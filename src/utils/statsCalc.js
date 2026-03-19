/**
 * Shared stats computation — used by Stats.jsx and Profile.jsx
 */

// EN→RU fallback (для старых записей с английскими жанрами)
const GENRE_RU = {
  'Action': 'Экшен', 'Adventure': 'Приключения', 'Comedy': 'Комедия',
  'Drama': 'Драма', 'Ecchi': 'Этти', 'Fantasy': 'Фэнтези',
  'Horror': 'Ужасы', 'Mahou Shoujo': 'Махо-сёдзё', 'Mecha': 'Меха',
  'Music': 'Музыка', 'Mystery': 'Детектив', 'Psychological': 'Психологическое',
  'Romance': 'Романтика', 'Sci-Fi': 'Фантастика', 'Slice of Life': 'Повседневность',
  'Sports': 'Спорт', 'Supernatural': 'Сверхъестественное', 'Thriller': 'Триллер',
  'Hentai': 'Хентай', 'Isekai': 'Исэкай',
}
const normalizeGenre = g => GENRE_RU[g] || g

export function computeStats(list) {
  const totalEp = list.reduce((s, a) => s + (a.ep || 0), 0)
  const totalHours = Math.round(totalEp * 23.5 / 60)
  const scored = list.filter(a => a.score)
  const avgScore = scored.length ? (scored.reduce((s, a) => s + a.score, 0) / scored.length).toFixed(1) : '—'

  const scoreDist = Array.from({ length: 10 }, (_, i) => ({
    s: String(i + 1),
    v: list.filter(a => a.score === i + 1).length,
  }))

  const genreMap = {}
  list.forEach(a => a.genres?.forEach(g => {
    const key = normalizeGenre(g)
    genreMap[key] = (genreMap[key] || 0) + 1
  }))
  const topGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const studioMap = {}
  list.forEach(a => { if (a.studio && a.studio !== '—') studioMap[a.studio] = (studioMap[a.studio] || 0) + 1 })
  const topStudios = Object.entries(studioMap).sort((a, b) => b[1] - a[1]).slice(0, 6)

  const epochMap = {}
  list.forEach(a => {
    if (!a.year) return
    const decade = Math.floor(a.year / 10) * 10
    epochMap[decade] = (epochMap[decade] || 0) + 1
  })
  const epochs = Object.entries(epochMap).sort((a, b) => a[0] - b[0]).map(([y, v]) => ({ y: `${y}е`, v }))

  return {
    total: list.length, totalEp, totalHours, scored: scored.length, avgScore,
    scoreDist, topGenres, topStudios, epochs,
    favorites: list.filter(a => a.score === 10).length,
    trash: list.filter(a => a.score && a.score <= 5).length,
  }
}
