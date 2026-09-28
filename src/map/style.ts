import type { FilterSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { MapMode } from '../types'

const POLITICAL_SOURCES = {
  countries: '/data/atlas/territories/countries.geojson',
  communities: '/data/atlas/territories/communities.geojson',
  provinces: '/data/atlas/territories/provinces.geojson',
  comarcas: '/data/atlas/territories/comarcas.geojson',
  concejos: '/data/atlas/territories/concejos.geojson',
  parishes: '/data/atlas/territories/parishes.geojson',
  neighborhoods: '/data/atlas/territories/neighborhoods.geojson',
}

export const POLITICAL_LEVEL_RANGES = [
  { source: 'countries', kind: 'country', min: 0, max: 5.4, color: '#72695f', width: 1.1, label: 12 },
  { source: 'communities', kind: 'autonomous-community', min: 4.6, max: 7.2, color: '#9b633d', width: 1.3, label: 12 },
  { source: 'provinces', kind: 'province', min: 6.4, max: 8.5, color: '#826444', width: 1.1, label: 12 },
  { source: 'comarcas', kind: 'functional-region', min: 7.4, max: 9.2, color: '#b1693f', width: 1.6, label: 13 },
  { source: 'concejos', kind: 'municipality', min: 8.5, max: 11.2, color: '#704f38', width: 1.2, label: 13 },
  { source: 'parishes', kind: 'parish', min: 10.5, max: 13.4, color: '#8d765f', width: 0.8, label: 12 },
  { source: 'neighborhoods', kind: 'neighborhood', min: 12.4, max: 24, color: '#9a4f3f', width: 1.15, label: 12 },
] as const

const selectedFilter: FilterSpecification = ['==', ['get', 'id'], '__none__']

function politicalLayers(): LayerSpecification[] {
  return POLITICAL_LEVEL_RANGES.flatMap(({ source, kind, min, max, color, width, label }) => [
    {
      id: `${source}-fill`, type: 'fill', source, minzoom: min, maxzoom: max,
      paint: {
        'fill-color': source === 'comarcas' ? '#d8a66f' : '#e7dfd1',
        'fill-opacity': source === 'parishes' ? 0.12 : source === 'neighborhoods' ? 0.2 : 0.22,
      },
    },
    {
      id: `${source}-hit`, type: 'fill', source, minzoom: min, maxzoom: max,
      paint: { 'fill-color': '#000000', 'fill-opacity': 0.001 },
    },
    {
      id: `${source}-line`, type: 'line', source, minzoom: min, maxzoom: max,
      paint: { 'line-color': color, 'line-width': width, 'line-opacity': 0.88 },
    },
    {
      id: `${source}-labels`, type: 'symbol', source: 'territory-labels', minzoom: min, maxzoom: max,
      filter: ['==', ['get', 'kind'], kind],
      layout: {
        'text-field': kind === 'functional-region' ? ['get', 'name'] : ['coalesce', ['get', 'localName'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], min, label - 1, Math.min(max, min + 2), label + 1],
        'text-max-width': 9,
        'text-padding': 4,
        'text-allow-overlap': false,
      },
      paint: { 'text-color': '#29251f', 'text-halo-color': '#f6f1e7', 'text-halo-width': 1.4 },
    },
    {
      id: `${source}-selected`, type: 'line', source, minzoom: Math.max(0, min - 3), maxzoom: 24,
      filter: selectedFilter,
      paint: { 'line-color': '#d95d39', 'line-width': 3.2, 'line-opacity': 1 },
    },
    {
      id: `${source}-compared`, type: 'line', source, minzoom: 0, maxzoom: 24,
      filter: ['in', ['get', 'id'], ['literal', []]],
      paint: { 'line-color': '#5c467d', 'line-width': 3, 'line-opacity': 0.95, 'line-dasharray': [2, 1.4] },
    },
  ] as LayerSpecification[])
}

function contextTerritoryLayers(): LayerSpecification[] {
  return [
    {
      id: 'context-communities-line', type: 'line', source: 'communities',
      paint: { 'line-color': '#827c72', 'line-width': 0.8, 'line-opacity': 0.5 },
    },
    {
      id: 'context-concejos-line', type: 'line', source: 'concejos', minzoom: 7,
      paint: { 'line-color': '#6d675f', 'line-width': 0.75, 'line-opacity': 0.45 },
    },
  ]
}

function silentBaseLayers(): LayerSpecification[] {
  return [
    {
      id: 'base-landcover', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland']]],
      paint: { 'fill-color': '#e3e5dc', 'fill-opacity': 0.5 },
    },
    {
      id: 'base-parks', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', minzoom: 5,
      paint: { 'fill-color': '#dce5d7', 'fill-opacity': 0.58 },
    },
    {
      id: 'base-water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
      paint: { 'fill-color': '#d9e5e6', 'fill-opacity': 0.9 },
    },
    {
      id: 'base-waterways', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway', minzoom: 7,
      paint: { 'line-color': '#b4ced3', 'line-width': 0.7, 'line-opacity': 0.75 },
    },
    {
      id: 'base-roads', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 6,
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]],
      paint: {
        'line-color': '#c9c2b8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.35, 12, 1.5],
        'line-opacity': 0.65,
      },
    },
    {
      id: 'base-buildings', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
      paint: { 'fill-color': '#d4cec4', 'fill-opacity': 0.45 },
    },
  ]
}

