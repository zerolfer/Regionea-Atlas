import { useState } from 'react'
import MapView from './map/MapView'
import ModeSwitch from './components/ModeSwitch'
import GranularityDial from './components/GranularityDial'

export type Mode = 'politico' | 'relieve' | 'transportes'

export default function App() {
  const [mode, setMode] = useState<Mode>('politico')
  const [granularity, setGranularity] = useState<'auto' | 'nuts0' | 'nuts1' | 'nuts2' | 'nuts3'>('auto')

  return (
    <>
      <div className="ui card">
        <div className="row" style={{ marginBottom: 8 }}>
          <ModeSwitch value={mode} onChange={setMode} />
        </div>
        {mode === 'politico' && (
          <GranularityDial value={granularity} onChange={setGranularity} />
        )}
      </div>
      <MapView mode={mode} granularity={granularity} />
    </>
  )
}