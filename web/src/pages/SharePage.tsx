import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Eye, Play } from 'lucide-react'
import ZedMascot from '../components/ZedMascot'
import DotCanvas from '../components/editor/DotCanvas'
import DiagramCanvas from '../components/editor/DiagramCanvas'
import type { View } from '../components/editor/DiagramCanvas'
import SimPanel from '../components/editor/SimPanel'
import { classifyAutomaton } from '../hooks/useAutomaton'
import { useSimulator } from '../hooks/useSimulator'
import { getById, type AutomatonRow } from '../lib/automatonService'
import es from './EditorPage.module.css'
import s from './SharePage.module.css'

type Mode = 'view' | 'simulate'

const noop = () => {}

export default function SharePage() {
  const { id } = useParams<{ id: string }>()
  const [row, setRow]         = useState<AutomatonRow | null>(null)
  const [status, setStatus]   = useState<'loading' | 'ok' | 'error'>('loading')
  const [mode, setMode]       = useState<Mode>('view')
  const editorViewRef          = useRef<View>({ panX: 0, panY: 0, zoom: 1 })

  useEffect(() => {
    if (!id) { setStatus('error'); return }
    getById(id)
      .then(r => { if (r) { setRow(r); setStatus('ok') } else setStatus('error') })
      .catch(() => setStatus('error'))
  }, [id])

  const states      = row?.data.states ?? []
  const transitions = row?.data.transitions ?? []
  const initialId    = row?.data.initialId ?? null

  const simulator = useSimulator(states, transitions, initialId)

  useEffect(() => {
    if (mode === 'simulate') simulator.reset()
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') {
    return <div className={s.center}>Loading…</div>
  }

  if (status === 'error') {
    return (
      <div className={s.center}>
        <p className={s.errorText}>This automaton isn't shared or doesn't exist.</p>
        <Link to="/" className={es.topbarBtnPrimary}>Go home</Link>
      </div>
    )
  }

  const { label: typeLabel, color: typeColor } = classifyAutomaton(states, transitions, initialId)
  const chipColor =
    typeColor === 'green'  ? es.statusChipGreen :
    typeColor === 'orange' ? es.statusChipOrange :
                             es.statusChip

  return (
    <div className={es.root}>
      <DotCanvas viewRef={editorViewRef} />

      <DiagramCanvas
        states={states}
        transitions={transitions}
        initialId={initialId}
        selectedId={null}
        tool="select"
        activeStateIds={mode === 'simulate' ? simulator.sim.activeIds : undefined}
        activeTransIds={mode === 'simulate' ? simulator.sim.activeTransIds : undefined}
        readOnly
        hideMinimap={mode === 'simulate'}
        onAddState={noop}
        onMoveState={noop}
        onDeleteState={noop}
        onToggleFinal={noop}
        onRenameState={noop}
        onSetInitial={noop}
        onAddTransition={noop}
        onDeleteTransition={noop}
        onSelect={noop}
        onDeleteSelected={noop}
        onViewChange={v => { editorViewRef.current = v }}
      />

      <header className={es.topbar}>
        <Link to="/" className={es.brand}>
          <ZedMascot size={28} />
          <span className={es.brandName}>ZFlap</span>
        </Link>
        <div className={es.topbarDivider} />
        <span className={s.name}>{row?.name}</span>
        <span className={s.badge}><Eye size={11} /> View only</span>
        <div className={es.topbarSpacer} />
        <Link to="/editor" className={es.topbarBtnPrimary}>Open in ZFlap</Link>
      </header>

      <SimPanel
        states={states}
        sigma={new Set(transitions.map(t => t.label).filter(Boolean))}
        sim={simulator.sim}
        hidden={mode === 'view'}
        onInput={simulator.setInput}
        onStep={simulator.step}
        onStepBack={simulator.stepBack}
        onRun={simulator.run}
        onReset={simulator.reset}
      />

      <div className={es.statusbar}>
        <div className={es.modeToggle} data-mode={mode}>
          <div className={es.modeIndicator} />
          <button
            className={`${es.modeBtn} ${mode === 'view' ? es.modeBtnActive : ''}`}
            onClick={() => setMode('view')}
          >
            <Eye size={11} /> <span className={es.modeBtnLabel}>View</span>
          </button>
          <button
            className={`${es.modeBtn} ${mode === 'simulate' ? es.modeBtnActiveGreen : ''}`}
            onClick={() => setMode('simulate')}
          >
            <Play size={11} /> <span className={es.modeBtnLabel}>Simulate</span>
          </button>
        </div>
        <span className={es.statusSep} />
        <span className={chipColor}>{typeLabel}</span>
        <span className={es.statusSep} />
        <span>
          {states.length} state{states.length !== 1 ? 's' : ''} ·{' '}
          {transitions.length} transition{transitions.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
