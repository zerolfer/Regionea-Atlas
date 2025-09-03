Paso a paso para que tu PWA (Vite + vite-pwa) descargue capas offline de forma eficiente, usando 1 .pmtiles por capa (para render) o 1–2 .fgb por ámbito/zoom (para features completas), y guardándolas en IndexedDB / OPFS.

Opción A — PMTiles (vector tiles MVT) para renderizar mapas

La mejor relación tamaño/escala y descarga progresiva. Ideal para navegar y ver el mapa suave incluso sin conexión.

0) Preparar los datos (build)

Genera tiles a varios niveles con tippecanoe:

tippecanoe -o regiones.mbtiles \
  --name="Regionea Atlas" \
  --no-feature-limit --no-tile-size-limit \
  --force --detect-shared-borders \
  --drop-densest-as-needed \
  -zg regiones.geojson


Convierte a PMTiles:

pmtiles convert regiones.mbtiles regiones.pmtiles


(Usa la CLI de PMTiles de Protomaps.)

1) Publicar el .pmtiles

Colócalo como estático (ej. /public/data/regiones.pmtiles) o en un bucket/CDN.

Caché HTTP (opcional pero recomendado):

Cache-Control: public, max-age=31536000, immutable

2) Cargar en el mapa (online y offline)

Con MapLibre + @protomaps/pmtiles:

import maplibregl from 'maplibre-gl'
import { PMTiles, Protocol } from '@protomaps/pmtiles'

// registra el protocolo pmtiles:// una sola vez
const protocol = new Protocol()
;(maplibregl as any).addProtocol?.('pmtiles', protocol.tile)

// url remota o local (ver más abajo el caso offline warmup)
const url = 'https://tu-dominio/data/regiones.pmtiles'
const p = new PMTiles(url)
protocol.add(p)

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      regiones: {
        type: 'vector',
        url: `pmtiles://${url}` // ← importante
      }
    },
    layers: [
      // ...tus capas vector
    ]
  }
})

3) Descarga offline “de verdad” (calentando el archivo completo)

Tienes dos buenas estrategias:

A) Service Worker + Cache Storage con soporte de Range requests (sencillo y robusto)

Ventaja: mantienes la misma URL https://.../regiones.pmtiles.

El SW sirve el archivo desde caché (incluyendo peticiones parciales con Range que usa PMTiles).

Service worker (vite-pwa / Workbox):

// sw.ts o el entry del SW que usa vite-pwa
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { RangeRequestsPlugin } from 'workbox-range-requests'

// cachea PMTiles y FGB con soporte de Range
registerRoute(
  ({url}) => url.pathname.endsWith('.pmtiles') || url.pathname.endsWith('.fgb'),
  new CacheFirst({
    cacheName: 'geo-bundles',
    plugins: [new RangeRequestsPlugin()],
  })
)


En la app (botón “Descargar offline”):

async function precachePMTiles() {
  const cache = await caches.open('geo-bundles')
  // descarga el archivo completo a la Cache Storage del SW
  await cache.add('/data/regiones.pmtiles')
  // opcional: verifica tamaño
  const resp = await cache.match('/data/regiones.pmtiles')
  console.log('PMTiles offline listo:', resp?.headers.get('content-length'))
}


Con esto, cuando el mapa pida pmtiles://https://.../regiones.pmtiles, el navegador lo servirá desde Cache Storage incluso sin red, y RangeRequestsPlugin responderá trozos parciales sin problemas.

B) OPFS (Origin Private File System) con descarga streaming y progreso (para ficheros grandes)

Ventaja: excelente para archivos grandes (cientos de MB) y control fino de progreso.

Requiere usar File System Access API (compatible en Chromium y Safari modernos; fallback a IndexedDB si no).

Descargar a OPFS con progreso:

async function downloadToOPFS(url: string, filename: string, onProgress?: (pct:number)=>void) {
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(filename, { create: true })
  const writable = await handle.createWritable()

  const resp = await fetch(url)
  if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)
  const total = Number(resp.headers.get('content-length') ?? 0)
  let loaded = 0

  const reader = resp.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    await writable.write(value)
    loaded += value.byteLength
    if (total && onProgress) onProgress(Math.round((loaded / total) * 100))
  }
  await writable.close()
  return handle
}


Usar el .pmtiles local en MapLibre/PMTiles:

import { PMTiles, Protocol } from '@protomaps/pmtiles'

async function useLocalPMTiles(filename: string) {
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(filename)
  const file = await handle.getFile()
  const url = URL.createObjectURL(file)

  // La librería PMTiles acepta URL de blob sin problema
  const protocol = new Protocol()
  ;(maplibregl as any).addProtocol?.('pmtiles', protocol.tile)
  const p = new PMTiles(url)
  protocol.add(p)

  map.setStyle({
    version: 8,
    sources: {
      regiones: { type: 'vector', url: `pmtiles://${url}` }
    },
    layers: [ /* ... */ ]
  })
}


Si prefieres no cambiar el style, mantén la URL remota y que el SW responda desde Cache Storage: es más transparente.

4) Versionado y actualizaciones

