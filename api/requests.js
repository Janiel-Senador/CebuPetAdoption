import { prisma, ensureSchema } from './db.js'
import { inCebu } from './util.js'

export default async function handler(req, res) {
  await ensureSchema()
  if (req.method === 'GET') {
    const r = await prisma.request.findMany()
    res.status(200).json(r)
    return
  }
  if (req.method === 'POST') {
    try {
      const data = req.body || await readJson(req)
      const { id = uid(), listingId, message, contact, location } = data
      const lat = Number(location?.lat), lng = Number(location?.lng)
      if (!inCebu(lat, lng)) { res.status(400).json({ error: 'Location must be within Cebu' }); return }
      await prisma.request.create({ data: { id, listingId, message, contact, lat, lng } })
      const ow = await prisma.listing.findUnique({ where: { id: listingId } })
      if (ow) {
        const msg = `New adoption request for ${ow.type} • ${ow.name} from ${contact}`
        await prisma.notification.create({ data: { id: uid(), userContact: ow.contact, message: msg } })
      }
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
