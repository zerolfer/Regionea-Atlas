import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import MapLayers from './MapLayers'

const value = { basemap: 'plan' as const, terrain3d: false, hypsometry: false }

it('cambiar el fondo no modifica los ajustes de terreno', () => {
  const onChange = vi.fn()
  render(<MapLayers mode="physical" value={value} onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Capas del mapa' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Satélite' }))
  expect(onChange).toHaveBeenCalledWith({ ...value, basemap: 'satellite' })
})

it('ofrece ajustes físicos independientes y los oculta en otros modos', () => {
  const onChange = vi.fn()
  const { rerender } = render(<MapLayers mode="physical" value={value} onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Capas del mapa' }))
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
  const button = screen.getByRole('button', { name: 'Capas del mapa' })
  fireEvent.click(button)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(button).toHaveFocus()
  fireEvent.click(button)
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
