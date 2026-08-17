import { useState, useCallback, useEffect, useRef } from 'react'
import s from './DfaDemo.module.css'

// ── DFA definition: accepts binary strings with an even number of 1s ──────────

const DELTA: Record<string, Record<string, string>> = {
  q0: { '0': 'q0', '1': 'q1' },
  q1: { '0': 'q1', '1': 'q0' },
}
const INITIAL = 'q0'
const FINAL   = new Set(['q0'])
const ALLOWED = new Set(['0', '1'])

// ── SVG geometry ──────────────────────────────────────────────────────────────

const CX = { q0: 100, q1: 300 }
const CY = { q0: 95,  q1: 95  }
const R  = 26

// Cubic bezier path for the q0→q1 arc (above)
const PATH_01 = `M ${CX.q0 + R + 2},${CY.q0 - 6} C 160,40 240,40 ${CX.q1 - R - 2},${CY.q1 - 6}`
// Cubic bezier path for the q1→q0 arc (below)
const PATH_10 = `M ${CX.q1 - R - 2},${CY.q1 + 6} C 240,150 160,150 ${CX.q0 + R + 2},${CY.q0 + 6}`
// Self-loop paths
const LOOP_0  = `M ${CX.q0 - 14},${CY.q0 - R + 2} C ${CX.q0 - 40},${CY.q0 - 70} ${CX.q0 + 40},${CY.q0 - 70} ${CX.q0 + 14},${CY.q0 - R + 2}`
const LOOP_1  = `M ${CX.q1 - 14},${CY.q1 - R + 2} C ${CX.q1 - 40},${CY.q1 - 70} ${CX.q1 + 40},${CY.q1 - 70} ${CX.q1 + 14},${CY.q1 - R + 2}`

type EdgeId = '0→0' | '1→1' | '0→1-1' | '1→0-1'

