import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ModeSwitch from './ModeSwitch'

describe('ModeSwitch', () => {
  it('changes between the three atlas modes', () => {
    const onChange = vi.fn()
    render(<ModeSwitch value="political" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Mapa físico' }))

    expect(onChange).toHaveBeenCalledWith('physical')
  })

  it('makes transport available', () => {
    const onChange = vi.fn()
    render(<ModeSwitch value="political" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Transporte público' }))
    expect(onChange).toHaveBeenCalledWith('transit')
  })
})
