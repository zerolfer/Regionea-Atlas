import { useMemo, useState } from 'react'
import { PHYSICAL_KIND_LABELS, TERRITORY_KIND_LABELS, searchEntities } from '../data/atlas'
import type { AtlasEntity } from '../types'

type Props = { entities: AtlasEntity[]; onSelect: (entity: AtlasEntity) => void }

export default function SearchBox({ entities, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const results = useMemo(() => searchEntities(entities, query), [entities, query])
  const visible = focused && query.trim().length >= 2

  return (
    <div className="search-wrap">
      <label className="search-box">
        <span aria-hidden="true">⌕</span>
        <span className="sr-only">Buscar territorios y accidentes geográficos</span>
        <input
          value={query}
          placeholder="Buscar un territorio o lugar…"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 140)}
          aria-expanded={visible}
          aria-controls="search-results"
        />
        {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Borrar búsqueda">×</button>}
      </label>
      {visible && (
        <div id="search-results" className="search-results" role="listbox">
          {results.length ? results.map((entity) => (
            <button key={entity.id} role="option" onClick={() => { onSelect(entity); setQuery(entity.name); setFocused(false) }}>
              <span>{entity.name}</span>
              <small>{PHYSICAL_KIND_LABELS[entity.kind] || TERRITORY_KIND_LABELS[entity.kind] || entity.kind}</small>
            </button>
          )) : <p>No hay coincidencias en el atlas.</p>}
        </div>
      )}
    </div>
  )
}
