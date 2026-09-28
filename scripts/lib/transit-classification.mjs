export const TRANSIT_CLASSIFICATION_VERSION = 1

export const TRANSIT_EXTENT_RULES = Object.freeze([
  Object.freeze({ extentClass: 'urban', maxSpanKm: 18, maxLengthKm: 55, minZoom: 9.5 }),
  Object.freeze({ extentClass: 'local', maxSpanKm: 65, maxLengthKm: 160, minZoom: 8 }),
  Object.freeze({ extentClass: 'regional', maxSpanKm: 260, maxLengthKm: 650, minZoom: 6.5 }),
  Object.freeze({ extentClass: 'long-distance', maxSpanKm: null, maxLengthKm: null, minZoom: 5 }),
])

const EARTH_RADIUS_KM = 6371.0088

function radians(value) {
  return value * Math.PI / 180
}

function validPosition(value) {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])
}

function linesFromCoordinates(value) {
  if (!Array.isArray(value) || value.length === 0) return []
  if (validPosition(value[0])) return [value.filter(validPosition)]
  return value.flatMap(linesFromCoordinates)
}

export function haversineKm(first, second) {
  const latitudeDelta = radians(second[1] - first[1])
  const longitudeDelta = radians(second[0] - first[0])
  const firstLatitude = radians(first[1])
  const secondLatitude = radians(second[1])
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)))
}

export function routeMetrics(coordinates) {
  const lines = linesFromCoordinates(coordinates).filter((line) => line.length >= 2)
  if (!lines.length) throw new Error('La ruta no contiene una línea válida para clasificar')
  const positions = lines.flat()
  const longitudes = positions.map(([longitude]) => longitude)
  const latitudes = positions.map(([, latitude]) => latitude)
  const bounds = [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)]
  const spanKm = haversineKm([bounds[0], bounds[1]], [bounds[2], bounds[3]])
  const lengthKm = Math.max(...lines.map((line) => line.slice(1).reduce(
    (length, position, index) => length + haversineKm(line[index], position),
    0,
  )))
  return { lengthKm, spanKm }
}

export function classifyRouteMetrics({ lengthKm, spanKm }) {
  if (!Number.isFinite(lengthKm) || lengthKm <= 0 || !Number.isFinite(spanKm) || spanKm <= 0) {
    throw new Error('Las métricas de la ruta no son válidas')
  }
  const rule = TRANSIT_EXTENT_RULES.find(({ maxSpanKm, maxLengthKm }) => (
    maxSpanKm == null || (spanKm <= maxSpanKm && lengthKm <= maxLengthKm)
  ))
  return { extentClass: rule.extentClass, displayMinZoom: rule.minZoom }
}

export function classifyRoute(coordinates, { stopCount = 0, basis = 'full-service-geometry' } = {}) {
  const metrics = routeMetrics(coordinates)
  const rendering = classifyRouteMetrics(metrics)
  return {
    ...rendering,
    routeLengthKm: Number(metrics.lengthKm.toFixed(2)),
    routeSpanKm: Number(metrics.spanKm.toFixed(2)),
    routeStopCount: Math.max(0, Math.trunc(stopCount)),
    classificationVersion: TRANSIT_CLASSIFICATION_VERSION,
    classificationBasis: basis,
  }
}

export function transitClassificationManifest() {
  return {
    version: TRANSIT_CLASSIFICATION_VERSION,
    method: 'geometry-scale',
    rules: TRANSIT_EXTENT_RULES.map((rule) => ({ ...rule })),
  }
}

export function assertRouteClassification(properties, context = 'ruta') {
  if (properties.classificationVersion !== TRANSIT_CLASSIFICATION_VERSION) throw new Error(`${context}: versión de clasificación no válida`)
  if (!['full-service-geometry', 'published-geometry'].includes(properties.classificationBasis)) throw new Error(`${context}: base de clasificación no válida`)
  if (!Number.isFinite(properties.routeLengthKm) || properties.routeLengthKm <= 0) throw new Error(`${context}: longitud de ruta no válida`)
  if (!Number.isFinite(properties.routeSpanKm) || properties.routeSpanKm <= 0) throw new Error(`${context}: extensión de ruta no válida`)
  if (!Number.isInteger(properties.routeStopCount) || properties.routeStopCount < 0) throw new Error(`${context}: número de paradas no válido`)
  const expected = classifyRouteMetrics({ lengthKm: properties.routeLengthKm, spanKm: properties.routeSpanKm })
  if (properties.extentClass !== expected.extentClass) throw new Error(`${context}: clase de extensión incoherente`)
  if (properties.displayMinZoom !== expected.displayMinZoom) throw new Error(`${context}: zoom mínimo incoherente`)
  if ('scope' in properties) throw new Error(`${context}: conserva el campo obsoleto scope`)
  return true
}
