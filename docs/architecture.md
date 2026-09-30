# Arquitectura y alcance

## Propósito

Regionea Atlas es un atlas cartográfico exploratorio para público general. Coordina tres lecturas sobre un mismo mapa:

- político-territorial: Europa como contexto, España como nivel intermedio y Asturias como primera cobertura detallada;
- física: elementos europeos de contexto y detalle físico asturiano;
- transporte público: horarios programados de CTA, ALSA y Renfe, más GTFS-Realtime de Renfe.

No incluye cuentas, favoritos sincronizados, navegación puerta a puerta ni cartografía completamente offline. La geolocalización se solicita al navegador, se mantiene en memoria y no se incorpora a la URL ni a los datos analíticos de la aplicación.

La arquitectura está preparada para nuevas coberturas, pero el pipeline territorial/físico actual contiene adaptadores concretos para Natural Earth, IGN, SITPA y SADEI. Añadir otro territorio exige implementar sus adaptadores; no basta con cambiar una caja geográfica.

## Flujo de ejecución

```text
fuentes oficiales ──> scripts de importación ──> public/data/atlas
                                                   │
Markdown editorial ──> build-content.mjs ──────────┤
                                                   ▼
navegador ──> React/App ──> catálogo + GeoJSON ──> MapLibre
    │                           │
    └── URL compartible         └── funciones /api para salidas y tiempo real

cron Vercel ──> descarga ZIP GTFS privado a Blob
```

El cliente no consulta directamente las fuentes administrativas ni usa claves. Consume el snapshot versionado en `public/data/atlas`. MapLibre solicita además teselas y fuentes tipográficas a OpenFreeMap y elevación Terrarium de Mapzen en AWS Open Data.

## Frontend

`src/App.tsx` compone la aplicación y mantiene:

- modo, selección, comparación y filtros;
- cámara sincronizada con la URL;
- catálogo de búsqueda;
- geolocalización en memoria;
- panel lateral de escritorio y hoja inferior móvil;
- refresco de salidas de una parada.

`src/map/MapView.tsx` encapsula MapLibre, eventos de mapa, selección, encuadre, posición del usuario y sondeo de vehículos cada 30 segundos. El componente se carga con `React.lazy`, separando MapLibre del paquete inicial.

Las actualizaciones de capas esperan `style.load`, no `isStyleLoaded()` (que también depende de teselas aún en descarga). `SelectionFocusController` conserva y consume una vez cada petición explícita de navegación del buscador o de una ficha; un clic en el mapa o una apertura del panel no reencuadran. Si el estilo cambia o el catálogo aún no ha resuelto la entidad, la petición queda pendiente. El encuadre usa el padding responsive del mapa más un pequeño margen; `fitBounds` de MapLibre suma ese margen al padding existente, no hay que duplicar el tamaño del panel.

`src/map/style.ts` es el contrato visual de escalas. Declara fuentes, capas, rangos de zoom e interacción. Las escalas políticas progresan de países a barrios. En transporte, cada ruta utiliza su clase de extensión importada; las paradas aparecen desde zoom 10 y sus etiquetas desde zoom 12.

`src/data/atlas.ts` carga manifiesto, catálogo y contenido editorial. `src/data/transit.ts` carga rutas y paradas, comprueba la versión de clasificación y construye el índice de búsqueda.

No hay gestor global de estado ni router externo. El path y `history.pushState`/`replaceState` son gestionados por `App.tsx` y `src/url-state.ts`.

## Modos del mapa

### Político

Las colecciones son GeoJSON independientes: países, comunidades autónomas, provincias, comarcas funcionales, concejos, parroquias y barrios. El nivel puede ser automático por zoom o forzado. Cuando coinciden varias geometrías, el mapa muestra un selector contextual.

Las relaciones de ascendencia se recorren con `parentId`. El comparador admite hasta tres territorios y muestra solo métricas comunes.

### Físico

Hay una colección de contexto europeo, una de detalle asturiano y una de superficies costeras españolas, además de colecciones derivadas de etiquetas. Los filtros de contenido son relieve, picos, hidrografía, valles, costa y espacios protegidos. La hipsometría y el terreno 3D son visualizaciones opcionales, desactivadas por defecto y persistidas en la URL. Sombreado, hipsometría y terreno usan instancias DEM separadas para evitar degradar el renderizado.

