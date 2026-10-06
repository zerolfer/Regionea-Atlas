import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import manifest from '../public/data/atlas/manifest.json'
import App from './App'

// WebGL and analytics are external to the filter interaction. Data loading,
// state transitions, URL persistence and the actual filter controls stay real.
vi.mock('./map/MapView', () => ({ default: () => null }))
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }))

beforeEach(() => {
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    readonly pointerId: number
    readonly isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.isPrimary = init.isPrimary ?? true
    }
  })
  const bodies: Record<string, unknown> = {
    '/data/atlas/manifest.json': manifest,
    '/data/atlas/editorial.json': {},
    '/data/atlas/catalog.json': { territories: [], physical: ['range', 'peak', 'river', 'beach', 'protected-area'].map((kind) => ({ id: kind, kind, name: kind, aliases: [] })) },
    '/data/atlas/transit/manifest.json': { status: 'scheduled' },
    '/data/atlas/transit/routes.geojson': { type: 'FeatureCollection', features: [] },
    '/data/atlas/transit/stops.geojson': { type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-5.7, 43.5] }, properties: { id: 'CTA:1', entityType: 'stop', name: 'Bus', provider: 'CTA', transportMode: 'bus' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-5.7, 43.5] }, properties: { id: 'RENFE:1', entityType: 'stop', name: 'Tren', provider: 'RENFE', transportMode: 'rail' } },
    ] },
  }
  vi.stubGlobal('fetch', async (url: string) => {
    if (!(url in bodies)) throw new Error(`URL inesperada: ${url}`)
    return { ok: true, json: async () => bodies[url] }
  })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

async function setup(path = '/mapa/fisico') {
  window.history.replaceState({}, '', path)
  await act(async () => { render(<App />) })
  vi.useFakeTimers()
}

function hold(button: HTMLElement) {
  fireEvent.pointerDown(button, { button: 0, clientX: 20, clientY: 20 })
  act(() => vi.advanceTimersByTime(500))
  fireEvent.pointerUp(button)
  fireEvent.click(button, { detail: 1 })
}

function activeFilters(label: string) {
  const bar = screen.getByLabelText(label)
  return within(bar).queryAllByRole('button', { pressed: true }).map(button => button.textContent)
}

function doubleClick(button: HTMLElement) {
  for (const detail of [1, 2]) {
    fireEvent.pointerDown(button, { button: 0 })
    fireEvent.pointerUp(button)
    fireEvent.click(button, { detail })
  }
  fireEvent.doubleClick(button, { detail: 2 })
}

it('doble clic físico aísla y repetir restaura según el estado anterior al primer clic', async () => {
  await setup()
  const peaks = screen.getByRole('button', { name: 'Picos' })
  doubleClick(peaks)
  expect(activeFilters('Filtros del mapa físico')).toEqual(['Picos'])
  doubleClick(peaks)
  expect(activeFilters('Filtros del mapa físico')).toEqual(['Sierras', 'Picos', 'Ríos y agua', 'Costa', 'Espacios protegidos'])
})

it('doble clic sobre un filtro apagado lo aísla y conserva los ajustes del terreno', async () => {
  await setup('/mapa/fisico?filtros=relief,terrain3d,hypsometry')
  doubleClick(screen.getByRole('button', { name: 'Picos' }))
  expect(activeFilters('Filtros del mapa físico')).toEqual(['Picos'])
  act(() => vi.advanceTimersByTime(220))
  expect(new URLSearchParams(window.location.search).get('filtros')).toBe('peaks,hypsometry,terrain3d')
})

it('doble clic en transporte conserva los otros grupos y restaura solo el propio', async () => {
  await setup('/mapa/transporte?tiempoReal=0')
  doubleClick(screen.getByRole('button', { name: 'Tren' }))
  expect(activeFilters('Filtros de transporte')).toEqual(['Tren', 'CTA', 'RENFE'])
  doubleClick(screen.getByRole('button', { name: 'CTA' }))
  expect(activeFilters('Filtros de transporte')).toEqual(['Tren', 'CTA'])
  doubleClick(screen.getByRole('button', { name: 'Tren' }))
  expect(activeFilters('Filtros de transporte')).toEqual(['Autobús', 'Tren', 'CTA'])
})

it('un segundo clic arrastrado no se convierte en aislamiento al recibir dblclick', async () => {
  await setup()
  const peaks = screen.getByRole('button', { name: 'Picos' })
  fireEvent.click(peaks, { detail: 1 })
  fireEvent.pointerDown(peaks, { button: 0, clientX: 20, clientY: 20 })
  fireEvent.pointerMove(peaks, { clientX: 50, clientY: 20 })
  fireEvent.pointerUp(peaks)
  fireEvent.click(peaks, { detail: 2 })
  fireEvent.doubleClick(peaks, { detail: 2 })
  expect(activeFilters('Filtros del mapa físico')).toEqual(['Sierras', 'Ríos y agua', 'Costa', 'Espacios protegidos'])
})

it('mantener un filtro físico deja solo ese y repetir activa todos los disponibles', async () => {
  await setup()
  hold(screen.getByRole('button', { name: 'Picos' }))
  expect(activeFilters('Filtros del mapa físico')).toEqual(['Picos'])
  act(() => vi.advanceTimersByTime(220))
  expect(new URLSearchParams(window.location.search).get('filtros')).toBe('peaks')
  hold(screen.getByRole('button', { name: 'Picos' }))
  expect(activeFilters('Filtros del mapa físico')).toEqual(['Sierras', 'Picos', 'Ríos y agua', 'Costa', 'Espacios protegidos'])
})