function physicalLayers(): LayerSpecification[] {
  return [
    {
      id: 'physical-europe-rivers', type: 'line', source: 'physical-europe', minzoom: 2, maxzoom: 9,
      filter: ['==', ['get', 'kind'], 'river'],
      paint: { 'line-color': '#5d91a5', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 8, 1.8], 'line-opacity': 0.8 },
    },
    {
      id: 'physical-europe-lakes', type: 'fill', source: 'physical-europe', minzoom: 2, maxzoom: 9,
      filter: ['==', ['get', 'kind'], 'lake'], paint: { 'fill-color': '#86b5c3', 'fill-opacity': 0.7 },
    },
    {
      id: 'physical-europe-ranges', type: 'fill', source: 'physical-europe', minzoom: 2.5, maxzoom: 9,
      filter: ['==', ['get', 'kind'], 'range'],
      paint: { 'fill-color': '#95785d', 'fill-opacity': 0.2, 'fill-outline-color': '#735a45' },
    },
    {
      id: 'physical-europe-valleys', type: 'fill', source: 'physical-europe', minzoom: 3, maxzoom: 9,
      filter: ['==', ['get', 'kind'], 'valley'],
      paint: { 'fill-color': '#c8aa70', 'fill-opacity': 0.24, 'fill-outline-color': '#9b7744' },
    },
    {
      id: 'physical-europe-coasts', type: 'fill', source: 'physical-europe', minzoom: 3, maxzoom: 9,
      filter: ['==', ['get', 'kind'], 'coast'],
      paint: { 'fill-color': '#68a7af', 'fill-opacity': 0.2, 'fill-outline-color': '#397984' },
    },
    {
      id: 'physical-europe-peaks', type: 'circle', source: 'physical-europe', minzoom: 4, maxzoom: 9,
      filter: ['==', ['get', 'kind'], 'peak'],
      paint: { 'circle-color': '#44382f', 'circle-radius': 3, 'circle-stroke-color': '#f6f1e7', 'circle-stroke-width': 0.8 },
    },
    {
      id: 'physical-europe-labels', type: 'symbol', source: 'physical-europe-labels', minzoom: 3.5, maxzoom: 9,
      layout: {
        'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11,
        'text-max-width': 9, 'text-padding': 3, 'text-allow-overlap': false,
      },
      paint: { 'text-color': '#3b342c', 'text-halo-color': '#f6f1e7', 'text-halo-width': 1.2 },
    },
    {
      id: 'physical-rivers', type: 'line', source: 'physical-asturias', minzoom: 7.5,
      filter: ['==', ['get', 'kind'], 'river'],
      paint: { 'line-color': '#347f9a', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 13, 2.6], 'line-opacity': 0.88 },
    },
    {
      id: 'physical-water', type: 'fill', source: 'physical-asturias', minzoom: 8,
      filter: ['in', ['get', 'kind'], ['literal', ['lake', 'reservoir']]],
      paint: { 'fill-color': '#6ba5b8', 'fill-opacity': 0.78, 'fill-outline-color': '#347f9a' },
    },
    {
      id: 'physical-protected', type: 'fill', source: 'physical-asturias', minzoom: 7.5,
      filter: ['==', ['get', 'kind'], 'protected-area'],
      paint: { 'fill-color': '#6f8d64', 'fill-opacity': 0.18, 'fill-outline-color': '#52724d' },
    },
    {
      id: 'physical-peaks', type: 'circle', source: 'physical-asturias', minzoom: 9,
      filter: ['==', ['get', 'kind'], 'peak'],
      paint: {
        'circle-color': '#342d27', 'circle-stroke-color': '#f6f1e7', 'circle-stroke-width': 1,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.3, 13, 4.5],
      },
    },
    {
      id: 'physical-river-labels', type: 'symbol', source: 'physical-asturias', minzoom: 10,
      filter: ['==', ['get', 'kind'], 'river'],
      layout: {
        'symbol-placement': 'line', 'symbol-spacing': 650,
        'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11,
        'text-padding': 18, 'text-allow-overlap': false,
      },
      paint: { 'text-color': '#296f8a', 'text-halo-color': '#f6f1e7', 'text-halo-width': 1.2 },
    },
    {
      id: 'physical-point-labels', type: 'symbol', source: 'physical-asturias-labels', minzoom: 9.4,
      filter: ['in', ['get', 'kind'], ['literal', ['peak', 'range', 'cape', 'bay', 'gulf', 'estuary', 'cliff', 'beach', 'island']]],
      layout: {
        'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 13, 13],
        'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-max-width': 10,
        'text-allow-overlap': false, 'text-ignore-placement': false,
      },
      paint: { 'text-color': '#2e2924', 'text-halo-color': '#f6f1e7', 'text-halo-width': 1.2 },
    },
    {
      id: 'physical-area-labels', type: 'symbol', source: 'physical-asturias-labels', minzoom: 9,
      filter: ['in', ['get', 'kind'], ['literal', ['lake', 'reservoir', 'protected-area']]],
      layout: {
        'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11,
        'text-max-width': 10, 'text-padding': 12, 'text-allow-overlap': false,
      },
      paint: { 'text-color': '#2e2924', 'text-halo-color': '#f6f1e7', 'text-halo-width': 1.2 },
    },
    {
      id: 'physical-selected-point', type: 'circle', source: 'physical-asturias', minzoom: 0,
      filter: selectedFilter,
      paint: { 'circle-color': '#e45c37', 'circle-radius': 8, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
    },
    {
      id: 'physical-selected-line', type: 'line', source: 'physical-asturias', minzoom: 0,
      filter: selectedFilter, paint: { 'line-color': '#e45c37', 'line-width': 4 },
    },
    {
      id: 'physical-selected-fill', type: 'line', source: 'physical-asturias', minzoom: 0,
      filter: selectedFilter, paint: { 'line-color': '#e45c37', 'line-width': 3 },
    },
    {
      id: 'physical-related-peaks', type: 'circle', source: 'physical-asturias', minzoom: 0,
      filter: ['in', ['get', 'id'], ['literal', []]],
      paint: { 'circle-color': '#e8a73a', 'circle-radius': 6, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
    },
    {
      id: 'physical-europe-selected-point', type: 'circle', source: 'physical-europe', minzoom: 0,
      filter: selectedFilter,
      paint: { 'circle-color': '#e45c37', 'circle-radius': 8, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
    },
    {
      id: 'physical-europe-selected-line', type: 'line', source: 'physical-europe', minzoom: 0,
      filter: selectedFilter, paint: { 'line-color': '#e45c37', 'line-width': 4 },
    },
    {
      id: 'physical-europe-selected-fill', type: 'line', source: 'physical-europe', minzoom: 0,
      filter: selectedFilter, paint: { 'line-color': '#e45c37', 'line-width': 3 },
    },
  ]
}

function transitLayers(): LayerSpecification[] {
  return [
    {
      id: 'transit-routes-overview', type: 'line', source: 'transit-routes', minzoom: 6.5, maxzoom: 8.7,
      filter: ['==', ['coalesce', ['get', 'transportMode'], ['case', ['==', ['get', 'provider'], 'RENFE'], 'rail', 'bus']], 'rail'],
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#316b8c'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6.5, 1.4, 8.7, 2.4],
        'line-opacity': 0.86,
      },
    },
    {
      id: 'transit-routes-line', type: 'line', source: 'transit-routes', minzoom: 8.5,
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#316b8c'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8.5, ['case', ['==', ['coalesce', ['get', 'transportMode'], 'bus'], 'rail'], 2, 0.7], 10.5, 4.5],
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'], 8.5,
          ['case',
            ['==', ['coalesce', ['get', 'transportMode'], 'bus'], 'rail'], 0.82,
            ['==', ['coalesce', ['get', 'scope'], 'regional'], 'local'], 0.16,
            0.48,
          ],
          10.5, 0.86,
        ],
      },
    },
    {
      id: 'transit-stops-circle', type: 'circle', source: 'transit-stops', minzoom: 10,
      paint: {
        'circle-color': '#f7f2e8', 'circle-stroke-color': ['coalesce', ['get', 'color'], '#316b8c'],
        'circle-stroke-width': 1.5, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 13, 5.5],
      },
    },
    {
      id: 'transit-stops-labels', type: 'symbol', source: 'transit-stops', minzoom: 12,
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 1], 'text-anchor': 'top' },
      paint: { 'text-color': '#25313a', 'text-halo-color': '#f7f2e8', 'text-halo-width': 1.2 },
    },
    {
      id: 'transit-vehicles-circle', type: 'circle', source: 'transit-vehicles', minzoom: 7,
      paint: { 'circle-color': '#e45c37', 'circle-radius': 6, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
    },
    {
      id: 'transit-selected-route', type: 'line', source: 'transit-routes', minzoom: 0,
      filter: selectedFilter, paint: { 'line-color': '#e45c37', 'line-width': 7, 'line-opacity': 0.9 },
    },
    {
      id: 'transit-selected-stop', type: 'circle', source: 'transit-stops', minzoom: 0,
      filter: selectedFilter, paint: { 'circle-color': '#e45c37', 'circle-radius': 9, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
    },
    {
      id: 'transit-selected-vehicle', type: 'circle', source: 'transit-vehicles', minzoom: 0,
      filter: selectedFilter, paint: { 'circle-color': '#e45c37', 'circle-radius': 10, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 },
    },
  ]
}

