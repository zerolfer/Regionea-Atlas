import type { StyleSpecification } from 'maplibre-gl'

// Public WMTS/WMS: no account/key. Stay inside each provider's coverage limits.
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
  ...Object.fromEntries([
    ['mainland', [-9.5, 35.5, 4.5, 44]],
    ['canaries', [-18.5, 27.5, -13, 29.5]],
  ].map(([region, bounds]) => [`satellite-pnoa-${region}`, {
    type: 'raster', tileSize: 256, minzoom: 12, maxzoom: 19, bounds,
    // WMTS returns opaque no-data tiles even in PNG. WMS with explicit
    // transparency was pixel-checked: no-data alpha=0, world remains beneath.
    tiles: ['https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=OI.OrthoimageCoverage&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'],
    attribution: '© <a href="https://pnoa.ign.es/pnoa-imagen/ortofotos-pnoa-maxima-actualidad" target="_blank" rel="noreferrer">IGN · PNOA Máxima Actualidad</a> · fechas según zona · <a href="https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf" target="_blank" rel="noreferrer">CC BY 4.0</a> · Melilla: Pléiades Neo © Airbus DS (2022)',
  }])) as StyleSpecification['sources'],
}
