import assert from 'node:assert/strict'
import { detailedDeltaGeometry, geometryBox, geometryRole, matchingCoastalArea, parseDeltaEnvironments, parseDeltaUnits, reprojectGeometry } from './coastal-areas.mjs'
import { importWaterAreas } from '../sync-physical-areas.mjs'

function unit(id, layer, coordinates, hole = '') {
  const ring = (text) => `<gml:LinearRing><gml:coordinates>${text}</gml:coordinates></gml:LinearRing>`
  return `<gml:featureMember><ms:delta_enviro><ms:gid>${id}</ms:gid><ms:layer>${layer}</ms:layer>
    <ms:the_geom><gml:MultiPolygon srsName="http://www.opengis.net/gml/srs/epsg.xml#4326"><gml:polygonMember><gml:Polygon>
    <gml:outerBoundaryIs>${ring(coordinates)}</gml:outerBoundaryIs>
    ${hole ? `<gml:innerBoundaryIs>${ring(hole)}</gml:innerBoundaryIs>` : ''}
    </gml:Polygon></gml:polygonMember></gml:MultiPolygon></ms:the_geom></ms:delta_enviro></gml:featureMember>`
}
const plain = unit('1', 'QHpd', '0,0 4,0 4,4 0,4 0,0', '1,1 2,1 2,2 1,2 1,1')
const marsh = unit('2', 'QHm', '4,0 5,0 5,4 4,4 4,0')
const submerged = unit('3', 'QHfd', '20,20 30,20 30,30 20,30 20,20')
const document = (members) => `<gml:FeatureCollection xmlns:gml="http://www.opengis.net/gml" xmlns:ms="http://mapserver.gis.umn.edu/mapserver">${members}</gml:FeatureCollection>`
const result = parseDeltaEnvironments(document(plain + marsh + submerged))
assert.deepEqual(geometryBox(result), [0, 0, 5, 4])
assert.equal(result.coordinates.length, 1, 'Se unen unidades contiguas, sin incluir depósitos sumergidos')
assert.equal(result.coordinates[0].length, 2, 'La unión conserva huecos')
assert.throws(() => parseDeltaEnvironments(document(plain)), /Faltan unidades/)
assert.throws(() => parseDeltaEnvironments(document(plain + plain + marsh)), /duplicado/)
assert.throws(() => parseDeltaEnvironments(document('')), /vacía/)
assert.throws(() => parseDeltaEnvironments(document(plain + marsh).replaceAll('#4326', '#25831')), /CRS/)
assert.throws(() => parseDeltaEnvironments(document(plain + marsh).replace('4,4', 'NaN,4')), /Anillo/)
assert.throws(() => parseDeltaEnvironments(document(plain + marsh).replace('0,4 0,0', '0,4 1,0')), /Anillo/)
await assert.rejects(() => importWaterAreas(Buffer.from('No es un ZIP')), /Invalid|ZIP/i)

const inventory = parseDeltaUnits(document(plain + marsh + submerged))
const perimeter = []
for (let i = 0; i < 25; i++) perimeter.push([i / 25, 0])
for (let i = 0; i < 25; i++) perimeter.push([1, i / 25])
for (let i = 0; i < 25; i++) perimeter.push([1 - i / 25, 1])
for (let i = 0; i < 25; i++) perimeter.push([0, 1 - i / 25])
perimeter.push([0, 0])
const details = inventory.map((item) => ({ ...item, geometry: { type: 'MultiPolygon', coordinates: [[perimeter]] } }))
const requests = []
await detailedDeltaGeometry(async (bbox, pixels) => {
  requests.push({ bbox, pixels })
  return pixels ? details : inventory
})
assert.equal(requests.length, 3, 'Una consulta de inventario y dos de detalle, sin consultar unidades marinas')
assert.deepEqual(requests[1], { bbox: [-0.01, -0.01, 0.01, 0.01], pixels: 2048 })
await assert.rejects(() => detailedDeltaGeometry(async () => inventory), /falta geometría detallada/)
await assert.rejects(() => detailedDeltaGeometry(async (bbox, pixels) => pixels ? [] : inventory), /falta geometría detallada/)

const area = { id: 'aviles', geometry: result, properties: { kind: 'estuary', name: 'Estuario de Avilés', bbox: [-5.95, 43.55, -5.88, 43.61] } }
const label = { geometry: { type: 'Point', coordinates: [-5.9, 43.58] }, properties: { kind: 'estuary', name: 'Ría de Avilés' } }
assert.equal(matchingCoastalArea(label, [area]), area)
const axis = { geometry: { type: 'LineString', coordinates: [[-5.92, 43.56], [-5.9, 43.6]] }, properties: { ...label.properties, kind: 'river', center: [-5.91, 43.58] } }
assert.equal(matchingCoastalArea(axis, [area]), area)
assert.equal(matchingCoastalArea({ ...axis, properties: { ...axis.properties, name: 'Río de Avilés' } }, [area]), null)
assert.equal(matchingCoastalArea(label, [area, { ...area, id: 'ambiguous' }]), null)
assert.equal(matchingCoastalArea({ ...label, geometry: { type: 'Point', coordinates: [0, 0] } }, [area]), null)
assert.equal(matchingCoastalArea({ ...label, properties: { ...label.properties, kind: 'bay' } }, [area]), null)
assert.equal(geometryRole(label), 'label')
assert.equal(geometryRole(area), 'area')
assert.equal(geometryRole({ ...label, properties: { kind: 'cape' } }), 'point')
assert.deepEqual(reprojectGeometry({ type: 'Polygon', coordinates: [[[0, 0], [111319.490793, 0], [111319.490793, 111325.142866], [0, 0]]] }, 'EPSG:3857').coordinates,
  [[[0, 0], [1, 0], [1, 1], [0, 0]]])
console.log('Superficies costeras: parser, huecos, CRS, identidad y reproyección válidos.')
