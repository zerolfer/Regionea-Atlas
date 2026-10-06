import type { AtlasEntity, DatasetManifest, EditorialEntry } from '../types'

export type AtlasData = {
  manifest: DatasetManifest
  territories: AtlasEntity[]
  physical: AtlasEntity[]
  entitiesById: Map<string, AtlasEntity>
  editorial: Record<string, EditorialEntry>
}

export async function loadAtlasData(signal?: AbortSignal): Promise<AtlasData> {
  const [manifestResponse, catalogResponse, editorialResponse] = await Promise.all([
    fetch('/data/atlas/manifest.json', { signal }),
    fetch('/data/atlas/catalog.json', { signal }),
    fetch('/data/atlas/editorial.json', { signal }),
  ])
  if (!manifestResponse.ok || !catalogResponse.ok || !editorialResponse.ok) {
    throw new Error('No se pudo cargar el catálogo del atlas')
  }
  const manifest = (await manifestResponse.json()) as DatasetManifest
  const catalog = (await catalogResponse.json()) as { territories: AtlasEntity[]; physical: AtlasEntity[] }
  const editorial = (await editorialResponse.json()) as Record<string, EditorialEntry>
  const entitiesById = new Map([...catalog.territories, ...catalog.physical].map((entity) => [entity.id, entity]))
  for (const entity of catalog.physical) for (const id of entity.legacyIds || []) {
    if (entitiesById.has(id)) throw new Error('Alias de ID duplicado en el catálogo')
    entitiesById.set(id, entity)
  }
  return { manifest, ...catalog, entitiesById, editorial }
}

export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
}

export function searchEntities(entities: AtlasEntity[], query: string, limit = 10) {
  const normalizedQuery = normalizeSearch(query.trim())
  if (normalizedQuery.length < 2) return []
  return entities
    .filter((entity) => !entity.geometryId && entity.labelEligible !== false)
    .map((entity) => {
      const names = [entity.name, entity.localName, ...entity.aliases].filter(Boolean).map((name) => normalizeSearch(String(name)))
      const exact = names.some((name) => name === normalizedQuery)
      const prefix = names.some((name) => name.startsWith(normalizedQuery))
      const contains = names.some((name) => name.includes(normalizedQuery))
      return { entity, score: exact ? 0 : prefix ? 1 : contains ? 2 : 99 }
    })
    .filter(({ score }) => score < 99)
    .sort((a, b) => a.score - b.score || a.entity.name.localeCompare(b.entity.name, 'es'))
    .slice(0, limit)
    .map(({ entity }) => entity)
}

export const TERRITORY_KIND_LABELS: Record<string, string> = {
  country: 'País',
  'autonomous-community': 'Comunidad o ciudad autónoma',
  province: 'Provincia',
  'functional-region': 'Comarca funcional',
  municipality: 'Concejo',
  parish: 'Parroquia',
  neighborhood: 'Barrio',
  historical: 'Territorio histórico',
  cultural: 'Territorio cultural',
}

export const BOUNDARY_STATUS_LABELS: Record<string, string> = {
  official: 'Límite administrativo oficial',
  statistical: 'Delimitación estadística',
  municipal: 'Delimitación municipal',
  reference: 'Geometría cartográfica de referencia',
}

export const PHYSICAL_KIND_LABELS: Record<string, string> = {
  peak: 'Pico o montaña',
  range: 'Sierra o cordillera',
  river: 'Río',
  lake: 'Lago o laguna',
  reservoir: 'Embalse',
  valley: 'Valle',
  coast: 'Accidente costero',
  cape: 'Cabo',
  bay: 'Bahía',
  gulf: 'Golfo',
  delta: 'Delta',
  estuary: 'Ría o estuario',
  cliff: 'Acantilado',
  beach: 'Playa',
  island: 'Isla',
  'protected-area': 'Espacio protegido',
}

export function isPhysicalEntity(entity: AtlasEntity) {
  return Object.hasOwn(PHYSICAL_KIND_LABELS, entity.kind)
}
