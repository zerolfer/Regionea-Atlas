import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ComparePanel from './ComparePanel'
import type { AtlasEntity } from '../types'

function territory(id: string, name: string, population: number | null): AtlasEntity {
  return {
    id,
    slug: id,
    name,
    aliases: [],
    kind: 'municipality',
    sourceId: 'test',
    bbox: null,
    center: null,
    population,
    areaKm2: 10,
    density: null,
  }
}

describe('ComparePanel', () => {
  it('only shows indicators available for every compared territory', () => {
    render(<ComparePanel entities={[territory('a', 'A', 100), territory('b', 'B', null)]} onRemove={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('Superficie')).toBeInTheDocument()
    expect(screen.queryByText('Población')).not.toBeInTheDocument()
    expect(screen.queryByText('Densidad')).not.toBeInTheDocument()
  })
})
