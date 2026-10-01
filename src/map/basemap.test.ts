import { expect, it } from 'vitest'
import { expression, featureFilter, validateStyleMin } from '@maplibre/maplibre-gl-style-spec'
import { buildStyle } from './style'

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
