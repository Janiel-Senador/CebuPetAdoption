import { sql, ensureSchema } from './db.js'
import { inCebu } from './util.js'

export default async function handler(req, res) {
  await ensureSchema()
  if (req.method === 'GET') {
    const r = await sql`SELECT * FROM requests`
    res.status(200).json(r.rows)
    return
  }
  if (req.method === 'POST') {
    try {
      const data = req.body || await readJson(req)
      const { id = uid(), listingId, message, contact, location } = data
      const lat = Number(location?.lat), lng = Number(location?.lng)
      if (!inCebu(lat, lng)) { res.status(400).json({ error: 'Location must be within Cebu' }); return }
      await sql`INSERT INTO requests (id,listing_id,message,contact,lat,lng,created_at) VALUES (${id},${listingId},${message},${contact},${lat},${lng},${new Date().toISOString()})`
      const ow = await sql`SELECT contact, type, name FROM listings WHERE id=${listingId}`
      if (ow.rows[0]) {
        const owner_contact = ow.rows[0].contact, ltype = ow.rows[0].type, lname = ow.rows[0].name
        const msg = `New adoption request for ${ltype} • ${lname} from ${contact}`
        await sql`INSERT INTO notifications (id, user_contact, message, created_at, read) VALUES (${uid()}, ${owner_contact}, ${msg}, ${new Date().toISOString()}, 0)`
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
