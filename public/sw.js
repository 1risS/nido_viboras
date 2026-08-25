// ── Service Worker – caché de video 360° ────────────────────────────────────
// Versión: al bumpar CACHE_NAME el visor descarga el video nuevo y borra el anterior.
const CACHE_NAME = 'viboras-v1'
const VIDEO_FILE = 'test_4K.mp4'

// ── Lifecycle ────────────────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  // Borra cachés de versiones anteriores
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
  const url = new URL(event.request.url)
  if (!url.pathname.endsWith(VIDEO_FILE)) return // solo interceptamos el video

  event.respondWith(handleVideo(event.request))
})

// ── Caché con soporte de range requests ─────────────────────────────────────
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
      return fetch(request) // sin red y sin caché: propagar error
    }
    if (!fullResponse.ok) return fullResponse

    await cache.put(cacheKey, fullResponse.clone())
    cached = fullResponse
  }

  // Sin range request: devolvemos el archivo completo desde caché
  if (!rangeHeader) return cached.clone()

  // Con range request: construimos un 206 Partial Content a partir del buffer cacheado
  const buffer = await cached.clone().arrayBuffer()
  return buildRangeResponse(
    buffer,
    rangeHeader,
    cached.headers.get('content-type') || 'video/mp4'
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
