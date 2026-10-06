import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

type Props = { active: boolean; onToggle: () => void; onHold: () => void; children: ReactNode }

export default function FilterButton({ active, onToggle, onHold, children }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gesture = useRef<{ pointerId: number | null; x: number; y: number; suppressClick: boolean; inProgress: boolean }>({ pointerId: null, x: 0, y: 0, suppressClick: false, inProgress: false })
  const holdCallback = useRef(onHold)
  useEffect(() => { holdCallback.current = onHold }, [onHold])

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }, [])
  const cancel = useCallback(() => {
    if (!gesture.current.inProgress) return
    clearTimer()
    gesture.current.suppressClick = gesture.current.pointerId !== null
    gesture.current.inProgress = false
  }, [clearTimer])
  const start = (pointerId: number | null, x = 0, y = 0) => {
    clearTimer()
    gesture.current = { pointerId, x, y, suppressClick: false, inProgress: true }
    timer.current = setTimeout(() => {
      timer.current = null
      gesture.current.suppressClick = true
      holdCallback.current()
    }, 500)
  }
  useEffect(() => {
    window.addEventListener('blur', cancel)
    return () => { clearTimer(); window.removeEventListener('blur', cancel) }
  }, [clearTimer, cancel])

  return <button
    type="button"
    className={active ? 'active' : ''}
    aria-pressed={active}
    title="Mantén pulsado para mostrar solo este filtro; repite para activar todos"
    aria-description="Mantén pulsado, también con Espacio, para mostrar solo este filtro; repite para activar todos"
    onPointerDown={(event) => {
      if (event.button !== 0 || !event.isPrimary) return
      start(event.pointerId, event.clientX, event.clientY)
    }}
    onPointerMove={(event) => {
      const current = gesture.current
      if (current.pointerId === event.pointerId && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) cancel()
    }}
    onPointerUp={(event) => {
      if (gesture.current.pointerId === event.pointerId) { clearTimer(); gesture.current.inProgress = false }
    }}
    onPointerCancel={(event) => { if (gesture.current.pointerId === event.pointerId) cancel() }}
    onPointerLeave={(event) => { if (gesture.current.pointerId === event.pointerId) cancel() }}
    onBlur={cancel}
    onContextMenu={(event) => event.preventDefault()}
    onKeyDown={(event) => {
      if (event.key === ' ' && !event.repeat) start(null)
      if (event.key === 'Enter' && !event.repeat) { clearTimer(); gesture.current.suppressClick = false }
    }}
    onKeyUp={(event) => { if (event.key === ' ') { clearTimer(); gesture.current.inProgress = false } }}
    onClick={(event) => {
      const current = gesture.current
      if (current.suppressClick && (event.detail !== 0 || current.pointerId === null)) {
        current.suppressClick = false
        event.preventDefault()
        return
      }
      clearTimer()
      onToggle()
    }}
  >{children}</button>
}
