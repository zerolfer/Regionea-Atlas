# Pipelines y ampliación de datos

## Comandos y artefactos

```bash
npm ci
npm run data:sync       # descarga territorio/físico y reconstruye todo lo derivado
npm run data:publish    # refina/valida el snapshot ya presente; no descarga territorio
npm run data:content    # compila content/territories a editorial.json
npm run data:validate   # valida snapshot sin descargar
npm run data:import-gtfs -- --feed proveedor=/ruta/feed.zip
```

`data:sync` requiere red y puede tardar. Descarga fuentes, reproyectadas ya por sus endpoints a WGS84 cuando procede, normaliza, simplifica, calcula cajas/superficies, escribe GeoJSON y catálogo, incorpora costa y playas oficiales mediante `sync-physical-coast.mjs`, refina etiquetas físicas, compila contenido, prepara transporte y valida.

El pipeline escribe el manifiesto principal al final, pero no usa un directorio temporal para el snapshot completo. Ejecútelo en una rama limpia, revise el diff y no despliegue una ejecución interrumpida.

`data:publish` no es equivalente: trabaja sobre los archivos existentes y actualiza `generatedAt`/checksums al refinar. Es el comando de build de Vercel porque algunas fuentes no son fiables desde su red.

## Fuentes y licencias actuales

El manifiesto desplegado es la autoridad de atribución. El adaptador actual declara:

| `sourceId` | Uso | Licencia persistida |
|---|---|---|
| `natural-earth` | países y físico europeo | dominio público |
| `ign-administrative-units` | comunidades y provincias | CC BY 4.0 |
| `sitpa-administrative-units` | concejos | CC BY 4.0 |
| `sadei-parishes` | parroquias estadísticas | CC BY 4.0 |
| `sadei-neighborhoods` | barrios de áreas urbanas | © SADEI; sujeto a su aviso legal |
| `sitpa-functional-regions` | comarcas funcionales | CC BY 4.0 |
| `sitpa-physical` | relieve, hidrografía y espacios protegidos | CC BY 4.0 |

El fondo tiene atribución independiente a OpenFreeMap, OpenMapTiles y OpenStreetMap; la elevación Terrarium, a Mapzen y AWS Open Data. Los GTFS se rigen por la licencia de cada publicación NAP. No copie la licencia de una colección a otra sin verificarla.

## Añadir una cobertura territorial

El pipeline territorial actual no tiene configuración declarativa. Para otra región:

1. Verifique fuente, licencia, fecha, CRS, granularidad y estabilidad de códigos.
2. Añada una entrada estable a `SOURCES` y otra a `manifest.sources`.
3. Implemente el adaptador de descarga en `scripts/sync-atlas-data.mjs`. Los helpers ArcGIS solicitan `outSR=4326`; cualquier otra fuente debe convertirse a WGS84.
4. Normalice cada feature mediante `decorate`, con ID, nombres, aliases, `kind`, `boundaryStatus`, `parentId`, métricas y `sourceId`.
5. Elija tolerancia por escala. Compruebe que la simplificación no invalida anillos ni cambia relaciones territoriales.
6. Añada la colección a `collectionMetadata`, catálogo, etiquetas y manifiesto.
7. Añada fuente/layer a `src/map/style.ts` y a las capas interactivas.
8. Generalice los invariantes del validador. No sustituya los recuentos asturianos sin crear comprobaciones equivalentes por cobertura.
9. Ejecute el pipeline, inspeccione geometrías y pruebe búsqueda, selección, ruta, geolocalización y URL.

Ejemplo de convención para concejos de otra cobertura:

```js
decorate(feature, {
  id: 'es-xx-municipality-01234',
  slug: slugify(name),
  name,
  localName,
  aliases: [],
  kind: 'municipality',
  boundaryStatus: 'official',
  parentId: 'es-xx',
  sourceId: 'autoridad-xx',
  population: null,
  areaKm2: roundMetric(geometryAreaKm2(feature.geometry)),
  density: null,
  referenceYear: null,
}, tolerancia)
```

El prefijo es un ejemplo; documente el esquema elegido en `contracts.md` antes de publicarlo.

### Fragmentación por cobertura

El cliente actual carga catálogo completo y cada modo referencia GeoJSON monolíticos por colección. Todavía no hay fragmentación por concejo/ciudad ni resolución de URLs desde el manifiesto en `style.ts`. Para introducirla hay que modificar conjuntamente manifiesto, cargador, estilo y estrategia de carga; no basta con crear más archivos.

## Añadir barrios

Solo publique polígonos verificables. El adaptador actual de SADEI:

- parsea un JavaScript que contiene `json_Barrios_2`;
- exige que todo valor de `parro` exista en `NEIGHBORHOOD_PARENTS`;
- usa `CodeB` como ID y marca el límite `statistical`;
- asocia barrios de Avilés, Gijón, Langreo, Mieres y Oviedo.

Para otra ciudad, añada el padre solo después de confirmar que la capa realmente pertenece a ese concejo. Si la fuente es municipal, use `boundaryStatus: 'municipal'`; no convierta puntos, rótulos o áreas aproximadas en polígonos.

Después actualice las reglas específicas del validador, que hoy enumeran los cinco concejos y esperan 91 barrios.

