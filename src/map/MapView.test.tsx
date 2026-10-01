import { act, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { AtlasEntity } from '../types'

const { camera, listeners } = vi.hoisted(() => {
  const listeners: Record<string, () => void> = {}
  const camera = {
    setPadding: vi.fn(), jumpTo: vi.fn(), stop: vi.fn(), easeTo: vi.fn(), fitBounds: vi.fn(),
    getPadding: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    addControl: vi.fn(), on: vi.fn((event: string, callback: () => void) => { listeners[event] = callback }),
    getCanvas: () => document.createElement('canvas'), getLayer: () => undefined,
    getSource: () => undefined, remove: vi.fn(),
  }
  return { camera, listeners }
})

// Replace the WebGL/network boundary, not the component's layout or effects.
vi.mock('maplibre-gl', () => ({
  Map: vi.fn(function () { return camera }),
  AttributionControl: class {}, NavigationControl: class {},
  Popup: class { remove() {} }, setWorkerUrl: vi.fn(),
}))
import MapView from './MapView'

afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

function props(): ComponentProps<typeof MapView> {
  return {
    mode: 'political', selected: null, transitSelection: null, compared: [], relatedPhysicalIds: [],
    physicalFilters: new Set(), transitFilters: { modes: new Set(['bus', 'rail']), providers: new Set(), showRealtime: false },
    politicalLevel: 'auto', locateRequest: null, sheetLevel: 'half', desktopPanelCollapsed: false,
    initialView: { center: [-5.86, 43.31], zoom: 8 }, externalViewRequest: null, focusRequestToken: 0,
    onEntityClick: vi.fn(), onTransitClick: vi.fn(), onViewportChange: vi.fn(), onLocateMatches: vi.fn(), onToast: vi.fn(),
  }
}

it('cambiar la altura del panel no mueve la cámara ni el margen global', () => {
  vi.stubGlobal('innerWidth', 390)
  vi.stubGlobal('innerHeight', 844)
  const initial = props()
  const { rerender } = render(<MapView {...initial} />)
  expect(camera.setPadding).not.toHaveBeenCalled()
  act(() => listeners['style.load']())
  for (const sheetLevel of ['full', 'peek', 'half'] as const) rerender(<MapView {...initial} sheetLevel={sheetLevel} />)
  expect(camera.setPadding).not.toHaveBeenCalled()
  expect(camera.jumpTo).not.toHaveBeenCalled()
  expect(camera.easeTo).not.toHaveBeenCalled()
  expect(camera.fitBounds).not.toHaveBeenCalled()
})

it('el comparador no vuelve a encuadrar cuando solo cambia la apertura del panel', () => {
  const initial = props()
  const { rerender } = render(<MapView {...initial} />)
  act(() => listeners['style.load']())
  const compared = [
    { id: 'gijon', bbox: [-5.8, 43.4, -5.5, 43.6] },
    { id: 'oviedo', bbox: [-6, 43.2, -5.7, 43.5] },
  ] as AtlasEntity[]
  rerender(<MapView {...initial} compared={compared} />)
  expect(camera.fitBounds).toHaveBeenCalledOnce()
  rerender(<MapView {...initial} compared={compared} sheetLevel="full" />)
  rerender(<MapView {...initial} compared={compared} sheetLevel="peek" />)
  expect(camera.fitBounds).toHaveBeenCalledOnce()
})
