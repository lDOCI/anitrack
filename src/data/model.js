// Unified title model. One shape for AniList + Shikimori data, keyed by MAL id when we have it.
//
// Title {
//   key, malId, anilistId,
//   titleRu, titleRuLicense, titleEn, titleRomaji, titleNative, synonyms[],
//   format: TV | TV_SHORT | MOVIE | OVA | ONA | SPECIAL | MUSIC,
//   status: RELEASING | FINISHED | NOT_YET_RELEASED | CANCELLED | HIATUS,
//   episodes, epAired, duration, year, season,
//   poster, genres[], studio, popularity,
//   nextEp: { episode, at(ms) } | null,
//   isAdult
// }

export const ANI_FIELDS = `id idMal format status episodes duration seasonYear season isAdult popularity
  startDate{year month day} endDate{year month day}
  title{romaji english native} synonyms genres
  studios(isMain:true){nodes{name}}
  coverImage{extraLarge large}
  nextAiringEpisode{episode airingAt}`

export const SHIKI_FIELDS = `id malId name russian licenseNameRu english japanese synonyms kind status episodes episodesAired
  airedOn{year} nextEpisodeAt poster{mainUrl} genres{russian kind} studios{name} score`

const GENRE_RU = {
  Action: 'Экшен', Adventure: 'Приключения', Comedy: 'Комедия', Drama: 'Драма', Ecchi: 'Этти', Fantasy: 'Фэнтези',
  Horror: 'Ужасы', 'Mahou Shoujo': 'Махо-сёдзё', Mecha: 'Меха', Music: 'Музыка', Mystery: 'Детектив',
  Psychological: 'Психологическое', Romance: 'Романтика', 'Sci-Fi': 'Фантастика', 'Slice of Life': 'Повседневность',
  Sports: 'Спорт', Supernatural: 'Сверхъестественное', Thriller: 'Триллер',
}

const SHIKI_FORMAT = { tv: 'TV', tv_special: 'SPECIAL', movie: 'MOVIE', ova: 'OVA', ona: 'ONA', special: 'SPECIAL', music: 'MUSIC', pv: 'SPECIAL', cm: 'SPECIAL' }
const SHIKI_STATUS = { anons: 'NOT_YET_RELEASED', ongoing: 'RELEASING', released: 'FINISHED' }
const LEGACY_KIND = { TV: 'tv', TV_SHORT: 'tv', MOVIE: 'movie', OVA: 'ova', ONA: 'ona', SPECIAL: 'special', MUSIC: 'music' }

export const legacyKind = (format) => LEGACY_KIND[format] || 'tv'

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }

export function fromAniList(m) {
  if (!m) return null
  const next = m.nextAiringEpisode
  const episodes = num(m.episodes)
  return {
    key: m.idMal ? String(m.idMal) : `a${m.id}`,
    malId: num(m.idMal),
    anilistId: m.id,
    titleRu: null,
    titleRuLicense: null,
    titleEn: m.title?.english || null,
    titleRomaji: m.title?.romaji || null,
    titleNative: m.title?.native || null,
    synonyms: m.synonyms || [],
    format: m.format || null,
    status: m.status || null,
    episodes,
    epAired: next ? Math.max(0, next.episode - 1) : m.status === 'FINISHED' ? episodes : null,
    duration: num(m.duration),
    year: m.seasonYear || m.startDate?.year || null,
    season: m.season || null,
    startDate: m.startDate || null,
    poster: m.coverImage?.extraLarge || m.coverImage?.large || null,
    genres: (m.genres || []).map(g => GENRE_RU[g] || g),
    studio: m.studios?.nodes?.[0]?.name || null,
    popularity: m.popularity || 0,
    nextEp: next ? { episode: next.episode, at: next.airingAt * 1000 } : null,
    isAdult: !!m.isAdult,
  }
}

export function fromShiki(a) {
  if (!a) return null
  const malId = num(a.malId || a.id)
  const episodes = num(a.episodes)
  const status = SHIKI_STATUS[a.status] || null
  const genres = (a.genres || []).filter(g => g.kind === 'genre' || g.kind === 'theme').map(g => g.russian).filter(Boolean)
  return {
    key: String(malId),
    malId,
    anilistId: null,
    titleRu: a.russian || null,
    titleRuLicense: a.licenseNameRu || null,
    titleEn: a.english || null,
    titleRomaji: a.name || null,
    titleNative: a.japanese || null,
    synonyms: a.synonyms || [],
    format: SHIKI_FORMAT[a.kind] || null,
    status,
    episodes,
    epAired: num(a.episodesAired) ?? (status === 'FINISHED' ? episodes : null),
    duration: null,
    year: a.airedOn?.year || null,
    season: null,
    startDate: null,
    poster: a.poster?.mainUrl || null,
    genres,
    studio: a.studios?.[0]?.name || null,
    popularity: 0,
    nextEp: a.nextEpisodeAt ? { episode: null, at: Date.parse(a.nextEpisodeAt) } : null,
    isAdult: false,
  }
}

// Merge two views of the same title. `ani` wins for format/episodes/airing/poster, `shiki` for Russian names + genres.
export function mergeTitles(ani, shiki) {
  if (!ani) return shiki
  if (!shiki) return ani
  const syn = [...new Set([...(ani.synonyms || []), ...(shiki.synonyms || [])])]
  const nextEp = ani.nextEp || (shiki.nextEp ? { episode: (shiki.epAired ?? 0) + 1, at: shiki.nextEp.at } : null)
  return {
    ...ani,
    key: String(shiki.malId || ani.malId || `a${ani.anilistId}`),
    malId: shiki.malId || ani.malId,
    titleRu: shiki.titleRu || ani.titleRu,
    titleRuLicense: shiki.titleRuLicense || ani.titleRuLicense,
    titleEn: ani.titleEn || shiki.titleEn,
    titleRomaji: ani.titleRomaji || shiki.titleRomaji,
    titleNative: ani.titleNative || shiki.titleNative,
    synonyms: syn,
    format: ani.format || shiki.format,
    status: ani.status || shiki.status,
    episodes: ani.episodes ?? shiki.episodes,
    epAired: ani.epAired ?? shiki.epAired,
    genres: shiki.genres?.length ? shiki.genres : ani.genres,
    studio: ani.studio || shiki.studio,
    poster: ani.poster || shiki.poster,
    nextEp,
  }
}

/** Preferred display name: license RU > RU > EN > romaji. */
const hasLatin = (s) => /[A-Za-z]/.test(s || '')
export function displayTitle(t) {
  const lic = t.titleRuLicense, ru = t.titleRu
  // some licensed names are half-transliterated ("Истребитель демонов: Kimetsu no Yaiba"): prefer the clean Russian one
  const ruName = lic && !(hasLatin(lic) && ru && !hasLatin(ru)) ? lic : (ru || lic)
  return ruName || t.titleEn || t.titleRomaji || t.titleNative || '—'
}

export const isReleasing = (t) => t.status === 'RELEASING' || (t.status === 'NOT_YET_RELEASED' && !!t.nextEp)

/** Human label for a format. */
export function formatLabel(format) {
  return { TV: 'ТВ', TV_SHORT: 'ТВ-короткометражка', MOVIE: 'Фильм', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Спешл', MUSIC: 'Клип' }[format] || '—'
}
