import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PHYSICAL_FILTERS, parseInitialUrl, writeCameraParams } from './url-state'

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
    expect(state.view).toEqual({ center: [-5.67, 43.54], zoom: 10.25, pitch: 0, bearing: 0 })
  })

  it('ignora filtros desconocidos y usa Asturias como vista segura', () => {
    window.history.replaceState({}, '', '/mapa/politico?filtros=unknown&lng=no&lat=43&z=no')
    const state = parseInitialUrl()

    expect(state.mode).toBe('political')
    expect([...state.filters]).toEqual([])
    expect(state.view).toEqual({ center: [-5.86, 43.31], zoom: 8, pitch: 0, bearing: 0 })
  })

  it('no interpreta la ausencia de parámetros como coordenadas 0/0', () => {
    window.history.replaceState({}, '', '/mapa/politico')
    expect(parseInitialUrl().view).toEqual({ center: [-5.86, 43.31], zoom: 8, pitch: 0, bearing: 0 })
  })

  it('restaura el nivel manual de barrios', () => {
    window.history.replaceState({}, '', '/mapa/politico?nivel=neighborhoods')
    expect(parseInitialUrl().politicalLevel).toBe('neighborhoods')
  })

  it('conserva todos los filtros desactivados al compartir una vista', () => {
    window.history.replaceState({}, '', '/mapa/fisico?filtros=')
    expect([...parseInitialUrl().filters]).toEqual([])
  })

  it('restaura filtros compartidos de transporte', () => {
    window.history.replaceState({}, '', '/mapa/transporte?fuentes=CTA,RENFE&transportes=bus,rail&tiempoReal=0')
    const state = parseInitialUrl()

    expect([...state.transitProviders]).toEqual(['CTA', 'RENFE'])
    expect([...state.transitModes]).toEqual(['bus', 'rail'])
    expect(state.showRealtime).toBe(false)
  })
})

it('separa ajustes de presentación de filtros geográficos en enlaces antiguos', () => {
  window.history.replaceState({}, '', '/mapa/fisico?fondo=satelite&filtros=peaks,hypsometry,terrain3d&pitch=74&bearing=125')
  const state = parseInitialUrl()
  expect(state.appearance).toEqual({ basemap: 'satellite', hypsometry: true, terrain3d: true })
  expect([...state.filters]).toEqual(['peaks'])
  expect(state.view).toMatchObject({ pitch: 74, bearing: 125 })
})

it('acota cámaras compartidas y conserva enlaces 3D sin inclinación explícita', () => {
  window.history.replaceState({}, '', '/mapa/fisico?filtros=terrain3d&pitch=999&bearing=no')
  expect(parseInitialUrl().view).toMatchObject({ pitch: 80, bearing: 0 })
  window.history.replaceState({}, '', '/mapa/fisico?filtros=terrain3d')
  expect(parseInitialUrl().view.pitch).toBe(60)
  window.history.replaceState({}, '', '/mapa/transporte?fondo=unknown&pitch=70')
  expect(parseInitialUrl().appearance.basemap).toBe('plan')
  expect(parseInitialUrl().view.pitch).toBe(0)
})

it('comparte una vista 3D horizontal sin confundir inclinación cero con ausencia de parámetro', () => {
  const params = new URLSearchParams('filtros=terrain3d')
  writeCameraParams(params, { center: [-4.8, 43.2], zoom: 12, pitch: 0, bearing: 125 }, true)
  window.history.replaceState({}, '', `/mapa/fisico?${params}`)
  expect(params.get('pitch')).toBe('0.0')
  expect(parseInitialUrl().view).toEqual({ center: [-4.8, 43.2], zoom: 12, pitch: 0, bearing: 125 })
})

it('keeps optional elevation layers disabled in the default physical view', () => {
  window.history.replaceState({}, '', '/mapa/fisico')

  const state = parseInitialUrl()

  expect([...state.filters]).toEqual(DEFAULT_PHYSICAL_FILTERS)
  expect(state.appearance.hypsometry).toBe(false)
  expect(state.appearance.terrain3d).toBe(false)
})
