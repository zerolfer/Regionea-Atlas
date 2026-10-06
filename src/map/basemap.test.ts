import { expect, it } from 'vitest'
import { expression, featureFilter, validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import { buildStyle } from './style'

it('dibuja monumentos protegidos puntuales sin convertir vértices de polígonos en marcadores', () => {
  const style = buildStyle('physical')
  const points = style.layers.find(layer => layer.id === 'physical-protected-points')!
  expect(points?.type).toBe('circle')
  if (points.type !== 'circle') throw new Error('Expected protected point layer')
  const filter = featureFilter(points.filter, 'filter').filter
  expect(filter({ zoom: 13 }, { type: 'Point', properties: { kind: 'protected-area' } })).toBe(true)
  expect(filter({ zoom: 13 }, { type: 'Polygon', properties: { kind: 'protected-area' } })).toBe(false)
  expect(validateStyleMin(style)).toEqual([])
})

it('superpone PNOA transparente de España al acercarse sin pedirlo en plano ni sustituir la base mundial', () => {
  for (const mode of ['physical', 'political', 'transit'] as const) {
    const plain = buildStyle(mode, 'plan')
    expect(plain.sources['satellite-pnoa-mainland']).toBeUndefined()
    const style = buildStyle(mode, 'satellite')
    const source = style.sources['satellite-pnoa-mainland']
    expect(source).toMatchObject({ type: 'raster', minzoom: 12, maxzoom: 19, bounds: [-9.5, 35.5, 4.5, 44] })
    if (source.type !== 'raster') throw new Error('Expected raster')
    expect(source.tiles?.[0]).toContain('FORMAT=image/png')
    expect(source.tiles?.[0]).toContain('REQUEST=GetMap')
    expect(source.tiles?.[0]).toContain('TRANSPARENT=TRUE')
    expect(source.tiles?.[0]).toContain('BBOX={bbox-epsg-3857}')
    expect(source.attribution).toMatch(/IGN|PNOA/)
    expect(style.sources['satellite-pnoa-canaries']).toMatchObject({ bounds: [-18.5, 27.5, -13, 29.5] })
    const regional = style.layers.findIndex(l => l.id === 'satellite-pnoa-mainland')
    expect(regional).toBeGreaterThan(style.layers.findIndex(l => l.id === 'satellite-detail'))
    expect(regional).toBeLessThan(style.layers.findIndex(l => l.id === 'user-location-dot'))
    expect(validateStyleMin(style)).toEqual([])
  }
})

it('los cursos menores aparecen al acercarse sin cortar los tramos de un río principal', () => {
  const style = buildStyle('physical', 'satellite')
  const rivers = style.layers.find(l => l.id === 'physical-rivers')!
  if (rivers.type !== 'line') throw new Error('Expected line')
  const opacity = expression.createExpression(rivers.paint!['line-opacity'], 'layers[0].paint.line-opacity')
  if (opacity.result !== 'success') throw new Error('Invalid opacity')
  expect(opacity.value.evaluate({ zoom: 9 }, { type: 'LineString', properties: { minZoom: 12 } })).toBe(0)
  expect(opacity.value.evaluate({ zoom: 9 }, { type: 'LineString', properties: { minZoom: 7.5 } })).toBeGreaterThan(0)
  expect(opacity.value.evaluate({ zoom: 13 }, { type: 'LineString', properties: { minZoom: 12 } })).toBeGreaterThan(0)
  expect(rivers.layout?.['line-cap']).toBe('round')
})

it('las etiquetas satelitales tienen un halo blanco fino sin alterar las etiquetas del plano', () => {
  for (const mode of ['physical', 'political', 'transit'] as const) {
    const satellite = buildStyle(mode, 'satellite')
    expect(validateStyleMin(satellite)).toEqual([])
    const labels = satellite.layers.filter((layer) => layer.type === 'symbol' && layer.layout?.['text-field'])
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      if (label.type !== 'symbol') continue
      expect(label.paint?.['text-halo-color']).toBe('#ffffff')
      expect(label.paint?.['text-halo-width']).toBe(1)
      expect(label.paint?.['text-halo-blur']).toBe(0)
    }
    const plainLabel = buildStyle(mode, 'plan').layers.find((layer) => layer.type === 'symbol' && layer.layout?.['text-field'])!
    if (plainLabel.type === 'symbol') expect(plainLabel.paint?.['text-halo-color']).not.toBe('#ffffff')
  }
})

it('no solicita imágenes satelitales en plano y mantiene un respaldo mundial bajo el detalle', () => {
  for (const mode of ['physical', 'political', 'transit'] as const) {
    expect(buildStyle(mode, 'plan').sources['satellite-detail']).toBeUndefined()
    const style = buildStyle(mode, 'satellite')
    expect(validateStyleMin(style)).toEqual([])
    expect(style.sources['satellite-detail']).toMatchObject({ type: 'raster', minzoom: 6, maxzoom: 14, bounds: [-180, -60, 180, 83] })
    const fallback = style.layers.findIndex(({ id }) => id === 'satellite-overview')
    const detail = style.layers.findIndex(({ id }) => id === 'satellite-detail')
    expect(fallback).toBeGreaterThan(0)
    expect(detail).toBeGreaterThan(fallback)
    expect(detail).toBeLessThan(style.layers.findIndex(({ id }) => id === 'user-location-dot'))
    expect(style.layers.filter(({ id }) => /base-.*(water|landcover|buildings|roads|parks)/.test(id))).toHaveLength(0)
    const hillshade = style.layers.find(({ id }) => id === 'hillshade')
    if (hillshade) expect(hillshade.layout?.visibility).toBe('none')
  }
})

it('excluye partes hide_3d y no inventa alturas para edificios sin datos', () => {
  const style = buildStyle('physical', 'satellite')
  const buildings = style.layers.find(({ id }) => id === 'buildings-3d')!
  expect(buildings?.type).toBe('fill-extrusion')
  if (buildings.type !== 'fill-extrusion') throw new Error('Expected extrusion layer')
  expect(buildings.minzoom).toBeGreaterThanOrEqual(14)
  expect(buildings.layout?.visibility).toBe('none')
  const filter = featureFilter(buildings.filter, 'filter').filter
  expect(filter({ zoom: 16 }, { type: 'Polygon', properties: { hide_3d: true, render_height: 20 } })).toBe(false)
  expect(filter({ zoom: 16 }, { type: 'Polygon', properties: { hide_3d: false, render_height: 20 } })).toBe(true)
  const compiled = expression.createExpression(buildings.paint!['fill-extrusion-height'], 'layers[0].paint.fill-extrusion-height')
  if (compiled.result !== 'success') throw new Error('Invalid height expression')
  expect(compiled.value.evaluate({ zoom: 16 }, { type: 'Polygon', properties: { render_height: 24 } })).toBe(24)
  expect(compiled.value.evaluate({ zoom: 16 }, { type: 'Polygon', properties: {} })).toBe(0)
})
