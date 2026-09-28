import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PHYSICAL_FILTERS, parseInitialUrl } from './url-state'

afterEach(() => window.history.replaceState({}, '', '/'))

describe('estado compartible del atlas', () => {
  it('restaura modo, selección, comparación, filtros y encuadre', () => {
    window.history.replaceState({}, '', '/mapa/fisico?seleccion=physical-1&comparar=a,b,c,d&filtros=peaks,coast&nivel=concejos&lng=-5.67&lat=43.54&z=10.25')
    const state = parseInitialUrl()

    expect(state.mode).toBe('physical')
    expect(state.selectedId).toBe('physical-1')
    expect(state.compareIds).toEqual(['a', 'b', 'c'])
    expect([...state.filters]).toEqual(['peaks', 'coast'])
    expect(state.politicalLevel).toBe('concejos')
    expect(state.view).toEqual({ center: [-5.67, 43.54], zoom: 10.25 })
  })

  it('ignora filtros desconocidos y usa Asturias como vista segura', () => {
    window.history.replaceState({}, '', '/mapa/politico?filtros=unknown&lng=no&lat=43&z=no')
    const state = parseInitialUrl()

    expect(state.mode).toBe('political')
    expect([...state.filters]).toEqual([])
    expect(state.view).toEqual({ center: [-5.86, 43.31], zoom: 8 })
  })

  it('no interpreta la ausencia de parámetros como coordenadas 0/0', () => {
    window.history.replaceState({}, '', '/mapa/politico')
    expect(parseInitialUrl().view).toEqual({ center: [-5.86, 43.31], zoom: 8 })
  })

  it('restaura el nivel manual de barrios', () => {
    window.history.replaceState({}, '', '/mapa/politico?nivel=neighborhoods')
    expect(parseInitialUrl().politicalLevel).toBe('neighborhoods')
  })

  it('restaura filtros compartidos de transporte', () => {
    window.history.replaceState({}, '', '/mapa/transporte?fuentes=CTA,RENFE&transportes=bus,rail&tiempoReal=0')
    const state = parseInitialUrl()

    expect([...state.transitProviders]).toEqual(['CTA', 'RENFE'])
    expect([...state.transitModes]).toEqual(['bus', 'rail'])
    expect(state.showRealtime).toBe(false)
  })
})

it('keeps optional elevation layers disabled in the default physical view', () => {
  window.history.replaceState({}, '', '/mapa/fisico')

  const state = parseInitialUrl()

  expect([...state.filters]).toEqual(DEFAULT_PHYSICAL_FILTERS)
  expect(state.filters.has('hypsometry')).toBe(false)
  expect(state.filters.has('terrain3d')).toBe(false)
})
