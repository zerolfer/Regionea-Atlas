# Pendientes y decisiones abiertas

Esta nota recoge trabajo futuro y el cierre de bloques ya entregados, sin comprometer una arquitectura. Revisarla al iniciar cada bloque de desarrollo y actualizarla cuando se tome una decisión o se cierre una tarea.

## Bloques entregados

- [x] Fondos y terreno 3D integrados en `main` y subidos al repositorio (cierre actualizado el 2026-10-06): selector «Tipo de mapa», plano/satélite, colores de altitud, cámara inclinada y edificios simplificados. Véanse el [diseño](superpowers/specs/2026-10-01-basemap-terrain.md) y los [resultados](superpowers/plans/2026-10-01-basemap-terrain.md). La resolución de 10 m del fondo mundial no equivale a ortofotografía urbana de alta resolución. La mejora de imagen es un pendiente distinto, no una integración pendiente del bloque 3D.
- [x] Red fluvial completa del inventario oficial SITPA: 20.816 registros de eje natural/curso oculto, incluidos 10.140 sin nombre. PNOA de alta resolución sobre la base mundial en España. Integrado en `main` el 2026-10-06 desde `codex/hydrography-pnoa` por indicación del usuario; el estado del despliegue en producción requiere comprobación independiente. Se conservan IDs y alias de rías. Continuidad sin unir huecos inventados; selección por registro, no identidad agregada de río.

Verificación del bloque fluvial/PNOA: 103 tests, validador de atlas, lint y compilación correctos. QA en Edge automatizado: Redes en escritorio y móvil emulado (390 × 844), ortofoto urbana de Gijón a zoom 17, cambio plano/satélite y caída simulada de PNOA conservando el fondo mundial. WMS se utiliza porque sus zonas sin datos son transparentes; las teselas WMTS comprobadas eran opacas. Sigue pendiente la comprobación de rendimiento y gestos en dispositivos físicos. La compilación conserva el aviso conocido de tamaño del paquete de MapLibre.

- [x] Ampliación de cobertura física asturiana integrada en `main` el 2026-10-06 por indicación del usuario: 4.763 anotaciones de picos/montes/collados, 1.143 de sierras, 722 lagos, 19 embalses, 175 registros de protección y costa/playas con inventarios completos. Incluye monumentos puntuales, Natura 2000, Ramsar y biosfera; se conservan registros sin nombre y fragmentos sin etiquetarlos. Parques zonificados como Redes se seleccionan conjuntamente sin mezclar sus figuras de protección. Se mantienen URLs antiguas mediante `legacyIds`. No se afirma despliegue en producción. La generalización del pipeline a nuevas regiones permanece pendiente en el backlog.

Verificación de la ampliación: 119 tests, inventarios/checksums, lint y build correctos. Edge automatizado comprobó búsqueda/selección de Pico Carda y Monte Areo, monumentos puntuales y filtro en móvil emulado, y selección de Redes completa desde un ID de zona. Sin errores de consola en esa pasada. Todos los IDs del catálogo anterior siguen disponibles directa o indirectamente mediante alias (17 alias de parques). La revisión independiente detectó y permitió corregir esa incompatibilidad, pero no llegó a emitir un veredicto completo por límite de uso del agente. Sigue pendiente revisión de rendimiento en dispositivos físicos.

## Decisión pendiente: arquitectura de datos y backend

El diseño del backend se ha pospuesto intencionadamente. Hoy se publica un snapshot GeoJSON con la web, se usan funciones de Vercel para las API de transporte y se guardan originales GTFS en Blob. Esto resuelve la primera cobertura, pero no determina cómo se almacenarán, consultarán y actualizarán datos cuando el atlas crezca.

**PostGIS es una posibilidad por estudiar, no una decisión tomada.** Hay que comparar al menos estas opciones con casos y costes reales: continuar con archivos versionados y funciones, introducir una base espacial como PostGIS, o combinar una base para preparación/consultas con artefactos estáticos para servir el mapa. La elección debe responder a necesidades medidas, no al mero aumento del número de entidades.

Antes de escoger, definir y medir:

- Próximas coberturas y volumen de geometrías, métricas, búsquedas y relaciones; frecuencia de actualización y consultas espaciales necesarias.
- Tiempo de carga, tamaño transferido y coste para móvil en mapas regionales y urbanos.
- Proceso de importación, validación, publicación atómica, conservación de la última versión válida y reversión.
- Almacenamiento compartido para tiempo real, caducidad y comportamiento cuando se multiplican las instancias serverless.
- Coste operativo, copias de seguridad, migraciones, observabilidad y dependencia de proveedores.
- Contratos que seguirán siendo públicos y estables: IDs, fuentes, licencias, fechas, manifiesto y URLs compartibles.

El resultado de ese estudio debe quedar en una decisión de arquitectura con una prueba de carga representativa y un plan de migración. Hasta entonces, no asumir PostGIS ni diseñar nuevas funciones como si ya existiera una base de datos.

## Datos y cobertura

