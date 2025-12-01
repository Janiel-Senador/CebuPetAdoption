import { prisma, ensureSchema } from './db.js'
import { inCebu } from './util.js'

export default async function handler(req, res) {
  await ensureSchema()
  if (req.method === 'GET') {
    try {
      const r = await prisma.pickup.findMany()
      res.status(200).json(r)
    } catch (e) { res.status(500).json({ error: String(e) }) }
    return
  }
  if (req.method === 'POST') {
    try {
      const data = req.body || await readJson(req)
      const { id = uid(), requestId, date, time, contact, location } = data
      const lat = Number(location?.lat), lng = Number(location?.lng)
      if (!inCebu(lat, lng)) { res.status(400).json({ error: 'Location must be within Cebu' }); return }
      await prisma.pickup.create({ data: { id, requestId, date, time, contact, lat, lng } })
      res.status(200).json({ id })
    } catch (e) { res.status(500).json({ error: String(e) }) }
    return
  }
  res.status(405).end()
}

function uid() { return Math.random().toString(36).slice(2, 10) }
async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => { try { resolve(JSON.parse(data||'{}')) } catch (e) { reject(e) } })
  })
}
