import { describe, expect, it } from 'vitest'
import * as pipeline from './sync-atlas-data.mjs'
import * as labels from './lib/physical-labels.mjs'
import * as coast from './sync-physical-coast.mjs'
import * as protectedSites from './lib/protected-sites.mjs'

const point = (id, text, elevation = 300) => ({ type: 'Feature', properties: { objectid: id, text, elevation }, geometry: { type: 'Point', coordinates: [-5.4, 43.5] } })

describe('inventario ArcGIS comprobado en todas las capas', () => {
  it('pagina por inventario y respeta el campo de ID propio de la capa', async () => {
    expect(typeof pipeline.fetchArcgisCollection).toBe('function')
    const request = async value => {
      const q = new URL(value).searchParams
      if (q.get('returnIdsOnly') === 'true') return { objectIdFieldName: 'objectid_1', objectIds: [3, 1, 2] }
      if (q.get('returnCountOnly') === 'true') return { count: 3 }
      const ids = q.get('objectIds').split(',').map(Number)
      expect(ids.length).toBeLessThanOrEqual(2)
      return { type: 'FeatureCollection', features: ids.map(id => ({ ...point(id, 'Lago'), properties: { objectid_1: id } })) }
    }
    const result = await pipeline.fetchArcgisCollection('https://example.com/MapServer/17/query?where=1%3D1', request, 2)
    expect(result.features.map(f => f.properties.objectid_1)).toEqual([1, 2, 3])
    expect(result.objectIdField).toBe('objectid_1')
  })
  it('rechaza un cambio de IDs aunque el recuento sea el mismo', async () => {
    expect(typeof pipeline.fetchArcgisCollection).toBe('function')
    let inventoryCalls = 0
    const request = async value => {
      const q = new URL(value).searchParams
      if (q.get('returnIdsOnly') === 'true') return { objectIdFieldName: 'objectid', objectIds: ++inventoryCalls === 1 ? [1] : [2] }
      if (q.get('returnCountOnly') === 'true') return { count: 1 }
      return { type: 'FeatureCollection', features: [point(1, 'Pico')] }
    }
    await expect(pipeline.fetchArcgisCollection('https://example.com/MapServer/2/query?where=1%3D1', request)).rejects.toThrow(/inventario.*modific/i)
  })
  it('rechaza respuestas truncadas en cualquier capa', async () => {
    expect(typeof pipeline.fetchArcgisCollection).toBe('function')
    const request = async value => {
      const q = new URL(value).searchParams
      if (q.get('returnIdsOnly') === 'true') return { objectIds: [1, 2] }
      if (q.get('returnCountOnly') === 'true') return { count: 2 }
      return { type: 'FeatureCollection', features: [point(1, 'Pico')], exceededTransferLimit: true }
    }
    await expect(pipeline.fetchArcgisCollection('https://example.com/MapServer/2/query?where=1%3D1', request)).rejects.toThrow(/incomplet|truncad/i)
  })
})

describe('cobertura física sin exclusiones por altura o nombre', () => {
  it('descarga y conserva cumbres bajas, sierras homónimas y lagos sin nombre', async () => {
    expect(typeof pipeline.fetchPhysicalCore).toBe('function')
    const request = async value => {
      const url = new URL(value), where = url.searchParams.get('where')
      expect(where).not.toMatch(/elevation|nombre/)
      const records = url.pathname.includes('NombresGeograficos')
        ? where.includes('030422') ? [point(1, 'Pico Carda', 329.46)] : [point(2, 'Sierra Pelada'), point(3, 'Sierra Pelada')]
        : url.pathname.includes('Hidrografia/MapServer/2') ? [{ ...point(4, ''), properties: { objectid: 4, nombre: null } }] : []
      if (url.searchParams.get('returnIdsOnly') === 'true') return { objectIdFieldName: 'objectid', objectIds: records.map(f => f.properties.objectid) }
      if (url.searchParams.get('returnCountOnly') === 'true') return { count: records.length }
      expect(url.searchParams.get('outSR')).toBe('4326')
      return { type: 'FeatureCollection', features: records }
    }
    const core = await pipeline.fetchPhysicalCore(request)
    expect(core.features.map(f => f.id)).toEqual(expect.arrayContaining(['physical-as-peak-names-030422-1', 'physical-as-range-names-030424-2', 'physical-as-range-names-030424-3', 'physical-as-lake-hydro-2-4']))
    expect(core.features.find(f => f.properties.kind === 'peak').properties.elevationM).toBe(329.5)
    expect(core.features.find(f => f.properties.kind === 'lake').properties.name).toBe('')
  })

  it('conserva anotaciones fragmentadas sin etiquetarlas como accidentes completos', () => {
    expect(typeof pipeline.buildPhysicalCoreFeatures).toBe('function')
    const result = pipeline.buildPhysicalCoreFeatures({ namespace: 'names-030424', kind: 'range' }, { objectIdField: 'objectid', features: [point(1, 'M o n t e    A r e o'), point(2, 'Sierra'), point(3, 'de')] })
    expect(result).toHaveLength(3)
    expect(result[0].properties).toMatchObject({ name: 'Monte Areo', labelEligible: true })
    expect(result[1].properties.labelEligible).toBe(false)
    expect(result[2].properties.labelEligible).toBe(false)
  })

  it('importa protección puntual, Natura 2000, Ramsar y zonificaciones de biosfera con sus IDs', () => {
    expect(typeof pipeline.buildPhysicalCoreFeatures).toBe('function')
    const ramsar = pipeline.buildPhysicalCoreFeatures({ namespace: 'protected-17', kind: 'protected-area', protectionType: 'Humedal Ramsar' }, { objectIdField: 'objectid_1', features: [{ ...point(1, ''), properties: { objectid_1: 1, ram_name: 'Ría de Villaviciosa', ram_code: 69 } }] })
    expect(ramsar[0].properties).toMatchObject({ id: 'physical-as-protected-area-protected-17-1', name: 'Ría De Villaviciosa', protectionType: 'Humedal Ramsar' })
    const natura = pipeline.buildPhysicalCoreFeatures({ namespace: 'protected-15', kind: 'protected-area', protectionType: 'ZEC' }, { objectIdField: 'objectid', features: [{ ...point(54, ''), properties: { objectid: 54, site_name: 'RÍA DE VILLAVICIOSA', tipo: 'ZEC y ZEPA', site_code: 'ES1200006' } }] })
    expect(natura[0].properties).toMatchObject({ name: 'Ría De Villaviciosa', protectionType: 'ZEC y ZEPA' })
  })
  it('publica el ID antiguo calculado de un parque como alias de compatibilidad', () => {
    const features = pipeline.buildPhysicalCoreFeatures({ namespace: 'protected-2', kind: 'protected-area' }, { objectIdField: 'gid', features: [{ ...point(1, ''), properties: { gid: 1, nombre: 'Redes' } }] })
    expect(features[0].properties.legacyIds).toHaveLength(1)
    expect(features[0].properties.legacyIds[0]).toMatch(/^physical-as-protected-area-protected-2-[a-f0-9]{12}$/)
  })
})

