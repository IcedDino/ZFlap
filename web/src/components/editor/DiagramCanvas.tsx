import { useRef, useState, useEffect, useCallback } from 'react'
import type { FAState, FATransition } from '../../hooks/useAutomaton'
import { STATE_R, FINAL_GAP } from '../../hooks/useAutomaton'
import type { Tool } from './FloatingToolbar'
import s from './DiagramCanvas.module.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const CURVE_OFF = 32    // perpendicular offset for bidirectional arcs
const MIN_ZOOM  = 0.2
const MAX_ZOOM  = 3.0
const MM_W      = 168   // minimap pixel width
const MM_H      = 108   // minimap pixel height

// ── Types ─────────────────────────────────────────────────────────────────────

export interface View { panX: number; panY: number; zoom: number }

type Drag =
  | { mode: 'idle' }
  | { mode: 'pan';   startPanX: number; startPanY: number; startSX: number; startSY: number }
  | { mode: 'state'; stateId: string;   offX: number; offY: number }
  | { mode: 'transition'; fromId: string }

interface TransitionDragState {
  fromId: string
  cursorX: number
  cursorY: number
  snapId: string | null
}

interface Popup {
  visible: boolean
  screenX: number; screenY: number
  fromId: string;  toId: string
}

// ── Label fit helper ──────────────────────────────────────────────────────────

const LABEL_AVAIL_W  = (STATE_R - 6) * 2   // usable diameter with padding
const LABEL_MAX_FONT = 22
const LABEL_MIN_FONT = 12
const CHAR_W_RATIO   = 0.62                 // monospace char width ÷ fontSize

function fitLabel(label: string): { text: string; fontSize: number } {
  if (label.length === 0) return { text: '', fontSize: LABEL_MAX_FONT }
  const rawFont = LABEL_AVAIL_W / (label.length * CHAR_W_RATIO)
  if (rawFont >= LABEL_MAX_FONT) return { text: label, fontSize: LABEL_MAX_FONT }
  if (rawFont >= LABEL_MIN_FONT) return { text: label, fontSize: Math.floor(rawFont) }
  const maxChars = Math.floor(LABEL_AVAIL_W / (LABEL_MIN_FONT * CHAR_W_RATIO))
  return { text: label.slice(0, maxChars - 1) + '…', fontSize: LABEL_MIN_FONT }
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function norm(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy) || 1
  return [dx / len, dy / len]
}

function toWorld(cx: number, cy: number, svg: SVGSVGElement, v: View) {
  const r = svg.getBoundingClientRect()
  return { x: (cx - r.left - v.panX) / v.zoom, y: (cy - r.top - v.panY) / v.zoom }
}

function toViewport(wx: number, wy: number, svg: SVGSVGElement, v: View) {
  const r = svg.getBoundingClientRect()
  return { x: wx * v.zoom + v.panX + r.left, y: wy * v.zoom + v.panY + r.top }
}

function hitState(states: FAState[], wx: number, wy: number): FAState | null {
  for (let i = states.length - 1; i >= 0; i--) {
    const st = states[i]
    if ((wx - st.x) ** 2 + (wy - st.y) ** 2 <= (STATE_R + 4) ** 2) return st
  }
  return null
}

function getTransId(target: EventTarget | null): string | null {
  if (!target || !(target instanceof Element)) return null
  return target.closest('[data-tid]')?.getAttribute('data-tid') ?? null
}

interface TransPath { d: string; lx: number; ly: number }

