import { useEffect, useRef, useState } from 'react'
import { StepForward, StepBack, Play, Pause, RotateCcw } from 'lucide-react'
import type { FAState } from '../../hooks/useAutomaton'
import type { TmSimState } from '../../hooks/useTmSimulator'
import s from './TmSimPanel.module.css'

const BLANK = '_'
const WINDOW = 11

interface Props {
  states:     FAState[]
  sim:        TmSimState
  hidden?:    boolean
  onInput:    (v: string) => void
  onStep:     () => void
  onStepBack: () => void
  onRun:      () => void
  onReset:    () => void
  onClose?:   () => void
}

function stateLabel(id: string, states: FAState[]): string {
  return states.find(st => st.id === id)?.label ?? id
}

function getTapeWindow(tape: string[], head: number) {
  const half  = Math.floor(WINDOW / 2)
  const start = head - half
  const cells = []
  for (let i = 0; i < WINDOW; i++) {
    const idx = start + i
    cells.push({ char: tape[idx] ?? BLANK, idx, isHead: idx === head })
  }
  return cells
}

export default function TmSimPanel({
  states, sim, hidden,
  onInput, onStep, onStepBack, onRun, onReset, onClose,
}: Props) {
  const [speed,   setSpeed]   = useState(1)
  const [playing, setPlaying] = useState(false)

  const isDone   = sim.status === 'accepted' || sim.status === 'halted'
  const canAct   = sim.status === 'running'
  const canBack  = sim.history.length > 0

  // Auto-play
  useEffect(() => {
    if (!playing || !canAct) { setPlaying(false); return }
    const id = setTimeout(onStep, 1000 / speed)
    return () => clearTimeout(id)
  }, [playing, canAct, sim.head, speed, onStep])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (hidden) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') { e.preventDefault(); onStep() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); onStepBack() }
      if (e.key === ' ')          { e.preventDefault(); setPlaying(p => p ? false : canAct) }
      if (e.key === 'Enter')      { e.preventDefault(); onRun() }
      if (e.key === 'Escape')     { e.preventDefault(); setPlaying(false); onReset() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hidden, canAct, onStep, onStepBack, onRun, onReset])

  const tapeWindow = getTapeWindow(sim.tape, sim.head)
  const lastLog    = sim.log.length > 0 ? sim.log[sim.log.length - 1] : null
  const traceEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [sim.log.length])

  return (
    <aside className={`${s.sidebar} ${hidden ? s.sidebarHidden : ''}`}>

      {/* Mobile drag handle */}
      {onClose && (
        <button className={s.mobileClose} onClick={onClose} aria-label="Close simulator">
          <span className={s.dragHandle} />
        </button>
      )}

      {/* ── Status banner ── */}
      <div className={`${s.banner} ${
        sim.status === 'accepted' ? s.bannerAccepted :
        sim.status === 'halted'   ? s.bannerRejected :
        sim.status === 'running'  ? s.bannerRunning  :
                                     s.bannerIdle
      }`}>
        <span className={s.bannerEyebrow}>Turing Machine</span>
        <span className={s.bannerStatus}>
          {sim.status === 'accepted' ? '✓ Accepted' :
           sim.status === 'halted'   ? '✕ Halted'   :
           sim.status === 'running'  ? 'Running'    : 'Idle'}
        </span>
      </div>

      {/* ── Scrollable body ── */}
      <div className={s.body}>

        {/* Input */}
        <div className={s.section}>
          <label className={s.sectionLabel}>Input string</label>
          <input
            className={s.inputField}
            value={sim.input}
            onChange={e => { setPlaying(false); onInput(e.target.value) }}
            placeholder="e.g. aabb"
            spellCheck={false}
            tabIndex={hidden ? -1 : 0}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); onRun() }
              e.stopPropagation()
            }}
          />
        </div>

        {/* Tape visualization */}
        <div className={s.section}>
          <label className={s.sectionLabel}>Tape</label>
          <div className={s.tapeWrap}>
            <div className={s.tapeRow}>
              {tapeWindow.map(({ char, idx, isHead }) => (
                <div
                  key={idx}
                  className={`${s.cell} ${isHead ? s.cellActive : ''} ${char === BLANK ? s.cellBlank : ''}`}
                >
                  {char === BLANK ? '·' : char}
                </div>
              ))}
            </div>
            <div className={s.headBar}>
              {tapeWindow.map(({ idx, isHead }) => (
                <div key={idx} className={`${s.headCell} ${isHead ? s.headArrowActive : ''}`}>
                  {isHead && <span className={s.headArrow}>▲</span>}
                </div>
              ))}
            </div>
          </div>
          <div className={s.tapePos}>
            Head: {sim.head} &nbsp;·&nbsp; Cells: {sim.tape.filter(c => c !== BLANK).length} non-blank
          </div>
        </div>

        {/* Current state + last action */}
        {sim.state && (
          <div className={s.section}>
            <label className={s.sectionLabel}>Current state</label>
            <div className={s.stateInfo}>
              <span className={`${s.stateBadge} ${
                sim.status === 'accepted' ? s.stateAccepted :
                sim.status === 'halted'   ? s.stateHalted :
                s.stateRunning
              }`}>
                {stateLabel(sim.state, states)}
              </span>
              {sim.status === 'running' && (
                <span className={s.stateHint}>accepting if final</span>
              )}
            </div>

            {lastLog && (
              <div className={s.lastAction}>
                <span className={s.actionLabel}>Last step</span>
                <div className={s.actionDetail}>
                  <span className={s.actionCell}>read <b>{lastLog.read}</b></span>
                  <span className={s.actionArrow}>→</span>
                  <span className={s.actionCell}>write <b>{lastLog.write}</b></span>
                  <span className={s.actionArrow}>→</span>
                  <span className={s.actionCell}>{lastLog.dir}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notices */}
        {sim.status === 'halted' && (
          <p className={s.deadNote}>Halted — no transition for current state and tape symbol.</p>
        )}
        {sim.status === 'idle' && (
          <p className={s.idleNote}>Type a string and press Enter or Run to start the Turing Machine.</p>
        )}

        {/* Computation trace */}
        {sim.log.length > 0 && (
          <div className={s.section}>
            <label className={s.sectionLabel}>Trace ({sim.log.length} steps)</label>
            <div className={s.trace}>
              {sim.log.map((entry, i) => {
                const isCurrent = !isDone && i === sim.log.length - 1
                return (
                  <div
                    key={i}
                    className={`${s.traceRow} ${isCurrent ? s.traceRowCurrent : ''}`}
                  >
                    <span className={s.traceIdx}>{i + 1}</span>
                    <span className={s.traceCell}>{stateLabel(entry.fromState, states)}</span>
                    <span className={s.traceArrow}>→</span>
                    <span className={s.traceCell}>{stateLabel(entry.toState, states)}</span>
                    <span className={s.traceSym}>{entry.read}</span>
                    <span className={s.traceDir}>{entry.dir}</span>
                    <span className={s.traceSym}>{entry.write}</span>
                  </div>
                )
              })}
              {isDone && (
                <div className={`${s.traceResult} ${sim.status === 'accepted' ? s.traceResultOk : s.traceResultNo}`}>
                  {sim.status === 'accepted' ? '✓ Accepted' : '✕ Halted'}
                </div>
              )}
              <div ref={traceEndRef} />
            </div>
          </div>
        )}

        {/* Speed slider */}
        {sim.status !== 'idle' && (
          <div className={s.speedRow}>
            <span className={s.speedLabel}>Speed</span>
            <div className={s.speedSliderWrap}>
              <input
                type="range"
                className={s.speedSlider}
                min="0.5" max="8" step="0.5"
                value={speed}
                onChange={e => setSpeed(parseFloat(e.target.value))}
                tabIndex={hidden ? -1 : 0}
              />
              <span className={s.speedValue}>{speed}×</span>
            </div>
          </div>
        )}

      </div>

      {/* ── Fixed footer: controls ── */}
      <div className={s.footer}>
        <div className={s.controls}>
          <button
            className={s.btnIcon}
            onClick={() => { setPlaying(false); onStepBack() }}
            disabled={!canBack}
            tabIndex={hidden ? -1 : 0}
            title="Step back (←)"
          >
            <StepBack size={14} />
          </button>

          <button
            className={`${s.btnPlay} ${playing ? s.btnPlaying : ''}`}
            onClick={() => setPlaying(p => !p)}
            disabled={!canAct && !playing}
            tabIndex={hidden ? -1 : 0}
            title={playing ? 'Pause (Space)' : 'Auto-play (Space)'}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? 'Pause' : 'Play'}
          </button>

          <button
            className={s.btnStep}
            onClick={() => { setPlaying(false); onStep() }}
            disabled={!canAct}
            tabIndex={hidden ? -1 : 0}
            title="Step (→)"
          >
            <StepForward size={13} /> Step
          </button>

          <button
            className={s.btnIcon}
            onClick={() => { setPlaying(false); onReset() }}
            tabIndex={hidden ? -1 : 0}
            title="Reset (Esc)"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

    </aside>
  )
}
