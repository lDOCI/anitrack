// Parser for the "text import": one anime per line, free-form tags.
// Pure function, no I/O. JS \b does not understand Cyrillic, so word boundaries are Unicode-aware lookarounds.

const NB = '(?<![\\p{L}\\p{N}])'
const NE = '(?![\\p{L}\\p{N}])'
const rx = (src, flags = 'iu') => new RegExp(src.replaceAll('<B>', NB).replaceAll('<E>', NE), flags)

const RE_DROPPED = rx('<B>(?:дроп|дропнул|дропнуто|drop|брошено|бросил)<E>')
const RE_WATCHING = rx('<B>(?:смотрю|смотрит|watching|онгоинг)<E>')
const RE_PLANNED = rx('<B>(?:план|планирую|planned|хочу|буду)<E>')
const RE_STATUS_WORDS = rx('<B>(?:онгоинг|дроп|дропнул|дропнуто|drop|брошено|смотрю|смотрит|план|планирую|бросил|хочу|буду|watching|dropped|planned)<E>', 'giu')
const RE_SEASONS = [
  rx('<B>(\\d+)\\s*(?:сезон|season)<E>'),
  rx('<B>сезон\\s*(\\d+)<E>'),
  rx('<B>s(\\d+)<E>'),
]
const RE_PART = /[\s.:\-–—]+Часть\s+(II|III|IV|V|\d+)\s*$/iu
const RE_PART_SPLIT = /[\s.:\-–—]+Часть\s+(II|III|IV|V|2|3|4|5)\s*$/iu

const normKey = (s) => s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '')

// animego.me list copied from the page: "[Название](url)\nRomaji\n[Начать|Продолжить E / N](url#player)"
const ANIMEGO = /\[([^\]\n]+)\]\(https?:\/\/animego\.me\/anime\/[^)\s]+\)[ \t]*\r?\n[ \t]*([^\n[]*?)[ \t]*\r?\n[ \t]*\[(?:Начать|Продолжить|Смотреть|Досмотреть)[^\]\d]*(\d+)\s*\/\s*(\d+)\]/gu

function parseAnimego(raw) {
  const out = []
  const seen = new Set()
  for (const m of String(raw ?? '').matchAll(ANIMEGO)) {
    const title = m[1].replace(/\s*\((?:19|20)\d{2}\)\s*$/, '').trim()
    const ep = parseInt(m[3], 10), total = parseInt(m[4], 10)
    if (!title || seen.has(title)) continue
    seen.add(title)
    const status = ep <= 0 ? 'planned' : total > 0 && ep >= total ? 'completed' : 'watching'
    out.push({ title, alt: m[2].trim() || null, score: null, season: null, status, hadPart: false, statusExplicit: true, ep, epTotal: total || null })
  }
  return out
}

/** @returns {{title:string, score:number|null, season:number|null, status:string, hadPart:boolean, statusExplicit:boolean}[]} */
export function parseLines(raw) {
  const ag = /animego\.me\/anime\//.test(String(raw ?? '')) ? parseAnimego(raw) : []
  if (ag.length) return ag
  const seen = new Set()
  const out = []
  // "Название (7/10, фильм(9/10))" = the series AND its movie: expand into two lines
  const rawLines = []
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const m = line.match(/^(.*?)\s*\(\s*(\d{1,2})\/10\s*,\s*фильм\s*\(?\s*(\d{1,2})\/10\s*\)?\s*\)?/iu)
    if (m && m[1].trim()) rawLines.push(`${m[1].trim()} ${m[2]}/10`, `${m[1].trim()} фильм ${m[3]}/10`)
    else rawLines.push(line)
  }

  for (const line of rawLines) {
    const l = line.trim().replace(/^[*•\-–—]+\s*/, '').replace(/^\d{1,3}[.)]\s+/, '')
    if (l.length <= 1) continue
    let score = null, status = null, season = null
    let s = l

    // Статус
    if (RE_DROPPED.test(s)) status = 'dropped'
    else if (RE_WATCHING.test(s)) status = 'watching'
    else if (RE_PLANNED.test(s)) status = 'planned'

    // Оценка: формат (X/10) или X/10
    // a score inside brackets takes the whole bracket with it: "(7/10 круто, но оборван)"
    const scoreM = s.match(/\(\s*(\d{1,2})\/10[^)]*\)?/) || s.match(/\(?(\d{1,2})\/10\)?/)
    if (scoreM) {
      const n = parseInt(scoreM[1], 10)
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

    // Незакрытая "(" в конце (комментарий оборван) — выбрасываем хвост
    s = s.replace(/\s*\([^)]*$/, '')

    // Убираем круглые и квадратные скобки (с содержимым), «» — только символы
    s = s.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/[«»]/g, '').replace(/\s{2,}/g, ' ').trim()

    // Явный сезон: "3 сезон", "сезон 3", "S3"
    for (const p of RE_SEASONS) {
      const m = s.match(p)
      if (m) { season = parseInt(m[1], 10); s = s.replace(m[0], ' ').trim(); break }
    }

    // Убираем "Часть N" в конце — это split сезона, запоминаем флаг
    const hadPart = RE_PART_SPLIT.test(s)
    s = s.replace(RE_PART, '').trim()

    // "Название N: Подзаголовок" → season=N, сохраняем "Название: Подзаголовок"
    // Но не трогаем если предыдущее слово — большое число (Моб Психо 100 3: ...)
    if (!season) {
      const m = s.match(/^(.+?)\s+(\d{1,2})\s*:\s*(.+)$/)
      if (m) {
        const base = m[1].trim(), num = parseInt(m[2], 10), sub = m[3].trim()
        const prevWord = base.match(/(\S+)\s*$/)
        const prevIsBig = prevWord && !isNaN(parseInt(prevWord[1], 10)) && parseInt(prevWord[1], 10) > 12
        if (!prevIsBig && num <= 12) { season = num; s = base + ': ' + sub }
      }
    }

    // Убираем статусные слова
    s = s.replace(RE_STATUS_WORDS, ' ')

    // Число в конце = сезон
    if (!season) {
      const m = s.match(/\s+(\d{1,2})\s*$/)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n <= 12) {
          const before = s.slice(0, m.index).trim()
          const lastChar = s[m.index - 1] || ''
          const prevWord = before.match(/(\S+)$/)
          const prevIsBig = prevWord && !isNaN(parseInt(prevWord[1], 10)) && parseInt(prevWord[1], 10) > 12
          if (/[а-яёА-ЯЁa-zA-Z!?»]/.test(lastChar) || prevIsBig) { season = n; s = before }
        }
      }
    }

    // хвостовые разделители ("Тетрадь смерти —") тоже убираем
    s = s.replace(/\s{2,}/g, ' ').replace(/[\s.,:;\-–—|]+$/, '').replace(/^[\s\-–—|:]+/, '').trim()
    if (!s || s.length < 2) continue
    const statusExplicit = !!status
    if (!status) status = 'completed'

    const key = normKey(s) + '_' + (season || 0)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ title: s, score, season, status, hadPart, statusExplicit })
  }
  return out
}
