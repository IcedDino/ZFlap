import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import s from './CustomCursor.module.css'

const LERP = 0.45

function CursorImpl() {
  const dotRef  = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dot  = dotRef.current!
    const ring = ringRef.current!

    let mx = -300, my = -300
    let rx = -300, ry = -300
    let raf: number

    function tick() {
      rx += (mx - rx) * LERP
      ry += (my - ry) * LERP
      dot.style.transform  = `translate(${mx}px,${my}px) translate(-50%,-50%)`
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`
      raf = requestAnimationFrame(tick)
    }

    // Pointer events keep the custom cursor synchronized while an element has
    // pointer capture during drag. Mousemove alone can stop updating during
    // captured pointer interactions, which makes the native (hidden) cursor
    // appear to freeze and then jump when the drag ends.
    const onMove = (e: PointerEvent) => { mx = e.clientX; my = e.clientY }

    const onOver = (e: PointerEvent) => {
      if ((e.target as Element).closest(
        'button, a, input, select, textarea, [role="button"], label'
      )) {
        dot.dataset.hover  = ''
        ring.dataset.hover = ''
      }
    }
    const onOut = (e: PointerEvent) => {
      if ((e.target as Element).closest(
        'button, a, input, select, textarea, [role="button"], label'
      )) {
        delete dot.dataset.hover
        delete ring.dataset.hover
      }
    }

    const onDown = () => { dot.dataset.click = '';  ring.dataset.click = '' }
    const onUp   = () => { delete dot.dataset.click; delete ring.dataset.click }

    const onLeave = () => { dot.style.opacity = '0'; ring.style.opacity = '0' }
    const onEnter = () => { dot.style.opacity = '1'; ring.style.opacity = '1' }

    document.addEventListener('pointermove',  onMove)
    document.addEventListener('pointerover',  onOver)
    document.addEventListener('pointerout',   onOut)
    document.addEventListener('pointerdown',  onDown)
    document.addEventListener('pointerup',    onUp)
    document.documentElement.addEventListener('mouseleave', onLeave)
    document.documentElement.addEventListener('mouseenter', onEnter)

    tick()

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointermove',  onMove)
      document.removeEventListener('pointerover',  onOver)
      document.removeEventListener('pointerout',   onOut)
      document.removeEventListener('pointerdown',  onDown)
      document.removeEventListener('pointerup',    onUp)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      document.documentElement.removeEventListener('mouseenter', onEnter)
    }
  }, [])

  return (
    <>
      <div ref={dotRef}  className={s.dot}  />
      <div ref={ringRef} className={s.ring} />
    </>
  )
}

export default function CustomCursor() {
  const { pathname } = useLocation()
  if (pathname === '/cursor-showcase') return null
  return <CursorImpl />
}
