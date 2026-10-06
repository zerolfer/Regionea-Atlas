# Contratos de datos

Este documento es normativo para los artefactos persistidos. Los tipos de interfaz viven en `src/types.ts`; los invariantes comprobables, en `scripts/validate-atlas-data.mjs`.

## Convenciones comunes

- Todas las geometrías publicadas están en WGS84, orden `[longitud, latitud]`.
- Una caja geográfica es `[oeste, sur, este, norte]`.
- `Feature.id` debe coincidir con `Feature.properties.id` en el atlas territorial/físico.
- Los IDs son opacos para el cliente: se pueden interpretar en importadores, nunca reconstruir en la UI.
- Los campos desconocidos pueden conservarse; eliminar o renombrar campos existentes requiere migración.
- `null` significa conocido como ausente o no disponible. La omisión se reserva para campos no aplicables.
- `sourceId` debe resolver a una entrada de `manifest.sources`.

## Identidad y versionado de IDs

Los IDs publicados no cambian por traducciones, correcciones ortográficas o cambios de geometría. Esquemas actuales:

| Entidad | Esquema actual | Autoridad base |
|---|---|---|
| País | `country-{adm0_a3}` | Natural Earth |
| Comunidad | `es-ccaa-{código}` | código nacional IGN |
| Asturias | `es-as` | alias estable especial de `es-ccaa-03` |
| Provincia | `es-prov-{código}` | código nacional IGN |
| Comarca | `es-as-comarca-{slug}` | nombre SITPA; legado menos robusto |
| Concejo | `es-as-concejo-{INE de 5 dígitos}` | INE/SITPA |
| Parroquia | `es-as-parish-{SADEI de 6 dígitos}` | SADEI |
| Barrio | `es-as-neighborhood-{CodeB}` | SADEI |
| Físico Asturias | `physical-as-{kind}-{capa}-{objectid/hash}` | SITPA |
| Físico Europa | `physical-eu-{kind}-{ne_id/wikidata/hash}` | Natural Earth |
| Masa de agua española | `physical-es-water-{CodMasa}` | MITECO/plan hidrológico |
| Delta del Ebro | `physical-es-delta-ebro` | identidad fija, unidades ICGC LIFE EBRO |
| Transporte | `{proveedor}:{id GTFS}` | feed GTFS |

Para una cobertura nueva se recomienda `{país}-{ámbito}-{tipo}-{código-autoritativo}`. No reutilice un ID para una entidad distinta. Si una fuente sustituye sus códigos, publique un mapa de migración antes de cambiar URLs guardadas.

La comarca usa hoy un slug porque la fuente importada no aportó un código estable. Trátelo como compatibilidad publicada: no regenere el ID al cambiar el nombre visible.

## `AtlasEntity`

Es la forma sin geometría de un territorio o accidente dentro de `catalog.json`:

```ts
type AtlasEntity = {
  id: string
  slug: string
  name: string
  localName?: string
  aliases: string[]
  kind: TerritoryKind | PhysicalFeatureKind
  sourceId: string
  bbox: [number, number, number, number] | null
  center: [number, number] | null
  parentId?: string | null
  boundaryStatus?: BoundaryStatus
  population?: number | null
  areaKm2?: number | null
  density?: number | null
  referenceYear?: number | null
  elevationM?: number | null
  lengthKm?: number | null
  minZoom?: number
  territoryIds?: string[]
  geometryRole?: 'area' | 'label' | 'line' | 'point'
  geometryNote?: string
  geometryId?: string
  sourceDate?: string
}
```

Los GeoJSON territoriales y físicos llevan estas propiedades junto a `geometry`. `bbox` y `center` se calculan después de simplificar; `center` es el centro de la caja, no un centroide garantizado dentro del polígono.

`MetricValue` existe en TypeScript como diseño futuro, pero el snapshot actual persiste métricas planas. No publique objetos `MetricValue` sin actualizar cliente, validador y migración.

## Territorios

`TerritoryKind` admite:

- publicados: `country`, `autonomous-community`, `province`, `functional-region`, `municipality`, `parish`, `neighborhood`;
- reservados: `historical`, `cultural`.

`parentId` forma la ruta territorial. Todas las referencias deben resolver dentro del catálogo. Los tipos reservados no tienen todavía capas, estilos ni importadores.

### Naturaleza del límite

`BoundaryStatus` evita equiparar todas las geometrías:

