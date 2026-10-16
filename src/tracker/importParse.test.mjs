import assert from 'node:assert/strict'
import { parseLines } from './importParse.js'

const one = (l) => parseLines(l)[0]
const eq = (line, exp) => assert.deepEqual(one(line), { score: null, season: null, status: 'completed', hadPart: false, ...exp, statusExplicit: exp.status != null }, line)

eq('Атака титанов 3 сезон 9/10', { title: 'Атака титанов', season: 3, score: 9 })
eq('Тетрадь смерти — 9/10', { title: 'Тетрадь смерти', score: 9 })
eq('Фрирен', { title: 'Фрирен' })
eq('Винланд сага смотрю', { title: 'Винланд сага', status: 'watching' })
eq('- Клинок рассекающий демонов (8/10) дроп', { title: 'Клинок рассекающий демонов', score: 8, status: 'dropped' })
eq('• Ванпанчмен 2', { title: 'Ванпанчмен', season: 2 })
eq('Магическая битва сезон 2', { title: 'Магическая битва', season: 2 })
eq('Re:Zero S2 7/10', { title: 'Re:Zero', season: 2, score: 7 })
eq('Токийский гуль план', { title: 'Токийский гуль', status: 'planned' })
eq('Моб Психо 100 3', { title: 'Моб Психо 100', season: 3 })
eq('Моб Психо 100', { title: 'Моб Психо 100' })
eq('Кулинарные войны 2: Второе блюдо', { title: 'Кулинарные войны: Второе блюдо', season: 2 })
eq('Атака титанов 4 сезон. Часть 2 10/10', { title: 'Атака титанов', season: 4, score: 10, hadPart: true })
eq('Берсерк [комментарий] (классика)', { title: 'Берсерк' })
eq('Ковбой Бибоп (круто, но оборван)', { title: 'Ковбой Бибоп' })
eq('Тетрадь смерти, но это слабо тянет 5/10', { title: 'Тетрадь смерти', score: 5 })
eq('1. «Стальной алхимик» 10/10', { title: 'Стальной алхимик', score: 10 })
eq('Планета лис', { title: 'Планета лис' }) // "план" inside a word is not a status
assert.equal(parseLines('Берсерк\nберсерк!\n\n \nх').length, 1) // dedupe, empties, one-char lines
assert.equal(one('Фрирен 0/10').score, null)

console.log('importParse: all tests passed')