Guarda en IndexedDB (p. ej. con idb-keyval) un pequeño registro:

type OfflineItem = {
  id: 'regiones.pmtiles',
  version: '2025-09-01',
  size: number,
  etag?: string,
  storedAt: number
}


Compara version/etag con un manifest ligero en tu servidor: si cambia, vuelve a descargar.

Muestra al usuario “Actualizar datos offline (25 MB)”.

Opción B — FlatGeobuf (.fgb) para descargar features completas

Cuando el usuario necesita geometría exacta (análisis, selección, exportación), guarda la capa como .fgb.

0) Preparar los datos (build)

Con GDAL:

ogr2ogr -f FlatGeobuf regiones.fgb regiones.gpkg \
  -lco SPATIAL_INDEX=YES -progress


FlatGeobuf es binario, indexado, rápido y compacto.

Si tienes varias escalas (ej. global vs. país), crea 1–2 ficheros (global y por-país/continente).

1) Cargar en el cliente (streaming y filtros espaciales)
import * as fgb from 'flatgeobuf/lib/mjs'

async function* readFGB(urlOrBlob: string | Blob, bbox?: [number,number,number,number]) {
  const src = typeof urlOrBlob === 'string' ? urlOrBlob : URL.createObjectURL(urlOrBlob)
  for await (const feature of fgb.deserialize(src, bbox)) {
    yield feature // GeoJSON Feature
  }
}


Online: readFGB('/data/regiones.fgb', bbox) hará HTTP range requests y traerá solo lo necesario.

Offline: descarga el .fgb completo (Cache/OPFS) y pásalo como Blob.

2) Descarga offline
Con Service Worker + Range (rápido de integrar)

Misma regla que en PMTiles (ver SW arriba). Luego:

const cache = await caches.open('geo-bundles')
await cache.add('/data/regiones.fgb') // archivo completo

Con OPFS (con progreso)

Reutiliza downloadToOPFS de arriba:

const handle = await downloadToOPFS('/data/regiones.fgb','regiones.fgb', pct => showProgress(pct))
const file = await (await handle.getFile())
for await (const feat of readFGB(file)) {
  // …añade a una capa vectorial de tu mapa o a tu store
}


Truco: si solo necesitas un subconjunto espacial para offline, crea y publica recortes (regiones_es.fgb, regiones_eu.fgb) y descarga únicamente los que el usuario elija.

¿IndexedDB o OPFS?

OPFS (Origin Private File System): ideal para archivos grandes (decenas/centenas de MB), lectura/escritura tipo fichero, buen rendimiento.

IndexedDB (idb-keyval): sencillo para metadatos y blobs medianos; más interoperable, pero puede fragmentar grandes blobs.

Estrategia recomendada:

Ficheros grandes (.pmtiles, .fgb) → OPFS o Cache Storage (con SW + Range).

Manifest/estado (qué tengo, versión, tamaño) → IndexedDB.

Gestión de espacio, cuotas y UX

Pide confirmación clara con el tamaño antes de descargar (muestra content-length si está disponible).

Usa navigator.storage.estimate() para comprobar cuota y espacio libre.

Botones:

“Descargar mapa offline (X MB)”

“Actualizar datos offline”

“Liberar espacio” (borrar de Cache Storage/OPFS).

Cuotas: PWA instalada suele tener más margen; modo incógnito es muy limitado.

Ejemplo rápido de control de espacio:

const { quota, usage } = await navigator.storage.estimate()
const free = (quota ?? 0) - (usage ?? 0)
if (free < bytesNecesarios) {
  // informa al usuario
}

Estrategia de cache del SW (vite-pwa)

En tu vite.config.ts:

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    // precache de lo mínimo (app shell)
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    // runtime cache: PMTiles + FGB con Range
    runtimeCaching: [
      {
        urlPattern: ({url}) => url.pathname.endsWith('.pmtiles') || url.pathname.endsWith('.fgb'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'geo-bundles',
          plugins: [
            // en SW real importas RangeRequestsPlugin, aquí Workbox lo empaqueta
          ]
        }
      }
    ]
  }
})


Nota: si activas protecciones/middleware, excluye estos assets (como ya comentamos) para evitar 401.

¿Cuándo usar cada formato?

Quiero el mapa fluido y pequeño → PMTiles.

Quiero la geometría exacta para análisis/export → FlatGeobuf.

Ambos: render con PMTiles, y cuando el usuario entra en “modo análisis”, descarga el FGb del área elegida.

Checklist final

Genera y publica *.pmtiles y/o *.fgb con índice.

Configura SW con CacheFirst + RangeRequests.

Implementa botones de descarga offline (Cache.add u OPFS streaming con progreso).

Mantén manifest de versiones en IndexedDB para actualizar.

Excluye assets PWA/geo de cualquier middleware que exija auth.

Si quieres, te preparo un módulo offlineData.ts listo para pegar (con: estimación de espacio, descarga a Cache/OPFS, progreso, registro en IndexedDB y “switch” automático a offline). Sólo dime si usarás MapLibre u otra lib, y si alojas en /public o en CDN.