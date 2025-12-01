const centerCebu = { lat: 10.3157, lng: 123.8854 }
const cebuRadiusKm = 110

const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)) }
}

const data = {
  listings: [],
  requests: [],
  pickups: [],
  foodRequests: [],
  notifications: [],
}

const API = localStorage.getItem('API_BASE') || '/api'

async function apiGet(path) {
  const r = await fetch(`${API}${path}`)
  return r.json()
}
async function apiPost(path, body) {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return r.json()
}

function uid() { return Math.random().toString(36).slice(2, 10) }

function toKm(meters) { return Math.round(meters / 1000) }

function haversineKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function inCebu(latlng) { return haversineKm(centerCebu, latlng) <= cebuRadiusKm }

const map = L.map('map').setView([centerCebu.lat, centerCebu.lng], 11)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map)

const layerListings = L.layerGroup().addTo(map)
const layerRequests = L.layerGroup().addTo(map)
const layerPickups = L.layerGroup().addTo(map)
const layerFood = L.layerGroup().addTo(map)
const layerLinks = L.layerGroup().addTo(map)

const tempSelectionMarker = {
  post: null,
  req: null,
  pickup: null,
  food: null,
}

function circle(latlng, color) {
  return L.circleMarker([latlng.lat, latlng.lng], { radius: 9, color, weight: 2, fillColor: color, fillOpacity: 0.35 })
}

function renderAll() {
  layerListings.clearLayers()
  layerRequests.clearLayers()
  layerPickups.clearLayers()

  data.listings.forEach(l => {
    const m = circle(l.location, '#2ecc71').addTo(layerListings)
    m.bindPopup(`
      <b>${l.type} • ${l.name}</b><br>
      ${l.desc}<br>
      ${l.img ? `<img class="popup-img" src="${l.img}" alt="${l.name}" style="margin-top:6px;max-width:200px;max-height:140px;border-radius:6px"/>` : ''}
      <br><small>Contact: ${l.contact}</small><br>
      <button data-act="req" data-id="${l.id}">Request Adoption</button>
    `)
    m.on('popupopen', (e) => attachPopupActions(e.popup))
  })

  data.requests.forEach(r => {
    const m = circle(r.location, '#e67e22').addTo(layerRequests)
    const related = data.pickups.filter(p => p.requestId === r.id)
    const info = related.length ? `<br><small>${related.length} pickup${related.length>1?'s':''}: ${related.map(p=>p.contact).join(', ')}</small>` : ''
    m.bindPopup(`<b>Request for ${r.listingName}</b><br>${r.message}<br><small>Contact: ${r.contact}</small>${info}<br><button data-act="pickup" data-id="${r.id}">Schedule Pickup</button>`)
    m.on('popupopen', (e) => attachPopupActions(e.popup))
  })

  data.pickups.forEach(p => {
    const m = circle(p.location, '#8e44ad').addTo(layerPickups)
    m.bindPopup(`<b>Pickup for ${p.requestTitle}</b><br>${p.date} ${p.time}<br><small>Contact: ${p.contact}</small>`)
  })

  data.foodRequests.forEach(f => {
    const m = circle(f.location, '#f1c40f').addTo(layerFood)
    m.bindPopup(`<b>Food Request (${f.animal})</b><br>${f.kind} • ${f.qty}<br><small>Contact: ${f.contact}</small>`)
  })

  layerLinks.clearLayers()
  data.pickups.forEach(p => {
    const req = data.requests.find(r => r.id === p.requestId)
    if (!req) return
    const line = L.polyline([
      [req.location.lat, req.location.lng],
      [p.location.lat, p.location.lng]
    ], { color: '#8e44ad', weight: 3, opacity: 0.7, dashArray: '6,4' }).addTo(layerLinks)
    line.bindTooltip(`Pickup by ${p.contact} • ${p.date} ${p.time}`, { sticky: true })
  })

  refreshSelectors()
  applyFilters()
}

