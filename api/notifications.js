import { prisma, ensureSchema } from './db.js'

export default async function handler(req, res) {
  await ensureSchema()
  if (req.method === 'GET') {
    const contact = (req.query && req.query.contact) || undefined
    try {
      if (contact) {
        const r = await prisma.notification.findMany({ where: { userContact: contact }, orderBy: { createdAt: 'desc' } })
        res.status(200).json(r)
      } else {
        const r = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } })
        res.status(200).json(r)
      }
    } catch (e) { res.status(500).json({ error: String(e) }) }
    return
  }
  res.status(405).end()
}
