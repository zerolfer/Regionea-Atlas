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

`npm test` ejecuta Vitest, la comprobación autocontenida del clasificador y el validador completo del snapshot. `npm run build` ejecuta TypeScript y Vite/PWA.

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

- PWA: solo armazón estático precacheado; GeoJSON y teselas no garantizados offline.
- Realtime: caché de proceso 15 s y CDN 15 s/45 s stale-while-revalidate.
- Salidas: CDN 60 s/300 s stale-while-revalidate.
- Fallo realtime: último objeto correcto de la instancia pasa a `stale`; otra instancia puede no tenerlo.
- Fallo de API de salidas en cliente: lectura directa del JSON estático.
- Fallo de fuente durante `data:sync`: el proceso aborta; Git conserva el snapshot anterior recuperable.

## Diagnóstico rápido

### Pantalla vacía o mapa sin fondo

Compruebe WebGL2 y red hacia OpenFreeMap. En físico, compruebe también Esri. Los GeoJSON pueden estar correctos aunque las teselas fallen.

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

1. El pipeline territorial/físico es específico de Asturias y no está dividido en adaptadores configurables.
2. Las colecciones son monolíticas; no hay carga por concejo/ciudad ni resolución de colecciones desde el manifiesto.
3. El cron GTFS solo archiva originales; no normaliza, valida ni promociona un snapshot.
4. El “último realtime válido” vive en memoria de una instancia, no en almacenamiento compartido.
5. La selección de transporte no se restaura desde la URL.
6. El validador contiene recuentos y padres asturianos fijos; una cobertura nueva exige generalizarlo.
7. `MetricValue` y los tipos territorial histórico/cultural están reservados, no implementados de extremo a extremo.
8. Las relaciones sierra-pico se infieren en cliente por proximidad.
9. El bundle de MapLibre es grande; solo se ha aislado mediante carga perezosa, no se ha optimizado más.
10. Docker/Task tienen discrepancias de versión de Node y puerto documentadas arriba.
11. No hay E2E, regresión visual ni auditoría de accesibilidad automatizadas.
12. El importador actual escribe o reemplaza salidas presentes, pero no elimina ficheros por parada que hayan desaparecido del feed nuevo.

Estas limitaciones no deben ocultarse con lógica de respaldo en el navegador. Al resolver una, añada la garantía correspondiente al validador o a pruebas automatizadas.