function attachPopupActions(popup) {
  const el = popup.getElement()
  if (!el) return
  const btnReq = el.querySelector('button[data-act="req"]')
  if (btnReq) {
    btnReq.addEventListener('click', () => {
      const id = btnReq.getAttribute('data-id')
      const listing = data.listings.find(l => l.id === id)
      if (!listing) return
      switchTab('request')
      document.getElementById('req-listing').value = listing.id
    })
  }
  const btnPickup = el.querySelector('button[data-act="pickup"]')
  if (btnPickup) {
    btnPickup.addEventListener('click', () => {
      const id = btnPickup.getAttribute('data-id')
      const req = data.requests.find(r => r.id === id)
      if (!req) return
      switchTab('pickup')
      document.getElementById('pickup-request').value = req.id
    })
  }
}

function refreshSelectors() {
  const listingSel = document.getElementById('req-listing')
  listingSel.innerHTML = ''
  data.listings.forEach(l => {
    const opt = document.createElement('option')
    opt.value = l.id
    opt.textContent = `${l.type} • ${l.name}`
    listingSel.appendChild(opt)
  })

  const reqSel = document.getElementById('pickup-request')
  reqSel.innerHTML = ''
  data.requests.forEach(r => {
    const opt = document.createElement('option')
    opt.value = r.id
    opt.textContent = `Request • ${r.listingName}`
    reqSel.appendChild(opt)
  })
}

function applyFilters() {
  const showListings = document.getElementById('filter-listings').checked
  const showRequests = document.getElementById('filter-requests').checked
  const showPickups = document.getElementById('filter-pickups').checked
  const showFood = document.getElementById('filter-food').checked
  const showLinks = document.getElementById('filter-links').checked
  if (showListings) { layerListings.addTo(map) } else { map.removeLayer(layerListings) }
  if (showRequests) { layerRequests.addTo(map) } else { map.removeLayer(layerRequests) }
  if (showPickups) { layerPickups.addTo(map) } else { map.removeLayer(layerPickups) }
  if (showFood) { layerFood.addTo(map) } else { map.removeLayer(layerFood) }
  if (showLinks) { layerLinks.addTo(map) } else { map.removeLayer(layerLinks) }
}

document.getElementById('filter-listings').addEventListener('change', applyFilters)
document.getElementById('filter-requests').addEventListener('change', applyFilters)
document.getElementById('filter-pickups').addEventListener('change', applyFilters)
document.getElementById('filter-food').addEventListener('change', applyFilters)
document.getElementById('filter-links').addEventListener('change', applyFilters)

