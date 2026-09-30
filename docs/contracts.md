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
| `lng`, `lat`, `z` | cámara |

La selección de transporte no se restaura actualmente desde `seleccion`: el parser solo resuelve ese parámetro contra `entitiesById`. Es una limitación conocida.

Los valores físicos reconocidos son `relief`, `peaks`, `hydrography`, `valleys`, `coast`, `protected`, `hypsometry` y `terrain3d`. El estado predeterminado contiene relieve, picos, hidrografía, costa y espacios protegidos; hipsometría y 3D requieren activación explícita. La interfaz solo ofrece filtros de entidades si el catálogo contiene tipos asociados según `PHYSICAL_FILTER_KINDS`: Valles queda oculto mientras no haya datos. Se sigue aceptando `valleys` en URLs antiguas. `filtros=` representa todos los filtros desactivados, no los predeterminados.

## Evolución de contratos

Un cambio incompatible debe incluir:

1. nueva versión explícita del contrato afectado;
2. importador y migración del snapshot existente;
3. validador que rechace la forma antigua;
4. cliente compatible con la forma nueva;
5. pruebas y actualización de este documento.

No introduzca recálculos de respaldo en el navegador: ocultan snapshots incompletos y duplican lógica.
