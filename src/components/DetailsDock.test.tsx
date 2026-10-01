import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import DetailsDock from './DetailsDock'

afterEach(() => vi.unstubAllGlobals())

function desktopViewport() {
  const media = new EventTarget() as EventTarget & { matches: boolean }
  media.matches = true
  vi.stubGlobal('matchMedia', () => media)
  return (desktop: boolean) => {
    media.matches = desktop
    act(() => media.dispatchEvent(new Event('change')))
  }
}

it('pliega y recupera la ficha sin desmontar su contenido ni perder el estado', () => {
  desktopViewport()
  const { rerender } = render(<DetailsDock><h1>Gijón</h1><input aria-label="Nota" defaultValue="" /></DetailsDock>)
  const field = screen.getByRole('textbox', { name: 'Nota' })
  fireEvent.change(field, { target: { value: 'Conservar esta ficha' } })
  const toggle = screen.getByRole('button', { name: 'Plegar panel de detalles' })
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const content = document.getElementById(toggle.getAttribute('aria-controls')!)!
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(content).toHaveAttribute('inert')

  // A new map/search selection changes the content, not the user's docking choice.
  rerender(<DetailsDock><h1>Oviedo</h1><input aria-label="Nota" defaultValue="" /></DetailsDock>)
  expect(screen.getByRole('button', { name: 'Mostrar panel de detalles' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText('Oviedo')).toBeInTheDocument()
  expect(field).toHaveValue('Conservar esta ficha')
  fireEvent.click(toggle)
  expect(content).not.toHaveAttribute('inert')
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('textbox', { name: 'Nota' })).toBe(field)
})

it('no oculta ni bloquea la hoja móvil y conserva el plegado al volver a escritorio', () => {
  const setDesktop = desktopViewport()
  render(<DetailsDock><button>Acción de la ficha</button></DetailsDock>)
  const toggle = screen.getByRole('button', { name: 'Plegar panel de detalles' })
  const content = document.getElementById(toggle.getAttribute('aria-controls')!)!
  fireEvent.click(toggle)
  setDesktop(false)
  expect(screen.queryByRole('button', { name: /panel de detalles/ })).not.toBeInTheDocument()
  expect(content).not.toHaveAttribute('inert')
  expect(screen.getByRole('button', { name: 'Acción de la ficha' })).toBeEnabled()
  setDesktop(true)
  expect(screen.getByRole('button', { name: 'Mostrar panel de detalles' })).toHaveAttribute('aria-expanded', 'false')
  expect(content).toHaveAttribute('inert')
})

it('notifica el espacio liberado al mapa solo cuando el usuario cambia el acople', () => {
  desktopViewport()
  const onCollapsedChange = vi.fn()
  render(<DetailsDock onCollapsedChange={onCollapsedChange}>Ficha</DetailsDock>)
  expect(onCollapsedChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Plegar panel de detalles' }))
  expect(onCollapsedChange).toHaveBeenLastCalledWith(true)
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar panel de detalles' }))
  expect(onCollapsedChange).toHaveBeenLastCalledWith(false)
})
