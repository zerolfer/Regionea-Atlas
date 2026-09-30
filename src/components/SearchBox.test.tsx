/// <reference types="node" />
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import SearchBox from './SearchBox'

// Vitest stubs CSS imports; read the real rules for this stacking regression.
const appStyles = readFileSync('src/index.css', 'utf8')

it('eleva los resultados por encima de la hoja sin cambiar su estado ni superar los diálogos', () => {
  const onSelect = vi.fn()
  const style = document.createElement('style')
  style.textContent = appStyles
  document.head.appendChild(style)
  try {
    render(<>
      <header className="topbar"><SearchBox items={[{ id: 'gijon', name: 'Gijón', aliases: [], kindLabel: 'Concejo' }]} mode="political" onSelect={onSelect} /></header>
      <aside className="side-panel sheet-full" aria-label="Ficha de detalles" style={{ zIndex: 40 }} />
      <div className="modal-backdrop" data-testid="dialog-layer" />
    </>)
    const header = screen.getByRole('banner')
    const sheet = screen.getByRole('complementary', { name: 'Ficha de detalles' })
    const input = screen.getByRole('textbox', { name: 'Buscar territorios' })
    expect(getComputedStyle(header).zIndex).toBe('30')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'gij' } })
    expect(Number(getComputedStyle(header).zIndex)).toBeGreaterThan(Number(getComputedStyle(sheet).zIndex))
    expect(Number(getComputedStyle(header).zIndex)).toBeLessThan(Number(getComputedStyle(screen.getByTestId('dialog-layer')).zIndex))
    fireEvent.click(screen.getByRole('option', { name: /Gijón/ }))
    expect(onSelect).toHaveBeenCalledOnce()
    expect(getComputedStyle(header).zIndex).toBe('30')
    expect(sheet).toHaveClass('sheet-full')
  } finally {
    style.remove()
  }
})

it('conserva el resultado cuando el foco pasa del buscador al botón', () => {
  const onSelect = vi.fn()
  const item = { id: 'beach', name: 'Playa de San Lorenzo', aliases: ['San Lorenzo'], kindLabel: 'Playa' }
  render(<SearchBox items={[item]} mode="physical" onSelect={onSelect} />)
  const input = screen.getByRole('textbox', { name: 'Buscar accidentes geográficos' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'San Lorenzo' } })
  const result = screen.getByRole('option')
  fireEvent.blur(input, { relatedTarget: result })
  expect(result).toBeInTheDocument()
  fireEvent.click(result)
  expect(onSelect).toHaveBeenCalledWith(item)
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})
