import * as pmtiles from 'pmtiles'
import maplibregl from 'maplibre-gl'

// Registrar protocolo pmtiles:// para MapLibre
export function registerPMTilesProtocol() {
    const protocol = new pmtiles.Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)
}