type Mode = 'auto' | 'manual'
type Level = 'nuts0' | 'nuts1' | 'nuts2' | 'nuts3'

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
            <button className={mode === 'auto' ? 'active' : ''} onClick={() => onMode('auto')}>Auto</button>
            <button className={mode === 'manual' ? 'active' : ''} onClick={() => onMode('manual')}>Manual</button>
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
