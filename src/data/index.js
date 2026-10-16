import { displayTitle, legacyKind } from './model.js'
import { searchBase, aniByMalIds, enrich, shikiSearch, shikiSearchBatch, STOP } from './search.js'
import { getFranchise } from './franchise.js'
import { norm, seasonNo, rankTitles } from './match.js'
import { cacheGet, cacheSet, TTL } from './net.js'
import aliases from './ruSearchMap.json' with { type: 'json' }

export { getFranchise }
export { recommend } from './recommend.js'
export { resolveSeries, resolveSeriesMany, groupByRelations } from './series.js'

// "Магическая битва 2 сезон" -> "Магическая битва"  (Unicode-aware boundaries: \b doesn't see Cyrillic)
const SEASON_WORDS = '(?:первый|второй|третий|четвертый|пятый|шестой|first|second|third|fourth|fifth|sixth)'
const NB = '(?<![\\p{L}\\p{N}])', NE = '(?![\\p{L}\\p{N}])'
function stripSeason(q) {
  return String(q)
    .replace(new RegExp(`${NB}${SEASON_WORDS}\\s+(?:сезон|season)${NE}`, 'giu'), ' ')
    .replace(new RegExp(`${NB}\\d{1,2}\\s*(?:st|nd|rd|th)?\\s*(?:сезон|season)${NE}`, 'giu'), ' ')
    .replace(new RegExp(`${NB}(?:сезон|season)\\s*\\d{1,2}${NE}`, 'giu'), ' ')
    .replace(/\s+(?:ii|iii|iv|v|vi|\d{1,2})\s*$/i, ' ')
    .replace(/\s+/g, ' ').trim()
}

// curated Russian aliases (slang, short names): exact or prefix of the squashed query
function aliasMalId(q) {
  const key = norm(q).replace(/ /g, '')
  if (key.length < 4) return null
  const map = aliases.byId
  if (map[key]) return map[key]
  if (key.length >= 6) for (const [k, id] of Object.entries(map)) if (k.length >= 5 && key.startsWith(k) && key.length - k.length <= 2) return id
  return null
}

/**
 * Search anime by any name. Understands Russian/English/romaji, abbreviations, typos, slang,
 * and "<name> N сезон" (resolves the Nth season through the franchise graph).
 */
export async function searchAnime(q, { limit = 12 } = {}) {
  let results = await searchBase(q, { limit: Math.max(limit, 12) })
  const lead = []

  const aid = aliasMalId(q)
  if (aid && !results.some(r => String(r.malId) === String(aid))) {
    const [t] = await enrich(await aniByMalIds([aid]))
    if (t) lead.push({ ...t, score: 135 })
  }

  const n = seasonNo(q)
  if (n && n >= 2 && seasonNo(results[0] ? (results[0].titleEn || results[0].titleRomaji || '') : '') !== n) {
    const base = stripSeason(q)
    if (base && base !== q.trim()) {
      const [top] = await searchBase(base, { limit: 3 })
      const fr = top && await getFranchise({ anilistId: top.anilistId, malId: top.malId })
      const hit = fr?.entries.find(e => e.role === 'season' && e.seasonNum === n && e.cour === 1)
      if (hit) lead.push({ ...hit, score: 140 })
    }
  }

  if (lead.length) {
    const taken = new Set(lead.map(t => t.key))
    results = [...lead.sort((a, b) => b.score - a.score), ...results.filter(r => !taken.has(r.key))]
  }
  return results.slice(0, limit)
}

/**
 * Cheap matcher for bulk import: Shikimori only (understands Russian well, no AniList quota, ~1 request per line).
 * A clear winner is accepted right away; only unclear cases fall back to the full AniList+Shikimori search.
 * Results are cached for a week, so re-importing a list is instant. null when nothing is convincing.
 */
