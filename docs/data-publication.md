# Publicación y licencias de datos

La licencia MIT del repositorio cubre el código y la documentación propios. No concede derechos sobre datos, cartografía, imágenes o servicios de terceros.

## Fuentes territoriales y físicas

El manifiesto `public/data/atlas/manifest.json` identifica fuentes, licencias, fechas y colecciones. Mantenga esos metadatos y las atribuciones al redistribuir los datos. Natural Earth figura como dominio público; las colecciones identificadas como CC BY 4.0 requieren respetar sus condiciones y conservar la atribución y la información sobre las modificaciones.

Los barrios de SADEI figuran como «© SADEI; uso sujeto a su aviso legal». El [aviso legal de SADEI](https://www.sadei.es/sadei/sadei.es/aviso-legal_135_1_ap.html) consultado el 7 de octubre de 2026 no contiene una autorización expresa de redistribución. Falta documentar una licencia aplicable o autorización antes de dar por autorizada su publicación en un repositorio público. Estos datos también están incorporados a colecciones derivadas, como el catálogo y las etiquetas territoriales; excluir únicamente `neighborhoods.geojson` no los elimina de todo el snapshot ni del historial de Git.

## Transporte

El snapshot incluye datos de CTA, ALSA y Renfe. Las [condiciones del NAP](https://nap.transportes.gob.es/condiciones-uso) exigen aceptar previamente la licencia correspondiente y respetar sus condiciones. La [licencia de datos del NAP](https://nap.transportes.gob.es/licencia-datos) permite reutilización, pero mantiene las condiciones de las fuentes originales y establece que prevalece la más restrictiva en caso de discrepancia.

Antes de publicar el snapshot de transporte, registre para cada feed la fuente de descarga, la licencia aplicable, su aceptación cuando corresponda y las atribuciones exigidas. El manifiesto actual de transporte documenta proveedores y vigencia, pero no acredita esos permisos. No atribuya automáticamente MIT ni CC BY 4.0 a estos datos.

## Comprobaciones antes de hacer público el repositorio

- Revisar credenciales en los archivos actuales y en todo el historial que vaya a publicarse. `.gitignore` no elimina archivos ya versionados ni versiones antiguas.
- Mantener los archivos de entorno reales fuera de Git; los ejemplos solo deben contener valores ficticios.
- Resolver los permisos pendientes de SADEI y de los feeds de transporte, conservando las pruebas y las atribuciones.
- Comprobar el acceso al remoto y la cuenta de GitHub antes de cambiar la visibilidad.
- Si se decide excluir datos, revisar también sus derivados y el historial. No reescribir un historial compartido sin autorización expresa.
