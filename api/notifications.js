import { sql, ensureSchema } from './db.js'

export default async function handler(req, res) {
  await ensureSchema()
  if (req.method === 'GET') {
    const contact = (req.query && req.query.contact) || undefined
    if (contact) {
      const r = await sql`SELECT * FROM notifications WHERE user_contact=${contact} ORDER BY created_at DESC`
      res.status(200).json(r.rows)
    } else {
      const r = await sql`SELECT * FROM notifications ORDER BY created_at DESC`
      res.status(200).json(r.rows)
    }
    return
  }
  res.status(405).end()
}
