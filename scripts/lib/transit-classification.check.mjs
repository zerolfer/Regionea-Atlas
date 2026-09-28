import assert from 'node:assert/strict'
import { assertRouteClassification, classifyRoute, classifyRouteMetrics, routeMetrics } from './transit-classification.mjs'

const urban = classifyRoute([[-5.86, 43.36], [-5.75, 43.42]], { stopCount: 12 })
assert.equal(urban.extentClass, 'urban')
assert.equal(urban.displayMinZoom, 9.5)
assert.equal(urban.routeStopCount, 12)
assertRouteClassification(urban)

assert.deepEqual(classifyRouteMetrics({ lengthKm: 80, spanKm: 45 }), { extentClass: 'local', displayMinZoom: 8 })
assert.deepEqual(classifyRouteMetrics({ lengthKm: 320, spanKm: 180 }), { extentClass: 'regional', displayMinZoom: 6.5 })
assert.deepEqual(classifyRouteMetrics({ lengthKm: 900, spanKm: 600 }), { extentClass: 'long-distance', displayMinZoom: 5 })

const alternatives = routeMetrics([
  [[-5.9, 43.3], [-5.7, 43.4]],
  [[-5.9, 43.3], [-4.8, 43.4]],
])
assert(alternatives.lengthKm > 80)
assert(alternatives.spanKm > 80)

assert.throws(() => assertRouteClassification({ ...urban, extentClass: 'regional' }), /incoherente/)
process.stdout.write('Clasificación de transporte válida.\n')
