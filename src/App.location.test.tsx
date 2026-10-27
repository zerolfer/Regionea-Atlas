import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { StrictMode } from 'react'
import type MapView from './map/MapView'
import manifest from '../public/data/atlas/manifest.json'
import App from './App'

const map = vi.hoisted(() => ({ props: null as ComponentProps<typeof MapView> | null }))
// Only the WebGL/analytics and browser/network boundaries are substituted.
vi.mock('./map/MapView', () => ({ default: (props: ComponentProps<typeof MapView>) => { map.props = props; return null } }))
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }))

let success: PositionCallback
let failure: PositionErrorCallback
let permission: EventTarget & { state: PermissionState }
let hidden: boolean
const watch = vi.fn()
const clear = vi.fn()

beforeEach(() => {
  map.props = null
  hidden = false
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => hidden ? 'hidden' : 'visible')
  permission = Object.assign(new EventTarget(), { state: 'prompt' as PermissionState })
  watch.mockImplementation((onSuccess: PositionCallback, onError: PositionErrorCallback) => {
    success = onSuccess; failure = onError; return 0
  })
  vi.stubGlobal('navigator', Object.create(navigator, {
    userAgent: { value: navigator.userAgent }, platform: { value: navigator.platform },
    permissions: { configurable: true, value: { query: async () => permission } },
    geolocation: { configurable: true, value: { watchPosition: watch, clearWatch: clear, getCurrentPosition: vi.fn() } },
  }))
  const bodies: Record<string, unknown> = {
    '/data/atlas/manifest.json': manifest, '/data/atlas/editorial.json': {},
    '/data/atlas/catalog.json': { territories: [], physical: [] },
    '/data/atlas/transit/manifest.json': { status: 'scheduled' },
    '/data/atlas/transit/routes.geojson': { type: 'FeatureCollection', features: [] },
    '/data/atlas/transit/stops.geojson': { type: 'FeatureCollection', features: [] },
  }
  vi.stubGlobal('fetch', async (url: string) => {
    if (!(url in bodies)) throw new Error(`URL inesperada: ${url}`)
    return { ok: true, json: async () => bodies[url] }
  })
  window.history.replaceState({}, '', '/mapa/fisico')
})

afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals() })

async function setup() {
  let result: ReturnType<typeof render>
  await act(async () => { result = render(<App />) })
  return result!
}

