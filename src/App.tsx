import { useState } from 'react'
import MapView from './map/MapView'
import ModeSwitch from './components/ModeSwitch'
import GranularityDial from './components/GranularityDial'

export type Mode = 'politico' | 'relieve' | 'transportes'

export default function App() {
  const [mode, setMode] = useState<Mode>('politico')
  const [granMode, setGranMode] = useState<'auto' | 'manual'>('auto')
  const [level, setLevel] = useState<'nuts0' | 'nuts1' | 'nuts2' | 'nuts3'>('nuts0')
  
  return (
    <>
      <div className="ui card">
        <div className="row" style={{ marginBottom: 8 }}>
          <ModeSwitch value={mode} onChange={setMode} />
        </div>
        {mode === 'politico' && (
          <GranularityDial
            mode={granMode}
            level={level}
            onMode={setGranMode}
            onDeepen={() => {
              const NEXT = { nuts0: 'nuts1', nuts1: 'nuts2', nuts2: 'nuts3', nuts3: 'nuts3' } as const
              const next = NEXT[level]
              setLevel(next)
            }}
            onBack={() => {
              const PREV = { nuts0: 'nuts0', nuts1: 'nuts0', nuts2: 'nuts1', nuts3: 'nuts2' } as const
              const prev = PREV[level]
              setLevel(prev)
            }}
          />
        )}
      </div>
      <MapView 
        mode={mode} 
        granMode={granMode} 
        level={level} 
        onAutoLevel={(lvl) => setLevel(lvl)}
        />
    </>
  )
}