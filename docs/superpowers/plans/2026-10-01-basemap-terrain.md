# Fondos y terreno 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir explorar montañas de perfil y alternar fondos sin mezclar presentación con filtros geográficos.

**Architecture:** Reutilizar React, MapLibre y las fuentes vectoriales/DEM existentes. Separar `MapAppearance` de `PhysicalFilter`; conservar compatibilidad URL. Añadir fuentes raster públicas mundiales bajo los datos del atlas, sin modificar el backend.

**Tech Stack:** React 19, TypeScript, MapLibre 6, Vitest y navegador de pruebas.

**Spec:** [Diseño y fuentes](../specs/2026-10-01-basemap-terrain.md). Resolución satelital aprobada el 2026-10-01.

## Global Constraints

- «Plano» y «Satélite» en los tres modos; ajustes de altitud y 3D solo en físico.
- Inclinación inicial 60° desde plano; máximo 80°.
- No incorporar claves obligatorias en el navegador, dependencias pesadas, cuentas, pagos ni cambios de backend.
- Mantener enlaces antiguos, selección, encuadre y la cámara estable durante gestos del panel.
- No publicar ni prometer imagen urbana de alta resolución; Sentinel-2 es un compuesto de 2021 a 10 m.
- Trabajar en rama Git, preservar cambios ajenos y no hacer merge/push sin nueva autorización.

## Review Focus

1. URLs antiguas sin inclinación: recuperar 3D sin perder filtros geográficos.
2. Cambio de geometrías/fondo durante 3D: mantener cámara y selección.
3. Tiempo de carga, océanos o cobertura ausente: conservar un fondo visible y explicar disponibilidad.
4. Alturas OSM ausentes o `hide_3d`: no fabricar edificios altos ni mostrar partes excluidas.
5. Panel móvil, búsqueda y teclado: selector accesible, sin solapamientos ni saltos de cámara.

---

### Task 1: Estado compartible y selector — completada

**Files:** `src/types.ts`, `src/url-state.ts`, `src/App.tsx`, `src/map/physical.ts`, `src/index.css`; crear `src/components/MapLayers.tsx` y su prueba; ampliar `src/App.url.test.ts`.

**Interfaces:**
- Produce `MapAppearance = { basemap: 'plan' | 'satellite'; hypsometry: boolean; terrain3d: boolean }`.
- `ViewState` añade `pitch?: number` y `bearing?: number` con valores por defecto seguros.
- `parseInitialUrl()` añade `appearance`; `filters` contiene solo accidentes. Serialización conserva `hypsometry`/`terrain3d` en `filtros` por compatibilidad, y añade `fondo=satelite`, `pitch` y `bearing` cuando corresponda.
- `MapLayers({ mode, value, onChange })` consume `MapMode`, `MapAppearance` y `(next: MapAppearance) => void`.

- [ ] Escribir pruebas de URL: `fondo=satelite&filtros=peaks,hypsometry,terrain3d&pitch=74&bearing=125` restaura apariencia y cámara; `filters` solo incluye `peaks`. Limitar `pitch=999` a 80, usar 60 para enlace antiguo de 3D sin pitch; ignorar fondo desconocido.
- [ ] Escribir pruebas del selector: fondos en todos los modos; ajustes únicamente en físico; Escape devuelve foco; pulsación exterior cierra; no aparece interruptor «Sombreado».
- [ ] Ejecutar `npx vitest run src/App.url.test.ts src/components/MapLayers.test.tsx` y confirmar fallos esperados.
- [ ] Implementar contratos, selector y migración URL según los valores anteriores; renombrar el filtro de cordilleras a «Sierras».
- [ ] Repetir las pruebas y confirmar que pasan.
- [ ] Commit: `feat: separate basemap appearance from geographic filters`.

### Task 2: Renderizado y cámara — completada

**Files:** `src/map/style.ts`, `src/map/MapView.tsx`; crear `src/map/basemap.test.ts`; ampliar `src/map/MapView.test.tsx`.

**Interfaces:**
- Consume `MapAppearance` y `ViewState` de Task 1.
- Produce `buildStyle(mode: MapMode, basemap?: MapAppearance['basemap']): StyleSpecification` y prop `appearance: MapAppearance` de `MapView`.
- `onViewportChange` incluye inclinación y orientación reales, no una estimación del cliente.

