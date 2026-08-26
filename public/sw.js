// ── Service Worker – caché completa ──────────────────────────────────────────
// Para forzar re-descarga de todos los assets, bumpeá CACHE_NAME (ej: v3 → v4)
const CACHE_NAME = 'viboras-v3'
const VIDEO_FILE = 'video_noBg.webm'

// Orígenes CDN que se cachean al primer acceso (cache-first)
const CDN_ORIGINS = [
  'https://cdn.jsdelivr.net',
  'https://cdn.socket.io',
  'https://unpkg.com'
]

// ── Lifecycle ────────────────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )
      )
      .then(() => clients.claim())
  )
})

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Video local: caché completa con soporte de range requests
  if (url.pathname.endsWith(VIDEO_FILE)) {
    event.respondWith(handleVideo(request))
    return
  }

  // Scripts CDN: cache-first (sirve offline después del primer load)
  if (CDN_ORIGINS.some(o => request.url.startsWith(o))) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Navegación (index.html): network-first con fallback a caché
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
  }
})

// ── Estrategias de caché ─────────────────────────────────────────────────────
async function cacheFirst (request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirst (request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return (
      (await cache.match(request)) || new Response('Offline', { status: 503 })
    )
  }
}

// ── Video con soporte de range requests ──────────────────────────────────────
async function handleVideo (request) {
  const cache = await caches.open(CACHE_NAME)
  const cacheKey = request.url.split('?')[0]
  const rangeHeader = request.headers.get('range')

  let cached = await cache.match(cacheKey)

  if (!cached) {
    // Primera vez: descargamos el archivo completo (sin Range) y lo cacheamos
    let fullResponse
    try {
      fullResponse = await fetch(
        new Request(cacheKey, { credentials: 'same-origin' })
      )
    } catch {
      return fetch(request)
    }
    if (!fullResponse.ok) return fullResponse
    await cache.put(cacheKey, fullResponse.clone())
    cached = fullResponse
  }

  if (!rangeHeader) return cached.clone()

  const buffer = await cached.clone().arrayBuffer()
  return buildRangeResponse(
    buffer,
    rangeHeader,
    cached.headers.get('content-type') || 'video/webm'
  )
}

function buildRangeResponse (buffer, rangeHeader, contentType) {
  const total = buffer.byteLength
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)

  if (!match) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${total}` }
    })
  }

  const start = match[1] !== '' ? parseInt(match[1], 10) : 0
  const end = match[2] !== '' ? parseInt(match[2], 10) : total - 1
  const last = Math.min(end, total - 1)
  const length = last - start + 1

  return new Response(buffer.slice(start, last + 1), {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Range': `bytes ${start}-${last}/${total}`,
      'Content-Length': String(length),
      'Accept-Ranges': 'bytes'
    }
  })
}
