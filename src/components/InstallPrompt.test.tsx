import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InstallPrompt from './InstallPrompt'

describe('InstallPrompt', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('offers the native install flow when the browser exposes it', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined)
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    })
    render(<InstallPrompt />)

    window.dispatchEvent(event)
    fireEvent.click(await screen.findByRole('button', { name: 'Instalar' }))

    await waitFor(() => expect(prompt).toHaveBeenCalledOnce())
  })

  it('remembers a dismissal so it does not insist during the next month', async () => {
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    })
    const { unmount } = render(<InstallPrompt />)
    window.dispatchEvent(event)
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sugerencia de instalación' }))
    unmount()

    render(<InstallPrompt />)
    window.dispatchEvent(event)

    expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument()
  })
})
