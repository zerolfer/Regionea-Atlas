import type { FilterSpecification } from 'maplibre-gl'
import type { AtlasEntity, PhysicalFilter } from '../types'

export const PHYSICAL_FILTER_KINDS: Record<PhysicalFilter, string[]> = {
  relief: ['range'], peaks: ['peak'], hydrography: ['river', 'lake', 'reservoir'],
  valleys: ['valley'], coast: ['coast', 'cape', 'bay', 'gulf', 'delta', 'estuary', 'cliff', 'beach', 'island'],
  protected: ['protected-area'], hypsometry: [], terrain3d: [],
}

export function availablePhysicalFilters(entities: AtlasEntity[], filters: PhysicalFilter[]) {
  const kinds = new Set(entities.map(({ kind }) => kind))
  return filters.filter((filter) => !PHYSICAL_FILTER_KINDS[filter].length || PHYSICAL_FILTER_KINDS[filter].some((kind) => kinds.has(kind as AtlasEntity['kind'])))
}

// Circle layers otherwise draw a circle at every vertex of a selected polygon.
// MapLibre's geometry-type expression also normalises Multi* geometries.
export function physicalSelectionFilter(id: string | undefined, geometry: 'Point' | 'LineString' | 'Polygon'): FilterSpecification {
  return ['all', ['==', ['get', 'id'], id || '__none__'], ['==', ['geometry-type'], geometry]]
}
