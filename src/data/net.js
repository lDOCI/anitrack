// Low-level network + cache for the data layer. No DOM / React: runs in browser and Node.

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── tiny TTL cache (localStorage when present, memory otherwise) ──
const mem = new Map()
const PREFIX = 'anitrack:c2:'

export function cacheGet(key) {
  const k = PREFIX + key
  let raw = mem.get(k)
  if (raw === undefined) {
    try { raw = globalThis.localStorage?.getItem(k) ?? null } catch { raw = null }
    if (raw) mem.set(k, raw)
  }
  if (!raw) return undefined
  try {
    const { v, e } = JSON.parse(raw)
    if (e && e < Date.now()) { cacheDel(key); return undefined }
    return v
  } catch { return undefined }
}

export function cacheSet(key, value, ttlMs) {
  const k = PREFIX + key
  const raw = JSON.stringify({ v: value, e: ttlMs ? Date.now() + ttlMs : 0 })
  mem.set(k, raw)
  try { globalThis.localStorage?.setItem(k, raw) } catch { /* quota / private mode */ }
}

export function cacheDel(key) {
  const k = PREFIX + key
  mem.delete(k)
  try { globalThis.localStorage?.removeItem(k) } catch { /* ignore */ }
}

export const TTL = { search: 30 * 60e3, franchise: 24 * 3600e3, airing: 10 * 60e3, titles: 7 * 24 * 3600e3 }

// ── AniList (90 req/min): serialized with a min gap, honors Retry-After ──
const ANILIST = 'https://graphql.anilist.co'
let aniChain = Promise.resolve()
let aniLast = 0
let aniGap = 700            // ms between calls; derived from X-RateLimit-Limit (60s / limit)
let aniRemaining = Infinity // calls left in the current window
let aniResetAt = 0          // epoch ms when the window resets

export function anilist(query, variables) {
  const run = async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      // out of quota: sleep until the window resets rather than burning calls into 429s
      if (aniRemaining <= 1 && aniResetAt > Date.now()) await sleep(Math.min(aniResetAt - Date.now() + 250, 65000))
      const wait = aniLast + aniGap - Date.now()
      if (wait > 0) await sleep(wait)
      aniLast = Date.now()
      let res
      try {
        res = await fetch(ANILIST, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables }),
        })
      } catch { await sleep(800 * (attempt + 1)); continue }
      const lim = Number(res.headers.get('x-ratelimit-limit'))
      const rem = res.headers.get('x-ratelimit-remaining')
      const reset = Number(res.headers.get('x-ratelimit-reset'))
      if (lim > 0) aniGap = Math.max(300, Math.ceil(60000 / lim))
      if (rem != null) aniRemaining = Number(rem)
      if (reset > 0) aniResetAt = reset * 1000
      if (res.status === 429) {
        const ra = Number(res.headers.get('Retry-After')) || 20
        await sleep(Math.min(ra, 30) * 1000)
        continue
      }
      if (res.status >= 500) { await sleep(800 * (attempt + 1)); continue }
      const json = await res.json().catch(() => null)
      if (json?.data) return json.data
      return null // 4xx with errors (e.g. 404 media not found)
    }
    return null
  }
  const p = aniChain.then(run, run)
  aniChain = p.catch(() => {})
  return p
}

// ── Shikimori: 5 req/s cap → one shared queue (~4.5/s) so bursts pipeline instead of hitting 429 ──
let shikiNext = 0
const shikiHits = []
async function shikiSlot() {
  // per-minute budget: Shikimori allows 90/min but counts generously; we use 60 so a burst never turns into a wall of 429s
  const cutoff = () => Date.now() - 60000
  while (shikiHits.length && shikiHits[0] < cutoff()) shikiHits.shift()
  if (shikiHits.length >= 60) await sleep(Math.max(200, shikiHits[0] + 60000 - Date.now() + 100))
  const now = Date.now()
  const at = Math.max(now, shikiNext)
  shikiNext = at + 330
  if (at > now) await sleep(at - now)
  shikiHits.push(Date.now())
}

// fetch with a timeout: Shikimori sometimes holds a single request for ~70s; abort and retry instead of freezing the import
function fetchT(url, opts, ms = 10000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

// ── Shikimori GraphQL: host fallback ──
const SHIKI_HOSTS = ['https://shikimori.io', 'https://shikimori.one']
let shikiHost = 0

export async function shikiGql(query, variables) {
  for (let i = 0; i < SHIKI_HOSTS.length; i++) {
    const host = SHIKI_HOSTS[(shikiHost + i) % SHIKI_HOSTS.length]
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await shikiSlot()
        const res = await fetchT(host + '/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables }),
        })
        if (res.status === 429) { await sleep(2500 * (attempt + 1)); continue } // rate limited: same host, back off
        if (!res.ok) return null // 4xx (e.g. query too complex): another host would say the same
        shikiHost = (shikiHost + i) % SHIKI_HOSTS.length
        return (await res.json()).data ?? null
      } catch (e) { if (e?.name === 'AbortError') continue; break } // timeout: retry; network / CORS failure: next host
    }
  }
  return null
}

/** Shikimori REST GET (JSON) with host fallback. */
export async function shikiRest(path) {
  for (let i = 0; i < SHIKI_HOSTS.length; i++) {
    const host = SHIKI_HOSTS[(shikiHost + i) % SHIKI_HOSTS.length]
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await shikiSlot()
        const res = await fetchT(host + path)
        if (res.status === 429) { await sleep(2500 * (attempt + 1)); continue }
        if (!res.ok) return null
        shikiHost = (shikiHost + i) % SHIKI_HOSTS.length
        return await res.json()
      } catch (e) { if (e?.name === 'AbortError') continue; break }
    }
  }
  return null
}

export const SHIKI_ORIGIN = () => SHIKI_HOSTS[shikiHost]
