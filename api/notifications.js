import { prisma, ensureSchema } from './db.js'

export default async function handler(req, res) {
  await ensureSchema()
  if (req.method === 'GET') {
    const contact = (req.query && req.query.contact) || undefined
    if (contact) {
      const r = await prisma.notification.findMany({ where: { userContact: contact }, orderBy: { createdAt: 'desc' } })
      res.status(200).json(r)
    } else {
      const r = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } })
      res.status(200).json(r)
    }
    return
  }
  res.status(405).end()
}
