import { useRef, useState, useEffect, useCallback } from 'react'
import type { FAState, FATransition, FATransitionKind, AutomatonType } from '../../hooks/useAutomaton'
import { STATE_R, FINAL_GAP } from '../../hooks/useAutomaton'
import type { Tool } from './FloatingToolbar'
import s from './DiagramCanvas.module.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const CURVE_OFF = 52    // perpendicular offset for bidirectional arcs
const FAN_OFF   = 28    // spacing between parallel outgoing/incoming transition lanes
const LABEL_GAP  = 14   // clearance between a transition stroke and its nearest label line
const LABEL_LINE = 14   // line height of a stacked multi-symbol transition label
// dominant-baseline="middle" centres on half the x-height, but a label's optical
// centre is half the cap-height, so glyphs land slightly above their anchor.
// Nudging back down keeps the clearance equal above and below the stroke.
const LABEL_RISE = 2    // optical-centre correction, world units
const LOOP_R     = 46   // default radius of the self-loop circle
const LOOP_MIN_R = 20   // below this the loop barely clears the state
// The loop circle must still cross the state circle to have attachment points.
// dist = STATE_R + r*0.55 stays inside |STATE_R - r| < dist < STATE_R + r for
// any r below STATE_R * 40/9; round down for margin.
const LOOP_MAX_R = STATE_R * 4
const MAX_BEND   = 1400 // clamp on a hand-dragged arc, world units
const BEND_SNAP  = 12   // drag within this of the automatic arc releases the override
const MIN_ZOOM  = 0.2
const MAX_ZOOM  = 3.0
const MM_W      = 168   // minimap pixel width
const MM_H      = 108   // minimap pixel height

// ── Types ─────────────────────────────────────────────────────────────────────

export interface View { panX: number; panY: number; zoom: number }

interface EdgeLayout { isTwin: boolean; isForward: boolean; fanIndex: number; fanCount: number }

type Drag =
  | { mode: 'idle' }
  | { mode: 'pan';   startPanX: number; startPanY: number; startSX: number; startSY: number }
  | { mode: 'state'; stateId: string; offX: number; offY: number }
  | { mode: 'group'; startX: number; startY: number; origins: Map<string, { x: number; y: number }> }
  | { mode: 'rect-select'; startSX: number; startSY: number; currentSX: number; currentSY: number }
  | { mode: 'transition'; fromId: string }
  | { mode: 'curve'; transId: string; moved: boolean; layout: EdgeLayout }

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
  editingTransitionId: string | null
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

// ── Collision push ────────────────────────────────────────────────────────────
// States all live on one z-plane — they can never stack. Dragging one into
// another shoves the other(s) aside instead of overlapping. Runs as a small
// position-based-dynamics relaxation: a handful of passes over every pair,
// each pass nudging apart whatever's still too close. The dragged state is
// pinned (only *other* states move because of it) so it stays glued to the
// cursor; two states pushed into each other by a chain reaction split the
// correction evenly between them.

const PUSH_GAP        = 16   // minimum breathing room between circle edges
const PUSH_ITERATIONS = 4
const GOLDEN_ANGLE    = 2.399963229728653   // radians — spreads coincident states apart

function effRadius(st: FAState): number {
  return STATE_R + (st.isFinal ? FINAL_GAP : 0)
}

