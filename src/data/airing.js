// Airing: fresh episode counts + next-episode time for titles in the user's list.

import { cacheGet, cacheSet, TTL } from './net.js'
import { aniByIds, aniByMalIds } from './search.js'

/**
 * items: [{ anilistId?, malId? }]. Returns Map keyed by String(malId) and `a${anilistId}`
 * -> { status, episodes, epAired, nextEp: {episode, at}|null, format }
 * Cached 10 min per title so reopening the list doesn't re-query.
 */
export async function fetchAiring(items) {
  const out = new Map()
  const needAni = [], needMal = []
  for (const it of items) {
    const key = it.malId ? String(it.malId) : `a${it.anilistId}`
    const c = cacheGet('air:' + key)
    if (c) { out.set(key, c); if (it.anilistId) out.set(`a${it.anilistId}`, c); continue }
    if (it.anilistId) needAni.push(it.anilistId)
    else if (it.malId) needMal.push(it.malId)
  }
  const fresh = []
  if (needAni.length) fresh.push(...await aniByIds(needAni))
  if (needMal.length) fresh.push(...await aniByMalIds(needMal))
  for (const t of fresh) {
    const v = { status: t.status, episodes: t.episodes, epAired: t.epAired, nextEp: t.nextEp, format: t.format }
    if (t.malId) { out.set(String(t.malId), v); cacheSet('air:' + t.malId, v, TTL.airing) }
    out.set(`a${t.anilistId}`, v)
    cacheSet('air:a' + t.anilistId, v, TTL.airing)
  }
  return out
}

/** "через 2д 4ч" / "через 3ч 20м" / "через 12м" / "вышла" for a timestamp (ms). */
export function countdown(at, now = Date.now()) {
  if (!at) return null
  const ms = at - now
  if (ms <= 0) return 'вышла'
  const m = Math.floor(ms / 60000)
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60
  if (d) return `через ${d}д ${h}ч`
  if (h) return `через ${h}ч ${mm}м`
  return `через ${Math.max(mm, 1)}м`
}

/** "Вт, 21:30" in the viewer's timezone. */
export function airDay(at) {
  if (!at) return null
  const d = new Date(at)
  const wd = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()]
  return `${wd}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * What the user should see for a list entry:
 * { aired, behind, next: {episode, at, in, day}|null, state: 'airing'|'finished'|'upcoming'|'unknown' }
 */
export function airingInfo(entry, now = Date.now()) {
  const watched = entry.ep || 0
  const aired = entry.epAired ?? (entry.epTotal && !entry.isOngoing ? entry.epTotal : null)
  const next = entry.nextEpisodeAt && Date.parse(entry.nextEpisodeAt) > now
    ? { episode: entry.nextEp || (aired != null ? aired + 1 : null), at: Date.parse(entry.nextEpisodeAt) }
    : null
  const state = entry.status === 'NOT_YET_RELEASED' ? 'upcoming'
    : next || entry.isOngoing ? 'airing'
    : entry.epTotal || aired != null ? 'finished'
    : 'unknown'
  return {
    aired,
    behind: aired != null ? Math.max(0, aired - watched) : 0,
    next: next ? { ...next, in: countdown(next.at, now), day: airDay(next.at) } : null,
    state,
  }
}
