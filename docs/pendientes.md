# Pendientes y decisiones abiertas

Esta nota recoge trabajo futuro y el cierre de bloques ya entregados, sin comprometer una arquitectura. Revisarla al iniciar cada bloque de desarrollo y actualizarla cuando se tome una decisión o se cierre una tarea.

## Bloques entregados

- [x] Fondos y terreno 3D integrados en `main` y subidos al repositorio (cierre actualizado el 2026-10-06): selector «Tipo de mapa», plano/satélite, colores de altitud, cámara inclinada y edificios simplificados. Véanse el [diseño](superpowers/specs/2026-10-01-basemap-terrain.md) y los [resultados](superpowers/plans/2026-10-01-basemap-terrain.md). La resolución de 10 m del fondo mundial no equivale a ortofotografía urbana de alta resolución. La mejora de imagen es un pendiente distinto, no una integración pendiente del bloque 3D.

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

- Completar la red fluvial oficial de Asturias, sin excluir cursos por carecer de nombre o por tener tramos menores de 5 km. Diagnóstico del 2026-10-06: el importador impone ambos filtros y el snapshot incluye 233 geometrías fluviales; la capa oficial «Red fluvial» devuelve 14.979 registros de tipo «Línea de eje de río» al consultar sin esos filtros (registros/tramos, no ríos distintos). El servicio limita las respuestas a 1.000 registros: implementar paginación y validar recuentos/IDs antes de publicar. Graduar la visualización por escala, no descartar detalle durante la importación; no inventar topónimos para cursos sin nombre. Usar Redes como caso de regresión y comprobar qué otros tipos de cauce ofrece la fuente.
- Generalizar el pipeline territorial y físico, hoy específico de Asturias, mediante adaptadores por cobertura. Generalizar también el validador, cuyos recuentos y relaciones parentales son asturianos.
- Estudiar fragmentación por cobertura, concejo o ciudad y carga desde el manifiesto para evitar colecciones GeoJSON monolíticas. La estrategia concreta depende del estudio de backend.
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
- Mejorar la nitidez del fondo de imágenes: el proveedor mundial actual tiene 10 m por píxel y detalle hasta zoom 14; ampliar más no añade resolución. Propuesta pendiente de implementación: mantener el respaldo mundial y superponer ortofotos regionales por cobertura/zoom, empezando por PNOA en España. Verificar servicio, cobertura, licencia, CORS y rendimiento antes de integrar; mostrar atribuciones y diferencias de fecha/color sin prometer transiciones invisibles. Referencias: [resoluciones PNOA](https://pnoa.ign.es/pnoa-imagen/especificaciones-tecnicas) y [servicios web](https://pnoa.ign.es/web/portal/pnoa-imagen/visualizadores-y-servicios-web).
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
