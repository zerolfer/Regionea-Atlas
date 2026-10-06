export function cartographicName(value) {
  const raw = String(value || '').trim()
  // In these CAD annotations wide spacing separates words, while individual
  // letters have one/two spaces. Ambiguous fragments are preserved, not joined
  // to neighbouring records to invent a geographic identity.
  const name = raw.split(/\s{3,}/u).map(part => /^(?:\p{L}\s{1,2})+\p{L}$/u.test(part)
    ? part.replace(/\s/gu, '') : part).join(' ').replace(/\s+/gu, ' ').trim()
  const normalized = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const generic = /^(sierra|cordal|cordillera|monte|montes|pico|pena|alto|collada|de|del|la|las|el|los)$/u
  const labelEligible = name.length >= 3 && !generic.test(normalized)
    && !/\b(de|del|la|las|el|los)$/u.test(normalized)
    && !name.split(' ').every(word => word.length === 1)
  return { name, labelEligible }
}

export function physicalLabelCollection(features, include = () => true) {
  const seen = new Set()
  return { type: 'FeatureCollection', features: features.filter(include).filter(feature => {
    const p = feature.properties
    if (!p.name?.trim() || !p.center || p.labelEligible === false || seen.has(feature.id)) return false
    seen.add(feature.id)
    return true
  }).map(feature => ({ type: 'Feature', id: feature.id, properties: feature.properties, geometry: { type: 'Point', coordinates: feature.properties.center } })) }
}
