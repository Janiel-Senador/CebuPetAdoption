export default async function handler(req, res) {
  const base = process.env.RAILWAY_API_URL
  if (!base) { res.status(500).json({ error: 'RAILWAY_API_URL not set' }); return }
  const segs = Array.isArray(req.query.path) ? req.query.path : []
  const target = `${base}/${segs.join('/')}`
  const filteredHeaders = { ...req.headers }
  delete filteredHeaders.host
  delete filteredHeaders['content-length']
  delete filteredHeaders.connection
  let body = undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise((resolve) => {
      let data = ''
      req.on('data', (chunk) => { data += chunk })
      req.on('end', () => resolve(data))
    })
  }
  const resp = await fetch(target, { method: req.method, headers: filteredHeaders, body })
  const text = await resp.text()
  const ct = resp.headers.get('content-type') || 'text/plain'
  res.status(resp.status)
  res.setHeader('Content-Type', ct)
  res.send(text)
}
