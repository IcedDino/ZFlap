import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Download, Upload, Save, Check, Pencil, Play, Share2, User, ChevronDown, FileJson, Image as ImageIcon, FileText } from 'lucide-react'
import ZedMascot from '../components/ZedMascot'
import DotCanvas from '../components/editor/DotCanvas'
import DiagramCanvas from '../components/editor/DiagramCanvas'
import type { View } from '../components/editor/DiagramCanvas'
import FloatingToolbar from '../components/editor/FloatingToolbar'
import type { Tool } from '../components/editor/FloatingToolbar'
import SimPanel from '../components/editor/SimPanel'
import AuthModal from '../components/AuthModal'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAutomaton, classifyAutomaton } from '../hooks/useAutomaton'
import type { RemoteAction } from '../hooks/useAutomaton'
import { useSimulator } from '../hooks/useSimulator'
import { useAuth } from '../hooks/useAuth'
import { create, update, setPublic, getById } from '../lib/automatonService'
import { joinAutomatonChannel, leaveAutomatonChannel, broadcastAction, broadcastCursor, trackIdentity, randomPeerColor, randomAnonIdentity, createClientId } from '../lib/realtime'
import type { Peer, CursorState } from '../lib/realtime'
import { downloadAutomatonJson, downloadAutomatonPng, downloadAutomatonPdf } from '../lib/automatonExport'
import s from './EditorPage.module.css'

type Mode = 'edit' | 'simulate'

