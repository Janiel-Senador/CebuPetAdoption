import { prisma } from './db.js'

export default async function handler(req, res) {
  try {
    await prisma.$executeRaw`SELECT 1`
    res.status(200).json({ status: 'ok' })
  } catch (e) {
    res.status(500).json({ status: 'error', message: String(e) })
  }
}
