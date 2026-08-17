import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Download, Save, Pencil, Play, Share2, User } from 'lucide-react'
import ZedMascot from '../components/ZedMascot'
import DotCanvas from '../components/editor/DotCanvas'
import DiagramCanvas from '../components/editor/DiagramCanvas'
import type { View } from '../components/editor/DiagramCanvas'
import FloatingToolbar from '../components/editor/FloatingToolbar'
import type { Tool } from '../components/editor/FloatingToolbar'
import SimPanel from '../components/editor/SimPanel'
import AuthModal from '../components/AuthModal'
import { useAutomaton, classifyAutomaton } from '../hooks/useAutomaton'
import { useSimulator } from '../hooks/useSimulator'
import { useAuth } from '../hooks/useAuth'
import { create, update, setPublic, getById } from '../lib/automatonService'
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

  const automaton      = useAutomaton({ persistLocal: !id })
  const editorViewRef  = useRef<View>({ panX: 0, panY: 0, zoom: 1 })

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
        setLoaded(true)
      })
      .catch(() => { setLoadError('Failed to load this automaton.'); setLoaded(true) })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    if (!user) { setAuthOpen(true); return }
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
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }, [user, docId, name, automaton.states, automaton.transitions, automaton.initialId, navigate])

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

        <button className={s.topbarBtn} onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Saving…' : 'Save'}
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