## Añadir accidentes físicos

1. Confirme que el tipo existe en `PhysicalFeatureKind`; si es nuevo, añádalo también a etiquetas, filtros y estilo.
2. Cree IDs a partir de un código estable de la fuente. Use hash de nombre+bbox solo como último recurso y documente su fragilidad.
3. Normalice con `physicalFeature` o un adaptador equivalente.
4. Indique altitud/longitud solo si la fuente las aporta y documente unidad.
5. Añada `territoryIds` cuando la relación pueda calcularse de forma reproducible.
6. Añada capa visual, capa de selección y capa a `PHYSICAL_INTERACTIVE_LAYERS`.
7. Genere etiquetas derivadas con una política de deduplicación explícita.

Para costa asturiana, `sync-physical-coast.mjs` clasifica códigos oficiales de Nombres Geográficos y añade la capa de playas de Turismo. La clasificación parte del código de capa y solo usa el nombre para separar cabo, bahía y golfo dentro del grupo que la propia fuente declara conjuntamente.

Los rótulos SITPA pueden estar fragmentados en varios registros. No una palabras por proximidad sin una regla verificable: es preferible omitir un nombre a inventar un accidente.

## Añadir contenido editorial

Cree `content/territories/{id}.md`:

```markdown
---
id: es-as-concejo-33024
title: Gijón/Xixón
kicker: Concejo
summary: Resumen breve y verificable.
---

## Contexto

Párrafo editorial.
```

El frontmatter es plano y no admite listas YAML. Ejecute `npm run data:content`. Compruebe manualmente que el ID existe; el compilador actual no valida esa relación ni citas dentro del texto.

## Importar GTFS estático

### Requisitos del feed

El importador requiere `routes.txt`, `stops.txt`, `trips.txt` y `stop_times.txt`. Usa opcionalmente `feed_info.txt`, `calendar.txt`, `calendar_dates.txt` y `shapes.txt`. Si no hay shapes, construye la línea con las paradas ordenadas del viaje.

Ejemplo para la cobertura inicial:

```bash
npm run data:import-gtfs -- \
  --feed cta=/datos/cta.zip \
  --feed alsa=/datos/alsa.zip \
  --feed renfe=/datos/renfe.zip
```

Ejemplo para otra cobertura:

```bash
npm run data:import-gtfs -- \
  --feed operador=/datos/operador.zip \
  --coverage-id es-xx \
  --coverage-bounds -3.20,39.90,-2.10,40.80 \
  --context-bounds -3.40,39.70,-1.90,41.00
```

Las cajas anteriores son sintácticas, no una fuente geográfica recomendada. Sustitúyalas por límites justificados.

El importador:

1. selecciona paradas dentro de `coverage.bounds`;
2. incluye viajes que pasan por ellas;
3. conserva variantes completas para clasificar alcance;
4. elige una variante representativa para dibujar;
5. recorta solo ALSA a `contextBounds`;
6. simplifica la línea publicada;
7. genera rutas, paradas, calendario y salidas fragmentadas;
8. escribe archivos mediante renombrado `.next` por archivo.

Tras importar:

```bash
npm run data:validate
npm test
```

Revise distribución de `extentClass`, colores, nombres, vigencia del feed y rutas sin geometría.

### Añadir un operador

- Use un `provider` corto, estable y en minúsculas en CLI; el GeoJSON lo muestra en mayúsculas.
- Los IDs originales se conservan tras `{provider}:`.
- Añada color de respaldo a `PROVIDER_COLORS` si el feed no publica uno válido.
- Revise `transportMode`: las rutas se deducen de `route_type`, pero las paradas no son aún multimodales.
- Si necesita recorte contextual, generalice la regla hoy específica de `provider === 'alsa'`; no copie excepciones por operador.
- Añada variables al cron solo si existe una URL descargable legalmente y documente su autenticación como secreto.

El cron admite actualmente únicamente CTA, ALSA y Renfe mediante una lista fija. Añadir un operador al importador no lo añade automáticamente al cron.

## Añadir GTFS-Realtime

La implementación actual está especializada en Renfe. Para otro proveedor:

1. Cree un adaptador serverless que decodifique protobuf y emita el contrato normalizado.
2. Mantenga IDs con namespace y asegure correspondencia con `route_id`, `trip_id` y `stop_id` estáticos.
3. Defina caché corta, timeout, estado parcial y respaldo `stale`.
4. Integre actualizaciones de salida sin asumir que todos los feeds aportan vehículos, alertas y trip updates.
5. Añada pruebas con protobuf/objetos simulados; CI no debe depender del proveedor.
6. Añada el proveedor al cliente de manera declarativa antes de crear intervalos adicionales.

No exponga tokens al frontend. Las variables sin prefijo `VITE_` permanecen en servidor.

## Publicación segura de datos

- Ejecute importaciones en una rama.
- Conserve el último snapshot válido si una descarga falla; el pipeline actual aborta, no debe reemplazarse por archivos parciales.
- Revise licencias y atribuciones del manifiesto.
- Revise el diff: los JSON compactos pueden ocultar cambios masivos; use scripts de recuento o un visor GIS.
- No haga commit de ZIP ni originales en `data/`.
- Haga commit conjunto de artefactos, manifiestos y adaptador que los produjo.
