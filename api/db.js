import pg from 'pg'

const { Pool } = pg
const DATABASE_URL = process.env.DATABASE_URL

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL && DATABASE_URL.includes('postgresql') ? { rejectUnauthorized: false } : undefined,
})

let initialized = false
export async function ensureSchema() {
  if (initialized) return
  const client = await pool.connect()
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      type TEXT,
      name TEXT,
      desc TEXT,
      img TEXT,
      contact TEXT,
      lat REAL,
      lng REAL,
      created_at TEXT
    )`)
    await client.query(`CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      listing_id TEXT,
      message TEXT,
      contact TEXT,
      lat REAL,
      lng REAL,
      created_at TEXT
    )`)
    await client.query(`CREATE TABLE IF NOT EXISTS pickups (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      date TEXT,
      time TEXT,
      contact TEXT,
      lat REAL,
      lng REAL,
      created_at TEXT
    )`)
    await client.query(`CREATE TABLE IF NOT EXISTS food_requests (
      id TEXT PRIMARY KEY,
      animal TEXT,
      kind TEXT,
      qty TEXT,
      contact TEXT,
      lat REAL,
      lng REAL,
      created_at TEXT
    )`)
    await client.query(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_contact TEXT,
      message TEXT,
      created_at TEXT,
      read INTEGER DEFAULT 0
    )`)
    initialized = true
  } finally {
    client.release()
  }
}
