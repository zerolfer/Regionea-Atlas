import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import ComparePanel from './components/ComparePanel'
import EntityPanel from './components/EntityPanel'
import ModeSwitch from './components/ModeSwitch'
import SearchBox from './components/SearchBox'
import Toast from './components/Toast'
import { isPhysicalEntity, loadAtlasData, PHYSICAL_KIND_LABELS, TERRITORY_KIND_LABELS } from './data/atlas'
import type { AtlasData } from './data/atlas'
import { ALL_PHYSICAL_FILTERS, parseInitialUrl } from './url-state'
import type { AtlasEntity, BottomSheetLevel, MapMode, MapSelection, PhysicalFilter, PoliticalLevel, TransitFreshness, UserLocation, ViewState } from './types'

type TransitSelection = Extract<MapSelection, { type: 'route' | 'stop' | 'vehicle' }>

const MapView = lazy(() => import('./map/MapView'))
const MODE_PATHS: Record<MapMode, string> = { political: 'politico', physical: 'fisico', transit: 'transporte' }
const FILTER_LABELS: Record<PhysicalFilter, string> = {
  relief: 'Relieve', peaks: 'Picos', hydrography: 'Ríos y agua', valleys: 'Valles', coast: 'Costa', protected: 'Espacios protegidos',
}
const POLITICAL_LEVEL_LABELS: Record<PoliticalLevel, string> = {
  auto: 'Automático', countries: 'Países', communities: 'Comunidades', provinces: 'Provincias',
  comarcas: 'Comarcas', concejos: 'Concejos', parishes: 'Parroquias', neighborhoods: 'Barrios',
}

const TRANSIT_STATUS_COPY: Record<TransitFreshness, { title: string; text: string }> = {
  demo: { title: 'Datos de demostración', text: 'Se sustituirán automáticamente al importar los GTFS del NAP.' },
  scheduled: { title: 'Horario programado', text: 'Información procedente del último GTFS estático válido.' },
  live: { title: 'Datos en vivo', text: 'Posición o actualización recibida del servicio en tiempo real.' },
  stale: { title: 'Tiempo real desactualizado', text: 'Se muestra el último dato válido mientras se recupera la conexión.' },
}

function modeIntro(mode: MapMode, transitStatus: TransitFreshness) {
  if (mode === 'physical') return {
    kicker: 'Atlas físico', title: 'Leer el territorio desde el relieve',
    text: 'Acércate para descubrir sierras, picos, ríos, lagos y espacios protegidos. Usa los filtros para aislar cada sistema.',
  }
  if (mode === 'transit') return {
    kicker: 'Movilidad pública', title: 'La red asturiana, en un solo mapa',
    text: transitStatus === 'demo'
      ? 'La integración CTA, ALSA y Renfe está preparada. Hasta configurar las credenciales NAP, las líneas visibles son una demostración claramente identificada.'
      : 'Consulta líneas, paradas y próximas salidas de los últimos GTFS importados para Asturias.',
  }
  return {
    kicker: 'Atlas territorial', title: 'Asturias, España y Europa por capas',
    text: 'Haz zoom para pasar de países y comunidades a comarcas, concejos, parroquias y barrios. Cada límite mantiene su fuente y su naturaleza.',
  }
}

