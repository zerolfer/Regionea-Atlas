import { useState } from 'react'
import MapView from './map/MapView'
import ModeSwitch from './components/ModeSwitch'
import GranularityDial from './components/GranularityDial'
import type { Mode, GranMode, Level } from './types'
import Toast from './components/Toast'
import { Analytics } from "@vercel/analytics/next"

export default function App() {
  const [mode, setMode] = useState<Mode>('politico')
  const [granMode, setGranMode] = useState<GranMode>('auto')
  const [level, setLevel] = useState<Level>('nuts0')
  const [toast, setToast] = useState<string | null>(null)
  
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
        // mode={mode} // XXX: De momento sin uso
        granMode={granMode} 
        level={level} 
        onAutoLevel={(lvl) => setLevel(lvl)}
        onToast={(m)=> setToast(m)}
        />
      <Toast message={toast} />
      <Analytics />
    </>
  )
}