import { describe, expect, it } from 'vitest'
import { bottomSheetHeight, nearestBottomSheetLevel } from './bottom-sheet'

describe('panel inferior', () => {
  it('mantiene el estado cerrado compacto y escala los otros niveles con la pantalla', () => {
    expect(bottomSheetHeight('peek', 800)).toBe(144)
    expect(bottomSheetHeight('half', 800)).toBe(344)
    expect(bottomSheetHeight('full', 800)).toBe(632)
  })

  it('ancla el panel al nivel más próximo a la altura alcanzada', () => {
    expect(nearestBottomSheetLevel(80, 800)).toBe('peek')
    expect(nearestBottomSheetLevel(330, 800)).toBe('half')
    expect(nearestBottomSheetLevel(620, 800)).toBe('full')
    expect(nearestBottomSheetLevel(230, 800)).toBe('peek')
    expect(nearestBottomSheetLevel(250, 800)).toBe('half')
  })

  it('reserva el área segura sin cortar la cabecera ni invertir los topes en pantallas bajas', () => {
    expect(bottomSheetHeight('peek', 800, 34)).toBe(178)
    expect(bottomSheetHeight('half', 320, 34)).toBe(178)
    expect(bottomSheetHeight('full', 320, 34)).toBe(253)
    expect(nearestBottomSheetLevel(200, 800, 34)).toBe('peek')
  })
})
