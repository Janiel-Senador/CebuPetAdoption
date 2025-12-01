import { prisma, ensureSchema } from './db.js'

export default async function handler(req, res) {
  await ensureSchema()
  if (req.method === 'POST') {
    try {
      const data = req.body || await readJson(req)
      const ids = Array.isArray(data.ids) ? data.ids : []
      await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { read: 1 } })
      res.status(200).json({ updated: ids.length })
    } catch (e) { res.status(500).json({ error: String(e) }) }
    return
  }
  res.status(405).end()
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => { try { resolve(JSON.parse(data||'{}')) } catch (e) { reject(e) } })
  })
}
