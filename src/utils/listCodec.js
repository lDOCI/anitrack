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

/** Parse hash → { type, data } */
export function parseHash(hash) {
  if (!hash || hash.length < 4) return null
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  if (h.startsWith('p=')) return { type: 'profile', data: decodeList(h.slice(2)) }
  if (h.startsWith('c=')) return { type: 'compare', data: decodeList(h.slice(2)) }
  return null
}

/**
 * Hydrate minimal list (id+score+status) → full data from Shikimori GQL.
 */
const GQL = 'https://shikimori.one/api/graphql'
const GQL_Q = `query($ids:String!){animes(ids:$ids,limit:50){id name russian licenseNameRu kind episodes episodesAired airedOn{year} genres{russian kind} studios{name}}}`

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
      const res = await fetch(GQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: GQL_Q, variables: { ids: batch.join(',') } }),
      })
      const data = await res.json()
      for (const a of (data.data?.animes || [])) byId[Number(a.id)] = a
    } catch {}
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
      studio: full.studios?.[0]?.name || '—',
      epTotal: full.episodes || null,
      kind: full.kind || 'tv',
    }
  })
}
