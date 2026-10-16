import { formatLabel, norm } from '../data/index.js'

/** Label for the kind of entry: 'Сезон 2', 'Фильм', 'OVA'... (legacy entries carry seasonLabel / kind only). */
export function typeLabel(e) {
  if (e.seasonLabel) return e.seasonLabel
  if (e.season) return `Сезон ${e.season}`
  if (e.format) return formatLabel(e.format)
  const k = (e.kind || '').toLowerCase()
  return { movie: 'Фильм', ova: 'OVA', ona: 'ONA', special: 'Спешл', tv: 'Сезон 1' }[k] || 'Сезон 1'
}

export const isSeasonLike = (e) => e.role ? e.role === 'season' : !['movie', 'ova', 'ona', 'special'].includes((e.kind || '').toLowerCase())

/** Entries of one stack in watch order: seasons by number, extras by year. */
export function sortStack(entries) {
  return [...entries].sort((a, b) =>
    (a.year || 9999) - (b.year || 9999) ||
    (a.season || 99) - (b.season || 99) ||
    (a.addedAt || 0) - (b.addedAt || 0))
}

/** The entry that names the stack: first season if any, else the oldest. */
export function stackHead(entries) {
  const seasons = entries.filter(isSeasonLike)
  const pool = seasons.length ? seasons : entries
  return [...pool].sort((a, b) => (a.season || 99) - (b.season || 99) || (a.year || 9999) - (b.year || 9999))[0]
}

/** Group a (filtered, sorted) list into stacks keeping first-seen order. */
export function groupStacks(list) {
  const idx = new Map()
  const out = []
  for (const e of list) {
    const key = e.franchiseId || e.seriesKey || `e${e.id}`
    if (idx.has(key)) out[idx.get(key)].push(e)
    else { idx.set(key, out.length); out.push([e]) }
  }
  return out.map(sortStack)
}

export const stackKey = (entries) => entries[0].franchiseId || entries[0].seriesKey || `e${entries[0].id}`

/** Highest episode the user can have watched right now. */
export function epCap(e) {
  const airing = e.isOngoing && e.epAired != null
  if (airing) return e.epAired
  return e.epTotal || e.epAired || 9999
}

/** Apply "+1 episode" and keep the status honest. */
export function bumpEpisode(e, delta = 1) {
  const cap = epCap(e)
  const ep = Math.max(0, Math.min(cap, (e.ep || 0) + delta))
  let status = e.status
  if (delta > 0 && status === 'planned') status = 'watching'
  if (e.epTotal && ep >= e.epTotal && !e.isOngoing) status = 'completed'
  else if (status === 'completed' && delta < 0) status = 'watching'
  return { ...e, ep, status }
}

/** "Name.s2" style export line, kept compatible with the text importer. */
export function exportLine(e) {
  const season = e.role === 'season' && e.season > 1 ? ` ${e.season} сезон` : ''
  const extra = e.role && e.role !== 'season' ? ` (${typeLabel(e)})` : ''
  return `${e.title}${season}${extra}${e.score ? ` ${e.score}/10` : ''}`
}

// ── duplicates ──
const squash = (x) => norm(x).replace(/ /g, '')
/** How an entry may be written: "Название", "Название 2" (season number appended for seasons 2+). */
function nameKeys(e) {
  const keys = new Set()
  for (const n of [e.title, e.titleRomaji, e.titleJp]) if (n) keys.add(squash(n))
  if (e.season > 1 && e.title) keys.add(squash(`${e.title} ${e.season}`))
  return keys
}

/** What the list already contains: MAL ids + name keys (name keys only count for entries without an id). */
export function knownEntries(list) {
  const ids = new Set(), names = new Set()
  for (const e of list) {
    if (e.shikiId) ids.add(String(e.shikiId))
    else for (const k of nameKeys({ ...e, season: e.season || 1 })) names.add(k)
    if ((e.season || 1) <= 1 && e.title) names.add(`${squash(e.title)}#1`)
  }
  return { ids, names }
}

/** Is this matched Title (or entry) already in the list? */
export function isKnown(known, { malId, shikiId, titles }) {
  const id = malId || shikiId
  if (id && known.ids.has(String(id))) return true
  return (titles || []).some(t => t && known.names.has(squash(t)))
}

const weight = (e) => (e.status !== 'planned' ? 4 : 0) + (e.score ? 2 : 0) + ((e.ep || 0) > 0 ? 1 : 0) + (e.shikiId ? 0.5 : 0)

/** Ids of entries that duplicate another one (same MAL id, or same name+season for entries without an id). Keeps the one with progress. */
export function duplicateIds(list) {
  const drop = new Set()
  const byId = new Map()
  for (const e of list) {
    if (!e.shikiId) continue
    const k = String(e.shikiId)
    const cur = byId.get(k)
    if (!cur) byId.set(k, e)
    else if (weight(e) > weight(cur)) { drop.add(cur.id); byId.set(k, e) }
    else drop.add(e.id)
  }
  // an entry with no id that is the same title+season as one that has an id
  const idNames = new Map()
  for (const e of byId.values()) for (const k of nameKeys({ ...e, season: e.season || 1 })) idNames.set(`${k}#${e.season || 1}`, e)
  for (const e of list) {
    if (e.shikiId || drop.has(e.id)) continue
    const season = e.season || 1
    const twin = [...nameKeys({ ...e, season })].map(k => idNames.get(`${k}#${season}`)).find(Boolean)
    if (twin) { if (weight(e) > weight(twin)) drop.add(twin.id); else drop.add(e.id) }
  }
  return drop
}

/**
 * Put franchise ids / season numbers from groupByRelations onto entries.
 * Entries join an existing stack when the list already has one for that franchise (so seriesKey stays stable).
 */
export function applyGrouping(entries, existing, groups) {
  const anchor = new Map()
  for (const e of existing) {
    const g = e.shikiId && groups.get(String(e.shikiId))
    if (g && e.franchiseId) anchor.set(g.id, { seriesKey: e.seriesKey || e.franchiseId, franchiseId: e.franchiseId })
  }
  return entries.map(e => {
    const g = e.shikiId && groups.get(String(e.shikiId))
    if (!g) return e
    const a = anchor.get(g.id)
    const info = e.role ? {} : { role: g.role, season: g.seasonNum, seasonLabel: g.label }
    return { ...e, ...info, seriesKey: a?.seriesKey || g.id, franchiseId: a?.franchiseId || g.id }
  })
}