export default function App() {
  const initial = useMemo(parseInitialUrl, [])
  const [atlas, setAtlas] = useState<AtlasData | null>(null)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [mode, setModeState] = useState<MapMode>(initial.mode)
  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId)
  const [transitSelection, setTransitSelection] = useState<TransitSelection | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>(initial.compareIds)
  const [compareOpen, setCompareOpen] = useState(false)
  const [contextIds, setContextIds] = useState<string[]>([])
  const [physicalFilters, setPhysicalFilters] = useState(initial.filters)
  const [politicalLevel, setPoliticalLevel] = useState<PoliticalLevel>(initial.politicalLevel)
  const [view, setView] = useState<ViewState>(initial.view)
  const [externalViewRequest, setExternalViewRequest] = useState<{ view: ViewState; token: number } | null>(null)
  const [locateRequest, setLocateRequest] = useState<UserLocation | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [sheetLevel, setSheetLevel] = useState<BottomSheetLevel>('half')
  const [transitDatasetStatus, setTransitDatasetStatus] = useState<TransitFreshness>('demo')
  const [departures, setDepartures] = useState<Array<{
    route: string
    destination: string
    scheduledTime: string
    freshness: 'live' | 'scheduled' | 'stale' | 'demo'
    delaySeconds?: number | null
  }>>([])

  useEffect(() => {
    const controller = new AbortController()
    loadAtlasData(controller.signal).then(setAtlas).catch((error) => {
      if (error.name !== 'AbortError') setLoadingError(error.message)
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    fetch('/data/atlas/transit/manifest.json')
      .then((response) => response.ok ? response.json() : null)
      .then((manifest) => {
        if (manifest && ['demo', 'scheduled', 'stale'].includes(manifest.status)) setTransitDatasetStatus(manifest.status)
      })
      .catch(() => undefined)
  }, [])

  const selected = selectedId ? atlas?.entitiesById.get(selectedId) || null : null
  const compared = compareIds.map((id) => atlas?.entitiesById.get(id)).filter((entity): entity is AtlasEntity => Boolean(entity))
  const searchPool = atlas ? [...atlas.territories, ...atlas.physical] : []
  const source = selected ? atlas?.manifest.sources.find((item) => item.id === selected.sourceId) : undefined
  const parent = selected?.parentId ? atlas?.entitiesById.get(selected.parentId) : undefined
  const ancestors = useMemo(() => {
    if (!selected || !atlas) return []
    const result: AtlasEntity[] = []
    let current = selected.parentId ? atlas.entitiesById.get(selected.parentId) : undefined
    while (current) {
      result.unshift(current)
      current = current.parentId ? atlas.entitiesById.get(current.parentId) : undefined
    }
    return result
  }, [selected, atlas])

  const setMode = useCallback((nextMode: MapMode) => {
    setModeState(nextMode)
    setCompareOpen(false)
    setTransitSelection(null)
    setContextIds([])
    if (
      nextMode === 'transit'
      || (selected && nextMode === 'political' && isPhysicalEntity(selected))
      || (selected && nextMode === 'physical' && !isPhysicalEntity(selected))
    ) setSelectedId(null)
    window.history.pushState({}, '', `/mapa/${MODE_PATHS[nextMode]}${window.location.search}`)
  }, [selected])

  useEffect(() => {
    if (!selected) return
    if (isPhysicalEntity(selected) && mode !== 'physical') setModeState('physical')
    if (!isPhysicalEntity(selected) && mode !== 'political') setModeState('political')
  }, [selected, mode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (selectedId) params.set('seleccion', selectedId)
      if (compareIds.length) params.set('comparar', compareIds.join(','))
      if (mode === 'physical' && physicalFilters.size !== ALL_PHYSICAL_FILTERS.length) params.set('filtros', [...physicalFilters].join(','))
      if (mode === 'political' && politicalLevel !== 'auto') params.set('nivel', politicalLevel)
      params.set('lng', view.center[0].toFixed(4))
      params.set('lat', view.center[1].toFixed(4))
      params.set('z', view.zoom.toFixed(2))
      window.history.replaceState({}, '', `/mapa/${MODE_PATHS[mode]}?${params.toString()}`)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [mode, selectedId, compareIds, physicalFilters, politicalLevel, view])

  useEffect(() => {
    const onPopState = () => {
      const next = parseInitialUrl()
      setModeState(next.mode)
      setSelectedId(next.selectedId)
      setCompareIds(next.compareIds)
      setPhysicalFilters(next.filters)
      setPoliticalLevel(next.politicalLevel)
      setView(next.view)
      setExternalViewRequest({ view: next.view, token: Date.now() })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!navigator.permissions) return
    navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (permission.state === 'granted') locate(false)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (transitSelection?.type !== 'stop') { setDepartures([]); return }
    let active = true
    const loadDepartures = async () => {
      try {
        const response = await fetch(`/api/transporte/paradas/${encodeURIComponent(transitSelection.id)}/salidas`)
        if (!response.ok) throw new Error('API no disponible')
        const data = await response.json()
        if (active) setDepartures(data.departures || [])
      } catch {
        const filename = `${encodeURIComponent(transitSelection.id).replaceAll('%', '_')}.json`
        const response = await fetch(`/data/atlas/transit/departures/${filename}`)
        const data = await response.json()
        if (active) setDepartures(data.departures || [])
      }
    }
    loadDepartures()
    const interval = window.setInterval(loadDepartures, 30_000)
    return () => { active = false; window.clearInterval(interval) }
  }, [transitSelection])

  function selectEntity(entity: AtlasEntity) {
    setCompareOpen(false)
    setTransitSelection(null)
    setContextIds([])
    if (isPhysicalEntity(entity) && mode !== 'physical') setModeState('physical')
    if (!isPhysicalEntity(entity) && mode !== 'political') setModeState('political')
    setSelectedId(entity.id)
  }

  function handleEntityClick(ids: string[]) {
    setCompareOpen(false)
    const validIds = ids.filter((id) => atlas?.entitiesById.has(id))
    if (validIds.length > 1) setContextIds(validIds)
    else if (validIds[0]) setSelectedId(validIds[0])
  }

  function toggleCompare(entity: AtlasEntity) {
    setCompareIds((current) => {
      if (current.includes(entity.id)) return current.filter((id) => id !== entity.id)
      if (current.length >= 3) { setToast('Puedes comparar un máximo de tres territorios'); return current }
      return [...current, entity.id]
    })
  }

  function toggleFilter(filter: PhysicalFilter) {
    setPhysicalFilters((current) => {
      const next = new Set(current)
      if (next.has(filter)) next.delete(filter)
      else next.add(filter)
      return next
    })
  }

  function locate(showFeedback = true) {
    if (!navigator.geolocation) { setToast('Este navegador no permite utilizar la ubicación'); return }
    if (showFeedback) setToast('Buscando tu territorio…')
    setModeState('political')
    setPoliticalLevel('auto')
    navigator.geolocation.getCurrentPosition(
      (position) => setLocateRequest({
        coordinates: [position.coords.longitude, position.coords.latitude],
        accuracy: position.coords.accuracy,
        token: Date.now(),
      }),
      () => setToast('No se pudo acceder a la ubicación. Seguimos en Asturias.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    )
  }

  function cycleSheetLevel() {
    setSheetLevel((current) => current === 'peek' ? 'half' : current === 'half' ? 'full' : 'peek')
  }

  function handleLocateMatches(ids: string[]) {
    const valid = ids.filter((id) => atlas?.entitiesById.has(id))
    if (!valid.length) setToast('Tu ubicación queda fuera de las divisiones cargadas')
    else if (valid.length === 1) setSelectedId(valid[0])
    else setContextIds(valid)
  }

  const intro = modeIntro(mode, transitDatasetStatus)

  return (
    <main className={`app mode-${mode} ${contextIds.length ? 'context-open' : ''}`}>
      <Suspense fallback={<div className="map-loading">Preparando el atlas…</div>}>
        <MapView
          mode={mode}
          selected={selected}
          physicalFilters={physicalFilters}
          politicalLevel={politicalLevel}
          locateRequest={locateRequest}
          sheetLevel={sheetLevel}
          initialView={initial.view}
          externalViewRequest={externalViewRequest}
          onEntityClick={handleEntityClick}
          onTransitClick={(type, id, name, provider, freshness) => { setCompareOpen(false); setSelectedId(null); setContextIds([]); setTransitSelection({ type, id, name, provider, freshness }) }}
          onViewportChange={setView}
          onLocateMatches={handleLocateMatches}
          onToast={setToast}
        />
      </Suspense>

      <header className="topbar">
        <button className="brand" onClick={() => { setCompareOpen(false); setSelectedId(null); setTransitSelection(null) }} aria-label="Inicio de Regionea Atlas">
          <span className="brand-mark" aria-hidden="true"><img src="/favicon-192x192.png" alt="" /></span>
          <span><strong>Regionea</strong><small>Atlas</small></span>
        </button>
        <SearchBox entities={searchPool} onSelect={selectEntity} />
        <button className="location-button" onClick={() => locate()}><span aria-hidden="true">⌾</span><span>Ver mi territorio</span></button>
      </header>

      <aside className={`side-panel sheet-${sheetLevel} ${selected || transitSelection || compareOpen ? 'has-content' : ''}`}>
        <button className="sheet-handle" onClick={cycleSheetLevel} aria-label={`Panel ${sheetLevel === 'peek' ? 'mínimo; ampliar' : sheetLevel === 'half' ? 'medio; ampliar' : 'completo; reducir'}`}><span /></button>
        <div className="panel-scroll">
          {loadingError && <div className="error-state"><strong>No se pudo abrir el catálogo.</strong><p>{loadingError}</p></div>}
          {!selected && !transitSelection && !compareOpen && (
            <section className="intro-panel">
              <span className="eyebrow">{intro.kicker}</span><h1>{intro.title}</h1><p>{intro.text}</p>
              {mode === 'transit' && <div className="demo-notice"><strong>{TRANSIT_STATUS_COPY[transitDatasetStatus].title}</strong><span>{TRANSIT_STATUS_COPY[transitDatasetStatus].text}</span></div>}
              <div className="coverage-summary">
                <div><strong>{atlas?.manifest.collections.concejos?.count || '—'}</strong><span>concejos</span></div>
                <div><strong>{atlas?.manifest.collections.parishes?.count || '—'}</strong><span>parroquias</span></div>
                <div><strong>{atlas?.manifest.collections.neighborhoods?.count || '—'}</strong><span>barrios</span></div>
              </div>
            </section>
          )}
          {!compareOpen && selected && <EntityPanel entity={selected} editorial={atlas?.editorial[selected.id]} source={source} datasetDate={atlas?.manifest.generatedAt} parent={parent} ancestors={ancestors} compared={compareIds.includes(selected.id)} onNavigate={selectEntity} onCompare={() => toggleCompare(selected)} onClose={() => setSelectedId(null)} />}
          {!compareOpen && transitSelection && (
            <article className="entity-panel transit-detail">
              <div className="panel-kicker-row"><span className="eyebrow">{transitSelection.type === 'stop' ? 'Parada' : transitSelection.type === 'route' ? 'Línea' : 'Vehículo'}</span><button className="icon-button" onClick={() => setTransitSelection(null)} aria-label="Cerrar ficha de transporte">×</button></div>
              <h1>{transitSelection.name}</h1><p className="local-name">{transitSelection.provider}</p>
              <div className="demo-notice"><strong>{TRANSIT_STATUS_COPY[transitSelection.freshness].title}</strong><span>{TRANSIT_STATUS_COPY[transitSelection.freshness].text}</span></div>
              {transitSelection.type === 'stop' && <section className="departures"><h2>Próximas salidas</h2>{departures.length ? departures.map((departure) => <div key={`${departure.route}-${departure.scheduledTime}`}><strong>{departure.scheduledTime}</strong><span>{departure.route} · {departure.destination}</span><small>{departure.freshness === 'live' ? 'en vivo' : departure.freshness === 'stale' ? 'tiempo real desactualizado' : departure.freshness === 'demo' ? 'programado · demo' : 'programado'}{departure.delaySeconds ? ` · ${Math.round(departure.delaySeconds / 60)} min` : ''}</small></div>) : <p>No hay salidas cargadas.</p>}</section>}
            </article>
          )}
          {compareOpen && <ComparePanel entities={compared} onRemove={(id) => setCompareIds((current) => current.filter((item) => item !== id))} onClose={() => setCompareOpen(false)} />}
        </div>
        <footer className="panel-footer"><button onClick={() => setSourcesOpen(true)}>Fuentes y licencias</button><span>{atlas ? `Datos ${atlas.manifest.version}` : 'Cargando datos…'}</span></footer>
      </aside>

      {mode === 'physical' && <div className="filter-bar" aria-label="Filtros del mapa físico">{ALL_PHYSICAL_FILTERS.map((filter) => <button key={filter} className={physicalFilters.has(filter) ? 'active' : ''} aria-pressed={physicalFilters.has(filter)} onClick={() => toggleFilter(filter)}>{FILTER_LABELS[filter]}</button>)}</div>}
      {mode === 'political' && <div className="filter-bar level-bar" aria-label="Nivel territorial">{(Object.keys(POLITICAL_LEVEL_LABELS) as PoliticalLevel[]).map((level) => <button key={level} className={politicalLevel === level ? 'active' : ''} aria-pressed={politicalLevel === level} onClick={() => setPoliticalLevel(level)}>{POLITICAL_LEVEL_LABELS[level]}</button>)}</div>}
      <ModeSwitch value={mode} onChange={setMode} />

      {compareIds.length > 0 && <button className="compare-fab" onClick={() => setCompareOpen(true)}><span>{compareIds.length}</span> Comparar</button>}

      {contextIds.length > 0 && (
        <div className="context-picker" role="dialog" aria-label="Territorios coincidentes">
          <div><span className="eyebrow">En este punto</span><button className="icon-button" onClick={() => setContextIds([])} aria-label="Cerrar selector de territorios">×</button></div>
          {contextIds.map((id) => { const entity = atlas?.entitiesById.get(id); return entity ? <button key={id} onClick={() => selectEntity(entity)}><strong>{entity.name}</strong><small>{PHYSICAL_KIND_LABELS[entity.kind] || TERRITORY_KIND_LABELS[entity.kind] || entity.kind}</small></button> : null })}
        </div>
      )}

      {sourcesOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSourcesOpen(false)}>
          <section className="sources-modal" role="dialog" aria-modal="true" aria-labelledby="sources-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-kicker-row"><span className="eyebrow">Transparencia</span><button className="icon-button" onClick={() => setSourcesOpen(false)} aria-label="Cerrar fuentes y licencias">×</button></div>
            <h2 id="sources-title">Fuentes y licencias</h2><p>Cada ficha conserva su procedencia. Las parroquias son ámbitos estadísticos y no deslindes jurídicos.</p>
            <ul>{atlas?.manifest.sources.map((item) => <li key={item.id}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><span>{item.license}</span></li>)}</ul>
          </section>
        </div>
      )}
      <Toast message={toast} />
      <Analytics />
    </main>
  )
}
