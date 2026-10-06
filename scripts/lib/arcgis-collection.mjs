import { createHash } from 'node:crypto'

// Inventory-based downloads do not rely on the server's default page size.
export async function fetchArcgisCollection(value, request, batchSize = 1000) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error('Lote ArcGIS no válido')
  const query = new URL(value)
  for (const key of ['resultOffset', 'resultRecordCount', 'objectIds', 'returnCountOnly', 'returnIdsOnly']) query.searchParams.delete(key)
  query.searchParams.set('returnGeometry', 'true')
  query.searchParams.set('outSR', '4326')
  query.searchParams.set('f', 'geojson')
  if (!query.searchParams.has('outFields')) query.searchParams.set('outFields', '*')
  const inventoryUrl = new URL(query)
  inventoryUrl.searchParams.set('returnIdsOnly', 'true')
  inventoryUrl.searchParams.set('f', 'json')
  const inventory = await request(inventoryUrl.toString())
  const ids = inventory.objectIds
  if (!Array.isArray(ids) || ids.some(id => !Number.isInteger(id)) || new Set(ids).size !== ids.length) throw new Error('Inventario ArcGIS inválido o duplicado')
  ids.sort((a, b) => a - b)
  const objectIdField = inventory.objectIdFieldName || 'objectid'
  const countUrl = new URL(query)
  countUrl.searchParams.set('returnCountOnly', 'true')
  countUrl.searchParams.set('f', 'json')
  const checkCount = async () => {
    if ((await request(countUrl.toString())).count !== ids.length) throw new Error('Inventario ArcGIS incompleto o modificado durante la descarga')
  }
  await checkCount()
  const features = [], seen = new Set()
  for (let offset = 0; offset < ids.length; offset += batchSize) {
    const batch = ids.slice(offset, offset + batchSize), expected = new Set(batch)
    query.searchParams.set('objectIds', batch.join(','))
    const page = await request(query.toString())
    if (!Array.isArray(page.features) || page.features.length !== batch.length || page.exceededTransferLimit) throw new Error('Descarga ArcGIS incompleta o truncada')
    for (const feature of page.features) {
      const id = feature.properties?.[objectIdField]
      if (!expected.has(id) || seen.has(id)) throw new Error('ID ArcGIS inesperado o duplicado')
      if (!feature.geometry?.coordinates) throw new Error(`Geometría ArcGIS ausente: ${id}`)
      seen.add(id)
      features.push(feature)
    }
  }
  await checkCount()
  const finalInventory = (await request(inventoryUrl.toString())).objectIds
  if (!Array.isArray(finalInventory) || JSON.stringify([...finalInventory].sort((a, b) => a - b)) !== JSON.stringify(ids)) throw new Error('Inventario ArcGIS modificado durante la descarga')
  features.sort((a, b) => a.properties[objectIdField] - b.properties[objectIdField])
  return { type: 'FeatureCollection', features, objectIdField, coverage: {
    sourceUrl: query.origin + query.pathname.replace(/\/query$/, ''), where: query.searchParams.get('where') || '1=1',
    featureCount: features.length, downloadedAt: new Date().toISOString(),
    objectIdsSha256: createHash('sha256').update(JSON.stringify(ids)).digest('hex'),
  } }
}
