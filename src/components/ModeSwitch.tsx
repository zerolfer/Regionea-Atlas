import type { MapMode } from '../types'

const MODES: Array<{ id: MapMode; label: string; shortLabel: string; icon: string }> = [
  { id: 'political', label: 'Mapa político', shortLabel: 'Político', icon: '⌁' },
  { id: 'physical', label: 'Mapa físico', shortLabel: 'Físico', icon: '△' },
  { id: 'transit', label: 'Transporte público', shortLabel: 'Transporte', icon: '↝' },
]

type Props = { value: MapMode; onChange: (mode: MapMode) => void }

export default function ModeSwitch({ value, onChange }: Props) {
  return (
    <nav className="mode-switch" aria-label="Tipo de mapa">
      {MODES.map((mode) => (
        <button
          key={mode.id}
          className={value === mode.id ? 'mode-button active' : 'mode-button'}
          aria-pressed={value === mode.id}
          aria-label={mode.label}
          onClick={() => onChange(mode.id)}
        >
          <span className="mode-icon" aria-hidden="true">{mode.icon}</span>
          <span>{mode.shortLabel}</span>
        </button>
      ))}
    </nav>
  )
}