function computeTransPath(
  from: FAState, to: FAState,
  isTwin: boolean, isForward: boolean
): TransPath {
  // Self-loop
  if (from.id === to.id) {
    const { x, y } = from
    const sp = 14, h = 68
    const x1 = x - sp,    y1 = y - STATE_R + 2
    const x2 = x + sp,    y2 = y - STATE_R + 2
    const c1x = x - h * 0.55, c1y = y - h
    const c2x = x + h * 0.55, c2y = y - h
    return { d: `M ${x1},${y1} C ${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`, lx: x, ly: y - h - 10 }
  }

  const dx = to.x - from.x, dy = to.y - from.y
  const [ux, uy] = norm(dx, dy)
  const [px, py] = [-uy, ux]   // perpendicular

  if (!isTwin) {
    // Straight
    const x1 = from.x + ux * STATE_R, y1 = from.y + uy * STATE_R
    const x2 = to.x   - ux * STATE_R, y2 = to.y   - uy * STATE_R
    return { d: `M ${x1},${y1} L ${x2},${y2}`, lx: (x1+x2)/2 + px*(-14), ly: (y1+y2)/2 + py*(-14) }
  }

  // Quadratic bezier — curve to one side
  const sign = isForward ? 1 : -1
  const cpx = (from.x + to.x) / 2 + px * CURVE_OFF * sign
  const cpy = (from.y + to.y) / 2 + py * CURVE_OFF * sign

  const [fd0, fd1] = norm(cpx - from.x, cpy - from.y)
  const [td0, td1] = norm(to.x - cpx,   to.y - cpy)

  const x1 = from.x + fd0 * STATE_R, y1 = from.y + fd1 * STATE_R
  const x2 = to.x   - td0 * STATE_R, y2 = to.y   - td1 * STATE_R

  // Bezier midpoint (t=0.5)
  const bx = 0.25*x1 + 0.5*cpx + 0.25*x2
  const by = 0.25*y1 + 0.5*cpy + 0.25*y2

  return {
    d: `M ${x1},${y1} Q ${cpx},${cpy} ${x2},${y2}`,
    lx: bx + px * CURVE_OFF * sign * 0.28,
    ly: by + py * CURVE_OFF * sign * 0.28,
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PeerCursor {
  id:         string
  color:      string
  x:          number | null
  y:          number | null
  selectedId: string | null
}

interface Props {
  states:      FAState[]
  transitions: FATransition[]
  initialId:   string | null
  selectedId:  string | null
  tool:        Tool
  activeStateIds?:  Set<string>
  activeTransIds?:  Set<string>
  readOnly?:        boolean
  hideMinimap?:     boolean
  peers?:           PeerCursor[]
  onAddState:         (x: number, y: number) => void
  onMoveState:        (id: string, x: number, y: number) => void
  onDeleteState:      (id: string) => void
  onToggleFinal:      (id: string) => void
  onRenameState:      (id: string, label: string) => void
  onSetInitial:       (id: string) => void
  onAddTransition:    (fromId: string, toId: string, label: string) => void
  onDeleteTransition: (id: string) => void
  onSelect:           (id: string | null) => void
  onDeleteSelected:   () => void
  onViewChange?:      (v: View) => void
  onCursorMove?:      (x: number, y: number) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiagramCanvas({
  states, transitions, initialId, selectedId, tool,
  activeStateIds, activeTransIds, readOnly, hideMinimap, peers,
  onAddState, onMoveState, onDeleteState, onToggleFinal, onRenameState, onSetInitial,
  onAddTransition, onDeleteTransition, onSelect, onDeleteSelected,
  onViewChange, onCursorMove,
}: Props) {
  const svgRef   = useRef<SVGSVGElement>(null)
  const groupRef = useRef<SVGGElement>(null)
  const labelRef = useRef<HTMLInputElement>(null)

  // View stored in a ref — updated directly for pan/zoom (no React re-renders)
  const viewRef = useRef<View>({ panX: 0, panY: 0, zoom: 1 })
  const dragRef = useRef<Drag>({ mode: 'idle' })

  // View-change callback (mirrored to ref so applyView can call it without deps)
  const cbViewChange = useRef(onViewChange)
  cbViewChange.current = onViewChange

  // Live-collab cursor broadcast — throttled so we don't fire on every
  // native mousemove (dozens/sec) when live collaborators are watching
  const cbCursorMove  = useRef(onCursorMove)
  cbCursorMove.current = onCursorMove
  const lastCursorSentRef = useRef(0)

  // Minimap refs
  const mmRectRef = useRef<SVGRectElement>(null)
  const mmSvgRef  = useRef<SVGSVGElement>(null)
  const mmDragRef = useRef(false)

  // Mirrors of props as refs so native handlers always read current values
  // without needing to be in the effect dependency array
  const statesRef     = useRef(states)
  const transRef      = useRef(transitions)
  const selectedRef   = useRef(selectedId)
  const toolRef       = useRef(tool)
  const cbAdd         = useRef(onAddState)
  const cbMove        = useRef(onMoveState)
  const cbDelState    = useRef(onDeleteState)
  const cbToggle      = useRef(onToggleFinal)
  const cbRename      = useRef(onRenameState)
  const cbSetInitial  = useRef(onSetInitial)
  const cbAddTrans    = useRef(onAddTransition)
  const cbDelTrans    = useRef(onDeleteTransition)
  const cbSelect      = useRef(onSelect)
  const cbDelSelected   = useRef(onDeleteSelected)
  const readOnlyRef     = useRef(readOnly ?? false)
  const activeIdsRef    = useRef(activeStateIds)

  statesRef.current     = states
  transRef.current      = transitions
  selectedRef.current   = selectedId
  toolRef.current       = tool
  cbAdd.current         = onAddState
  cbMove.current        = onMoveState
  cbDelState.current    = onDeleteState
  cbToggle.current      = onToggleFinal
  cbRename.current      = onRenameState
  cbSetInitial.current  = onSetInitial
  cbAddTrans.current    = onAddTransition
  cbDelTrans.current    = onDeleteTransition
  cbSelect.current      = onSelect
  cbDelSelected.current = onDeleteSelected
  readOnlyRef.current   = readOnly ?? false
  activeIdsRef.current  = activeStateIds

  // React state for visuals that need a re-render
  const [transDrag, setTransDrag] = useState<TransitionDragState | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [popup, setPopup]         = useState<Popup>({ visible: false, screenX: 0, screenY: 0, fromId: '', toId: '' })
  const [labelDraft, setLabelDraft] = useState('')

  interface RenamePopup { stateId: string; screenX: number; screenY: number }
  const [renamePopup, setRenamePopup] = useState<RenamePopup | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  // ── Minimap world-bounds helper ───────────────────────────────────────────────

  function getMMBounds(sts: FAState[]) {
    if (sts.length === 0) return null
    const pad = STATE_R + FINAL_GAP + 20
    const xs  = sts.map(s => s.x)
    const ys  = sts.map(s => s.y)
    const cx  = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy  = (Math.min(...ys) + Math.max(...ys)) / 2
    // half-extent of state cluster
    const ex  = Math.max(Math.max(...xs) - cx, 1) + pad
    const ey  = Math.max(Math.max(...ys) - cy, 1) + pad
    // show 5× the cluster extent on each side, minimum ±2000 × ±1200 world units
    const hw  = Math.max(ex * 5, 2000)
    const hh  = Math.max(ey * 5, 1200)
    const bw  = hw * 2
    const bh  = hh * 2
    const scl = Math.min((MM_W - 4) / bw, (MM_H - 4) / bh)
    const ox  = (MM_W - bw * scl) / 2
    const oy  = (MM_H - bh * scl) / 2
    return { bx: cx - hw, by: cy - hh, scl, ox, oy }
  }

  // ── Apply pan/zoom directly to the SVG group transform ───────────────────────

  function applyView() {
    const { panX, panY, zoom } = viewRef.current
    groupRef.current?.setAttribute('transform', `translate(${panX},${panY}) scale(${zoom})`)

    // Always notify so DotCanvas stays in sync even before the first state exists
    cbViewChange.current?.({ ...viewRef.current })

    // Sync minimap viewport rect
    const b      = getMMBounds(statesRef.current)
    const mmRect = mmRectRef.current
    const svg    = svgRef.current
    if (!b || !mmRect || !svg) return
    const { width: sw, height: sh } = svg.getBoundingClientRect()
    const rx = ((-panX / zoom) - b.bx) * b.scl + b.ox
    const ry = ((-panY / zoom) - b.by) * b.scl + b.oy
    const rw = (sw / zoom) * b.scl
    const rh = (sh / zoom) * b.scl
    // no clamping — rect can bleed to the edge when drifted, acting as a direction indicator
    mmRect.setAttribute('x',      String(rx))
    mmRect.setAttribute('y',      String(ry))
    mmRect.setAttribute('width',  String(Math.max(2, rw)))
    mmRect.setAttribute('height', String(Math.max(2, rh)))
  }

  // ── Navigate canvas to a minimap-click world position ────────────────────────

  function panToMinimap(e: MouseEvent) {
    const mmSvg = mmSvgRef.current
    const svgEl = svgRef.current
    if (!mmSvg || !svgEl) return
    const b = getMMBounds(statesRef.current)
    if (!b) return
    const r   = mmSvg.getBoundingClientRect()
    const wx  = (e.clientX - r.left  - b.ox) / b.scl + b.bx
    const wy  = (e.clientY - r.top   - b.oy) / b.scl + b.by
    const svgR = svgEl.getBoundingClientRect()
    const z   = viewRef.current.zoom
    viewRef.current = { ...viewRef.current,
      panX: svgR.width  / 2 - wx * z,
      panY: svgR.height / 2 - wy * z,
    }
    applyView()
  }

  // ── Initialise pan to canvas centre ──────────────────────────────────────────

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const { width, height } = svg.getBoundingClientRect()
    viewRef.current = { panX: width / 2, panY: height / 2, zoom: 1 }
    applyView()
  }, [])

  // ── Re-sync minimap viewport rect after state add/move/delete ────────────────

  useEffect(() => { applyView() }, [states])

  // ── All mouse / keyboard / wheel events — native listeners ───────────────────

  useEffect(() => {
    const svg = svgRef.current!

    // ── mousedown ──
    function onDown(e: MouseEvent) {
      if (e.button !== 0) return
      e.preventDefault()

      const ro          = readOnlyRef.current
      const currentTool = toolRef.current
      const w           = toWorld(e.clientX, e.clientY, svg, viewRef.current)

      // Did we click a transition hit-zone?
      const tid = getTransId(e.target)
      if (tid) {
        if (!ro && currentTool === 'delete') { cbDelTrans.current(tid); return }
        if (!ro && currentTool === 'select') { cbSelect.current(tid);   return }
        return
      }

      // Did we hit a state?
      const st = hitState(statesRef.current, w.x, w.y)
      if (st) {
        if (!ro && currentTool === 'delete')  { cbDelState.current(st.id);    return }
        if (!ro && currentTool === 'final')   { cbToggle.current(st.id);     return }
        if (!ro && currentTool === 'initial') { cbSetInitial.current(st.id); return }
        if (!ro && currentTool === 'transition') {
          dragRef.current = { mode: 'transition', fromId: st.id }
          setTransDrag({ fromId: st.id, cursorX: w.x, cursorY: w.y, snapId: null })
          return
        }
        if (!ro && currentTool === 'select') {
          cbSelect.current(st.id)
          dragRef.current = { mode: 'state', stateId: st.id, offX: w.x - st.x, offY: w.y - st.y }
          return
        }
        // In readOnly mode: fall through to pan
      }

      // Empty canvas (or readOnly — always allow pan)
      if (!ro && currentTool === 'state') {
        cbAdd.current(w.x, w.y)
        return
      }
      if (ro || currentTool === 'select') {
        if (!ro) cbSelect.current(null)
        const v = viewRef.current
        dragRef.current = { mode: 'pan', startPanX: v.panX, startPanY: v.panY, startSX: e.clientX, startSY: e.clientY }
      }
    }

    // ── mousemove ──
    function onMove(e: MouseEvent) {
      if (mmDragRef.current) { panToMinimap(e); return }

      if (cbCursorMove.current) {
        const now = performance.now()
        if (now - lastCursorSentRef.current > 80) {
          lastCursorSentRef.current = now
          const w = toWorld(e.clientX, e.clientY, svg, viewRef.current)
          cbCursorMove.current(w.x, w.y)
        }
      }

      const d = dragRef.current

      if (d.mode === 'idle') {
        const w = toWorld(e.clientX, e.clientY, svg, viewRef.current)
        const hit = hitState(statesRef.current, w.x, w.y)
        setHoveredId(hit?.id ?? null)
        return
      }

      if (d.mode === 'pan') {
        viewRef.current = {
          ...viewRef.current,
          panX: d.startPanX + e.clientX - d.startSX,
          panY: d.startPanY + e.clientY - d.startSY,
        }
        applyView()
        setPopup(p => p.visible ? { ...p, visible: false } : p)
        return
      }

      if (d.mode === 'state') {
        const w = toWorld(e.clientX, e.clientY, svg, viewRef.current)
        cbMove.current(d.stateId, w.x - d.offX, w.y - d.offY)
        return
      }

      if (d.mode === 'transition') {
        const w    = toWorld(e.clientX, e.clientY, svg, viewRef.current)
        const snap = hitState(statesRef.current, w.x, w.y)
        setTransDrag({ fromId: d.fromId, cursorX: w.x, cursorY: w.y, snapId: snap?.id ?? null })
        setHoveredId(snap?.id ?? null)
      }
    }

    // ── mouseup ──
    function onUp(e: MouseEvent) {
      mmDragRef.current = false
      const d = dragRef.current
      dragRef.current = { mode: 'idle' }

      if (d.mode === 'transition') {
        setTransDrag(null)
        setHoveredId(null)
        const w    = toWorld(e.clientX, e.clientY, svg, viewRef.current)
        const snap = hitState(statesRef.current, w.x, w.y)
        if (!snap) return

        const fromSt = statesRef.current.find(s => s.id === d.fromId)!
        const isSelf = snap.id === d.fromId
        const midWX = isSelf ? fromSt.x              : (fromSt.x + snap.x) / 2
        const midWY = isSelf ? fromSt.y - STATE_R - 44 : (fromSt.y + snap.y) / 2
        const vp = toViewport(midWX, midWY, svg, viewRef.current)
        setPopup({ visible: true, screenX: vp.x, screenY: vp.y, fromId: d.fromId, toId: snap.id })
        setLabelDraft('')
        requestAnimationFrame(() => labelRef.current?.focus())
      }
    }

    // ── dblclick: rename state ──
    function onDbl(e: MouseEvent) {
      if (readOnlyRef.current) return
      const w  = toWorld(e.clientX, e.clientY, svg, viewRef.current)
      const st = hitState(statesRef.current, w.x, w.y)
      if (!st) return
      const vp = toViewport(st.x, st.y, svg, viewRef.current)
      setRenamePopup({ stateId: st.id, screenX: vp.x, screenY: vp.y })
      setRenameDraft(st.label)
      requestAnimationFrame(() => { renameRef.current?.select() })
    }

    // ── wheel: two-finger scroll → pan · pinch / Ctrl+scroll → zoom ──
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const v = viewRef.current

      if (e.ctrlKey) {
        // Pinch-to-zoom or Ctrl+scroll — zoom toward cursor
        const r  = svg.getBoundingClientRect()
        const sx = e.clientX - r.left
        const sy = e.clientY - r.top
        const factor  = e.deltaY < 0 ? 1.09 : 1 / 1.09
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * factor))
        const wx = (sx - v.panX) / v.zoom
        const wy = (sy - v.panY) / v.zoom
        viewRef.current = { zoom: newZoom, panX: sx - wx * newZoom, panY: sy - wy * newZoom }
      } else {
        // Two-finger scroll — pan
        viewRef.current = {
          ...v,
          panX: v.panX - e.deltaX,
          panY: v.panY - e.deltaY,
        }
      }

      applyView()
      setPopup(p => p.visible ? { ...p, visible: false } : p)
    }

    // ── keyboard: delete selected, escape, tool shortcuts ──
    function onKey(e: KeyboardEvent) {
      if (readOnlyRef.current) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        cbDelSelected.current()
      }
      if (e.key === 'Escape') cbSelect.current(null)
    }

    svg.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    svg.addEventListener('dblclick', onDbl)
    svg.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)

    return () => {
      svg.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      svg.removeEventListener('dblclick', onDbl)
      svg.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [])   // empty — all mutable state accessed via refs

  // ── Label popup confirm / cancel ─────────────────────────────────────────────

  const confirmLabel = useCallback(() => {
    if (!popup.visible) return
    cbAddTrans.current(popup.fromId, popup.toId, labelDraft.trim() || 'ε')
    setPopup(p => ({ ...p, visible: false }))
  }, [popup, labelDraft])

  const cancelLabel = useCallback(() => setPopup(p => ({ ...p, visible: false })), [])

  const confirmRename = useCallback(() => {
    if (!renamePopup) return
    const label = renameDraft.trim()
    if (label) cbRename.current(renamePopup.stateId, label)
    setRenamePopup(null)
  }, [renamePopup, renameDraft])

  const cancelRename = useCallback(() => setRenamePopup(null), [])

  // ── Twin detection (bidirectional pairs) ─────────────────────────────────────

  const twinSet = new Set<string>()
  for (const t of transitions) {
    if (transitions.some(r => r.fromId === t.toId && r.toId === t.fromId)) {
      twinSet.add(t.id)
    }
  }

  // ── Transition preview geometry ───────────────────────────────────────────────

  const previewPath = (() => {
    if (!transDrag) return null
    const from = states.find(s => s.id === transDrag.fromId)
    if (!from) return null
    const snap = transDrag.snapId ? states.find(s => s.id === transDrag.snapId) : null

    if (snap && snap.id === from.id) {
      // Self-loop preview
      const { x, y } = from
      const sp = 14, h = 68
      return `M ${x-sp},${y-STATE_R+2} C ${x-h*.55},${y-h} ${x+h*.55},${y-h} ${x+sp},${y-STATE_R+2}`
    }

    const ex = snap ? snap.x : transDrag.cursorX
    const ey = snap ? snap.y : transDrag.cursorY
    const [ux, uy] = norm(ex - from.x, ey - from.y)
    const x1 = from.x + ux * STATE_R, y1 = from.y + uy * STATE_R
    const x2 = snap ? snap.x - ux * STATE_R : ex
    const y2 = snap ? snap.y - uy * STATE_R : ey
    return `M ${x1},${y1} L ${x2},${y2}`
  })()

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={s.root}>
      <svg ref={svgRef} className={s.svg}>
        <defs>
          <marker id="arrowD" markerWidth="7" markerHeight="6"
            refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0.5 L0,5.5 L6.5,3 z" fill="#C8C3BA" />
          </marker>
          <marker id="arrowS" markerWidth="7" markerHeight="6"
            refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0.5 L0,5.5 L6.5,3 z" fill="#F97316" />
          </marker>
          <marker id="arrowP" markerWidth="7" markerHeight="6"
            refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0.5 L0,5.5 L6.5,3 z" fill="#AAA49A" />
          </marker>
          <marker id="arrowA" markerWidth="7" markerHeight="6"
            refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0.5 L0,5.5 L6.5,3 z" fill="#16A34A" />
          </marker>
        </defs>

        <g ref={groupRef}>

          {/* ── Transitions ── */}
          {transitions.map(t => {
            const from = states.find(s => s.id === t.fromId)
            const to   = states.find(s => s.id === t.toId)
            if (!from || !to) return null

            const isSel    = t.id === selectedId
            const isActive = activeTransIds?.has(t.id) ?? false
            const isTwin   = twinSet.has(t.id)
            const isFwd    = !isTwin || t.fromId < t.toId
            const { d, lx, ly } = computeTransPath(from, to, isTwin, isFwd)

            const stroke    = isActive ? '#16A34A' : isSel ? '#F97316' : '#C8C3BA'
            const strokeW   = isActive ? 2.5       : isSel ? 2         : 1.5
            const arrow     = isActive ? 'url(#arrowA)' : isSel ? 'url(#arrowS)' : 'url(#arrowD)'
            const labelFill = isActive ? '#15803D' : isSel ? '#EA6C0A' : '#6B6459'

            return (
              <g key={t.id}>
                {/* Active glow */}
                {isActive && (
                  <path d={d} stroke="rgba(22,163,74,0.18)" strokeWidth={8} fill="none" pointerEvents="none" />
                )}
                {/* Wide transparent hit zone carries data-tid for click detection */}
                <path
                  d={d}
                  stroke="transparent" strokeWidth={18} fill="none"
                  data-tid={t.id}
                  style={{ cursor: tool === 'delete' ? 'not-allowed' : 'pointer' }}
                />
                {/* Visible path */}
                <path
                  d={d}
                  stroke={stroke}
                  strokeWidth={strokeW}
                  fill="none"
                  markerEnd={arrow}
                  pointerEvents="none"
                />
                {/* Label */}
                <text
                  x={lx} y={ly}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={13} fontFamily="JetBrains Mono, monospace"
                  fill={labelFill}
                  pointerEvents="none"
                  style={{ userSelect: 'none' }}
                >
                  {t.label}
                </text>
              </g>
            )
          })}

          {/* ── Transition drag preview ── */}
          {previewPath && (
            <path
              d={previewPath}
              stroke="#AAA49A" strokeWidth={1.5}
              strokeDasharray="6 4" fill="none"
              markerEnd="url(#arrowP)"
              pointerEvents="none"
            />
          )}

          {/* ── States ── */}
          {states.map(st => {
            const isSel      = st.id === selectedId
            const isInit     = st.id === initialId
            const isHov      = st.id === hoveredId
            const isDragSrc  = transDrag?.fromId === st.id
            const isDragSnap = transDrag?.snapId  === st.id
            const isActive   = activeStateIds?.has(st.id) ?? false
            const peerHere   = peers?.find(p => p.selectedId === st.id)

            const fill   = isActive ? '#F0FDF4' : isSel ? '#FFF7ED' : '#FFFFFF'
            const stroke = isActive ? '#16A34A' : isSel ? '#F97316' : (isHov || isDragSnap) ? '#C8C3BA' : '#E6E2DA'
            const sw     = isActive ? 2.5 : isSel ? 2 : 1.5
            const tFill  = isActive ? '#15803D' : isSel ? '#EA6C0A' : '#1A1814'

            return (
              <g key={st.id}>
                {/* A live collaborator has this state selected */}
                {peerHere && (
                  <circle cx={st.x} cy={st.y} r={STATE_R + 16}
                    fill="none"
                    stroke={peerHere.color}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    pointerEvents="none"
                  />
                )}

                {/* Active state glow */}
                {isActive && (
                  <circle cx={st.x} cy={st.y} r={STATE_R + 12}
                    fill="rgba(22,163,74,0.10)"
                    stroke="rgba(22,163,74,0.20)"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                )}

                {/* Snap / source glow */}
                {(isDragSrc || isDragSnap) && (
                  <circle cx={st.x} cy={st.y} r={STATE_R + 13}
                    fill="rgba(249,115,22,0.07)"
                    stroke="rgba(249,115,22,0.22)"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                )}

                {/* Final outer ring */}
                {st.isFinal && (
                  <circle cx={st.x} cy={st.y} r={STATE_R + FINAL_GAP}
                    fill="none"
                    stroke={isSel ? '#F97316' : '#E6E2DA'}
                    strokeWidth={sw}
                  />
                )}

                {/* Body */}
                <circle cx={st.x} cy={st.y} r={STATE_R}
                  fill={fill} stroke={stroke} strokeWidth={sw}
                  style={{ transition: 'fill 0.15s, stroke 0.15s' }}
                />

                {/* Initial arrow */}
                {isInit && (
                  <g pointerEvents="none">
                    <line
                      x1={st.x - STATE_R - 24} y1={st.y}
                      x2={st.x - STATE_R - 2}  y2={st.y}
                      stroke={isSel ? '#F97316' : '#AAA49A'} strokeWidth={1.5}
                    />
                    <path
                      d={`M${st.x-STATE_R-9},${st.y-5} L${st.x-STATE_R-1},${st.y} L${st.x-STATE_R-9},${st.y+5}`}
                      fill="none"
                      stroke={isSel ? '#F97316' : '#AAA49A'}
                      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
                    />
                  </g>
                )}

                {/* Label */}
                {(() => {
                  const { text, fontSize } = fitLabel(st.label)
                  return (
                    <text
                      x={st.x} y={st.y}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={fontSize} fontFamily="Inter, sans-serif" fontWeight={600}
                      fill={tFill}
                      pointerEvents="none"
                      style={{ userSelect: 'none' }}
                    >
                      {text}
                    </text>
                  )
                })()}
              </g>
            )
          })}

          {/* ── Live collaborators' cursors ── */}
          {peers?.filter(p => p.x !== null && p.y !== null).map(p => (
            <g key={p.id} pointerEvents="none">
              <path
                d={`M${p.x},${p.y} L${p.x! + 3},${p.y! + 14} L${p.x! + 6.5},${p.y! + 9.5} L${p.x! + 12},${p.y! + 10.5} Z`}
                fill={p.color}
                stroke="#FFFFFF"
                strokeWidth={1.2}
              />
            </g>
          ))}

        </g>
      </svg>

      {/* ── Minimap ── */}
      {!hideMinimap && (() => {
        const b = getMMBounds(states)
        if (!b) return null
        const { bx, by, scl, ox, oy } = b
        const toMX = (wx: number) => (wx - bx) * scl + ox
        const toMY = (wy: number) => (wy - by) * scl + oy
        const stR  = Math.max(2, STATE_R * scl)

        return (
          <div className={s.minimap}>
            <svg
              ref={mmSvgRef}
              width={MM_W} height={MM_H}
              onMouseDown={e => {
                e.stopPropagation()
                mmDragRef.current = true
                panToMinimap(e.nativeEvent)
              }}
            >
              {/* Transitions */}
              {transitions.map(t => {
                const f = states.find(st => st.id === t.fromId)
                const o = states.find(st => st.id === t.toId)
                if (!f || !o) return null
                if (f.id === o.id) return null
                return <line key={t.id}
                  x1={toMX(f.x)} y1={toMY(f.y)}
                  x2={toMX(o.x)} y2={toMY(o.y)}
                  stroke="#C8C3BA" strokeWidth={0.8} />
              })}

              {/* States */}
              {states.map(st => (
                <circle key={st.id}
                  cx={toMX(st.x)} cy={toMY(st.y)} r={stR}
                  fill={
                    activeStateIds?.has(st.id) ? '#16A34A' :
                    st.id === selectedId        ? '#F97316' : '#6B6459'
                  }
                  stroke={st.id === initialId ? '#AAA49A' : 'none'}
                  strokeWidth={1}
                />
              ))}

              {/* Viewport indicator — position/size set imperatively by applyView */}
              <rect ref={mmRectRef}
                x={-9999} y={-9999} width={0} height={0}
                fill="rgba(249,115,22,0.07)"
                stroke="#F97316" strokeWidth={1}
                rx={3} pointerEvents="none"
              />
            </svg>
          </div>
        )
      })()}

      {/* ── Label popup (HTML overlay, position: fixed) ── */}
      {popup.visible && (
        <div
          className={s.popup}
          style={{ left: popup.screenX, top: popup.screenY }}
        >
          <span className={s.popupHint}>Transition label</span>
          <input
            ref={labelRef}
            className={s.popupInput}
            value={labelDraft}
            onChange={e => setLabelDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  { e.preventDefault(); confirmLabel() }
              if (e.key === 'Escape') { e.preventDefault(); cancelLabel()  }
              e.stopPropagation()
            }}
            placeholder="ε"
            maxLength={8}
            spellCheck={false}
          />
          <button className={s.popupOk}     onClick={confirmLabel}>Add</button>
          <button className={s.popupCancel} onClick={cancelLabel}>✕</button>
        </div>
      )}

      {/* ── Rename popup (HTML overlay, position: fixed) ── */}
      {renamePopup && (
        <div
          className={s.popup}
          style={{ left: renamePopup.screenX, top: renamePopup.screenY }}
        >
          <span className={s.popupHint}>State name</span>
          <input
            ref={renameRef}
            className={s.popupInput}
            value={renameDraft}
            onChange={e => setRenameDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  { e.preventDefault(); confirmRename() }
              if (e.key === 'Escape') { e.preventDefault(); cancelRename()  }
              e.stopPropagation()
            }}
            maxLength={16}
            spellCheck={false}
          />
          <button className={s.popupOk}     onClick={confirmRename}>OK</button>
          <button className={s.popupCancel} onClick={cancelRename}>✕</button>
        </div>
      )}
    </div>
  )
}