function resolveCollisions(
  states: FAState[], draggedId: string, x: number, y: number
): Map<string, { x: number; y: number }> {
  const pos = new Map(states.map(st => [st.id, { x: st.x, y: st.y }]))
  pos.set(draggedId, { x, y })

  // Spatial hash: only compare states in nearby cells instead of every pair.
  // The cell is intentionally a little larger than the maximum collision
  // diameter, so dense diagrams stay close to O(n) per relaxation pass.
  const CELL = STATE_R * 2 + PUSH_GAP + FINAL_GAP
  for (let pass = 0; pass < PUSH_ITERATIONS; pass++) {
    const grid = new Map<string, FAState[]>()
    const cellKey = (x: number, y: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`

    for (const st of states) {
      const p = pos.get(st.id)!
      const key = cellKey(p.x, p.y)
      const bucket = grid.get(key)
      if (bucket) bucket.push(st)
      else grid.set(key, [st])
    }

    for (const a of states) {
      const pa = pos.get(a.id)!
      const cellX = Math.floor(pa.x / CELL)
      const cellY = Math.floor(pa.y / CELL)

      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const bucket = grid.get(`${cellX + ox},${cellY + oy}`)
          if (!bucket) continue

          for (const b of bucket) {
            if (a.id >= b.id) continue
            const pb = pos.get(b.id)!
            const minDist = effRadius(a) + effRadius(b) + PUSH_GAP
            let dx = pb.x - pa.x, dy = pb.y - pa.y
            let dist = Math.hypot(dx, dy)
            if (dist >= minDist) continue

            if (dist === 0) {
              const angle = (b.id.length % 31) * GOLDEN_ANGLE
              dx = Math.cos(angle); dy = Math.sin(angle); dist = 1
            }
            const nx = dx / dist, ny = dy / dist
            const overlap = minDist - dist
            const aPinned = a.id === draggedId, bPinned = b.id === draggedId

            if (aPinned) {
              pb.x += nx * overlap; pb.y += ny * overlap
            } else if (bPinned) {
              pa.x -= nx * overlap; pa.y -= ny * overlap
            } else {
              pa.x -= nx * overlap / 2; pa.y -= ny * overlap / 2
              pb.x += nx * overlap / 2; pb.y += ny * overlap / 2
            }
          }
        }
      }
    }
  }

  const updates = new Map<string, { x: number; y: number }>()
  for (const st of states) {
    const p = pos.get(st.id)!
    if (st.id === draggedId || p.x !== st.x || p.y !== st.y) updates.set(st.id, p)
  }
  return updates
}

function getTransId(target: EventTarget | null): string | null {
  if (!target || !(target instanceof Element)) return null
  return target.closest('[data-tid]')?.getAttribute('data-tid') ?? null
}

// A self-loop is a real circle that overlaps the state, drawn as the major arc
// between the two circle intersections. That reads as a round loop instead of
// the flat teardrop a shallow bezier produces at this state radius.
function loopDist(r: number): number { return STATE_R + r * 0.55 }

function clampLoopRadius(r: number): number {
  return Math.min(LOOP_MAX_R, Math.max(LOOP_MIN_R, r))
}

function selfLoopPath(x: number, y: number, radius = LOOP_R): { d: string; topY: number } {
  const r = clampLoopRadius(radius)
  const dist = loopDist(r)
  const a = (dist * dist + STATE_R * STATE_R - r * r) / (2 * dist)
  const half = Math.sqrt(Math.max(STATE_R * STATE_R - a * a, 1))   // half-chord between intersections
  const ay = y - a
  return {
    d: `M ${x - half},${ay} A ${r} ${r} 0 1 1 ${x + half},${ay}`,
    topY: y - dist - r,
  }
}

// lx/ly anchor the label stack; nx/ny is the unit normal pointing away from the
// stroke, so the renderer can grow a multi-symbol stack without crossing the line.
// ax/ay is the apex — the point on the stroke the drag handle rides.
interface TransPath { d: string; lx: number; ly: number; nx: number; ny: number; ax: number; ay: number }

// The automatic arc for an edge, in the same units a hand-dragged `curve`
// stores. Shared with the drag handler so it can tell "back at the default"
// from "deliberately flat" and drop the override instead of pinning it.
function autoBend(isTwin: boolean, isForward: boolean, fanIndex: number, fanCount: number): number {
  const fanOffset = fanCount > 1 ? (fanIndex - (fanCount - 1) / 2) * FAN_OFF : 0
  return (isTwin ? CURVE_OFF * (isForward ? 1 : -1) : 0) + fanOffset
}

// Resolves every edge's twin/fan routing in one pass. Both the renderer and the
// curve-drag handler read from this, so a dragged edge is always measured
// against the exact lane it was drawn in.
function computeEdgeLayout(
  transitions: FATransition[],
  stateById: Map<string, FAState>,
): Map<string, EdgeLayout> {
  const reverseKeys = new Set(transitions.map(t => `${t.toId}\0${t.fromId}`))

  // Fan transitions that share a source into deterministic visual lanes.
  // Transitions to the same target are already merged in useAutomaton, so each
  // entry here represents a distinct visual edge.
  const outgoing = new Map<string, FATransition[]>()
  for (const t of transitions) {
    if (t.fromId === t.toId) continue
    const group = outgoing.get(t.fromId)
    if (group) group.push(t)
    else outgoing.set(t.fromId, [t])
  }
  for (const group of outgoing.values()) {
    group.sort((a, b) => {
      const ta = stateById.get(a.toId), tb = stateById.get(b.toId)
      if (!ta || !tb) return a.toId.localeCompare(b.toId)
      const sa = stateById.get(a.fromId)!
      const aa = Math.atan2(ta.y - sa.y, ta.x - sa.x)
      const ab = Math.atan2(tb.y - sa.y, tb.x - sa.x)
      return aa - ab || a.toId.localeCompare(b.toId)
    })
  }

  const layout = new Map<string, EdgeLayout>()
  for (const t of transitions) {
    const isTwin = reverseKeys.has(`${t.fromId}\0${t.toId}`)
    const group  = outgoing.get(t.fromId) ?? []
    layout.set(t.id, {
      isTwin,
      isForward: !isTwin || t.fromId < t.toId,
      fanIndex:  Math.max(0, group.findIndex(edge => edge.id === t.id)),
      fanCount:  group.length,
    })
  }
  return layout
}

// Turns a cursor position into the `curve` value that puts the edge's apex under
// it. The apex is the quadratic's midpoint, which sits half way to the control
// point — but the two endpoints are pushed off the chord as well, since they
// follow the control point's direction around each state's rim. Working that
// through, apexPerp = bend * (0.5 + 0.5 * STATE_R / hypot(halfChord, bend)),
// which has bend on both sides; a few fixed-point passes settle it to well
// under a pixel.
function bendForCursor(from: FAState, to: FAState, isForward: boolean, wx: number, wy: number): number {
  const canonicalFrom = isForward ? from : to
  const canonicalTo   = isForward ? to : from
  const [cux, cuy] = norm(canonicalTo.x - canonicalFrom.x, canonicalTo.y - canonicalFrom.y)
  const target = (wx - (from.x + to.x) / 2) * -cuy + (wy - (from.y + to.y) / 2) * cux

  const halfChord = Math.hypot(to.x - from.x, to.y - from.y) / 2
  let bend = target * 2
  for (let i = 0; i < 4; i++) {
    const h = Math.max(Math.hypot(halfChord, bend), 1)
    bend = target / (0.5 + 0.5 * STATE_R / h)
  }
  return Math.max(-MAX_BEND, Math.min(MAX_BEND, bend))
}

function computeTransPath(
  from: FAState, to: FAState,
  isTwin: boolean, isForward: boolean,
  fanIndex = 0, fanCount = 1,
  curve?: number
): TransPath {
  // Self-loop — `curve` carries the loop's radius rather than a bend.
  if (from.id === to.id) {
    const loop = selfLoopPath(from.x, from.y, curve ?? LOOP_R)
    return { d: loop.d, lx: from.x, ly: loop.topY - 12, nx: 0, ny: -1, ax: from.x, ay: loop.topY }
  }

  const dx = to.x - from.x, dy = to.y - from.y
  const [ux, uy] = norm(dx, dy)
  const [px, py] = [-uy, ux]   // perpendicular
  const hasFan = fanCount > 1

  if (curve === undefined && !isTwin && !hasFan) {
    // Straight
    const x1 = from.x + ux * STATE_R, y1 = from.y + uy * STATE_R
    const x2 = to.x   - ux * STATE_R, y2 = to.y   - uy * STATE_R
    return {
      d: `M ${x1},${y1} L ${x2},${y2}`,
      lx: (x1+x2)/2 - px*LABEL_GAP, ly: (y1+y2)/2 - py*LABEL_GAP,
      nx: -px, ny: -py,
      ax: (x1+x2)/2, ay: (y1+y2)/2,
    }
  }

  // Quadratic bezier. Besides reciprocal transitions, fan out all edges
  // sharing the same source so 2–4 outgoing transitions cannot sit on the
  // same visual lane. Reciprocal pairs keep their opposite-side routing.
  // The perpendicular vector changes sign when the direction is reversed, so
  // compute it from one canonical direction and then choose opposite bends.
  const canonicalFrom = isForward ? from : to
  const canonicalTo   = isForward ? to : from
  const [cux, cuy] = norm(canonicalTo.x - canonicalFrom.x, canonicalTo.y - canonicalFrom.y)
  const [cpxUnit, cpyUnit] = [-cuy, cux]
  const bend = curve ?? autoBend(isTwin, isForward, fanIndex, fanCount)
  const cpx = (from.x + to.x) / 2 + cpxUnit * bend
  const cpy = (from.y + to.y) / 2 + cpyUnit * bend

  const [fd0, fd1] = norm(cpx - from.x, cpy - from.y)
  const [td0, td1] = norm(to.x - cpx,   to.y - cpy)

  const x1 = from.x + fd0 * STATE_R, y1 = from.y + fd1 * STATE_R
  const x2 = to.x   - td0 * STATE_R, y2 = to.y   - td1 * STATE_R

  // Bezier midpoint (t=0.5)
  const bx = 0.25*x1 + 0.5*cpx + 0.25*x2
  const by = 0.25*y1 + 0.5*cpy + 0.25*y2

  // Sit on the outside of the bend, a fixed distance off the stroke. The middle
  // lane of an odd fan has no bend at all, so it falls back to the side that
  // straight edges use rather than landing on top of its own line.
  const [nx, ny] = bend > 0 ? [cpxUnit, cpyUnit]
                 : bend < 0 ? [-cpxUnit, -cpyUnit]
                 : [-px, -py]
  return {
    d: `M ${x1},${y1} Q ${cpx},${cpy} ${x2},${y2}`,
    lx: bx + nx * LABEL_GAP,
    ly: by + ny * LABEL_GAP,
    nx, ny,
    ax: bx, ay: by,
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
  automatonType?: AutomatonType
  activeStateIds?:  Set<string>
  activeTransIds?:  Set<string>
  readOnly?:        boolean
  hideMinimap?:     boolean
  peers?:           PeerCursor[]
  onAddState:         (x: number, y: number) => void
  onMoveStates:       (updates: { id: string; x: number; y: number }[]) => void
  onDeleteState:      (id: string) => void
  onToggleFinal:      (id: string) => void
  onRenameState:      (id: string, label: string) => void
  onSetInitial:       (id: string) => void
  onAddTransition:    (fromId: string, toId: string, label: string, kind?: FATransitionKind, rangeStart?: string, rangeEnd?: string) => void
  onEditTransition?:  (id: string, label: string, kind?: FATransitionKind, rangeStart?: string, rangeEnd?: string) => void
  onCurveTransition?: (id: string, curve: number | undefined) => void
  onDeleteTransition: (id: string) => void
  onSelect:           (id: string | null) => void
  onDeleteSelected:   () => void
  onViewChange?:      (v: View) => void
  onCursorMove?:      (x: number, y: number) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiagramCanvas({
  states, transitions, initialId, selectedId, tool, automatonType = 'dfa',
  activeStateIds, activeTransIds, readOnly, hideMinimap, peers,
  onAddState, onMoveStates, onDeleteState, onToggleFinal, onRenameState, onSetInitial,
  onAddTransition, onEditTransition, onCurveTransition, onDeleteTransition, onSelect, onDeleteSelected,
  onViewChange, onCursorMove,
}: Props) {
  const isTmType = automatonType.startsWith('tm-')
  const svgRef   = useRef<SVGSVGElement>(null)
  const groupRef = useRef<SVGGElement>(null)
  const labelRef = useRef<HTMLInputElement>(null)
  const rangeStartRef = useRef<HTMLInputElement>(null)
  const rangeEndRef = useRef<HTMLInputElement>(null)

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
  const suppressContextMenuRef = useRef(false)
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ startDistance: number; startZoom: number; startPanX: number; startPanY: number; startCenterX: number; startCenterY: number; startWorldX: number; startWorldY: number } | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressRef = useRef<{ pointerId: number; startX: number; startY: number; fired: boolean } | null>(null)
  const touchMovedRef = useRef(false)
  const lastTapRef = useRef<{ time: number; x: number; y: number; stateId: string | null; transId: string | null }>({ time: 0, x: 0, y: 0, stateId: null, transId: null })
  const touchStartHitRef = useRef<{ stateId: string | null; transId: string | null }>({ stateId: null, transId: null })

  // Mirrors of props as refs so native handlers always read current values
  // without needing to be in the effect dependency array
  const statesRef     = useRef(states)
  const transRef      = useRef(transitions)
  const selectedRef   = useRef(selectedId)
  const toolRef       = useRef(tool)
  const cbAdd         = useRef(onAddState)
  const cbMoveStates   = useRef(onMoveStates)
  const cbDelState    = useRef(onDeleteState)
  const cbToggle      = useRef(onToggleFinal)
  const cbRename      = useRef(onRenameState)
  const cbSetInitial  = useRef(onSetInitial)
  const cbAddTrans    = useRef(onAddTransition)
  const cbEditTrans   = useRef(onEditTransition)
  const cbCurveTrans  = useRef(onCurveTransition)
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
  cbMoveStates.current   = onMoveStates
  cbDelState.current    = onDeleteState
  cbToggle.current      = onToggleFinal
  cbRename.current      = onRenameState
  cbSetInitial.current  = onSetInitial
  cbAddTrans.current    = onAddTransition
  cbEditTrans.current   = onEditTransition
  cbCurveTrans.current  = onCurveTransition
  cbDelTrans.current    = onDeleteTransition
  cbSelect.current      = onSelect
  cbDelSelected.current = onDeleteSelected
  readOnlyRef.current   = readOnly ?? false
  activeIdsRef.current  = activeStateIds

  // React state for visuals that need a re-render
  const [transDrag, setTransDrag] = useState<TransitionDragState | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [popup, setPopup]         = useState<Popup>({ visible: false, screenX: 0, screenY: 0, fromId: '', toId: '', editingTransitionId: null })
  const [labelDraft, setLabelDraft] = useState('')
  const [rangeMode, setRangeMode] = useState(false)
  const [rangeStartDraft, setRangeStartDraft] = useState('')
  const [rangeEndDraft, setRangeEndDraft] = useState('')
  const [rangeError, setRangeError] = useState('')
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const selectedIdsRef = useRef<Set<string>>(new Set())

  // Editing popups belong to Select mode. Switching to another editing tool
  // must close any state/transition editor that is still open.
  useEffect(() => {
    if (tool === 'select') return
    setPopup(p => p.visible ? { ...p, visible: false } : p)
    setRenamePopup(null)
  }, [tool])

  // TM transition popup fields
  const [tmRead, setTmRead]       = useState('')
  const [tmWrite, setTmWrite]     = useState('')
  const [tmDir, setTmDir]         = useState<'L' | 'R' | 'S'>('R')

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

  function panToMinimap(e: { clientX: number; clientY: number }) {
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

    function clearLongPress() {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      longPressRef.current = null
    }

    function beginPinch() {
      const points = [...activePointersRef.current.values()]
      if (points.length < 2 || !svg) return
      const a = points[0], b = points[1]
      const dx = b.x - a.x, dy = b.y - a.y
      const distance = Math.max(1, Math.hypot(dx, dy))
      const centerX = (a.x + b.x) / 2
      const centerY = (a.y + b.y) / 2
      const r = svg.getBoundingClientRect()
      const v = viewRef.current
      const sx = centerX - r.left
      const sy = centerY - r.top
      pinchRef.current = {
        startDistance: distance,
        startZoom: v.zoom,
        startPanX: v.panX,
        startPanY: v.panY,
        startCenterX: sx,
        startCenterY: sy,
        startWorldX: (sx - v.panX) / v.zoom,
        startWorldY: (sy - v.panY) / v.zoom,
      }
      dragRef.current = { mode: 'idle' }
      setSelectionRect(null)
      setTransDrag(null)
      setHoveredId(null)
      setPopup(p => p.visible ? { ...p, visible: false } : p)
      setRenamePopup(null)
      clearLongPress()
    }

    // ── pointerdown: mouse, touch and pen share the same interaction model ──
    function onPointerDown(e: PointerEvent) {
      const ro = readOnlyRef.current
      const currentTool = toolRef.current
      const isTouch = e.pointerType === 'touch'
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (svg.setPointerCapture) {
        try { svg.setPointerCapture(e.pointerId) } catch { /* pointer may already be released */ }
      }

      if (isTouch && activePointersRef.current.size >= 2) {
        e.preventDefault()
        beginPinch()
        return
      }

      const w = toWorld(e.clientX, e.clientY, svg, viewRef.current)
      if (isTouch) {
        touchStartHitRef.current = {
          stateId: hitState(statesRef.current, w.x, w.y)?.id ?? null,
          transId: getTransId(e.target),
        }
        touchMovedRef.current = false
      }

      // Desktop right-drag keeps the original Windows-like marquee behavior.
      // On touch there is no right button, so long-press on empty Select canvas
      // enters the same marquee mode below.
      if (e.button === 2 && !isTouch && !ro) {
        e.preventDefault()
        suppressContextMenuRef.current = true
        if (statesRef.current.length === 0) return

        const hit = hitState(statesRef.current, w.x, w.y)
        if (currentTool === 'select' && hit && selectedIdsRef.current.has(hit.id)) {
          const selected = new Set(selectedIdsRef.current)
          const origins = new Map(
            statesRef.current.filter(st => selected.has(st.id)).map(st => [st.id, { x: st.x, y: st.y }])
          )
          if (origins.size > 0) {
            dragRef.current = { mode: 'group', startX: w.x, startY: w.y, origins }
            return
          }
        }

        if (currentTool === 'select') {
          setPopup(p => p.visible ? { ...p, visible: false } : p)
          setRenamePopup(null)
          const r = svg.getBoundingClientRect()
          const sx = e.clientX - r.left
          const sy = e.clientY - r.top
          dragRef.current = { mode: 'rect-select', startSX: sx, startSY: sy, currentSX: sx, currentSY: sy }
          setSelectionRect({ x: sx, y: sy, width: 0, height: 0 })
          return
        }

        dragRef.current = {
          mode: 'group', startX: w.x, startY: w.y,
          origins: new Map(statesRef.current.map(st => [st.id, { x: st.x, y: st.y }])),
        }
        return
      }

      if (e.button !== 0) return
      e.preventDefault()

      const tid = getTransId(e.target)
      if (tid) {
        if (!ro && currentTool === 'delete') { cbDelTrans.current(tid); return }
        if (!ro && currentTool === 'select') {
          cbSelect.current(tid)
          // Arm a curve drag. Nothing is written until the pointer actually
          // moves, so a plain click stays a plain select and a double-click
          // still reaches the label editor. The edge's lane is resolved once
          // here rather than on every move — no edge can be added mid-drag.
          const layout = computeEdgeLayout(
            transRef.current,
            new Map(statesRef.current.map(st => [st.id, st])),
          ).get(tid)
          if (layout) dragRef.current = { mode: 'curve', transId: tid, moved: false, layout }
          return
        }
        return
      }

      const st = hitState(statesRef.current, w.x, w.y)
      if (st) {
        if (!ro && currentTool === 'delete') { cbDelState.current(st.id); return }
        if (!ro && currentTool === 'final') { cbToggle.current(st.id); return }
        if (!ro && currentTool === 'initial') { cbSetInitial.current(st.id); return }
        if (!ro && currentTool === 'transition') {
          dragRef.current = { mode: 'transition', fromId: st.id }
          setTransDrag({ fromId: st.id, cursorX: w.x, cursorY: w.y, snapId: null })
          return
        }
        if (!ro && currentTool === 'select') {
          // If this state is already part of a multi-selection, a normal
          // left-drag should move the whole selection. This applies to mouse,
          // touch and pen; the selection rectangle/right-drag is only the way
          // the group is created, not the way it must be moved.
          if (selectedIdsRef.current.size > 1 && selectedIdsRef.current.has(st.id)) {
            const origins = new Map(
              statesRef.current
                .filter(state => selectedIdsRef.current.has(state.id))
                .map(state => [state.id, { x: state.x, y: state.y }])
            )
            dragRef.current = { mode: 'group', startX: w.x, startY: w.y, origins }
          } else {
            selectedIdsRef.current = new Set([st.id])
            cbSelect.current(st.id)
            dragRef.current = { mode: 'state', stateId: st.id, offX: w.x - st.x, offY: w.y - st.y }
          }
          touchMovedRef.current = false
          return
        }
      }

      if (!ro && currentTool === 'state') {
        cbAdd.current(w.x, w.y)
        return
      }

      if (ro || currentTool === 'select') {
        if (!ro) {
          selectedIdsRef.current.clear()
          cbSelect.current(null)
        }
        const r = svg.getBoundingClientRect()
        const sx = e.clientX - r.left
        const sy = e.clientY - r.top

        if (isTouch && !ro && currentTool === 'select') {
          // Long-press on empty canvas enters the same marquee used by right-drag.
          dragRef.current = { mode: 'idle' }
          longPressRef.current = { pointerId: e.pointerId, startX: sx, startY: sy, fired: false }
          longPressTimerRef.current = window.setTimeout(() => {
            const lp = longPressRef.current
            if (!lp || lp.pointerId !== e.pointerId || activePointersRef.current.size !== 1) return
            lp.fired = true
            dragRef.current = { mode: 'rect-select', startSX: lp.startX, startSY: lp.startY, currentSX: lp.startX, currentSY: lp.startY }
            setSelectionRect({ x: lp.startX, y: lp.startY, width: 0, height: 0 })
            setPopup(p => p.visible ? { ...p, visible: false } : p)
            setRenamePopup(null)
          }, 350)
          return
        }

        const v = viewRef.current
        dragRef.current = { mode: 'pan', startPanX: v.panX, startPanY: v.panY, startSX: e.clientX, startSY: e.clientY }
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (activePointersRef.current.has(e.pointerId)) {
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      }

      if (activePointersRef.current.size >= 2) {
        if (!pinchRef.current) beginPinch()
        const pinch = pinchRef.current
        const points = [...activePointersRef.current.values()]
        if (pinch && points.length >= 2) {
          e.preventDefault()
          const a = points[0], b = points[1]
          const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
          const centerX = (a.x + b.x) / 2
          const centerY = (a.y + b.y) / 2
          const r = svg.getBoundingClientRect()
          const sx = centerX - r.left
          const sy = centerY - r.top
          const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinch.startZoom * (distance / pinch.startDistance)))
          viewRef.current = {
            zoom: newZoom,
            panX: sx - pinch.startWorldX * newZoom,
            panY: sy - pinch.startWorldY * newZoom,
          }
          applyView()
          return
        }
      }

      if (mmDragRef.current) { panToMinimap(e); return }

      if (cbCursorMove.current && e.pointerType !== 'touch') {
        const now = performance.now()
        if (now - lastCursorSentRef.current > 33) {
          lastCursorSentRef.current = now
          const w = toWorld(e.clientX, e.clientY, svg, viewRef.current)
          cbCursorMove.current(w.x, w.y)
        }
      }

      const lp = longPressRef.current
      if (lp && lp.pointerId === e.pointerId && !lp.fired) {
        const moved = Math.hypot(e.clientX - (svg.getBoundingClientRect().left + lp.startX), e.clientY - (svg.getBoundingClientRect().top + lp.startY))
        if (moved > 8) {
          clearLongPress()
          touchMovedRef.current = true
          if (readOnlyRef.current || currentToolIsSelect(toolRef.current)) {
            const v = viewRef.current
            dragRef.current = { mode: 'pan', startPanX: v.panX, startPanY: v.panY, startSX: e.clientX, startSY: e.clientY }
          }
        } else {
          return
        }
      }

      const d = dragRef.current
      if (d.mode === 'idle') {
        if (e.pointerType === 'touch') return
        const w = toWorld(e.clientX, e.clientY, svg, viewRef.current)
        setHoveredId(hitState(statesRef.current, w.x, w.y)?.id ?? null)
        return
      }

      if (d.mode === 'pan') {
        viewRef.current = { ...viewRef.current, panX: d.startPanX + e.clientX - d.startSX, panY: d.startPanY + e.clientY - d.startSY }
        applyView()
        setPopup(p => p.visible ? { ...p, visible: false } : p)
        return
      }

      if (d.mode === 'state') {
        touchMovedRef.current = true
        const w = toWorld(e.clientX, e.clientY, svg, viewRef.current)
        const updates = resolveCollisions(statesRef.current, d.stateId, w.x - d.offX, w.y - d.offY)
        cbMoveStates.current([...updates].map(([id, p]) => ({ id, x: p.x, y: p.y })))
        return
      }

      if (d.mode === 'rect-select') {
        const r = svg.getBoundingClientRect()
        const sx = e.clientX - r.left, sy = e.clientY - r.top
        dragRef.current = { ...d, currentSX: sx, currentSY: sy }
        setSelectionRect({ x: Math.min(d.startSX, sx), y: Math.min(d.startSY, sy), width: Math.abs(sx - d.startSX), height: Math.abs(sy - d.startSY) })
        return
      }

      if (d.mode === 'group') {
        touchMovedRef.current = true
        const w = toWorld(e.clientX, e.clientY, svg, viewRef.current)
        const dx = w.x - d.startX, dy = w.y - d.startY
        cbMoveStates.current([...d.origins].map(([id, p]) => ({ id, x: p.x + dx, y: p.y + dy })))
        return
      }

      if (d.mode === 'curve') {
        const t = transRef.current.find(edge => edge.id === d.transId)
        if (!t) return
        const from = statesRef.current.find(st => st.id === t.fromId)
        const to   = statesRef.current.find(st => st.id === t.toId)
        if (!from || !to) return

        touchMovedRef.current = true
        dragRef.current = { ...d, moved: true }
        const w = toWorld(e.clientX, e.clientY, svg, viewRef.current)

        if (from.id === to.id) {
          // A loop has no chord, so its radius follows how far out the cursor is
          // pulled. Its crown sits at STATE_R + 1.55r from the centre (loopDist
          // plus the radius itself), so inverting that gives the radius back.
          const reach = Math.hypot(w.x - from.x, w.y - from.y)
          const raw = clampLoopRadius((reach - STATE_R) / 1.55)
          cbCurveTrans.current?.(t.id, Math.abs(raw - LOOP_R) < BEND_SNAP ? undefined : raw)
          return
        }

        const { isTwin, isForward, fanIndex, fanCount } = d.layout
        const bend = bendForCursor(from, to, isForward, w.x, w.y)
        const auto = autoBend(isTwin, isForward, fanIndex, fanCount)
        cbCurveTrans.current?.(t.id, Math.abs(bend - auto) < BEND_SNAP ? undefined : bend)
        return
      }

      if (d.mode === 'transition') {
        const w = toWorld(e.clientX, e.clientY, svg, viewRef.current)
        const snap = hitState(statesRef.current, w.x, w.y)
        setTransDrag({ fromId: d.fromId, cursorX: w.x, cursorY: w.y, snapId: snap?.id ?? null })
        setHoveredId(snap?.id ?? null)
      }
    }

    function currentToolIsSelect(currentTool: Tool) { return currentTool === 'select' }

    function onPointerUp(e: PointerEvent) {
      activePointersRef.current.delete(e.pointerId)
      if (activePointersRef.current.size < 2) pinchRef.current = null
      clearLongPress()
      if (mmDragRef.current) mmDragRef.current = false

      const d = dragRef.current
      dragRef.current = { mode: 'idle' }

      if (d.mode === 'rect-select') {
        const r = svg.getBoundingClientRect()
        const ex = e.clientX - r.left, ey = e.clientY - r.top
        const x1 = Math.min(d.startSX, ex), y1 = Math.min(d.startSY, ey)
        const x2 = Math.max(d.startSX, ex), y2 = Math.max(d.startSY, ey)
        const z = viewRef.current.zoom, panX = viewRef.current.panX, panY = viewRef.current.panY
        const ids = new Set(statesRef.current.filter(st => {
          const sx = st.x * z + panX, sy = st.y * z + panY, radius = (STATE_R + 4) * z
          return sx + radius >= x1 && sx - radius <= x2 && sy + radius >= y1 && sy - radius <= y2
        }).map(st => st.id))
        selectedIdsRef.current = ids
        const first = ids.values().next().value as string | undefined
        cbSelect.current(first ?? null)
        setSelectionRect(null)
        return
      }

      if (d.mode === 'transition') {
        setTransDrag(null); setHoveredId(null)
        const w = toWorld(e.clientX, e.clientY, svg, viewRef.current)
        const snap = hitState(statesRef.current, w.x, w.y)
        if (!snap) return
        const fromSt = statesRef.current.find(st => st.id === d.fromId)
        if (!fromSt) return
        const isSelf = snap.id === d.fromId
        const midWX = isSelf ? fromSt.x : (fromSt.x + snap.x) / 2
        const midWY = isSelf ? fromSt.y - STATE_R - 44 : (fromSt.y + snap.y) / 2
        const vp = toViewport(midWX, midWY, svg, viewRef.current)
        setPopup({ visible: true, screenX: vp.x, screenY: vp.y, fromId: d.fromId, toId: snap.id, editingTransitionId: null })
        setLabelDraft(''); setRangeMode(false); setRangeStartDraft(''); setRangeEndDraft(''); setRangeError('')
        setTmRead(''); setTmWrite(''); setTmDir('R')
        requestAnimationFrame(() => labelRef.current?.focus())
        return
      }

      // A short touch on empty Select canvas is simply a tap; long-press is the marquee.
      if (e.pointerType === 'touch' && longPressRef.current === null && !touchMovedRef.current) {
        // handled by the normal selection state above; no special action required
      }

      if (e.pointerType === 'touch' && !touchMovedRef.current) {
        const now = performance.now()
        const tid = touchStartHitRef.current.transId
        const st = touchStartHitRef.current.stateId ? statesRef.current.find(state => state.id === touchStartHitRef.current.stateId) : null
        const prev = lastTapRef.current
        const isDouble = now - prev.time < 320 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 14 && prev.stateId === (st?.id ?? null) && prev.transId === (tid ?? null)
        if (isDouble && toolRef.current === 'select' && !readOnlyRef.current) {
          lastTapRef.current = { time: 0, x: 0, y: 0, stateId: null, transId: null }
          onDbl({ clientX: e.clientX, clientY: e.clientY, target: e.target } as unknown as MouseEvent, st?.id ?? null, tid ?? null)
        } else {
          lastTapRef.current = { time: now, x: e.clientX, y: e.clientY, stateId: st?.id ?? null, transId: tid ?? null }
        }
      }
    }

    // ── dblclick: edit transition or rename state ──
    function onContextMenu(e: MouseEvent) {
      if (suppressContextMenuRef.current) {
        e.preventDefault()
        suppressContextMenuRef.current = false
      }
    }

    function onDbl(e: MouseEvent, forcedStateId: string | null = null, forcedTransId: string | null = null) {
      if (readOnlyRef.current || toolRef.current !== 'select') return

      // A transition is editable only in Select mode. Check it first so a
      // double-click on the transition label/path never falls through to
      // state renaming.
      const tid = forcedTransId ?? getTransId(e.target)
      if (tid) {
        const t = transRef.current.find(tr => tr.id === tid)
        if (!t) return

        const from = statesRef.current.find(s => s.id === t.fromId)
        const to   = statesRef.current.find(s => s.id === t.toId)
        if (!from || !to) return

        const isTwin = transRef.current.some(r =>
          r.id !== t.id && r.fromId === t.toId && r.toId === t.fromId
        )
        const isFwd = !isTwin || t.fromId < t.toId
        const { lx, ly } = computeTransPath(from, to, isTwin, isFwd)
        const vp = toViewport(lx, ly, svg, viewRef.current)

        const isRange = t.kind === 'range' && !!t.rangeStart && !!t.rangeEnd
        setPopup({
          visible: true,
          screenX: vp.x,
          screenY: vp.y,
          fromId: t.fromId,
          toId: t.toId,
          editingTransitionId: t.id,
        })
        setRangeMode(isRange)
        setLabelDraft(isRange ? '' : t.label)
        setRangeStartDraft(isRange ? (t.rangeStart ?? '') : '')
        setRangeEndDraft(isRange ? (t.rangeEnd ?? '') : '')
        setRangeError('')

        // Accept both the current "read/write,dir" label and the legacy
        // arrow format "read→write,dir" from documents saved before the
        // formats were unified.
        const tm = /^(.+?)(?:\/|→)(.+?),\s*([LRS])$/i.exec(t.label.trim())
        setTmRead(tm && tm[1].trim() !== '_' ? tm[1].trim() : '')
        setTmWrite(tm && tm[2].trim() !== '_' ? tm[2].trim() : '')
        setTmDir(tm ? (tm[3].toUpperCase() as 'L' | 'R' | 'S') : 'R')

        requestAnimationFrame(() => {
          if (isRange) rangeStartRef.current?.select()
          else labelRef.current?.select()
        })
        return
      }

      const w  = toWorld(e.clientX, e.clientY, svg, viewRef.current)
      const st = forcedStateId ? statesRef.current.find(state => state.id === forcedStateId) ?? null : hitState(statesRef.current, w.x, w.y)
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

    svg.addEventListener('pointerdown', onPointerDown)
    svg.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup',   onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    svg.addEventListener('dblclick', onDbl)
    svg.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)

    return () => {
      svg.removeEventListener('pointerdown', onPointerDown)
      svg.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup',   onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      svg.removeEventListener('dblclick', onDbl)
      svg.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [])   // empty — all mutable state accessed via refs

  // ── Label popup confirm / cancel ─────────────────────────────────────────────

  const confirmLabel = useCallback(() => {
    if (!popup.visible) return
    const editingId = popup.editingTransitionId

    if (isTmType) {
      const read  = tmRead.trim() || '_'
      const write = tmWrite.trim() || '_'
      const label = `${read}/${write},${tmDir}`
      if (editingId) {
        cbEditTrans.current?.(editingId, label, 'symbol')
      } else {
        cbAddTrans.current(popup.fromId, popup.toId, label, 'symbol')
      }
      setPopup(p => ({ ...p, visible: false }))
      return
    }

    if (!rangeMode) {
      const label = labelDraft.trim() || 'ε'
      if (editingId) {
        cbEditTrans.current?.(editingId, label, 'symbol')
      } else {
        cbAddTrans.current(popup.fromId, popup.toId, label, 'symbol')
      }
      setPopup(p => ({ ...p, visible: false }))
      return
    }

    const start = rangeStartDraft.trim()
    const end   = rangeEndDraft.trim()
    const startCode = start.length === 1 ? start.charCodeAt(0) : -1
    const endCode   = end.length === 1 ? end.charCodeAt(0) : -1
    const sameLowercase = startCode >= 97 && startCode <= 122 && endCode >= 97 && endCode <= 122
    const sameDigit     = startCode >= 48 && startCode <= 57 && endCode >= 48 && endCode <= 57

    if (!sameLowercase && !sameDigit) {
      setRangeError('Use a-z or 0-9 only')
      return
    }
    if (startCode > endCode) {
      setRangeError('Range must go from low to high')
      return
    }

    const label = `${start}-${end}`
    if (editingId) {
      cbEditTrans.current?.(editingId, label, 'range', start, end)
    } else {
      cbAddTrans.current(popup.fromId, popup.toId, label, 'range', start, end)
    }
    setPopup(p => ({ ...p, visible: false }))
  }, [popup, labelDraft, rangeMode, rangeStartDraft, rangeEndDraft, tmRead, tmWrite, tmDir, isTmType])

  const toggleRangeMode = useCallback(() => {
    setRangeMode(current => {
      const next = !current
      setRangeError('')
      if (next) {
        setLabelDraft('')
        requestAnimationFrame(() => rangeStartRef.current?.focus())
      } else {
        setRangeStartDraft('')
        setRangeEndDraft('')
        requestAnimationFrame(() => labelRef.current?.focus())
      }
      return next
    })
  }, [])

  const cancelLabel = useCallback(() => setPopup(p => ({ ...p, visible: false })), [])

  const confirmRename = useCallback(() => {
    if (!renamePopup) return
    const label = renameDraft.trim()
    if (label) cbRename.current(renamePopup.stateId, label)
    setRenamePopup(null)
  }, [renamePopup, renameDraft])

  const cancelRename = useCallback(() => setRenamePopup(null), [])

  // ── Twin detection (bidirectional pairs) ─────────────────────────────────────

  const stateById = new Map(states.map(st => [st.id, st]))
  const edgeLayout = computeEdgeLayout(transitions, stateById)

  // ── Transition preview geometry ───────────────────────────────────────────────

  const previewPath = (() => {
    if (!transDrag) return null
    const from = stateById.get(transDrag.fromId)
    if (!from) return null
    const snap = transDrag.snapId ? stateById.get(transDrag.snapId) : null

    if (snap && snap.id === from.id) {
      // Self-loop preview
      return selfLoopPath(from.x, from.y).d
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
          <marker id="arrowD" markerWidth="16" markerHeight="13"
            refX="15" refY="6.5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0.5 L0,12.5 L15,6.5 z" fill="#C8C3BA" />
          </marker>
          <marker id="arrowS" markerWidth="16" markerHeight="13"
            refX="15" refY="6.5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0.5 L0,12.5 L15,6.5 z" fill="#F97316" />
          </marker>
          <marker id="arrowP" markerWidth="16" markerHeight="13"
            refX="15" refY="6.5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0.5 L0,12.5 L15,6.5 z" fill="#AAA49A" />
          </marker>
          <marker id="arrowA" markerWidth="16" markerHeight="13"
            refX="15" refY="6.5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0.5 L0,12.5 L15,6.5 z" fill="#16A34A" />
          </marker>
        </defs>

        <g ref={groupRef}>

          {/* ── Transitions ── */}
          {transitions.map(t => {
            const from = stateById.get(t.fromId)
            const to   = stateById.get(t.toId)
            if (!from || !to) return null

            const isSel    = t.id === selectedId
            const isActive = activeTransIds?.has(t.id) ?? false
            const lay = edgeLayout.get(t.id) ?? { isTwin: false, isForward: true, fanIndex: 0, fanCount: 1 }
            const { d, lx, ly, nx, ny, ax, ay } =
              computeTransPath(from, to, lay.isTwin, lay.isForward, lay.fanIndex, lay.fanCount, t.curve)

            // The stack is centred on its anchor, so a label with N symbols
            // reaches (N-1)*LABEL_LINE/2 back toward the stroke. Push the whole
            // block out by that much and the nearest line keeps its clearance
            // no matter how many symbols the transition carries.
            const tokens  = t.label.split(',').map(token => token.trim()).filter(Boolean)
            const lineCount = Math.max(tokens.length, 1)
            const stackPush = (lineCount - 1) * (LABEL_LINE / 2)
            const tx = lx + nx * stackPush
            const ty = ly + ny * stackPush + LABEL_RISE

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
                  style={{ cursor: tool === 'delete' ? 'not-allowed' : readOnly ? 'default' : 'grab' }}
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
                {/* Curve handle — drag to reshape the arc */}
                {isSel && !readOnly && tool === 'select' && (
                  <circle
                    cx={ax} cy={ay} r={5}
                    fill="#FFFFFF" stroke="#F97316" strokeWidth={2}
                    data-tid={t.id}
                    style={{ cursor: 'grab' }}
                  />
                )}
                {/* Label */}
                <text
                  x={tx} y={ty}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={13} fontFamily="JetBrains Mono, monospace"
                  fill={labelFill}
                  strokeWidth={3} paintOrder="stroke"
                  pointerEvents="none"
                  style={{ userSelect: 'none', stroke: 'var(--bg)' }}
                >
                  {tokens.map((token, index) => (
                    <tspan
                      key={`${t.id}-${index}`}
                      x={tx}
                      dy={index === 0 ? `${-stackPush}px` : `${LABEL_LINE}px`}
                    >
                      {token}
                    </tspan>
                  ))}
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
            const isMultiSel  = selectedIdsRef.current.has(st.id)
            const isInit     = st.id === initialId
            const isHov      = st.id === hoveredId
            const isDragSrc  = transDrag?.fromId === st.id
            const isDragSnap = transDrag?.snapId  === st.id
            const isActive   = activeStateIds?.has(st.id) ?? false
            const peerHere   = peers?.find(p => p.selectedId === st.id)

            const fill   = isActive ? '#F0FDF4' : isMultiSel ? '#FFF7ED' : '#FFFFFF'
            const stroke = isActive ? '#16A34A' : isMultiSel ? '#F97316' : (isHov || isDragSnap) ? '#C8C3BA' : '#E6E2DA'
            const sw     = isActive ? 2.5 : isMultiSel ? 2 : 1.5
            const tFill  = isActive ? '#15803D' : isMultiSel ? '#EA6C0A' : '#1A1814'

            // The state being dragged by this client stays glued to the
            // cursor with zero latency; every other state (including ones
            // this drag is actively pushing aside) eases into its new spot
            // so the push reads as a shove, not a teleport.
            const isLocalDrag = dragRef.current.mode === 'state' && dragRef.current.stateId === st.id
            const isLocalCollisionPush = dragRef.current.mode === 'state' && !isLocalDrag
            const groupStyle  = isLocalDrag ? undefined : isLocalCollisionPush ? { transition: 'transform 0.12s ease-out' } : undefined

            return (
              <g key={st.id} transform={`translate(${st.x} ${st.y})`} style={groupStyle}>
                {/* A live collaborator has this state selected */}
                {peerHere && (
                  <circle r={STATE_R + 16}
                    fill="none"
                    stroke={peerHere.color}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    pointerEvents="none"
                  />
                )}

                {/* Active state glow */}
                {isActive && (
                  <circle r={STATE_R + 12}
                    fill="rgba(22,163,74,0.10)"
                    stroke="rgba(22,163,74,0.20)"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                )}

                {/* Snap / source glow */}
                {(isDragSrc || isDragSnap) && (
                  <circle r={STATE_R + 13}
                    fill="rgba(249,115,22,0.07)"
                    stroke="rgba(249,115,22,0.22)"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                )}

                {/* Final outer ring */}
                {st.isFinal && (
                  <circle r={STATE_R + FINAL_GAP}
                    fill="none"
                    stroke={isMultiSel ? '#F97316' : '#E6E2DA'}
                    strokeWidth={sw}
                  />
                )}

                {/* Body */}
                <circle r={STATE_R}
                  fill={fill} stroke={stroke} strokeWidth={sw}
                  style={{ transition: 'fill 0.15s, stroke 0.15s' }}
                />

                {/* Initial arrow */}
                {isInit && (
                  <g pointerEvents="none">
                    <line
                      x1={-STATE_R - 24} y1={0}
                      x2={-STATE_R - 2}  y2={0}
                      stroke={isMultiSel ? '#F97316' : '#AAA49A'} strokeWidth={1.5}
                    />
                    <path
                      d={`M${-STATE_R-9},${-5} L${-STATE_R-1},${0} L${-STATE_R-9},${5}`}
                      fill="none"
                      stroke={isMultiSel ? '#F97316' : '#AAA49A'}
                      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
                    />
                  </g>
                )}

                {/* Label */}
                {(() => {
                  const { text, fontSize } = fitLabel(st.label)
                  return (
                    <text
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

        {selectionRect && (
          <rect
            x={selectionRect.x}
            y={selectionRect.y}
            width={selectionRect.width}
            height={selectionRect.height}
            fill="rgba(249,115,22,0.08)"
            stroke="#F97316"
            strokeWidth={1}
            strokeDasharray="5 4"
            pointerEvents="none"
          />
        )}
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
              onPointerDown={e => {
                e.stopPropagation()
                e.preventDefault()
                mmDragRef.current = true
                panToMinimap(e.nativeEvent)
              }}
              onTouchStart={e => {
                e.stopPropagation()
                if (e.touches.length === 1) {
                  mmDragRef.current = true
                  const t = e.touches[0]
                  panToMinimap({ clientX: t.clientX, clientY: t.clientY } as MouseEvent)
                }
              }}
              onTouchMove={e => {
                e.preventDefault()
                if (mmDragRef.current && e.touches.length === 1) {
                  const t = e.touches[0]
                  panToMinimap({ clientX: t.clientX, clientY: t.clientY } as MouseEvent)
                }
              }}
              onTouchEnd={() => { mmDragRef.current = false }}
              onTouchCancel={() => { mmDragRef.current = false }}
            >
              {/* Transitions */}
              {transitions.map(t => {
                const f = stateById.get(t.fromId)
                const o = stateById.get(t.toId)
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
          {isTmType ? (
            <>
              <span className={s.popupHint}>Transition</span>
              <input
                className={s.popupInput}
                value={tmRead}
                onChange={e => setTmRead(e.target.value.slice(0, 1))}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); confirmLabel() }
                  if (e.key === 'Escape') { e.preventDefault(); cancelLabel() }
                  e.stopPropagation()
                }}
                placeholder="read"
                maxLength={1}
                spellCheck={false}
              />
              <span className={s.popupHint}>→</span>
              <input
                className={s.popupInput}
                value={tmWrite}
                onChange={e => setTmWrite(e.target.value.slice(0, 1))}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); confirmLabel() }
                  if (e.key === 'Escape') { e.preventDefault(); cancelLabel() }
                  e.stopPropagation()
                }}
                placeholder="write"
                maxLength={1}
                spellCheck={false}
              />
              <select
                className={s.popupDir}
                value={tmDir}
                onChange={e => setTmDir(e.target.value as 'L' | 'R' | 'S')}
              >
                <option value="R">R</option>
                <option value="L">L</option>
                <option value="S">S</option>
              </select>
            </>
          ) : (
            <>
              <span className={s.popupHint}>
                {popup.editingTransitionId ? 'Edit transition' : 'Transition label'}
              </span>
              {!rangeMode ? (
                <input
                  ref={labelRef}
                  className={s.popupInput}
                  value={labelDraft}
                  onChange={e => {
                    const next = e.target.value
                    if (!automatonType.startsWith('tm-') && labelDraft.length === 1 && next.length === 2 && !next.includes(',')) {
                      setLabelDraft(`${labelDraft},${next[1]}`)
                    } else {
                      setLabelDraft(next)
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  { e.preventDefault(); confirmLabel() }
                    if (e.key === 'Escape') { e.preventDefault(); cancelLabel()  }
                    e.stopPropagation()
                  }}
                  placeholder={automatonType.startsWith('tm-') ? '0/1,R' : 'a'}
                  maxLength={automatonType.startsWith('tm-') ? 32 : 64}
                  spellCheck={false}
                />
              ) : (
                <>
                  <input
                    ref={rangeStartRef}
                    className={s.popupRangeInput}
                    value={rangeStartDraft}
                    onChange={e => { setRangeStartDraft(e.target.value.slice(-1)); setRangeError('') }}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  { e.preventDefault(); confirmLabel() }
                      if (e.key === 'Escape') { e.preventDefault(); cancelLabel() }
                      if (e.key === 'Tab') requestAnimationFrame(() => rangeEndRef.current?.focus())
                      e.stopPropagation()
                    }}
                    placeholder="a"
                    maxLength={1}
                    spellCheck={false}
                  />
                  <span className={s.popupRangeDash}>-</span>
                  <input
                    ref={rangeEndRef}
                    className={s.popupRangeInput}
                    value={rangeEndDraft}
                    onChange={e => { setRangeEndDraft(e.target.value.slice(-1)); setRangeError('') }}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  { e.preventDefault(); confirmLabel() }
                      if (e.key === 'Escape') { e.preventDefault(); cancelLabel() }
                      e.stopPropagation()
                    }}
                    placeholder="z"
                    maxLength={1}
                    spellCheck={false}
                  />
                </>
              )}
            </>
          )}
          {!isTmType && (
            <button
              className={`${s.popupRangeButton} ${rangeMode ? s.popupRangeButtonActive : ''}`}
              onClick={toggleRangeMode}
              type="button"
            >Range</button>
          )}
          <button className={s.popupOk} onClick={confirmLabel}>
            {popup.editingTransitionId ? 'Save' : 'Add'}
          </button>
          <button className={s.popupCancel} onClick={cancelLabel}>✕</button>
          {rangeError && <span className={s.popupError}>{rangeError}</span>}
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
