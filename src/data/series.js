// Cheap franchise grouping from Shikimori alone (1 REST call, no AniList): used to stack seasons of the same
// show in the list, to migrate old saved lists, and by import. Full details come from franchise.js.

import { shikiRest, shikiGql, cacheGet, cacheSet, TTL } from './net.js'

const MAX_NODES = 60
export const SHIKI_EXTRA = { side_story: 'side', spin_off: 'spinoff' }
// relation of the TARGET relative to the SOURCE; the reverse direction needs the inverse
const INVERSE = { sequel: 'prequel', prequel: 'sequel', side_story: 'parent_story', spin_off: 'parent_story', parent_story: 'spin_off', full_story: 'summary', summary: 'full_story' }

/**
 * Walk the Shikimori franchise graph around `malId`.
 * Season chain = sequel/prequel links (plus one hop to the parent story if the seed is a side story/spin-off).
 * -> { root, chain: [malId...] (oldest first), extras: Map(malId -> 'side'|'spinoff') } | null
 */
export async function walkShikiFranchise(malId) {
  malId = Number(malId)
  const g = await shikiRest(`/api/animes/${malId}/franchise`)
  if (!g?.nodes?.length || !g.links) return null

  const adj = new Map()
  const add = (a, b, rel) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, rel]) }
  for (const l of g.links) { add(l.source_id, l.target_id, l.relation); add(l.target_id, l.source_id, INVERSE[l.relation] || l.relation) }

  const chain = new Set([malId])
  const queue = [malId]
  for (const [to, rel] of adj.get(malId) || []) if (rel === 'parent_story' && !chain.has(to)) { chain.add(to); queue.push(to) }
  const extras = new Map()
  while (queue.length && chain.size < MAX_NODES) {
    const cur = queue.shift()
    for (const [to, rel] of adj.get(cur) || []) {
      if (rel === 'sequel' || rel === 'prequel') { if (!chain.has(to)) { chain.add(to); queue.push(to) } }
      else if (SHIKI_EXTRA[rel] && !extras.has(to)) extras.set(to, SHIKI_EXTRA[rel])
    }
  }
  for (const id of chain) extras.delete(id)

  const date = new Map(g.nodes.map(n => [n.id, n.date || Infinity]))
  const ordered = [...chain].sort((a, b) => (date.get(a) ?? Infinity) - (date.get(b) ?? Infinity) || a - b)
  return { root: ordered[0], chain: ordered, extras, nodes: new Map(g.nodes.map(n => [n.id, n])) }
}

// "Часть 2" / "Part 2" / "2nd cour" = continuation of the previous season, not a new one
const COUR = /(?<![\p{L}\p{N}])(?:часть|part|cour)\s*(?:2|ii|3|iii)(?![\p{L}\p{N}])/iu
const kindOf = (k) => {
  const t = String(k || '').toLowerCase()
  if (t.includes('фильм')) return 'movie'
  if (t.includes('ova') || t.includes('ова')) return 'ova'
  if (t.includes('спешл') || t.includes('special')) return 'special'
  if (t.includes('ona')) return 'ona'
  if (t.includes('клип') || t.includes('music')) return 'music'
  if (t.includes('tv')) return 'season'
  return 'season'
}

/** malId -> { role, seasonNum, cour, label } from node kinds + release order (chain: seasons/movies in story order). */
export function classifyMembers(walk) {
  const out = {}
  let season = 0
  for (const id of walk.chain) {
    const n = walk.nodes.get(id)
    const role = kindOf(n?.kind)
    if (role === 'music') continue
    if (role === 'season') {
      const cont = COUR.test(n?.name || '') && season > 0
      if (!cont) season += 1
      out[id] = { role, seasonNum: season, cour: cont ? 2 : 1, label: `Сезон ${season}${cont ? ' · часть 2' : ''}` }
    } else {
      out[id] = { role, seasonNum: null, cour: 1, label: { movie: 'Фильм', ova: 'OVA', special: 'Спешл', ona: 'ONA' }[role] }
    }
  }
  for (const [id, link] of walk.extras) {
    const role = kindOf(walk.nodes.get(id)?.kind)
    if (role === 'music') continue
    out[id] = role === 'season'
      ? { role: 'spinoff', seasonNum: null, cour: 1, label: link === 'side' ? 'Побочная история' : 'Спин-офф' }
      : { role, seasonNum: null, cour: 1, label: { movie: 'Фильм', ova: 'OVA', special: 'Спешл', ona: 'ONA' }[role] }
  }
  return out
}

