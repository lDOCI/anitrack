import { useState, useEffect, useRef } from 'react'
import AchievementToast from './AchievementToast'
import NavBar from '../components/NavBar'
import ruMap from '../data/ruSearchMap.json'

// ── Константы ─────────────────────────────────────────────
const STATUS_META = {
  watching:  { label: 'Смотрю',      jp: '視聴中', color: '#d62828' },
  completed: { label: 'Просмотрено', jp: '完了',   color: '#166534' },
  dropped:   { label: 'Брошено',     jp: '中断',   color: '#92400e' },
  planned:   { label: 'В планах',    jp: '計画',   color: '#1e40af' },
}
const TABS = [
  { key: 'all',       label: 'Все',         jp: '全部' },
  { key: 'watching',  label: 'Смотрю',      jp: '視聴中' },
  { key: 'completed', label: 'Просмотрено', jp: '完了' },
  { key: 'planned',   label: 'В планах',    jp: '計画' },
  { key: 'dropped',   label: 'Брошено',     jp: '中断' },
]
const STORAGE_KEY = 'anitrack_list'
const isOvaKind = k => ['ova', 'ona', 'special', 'movie'].includes((k || '').toLowerCase())
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Транслитерация ────────────────────────────────────────
const TR = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'j','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya','А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'Yo','Ж':'Zh','З':'Z','И':'I','Й':'J','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'H','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Sch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya'}
const translit = s => s.split('').map(c => TR[c] ?? c).join('')
const isCyrillic = s => /[а-яёА-ЯЁ]/.test(s)
const normalizeKey = s => (s || '').toLowerCase().replace(/ё/g, 'е').replace(/э/g, 'е').replace(/[^a-zа-я0-9]/g, '')

// ── ruSearchMap.json: byId (normalizedRus → shikiId), byQuery (normalizedRus → engQuery) ──
// byQuery отсортирован по длине ключа (длинные первыми) для prefix-matching
const RU_BY_QUERY_SORTED = Object.entries(ruMap.byQuery)
  .sort((a, b) => b[0].length - a[0].length)

function getShikiIdByTitle(title) {
  const key = normalizeKey(title)
  return ruMap.byId[key] || null
}

function getRuSearchQuery(title) {
  const key = normalizeKey(title)
  for (const [normPat, eng] of RU_BY_QUERY_SORTED) {
    const matchLen = normPat.length < 9 ? normPat.length : Math.min(normPat.length, 14)
    if (key.startsWith(normPat.slice(0, matchLen))) return eng
  }
  return null
}

// ── Shikimori hosts (fallback) ────────────────────────────
const SHIKI_HOSTS = ['https://shikimori.one', 'https://shikimori.io']
let _activeHost = SHIKI_HOSTS[0]

// Wrapper: fetch with host fallback
async function shikiFetchLocal(path, opts) {
  for (const host of [_activeHost, ...SHIKI_HOSTS.filter(h => h !== _activeHost)]) {
    try {
      const res = await fetch(host + path, opts)
      if (res.ok || res.status === 429) { _activeHost = host; return res }
    } catch {}
  }
  throw new Error('All Shikimori hosts unavailable')
}

// ── Shikimori GraphQL ─────────────────────────────────────
const SHIKI_GQL = '/api/graphql' // path only, used with shikiFetchLocal
const GQL_SEARCH_Q = `query($q:String!){animes(search:$q,limit:20,order:popularity){id name russian licenseNameRu kind status episodes episodesAired airedOn{year} nextEpisodeAt poster{mainUrl} genres{russian kind} studios{name}}}`
const GQL_BY_IDS_Q = `query($ids:String!){animes(ids:$ids,limit:25){id poster{mainUrl}}}`
const GQL_BY_IDS_FULL_Q = `query($ids:String!){animes(ids:$ids,limit:50){id name russian licenseNameRu kind status episodes episodesAired airedOn{year} nextEpisodeAt poster{mainUrl} genres{russian kind} studios{name}}}`

// Жанры: genre + theme (Исэкай и т.д.), без demographic (Сёнен, Сэйнэн)

function pickGenres(genres) {
  if (!genres?.length) return []
  const real = genres.filter(g => g.kind === 'genre').map(g => g.russian)
  const themes = genres.filter(g => g.kind === 'theme').map(g => g.russian)
  return [...real, ...themes].filter(Boolean)
}

function mapGql(a) {
  return {
    id: `shiki_${a.id}`,
    shikiId: String(a.id),
    title: a.licenseNameRu || a.russian || a.name,
    titleJp: a.russian || a.name,
    titleRomaji: a.name,
    epTotal: a.episodes || null,
    epAired: a.episodesAired || null,
    isOngoing: a.status === 'ongoing',
    nextEpisodeAt: a.nextEpisodeAt || null,
    genres: pickGenres(a.genres),
    poster: a.poster?.mainUrl || null,
    year: a.airedOn?.year || null,
    studio: a.studios?.[0]?.name || '—',
    source: 'shiki',
    kind: a.kind || 'tv',
  }
}

async function gqlSearch(q) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await shikiFetchLocal(SHIKI_GQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: GQL_SEARCH_Q, variables: { q } }),
      })
      if (res.status === 429) { await sleep(2000 + attempt * 1000); continue }
      if (!res.ok) return []
      const data = await res.json()
      return (data.data?.animes || []).map(mapGql)
    } catch { return [] }
  }
  return []
}

async function gqlPosters(shikiIds) {
  if (!shikiIds.length) return {}
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await shikiFetchLocal(SHIKI_GQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: GQL_BY_IDS_Q, variables: { ids: shikiIds.map(String).join(',') } }),
      })
      if (res.status === 429) { await sleep(2000 + attempt * 1500); continue }
      if (!res.ok) return {}
      const data = await res.json()
      const map = {}
      for (const a of (data.data?.animes || [])) {
        if (a.poster?.mainUrl) map[String(a.id)] = a.poster.mainUrl
      }
      return map
    } catch { return {} }
  }
  return {}
}

async function gqlFetchByIds(ids) {
  if (!ids.length) return []
  const results = []
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50).map(String)
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await shikiFetchLocal(SHIKI_GQL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: GQL_BY_IDS_FULL_Q, variables: { ids: chunk.join(',') } }),
        })
        if (res.status === 429) { console.log(`[gqlFetchByIds] 429, retry ${attempt+1}`); await sleep(2000 + attempt * 2000); continue }
        if (!res.ok) { console.log(`[gqlFetchByIds] HTTP ${res.status}`); break }
        const data = await res.json()
        if (data.errors) console.log(`[gqlFetchByIds] GQL errors:`, JSON.stringify(data.errors).slice(0, 200))
        const animes = data.data?.animes || []
        console.log(`[gqlFetchByIds] chunk ${i/50+1}: got ${animes.length} animes`)
        for (const a of animes) results.push(mapGql(a))
        break
      } catch (e) { console.log(`[gqlFetchByIds] catch:`, e.message); break }
    }
  }
  return results
}

// ── Shikimori REST ────────────────────────────────────────
async function restSearch(q) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await _restThrottle()
      const res = await shikiFetchLocal(
        `/api/animes?search=${encodeURIComponent(q)}&limit=15&order=popularity`,
        { headers: { 'User-Agent': 'AniTracker/1.0' } }
      )
      if (res.status === 429) { await sleep(2000 + attempt * 1000); continue }
      if (!res.ok) return []
      const data = await res.json()
      return data.map(a => ({
        id: `shiki_${a.id}`,
        shikiId: String(a.id),
        title: a.russian || a.name,
        titleJp: a.name,
        titleRomaji: a.name,
        epTotal: a.episodes || null,
        epAired: a.episodes_aired || null,
        isOngoing: a.status === 'ongoing',
        poster: a.image?.original ? `${_activeHost}${a.image.original}` : null,
        genres: pickGenres(a.genres),
        year: a.aired_on ? new Date(a.aired_on).getFullYear() : null,
        studio: a.studios?.[0]?.name || '—',
        source: 'shiki',
        kind: a.kind || 'tv',
      }))
    } catch { return [] }
  }
  return []
}

// Rate limiter для REST API: очередь гарантирует ~3 запроса/сек
let _restQueue = Promise.resolve()
async function _restThrottle() {
  const myTurn = _restQueue.then(() => sleep(350), () => sleep(350))
  _restQueue = myTurn
  return myTurn
}

async function restRelated(shikiId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await _restThrottle()
      const res = await shikiFetchLocal(`/api/animes/${shikiId}/related`)
      if (res.status === 429) { await sleep(2000 + attempt * 1500); continue }
      if (!res.ok) return []
      const data = await res.json()
      return data
        .filter(r => r.anime && ['Sequel','Prequel','Side Story','Summary','Alternative Version','Spin-off','Other'].includes(r.relation))
        .map(r => ({
          shikiId: String(r.anime.id),
          title: r.anime.name,
          titleRu: r.anime.russian,
          kind: r.anime.kind,
          relation: r.relation,
          episodes: r.anime.episodes || r.anime.episodes_aired || null,
          airedYear: r.anime.aired_on ? new Date(r.anime.aired_on).getFullYear() : null,
        }))
    } catch { return [] }
  }
  return []
}

async function restDetails(shikiId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await _restThrottle()
      const res = await shikiFetchLocal(`/api/animes/${shikiId}`)
      if (res.status === 429) { await sleep(2000 + attempt * 1500); continue }
      if (!res.ok) return null
      const a = await res.json()
      return {
        shikiId: String(a.id),
        title: a.russian || a.name,
        titleJp: a.japanese?.[0] || a.name,
        titleRomaji: a.name,
        kind: a.kind,
        epTotal: a.episodes || null,
        epAired: a.episodes_aired || null,
        isOngoing: a.status === 'ongoing',
        nextEpisodeAt: a.next_episode_at || null,
        genres: pickGenres(a.genres),
        year: a.aired_on ? new Date(a.aired_on).getFullYear() : null,
        studio: a.studios?.[0]?.name || '—',
      }
    } catch { return null }
  }
  return null
}

// ── AniList (последний fallback) ──────────────────────────
const ANI_GENRE_RU = {
  'Action': 'Экшен', 'Adventure': 'Приключения', 'Comedy': 'Комедия',
  'Drama': 'Драма', 'Ecchi': 'Этти', 'Fantasy': 'Фэнтези',
  'Horror': 'Ужасы', 'Mahou Shoujo': 'Махо-сёдзё', 'Mecha': 'Меха',
  'Music': 'Музыка', 'Mystery': 'Детектив', 'Psychological': 'Психологическое',
  'Romance': 'Романтика', 'Sci-Fi': 'Фантастика', 'Slice of Life': 'Повседневность',
  'Sports': 'Спорт', 'Supernatural': 'Сверхъестественное', 'Thriller': 'Триллер',
}
const ANI_Q = `query($s:String){Page(perPage:10){media(search:$s,type:ANIME,sort:SEARCH_MATCH){id title{romaji native english}coverImage{large}episodes genres startDate{year}studios(isMain:true){nodes{name}}status}}}`

async function anilistSearch(q) {
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: ANI_Q, variables: { s: q } }),
    })
    const data = await res.json()
    return (data.data?.Page?.media || []).map(m => ({
      id: `ani_${m.id}`,
      shikiId: null,
      title: m.title.english || m.title.romaji || '',
      titleJp: m.title.native || '',
      titleRomaji: m.title.romaji || '',
      epTotal: m.episodes || null,
      isOngoing: m.status === 'RELEASING',
      genres: (m.genres || []).map(g => ANI_GENRE_RU[g] || g),
      poster: m.coverImage?.large || null,
      year: m.startDate?.year || null,
      studio: m.studios?.nodes?.[0]?.name || '—',
      source: 'anilist',
      kind: 'tv',
    }))
  } catch { return [] }
}

// ── smartSearch ───────────────────────────────────────────
// 1. gqlSearch(q)          — GQL, CDN постеры, полнотекстовый
// 2. restSearch(q)         — REST, лучше по русским названиям
// 3. gqlSearch/rest(base)  — без подзаголовка после ":"
// 4. gqlSearch/rest(tl)    — транслит кириллицы
async function enrichWithGqlPosters(restResults) {
  try {
    const ids = restResults.map(r => r.shikiId).filter(Boolean)
    const posters = await gqlPosters(ids)
    return restResults.map(r => ({ ...r, poster: posters[r.shikiId] || r.poster || null }))
  } catch { return restResults }
}

