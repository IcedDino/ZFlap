import { useRef, useState, useEffect, useCallback } from 'react'
import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import s from './CursorShowcase.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type CursorType = 'duo'|'cross'|'bloom'|'trail'|'bracket'|'spotlight'|'pixel'|'snap'|'elastic'

interface CursorProps {
  cellRef: RefObject<HTMLDivElement>
  btnRef:  RefObject<HTMLButtonElement>
}

const CONFIGS: Array<{ type: CursorType; name: string; desc: string; dark?: boolean }> = [
  { type: 'duo',       name: 'Duo',       desc: 'Dot + lagging ring'       },
  { type: 'cross',     name: 'Cross',     desc: 'Fine crosshair'            },
  { type: 'bloom',     name: 'Bloom',     desc: 'Glow pulse on click'       },
  { type: 'trail',     name: 'Trail',     desc: 'Particle breadcrumb'       },
  { type: 'bracket',   name: 'Bracket',   desc: 'Corner L-brackets'         },
  { type: 'spotlight', name: 'Spotlight', desc: 'Vignette cutout',  dark: true },
  { type: 'pixel',     name: 'Pixel',     desc: '8-bit arrow'               },
  { type: 'snap',      name: 'Snap',      desc: 'Magnetic ring'             },
  { type: 'elastic',   name: 'Elastic',   desc: 'Spring with overshoot'     },
]

// ── Shared mouse hook ─────────────────────────────────────────────────────────

function useCellMouse(ref: RefObject<HTMLDivElement>) {
  const posRef    = useRef({ x: -999, y: -999 })
  const [pos,     setPos]     = useState({ x: -999, y: -999 })
  const [inside,  setInside]  = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove  = (e: MouseEvent) => {
      const b = el.getBoundingClientRect()
      const p = { x: e.clientX - b.left, y: e.clientY - b.top }
      posRef.current = p; setPos({ ...p })
    }
    const onEnter = () => setInside(true)
    const onLeave = () => { setInside(false); setHovered(false) }
    const onOver  = (e: MouseEvent) => {
      if ((e.target as Element).closest('button,a,input')) setHovered(true)
    }
    const onOut   = (e: MouseEvent) => {
      if ((e.target as Element).closest('button,a,input')) setHovered(false)
    }
    el.addEventListener('mousemove',  onMove)
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('mouseover',  onOver)
    el.addEventListener('mouseout',   onOut)
    return () => {
      el.removeEventListener('mousemove',  onMove)
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('mouseover',  onOver)
      el.removeEventListener('mouseout',   onOut)
    }
  }, [ref])

  return { pos, posRef, inside, hovered }
}

// ── 1. Duo ────────────────────────────────────────────────────────────────────

