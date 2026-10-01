import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import DetailsSheet from './DetailsSheet'

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
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
})

function setup(level: 'peek' | 'half' | 'full' = 'peek') {
  const onLevelChange = vi.fn()
  const onClose = vi.fn()
  const result = render(<DetailsSheet level={level} onLevelChange={onLevelChange} footer={<span>Fuentes</span>}>
    <article className="entity-panel">
      <header className="panel-heading"><h1>Ría de San Martín de la Arena</h1><button onClick={onClose}>Cerrar ficha</button></header>
      <div className="panel-body"><p>Contenido desplazable</p></div>
    </article>
  </DetailsSheet>)
  const sheet = result.container.querySelector('aside')!
  vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({ height: level === 'peek' ? 144 : 632 } as DOMRect)
  const title = screen.getByRole('heading')
  title.parentElement!.setPointerCapture = vi.fn()
  screen.getByRole('button', { name: /Panel/ }).setPointerCapture = vi.fn()
  return { ...result, sheet, title, onLevelChange, onClose }
}

it('arrastra desde el título y ancla a media altura sin desplazar el contenido', () => {
  const { sheet, title, onLevelChange } = setup()
  fireEvent.pointerDown(title, { clientY: 700, button: 0 })
  fireEvent.pointerMove(sheet, { clientY: 500 })
  expect(sheet.style.getPropertyValue('--sheet-drag-height')).toBe('344px')
  expect(sheet.querySelector('.panel-body')!.scrollTop).toBe(0)
  fireEvent.pointerUp(sheet, { clientY: 500 })
  expect(onLevelChange).toHaveBeenCalledExactlyOnceWith('half')
})

it('conserva título y cierre al alcanzar el mínimo y limita el arrastre superior', () => {
  const { sheet, title, onLevelChange } = setup('full')
  fireEvent.pointerDown(title, { clientY: 170, button: 0 })
  fireEvent.pointerMove(sheet, { clientY: -900 })
  expect(sheet.style.getPropertyValue('--sheet-drag-height')).toBe('632px')
  fireEvent.pointerMove(sheet, { clientY: 900 })
  expect(sheet.style.getPropertyValue('--sheet-drag-height')).toBe('144px')
  expect(screen.getByRole('heading')).toBe(title)
  expect(screen.getByRole('button', { name: 'Cerrar ficha' })).toBeInTheDocument()
  fireEvent.pointerUp(sheet)
  expect(onLevelChange).toHaveBeenCalledExactlyOnceWith('peek')
})

it('no intercepta el botón de cierre ni los gestos del contenido', () => {
  const { sheet, onLevelChange, onClose } = setup()
  const close = screen.getByRole('button', { name: 'Cerrar ficha' })
  fireEvent.pointerDown(close, { clientY: 700, button: 0 })
  fireEvent.pointerMove(sheet, { clientY: 400 })
  fireEvent.pointerUp(sheet)
  fireEvent.click(close)
  expect(onClose).toHaveBeenCalledOnce()
  fireEvent.pointerDown(screen.getByText('Contenido desplazable'), { clientY: 700, button: 0 })
  fireEvent.pointerMove(sheet, { clientY: 400 })
  fireEvent.pointerUp(sheet)
  expect(onLevelChange).not.toHaveBeenCalled()
  expect(sheet).not.toHaveClass('is-dragging')
})

it('mantiene el control por teclado y no inicia arrastres en escritorio', () => {
  const { sheet, title, onLevelChange } = setup()
  fireEvent.click(screen.getByRole('button', { name: /Panel/ }))
  expect(onLevelChange).toHaveBeenCalledExactlyOnceWith('half')
  onLevelChange.mockClear()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
  fireEvent.pointerDown(title, { clientY: 700, button: 0 })
  fireEvent.pointerMove(sheet, { clientY: 400 })
  fireEvent.pointerUp(sheet)
  expect(onLevelChange).not.toHaveBeenCalled()
})

it('ignora otros dedos y cancela limpiamente al perder la captura', () => {
  const { sheet, title, onLevelChange } = setup()
  fireEvent.pointerDown(title, { clientY: 700, button: 0, pointerId: 3 })
  fireEvent.pointerMove(sheet, { clientY: 100, pointerId: 4 })
  expect(sheet.style.getPropertyValue('--sheet-drag-height')).toBe('144px')
  fireEvent.pointerMove(sheet, { clientY: 500, pointerId: 3 })
  fireEvent.lostPointerCapture(title.parentElement!, { pointerId: 3 })
  expect(sheet).not.toHaveClass('is-dragging')
  expect(onLevelChange).not.toHaveBeenCalled()
  fireEvent.pointerDown(title, { clientY: 700, button: 0, pointerId: 5 })
  fireEvent.pointerMove(sheet, { clientY: 500, pointerId: 5 })
  fireEvent.pointerUp(sheet, { pointerId: 5 })
  expect(onLevelChange).toHaveBeenCalledExactlyOnceWith('half')
})

it('no cicla el nivel por el clic sintético posterior al arrastre del asa', () => {
  const { sheet, onLevelChange } = setup()
  const handle = screen.getByRole('button', { name: /Panel/ })
  fireEvent.pointerDown(handle, { clientY: 700, button: 0 })
  fireEvent.pointerMove(sheet, { clientY: 100 })
  fireEvent.pointerUp(handle)
  fireEvent.click(handle)
  expect(onLevelChange).toHaveBeenCalledExactlyOnceWith('full')
})
