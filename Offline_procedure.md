# Política online-first de Regionea Atlas

Regionea Atlas es una PWA online-first. El service worker conserva el armazón de la interfaz —HTML, CSS, JavaScript, iconos y tipografías— para que la aplicación pueda arrancar con rapidez y mostrar un estado comprensible cuando no hay conexión.

Las colecciones GeoJSON, el fondo cartográfico y los datos de transporte no se precargan. Esta decisión evita descargas masivas, datos obsoletos y consumo de almacenamiento inesperado. Los originales locales del antiguo prototipo pueden permanecer en el equipo del desarrollador, pero no forman parte de la compilación ni del contexto de la aplicación.

## Comportamiento esperado

- Con conexión, el cliente carga `manifest.json`, el catálogo y las colecciones necesarias para el modo y la escala actuales.
- Sin conexión, se abre la interfaz cacheada y se informa si una colección requerida no está disponible.
- El navegador puede reutilizar respuestas HTTP recientes conforme a sus cabeceras, pero no se ofrece una descarga cartográfica completa.
- Los feeds GTFS estáticos conservan la última versión válida en servidor.
- El proxy GTFS-Realtime usa una caché corta y etiqueta cada respuesta como `live`, `stale` o `unavailable`.

## Evolución futura

Si se incorpora un modo offline, deberá ser explícito y limitado por ámbito: el usuario escogerá territorio, capas, tamaño estimado y fecha de actualización. Esa función requerirá política de caducidad, control de cuota, borrado visible y pruebas específicas; no debe añadirse como efecto lateral de instalar la PWA.