| Valor | Significado de producto |
|---|---|
| `official` | unidad administrativa o funcional publicada por la autoridad fuente |
| `statistical` | ámbito con finalidad estadística; no implica deslinde jurídico |
| `municipal` | delimitación publicada por una fuente municipal |
| `reference` | geometría cartográfica de contexto, no presentada como deslinde oficial |

En el snapshot actual las parroquias y barrios son `statistical`; los países de Natural Earth son `reference`. El validador exige un estado reconocido a todo territorio y reglas más estrictas para parroquias y barrios.

## Accidentes físicos

Tipos reconocidos: `peak`, `range`, `river`, `lake`, `reservoir`, `valley`, `coast`, `cape`, `bay`, `gulf`, `delta`, `estuary`, `cliff`, `beach`, `island` y `protected-area`.

El snapshot asturiano puebla picos, sierras, ríos, lagos, embalses, espacios protegidos, cabos, bahías, rías, islas y playas. El contexto Natural Earth incorpora golfos y deltas disponibles en su cobertura europea y mediterránea. Sus polígonos son áreas cartográficas de referencia para rótulos, no límites jurídicos, y llevan `boundaryStatus: 'reference'`. `cliff` y `valley` siguen preparados, pero solo se publican cuando una fuente los identifica de forma verificable. Añadir un tipo al contrato no autoriza a deducirlo de rótulos incompletos. `territoryIds` relaciona el accidente con territorios cuando la importación dispone de esa relación; actualmente el detalle asturiano usa `['es-as']` de forma general.

Los nombres de playas se presentan con «Playa…», conservando el topónimo original en `localName` y `aliases`. Los IDs ya publicados no se regeneran al corregir nombres o tipos; que un ID opaco contenga un tipo antiguo no cambia el significado de `kind`.

### Superficies y topónimos costeros

`geometryRole` es obligatorio para los accidentes físicos publicados: `area` requiere Polygon/MultiPolygon, `line` describe un recorrido, `point` una localización y `label` un topónimo sin delimitación. Las colecciones de etiquetas derivadas llevan Point para dibujar el nombre, pero conservan el papel geométrico de la entidad original.

Golfos, bahías, deltas y rías se dibujan y seleccionan como superficies cuando existe un polígono verificable. Un registro puntual de nomenclátor solo aporta una etiqueta y su ficha advierte que no delimita el accidente. No se permiten círculos, buffers ni polígonos inventados como sustitutos.

`geometryNote` explica el alcance de la superficie; `sourceDate` es la actualización conocida de la fuente (ISO `YYYY-MM` o `YYYY-MM-DD`, sin inventar precisión). Es independiente de `manifest.generatedAt`, que fecha la generación de la colección. MITECO delimita masas de agua de transición, no todo el paisaje de una ría. El Ebro delimita las unidades de llanura deltaica y marismas QHpd/QHm del ICGC, no todo el delta geomorfológico ni el parque natural.

`geometryId` conserva IDs antiguos de topónimos al dirigir selección y encuadre hacia una superficie canónica del catálogo. Debe resolver a una entidad `area` sin otra referencia: no se permiten cadenas. El catálogo antiguo adopta bbox, fuente, fecha y nota de esa superficie; el importador conserva su nombre como alias en la entidad canónica. La búsqueda excluye duplicados con `geometryId`, pero las URLs antiguas siguen funcionando. La asociación exige mismo tipo, nombre normalizado, proximidad y una sola coincidencia; una ambigüedad no se resuelve automáticamente.

### Inventarios físicos asturianos

El resto del detalle físico usa también inventarios completos. `sourceCoverage` registra por namespace URL, filtro, recuento, fecha de descarga, SHA-256 de los IDs oficiales ordenados e `idPrefix` (núcleo) o `idNamespace` (costa/playas). `scripts/lib/arcgis-collection.mjs` verifica IDs y recuentos antes/después, descarga lotes de hasta 1.000 y respeta `objectIdFieldName`, incluido `objectid_1`. No se excluyen registros por altitud o ausencia de nombre; las respuestas truncadas, duplicadas o modificadas abortan la actualización.

La capa `030422` contiene anotaciones de picos, montes o collados y `030424` de sierras o áreas extensas. La ficha aclara que el punto es la posición del topónimo, no una delimitación ni necesariamente la cima. `labelEligible: false` conserva textos ausentes o claramente fragmentarios sin usarlos en etiquetas/búsqueda. `cartographicName` recompone letras espaciadas solo dentro de un mismo registro cuando existe separación entre palabras; no junta textos de registros vecinos. Los homónimos conservan IDs y etiquetas independientes; MapLibre resuelve las colisiones en pantalla.

