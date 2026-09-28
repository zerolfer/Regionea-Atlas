import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import type { SearchItem, TransitFreshness, TransitMode, TransitScope } from '../types'

type TransitProperties = {
  id: string
  entityType: 'route' | 'stop' | 'vehicle'
  provider?: string
  freshness?: TransitFreshness
  name?: string
  shortName?: string
  transportMode?: TransitMode
  scope?: TransitScope
  routeType?: number | string
}

export type TransitCatalog = {
  items: SearchItem[]
  providers: string[]
  modes: TransitMode[]
}

function visitCoordinates(value: unknown, visitor: (position: Position) => void) {
  if (!Array.isArray(value) || value.length === 0) return
  if (typeof value[0] === 'number') {
    visitor(value as Position)
    return
  }
  for (const child of value) visitCoordinates(child, visitor)
}

export function geometryBounds(geometry: Geometry): [number, number, number, number] | null {
  if (geometry.type === 'GeometryCollection') {
    const bounds = geometry.geometries.map(geometryBounds).filter((value): value is [number, number, number, number] => Boolean(value))
    if (!bounds.length) return null
    return [
      Math.min(...bounds.map((item) => item[0])), Math.min(...bounds.map((item) => item[1])),
      Math.max(...bounds.map((item) => item[2])), Math.max(...bounds.map((item) => item[3])),
    ]
  }
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  visitCoordinates(geometry.coordinates, ([longitude, latitude]) => {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return
    west = Math.min(west, longitude)
    south = Math.min(south, latitude)
    east = Math.max(east, longitude)
    north = Math.max(north, latitude)
  })
  return Number.isFinite(west) ? [west, south, east, north] : null
}

export function transitMode(properties: TransitProperties): TransitMode {
  if (properties.transportMode) return properties.transportMode
  const routeType = Number(properties.routeType)
  if (routeType === 4 || (routeType >= 1000 && routeType < 1100)) return 'ferry'
  if (routeType >= 1100 && routeType < 1200) return 'air'
  if ([0, 1, 2, 5, 6, 7, 11, 12].includes(routeType)) return 'rail'
  if (properties.provider?.toLocaleUpperCase('es') === 'RENFE') return 'rail'
  return 'bus'
}

export function transitScope(geometry: Geometry): TransitScope {
  const bounds = geometryBounds(geometry)
  if (!bounds) return 'regional'
  const outsideAsturias = bounds[0] < -7.25 || bounds[2] > -4.45 || bounds[1] < 42.9 || bounds[3] > 43.75
  if (outsideAsturias) return 'external'
  const middleLatitude = (bounds[1] + bounds[3]) / 2
  const widthKm = (bounds[2] - bounds[0]) * 111 * Math.cos(middleLatitude * Math.PI / 180)
  const heightKm = (bounds[3] - bounds[1]) * 111
  return Math.hypot(widthKm, heightKm) <= 24 ? 'local' : 'regional'
}

function toSearchItem(feature: Feature<Geometry, TransitProperties>): SearchItem | null {
  const { properties, geometry } = feature
  if (!properties?.id || !geometry) return null
  const mode = transitMode(properties)
  const bbox = geometryBounds(geometry)
  const center = bbox ? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] as [number, number] : null
  const type = properties.entityType
  return {
    id: properties.id,
    name: properties.name || properties.shortName || properties.id,
    aliases: [properties.shortName || '', properties.provider || ''].filter(Boolean),
    kindLabel: type === 'route' ? `Línea · ${properties.provider || 'Transporte'}` : type === 'stop' ? `Parada · ${properties.provider || 'Transporte'}` : `Vehículo · ${properties.provider || 'Transporte'}`,
    transitSelection: {
      type,
      id: properties.id,
      name: properties.name || properties.shortName || properties.id,
      provider: properties.provider || '',
      freshness: properties.freshness || 'scheduled',
      transportMode: mode,
      scope: properties.scope || (type === 'route' ? transitScope(geometry) : 'local'),
      bbox,
      center,
    },
  }
}

async function fetchCollection(path: string, signal?: AbortSignal) {
  const response = await fetch(path, { signal })
  if (!response.ok) throw new Error(`No se pudo cargar ${path}`)
  return response.json() as Promise<FeatureCollection<Geometry, TransitProperties>>
}

export async function loadTransitCatalog(signal?: AbortSignal): Promise<TransitCatalog> {
  const [routes, stops] = await Promise.all([
    fetchCollection('/data/atlas/transit/routes.geojson', signal),
    fetchCollection('/data/atlas/transit/stops.geojson', signal),
  ])
  const features = [...routes.features, ...stops.features]
  const items = features.map(toSearchItem).filter((item): item is SearchItem => Boolean(item))
  const providers = [...new Set(features.map((feature) => feature.properties?.provider).filter((provider): provider is string => Boolean(provider)))].sort()
  const modes = [...new Set(features.map((feature) => transitMode(feature.properties)))].sort() as TransitMode[]
  return { items, providers, modes }
}
