import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import SearchBox from './SearchBox'

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
