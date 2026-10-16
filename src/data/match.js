// Title matching & ranking. Replaces the old bestMatch() heuristics with one scorer over ALL aliases
// (RU, license RU, EN, romaji, native, synonyms), plus season-number and format awareness.

export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’'`"«»„“”]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const ORD = {
  первый: 1, первая: 1, первое: 1, второй: 2, вторая: 2, второе: 2, третий: 3, третья: 3, третье: 3,
  четвертый: 4, четвертая: 4, четвертое: 4, пятый: 5, пятая: 5, пятое: 5, шестой: 6, седьмой: 7, восьмой: 8,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
}
const ROMAN = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6 }

/** Season number hinted by a name, or null. ("Season 2", "2nd Season", "2 сезон", "Часть II" is NOT a season.) */
export function seasonNo(name) {
  const n = norm(name)
  if (!n) return null
  let m
  if ((m = n.match(re('<B>(\\d{1,2}) ?(?:st|nd|rd|th) season<E>')))) return +m[1]
  if ((m = n.match(re('<B>season (\\d{1,2})<E>')))) return +m[1]
  if ((m = n.match(re('<B>(\\d{1,2}) сезон<E>'))) || (m = n.match(re('<B>сезон (\\d{1,2})<E>')))) return +m[1]
  if ((m = n.match(re('<B>s(\\d{1,2})$')))) return +m[1]
  for (const [w, v] of Object.entries(ORD)) {
    if (re(`<B>${w}( season| сезон)<E>|<B>(сезон|season) ${w}<E>`).test(n)) return v
  }
  if ((m = n.match(re('<B>(ii|iii|iv|v|vi)$')))) return ROMAN[m[1]]
  if ((m = n.match(/(?:^|\s)(\d{1,2})$/)) && +m[1] >= 2 && +m[1] <= 20) return +m[1]
  return null
}

// JS \b only knows ASCII word chars: use Unicode-aware boundaries so Cyrillic words work
const B = '(?<![\\p{L}\\p{N}])'
const E = '(?![\\p{L}\\p{N}])'
const re = (src, flags = '') => new RegExp(src.replaceAll('<B>', B).replaceAll('<E>', E), flags + 'u')

// bigram dice coefficient: typo / transliteration tolerance
function dice(a, b) {
  if (a.length < 2 || b.length < 2) return 0
  const grams = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1) } return m }
  const A = grams(a), B = grams(b)
  let inter = 0
  for (const [g, c] of A) inter += Math.min(c, B.get(g) || 0)
  return (2 * inter) / (a.length - 1 + b.length - 1)
}

function scoreName(qn, qToks, cn) {
  if (!cn) return 0
  if (cn === qn) return 100
  const cToks = cn.split(' ')
  let s = 0
  if (qn.length >= 3) {
    if (cn.startsWith(qn)) s = Math.max(s, 86 - Math.min(cn.length - qn.length, 24) * 0.4)
    else if ((' ' + cn + ' ').includes(' ' + qn + ' ')) s = Math.max(s, 72)
    else if (cn.includes(qn)) s = Math.max(s, 58)
  }
  const matched = qToks.filter(qt => cToks.some(ct => ct === qt || (qt.length >= 3 && ct.startsWith(qt)) || (ct.length >= 4 && qt.startsWith(ct))))
  if (matched.length) {
    const cov = matched.length / qToks.length
    const extra = Math.min((cToks.length - matched.length) * 1.5, 15)
    s = Math.max(s, (cov === 1 ? 62 : cov * 40) - extra)
  }
  s = Math.max(s, dice(qn, cn) * 66)
  return s
}

export const nameList = (t) =>
  [t.titleRuLicense, t.titleRu, t.titleEn, t.titleRomaji, t.titleNative, ...(t.synonyms || [])].filter(Boolean)

/** How well `query` matches title `t` (higher = better, ~0..120). */
export function scoreTitle(query, t) {
  const qn = norm(query)
  if (!qn) return 0
  const qToks = qn.split(' ').filter(Boolean)
  // the season number is part of intent, not of the base name: score the base name, then adjust
  const qSeason = seasonNo(query)
  let best = 0
  for (const name of nameList(t)) best = Math.max(best, scoreName(qn, qToks, norm(name)))

  const cSeasons = nameList(t).map(seasonNo).filter(n => n != null)
  const cSeason = cSeasons.length ? Math.max(...cSeasons) : null
  if (qSeason) {
    if (cSeason === qSeason) best += best >= 40 ? 18 : 0 // a matching number only counts when the name matched too
    else if (cSeason && cSeason !== qSeason) best -= 28
    else if (!cSeason) best -= 8 // asked for season N, this looks like season 1
  } else if (cSeason && cSeason > 1) best -= 10 // no number asked: prefer the base season

  const wantsMovie = re('<B>(?:фильм|movie|film|gekijouban)<E>', 'i').test(query)
  const wantsExtra = re('<B>(?:ova|ова|ona|она|special|спешл|спецвыпуск|oad)<E>', 'i').test(query)
  const f = t.format
  if (f === 'TV') best += 10
  else if (f === 'TV_SHORT') best += 1
  else if (f === 'MOVIE') best += wantsMovie ? 14 : -2
  else if (f === 'OVA' || f === 'ONA') best -= wantsExtra ? 0 : 9
  else if (f === 'SPECIAL') best -= wantsExtra ? 0 : 18
  else if (f === 'MUSIC') best -= 30

  if (t.popularity) best += Math.min(Math.log10(t.popularity + 1) * 2.5, 15)
  else if (t.shikiRank != null) best += Math.max(0, 3 - t.shikiRank * 0.8)
  return best
}

export function rankTitles(query, titles) {
  return titles
    .map(t => ({ t, s: scoreTitle(query, t) }))
    .sort((a, b) => b.s - a.s)
}
