import { act, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AtlasEntity } from '../types'

const { camera, listeners } = vi.hoisted(() => {
  const listeners: Record<string, (event?: { sourceId?: string; error?: Error }) => void> = {}
  const camera = {
    setPadding: vi.fn(), jumpTo: vi.fn(), stop: vi.fn(), easeTo: vi.fn(), fitBounds: vi.fn(),
    getPadding: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    addControl: vi.fn(), on: vi.fn((event: string, callback: (event?: { sourceId?: string; error?: Error }) => void) => { listeners[event] = callback }),
    getCanvas: () => document.createElement('canvas'), getLayer: vi.fn(() => undefined as object | undefined),
    getSource: vi.fn(() => undefined as object | undefined), remove: vi.fn(),
    getTerrain: vi.fn(() => null as { source: string; exaggeration: number } | null), setTerrain: vi.fn(),
    getPitch: vi.fn(() => 0), getBearing: () => 125, getZoom: () => 12,
    getCenter: () => ({ lng: -4.8, lat: 43.2 }), setLayoutProperty: vi.fn(), setStyle: vi.fn(),
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
import { Map } from 'maplibre-gl'

beforeEach(() => {
  camera.getLayer.mockReturnValue(undefined)
  camera.getSource.mockReturnValue(undefined)
  camera.getTerrain.mockReturnValue(null)
  camera.getPitch.mockReturnValue(0)
})

afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

function props(): ComponentProps<typeof MapView> {
  return {
    mode: 'political', selected: null, transitSelection: null, compared: [], relatedPhysicalIds: [],
    physicalFilters: new Set(), transitFilters: { modes: new Set(['bus', 'rail']), providers: new Set(), showRealtime: false },
    appearance: { basemap: 'plan', terrain3d: false, hypsometry: false },
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

it('activar terreno desde plano inclina 60° sin reiniciar cámara al cambiar filtros o fondo', () => {
  const initial = { ...props(), mode: 'physical' as const }
  camera.getSource.mockImplementation((id?: string) => id === 'terrain-dem' ? {} : undefined)
  const { rerender } = render(<MapView {...initial} />)
  act(() => listeners['style.load']())
  camera.easeTo.mockClear()
  const appearance = { ...initial.appearance, terrain3d: true }
  rerender(<MapView {...initial} appearance={appearance} />)
  expect(camera.setTerrain).toHaveBeenLastCalledWith({ source: 'terrain-dem', exaggeration: 1.35 })
  expect(camera.easeTo).toHaveBeenCalledWith(expect.objectContaining({ pitch: 60 }))
  camera.getPitch.mockReturnValue(74)
  camera.easeTo.mockClear()
  rerender(<MapView {...initial} appearance={appearance} physicalFilters={new Set(['peaks'])} />)
  rerender(<MapView {...initial} appearance={{ ...appearance, basemap: 'satellite' }} />)
  act(() => listeners['style.load']())
  expect(camera.easeTo).not.toHaveBeenCalled()
  expect(camera.jumpTo).not.toHaveBeenCalled()
})

it('restaura cámara compartida y emite inclinación y orientación reales', () => {
  const initial = { ...props(), mode: 'physical' as const, appearance: { basemap: 'satellite' as const, terrain3d: true, hypsometry: false }, initialView: { center: [-4.8, 43.2] as [number, number], zoom: 12, pitch: 74, bearing: 125 } }
  render(<MapView {...initial} />)
  expect(Map).toHaveBeenCalledWith(expect.objectContaining({ maxPitch: 80, pitch: 74, bearing: 125 }))
  camera.getPitch.mockReturnValue(74)
  act(() => listeners['style.load']())
  expect(camera.easeTo).not.toHaveBeenCalled()
  act(() => listeners['moveend']())
  expect(initial.onViewportChange).toHaveBeenCalledWith({ center: [-4.8, 43.2], zoom: 12, pitch: 74, bearing: 125 })
})

it('después de restaurar una URL, el control 3D vuelve a responder a cambios explícitos', () => {
  const initial = { ...props(), mode: 'physical' as const, externalViewRequest: { view: { center: [-4.8, 43.2] as [number, number], zoom: 12, pitch: 0, bearing: 0 }, token: 1 } }
  const { rerender } = render(<MapView {...initial} />)
  act(() => listeners['style.load']())
  camera.easeTo.mockClear()
  rerender(<MapView {...initial} appearance={{ ...initial.appearance, terrain3d: true }} />)
  expect(camera.easeTo).toHaveBeenCalledWith(expect.objectContaining({ pitch: 60 }))
})

it('avisa una vez si falla el detalle satelital sin cambiar el fondo ni la cámara', () => {
  const initial = { ...props(), appearance: { ...props().appearance, basemap: 'satellite' as const } }
  render(<MapView {...initial} />)
  act(() => {
    listeners.error?.({ sourceId: 'satellite-detail' })
    listeners.error?.({ sourceId: 'satellite-detail' })
  })
  expect(initial.onToast).toHaveBeenCalledOnce()
  expect(initial.onToast).toHaveBeenCalledWith(expect.stringContaining('NASA'))
  expect(camera.setStyle).not.toHaveBeenCalled()
  expect(camera.jumpTo).not.toHaveBeenCalled()
})

it('no oculta los errores de otras fuentes al gestionar el respaldo satelital', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const error = new Error('Vector source failed')
  render(<MapView {...props()} />)
  act(() => listeners.error({ sourceId: 'openmaptiles', error }))
  expect(log).toHaveBeenCalledWith(error)
  log.mockRestore()
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
