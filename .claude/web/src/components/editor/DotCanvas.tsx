import { useEffect, useRef } from 'react'
import type { View } from './DiagramCanvas'

const SPACING   = 32       // world units between grid points
const DOT_R     = 1.8      // base dot radius (world units)
const REPEL_R   = 110      // cursor influence radius (screen px)
const REPEL_STR = 46       // max displacement (screen px)
const LERP      = 0.11     // spring return speed per frame
const BASE_A    = 0.22     // base dot opacity

interface Props {
  viewRef: { current: View }
}

export default function DotCanvas({ viewRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    let raf: number
    const mouse = { x: -99999, y: -99999 }
    let dotColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-dot').trim() || 'rgba(26,24,20,0.20)'

    // Per-dot spring displacement, keyed by "wx,wy" world position
    const springs = new Map<string, { dx: number; dy: number }>()

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = canvas.offsetWidth  * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function draw() {
      const { panX, panY, zoom } = viewRef.current
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)

      // World-space extent of the visible viewport (with 1-dot margin)
      const wL = (-panX) / zoom - SPACING
      const wT = (-panY) / zoom - SPACING
      const wR = (w - panX) / zoom + SPACING
      const wB = (h - panY) / zoom + SPACING

      // Snap grid start to spacing
      const startX = Math.floor(wL / SPACING) * SPACING
      const startY = Math.floor(wT / SPACING) * SPACING

      for (let wy = startY; wy <= wB; wy += SPACING) {
        for (let wx = startX; wx <= wR; wx += SPACING) {
          // World → screen (unsprung origin)
          const sx0 = wx * zoom + panX
          const sy0 = wy * zoom + panY

          // Repulsion: computed from the origin, not the animated position,
          // so the spring is stable regardless of current displacement
          const rdx  = sx0 - mouse.x
          const rdy  = sy0 - mouse.y
          const dist = Math.sqrt(rdx * rdx + rdy * rdy)

          let tdx = 0, tdy = 0
          let proximity = 0

          if (dist < REPEL_R && dist > 0.1) {
            proximity  = 1 - dist / REPEL_R
            const zoomScale = zoom / 3.0
            const force = proximity * proximity * REPEL_STR * zoomScale
            tdx = (rdx / dist) * force
            tdy = (rdy / dist) * force
          }

          // Spring state
          const key = `${wx},${wy}`
          let sp = springs.get(key)
          if (!sp) { sp = { dx: 0, dy: 0 }; springs.set(key, sp) }
          sp.dx += (tdx - sp.dx) * LERP
          sp.dy += (tdy - sp.dy) * LERP

          const cx = sx0 + sp.dx
          const cy = sy0 + sp.dy

          // Fade and shrink near cursor
          const alpha = BASE_A * (1 - proximity * 0.72)
          const r     = DOT_R  * zoom * (1 - proximity * 0.45)

          if (alpha < 0.004 || r < 0.15) continue

          const match = dotColor.match(/rgba?\(([^)]+)\)/)
          if (match) {
            const parts = match[1].split(',').map(part => part.trim())
            ctx.fillStyle = `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha.toFixed(3)})`
          } else {
            ctx.fillStyle = dotColor
          }

          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      raf = requestAnimationFrame(draw)
    }

    const onMove  = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    const onLeave = () => { mouse.x = -99999; mouse.y = -99999 }

    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const themeObserver = new MutationObserver(() => {
      dotColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-dot').trim() || 'rgba(26,24,20,0.20)'
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    resize()
    draw()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
    }
  }, [viewRef])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  )
}