Protección incluye las capas 1, 2, 3, 5, 6, 7, 13, 14, 15, 17 y 18: parques, reservas, monumentos puntuales/poligonales, paisajes, LIC, ZEPA, ZEC, Ramsar y biosfera. `protectionType`, `protectionZone` y `protectionInstrument` conservan lo indicado por la fuente. No se confunden hábitats, vegetación marina ni usos del suelo con figuras de protección.

Los parques naturales y reservas de biosfera zonificados se agrupan por categoría de fuente, nombre oficial e instrumento. `aggregateProtectedSites` une sus polígonos sin rellenar huecos ni conectar partes separadas; no mezcla parque, ZEC/ZEPA y biosfera. La entidad `physical-as-protected-site-…` conserva `memberIds`; los originales permanecen con `geometryId` hacia el conjunto y siguen formando parte del inventario. Las zonas no se simplifican independientemente antes de unirlas. Una identidad ambigua entre instrumentos aborta la agregación.

`legacyIds` son alias de identificador, no de nombre. Conservan los enlaces de parques que antes usaban un hash por no reconocer `objectid_1`. `loadAtlasData` los incorpora a `entitiesById` sin duplicar entidades; el validador exige que no coincidan entre sí ni con un ID canónico. El refinado debe conservarlos también en registros que apuntan a superficies agregadas.

#### Especificación fluvial

La capa 4 de Hidrografía SITPA aporta registros de eje de río y curso fluvial oculto. Se importan ambos tipos completos, incluidos arroyos cortos y registros sin topónimo; se excluyen canales, acequias, márgenes e islas fluviales porque no representan esos ejes naturales. «Completa» se refiere al inventario de esta fuente, no a una garantía de que todo cauce existente esté cartografiado.

- Cada ID `physical-as-river-hydro-4-{objectid}` sigue representando un registro, no necesariamente un río completo. `lengthKm` mide ese registro; la ficha lo advierte.
- `name: ''` conserva la ausencia de topónimo: la interfaz muestra «Curso de agua sin nombre en la fuente», sin convertir esa descripción en nombre oficial ni etiquetar el mapa con ella. No se asignan nombres de ríos vecinos a afluentes desconocidos.
- `minZoom` es 7.5 para registros con nombre de cursos conectados de al menos 5 km, 10 para los demás con nombre y 12 para los sin nombre. La longitud conjunta solo reúne registros de igual nombre normalizado y extremos exactos coincidentes; no usa proximidad ni el campo `cod` (que clasifica geometrías, no identifica ríos).
- Las partes de un mismo registro se encadenan únicamente en extremos exactos con dos incidencias, revirtiendo la orientación cuando procede. Los huecos y bifurcaciones reales se mantienen; no se añaden segmentos rectos para aparentar continuidad. IDs y selección siguen siendo por registro.
- Un ID fluvial antiguo ya asociado a una superficie de ría conserva `geometryId`, naturaleza, fuente y encuadre canónicos; no reaparece como duplicado de búsqueda.

`manifest.collections.physicalAsturias.riverCoverage` registra `sourceUrl`, filtro `where`, `featureCount`, `downloadedAt` y `objectIdsSha256` (SHA-256 del JSON de IDs numéricos ordenados). El descargador inventaría IDs, comprueba recuentos antes/después y descarga lotes de hasta 1.000; aborta ante IDs duplicados, inesperados o ausentes. El validador verifica que el inventario publicado coincide, incluidos los IDs redirigidos a rías. `downloadedAt` es la fecha de descarga, no una fecha inventada de actualización cartográfica.

Excepción explícita de normalización: un eje hidrográfico clasificado como río y denominado oficialmente «Ría…» o «Estuario…» puede adoptar el tipo de la superficie MITECO coincidente bajo las mismas comprobaciones. No basta con desembocar en una ría. El eje enlazado deja de dibujarse como accidente independiente, pero su ID permanece resoluble.

## Manifiesto principal

`public/data/atlas/manifest.json` contiene:

```ts
type DatasetManifest = {
  version: string
  generatedAt: string        // ISO 8601
  bounds: BBox
  defaultView: { center: Position; zoom: number }
  collections: Record<string, DatasetCollection>
  sources: SourceReference[]
}
```

