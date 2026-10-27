import { useCallback, useEffect, useRef, useState } from 'react'
import type { UserLocation } from './types'

// Live position and camera requests are separate: GPS updates must not interrupt
// exploration or reopen territorial selections on every fix.
export function useUserLocation(onToast: (message: string) => void) {
  const [enabled, setEnabled] = useState(false)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locateRequest, setLocateRequest] = useState<UserLocation | null>(null)
  const latest = useRef<{ location: UserLocation; timestamp: number } | null>(null)
  const requested = useRef(false)
  const pendingFocus = useRef(false)
  const sequence = useRef(0)
  const watchControl = useRef<{ start: () => void; stop: () => void } | null>(null)

  const locate = useCallback((showFeedback = true) => {
    if (!navigator.geolocation) { onToast('Este navegador no permite utilizar la ubicación'); return }
    requested.current = true
    pendingFocus.current = true
    if (showFeedback) onToast('Buscando tu territorio…')
    // Reuse only a recent fix; returning from suspension must await a fresh one.
    if (latest.current && Date.now() - latest.current.timestamp < 15_000) {
      setLocateRequest({ ...latest.current.location, token: ++sequence.current })
      pendingFocus.current = false
    }
    setEnabled(true)
    watchControl.current?.start()
  }, [onToast])

  const revoke = useCallback(() => {
    // Invalidate callbacks immediately, before React runs effect cleanup.
    watchControl.current?.stop()
    setEnabled(false)
    latest.current = null
    pendingFocus.current = false
    setUserLocation(null)
    setLocateRequest(null)
    if (requested.current) onToast('No hay permiso de ubicación. Puedes habilitarlo en tu navegador.')
    requested.current = false
  }, [onToast])

  useEffect(() => {
    if (!navigator.permissions) return
    let active = true
    let permission: PermissionStatus | undefined
    const changed = () => {
      if (permission?.state === 'granted') {
        if (!requested.current) locate(false)
      } else revoke()
    }
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      if (!active) return
      permission = status
      // Opening the app must never prompt for permission on its own.
      if (status.state === 'granted' && !requested.current) locate(false)
      status.addEventListener('change', changed)
    }).catch(() => undefined)
    return () => { active = false; permission?.removeEventListener('change', changed) }
  }, [locate, revoke])

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return
    const geolocation = navigator.geolocation
    let watchId: number | null = null
    let generation = 0
    let disposed = false
    let errorReported = false
    const stop = () => {
      generation++
      if (watchId !== null) geolocation.clearWatch(watchId)
      watchId = null
    }
    const start = () => {
      if (disposed || document.visibilityState === 'hidden' || watchId !== null) return
      const session = ++generation
      watchId = geolocation.watchPosition((position) => {
        if (disposed || session !== generation) return
        errorReported = false
        const location: UserLocation = {
          coordinates: [position.coords.longitude, position.coords.latitude],
          accuracy: position.coords.accuracy, token: ++sequence.current,
        }
        latest.current = { location, timestamp: position.timestamp }
        setUserLocation(location)
        if (pendingFocus.current) {
          pendingFocus.current = false
          setLocateRequest(location)
        }
      }, (error) => {
        if (disposed || session !== generation) return
        if (error.code === 1) { stop(); revoke(); return }
        if (!errorReported) onToast(latest.current
          ? 'No se puede actualizar la ubicación. Se conserva la última ubicación mientras se recupera la señal.'
          : 'No se pudo obtener la ubicación. Se volverá a intentar cuando haya señal.')
        errorReported = true
      }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 1000 })
    }
    const visibilityChanged = () => document.visibilityState === 'hidden' ? stop() : start()
    const control = { start, stop }
    watchControl.current = control
    document.addEventListener('visibilitychange', visibilityChanged)
    window.addEventListener('pagehide', stop)
    window.addEventListener('pageshow', start)
    start()
    return () => {
      disposed = true
      stop()
      if (watchControl.current === control) watchControl.current = null
      document.removeEventListener('visibilitychange', visibilityChanged)
      window.removeEventListener('pagehide', stop)
      window.removeEventListener('pageshow', start)
    }
  }, [enabled, onToast, revoke])

  return { userLocation, locateRequest, locate }
}
