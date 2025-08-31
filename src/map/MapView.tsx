import { useEffect, useRef } from 'react'
import maplibregl, { Map } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { registerPMTilesProtocol } from './pmtiles'
import { buildStyle } from './style'
import type { Mode } from '../App'

export default function MapView({ mode, granularity }: { mode: Mode, granularity: 'auto' | 'nuts0' | 'nuts1' | 'nuts2' | 'nuts3' }) {
    const mapRef = useRef<Map | null>(null)

    useEffect(() => {
        // Registrar protocolo pmtiles una sola vez
        if (!(maplibregl as any)._pmtilesRegistered) {
            registerPMTilesProtocol()
                ; (maplibregl as any)._pmtilesRegistered = true
        }

        const nutsUrl = 'pmtiles://data/nuts_eu.pmtiles' // TODO: ⚠️ coloca el archivo en /public/data o ajusta ruta

        const map = new maplibregl.Map({
            container: 'map',
            style: buildStyle(nutsUrl),
            center: [10, 50],
            zoom: 3,
            hash: true,
        })
        mapRef.current = map

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

        map.on('load', () => {
            // Reglas mínimas de granularidad por zoom (demo); en la iteración 2 lo ligamos a registry.ts
            function applyVisibility() {
                const z = map.getZoom()
                const target = granularity === 'auto'
                    ? (z < 4 ? 'nuts0' : z < 6 ? 'nuts1' : z < 8 ? 'nuts2' : 'nuts3')
                    : granularity
                // En un estilo real, separarías NUTS por capa; aquí simplificado
                map.setPaintProperty('nuts-fill', 'fill-opacity', target === 'nuts0' ? 0.2 : 0.3)
            }
            applyVisibility()
            map.on('zoomend', applyVisibility)
        })

        return () => { map.remove() }
    }, [granularity, mode])

    return <div id="map" />
}