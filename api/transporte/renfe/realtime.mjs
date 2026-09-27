import { getRenfeRealtime } from '../../_lib/renfe-realtime.mjs'

export default async function handler(_request, response) {
  response.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=45')
  const data = await getRenfeRealtime()
  return response.status(data.status === 'unavailable' ? 503 : 200).json(data)
}