export default function EditorPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tool, setTool] = useState<Tool>('select')
  const [name, setName] = useState('Untitled automaton')
  const [mode, setMode] = useState<Mode>('edit')

  const [docId, setDocId]       = useState<string | null>(null)
  const [loaded, setLoaded]     = useState(!id)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [copied, setCopied]     = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const [peers, setPeers]       = useState<{ id: string; color: string; initial: string; name: string }[]>([])
  const [cursors, setCursors]   = useState<Record<string, CursorState>>({})

  const channelRef      = useRef<RealtimeChannel | null>(null)
  const importInputRef  = useRef<HTMLInputElement | null>(null)
  const autoSaveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const myColorRef      = useRef(randomPeerColor())
  const clientIdRef     = useRef(createClientId())
  const anonIdentityRef = useRef(randomAnonIdentity()) // stable per session — only used while signed out
  const lastCursorRef   = useRef<{ x: number; y: number } | null>(null)

  // MOVE_STATE fires on every mousemove during a drag (dozens/sec) —
  // broadcasting each one unthrottled makes channel.send() (a real
  // network op, occasionally an actual REST fallback fetch) fight the
  // drag for CPU/socket time and lags the person doing the dragging,
  // not just their peers. Local dispatch below stays untouched/instant;
  // only the network send is throttled, trailing-edge so the final
  // resting position is never dropped.
  const lastMoveSentRef  = useRef(0)
  // Keyed by state id, not a single slot — a collision push can move several
  // states in one mousemove tick, and a single slot would silently drop all
  // but the last one from the broadcast.
  const pendingMovesRef   = useRef<Map<string, RemoteAction>>(new Map())
  const moveThrottleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Signed-in collaborators show their initial; anonymous ones get a
  // Google-Docs-style animal identity (no account needed to co-edit).
  const myIdentity = user
    ? { initial: (user.email ?? '?')[0].toUpperCase(), name: user.email ?? 'Signed in' }
    : anonIdentityRef.current
  // handleSave is declared further down (it needs `automaton`, which needs
  // this callback first) — kept current via ref so handleLocalAction can
  // call it without a circular declaration order.
  const handleSaveRef = useRef<() => void>(() => {})

  // Live collaboration: broadcast our own edits to anyone else on this
  // automaton, and debounce-persist them — but only for public docs
  // (private ones keep the explicit-Save-only flow). Not memoized: it
  // closes over the latest isPublic/docId each render, and useAutomaton
  // mirrors whatever onAction it's given into a ref internally, so a
  // fresh closure per render is exactly what it expects, not a bug.
  function handleLocalAction(action: RemoteAction) {
    if (channelRef.current) {
      const channel = channelRef.current
      if (action.type === 'MOVE_STATE') {
        const now = performance.now()
        const elapsed = now - lastMoveSentRef.current
        pendingMovesRef.current.set(action.id, action)
        if (elapsed >= 16) {
          lastMoveSentRef.current = now
          for (const a of pendingMovesRef.current.values()) broadcastAction(channel, clientIdRef.current, a)
          pendingMovesRef.current.clear()
        } else if (!moveThrottleTimer.current) {
          moveThrottleTimer.current = setTimeout(() => {
            moveThrottleTimer.current = null
            if (pendingMovesRef.current.size && channelRef.current) {
              lastMoveSentRef.current = performance.now()
              for (const a of pendingMovesRef.current.values()) broadcastAction(channelRef.current, clientIdRef.current, a)
              pendingMovesRef.current.clear()
            }
          }, 16 - elapsed)
        }
      } else {
        broadcastAction(channel, clientIdRef.current, action)
      }
      // Reconnect-on-stale-state lives only in the visibility/focus
      // effect below now — checking channel.state here, on every single
      // send, turned out to misfire constantly (likely a timing gap
      // between the SUBSCRIBED callback and channel.state actually
      // reading 'joined'), tearing the channel down and rebuilding it
      // on nearly every edit. That's what was causing editors to
      // flicker in and out of the presence list, sometimes duplicated —
      // each rejoin is a fresh leave+join for the same person.
    }
    if (isPublic && docId) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(() => { handleSaveRef.current() }, 1500)
    }
  }

  // Cursor position + current selection — Broadcast, not Presence (see the
  // note on PresenceState in realtime.ts for why). DiagramCanvas already
  // throttles calls here to ~80ms, matched to what a smooth cursor needs;
  // no extra throttling on top. Same non-memoized-closure reasoning as
  // handleLocalAction above.
  function handleCursorMove(x: number, y: number) {
    lastCursorRef.current = { x, y }
    if (channelRef.current) {
      broadcastCursor(channelRef.current, clientIdRef.current, { x, y, selectedId: automaton.selectedId })
    }
  }

  const automaton      = useAutomaton({ persistLocal: !id, onAction: handleLocalAction })
  const editorViewRef  = useRef<View>({ panX: 0, panY: 0, zoom: 1 })

  const currentSnapshot = JSON.stringify({
    name, states: automaton.states, transitions: automaton.transitions, initialId: automaton.initialId,
  })
  const isSaved = savedSnapshot !== null && savedSnapshot === currentSnapshot

  // Load the cloud document named by the URL (skip if we already have it, e.g. right after Save)
  useEffect(() => {
    if (!id || id === docId) return
    setLoaded(false)
    setLoadError(null)
    getById(id)
      .then(row => {
        if (!row) { setLoadError("This automaton doesn't exist or you don't have access to it."); setLoaded(true); return }
        automaton.load({ states: row.data.states, transitions: row.data.transitions, initialId: row.data.initialId })
        setName(row.name)
        setIsPublic(row.is_public)
        setDocId(row.id)
        setSavedSnapshot(JSON.stringify({
          name: row.name, states: row.data.states, transitions: row.data.transitions, initialId: row.data.initialId,
        }))
        setLoaded(true)
      })
      .catch(() => { setLoadError('Failed to load this automaton.'); setLoaded(true) })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    // Creating a new automaton needs an account; updating an existing
    // public one doesn't — RLS allows anyone to write while it's public,
    // which is what makes anonymous live collaborators able to save at all.
    if (!docId && !user) { setAuthOpen(true); return }
    setSaving(true)
    try {
      const payload = { states: automaton.states, transitions: automaton.transitions, initialId: automaton.initialId }
      if (docId) {
        await update(docId, { name, data: payload })
      } else {
        const row = await create(name, payload)
        setDocId(row.id)
        navigate(`/editor/${row.id}`, { replace: true })
      }
      setSavedSnapshot(JSON.stringify({ name, ...payload }))
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }, [user, docId, name, automaton.states, automaton.transitions, automaton.initialId, navigate])
  handleSaveRef.current = handleSave

  const handleShare = useCallback(async () => {
    try {
      let shareId = docId

      // A new unsaved automaton has no URL yet. If the user is signed in,
      // create it first; otherwise the existing auth flow is used.
      if (!shareId) {
        if (!user) {
          setAuthOpen(true)
          return
        }
        const payload = { states: automaton.states, transitions: automaton.transitions, initialId: automaton.initialId }
        const row = await create(name, payload)
        shareId = row.id
        setDocId(row.id)
        navigate(`/editor/${row.id}`, { replace: true })
      }

      if (!isPublic) { await setPublic(shareId, true); setIsPublic(true) }
      await navigator.clipboard.writeText(`${location.origin}/editor/${shareId}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error(err)
      setErrorToast("Couldn't create a share link — try again.")
      setTimeout(() => setErrorToast(null), 3000)
    }
  }, [docId, isPublic, user, name, automaton.states, automaton.transitions, automaton.initialId, navigate])

  const exportModel = { name, states: automaton.states, transitions: automaton.transitions, initialId: automaton.initialId }

  const runExport = useCallback(async (kind: 'json' | 'png' | 'pdf') => {
    setExportOpen(false)
    try {
      if (kind === 'json') downloadAutomatonJson(exportModel)
      else if (kind === 'png') await downloadAutomatonPng(exportModel)
      else await downloadAutomatonPdf(exportModel)
    } catch (err) {
      console.error(err)
      setErrorToast(err instanceof Error ? err.message : 'Export failed.')
      setTimeout(() => setErrorToast(null), 3000)
    }
  }, [name, automaton.states, automaton.transitions, automaton.initialId])

  const handleImportFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        if (!Array.isArray(parsed.states) || !Array.isArray(parsed.transitions)) throw new Error('Invalid automaton file')
        automaton.load({ states: parsed.states, transitions: parsed.transitions, initialId: parsed.initialId ?? null })
        if (typeof parsed.name === 'string') setName(parsed.name)
      } catch (err) {
        console.error(err)
        setErrorToast('That file is not a valid automaton export.')
        setTimeout(() => setErrorToast(null), 3000)
      }
    }
    reader.readAsText(file)
  }, [automaton.load])

  // Join the live channel for public docs — anyone with the link, no
  // account needed. Private docs never join, so they stay single-editor.
  // Reconnection on a dropped WebSocket (heartbeat timeout, backgrounded
  // tab, network blip) is handled inside joinAutomatonChannel itself, by
  // retrying on this same channel object — not by tearing this effect's
  // channel down and recreating it, which is what caused the earlier
  // duplicate/flickering presence bug.
  useEffect(() => {
    if (!docId || !isPublic) return
    const channel = joinAutomatonChannel(docId, {
      clientId: clientIdRef.current,
      getPresence: () => ({ color: myColorRef.current, initial: myIdentity.initial, name: myIdentity.name }),
      onAction: automaton.applyRemote,
      onPresence: newPeers => {
        setPeers(newPeers)
        // Drop cursor/selection data for anyone who's no longer connected
        // so a disconnected peer's cursor doesn't linger as a ghost.
        const stillHere = new Set(newPeers.map(p => p.id))
        setCursors(prev => {
          const next: Record<string, CursorState> = {}
          for (const key of Object.keys(prev)) if (stillHere.has(key)) next[key] = prev[key]
          return next
        })
      },
      onCursor: (senderId, cursor) => {
        setCursors(prev => ({ ...prev, [senderId]: cursor }))
      },
    })
    channelRef.current = channel
    return () => {
      leaveAutomatonChannel(channel)
      channelRef.current = null
      setPeers([])
      setCursors({})
    }
  }, [docId, isPublic]) // eslint-disable-line react-hooks/exhaustive-deps

  // Selection changed without necessarily moving the mouse (e.g. a click)
  // — push it to peers right away rather than waiting for the next
  // cursor move, over the same broadcast channel cursor position uses.
  useEffect(() => {
    if (!channelRef.current) return
    broadcastCursor(channelRef.current, clientIdRef.current, {
      x: lastCursorRef.current?.x ?? null,
      y: lastCursorRef.current?.y ?? null,
      selectedId: automaton.selectedId,
    })
  }, [automaton.selectedId])

  // Identity changed (signed in mid-session) — this one genuinely belongs
  // on Presence, and is rare enough that it's not a rate concern.
  useEffect(() => {
    if (!channelRef.current) return
    trackIdentity(channelRef.current, { color: myColorRef.current, initial: myIdentity.initial, name: myIdentity.name })
  }, [myIdentity.initial, myIdentity.name])

  useEffect(() => () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (moveThrottleTimer.current) clearTimeout(moveThrottleTimer.current)
  }, [])

  useEffect(() => {
    if (!exportOpen) return
    const close = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-export-menu]')) setExportOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [exportOpen])

  const simulator = useSimulator(
    automaton.states,
    automaton.transitions,
    automaton.initialId,
  )

  useEffect(() => {
    if (mode === 'simulate') simulator.reset()
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const { label: typeLabel, color: typeColor } = classifyAutomaton(
    automaton.states, automaton.transitions, automaton.initialId
  )

  const sigma    = [...new Set(automaton.transitions.map(t => t.label).filter(Boolean))].sort()
  const sigmaStr = sigma.length === 0 ? '∅' : `{${sigma.join(', ')}}`

  const dotColor =
    typeColor === 'green'  ? s.statusDotOk :
    typeColor === 'orange' ? s.statusDotWarn :
                             s.statusDot

  const chipColor =
    typeColor === 'green'  ? s.statusChipGreen :
    typeColor === 'orange' ? s.statusChipOrange :
                             s.statusChip

  // Identity (Presence) merged with cursor/selection (Broadcast) for
  // DiagramCanvas — see realtime.ts for why those two live separately.
  const mergedPeers: Peer[] = peers.map(p => ({
    ...p,
    ...(cursors[p.id] ?? { x: null, y: null, selectedId: null }),
  }))

  if (loadError) {
    return (
      <div className={s.root}>
        <div className={s.smallWarning} style={{ display: 'flex' }}>
          <span>{loadError} <Link to="/editor">Start a new one</Link></span>
        </div>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className={s.root}>
        <div className={s.loadingOverlay}>
          <div className={s.spinner} />
          <span>Loading automaton…</span>
        </div>
      </div>
    )
  }

  return (
    <div className={s.root}>

      {/* ── Dot-grid background ── */}
      <DotCanvas viewRef={editorViewRef} />

      {/* ── Diagram canvas ── */}
      <DiagramCanvas
        states={automaton.states}
        transitions={automaton.transitions}
        initialId={automaton.initialId}
        selectedId={automaton.selectedId}
        tool={tool}
        activeStateIds={mode === 'simulate' ? simulator.sim.activeIds   : undefined}
        activeTransIds={mode === 'simulate' ? simulator.sim.activeTransIds : undefined}
        readOnly={mode === 'simulate'}
        hideMinimap={mode === 'simulate'}
        peers={mergedPeers}
        onCursorMove={handleCursorMove}
        onAddState={automaton.addState}
        onMoveState={automaton.moveState}
        onDeleteState={automaton.deleteState}
        onToggleFinal={automaton.toggleFinal}
        onRenameState={automaton.renameState}
        onSetInitial={automaton.setInitial}
        onAddTransition={automaton.addTransition}
        onEditTransition={automaton.editTransition}
        onDeleteTransition={automaton.deleteTransition}
        onSelect={automaton.select}
        onDeleteSelected={automaton.deleteSelected}
        onViewChange={v => { editorViewRef.current = v }}
      />

      {/* ── Topbar ── */}
      <header className={s.topbar}>
        <Link to="/" className={s.brand}>
          <ZedMascot size={28} />
          <span className={s.brandName}>ZFlap</span>
        </Link>

        <div className={s.topbarDivider} />

        <input
          className={s.nameInput}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
              handleSave()
            }
          }}
          spellCheck={false}
          aria-label="Automaton name"
        />

        <div className={s.topbarSpacer} />

        {isPublic && docId && (() => {
          const people = [
            { id: 'me', color: myColorRef.current, initial: myIdentity.initial, name: `You (${myIdentity.name})` },
            ...peers,
          ]
          const visible  = people.slice(0, 4)
          const overflow = people.length - visible.length
          return (
            <div className={s.peopleStack} title={`${people.length} people live on this automaton`}>
              {visible.map((p, i) => (
                <span
                  key={p.id}
                  className={s.peerAvatar}
                  style={{ background: p.color, zIndex: visible.length - i }}
                  title={p.name}
                >
                  {p.initial}
                </span>
              ))}
              {overflow > 0 && <span className={s.peerAvatarMore}>+{overflow}</span>}
            </div>
          )
        })()}

        <button
          className={isSaved ? s.topbarBtnSaved : s.topbarBtn}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <>Saving…</> : isSaved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save</>}
        </button>
        <button className={s.topbarBtn} onClick={handleShare}>
          <Share2 size={14} /> {copied ? 'Copied!' : 'Share'}
        </button>
        <button className={s.topbarBtn} onClick={() => importInputRef.current?.click()}>
          <Upload size={14} /> Import
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleImportFile(file)
            e.target.value = ''
          }}
        />
        <div className={s.exportWrap} data-export-menu>
          <button
            className={s.topbarBtnPrimary}
            onClick={() => setExportOpen(open => !open)}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
          >
            <Download size={14} /> Export <ChevronDown size={13} />
          </button>
          {exportOpen && (
            <div className={s.exportMenu} role="menu">
              <button className={s.exportMenuItem} onClick={() => runExport('json')} role="menuitem">
                <FileJson size={15} /> <span>Automaton (.json)</span>
              </button>
              <button className={s.exportMenuItem} onClick={() => runExport('png')} disabled={automaton.states.length === 0} role="menuitem">
                <ImageIcon size={15} /> <span>Automaton image (.png)</span>
              </button>
              <button className={s.exportMenuItem} onClick={() => runExport('pdf')} disabled={automaton.states.length === 0} role="menuitem">
                <FileText size={15} /> <span>Automaton PDF (.pdf)</span>
              </button>
            </div>
          )}
        </div>

        {!user && (
          <>
            <div className={s.topbarDivider} />
            <button className={s.topbarBtn} onClick={() => setAuthOpen(true)}>
              <User size={14} /> Sign in
            </button>
          </>
        )}
      </header>

      {errorToast && <div className={s.errorToast}>{errorToast}</div>}

      {/* ── Left floating toolbar — always mounted, slides out in simulate mode ── */}
      <FloatingToolbar
        activeTool={tool}
        onToolChange={setTool}
        hidden={mode === 'simulate'}
      />

      {/* ── Right sidebar — always mounted, slides in in simulate mode ── */}
      <SimPanel
        states={automaton.states}
        sigma={new Set(automaton.transitions.map(t => t.label).filter(Boolean))}
        sim={simulator.sim}
        hidden={mode === 'edit'}
        onInput={simulator.setInput}
        onStep={simulator.step}
        onStepBack={simulator.stepBack}
        onRun={simulator.run}
        onReset={simulator.reset}
      />

      {/* ── Small-screen warning ── */}
      <div className={s.smallWarning}>
        <span>Screen too small — please switch to full screen or a larger device.</span>
      </div>

      {/* ── Bottom status bar ── */}
      <div className={s.statusbar}>

        {/* Animated mode toggle */}
        <div className={s.modeToggle} data-mode={mode}>
          <div className={s.modeIndicator} />
          <button
            className={`${s.modeBtn} ${mode === 'edit' ? s.modeBtnActive : ''}`}
            onClick={() => setMode('edit')}
          >
            <Pencil size={11} /> <span className={s.modeBtnLabel}>Edit</span>
          </button>
          <button
            className={`${s.modeBtn} ${mode === 'simulate' ? s.modeBtnActiveGreen : ''}`}
            onClick={() => setMode('simulate')}
          >
            <Play size={11} /> <span className={s.modeBtnLabel}>Simulate</span>
          </button>
        </div>

        <span className={s.statusSep} />

        {mode === 'simulate' && simulator.sim.status !== 'idle' ? (
          simulator.sim.status === 'accepted' ? (
            <span className={s.statusChipGreen}>✓ Simulation complete — accepted</span>
          ) : simulator.sim.status === 'rejected' ? (
            <span className={s.simRejected}>✕ Simulation complete — rejected</span>
          ) : (
            <span>Simulating step {simulator.sim.head} / {simulator.sim.input.length}</span>
          )
        ) : (
          <>
            {/* Automaton info */}
            <span className={chipColor}>{typeLabel}</span>
            <span className={s.statusSep} />
            <span>
              {automaton.states.length} state{automaton.states.length !== 1 ? 's' : ''} ·{' '}
              {automaton.transitions.length} transition{automaton.transitions.length !== 1 ? 's' : ''} ·{' '}
              Σ = {sigmaStr}
            </span>
            <span className={s.statusSep} />
            <span className={dotColor} />
            <span>{typeLabel}</span>
          </>
        )}
      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

    </div>
  )
}