- [ ] Escribir pruebas reales de estilos: validación MapLibre sin errores en los tres modos, raster debajo de datos, sin raster satelital en plano, detalle limitado a zooms 6–14 y respaldo mundial debajo. Evaluar filtro de edificios con `hide_3d`; altura ausente no crea extrusión ficticia.
- [ ] Escribir pruebas de cámara en la frontera WebGL: filtros y cambios de fondo no fuerzan pitch; activar 3D desde plano usa 60; panel conserva la prueba existente de no mover cámara. Vista compartida restaura pitch y bearing sin animación inicial contradictoria.
- [ ] Ejecutar `npx vitest run src/map/basemap.test.ts src/map/MapView.test.tsx` y confirmar fallos esperados.
- [ ] Añadir fuentes comprobadas en el diseño, ocultar superficies opacas del plano en satélite; conservar datos/etiquetas. Separar aplicación de terreno/altitud de los filtros; extrusiones OSM cercanas, sin fotogrametría. Configurar maxPitch 80; animar solo cambios explícitos de 3D, respetando movimiento reducido.
- [ ] Repetir pruebas; verificar una tesela real desde el navegador y una caída del proveedor con respaldo visible. No usar solicitudes por debajo del mínimo WMTS publicado.
- [ ] Commit: `feat: add global satellite basemap and horizon terrain camera`.

### Task 3: Contratos, regresión y entrega

**Files:** actualizar `docs/contracts.md`, `docs/architecture.md`, `docs/pendientes.md` y resultados de este plan.

**Interfaces:** documentar estado URL y orden de capas implementados; no cambiar los contratos de datasets GeoJSON.

- [ ] Documentar fuentes, atribuciones, fechas, resolución, límites de servicio y cómo sustituir el proveedor sin tocar filtros geográficos.
- [ ] Ejecutar `npm test`, `npm run lint` y `npm run build`; corregir regresiones.
- [ ] Revisar en escritorio y móvil: físico montaña/cámara 3D, ciudad/edificios; fondos en político/transporte; selección y URL restauradas; océanos; panel abierto/cerrado; búsqueda sobre panel; teclado y Escape. Recoger capturas fuera del repositorio.
- [ ] Solicitar una revisión independiente acotada, corregir hallazgos y repetir comprobaciones afectadas.
- [ ] Commit: `docs: document basemap contracts and deferred imagery enhancements`.
- [ ] Entregar para revisión manual. No hacer merge/push hasta autorización.

## Auto-revisión

Los requisitos están cubiertos por las tres tareas; los cinco riesgos tienen comprobaciones asignadas. No introduce backend ni trabajo fotogramétrico. Recomendada ejecución nativa: interfaz, estado y MapLibre están estrechamente relacionados y no precisan implementadores paralelos.

## Resultados de implementación, 2026-10-01

- Task 1: pruebas URL/selector RED (5 fallos esperados) → GREEN; suite completa 72/72, validación de datos, lint y build correctos. Commit `a08b67a`.
- Task 2: pruebas de estilos/cámara RED (4 fallos esperados) → GREEN; regresiones adicionales para cambios tras restaurar URL, inclinación cero explícita y registro de errores ajenos al satélite. Suite completa 80/80, validadores, lint y build correctos. Commit `30c558e`.
- Navegador real: montaña satelital a 74°, edificios de Gijón a 70°, fondos político/transporte, búsqueda de Pico Urriellu con navegación conservando orientación, hoja en sus tres estados sin modificar cámara y selector manejable mediante teclado/Escape.
- QA responsive: 1280×720, 850×720 y 390×844. Corregido solapamiento inicial del botón Capas con la hoja móvil abierta; queda a 116–160 px, antes del tope superior de la hoja (177 px). En escritorio estrecho queda por encima del cambio de modo. Atribución sigue anclada abajo.
- Caída simulada de Terrascope: imagen general NASA visible, terreno y entidades conservados, un aviso sin reiniciar cámara. Restaurada la red de la pestaña de prueba.
- Limitaciones de verificación: el gesto multitáctil se mantiene en MapLibre, pero requiere revisión manual en un dispositivo físico; imagen de 10 m no aporta detalle urbano adicional al ampliar. Advertencia conocida de tamaño del chunk MapLibre en build, sin errores de compilación.
- Task 3: documentación actualizada; revisión independiente y entrega pendientes. Sin merge ni push.
