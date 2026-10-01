import { bottomSheetHeight } from '../bottom-sheet'
import type { BottomSheetLevel } from '../types'

export function viewportPadding(width: number, height: number, sheetLevel: BottomSheetLevel, panelCollapsed: boolean, safeAreaInset = 0) {
  const panelWidth = Math.min(width <= 1100 ? 360 : 396, (width - 54) / 2)
  const desktopPanel = panelCollapsed ? 36 : panelWidth + 36
  return width > 760
    ? { top: 84, right: 36, bottom: 72, left: desktopPanel }
    : { top: 82, right: 18, bottom: bottomSheetHeight(sheetLevel, height, safeAreaInset) + 12, left: 18 }
}
