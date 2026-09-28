# Documentación técnica

Esta documentación describe la implementación que existe en el repositorio. Distingue entre contratos que deben preservarse y procedimientos que pueden evolucionar.

## Lectura recomendada

1. [Arquitectura y alcance](architecture.md): límites del producto, flujo de ejecución y responsabilidades de cada módulo.
2. [Contratos de datos](contracts.md): formas persistidas, identificadores, relaciones, manifiestos y API.
3. [Ampliación y pipelines](data-extension-guide.md): regenerar el atlas y añadir territorios, accidentes, coberturas u operadores.
4. [Operación y calidad](operations.md): configuración, pruebas, PWA, Vercel, Git, despliegue y diagnóstico.

`src/types.ts` es la referencia para los tipos que consume el cliente. Los documentos anteriores son la referencia humana; cuando difieran del código o de `scripts/validate-atlas-data.mjs`, prevalece el contrato ejecutable y la discrepancia debe corregirse en el mismo cambio.

## Principios de mantenimiento

- Los datos publicados son artefactos: deben poder reconstruirse, validarse y atribuirse.
- Un identificador publicado es estable. Un cambio de nombre no debe cambiarlo.
- Ninguna geometría se presenta como más oficial de lo que declara su `boundaryStatus`.
- La clasificación cartográfica de transporte se calcula en importación y se valida; el navegador no la deduce.
- Asturias es la primera cobertura detallada, no una frontera arquitectónica de Regionea Atlas.
- No se incorporan datos sin fuente y licencia verificables.
- Los cambios de contrato requieren migración del snapshot, validador y documentación en el mismo commit o serie trazable.

