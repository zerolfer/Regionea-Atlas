import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { MapAppearance, MapMode } from '../types'

type Props = { mode: MapMode; value: MapAppearance; onChange: (value: MapAppearance) => void }

const TOUCH_QUERY = '(pointer: coarse)'
function subscribeToInteraction(update: () => void) {
  const media = window.matchMedia?.(TOUCH_QUERY)
  media?.addEventListener('change', update)
  return () => media?.removeEventListener('change', update)
}
const isTouchInteraction = () => window.matchMedia?.(TOUCH_QUERY).matches ?? false

export default function MapLayers({ mode, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [informationOpen, setInformationOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const informationButton = useRef<HTMLButtonElement>(null)
  const informationClose = useRef<HTMLButtonElement>(null)
  const informationCard = useRef<HTMLElement>(null)
  const options = useRef<HTMLElement>(null)
  const previousInformationOpen = useRef(false)
  const touch = useSyncExternalStore(subscribeToInteraction, isTouchInteraction)
  const [informationPosition, setInformationPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null)
  const informationReady = informationPosition !== null

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node
      if (!root.current?.contains(target)) {
        setOpen(false); setInformationOpen(false); previousInformationOpen.current = false
      } else if (informationOpen && !informationCard.current?.contains(target) && !informationButton.current?.contains(target)) {
        setInformationOpen(false); previousInformationOpen.current = false
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open, informationOpen])

  useLayoutEffect(() => {
    if (!open || !informationOpen) return
    const position = () => {
      if (!options.current || !informationCard.current) return
      const panel = options.current.getBoundingClientRect()
      const card = informationCard.current.getBoundingClientRect()
      const gap = 10, margin = 12
      const width = window.innerWidth, height = window.innerHeight
      const rightSpace = width - margin - panel.right - gap
      const cardWidth = Math.min(320, width - margin * 2)
      let left = panel.left, top = panel.bottom + gap
      let maxHeight = height - margin * 2, availableWidth = cardWidth
      if (rightSpace >= 220) {
        left = panel.right + gap; top = panel.top
        availableWidth = Math.min(cardWidth, rightSpace)
      } else {
        const above = Math.max(0, panel.top - margin - gap)
        const below = Math.max(0, height - margin - panel.bottom - gap)
        const useAbove = below < card.height && above > below
        maxHeight = useAbove ? above : below
        top = useAbove ? panel.top - gap - Math.min(card.height, maxHeight) : panel.bottom + gap
      }
      setInformationPosition({
        left: Math.max(margin, Math.min(left, width - availableWidth - margin)),
        top: Math.max(margin, Math.min(top, height - Math.min(card.height, maxHeight) - margin)),
        width: availableWidth, maxHeight,
      })
    }
    position()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(position)
    if (options.current) observer?.observe(options.current)
    if (informationCard.current) observer?.observe(informationCard.current)
    window.addEventListener('resize', position)
    document.addEventListener('scroll', position, true)
    return () => { observer?.disconnect(); window.removeEventListener('resize', position); document.removeEventListener('scroll', position, true) }
  }, [open, informationOpen])

  useEffect(() => {
    if (!open) return
    if (informationOpen) { if (informationReady) informationClose.current?.focus() }
    else if (previousInformationOpen.current) informationButton.current?.focus()
    previousInformationOpen.current = informationOpen
  }, [open, informationOpen, informationReady])

  function close() {
    setOpen(false); setInformationOpen(false); previousInformationOpen.current = false
    trigger.current?.focus()
  }

  return <div className={`map-layers ${open ? 'is-open' : ''}`} ref={root} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); if (informationOpen) setInformationOpen(false); else close() } }}>
    <button className="layers-trigger" ref={trigger} aria-label="Tipo de mapa" title="Tipo de mapa" aria-expanded={open} aria-controls="map-layers-options" aria-haspopup="dialog" onClick={() => open ? close() : setOpen(true)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && <section id="map-layers-options" ref={options} className="layers-popover" role="dialog" aria-label="Tipo de mapa">
      <div className="layers-heading"><div className="layers-heading-title"><h2>Tipo de mapa</h2>
        <button className="layers-information-button" ref={informationButton} aria-label="Información del mapa" aria-expanded={informationOpen} aria-controls="map-layers-information" onClick={() => { setInformationPosition(null); setInformationOpen(!informationOpen) }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M12 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="7.5" r="1" fill="currentColor" /></svg>
        </button>
      </div><button className="icon-button" aria-label="Cerrar tipo de mapa" onClick={close}>×</button></div>
      <fieldset className="basemap-options"><legend className="sr-only">Tipo de mapa</legend>
        <label className={value.basemap === 'plan' ? 'selected' : ''}><span className="basemap-swatch swatch-plan" aria-hidden="true" /><span><input type="radio" name="basemap" checked={value.basemap === 'plan'} onChange={() => onChange({ ...value, basemap: 'plan' })} /> Plano</span></label>
        <label className={value.basemap === 'satellite' ? 'selected' : ''}><span className="basemap-swatch swatch-satellite" aria-hidden="true" /><span><input type="radio" name="basemap" checked={value.basemap === 'satellite'} onChange={() => onChange({ ...value, basemap: 'satellite' })} /> Satélite</span></label>
      </fieldset>
      {mode === 'physical' && <div className="terrain-options">
        <label><input type="checkbox" checked={value.hypsometry} onChange={() => onChange({ ...value, hypsometry: !value.hypsometry })} /><span>Colores de altitud</span><span className="terrain-toggle" aria-hidden="true" /></label>
        <label><input type="checkbox" checked={value.terrain3d} onChange={() => onChange({ ...value, terrain3d: !value.terrain3d })} /><span>Terreno y edificios 3D</span><span className="terrain-toggle" aria-hidden="true" /></label>
      </div>}
    </section>}
      {open && informationOpen && <aside id="map-layers-information" ref={informationCard} className="layers-information" style={{ ...informationPosition, visibility: informationPosition ? undefined : 'hidden' }} role="region" aria-label="Información del mapa">
        <div className="layers-heading"><h2>Información del mapa</h2><button ref={informationClose} className="icon-button" aria-label="Cerrar información" onClick={() => setInformationOpen(false)}>×</button></div>
        <div className="layers-information-body">
          {mode === 'physical' && <><p>{touch ? 'Arrastra con dos dedos para inclinar el mapa.' : 'Mantén pulsado el botón derecho y arrastra para inclinar el mapa.'}</p><p>Edificios simplificados con alturas disponibles o estimadas de OSM, sin fachadas fotografiadas.</p></>}
          <p>En Satélite: <a href="https://esa-worldcover.org/en/data-access" target="_blank" rel="noreferrer">Sentinel‑2 · 2021 · 10 m</a>. Paisaje, sin detalle de fachadas. <a href="https://www.earthdata.nasa.gov/data/tools/gibs" target="_blank" rel="noreferrer">NASA Blue Marble · 2004 · 500 m</a> en vistas generales y como respaldo.</p>
        </div>
      </aside>}
  </div>
}
