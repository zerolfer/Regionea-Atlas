import { useEffect, useRef } from 'react'
import { Map, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl'
import type { FilterSpecification, GeoJSONSource, MapLayerMouseEvent, MapGeoJSONFeature } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildStyle, PHYSICAL_INTERACTIVE_LAYERS, POLITICAL_INTERACTIVE_LAYERS, POLITICAL_LEVEL_RANGES, TRANSIT_INTERACTIVE_LAYERS, TRANSIT_ROUTE_LAYERS } from './style'
import { geometryBounds } from '../data/transit'
import type { AtlasEntity, BottomSheetLevel, MapAppearance, MapMode, PhysicalFilter, PoliticalLevel, TransitFilters, TransitFreshness, TransitMode, TransitSelection, UserLocation, ViewState } from '../types'
import { APP_VERSION } from '../version'
import { viewportPadding } from './viewport-padding'
import { bottomSheetSafeAreaInset } from '../bottom-sheet'
import { CollapsedAttributionControl } from './attribution-control'
import { PHYSICAL_FILTER_KINDS, physicalSelectionFilter } from './physical'
import { fitEntityBounds, focusPoint, SelectionFocusController } from './selection-focus'

setWorkerUrl(workerUrl)
const ASTURIAS_CENTER: [number, number] = [-5.86, 43.31]

type Props = {
  mode: MapMode
  selected: AtlasEntity | null
  transitSelection: TransitSelection | null
  compared: AtlasEntity[]
  relatedPhysicalIds: string[]
  physicalFilters: Set<PhysicalFilter>
  appearance: MapAppearance
  transitFilters: TransitFilters
  politicalLevel: PoliticalLevel
  locateRequest: UserLocation | null
  sheetLevel: BottomSheetLevel
  desktopPanelCollapsed: boolean
  initialView: ViewState
  externalViewRequest: { view: ViewState; token: number } | null
  focusRequestToken: number
  onEntityClick: (ids: string[]) => void
  onTransitClick: (selection: TransitSelection) => void
  onViewportChange: (view: ViewState) => void
  onLocateMatches: (ids: string[]) => void
  onToast: (message: string) => void
}

function navigationPadding(props: Props) {
  return viewportPadding(window.innerWidth, window.visualViewport?.height ?? window.innerHeight, props.sheetLevel, props.desktopPanelCollapsed, bottomSheetSafeAreaInset())
}

function interactiveLayers(mode: MapMode) {
  if (mode === 'physical') return PHYSICAL_INTERACTIVE_LAYERS
  if (mode === 'transit') return TRANSIT_INTERACTIVE_LAYERS
  return POLITICAL_INTERACTIVE_LAYERS
}

function existingLayers(map: Map, ids: string[]) {
  return ids.filter((id) => Boolean(map.getLayer(id)))
}