it('aislar un filtro inicialmente apagado no modifica los ajustes de terreno', async () => {
  await setup('/mapa/fisico?filtros=relief,terrain3d,hypsometry')
  hold(screen.getByRole('button', { name: 'Picos' }))
  expect(activeFilters('Filtros del mapa físico')).toEqual(['Picos'])
  act(() => vi.advanceTimersByTime(220))
  expect(new URLSearchParams(window.location.search).get('filtros')).toBe('peaks,hypsometry,terrain3d')
})

it('la pulsación corta sigue alternando un solo filtro', async () => {
  await setup()
  const peaks = screen.getByRole('button', { name: 'Picos' })
  fireEvent.pointerDown(peaks, { button: 0 })
  act(() => vi.advanceTimersByTime(100))
  fireEvent.pointerUp(peaks)
  fireEvent.click(peaks, { detail: 1 })
  expect(activeFilters('Filtros del mapa físico')).toEqual(['Sierras', 'Ríos y agua', 'Costa', 'Espacios protegidos'])
})

it('deslizar la barra cancela la pulsación larga y su clic residual', async () => {
  await setup()
  const peaks = screen.getByRole('button', { name: 'Picos' })
  fireEvent.pointerDown(peaks, { button: 0, clientX: 20, clientY: 20 })
  fireEvent.pointerMove(peaks, { clientX: 60, clientY: 20 })
  act(() => vi.advanceTimersByTime(600))
  fireEvent.pointerUp(peaks)
  fireEvent.click(peaks, { detail: 1 })
  expect(activeFilters('Filtros del mapa físico')).toEqual(['Sierras', 'Picos', 'Ríos y agua', 'Costa', 'Espacios protegidos'])
})

it('los medios y proveedores se aíslan por separado sin cambiar tiempo real', async () => {
  await setup('/mapa/transporte?tiempoReal=0')
  hold(screen.getByRole('button', { name: 'Tren' }))
  expect(activeFilters('Filtros de transporte')).toEqual(['Tren', 'CTA', 'RENFE'])
  hold(screen.getByRole('button', { name: 'CTA' }))
  expect(activeFilters('Filtros de transporte')).toEqual(['Tren', 'CTA'])
  hold(screen.getByRole('button', { name: 'Tren' }))
  expect(activeFilters('Filtros de transporte')).toEqual(['Autobús', 'Tren', 'CTA'])
  hold(screen.getByRole('button', { name: 'CTA' }))
  expect(activeFilters('Filtros de transporte')).toEqual(['Autobús', 'Tren', 'CTA', 'RENFE'])
})

it('permite aislar con Espacio mantenido sin disparar el clic normal al soltar', async () => {
  await setup()
  const peaks = screen.getByRole('button', { name: 'Picos' })
  peaks.focus()
  fireEvent.keyDown(peaks, { key: ' ' })
  act(() => vi.advanceTimersByTime(500))
  fireEvent.keyUp(peaks, { key: ' ' })
  fireEvent.click(peaks, { detail: 0 })
  expect(activeFilters('Filtros del mapa físico')).toEqual(['Picos'])
})

it.each(['pointerCancel', 'pointerLeave', 'blur'] as const)('%s cancela una pulsación en curso sin bloquear el siguiente toque', async (event) => {
  await setup()
  const peaks = screen.getByRole('button', { name: 'Picos' })
  fireEvent.pointerDown(peaks, { button: 0 })
  fireEvent[event](peaks)
  act(() => vi.advanceTimersByTime(600))
  expect(activeFilters('Filtros del mapa físico')).toHaveLength(5)
  fireEvent.pointerDown(peaks, { button: 0 })
  fireEvent.pointerUp(peaks)
  fireEvent.click(peaks, { detail: 1 })
  expect(peaks).toHaveAttribute('aria-pressed', 'false')
})

it('salir del filtro tras deslizar no bloquea un clic posterior de teclado', async () => {
  await setup()
  const peaks = screen.getByRole('button', { name: 'Picos' })
  fireEvent.pointerDown(peaks, { button: 0 })
  fireEvent.pointerCancel(peaks)
  fireEvent.keyDown(peaks, { key: 'Enter' })
  fireEvent.click(peaks, { detail: 0 })
  expect(peaks).toHaveAttribute('aria-pressed', 'false')
})

it('una pérdida de foco sin pulsación no consume activaciones de lector de pantalla', async () => {
  await setup()
  const peaks = screen.getByRole('button', { name: 'Picos' })
  fireEvent.blur(window)
  fireEvent.click(peaks, { detail: 0 })
  expect(peaks).toHaveAttribute('aria-pressed', 'false')
})

it('salir con el ratón no interrumpe una pulsación larga de Espacio', async () => {
  await setup()
  const peaks = screen.getByRole('button', { name: 'Picos' })
  fireEvent.keyDown(peaks, { key: ' ' })
  act(() => vi.advanceTimersByTime(500))
  fireEvent.pointerLeave(peaks)
  fireEvent.keyUp(peaks, { key: ' ' })
  fireEvent.click(peaks, { detail: 0 })
  expect(activeFilters('Filtros del mapa físico')).toEqual(['Picos'])
})
