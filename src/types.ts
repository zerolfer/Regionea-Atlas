export type MapMode = 'political' | 'physical' | 'transit'
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
  territoryIds?: string[]
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

export type MapSelection =
  | { type: 'territory'; entity: AtlasEntity }
  | { type: 'physical'; entity: AtlasEntity }
  | { type: 'route'; id: string; name: string; provider: string; freshness: TransitFreshness }
  | { type: 'stop'; id: string; name: string; provider: string; freshness: TransitFreshness }
  | { type: 'vehicle'; id: string; name: string; provider: string; freshness: TransitFreshness }

export type ViewState = {
  center: [number, number]
  zoom: number
}

export type UserLocation = {
  coordinates: [number, number]
  accuracy: number
  token: number
}


