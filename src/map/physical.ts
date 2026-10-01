import type { FilterSpecification } from 'maplibre-gl'
import type { AtlasEntity, PhysicalFilter } from '../types'

export const PHYSICAL_FILTER_KINDS: Record<PhysicalFilter, string[]> = {
  relief: ['range'], peaks: ['peak'], hydrography: ['river', 'lake', 'reservoir'],
  valleys: ['valley'], coast: ['coast', 'cape', 'bay', 'gulf', 'delta', 'estuary', 'cliff', 'beach', 'island'],
  protected: ['protected-area'],
}

// These features denote surfaces, never point landmarks. A gazetteer position
// may label one, but does not delimit it and must not acquire a circle marker.
export const COASTAL_AREA_KINDS = ['bay', 'gulf', 'delta', 'estuary']

export function availablePhysicalFilters(entities: AtlasEntity[], filters: PhysicalFilter[]) {
  const kinds = new Set(entities.map(({ kind }) => kind))
  return filters.filter((filter) => !PHYSICAL_FILTER_KINDS[filter].length || PHYSICAL_FILTER_KINDS[filter].some((kind) => kinds.has(kind as AtlasEntity['kind'])))
}

// Circle layers otherwise draw a circle at every vertex of a selected polygon.
// MapLibre's geometry-type expression also normalises Multi* geometries.
export function physicalSelectionFilter(id: string | undefined, geometry: 'Point' | 'LineString' | 'Polygon'): FilterSpecification {
  const filter: FilterSpecification = ['all', ['==', ['get', 'id'], id || '__none__'], ['==', ['geometry-type'], geometry]]
  if (geometry === 'Point') filter.push(['!', ['in', ['get', 'kind'], ['literal', COASTAL_AREA_KINDS]]])
  return filter
}
