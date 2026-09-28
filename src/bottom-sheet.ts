import type { BottomSheetLevel } from './types'

export const SHEET_LEVELS: BottomSheetLevel[] = ['peek', 'half', 'full']
export const SHEET_PEEK_HEIGHT = 72

export function bottomSheetHeight(level: BottomSheetLevel, viewportHeight: number) {
  if (level === 'peek') return SHEET_PEEK_HEIGHT
  return Math.round(viewportHeight * (level === 'half' ? 0.43 : 0.79))
}

export function nearestBottomSheetLevel(height: number, viewportHeight: number): BottomSheetLevel {
  return SHEET_LEVELS.reduce<BottomSheetLevel>((nearest, level) => (
    Math.abs(bottomSheetHeight(level, viewportHeight) - height)
      < Math.abs(bottomSheetHeight(nearest, viewportHeight) - height)
      ? level
      : nearest
  ), 'half')
}
