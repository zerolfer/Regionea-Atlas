import { useEffect, useRef } from 'react'
import maplibregl, { Map } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { registerPMTilesProtocol } from './pmtiles'
import { buildStyle } from './style'
import type { Mode } from '../App'

export default function MapView({ mode, granularity }: { mode: Mode, granularity: 'auto' | 'nuts0' | 'nuts1' | 'nuts2' | 'nuts3' }) {
    const mapRef = useRef<Map | null>(null)

    const GROUPS = {
        nuts0: ['nuts0-fill', 'nuts0-outline', 'nuts0-labels'],
        nuts1: ['nuts1-fill', 'nuts1-outline', 'nuts1-labels'],
        nuts2: ['nuts2-fill', 'nuts2-outline', 'nuts2-labels'],
        nuts3: ['nuts3-fill', 'nuts3-outline', 'nuts3-labels'],
    }

    // helper para mostrar/ocultar grupos
    function setVisibility(map: maplibregl.Map, show: Array<keyof typeof GROUPS>) {
        (Object.keys(GROUPS) as Array<keyof typeof GROUPS>).forEach(g => {
            const visibility = show.includes(g) ? 'visible' : 'none'
            GROUPS[g].forEach(id => {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility)
            })
        })
    }

    // aplica granularidad 'auto' o fija
    function applyGranularity(map: maplibregl.Map, granularity: 'auto' | 'nuts0' | 'nuts1' | 'nuts2' | 'nuts3') {
        if (granularity === 'auto') {
            // Deja que gobiernen minzoom/maxzoom del style:
            // hacemos visible todo (MapLibre ya recorta por min/max)
            setVisibility(map, ['nuts0', 'nuts1', 'nuts2', 'nuts3'])
        } else {
            // Fuerza solo ese nivel
            setVisibility(map, [granularity])
        }
    }


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
            applyGranularity(map, granularity)
        })

        for (let i = 0; i <= 3; i++) {
            map.on('click', `nuts${i}-labels`, e => {
                console.log(e.features?.[0]?.properties);
            });
        }


        return () => { map.remove() }
    }, [granularity, mode])

    return <div id="map" />
}