import { useEffect, useRef } from 'react'
import maplibregl, { Map } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { registerPMTilesProtocol } from './pmtiles'
import { buildStyle } from './style'
import type { GranMode, Level } from '../types'

export default function MapView({
    // mode, // XXX: De momento sin uso
    granMode,
    level,
    onAutoLevel,
    onToast
}: {
    // mode: Mode, // XXX: De momento sin uso
    granMode: GranMode,
    level: Level,
    onAutoLevel?: (lvl: Level) => void,
    onToast?: (message: string) => void
}
) {
    const mapRef = useRef<Map | null>(null)
    const headingMarkerRef = useRef<maplibregl.Marker | null>(null)
    const lastPosRef = useRef<{ lng: number, lat: number } | null>(null)

    const GROUPS = {
        nuts0: [/*'nuts0-fill',*/ 'nuts0-outline', 'nuts0-labels'],
        nuts1: [/*'nuts1-fill',*/ 'nuts1-outline', 'nuts1-labels'],
        nuts2: [/*'nuts2-fill',*/ 'nuts2-outline', 'nuts2-labels'],
        nuts3: [/*'nuts3-fill',*/ 'nuts3-outline', 'nuts3-labels'],
    }

    const ORDER = ['nuts0', 'nuts1', 'nuts2', 'nuts3'] as const
    type LocalLevel = typeof ORDER[number]
    const LEVEL_CODE: Record<LocalLevel, '0' | '1' | '2' | '3'> = {
        nuts0: '0', nuts1: '1', nuts2: '2', nuts3: '3'
    }


    const EASE_DURATION = 500

    // const LEVEL_ZOOM_RANGE: Record<'nuts0' | 'nuts1' | 'nuts2' | 'nuts3', { min: number, max: number }> = {
    //     nuts0: { min: 0, max: 3.9 }, // países
    //     nuts1: { min: 4.0, max: 5.9 }, // grandes regiones
    //     nuts2: { min: 6.0, max: 7.9 },
    //     nuts3: { min: 8.0, max: 22.0 }
    // }

    // type Level = 'nuts0' | 'nuts1' | 'nuts2' | 'nuts3'

    function levelFromZoom(z: number): LocalLevel {
        if (z < 4) return 'nuts0'
        if (z < 6) return 'nuts1'
        if (z < 8) return 'nuts2'
        return 'nuts3'
    }

    const AUTO_ZOOM_RANGE: Record<keyof typeof GROUPS, { min: number, max: number }> = {
        nuts0: { min: 0, max: 4 },   // visible <4
        nuts1: { min: 4, max: 6 },
        nuts2: { min: 6, max: 8 },
        nuts3: { min: 8, max: 24 },
    } as const

    function ensureZoomInRange(map: maplibregl.Map, level: keyof typeof AUTO_ZOOM_RANGE) {
        const z = map.getZoom()
        const { min, max } = AUTO_ZOOM_RANGE[level]
        if (z < min) {
            map.easeTo({ zoom: min + 0.01, duration: EASE_DURATION })
        } else if (z > max) {
            map.easeTo({ zoom: Math.max(min, max - 0.01), duration: EASE_DURATION })
        }
    }


    function setGroupZoomRange(map: maplibregl.Map, ids: string[], min: number, max: number) {
        ids.forEach(id => map.getLayer(id) && map.setLayerZoomRange(id, min, max))
    }

    // Al entrar en MANUAL: desactivar auto-ocultado (mostrar siempre)
    function enableManualZoomRanges(map: maplibregl.Map) {
        Object.values(GROUPS).forEach(ids => setGroupZoomRange(map, ids, 0, 24))
    }

    // Al volver a AUTO: restaurar rangos por nivel
    function enableAutoZoomRanges(map: maplibregl.Map) {
        (Object.keys(GROUPS) as Array<keyof typeof GROUPS>).forEach(k => {
            const { min, max } = AUTO_ZOOM_RANGE[k]
            setGroupZoomRange(map, GROUPS[k], min, max)
        })
    }
    function setLevelFilter(map: maplibregl.Map, granMode: GranMode, level: LocalLevel) {
        // Asegura visibilidad (controlaremos con filtros/opacidades)
        (Object.values(GROUPS).flat()).forEach(id => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible')
        })

        if (granMode === 'auto') {
            // Cada capa filtra su propio nivel (el style decide por min/max u opacidades por zoom)
            ORDER.forEach(lvl => {
                const code = LEVEL_CODE[lvl]
                const ids = GROUPS[lvl]
                ids.forEach(id => {
                    if (!map.getLayer(id)) return
                    map.setFilter(id, ['==', ['to-string', ['get', 'LEVL_CODE']], code])
                    // Opcional: restaurar opacidades base si las tocas en manual
                    if (id.endsWith('-labels')) map.setPaintProperty(id, 'text-opacity', 1)
                })
            })
            return
        }

        // === MANUAL ===
        const currentIdx = ORDER.indexOf(level)

        ORDER.forEach((lvl, idx) => {
            const code = LEVEL_CODE[lvl]
            const fillId = `${lvl}-fill`
            const lineId = `${lvl}-outline`
            const labelId = `${lvl}-labels`

            // LABELS: solo del nivel actual
            if (map.getLayer(labelId)) {
                map.setFilter(labelId,
                    lvl === level
                        ? ['==', ['to-string', ['get', 'LEVL_CODE']], code]
                        : ['==', ['to-string', ['get', 'LEVL_CODE']], '__none__']
                )
                map.setPaintProperty(labelId, 'text-opacity', lvl === level ? 1 : 0)
            }

            // FILL: si usas fills, aplica igual que labels (solo nivel actual)
            if (map.getLayer(fillId)) {
                map.setFilter(fillId,
                    lvl === level
                        ? ['==', ['to-string', ['get', 'LEVL_CODE']], code]
                        : ['==', ['to-string', ['get', 'LEVL_CODE']], '__none__']
                )
                // Ajusta opacidad base del fill del nivel actual si lo usas
                if (lvl === level) map.setPaintProperty(fillId, 'fill-opacity', 0.35)
            }

            // OUTLINE: nivel actual + niveles superiores (coarser ⇒ idx menor)
            if (map.getLayer(lineId)) {
                const show = idx <= currentIdx
                map.setFilter(lineId,
                    show
                        ? ['==', ['to-string', ['get', 'LEVL_CODE']], code]
                        : ['==', ['to-string', ['get', 'LEVL_CODE']], '__none__']
                )
                // Estilo contextual (más arriba → más fino y translúcido)
                const delta = currentIdx - idx // 0 actual, 1 un nivel arriba, etc.
                const width = delta === 0 ? 1.2 : delta === 1 ? 1.0 : delta === 2 ? 0.8 : 0.6
                const opacity = delta === 0 ? 1.0 : delta === 1 ? 0.7 : delta === 2 ? 0.5 : 0.35
                map.setPaintProperty(lineId, 'line-width', width)
                map.setPaintProperty(lineId, 'line-opacity', opacity)
            }
        })
    }



    useEffect(() => {
        // Registrar protocolo pmtiles una sola vez
        registerPMTilesProtocol()

        const nutsUrl = 'pmtiles://data/nuts_eu.pmtiles'

        const map = new maplibregl.Map({
            container: 'map',
            style: buildStyle(nutsUrl),
            center: [10, 50],
            zoom: 3,
            hash: true,
            maxTileCacheSize: 1024,
            fadeDuration: 0,
            maxTileCacheZoomLevels: 10

        })
        mapRef.current = map

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
        // Control de geolocalización (botón para ir a mi ubicación y mostrar punto)
        const geolocate = new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserLocation: true,
            showAccuracyCircle: false,
            fitBoundsOptions: { maxZoom: 10 },
        })
        map.addControl(geolocate, 'top-right')
        geolocate.on('error', () => onToast?.('No se pudo acceder a la ubicación'))

        function ensureHeadingMarker(): maplibregl.Marker {
            if (headingMarkerRef.current) return headingMarkerRef.current
            const el = document.createElement('div')
            el.className = 'heading-arrow'
            const m = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
            headingMarkerRef.current = m
            m.addTo(map)
            return m
        }

        function updateHeading(lng: number, lat: number, headingDeg?: number | null) {
            const marker = ensureHeadingMarker()
            marker.setLngLat([lng, lat])
            lastPosRef.current = { lng, lat }
            const el = marker.getElement()
            if (typeof headingDeg === 'number' && !Number.isNaN(headingDeg)) {
                el.style.transform = `rotate(${headingDeg}deg)`
            } else {
                el.style.transform = ''
            }
        }

        geolocate.on('geolocate', (e: GeolocationPosition) => {
            const { longitude, latitude, heading } = e.coords as GeolocationCoordinates & { heading?: number | null }
            updateHeading(longitude, latitude, heading ?? null)
        })

        // Fallback a orientación del dispositivo para rotar la flecha si no hay heading del GPS
        const onDeviceOrientation = (evt: DeviceOrientationEvent) => {
            if (!lastPosRef.current) return
            // alpha: 0–360 respecto al norte
            const alpha = typeof evt.alpha === 'number' ? evt.alpha : null
            if (alpha == null) return
            updateHeading(lastPosRef.current.lng, lastPosRef.current.lat, alpha)
        }
        window.addEventListener('deviceorientation', onDeviceOrientation)

        map.on('load', () => {
            // switchGroup(map, granularity)
            setLevelFilter(map, granMode, level)
            if (granMode === 'manual') ensureZoomInRange(map, level)
        })

        // Registrar el handler de click para todos los niveles NUTS 0-3
        for (let i = 0; i < Object.keys(GROUPS).length; i++) {
            map.on('click', `nuts${i}-labels`, (e: maplibregl.MapLayerMouseEvent) => {
                const props = e.features?.[0]?.properties as any
                try {
                    onToast?.(JSON.stringify(props, null, 2))
                } catch {
                    const name = props?.NAME_LATN || props?.NUTS_ID || 'Sin nombre'
                    const code = props?.NUTS_ID ? ` (${props.NUTS_ID})` : ''
                    onToast?.(`${name}${code}`)
                }
            });
        }

        return () => {
            window.removeEventListener('deviceorientation', onDeviceOrientation)
            if (headingMarkerRef.current) {
                headingMarkerRef.current.remove()
                headingMarkerRef.current = null
            }
            map.remove()
        }
    }, [])

    useEffect(() => {
        const map = mapRef.current
        if (!map || !map.isStyleLoaded()) return

        if (granMode === 'manual') {
            const z = map.getZoom()
            const autoLevel = levelFromZoom(z)
            onAutoLevel?.(autoLevel)             // ← actualiza App
            enableManualZoomRanges(map)          // ← quita min/max por capa
            setLevelFilter(map, 'manual', autoLevel) // ← ahora aplica contexto
            ensureZoomInRange(map, autoLevel)
        } else {
            enableAutoZoomRanges(map)
            setLevelFilter(map, 'auto', level)
        }
    }, [granMode])

    // cuando cambia el nivel en manual
    useEffect(() => {
        const map = mapRef.current
        if (!map || !map.isStyleLoaded() || granMode !== 'manual') return
        setLevelFilter(map, 'manual', level)
        ensureZoomInRange(map, level)
    }, [level, granMode])


    return <div id="map" />
}