- La cobertura fluvial se comprueba ahora contra inventario de IDs y recuentos; no volver a introducir el antiguo filtro de nombre/longitud >5 km. La fuente contiene 14.979 ejes y 5.837 cursos ocultos, no 20.816 ríos distintos ni una garantía de que esté cartografiado cada cauce real. Investigar una identidad agregada por río solo con relaciones verificables, sin agrupar afluentes por nombre/proximidad.
- [ ] Generalizar y automatizar el pipeline territorial y físico para nuevas regiones. La cobertura asturiana está corregida, pero eso no implica que el pipeline sea ya reutilizable: conserva rutas, prefijos, capas y validaciones específicos de Asturias. Objetivo: configurar un adaptador por proveedor/cobertura, sin corregir manualmente cada río, pico, sierra o espacio protegido.
  - Separar la configuración de fuentes (cobertura, licencia, campos de identidad/nombre, tipos y relaciones oficiales) del procesamiento común: descarga completa, normalización, reproyección, validación, simplificación y publicación.
  - Parametrizar namespaces, rutas, colecciones del manifiesto y validaciones; eliminar referencias regionales del núcleo compartido, conservándolas únicamente en los adaptadores.
  - Agrupar automáticamente mediante identificadores y relaciones oficiales. Las asociaciones basadas solo en nombres requieren reglas verificables por fuente; no unir geometrías por parecido o proximidad sin respaldo ni inventar continuidad entre tramos.
  - Generar un informe de calidad con registros incompletos, anotaciones fragmentadas y relaciones ambiguas. Conservar los originales y señalar las limitaciones sin imponer correcciones entidad por entidad.
  - Criterios de aceptación: ejecutar el mismo pipeline en Asturias y una segunda cobertura real mediante configuración/adaptadores; verificar inventarios completos, IDs estables, URLs compatibles, relaciones válidas, agrupaciones reproducibles y conservación de la última versión válida ante fallos. Documentar cómo incorporar otra fuente y cubrirlo con pruebas automatizadas.
  - Este bloque no depende de elegir PostGIS u otro backend. Se puede generalizar el procesamiento con la publicación actual; la fragmentación y el almacenamiento remoto se estudiarán por separado.
- Estudiar fragmentación por cobertura, concejo o ciudad y carga desde el manifiesto para evitar colecciones GeoJSON monolíticas. La estrategia concreta depende del estudio de backend.
- Medir la cobertura física completa en móviles reales y conexiones lentas: tras añadir las demás capas y conservar topología de las zonas, snapshot asturiano ~49,62 MB sin comprimir / ~8,98 MB con gzip; catálogo ~13,85 MB / ~1,23 MB con gzip (medición local, no tamaño transferido garantizado). Graduar el dibujo no elimina el coste de descargar/procesar toda la colección. La QA debe esperar también al worker GeoJSON tras cambiar de fondo; `networkidle` por sí solo no prueba que ya se dibujen los cauces. Estudiar fragmentación por cobertura/escala sin volver a excluir datos del inventario.
- Persistir relaciones verificables entre sierras y sus picos; la asociación actual por proximidad es una heurística de interfaz.
- Preparar la publicación de territorios históricos y culturales y métricas `MetricValue` completas solo cuando existan fuentes, contratos y presentación adecuados.
- Ampliar accidentes físicos y considerar rutas de montaña con fuentes y licencias comprobadas, sin deducir geometrías o relaciones de rótulos incompletos.

## Transporte y actualización

- Completar el flujo del cron GTFS: hoy descarga ZIP a Blob, pero no normaliza, valida ni publica un nuevo snapshot. Definir la promoción y reversión tras decidir la arquitectura de datos; mantener mientras tanto el último GTFS válido.
- Guardar el último resultado de Renfe Realtime de forma compartida si se requiere continuidad entre instancias; ahora el respaldo vive en la memoria de cada función.
- Eliminar de forma controlada los ficheros de salidas de paradas desaparecidas al importar un feed nuevo.
- Restaurar selecciones de línea, parada y vehículo desde la URL, igual que las selecciones territoriales y físicas.
- Investigar barco y avión cuando haya feeds reutilizables y una cobertura útil; conservar filtros por medio y proveedor sin presentar datos ficticios como servicio activo.

## Experiencia y calidad

- Comprobar gestos multitáctiles en dispositivos físicos; la implementación 3D está entregada, pero la revisión en navegador emulado no sustituye esa comprobación manual.
- Ampliar detalle de imágenes a otras coberturas verificadas. PNOA en España ya está implementado; fuera de esa cobertura la base mundial sigue limitada a 10 m. No prometer transiciones invisibles entre fechas/colores distintos ni capacidad ilimitada de servicios públicos.
- Fotogrametría de edificios queda fuera; las extrusiones simplificadas con geometrías y alturas disponibles de OSM ya forman parte del bloque entregado.

- Hacer que los mensajes introductorios del panel respondan al área visible hasta una escala razonable, sin sustituir una selección explícita de parroquia o barrio.
- Incorporar pruebas E2E con fuentes simuladas, regresión visual en móvil/tableta/escritorio y auditoría automatizada de accesibilidad; mantener revisión manual para gestos y mapa.
- Medir y optimizar el peso del paquete de MapLibre, actualmente separado mediante carga perezosa.
- Armonizar las versiones de Node y los puertos de Docker/Task con el entorno de despliegue.

## Orden orientativo

1. Estudiar backend, cargas y estrategia de publicación; documentar la decisión.
2. Automatizar la actualización GTFS y asegurar su reversión conforme a esa decisión.
3. Generalizar y fragmentar datos al incorporar la siguiente cobertura.
4. Trabajar la experiencia y la batería de pruebas junto a cada ampliación.

Este orden puede cambiar según las pruebas de uso. Cada tarea cerrada debe incluir los cambios de contrato, validación y documentación que correspondan.
