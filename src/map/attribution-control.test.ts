import { Evented } from 'maplibre-gl'
import type { Map } from 'maplibre-gl'
import { expect, it } from 'vitest'
import { CollapsedAttributionControl } from './attribution-control'

class ControlTestMap extends Evented {}

function mountControl(width: number) {
  const canvas = document.createElement('div')
  Object.defineProperty(canvas, 'offsetWidth', { value: width })
  const source = { attribution: 'OpenFreeMap · © OpenStreetMap contributors' }
  // Only the map surface needed by the real control; no WebGL or network.
  const map = Object.assign(new ControlTestMap(), {
    getCanvasContainer: () => canvas,
    _getUIString: () => 'Mostrar atribuciones',
    style: { stylesheet: {}, tileManagers: { basemap: { used: true, getSource: () => source } } },
  })
  const control = new CollapsedAttributionControl({ compact: true, customAttribution: 'Regionea Atlas v1.0.0' })
  const element = control.onAdd(map as unknown as Map) as HTMLDetailsElement
  return { control, element, map, source }
}

it.each([390, 1440])('inicia los créditos minimizados en un mapa de %i píxeles', (width) => {
  const { control, element } = mountControl(width)
  expect(element.open).toBe(false)
  expect(element.classList.contains('maplibregl-compact-show')).toBe(false)
  expect(element.textContent).toContain('Regionea Atlas v1.0.0')
  expect(element.textContent).toContain('© OpenStreetMap contributors')
  expect(element.querySelector('summary')?.getAttribute('aria-label')).toBeTruthy()
  control.onRemove()
})

it('actualiza las fuentes sin desplegar los créditos y permite abrirlos y cerrarlos', () => {
  const { control, element, map, source } = mountControl(1440)
  document.body.append(element)
  source.attribution = 'OpenFreeMap · © OpenStreetMap contributors · Elevación © Mapzen'
  map.fire('styledata', { dataType: 'style' })
  map.fire('resize')
  expect(element.open).toBe(false)
  expect(element.classList.contains('maplibregl-compact-show')).toBe(false)
  expect(element.textContent).toContain('Elevación © Mapzen')

  element.querySelector('summary')!.click()
  expect(element.open).toBe(true)
  expect(element.classList.contains('maplibregl-compact-show')).toBe(true)
  map.fire('terrain')
  expect(element.open).toBe(true)
  element.querySelector('summary')!.click()
  expect(element.open).toBe(false)
  expect(element.classList.contains('maplibregl-compact-show')).toBe(false)
  control.onRemove()
})
