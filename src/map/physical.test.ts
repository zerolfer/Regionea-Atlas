import { describe, expect, it } from 'vitest'
import { featureFilter } from '@maplibre/maplibre-gl-style-spec'
import type { AtlasEntity } from '../types'
import { ALL_PHYSICAL_FILTERS } from '../url-state'
import { availablePhysicalFilters, physicalSelectionFilter } from './physical'
import { buildStyle } from './style'

describe('selección física por tipo de geometría', () => {
  it('un polígono o una línea no dibujan círculos en sus vértices', () => {
    const filter = featureFilter(physicalSelectionFilter('selected', 'Point'), 'layers[0].filter').filter
    expect(filter({ zoom: 10 }, { type: 'Polygon', properties: { id: 'selected' } })).toBe(false)
    expect(filter({ zoom: 10 }, { type: 'LineString', properties: { id: 'selected' } })).toBe(false)
    expect(filter({ zoom: 10 }, { type: 'Point', properties: { id: 'selected' } })).toBe(true)
    expect(filter({ zoom: 10 }, { type: 'Point', properties: { id: 'other' } })).toBe(false)
  })

  it('las capas europeas y regionales arrancan con selección tipada', () => {
    const style = buildStyle('physical')
    for (const prefix of ['physical', 'physical-europe']) {
      for (const [suffix, type] of [['point', 'Point'], ['line', 'LineString'], ['fill', 'Polygon']] as const) {
        const layer = style.layers.find(({ id }) => id === `${prefix}-selected-${suffix}`)!
        expect('filter' in layer && layer.filter).toEqual(physicalSelectionFilter(undefined, type))
      }
    }
  })
})

it('oculta Valles sin datos y lo vuelve a ofrecer si se incorporan valles', () => {
  expect(availablePhysicalFilters([], ALL_PHYSICAL_FILTERS)).not.toContain('valleys')
  expect(availablePhysicalFilters([{ kind: 'valley' } as AtlasEntity], ALL_PHYSICAL_FILTERS)).toContain('valleys')
  expect(availablePhysicalFilters([{ kind: 'gulf' } as AtlasEntity, { kind: 'delta' } as AtlasEntity], ALL_PHYSICAL_FILTERS)).toContain('coast')
})

it('etiqueta ríos a escala regional y refuerza el nombre del río seleccionado', () => {
  const style = buildStyle('physical')
  const river = style.layers.find(({ id }) => id === 'physical-river-labels')!
  expect(river.minzoom).toBeLessThanOrEqual(8)
  expect(style.layers.some(({ id }) => id === 'physical-selected-river-label')).toBe(true)
  expect(style.layers.some(({ id }) => id === 'physical-europe-marine-labels')).toBe(true)
})

it('no representa golfos, bahías, deltas ni rías mediante marcadores puntuales', () => {
  const style = buildStyle('physical')
  const pointLayer = style.layers.find(({ id }) => id === 'physical-coast-points')!
  const normal = featureFilter('filter' in pointLayer ? pointLayer.filter : undefined, 'layers[0].filter').filter
  const selected = featureFilter(physicalSelectionFilter('selected', 'Point'), 'layers[0].filter').filter
  for (const kind of ['gulf', 'bay', 'delta', 'estuary']) {
    const feature = { type: 'Point' as const, properties: { id: 'selected', kind } }
    expect(normal({ zoom: 12 }, feature)).toBe(false)
    expect(selected({ zoom: 12 }, feature)).toBe(false)
  }
  const gulf = style.layers.find(({ id }) => id === 'physical-europe-coasts')!
  expect(gulf.maxzoom).toBeUndefined()
  expect(style.layers.some(({ id, type }) => id === 'physical-coastal-selected-area' && type === 'fill')).toBe(true)
})