`scripts/sync-physical-coast.mjs` enriquece el detalle con rías, islas, cabos, bahías y playas oficiales de SITPA. Los símbolos costeros aparecen progresivamente para no saturar escalas regionales.

`scripts/sync-physical-areas.mjs` incorpora superficies de masas de agua MITECO y unidades deltaicas del Ebro del ICGC. Golfos, bahías, rías y deltas se seleccionan como áreas, no mediante marcadores puntuales. El refinado vincula topónimos/ejes antiguos a superficies canónicas cuando hay una coincidencia inequívoca, conserva sus URLs y deduplica búsqueda y etiquetas. Las fichas distinguen la fecha de fuente y el alcance del polígono; consulte los contratos y la guía de ampliación antes de incorporar otra colección.

La relación entre una sierra seleccionada y sus picos se calcula actualmente en el cliente por proximidad al centro, no mediante una relación persistida. Es una heurística de interfaz y no un vínculo de datos normativo.

### Transporte

El snapshot contiene rutas, paradas, calendarios y salidas por parada. Los filtros actúan por proveedor, medio y visibilidad del tiempo real. Una selección atenúa el resto de la red.

El endpoint de salidas combina el calendario estático con actualizaciones GTFS-Realtime de Renfe cuando puede relacionarlas. Si la API falla, el cliente intenta cargar el JSON estático de la parada.

## API serverless

- `GET /api/transporte/renfe/realtime`: normaliza alertas, posiciones y actualizaciones; usa caché de proceso de 15 segundos y cabecera CDN `s-maxage=15`.
- `GET /api/transporte/paradas/:id/salidas`: calcula próximas salidas con zona `Europe/Madrid`, aplica excepciones de calendario y retrasos Renfe; usa `s-maxage=60`.
- `GET /api/jobs/sync-gtfs`: endpoint del cron diario. Descarga ZIP configurados y los guarda de forma privada en Vercel Blob.

Las cachés en memoria de una función serverless son oportunistas: una nueva instancia puede empezar vacía. El último GTFS estático válido sigue siendo el respaldo persistente incluido en el despliegue.

## PWA y red

`vite-plugin-pwa` genera el manifiesto y un service worker `autoUpdate`. Workbox precachea HTML, JavaScript, CSS, iconos, SVG y fuentes incluidas en `dist`; no precachea JSON, GeoJSON, teselas ni respuestas API. La aplicación es online-first para datos cartográficos. El cliente ofrece la instalación nativa cuando recibe `beforeinstallprompt`; en Safari de iOS muestra el flujo manual «Compartir → Añadir a pantalla de inicio». Un descarte se recuerda durante 30 días.

Las rutas `/mapa/*` se reescriben a `/index.html` en Vercel. El service worker usa el mismo fallback para navegación.

## Vercel y despliegue

`vercel.json` ejecuta `npm run data:publish && npm run build`. `data:publish` refina el snapshot ya versionado, compila Markdown, garantiza un demo solo si falta transporte, enriquece la clasificación y valida.

El cron de las 03:17 UTC descarga originales GTFS a Blob, pero **no ejecuta el importador ni publica un snapshot nuevo**. La normalización automática de Blob a un nuevo despliegue todavía no está conectada.

## Estructura del repositorio

```text
api/                          funciones Vercel y lógica GTFS compartida
content/territories/          Markdown editorial fuente
docs/                         arquitectura, contratos y guías
public/data/atlas/            snapshot que consume y despliega el cliente
scripts/                      descarga, normalización, enriquecimiento y validación
src/components/               búsqueda, fichas, selector de modo, comparación
src/data/                     carga y búsqueda de atlas/transporte
src/map/                      estilo e integración MapLibre
src/types.ts                  contratos del cliente
src/url-state.ts              lectura del estado compartible
vite.config.ts                Vite y PWA
vercel.json                   build, rewrites y cron
```

`data/`, ZIP, MBTiles y PMTiles están ignorados. El producto nuevo no registra protocolos PMTiles.

## Dependencias externas en tiempo de ejecución

- OpenFreeMap/OpenMapTiles: fondo vectorial y glifos.
- Mapzen Terrain Tiles en AWS Open Data: sombreado, hipsometría y relieve 3D.
- Renfe GTFS-Realtime: tres feeds protobuf, salvo URL alternativa configurada.
- Vercel Analytics: componente cargado por el frontend.

Una caída de estos servicios no invalida el snapshot territorial, pero puede dejar el fondo, el sombreado o el tiempo real incompletos.
