import type { Map } from 'maplibre-gl'
import type { AtlasEntity, TransitSelection } from '../types'

type Camera = Pick<Map, 'getPadding' | 'stop' | 'easeTo' | 'fitBounds'>
type FocusRequest = {
  focusRequestToken: number
  selected: AtlasEntity | null
  transitSelection: TransitSelection | null
}

export function fitEntityBounds(map: Camera, bounds: [number, number, number, number], maxZoom = 13) {
  const padding = map.getPadding()
  map.stop()
  if (Math.abs(bounds[2] - bounds[0]) < 1e-7 && Math.abs(bounds[3] - bounds[1]) < 1e-7) {
    map.easeTo({ center: [bounds[0], bounds[1]], zoom: maxZoom, padding, duration: 700 })
    return
  }
  map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], {
    // fitBounds adds this inset to the existing viewport padding and does not
    // retain it (MapLibre cameraForBounds already accounts for the panels).
    padding: 12, maxZoom, duration: 700,
  })
}

// Consume only explicit navigation, not map clicks or panel resizes. Requests
// remain pending until both the style and asynchronously loaded entity exist.
export class SelectionFocusController {
  private consumedToken = 0

  apply(map: Camera, request: FocusRequest, styleReady: boolean) {
    const target = request.selected || request.transitSelection
    if (!styleReady || !target || !request.focusRequestToken || request.focusRequestToken === this.consumedToken) return
    const zoom = request.transitSelection?.type === 'stop' ? 15 : 13
    if (target.bbox) fitEntityBounds(map, target.bbox, zoom)
    else if (target.center) {
      map.stop()
      map.easeTo({ center: target.center, zoom, padding: map.getPadding(), duration: 700 })
    } else return
    this.consumedToken = request.focusRequestToken
  }
}