export async function quickMatch(name, minScore = 62) {
  const ck = 'qm:' + norm(name)
  const hit = cacheGet(ck)
  if (hit) return hit

  const accept = (ranked, strict) => {
    const [best, second] = ranked
    if (!best) return null
    const lead = best.s - (second ? second.s : 0)
    const ok = strict ? (best.s >= minScore + 12 || (best.s >= minScore && lead >= 8)) : (best.s >= minScore && (best.s >= minScore + 8 || lead >= 5))
    return ok ? { ...best.t, score: Math.round(best.s) } : null
  }

  let pool = await shikiSearch(name, 10)
  let found = accept(rankTitles(name, pool), true)

  // folk names don't match word for word: retry Shikimori (cheap, ~0.3s) on variants before touching AniList
  if (!found) {
    const nn = norm(name)
    const words = nn.split(' ').filter(w => w.length >= 4 && !STOP.has(w)).sort((a, b) => b.length - a.length)
    const colon = name.search(/[:：]/)
    const variants = [...new Set([
      colon > 2 ? name.slice(0, colon).trim() : null,
      words.slice(0, 3).join(' '),
      words.slice(0, 2).join(' '),
    ])].filter(v => v && norm(v) !== nn).slice(0, 3)
    for (const v of variants) {
      const more = await shikiSearch(v, 10)
      const seen = new Set(pool.map(t => t.key))
      pool = [...pool, ...more.filter(t => !seen.has(t.key))]
      found = accept(rankTitles(name, pool), false)
      if (found) break
    }
  }

  if (!found) found = await matchAnime(name, minScore) // last resort: AniList (slow, quota-limited)
  if (found) cacheSet(ck, found, TTL.titles)
  return found
}

/**
 * Warm the quickMatch cache for many names at once: ~6 names per Shikimori request instead of one request each.
 * Names without a clear winner are left for quickMatch's slower fallbacks. onProgress(done, total) optional.
 */
export async function prefetchMatches(names, { minScore = 62, onProgress } = {}) {
  const todo = [...new Set(names.map(n => String(n || '').trim()).filter(n => n.length >= 2))].filter(n => !cacheGet('qm:' + norm(n)))
  let done = 0
  for (let i = 0; i < todo.length; i += 6) {
    const part = todo.slice(i, i + 6)
    const results = await shikiSearchBatch(part, 5)
    part.forEach((name, k) => {
      const ranked = rankTitles(name, results[k] || [])
      const [best, second] = ranked
      if (!best) return
      const lead = best.s - (second ? second.s : 0)
      if (best.s >= minScore + 12 || (best.s >= minScore && lead >= 8)) cacheSet('qm:' + norm(name), { ...best.t, score: Math.round(best.s) }, TTL.titles)
    })
    done += part.length
    onProgress?.(Math.min(done, todo.length), todo.length)
  }
}

/** Best single match for importing a name from text. null when nothing is convincing. */
export async function matchAnime(name, minScore = 62) {
  const res = await searchAnime(name, { limit: 5 })
  return res.length && res[0].score >= minScore ? res[0] : null
}

export { fetchAiring, airingInfo, countdown, airDay } from './airing.js'
export { displayTitle, formatLabel, isReleasing, legacyKind } from './model.js'
export { norm, seasonNo } from './match.js'

/**
 * Build a list entry from a Title (optionally from a franchise entry). Keeps every legacy field the pages
 * already read (shikiId = MAL id, kind, season, seasonLabel, ep, epTotal, epAired, isOngoing, nextEpisodeAt...),
 * so saved lists, share links (listCodec) and the other pages keep working.
 */
export function buildEntry(t, { seriesKey, franchiseId } = {}) {
  return {
    id: Date.now() + Math.random(),
    shikiId: t.malId ? String(t.malId) : null,
    anilistId: t.anilistId || null,
    franchiseId: franchiseId || null,
    seriesKey: seriesKey || franchiseId || `t${t.key}`,
    title: displayTitle(t),
    titleJp: t.titleNative || '',
    titleRomaji: t.titleRomaji || t.titleEn || '',
    season: t.role === 'season' ? t.seasonNum : null,
    seasonLabel: t.label || null,
    role: t.role || null,
    format: t.format || null,
    kind: legacyKind(t.format),
    score: null,
    status: 'planned',
    ep: 0,
    epTotal: t.episodes || null,
    epAired: t.epAired ?? null,
    isOngoing: t.status === 'RELEASING',
    nextEpisodeAt: t.nextEp ? new Date(t.nextEp.at).toISOString() : null,
    nextEp: t.nextEp?.episode || null,
    genres: t.genres || [],
    poster: t.poster || null,
    year: t.year || null,
    studio: t.studio || '—',
    addedAt: Date.now(),
    hasSequel: false,
    hasOva: false,
  }
}
