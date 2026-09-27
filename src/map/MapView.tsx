import { useEffect, useRef } from 'react'
import { AttributionControl, Map, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import type { FilterSpecification, GeoJSONSource, MapLayerMouseEvent, MapGeoJSONFeature } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildStyle, PHYSICAL_INTERACTIVE_LAYERS, POLITICAL_INTERACTIVE_LAYERS, POLITICAL_LEVEL_RANGES, TRANSIT_INTERACTIVE_LAYERS } from './style'
import type { AtlasEntity, BottomSheetLevel, MapMode, PhysicalFilter, PoliticalLevel, TransitFreshness, UserLocation, ViewState } from '../types'
import { APP_VERSION } from '../version'

setWorkerUrl(workerUrl)
const ASTURIAS_CENTER: [number, number] = [-5.86, 43.31]

function viewportPadding(sheetLevel: BottomSheetLevel = 'half') {
  const mobileBottom = sheetLevel === 'peek' ? 155 : sheetLevel === 'full' ? Math.round(window.innerHeight * 0.65) : Math.round(window.innerHeight * 0.45)
  const desktopPanel = Math.min(396, (window.innerWidth - 54) / 2) + 36
  return window.innerWidth > 760
    ? { top: 84, right: 36, bottom: 72, left: desktopPanel }
    : { top: 82, right: 18, bottom: mobileBottom, left: 18 }
}

type Props = {
  mode: MapMode
  selected: AtlasEntity | null
  physicalFilters: Set<PhysicalFilter>
  politicalLevel: PoliticalLevel
  locateRequest: UserLocation | null
  sheetLevel: BottomSheetLevel
  initialView: ViewState
  externalViewRequest: { view: ViewState; token: number } | null
  onEntityClick: (ids: string[]) => void
  onTransitClick: (type: 'route' | 'stop' | 'vehicle', id: string, name: string, provider: string, freshness: TransitFreshness) => void
  onViewportChange: (view: ViewState) => void
  onLocateMatches: (ids: string[]) => void
  onToast: (message: string) => void
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
    hydrography: ['physical-europe-rivers', 'physical-europe-lakes', 'physical-rivers', 'physical-water'],
    valleys: ['physical-europe-valleys'], coast: ['physical-europe-coasts'], protected: ['physical-protected'],
  }
  Object.entries(groups).forEach(([filter, layers]) => {
    layers.forEach((layer) => {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', filters.has(filter as PhysicalFilter) ? 'visible' : 'none')
    })
  })
}

function applyPoliticalLevel(map: Map, activeLevel: PoliticalLevel) {
  POLITICAL_LEVEL_RANGES.forEach(({ source, min, max }) => {
    const visible = activeLevel === 'auto' || activeLevel === source
    ;['fill', 'hit', 'line', 'labels'].forEach((suffix) => {
      const layer = `${source}-${suffix}`
      if (!map.getLayer(layer)) return
      map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none')
      const autoHitLayer = activeLevel === 'auto' && suffix === 'hit'
      map.setLayerZoomRange(layer, activeLevel === source || autoHitLayer ? 0 : min, activeLevel === source || autoHitLayer ? 24 : max)
    })
  })
}

