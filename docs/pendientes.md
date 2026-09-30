# Pendientes y decisiones abiertas

Esta nota recoge trabajo futuro; no describe funciones ya entregadas ni compromete una arquitectura. Revisarla al iniciar cada bloque de desarrollo y actualizarla cuando se tome una decisión o se cierre una tarea.

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
