import type { Map, PaddingOptions } from 'maplibre-gl'
import type { AtlasEntity, TransitSelection } from '../types'

type Camera = Pick<Map, 'stop' | 'easeTo' | 'fitBounds'>
const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 }
type FocusRequest = {
  focusRequestToken: number
  selected: AtlasEntity | null
  transitSelection: TransitSelection | null
}

export function focusPoint(map: Camera, center: [number, number], zoom: number, padding: PaddingOptions, duration = 700) {
  const offset: [number, number] = [((padding.left ?? 0) - (padding.right ?? 0)) / 2, ((padding.top ?? 0) - (padding.bottom ?? 0)) / 2]
  map.stop()
  // An offset targets the free part of the map without changing its vanishing
  // point or retaining panel padding after the animation (also in 3D).
  map.easeTo({ center, zoom, offset, duration })
}

export function fitEntityBounds(map: Camera, bounds: [number, number, number, number], maxZoom = 13, padding: PaddingOptions = NO_PADDING) {
  if (Math.abs(bounds[2] - bounds[0]) < 1e-7 && Math.abs(bounds[3] - bounds[1]) < 1e-7) {
    focusPoint(map, [bounds[0], bounds[1]], maxZoom, padding)
    return
  }
  map.stop()
  map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], {
    // MapLibre 6 fits using these temporary insets, without retaining padding.
    padding: { top: (padding.top ?? 0) + 12, right: (padding.right ?? 0) + 12, bottom: (padding.bottom ?? 0) + 12, left: (padding.left ?? 0) + 12 },
    maxZoom, duration: 700,
  })
}

// Consume only explicit navigation, not map clicks or panel resizes. Requests
// remain pending until both the style and asynchronously loaded entity exist.
export class SelectionFocusController {
  private consumedToken = 0

  apply(map: Camera, request: FocusRequest, styleReady: boolean, padding: PaddingOptions = NO_PADDING) {
    const target = request.selected || request.transitSelection
    if (!styleReady || !target || !request.focusRequestToken || request.focusRequestToken === this.consumedToken) return
    const zoom = request.transitSelection?.type === 'stop' ? 15 : 13
    if (target.bbox) fitEntityBounds(map, target.bbox, zoom, padding)
    else if (target.center) {
      focusPoint(map, target.center, zoom, padding)
    } else return
    this.consumedToken = request.focusRequestToken
  }
}
