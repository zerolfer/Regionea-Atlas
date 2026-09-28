import { describe, expect, it } from 'vitest'
import { buildNeighborhoods } from './sync-atlas-data.mjs'

const parentIds = {
  'Avilés': 'es-as-concejo-33004',
  'Gijón / Xixón': 'es-as-concejo-33024',
  'Langreo / Llangréu': 'es-as-concejo-33031',
  Mieres: 'es-as-concejo-33037',
  'Oviedo / Uviéu': 'es-as-concejo-33044',
}

function sourceFor(parentNames) {
  const features = parentNames.map((parent, index) => ({
    type: 'Feature',
    properties: { Barrio: `Barrio ${index + 1}`, CodeB: `B${index + 1}`, parro: parent },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-5.9 + index * 0.01, 43.3],
        [-5.89 + index * 0.01, 43.3],
        [-5.89 + index * 0.01, 43.31],
        [-5.9 + index * 0.01, 43.31],
        [-5.9 + index * 0.01, 43.3],
      ]],
    },
  }))
  return `var json_Barrios_2 = ${JSON.stringify({ type: 'FeatureCollection', features })}`
}

describe('importación de barrios SADEI', () => {
  it('asigna las cinco áreas urbanas a su concejo', () => {
    const names = Object.keys(parentIds)
    const neighborhoods = buildNeighborhoods(sourceFor(names))

    expect(neighborhoods).toHaveLength(5)
    expect(Object.fromEntries(neighborhoods.map(({ properties }) => [properties.slug.split('-barrio-')[0], properties.parentId]))).toEqual({
      aviles: parentIds['Avilés'],
      'gijon-xixon': parentIds['Gijón / Xixón'],
      'langreo-llangreu': parentIds['Langreo / Llangréu'],
      mieres: parentIds.Mieres,
      'oviedo-uvieu': parentIds['Oviedo / Uviéu'],
    })
    expect(neighborhoods.every(({ properties }) => properties.boundaryStatus === 'statistical')).toBe(true)
  })

  it('falla de forma explícita si SADEI añade un área urbana sin relación conocida', () => {
    expect(() => buildNeighborhoods(sourceFor(['Área desconocida']))).toThrow('Barrios sin concejo asociado: Área desconocida')
  })
})
