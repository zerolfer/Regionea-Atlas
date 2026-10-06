export type MapMode = 'political' | 'physical' | 'transit'
export type MapAppearance = { basemap: 'plan' | 'satellite'; hypsometry: boolean; terrain3d: boolean }
export type BottomSheetLevel = 'peek' | 'half' | 'full'
export type PoliticalLevel = 'auto' | 'countries' | 'communities' | 'provinces' | 'comarcas' | 'concejos' | 'parishes' | 'neighborhoods'

export type TerritoryKind =
  | 'country'
  | 'autonomous-community'
  | 'province'
  | 'functional-region'
  | 'municipality'
  | 'parish'
  | 'neighborhood'
  | 'historical'
  | 'cultural'

export type BoundaryStatus = 'official' | 'statistical' | 'municipal' | 'reference'

export type PhysicalFeatureKind =
  | 'peak'
  | 'range'
  | 'river'
  | 'lake'
  | 'reservoir'
  | 'valley'
  | 'coast'
  | 'cape'
  | 'bay'
  | 'gulf'
  | 'delta'
  | 'estuary'
  | 'cliff'
  | 'beach'
  | 'island'
  | 'protected-area'

export type MetricValue = {
  value: number | null
  unit: string
  referenceYear: number | null
  sourceId: string
}

export type AtlasEntity = {
  id: string
  slug: string
  name: string
  localName?: string
  aliases: string[]
  kind: TerritoryKind | PhysicalFeatureKind
  sourceId: string
  bbox: [number, number, number, number] | null
  center: [number, number] | null
  parentId?: string | null
  boundaryStatus?: BoundaryStatus
  population?: number | null
  areaKm2?: number | null
  density?: number | null
  referenceYear?: number | null
  elevationM?: number | null
  lengthKm?: number | null
  minZoom?: number
  territoryIds?: string[]
  geometryRole?: 'area' | 'label' | 'line' | 'point'
  geometryNote?: string
  geometryId?: string
  sourceDate?: string
}

export type DatasetCollection = {
  url: string
  bytes: number
  sha256: string
  count: number
  sourceIds: string[]
  license: string
  bounds: [number, number, number, number]
  minZoom: number
  maxZoom: number
  riverCoverage?: {
    sourceUrl: string
    where: string
    featureCount: number
    downloadedAt: string
    objectIdsSha256: string
  }
}

export type SourceReference = {
  id: string
  title: string
  url: string
  license: string
}

export type DatasetManifest = {
  version: string
  generatedAt: string
  bounds: [number, number, number, number]
  defaultView: { center: [number, number]; zoom: number }
  collections: Record<string, DatasetCollection>
  sources: SourceReference[]
}

export type EditorialSection = {
  title: string
  paragraphs: string[]
}

export type EditorialEntry = {
  id: string
  title: string
  kicker?: string
  summary: string
  sections: EditorialSection[]
}

export type PhysicalFilter = 'relief' | 'peaks' | 'hydrography' | 'valleys' | 'coast' | 'protected'
export type TransitFreshness = 'live' | 'scheduled' | 'stale' | 'demo'
export type TransitMode = 'bus' | 'rail' | 'ferry' | 'air'
export type TransitExtentClass = 'urban' | 'local' | 'regional' | 'long-distance'

export type TransitSelection = {
  type: 'route' | 'stop' | 'vehicle'
  id: string
  name: string
  provider: string
  freshness: TransitFreshness
  transportMode?: TransitMode
  extentClass?: TransitExtentClass
  routeLengthKm?: number
  routeSpanKm?: number
  routeStopCount?: number
  displayMinZoom?: number
  bbox?: [number, number, number, number] | null
  center?: [number, number] | null
}

export type TransitFilters = {
  providers: Set<string>
  modes: Set<TransitMode>
  showRealtime: boolean
}

export type SearchItem = {
  id: string
  name: string
  aliases: string[]
  kindLabel: string
  atlasEntity?: AtlasEntity
  transitSelection?: TransitSelection
}

export type MapSelection =
  | { type: 'territory'; entity: AtlasEntity }
  | { type: 'physical'; entity: AtlasEntity }
  | TransitSelection

export type ViewState = {
  center: [number, number]
  zoom: number
  pitch?: number
  bearing?: number
}

export type UserLocation = {
  coordinates: [number, number]
  accuracy: number
  token: number
}
