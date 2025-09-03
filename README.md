Regionea Atlas es un visor geográfico multiplataforma que permite explorar las divisiones territoriales y temáticas desde lo global hasta lo local, con capas políticas, de relieve, transportes y puntos de interés.


# Objetivo de esta primera iteración

Arrancar un **MVP 100 % cliente (sin servidor)** que cargue:

- Un mapa base.  
- Una capa **NUTS Europa (0–3)** desde **PMTiles**. 
- Un **selector de modo** (Político / Relieve / Transportes — de momento solo Político activo).
- Un **selector de granularidad** guiado por zoom (NUTS0→1→2→3) + breadcrumb de navegación.
    

Luego, en iteración 2, añadimos **España CCAA/Provincias/Municipios** (PMTiles). En iteración 3, **barrios** (Asturias) y un **overlay temático Berlín (Muro)** como ejemplo.

---

# 1) Stack y scaffolding

**Stack**: React + Vite + TypeScript + MapLibre GL JS + PMTiles + PWA (vite-plugin-pwa)

### Comandos de arranque

```bash
# 1) Crear proyecto
npm create vite@latest geo-mvp -- --template react-ts
cd geo-mvp

# 2) Dependencias
npm i maplibre-gl pmtiles
npm i -D vite-plugin-pwa

# 3) (Opcional dev) tipos
npm i -D @types/geojson
```

---

# 2) Estructura de carpetas propuesta

```
geo-mvp/
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
├─ public/
│  └─ icons PWA, manifest etc.
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ styles.css
│  ├─ components/
│  │  ├─ ModeSwitch.tsx
│  │  └─ GranularityDial.tsx
│  ├─ map/
│  │  ├─ MapView.tsx
│  │  ├─ pmtiles.ts (helper de protocolo)
│  │  └─ style.ts (estilo base + capas)
│  └─ config/
│     └─ registry.ts (registro de capas y reglas por zoom/bbox)
└─ data/
   └─ nuts_eu.pmtiles   (colócalo aquí para dev)
```

---

# 3) Archivos clave (contenido mínimo)

