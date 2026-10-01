import { AttributionControl } from 'maplibre-gl'
import type { Map } from 'maplibre-gl'

export class CollapsedAttributionControl extends AttributionControl {
  override onAdd(map: Map): HTMLElement {
    const element = super.onAdd(map)
    // MapLibre 6 starts compact controls expanded; keep its native toggle and
    // source updates, but initialise both its CSS and <details> states closed.
    element.classList.remove('maplibregl-compact-show')
    element.removeAttribute('open')
    return element
  }
}
