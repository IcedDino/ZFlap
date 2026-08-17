import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Download, Save, Check, Pencil, Play, Share2, User } from 'lucide-react'
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
import { joinAutomatonChannel, leaveAutomatonChannel, broadcastAction, trackPresence, randomPeerColor, randomAnonIdentity, createClientId } from '../lib/realtime'
import type { Peer } from '../lib/realtime'
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
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [peers, setPeers]       = useState<Peer[]>([])

  const channelRef      = useRef<RealtimeChannel | null>(null)
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
  const pendingMoveRef   = useRef<RemoteAction | null>(null)
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
        pendingMoveRef.current = action
        if (elapsed >= 60) {
          lastMoveSentRef.current = now
          broadcastAction(channel, clientIdRef.current, action)
          pendingMoveRef.current = null
        } else if (!moveThrottleTimer.current) {
          moveThrottleTimer.current = setTimeout(() => {
            moveThrottleTimer.current = null
            if (pendingMoveRef.current && channelRef.current) {
              lastMoveSentRef.current = performance.now()
              broadcastAction(channelRef.current, clientIdRef.current, pendingMoveRef.current)
              pendingMoveRef.current = null
            }
          }, 60 - elapsed)
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

  // Cursor position + current selection, shared the same way — Presence,
  // not Broadcast, since it's "my current live state" rather than a
  // one-off event. Same non-memoized-closure reasoning as above.
  function handleCursorMove(x: number, y: number) {
    lastCursorRef.current = { x, y }
    if (channelRef.current) {
      trackPresence(channelRef.current, {
        color: myColorRef.current, initial: myIdentity.initial, name: myIdentity.name,
        x, y, selectedId: automaton.selectedId,
      })
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
    if (!docId) return
    try {
      if (!isPublic) { await setPublic(docId, true); setIsPublic(true) }
      await navigator.clipboard.writeText(`${location.origin}/share/${docId}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error(err)
    }
  }, [docId, isPublic])

  // Join the live channel for public docs — anyone with the link, no
  // account needed. Private docs never join, so they stay single-editor.
  // reconnectNonce forces a clean rejoin (see visibility effect below).
  const [reconnectNonce, setReconnectNonce] = useState(0)
  useEffect(() => {
    if (!docId || !isPublic) return
    const channel = joinAutomatonChannel(docId, {
      clientId: clientIdRef.current,
      initial: {
        color: myColorRef.current, initial: myIdentity.initial, name: myIdentity.name,
        x: null, y: null, selectedId: automaton.selectedId,
      },
      onAction: automaton.applyRemote,
      onPresence: setPeers,
    })
    channelRef.current = channel
    return () => {
      leaveAutomatonChannel(channel)
      channelRef.current = null
      setPeers([])
    }
  }, [docId, isPublic, reconnectNonce]) // eslint-disable-line react-hooks/exhaustive-deps

  // A backgrounded tab's WebSocket can get silently throttled/dropped by
  // the browser — channelRef.current then still looks "present" but its
  // underlying socket state is stale, so sends go nowhere. Catch that
  // the moment the tab becomes active again rather than waiting for the
  // person to notice their edit never synced.
  useEffect(() => {
    function checkStale() {
      if (document.visibilityState !== 'visible') return
      const ch = channelRef.current
      if (ch && ch.state !== 'joined') setReconnectNonce(n => n + 1)
    }
    document.addEventListener('visibilitychange', checkStale)
    window.addEventListener('focus', checkStale)
    return () => {
      document.removeEventListener('visibilitychange', checkStale)
      window.removeEventListener('focus', checkStale)
    }
  }, [])

  // Selection changed without necessarily moving the mouse (e.g. a click),
  // or identity changed (signed in mid-session) — push it to peers right
  // away rather than waiting for the next cursor move.
  useEffect(() => {
    if (!channelRef.current) return
    trackPresence(channelRef.current, {
      color: myColorRef.current, initial: myIdentity.initial, name: myIdentity.name,
      x: lastCursorRef.current?.x ?? null,
      y: lastCursorRef.current?.y ?? null,
      selectedId: automaton.selectedId,
    })
  }, [automaton.selectedId, myIdentity.initial, myIdentity.name])

  useEffect(() => () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (moveThrottleTimer.current) clearTimeout(moveThrottleTimer.current)
  }, [])

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
    return <div className={s.root} />
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
        peers={peers}
        onCursorMove={handleCursorMove}
        onAddState={automaton.addState}
        onMoveState={automaton.moveState}
        onDeleteState={automaton.deleteState}
        onToggleFinal={automaton.toggleFinal}
        onRenameState={automaton.renameState}
        onSetInitial={automaton.setInitial}
        onAddTransition={automaton.addTransition}
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
        <button className={s.topbarBtn} onClick={handleShare} disabled={!docId}>
          <Share2 size={14} /> {copied ? 'Copied!' : 'Share'}
        </button>
        <button className={s.topbarBtnPrimary}>
          <Download size={14} /> Export
        </button>

        {!user && (
          <>
            <div className={s.topbarDivider} />
            <button className={s.topbarBtn} onClick={() => setAuthOpen(true)}>
              <User size={14} /> Sign in
            </button>
          </>
        )}
      </header>

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
