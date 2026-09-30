import { describe, expect, it } from 'vitest'
import { beachDisplayName, coastalKind } from './sync-physical-coast.mjs'
import { buildPhysicalContext } from './sync-physical-context.mjs'

describe('toponimia costera sin identidades inventadas', () => {
  it('añade Playa una sola vez y conserva variantes ya completas', () => {
    expect(beachDisplayName('San Lorenzo')).toBe('Playa de San Lorenzo')
    expect(beachDisplayName('Playa de Toró')).toBe('Playa de Toró')
    expect(beachDisplayName('Playas de Xagó')).toBe('Playas de Xagó')
    expect(beachDisplayName('El Figus')).toBe('Playa del Figus')
    expect(beachDisplayName('La Isla')).toBe('Playa de la Isla')
    expect(beachDisplayName('De Poniente')).toBe('Playa de Poniente')
    expect(beachDisplayName('Del Silencio')).toBe('Playa del Silencio')
    expect(beachDisplayName('De La Isla')).toBe('Playa de la Isla')
    expect(beachDisplayName('')).toBe('')
  })
  it('no presenta rótulos ambiguos como bahías ni junta fragmentos CAD', () => {
    const kind = (text, layer = '050412') => coastalKind({ properties: { text, layer } })
    expect(kind('Ensenada de Xagó')).toBe('bay')
    expect(kind('Islote Ladrona')).toBe('island')
    expect(kind('Puerto Llamperu')).toBe('coast')
    expect(kind('Ensenada De')).toBeNull()
    expect(kind('E N S E N A D A')).toBeNull()
    expect(kind('Ría de Villaviciosa', '050404')).toBe('estuary')
  })
})

it('no confunde una caja que cruza el antimeridiano con una geometría europea', () => {
  const geometry = { type: 'MultiPolygon', coordinates: [
    [[[179, 63], [180, 63], [180, 64], [179, 63]]],
    [[[-180, 63], [-179, 63], [-179, 64], [-180, 63]]],
  ] }
  const marine = { features: [{ geometry, properties: { featurecla: 'gulf', name_es: 'Golfo del Anádyr', ne_id: 555 } }] }
  expect(buildPhysicalContext(marine, { features: [] })).toEqual([])
})

it('importa golfos y deltas verificables con IDs estables y fuente explícita', () => {
  const geometry = { type: 'Polygon', coordinates: [[[-6, 44], [-4, 44], [-4, 46], [-6, 44]]] }
  const marine = { features: [{ geometry, properties: { featurecla: 'bay', name: 'Bay of Biscay', name_es: 'Golfo de Vizcaya', ne_id: 123 } }] }
  const regions = { features: [{ geometry, properties: { FEATURECLA: 'Delta', NAME: 'Danube Delta', NAME_ES: 'Delta del Danubio' } }] }
  const generated = buildPhysicalContext(marine, regions)
  expect(generated.map(({ properties }) => properties.kind)).toEqual(['gulf', 'delta'])
  expect(generated[0].id).toBe('physical-eu-gulf-123')
  expect(generated[0].properties.aliases).toContain('Bay of Biscay')
  expect(generated.every(({ properties }) => properties.sourceId === 'natural-earth' && properties.boundaryStatus === 'reference')).toBe(true)
  expect(buildPhysicalContext(marine, regions)).toEqual(generated)
})
