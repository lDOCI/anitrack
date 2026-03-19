/**
 * Скрипт для генерации ruSearchMap.json
 * Парсит топ-300 аниме с Shikimori GraphQL API
 * Формат: { byId: { normalizedRus: shikiId }, byQuery: { normalizedRus: englishQuery } }
 *
 * Запуск: node scripts/generateRuMap.mjs
 */

import { writeFileSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '../src/data/ruSearchMap.json')

const GQL_URL = 'https://shikimori.one/api/graphql'

const GQL_QUERY = `query($page: Int!, $limit: Int!) {
  animes(order: popularity, page: $page, limit: $limit) {
    id
    name
    russian
    licenseNameRu
    kind
  }
}`

function normalizeKey(s) {
  return (s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/э/g, 'е')
    .replace(/[«»""„"'`']/g, '')
    .replace(/[^a-zа-я0-9]/g, '')
}

async function fetchPage(page, limit = 50) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: GQL_QUERY,
      variables: { page, limit }
    })
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`)
  const json = await res.json()
  if (json.errors) throw new Error(`GQL errors: ${JSON.stringify(json.errors)}`)
  return json.data.animes
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Ручные маппинги: тайтлы которые Shikimori не находит по русскому
// (маппятся на английский поисковый запрос)
const MANUAL_BY_QUERY = {
  "всемвозможнымтебекоторыхялюбил": "To Every You I Loved Before",
  "всетотженевзрачныйбоец": "Kawaranu Nichijo",
  "заботызапертойпринцессывампиров": "Trapped in a Dating Sim",
  "нежелательнобессмертныйавантюрист": "Nozomanu Fushi no Boukensha",
  "нежеланнобессмертныйавантюрист": "Nozomanu Fushi no Boukensha",
  "беззаботнаяжизньвиноммире": "Isekai Nonbiri Nouka",
  "незнакомцывдругойжизни": "Umibe no Etranger",
  "великаянебеснаястена": "Tasogare no Kishi",
  "евангелионконецевангелиона": "End of Evangelion",
  "негативныйпозитивныйрыбак": "Negative Happy Chainsaw Edge",
  "туалетныймальчикханако": "Jibaku Shounen Hanako-kun",
  "ублюдоксокрушительтьмы": "Bastard Heavy Metal Dark Fantasy",
  "бездомныйбогарагото": "Noragami Aragoto",
  "мистикаюныедевы": "Mouryou no Hako",
  "городвкоторомменянет": "Boku dake ga Inai Machi",
  "папашидружбаны": "Papa no Iu Koto wo Kikinasai",
  "богатыйдетективбаланс": "Fugou Keiji",
  "патриотизммориарти": "Yuukoku no Moriarty",
  "юныйлордмастерпобега": "Dungeon Escape",
  "драгоценностирури": "Ruri Dragon",
  "вермейлвзолотом": "Kinsou no Vermeil",
  "скрытыевещи": "Kaii to Otome to Kamikakushi",
  "девушканачас": "Kanojo Okarishimasu",
  "стодевушеккоторые": "100 Kanojo",
  "дитяпогоды": "Tenki no Ko",
  "тусовщиккунмин": "Oshi no Ko",
  "витубер": "VTuber Legend",
  "бармен": "Bartender Glass of God",
  "аляиногда": "Alya Sometimes Hides Her Feelings in Russian",
  "обычныйроманвцзюлуне": "Kowloon Generic Romance",
  "треугольникаякаси": "Ayakashi Triangle",
}

async function main() {
  console.log('Парсим топ-300 аниме с Shikimori...\n')

  const allAnimes = []
  const PAGES = 10
  const PER_PAGE = 50

  for (let page = 1; page <= PAGES; page++) {
    console.log(`  Страница ${page}/${PAGES}...`)
    const animes = await fetchPage(page, PER_PAGE)
    allAnimes.push(...animes)
    console.log(`    → получено ${animes.length} аниме (всего: ${allAnimes.length})`)
    if (page < PAGES) await sleep(1000)
  }

  console.log(`\nВсего получено: ${allAnimes.length} аниме`)

  const byId = {}
  let added = 0

  for (const a of allAnimes) {
    const id = String(a.id)
    const titles = [a.russian, a.licenseNameRu].filter(Boolean)

    for (const title of titles) {
      const key = normalizeKey(title)
      if (!key || key.length < 3) continue

      // Не перезаписываем существующий ключ (первый = более популярный)
      if (!byId[key]) {
        byId[key] = id
        added++
      }
    }
  }

  // Числовые алиасы: «пять» → «5», «два» → «2» и т.д.
  const WORD_TO_NUM = {
    'один': '1', 'одна': '1', 'одно': '1', 'первый': '1', 'первая': '1',
    'два': '2', 'две': '2', 'второй': '2', 'вторая': '2',
    'три': '3', 'третий': '3', 'третья': '3',
    'четыре': '4', 'четвертый': '4', 'четвертая': '4',
    'пять': '5', 'пятый': '5', 'пятая': '5',
    'шесть': '6', 'шестой': '6',
    'семь': '7', 'седьмой': '7',
    'восемь': '8', 'восьмой': '8',
    'девять': '9', 'девятый': '9',
    'десять': '10', 'десятый': '10',
  }
  let aliasCount = 0
  for (const [key, id] of Object.entries({ ...byId })) {
    for (const [word, num] of Object.entries(WORD_TO_NUM)) {
      if (key.includes(word)) {
        const alias = key.replace(word, num)
        if (alias !== key && !byId[alias]) {
          byId[alias] = id
          aliasCount++
        }
      }
    }
  }
  console.log(`byId записей: ${added} + ${aliasCount} алиасов = ${Object.keys(byId).length}`)

  // Добавляем ручные byQuery
  const byQuery = { ...MANUAL_BY_QUERY }

  // Ищем конфликты: если ключ byQuery уже есть в byId, удаляем из byQuery
  let removed = 0
  for (const key of Object.keys(byQuery)) {
    if (byId[key]) {
      delete byQuery[key]
      removed++
    }
  }
  if (removed) console.log(`Удалено ${removed} ручных записей (уже есть в byId)`)

  console.log(`byQuery записей: ${Object.keys(byQuery).length}`)

  const result = { byId, byQuery }

  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`\n✓ Записано в ${OUT_PATH}`)
  console.log(`  byId: ${Object.keys(byId).length} записей`)
  console.log(`  byQuery: ${Object.keys(byQuery).length} записей`)
}

main().catch(err => {
  console.error('Ошибка:', err)
  process.exit(1)
})
