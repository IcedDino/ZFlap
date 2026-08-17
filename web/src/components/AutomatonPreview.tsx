import type { FAState, FATransition } from '../hooks/useAutomaton'
import { STATE_R, FINAL_GAP } from '../hooks/useAutomaton'

interface Props {
  states:      FAState[]
  transitions: FATransition[]
  initialId:   string | null
}

function norm(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy) || 1
  return [dx / len, dy / len]
}

export default function AutomatonPreview({ states, transitions, initialId }: Props) {
  if (states.length === 0) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 200 100">
        <circle cx="100" cy="50" r="20" fill="none" stroke="#E6E2DA" strokeWidth="2" strokeDasharray="4 4" />
      </svg>
    )
  }

  const pad = STATE_R + FINAL_GAP + 24
  const xs = states.map(s => s.x)
  const ys = states.map(s => s.y)
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const w = Math.max(Math.max(...xs) - Math.min(...xs) + pad * 2, 1)
  const h = Math.max(Math.max(...ys) - Math.min(...ys) + pad * 2, 1)

  return (
    <svg width="100%" height="100%" viewBox={`${minX} ${minY} ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="pv-arrow" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0.5 L0,5.5 L6.5,3 z" fill="#C8C3BA" />
        </marker>
      </defs>

      {transitions.map(t => {
        const from = states.find(s => s.id === t.fromId)
        const to   = states.find(s => s.id === t.toId)
        if (!from || !to) return null

        if (from.id === to.id) {
          const { x, y } = from
          const sp = 14, hgt = 60
          const d = `M ${x - sp},${y - STATE_R + 2} C ${x - hgt * 0.55},${y - hgt} ${x + hgt * 0.55},${y - hgt} ${x + sp},${y - STATE_R + 2}`
          return <path key={t.id} d={d} stroke="#C8C3BA" strokeWidth="2" fill="none" markerEnd="url(#pv-arrow)" />
        }

        const [ux, uy] = norm(to.x - from.x, to.y - from.y)
        const x1 = from.x + ux * STATE_R, y1 = from.y + uy * STATE_R
        const x2 = to.x   - ux * STATE_R, y2 = to.y   - uy * STATE_R
        return <line key={t.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C8C3BA" strokeWidth="2" markerEnd="url(#pv-arrow)" />
      })}

      {states.map(st => (
        <g key={st.id}>
          {st.isFinal && (
            <circle cx={st.x} cy={st.y} r={STATE_R + FINAL_GAP} fill="none" stroke="#E6E2DA" strokeWidth="3" />
          )}
          <circle cx={st.x} cy={st.y} r={STATE_R} fill="#FFFFFF" stroke={st.id === initialId ? '#F97316' : '#E6E2DA'} strokeWidth="3" />
        </g>
      ))}
    </svg>
  )
}
