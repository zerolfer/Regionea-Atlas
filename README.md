# Regionea Atlas

Atlas cartográfico exploratorio de Asturias, con contexto de España y Europa. La aplicación ofrece tres lecturas coordinadas del territorio: político-territorial, física y de transporte público.

## Estado del producto

- Mapa político progresivo: países europeos, comunidades y provincias españolas, ocho comarcas funcionales, 78 concejos, 859 parroquias estadísticas y 56 barrios de Gijón y Oviedo.
- Atlas físico educativo: relieve, cordilleras, picos, hidrografía y espacios protegidos con filtros independientes.
- Transporte: CTA, ALSA y Renfe con importador GTFS, horarios reales normalizados y proxy de los tres canales GTFS-Realtime de Renfe.
- Buscador, ruta territorial, nivel automático o manual, fichas con procedencia, comparación de hasta tres territorios, geolocalización privada y URLs compartibles.
- Interfaz editorial responsive: panel lateral en escritorio y hoja inferior en móvil.
- PWA online-first: se precarga la interfaz, no las colecciones geográficas.

No se necesita ninguna clave en el navegador. MapLibre utiliza un fondo vectorial mudo de OpenFreeMap y todas las integraciones con credenciales se ejecutan en servidor.

## Stack

- React 19, TypeScript y Vite 7.
- MapLibre GL JS 6 con worker separado.
- GeoJSON WGS84 simplificado por escala y catálogo versionado.
- Funciones y tareas programadas de Vercel; Vercel Blob para originales GTFS privados.
- Vitest, Testing Library, ESLint y vite-plugin-pwa.

MapLibre 6 requiere WebGL2.

## Desarrollo local

Requisitos: Node.js 22 o posterior y npm.

```bash
npm ci
npm run data:sync
npm run dev
```

El snapshot de `public/data/atlas`, territorio, físico y transporte, se versiona con el repositorio. `data:sync` crea un transporte de demostración sólo cuando todavía no existe un GTFS importado y nunca sustituye un snapshot de transporte válido.

La aplicación queda disponible en `http://localhost:5173/mapa/politico`. Rutas principales:

- `/mapa/politico`
- `/mapa/fisico`
- `/mapa/transporte`

Control de calidad:

```bash
npm run lint
npm test
npm run build
```

Con Docker y [Task](https://taskfile.dev/):

```bash
task dev
task stop
task prod:build
task prod:serve
```

## Datos territoriales y físicos

El snapshot desplegable se encuentra en `public/data/atlas`. Para regenerarlo en local desde las fuentes oficiales:

```bash
npm run data:sync
```

El proceso descarga, normaliza a los contratos internos, simplifica, calcula superficies y cajas geográficas, incorpora licencia, fuente y rango de zoom por colección, verifica checksums y publica al final un `manifest.json` atómico. Las fuentes principales son Natural Earth, IGN/CNIG y SITPA/SADEI. El contenido editorial vive en Markdown bajo `content/territories` y puede regenerarse por separado:

```bash
npm run data:content
```

Las parroquias se presentan expresamente como delimitaciones estadísticas, no como deslindes jurídicos.

Los barrios de Gijón y Oviedo proceden de la capa poligonal específica que SADEI publica para las principales áreas urbanas de Asturias. Se muestran como delimitaciones estadísticas y no como deslindes jurídicos. La atribución enlaza el catálogo y el aviso legal de SADEI; el pipeline no utiliza el antiguo WFS municipal ni reconstruye polígonos a partir de puntos.

## Transporte

El importador acepta uno o varios ZIP GTFS descargados del NAP:

```bash
npm run data:import-gtfs -- --feed cta=/ruta/cta.zip --feed alsa=/ruta/alsa.zip --feed renfe=/ruta/renfe.zip
```

Los identificadores se conservan con espacio de nombres por proveedor. Las salidas programadas quedan en `public/data/atlas/transit`; el tiempo real se expone mediante:

- `GET /api/transporte/renfe/realtime`
- `GET /api/transporte/paradas/:id/salidas`

Los tres endpoints públicos de Renfe (`alerts`, `trip_updates` y `vehicle_positions`) se utilizan de forma predeterminada, sin clave del navegador. Variables de servidor opcionales:

- `RENFE_GTFS_RT_ALERTS_URL`, `RENFE_GTFS_RT_TRIP_UPDATES_URL`, `RENFE_GTFS_RT_VEHICLE_POSITIONS_URL`
- `RENFE_GTFS_RT_URL` (compatibilidad con un feed combinado alternativo)
- `RENFE_GTFS_RT_TOKEN` (solo si un endpoint alternativo lo exige)
- `NAP_API_TOKEN` (opcional, según la fuente)
- `CTA_GTFS_URL`, `ALSA_GTFS_URL`, `RENFE_GTFS_URL`
- `BLOB_READ_WRITE_TOKEN`
- `CRON_SECRET`

Si el tiempo real falla, la respuesta conserva el último valor válido en memoria y lo marca como `stale`; el horario estático continúa disponible. El importador procesa feeds grandes por filas, admite horas posteriores a las 24:00, deduplica salidas, aplica `calendar.txt` y `calendar_dates.txt`, fragmenta las próximas salidas por parada y marca como desactualizado un feed cuya vigencia haya terminado.

## Estructura

```text
api/                         Funciones serverless y tarea programada
content/territories/         Contenido editorial en Markdown
public/data/atlas/           Snapshot generado consumido por el cliente
scripts/
├─ sync-atlas-data.mjs       Pipeline territorial y físico
├─ build-content.mjs         Compilación de contenido editorial
└─ import-gtfs.mjs           Normalización GTFS
src/
├─ components/               Navegación, búsqueda, fichas y comparación
├─ data/atlas.ts             Cliente y búsqueda del catálogo
├─ map/                      Estilo, interacción y estado de MapLibre
├─ App.tsx                   Estado compartible y composición responsive
└─ types.ts                  Contratos internos
```

Los originales descargados en `data/` se excluyen de Git. El snapshot de `public/data/atlas` viaja con el repositorio: el build de Vercel no consigue conectar con `sig.asturias.es`.
