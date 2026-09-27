import { put } from '@vercel/blob'

const FEEDS = [
  ['cta', 'CTA_GTFS_URL'],
  ['alsa', 'ALSA_GTFS_URL'],
  ['renfe', 'RENFE_GTFS_URL'],
]

export default async function handler(request, response) {
  if (process.env.CRON_SECRET && request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: 'No autorizado' })
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return response.status(503).json({ error: 'BLOB_READ_WRITE_TOKEN no configurado' })
  const results = []
  for (const [provider, envName] of FEEDS) {
    const url = process.env[envName]
    if (!url) { results.push({ provider, status: 'skipped', reason: `${envName} no configurada` }); continue }
    try {
      const napToken = process.env.NAP_API_TOKEN || process.env.NAP_TOKEN
      const upstream = await fetch(url, { headers: napToken ? { Authorization: `Bearer ${napToken}` } : {} })
      if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`)
      const body = await upstream.arrayBuffer()
      const blob = await put(`gtfs/raw/${provider}/latest.zip`, body, { access: 'private', addRandomSuffix: false, contentType: 'application/zip' })
      results.push({ provider, status: 'downloaded', bytes: body.byteLength, pathname: blob.pathname })
    } catch (error) {
      results.push({ provider, status: 'failed', reason: error.message })
    }
  }
  const failed = results.some((item) => item.status === 'failed')
  return response.status(failed ? 207 : 200).json({ checkedAt: new Date().toISOString(), results })
}