Cada colección declara URL pública, bytes exactos, SHA-256, recuento, fuentes, licencia, bounds y rango de zoom. El manifiesto se escribe al final del pipeline. El validador recalcula tamaño y checksum, comprueba IDs y coordenadas.

`version` es hoy la fecha UTC `YYYY-MM-DD`, no SemVer. Si se generan dos snapshots el mismo día comparten versión aunque difiera `generatedAt` y checksum.

`catalog.json` tiene `{ territories: AtlasEntity[], physical: AtlasEntity[] }`. `editorial.json` es un objeto indexado por ID.

## Contenido editorial

Forma compilada:

```ts
type EditorialEntry = {
  id: string
  title: string
  kicker?: string
  summary: string
  sections: { title: string; paragraphs: string[] }[]
}
```

El `id` debe coincidir con una entidad para mostrarse en su ficha, aunque `build-content.mjs` aún no lo valida. El Markdown admite frontmatter plano (`id`, `title`, `kicker`, `summary`), títulos `##` y párrafos; no es un parser Markdown general.

## Transporte estático

### Ruta GeoJSON

Propiedades requeridas por importación/validación:

```ts
{
  id: `${provider}:${route_id}`
  entityType: 'route'
  provider: string
  freshness: 'scheduled' | 'stale' | 'demo'
  name: string
  shortName: string
  color: `#${string}`
  routeType: number
  transportMode: 'bus' | 'rail' | 'ferry' | 'air'
  extentClass: 'urban' | 'local' | 'regional' | 'long-distance'
  routeLengthKm: number
  routeSpanKm: number
  routeStopCount: number
  displayMinZoom: number
  classificationVersion: 1
  classificationBasis: 'full-service-geometry' | 'published-geometry'
}
```

La geometría publicada es `LineString`. El clasificador acepta variantes anidadas y calcula sobre todas ellas antes de elegir/simplificar la representación. `classificationBasis='published-geometry'` identifica snapshots antiguos enriquecidos a partir de lo ya publicado.

### Clasificación genérica

`scripts/lib/transit-classification.mjs` es la única implementación autorizada:

| Clase | Extensión máxima | Longitud máxima | zoom mínimo |
|---|---:|---:|---:|
| `urban` | 18 km | 55 km | 9,5 |
| `local` | 65 km | 160 km | 8 |
| `regional` | 260 km | 650 km | 6,5 |
| `long-distance` | sin límite | sin límite | 5 |

Se elige la primera regla que cumple simultáneamente extensión diagonal y longitud. La longitud es el máximo entre variantes, no su suma. La clasificación no depende de Asturias ni de la caja de cobertura. Cambiar reglas exige aumentar `TRANSIT_CLASSIFICATION_VERSION`, regenerar todos los feeds, actualizar estilo/cliente y validar.

### Parada GeoJSON

```ts
{
  id: `${provider}:${stop_id}`
  entityType: 'stop'
  provider: string
  freshness: 'scheduled' | 'stale' | 'demo'
  name: string
  color: string
  transportMode: 'bus' | 'rail' | 'ferry' | 'air'
}
```

La implementación actual asigna `rail` a Renfe y `bus` al resto de paradas porque GTFS no define el medio en `stops.txt`. Para operadores multimodales hará falta derivarlo de las rutas asociadas.

### Cobertura

El manifiesto de transporte contiene:

```json
{
  "coverage": {
    "id": "es-as",
    "bounds": [-7.25, 42.9, -4.45, 43.75],
    "contextBounds": [-7.5, 42.72, -4.2, 43.93]
  }
}
```

`bounds` selecciona paradas y viajes relevantes. `contextBounds` recorta únicamente la geometría publicada de ALSA. La clasificación se calcula antes del recorte. La cobertura describe el snapshot, no el alcance semántico de cada ruta.

### Calendario y salidas

`schedule.json` guarda por proveedor `status`, fechas de vigencia, calendarios por `service_id` y excepciones por fecha. Los ficheros `departures/{stop-id-codificado}.json` contienen `stopId` y salidas con ruta, destino, hora GTFS, `serviceId`, `tripId`, secuencia y segundos desde el inicio del día. Se admiten horas superiores a 24:00.

El nombre de fichero sustituye cada `%` de `encodeURIComponent(id)` por `_`. La API y el cliente usan la misma regla.

## Tiempo real normalizado

`GET /api/transporte/renfe/realtime` devuelve:

```ts
{
  status: 'live' | 'stale' | 'unavailable'
  updatedAt: string | null
  vehicles: Array<{ id; tripId; routeId; latitude; longitude; bearing; timestamp }>
  alerts: Array<{ id; header; description }>
  tripUpdates: Array<{
    id; tripId; routeId; timestamp
    stops: Array<{ stopId; stopSequence; arrivalDelay; departureDelay }>
  }>
  reason?: string
}
```

Los IDs normalizados llevan prefijo `renfe:` cuando proceden de campos identificativos del feed. `stale` puede significar respuesta parcial o último resultado correcto conservado en el proceso.

## URL compartible

Paths: `/mapa/politico`, `/mapa/fisico`, `/mapa/transporte`.

| Parámetro | Uso |
|---|---|
| `seleccion` | ID territorial o físico |
| `comparar` | hasta tres IDs separados por coma |
| `nivel` | nivel político manual |
| `filtros` | filtros físicos separados por coma |
| `fuentes` | proveedores de transporte activos |
| `transportes` | medios activos |
| `tiempoReal=0` | oculta tiempo real |
| `fondo=satelite` | imagen satelital; ausente o desconocido equivale a plano |
| `lng`, `lat`, `z` | centro y zoom de cámara |
| `pitch`, `bearing` | inclinación y orientación en grados |

La selección de transporte no se restaura actualmente desde `seleccion`: el parser solo resuelve ese parámetro contra `entitiesById`. Es una limitación conocida.

`PhysicalFilter` contiene exclusivamente `relief` (Sierras), `peaks`, `hydrography`, `valleys`, `coast` y `protected`. El estado predeterminado activa sierras, picos, hidrografía, costa y espacios protegidos. La interfaz solo ofrece filtros de entidades si el catálogo contiene tipos asociados según `PHYSICAL_FILTER_KINDS`: Valles queda oculto mientras no haya datos. Se sigue aceptando `valleys` en URLs antiguas. `filtros=` representa todos los filtros desactivados, no los predeterminados.

`MapAppearance = { basemap: 'plan' | 'satellite'; hypsometry: boolean; terrain3d: boolean }` es estado de presentación independiente. Su valor inicial es plano sin colores de altitud ni 3D. El fondo se aplica en todos los modos; altitud, terreno y edificios 3D solo en físico. Para conservar URLs publicadas, `hypsometry` y `terrain3d` se leen y escriben dentro de `filtros`, pero el parser los separa y nunca los entrega como filtros de entidades.

`ViewState` añade `pitch?: number` y `bearing?: number`. La inclinación explícita se restaura en cualquier modo, con o sin terreno, y se limita a 0–80°; sin ese parámetro, un enlace físico antiguo con `terrain3d` usa 60° y los demás comienzan a 0°. La orientación se normaliza a −180–180°. La serialización incluye `pitch=0.0` cuando el 3D está activo y la cámara está cenital: omitirlo restauraría incorrectamente 60°. Centro, zoom, inclinación y orientación proceden de los eventos de MapLibre, no se recalculan al mover el panel ni al cambiar filtros o fondo.

## Fondos externos y edificios

Las fuentes raster se declaran en `src/map/basemap.ts`, fuera de los contratos GeoJSON y del manifiesto del atlas. Solo se solicitan al elegir satélite. El selector y las atribuciones indican proveedor, fecha y resolución; su disponibilidad depende de servicios públicos externos sin garantía de continuidad. El respaldo NASA permanece debajo del detalle, no sustituye ni elimina entidades del atlas.

Los edificios son extrusiones del `source-layer: building` de OpenMapTiles: `hide_3d=true` excluye una parte, `render_height` determina altura y `render_min_height` su base. Un valor ausente o no numérico se trata como 0, sin inventar una altura en el cliente; los valores publicados por el proveedor pueden ser estimados. Se muestran desde zoom 14 únicamente con 3D físico. No son fotogrametría ni edificios con fachadas fotografiadas. Fuentes, licencias, límites WMTS y procedimiento de sustitución se describen en [arquitectura](architecture.md#fondos-y-terreno-3d).

## Evolución de contratos

Un cambio incompatible debe incluir:

1. nueva versión explícita del contrato afectado;
2. importador y migración del snapshot existente;
3. validador que rechace la forma antigua;
4. cliente compatible con la forma nueva;
5. pruebas y actualización de este documento.

No introduzca recálculos de respaldo en el navegador: ocultan snapshots incompletos y duplican lógica.
