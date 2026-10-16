/**
 * Binary codec for anime lists.
 * Sort IDs → delta-encode → varint + packed score/status → base64url.
 * ~900 chars for 262 anime.
 */

const ST_ENC = { completed: 0, watching: 1, dropped: 2, planned: 3, onhold: 3 }
const ST_DEC = ['completed', 'watching', 'dropped', 'planned']

function toBase64url(bytes) {
  const bin = bytes.map(b => String.fromCharCode(b)).join('')
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  return Array.from(bin, c => c.charCodeAt(0))
}

export function encodeList(list) {
  const sorted = [...list]
    .filter(a => a.shikiId)
    .sort((a, b) => (Number(a.shikiId) || 0) - (Number(b.shikiId) || 0))

  const bytes = []
  let prev = 0

  for (const a of sorted) {
    const id = Number(a.shikiId) || 0
    let delta = id - prev
    prev = id

    // Varint encode delta
    while (delta >= 128) {
      bytes.push(0x80 | (delta & 0x7f))
      delta >>>= 7
    }
    bytes.push(delta)

    // Score (4 bits, 0-15) + status (2 bits) = 1 byte
    const sc = Math.min(Math.max(a.score || 0, 0), 15)
    const st = ST_ENC[a.status] ?? 0
    bytes.push((sc << 2) | st)
  }

  return toBase64url(bytes)
}

export function decodeList(hash) {
  try {
    const bytes = fromBase64url(hash)
    const result = []
    let i = 0, prevId = 0

    while (i < bytes.length - 1) {
      // Read varint delta
      let delta = 0, shift = 0
      while (i < bytes.length && (bytes[i] & 0x80)) {
        delta |= (bytes[i] & 0x7f) << shift
        shift += 7
        i++
      }
      if (i >= bytes.length) break
      delta |= bytes[i] << shift
      i++

      prevId += delta

      // Read score + status byte
      if (i >= bytes.length) break
      const packed = bytes[i]
      i++

      result.push({
        shikiId: prevId,
        score: (packed >> 2) & 0x0f,
        status: ST_DEC[packed & 0x03] || 'completed',
      })
    }

    return result.filter(a => a.shikiId)
  } catch { return null }
}

/** Build profile URL */
export function buildShareUrl(list) {
  return `${location.origin}${location.pathname}#p=${encodeList(list)}`
}

/** Build compare URL */
export function buildCompareUrl(list) {
  return `${location.origin}${location.pathname}#c=${encodeList(list)}`
}

// ── short links: the encoded list is stored in a tiny public key-value service (textdb.dev, no signup);
//    the link then carries only an 8-char key. If the service is down callers fall back to the long link. ──
const SHORT_API = 'https://textdb.dev/api/data/'
const KEY_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const newKey = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => KEY_ALPHABET[b % 32]).join('')

/** Upload the list, return a short URL or null (service unreachable). type: 'c' compare | 'p' profile */
export async function buildShortUrl(list, type = 'c') {
  const body = encodeList(list)
  if (!body) return null
  const key = newKey()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 7000)
  try {
    const res = await fetch(`${SHORT_API}at-${key}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, signal: ctrl.signal })
    return res.ok ? `${location.origin}${location.pathname}#${type}=s:${key}` : null
  } catch { return null } finally { clearTimeout(timer) }
}

/** Load a list stored by buildShortUrl. -> minimal list | null */
export async function fetchShared(key) {
  try {
    const res = await fetch(`${SHORT_API}at-${encodeURIComponent(key)}`)
    if (!res.ok) return null
    return decodeList((await res.text()).trim())
  } catch { return null }
}

/** Parse hash → { type, data } | { type, remote } for short links */
export function parseHash(hash) {
  if (!hash || hash.length < 4) return null
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  const kind = h.startsWith('p=') ? 'profile' : h.startsWith('c=') ? 'compare' : null
  if (!kind) return null
  const body = h.slice(2)
  if (body.startsWith('s:')) return { type: kind, data: null, remote: body.slice(2) }
  return { type: kind, data: decodeList(body) }
}

/**
 * Hydrate minimal list (id+score+status) → full data from Shikimori GQL.
 */
const SHIKI_HOSTS = ['https://shikimori.one', 'https://shikimori.io']

export async function shikiFetch(path, opts) {
  for (const host of SHIKI_HOSTS) {
    try {
      const res = await fetch(host + path, opts)
      if (res.ok) return res
    } catch { /* host unreachable: try the next one */ }
  }
  return null
}

const GQL_PATH = '/api/graphql'
const GQL_Q = `query($ids:String!){animes(ids:$ids,limit:50){id name russian licenseNameRu kind episodes episodesAired airedOn{year} poster{mainUrl} genres{russian kind} studios{name}}}`

function pickGenres(genres) {
  if (!genres?.length) return []
  const real = genres.filter(g => g.kind === 'genre').map(g => g.russian)
  const themes = genres.filter(g => g.kind === 'theme').map(g => g.russian)
  return [...real, ...themes].filter(Boolean)
}

export async function hydrateList(minimalList, onProgress) {
  const ids = [...new Set(minimalList.map(a => a.shikiId).filter(Boolean))]
  const byId = {}

  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    try {
      const res = await shikiFetch(GQL_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: GQL_Q, variables: { ids: batch.join(',') } }),
      })
      if (res) {
        const data = await res.json()
        for (const a of (data.data?.animes || [])) byId[Number(a.id)] = a
      }
    } catch { /* host unreachable: try the next one */ }
    if (onProgress) onProgress(Math.min(1, (i + 50) / ids.length))
    if (i + 50 < ids.length) await new Promise(r => setTimeout(r, 350))
  }

  return minimalList.map(m => {
    const full = byId[m.shikiId]
    if (!full) return { ...m, title: `#${m.shikiId}`, genres: [], studio: '—' }
    return {
      ...m,
      title: full.licenseNameRu || full.russian || full.name,
      genres: pickGenres(full.genres),
      year: full.airedOn?.year || null,
      poster: full.poster?.mainUrl || null,
      studio: full.studios?.[0]?.name || '—',
      epTotal: full.episodes || null,
      kind: full.kind || 'tv',
    }
  })
}
