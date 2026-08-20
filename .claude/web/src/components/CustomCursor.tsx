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

    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY }

    const onOver = (e: MouseEvent) => {
      if ((e.target as Element).closest(
        'button, a, input, select, textarea, [role="button"], label'
      )) {
        dot.dataset.hover  = ''
        ring.dataset.hover = ''
      }
    }
    const onOut = (e: MouseEvent) => {
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

    document.addEventListener('mousemove',  onMove)
    document.addEventListener('mouseover',  onOver)
    document.addEventListener('mouseout',   onOut)
    document.addEventListener('mousedown',  onDown)
    document.addEventListener('mouseup',    onUp)
    document.documentElement.addEventListener('mouseleave', onLeave)
    document.documentElement.addEventListener('mouseenter', onEnter)

    tick()

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousemove',  onMove)
      document.removeEventListener('mouseover',  onOver)
      document.removeEventListener('mouseout',   onOut)
      document.removeEventListener('mousedown',  onDown)
      document.removeEventListener('mouseup',    onUp)
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
