import { describe, expect, it } from 'vitest'
import { isPhysicalEntity, normalizeSearch, searchEntities } from './atlas'
import type { AtlasEntity } from '../types'

const entities: AtlasEntity[] = [
  {
    id: 'es-as', slug: 'asturias', name: 'Asturias', localName: 'Asturies',
    aliases: ['Principado de Asturias'], kind: 'autonomous-community', sourceId: 'test',
    bbox: null, center: null,
  },
  {
    id: 'es-as-concejo-33024', slug: 'gijon', name: 'Gijón', localName: 'Xixón',
    aliases: [], kind: 'municipality', sourceId: 'test', bbox: null, center: null,
  },
  {
    id: 'physical-picos-de-europa', slug: 'picos-de-europa', name: 'Picos de Europa',
    aliases: [], kind: 'range', sourceId: 'test', bbox: null, center: null,
  },
]

describe('catálogo del atlas', () => {
  it('normaliza diacríticos y mayúsculas para la búsqueda', () => {
    expect(normalizeSearch('  GIJÓN  ')).toBe('  gijon  ')
    expect(searchEntities(entities, 'xixon')).toEqual([entities[1]])
  })

  it('prioriza coincidencias exactas y también busca alias', () => {
    expect(searchEntities(entities, 'asturias').map(({ id }) => id)).toEqual(['es-as'])
    expect(searchEntities(entities, 'principado').map(({ id }) => id)).toEqual(['es-as'])
  })

  it('distingue accidentes físicos de territorios', () => {
    expect(isPhysicalEntity(entities[0])).toBe(false)
    expect(isPhysicalEntity(entities[2])).toBe(true)
  })

  it('busca el nombre antiguo en la superficie canónica sin duplicar resultados', () => {
    const area: AtlasEntity = { ...entities[2], id: 'area', name: 'Estuario de Avilés', kind: 'estuary', geometryRole: 'area', aliases: ['Ría de Avilés'] }
    const legacy = { ...area, id: 'legacy', name: 'Ría de Avilés', geometryId: 'area' }
    expect(searchEntities([legacy, area], 'ría de avilés')).toEqual([area])
  })
})
