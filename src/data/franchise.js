// Franchise graph: all seasons, movies, OVAs and specials of a show, in watch order, with a clear role for each.
// Built from AniList relation edges (SEQUEL/PREQUEL chain + side stories / spin-offs), RU names added from Shikimori.

import { anilist, cacheGet, cacheSet, TTL } from './net.js'
import { ANI_FIELDS, fromAniList, mergeTitles, displayTitle } from './model.js'
import { aniByMalIds, shikiByMalIds } from './search.js'
import { walkShikiFranchise } from './series.js'

const REL_Q = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){${ANI_FIELDS}
  relations{edges{relationType(version:2) node{${ANI_FIELDS}}}}}}}`

const CHAIN = new Set(['SEQUEL', 'PREQUEL', 'PARENT'])
const EXTRA = { SIDE_STORY: 'side', SPIN_OFF: 'spinoff' }
const MAX_NODES = 60
const MAX_DEPTH = 10

const dateKey = (t) => {
  const d = t.startDate
  if (!d?.year) return Infinity
  return d.year * 10000 + (d.month || 0) * 100 + (d.day || 0)
}

// "Part 2", "Часть 2", "2nd cour" -> split-cour continuation of the previous season
const COUR_RE = /(?<![\p{L}\p{N}])(?:part|cour|часть)\s*(2|ii|3|iii)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])(2nd|second|3rd|third) cour(?![\p{L}\p{N}])/iu
const courOf = (t) => {
  for (const n of [t.titleRomaji, t.titleEn, ...(t.synonyms || [])]) {
    const m = n && n.match(COUR_RE)
    if (m) return /^(3|iii)$/i.test(m[1] || '') || /3rd|third/i.test(m[2] || '') ? 3 : 2
  }
  return 1
}

const LABEL = { movie: 'Фильм', ova: 'OVA', special: 'Спешл', ona: 'ONA', spinoff: 'Спин-офф', side: 'Побочная история', short: 'Короткометражка' }

/** Assign role / season number / label. `nodes` = [{title, link}] in any order. */
function classify(nodes) {
  const sorted = [...nodes].sort((a, b) => dateKey(a.title) - dateKey(b.title) || a.title.anilistId - b.title.anilistId)
  let season = 0
  let lastSeasonCours = 0
  const out = []
  // minutes per episode of the franchise's regular TV seasons; much shorter TV runs are shorts, not seasons
  const durs = sorted.map(n => n.title).filter(t => t.format === 'TV' && t.duration).map(t => t.duration).sort((a, b) => a - b)
  const median = durs.length ? durs[Math.floor(durs.length / 2)] : null
  for (const { title: t, link } of sorted) {
    let role, seasonNum = null, cour = 1
    const f = t.format
    if (f === 'MUSIC') continue
    const isShort = f === 'TV' && median && t.duration && t.duration < 15 && t.duration < median * 0.5
    if (isShort) role = 'short'
    else if (f === 'TV' || (f === 'ONA' && (t.episodes || 0) >= 6)) {
      if (link === 'spinoff') role = 'spinoff'
      else {
        role = 'season'
        cour = courOf(t)
        if (cour > 1 && season > 0) seasonNum = season
        else { season += 1; seasonNum = season; cour = 1 }
        lastSeasonCours = Math.max(lastSeasonCours, cour)
      }
    } else if (f === 'TV_SHORT') role = 'short'
    else if (f === 'MOVIE') role = 'movie'
    else if (f === 'OVA') role = 'ova'
    else if (f === 'SPECIAL') role = 'special'
    else if (f === 'ONA') role = 'ona'
    else role = link ? (EXTRA[link] || 'side') : 'special'
    if (link === 'side' && role !== 'season') role = role === 'movie' ? 'movie' : role

    const label = role === 'season'
      ? `Сезон ${seasonNum}${cour > 1 ? ` · часть ${cour}` : ''}`
      : LABEL[role] || 'Другое'
    out.push({ ...t, role, link: link || null, seasonNum, cour, label, afterSeason: season || null })
  }
  return out.map((e, i) => ({ ...e, order: i }))
}

/** Fast path: one Shikimori REST call gives every node + typed links; one AniList batch adds formats/dates/airing. */
async function franchiseViaShiki(malId) {
  const w = await walkShikiFranchise(malId)
  if (!w) return null
  const { chain, extras } = w
  const chainSet = new Set(chain)
  const ids = [...chain, ...extras.keys()].slice(0, 50)
  const [aniList, ru] = await Promise.all([aniByMalIds(ids), shikiByMalIds(ids)])
  const aniByMal = new Map(aniList.map(t => [String(t.malId), t]))
  const nodes = []
  for (const id of ids) {
    let t = aniByMal.get(String(id)) || null
    const s = ru.get(String(id)) || null
    t = t && s ? mergeTitles(t, s) : t || s
    if (!t || t.isAdult || t.format === 'MUSIC') continue
    nodes.push({ title: t, link: chainSet.has(id) ? null : extras.get(id) })
  }
  return { nodes, root: w.root }
}

/** Fallback: walk AniList SEQUEL/PREQUEL/PARENT edges level by level. */
async function franchiseViaAniList(anilistId) {
  const chain = new Map()   // anilistId -> Title (SEQUEL/PREQUEL/PARENT-connected)
  const extras = new Map()  // anilistId -> { title, link }
  const queued = new Set([anilistId])
  let frontier = [anilistId]

  for (let depth = 0; depth < MAX_DEPTH && frontier.length && chain.size < MAX_NODES; depth++) {
    const d = await anilist(REL_Q, { ids: frontier.slice(0, 50) })
    const media = d?.Page?.media || []
    if (!media.length && depth === 0) return null
    const next = []
    for (const m of media) {
      chain.set(m.id, fromAniList(m))
      for (const e of m.relations?.edges || []) {
        const n = e.node
        if (!n || n.isAdult || n.format === 'MUSIC') continue
        if (CHAIN.has(e.relationType)) {
          if (!chain.has(n.id)) chain.set(n.id, fromAniList(n))
          if (!queued.has(n.id)) { queued.add(n.id); next.push(n.id) }
        } else if (EXTRA[e.relationType] && !extras.has(n.id)) {
          extras.set(n.id, { title: fromAniList(n), link: EXTRA[e.relationType] })
        }
      }
    }
    frontier = next
  }

  const nodes = [...chain.values()].map(t => ({ title: t, link: null }))
  for (const [id, x] of extras) if (!chain.has(id)) nodes.push(x)
  const ru = await shikiByMalIds(nodes.map(n => n.title.malId).filter(Boolean))
  for (const n of nodes) {
    const s = n.title.malId ? ru.get(String(n.title.malId)) : null
    if (s) n.title = mergeTitles(n.title, s)
  }
  return nodes
}

/**
 * Resolve the whole franchise for a title. seed = { malId?, anilistId? }.
 * -> { id, name, rootKey, seedKey, entries: [Title & {role, seasonNum, cour, label, order, afterSeason}], memberMalIds }
 */
export async function getFranchise(seed) {
  let { malId, anilistId } = seed
  const sk = String(malId || `a${anilistId}`)
  const ck = 'fr:' + sk
  const hit = cacheGet(ck)
  if (hit) return hit

  let nodes = null
  let root = null
  if (malId) {
    const r = await franchiseViaShiki(Number(malId))
    nodes = r?.nodes || null
    root = r?.root || null
  }
  if (!nodes?.length) {
    if (!anilistId && malId) anilistId = (await aniByMalIds([malId]))[0]?.anilistId
    if (anilistId) nodes = await franchiseViaAniList(anilistId)
  }
  if (!nodes?.length) return null

  const entries = classify(nodes)
  if (!entries.length) return null
  const first = entries.find(e => e.role === 'season') || entries[0]
  const franchise = {
    id: root ? `f${root}` : `f${first.malId || first.anilistId}`,
    name: displayTitle(first),
    rootKey: first.key,
    seedKey: sk,
    entries,
    memberMalIds: entries.map(e => e.malId).filter(Boolean),
  }
  cacheSet(ck, franchise, TTL.franchise)
  for (const e of entries) if (e.malId && String(e.malId) !== sk) cacheSet('fr:' + e.malId, franchise, TTL.franchise)
  return franchise
}
