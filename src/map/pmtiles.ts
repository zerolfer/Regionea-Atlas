import * as pmtiles from 'pmtiles'
import maplibregl from 'maplibre-gl'

let isPmtilesProtocolRegistered = false

// Registrar protocolo pmtiles:// para MapLibre de forma idempotente
export function registerPMTilesProtocol() {
    if (isPmtilesProtocolRegistered) return
    const protocol = new pmtiles.Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)
    isPmtilesProtocolRegistered = true
}