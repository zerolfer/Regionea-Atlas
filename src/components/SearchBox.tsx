import { useMemo, useState } from 'react'
import { normalizeSearch } from '../data/atlas'
import type { MapMode, SearchItem } from '../types'

type Props = { items: SearchItem[]; mode: MapMode; onSelect: (item: SearchItem) => void }

const SEARCH_COPY: Record<MapMode, { label: string; placeholder: string; empty: string }> = {
  political: { label: 'Buscar territorios', placeholder: 'Buscar un territorio…', empty: 'No hay territorios coincidentes.' },
  physical: { label: 'Buscar accidentes geográficos', placeholder: 'Buscar un río, pico o sierra…', empty: 'No hay accidentes geográficos coincidentes.' },
  transit: { label: 'Buscar líneas y paradas', placeholder: 'Buscar una línea o parada…', empty: 'No hay líneas ni paradas coincidentes.' },
}

function search(items: SearchItem[], query: string) {
  const normalizedQuery = normalizeSearch(query.trim())
  if (normalizedQuery.length < 2) return []
  return items
    .map((item) => {
      const names = [item.name, ...item.aliases].map(normalizeSearch)
      const score = names.some((name) => name === normalizedQuery) ? 0
        : names.some((name) => name.startsWith(normalizedQuery)) ? 1
          : names.some((name) => name.includes(normalizedQuery)) ? 2 : 99
      return { item, score }
    })
    .filter(({ score }) => score < 99)
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, 'es'))
    .slice(0, 12)
    .map(({ item }) => item)
}

export default function SearchBox({ items, mode, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const results = useMemo(() => search(items, query), [items, query])
  const visible = focused && query.trim().length >= 2
  const copy = SEARCH_COPY[mode]

  return (
    <div className="search-wrap">
      <label className="search-box">
        <span aria-hidden="true">⌕</span>
        <span className="sr-only">{copy.label}</span>
        <input
          value={query}
          placeholder={copy.placeholder}
          aria-label={copy.label}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            // Keep results mounted while focus moves to a result. A timeout can
            // discard slow touch/keyboard clicks before their selection fires.
            if (!event.currentTarget.closest('.search-wrap')?.contains(event.relatedTarget)) setFocused(false)
          }}
          aria-expanded={visible}
          aria-controls="search-results"
        />
        {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Borrar búsqueda">×</button>}
      </label>
      {visible && (
        <div id="search-results" className="search-results" role="listbox">
          {results.length ? results.map((item) => (
            <button key={item.id} role="option" onClick={() => { onSelect(item); setQuery(item.name); setFocused(false) }}>
              <span>{item.name}</span>
              <small>{item.kindLabel}</small>
            </button>
          )) : <p>{copy.empty}</p>}
        </div>
      )}
    </div>
  )
}