function position(longitude: number, latitude: number): GeolocationPosition {
  return { coords: { longitude, latitude, accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() } as GeolocationPosition
}

function locate() { fireEvent.click(screen.getByRole('button', { name: 'Ver mi territorio' })) }

it('actualiza la posición sucesivamente sin repetir el encuadre ni cambiar de modo', async () => {
  await setup()
  locate()
  expect(watch).toHaveBeenCalledOnce()
  act(() => success(position(-5.69, 43.54)))
  expect(map.props?.userLocation?.coordinates).toEqual([-5.69, 43.54])
  const focus = map.props?.locateRequest
  act(() => success(position(-5.68, 43.55)))
  expect(map.props?.userLocation?.coordinates).toEqual([-5.68, 43.55])
  expect(map.props?.locateRequest).toBe(focus)
  expect(map.props?.mode).toBe('physical')
  locate()
  expect(map.props?.locateRequest?.coordinates).toEqual([-5.68, 43.55])
  expect(map.props?.locateRequest?.token).not.toBe(focus?.token)
  expect(watch).toHaveBeenCalledOnce()
})

it('arranca automáticamente solo cuando el permiso ya estaba concedido', async () => {
  permission.state = 'granted'
  await setup()
  expect(watch).toHaveBeenCalledOnce()
  act(() => success(position(-5.69, 43.54)))
  expect(map.props?.userLocation?.accuracy).toBe(8)
  expect(map.props?.locateRequest?.coordinates).toEqual([-5.69, 43.54])
})

it('no provoca una petición de permiso al abrir sin autorización previa', async () => {
  await setup()
  expect(watch).not.toHaveBeenCalled()
  expect(map.props?.userLocation).toBeNull()
})

it('libera incluso un watch con id cero y descarta respuestas después de desmontar', async () => {
  const { unmount } = await setup()
  locate()
  expect(watch).toHaveBeenCalledOnce()
  const previous = map.props
  unmount()
  expect(clear).toHaveBeenCalledWith(0)
  act(() => success(position(-5.69, 43.54)))
  expect(map.props).toBe(previous)
})

it('pausa oculta y reanuda visible sin recentrar, ignorando lecturas del watch anterior', async () => {
  await setup()
  locate()
  expect(watch).toHaveBeenCalledOnce()
  act(() => success(position(-5.69, 43.54)))
  const previousSuccess = success
  const focus = map.props?.locateRequest
  hidden = true
  fireEvent(document, new Event('visibilitychange'))
  expect(clear).toHaveBeenCalledWith(0)
  hidden = false
  fireEvent(document, new Event('visibilitychange'))
  expect(watch).toHaveBeenCalledTimes(2)
  act(() => success(position(-5.68, 43.55)))
  act(() => previousSuccess(position(-6, 43)))
  expect(map.props?.userLocation?.coordinates).toEqual([-5.68, 43.55])
  expect(map.props?.locateRequest).toBe(focus)
})

it('un error temporal conserva el seguimiento y una lectura posterior recupera la posición', async () => {
  await setup()
  locate()
  expect(watch).toHaveBeenCalledOnce()
  act(() => success(position(-5.69, 43.54)))
  act(() => failure({ code: 3 } as GeolocationPositionError))
  expect(screen.getByText(/última ubicación/i)).toBeInTheDocument()
  expect(clear).not.toHaveBeenCalled()
  act(() => success(position(-5.68, 43.55)))
  expect(map.props?.userLocation?.coordinates).toEqual([-5.68, 43.55])
})

it('revocar el permiso retira el marcador y detiene el seguimiento', async () => {
  permission.state = 'granted'
  await setup()
  expect(watch).toHaveBeenCalledOnce()
  act(() => success(position(-5.69, 43.54)))
  act(() => { permission.state = 'denied'; permission.dispatchEvent(new Event('change')) })
  expect(clear).toHaveBeenCalledWith(0)
  expect(map.props?.userLocation).toBeNull()
})

it('una lectura pendiente al revocar no restaura el marcador antes de limpiar el efecto', async () => {
  permission.state = 'granted'
  await setup()
  expect(watch).toHaveBeenCalledOnce()
  act(() => success(position(-5.69, 43.54)))
  act(() => {
    permission.state = 'denied'
    permission.dispatchEvent(new Event('change'))
    success(position(-5.68, 43.55))
  })
  expect(map.props?.userLocation).toBeNull()
  expect(clear).toHaveBeenCalledWith(0)
})

it('revocar y conceder de nuevo inicia otro watch e invalida la lectura anterior incluso en el mismo lote', async () => {
  permission.state = 'granted'
  await setup()
  const oldSuccess = success
  act(() => {
    permission.state = 'denied'
    permission.dispatchEvent(new Event('change'))
    permission.state = 'granted'
    permission.dispatchEvent(new Event('change'))
    oldSuccess(position(-6, 43))
  })
  expect(watch).toHaveBeenCalledTimes(2)
  expect(map.props?.userLocation).toBeNull()
  act(() => success(position(-5.69, 43.54)))
  expect(map.props?.userLocation?.coordinates).toEqual([-5.69, 43.54])
})

it('suspender y restaurar la página libera y reanuda una sola suscripción', async () => {
  await setup()
  locate()
  expect(watch).toHaveBeenCalledOnce()
  fireEvent(window, new Event('pagehide'))
  expect(clear).toHaveBeenCalledWith(0)
  fireEvent(window, new Event('pageshow'))
  fireEvent(window, new Event('pageshow'))
  expect(watch).toHaveBeenCalledTimes(2)
})

it('denegar la solicitud no deja un marcador ni un watch activo', async () => {
  await setup()
  locate()
  expect(watch).toHaveBeenCalledOnce()
  act(() => failure({ code: 1 } as GeolocationPositionError))
  expect(clear).toHaveBeenCalledWith(0)
  expect(map.props?.userLocation).toBeNull()
  expect(screen.getByText(/permiso de ubicación/i)).toBeInTheDocument()
})

it('funciona sin Permissions API y solo inicia el GPS tras pulsar el botón', async () => {
  Object.defineProperty(navigator, 'permissions', { value: undefined })
  await setup()
  expect(watch).not.toHaveBeenCalled()
  locate()
  expect(watch).toHaveBeenCalledOnce()
  act(() => success(position(-5.69, 43.54)))
  expect(map.props?.userLocation?.coordinates).toEqual([-5.69, 43.54])
})

it('informa si el navegador no soporta geolocalización', async () => {
  Object.defineProperty(navigator, 'geolocation', { value: undefined })
  await setup()
  locate()
  expect(screen.getByText(/no permite utilizar la ubicación/i)).toBeInTheDocument()
  expect(watch).not.toHaveBeenCalled()
})

it('una respuesta tardía de permisos no arranca el GPS tras desmontar', async () => {
  let resolve!: (status: typeof permission) => void
  Object.defineProperty(navigator, 'permissions', { value: { query: () => new Promise((done) => { resolve = done }) } })
  const { unmount } = await setup()
  unmount()
  permission.state = 'granted'
  await act(async () => resolve(permission))
  expect(watch).not.toHaveBeenCalled()
})

it('StrictMode mantiene una sola suscripción y elimina el listener al salir', async () => {
  permission.state = 'granted'
  let unmount!: () => void
  await act(async () => { ({ unmount } = render(<StrictMode><App /></StrictMode>)) })
  expect(watch).toHaveBeenCalledOnce()
  unmount()
  expect(clear).toHaveBeenCalledOnce()
  act(() => { permission.state = 'denied'; permission.dispatchEvent(new Event('change')) })
  expect(clear).toHaveBeenCalledOnce()
})
