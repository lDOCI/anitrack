// "If you liked X, watch Y": community recommendations from AniList (votes per pair), combined over many seed titles.
// A title recommended for several of your favourites ranks above one recommended for a single favourite.

import { anilist, cacheGet, cacheSet } from './net.js'
import { shikiByMalIds } from './search.js'
import { resolveSeriesMany } from './series.js'
import { displayTitle, mergeTitles, fromAniList } from './model.js'

const REC_Q = `query($ids:[Int]){Page(perPage:25){media(idMal_in:$ids,type:ANIME){idMal
  recommendations(sort:RATING_DESC,perPage:8){nodes{rating mediaRecommendation{
    idMal id format averageScore popularity seasonYear isAdult episodes status
    title{romaji english native} coverImage{large}}}}}}}`

const OK_FORMATS = new Set(['TV', 'MOVIE', 'ONA', 'TV_SHORT'])
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }
const hashOf = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36) }

/**
 * seeds: [{ malId, weight (0-10, how much it's loved), title }], exclude: Set of malIds already seen by anyone.
 * -> [{ malId, title, poster, format, year, avg, hits: [seed titles], score }] best first
 */
export async function recommend(seeds, exclude = new Set(), { limit = 20, minAvg = 65, onPartial } = {}) {
  const usable = seeds.filter(s => s.malId)
  if (!usable.length) return []
  const ck = 'rec:' + hashOf(usable.map(s => `${s.malId}:${s.weight}`).sort().join(',') + '|' + [...exclude].length)
  const hit = cacheGet(ck)
  if (hit) return hit

  const bySeed = new Map(usable.map(s => [String(s.malId), s]))
  const cand = new Map()
  for (const part of chunk(usable.map(s => s.malId), 25)) {
    const d = await anilist(REC_Q, { ids: part })
    for (const m of d?.Page?.media || []) {
      const seed = bySeed.get(String(m.idMal))
      if (!seed) continue
      for (const n of m.recommendations?.nodes || []) {
        const r = n.mediaRecommendation
        if (!r?.idMal || r.isAdult || n.rating < 15) continue
        if (exclude.has(String(r.idMal)) || !OK_FORMATS.has(r.format) || (r.averageScore || 0) < minAvg) continue
        const c = cand.get(r.idMal) || { r, score: 0, hits: [] }
        c.score += Math.log10(1 + n.rating) * (seed.weight / 10)
        c.hits.push(seed.title)
        cand.set(r.idMal, c)
      }
    }
  }

  const ranked = [...cand.values()]
    .map(c => ({ ...c, rank: c.hits.length * 3 + c.score + (c.r.averageScore - 70) / 20 }))
    .sort((x, y) => y.rank - x.rank)
    .slice(0, limit + 10)

  const toItem = (c, sh) => {
    const base = fromAniList({ ...c.r, id: c.r.id })
    const t = sh || (ru.get(String(c.r.idMal)) ? mergeTitles(base, ru.get(String(c.r.idMal))) : base)
    return { malId: sh ? sh.malId : c.r.idMal, title: displayTitle(t), poster: sh?.poster || c.r.coverImage?.large || t.poster, format: sh?.format || c.r.format, year: sh?.year || c.r.seasonYear, avg: c.r.averageScore, hits: c.hits, score: c.rank, viaSequel: !!sh }
  }

  // stage 1: quick list straight from AniList votes (one cached Russian-names call)
  const ru = await shikiByMalIds(ranked.map(c => c.r.idMal))
  if (onPartial) onPartial(ranked.slice(0, limit).map(c => toItem(c, null)))

  // stage 2: franchise-aware: drop shows whose other seasons you've already seen, recommend a series once, via its first season
  const ser = await resolveSeriesMany(ranked.map(c => c.r.idMal)).catch(() => new Map())
  const seen = new Set()
  const kept = []
  for (const c of ranked) {
    const s = ser.get(String(c.r.idMal))
    if (s?.members.some(m => exclude.has(String(m)))) continue
    const key = s?.id || `m${c.r.idMal}`
    if (seen.has(key)) continue
    seen.add(key)
    kept.push({ c, root: s && s.root !== c.r.idMal ? s.root : null })
    if (kept.length >= limit) break
  }
  const roots = await shikiByMalIds(kept.map(k => k.root).filter(Boolean))
  const out = kept.map(({ c, root }) => toItem(c, root ? roots.get(String(root)) || null : null))
  if (out.length) cacheSet(ck, out, 6 * 3600e3)
  return out
}
