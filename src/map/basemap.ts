import type { StyleSpecification } from 'maplibre-gl'

// Public WMTS: no account/key. Stay inside the advertised tile matrix limits.
// NASA stays underneath: transparent ocean/no-data tiles and outages expose it.
export const SATELLITE_SOURCES: StyleSpecification['sources'] = {
  'satellite-overview': {
    type: 'raster', tileSize: 256, maxzoom: 5,
    tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],
    attribution: '<a href="https://www.earthdata.nasa.gov/data/tools/gibs" target="_blank" rel="noreferrer">NASA GIBS · Blue Marble (2004)</a>',
  },
  'satellite-detail': {
    type: 'raster', tileSize: 256, minzoom: 6, maxzoom: 14, bounds: [-180, -60, 180, 83],
    tiles: ['https://wmts.terrascope.be/?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=esa-worldcover-s2rgbnir-10m-2021-v2_tcc&STYLE=default&FORMAT=image/png&TILEMATRIXSET=EPSG:3857&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&TIME=2021-01-01'],
    attribution: '© <a href="https://esa-worldcover.org/en/data-access" target="_blank" rel="noreferrer">ESA WorldCover project 2021</a> / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · Terrascope',
  },
}
