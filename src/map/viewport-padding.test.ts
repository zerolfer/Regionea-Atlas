import { expect, it } from 'vitest'
import { viewportPadding } from './viewport-padding'

it('reserva el ancho real del panel abierto y libera el margen al plegarlo', () => {
  expect(viewportPadding(1440, 900, 'half', false)).toEqual({ top: 84, right: 36, bottom: 72, left: 432 })
  expect(viewportPadding(1000, 800, 'half', false)).toEqual({ top: 84, right: 36, bottom: 72, left: 396 })
  expect(viewportPadding(761, 800, 'half', false).left).toBe(389.5)
  expect(viewportPadding(1440, 900, 'half', true)).toEqual({ top: 84, right: 36, bottom: 72, left: 36 })
})

it('mantiene el encuadre de la hoja móvil aunque el escritorio se haya plegado', () => {
  expect(viewportPadding(390, 800, 'peek', true)).toEqual({ top: 82, right: 18, bottom: 84, left: 18 })
  expect(viewportPadding(390, 800, 'full', false)).toEqual({ top: 82, right: 18, bottom: 644, left: 18 })
})
