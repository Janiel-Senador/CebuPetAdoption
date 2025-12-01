import { sql } from '@vercel/postgres'

let initialized = false
export async function ensureSchema() {
  if (initialized) return
  await sql`CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    type TEXT,
    name TEXT,
    desc TEXT,
    img TEXT,
    contact TEXT,
    lat REAL,
    lng REAL,
    created_at TEXT
  )`
  await sql`CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    listing_id TEXT,
    message TEXT,
    contact TEXT,
    lat REAL,
    lng REAL,
    created_at TEXT
  )`
  await sql`CREATE TABLE IF NOT EXISTS pickups (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    date TEXT,
    time TEXT,
    contact TEXT,
    lat REAL,
    lng REAL,
    created_at TEXT
  )`
  await sql`CREATE TABLE IF NOT EXISTS food_requests (
    id TEXT PRIMARY KEY,
    animal TEXT,
    kind TEXT,
    qty TEXT,
    contact TEXT,
    lat REAL,
    lng REAL,
    created_at TEXT
  )`
  await sql`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_contact TEXT,
    message TEXT,
    created_at TEXT,
    read INTEGER DEFAULT 0
  )`
  initialized = true
}

export { sql }