export function buildStyle(mode: MapMode): StyleSpecification {
  const sources: StyleSpecification['sources'] = {
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: 'OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors',
    },
    hillshade: {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 13,
      attribution: 'Esri, USGS, NGA, NASA, CGIAR, NCEAS',
    },
    'user-location': {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    },
  }
  Object.entries(POLITICAL_SOURCES).forEach(([id, data]) => {
    sources[id] = { type: 'geojson', data, generateId: false }
  })
  sources['territory-labels'] = { type: 'geojson', data: '/data/atlas/territories/labels.geojson', generateId: false }

  const layers: LayerSpecification[] = [
    { id: 'background', type: 'background', paint: { 'background-color': mode === 'physical' ? '#eee9df' : '#e9e4da' } },
    ...(mode === 'physical'
      ? [
          { id: 'hillshade', type: 'raster', source: 'hillshade', paint: { 'raster-saturation': -0.55, 'raster-contrast': 0.08, 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.62, 13, 0.52, 16, 0.08] } } as LayerSpecification,
          { id: 'physical-base-landcover', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', minzoom: 7, paint: { 'fill-color': '#d8dfd1', 'fill-opacity': 0.2 } } as LayerSpecification,
          { id: 'physical-base-water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#bdd8de', 'fill-opacity': 0.9 } } as LayerSpecification,
          { id: 'physical-base-waterways', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway', minzoom: 7, paint: { 'line-color': '#7eafbb', 'line-width': 0.65, 'line-opacity': 0.6 } } as LayerSpecification,
          { id: 'physical-base-roads', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 10, filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']]], paint: { 'line-color': '#bbb3a8', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.35, 16, 1.1], 'line-opacity': 0.42 } } as LayerSpecification,
          { id: 'physical-base-buildings', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': '#cfc8bd', 'fill-opacity': 0.3 } } as LayerSpecification,
        ]
      : silentBaseLayers()),
  ]

  if (mode === 'political') layers.push(...politicalLayers())
  if (mode === 'physical') {
    sources['physical-europe'] = { type: 'geojson', data: '/data/atlas/physical/europe.geojson' }
    sources['physical-asturias'] = { type: 'geojson', data: '/data/atlas/physical/asturias.geojson' }
    sources['physical-europe-labels'] = { type: 'geojson', data: '/data/atlas/physical/labels-europe.geojson' }
    sources['physical-asturias-labels'] = { type: 'geojson', data: '/data/atlas/physical/labels-asturias.geojson' }
    layers.push(...contextTerritoryLayers(), ...physicalLayers())
  }
  if (mode === 'transit') {
    sources['transit-routes'] = { type: 'geojson', data: '/data/atlas/transit/routes.geojson' }
    sources['transit-stops'] = { type: 'geojson', data: '/data/atlas/transit/stops.geojson' }
    sources['transit-vehicles'] = { type: 'geojson', data: '/data/atlas/transit/vehicles.geojson' }
    layers.push(...contextTerritoryLayers(), ...transitLayers())
  }

  layers.push(
    {
      id: 'user-location-halo', type: 'circle', source: 'user-location',
      paint: { 'circle-color': '#168bd2', 'circle-radius': 13, 'circle-opacity': 0.2 },
    },
    {
      id: 'user-location-dot', type: 'circle', source: 'user-location',
      paint: { 'circle-color': '#168bd2', 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 },
    },
  )

  return { version: 8, name: `regionea-${mode}`, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', sources, layers }
}

export const POLITICAL_INTERACTIVE_LAYERS = POLITICAL_LEVEL_RANGES.flatMap(({ source }) => [`${source}-hit`, `${source}-labels`])
export const PHYSICAL_INTERACTIVE_LAYERS = [
  'physical-europe-rivers', 'physical-europe-lakes', 'physical-europe-ranges', 'physical-europe-valleys',
  'physical-europe-coasts', 'physical-europe-peaks', 'physical-europe-labels',
  'physical-rivers', 'physical-water', 'physical-protected', 'physical-peaks',
  'physical-river-labels', 'physical-point-labels', 'physical-area-labels',
]
export const TRANSIT_INTERACTIVE_LAYERS = ['transit-selected-route', 'transit-selected-stop', 'transit-selected-vehicle', 'transit-routes-line', 'transit-routes-overview', 'transit-stops-circle', 'transit-stops-labels', 'transit-vehicles-circle']