## vite.config.ts (PWA + TS path opcional)

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Geo MVP',
        short_name: 'GeoMVP',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0ea5e9',
        icons: [
          { src: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
```

## tsconfig.json (sencillo)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

## index.html (contenedor del mapa)

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Geo MVP</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## src/styles.css

```css
html, body, #root { height: 100%; margin: 0; }
#map { position: absolute; inset: 0; }
.ui { position: absolute; top: 12px; left: 12px; z-index: 10; }
.card { background: rgba(255,255,255,.9); padding: 8px 12px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.row { display:flex; gap:8px; align-items:center; }
button { padding: 6px 10px; border-radius: 8px; border: 1px solid #e5e7eb; background:#fff; cursor:pointer; }
button.active { background:#0ea5e9; color:#fff; border-color:#0ea5e9; }
```

## src/main.tsx

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

## src/App.tsx (UI: modo + granularidad)

```tsx
import { useState } from 'react'
import MapView from './map/MapView'
import ModeSwitch from './components/ModeSwitch'
import GranularityDial from './components/GranularityDial'

export type Mode = 'politico' | 'relieve' | 'transportes'

export default function App(){
  const [mode, setMode] = useState<Mode>('politico')
  const [granularity, setGranularity] = useState<'auto'|'nuts0'|'nuts1'|'nuts2'|'nuts3'>('auto')

  return (
    <>
      <div className="ui card">
        <div className="row" style={{marginBottom:8}}>
          <ModeSwitch value={mode} onChange={setMode} />
        </div>
        {mode==='politico' && (
          <GranularityDial value={granularity} onChange={setGranularity} />
        )}
      </div>
      <MapView mode={mode} granularity={granularity} />
    </>
  )
}
```

## src/components/ModeSwitch.tsx

```tsx
import { Mode } from '../App'

export default function ModeSwitch({value,onChange}:{value:Mode,onChange:(m:Mode)=>void}){
  const modes: Mode[] = ['politico','relieve','transportes']
  return (
    <div className="row">
      {modes.map(m=> (
        <button key={m} className={value===m? 'active':''} onClick={()=>onChange(m)}>
          {m}
        </button>
      ))}
    </div>
  )
}
```

## src/components/GranularityDial.tsx

```tsx
const options = [
  {id:'auto', label:'Auto'},
  {id:'nuts0', label:'NUTS0'},
  {id:'nuts1', label:'NUTS1'},
  {id:'nuts2', label:'NUTS2'},
  {id:'nuts3', label:'NUTS3'},
] as const

type V = typeof options[number]['id']

export default function GranularityDial({value,onChange}:{value:V,onChange:(v:V)=>void}){
  return (
    <div className="row">
      {options.map(o=> (
        <button key={o.id} className={value===o.id? 'active':''} onClick={()=>onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
```

## src/map/pmtiles.ts (protocolo PMTiles)

```ts
import * as pmtiles from 'pmtiles'

// Registrar protocolo pmtiles:// para MapLibre
export function registerPMTilesProtocol(){
  const protocol = new pmtiles.Protocol()
  // @ts-expect-error - MapLibre expone addProtocol en runtime
  maplibregl.addProtocol('pmtiles', protocol.tile)
}
```

## src/map/style.ts (estilo base + capas NUTS)

```ts
import type { StyleSpecification } from 'maplibre-gl'

export function buildStyle(nutsUrl: string): StyleSpecification {
  return {
    version: 8,
    name: 'geo-mvp',
    sources: {
      nuts: {
        type: 'vector',
        url: nutsUrl // e.g. 'pmtiles://data/nuts_eu.pmtiles'
      },
      // Base raster dev (opcional): quítalo cuando uses un basemap PMTiles
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap'
      }
    },
    layers: [
      { id:'osm', type:'raster', source:'osm', minzoom:0, maxzoom:22 },
      // Relleno
      {
        id: 'nuts-fill',
        type: 'fill',
        source: 'nuts',
        'source-layer': 'nuts', // asegúrate de usar el nombre de capa MVT que generas
        paint: {
          'fill-color': '#81d4fa',
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            2, 0.2,
            6, 0.3
          ]
        }
      },
      // Borde
      {
        id: 'nuts-outline',
        type: 'line',
        source: 'nuts',
        'source-layer': 'nuts',
        paint: {
          'line-color': '#0284c7',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            2, 0.4,
            8, 1.2
          ]
        }
      },
      // Etiquetas
      {
        id: 'nuts-label',
        type: 'symbol',
        source: 'nuts',
        'source-layer': 'nuts_labels', // si generas una capa de centroides
        layout: {
          'text-field': ['get','name'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'], 2, 10, 8, 14
          ],
          'text-allow-overlap': false
        },
        paint: { 'text-color': '#0f172a', 'text-halo-color':'#fff', 'text-halo-width':1 }
      }
    ]
  }
}
```

## src/map/MapView.tsx (monta MapLibre + PMTiles + lógica zoom)

```tsx
import { useEffect, useRef } from 'react'
import maplibregl, { Map } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { registerPMTilesProtocol } from './pmtiles'
import { buildStyle } from './style'
import type { Mode } from '../App'

export default function MapView({mode, granularity}:{mode:Mode, granularity:'auto'|'nuts0'|'nuts1'|'nuts2'|'nuts3'}){
  const mapRef = useRef<Map|null>(null)

  useEffect(()=>{
    // Registrar protocolo pmtiles una sola vez
    // @ts-ignore
    if(!(maplibregl as any)._pmtilesRegistered){
      registerPMTilesProtocol()
      // @ts-ignore
      ;(maplibregl as any)._pmtilesRegistered = true
    }

    const nutsUrl = 'pmtiles://data/nuts_eu.pmtiles' // ⚠️ coloca el archivo en /public/data o ajusta ruta

    const map = new maplibregl.Map({
      container: 'map',
      style: buildStyle(nutsUrl),
      center: [10, 50],
      zoom: 3,
      hash: true,
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl({showCompass:false}), 'top-right')

    map.on('load', ()=>{
      // Reglas mínimas de granularidad por zoom (demo); en la iteración 2 lo ligamos a registry.ts
      function applyVisibility(){
        const z = map.getZoom()
        const target = granularity === 'auto'
          ? (z<4? 'nuts0' : z<6? 'nuts1' : z<8? 'nuts2' : 'nuts3')
          : granularity
        // En un estilo real, separarías NUTS por capa; aquí simplificado
        map.setPaintProperty('nuts-fill', 'fill-opacity', target==='nuts0' ? 0.2 : 0.3)
      }
      applyVisibility()
      map.on('zoomend', applyVisibility)
    })

    return ()=>{ map.remove() }
  }, [granularity, mode])

  return <div id="map" />
}
```

## src/config/registry.ts (placeholder para la iteración 2)

```ts
export type LayerEntry = {
  id: string
  granularity: 'nuts0'|'nuts1'|'nuts2'|'nuts3'|'ccaa'|'prov'|'muni'|'barrio'|'seccion'|'custom'
  bbox: [number,number,number,number] // [minLon,minLat,maxLon,maxLat]
  pmtiles: string
  minzoom: number
  maxzoom: number
  locale?: string
  tags?: Record<string,string>
}

export const LAYERS: LayerEntry[] = [
  { id:'eu-nuts', granularity:'nuts0', bbox:[-31,27,40,72], pmtiles:'/data/nuts_eu.pmtiles', minzoom:2, maxzoom:9 }
]
```

---

# 4) Generar `nuts_eu.pmtiles` (datos reales)

### 4.1 Descargar NUTS (Eurostat GISCO)

* Descarga el shapefile/GeoPackage de **NUTS 2024** (niveles 0–3). (En producción, documentaremos la URL exacta y licencia.)
* Unifica a **EPSG:4326** o **3857** según prefieras para preproceso (Tippecanoe espera 4326 en GeoJSON).

Fuentes: https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics

### 4.2 Preprocesar y crear centroides de etiquetas

```bash
# Convertir a GeoJSON (ejemplo con ogr2ogr)
ogr2ogr -f GeoJSON nuts.geojson NUTS_RG_01M_2024_4326.gpkg NUTS_RG_01M_2024_4326_LEVL_0
ogr2ogr -f GeoJSON -append nuts.geojson NUTS_RG_01M_2024_4326.gpkg NUTS_RG_01M_2024_4326_LEVL_1
ogr2ogr -f GeoJSON -append nuts.geojson NUTS_RG_01M_2024_4326.gpkg NUTS_RG_01M_2024_4326_LEVL_2
ogr2ogr -f GeoJSON -append nuts.geojson NUTS_RG_01M_2024_4326.gpkg NUTS_RG_01M_2024_4326_LEVL_3

# (Opcional) generar centroides/point-on-surface para etiquetas
# Puedes usar tippecanoe-enrich u otro script; para empezar, omite y etiqueta por polígonos grandes
```

### 4.3 Generar tiles con Tippecanoe → PMTiles

```bash
# Crear vector tiles (capa "nuts")
tippecanoe -o nuts_eu.pmtiles \
  -Z2 -z9 \
  --drop-densest-as-needed \
  --coalesce --reorder --detect-shared-borders \
  --layer=nuts \
  --include NAME_LATN --include NUTS_ID \
  nuts.geojson
```

Copia `nuts_eu.pmtiles` a `public/data/` o sírvelo desde CDN. En `MapView.tsx` deja `pmtiles://data/nuts_eu.pmtiles`.

---

# 5) Navegación “drill-down” (iteración 2)

- **Breadcrumb**: guarda el `feature` seleccionado en cada nivel y haz `fitBounds` al bbox del siguiente.
    
- **Click handler**: al clicar un polígono, determina su nivel (campo `LEVL_CODE`/`NUTS_ID`) y activa `granularity` siguiente.
    
- **Registry**: al entrar en el bbox de un país/ciudad, monta/desmonta tilesets (España admin; Berlín submunicipal; etc.).
    

Pseudo:

```ts
map.on('click','nuts-fill', (e)=>{
  const f = e.features?.[0]
  if(!f) return
  // guardar breadcrumb
  // calcular bbox del feature (si el tile trae geometry simplificada, pide bbox precomputado)
  // fitBounds y setGranularity(siguienteNivel)
})
```

---

# 6) Búsqueda (iteración 2)

- **Nominatim** (uso ligero). Al seleccionar resultado, `flyTo` y activar tilesets relevantes.
    

---

# 7) Aceptación de esta iteración

- Arranca la app, se ve el mapa y al cambiar el dial **NUTS0/1/2/3** se ajusta la visibilidad.
    
- El **PMTiles** de NUTS carga correctamente desde `/data/nuts_eu.pmtiles`.
    
- PWA instalable en escritorio/móvil.
    

---

# 8) Próximos pasos (tras verificar)

1. Añadir **España admin** (CCAA/Provincias/Municipios) como `es_admin.pmtiles` y reglas por zoom.
2. Implementar **breadcrumb** y click para drill-down.
3. Registrar **ciudades Asturias** con submunicipal (barrios) y preparar `*_submun.pmtiles`.
4. Overlay temático: **Berlín — Muro** (línea + POIs) como `berlin_wall.pmtiles`.
5. Selector de idioma de topónimos (cuando usemos basemap vectorial o etiquetado propio).

---

# 9) Docker + Taskfile — Scaffolding

Además del código, hemos preparado un entorno de desarrollo y build reproducible usando **Docker** y **go-task**:

* **Servicios definidos en `docker-compose.yml`:**

  * `web`: entorno de desarrollo (Vite dev server en `:5173`).
  * `prod`: build de producción servido con Nginx en `:8080`.
  * `tiles`: contenedor con `tippecanoe` y `pmtiles` para generar tiles sin instalar nada localmente.

* **Tareas en `Taskfile.yml`:**

  * `task dev`: arranca el contenedor `web` y expone la app en `http://localhost:5173`.
  * `task build` + `task serve:prod`: construyen y sirven el bundle en `http://localhost:8080`.
  * `task tiles:nuts`: genera `public/data/nuts_eu.pmtiles` a partir de `data/nuts.geojson` usando tippecanoe.
  * `task tiles:inspect`: muestra metadatos de un `.pmtiles`.
  * `task tiles:serve`: lanza un mini-servidor para servir un `.pmtiles` en `:8081`.

**¿Por qué esta separación?**

* Evitamos instalar toolchains GIS en tu máquina (todo vive en Docker).
* Cada tarea es reproducible, basta con `task nombre`.
* Se pueden añadir tareas análogas (`tiles:es_admin`, `tiles:berlin_wall`) para otras capas.

---

# 10) Notas

* GeoJSON directo es viable solo para datasets pequeños. PMTiles es más eficiente porque divide por zoom y región y el cliente solo descarga lo que ve.
* Los parámetros `-Z` y `-z` de tippecanoe definen el rango de zoom al que se generan tiles: simplificación en bajos, detalle en altos.
* Taskfile permite automatizar generación por capa; más adelante se puede escalar con un `config.yml` único para definir todas las capas.