async function smartSearch(q, { skipEnrich = false } = {}) {
  const enrich = skipEnrich ? r => r : enrichWithGqlPosters

  // Шаг 0: прямой lookup по shikiId из кэша (мгновенно, без поиска)
  const cachedId = getShikiIdByTitle(q)
  if (cachedId) {
    const items = await gqlFetchByIds([cachedId])
    if (items.length) return skipEnrich ? items : enrich(items)
  }

  // Шаг 1: byQuery — если есть маппинг на английское название, ищем сразу по нему
  // (экономим 2 API вызова по сравнению со старым порядком)
  const mapped = getRuSearchQuery(q)
  if (mapped) {
    const [gqlM, restM] = await Promise.all([gqlSearch(mapped), restSearch(mapped)])
    const extra = [...gqlM]
    const mIds = new Set(gqlM.map(r => r.shikiId))
    for (const r of restM) { if (!mIds.has(r.shikiId)) extra.push(r) }
    if (extra.length > 0 && bestMatch(extra, q)) {
      return skipEnrich ? extra : enrich(extra)
    }
  }

  // Шаг 2: основной поиск GQL + REST параллельно
  const [gql, rest] = await Promise.all([gqlSearch(q), restSearch(q)])
  const merged = [...gql]
  const gqlIds = new Set(gql.map(r => r.shikiId))
  for (const r of rest) { if (!gqlIds.has(r.shikiId)) merged.push(r) }

  // Если нашли хороший матч — возвращаем сразу
  if (merged.length > 0) return skipEnrich ? merged : enrich(merged)

  // Шаг 3: без подзаголовка — "Атака титанов: Финал" → "Атака титанов"
  const colonIdx = q.indexOf(':')
  if (colonIdx > 0) {
    const base = q.slice(0, colonIdx).trim()
    const [gqlBase, restBase] = await Promise.all([gqlSearch(base), restSearch(base)])
    const mergedBase = [...gqlBase]
    const baseIds = new Set(gqlBase.map(r => r.shikiId))
    for (const r of restBase) { if (!baseIds.has(r.shikiId)) mergedBase.push(r) }
    if (mergedBase.length > 0) return skipEnrich ? mergedBase : enrich(mergedBase)
  }

  // Шаг 4: транслит кириллицы
  if (isCyrillic(q)) {
    const tl = translit(q)
    const [gqlTl, restTl] = await Promise.all([gqlSearch(tl), restSearch(tl)])
    const mergedTl = [...gqlTl]
    const tlIds = new Set(gqlTl.map(r => r.shikiId))
    for (const r of restTl) { if (!tlIds.has(r.shikiId)) mergedTl.push(r) }
    if (mergedTl.length > 0) return skipEnrich ? mergedTl : enrich(mergedTl)
  }

  return []
}

// ── resolveRootId ─────────────────────────────────────────
async function resolveRootId(shikiId) {
  const visited = new Set()
  let cur = String(shikiId)
  for (let i = 0; i < 10; i++) {
    if (visited.has(cur)) break
    visited.add(cur)
    try {
      const rel = await restRelated(cur)
      const pre = rel.find(r => r.relation === 'Prequel')
      if (!pre) break
      cur = String(pre.shikiId)
    } catch { break }
  }
  return cur
}

// ── Утилиты ───────────────────────────────────────────────
function makeSeriesKey(title) {
  const base = (title || '')
    .replace(/[.:]\s*Часть\s*(II|III|IV|\d+)\s*$/i, '')
    .replace(/\s+Часть\s+(II|III|IV|\d+)\s*$/i, '')
    .replace(/\s+(\d+)\s*(сезон|season)?\s*$/i, '')
    .replace(/\s+(сезон|season)\s*\d+\s*$/i, '')
    .replace(/\s+(II|III|IV|VI|VII|VIII|IX|XI|XII)\s*$/i, '')
    .replace(/\s+S\d+\s*$/i, '')
    .replace(/\s+Part\s*(II|III|IV|\d+)\s*$/i, '')
    .replace(/!!+/g, '')
    .trim()
  return normalizeKey(base)
}

