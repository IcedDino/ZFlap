import { useEffect, useRef, useState } from 'react'
import { StepForward, StepBack, Play, Pause, RotateCcw } from 'lucide-react'
import type { FAState, AutomatonType } from '../../hooks/useAutomaton'
import type { SimState } from '../../hooks/useSimulator'
import s from './SimPanel.module.css'

interface Props {
  states:     FAState[]
  sigma:      Set<string>
  sim:        SimState
  automatonType: AutomatonType
  hidden?:    boolean
  onInput:    (v: string) => void
  onRegex:    (v: string) => void
  onStep:     () => void
  onStepBack: () => void
  onRun:      () => void
  onReset:    () => void
  onClose?:   () => void
}

export default function SimPanel({
  states, sigma, sim, automatonType, hidden,
  onInput, onRegex, onStep, onStepBack, onRun, onReset, onClose,
}: Props) {
  const [speed,   setSpeed]   = useState(1)
  const [playing, setPlaying] = useState(false)

  const isDone  = sim.status === 'accepted' || sim.status === 'rejected'
  const canAct  = sim.status === 'running'
  const canBack = sim.history.length > 0
  const chars   = sim.input.split('')
  const atEnd   = sim.head >= chars.length

  // Auto-play: chained setTimeout so it naturally stops when done
  useEffect(() => {
    if (!playing || !canAct) { setPlaying(false); return }
    const id = setTimeout(onStep, 1000 / speed)
    return () => clearTimeout(id)
  }, [playing, canAct, sim.head, speed, onStep])

  // Global keyboard shortcuts
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

  const traceEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [sim.log.length])

  function stateLabel(id: string) {
    return states.find(st => st.id === id)?.label ?? id
  }

  return (
    <aside className={`${s.sidebar} ${hidden ? s.sidebarHidden : ''}`}>

      {/* ── Mobile drag handle ── */}
      {onClose && (
        <button className={s.mobileClose} onClick={onClose} aria-label="Close simulator">
          <span className={s.dragHandle} />
        </button>
      )}

      {/* ── Status banner ── */}
      <div className={`${s.banner} ${
        sim.status === 'accepted' ? s.bannerAccepted :
        sim.status === 'rejected' ? s.bannerRejected :
        sim.status === 'running'  ? s.bannerRunning  :
                                    s.bannerIdle
      }`}>
        <span className={s.bannerEyebrow}>Simulator status</span>
        <span className={s.bannerStatus}>
          {sim.status === 'accepted' ? '✓ Accepted' :
           sim.status === 'rejected' ? '✕ Rejected' :
           sim.status === 'running'  ? 'Running'    : 'Idle'}
        </span>
      </div>

      {/* ── Scrollable body ── */}
      <div className={s.body}>

        {/* Input / regex */}
        {automatonType === 'regex' ? (
          <>
            <div className={s.section}>
              <label className={s.sectionLabel}>Regular expression</label>
              <input
                className={s.inputField}
                value={sim.regex}
                onChange={e => { setPlaying(false); onRegex(e.target.value) }}
                placeholder="e.g. (a|b)*abb"
                spellCheck={false}
                tabIndex={hidden ? -1 : 0}
              />
              {sim.regexError && <p className={s.deadNote}>{sim.regexError}</p>}
            </div>
            <div className={s.section}>
              <label className={s.sectionLabel}>Input string</label>
              <input
                className={s.inputField}
                value={sim.input}
                onChange={e => { setPlaying(false); onInput(e.target.value) }}
                placeholder="Type a string to test…"
                spellCheck={false}
                tabIndex={hidden ? -1 : 0}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onRun() }; e.stopPropagation() }}
              />
            </div>
          </>
        ) : (
          <div className={s.section}>
            <label className={s.sectionLabel}>{automatonType.startsWith('tm-') ? 'Initial tape input' : 'Input string'}</label>
            <input
              className={s.inputField}
              value={sim.input}
              onChange={e => { setPlaying(false); onInput(e.target.value) }}
              placeholder="Type a string to test…"
              spellCheck={false}
              tabIndex={hidden ? -1 : 0}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onRun() }; e.stopPropagation() }}
            />
          </div>
        )}

        {/* Active states + tape */}
        {sim.status !== 'idle' && states.length > 0 && (
          <div className={s.section}>
            <label className={s.sectionLabel}>Active automaton state</label>

            {/* State node circles */}
            <div className={s.stateRow}>
              {states.map(st => {
                const active = sim.activeIds.has(st.id)
                return (
                  <div
                    key={st.id}
                    className={`${s.stateNode} ${active ? s.stateNodeActive : s.stateNodeDim}`}
                  >
                    {st.isFinal && <div className={s.stateNodeInner} />}
                    <span>{st.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Tape */}
            {chars.length > 0 && (
              <div className={s.tapeWrap}>
                {/* Head pointer row */}
                <div className={s.headRow}>
                  {chars.map((_, i) => (
                    <div key={i} className={s.headCell}>
                      {i === sim.head && <span className={s.headArrow}>▼</span>}
                    </div>
                  ))}
                  <div className={s.headCell}>
                    {atEnd && <span className={s.headArrow}>▼</span>}
                  </div>
                </div>

                {/* Symbol cells */}
                <div className={s.tapeScroll}>
                  <div className={s.tape}>
                    {chars.map((ch, i) => {
                      const invalid = sigma.size > 0 && !sigma.has(ch)
                      return (
                        <div key={i} className={`${s.cell} ${
                          i < sim.head   ? s.cellPast   :
                          i === sim.head ? s.cellHead   : s.cellFuture
                        } ${invalid && i >= sim.head ? s.cellInvalid : ''}`}>
                          {ch}
                        </div>
                      )
                    })}
                    <div className={`${s.cell} ${s.cellEnd} ${atEnd ? s.cellHead : ''}`}>⊣</div>
                  </div>
                </div>

                <div className={s.tapePos}>{sim.head} / {sim.input.length}</div>
              </div>
            )}
          </div>
        )}

        {automatonType.startsWith('tm-') && sim.status !== 'idle' && (
          <div className={s.section}>
            <label className={s.sectionLabel}>Tape</label>
            <div className={s.tapeScroll}>
              <div className={s.tape}>
                {(() => {
                  const cells = sim.tape.length ? sim.tape : ['_']
                  const headIndex = sim.tmHead - sim.tmTapeOrigin
                  const start = Math.max(0, Math.min(headIndex - 6, cells.length - 12))
                  const end = Math.min(cells.length, start + 12)
                  return Array.from({ length: Math.max(1, end - start) }, (_, offset) => {
                    const i = start + offset
                    return <div key={i} className={`${s.cell} ${i === headIndex ? s.cellHead : s.cellFuture}`}>{cells[i] ?? '_'}</div>
                  })
                })()}
              </div>
            </div>
            <p className={s.idleNote}>TM transitions use <code>read/write,move</code>, for example <code>0/1,R</code> or <code>1/1,L</code>. Use <code>_</code> for blank.</p>
          </div>
        )}

        {/* Notices */}
        {sim.status === 'rejected' && !atEnd && (
          <p className={s.deadNote}>Dead — no transitions from current states</p>
        )}
        {sim.status === 'idle' && (
          <p className={s.idleNote}>Add an initial state and type a string to start simulating.</p>
        )}

        {/* Computation trace */}
        {sim.log.length > 0 && (
          <div className={s.section}>
            <label className={s.sectionLabel}>Trace</label>
            <div className={s.trace}>
              {sim.log.map((entry, i) => {
                const isCurrent = !isDone && i === sim.log.length - 1
                const isLastDone = isDone && i === sim.log.length - 1
                return (
                  <div
                    key={i}
                    className={`${s.traceRow} ${isCurrent ? s.traceRowCurrent : ''}`}
                  >
                    <div className={s.traceLeft}>
                      {i === 0 ? (
                        <span className={s.traceStart}>→</span>
                      ) : (
                        <>
                          <span className={s.traceIdx}>{i}</span>
                          <span className={s.traceSym}>{entry.symbol}</span>
                        </>
                      )}
                    </div>
                    {i > 0 && <span className={s.traceArrow}>→</span>}
                    <div className={s.traceNodes}>
                      {entry.toIds.length === 0 ? (
                        <span className={s.traceEmpty}>∅</span>
                      ) : entry.toIds.map(id => {
                        const final = states.find(st => st.id === id)?.isFinal
                        return (
                          <span
                            key={id}
                            className={`${s.traceNode} ${
                              isCurrent || isLastDone
                                ? sim.status === 'accepted' && isLastDone
                                  ? s.traceNodeGreen
                                  : s.traceNodeActive
                                : s.traceNodeDim
                            } ${final ? s.traceNodeFinal : ''}`}
                          >
                            {stateLabel(id)}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {isDone && (
                <div className={`${s.traceResult} ${sim.status === 'accepted' ? s.traceResultOk : s.traceResultNo}`}>
                  {sim.status === 'accepted' ? '✓ Accepted' : '✕ Rejected'}
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
                min="0.5"
                max="8"
                step="0.5"
                value={speed}
                onChange={e => setSpeed(parseFloat(e.target.value))}
                tabIndex={hidden ? -1 : 0}
              />
              <span className={s.speedValue}>{speed}×</span>
            </div>
          </div>
        )}

      </div>{/* end .body */}

      {/* ── Fixed footer: controls + hints ── */}
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
