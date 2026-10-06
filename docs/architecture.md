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

- modo, selección, comparación, filtros geográficos y apariencia del fondo;
- cámara sincronizada con la URL;
- catálogo de búsqueda;
- geolocalización en memoria;
- panel lateral de escritorio y hoja inferior móvil;
- refresco de salidas de una parada.

`src/map/MapView.tsx` encapsula MapLibre, eventos de mapa, selección, encuadre, posición del usuario y sondeo de vehículos cada 30 segundos. El componente se carga con `React.lazy`, separando MapLibre del paquete inicial.

Las actualizaciones de capas esperan `style.load`, no `isStyleLoaded()` (que también depende de teselas aún en descarga). `SelectionFocusController` conserva y consume una vez cada petición explícita de navegación del buscador o de una ficha; un clic en el mapa o una apertura del panel no reencuadran. Si el estilo cambia o el catálogo aún no ha resuelto la entidad, la petición queda pendiente. No se aplica padding global a MapLibre: cambiar la apertura de la hoja o el acople no debe desplazar el mapa ni modificar la URL. Cada navegación explícita calcula los márgenes actuales mediante `viewportPadding`: para áreas, `fitBounds` de MapLibre 6 recibe los márgenes más 12 px y no los conserva; para puntos y ubicación, `focusPoint` convierte los márgenes en un `offset` que centra el destino en el espacio libre sin cambiar el punto de fuga. El comparador se encuadra al cambiar sus territorios, no al mover el panel. Las atribuciones móviles permanecen ancladas al borde inferior del viewport, por encima de la hoja y por debajo de los diálogos; el pie reserva espacio para su botón.

`src/map/style.ts` es el contrato visual de escalas. Declara fuentes, capas, rangos de zoom e interacción. Las escalas políticas progresan de países a barrios. En transporte, cada ruta utiliza su clase de extensión importada; las paradas aparecen desde zoom 10 y sus etiquetas desde zoom 12.

`src/data/atlas.ts` carga manifiesto, catálogo y contenido editorial. `src/data/transit.ts` carga rutas y paradas, comprueba la versión de clasificación y construye el índice de búsqueda.

No hay gestor global de estado ni router externo. El path y `history.pushState`/`replaceState` son gestionados por `App.tsx` y `src/url-state.ts`.

La cabecera crea un contexto de apilamiento propio. Cuando el buscador abre resultados, se eleva temporalmente a `z-index: 46`, por encima de la hoja móvil (40) y el selector contextual (45), pero por debajo de los diálogos (50). Al cerrar los resultados recupera su prioridad habitual; buscar no cambia el estado de apertura de la hoja.

`DetailsDock` añade el acople del panel de escritorio: una pestaña lateral lo pliega sin desmontar la ficha ni perder su desplazamiento. Mientras está plegado, el contenido es `inert` (no recibe foco ni interacción); una nueva selección no lo abre. Al pasar a móvil se elimina ese bloqueo y se conserva la hoja inferior existente, independientemente del acople de escritorio. El panel llega al borde inferior; los filtros se ajustan a su contenido y tienen desplazamiento horizontal si no caben. El margen de navegación se calcula en `src/map/viewport-padding.ts` y coincide con el ancho responsive del panel o con el espacio liberado al plegarlo; solo se utiliza cuando se solicita mover la cámara. El acople es estado de interfaz de la sesión, no un parámetro compartible de la URL.

`DetailsSheet` gestiona el arrastre móvil localmente, sin volver a renderizar el mapa en cada movimiento. El mínimo mide `SHEET_PEEK_HEIGHT` (144 px) más el área segura inferior, compartido con CSS y los márgenes de navegación; los otros topes son 43 % y 79 % de la altura disponible, sin bajar del mínimo en pantallas bajas. `bottomSheetSafeAreaInset` lee la variable CSS `--sheet-safe-bottom` para mantener el mismo cálculo durante el arrastre y la navegación explícita. El asa y la cabecera `PanelHeader` permiten arrastrar, salvo sus controles interactivos. El título ocupa como máximo dos líneas y el tipo se coloca debajo en móvil, manteniendo la misma disposición en los tres estados. La cabecera y el pie no pertenecen al contenido desplazable (`panel-body`): el cierre permanece visible y no se reorganiza la ficha al alcanzar el mínimo. El cuerpo queda recortado y fuera de interacción en ese estado; al arrastrar vuelve a revelarse. Las nuevas fichas deben utilizar esta cabecera y envolver su contenido en `panel-body`. En escritorio se mantiene el orden tipo/título y el desplazamiento de la ficha completa.

## Modos del mapa

### Político

