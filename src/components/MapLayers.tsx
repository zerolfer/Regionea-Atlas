import { useEffect, useRef, useState } from 'react'
import type { MapAppearance, MapMode } from '../types'

type Props = { mode: MapMode; value: MapAppearance; onChange: (value: MapAppearance) => void }

export default function MapLayers({ mode, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const firstOption = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    firstOption.current?.focus()
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  function close() { setOpen(false); trigger.current?.focus() }

  return <div className={`map-layers ${open ? 'is-open' : ''}`} ref={root}>
    <button className="layers-trigger" ref={trigger} aria-label="Capas del mapa" aria-expanded={open} aria-controls="map-layers-options" aria-haspopup="dialog" onClick={() => setOpen(!open)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span>Capas</span>
    </button>
    {open && <section id="map-layers-options" className="layers-popover" role="dialog" aria-label="Capas del mapa" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
      <div className="layers-heading"><strong>Mapa de fondo</strong><button className="icon-button" aria-label="Cerrar capas" onClick={close}>×</button></div>
      <fieldset className="basemap-options"><legend className="sr-only">Mapa de fondo</legend>
        <label className={value.basemap === 'plan' ? 'selected' : ''}><span className="basemap-swatch swatch-plan" aria-hidden="true" /><span><input ref={firstOption} type="radio" name="basemap" checked={value.basemap === 'plan'} onChange={() => onChange({ ...value, basemap: 'plan' })} /> Plano</span></label>
        <label className={value.basemap === 'satellite' ? 'selected' : ''}><span className="basemap-swatch swatch-satellite" aria-hidden="true" /><span><input type="radio" name="basemap" checked={value.basemap === 'satellite'} onChange={() => onChange({ ...value, basemap: 'satellite' })} /> Satélite</span></label>
      </fieldset>
      {mode === 'physical' && <div className="terrain-options">
        <label><input type="checkbox" checked={value.hypsometry} onChange={() => onChange({ ...value, hypsometry: !value.hypsometry })} /> Colores de altitud</label>
        <label><input type="checkbox" checked={value.terrain3d} onChange={() => onChange({ ...value, terrain3d: !value.terrain3d })} /> Terreno y edificios 3D</label>
        {value.terrain3d && <p>Arrastra con dos dedos para inclinar en móvil; en escritorio, botón derecho y arrastrar. Edificios simplificados con alturas disponibles o estimadas de OSM.</p>}
      </div>}
      {value.basemap === 'satellite' && <p className="imagery-note"><a href="https://esa-worldcover.org/en/data-access" target="_blank" rel="noreferrer">Sentinel‑2 · 2021 · 10 m</a>. Paisaje, sin detalle de fachadas. <a href="https://www.earthdata.nasa.gov/data/tools/gibs" target="_blank" rel="noreferrer">NASA Blue Marble · 2004 · 500 m</a> en vistas generales y como respaldo.</p>}
    </section>}
  </div>
}
