import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Play, Square, RotateCcw } from 'lucide-react'
import s from './TmDemo.module.css'

// ── TM definition: aⁿbⁿ ──────────────────────────────────────────────────────

const BLANK = '_'

interface TmRule {
  write: string
  dir: 'L' | 'R' | 'S'
  next: string
}

const RULES: Record<string, Record<string, TmRule>> = {
  q0: {
    a: { write: 'X', dir: 'R', next: 'q1' },
    Y: { write: 'Y', dir: 'R', next: 'q3' },
  },
  q1: {
    a: { write: 'a', dir: 'R', next: 'q1' },
    Y: { write: 'Y', dir: 'R', next: 'q1' },
    b: { write: 'Y', dir: 'L', next: 'q2' },
  },
  q2: {
    a: { write: 'a', dir: 'L', next: 'q2' },
    Y: { write: 'Y', dir: 'L', next: 'q2' },
    X: { write: 'X', dir: 'R', next: 'q0' },
  },
  q3: {
    Y: { write: 'Y', dir: 'R', next: 'q3' },
    [BLANK]: { write: BLANK, dir: 'S', next: 'qf' },
  },
}

const FINAL   = new Set(['qf'])
const INITIAL = 'q0'

// ── Simulation ────────────────────────────────────────────────────────────────

interface Snapshot {
  state: string
  tape: string[]
  head: number        // absolute index into tape[]
  read: string
  write: string
  dir: 'L' | 'R' | 'S' | '—'
}

function buildTrace(input: string): Snapshot[] {
  // Pad with blanks on both ends
  const tape = [BLANK, BLANK, ...input.split(''), BLANK, BLANK, BLANK]
  let head = 2  // first real character
  let state = INITIAL

  const snaps: Snapshot[] = [
    { state, tape: [...tape], head, read: '—', write: '—', dir: '—' },
  ]

  for (let step = 0; step < 500; step++) {
    if (FINAL.has(state)) break

    // Expand tape
    while (head < 0) { tape.unshift(BLANK); head++ }
    while (head >= tape.length) tape.push(BLANK)

    const sym  = tape[head] ?? BLANK
    const rule = RULES[state]?.[sym]
    if (!rule) break   // no rule → implicit reject

    tape[head] = rule.write
    const prevState = state
    state = rule.next

    if      (rule.dir === 'R') head++
    else if (rule.dir === 'L') head--

    while (head >= tape.length) tape.push(BLANK)
    while (head < 0) { tape.unshift(BLANK); head++ }

    snaps.push({ state, tape: [...tape], head, read: sym, write: rule.write, dir: rule.dir })
    void prevState
  }

  return snaps
}

// ── Preset inputs ─────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'ab',     valid: true  },
  { label: 'aabb',   valid: true  },
  { label: 'aaabbb', valid: true  },
  { label: 'aab',    valid: false },
  { label: 'abbb',   valid: false },
]

// ── Tape window ───────────────────────────────────────────────────────────────

const WINDOW = 9   // number of cells visible

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function TmDemo() {
  const [preset, setPreset]   = useState('aabb')
  const [trace, setTrace]     = useState<Snapshot[]>(() => buildTrace('aabb'))
  const [step, setStep]       = useState(0)
  const [playing, setPlaying] = useState(false)
  const playRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const load = useCallback((input: string) => {
    clearInterval(playRef.current)
    setPlaying(false)
    setPreset(input)
    setTrace(buildTrace(input))
    setStep(0)
  }, [])

  const cur     = trace[step]
  const isLast  = step === trace.length - 1
  const isDone  = isLast
  const accepted = isDone && FINAL.has(cur.state)
  const rejected = isDone && !FINAL.has(cur.state)

  const stepFwd = useCallback(() => {
    setStep(s => Math.min(s + 1, trace.length - 1))
  }, [trace])

  const stepBwd = useCallback(() => {
    clearInterval(playRef.current)
    setPlaying(false)
    setStep(s => Math.max(s - 1, 0))
  }, [])

  const reset = useCallback(() => {
    clearInterval(playRef.current)
    setPlaying(false)
    setStep(0)
  }, [])

  // Auto-play
  useEffect(() => {
    if (!playing) return
    if (isLast) { setPlaying(false); return }
    playRef.current = setInterval(() => {
      setStep(s => {
        if (s >= trace.length - 1) {
          clearInterval(playRef.current)
          setPlaying(false)
          return s
        }
        return s + 1
      })
    }, 500)
    return () => clearInterval(playRef.current)
  }, [playing, isLast, trace])

  const tapeWindow = getTapeWindow(cur.tape, cur.head)

  return (
    <div className={s.root}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.badge}>TM</span>
          <span className={s.title}>aⁿbⁿ Turing machine</span>
        </div>
        <span className={s.stepCount}>
          step {step} / {trace.length - 1}
        </span>
      </div>

      {/* Preset selector */}
      <div className={s.presets}>
        <span className={s.presetsLabel}>Input:</span>
        {PRESETS.map(p => (
          <button
            key={p.label}
            className={`${s.presetBtn} ${preset === p.label ? s.presetBtnActive : ''} ${p.valid ? s.presetValid : s.presetInvalid}`}
            onClick={() => load(p.label)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Tape */}
      <div className={s.tapeArea}>
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
        <div className={s.headIndicator} />
      </div>

      {/* State + last action */}
      <div className={s.info}>
        <div className={s.infoState}>
          <span className={s.infoLabel}>State</span>
          <span className={`${s.infoValue} ${accepted ? s.infoAccepted : rejected ? s.infoRejected : s.infoRunning}`}>
            {cur.state}
          </span>
        </div>
        {step > 0 && (
          <>
            <div className={s.infoItem}>
              <span className={s.infoLabel}>Read</span>
              <span className={`${s.infoValue} ${s.infoMono}`}>{cur.read}</span>
            </div>
            <div className={s.infoItem}>
              <span className={s.infoLabel}>Write</span>
              <span className={`${s.infoValue} ${s.infoMono}`}>{cur.write}</span>
            </div>
            <div className={s.infoItem}>
              <span className={s.infoLabel}>Move</span>
              <span className={`${s.infoValue} ${s.infoMono}`}>{cur.dir}</span>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className={s.controls}>
        <button className={s.controlBtn} onClick={reset} disabled={step === 0} title="Reset">
          <RotateCcw size={15} />
        </button>
        <button className={s.controlBtn} onClick={stepBwd} disabled={step === 0} title="Previous step">
          <ChevronLeft size={18} />
        </button>
        <button
          className={`${s.controlBtn} ${s.controlBtnPlay}`}
          onClick={() => setPlaying(p => !p)}
          disabled={isLast}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Square size={14} /> : <Play size={14} />}
        </button>
        <button className={s.controlBtn} onClick={stepFwd} disabled={isLast} title="Next step">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Result */}
      {isDone && (
        <div className={`${s.result} ${accepted ? s.resultAccepted : s.resultRejected}`}>
          {accepted ? `✓ Accepted — "${preset}" ∈ aⁿbⁿ` : `✗ Rejected — "${preset}" ∉ aⁿbⁿ`}
        </div>
      )}
    </div>
  )
}
