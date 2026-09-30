# Operación, calidad y diagnóstico

## Entorno local

La guía principal usa Node.js 22 o posterior y npm:

```bash
npm ci
npm run dev
```

La app se abre en `http://localhost:5173/mapa/politico`. Para regenerar datos desde fuentes externas, ejecute aparte `npm run data:sync`.

También existen Docker Compose y Task:

```bash
task dev
task stop
task prod:build
task prod:serve
```

El `Dockerfile` usa hoy Node 20 mientras la guía local recomienda Node 22. Conviene alinearlo antes de considerar Docker el entorno canónico. Además, `Taskfile.yaml` anuncia producción en 8080, pero `docker-compose.yaml` publica 8070.

## Variables y secretos

Todas son de servidor; ninguna es obligatoria en el navegador.

| Variable | Uso | Obligatoria |
|---|---|---|
| `RENFE_GTFS_RT_ALERTS_URL` | feed de alertas alternativo | no |
| `RENFE_GTFS_RT_TRIP_UPDATES_URL` | actualizaciones alternativas | no |
| `RENFE_GTFS_RT_VEHICLE_POSITIONS_URL` | posiciones alternativas | no |
| `RENFE_GTFS_RT_URL` | feed combinado; sustituye los tres anteriores | no |
| `RENFE_GTFS_RT_TOKEN` | bearer para endpoint alternativo | no |
| `CTA_GTFS_URL` | descarga diaria CTA | para ese feed |
| `ALSA_GTFS_URL` | descarga diaria ALSA | para ese feed |
| `RENFE_GTFS_URL` | descarga diaria Renfe | para ese feed |
| `NAP_API_TOKEN` / `NAP_TOKEN` | bearer de descarga NAP | según fuente |
| `BLOB_READ_WRITE_TOKEN` | escritura privada en Vercel Blob | sí para cron |
| `CRON_SECRET` | autoriza el endpoint cron | recomendada |

No documente valores reales. Configure secretos por entorno en Vercel. `NAP_API_TOKEN` tiene precedencia sobre el alias `NAP_TOKEN`.

## Pruebas obligatorias

Antes de integrar:

```bash
npm run lint
npm test
npm run build
```

`npm test` ejecuta Vitest, las comprobaciones autocontenidas de clasificación y superficies costeras (GML, huecos, CRS, identidad, reproyección y ZIP inválido), y el validador completo del snapshot. Estas pruebas no descargan fuentes externas. `npm run build` ejecuta TypeScript y Vite/PWA.

Para cambios de datos use además:

```bash
npm run data:validate
git diff --check
```

El validador comprueba fuentes, licencias, fechas, bounds, tamaños, checksums, WGS84, IDs, relaciones, recuentos asturianos y clasificación de rutas. No comprueba todavía validez topológica completa, solapes, Markdown huérfano ni accesibilidad visual.

## Criterios de revisión

- Móvil 390 px, tableta y escritorio sin solapamientos.
- Teclado, foco visible, contraste y movimiento reducido.
- Selección y doble clic no interfieren.
- Hoja móvil conserva su estado al seleccionar.
- URL restaura modo, cámara, selección territorial/física, comparación y filtros.
- Geolocalización concedida, denegada y fuera de cobertura.
- Comparación limitada a tres y encuadre conjunto correcto.
- Feeds caducados, servicios después de medianoche y `calendar_dates`.
- Caída total y parcial de GTFS-Realtime.
- No aparece ninguna clave en el bundle ni en peticiones del navegador.

Las pruebas E2E y visuales automatizadas todavía no están configuradas; estas comprobaciones requieren revisión manual.

## Git y despliegue

1. Compruebe rama y estado: `git status --short --branch`.
2. Cree una rama `codex/<tema>` o la convención acordada.
3. No descarte cambios ajenos ni reescriba historial compartido.
4. Haga commits pequeños con importador, contrato, migración y pruebas coherentes.
5. Ejecute la puerta de calidad.
6. Publique la rama y revise preview de Vercel.
7. Integre en `main` solo tras aceptación.

Vercel ejecuta `data:publish` antes de compilar. Por ello un build puede cambiar `manifest.generatedAt` dentro de su artefacto aunque el repositorio no cambie. Los datos territoriales no se descargan durante el build.

## Caché y recuperación

- PWA: solo armazón estático precacheado; GeoJSON y teselas no garantizados offline. La promoción de instalación usa el evento nativo en Chromium y ayuda manual en Safari de iOS.
- Realtime: caché de proceso 15 s y CDN 15 s/45 s stale-while-revalidate.
- Salidas: CDN 60 s/300 s stale-while-revalidate.
- Fallo realtime: último objeto correcto de la instancia pasa a `stale`; otra instancia puede no tenerlo.
- Fallo de API de salidas en cliente: lectura directa del JSON estático.
- Fallo de fuente durante `data:sync`: el proceso aborta; Git conserva el snapshot anterior recuperable.

## Diagnóstico rápido

### Pantalla vacía o mapa sin fondo

Compruebe WebGL2 y red hacia OpenFreeMap. En físico, compruebe también el acceso a `elevation-tiles-prod` de AWS Open Data. Los GeoJSON pueden estar correctos aunque las teselas fallen.

### “No se pudo cargar el catálogo”

Verifique respuesta de:

```text
/data/atlas/manifest.json
/data/atlas/catalog.json
/data/atlas/editorial.json
```

Ejecute `npm run data:validate`. Un checksum incorrecto suele indicar que se modificó una colección sin regenerar el manifiesto.

### Transporte no aparece

Compruebe `transit/manifest.json`, versión 1 de clasificación y `displayMinZoom`. Una ruta urbana no se dibuja antes de zoom 9,5; las paradas, antes de zoom 10.

### No hay próximas salidas

Compruebe que existe el fichero codificado de la parada, que el feed sigue vigente y que `service_id` está en `schedule.json`. Las horas GTFS posteriores a 24:00 son válidas.

### Realtime 503

Pruebe `/api/transporte/renfe/realtime`, URLs configuradas y token solo si el endpoint alternativo lo exige. Un 503 con `status: unavailable` indica que no hubo feed válido ni caché previa en esa instancia.

### El cron descarga pero la web no cambia

Es el comportamiento actual: el cron guarda `latest.zip` en Blob, pero no importa ni despliega. Ejecute el importador con ZIP descargados y publique el snapshot, o implemente una fase controlada de normalización y promoción.

### Un ID editorial no aparece

El nombre del fichero no manda; manda `id` en frontmatter. Debe coincidir exactamente con una entidad del catálogo y hay que ejecutar `npm run data:content`.

## Problemas y deuda conocidos

La lista única de trabajo futuro y la decisión pendiente sobre la arquitectura de datos se mantienen en [Pendientes y decisiones abiertas](pendientes.md). El backend se ha pospuesto deliberadamente; PostGIS figura allí como opción de estudio, no como solución aprobada.
