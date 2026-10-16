// Search: AniList (synonyms, formats, airing) + Shikimori (Russian names) queried together, joined by MAL id,
// enriched so every result has both sides, then ranked by match quality over all aliases.

import { anilist, shikiGql, cacheGet, cacheSet, TTL } from './net.js'
import { ANI_FIELDS, SHIKI_FIELDS, fromAniList, fromShiki, mergeTitles } from './model.js'
import { norm, rankTitles } from './match.js'

const ANI_SEARCH = `query($s:String){Page(perPage:20){media(search:$s,type:ANIME,isAdult:false,sort:SEARCH_MATCH){${ANI_FIELDS}}}}`
const ANI_BY_MAL = `query($ids:[Int]){Page(perPage:50){media(idMal_in:$ids,type:ANIME){${ANI_FIELDS}}}}`
export const ANI_BY_ID = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){${ANI_FIELDS}}}}`
const SHIKI_SEARCH = (n) => `query($q:String!){animes(search:$q,limit:${n},order:popularity){${SHIKI_FIELDS}}}`
const SHIKI_BY_IDS = `query($ids:String!){animes(ids:$ids,limit:50){${SHIKI_FIELDS}}}`

export const STOP = new Set(['фильм', 'аниме', 'сериал', 'часть', 'сезон', 'это', 'как', 'про', 'для', 'при', 'над', 'под', 'или', 'что', 'the', 'and', 'of'])
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }

export async function aniSearch(q) {
  const d = await anilist(ANI_SEARCH, { s: q })
  return (d?.Page?.media || []).map(fromAniList)
}

export async function aniByMalIds(ids) {
  const out = []
  for (const part of chunk([...new Set(ids)].filter(Boolean), 50)) {
    const d = await anilist(ANI_BY_MAL, { ids: part.map(Number) })
    out.push(...(d?.Page?.media || []).map(fromAniList))
  }
  return out
}

export async function aniByIds(ids) {
  const out = []
  for (const part of chunk([...new Set(ids)].filter(Boolean), 50)) {
    const d = await anilist(ANI_BY_ID, { ids: part.map(Number) })
    out.push(...(d?.Page?.media || []).map(fromAniList))
  }
  return out
}

const SHIKI_BATCH = (qs, n) => `query{${qs.map((q, i) => `a${i}: animes(search:${JSON.stringify(q)},limit:${n},order:popularity){${SHIKI_FIELDS}}`).join(' ')}}`

/**
 * Many searches in ONE Shikimori request (GraphQL aliases; their complexity cap allows ~6 per call).
 * -> array (same order as `queries`) of Title[]
 */
export async function shikiSearchBatch(queries, n = 5) {
  if (!queries.length) return []
  const d = await shikiGql(SHIKI_BATCH(queries, n), {})
  if (!d) {
    if (queries.length === 1) return [[]]
    const mid = Math.ceil(queries.length / 2) // over the complexity cap: split and retry
    return [...await shikiSearchBatch(queries.slice(0, mid), n), ...await shikiSearchBatch(queries.slice(mid), n)]
  }
  return queries.map((_, i) => (d[`a${i}`] || []).map(fromShiki).filter(t => t.malId).map((t, k) => ({ ...t, shikiRank: k })))
}

export async function shikiSearch(q, n = 15) {
  const d = await shikiGql(SHIKI_SEARCH(n), { q })
  return (d?.animes || []).map(fromShiki).filter(t => t.malId).map((t, i) => ({ ...t, shikiRank: i })) // Shikimori returns by popularity
}

/** Russian names / posters for MAL ids. Names are cached for a week. */
export async function shikiByMalIds(ids) {
  const result = new Map()
  const need = []
  for (const id of [...new Set(ids)].filter(Boolean)) {
    const c = cacheGet('ru:' + id)
    if (c) result.set(String(id), c)
    else need.push(String(id))
  }
  for (const part of chunk(need, 40)) {
    const d = await shikiGql(SHIKI_BY_IDS, { ids: part.join(',') })
    for (const a of d?.animes || []) {
      const t = fromShiki(a)
      if (!t?.malId) continue
      result.set(String(t.malId), t)
      cacheSet('ru:' + t.malId, t, TTL.titles)
    }
  }
  return result
}

/** Join two result lists by MAL id (AniList-only titles without idMal stay separate). */
function join(aniList, shikiList) {
  const byKey = new Map()
  for (const t of aniList) byKey.set(t.key, t)
  for (const s of shikiList) byKey.set(s.key, byKey.has(s.key) ? mergeTitles(byKey.get(s.key), s) : s)
  return [...byKey.values()]
}

/** Make sure each title carries Russian names (from Shikimori) and AniList data (format, airing, synonyms). */
export async function enrich(titles) {
  const needRu = titles.filter(t => t.malId && !t.titleRu && !t.titleRuLicense).map(t => t.malId)
  const needAni = titles.filter(t => t.malId && !t.anilistId).map(t => t.malId)
  const [ruMap, aniList] = await Promise.all([
    needRu.length ? shikiByMalIds(needRu) : new Map(),
    needAni.length ? aniByMalIds(needAni) : [],
  ])
  const aniByMal = new Map(aniList.filter(a => a.malId).map(a => [a.malId, a]))
  return titles.map(t => {
    let r = t
    const a = t.malId && !t.anilistId ? aniByMal.get(t.malId) : null
    if (a) r = mergeTitles(a, r)
    const ru = r.malId ? ruMap.get(String(r.malId)) : null
    if (ru && !r.titleRu && !r.titleRuLicense) r = mergeTitles(r, ru)
    return r
  })
}

/**
 * Search anime by any name: Russian, English, romaji, abbreviations, with a season number or a typo.
 * Returns Title[] best-first, each with `.score`.
 */
export async function searchBase(q, { limit = 12 } = {}) {
  const query = String(q || '').trim()
  if (query.length < 2) return []
  const ck = 'search:' + norm(query)
  const hit = cacheGet(ck)
  if (hit) return hit.slice(0, limit)

  const run = async (text) => {
    const [ani, shiki] = await Promise.all([aniSearch(text), shikiSearch(text)])
    return enrich(join(ani, shiki))
  }

  let titles = await run(query)
  let ranked = rankTitles(query, titles)

  // nothing convincing: folk names ("Жизнь в другом мире с нуля") don't match word for word, so query by the key words
  if (!ranked.length || ranked[0].s < 55) {
    const words = norm(query).split(' ').filter(w => w.length >= 4 && !STOP.has(w)).sort((a, b) => b.length - a.length)
    const tries = [...new Set([words.slice(0, 3).join(' '), words.slice(0, 2).join(' ')])].filter(t => t && t !== norm(query))
    for (const t of tries.slice(0, 2)) {
      const more = await run(t)
      const seen = new Set(titles.map(x => x.key))
      titles = [...titles, ...more.filter(x => !seen.has(x.key))]
    }
    ranked = rankTitles(query, titles)
  }

  // weak result: retry on the base name ("Атака титанов: Финал" -> "Атака титанов") and merge
  const colon = query.search(/[:：]/)
  if ((!ranked.length || ranked[0].s < 55) && colon > 2) {
    const more = await run(query.slice(0, colon).trim())
    const seen = new Set(titles.map(t => t.key))
    titles = [...titles, ...more.filter(t => !seen.has(t.key))]
    ranked = rankTitles(query, titles)
  }

  // drop obvious noise, but never return nothing when there were candidates
  const strong = ranked.filter(r => r.s >= 30)
  const out = (strong.length ? strong : ranked.slice(0, 3)).slice(0, Math.max(limit, 12)).map(({ t, s }) => ({ ...t, score: Math.round(s) }))
  if (out.length) cacheSet(ck, out, TTL.search)
  return out.slice(0, limit)
}