function edgeForTransition(from: string, sym: string): EdgeId {
  if (from === 'q0' && sym === '0') return '0→0'
  if (from === 'q1' && sym === '0') return '1→1'
  if (from === 'q0' && sym === '1') return '0→1-1'
  return '1→0-1'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StateNode({
  id, active, visited, isFinal, isInitial,
}: {
  id: string; active: boolean; visited: boolean; isFinal: boolean; isInitial: boolean
}) {
  const cx = CX[id as keyof typeof CX]
  const cy = CY[id as keyof typeof CY]
  const label = id === 'q0' ? 'q₀' : 'q₁'

  return (
    <g>
      {/* Glow behind active node */}
      {active && (
        <circle cx={cx} cy={cy} r={R + 12}
          fill="rgba(240,207,96,0.08)"
          className={s.activeGlow}
        />
      )}
      {/* Outer ring for final states */}
      {isFinal && (
        <circle cx={cx} cy={cy} r={R + 6}
          fill="none"
          stroke={active ? 'rgba(240,207,96,0.7)' : visited ? 'rgba(240,207,96,0.3)' : 'rgba(255,255,255,0.1)'}
          strokeWidth="1.5"
        />
      )}
      {/* Main circle */}
      <circle
        cx={cx} cy={cy} r={R}
        fill={active ? 'rgba(240,207,96,0.12)' : visited ? 'rgba(240,207,96,0.04)' : '#13151E'}
        stroke={
          active   ? '#F0CF60'
          : visited  ? 'rgba(240,207,96,0.45)'
          : 'rgba(255,255,255,0.12)'
        }
        strokeWidth={active ? 2 : 1.5}
        style={{ transition: 'all 0.2s ease' }}
      />
      {/* Label */}
      <text
        x={cx} y={cy + 5}
        textAnchor="middle"
        fontSize="14" fontFamily="Inter,sans-serif" fontWeight="600"
        fill={active ? '#F0CF60' : visited ? 'rgba(240,207,96,0.7)' : 'rgba(255,255,255,0.35)'}
        style={{ transition: 'fill 0.2s ease' }}
      >
        {label}
      </text>
      {/* Initial arrow */}
      {isInitial && (
        <line
          x1={cx - R - 22} y1={cy}
          x2={cx - R - 2}  y2={cy}
          stroke={active ? 'rgba(240,207,96,0.7)' : 'rgba(255,255,255,0.2)'}
          strokeWidth="1.5"
          markerEnd="url(#arrowInit)"
        />
      )}
    </g>
  )
}

function Edge({
  d, label, lx, ly, active, faint,
}: {
  d: string; label: string; lx: number; ly: number;
  active: boolean; faint: boolean;
}) {
  return (
    <g>
      <path
        d={d} fill="none"
        stroke={active ? '#F0CF60' : faint ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'}
        strokeWidth={active ? 2 : 1.5}
        markerEnd={active ? 'url(#arrowActive)' : 'url(#arrow)'}
        style={{ transition: 'stroke 0.2s ease, stroke-width 0.2s ease' }}
      />
      <text
        x={lx} y={ly}
        textAnchor="middle"
        fontSize="12" fontFamily="JetBrains Mono,monospace"
        fill={active ? '#F0CF60' : 'rgba(255,255,255,0.3)'}
        style={{ transition: 'fill 0.2s ease' }}
      >
        {label}
      </text>
    </g>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DfaDemo() {
  const [input, setInput] = useState('')
  const [activeEdge, setActiveEdge] = useState<EdgeId | null>(null)
  const edgeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  // Derive state path from input
  const statePath = (() => {
    const path = [INITIAL]
    let cur = INITIAL
    for (const c of input) {
      const nxt = DELTA[cur]?.[c]
      if (!nxt) break
      cur = nxt
      path.push(cur)
    }
    return path
  })()

  const currentState = statePath[statePath.length - 1]
  const accepted = input.length > 0 && FINAL.has(currentState)
  const rejected = input.length > 0 && !FINAL.has(currentState)

  const visitedStates = new Set(statePath)

  const flashEdge = useCallback((from: string, sym: string) => {
    clearTimeout(edgeTimer.current)
    setActiveEdge(edgeForTransition(from, sym))
    edgeTimer.current = setTimeout(() => setActiveEdge(null), 400)
  }, [])

  const handleKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      setInput(prev => prev.slice(0, -1))
      return
    }
    if (!ALLOWED.has(e.key)) return
    e.preventDefault()
    const prevState = statePath[statePath.length - 1]
    setInput(prev => prev + e.key)
    flashEdge(prevState, e.key)
  }, [statePath, flashEdge])

  useEffect(() => () => clearTimeout(edgeTimer.current), [])

  return (
    <div className={s.root}>
      {/* ── Header ── */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.badge}>DFA</span>
          <span className={s.title}>Even number of 1s</span>
        </div>
        <button className={s.resetBtn} onClick={() => setInput('')} disabled={!input}>
          Reset
        </button>
      </div>

      {/* ── SVG diagram ── */}
      <div className={s.svgWrap} onClick={() => inputRef.current?.focus()}>
        <svg viewBox="0 0 420 185" className={s.svg}>
          <defs>
            <marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="rgba(255,255,255,0.2)" />
            </marker>
            <marker id="arrowActive" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#F0CF60" />
            </marker>
            <marker id="arrowInit" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="rgba(255,255,255,0.2)" />
            </marker>
          </defs>

          {/* Edges */}
          <Edge d={LOOP_0}  label="0" lx={CX.q0}       ly={CY.q0 - 54} active={activeEdge === '0→0'}   faint={false} />
          <Edge d={LOOP_1}  label="0" lx={CX.q1}       ly={CY.q1 - 54} active={activeEdge === '1→1'}   faint={false} />
          <Edge d={PATH_01} label="1" lx={200}          ly={52}         active={activeEdge === '0→1-1'} faint={false} />
          <Edge d={PATH_10} label="1" lx={200}          ly={148}        active={activeEdge === '1→0-1'} faint={false} />

          {/* State nodes */}
          <StateNode id="q0" active={currentState === 'q0'} visited={visitedStates.has('q0')} isFinal isInitial />
          <StateNode id="q1" active={currentState === 'q1'} visited={visitedStates.has('q1')} isFinal={false} isInitial={false} />

          {/* State labels below nodes */}
          <text x={CX.q0} y={CY.q0 + R + 18} textAnchor="middle" fontSize="10"
            fill="rgba(255,255,255,0.2)" fontFamily="Inter,sans-serif">
            {FINAL.has('q0') ? 'accept' : ''}
          </text>
          <text x={CX.q1} y={CY.q1 + R + 18} textAnchor="middle" fontSize="10"
            fill="rgba(255,255,255,0.2)" fontFamily="Inter,sans-serif">
            reject
          </text>
        </svg>
        <div className={s.svgHint}>Click diagram then type 0 or 1</div>
      </div>

      {/* ── Input field ── */}
      <div className={s.inputRow}>
        <div className={s.inputWrap} onClick={() => inputRef.current?.focus()}>
          <span className={s.inputPrefix}>w =</span>
          <span className={s.inputChars}>
            {input.split('').map((c, i) => {
              const stateAfter = statePath[i + 1]
              const isLast = i === input.length - 1
              return (
                <span
                  key={i}
                  className={`${s.char} ${isLast ? s.charLast : ''}`}
                  title={`→ ${stateAfter === 'q0' ? 'q₀' : 'q₁'}`}
                >
                  {c}
                </span>
              )
            })}
            <span className={s.cursor} />
          </span>
          {!input && <span className={s.placeholder}>type 0 or 1…</span>}
        </div>
        <input
          ref={inputRef}
          className={s.hiddenInput}
          onKeyDown={handleKey}
          readOnly
          aria-label="DFA input"
        />
      </div>

      {/* ── State path ── */}
      {input.length > 0 && (
        <div className={s.pathRow}>
          {statePath.map((st, i) => (
            <span key={i} className={s.pathItem}>
              <span className={`${s.pathState} ${i === statePath.length - 1 ? s.pathStateCurrent : ''}`}>
                {st === 'q0' ? 'q₀' : 'q₁'}
              </span>
              {i < statePath.length - 1 && (
                <span className={s.pathArrow}>
                  <span className={s.pathSym}>{input[i]}</span>
                  →
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* ── Result ── */}
      <div className={s.result}>
        {accepted && (
          <div className={s.resultAccepted}>
            ✓ Accepted — even number of 1s
          </div>
        )}
        {rejected && (
          <div className={s.resultRejected}>
            ✗ Rejected — odd number of 1s
          </div>
        )}
        {!input && (
          <div className={s.resultIdle}>
            Accepts binary strings with an even number of 1s
          </div>
        )}
      </div>
    </div>
  )
}
