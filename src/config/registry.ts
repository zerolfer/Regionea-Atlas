export type LayerEntry = {
    id: string
    granularity: 'nuts0' | 'nuts1' | 'nuts2' | 'nuts3' | 'ccaa' | 'prov' | 'muni' | 'barrio' | 'seccion' | 'custom'
    bbox: [number, number, number, number] // [minLon,minLat,maxLon,maxLat]
    pmtiles: string
    minzoom: number
    maxzoom: number
    locale?: string
    tags?: Record<string, string>
}

export const LAYERS: LayerEntry[] = [
    { id: 'eu-nuts', granularity: 'nuts0', bbox: [-31, 27, 40, 72], pmtiles: '/data/nuts_eu.pmtiles', minzoom: 2, maxzoom: 9 }
]