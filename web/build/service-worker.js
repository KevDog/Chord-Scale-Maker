/* The offline worker (build/sw.ts writes VERSION and PRECACHE above this). App chunks come from the cache; pages and
 * everything else from the network, cached as they arrive, the cache answering when offline. */
/* global VERSION, PRECACHE */
const CACHE = `csm-${VERSION}`
/** the sampled sounds (/sounds/, #538): cached on first play and kept across builds, as a changed file gets a new name */
const SOUNDS = 'csm-sounds'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  const old = (key) => key.startsWith('csm-') && key !== CACHE && key !== SOUNDS
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter(old).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

/** a navigation can't take a redirected response ("/library" → "/library/"), so copy it into a fresh one */
const unredirected = (response) => (response.redirected ? new Response(response.body, response) : response)

async function cacheFirst(request, cache = CACHE) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) (await caches.open(cache)).put(request, response.clone())
  return response
}

/** offline, a page not yet visited opens from the app shell, Nuxt's client-only /200.html (a song reads its chart from
 * the address), and a song's payload is /song's (each is empty: the chart is in the app's chunks) */
function shellOf(request, url) {
  if (request.mode === 'navigate') return '/200.html'
  return url.pathname.startsWith('/song/') && url.pathname.endsWith('/_payload.json') ? '/song/_payload.json' : undefined
}

async function networkFirst(request, url) {
  try {
    const response = await fetch(request)
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
    return response
  } catch (error) {
    // a payload's ?_b= names the build; a page's query is read by the app
    const cached = await caches.match(request, { ignoreSearch: true })
    if (cached) return unredirected(cached)
    const shell = shellOf(request, url)
    const fallback = shell && (await caches.match(shell))
    if (fallback) return unredirected(fallback)
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_vercel/')) return
  // hashed chunks never change; builds/ (the app manifest) does, so it's fetched like a page
  const hashed = url.pathname.startsWith('/_nuxt/') && !url.pathname.startsWith('/_nuxt/builds/')
  if (url.pathname.startsWith('/sounds/')) event.respondWith(cacheFirst(request, SOUNDS))
  else event.respondWith(hashed ? cacheFirst(request) : networkFirst(request, url))
})
