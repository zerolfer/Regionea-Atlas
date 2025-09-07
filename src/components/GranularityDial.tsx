import type { GranMode as Mode, Level } from '../types'

export default function GranularityDial({
    mode, level, onMode, onDeepen, onBack
}: {
    mode: Mode
    level: Level
    onMode: (m: Mode) => void
    onDeepen: () => void
    onBack: () => void
}) {
    return (
        <div className="row">
            <button className={mode === 'auto' ? 'active' : ''} aria-pressed={mode==='auto'} onClick={() => onMode('auto')}>Auto</button>
            <button className={mode === 'manual' ? 'active' : ''} aria-pressed={mode==='manual'} onClick={() => onMode('manual')}>Manual</button>
            {mode === 'manual' && (
                <>
                    <button title="Retroceder" onClick={onBack}>←</button>
                    <button title="Profundizar" onClick={onDeepen}>Profundizar →</button>
                    <span style={{ marginLeft: 6, opacity: .7 }}>{level.toUpperCase()}</span>
                </>
            )}
        </div>
    )
}