function applySelection(map: Map, mode: MapMode, selected: AtlasEntity | null) {
  const filter: FilterSpecification = ['==', ['get', 'id'], selected?.id || '__none__']
  if (mode === 'political') {
    ;['countries', 'communities', 'provinces', 'comarcas', 'concejos', 'parishes', 'neighborhoods'].forEach((source) => {
      if (map.getLayer(`${source}-selected`)) map.setFilter(`${source}-selected`, filter)
    })
  } else if (mode === 'physical') {
    ;[
      'physical-selected-point', 'physical-selected-line', 'physical-selected-fill',
      'physical-europe-selected-point', 'physical-europe-selected-line', 'physical-europe-selected-fill',
    ].forEach((layer) => {
      if (map.getLayer(layer)) map.setFilter(layer, filter)
    })
  }
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
  const selectedIdRef = useRef<string | null>(null)
  const styleModeRef = useRef(props.mode)
  propsRef.current = props

  useEffect(() => {
    const map = new Map({
      container: 'map', style: buildStyle(propsRef.current.mode),
      center: propsRef.current.initialView.center || ASTURIAS_CENTER,
      zoom: propsRef.current.initialView.zoom || 8,
      attributionControl: false, fadeDuration: 120, maxZoom: 17,
    })
    map.setPadding(viewportPadding(propsRef.current.sheetLevel))
    mapRef.current = map
    map.addControl(new NavigationControl({ showCompass: true, showZoom: true }), 'top-right')
    map.addControl(new AttributionControl({ customAttribution: `Regionea Atlas v${APP_VERSION}`, compact: true }), 'bottom-right')

    const handleClick = (event: MapLayerMouseEvent) => {
      const current = propsRef.current
      const layers = existingLayers(map, interactiveLayers(current.mode))
      const features = uniqueFeatures(map.queryRenderedFeatures(event.point, { layers }))
      if (!features.length) return
      if (current.mode === 'transit') {
        const feature = features[0]
        const type = String(feature.properties?.entityType || 'stop') as 'route' | 'stop' | 'vehicle'
        const freshness = String(feature.properties?.freshness || 'scheduled') as TransitFreshness
        current.onTransitClick(type, String(feature.properties?.id), String(feature.properties?.name), String(feature.properties?.provider || ''), freshness)
      } else {
        current.onEntityClick(features.map((feature) => String(feature.properties?.id)))
      }
    }

    map.on('click', handleClick)
    map.on('mousemove', (event) => {
      const layers = existingLayers(map, interactiveLayers(propsRef.current.mode))
      map.getCanvas().style.cursor = map.queryRenderedFeatures(event.point, { layers }).length ? 'pointer' : ''
    })
    map.on('moveend', () => {
      const center = map.getCenter()
      propsRef.current.onViewportChange({ center: [center.lng, center.lat], zoom: map.getZoom() })
    })
    const handleResize = () => map.setPadding(viewportPadding(propsRef.current.sheetLevel))
    window.addEventListener('resize', handleResize)
    map.once('load', () => {
      applyPhysicalFilters(map, propsRef.current.physicalFilters)
      applyPoliticalLevel(map, propsRef.current.politicalLevel)
      applySelection(map, propsRef.current.mode, propsRef.current.selected)
      applyUserLocation(map, propsRef.current.locateRequest)
    })
    return () => { window.removeEventListener('resize', handleResize); mapRef.current = null; map.remove() }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (styleModeRef.current === props.mode) return
    styleModeRef.current = props.mode
    map.setStyle(buildStyle(props.mode), { diff: false })
    map.once('style.load', () => {
      applyPhysicalFilters(map, propsRef.current.physicalFilters)
      applyPoliticalLevel(map, propsRef.current.politicalLevel)
      applySelection(map, propsRef.current.mode, propsRef.current.selected)
      applyUserLocation(map, propsRef.current.locateRequest)
    })
  }, [props.mode])

  useEffect(() => {
    const map = mapRef.current
    if (map?.isStyleLoaded()) applyPhysicalFilters(map, props.physicalFilters)
  }, [props.physicalFilters])

  useEffect(() => {
    const map = mapRef.current
    if (map?.isStyleLoaded() && props.mode === 'political') applyPoliticalLevel(map, props.politicalLevel)
  }, [props.politicalLevel, props.mode])

  useEffect(() => {
    mapRef.current?.setPadding(viewportPadding(props.sheetLevel))
  }, [props.sheetLevel])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !props.externalViewRequest) return
    map.jumpTo({ center: props.externalViewRequest.view.center, zoom: props.externalViewRequest.view.zoom })
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
        if (!source) return
        source.setData({
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
        })
      } catch {
        // El mapa mantiene el último GeoJSON válido y el horario programado.
      }
    }
    const onStyleLoad = () => refreshVehicles()
    if (map.isStyleLoaded() && map.getSource('transit-vehicles')) refreshVehicles()
    else map.once('style.load', onStyleLoad)
    const interval = window.setInterval(refreshVehicles, 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
      map.off('style.load', onStyleLoad)
    }
  }, [props.mode])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    applySelection(map, props.mode, props.selected)
    if (props.selected && props.selected.id !== selectedIdRef.current) {
      selectedIdRef.current = props.selected.id
      if (props.selected.bbox) {
        map.fitBounds([[props.selected.bbox[0], props.selected.bbox[1]], [props.selected.bbox[2], props.selected.bbox[3]]], {
          padding: viewportPadding(props.sheetLevel), maxZoom: 12, duration: 700,
        })
      } else if (props.selected.center) {
        map.easeTo({ center: props.selected.center, zoom: Math.max(map.getZoom(), 10), duration: 700 })
      }
    }
  }, [props.selected, props.mode, props.sheetLevel])

  useEffect(() => {
    const map = mapRef.current
    const request = props.locateRequest
    if (!map || !request) return
    if (map.isStyleLoaded()) applyUserLocation(map, request)
    map.easeTo({ center: request.coordinates, zoom: 11, duration: 850 })
    map.once('idle', () => {
      const point = map.project(request.coordinates)
      const layers = existingLayers(map, POLITICAL_INTERACTIVE_LAYERS)
      const ids = uniqueFeatures(map.queryRenderedFeatures(point, { layers })).map((feature) => String(feature.properties?.id))
      propsRef.current.onLocateMatches(ids)
    })
  }, [props.locateRequest])

  return <div id="map" aria-label="Mapa interactivo de Regionea Atlas" />
}
