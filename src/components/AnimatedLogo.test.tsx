import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import AnimatedLogo from './AnimatedLogo'

it('starts in the current mode and handles rapid mode changes with a fresh reveal', () => {
  const { container, rerender } = render(<AnimatedLogo mode="physical" locateToken={0} />)
  expect(container.querySelector('.atlas-logo-mode')).toBeNull()
  expect(container.querySelector('svg > g > g[color]')?.getAttribute('color')).toBe('#4e765c')
  rerender(<AnimatedLogo mode="transit" locateToken={0} />)
  const first = container.querySelector('.atlas-logo-mode')
  expect(first?.querySelector('g[color]')?.getAttribute('color')).toBe('#326b89')
  rerender(<AnimatedLogo mode="political" locateToken={0} />)
  expect(container.querySelector('.atlas-logo-mode')).not.toBe(first)
  expect(container.querySelector('svg > g > g[color]')?.getAttribute('color')).toBe('#326b89')
  expect(container.querySelector('.atlas-logo-mode g[color]')?.getAttribute('color')).toBe('#b35e37')
})

it('replays both location waves without restarting the mode reveal', () => {
  const { container, rerender } = render(<AnimatedLogo mode="political" locateToken={0} />)
  rerender(<AnimatedLogo mode="physical" locateToken={1} />)
  const reveal = container.querySelector('.atlas-logo-mode')
  const wave = container.querySelector('.atlas-logo-wave')
  expect(container.querySelectorAll('.atlas-logo-wave')).toHaveLength(2)
  rerender(<AnimatedLogo mode="physical" locateToken={2} />)
  expect(container.querySelector('.atlas-logo-wave')).not.toBe(wave)
  expect(container.querySelector('.atlas-logo-mode')).toBe(reveal)
})