/** Series identity for a MAL id: { id: 'f<root>', root, members: [malId...] } (members = chain + side stories). Cached. */
export async function resolveSeries(malId) {
  const ck = 'ser:' + malId
  const hit = cacheGet(ck)
  if (hit) return hit
  const w = await walkShikiFranchise(malId)
  if (!w) return null
  const res = { id: `f${w.root}`, root: w.root, members: [...w.chain, ...w.extras.keys()], roles: classifyMembers(w) }
  cacheSet(ck, res, TTL.franchise)
  for (const m of res.members) if (String(m) !== String(malId)) cacheSet('ser:' + m, res, TTL.franchise)
  return res
}

/** Resolve series for many MAL ids with small concurrency. -> Map(String(malId) -> series) */
export async function resolveSeriesMany(malIds, onProgress) {
  const ids = [...new Set(malIds.map(String))]
  const out = new Map()
  let done = 0
  let i = 0
  const worker = async () => {
    while (i < ids.length) {
      const id = ids[i++]
      if (out.has(id)) { done++; continue }
      const s = await resolveSeries(id).catch(() => null)
      if (s) for (const m of s.members) if (ids.includes(String(m))) out.set(String(m), s)
      done++
      onProgress?.(done, ids.length)
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return out
}

// ── bulk grouping: relations for up to 50 titles per request ──
const REL_Q = `query($ids:String!){animes(ids:$ids,limit:50){id kind name russian airedOn{year}
  related{relationKind anime{id kind name russian airedOn{year}}}}}`
const LINK_KINDS = new Set(['side_story', 'spin_off', 'parent_story', 'full_story', 'summary'])
const roleOfKind = (k) => ({ tv: 'season', movie: 'movie', ova: 'ova', ona: 'ona', special: 'special', tv_special: 'special' }[String(k || '').toLowerCase()] || 'special')
const EXTRA_LABEL = { movie: 'Фильм', ova: 'OVA', ona: 'ONA', special: 'Спешл', spinoff: 'Спин-офф' }

/**
 * Group many MAL ids into franchises with a handful of requests (not one per franchise).
 * Seasons are linked by sequel/prequel — also through a title that isn't in the list (S1 and S3 both point at S2);
 * movies/OVAs/side stories join a group when they point at a member.
 * -> Map(String(malId) -> { id: 'f<root>', root, role, seasonNum, cour, label })
 */
export async function groupByRelations(malIds) {
  const ids = [...new Set(malIds.map(Number).filter(Boolean))]
  const info = new Map()                 // id -> { kind, name, year }
  const rel = []                         // [a, b, kind]
  for (let i = 0; i < ids.length; i += 50) {
    const d = await shikiGql(REL_Q, { ids: ids.slice(i, i + 50).join(',') })
    for (const a of d?.animes || []) {
      const id = Number(a.id)
      info.set(id, { kind: a.kind, name: a.russian || a.name, year: a.airedOn?.year || null })
      for (const r of a.related || []) {
        if (!r.anime) continue
        const b = Number(r.anime.id)
        if (!info.has(b)) info.set(b, { kind: r.anime.kind, name: r.anime.russian || r.anime.name, year: r.anime.airedOn?.year || null })
        rel.push([id, b, r.relationKind])
      }
    }
  }

  const inList = new Set(ids)
  const parent = new Map()
  const find = (x) => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra) }
  const chained = new Set()              // has a sequel/prequel relative = part of a season chain
  for (const [a, b, k] of rel) {
    if (k === 'sequel' || k === 'prequel') { union(a, b); chained.add(a); chained.add(b) }
    else if (LINK_KINDS.has(k) && inList.has(b)) union(a, b)
  }

  const groups = new Map()
  for (const id of ids) { const r = find(id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(id) }
  // every node of the group (incl. ones outside the list) decides the root: the earliest title
  const allNodes = new Map()
  for (const id of info.keys()) { const r = find(id); if (!allNodes.has(r)) allNodes.set(r, []); allNodes.get(r).push(id) }
  const when = (id) => info.get(id)?.year || 9999
  const sorter = (a, b) => when(a) - when(b) || a - b

  const out = new Map()
  for (const [r, members] of groups) {
    const root = [...(allNodes.get(r) || members)].sort(sorter)[0]
    let season = 0
    for (const id of [...members].sort(sorter)) {
      const n = info.get(id) || {}
      let role = roleOfKind(n.kind)
      if (role === 'season' && !chained.has(id) && members.length > 1) role = 'spinoff' // joined only by a side link, not a sequel chain
      let res
      if (role === 'season') {
        const cont = /(?<![\p{L}\p{N}])(?:часть|part|cour)\s*(?:2|ii|3|iii)(?![\p{L}\p{N}])/iu.test(n.name || '') && season > 0
        if (!cont) season += 1
        res = { role, seasonNum: season, cour: cont ? 2 : 1, label: `Сезон ${season}${cont ? ' · часть 2' : ''}` }
      } else res = { role, seasonNum: null, cour: 1, label: EXTRA_LABEL[role] || 'Другое' }
      out.set(String(id), { id: `f${root}`, root, ...res })
    }
  }
  return out
}
