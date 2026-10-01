import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'

const DESKTOP_QUERY = '(min-width: 761px)'

export default function DetailsDock({ children, onCollapsedChange }: { children: ReactNode; onCollapsedChange?: (collapsed: boolean) => void }) {
  const contentId = useId()
  const [collapsed, setCollapsed] = useState(false)
  const [desktop, setDesktop] = useState(() => window.matchMedia?.(DESKTOP_QUERY).matches ?? false)

  useEffect(() => {
    const media = window.matchMedia?.(DESKTOP_QUERY)
    if (!media) return
    const update = () => setDesktop(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const label = collapsed ? 'Mostrar panel de detalles' : 'Plegar panel de detalles'
  return (
    <div className={`details-dock${desktop && collapsed ? ' is-collapsed' : ''}`}>
      <div id={contentId} className="details-content" inert={desktop && collapsed}>{children}</div>
      {desktop && <button
        className="details-toggle"
        aria-controls={contentId}
        aria-expanded={!collapsed}
        aria-label={label}
        title={label}
        onClick={() => {
          const next = !collapsed
          setCollapsed(next)
          onCollapsedChange?.(next)
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={collapsed ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>}
    </div>
  )
}