function normStr(s) {
  return (s || '').toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/э/g, 'е')
    .replace(/[«»""„"]/g, '')
    .replace(/[.,!?;]+(?=\s|$)/g, '')
    .replace(/[-–—:]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const ORDINALS = Object.freeze({ 'первый':1,'первая':1,'первое':1,'второй':2,'вторая':2,'второе':2,'третий':3,'третья':3,'третье':3,'третьего':3,'четвёртый':4,'четвёртая':4,'четвёртое':4,'пятый':5,'пятая':5,'пятое':5,'шестой':6,'седьмой':7,'восьмой':8,'девятый':9,'десятый':10 })

function bestMatch(results, query) {
  if (!results.length) return null
  if (results.length === 1) return results[0]
  const q = normStr(query)
  const qToks = q.split(/\s+/).filter(t => t.length > 1)
  const qLastNum = q.match(/(?<![/\d])(\d{1,2})\s*$/)?.[1] || null
  const qIsOva = /\b(ova|special|спецвыпуск)\b/i.test(q)
  const qIsMovie = /\b(фильм|movie|конец|end|последн|финальн)\b/i.test(q)

  function score(r) {
    const candidates = [r.title, r.titleRomaji, r.titleJp].filter(Boolean).map(normStr)
    let best = 0
    for (const c of candidates) {
      const cToks = c.split(/\s+/)
      let s = 0
      if (c === q) return 1000
      if (c.startsWith(q)) s += 80
      else if (c.includes(q)) s += 60
      else if (q.includes(c) && c.length > 6) s += 35

      const matched = qToks.filter(t => t.length > 1 && cToks.some(ct => ct === t || ct.includes(t) || t.includes(ct)))
      s += (matched.length / Math.max(qToks.length, 1)) * 50

      // Первый токен запроса: совпал → бонус, нет → штраф
      if (qToks[0] && qToks[0].length > 2) {
        const firstMatch = cToks[0] === qToks[0] || cToks[0]?.includes(qToks[0]) || qToks[0].includes(cToks[0] || '')
        const otherMatched = matched.filter(t => t !== qToks[0]).length
        if (firstMatch) s += 12
        else if (otherMatched >= 2) { /* другое написание */ }
        else if (otherMatched === 1) s -= 8
        else s -= 18
      }

      // Ключевые токены: оба первых значимых слова запроса отсутствуют → явный промах
      const keyToks = qToks.slice(0, 2).filter(t => t.length > 2)
      if (keyToks.length >= 2) {
        const keyMatched = keyToks.filter(t => cToks.some(ct => ct === t || ct.includes(t) || t.includes(ct)))
        if (keyMatched.length === 0) s -= 35
      }

      s -= Math.min(Math.abs(c.length - q.length) * 0.5, 20)

      if (qLastNum) {
        const cLastNum = c.match(/(?<![/\d])(\d{1,2})\s*$/)?.[1] || null
        if (cLastNum && cLastNum !== qLastNum) {
          s -= 40
        } else if (cLastNum === qLastNum) {
          s += 15
        } else {
          const ordEntry = Object.entries(ORDINALS).find(([w]) => cToks.some(ct => ct === w))
          if (ordEntry) {
            if (String(ordEntry[1]) === qLastNum) s += 10
            else s -= 35
          } else if (parseInt(qLastNum) > 1) {
            s -= 15
          }
        }
      } else {
        if (/(?<![/\d])\d{1,2}\s*$/.test(c)) s -= 30
        const sequelWords = /\b(финал|финальный|месть|реверберация|возвращение|продолжение|часть|part|final|revenge|rise|return|второй|вторая|второе|третий|третья|третье|четвёртый|четвёртое|пятый|пятое|шестой|седьмой|восьмой|девятый|десятый)\b/i
        if (sequelWords.test(c) && !sequelWords.test(q)) s -= 20
        const extraWords = /(спецвыпуск|мини.аниме|\boad\b|\bpv\b|\bpreview\b|\btrailer\b|\brecap\b|\bnce\b)/i
        if (extraWords.test(c) && !extraWords.test(q)) s -= 50
      }
      best = Math.max(best, s)
    }
    const kind = (r.kind || '').toLowerCase()
    if (!qIsOva) {
      if (kind === 'tv' || kind === 'ona') best += (qIsMovie ? 0 : 15)
      if (kind === 'special') best -= 25
      if (kind === 'ova') best -= 10
      if (kind === 'movie' && qIsMovie) best += 8
    }
    return best
  }

  const scored = results.map(r => ({ r, s: score(r) })).sort((a, b) => b.s - a.s)
  return scored[0].s >= 45 ? scored[0].r : null
}

function buildEntry(base, details, seasonNum, seasonLabel, seriesKey) {
  return {
    id: Date.now() + Math.random(),
    shikiId: details?.shikiId || base.shikiId || null,
    seriesKey,
    title: base.title,
    titleJp: details?.titleJp || base.titleJp || '',
    titleRomaji: details?.titleRomaji || base.titleRomaji || '',
    season: seasonNum,
    seasonLabel,
    kind: details?.kind || base.kind || 'tv',
    score: null,
    status: 'planned',
    ep: 0,
    epTotal: details?.epTotal || base.epTotal || null,
    epAired: details?.epAired || base.epAired || null,
    isOngoing: details?.isOngoing || base.isOngoing || false,
    genres: (details?.genres?.length ? details.genres : base.genres) || [],
    poster: base.poster || null,
    year: details?.year || base.year || null,
    studio: details?.studio && details.studio !== '—' ? details.studio : base.studio || '—',
    addedAt: Date.now(),
    hasSequel: false,
    hasOva: false,
  }
}

// ── SeasonPickerModal ─────────────────────────────────────
function SeasonPickerModal({ searchResult, existingSeriesKeys, onClose, onAdd }) {
  const [loading, setLoading] = useState(true)
  const [tvSeasons, setTvSeasons] = useState([])
  const [extras, setExtras] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [showOva, setShowOva] = useState(false)
  const [resolvedSK, setResolvedSK] = useState(null)
  const metaRef = useRef({ hasSequel: false, hasOva: false })

  const sk = resolvedSK || makeSeriesKey(searchResult.title)
  const existingLabels = existingSeriesKeys.get(sk) || new Set()

  useEffect(() => { loadSeasons() }, [])

  async function loadSeasons() {
    setLoading(true)
    try {
      let mainId = searchResult.shikiId
      if (!mainId) {
        const res = await smartSearch(searchResult.titleRomaji || searchResult.title)
        if (res.length) mainId = res[0].shikiId
      }
      if (!mainId) {
        setTvSeasons([{ ...searchResult, _label: 'Сезон 1', _num: 1 }])
        if (!existingLabels.has('Сезон 1')) setSelected(new Set(['tv_1']))
        setLoading(false)
        return
      }

      const rootId = await resolveRootId(mainId)
      const newSK = `shiki_${rootId}`
      setResolvedSK(newSK)
      const exLabels = existingSeriesKeys.get(newSK) || new Set()

      const related = await restRelated(mainId)
      const allIds = [mainId, ...related.map(r => r.shikiId)]
      const posters = await gqlPosters(allIds)

      const tvList = [], extraList = []

      const mainDet = await restDetails(mainId)
      if (mainDet) {
        const entry = { ...mainDet, poster: posters[mainId] || null }
        isOvaKind(mainDet.kind) ? extraList.push(entry) : tvList.push(entry)
      }

      for (const r of related) {
        const det = await restDetails(r.shikiId)
        if (!det) continue
        const entry = { ...det, poster: posters[r.shikiId] || null, _relation: r.relation }
        isOvaKind(det.kind) ? extraList.push(entry) : tvList.push(entry)
      }

      tvList.sort((a, b) => (a.year || 9999) - (b.year || 9999))
      extraList.sort((a, b) => (a.year || 9999) - (b.year || 9999))

      const tv = tvList.map((s, i) => ({ ...s, _label: `Сезон ${i + 1}`, _num: i + 1 }))
      const ov = {}
      const ex = extraList.map(s => {
        const k = (s.kind || '').toLowerCase()
        let label
        if (k === 'ova') { ov.ova = (ov.ova || 0) + 1; label = ov.ova > 1 ? `OVA ${ov.ova}` : 'OVA' }
        else if (k === 'movie') { ov.movie = (ov.movie || 0) + 1; label = ov.movie > 1 ? `Movie ${ov.movie}` : 'Movie' }
        else if (k === 'special') { ov.sp = (ov.sp || 0) + 1; label = ov.sp > 1 ? `Special ${ov.sp}` : 'Special' }
        else { ov.ex = (ov.ex || 0) + 1; label = ov.ex > 1 ? `Extra ${ov.ex}` : 'Extra' }
        return { ...s, _label: label, _num: null }
      })

      metaRef.current = { hasSequel: tv.length > 1, hasOva: ex.length > 0 }
      setTvSeasons(tv)
      setExtras(ex)

      // Если это фильм/OVA без TV-сезонов — автовыбираем и сразу раскрываем extras
      if (tv.length === 0 && ex.length > 0) {
        const firstEx = ex.find(s => !exLabels.has(s._label))
        if (firstEx) setSelected(new Set([`ex_${firstEx._label}`]))
        setShowOva(true)
      } else {
        const first = tv.find(s => !exLabels.has(s._label))
        if (first) setSelected(new Set([`tv_${first._num}`]))
      }
    } catch (e) {
      console.error(e)
      setTvSeasons([{ ...searchResult, _label: 'Сезон 1', _num: 1 }])
      if (!existingLabels.has('Сезон 1')) setSelected(new Set(['tv_1']))
    }
    setLoading(false)
  }

  const toggle = key => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const handleAdd = () => {
    const curSK = resolvedSK || makeSeriesKey(searchResult.title)
    const exLabels = existingSeriesKeys.get(curSK) || new Set()
    const items = []
    for (const s of tvSeasons) {
      if (!selected.has(`tv_${s._num}`) || exLabels.has(s._label)) continue
      const e = buildEntry(searchResult, s, s._num, s._label, curSK)
      e.hasSequel = metaRef.current.hasSequel
      e.hasOva = metaRef.current.hasOva
      items.push(e)
    }
    for (const s of extras) {
      if (!selected.has(`ex_${s._label}`) || exLabels.has(s._label)) continue
      items.push(buildEntry(searchResult, s, null, s._label, curSK))
    }
    if (items.length) onAdd(items)
    onClose()
  }

  const base = searchResult
  return (
    <div style={{position:'fixed',inset:0,zIndex:1100,background:'rgba(10,10,10,0.85)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={onClose}>
      <div style={{background:'#f0ede6',border:'3px solid #0a0a0a',width:'100%',maxWidth:500,maxHeight:'calc(100vh - 48px)',display:'flex',flexDirection:'column',boxShadow:'6px 6px 0 #0a0a0a'}} onClick={e => e.stopPropagation()}>
        <div style={{display:'flex',borderBottom:'3px solid #0a0a0a',flexShrink:0}}>
          {base.poster ? <img src={base.poster} style={{width:68,height:96,objectFit:'cover',objectPosition:'top',borderRight:'3px solid #0a0a0a',flexShrink:0}} /> : <div style={{width:68,height:96,background:'#e0ddd6',borderRight:'3px solid #0a0a0a',flexShrink:0}} />}
          <div style={{flex:1,padding:'12px 14px',minWidth:0}}>
            <div style={{fontFamily:"'Noto Sans JP'",fontSize:9,color:'#aaa',letterSpacing:'0.08em',marginBottom:3}}>ВЫБОР СЕЗОНОВ · シーズン選択</div>
            <div className="title-font" style={{fontSize:17,color:'#0a0a0a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{base.title}</div>
            <div style={{fontFamily:"'Space Grotesk'",fontSize:11,color:'#999',marginTop:3}}>{base.studio} · {base.year || '—'}</div>
          </div>
          <button onClick={onClose} style={{padding:'0 14px',background:'none',border:'none',borderLeft:'2px solid rgba(10,10,10,0.1)',fontFamily:"'Bangers', sans-serif",fontSize:22,cursor:'pointer',color:'#aaa'}}>✕</button>
        </div>

        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{padding:40,textAlign:'center'}}>
              <div style={{fontFamily:"'Bangers', sans-serif",fontSize:28,color:'#ccc',letterSpacing:'0.06em',marginBottom:6}}>読み込み中</div>
              <div style={{fontFamily:"'Space Grotesk'",fontSize:12,color:'#bbb'}}>Загружаем сезоны...</div>
            </div>
          ) : (
            <>
              {tvSeasons.length === 0 && <div style={{padding:'20px 16px',fontFamily:"'Space Grotesk'",fontSize:12,color:'#aaa'}}>Сезоны не найдены</div>}
              {tvSeasons.map(s => {
                const curSK = resolvedSK || makeSeriesKey(searchResult.title)
                const exLabels = existingSeriesKeys.get(curSK) || new Set()
                const added = exLabels.has(s._label)
                return <SeasonRow key={s.shikiId || s._num} s={s} label={s._label} selected={selected.has(`tv_${s._num}`)} added={added} onToggle={() => !added && toggle(`tv_${s._num}`)} />
              })}
              {extras.length > 0 && (
                <>
                  <div style={{borderTop:'1px solid rgba(10,10,10,0.08)',padding:'8px 16px'}}>
                    <button onClick={() => setShowOva(p => !p)} style={{fontFamily:"'Space Grotesk'",fontSize:11,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',background:'none',border:'1.5px solid rgba(10,10,10,0.15)',padding:'3px 10px',cursor:'pointer',color:'#888'}}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#0a0a0a'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(10,10,10,0.15)'}>
                      {showOva ? '▲' : '▼'} OVA / Special ({extras.length})
                    </button>
                  </div>
                  {showOva && extras.map(s => {
                    const curSK = resolvedSK || makeSeriesKey(searchResult.title)
                    const exLabels = existingSeriesKeys.get(curSK) || new Set()
                    const added = exLabels.has(s._label)
                    return <SeasonRow key={s.shikiId || s._label} s={s} label={s._label} selected={selected.has(`ex_${s._label}`)} added={added} onToggle={() => !added && toggle(`ex_${s._label}`)} isOva />
                  })}
                </>
              )}
            </>
          )}
        </div>

        {!loading && (
          <div style={{padding:14,borderTop:'3px solid #0a0a0a',flexShrink:0,display:'flex',gap:8}}>
            <button onClick={onClose} style={{padding:'10px 16px',background:'transparent',border:'2px solid #ddd',fontFamily:"'Space Grotesk'",fontSize:12,fontWeight:700,cursor:'pointer',color:'#aaa'}}>ОТМЕНА</button>
            <button onClick={handleAdd} disabled={selected.size === 0}
              style={{flex:1,padding:'10px',fontFamily:"'Bangers', sans-serif",fontSize:22,letterSpacing:'0.08em',background:selected.size > 0 ? '#0a0a0a' : '#ddd',color:selected.size > 0 ? '#f0ede6' : '#bbb',border:`3px solid ${selected.size > 0 ? '#0a0a0a' : '#ddd'}`,cursor:selected.size > 0 ? 'pointer' : 'default'}}
              onMouseEnter={e => { if (selected.size > 0) { e.currentTarget.style.background = '#d62828'; e.currentTarget.style.borderColor = '#d62828' } }}
              onMouseLeave={e => { if (selected.size > 0) { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.borderColor = '#0a0a0a' } }}>
              ДОБАВИТЬ {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SeasonRow({ s, label, selected, added, onToggle, isOva }) {
  const color = added ? '#166534' : isOva ? '#92400e' : '#1e40af'
  return (
    <div onClick={onToggle}
      style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderBottom:'1px solid rgba(10,10,10,0.06)',cursor:added ? 'default' : 'pointer',background:selected ? 'rgba(10,10,10,0.04)' : 'transparent',opacity:added ? 0.65 : 1}}
      onMouseEnter={e => { if (!added && !selected) e.currentTarget.style.background = 'rgba(10,10,10,0.02)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}>
      <div style={{width:18,height:18,border:`2.5px solid ${added ? '#166534' : selected ? '#0a0a0a' : '#ccc'}`,background:added ? '#166534' : selected ? '#0a0a0a' : 'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
        {(selected || added) && <span style={{color:'#f0ede6',fontSize:10,lineHeight:1}}>✓</span>}
      </div>
      {s.poster ? <img src={s.poster} style={{width:32,height:44,objectFit:'cover',border:'1.5px solid #0a0a0a',flexShrink:0}} /> : <div style={{width:32,height:44,background:'#e0ddd6',border:'1.5px solid rgba(10,10,10,0.15)',flexShrink:0}} />}
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
          <span style={{fontFamily:"'Bangers', sans-serif",fontSize:11,letterSpacing:'0.05em',background:color,color:'#fff',padding:'1px 6px'}}>{added ? '✓ ' : ''}{label}</span>
          {s.year && <span style={{fontFamily:"'Space Grotesk'",fontSize:10,color:'#aaa'}}>{s.year}</span>}
          {s.isOngoing && <span style={{fontFamily:"'Bangers', sans-serif",fontSize:9,background:'#d62828',color:'#fff',padding:'1px 5px',letterSpacing:'0.04em'}}>ОНГОИНГ</span>}
        </div>
        {s.titleRomaji && s.titleRomaji !== s.title && <div style={{fontFamily:"'Space Grotesk'",fontSize:10,color:'#aaa',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.titleRomaji}</div>}
      </div>
      <div style={{fontFamily:"'Bangers', sans-serif",fontSize:15,color:s.epTotal ? '#0a0a0a' : '#ccc',flexShrink:0}}>{s.epTotal ? `${s.epTotal}эп` : '?'}</div>
    </div>
  )
}

// ── SearchModal ───────────────────────────────────────────
function SearchModal({ onClose, onSelectResult }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50) }, [])

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try { setResults(await smartSearch(q.trim())) } catch { setResults([]) }
      setLoading(false)
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [q])

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(10,10,10,0.8)',backdropFilter:'blur(6px)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:72}} onClick={onClose}>
      <div style={{background:'#f0ede6',border:'3px solid #0a0a0a',width:'100%',maxWidth:580,maxHeight:'calc(100vh - 120px)',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'6px 6px 0 #0a0a0a'}} onClick={e => e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',borderBottom:'3px solid #0a0a0a',flexShrink:0}}>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Введите название аниме..."
            style={{flex:1,padding:'16px 20px',background:'transparent',border:'none',outline:'none',fontFamily:"'Space Grotesk',sans-serif",fontSize:16,color:'#0a0a0a'}} />
          {loading && <span style={{padding:'0 16px',fontFamily:"'Noto Sans JP'",fontSize:11,color:'#aaa'}}>検索中...</span>}
          <button onClick={onClose} style={{padding:'0 18px',height:54,background:'none',border:'none',borderLeft:'2px solid rgba(10,10,10,0.1)',fontFamily:"'Bangers', sans-serif",fontSize:22,cursor:'pointer',color:'#aaa'}}>✕</button>
        </div>
        <div style={{overflowY:'auto',flex:1}}>
          {q.trim().length >= 2 && !loading && results.length === 0 && <div style={{padding:48,textAlign:'center',fontFamily:"'Noto Sans JP'",fontSize:13,color:'#aaa'}}>Ничего не найдено</div>}
          {q.trim().length < 2 && <div style={{padding:48,textAlign:'center',fontFamily:"'Space Grotesk'",fontSize:13,color:'#bbb'}}>Введите минимум 2 символа</div>}
          {results.map((r, i) => (
            <div key={r.id}
              style={{display:'flex',gap:14,padding:'12px 16px',borderBottom:i < results.length - 1 ? '1px solid rgba(10,10,10,0.08)' : 'none',cursor:'pointer'}}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(10,10,10,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => { onSelectResult(r); onClose() }}>
              {r.poster ? <img src={r.poster} style={{width:44,height:62,objectFit:'cover',objectPosition:'top',border:'2px solid #0a0a0a',flexShrink:0}} /> : <div style={{width:44,height:62,background:'#e0ddd6',border:'2px solid #0a0a0a',flexShrink:0}} />}
              <div style={{flex:1,minWidth:0}}>
                <div className="title-font" style={{fontSize:18,marginBottom:2,color:'#0a0a0a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.title}</div>
                <div style={{fontFamily:"'Noto Sans JP'",fontSize:10,color:'#888',marginBottom:6,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.titleRomaji !== r.title ? r.titleRomaji : ''}{r.titleJp ? ` · ${r.titleJp}` : ''}</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{(r.genres || []).map(g => <span key={g} style={{fontSize:10,padding:'1px 6px',border:'1.5px solid rgba(10,10,10,0.15)',fontFamily:"'Space Grotesk'",color:'#666',fontWeight:700}}>{g}</span>)}</div>
              </div>
              <div style={{fontFamily:"'Space Grotesk'",fontSize:12,color:'#aaa',flexShrink:0,alignSelf:'center',textAlign:'right'}}>
                <div>{r.year || '—'}</div>
                <div>{r.epTotal ? `${r.epTotal} эп.` : '?'}</div>
                {r.isOngoing && <div style={{fontFamily:"'Bangers', sans-serif",fontSize:10,color:'#d62828',letterSpacing:'0.04em'}}>ОНГОИНГ</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── AlreadyInListDialog ───────────────────────────────────
function AlreadyInListDialog({ title, nextSeasonLabel, onConfirm, onPicker, onClose }) {
  return (
    <div style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(10,10,10,0.8)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={onClose}>
      <div style={{background:'#f0ede6',border:'3px solid #0a0a0a',maxWidth:360,width:'100%',boxShadow:'6px 6px 0 #0a0a0a',padding:24}} onClick={e => e.stopPropagation()}>
        <div style={{fontFamily:"'Bangers', sans-serif",fontSize:22,letterSpacing:'0.06em',color:'#0a0a0a',marginBottom:6}}>УЖЕ В СПИСКЕ</div>
        <div style={{fontFamily:"'Space Grotesk'",fontSize:13,color:'#666',marginBottom:20,lineHeight:1.6}}>
          <span style={{fontWeight:700,color:'#0a0a0a'}}>{title}</span> уже есть в списке.
          {nextSeasonLabel ? ` Добавить ${nextSeasonLabel}?` : ' Все доступные сезоны уже добавлены.'}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {nextSeasonLabel && (
            <button onClick={onConfirm} style={{padding:'10px',fontFamily:"'Bangers', sans-serif",fontSize:18,letterSpacing:'0.08em',background:'#0a0a0a',color:'#f0ede6',border:'3px solid #0a0a0a',cursor:'pointer'}}
              onMouseEnter={e => { e.currentTarget.style.background = '#d62828'; e.currentTarget.style.borderColor = '#d62828' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.borderColor = '#0a0a0a' }}>
              ДОБАВИТЬ {nextSeasonLabel.toUpperCase()}
            </button>
          )}
          <button onClick={onPicker} style={{padding:'10px',fontFamily:"'Space Grotesk'",fontSize:12,fontWeight:700,letterSpacing:'0.06em',background:'transparent',color:'#666',border:'2px solid #ddd',cursor:'pointer'}}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0a0a0a'; e.currentTarget.style.color = '#0a0a0a' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#666' }}>
            ВЫБРАТЬ СЕЗОНЫ ВРУЧНУЮ
          </button>
          <button onClick={onClose} style={{padding:'8px',fontFamily:"'Space Grotesk'",fontSize:11,fontWeight:700,background:'transparent',color:'#bbb',border:'none',cursor:'pointer'}}>ОТМЕНА</button>
        </div>
      </div>
    </div>
  )
}

// ── EditModal ─────────────────────────────────────────────
function EditModal({ entries, initialIdx, onClose, onSave, onDelete, onAddSeasonPicker, ongoingData, onUpdateEntry }) {
  const [activeIdx, setActiveIdx] = useState(initialIdx || 0)
  const [vals, setVals] = useState(() => Object.fromEntries(entries.map(e => [e.id, { score: e.score || 0, status: e.status || 'planned', ep: e.ep || 0 }])))
  const [linking, setLinking] = useState(false)

  const anime = entries[activeIdx]
  if (!anime) return null
  const v = vals[anime.id] || { score: 0, status: 'planned', ep: 0 }
  const setV = patch => setVals(prev => ({ ...prev, [anime.id]: { ...prev[anime.id], ...patch } }))

  const liveData = ongoingData?.[String(anime.shikiId)]
  const epAired = liveData?.epAired || anime.epAired || null
  const ongoing = liveData?.isOngoing || anime.isOngoing || false
  const epMax = ongoing ? (epAired || 9999) : (anime.epTotal || 9999)

  const saveAll = () => {
    for (const e of entries) {
      const ev = vals[e.id]
      if (ev) onSave({ ...e, score: ev.score || null, status: ev.status, ep: ev.ep })
    }
  }

  useEffect(() => {
    if (anime.shikiId || linking) return
    setLinking(true)
    ;(async () => {
      try {
        const found = await smartSearch(anime.title)
        const match = bestMatch(found, anime.title)
        if (match?.shikiId) {
          const [rootId, details, posters] = await Promise.all([
            resolveRootId(match.shikiId).catch(() => match.shikiId),
            restDetails(match.shikiId),
            gqlPosters([match.shikiId]),
          ])
          onUpdateEntry({
            ...anime,
            shikiId: match.shikiId,
            seriesKey: `shiki_${rootId}`,
            poster: posters[match.shikiId] || anime.poster,
            titleJp: details?.titleJp || anime.titleJp,
            epTotal: details?.epTotal || anime.epTotal,
            epAired: details?.epAired || anime.epAired,
            isOngoing: details?.isOngoing ?? anime.isOngoing,
            genres: details?.genres?.length ? details.genres : anime.genres,
            studio: details?.studio && details.studio !== '—' ? details.studio : anime.studio,
            year: details?.year || anime.year,
          })
        }
      } catch {}
      setLinking(false)
    })()
  }, [anime.id])

  const base = entries[0]
  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(10,10,10,0.8)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={() => { saveAll(); onClose() }}>
      <div style={{background:'#f0ede6',border:'3px solid #0a0a0a',width:'100%',maxWidth:440,maxHeight:'calc(100vh - 48px)',overflowY:'auto',boxShadow:'6px 6px 0 #0a0a0a'}} onClick={e => e.stopPropagation()}>
        <div style={{display:'flex',borderBottom:'3px solid #0a0a0a'}}>
          {base.poster ? <img src={base.poster} style={{width:80,height:112,objectFit:'cover',borderRight:'3px solid #0a0a0a',flexShrink:0}} /> : <div style={{width:80,height:112,background:'#e0ddd6',borderRight:'3px solid #0a0a0a',flexShrink:0}} />}
          <div style={{padding:'12px 14px',flex:1,minWidth:0}}>
            {linking && <div style={{fontFamily:"'Noto Sans JP'",fontSize:9,color:'#d62828',marginBottom:3}}>🔍 привязываем к Shikimori...</div>}
            <div style={{fontFamily:"'Noto Sans JP'",fontSize:10,color:'#888',marginBottom:3}}>{base.titleJp}</div>
            <div className="title-font" style={{fontSize:17,lineHeight:1.15,color:'#0a0a0a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{base.title}</div>
            <div style={{fontFamily:"'Space Grotesk'",fontSize:11,color:'#888',marginTop:3}}>{base.studio} · {base.year || '—'}</div>
          </div>
          <button onClick={() => { saveAll(); onClose() }} style={{padding:'0 14px',background:'none',border:'none',borderLeft:'2px solid rgba(10,10,10,0.1)',fontFamily:"'Bangers', sans-serif",fontSize:22,cursor:'pointer',color:'#aaa'}}>✕</button>
        </div>

        <div style={{display:'flex',borderBottom:'2px solid rgba(10,10,10,0.1)',overflowX:'auto',background:'rgba(10,10,10,0.02)'}}>
          {entries.map((e, i) => {
            const ev = vals[e.id] || {}
            const sc = STATUS_META[ev.status || e.status]?.color || '#aaa'
            return (
              <button key={e.id} onClick={() => setActiveIdx(i)}
                style={{padding:'6px 11px',background:'none',border:'none',borderBottom:`3px solid ${i === activeIdx ? sc : 'transparent'}`,fontFamily:"'Bangers', sans-serif",fontSize:11,letterSpacing:'0.04em',color:i === activeIdx ? '#0a0a0a' : '#aaa',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                <span style={{fontSize:12}}>{e.seasonLabel || `#${i + 1}`}</span>
                <div style={{display:'flex',alignItems:'center',gap:3}}>
                  <span style={{width:5,height:5,borderRadius:'50%',background:sc,display:'inline-block'}} />
                  {(ev.score || e.score) > 0 && <span style={{fontFamily:"'Space Grotesk'",fontSize:8,fontWeight:700,color:'#888'}}>{ev.score || e.score}/10</span>}
                  {e.epTotal && <span style={{fontFamily:"'Space Grotesk'",fontSize:8,color:'#aaa'}}>{ev.ep || e.ep}/{e.epTotal}</span>}
                </div>
              </button>
            )
          })}
          {entries.some(e => e.hasSequel) && (
            <button onClick={() => { saveAll(); onClose(); onAddSeasonPicker(base) }}
              style={{padding:'6px 10px',background:'none',border:'none',borderBottom:'3px solid transparent',fontFamily:"'Bangers', sans-serif",fontSize:14,color:'#ccc',cursor:'pointer',flexShrink:0,alignSelf:'center'}}
              title="Добавить сезон">+</button>
          )}
        </div>

        <div style={{padding:18,display:'flex',flexDirection:'column',gap:16}}>
          <div>
            <div style={{fontFamily:"'Space Grotesk'",fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#aaa',marginBottom:7}}>Статус</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <button key={key} onClick={() => {
                  const patch = { status: key }
                  if (key === 'completed') patch.ep = epMax < 9999 ? epMax : (anime.epTotal || v.ep)
                  if (key === 'planned') patch.ep = 0
                  setV(patch)
                }} style={{padding:'7px 10px',border:'2px solid',borderColor:v.status === key ? meta.color : '#ddd',background:v.status === key ? meta.color : 'transparent',color:v.status === key ? '#fff' : '#666',fontFamily:"'Space Grotesk'",fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontFamily:"'Noto Sans JP'",fontSize:9}}>{meta.jp}</span>{meta.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{fontFamily:"'Space Grotesk'",fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#aaa',marginBottom:7}}>
              Оценка {v.score > 0 ? `— ${v.score}/10` : '— не выставлена'}
            </div>
            <div style={{display:'flex',gap:3}}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setV({ score: v.score === n ? 0 : n })}
                  style={{flex:1,padding:'7px 0',background:v.score >= n ? '#0a0a0a' : 'transparent',border:'2px solid',borderColor:v.score >= n ? '#0a0a0a' : '#ddd',color:v.score >= n ? '#f0ede6' : '#aaa',fontFamily:"'Bangers', sans-serif",fontSize:13,cursor:'pointer'}}>{n}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{fontFamily:"'Space Grotesk'",fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#aaa',marginBottom:7}}>
              Прогресс {ongoing && epAired ? <span style={{textTransform:'none',fontWeight:400}}>(вышло {epAired} из {anime.epTotal || '?'})</span> : anime.epTotal ? <span style={{textTransform:'none',fontWeight:400}}>(всего {anime.epTotal})</span> : ''}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button onClick={() => setV({ ep: Math.max(0, v.ep - 1) })} style={{width:34,height:34,border:'2px solid #0a0a0a',background:'none',fontFamily:"'Bangers', sans-serif",fontSize:20,cursor:'pointer',color:'#0a0a0a'}}>−</button>
              <input type="number" value={v.ep} min={0} max={epMax} onChange={e => setV({ ep: Math.min(epMax, Math.max(0, Number(e.target.value))) })} style={{flex:1,padding:'7px',border:'2px solid #0a0a0a',fontFamily:"'Bangers', sans-serif",fontSize:20,textAlign:'center',background:'#fff',outline:'none',color:'#0a0a0a'}} />
              <button onClick={() => setV({ ep: Math.min(epMax, v.ep + 1) })} style={{width:34,height:34,border:'2px solid #0a0a0a',background:'none',fontFamily:"'Bangers', sans-serif",fontSize:20,cursor:'pointer',color:'#0a0a0a'}}>+</button>
              {epMax < 9999 && <button onClick={() => setV({ ep: epMax })} style={{padding:'0 10px',height:34,border:'2px solid #ddd',background:'none',fontFamily:"'Space Grotesk'",fontSize:11,fontWeight:700,cursor:'pointer',color:'#aaa',whiteSpace:'nowrap'}}>ВСЕ</button>}
            </div>
          </div>

          <div style={{display:'flex',gap:8,marginTop:2}}>
            <button onClick={() => { if (confirm(`Удалить «${anime.seasonLabel || anime.title}»?`)) { onDelete(anime.id); onClose() } }}
              style={{padding:'9px 12px',background:'transparent',color:'#bbb',border:'2px solid #ddd',fontFamily:"'Space Grotesk'",fontSize:12,fontWeight:700,cursor:'pointer'}}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#d62828'; e.currentTarget.style.color = '#d62828' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#bbb' }}>УДАЛИТЬ</button>
            <button onClick={() => { saveAll(); onClose() }}
              style={{flex:1,padding:'9px',background:'#0a0a0a',color:'#f0ede6',border:'3px solid #0a0a0a',fontFamily:"'Bangers', sans-serif",fontSize:20,letterSpacing:'0.08em',cursor:'pointer'}}
              onMouseEnter={e => { e.currentTarget.style.background = '#d62828'; e.currentTarget.style.borderColor = '#d62828'; e.currentTarget.style.transform = 'translate(-2px,-2px)'; e.currentTarget.style.boxShadow = '4px 4px 0 #0a0a0a' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.borderColor = '#0a0a0a'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>СОХРАНИТЬ</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ImportModal ───────────────────────────────────────────
function ImportModal({ onClose, onImport }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState([])
  const [done, setDone] = useState(false)

  function parseLines(raw) {
    const seen = new Set()
    return raw.split('\n').map(l => l.trim().replace(/^[*•\-–—]+\s*/, '')).filter(l => l.length > 1).map(l => {
      let score = null, status = null, season = null
      let s = l

      // Статус
      if (/\b(дроп|дропнул|дропнуто|drop|брошено|бросил)\b/i.test(s)) status = 'dropped'
      else if (/\b(смотрю|смотрит|watching|онгоинг)\b/i.test(s)) status = 'watching'
      else if (/\b(план|планирую|planned|хочу|буду)\b/i.test(s)) status = 'planned'

      // Оценка: формат (X/10) или X/10
      const scoreM = s.match(/\(?(\d{1,2})\/10\)?/)
      if (scoreM) {
        const n = parseInt(scoreM[1])
        if (n >= 1 && n <= 10) { score = n; s = s.replace(scoreM[0], '').trim() }
      }

      // Убираем пользовательские комментарии
      s = s.replace(/\s+выходит\s*[?)]*\s*$/i, '')                                   // "выходит)", "выходит?)"
      s = s.replace(/[,;]\s*(?:но |круто|очень |полуаниме|слабо |фильм\s*\)).*/i, '') // ", но оборван)", ", концовка ..."
      s = s.replace(/\s+(?:но это |полуаниме ).*/i, '')                               // "но это слабо тянет..."
      // Незакрытая скобка в конце
      if (/\)\s*$/.test(s) && (s.match(/\)/g) || []).length > (s.match(/\(/g) || []).length) {
        s = s.replace(/\s*\)\s*$/, '')
      }

      // Убираем круглые и квадратные скобки (с содержимым), «» — только символы
      s = s.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/[«»]/g, '').replace(/\s{2,}/g, ' ').trim()

      // Явный сезон: "3 сезон", "сезон 3", "S3"
      for (const p of [/\b(\d+)\s*(?:сезон|season)\b/i, /\bсезон\s*(\d+)\b/i, /\bs(\d+)\b/i]) {
        const m = s.match(p)
        if (m) { season = parseInt(m[1]); s = s.replace(m[0], ' ').trim(); break }
      }

      // Убираем "Часть N" в конце — это split сезона, запоминаем флаг
      const hadPart = /[\s.:\-–—]+Часть\s+(II|III|IV|V|2|3|4|5)\s*$/i.test(s)
      s = s.replace(/[\s.:\-–—]+Часть\s+(II|III|IV|V|\d+)\s*$/i, '').trim()

      // "Название N: Подзаголовок" → season=N, сохраняем "Название: Подзаголовок"
      // Но не трогаем если предыдущее слово — большое число (Моб Психо 100 3: ...)
      if (!season) {
        const m = s.match(/^(.+?)\s+(\d{1,2})\s*:\s*(.+)$/)
        if (m) {
          const base = m[1].trim(), num = parseInt(m[2]), sub = m[3].trim()
          const prevWord = base.match(/(\S+)\s*$/)
          const prevIsBig = prevWord && !isNaN(parseInt(prevWord[1])) && parseInt(prevWord[1]) > 12
          if (!prevIsBig && num <= 12) { season = num; s = base + ': ' + sub }
        }
      }

      // Убираем статусные слова
      s = s.replace(/\b(онгоинг|дропнул|смотрю|дропнуто|план|планирую|бросил|хочу|буду|watching|dropped|planned)\b/gi, ' ')

      // Число в конце = сезон
      if (!season) {
        const m = s.match(/\s+(\d{1,2})\s*$/)
        if (m) {
          const n = parseInt(m[1])
          if (n <= 12) {
            const before = s.slice(0, m.index).trim()
            const lastChar = s[m.index - 1] || ''
            const prevWord = before.match(/(\S+)$/)
            const prevIsBig = prevWord && !isNaN(parseInt(prevWord[1])) && parseInt(prevWord[1]) > 12
            if (/[а-яёА-ЯЁa-zA-Z!?»]/.test(lastChar) || prevIsBig) {
              season = n; s = before
            }
          }
        }
      }

      s = s.replace(/\s{2,}/g, ' ').replace(/[\s.,:;]+$/, '').trim()
      if (!s || s.length < 2) return null
      if (!status && score) status = 'completed'
      if (!status) status = 'completed'

      const key = s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '') + '_' + (season || 0)
      if (seen.has(key)) return null
      seen.add(key)
      return { title: s, score, season, status, hadPart }
    }).filter(x => x && x.title.length > 1)
  }

    async function runImport() {
    const lines = parseLines(text)
    if (!lines.length) return
    setLoading(true)
    setProgress(lines.map(l => ({ title: l.title, season: l.season, hadPart: l.hadPart, state: 'pending' })))
    const results = []

    // Кэши — одна серия = один запрос
    const rootCache = {}
    const chainCache = {}

    async function cachedRoot(shikiId) {
      if (rootCache[shikiId] !== undefined) return rootCache[shikiId]
      const r = await resolveRootId(shikiId).catch(() => shikiId)
      rootCache[shikiId] = r
      return r
    }

    async function buildChain(rootId) {
      if (chainCache[rootId]) return chainCache[rootId]
      const chain = [rootId]
      let cur = rootId
      for (let step = 0; step < 14; step++) {
        try {
          const rel = await restRelated(cur)
          const seq = rel.find(r => r.relation === 'Sequel' && !isOvaKind(r.kind))
          if (!seq) break
          chain.push(seq.shikiId)
          cur = seq.shikiId
        } catch { break }
      }
      chainCache[rootId] = chain
      return chain
    }

    // Общая обработка найденного матча → результат (0 API calls)
    function processMatch(i, line, match) {
      const { score, season, status: parsedStatus, hadPart } = line
      const isExtra = isOvaKind(match.kind)
      const sk = makeSeriesKey(match.title)
      let chainPos = 1
      let seasonLabel
      if (isExtra) {
        const k = (match.kind || '').toLowerCase()
        seasonLabel = k === 'movie' ? 'Movie' : k === 'ova' ? 'OVA' : 'Special'
        chainPos = null
      } else if (season && season >= 1) {
        chainPos = season
        seasonLabel = hadPart ? `Сезон ${season} Ч.2` : `Сезон ${season}`
      } else if (hadPart) {
        chainPos = 1
        seasonLabel = `Сезон 1 Ч.2`
      } else {
        seasonLabel = `Сезон 1`
      }
      const finalStatus = parsedStatus || (match.isOngoing ? 'watching' : 'completed')
      results.push({
        id: Date.now() + i + Math.random(),
        shikiId: match.shikiId, seriesKey: sk, title: match.title,
        titleJp: match.titleJp || '', titleRomaji: match.titleRomaji || '',
        season: chainPos, seasonLabel, kind: match.kind || 'tv', score,
        status: finalStatus,
        ep: finalStatus === 'completed' ? (match.epTotal || 0) : 0,
        epTotal: match.epTotal || null, epAired: match.epAired || null,
        isOngoing: match.isOngoing || false, genres: match.genres || [],
        poster: match.poster || null, year: match.year || null,
        studio: match.studio || '—', addedAt: Date.now() + i,
        hasSequel: true, hasOva: false,
      })
      setProgress(p => p.map((x, idx) => idx === i ? { ...x, state: 'found', found: match.title, season: chainPos } : x))
    }

    // ── Фаза 1: batch fetch известных тайтлов по ID (мгновенно) ──
    const knownLines = []
    const queryLines = []  // есть byQuery маппинг → быстрый поиск по англ. названию
    const unknownLines = []
    for (let i = 0; i < lines.length; i++) {
      const cachedId = getShikiIdByTitle(lines[i].title)
      if (cachedId) {
        knownLines.push({ idx: i, line: lines[i], shikiId: cachedId })
      } else {
        const engQuery = getRuSearchQuery(lines[i].title)
        if (engQuery) queryLines.push({ idx: i, line: lines[i], engQuery })
        else unknownLines.push({ idx: i, line: lines[i] })
      }
    }

    console.log(`[IMPORT] known: ${knownLines.length}, query: ${queryLines.length}, unknown: ${unknownLines.length}`)
    for (const k of knownLines.slice(0, 5)) console.log(`  [KNOWN] "${k.line.title}" → shikiId: ${k.shikiId}`)
    for (const u of unknownLines.slice(0, 5)) console.log(`  [UNKNOWN] "${u.line.title}"`)

    if (knownLines.length > 0) {
      const allIds = [...new Set(knownLines.map(k => k.shikiId))]
      console.log(`[IMPORT] gqlFetchByIds(${allIds.length} ids): ${allIds.slice(0, 5).join(',')}...`)
      const fetched = await gqlFetchByIds(allIds)
      console.log(`[IMPORT] fetched: ${fetched.length} items`)
      const byId = {}
      for (const item of fetched) byId[item.shikiId] = item

      // Все known items — мгновенно (0 API calls, всё из кэша)
      for (const { idx: i, line, shikiId } of knownLines) {
        const match = byId[shikiId]
        if (!match) {
          unknownLines.push({ idx: i, line })
          continue
        }
        try {
          processMatch(i, line, match)
        } catch {
          setProgress(p => p.map((x, idx) => idx === i ? { ...x, state: 'error' } : x))
        }
      }
    }

    // ── Фаза 1.5: быстрый поиск по английскому названию для byQuery items ──
    if (queryLines.length > 0) {
      const Q_BATCH = 5
      for (let qb = 0; qb < queryLines.length; qb += Q_BATCH) {
        const qBatch = queryLines.slice(qb, qb + Q_BATCH)
        setProgress(p => p.map((x, idx) =>
          qBatch.some(q => q.idx === idx) ? { ...x, state: 'searching' } : x
        ))
        await Promise.all(qBatch.map(async ({ idx: i, line, engQuery }) => {
          try {
            const found = await gqlSearch(engQuery)
            const match = bestMatch(found, line.title)
            if (!match || !match.shikiId) {
              unknownLines.push({ idx: i, line })
              setProgress(p => p.map((x, idx) => idx === i ? { ...x, state: 'pending' } : x))
              return
            }
            processMatch(i, line, match)
          } catch {
            unknownLines.push({ idx: i, line })
            setProgress(p => p.map((x, idx) => idx === i ? { ...x, state: 'pending' } : x))
          }
        }))
        if (qb + Q_BATCH < queryLines.length) await sleep(400)
      }
    }

    // ── Фаза 2: smartSearch для неизвестных тайтлов (медленный путь) ──
    unknownLines.sort((a, b) => a.idx - b.idx)
    const BATCH = 3
    for (let b = 0; b < unknownLines.length; b += BATCH) {
      const batch = unknownLines.slice(b, b + BATCH)

      setProgress(p => p.map((x, idx) =>
        batch.some(u => u.idx === idx) ? { ...x, state: 'searching' } : x
      ))

      await Promise.all(batch.map(async ({ idx: i, line }) => {
        try {
          const found = await smartSearch(line.title, { skipEnrich: true })
          const match = bestMatch(found, line.title)
          if (!match || !match.shikiId) {
            setProgress(p => p.map((x, idx) => idx === i ? { ...x, state: 'notfound' } : x))
            return
          }
          await processMatch(i, line, match)
        } catch {
          setProgress(p => p.map((x, idx) => idx === i ? { ...x, state: 'error' } : x))
        }
      }))

      // Пауза между батчами — даём API передохнуть
      if (b + BATCH < unknownLines.length) await sleep(400)
    }

    const seen = new Set()
    const deduped = results.filter(r => {
      const k = `${r.seriesKey}__${r.seasonLabel}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    onImport(deduped)
    setLoading(false)
    setDone(true)
  }

  const parsedCount = parseLines(text).length

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(10,10,10,0.8)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={!loading ? onClose : undefined}>
      <div style={{background:'#f0ede6',border:'3px solid #0a0a0a',width:'100%',maxWidth:520,maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'6px 6px 0 #0a0a0a'}} onClick={e => e.stopPropagation()}>
        <div style={{borderBottom:'3px solid #0a0a0a',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Bangers', sans-serif",fontSize:24,letterSpacing:'0.06em',color:'#0a0a0a'}}>ИМПОРТ ТЕКСТОМ</div>
            <div style={{fontFamily:"'Noto Sans JP'",fontSize:10,color:'#aaa',marginTop:2}}>テキストインポート</div>
          </div>
          {!loading && <button onClick={onClose} style={{background:'none',border:'none',fontFamily:"'Bangers', sans-serif",fontSize:22,cursor:'pointer',color:'#aaa'}}>✕</button>}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:14}}>
          {done ? (
            <div style={{textAlign:'center',padding:'40px 20px',display:'flex',flexDirection:'column',alignItems:'center',flex:1}}>
              <div style={{fontFamily:"'Bangers', sans-serif",fontSize:56,color:'#0a0a0a',marginBottom:12,letterSpacing:'0.04em'}}>完了!</div>
              <div style={{fontFamily:"'Space Grotesk'",fontSize:15,color:'#666',marginBottom:28}}>
                Добавлено {progress.filter(p => p.state === 'found').length} из {progress.length} аниме
              </div>
              <button onClick={onClose} style={{fontFamily:"'Bangers', sans-serif",fontSize:20,letterSpacing:'0.08em',padding:'10px 32px',background:'#0a0a0a',color:'#f0ede6',border:'3px solid #0a0a0a',cursor:'pointer'}}>ГОТОВО</button>
            </div>
          ) : !loading ? (
            <>
              <div style={{fontFamily:"'Space Grotesk'",fontSize:13,color:'#666',lineHeight:1.7,padding:'10px 14px',background:'rgba(10,10,10,0.04)',borderLeft:'3px solid #0a0a0a'}}>
                Каждая строка — одно аниме.<br />
                <span style={{color:'#0a0a0a',fontWeight:700}}>Атака титанов 3 сезон 9/10</span><br />
                <span style={{color:'#0a0a0a',fontWeight:700}}>Тетрадь смерти — 9/10</span><br />
                <span style={{color:'#666',fontSize:12}}>Теги: <b>дроп</b>, <b>смотрю</b>, <b>план</b></span>
              </div>
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder={'Атака титанов 3 сезон 9/10\nТетрадь смерти — 9/10\nФрирен\nВинланд сага смотрю'}
                style={{width:'100%',height:160,padding:12,background:'#fff',border:'2px solid #0a0a0a',fontFamily:"'Space Grotesk',sans-serif",fontSize:14,resize:'vertical',outline:'none',color:'#0a0a0a',lineHeight:1.8}}
                autoFocus />
              {parsedCount > 0 && <div style={{fontFamily:"'Space Grotesk'",fontSize:11,color:'#aaa'}}>Распознано {parsedCount} строк · ~{Math.ceil(parsedCount * 0.5 / 60)} мин</div>}
              <button onClick={runImport} disabled={!text.trim()}
                style={{width:'100%',padding:'12px',fontFamily:"'Bangers', sans-serif",fontSize:22,letterSpacing:'0.08em',background:text.trim() ? '#0a0a0a' : '#ddd',color:text.trim() ? '#f0ede6' : '#bbb',border:`3px solid ${text.trim() ? '#0a0a0a' : '#ddd'}`,cursor:text.trim() ? 'pointer' : 'default'}}
                onMouseEnter={e => { if (text.trim()) { e.currentTarget.style.background = '#d62828'; e.currentTarget.style.borderColor = '#d62828' } }}
                onMouseLeave={e => { if (text.trim()) { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.borderColor = '#0a0a0a' } }}>
                НАЙТИ И ДОБАВИТЬ ({parsedCount})
              </button>
            </>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <div style={{fontFamily:"'Space Grotesk'",fontSize:12,fontWeight:700,color:'#aaa',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8,display:'flex',justifyContent:'space-between'}}>
                <span>Поиск... {progress.filter(p => ['found','notfound','error'].includes(p.state)).length}/{progress.length}</span>
                <span style={{fontWeight:400,textTransform:'none'}}>~{Math.ceil(progress.filter(p => ['pending','searching'].includes(p.state)).length * 0.5 / 60)} мин осталось</span>
              </div>
              {progress.map((p, i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'4px 0',borderBottom:'1px solid rgba(10,10,10,0.05)'}}>
                  <span style={{fontSize:12,flexShrink:0,width:16,textAlign:'center'}}>{p.state === 'searching' ? '⏳' : p.state === 'found' ? '✓' : p.state === 'pending' ? '·' : '✗'}</span>
                  <span style={{fontFamily:"'Space Grotesk'",fontSize:12,color:p.state === 'found' ? '#0a0a0a' : p.state === 'notfound' || p.state === 'error' ? '#bbb' : '#666',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.title}{p.season > 1 && p.hadPart ? ` (С${p.season} Ч.2)` : p.season > 1 ? ` (С${p.season})` : p.hadPart ? ' (Ч.2)' : ''}</span>
                  {p.state === 'found' && p.found !== p.title && <span style={{fontFamily:"'Noto Sans JP'",fontSize:9,color:'#bbb',flexShrink:0}}>→ {p.found}</span>}
                  {p.state === 'notfound' && <span style={{fontFamily:"'Space Grotesk'",fontSize:10,color:'#d62828',flexShrink:0}}>не найдено</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── AnimeGroup ────────────────────────────────────────────
function AnimeGroup({ entries, onEdit, onQuickAddNextSeason, formatCountdown, getLiveEpAired, isOngoing }) {
  const [expanded, setExpanded] = useState(false)
  const base = entries[0]
  const multi = entries.length > 1

  const allCompleted = entries.every(a => a.status === 'completed')
  const anyWatching = entries.some(a => a.status === 'watching')
  const summaryStatus = allCompleted ? 'completed' : anyWatching ? 'watching' : entries[0].status
  const summaryMeta = STATUS_META[summaryStatus]
  const avgScore = (() => { const sc = entries.filter(a => a.score); return sc.length ? Math.round(sc.reduce((s, a) => s + a.score, 0) / sc.length * 10) / 10 : null })()
  const totalEp = entries.reduce((s, a) => s + (a.ep || 0), 0)
  const totalEpMax = entries.every(a => a.epTotal) ? entries.reduce((s, a) => s + (a.epTotal || 0), 0) : null

  const tvEntries = entries.filter(e => !isOvaKind(e.kind))
  const nextSeasonNum = tvEntries.length + 1
  const lastTv = tvEntries[tvEntries.length - 1] || base
  const showNextBtn = lastTv?.hasSequel === true

  if (!multi) {
    const anime = entries[0]
    const meta = STATUS_META[anime.status]
    const liveAired = getLiveEpAired(anime)
    const ong = isOngoing(anime)
    const progressMax = ong ? liveAired : anime.epTotal
    const progress = progressMax ? Math.min((anime.ep / progressMax) * 100, 100) : null
    const cd = formatCountdown(anime.shikiId)

    return (
      <div className="anime-row" onClick={() => onEdit(entries, 0)}>
        <div className="poster-wrap">
          {anime.poster ? <img className="poster-img" src={anime.poster} alt={anime.title} loading="lazy" /> : <div style={{width:60,height:86,background:'#e0ddd6',display:'flex',alignItems:'center',justifyContent:'center',color:'#ccc',fontSize:20}}>?</div>}
        </div>
        <div style={{flex:1,padding:'14px 16px',minWidth:0,overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3,flexWrap:'nowrap'}}>
            <div className="title-font" style={{fontSize:20,color:'#0a0a0a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>{anime.title}</div>
            {anime.seasonLabel && anime.seasonLabel !== 'Сезон 1' && <span style={{fontFamily:"'Bangers', sans-serif",fontSize:10,background:'#0a0a0a',color:'#f0ede6',padding:'1px 6px',flexShrink:0,letterSpacing:'0.04em'}}>{anime.seasonLabel}</span>}
            {ong && <span style={{fontFamily:"'Bangers', sans-serif",fontSize:9,letterSpacing:'0.06em',background:'#d62828',color:'#fff',padding:'1px 6px',flexShrink:0}}>ОНГОИНГ</span>}
            {showNextBtn && <button className="next-season-btn" onClick={e => { e.stopPropagation(); onQuickAddNextSeason(base, nextSeasonNum) }}>+ С{nextSeasonNum}</button>}
          </div>
          <div style={{fontFamily:"'Noto Sans JP'",fontSize:10,color:'#999',marginBottom:7,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{anime.titleJp && anime.titleJp !== anime.title ? `${anime.titleJp} · ` : ''}{anime.studio}{anime.year ? ` · ${anime.year}` : ''}</div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{(anime.genres || []).slice(0, 3).map(g => <span key={g} style={{fontSize:10,fontWeight:700,padding:'2px 7px',border:'1.5px solid rgba(10,10,10,0.14)',color:'#777',fontFamily:"'Space Grotesk'"}}>{g}</span>)}</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',justifyContent:'center',gap:6,padding:'12px 16px',flexShrink:0,minWidth:140}}>
          <div style={{lineHeight:1,color:anime.score ? '#0a0a0a' : '#ccc',display:'flex',alignItems:'baseline'}}>
            <span style={{fontFamily:"'Bangers', sans-serif",fontSize:30,letterSpacing:'0.04em'}}>{anime.score || '—'}</span>
            {anime.score && <span style={{fontFamily:"'Space Grotesk'",fontSize:10,fontWeight:700,color:'#bbb',marginLeft:2}}>/10</span>}
          </div>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',padding:'2px 8px',border:`2px solid ${meta.color}`,color:meta.color,display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}>
            <span style={{fontFamily:"'Noto Sans JP'",fontSize:8}}>{meta.jp}</span>{meta.label}
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
            {progress !== null && <div style={{width:80,height:3,background:'rgba(10,10,10,0.1)'}}><div style={{height:'100%',background:progress === 100 ? '#166534' : '#0a0a0a',width:`${progress}%`,transition:'width 0.4s'}} /></div>}
            <span style={{fontFamily:"'Space Grotesk'",fontSize:11,color:'#999',fontWeight:600}}>{anime.ep}{ong && liveAired ? `/${liveAired} из ${anime.epTotal || '?'}` : anime.epTotal ? `/${anime.epTotal}` : ''} эп.</span>
            {anime.status === 'watching' && cd && <span style={{fontFamily:"'Space Grotesk'",fontSize:10,fontWeight:700,color:cd === 'скоро!' ? '#d62828' : '#1e40af',letterSpacing:'0.04em'}}>⏱ {cd}</span>}
          </div>
        </div>
        <button className="pencil-btn" onClick={e => { e.stopPropagation(); onEdit(entries, 0) }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><path d="M11 2 L14 5 L5 14 L2 14 L2 11 Z" /><path d="M9 4 L12 7" /></svg>
        </button>
      </div>
    )
  }

  return (
    <div style={{borderBottom:'2px solid rgba(10,10,10,0.08)'}}>
      <div className="anime-row" style={{borderBottom:expanded ? '1px solid rgba(10,10,10,0.08)' : 'none',background:expanded ? 'rgba(10,10,10,0.02)' : 'transparent'}} onClick={() => setExpanded(!expanded)}>
        <div className="poster-wrap">
          {base.poster ? <img className="poster-img" src={base.poster} alt={base.title} loading="lazy" /> : <div style={{width:60,height:86,background:'#e0ddd6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,color:'#ccc'}}>?</div>}
        </div>
        <div style={{flex:1,padding:'14px 16px',minWidth:0,overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3,flexWrap:'wrap'}}>
            <div className="title-font" style={{fontSize:20,color:'#0a0a0a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{base.title}</div>
            {entries.map(e => <span key={e.id} style={{fontFamily:"'Bangers', sans-serif",fontSize:9,letterSpacing:'0.04em',background:STATUS_META[e.status].color,color:'#fff',padding:'1px 5px',flexShrink:0}}>{e.seasonLabel || `С${e.season || 1}`}</span>)}
            {showNextBtn && <button className="next-season-btn" onClick={e => { e.stopPropagation(); onQuickAddNextSeason(base, nextSeasonNum) }}>+ С{nextSeasonNum}</button>}
          </div>
          <div style={{fontFamily:"'Noto Sans JP'",fontSize:10,color:'#999',marginBottom:7,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{base.titleJp && base.titleJp !== base.title ? `${base.titleJp} · ` : ''}{base.studio}{base.year ? ` · ${base.year}` : ''}</div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{(base.genres || []).slice(0, 3).map(g => <span key={g} style={{fontSize:10,fontWeight:700,padding:'2px 7px',border:'1.5px solid rgba(10,10,10,0.14)',color:'#777',fontFamily:"'Space Grotesk'"}}>{g}</span>)}</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',justifyContent:'center',gap:6,padding:'12px 16px',flexShrink:0,minWidth:140}}>
          <div style={{lineHeight:1,color:avgScore ? '#0a0a0a' : '#ccc',display:'flex',alignItems:'baseline'}}>
            <span style={{fontFamily:"'Bangers', sans-serif",fontSize:30,letterSpacing:'0.04em'}}>{avgScore || '—'}</span>
            {avgScore && <span style={{fontFamily:"'Space Grotesk'",fontSize:10,fontWeight:700,color:'#bbb',marginLeft:2}}>/10</span>}
          </div>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',padding:'2px 8px',border:`2px solid ${summaryMeta.color}`,color:summaryMeta.color,display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}>
            <span style={{fontFamily:"'Noto Sans JP'",fontSize:8}}>{summaryMeta.jp}</span>{summaryMeta.label}
          </div>
          <span style={{fontFamily:"'Space Grotesk'",fontSize:11,color:'#999',fontWeight:600}}>{totalEp}{totalEpMax ? `/${totalEpMax}` : ''} эп. · {entries.length} зап.</span>
        </div>
        <button style={{background:'none',border:'none',cursor:'pointer',padding:'6px 10px',flexShrink:0,alignSelf:'center',fontFamily:"'Bangers', sans-serif",fontSize:16,color:'#aaa'}} onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}>{expanded ? '▲' : '▼'}</button>
      </div>

      {expanded && (
        <div style={{background:'rgba(10,10,10,0.015)'}}>
          {entries.map((anime, si) => {
            const meta = STATUS_META[anime.status]
            const liveAired = getLiveEpAired(anime)
            const ong = isOngoing(anime)
            const progressMax = ong ? liveAired : anime.epTotal
            const progress = progressMax ? Math.min((anime.ep / progressMax) * 100, 100) : null
            const cd = anime.status === 'watching' ? formatCountdown(anime.shikiId) : null
            const k = (anime.kind || '').toLowerCase()
            const labelColor = k === 'ova' || k === 'ona' ? '#92400e' : k === 'special' || k === 'movie' ? '#166534' : '#1e40af'
            return (
              <div key={anime.id}
                style={{display:'flex',alignItems:'center',padding:'9px 16px 9px 76px',borderBottom:si < entries.length - 1 ? '1px solid rgba(10,10,10,0.05)' : 'none',cursor:'pointer'}}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(10,10,10,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => onEdit(entries, si)}>
                <div style={{fontFamily:"'Bangers', sans-serif",fontSize:11,letterSpacing:'0.05em',background:labelColor,color:'#fff',padding:'2px 7px',marginRight:12,flexShrink:0}}>{anime.seasonLabel || `Сезон ${anime.season || si + 1}`}</div>
                {ong && <span style={{fontFamily:"'Bangers', sans-serif",fontSize:9,background:'#d62828',color:'#fff',padding:'1px 5px',marginRight:8,flexShrink:0,letterSpacing:'0.04em'}}>ОНГОИНГ</span>}
                <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',padding:'2px 7px',border:`2px solid ${meta.color}`,color:meta.color,marginRight:12,flexShrink:0,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:3}}>
                  <span style={{fontFamily:"'Noto Sans JP'",fontSize:8}}>{meta.jp}</span>{meta.label}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  {progress !== null && <div style={{width:'100%',maxWidth:100,height:3,background:'rgba(10,10,10,0.1)',marginBottom:3}}><div style={{height:'100%',background:progress === 100 ? '#166534' : '#0a0a0a',width:`${progress}%`}} /></div>}
                  <span style={{fontFamily:"'Space Grotesk'",fontSize:11,color:'#999',fontWeight:600}}>{anime.ep}{ong && liveAired ? `/${liveAired} из ${anime.epTotal || '?'}` : anime.epTotal ? `/${anime.epTotal}` : ''} эп.</span>
                  {cd && <div style={{fontFamily:"'Space Grotesk'",fontSize:10,fontWeight:700,color:cd === 'скоро!' ? '#d62828' : '#1e40af',marginTop:2}}>⏱ {cd}</div>}
                </div>
                <div style={{fontFamily:"'Bangers', sans-serif",fontSize:20,color:anime.score ? '#0a0a0a' : '#ddd',marginRight:10,flexShrink:0}}>{anime.score ? `${anime.score}/10` : '—'}</div>
                <button className="pencil-btn" style={{opacity:1,position:'static'}} onClick={e => { e.stopPropagation(); onEdit(entries, si) }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><path d="M11 2 L14 5 L5 14 L2 14 L2 11 Z" /><path d="M9 4 L12 7" /></svg>
                </button>
              </div>
            )
          })}
          <div style={{padding:'8px 16px 8px 76px'}}>
            {showNextBtn && (
              <button onClick={() => onQuickAddNextSeason(base, nextSeasonNum)}
                style={{fontFamily:"'Bangers', sans-serif",fontSize:12,letterSpacing:'0.06em',padding:'5px 14px',background:'transparent',color:'#aaa',border:'2px dashed #ddd',cursor:'pointer'}}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0a0a0a'; e.currentTarget.style.color = '#0a0a0a' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#aaa' }}>
                + ДОБАВИТЬ СЕЗОН {nextSeasonNum}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────
export default function Tracker({ navigate }) {
  const [animeList, setAnimeList] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
  })
  const [activeTab, setActiveTab] = useState('all')
  const [showSearch, setShowSearch] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editGroup, setEditGroup] = useState(null)
  const [seasonPicker, setSeasonPicker] = useState(null)
  const [alreadyDialog, setAlreadyDialog] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [sortBy, setSortBy] = useState('added')
  const [listSearch, setListSearch] = useState('')
  const [ongoingData, setOngoingData] = useState({})
  const [now, setNow] = useState(Date.now())

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(animeList)) } catch {} }, [animeList])
  useEffect(() => { const h = () => setScrolled(window.scrollY > 10); window.addEventListener('scroll', h, { passive: true }); return () => window.removeEventListener('scroll', h) }, [])
  useEffect(() => { const h = e => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  // Миграция: обновить жанры для всех аниме из Shikimori (однократно)
  useEffect(() => {
    const GENRE_MIG_KEY = 'anitrack_genre_migrated_v2'
    if (localStorage.getItem(GENRE_MIG_KEY)) return
    const ids = animeList.filter(a => a.shikiId).map(a => a.shikiId)
    if (!ids.length) return
    ;(async () => {
      const byId = {}
      for (let i = 0; i < ids.length; i += 50) {
        try {
          const batch = ids.slice(i, i + 50)
          const res = await shikiFetchLocal(SHIKI_GQL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: GQL_BY_IDS_FULL_Q, variables: { ids: batch.join(',') } }),
          })
          const data = await res.json()
          for (const a of (data.data?.animes || [])) byId[String(a.id)] = pickGenres(a.genres)
        } catch {}
        if (i + 50 < ids.length) await sleep(400)
      }
      setAnimeList(prev => {
        const updated = prev.map(a => {
          if (!a.shikiId || !byId[a.shikiId]) return a
          return { ...a, genres: byId[a.shikiId] }
        })
        return updated
      })
      localStorage.setItem(GENRE_MIG_KEY, '1')
    })()
  }, [])

  useEffect(() => {
    const watching = animeList.filter(a => a.status === 'watching' && a.shikiId)
    if (!watching.length) return
    Promise.allSettled(
      watching.map(a => restDetails(a.shikiId).then(d => d ? {
        id: String(d.shikiId),
        nextEpisodeAt: d.nextEpisodeAt ? new Date(d.nextEpisodeAt).getTime() : null,
        epAired: d.epAired,
        isOngoing: d.isOngoing,
      } : null))
    ).then(results => {
      const map = {}
      for (const r of results) if (r.status === 'fulfilled' && r.value?.id) map[r.value.id] = r.value
      setOngoingData(map)
    })
  }, [animeList.filter(a => a.status === 'watching').map(a => a.shikiId).sort().join(',')])

  const existingSeriesKeys = new Map()
  for (const a of animeList) {
    const k = a.seriesKey || makeSeriesKey(a.title || '')
    if (!existingSeriesKeys.has(k)) existingSeriesKeys.set(k, new Set())
    existingSeriesKeys.get(k).add(a.seasonLabel || `Сезон ${a.season || 1}`)
  }

  const addItems = items => setAnimeList(prev => {
    const toAdd = items.filter(item => {
      const ex = existingSeriesKeys.get(item.seriesKey)
      return !ex || !ex.has(item.seasonLabel || `Сезон ${item.season || 1}`)
    })
    return [...toAdd.map(a => ({ ...a, addedAt: Date.now() })), ...prev]
  })

  const updateEntry = updated => setAnimeList(prev => prev.map(a => a.id === updated.id ? updated : a))
  const saveAnime = updated => setAnimeList(prev => prev.map(a => a.id === updated.id ? updated : a))
  const deleteAnime = id => setAnimeList(prev => prev.filter(a => a.id !== id))
  const resetList = () => { if (confirm('Сбросить весь список?')) setAnimeList([]) }

  const importAnime = items => setAnimeList(prev => {
    const ex = new Set(prev.map(a => `${a.seriesKey}__${a.seasonLabel || `Сезон ${a.season || 1}`}`))
    return [...items.filter(a => !ex.has(`${a.seriesKey}__${a.seasonLabel || `Сезон ${a.season || 1}`}`)), ...prev]
  })

  const exportList = () => {
    const lines = animeList.map(a => `${a.title}${a.season > 1 ? ` ${a.season} сезон` : ''}${a.score ? ` ${a.score}/10` : ''}`)
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url; el.download = 'anitrack_export.txt'; el.click()
    URL.revokeObjectURL(url)
  }

  const handleSelectResult = async r => {
    let rootId = r.shikiId ? await resolveRootId(r.shikiId).catch(() => r.shikiId) : null
    const sk = rootId ? `shiki_${rootId}` : makeSeriesKey(r.title)
    const existing = existingSeriesKeys.get(sk)

    // Фильм/OVA/Special — добавляем сразу без диалога выбора сезонов
    if (isOvaKind(r.kind)) {
      if (existing?.has(r.kind === 'movie' ? 'Movie' : r.kind === 'ova' ? 'OVA' : 'Special')) {
        // Уже добавлен — открываем picker чтобы пользователь видел
        setSeasonPicker(r)
        return
      }
      const label = r.kind === 'movie' ? 'Movie' : r.kind === 'ova' ? 'OVA' : 'Special'
      addItems([{
        id: Date.now() + Math.random(),
        shikiId: r.shikiId,
        seriesKey: sk,
        title: r.title,
        titleJp: r.titleJp || '',
        titleRomaji: r.titleRomaji || '',
        season: null,
        seasonLabel: label,
        kind: r.kind || 'movie',
        score: null,
        status: 'planned',
        ep: 0,
        epTotal: r.epTotal || null,
        genres: r.genres || [],
        poster: r.poster || null,
        year: r.year || null,
        studio: r.studio || '—',
        addedAt: Date.now(),
        hasSequel: false,
        hasOva: false,
      }])
      return
    }

    if (existing?.size > 0) {
      const tvLabels = [...existing].filter(l => l.startsWith('Сезон'))
      const nextNum = tvLabels.length + 1
      const nextLabel = `Сезон ${nextNum}`
      const alreadyHasNext = existing.has(nextLabel)
      let nextExists = false
      if (!alreadyHasNext && r.shikiId) {
        try {
          const rel = await restRelated(r.shikiId)
          nextExists = rel.some(x => x.relation === 'Sequel' && !isOvaKind(x.kind))
        } catch {}
      }
      if (alreadyHasNext || !nextExists) {
        setSeasonPicker(r)
        return
      }
      setAlreadyDialog({ searchResult: r, nextSeasonLabel: nextLabel, nextSeasonNum: nextNum })
      return
    }
    setSeasonPicker(r)
  }

  const handleQuickAddNextSeason = async (baseAnime, nextSeasonNum) => {
    if (!baseAnime.hasSequel) return
    const nextLabel = `Сезон ${nextSeasonNum}`
    if ((existingSeriesKeys.get(baseAnime.seriesKey) || new Set()).has(nextLabel)) return

    // Без shikiId не добавляем — не знаем что идёт следующим
    if (!baseAnime.shikiId) return

    try {
      // Берём последний TV-сезон этой серии чтобы найти его Sequel
      const seriesEntries = animeList
        .filter(a => a.seriesKey === baseAnime.seriesKey && !isOvaKind(a.kind) && a.shikiId)
        .sort((a, b) => (a.season || 0) - (b.season || 0))
      const lastEntry = seriesEntries[seriesEntries.length - 1] || baseAnime

      const rel = await restRelated(lastEntry.shikiId)
      const seq = rel.find(r => r.relation === 'Sequel' && !isOvaKind(r.kind))

      if (!seq) {
        // Реального сиквела нет — убираем кнопку
        setAnimeList(prev => prev.map(a =>
          a.shikiId === lastEntry.shikiId ? { ...a, hasSequel: false } : a
        ))
        return
      }

      const [nextRel, posters] = await Promise.all([
        restRelated(seq.shikiId),
        gqlPosters([seq.shikiId])
      ])
      const newHasSequel = nextRel.some(x => x.relation === 'Sequel' && !isOvaKind(x.kind))
      addItems([{
        ...baseAnime,
        id: Date.now(),
        shikiId: seq.shikiId,
        poster: posters[seq.shikiId] || null,
        season: nextSeasonNum,
        seasonLabel: nextLabel,
        kind: seq.kind || 'tv',
        score: null,
        status: 'planned',
        ep: 0,
        epTotal: null,
        addedAt: Date.now(),
        hasSequel: newHasSequel,
      }])
    } catch {}
  }

  const formatCountdown = shikiId => {
    const d = ongoingData[String(shikiId)]
    if (!d?.nextEpisodeAt) return null
    const diff = d.nextEpisodeAt - now
    if (diff <= 0) return 'скоро!'
    const days = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return days > 0 ? `${days}д ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const getLiveEpAired = anime => ongoingData[String(anime.shikiId)]?.epAired || anime.epAired || anime.epTotal || null
  const isOngoing = anime => ongoingData[String(anime.shikiId)]?.isOngoing || anime.isOngoing || false

  const filtered = animeList.filter(a => {
    const matchTab = activeTab === 'all' || a.status === activeTab
    if (!listSearch.trim()) return matchTab
    const q = listSearch.toLowerCase()
    return matchTab && (a.title?.toLowerCase().includes(q) || a.titleRomaji?.toLowerCase().includes(q) || a.titleJp?.toLowerCase().includes(q))
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'score') return (b.score || 0) - (a.score || 0)
    if (sortBy === 'title') return a.title.localeCompare(b.title, 'ru')
    return (b.addedAt || b.id) - (a.addedAt || a.id)
  })

  const groups = (() => {
    const seen = new Map(); const result = []
    for (const anime of sorted) {
      const key = anime.seriesKey || makeSeriesKey(anime.title || '')
      if (seen.has(key)) result[seen.get(key)].push(anime)
      else { seen.set(key, result.length); result.push([anime]) }
    }
    for (const g of result) g.sort((a, b) => (a.season || 0) - (b.season || 0))
    return result
  })()

  const counts = Object.fromEntries(Object.keys(STATUS_META).map(k => [k, animeList.filter(a => a.status === k).length]))

  return (
    <div style={{background:'#f0ede6',minHeight:'100vh'}}>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:#d62828;color:#fff}
        body{background:#f0ede6!important}
        .title-font{font-family:'Noto Sans',sans-serif;font-weight:900;font-style:italic;letter-spacing:0.01em;line-height:1.1}
        .ht::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:9998;opacity:0.03;background-image:radial-gradient(circle,#000 1px,transparent 1px);background-size:5px 5px}
        .tnav{position:fixed;top:0;left:0;right:0;z-index:500;background:#f0ede6;border-bottom:3px solid #0a0a0a}
        .tnav.sc{box-shadow:0 3px 0 rgba(10,10,10,0.12)}
        .search-input{flex:1;padding:0 20px;background:transparent;border:none;outline:none;font-family:'Space Grotesk',sans-serif;font-size:15px;color:#0a0a0a}
        .search-input::placeholder{color:#bbb}
        .tab-btn{display:flex;align-items:center;gap:5px;padding:0 14px;height:100%;background:none;border:none;border-bottom:3px solid transparent;font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;cursor:pointer;color:#888;transition:all 0.15s;white-space:nowrap;margin-bottom:-3px}
        .tab-btn:hover{color:#0a0a0a}
        .tab-btn.act{color:#0a0a0a;border-bottom-color:#d62828}
        .tc{font-family:'Bangers', sans-serif;font-size:13px;padding:1px 5px;background:rgba(10,10,10,0.08);border-radius:2px;color:#666}
        .tab-btn.act .tc{background:#d62828;color:#fff}
        .sort-btn{font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:4px 10px;background:none;border:1.5px solid transparent;cursor:pointer;color:#bbb;transition:all 0.1s}
        .sort-btn:hover{color:#0a0a0a}
        .sort-btn.act{color:#0a0a0a;border-color:rgba(10,10,10,0.2)}
        .anime-row{display:flex;align-items:stretch;border-bottom:2px solid rgba(10,10,10,0.08);cursor:pointer;transition:background 0.1s;position:relative}
        .anime-row:hover{background:rgba(10,10,10,0.025)}
        .anime-row:hover .pencil-btn{opacity:1}
        .anime-row:hover .next-season-btn{opacity:1}
        .anime-row:hover .poster-img{transform:scale(1.05)}
        .poster-wrap{width:60px;flex-shrink:0;border-right:2px solid rgba(10,10,10,0.08);overflow:hidden}
        .poster-img{width:60px;height:86px;object-fit:cover;object-position:center top;display:block;transition:transform 0.35s}
        .pencil-btn{opacity:0;background:none;border:2px solid transparent;cursor:pointer;color:#aaa;padding:6px 8px;flex-shrink:0;align-self:center;line-height:0;transition:all 0.12s}
        .pencil-btn:hover{color:#0a0a0a;border-color:rgba(10,10,10,0.2)}
        .next-season-btn{opacity:0;font-family:'Bangers', sans-serif;font-size:10px;letter-spacing:0.06em;background:rgba(10,10,10,0.07);border:1.5px solid rgba(10,10,10,0.15);color:#666;padding:2px 7px;cursor:pointer;transition:all 0.12s;white-space:nowrap;flex-shrink:0;line-height:1.6}
        .next-season-btn:hover{background:#0a0a0a;border-color:#0a0a0a;color:#f0ede6}
        @keyframes rowIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
        .anime-row{animation:rowIn 0.2s ease forwards}
      `}</style>
      <div className="ht" />

      <NavBar active="tracker" onNavigate={navigate} rightContent={<>
        <span style={{fontFamily:"'Noto Sans JP'",fontSize:11,color:'#999'}}>{animeList.length} アニメ</span>
        {animeList.length > 0 && <button onClick={resetList} style={{fontFamily:"'Space Grotesk'",fontSize:10,fontWeight:700,letterSpacing:'0.06em',background:'none',border:'1.5px solid #ddd',cursor:'pointer',color:'#aaa',padding:'3px 10px'}} onMouseEnter={e => { e.currentTarget.style.borderColor = '#d62828'; e.currentTarget.style.color = '#d62828' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#aaa' }}>СБРОСИТЬ</button>}
      </>} />
      <div className={`tnav ${scrolled ? 'sc' : ''}`} style={{position:'fixed',top:52,left:0,right:0,zIndex:499,background:'#f0ede6'}}>
        <div style={{display:'flex',alignItems:'center',borderBottom:'2px solid rgba(10,10,10,0.1)',height:48}}>
          <input className="search-input" placeholder="Найти в списке...  ⌘K — добавить новое" value={listSearch} onChange={e => setListSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setListSearch('') }} />
          {listSearch && <button onClick={() => setListSearch('')} style={{padding:'0 10px',height:'100%',background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:16}}>✕</button>}
          <button onClick={exportList} style={{fontFamily:"'Space Grotesk'",fontSize:12,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',padding:'0 14px',height:'100%',background:'transparent',color:'#888',border:'none',borderLeft:'2px solid rgba(10,10,10,0.1)',cursor:'pointer',whiteSpace:'nowrap'}} onMouseEnter={e => e.currentTarget.style.color = '#0a0a0a'} onMouseLeave={e => e.currentTarget.style.color = '#888'}>↓ ЭКСПОРТ</button>
          <button onClick={() => setShowImport(true)} style={{fontFamily:"'Space Grotesk'",fontSize:12,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',padding:'0 14px',height:'100%',background:'transparent',color:'#888',border:'none',borderLeft:'2px solid rgba(10,10,10,0.1)',cursor:'pointer',whiteSpace:'nowrap'}} onMouseEnter={e => e.currentTarget.style.color = '#0a0a0a'} onMouseLeave={e => e.currentTarget.style.color = '#888'}>ИМПОРТ</button>
          <button onClick={() => setShowSearch(true)} style={{fontFamily:"'Bangers', sans-serif",fontSize:17,letterSpacing:'0.08em',padding:'0 22px',height:'100%',background:'#0a0a0a',color:'#f0ede6',border:'none',borderLeft:'3px solid #0a0a0a',cursor:'pointer',whiteSpace:'nowrap'}} onMouseEnter={e => e.currentTarget.style.background = '#d62828'} onMouseLeave={e => e.currentTarget.style.background = '#0a0a0a'}>+ ДОБАВИТЬ</button>
        </div>
        <div style={{display:'flex',alignItems:'stretch',padding:'0 20px',height:38,overflowX:'auto',borderBottom:'2px solid rgba(10,10,10,0.1)'}}>
          {TABS.map(t => (
            <button key={t.key} className={`tab-btn ${activeTab === t.key ? 'act' : ''}`} onClick={() => setActiveTab(t.key)}>
              <span style={{fontFamily:"'Noto Sans JP'",fontSize:9,color:activeTab === t.key ? '#d62828' : '#ccc'}}>{t.jp}</span>
              {t.label}<span className="tc">{t.key === 'all' ? animeList.length : (counts[t.key] || 0)}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{paddingTop:140,maxWidth:860,margin:'0 auto'}}>
        <div style={{padding:'0 20px',display:'flex',alignItems:'center',justifyContent:'space-between',height:36,borderBottom:'1px solid rgba(10,10,10,0.07)'}}>
          <span style={{fontFamily:"'Space Grotesk'",fontSize:11,fontWeight:700,color:'#bbb',letterSpacing:'0.08em',textTransform:'uppercase'}}>{groups.length} {activeTab === 'all' ? 'тайтлов' : STATUS_META[activeTab]?.label.toLowerCase()}</span>
          <div style={{display:'flex'}}>
            {[['added','Дата'],['score','Оценка'],['title','А—Я']].map(([k,l]) => (
              <button key={k} className={`sort-btn ${sortBy === k ? 'act' : ''}`} onClick={() => setSortBy(k)}>{l}</button>
            ))}
          </div>
        </div>

        {animeList.length === 0 && (
          <div style={{padding:'80px 24px',textAlign:'center'}}>
            <div style={{fontFamily:"'Bangers', sans-serif",fontSize:64,color:'#ccc',marginBottom:12,letterSpacing:'0.02em'}}>空のリスト</div>
            <div style={{fontFamily:"'Space Grotesk'",fontSize:15,color:'#aaa',marginBottom:32}}>Список пуст. Добавьте первое аниме!</div>
            <button onClick={() => setShowSearch(true)} style={{fontFamily:"'Bangers', sans-serif",fontSize:22,letterSpacing:'0.08em',padding:'12px 36px',background:'#0a0a0a',color:'#f0ede6',border:'3px solid #0a0a0a',cursor:'pointer'}}
              onMouseEnter={e => { e.currentTarget.style.background = '#d62828'; e.currentTarget.style.transform = 'translate(-2px,-2px)'; e.currentTarget.style.boxShadow = '4px 4px 0 #0a0a0a' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
              + ДОБАВИТЬ АНИМЕ
            </button>
          </div>
        )}

        {listSearch && groups.length === 0 && animeList.length > 0 && (
          <div style={{padding:'60px 24px',textAlign:'center'}}>
            <div style={{fontFamily:"'Bangers', sans-serif",fontSize:48,color:'#ddd',marginBottom:8}}>見つからない</div>
            <div style={{fontFamily:"'Space Grotesk'",fontSize:13,color:'#bbb',marginBottom:16}}>По запросу <b>«{listSearch}»</b> ничего не найдено</div>
            <button onClick={() => setListSearch('')} style={{fontFamily:"'Space Grotesk'",fontSize:12,fontWeight:700,padding:'6px 18px',background:'none',border:'2px solid #ddd',cursor:'pointer',color:'#aaa'}} onMouseEnter={e => { e.currentTarget.style.borderColor = '#0a0a0a'; e.currentTarget.style.color = '#0a0a0a' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#aaa' }}>СБРОСИТЬ ПОИСК</button>
          </div>
        )}

        <div>
          {groups.map(entries => (
            <AnimeGroup key={entries[0].seriesKey || entries[0].id} entries={entries}
              onEdit={(ents, idx) => setEditGroup({ entries: ents, initialIdx: idx || 0 })}
              onQuickAddNextSeason={handleQuickAddNextSeason}
              formatCountdown={formatCountdown}
              getLiveEpAired={getLiveEpAired}
              isOngoing={isOngoing} />
          ))}
        </div>

        {!listSearch && groups.length === 0 && animeList.length > 0 && (
          <div style={{padding:60,textAlign:'center'}}>
            <div style={{fontFamily:"'Bangers', sans-serif",fontSize:48,color:'#ddd',marginBottom:8}}>空</div>
            <div style={{fontFamily:"'Noto Sans JP'",fontSize:13,color:'#bbb'}}>В этом разделе пусто</div>
          </div>
        )}
      </div>

      {showSearch && <SearchModal onClose={() => setShowSearch(false)} onSelectResult={r => { setShowSearch(false); handleSelectResult(r) }} />}
      {seasonPicker && <SeasonPickerModal searchResult={seasonPicker} existingSeriesKeys={existingSeriesKeys} onClose={() => setSeasonPicker(null)} onAdd={items => { addItems(items); setSeasonPicker(null) }} />}
      {alreadyDialog && (
        <AlreadyInListDialog
          title={alreadyDialog.searchResult.title}
          nextSeasonLabel={alreadyDialog.nextSeasonLabel}
          onConfirm={async () => {
            const r = alreadyDialog.searchResult
            let sk = makeSeriesKey(r.title)
            if (r.shikiId) sk = `shiki_${await resolveRootId(r.shikiId).catch(() => r.shikiId)}`
            addItems([{ id: Date.now(), shikiId: r.shikiId, seriesKey: sk, title: r.title, titleJp: r.titleJp || '', titleRomaji: r.titleRomaji || '', season: alreadyDialog.nextSeasonNum, seasonLabel: alreadyDialog.nextSeasonLabel, kind: 'tv', score: null, status: 'planned', ep: 0, epTotal: r.epTotal || null, genres: r.genres || [], poster: r.poster || null, year: r.year || null, studio: r.studio || '—', addedAt: Date.now(), hasSequel: false, hasOva: false }])
            setAlreadyDialog(null)
          }}
          onPicker={() => { setSeasonPicker(alreadyDialog.searchResult); setAlreadyDialog(null) }}
          onClose={() => setAlreadyDialog(null)} />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importAnime} />}
      {editGroup && (
        <EditModal entries={editGroup.entries} initialIdx={editGroup.initialIdx || 0}
          onClose={() => setEditGroup(null)} onSave={saveAnime}
          onDelete={id => { deleteAnime(id); setEditGroup(null) }}
          onAddSeasonPicker={base => { setEditGroup(null); setSeasonPicker(base) }}
          ongoingData={ongoingData} onUpdateEntry={updateEntry} />
      )}
      <AchievementToast list={animeList} />
    </div>
  )
}