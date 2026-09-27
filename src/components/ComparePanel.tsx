import { TERRITORY_KIND_LABELS } from '../data/atlas'
import type { AtlasEntity } from '../types'

type Props = { entities: AtlasEntity[]; onRemove: (id: string) => void; onClose: () => void }

function value(entity: AtlasEntity, key: 'population' | 'areaKm2' | 'density') {
  const raw = entity[key]
  if (raw == null) return '—'
  const formatted = new Intl.NumberFormat('es-ES', { maximumFractionDigits: key === 'population' ? 0 : 1 }).format(raw)
  return key === 'areaKm2' ? `${formatted} km²` : key === 'density' ? `${formatted} hab./km²` : formatted
}

export default function ComparePanel({ entities, onRemove, onClose }: Props) {
  const metrics = [
    { key: 'population' as const, label: 'Población' },
    { key: 'areaKm2' as const, label: 'Superficie' },
    { key: 'density' as const, label: 'Densidad' },
  ].filter(({ key }) => entities.length > 0 && entities.every((entity) => entity[key] != null))
  return (
    <section className="compare-panel" aria-label="Comparación de territorios">
      <div className="panel-kicker-row"><span className="eyebrow">Comparación</span><button className="icon-button" onClick={onClose} aria-label="Cerrar comparación">×</button></div>
      <h2>Territorios fijados</h2>
      <div className="compare-table-wrap">
        <table>
          <thead><tr><th>Indicador</th>{entities.map((entity) => <th key={entity.id}>{entity.name}<button onClick={() => onRemove(entity.id)} aria-label={`Quitar ${entity.name}`}>×</button></th>)}</tr></thead>
          <tbody>
            <tr><th>Tipo</th>{entities.map((entity) => <td key={entity.id}>{TERRITORY_KIND_LABELS[entity.kind]}</td>)}</tr>
            {metrics.map(({ key, label }) => <tr key={key}><th>{label}</th>{entities.map((entity) => <td key={entity.id}>{value(entity, key)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      {entities.length < 2 && <p className="empty-hint">Añade otro territorio desde su ficha para compararlos.</p>}
      {entities.length > 1 && metrics.length === 0 && <p className="empty-hint">Estos territorios todavía no comparten indicadores comparables.</p>}
    </section>
  )
}
