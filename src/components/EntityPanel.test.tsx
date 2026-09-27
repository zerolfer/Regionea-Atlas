import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EntityPanel from './EntityPanel'
import type { AtlasEntity, SourceReference } from '../types'

const parish: AtlasEntity = {
  id: 'es-as-parish-330440',
  slug: 'oviedo-uviéu',
  name: 'Oviedo',
  localName: 'Uviéu',
  aliases: [],
  kind: 'parish',
  sourceId: 'sadei-parishes',
  bbox: [-5.9, 43.3, -5.7, 43.5],
  center: [-5.84, 43.36],
  parentId: 'es-as-concejo-33044',
  boundaryStatus: 'statistical',
  population: null,
  areaKm2: 26.4,
  density: null,
}

const source: SourceReference = {
  id: 'sadei-parishes',
  title: 'SADEI — Parroquias estadísticas',
  url: 'https://example.com',
  license: 'CC BY 4.0',
}

describe('EntityPanel', () => {
  it('shows a complete territorial record and the statistical-boundary warning', () => {
    render(<EntityPanel entity={parish} source={source} datasetDate="2026-09-27T10:00:00.000Z" ancestors={[]} compared={false} onCompare={vi.fn()} onNavigate={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('Delimitación estadística')).toBeInTheDocument()
    expect(screen.getByText('No constituye un deslinde jurídico oficial.')).toBeInTheDocument()
    expect(screen.getByText('Población')).toBeInTheDocument()
    expect(screen.getByText('26,4 km²')).toBeInTheDocument()
    expect(screen.getByText(/Colección 27 sept 2026/)).toBeInTheDocument()
  })
})
