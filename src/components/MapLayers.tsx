import { useEffect, useRef, useState } from 'react'
import type { MapAppearance, MapMode } from '../types'

type Props = { mode: MapMode; value: MapAppearance; onChange: (value: MapAppearance) => void }

export default function MapLayers({ mode, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [informationOpen, setInformationOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const informationButton = useRef<HTMLButtonElement>(null)
  const informationClose = useRef<HTMLButtonElement>(null)
  const previousInformationOpen = useRef(false)

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus()
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false); setInformationOpen(false); previousInformationOpen.current = false
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (informationOpen) informationClose.current?.focus()
    else if (previousInformationOpen.current) informationButton.current?.focus()
    previousInformationOpen.current = informationOpen
  }, [open, informationOpen])

  function close() {
    setOpen(false); setInformationOpen(false); previousInformationOpen.current = false
    trigger.current?.focus()
  }

  return <div className={`map-layers ${open ? 'is-open' : ''}`} ref={root}>
    <button className="layers-trigger" ref={trigger} aria-label="Tipo de mapa" title="Tipo de mapa" aria-expanded={open} aria-controls="map-layers-options" aria-haspopup="dialog" onClick={() => open ? close() : setOpen(true)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && <section id="map-layers-options" className="layers-popover" role="dialog" aria-label="Tipo de mapa" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); if (informationOpen) setInformationOpen(false); else close() } }}>
      <div className="layers-settings" inert={informationOpen}>
      <div className="layers-heading"><h2>Tipo de mapa</h2><div className="layers-heading-actions">
        <button className="layers-information-button" ref={informationButton} aria-label="Información del mapa" aria-expanded={informationOpen} aria-controls="map-layers-information" onClick={() => setInformationOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M12 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="7.5" r="1" fill="currentColor" /></svg>
        </button>
        <button className="icon-button" aria-label="Cerrar tipo de mapa" onClick={close}>×</button>
      </div></div>
      <fieldset className="basemap-options"><legend className="sr-only">Tipo de mapa</legend>
        <label className={value.basemap === 'plan' ? 'selected' : ''}><span className="basemap-swatch swatch-plan" aria-hidden="true" /><span><input type="radio" name="basemap" checked={value.basemap === 'plan'} onChange={() => onChange({ ...value, basemap: 'plan' })} /> Plano</span></label>
        <label className={value.basemap === 'satellite' ? 'selected' : ''}><span className="basemap-swatch swatch-satellite" aria-hidden="true" /><span><input type="radio" name="basemap" checked={value.basemap === 'satellite'} onChange={() => onChange({ ...value, basemap: 'satellite' })} /> Satélite</span></label>
      </fieldset>
      {mode === 'physical' && <div className="terrain-options">
        <label><input type="checkbox" checked={value.hypsometry} onChange={() => onChange({ ...value, hypsometry: !value.hypsometry })} /><span>Colores de altitud</span><span className="terrain-toggle" aria-hidden="true" /></label>
        <label><input type="checkbox" checked={value.terrain3d} onChange={() => onChange({ ...value, terrain3d: !value.terrain3d })} /><span>Terreno y edificios 3D</span><span className="terrain-toggle" aria-hidden="true" /></label>
      </div>}
      </div>
      {informationOpen && <aside id="map-layers-information" className="layers-information" role="region" aria-label="Información del mapa">
        <div className="layers-heading"><h2>Información del mapa</h2><button ref={informationClose} className="icon-button" aria-label="Cerrar información" onClick={() => setInformationOpen(false)}>×</button></div>
        <div className="layers-information-body">
          {mode === 'physical' && <p>Arrastra con dos dedos para inclinar en móvil; en escritorio, botón derecho y arrastrar. Edificios simplificados con alturas disponibles o estimadas de OSM, sin fachadas fotografiadas.</p>}
          <p>En Satélite: <a href="https://esa-worldcover.org/en/data-access" target="_blank" rel="noreferrer">Sentinel‑2 · 2021 · 10 m</a>. Paisaje, sin detalle de fachadas. <a href="https://www.earthdata.nasa.gov/data/tools/gibs" target="_blank" rel="noreferrer">NASA Blue Marble · 2004 · 500 m</a> en vistas generales y como respaldo.</p>
        </div>
      </aside>}
    </section>}
  </div>
}
