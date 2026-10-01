# Fondos y terreno 3D

Estado: diseño y resolución aprobados por el usuario el 2026-10-01; implementado en `codex/basemap-terrain`, pendiente de revisión manual e integración. No hay cambios funcionales publicados.

## Experiencia acordada

- Selector «Capas» con «Plano» y «Satélite» en los tres modos. Plano sigue siendo el fondo inicial.
- Solo en físico: «Colores de altitud» y «Terreno y edificios 3D». El sombreado del plano físico permanece; no se añade un interruptor de sombreado.
- Los filtros superiores representan accidentes, no ajustes del fondo. Renombrar «Relieve» a «Sierras» para distinguir la capa de cordilleras del terreno.
- Cámara de terreno: inclinación inicial de 60° al activar 3D desde una vista plana y máximo de 80°, para acercarse al horizonte sin atravesar el terreno. No reiniciar inclinación ni orientación al cambiar filtros o fondo.
- Edificios simplificados con extrusiones de huellas OSM y alturas disponibles, solo a escala cercana. No son edificios fotorrealistas y no deben sugerir precisión donde la altura sea estimada.
- Conservar selección y encuadre al alternar fondos; compartir fondo, inclinación y orientación por URL. Mantener enlaces antiguos con `hypsometry` y `terrain3d` en `filtros`.
- Mantener las atribuciones accesibles y los controles sin solaparse con búsqueda, panel móvil o controles existentes. Arrastrar el panel no debe modificar la cámara.
- No incorporar claves obligatorias en el navegador, dependencias pesadas, cuentas, pagos ni cambios de backend.

## Fuente satelital propuesta y comprobaciones

### Detalle mundial: ESA WorldCover / Sentinel-2

Composición de color natural de 2021, resolución de 10 m; cobertura publicada entre latitudes −60° y 83°. Es adecuada para paisaje, no para reconocer fachadas o detalles urbanos como las ortofotos de Google. Un zoom mayor amplía píxeles, no aumenta la resolución original.

- [Datos, composiciones anuales y reutilización mediante servicios web](https://esa-worldcover.org/en/data-access).
- [Manual y licencia CC BY 4.0, sección 5.1](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf).
- [WMTS, capas públicas sin autenticación](https://docs.terrascope.be/Developers/WebServices/OGC/WMTSv2.html).
- [Condiciones de Terrascope](https://terrascope.be/en/terms-use): no degradar los servicios por carga elevada; disponibilidad sin garantía. Gratuito no significa capacidad ilimitada ni SLA.

Se comprobó el 2026-10-01: capacidades WMTS, capa `esa-worldcover-s2rgbnir-10m-2021-v2_tcc`, matrices EPSG:3857 de 6 a 14; una tesela de detalle devuelve HTTP 200, PNG y CORS para el origen del cliente, sin credenciales. Usar peticiones GetTile por parámetros: la plantilla REST anunciada no respondió correctamente en la comprobación. No descargar ni cachear conjuntos completos.

### Vista mundial y respaldo: NASA GIBS

Blue Marble proporciona una imagen mundial de menor resolución para zooms anteriores a 6 y para huecos en la cobertura de Sentinel-2. No es imagen actual ni fotografía urbana. Mantenerla debajo del detalle evita un fondo vacío sobre océanos y fuera de la cobertura, sin cambiar de proveedor según el centro del mapa.

- [Servicio e integración en bibliotecas](https://nasa-gibs.github.io/gibs-api-docs/map-library-usage/).
- [Uso y atribución de datos NASA](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy).
- Capacidades verificadas: `BlueMarble_NextGeneration`, `GoogleMapsCompatible_Level8`, teselas de 256 px; plantilla HTTPS publicada por NASA.

Mostrar fecha, resolución y fuentes en el selector/panel de atribuciones. No presentar este mosaico gratuito como equivalente visual de Google Earth.

## Fuera de este bloque

- Mezclar ortofotos regionales de mayor resolución al acercarse: el usuario lo ha reservado para una fase futura.
- Fotogrametría de edificios, 3D Tiles y nuevos motores de renderizado.
- Elegir un proveedor comercial o de cuota gratuita que requiera crear una cuenta, aceptar nuevas condiciones o introducir secretos: requiere una decisión explícita.
