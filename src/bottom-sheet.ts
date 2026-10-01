import type { BottomSheetLevel } from './types'

export const SHEET_LEVELS: BottomSheetLevel[] = ['peek', 'half', 'full']
export const SHEET_PEEK_HEIGHT = 144

export function bottomSheetSafeAreaInset() {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-safe-bottom')) || 0
}

export function bottomSheetHeight(level: BottomSheetLevel, viewportHeight: number, safeAreaInset = 0) {
  const minimum = SHEET_PEEK_HEIGHT + safeAreaInset
  if (level === 'peek') return minimum
  return Math.max(minimum, Math.round(viewportHeight * (level === 'half' ? 0.43 : 0.79)))
}

export function nearestBottomSheetLevel(height: number, viewportHeight: number, safeAreaInset = 0): BottomSheetLevel {
  return SHEET_LEVELS.reduce<BottomSheetLevel>((nearest, level) => (
    Math.abs(bottomSheetHeight(level, viewportHeight, safeAreaInset) - height)
      < Math.abs(bottomSheetHeight(nearest, viewportHeight, safeAreaInset) - height)
      ? level
      : nearest
  ), 'half')
}
