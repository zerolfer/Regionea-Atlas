import { BOUNDARY_STATUS_LABELS, PHYSICAL_KIND_LABELS, TERRITORY_KIND_LABELS } from '../data/atlas'
import type { AtlasEntity, EditorialEntry, SourceReference } from '../types'
import PanelHeader from './PanelHeader'

type Props = {
  entity: AtlasEntity
  editorial?: EditorialEntry
  source?: SourceReference
  datasetDate?: string
  parent?: AtlasEntity
  ancestors: AtlasEntity[]
  related?: AtlasEntity[]
  compared: boolean
  onCompare: () => void
  onNavigate: (entity: AtlasEntity) => void
  onClose: () => void
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 0) {
  return value == null ? '—' : new Intl.NumberFormat('es-ES', { maximumFractionDigits }).format(value)
}

function formatDatasetDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('es-ES', /^\d{4}-\d{2}$/.test(value)
    ? { month: 'short', year: 'numeric' } : { dateStyle: 'medium' }).format(date)
}

export default function EntityPanel({ entity, editorial, source, datasetDate, parent, ancestors, related = [], compared, onCompare, onNavigate, onClose }: Props) {
  const label = PHYSICAL_KIND_LABELS[entity.kind] || TERRITORY_KIND_LABELS[entity.kind] || entity.kind
  const isTerritory = Boolean(TERRITORY_KIND_LABELS[entity.kind])
  const hasMetrics = entity.population != null || entity.areaKm2 != null || entity.density != null || entity.elevationM != null || entity.lengthKm != null
  const boundaryLabel = entity.boundaryStatus ? BOUNDARY_STATUS_LABELS[entity.boundaryStatus] : null
  const formattedDatasetDate = formatDatasetDate(datasetDate)
  const formattedSourceDate = formatDatasetDate(entity.sourceDate)
  return (
    <article className="entity-panel">
      <PanelHeader title={entity.name || (entity.kind === 'river' ? 'Curso de agua sin nombre en la fuente' : label)} kicker={editorial?.kicker || label} onClose={onClose} />
      <div className="panel-body">
        {entity.localName && entity.localName !== entity.name && <p className="local-name">{entity.localName}</p>}
        {ancestors.length > 0 && <nav className="territory-path" aria-label="Ruta territorial">{ancestors.map((ancestor) => <button key={ancestor.id} onClick={() => onNavigate(ancestor)}>{ancestor.name}</button>)}<span>{entity.name}</span></nav>}
        {parent && ancestors.length === 0 && <p className="parent-line">Forma parte de {parent.name}</p>}
        {boundaryLabel && <p className={`boundary-status boundary-${entity.boundaryStatus}`}>{boundaryLabel}</p>}
        {entity.geometryRole === 'label' && <div className="boundary-note"><strong>Topónimo sin superficie delimitada.</strong> La fuente solo aporta una posición para el nombre, no los límites del accidente.</div>}
        {entity.geometryNote && <p className="boundary-note">{entity.geometryNote}</p>}
        {editorial?.summary && <p className="standfirst">{editorial.summary}</p>}
        {entity.boundaryStatus === 'statistical' && <div className="boundary-note"><strong>Límite estadístico.</strong> No constituye un deslinde jurídico oficial.</div>}
        {(isTerritory || hasMetrics) && (
          <dl className="metric-grid">
            {isTerritory && <div><dt>Población</dt><dd>{formatNumber(entity.population)}</dd></div>}
            {isTerritory && <div><dt>Superficie</dt><dd>{entity.areaKm2 == null ? '—' : `${formatNumber(entity.areaKm2, 1)} km²`}</dd></div>}
            {isTerritory && <div><dt>Densidad</dt><dd>{entity.density == null ? '—' : `${formatNumber(entity.density, 1)} hab./km²`}</dd></div>}
            {entity.elevationM != null && <div><dt>Altitud</dt><dd>{formatNumber(entity.elevationM)} m</dd></div>}
            {entity.lengthKm != null && <div><dt>Longitud cartografiada</dt><dd>{formatNumber(entity.lengthKm, 1)} km</dd></div>}
          </dl>
        )}
        {editorial?.sections.map((section) => (
          <section key={section.title} className="editorial-section">
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
        {related.length > 0 && (
          <section className="related-features">
            <h2>Picos destacados en el entorno</h2>
            <p>Se muestran los picos de mayor altitud próximos al topónimo de esta sierra.</p>
            <div>{related.map((item) => <button key={item.id} onClick={() => onNavigate(item)}><span>{item.name}</span>{item.elevationM != null && <small>{formatNumber(item.elevationM)} m</small>}</button>)}</div>
          </section>
        )}
        {isTerritory && (
          <button className={compared ? 'secondary-button selected' : 'secondary-button'} onClick={onCompare}>
            {compared ? 'Quitar de la comparación' : 'Añadir a comparar'}
          </button>
        )}
        {source && (
          <footer className="source-line">
            <span>Fuente</span>
            <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
            <small>{source.license}{formattedSourceDate ? ` · Fuente ${formattedSourceDate}` : entity.referenceYear ? ` · Datos ${entity.referenceYear}` : ''}{formattedDatasetDate ? ` · Colección ${formattedDatasetDate}` : ''}</small>
          </footer>
        )}
      </div>
    </article>
  )
}