Las colecciones son GeoJSON independientes: países, comunidades autónomas, provincias, comarcas funcionales, concejos, parroquias y barrios. El nivel puede ser automático por zoom o forzado. Cuando coinciden varias geometrías, el mapa muestra un selector contextual.

Las relaciones de ascendencia se recorren con `parentId`. El comparador admite hasta tres territorios y muestra solo métricas comunes.

### Físico

Hay una colección de contexto europeo, una de detalle asturiano y una de superficies costeras españolas, además de colecciones derivadas de etiquetas. Los filtros de contenido son sierras, picos, hidrografía, valles, costa y espacios protegidos. La hipsometría y el terreno 3D son ajustes independientes del selector Capas, desactivados por defecto y persistidos en la URL. Sombreado, hipsometría y terreno usan instancias DEM separadas para evitar degradar el renderizado.

`scripts/sync-physical-coast.mjs` enriquece el detalle con rías, islas, cabos, bahías y playas oficiales de SITPA. Los símbolos costeros aparecen progresivamente para no saturar escalas regionales.

`scripts/sync-physical-rivers.mjs` actualiza únicamente la red fluvial desde Hidrografía SITPA: inventario completo de ejes y cursos ocultos, lotes verificados y conservación de topónimos ausentes. Comparte `fetchRiverCollection`/`buildRiverFeatures` con el importador general. La escala se calcula por cursos con nombre conectados en extremos exactos; no se filtran tramos durante la descarga ni se rellenan huecos artificialmente. Las partes continuas de un mismo registro se encadenan sin alterar IDs. Los arroyos y cauces sin nombre aparecen al acercarse, tanto en plano como en satélite.

`scripts/sync-physical-areas.mjs` incorpora superficies de masas de agua MITECO y unidades deltaicas del Ebro del ICGC. Golfos, bahías, rías y deltas se seleccionan como áreas, no mediante marcadores puntuales. El refinado vincula topónimos/ejes antiguos a superficies canónicas cuando hay una coincidencia inequívoca, conserva sus URLs y deduplica búsqueda y etiquetas. Las fichas distinguen la fecha de fuente y el alcance del polígono; consulte los contratos y la guía de ampliación antes de incorporar otra colección.

La relación entre una sierra seleccionada y sus picos se calcula actualmente en el cliente por proximidad al centro, no mediante una relación persistida. Es una heurística de interfaz y no un vínculo de datos normativo.

### Transporte

El snapshot contiene rutas, paradas, calendarios y salidas por parada. Los filtros actúan por proveedor, medio y visibilidad del tiempo real. Una selección atenúa el resto de la red.

El endpoint de salidas combina el calendario estático con actualizaciones GTFS-Realtime de Renfe cuando puede relacionarlas. Si la API falla, el cliente intenta cargar el JSON estático de la parada.

Los vehículos se refrescan cada 30 segundos y después de cada `style.load`. El componente conserva en memoria el último GeoJSON recibido y lo reaplica inmediatamente al recrear el estilo (por ejemplo, Plano/Satélite); si la nueva petición falla no desaparecen las posiciones anteriores. Esta caché no es persistente ni convierte datos antiguos en información actualizada.

## Fondos y terreno 3D

`MapLayers` permite elegir Plano/Satélite en todos los modos; en físico añade Colores de altitud y Terreno y edificios 3D. El sombreado permanece en el plano físico, sin otro interruptor. Los ajustes consumen `MapAppearance`, no `PhysicalFilter`. «Tipo de mapa» se abre mediante un botón circular con icono, sin texto visible. En escritorio conserva su posición sobre el cambio de modo; en móvil flota a la izquierda debajo de los filtros. Con altura ≤420 px se reserva un hueco en la cabecera: no cabrían botón, filtros y hoja sin recortar el control. El botón queda detrás de la hoja, y al ampliarla completamente se oculta para no invadir su cabecera. El desplegable queda encima de la hoja y debajo de búsqueda/diálogos. Escape devuelve el foco al botón.

Los ajustes físicos conservan checkbox nativos en escritorio. En móvil se dibujan como interruptores de 48×28 px dentro de filas pulsables de al menos 48 px, manteniendo la semántica y navegación de teclado del control nativo. El fondo seleccionado recibe el foco inicial y los nombres Plano/Satélite están centrados. La ayuda y las fuentes están tras ⓘ, junto al título, en una tarjeta flotante independiente, sin pico. Se coloca al lado del selector si cabe, o debajo/encima, limitada al viewport y con desplazamiento interno si hace falta; recalcula su posición al cambiar tamaños o hacer scroll. No cambia la altura del selector ni bloquea sus opciones. Las instrucciones de inclinación responden a `(pointer: coarse)` (dos dedos) o ratón (botón derecho), también si cambia la interacción principal. Escape cierra primero la ayuda y devuelve el foco a ⓘ; un segundo Escape cierra el selector. Pulsar ⓘ de nuevo también cierra la ayuda; pulsar fuera de ella la cierra sin robar el foco al control pulsado. Cambiar fondo, altitud o 3D no añade texto ni cambia el alto del panel en ese modo.