const tabs = Array.from(document.querySelectorAll('.tab'))
function switchTab(id) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === id))
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${id}`))
}
tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)))

let activeForm = null
document.getElementById('post-select-loc').addEventListener('click', () => { activeForm = 'post' })
document.getElementById('req-select-loc').addEventListener('click', () => { activeForm = 'req' })
document.getElementById('pickup-select-loc').addEventListener('click', () => { activeForm = 'pickup' })
document.getElementById('food-select-loc').addEventListener('click', () => { activeForm = 'food' })

map.on('click', (e) => {
  if (!activeForm) return
  const latlng = { lat: e.latlng.lat, lng: e.latlng.lng }
  const dist = haversineKm(centerCebu, latlng)
  if (!inCebu(latlng)) {
    alert(`Selected location is ${Math.round(dist)} km from Cebu center. Please select within Cebu.`)
    return
  }
  const marker = circle(latlng, '#0ea5e9')
  marker.addTo(map)
  if (activeForm === 'post') {
    if (tempSelectionMarker.post) map.removeLayer(tempSelectionMarker.post)
    tempSelectionMarker.post = marker
    document.getElementById('post-loc-display').textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)} (${toKm(dist*1000)} km from center)`
    tempSelectionMarker.post.latlng = latlng
  } else if (activeForm === 'req') {
    if (tempSelectionMarker.req) map.removeLayer(tempSelectionMarker.req)
    tempSelectionMarker.req = marker
    document.getElementById('req-loc-display').textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)} (${toKm(dist*1000)} km)`
    tempSelectionMarker.req.latlng = latlng
  } else if (activeForm === 'pickup') {
    if (tempSelectionMarker.pickup) map.removeLayer(tempSelectionMarker.pickup)
    tempSelectionMarker.pickup = marker
    document.getElementById('pickup-loc-display').textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)} (${toKm(dist*1000)} km)`
    tempSelectionMarker.pickup.latlng = latlng
  } else if (activeForm === 'food') {
    if (tempSelectionMarker.food) map.removeLayer(tempSelectionMarker.food)
    tempSelectionMarker.food = marker
    document.getElementById('food-loc-display').textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)} (${toKm(dist*1000)} km)`
    tempSelectionMarker.food.latlng = latlng
  }
})

document.getElementById('post-file').addEventListener('change', () => {
  const f = document.getElementById('post-file').files[0]
  if (!f) { document.getElementById('post-preview').style.display = 'none'; return }
  const reader = new FileReader()
  reader.onload = () => { const img = document.getElementById('post-preview'); img.src = reader.result; img.style.display = 'block' }
  reader.readAsDataURL(f)
})

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

document.getElementById('form-post').addEventListener('submit', async (e) => {
  e.preventDefault()
  const type = document.getElementById('post-type').value.trim()
  const name = document.getElementById('post-name').value.trim()
  const desc = document.getElementById('post-desc').value.trim()
  const file = document.getElementById('post-file').files[0]
  const contact = document.getElementById('post-contact').value.trim()
  const sel = tempSelectionMarker.post?.latlng
  if (!sel) { alert('Select a location on the map within Cebu.') ; return }
  let imgData = ''
  if (file) { try { imgData = await readFileAsDataURL(file) } catch {} }
  const payload = { type, name, desc, img: imgData, contact, location: sel }
  const res = await apiPost('/listings', payload)
  const item = { id: res.id, ...payload }
  data.listings.push(item)
  renderAll()
  e.target.reset()
  document.getElementById('post-loc-display').textContent = 'No location selected'
  if (tempSelectionMarker.post) { map.removeLayer(tempSelectionMarker.post); tempSelectionMarker.post = null }
  const prev = document.getElementById('post-preview'); prev.src = ''; prev.style.display = 'none'
  switchTab('map')
})

document.getElementById('form-request').addEventListener('submit', async (e) => {
  e.preventDefault()
  const listingId = document.getElementById('req-listing').value
  const listing = data.listings.find(l => l.id === listingId)
  if (!listing) { alert('Choose a listing') ; return }
  const message = document.getElementById('req-message').value.trim()
  const contact = document.getElementById('req-contact').value.trim()
  const sel = tempSelectionMarker.req?.latlng
  if (!sel) { alert('Select a location on the map within Cebu.') ; return }
  const payload = { listingId, message, contact, location: sel }
  const res = await apiPost('/requests', payload)
  const item = { id: res.id, listingId, listingName: `${listing.type} • ${listing.name}`, message, contact, location: sel }
  data.requests.push(item)
  renderAll()
  e.target.reset()
  document.getElementById('req-loc-display').textContent = 'No location selected'
  if (tempSelectionMarker.req) { map.removeLayer(tempSelectionMarker.req); tempSelectionMarker.req = null }
  switchTab('map')
  alert('Notification sent to the listing owner')
})

document.getElementById('form-food').addEventListener('submit', async (e) => {
  e.preventDefault()
  const animal = document.getElementById('food-animal').value
  const kind = document.getElementById('food-kind').value.trim()
  const qty = document.getElementById('food-qty').value.trim()
  const contact = document.getElementById('food-contact').value.trim()
  const sel = tempSelectionMarker.food?.latlng
  if (!sel) { alert('Select a location on the map within Cebu.') ; return }
  const payload = { animal, kind, qty, contact, location: sel }
  const res = await apiPost('/food_requests', payload)
  const item = { id: res.id, ...payload }
  data.foodRequests.push(item)
  renderAll()
  e.target.reset()
  document.getElementById('food-loc-display').textContent = 'No location selected'
  if (tempSelectionMarker.food) { map.removeLayer(tempSelectionMarker.food); tempSelectionMarker.food = null }
  switchTab('map')
})

document.getElementById('form-pickup').addEventListener('submit', async (e) => {
  e.preventDefault()
  const reqId = document.getElementById('pickup-request').value
  const req = data.requests.find(r => r.id === reqId)
  if (!req) { alert('Choose a related request') ; return }
  const date = document.getElementById('pickup-date').value
  const time = document.getElementById('pickup-time').value
  const contact = document.getElementById('pickup-contact').value.trim()
  const sel = tempSelectionMarker.pickup?.latlng
  if (!sel) { alert('Select a pickup location on the map within Cebu.') ; return }
  const payload = { requestId: reqId, date, time, contact, location: sel }
  const res = await apiPost('/pickups', payload)
  const item = { id: res.id, requestId: reqId, requestTitle: req.listingName, date, time, contact, location: sel }
  data.pickups.push(item)
  renderAll()
  e.target.reset()
  document.getElementById('pickup-loc-display').textContent = 'No location selected'
  if (tempSelectionMarker.pickup) { map.removeLayer(tempSelectionMarker.pickup); tempSelectionMarker.pickup = null }
  switchTab('map')
})

async function initialLoad() {
  try {
    const [listings, requests, pickups, foods] = await Promise.all([
      apiGet('/listings'), apiGet('/requests'), apiGet('/pickups'), apiGet('/food_requests')
    ])
    data.listings = listings.map(l => ({ id: l.id, type: l.type, name: l.name, desc: l.desc, img: l.img, contact: l.contact, location: { lat: l.lat, lng: l.lng } }))
    data.requests = requests.map(r => ({ id: r.id, listingId: r.listing_id, listingName: '', message: r.message, contact: r.contact, location: { lat: r.lat, lng: r.lng } }))
    data.pickups = pickups.map(p => ({ id: p.id, requestId: p.request_id, requestTitle: '', date: p.date, time: p.time, contact: p.contact, location: { lat: p.lat, lng: p.lng } }))
    data.foodRequests = foods.map(f => ({ id: f.id, animal: f.animal, kind: f.kind, qty: f.qty, contact: f.contact, location: { lat: f.lat, lng: f.lng } }))
    data.requests.forEach(r => { const l = data.listings.find(x => x.id === r.listingId); r.listingName = l ? `${l.type} • ${l.name}` : 'Listing' })
    data.pickups.forEach(p => { const r = data.requests.find(x => x.id === p.requestId); p.requestTitle = r ? r.listingName : 'Request' })
    renderAll()
  } catch (e) {
    renderAll()
  }
}

async function loadNotifications(contact) {
  const list = await apiGet(`/notifications?contact=${encodeURIComponent(contact)}`)
  data.notifications = list
  const count = list.filter(n => n.read === 0).length
  document.getElementById('notif-count').textContent = String(count)
  const wrap = document.getElementById('notif-list')
  wrap.innerHTML = ''
  list.forEach(n => {
    const div = document.createElement('div')
    div.className = `notif-item ${n.read ? 'read' : ''}`
    div.textContent = n.message
    wrap.appendChild(div)
  })
}

document.getElementById('form-notif').addEventListener('submit', async (e) => {
  e.preventDefault()
  const contact = document.getElementById('notif-contact').value.trim()
  await loadNotifications(contact)
})

document.getElementById('notif-open').addEventListener('click', () => switchTab('notif'))

document.getElementById('api-set').addEventListener('click', async () => {
  const cur = localStorage.getItem('API_BASE') || API
  const v = prompt('Set API base URL', cur || '')
  if (v === null) return
  const base = v.trim()
  if (!base) { localStorage.removeItem('API_BASE'); alert('API base cleared.'); return }
  if (!/^https?:\/\//i.test(base)) { alert('Please enter a valid http(s) URL (e.g., http://127.0.0.1:5000)'); return }
  try {
    const r = await fetch(`${base}/health`)
    if (!r.ok) throw new Error('status')
    localStorage.setItem('API_BASE', base)
    alert('API base saved')
  } catch {
    alert('API base unreachable')
  }
})

initialLoad()
