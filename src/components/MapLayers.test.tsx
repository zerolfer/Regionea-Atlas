import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import type { MapAppearance } from '../types'
import MapLayers from './MapLayers'

const value = { basemap: 'plan' as const, terrain3d: false, hypsometry: false }
afterEach(() => vi.unstubAllGlobals())

function openSelector() {
  fireEvent.click(screen.getByRole('button', { name: 'Tipo de mapa' }))
}

it('presenta un botón solo con icono y un selector llamado Tipo de mapa', () => {
  render(<MapLayers mode="physical" value={value} onChange={vi.fn()} />)
  const trigger = screen.getByRole('button', { name: 'Tipo de mapa' })
  expect(trigger.textContent).toBe('')
  fireEvent.click(trigger)
  expect(screen.getByRole('heading', { name: 'Tipo de mapa' })).toBeInTheDocument()
})

it('mantiene la ayuda fuera de las opciones hasta abrir Información', () => {
  render(<MapLayers mode="physical" value={{ ...value, basemap: 'satellite', terrain3d: true }} onChange={vi.fn()} />)
  openSelector()
  expect(screen.queryByText(/Arrastra con dos dedos/)).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Sentinel/ })).not.toBeInTheDocument()
  const information = screen.getByRole('button', { name: 'Información del mapa' })
  fireEvent.click(information)
  const region = screen.getByRole('region', { name: 'Información del mapa' })
  expect(region).toHaveTextContent('alturas disponibles o estimadas')
  expect(screen.getByRole('link', { name: /Sentinel/ })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Satélite' })).toBeEnabled()
  expect(screen.getByRole('radio', { name: 'Satélite' }).closest('[inert]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Cerrar información' })).toHaveFocus()
  fireEvent.keyDown(region, { key: 'Escape' })
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(information).toHaveFocus()
})

it('la ayuda se puede cerrar pulsando otra vez Información sin cerrar las opciones', () => {
  render(<MapLayers mode="physical" value={value} onChange={vi.fn()} />)
  openSelector()
  const information = screen.getByRole('button', { name: 'Información del mapa' })
  fireEvent.click(information)
  fireEvent.click(information)
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('pulsar una opción fuera de la ayuda la cierra y permite seguir usando el selector', () => {
  render(<MapLayers mode="physical" value={value} onChange={vi.fn()} />)
  openSelector()
  fireEvent.click(screen.getByRole('button', { name: 'Información del mapa' }))
  fireEvent.pointerDown(screen.getByRole('radio', { name: 'Plano' }))
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('adapta la instrucción a la interacción principal y reacciona al cambiarla', () => {
  const listeners = new Set<() => void>()
  const media = { matches: true, addEventListener: (_: string, listener: () => void) => listeners.add(listener), removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) }
  vi.stubGlobal('matchMedia', () => media)
  render(<MapLayers mode="physical" value={value} onChange={vi.fn()} />)
  openSelector()
  fireEvent.click(screen.getByRole('button', { name: 'Información del mapa' }))
  expect(screen.getByRole('region')).toHaveTextContent('dos dedos')
  expect(screen.getByRole('region')).not.toHaveTextContent('botón derecho')
  act(() => { media.matches = false; listeners.forEach((listener) => listener()) })
  expect(screen.getByRole('region')).toHaveTextContent('botón derecho')
  expect(screen.getByRole('region')).not.toHaveTextContent('dos dedos')
})

it('al abrir enfoca el fondo seleccionado para no señalar dos tarjetas distintas', () => {
  render(<MapLayers mode="physical" value={{ ...value, basemap: 'satellite' }} onChange={vi.fn()} />)
  openSelector()
  expect(screen.getByRole('radio', { name: 'Satélite' })).toHaveFocus()
})

it('cerrar desde Información no la vuelve a abrir al reabrir el selector', () => {
  render(<MapLayers mode="physical" value={value} onChange={vi.fn()} />)
  openSelector()
  fireEvent.click(screen.getByRole('button', { name: 'Información del mapa' }))
  fireEvent.keyDown(screen.getByRole('region'), { key: 'Escape' })
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  openSelector()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Plano' })).toHaveFocus()
})

it('tocar el texto de una fila cambia el ajuste sin afectar al resto de la apariencia', () => {
  function Controlled() {
    const [appearance, setAppearance] = useState<MapAppearance>({ ...value, basemap: 'satellite' })
    return <MapLayers mode="physical" value={appearance} onChange={setAppearance} />
  }
  render(<Controlled />)
  openSelector()
  fireEvent.click(screen.getByText('Colores de altitud'))
  expect(screen.getByRole('checkbox', { name: 'Colores de altitud' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Terreno y edificios 3D' })).not.toBeChecked()
  expect(screen.getByRole('radio', { name: 'Satélite' })).toBeChecked()
  fireEvent.click(screen.getByText('Colores de altitud'))
  expect(screen.getByRole('checkbox', { name: 'Colores de altitud' })).not.toBeChecked()
})

it('cambiar el fondo no modifica los ajustes de terreno', () => {
  const onChange = vi.fn()
  render(<MapLayers mode="physical" value={value} onChange={onChange} />)
  openSelector()
  fireEvent.click(screen.getByRole('radio', { name: 'Satélite' }))
  expect(onChange).toHaveBeenCalledWith({ ...value, basemap: 'satellite' })
})

it('ofrece ajustes físicos independientes y los oculta en otros modos', () => {
  const onChange = vi.fn()
  const { rerender } = render(<MapLayers mode="physical" value={value} onChange={onChange} />)
  openSelector()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Terreno y edificios 3D' }))
  expect(onChange).toHaveBeenCalledWith({ ...value, terrain3d: true })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Colores de altitud' }))
  expect(onChange).toHaveBeenCalledWith({ ...value, hypsometry: true })
  rerender(<MapLayers mode="transit" value={value} onChange={onChange} />)
  expect(screen.getByRole('radio', { name: 'Satélite' })).toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

it('cierra con Escape y devuelve el foco al botón; pulsar fuera también cierra', () => {
  render(<MapLayers mode="physical" value={value} onChange={vi.fn()} />)
  const button = screen.getByRole('button', { name: 'Tipo de mapa' })
  fireEvent.click(button)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(button).toHaveFocus()
  fireEvent.click(button)
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
