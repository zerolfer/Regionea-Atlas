import { describe, expect, it } from 'vitest'
import * as pipeline from './sync-atlas-data.mjs'
import { replaceRiverSnapshot } from './sync-physical-rivers.mjs'

const axis = (id, name, length, coordinates, type = 'Línea de eje de río') => ({
  type: 'Feature', properties: { objectid: id, nombre: name, tipo: type, 'st_length(shape)': length },
  geometry: { type: 'LineString', coordinates },
})
const a = [-5.5, 43.1], b = [-5.49, 43.1], c = [-5.48, 43.1], d = [-5.47, 43.1]

describe('red fluvial completa sin conexiones inventadas', () => {
  it('conserva cursos cortos, sin nombre y ocultos, excluyendo canales y márgenes', () => {
    expect(typeof pipeline.buildRiverFeatures).toBe('function')
    const result = pipeline.buildRiverFeatures([
      axis(1, 'Río Alba', 800, [a, b]), axis(2, '', 20, [b, c]),
      axis(3, 'Río Alba', 30, [c, d], 'Curso fluvial oculto'),
      axis(4, 'Canal', 300, [a, d], 'Canal artificial'),
      axis(5, 'Margen', 300, [a, d], 'Márgen de cauce'),
    ])
    expect(result.map(f => f.id)).toEqual(['physical-as-river-hydro-4-1', 'physical-as-river-hydro-4-2', 'physical-as-river-hydro-4-3'])
    expect(result[1].properties.name).toBe('')
    expect(result[1].geometry.coordinates).toEqual([b, c])
    expect(result[2].properties.geometryNote).toMatch(/oculto/i)
    expect(result[0].properties.sourceId).toBe('sitpa-physical')
  })

  it('escala un curso conectado por su longitud conjunta sin hacer desaparecer tramos cortos', () => {
    expect(typeof pipeline.buildRiverFeatures).toBe('function')
    const result = pipeline.buildRiverFeatures([
      axis(1, 'Río Alba', 6000, [a, b]), axis(2, 'Río Alba', 100, [b, c]),
      axis(3, 'Río Alba', 90, [[-6, 43], [-5.99, 43]]), axis(4, '', 40, [c, d]),
    ])
    expect(result[0].properties.minZoom).toBe(7.5)
    expect(result[1].properties.minZoom).toBe(7.5)
    expect(result[2].properties.minZoom).toBe(10)
    expect(result[3].properties.minZoom).toBe(12)
  })

  it('encadena partes cuyos extremos coinciden, también invertidas, y mantiene los huecos reales', () => {
    expect(typeof pipeline.buildRiverFeatures).toBe('function')
    const result = pipeline.buildRiverFeatures([{
      ...axis(1, 'Río Alba', 7000, [a, b]),
      geometry: { type: 'MultiLineString', coordinates: [[a, b], [c, b], [[-6, 43], [-5.99, 43]]] },
    }])
    expect(result[0].geometry).toEqual({ type: 'MultiLineString', coordinates: [[a, b, c], [[-6, 43], [-5.99, 43]]] })
  })
})

describe('descarga fluvial verificable', () => {
  it('conserva los IDs de ríos antiguos que ya redirigen a una superficie de ría', () => {
    const id = 'physical-as-river-hydro-4-1'
    const previous = { ...axis(1, 'Ría de Avilés', 300, [a, b]), id, properties: { id, kind: 'estuary', name: 'Ría de Avilés', geometryId: 'water-area' } }
    const catalogAlias = { ...previous.properties, sourceId: 'miteco-water-2027', bbox: [-6, 43, -5, 44] }
    expect(typeof replaceRiverSnapshot).toBe('function')
    const asturias = { features: [previous] }, catalog = { physical: [catalogAlias, { id: 'water-area', kind: 'estuary' }] }
    const rivers = pipeline.buildRiverFeatures([axis(1, 'Ría de Avilés', 300, [a, b]), axis(2, '', 30, [b, c])])
    replaceRiverSnapshot(asturias, catalog, rivers)
    expect(asturias.features.filter(f => f.id === id)).toHaveLength(1)
    expect(asturias.features.find(f => f.id === id).properties).toMatchObject({ kind: 'estuary', geometryId: 'water-area' })
    expect(catalog.physical.find(f => f.id === id)).toEqual(catalogAlias)
    expect(catalog.physical).toHaveLength(3)
  })
  it('descarga todos los IDs en lotes, incluso sin nombre o menores de 5 km', async () => {
    expect(typeof pipeline.fetchRiverCollection).toBe('function')
    const raw = [axis(1, '', 20, [a, b]), axis(2, 'Río Alba', 800, [b, c]), axis(3, '', 30, [c, d])]
    const request = async value => {
      const url = new URL(value)
      expect(url.searchParams.get('where')).not.toMatch(/nombre|length/)
      if (url.searchParams.get('returnCountOnly') === 'true') return { count: 3 }
      if (url.searchParams.get('returnIdsOnly') === 'true') return { objectIds: [3, 1, 2] }
      expect(url.searchParams.get('outSR')).toBe('4326')
      const ids = url.searchParams.get('objectIds').split(',').map(Number)
      expect(ids.length).toBeLessThanOrEqual(2)
      return { type: 'FeatureCollection', features: raw.filter(f => ids.includes(f.properties.objectid)) }
    }
    const collection = await pipeline.fetchRiverCollection(request, 2)
    expect(collection.features.map(f => f.properties.objectid)).toEqual([1, 2, 3])
  })

  it('rechaza una respuesta truncada o duplicada antes de reemplazar el snapshot', async () => {
    expect(typeof pipeline.fetchRiverCollection).toBe('function')
    const request = async value => {
      const url = new URL(value)
      if (url.searchParams.get('returnCountOnly') === 'true') return { count: 2 }
      if (url.searchParams.get('returnIdsOnly') === 'true') return { objectIds: [1, 2] }
      return { type: 'FeatureCollection', features: [axis(1, '', 20, [a, b])] }
    }
    await expect(pipeline.fetchRiverCollection(request)).rejects.toThrow(/incomplet|truncad/i)
  })
})