function uniqueFeatures(features: MapGeoJSONFeature[]) {
  const seen = new Set<string>()
  return features.filter((feature) => {
    const id = String(feature.properties?.id || '')
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function applyPhysicalFilters(map: Map, filters: Set<PhysicalFilter>) {
  const groups: Record<PhysicalFilter, string[]> = {
    relief: ['physical-europe-ranges', 'physical-ranges'],
    peaks: ['physical-europe-peaks', 'physical-peaks'],
    hydrography: ['physical-europe-rivers', 'physical-europe-lakes', 'physical-europe-river-labels', 'physical-rivers', 'physical-water'],
    valleys: ['physical-europe-valleys'], coast: ['physical-europe-coasts', 'physical-europe-marine-labels', 'physical-coastal-areas', 'physical-coastal-labels', 'physical-coast-areas', 'physical-coast-lines', 'physical-coast-points'], protected: ['physical-protected', 'physical-protected-points'],
  }
  Object.entries(groups).forEach(([filter, layers]) => {
    layers.forEach((layer) => {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', filters.has(filter as PhysicalFilter) ? 'visible' : 'none')
    })
  })
  if (map.getLayer('physical-europe-labels')) {
    const kinds = [...filters].flatMap((filter) => PHYSICAL_FILTER_KINDS[filter]).filter((kind) => !['river', 'gulf', 'bay', 'delta'].includes(kind))
    map.setFilter('physical-europe-labels', ['in', ['get', 'kind'], ['literal', kinds]] as FilterSpecification)
  }
  if (map.getLayer('physical-river-labels')) map.setLayoutProperty('physical-river-labels', 'visibility', filters.has('hydrography') ? 'visible' : 'none')
  if (map.getLayer('physical-point-labels')) {
    const pointKinds = [
      ...(filters.has('relief') ? ['range'] : []),
      ...(filters.has('peaks') ? ['peak'] : []),
    ]
    map.setFilter('physical-point-labels', ['all', ['in', ['get', 'kind'], ['literal', pointKinds]], ['<=', ['coalesce', ['get', 'minZoom'], 9], ['zoom']]] as FilterSpecification)
  }
  if (map.getLayer('physical-coast-labels')) map.setLayoutProperty('physical-coast-labels', 'visibility', filters.has('coast') ? 'visible' : 'none')
  if (map.getLayer('physical-area-labels')) {
    const areaKinds = [
      ...(filters.has('hydrography') ? ['lake', 'reservoir'] : []),
      ...(filters.has('protected') ? ['protected-area'] : []),
    ]
    map.setFilter('physical-area-labels', ['in', ['get', 'kind'], ['literal', areaKinds]] as FilterSpecification)
  }
}

function applyAppearance(map: Map, mode: MapMode, appearance: MapAppearance) {
  const enabled = mode === 'physical' && appearance.terrain3d
  if (map.getSource('terrain-dem')) {
    const current = map.getTerrain()
    if (enabled && !current) map.setTerrain({ source: 'terrain-dem', exaggeration: 1.35 })
    if (!enabled && current) map.setTerrain(null)
  }
  if (map.getLayer('physical-hypsometry')) map.setLayoutProperty('physical-hypsometry', 'visibility', appearance.hypsometry ? 'visible' : 'none')
  if (map.getLayer('buildings-3d')) map.setLayoutProperty('buildings-3d', 'visibility', enabled ? 'visible' : 'none')
  if (map.getLayer('physical-base-buildings')) map.setLayoutProperty('physical-base-buildings', 'visibility', enabled ? 'none' : 'visible')
}

function applyPoliticalLevel(map: Map, activeLevel: PoliticalLevel) {
  POLITICAL_LEVEL_RANGES.forEach(({ source, min, max }) => {
    const visible = activeLevel === 'auto' || activeLevel === source
    ;['fill', 'hit', 'line', 'labels'].forEach((suffix) => {
      const layer = `${source}-${suffix}`
      if (!map.getLayer(layer)) return
      map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none')
      map.setLayerZoomRange(layer, activeLevel === source ? 0 : min, activeLevel === source ? 24 : max)
    })
  })
}

function transitModeExpression() {
  return ['coalesce', ['get', 'transportMode'], ['case', ['==', ['get', 'provider'], 'RENFE'], 'rail', 'bus']]
}

function applyTransitFilters(map: Map, filters: TransitFilters) {
  const providerFilter = ['in', ['get', 'provider'], ['literal', [...filters.providers]]]
  const modeFilter = ['in', transitModeExpression(), ['literal', [...filters.modes]]]
  const filter = ['all', providerFilter, modeFilter] as unknown as FilterSpecification
  ;['transit-stops-circle', 'transit-stops-labels'].forEach((layer) => {
    if (map.getLayer(layer)) map.setFilter(layer, filter)
  })
  TRANSIT_ROUTE_LAYERS.forEach(({ id, extentClass }) => {
    if (map.getLayer(id)) map.setFilter(id, ['all', filter, ['==', ['get', 'extentClass'], extentClass]] as unknown as FilterSpecification)
  })
  ;['transit-vehicles-circle', 'transit-selected-vehicle'].forEach((layer) => {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', filters.showRealtime ? 'visible' : 'none')
  })
}

function applySelection(map: Map, mode: MapMode, selected: AtlasEntity | null, transitSelection: TransitSelection | null, relatedPhysicalIds: string[]) {
  const filter: FilterSpecification = ['==', ['get', 'id'], selected?.id || '__none__']
  if (mode === 'political') {
    ;['countries', 'communities', 'provinces', 'comarcas', 'concejos', 'parishes', 'neighborhoods'].forEach((source) => {
      if (map.getLayer(`${source}-selected`)) map.setFilter(`${source}-selected`, filter)
    })
  } else if (mode === 'physical') {
    ;['physical', 'physical-europe', 'physical-coastal'].forEach((prefix) => {
      ;(['point', 'line', 'fill', 'area'] as const).forEach((suffix) => {
        const layer = `${prefix}-selected-${suffix}`
        const geometry = suffix === 'point' ? 'Point' : suffix === 'line' ? 'LineString' : 'Polygon'
        if (map.getLayer(layer)) map.setFilter(layer, physicalSelectionFilter(selected?.geometryId || selected?.id, geometry))
      })
      const riverLabel = `${prefix}-selected-river-label`
      if (map.getLayer(riverLabel)) map.setFilter(riverLabel, physicalSelectionFilter(selected?.kind === 'river' ? selected.id : undefined, 'LineString'))
      const normalLabel = `${prefix === 'physical' ? 'physical' : 'physical-europe'}-river-labels`
      if (map.getLayer(normalLabel)) {
        const labelFilter: FilterSpecification = ['all', ['==', ['get', 'kind'], 'river'], ['!=', ['get', 'id'], selected?.id || '__none__']]
        if (prefix === 'physical') labelFilter.push(['<=', ['coalesce', ['get', 'minZoom'], 7.5], ['zoom']])
        map.setFilter(normalLabel, labelFilter)
      }
    })
    if (map.getLayer('physical-related-peaks')) {
      map.setFilter('physical-related-peaks', ['in', ['get', 'id'], ['literal', relatedPhysicalIds]] as FilterSpecification)
    }
  } else if (mode === 'transit') {
    const transitFilter: FilterSpecification = ['==', ['get', 'id'], transitSelection?.id || '__none__']
    const layer = transitSelection?.type === 'route' ? 'transit-selected-route' : transitSelection?.type === 'vehicle' ? 'transit-selected-vehicle' : 'transit-selected-stop'
    ;['transit-selected-route', 'transit-selected-stop', 'transit-selected-vehicle'].forEach((candidate) => {
      if (map.getLayer(candidate)) map.setFilter(candidate, candidate === layer ? transitFilter : ['==', ['get', 'id'], '__none__'])
    })
    const dimmed = Boolean(transitSelection)
    TRANSIT_ROUTE_LAYERS.forEach(({ id, minZoom }) => {
      if (map.getLayer(id)) map.setPaintProperty(id, 'line-opacity', dimmed ? 0.14 : ['interpolate', ['linear'], ['zoom'], minZoom, 0.58, Math.min(11, minZoom + 2), 0.86])
    })
    if (map.getLayer('transit-stops-circle')) map.setPaintProperty('transit-stops-circle', 'circle-opacity', dimmed ? 0.22 : 1)
    if (map.getLayer('transit-stops-labels')) map.setPaintProperty('transit-stops-labels', 'text-opacity', dimmed ? 0.2 : 1)
    if (map.getLayer('transit-vehicles-circle')) map.setPaintProperty('transit-vehicles-circle', 'circle-opacity', dimmed ? 0.2 : 1)
  }
}

function applyCompared(map: Map, entities: AtlasEntity[]) {
  const filter = ['in', ['get', 'id'], ['literal', entities.map(({ id }) => id)]] as FilterSpecification
  ;['countries', 'communities', 'provinces', 'comarcas', 'concejos', 'parishes', 'neighborhoods'].forEach((source) => {
    if (map.getLayer(`${source}-compared`)) map.setFilter(`${source}-compared`, filter)
  })
}

function unionBounds(entities: AtlasEntity[]) {
  const bounds = entities.map(({ bbox }) => bbox).filter((value): value is [number, number, number, number] => Boolean(value))
  if (!bounds.length) return null
  return [
    Math.min(...bounds.map((item) => item[0])), Math.min(...bounds.map((item) => item[1])),
    Math.max(...bounds.map((item) => item[2])), Math.max(...bounds.map((item) => item[3])),
  ] as [number, number, number, number]
}

function applyUserLocation(map: Map, location: UserLocation | null) {
  const source = map.getSource('user-location') as GeoJSONSource | undefined
  if (!source) return
  source.setData({
    type: 'FeatureCollection',
    features: location ? [{
      type: 'Feature',
      properties: { accuracy: location.accuracy },
      geometry: { type: 'Point', coordinates: location.coordinates },
    }] : [],
  })
}

export default function MapView(props: Props) {
  const mapRef = useRef<Map | null>(null)
  const propsRef = useRef(props)
  const styleModeRef = useRef(props.mode)
  const styleBasemapRef = useRef(props.appearance.basemap)
  const terrainEnabledRef = useRef(props.mode === 'physical' && props.appearance.terrain3d)
  const restoredViewTokenRef = useRef(props.externalViewRequest?.token)
  const imageryErrorReportedRef = useRef(false)
  const lastVehiclesRef = useRef<Parameters<GeoJSONSource['setData']>[0] | null>(null)
  const styleReadyRef = useRef(false)
  const focusController = useRef(new SelectionFocusController())
  propsRef.current = props
  const comparedKey = props.compared.map(({ id }) => id).join(',')

  useEffect(() => {
    const map = new Map({
      container: 'map', style: buildStyle(propsRef.current.mode, propsRef.current.appearance.basemap),
      center: propsRef.current.initialView.center || ASTURIAS_CENTER,
      zoom: propsRef.current.initialView.zoom ?? 8,
      pitch: propsRef.current.initialView.pitch ?? 0, bearing: propsRef.current.initialView.bearing ?? 0,
      attributionControl: false, fadeDuration: 120, maxZoom: 19, maxPitch: 80,
    })
    mapRef.current = map
    map.addControl(new NavigationControl({ showCompass: true, showZoom: true }), 'top-right')
    map.addControl(new CollapsedAttributionControl({ customAttribution: `Regionea Atlas v${APP_VERSION}`, compact: true }), 'bottom-right')

    let clickTimer: number | undefined
    const riverTooltip = new Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'river-tooltip' })
    const hideRiverTooltip = () => riverTooltip.remove()
    map.getCanvas().addEventListener('mouseleave', hideRiverTooltip)
    const handleClick = (event: MapLayerMouseEvent) => {
      if (event.originalEvent.detail > 1) return
      window.clearTimeout(clickTimer)
      clickTimer = window.setTimeout(() => {
      const current = propsRef.current
      const layers = existingLayers(map, interactiveLayers(current.mode))
      const features = uniqueFeatures(map.queryRenderedFeatures(event.point, { layers }))
      if (!features.length) return
      if (current.mode === 'transit') {
        const feature = features[0]
        const type = String(feature.properties?.entityType || 'stop') as 'route' | 'stop' | 'vehicle'
        const freshness = String(feature.properties?.freshness || 'scheduled') as TransitFreshness
        const bounds = geometryBounds(feature.geometry)
        const transportMode = String(feature.properties?.transportMode || (feature.properties?.provider === 'RENFE' ? 'rail' : 'bus')) as TransitMode
        current.onTransitClick({
          type, id: String(feature.properties?.id), name: String(feature.properties?.name),
          provider: String(feature.properties?.provider || ''), freshness, transportMode,
          extentClass: feature.properties?.extentClass,
          routeLengthKm: Number(feature.properties?.routeLengthKm) || undefined,
          routeSpanKm: Number(feature.properties?.routeSpanKm) || undefined,
          routeStopCount: Number(feature.properties?.routeStopCount) || undefined,
          displayMinZoom: Number(feature.properties?.displayMinZoom) || undefined,
          bbox: bounds,
          center: bounds ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : null,
        })
      } else {
        current.onEntityClick(features.map((feature) => String(feature.properties?.id)))
      }
      }, 220)
    }
    const handleDoubleClick = () => window.clearTimeout(clickTimer)

    map.on('click', handleClick)
    map.on('dblclick', handleDoubleClick)
    map.on('mousemove', (event) => {
      const layers = existingLayers(map, interactiveLayers(propsRef.current.mode))
      const features = map.queryRenderedFeatures(event.point, { layers })
      map.getCanvas().style.cursor = features.length ? 'pointer' : ''
      const river = propsRef.current.mode === 'physical' ? features.find((feature) => feature.properties?.kind === 'river') : null
      if (river) riverTooltip.setLngLat(event.lngLat).setText(String(river.properties.name || 'Curso de agua sin nombre en la fuente')).addTo(map)
      else hideRiverTooltip()
    })
    map.on('moveend', () => {
      const center = map.getCenter()
      propsRef.current.onViewportChange({ center: [center.lng, center.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() })
    })
    map.on('error', (event) => {
      if (!('sourceId' in event) || !['satellite-detail', 'satellite-pnoa-mainland', 'satellite-pnoa-canaries'].includes(event.sourceId as string)) { console.error(event.error); return }
      if (propsRef.current.appearance.basemap !== 'satellite' || imageryErrorReportedRef.current) return
      imageryErrorReportedRef.current = true
      propsRef.current.onToast(event.sourceId === 'satellite-detail'
        ? 'No se pudo cargar el detalle satelital. Se conserva la imagen general de NASA.'
        : 'No se pudo cargar PNOA. Se conserva el fondo mundial disponible.')
    })
    map.on('style.load', () => {
      hideRiverTooltip()
      styleReadyRef.current = true
      applyPhysicalFilters(map, propsRef.current.physicalFilters)
      applyAppearance(map, propsRef.current.mode, propsRef.current.appearance)
      applyPoliticalLevel(map, propsRef.current.politicalLevel)
      applyTransitFilters(map, propsRef.current.transitFilters)
      applySelection(map, propsRef.current.mode, propsRef.current.selected, propsRef.current.transitSelection, propsRef.current.relatedPhysicalIds)
      applyCompared(map, propsRef.current.compared)
      applyUserLocation(map, propsRef.current.locateRequest)
      focusController.current.apply(map, propsRef.current, true, navigationPadding(propsRef.current))
    })
    return () => {
      window.clearTimeout(clickTimer)
      map.getCanvas().removeEventListener('mouseleave', hideRiverTooltip)
      hideRiverTooltip()
      styleReadyRef.current = false
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (styleModeRef.current === props.mode && styleBasemapRef.current === props.appearance.basemap) return
    styleModeRef.current = props.mode
    styleBasemapRef.current = props.appearance.basemap
    imageryErrorReportedRef.current = false
    styleReadyRef.current = false
    map.setStyle(buildStyle(props.mode, props.appearance.basemap), { diff: false })
  }, [props.mode, props.appearance.basemap])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const restoringView = props.externalViewRequest?.token !== restoredViewTokenRef.current
    restoredViewTokenRef.current = props.externalViewRequest?.token
    const enabled = props.mode === 'physical' && props.appearance.terrain3d
    if (styleReadyRef.current) applyAppearance(map, props.mode, props.appearance)
    if (enabled !== terrainEnabledRef.current) {
      terrainEnabledRef.current = enabled
      // URL restoration owns its exact camera, including a deliberately flat 3D view.
      if (!restoringView) {
        if (enabled && map.getPitch() < 20) map.easeTo({ pitch: 60, duration: 550 })
        if (!enabled && map.getPitch() > 0) map.easeTo({ pitch: 0, duration: 450 })
      }
    }
  }, [props.mode, props.appearance, props.externalViewRequest])

  useEffect(() => {
    const map = mapRef.current
    if (map && styleReadyRef.current) applyPhysicalFilters(map, props.physicalFilters)
  }, [props.physicalFilters])

  useEffect(() => {
    const map = mapRef.current
    if (map && styleReadyRef.current && props.mode === 'transit') applyTransitFilters(map, props.transitFilters)
  }, [props.transitFilters, props.mode])

  useEffect(() => {
    const map = mapRef.current
    if (map && styleReadyRef.current && props.mode === 'political') applyPoliticalLevel(map, props.politicalLevel)
  }, [props.politicalLevel, props.mode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !props.externalViewRequest) return
    map.jumpTo({ center: props.externalViewRequest.view.center, zoom: props.externalViewRequest.view.zoom, pitch: props.externalViewRequest.view.pitch ?? 0, bearing: props.externalViewRequest.view.bearing ?? 0 })
  }, [props.externalViewRequest])

  useEffect(() => {
    const map = mapRef.current
    if (!map || props.mode !== 'transit') return
    let active = true
    const refreshVehicles = async () => {
      try {
        const response = await fetch('/api/transporte/renfe/realtime')
        const data = await response.json()
        if (!active) return
        const source = map.getSource('transit-vehicles') as GeoJSONSource | undefined
        const vehicles: Parameters<GeoJSONSource['setData']>[0] = {
          type: 'FeatureCollection',
          features: (data.vehicles || []).map((vehicle: {
            id: string
            routeId?: string | null
            longitude: number
            latitude: number
            bearing?: number | null
          }) => ({
            type: 'Feature',
            properties: {
              id: vehicle.id, entityType: 'vehicle', provider: 'RENFE',
              name: vehicle.routeId || 'Tren Renfe', freshness: data.status,
              bearing: vehicle.bearing ?? null,
            },
            geometry: { type: 'Point', coordinates: [vehicle.longitude, vehicle.latitude] },
          })),
        }
        lastVehiclesRef.current = vehicles
        source?.setData(vehicles)
      } catch {
        // El mapa mantiene el último GeoJSON válido y el horario programado.
      }
    }
    const onStyleLoad = () => {
      const source = map.getSource('transit-vehicles') as GeoJSONSource | undefined
      if (lastVehiclesRef.current) source?.setData(lastVehiclesRef.current)
      void refreshVehicles()
    }
    map.on('style.load', onStyleLoad)
    if (map.isStyleLoaded() && map.getSource('transit-vehicles')) refreshVehicles()
    const interval = window.setInterval(refreshVehicles, 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
      map.off('style.load', onStyleLoad)
    }
  }, [props.mode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return
    applySelection(map, props.mode, props.selected, props.transitSelection, props.relatedPhysicalIds)
    focusController.current.apply(map, propsRef.current, true, navigationPadding(propsRef.current))
  }, [props.selected, props.transitSelection, props.relatedPhysicalIds, props.mode, props.focusRequestToken])

  useEffect(() => {
    const map = mapRef.current
    const bounds = unionBounds(props.compared)
    if (!map || !styleReadyRef.current) return
    applyCompared(map, props.compared)
    if (bounds && props.compared.length > 1) {
      fitEntityBounds(map, bounds, 12, navigationPadding(propsRef.current))
    }
  }, [comparedKey, props.compared])

  useEffect(() => {
    const map = mapRef.current
    const request = props.locateRequest
    if (!map || !request) return
    if (styleReadyRef.current) applyUserLocation(map, request)
    focusPoint(map, request.coordinates, 11, navigationPadding(propsRef.current), 850)
    if (props.mode !== 'political') return
    map.once('idle', () => {
      const point = map.project(request.coordinates)
      const layers = existingLayers(map, POLITICAL_INTERACTIVE_LAYERS)
      const ids = uniqueFeatures(map.queryRenderedFeatures(point, { layers })).map((feature) => String(feature.properties?.id))
      propsRef.current.onLocateMatches(ids)
    })
  }, [props.locateRequest, props.mode])

  return <div id="map" aria-label="Mapa interactivo de Regionea Atlas" />
}
