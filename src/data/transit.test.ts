import { describe, expect, it } from 'vitest'
import { geometryBounds, transitMode, transitScope } from './transit'

describe('normalización cartográfica del transporte', () => {
  it('calcula el encuadre y el alcance de una ruta', () => {
    const local = { type: 'LineString' as const, coordinates: [[-5.86, 43.36], [-5.75, 43.42]] }
    const external = { type: 'LineString' as const, coordinates: [[-5.86, 43.36], [-3.7, 40.4]] }

    expect(geometryBounds(local)).toEqual([-5.86, 43.36, -5.75, 43.42])
    expect(transitScope(local)).toBe('local')
    expect(transitScope(external)).toBe('external')
  })

  it('respeta route_type y usa el proveedor únicamente como respaldo', () => {
    expect(transitMode({ id: '1', entityType: 'route', routeType: 4 })).toBe('ferry')
    expect(transitMode({ id: '2', entityType: 'route', routeType: 1100 })).toBe('air')
    expect(transitMode({ id: '3', entityType: 'route', provider: 'RENFE' })).toBe('rail')
    expect(transitMode({ id: '4', entityType: 'route', provider: 'CTA' })).toBe('bus')
  })
})