function DuoCursor({ cellRef }: CursorProps) {
  const { pos, posRef, inside, hovered } = useCellMouse(cellRef)
  const rp = useRef({ x: -999, y: -999 })
  const [ring, setRing] = useState({ x: -999, y: -999 })

  useEffect(() => {
    let raf: number
    const tick = () => {
      const t = posRef.current
      if (Math.hypot(t.x - rp.current.x, t.y - rp.current.y) > 160)
        rp.current = { ...t }
      else {
        rp.current.x += (t.x - rp.current.x) * 0.13
        rp.current.y += (t.y - rp.current.y) * 0.13
      }
      setRing({ ...rp.current })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [posRef])

  if (!inside) return null
  const c = hovered ? '#F97316' : 'white'
  return (
    <>
      <div style={{ position:'absolute', pointerEvents:'none', left:pos.x, top:pos.y,
        width:10, height:10, borderRadius:'50%', background:c,
        transform:'translate(-50%,-50%)', zIndex:30,
        boxShadow:'0 0 0 1.5px rgba(0,0,0,0.32)', transition:'background .15s' }} />
      <div style={{ position:'absolute', pointerEvents:'none', left:ring.x, top:ring.y,
        width:32, height:32, borderRadius:'50%',
        border:`1.5px solid ${hovered ? '#F97316' : 'rgba(255,255,255,0.88)'}`,
        transform:'translate(-50%,-50%)', zIndex:30,
        boxShadow:'0 0 0 1px rgba(0,0,0,0.12)', transition:'border-color .15s' }} />
    </>
  )
}

// ── 2. Cross ──────────────────────────────────────────────────────────────────

function CrossCursor({ cellRef }: CursorProps) {
  const { pos, inside, hovered } = useCellMouse(cellRef)
  if (!inside) return null
  const c = hovered ? '#F97316' : '#1A1814'
  const arm = 14, gap = 5
  const { x, y } = pos
  return (
    <svg style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible', zIndex:30 }}>
      <line x1={x-arm-gap} y1={y}       x2={x-gap}       y2={y}       stroke={c} strokeWidth={1}/>
      <line x1={x+gap}     y1={y}       x2={x+arm+gap}   y2={y}       stroke={c} strokeWidth={1}/>
      <line x1={x}         y1={y-arm-gap} x2={x}         y2={y-gap}   stroke={c} strokeWidth={1}/>
      <line x1={x}         y1={y+gap}   x2={x}           y2={y+arm+gap} stroke={c} strokeWidth={1}/>
      <circle cx={x} cy={y} r={1.8} fill={c}/>
    </svg>
  )
}

// ── 3. Bloom ──────────────────────────────────────────────────────────────────

function BloomCursor({ cellRef }: CursorProps) {
  const { pos, posRef, inside, hovered } = useCellMouse(cellRef)
  const scaleRef = useRef(1)
  const velRef   = useRef(0)
  const [scale,  setScale] = useState(1)

  useEffect(() => {
    const el = cellRef.current; if (!el) return
    const fn = () => { scaleRef.current = 4.2; velRef.current = 0 }
    el.addEventListener('mousedown', fn)
    return () => el.removeEventListener('mousedown', fn)
  }, [cellRef])

  useEffect(() => {
    let raf: number
    const tick = () => {
      velRef.current   += (1 - scaleRef.current) * 0.2 - velRef.current * 0.62
      scaleRef.current += velRef.current
      setScale(scaleRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [posRef])

  if (!inside) return null
  return (
    <>
      <div style={{ position:'absolute', pointerEvents:'none', zIndex:29,
        left:pos.x, top:pos.y, width:54, height:54, borderRadius:'50%',
        background: hovered
          ? 'radial-gradient(circle, rgba(249,115,22,0.28) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(26,24,20,0.13) 0%, transparent 70%)',
        transform:`translate(-50%,-50%) scale(${scale})`,
        transition: scale > 3 ? 'none' : 'background .15s' }} />
      <div style={{ position:'absolute', pointerEvents:'none', zIndex:30,
        left:pos.x, top:pos.y, width:10, height:10, borderRadius:'50%',
        background: hovered ? '#F97316' : '#1A1814',
        transform:'translate(-50%,-50%)',
        boxShadow:'0 0 0 1.5px rgba(0,0,0,0.15)', transition:'background .15s' }} />
    </>
  )
}

// ── 4. Trail ──────────────────────────────────────────────────────────────────

const TRAIL_LEN = 12

function TrailCursor({ cellRef }: CursorProps) {
  const { posRef, inside } = useCellMouse(cellRef)
  const [dots, setDots] = useState<Array<{x:number;y:number}>>([])

  useEffect(() => {
    const trail: Array<{x:number;y:number}> = []
    let raf: number
    const tick = () => {
      trail.unshift({ ...posRef.current })
      if (trail.length > TRAIL_LEN) trail.pop()
      setDots([...trail])
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [posRef])

  if (!inside || dots.length === 0) return null
  return (
    <>
      {dots.map((d, i) => {
        const t = i / (TRAIL_LEN - 1)
        const size = Math.max(2, 10 * (1 - t * 0.7))
        return (
          <div key={i} style={{ position:'absolute', pointerEvents:'none', zIndex:30,
            left:d.x, top:d.y, width:size, height:size, borderRadius:'50%',
            background: `rgba(249,115,22,${(1 - t) * 0.9})`,
            transform:'translate(-50%,-50%)' }} />
        )
      })}
    </>
  )
}

// ── 5. Bracket ────────────────────────────────────────────────────────────────

function BracketCursor({ cellRef }: CursorProps) {
  const { pos, inside, hovered } = useCellMouse(cellRef)
  if (!inside) return null
  const g = hovered ? 7 : 15, a = 11, sw = 1.5
  const c = hovered ? '#F97316' : '#1A1814'
  const { x, y } = pos
  return (
    <svg style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible', zIndex:30 }}>
      <path d={`M${x-g},${y-g+a} L${x-g},${y-g} L${x-g+a},${y-g}`}   stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round"/>
      <path d={`M${x+g-a},${y-g} L${x+g},${y-g} L${x+g},${y-g+a}`}   stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round"/>
      <path d={`M${x-g},${y+g-a} L${x-g},${y+g} L${x-g+a},${y+g}`}   stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round"/>
      <path d={`M${x+g-a},${y+g} L${x+g},${y+g} L${x+g},${y+g-a}`}   stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round"/>
    </svg>
  )
}

// ── 6. Spotlight ──────────────────────────────────────────────────────────────

function SpotlightCursor({ cellRef }: CursorProps) {
  const { pos, inside } = useCellMouse(cellRef)
  const { x, y } = inside ? pos : { x: -9999, y: -9999 }
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:10,
      background:`radial-gradient(circle 68px at ${x}px ${y}px,
        transparent 0%,
        transparent 52px,
        rgba(12,10,7,0.82) 70px)` }} />
  )
}

// ── 7. Pixel ──────────────────────────────────────────────────────────────────

const PX = 5
const ARROW_MAP = [
  [1,0,0,0,0,0,0],
  [1,1,0,0,0,0,0],
  [1,1,1,0,0,0,0],
  [1,1,1,1,0,0,0],
  [1,1,1,1,1,0,0],
  [1,1,1,1,1,1,0],
  [1,1,1,0,0,0,0],
  [1,0,1,1,0,0,0],
  [0,0,0,1,1,0,0],
  [0,0,0,0,1,0,0],
]

function PixelCursor({ cellRef }: CursorProps) {
  const { pos, inside, hovered } = useCellMouse(cellRef)
  if (!inside) return null
  const c = hovered ? '#F97316' : '#1A1814'
  return (
    <div style={{ position:'absolute', pointerEvents:'none', zIndex:30,
      left:pos.x - 1, top:pos.y - 1, width: 7*PX, height: ARROW_MAP.length*PX }}>
      {ARROW_MAP.map((row, ri) =>
        row.map((px, ci) => !px ? null : (
          <div key={`${ri}-${ci}`} style={{ position:'absolute',
            left:ci*PX, top:ri*PX, width:PX-1, height:PX-1,
            background:c }} />
        ))
      )}
    </div>
  )
}

// ── 8. Snap ───────────────────────────────────────────────────────────────────

const SNAP_R = 88

function SnapCursor({ cellRef, btnRef }: CursorProps) {
  const { pos, posRef, inside, hovered } = useCellMouse(cellRef)
  const rp     = useRef({ x: -999, y: -999 })
  const [ring, setRing]   = useState({ x: -999, y: -999 })
  const [snapped, setSnapped] = useState(false)

  useEffect(() => {
    let raf: number
    const tick = () => {
      const mouse = posRef.current
      let tx = mouse.x, ty = mouse.y
      let snap = false

      if (btnRef.current && cellRef.current) {
        const br = btnRef.current.getBoundingClientRect()
        const cr = cellRef.current.getBoundingClientRect()
        const bx = br.left - cr.left + br.width  / 2
        const by = br.top  - cr.top  + br.height / 2
        const dist = Math.hypot(mouse.x - bx, mouse.y - by)
        if (dist < SNAP_R) {
          const t = (1 - dist / SNAP_R) ** 2
          tx = mouse.x + (bx - mouse.x) * t
          ty = mouse.y + (by - mouse.y) * t
          snap = dist < SNAP_R * 0.45
        }
      }

      setSnapped(snap)
      if (Math.hypot(tx - rp.current.x, ty - rp.current.y) > 160)
        rp.current = { x: tx, y: ty }
      else {
        rp.current.x += (tx - rp.current.x) * 0.2
        rp.current.y += (ty - rp.current.y) * 0.2
      }
      setRing({ ...rp.current })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [posRef, btnRef, cellRef])

  if (!inside) return null
  return (
    <>
      <div style={{ position:'absolute', pointerEvents:'none', zIndex:30,
        left:pos.x, top:pos.y, width:6, height:6, borderRadius:'50%',
        background:'#1A1814', transform:'translate(-50%,-50%)',
        boxShadow:'0 0 0 1px rgba(0,0,0,0.2)' }} />
      <div style={{ position:'absolute', pointerEvents:'none', zIndex:30,
        left:ring.x, top:ring.y, width:32, height:32, borderRadius:'50%',
        border:`1.5px solid ${snapped || hovered ? '#F97316' : '#1A1814'}`,
        transform:`translate(-50%,-50%) scale(${snapped ? 1.85 : 1})`,
        transition:'transform .18s ease-out, border-color .15s',
        opacity:0.8 }} />
    </>
  )
}

// ── 9. Elastic ────────────────────────────────────────────────────────────────

function ElasticCursor({ cellRef }: CursorProps) {
  const { pos, posRef, inside } = useCellMouse(cellRef)
  const rx = useRef(-999), ry = useRef(-999)
  const vx = useRef(0),    vy = useRef(0)
  const [ring, setRing] = useState({ x: -999, y: -999 })

  useEffect(() => {
    let raf: number
    const tick = () => {
      const t = posRef.current
      if (Math.hypot(t.x - rx.current, t.y - ry.current) > 160) {
        rx.current = t.x; ry.current = t.y
        vx.current = vy.current = 0
      } else {
        vx.current = vx.current * 0.72 + (t.x - rx.current) * 0.13
        vy.current = vy.current * 0.72 + (t.y - ry.current) * 0.13
        rx.current += vx.current
        ry.current += vy.current
      }
      setRing({ x: rx.current, y: ry.current })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [posRef])

  if (!inside) return null
  return (
    <>
      <div style={{ position:'absolute', pointerEvents:'none', zIndex:30,
        left:pos.x, top:pos.y, width:10, height:10, borderRadius:'50%',
        background:'#F97316', transform:'translate(-50%,-50%)',
        boxShadow:'0 0 0 1px rgba(0,0,0,0.12)' }} />
      <div style={{ position:'absolute', pointerEvents:'none', zIndex:30,
        left:ring.x, top:ring.y, width:32, height:32, borderRadius:'50%',
        border:'2px solid #F97316',
        transform:'translate(-50%,-50%)', opacity:0.65 }} />
    </>
  )
}

// ── Cursor map ────────────────────────────────────────────────────────────────

const CURSOR_MAP: Record<CursorType, React.FC<CursorProps>> = {
  duo: DuoCursor, cross: CrossCursor, bloom: BloomCursor, trail: TrailCursor,
  bracket: BracketCursor, spotlight: SpotlightCursor, pixel: PixelCursor,
  snap: SnapCursor, elastic: ElasticCursor,
}

// ── Cell ──────────────────────────────────────────────────────────────────────

interface Ripple { id: number; x: number; y: number }

function CursorCell({ type, name, desc, dark }: { type: CursorType; name: string; desc: string; dark?: boolean }) {
  const cellRef = useRef<HTMLDivElement>(null!)
  const btnRef  = useRef<HTMLButtonElement>(null!)
  const [clicks,  setClicks]  = useState(0)
  const [ripples, setRipples] = useState<Ripple[]>([])

  const addRipple = useCallback((x: number, y: number) => {
    const id = Date.now() + Math.random()
    setRipples(rs => [...rs, { id, x, y }])
    setTimeout(() => setRipples(rs => rs.filter(r => r.id !== id)), 700)
  }, [])

  const onCellClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button')) return
    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    addRipple(e.clientX - r.left, e.clientY - r.top)
    setClicks(c => c + 1)
  }, [addRipple])

  const onBtnClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const br  = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const cr  = cellRef.current.getBoundingClientRect()
    addRipple(br.left - cr.left + br.width / 2, br.top - cr.top + br.height / 2)
    setClicks(c => c + 1)
  }, [addRipple])

  const CursorComp = CURSOR_MAP[type]

  return (
    <div
      ref={cellRef}
      className={`${s.cell} ${dark ? s.cellDark : ''}`}
      onClick={onCellClick}
    >
      <CursorComp cellRef={cellRef} btnRef={btnRef} />

      <div className={s.cellLabel}>
        <span className={`${s.cellName} ${dark ? s.cellNameDark : ''}`}>{name}</span>
        <span className={`${s.cellDesc} ${dark ? s.cellDescDark : ''}`}>{desc}</span>
      </div>

      <button
        ref={btnRef}
        className={`${s.testBtn} ${dark ? s.testBtnDark : ''}`}
        onClick={onBtnClick}
        style={{ zIndex: type === 'spotlight' ? 5 : 20 }}
      >
        {clicks === 0 ? 'Click anywhere' : `${clicks}×`}
      </button>

      {ripples.map(r => (
        <div key={r.id} className={s.ripple} style={{ left:r.x, top:r.y }} />
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CursorShowcase() {
  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <Link to="/" className={s.back}>← Home</Link>
        <div className={s.topbarDiv} />
        <span className={s.title}>Cursor Lab</span>
        <span className={s.subtitle}>Move into each cell · click to test</span>
      </header>

      <div className={s.grid}>
        {CONFIGS.map(c => <CursorCell key={c.type} {...c} />)}
      </div>
    </div>
  )
}
