import type { StyleSpecification } from 'maplibre-gl'

export function buildStyle(nutsUrl: string): StyleSpecification {
    return {
        version: 8,
        name: 'regionea-atlas',

        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',

        sources: {
            nuts: {
                type: 'vector',
                url: nutsUrl
            },
            // Base raster dev (opcional): quítalo cuando uses un basemap PMTiles
            osm: {
                type: 'raster',
                tiles: [
                    'https://cartodb-basemaps-a.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors © CARTO'
            }
        },
        layers: [
            { id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 22 },
            
            // NUTS3 → z 8–24
            // {
            //     id: 'nuts3-fill',
            //     type: 'fill',
            //     source: 'nuts',
            //     'source-layer': 'nuts',
            //     minzoom: 8, maxzoom: 24,
            //     filter: ['==', ['get', 'LEVL_CODE'], 3],
            //     paint: { 'fill-color': '#fca5a5', 'fill-opacity': 0.35 }
            // },
            {
                id: 'nuts3-outline',
                type: 'line',
                source: 'nuts',
                'source-layer': 'nuts',
                minzoom: 8, maxzoom: 24,
                filter: ['==', ['to-string', ['get', 'LEVL_CODE']], '3'],
                paint: { 'line-color': '#dc2626', 'line-width': 1.0 }
            },
            {
                id: 'nuts3-labels',
                type: 'symbol',
                source: 'nuts',
                'source-layer': 'nuts',
                minzoom: 8, maxzoom: 24,
                filter: ['==', ['to-string', ['get', 'LEVL_CODE']], '3'],
                layout: {
                    'text-field': ['coalesce', ['get', 'NAME_LATN'], ['get', 'NUTS_ID']],
                    'text-font': ['Noto Sans Regular'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 8, 12, 12, 16]
                },
                paint: { 'text-color': '#111827', 'text-halo-color': '#fff', 'text-halo-width': 1 }
            },

            // NUTS2 → z 6–7.99
            // {
            //     id: 'nuts2-fill',
            //     type: 'fill',
            //     source: 'nuts',
            //     'source-layer': 'nuts',
            //     minzoom: 6, maxzoom: 8,
            //     filter: ['==', ['get', 'LEVL_CODE'], 2],
            //     paint: { 'fill-color': '#86efac', 'fill-opacity': 0.35 }
            // },
            {
                id: 'nuts2-outline',
                type: 'line',
                source: 'nuts',
                'source-layer': 'nuts',
                minzoom: 6, maxzoom: 8,
                filter: ['==', ['to-string', ['get', 'LEVL_CODE']], '2'],
                paint: { 'line-color': '#16a34a', 'line-width': 0.9 }
            },
            {
                id: 'nuts2-labels',
                type: 'symbol',
                source: 'nuts',
                'source-layer': 'nuts',
                minzoom: 6, maxzoom: 8,
                filter: ['==', ['to-string', ['get', 'LEVL_CODE']], '2'],
                layout: {
                    'text-field': ['coalesce', ['get', 'NAME_LATN'], ['get', 'NUTS_ID']],
                    'text-font': ['Noto Sans Regular'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 8, 14]
                },
                paint: { 'text-color': '#111827', 'text-halo-color': '#fff', 'text-halo-width': 1 }
            },

            // NUTS1 → z 4–5.99
            // {
            //     id: 'nuts1-fill',
            //     type: 'fill',
            //     source: 'nuts',
            //     'source-layer': 'nuts',
            //     minzoom: 4, maxzoom: 6,
            //     filter: ['==', ['get', 'LEVL_CODE'], 1],
            //     paint: { 'fill-color': '#a5b4fc', 'fill-opacity': 0.35 }
            // },
            {
                id: 'nuts1-outline',
                type: 'line',
                source: 'nuts',
                'source-layer': 'nuts',
                minzoom: 4, maxzoom: 6,
                filter: ['==', ['to-string', ['get', 'LEVL_CODE']], '1'],
                paint: { 'line-color': '#4338ca', 'line-width': 0.8 }
            },
            {
                id: 'nuts1-labels',
                type: 'symbol',
                source: 'nuts',
                'source-layer': 'nuts',
                minzoom: 4, maxzoom: 6,
                filter: ['==', ['to-string', ['get', 'LEVL_CODE']], '1'],
                layout: {
                    'text-field': ['coalesce', ['get', 'NAME_LATN'], ['get', 'NUTS_ID']],
                    'text-font': ['Noto Sans Regular'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 6, 13]
                },
                paint: { 'text-color': '#111827', 'text-halo-color': '#fff', 'text-halo-width': 1 }
            },

            // NUTS0 (países) → visible en z 0–3.99
            // {
            //     id: 'nuts0-fill',
            //     type: 'fill',
            //     source: 'nuts',
            //     'source-layer': 'nuts',
            //     minzoom: 0, maxzoom: 4,
            //     filter: ['==', ['get', 'LEVL_CODE'], 0],
            //     paint: { 'fill-color': '#cbd5e1', 'fill-opacity': 0.4 }
            // },
            {
                id: 'nuts0-outline',
                type: 'line',
                source: 'nuts',
                'source-layer': 'nuts',
                minzoom: 0, maxzoom: 4,
                filter: ['==', ['to-string', ['get', 'LEVL_CODE']], '0'],
                paint: { 'line-color': '#334155', 'line-width': 0.6 }
            },
            {
                id: 'nuts0-labels',
                type: 'symbol',
                source: 'nuts',
                'source-layer': 'nuts',
                minzoom: 0, maxzoom: 4,
                filter: ['==', ['to-string', ['get', 'LEVL_CODE']], '0'],
                layout: {
                    'text-field': ['coalesce', ['get', 'NAME_LATN'], ['get', 'NUTS_ID']],
                    'text-font': ['Noto Sans Regular'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 2, 11, 4, 13]
                },
                paint: { 'text-color': '#111827', 'text-halo-color': '#fff', 'text-halo-width': 1 }
            },

        ]
    }
}