describe('etiquetas por identidad, no por nombre global', () => {
  it('mantiene etiquetas de dos cumbres distintas con el mismo nombre', () => {
    expect(typeof labels.physicalLabelCollection).toBe('function')
    const features = [point(1, 'Peña Blanca'), point(2, 'Peña Blanca')].map((f, index) => ({ ...f, id: `peak-${index}`, properties: { id: `peak-${index}`, name: 'Peña Blanca', kind: 'peak', center: [-5 - index, 43] } }))
    expect(labels.physicalLabelCollection(features).features.map(f => f.id)).toEqual(['peak-0', 'peak-1'])
  })
  it('no transforma un fragmento ni un nombre ausente en una etiqueta', () => {
    expect(typeof labels.physicalLabelCollection).toBe('function')
    const features = [point(1, 'de'), point(2, '')].map((f, index) => ({ ...f, id: index, properties: { name: f.properties.text, center: [-5, 43], labelEligible: index === 1 } }))
    expect(labels.physicalLabelCollection(features).features).toHaveLength(0)
  })
})

it('conserva registros costeros fragmentarios sin convertirlos en etiquetas o eliminar sus IDs', () => {
  expect(typeof coast.buildCoastalFeatures).toBe('function')
  const result = coast.buildCoastalFeatures({ features: [{ ...point(1, 'Ensenada De'), properties: { objectid: 1, text: 'Ensenada De', layer: '050412' } }] }, { features: [] })
  expect(result).toHaveLength(1)
  expect(result[0].properties).toMatchObject({ id: 'physical-as-coast-names-hydro-coast-1', labelEligible: false })
})

it('selecciona un parque zonificado completo sin rellenar huecos o fusionar otras protecciones', () => {
  expect(typeof protectedSites.aggregateProtectedSites).toBe('function')
  const zone = (id, left, right, name = 'Parque Natural de Redes', namespace = 'protected-2') => ({
    type: 'Feature', id: `physical-as-protected-area-${namespace}-${id}`,
    properties: { id: `physical-as-protected-area-${namespace}-${id}`, name, kind: 'protected-area', protectionZone: `Zona ${id}`, protectionInstrument: 'Decreto de Redes', protectionType: 'Parque natural', geometryRole: 'area' },
    geometry: { type: 'Polygon', coordinates: [[[left, 43], [right, 43], [right, 44], [left, 44], [left, 43]]] },
  })
  const features = [zone(1, -6, -5), zone(2, -5, -4), zone(3, -2, -1), zone(4, -7, -6, 'Otro parque'), zone(5, -6, -5, 'Parque Natural de Redes', 'protected-15')]
  const result = protectedSites.aggregateProtectedSites(features)
  expect(result).toHaveLength(1)
  expect(result[0].geometry.type).toBe('MultiPolygon')
  expect(result[0].geometry.coordinates).toHaveLength(2)
  expect(result[0].properties.bbox).toEqual([-6, 43, -1, 44])
  expect(result[0].properties.memberIds).toHaveLength(3)
  expect(features[0].properties.geometryId).toBe(result[0].id)
  expect(features[4].properties.geometryId).toBeUndefined()
})
