import { describe, expect, it, vi } from 'vitest'
import type { AtlasEntity, TransitSelection } from '../types'
import { fitEntityBounds, focusPoint, SelectionFocusController } from './selection-focus'

function camera() {
  return {
    getPadding: () => ({ top: 82, right: 18, bottom: 340, left: 18 }),
    stop: vi.fn(), easeTo: vi.fn(), fitBounds: vi.fn(),
  }
}
const entity = { id: 'river', bbox: [-6, 43, -5.9, 43.2] } as AtlasEntity

it.each([
  { padding: { top: 82, right: 18, bottom: 679, left: 18 }, offset: [0, -298.5] },
  { padding: { top: 82, right: 18, bottom: 84, left: 18 }, offset: [0, -1] },
  { padding: { top: 84, right: 36, bottom: 72, left: 432 }, offset: [198, 6] },
])('centra una ubicación en el espacio libre sin guardar márgenes: $offset', ({ padding, offset }) => {
  const map = camera()
  focusPoint(map, [-5.6, 43.5], 11, padding, 850)
  expect(map.stop).toHaveBeenCalledOnce()
  expect(map.easeTo).toHaveBeenCalledWith({ center: [-5.6, 43.5], zoom: 11, offset, duration: 850 })
})

describe('navegación explícita al seleccionar un resultado', () => {
  it('no pierde la búsqueda mientras se carga o cambia el estilo', () => {
    const map = camera()
    const controller = new SelectionFocusController()
    const request = { selected: entity, transitSelection: null, focusRequestToken: 1 }
    controller.apply(map, request, false)
    expect(map.fitBounds).not.toHaveBeenCalled()
    controller.apply(map, request, true)
    expect(map.fitBounds).toHaveBeenCalledOnce()
    // Source/tile requests can remain pending after style.load.
    controller.apply(map, request, true)
    expect(map.fitBounds).toHaveBeenCalledOnce()
  })

  it('espera al catálogo y permite buscar dos veces el mismo resultado', () => {
    const map = camera()
    const controller = new SelectionFocusController()
    controller.apply(map, { selected: null, transitSelection: null, focusRequestToken: 1 }, true)
    controller.apply(map, { selected: entity, transitSelection: null, focusRequestToken: 1 }, true)
    controller.apply(map, { selected: entity, transitSelection: null, focusRequestToken: 2 }, true)
    expect(map.fitBounds).toHaveBeenCalledTimes(2)
  })

  it('no reencuadra por pulsar el mapa ni por cambiar la apertura del panel', () => {
    const map = camera()
    const controller = new SelectionFocusController()
    controller.apply(map, { selected: entity, transitSelection: null, focusRequestToken: 0 }, true)
    expect(map.fitBounds).not.toHaveBeenCalled()
    controller.apply(map, { selected: entity, transitSelection: null, focusRequestToken: 1 }, true)
    controller.apply(map, { selected: { ...entity, id: 'clicked' }, transitSelection: null, focusRequestToken: 1 }, true)
    expect(map.fitBounds).toHaveBeenCalledOnce()
  })

  it('respeta los paneles y no acumula padding al encadenar búsquedas', () => {
    const map = camera()
    const padding = { top: 82, right: 18, bottom: 340, left: 18 }
    fitEntityBounds(map, entity.bbox!, 13, padding)
    fitEntityBounds(map, entity.bbox!, 13, padding)
    const options = { padding: { top: 94, right: 30, bottom: 352, left: 30 }, maxZoom: 13, duration: 700 }
    expect(map.fitBounds).toHaveBeenLastCalledWith([[-6, 43], [-5.9, 43.2]], options)
    expect(map.fitBounds.mock.calls[0]).toEqual(map.fitBounds.mock.calls[1])
  })

  it('navega a una parada con caja puntual sin intentar encajar un área vacía', () => {
    const map = camera()
    const controller = new SelectionFocusController()
    const stop = { type: 'stop', id: 'CTA:stop', bbox: [-5.6, 43.5, -5.6, 43.5] } as TransitSelection
    controller.apply(map, { selected: null, transitSelection: stop, focusRequestToken: 1 }, true, { top: 82, right: 18, bottom: 340, left: 18 })
    expect(map.fitBounds).not.toHaveBeenCalled()
    expect(map.easeTo).toHaveBeenCalledWith({ center: [-5.6, 43.5], zoom: 15, offset: [0, -129], duration: 700 })
  })
})
