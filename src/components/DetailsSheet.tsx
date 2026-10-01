import { useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { bottomSheetHeight, bottomSheetSafeAreaInset, nearestBottomSheetLevel } from '../bottom-sheet'
import type { BottomSheetLevel } from '../types'

type Props = {
  level: BottomSheetLevel
  onLevelChange: (level: BottomSheetLevel) => void
  hasContent?: boolean
  children: ReactNode
  footer: ReactNode
}

export default function DetailsSheet({ level, onLevelChange, hasContent, children, footer }: Props) {
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const drag = useRef<{ pointerId: number; startY: number; startHeight: number; currentHeight: number; safeAreaInset: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const viewportHeight = () => window.visualViewport?.height ?? window.innerHeight

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (window.innerWidth > 760 || event.button !== 0 || event.isPrimary === false || drag.current) return
    const target = event.target instanceof Element ? event.target : null
    const handle = target?.closest<HTMLElement>('.sheet-handle')
    const heading = target?.closest<HTMLElement>('.panel-heading')
    if (!handle && (!heading || target?.closest('button, a, input, select, textarea'))) return
    const captureTarget = handle || heading!
    const height = event.currentTarget.getBoundingClientRect().height
    captureTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, startY: event.clientY, startHeight: height, currentHeight: height, safeAreaInset: bottomSheetSafeAreaInset(), moved: false }
    setDragHeight(height)
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const minimum = bottomSheetHeight('peek', viewportHeight(), current.safeAreaInset)
    const maximum = bottomSheetHeight('full', viewportHeight(), current.safeAreaInset)
    current.currentHeight = Math.max(minimum, Math.min(maximum, current.startHeight + current.startY - event.clientY))
    if (Math.abs(event.clientY - current.startY) > 5) current.moved = true
    setDragHeight(current.currentHeight)
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    drag.current = null
    setDragHeight(null)
    if (current.moved) {
      suppressClick.current = true
      if (event.type === 'pointerup') onLevelChange(nearestBottomSheetLevel(current.currentHeight, viewportHeight(), current.safeAreaInset))
      window.setTimeout(() => { suppressClick.current = false }, 0)
    }
  }

  return (
    <aside
      className={`side-panel sheet-${level} ${dragHeight != null ? 'is-dragging' : ''} ${hasContent ? 'has-content' : ''}`}
      style={dragHeight == null ? undefined : { '--sheet-drag-height': `${dragHeight}px` } as CSSProperties}
      onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
    >
      <button className="sheet-handle"
        onClick={() => { if (!suppressClick.current) onLevelChange(level === 'peek' ? 'half' : level === 'half' ? 'full' : 'peek') }}
        aria-label={`Panel ${level === 'peek' ? 'mínimo; ampliar' : level === 'half' ? 'medio; ampliar' : 'completo; reducir'}`}
      ><span /></button>
      <div className="panel-scroll">{children}</div>
      <footer className="panel-footer">{footer}</footer>
    </aside>
  )
}
