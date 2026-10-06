import { useId, useState } from 'react'
import type { MapMode } from '../types'

const COLORS: Record<MapMode, string> = { political: '#b35e37', physical: '#4e765c', transit: '#326b89' }

function Symbol({ color }: { color: string }) {
  return <g color={color}>
    <circle cx="64" cy="64" r="60" fill="#f7f2e8" />
    <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="5" />
    <g transform="translate(64 64) scale(1.12) translate(-64 -64)">
      <path d="M27 73c8-20 17-35 35-39 17-4 34 6 38 21 5 18-8 36-29 41-17 4-35-3-44-23Z" fill="currentColor" />
      <path d="M37 69c6-14 15-23 27-25 11-2 22 4 25 14 3 12-6 23-20 27-12 3-25-2-32-16Z" fill="none" stroke="#f7f2e8" strokeWidth="5" strokeLinecap="round" />
      <path d="M49 64c4-7 8-11 15-12 7-1 13 3 14 9 1 7-4 13-12 15-7 1-13-3-17-12Z" fill="none" stroke="#29251f" strokeWidth="5" strokeLinecap="round" />
      <circle cx="64" cy="63" r="5" fill="#f7f2e8" />
    </g>
    <path d="M84.16 88.64 100.1 104.2" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
  </g>
}

export default function AnimatedLogo({ mode, locateToken }: { mode: MapMode; locateToken: number }) {
  const id = useId()
  const [transition, setTransition] = useState({ mode, from: mode, serial: 0 })
  // Track every actual mode change, including navigation and rapid reversals.
  if (transition.mode !== mode) {
    setTransition({ mode, from: transition.mode, serial: transition.serial + 1 })
  }
  const maskId = `logo-mode-${id}`
  return <svg className="atlas-logo" viewBox="0 0 128 128" aria-hidden="true">
    <g key={transition.serial} className={transition.serial > 0 ? 'atlas-logo-transition' : undefined}>
    <Symbol color={COLORS[transition.from]} />
    {transition.serial > 0 && <g key={transition.serial} className="atlas-logo-mode">
      <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="128" height="128">
        <circle className="atlas-logo-reveal" cx="64" cy="64" r="92" fill="white" />
      </mask></defs>
      <g mask={`url(#${maskId})`}><Symbol color={COLORS[mode]} /></g>
    </g>}
    </g>
    {locateToken > 0 && <g key={`locate-${locateToken}`} color={COLORS[mode]}>
      <circle className="atlas-logo-wave" cx="64" cy="64" r="22" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <circle className="atlas-logo-wave atlas-logo-echo" cx="64" cy="64" r="22" fill="none" stroke="currentColor" strokeWidth="3.5" />
    </g>}
  </svg>
}
