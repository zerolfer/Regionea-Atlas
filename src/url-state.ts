import type { MapMode, PhysicalFilter, PoliticalLevel, TransitMode } from './types'

const PATH_MODES: Record<string, MapMode> = { politico: 'political', fisico: 'physical', transporte: 'transit' }
export const DEFAULT_PHYSICAL_FILTERS: PhysicalFilter[] = ['relief', 'peaks', 'hydrography', 'coast', 'protected']
export const ALL_PHYSICAL_FILTERS: PhysicalFilter[] = ['relief', 'peaks', 'hydrography', 'valleys', 'coast', 'protected', 'hypsometry', 'terrain3d']
export const POLITICAL_LEVELS: PoliticalLevel[] = ['auto', 'countries', 'communities', 'provinces', 'comarcas', 'concejos', 'parishes', 'neighborhoods']
export const TRANSIT_MODES: TransitMode[] = ['bus', 'rail', 'ferry', 'air']

export function parseInitialUrl() {
  const params = new URLSearchParams(window.location.search)
  const pathMode = window.location.pathname.split('/').filter(Boolean).at(-1) || 'politico'
  const mode = PATH_MODES[pathMode] || 'political'
  const longitude = params.has('lng') ? Number(params.get('lng')) : Number.NaN
  const latitude = params.has('lat') ? Number(params.get('lat')) : Number.NaN
  const zoom = params.has('z') ? Number(params.get('z')) : Number.NaN
  return {
    mode,
    selectedId: params.get('seleccion'),
    politicalLevel: POLITICAL_LEVELS.includes(params.get('nivel') as PoliticalLevel) ? params.get('nivel') as PoliticalLevel : 'auto',
    compareIds: (params.get('comparar') || '').split(',').filter(Boolean).slice(0, 3),
    view: {
      center: Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] as [number, number] : [-5.86, 43.31] as [number, number],
      zoom: Number.isFinite(zoom) ? zoom : 8,
    },
    filters: new Set<PhysicalFilter>((params.get('filtros') ?? DEFAULT_PHYSICAL_FILTERS.join(',')).split(',').filter((item): item is PhysicalFilter => ALL_PHYSICAL_FILTERS.includes(item as PhysicalFilter))),
    transitProviders: new Set((params.get('fuentes') || '').split(',').filter(Boolean).map((provider) => provider.toUpperCase())),
    transitModes: new Set<TransitMode>((params.get('transportes') || '').split(',').filter((item): item is TransitMode => TRANSIT_MODES.includes(item as TransitMode))),
    showRealtime: params.get('tiempoReal') !== '0',
  }
}