`buildStyle(mode, basemap)` reutiliza las fuentes vectoriales, DEM y GeoJSON. Para satélite oculta las superficies opacas del plano y su sombreado; coloca los raster después del fondo y antes de hipsometría, edificios y entidades/etiquetas. En este fondo aplica a todas las etiquetas un halo blanco nítido de 1 px; el plano conserva sus halos originales. Las geometrías, selección y colores de altitud permanecen independientes. No hay un segundo motor ni cambio de backend.

Fuentes comprobadas el 2026-10-01:

| Fuente | Uso | Límites y atribución |
|---|---|---|
| NASA GIBS Blue Marble Next Generation | vista general y respaldo permanente debajo del detalle | imagen 2004, aproximadamente 500 m; fuente limitada a zoom 5 y ampliada en zooms mayores cuando falta detalle; [uso de datos NASA](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy) |
| ESA WorldCover Sentinel-2, compuesto de color natural | detalle de paisaje | 2021, 10 m; latitudes −60° a 83°, matrices WMTS 6–14, CC BY 4.0; [datos ESA](https://esa-worldcover.org/en/data-access), [WMTS público Terrascope](https://docs.terrascope.be/Developers/WebServices/OGC/WMTSv2.html) |
| IGN PNOA Máxima Actualidad | detalle de España, sobre la base mundial desde zoom 12 | ortofotos de alta resolución con fechas según zona, no una fecha única; WMS GetMap PNG, `TRANSPARENT=TRUE`, BBOX EPSG:3857 por tesela de 256 px; cliente limitado a zoom 19 y cajas separadas Península/Baleares y Canarias; [servicios oficiales](https://www.ign.es/web/ign/portal/ide-area-nodo-ide-ign), [licencia IGN](https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf) |

Las plantillas y atribuciones exactas viven en `src/map/basemap.ts`. No requieren claves ni cuentas. PNOA se superpone por cobertura y zoom, sin cambiar todo el fondo según el centro de cámara. Se usa WMS con transparencia explícita: WMTS devolvió píxeles sin cobertura opacos incluso en PNG; la misma caja por WMS devolvió alpha 0 en todos sus píxeles en la comprobación del 2026-10-06. No basta con pedir formato PNG. Si falla PNOA permanece el fondo mundial disponible; si falla Terrascope queda NASA. Un aviso por carga de estilo, sin reiniciar cámara; errores de otras fuentes siguen registrados. Los colores/fechas pueden cambiar en el borde de cobertura. El detalle de 10 m del respaldo mundial no equivale a PNOA. Las [condiciones de Terrascope](https://terrascope.be/en/terms-use) no garantizan disponibilidad y prohíben degradar el servicio con carga elevada: no se precachean conjuntos de teselas ni se promete capacidad ilimitada.

La cámara admite hasta 80°. Al activar 3D desde una vista casi cenital se anima a 60°, respetando movimiento reducido; al desactivarlo vuelve a cenital. Cambiar filtros o fondo no modifica cámara. Una restauración explícita de URL prevalece sobre esa animación y conserva incluso `pitch=0` en 3D. MapLibre mantiene el centro/orientación durante `setStyle`; al recibir `style.load` se reaplican capas, terreno y selección. Las extrusiones OSM aparecen desde zoom 14, con alturas disponibles o estimadas por el proveedor; las ausentes no se inventan en el cliente.

Para ampliar el proveedor: verificar primero licencia, CORS, límites de cobertura/zoom, atribución, fecha, resolución y cuotas; actualizar `basemap.ts`, las capas raster de `style.ts` y las notas del selector. Mantener la API `MapAppearance` y la URL, salvo migración documentada. Ampliar `basemap.test.ts` (validación real de estilos, orden, límites y exclusión de raster en plano), probar la caída de detalle y una tesela real, y repetir QA móvil/escritorio. PNOA inicia las superposiciones regionales; otras coberturas y fotogrametría siguen pendientes. El zoom máximo de cámara es 19.

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
- NASA GIBS y ESA WorldCover/Terrascope: imágenes satelitales cuando se elige ese fondo.
- IGN PNOA: detalle de ortofotos españolas en el fondo Satélite desde zoom 12.
- Renfe GTFS-Realtime: tres feeds protobuf, salvo URL alternativa configurada.
- Vercel Analytics: componente cargado por el frontend.

Una caída de estos servicios no invalida el snapshot territorial, pero puede dejar el fondo, el sombreado o el tiempo real incompletos.
