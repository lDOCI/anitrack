import { useState, useEffect, useRef } from 'react'
import { decodeList, buildCompareUrl, buildShortUrl, fetchShared, hydrateList } from '../utils/listCodec'
import NavBar from '../components/NavBar'
import { recommend, formatLabel } from '../data'

const STORAGE_KEY = 'anitrack_list'
const HIGH = 8 // a score of 8+ counts as "loved"

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)

/** How much a person likes each genre: their average score in it minus their overall average (needs 3+ rated titles). */
function genreTaste(list) {
  const rated = list.filter(a => a.score > 0)
  const overall = avg(rated.map(a => a.score)) || 7
  const by = {}
  for (const a of rated) for (const g of a.genres || []) (by[g] ||= []).push(a.score)
  const taste = {}
  for (const [g, arr] of Object.entries(by)) if (arr.length >= 3) taste[g] = avg(arr) - overall
  return taste
}

/** Titles `from` loved and `to` hasn't seen, best first. Rank = their score + how well the genres fit `to`'s taste (+1 if already planned). */
function suggest(from, to, whoRates, toName) {
  const toMap = new Map(to.map(a => [Number(a.shikiId), a]))
  const taste = genreTaste(to)
  const out = []
  for (const a of from) {
    if (!(a.score >= HIGH) || a.status === 'planned' || a.status === 'dropped') continue
    const other = toMap.get(Number(a.shikiId))
    if (other && other.status !== 'planned') continue // already seen / started / dropped
    const inPlan = !!other
    const liked = (a.genres || []).filter(g => taste[g] > 0.3)
    const fit = (a.genres || []).map(g => taste[g]).filter(x => x != null)
    const boost = fit.length ? Math.max(-1.5, Math.min(1.5, avg(fit) * 0.5)) : 0
    const why = [`${whoRates} оценил на ${a.score}/10`]
    if (liked.length) why.push(`${toName} любит жанры: ${liked.slice(0, 3).join(', ')}`)
    if (inPlan) why.push('уже в планах')
    out.push({ title: a.title, poster: a.poster, genres: a.genres || [], score: a.score, why, rank: a.score + boost + (inPlan ? 1 : 0) })
  }
  return out.sort((x, y) => y.rank - x.rank)
}

/** Titles to base "you'll both like" on: what both rated 8+ (or, if there are few, each person's own 9+). */
function pickSeeds(myList, theirList) {
  const theirMap = new Map(theirList.map(a => [Number(a.shikiId), a]))
  const fav = []
  for (const m of myList) {
    const t = theirMap.get(Number(m.shikiId))
    if (t && m.score >= HIGH && t.score >= HIGH) fav.push({ malId: Number(m.shikiId), weight: (m.score + t.score) / 2, title: m.title })
  }
  fav.sort((a, b) => b.weight - a.weight)
  let seeds = fav.slice(0, 15)
  if (seeds.length < 4) {
    const have = new Set(seeds.map(x => x.malId))
    const own = [...myList, ...theirList].filter(a => a.score >= 9 && !have.has(Number(a.shikiId)))
      .sort((a, b) => b.score - a.score).slice(0, 10 - seeds.length)
      .map(a => ({ malId: Number(a.shikiId), weight: a.score - 1, title: a.title }))
    seeds = [...seeds, ...own]
  }
  return { seeds, shared: fav.length }
}

function compare(myList, theirList) {
  const myMap = new Map(myList.map(a => [Number(a.shikiId), a]))
  const theirMap = new Map(theirList.map(a => [Number(a.shikiId), a]))

  const both = []
  for (const [id, mine] of myMap) {
    const theirs = theirMap.get(id)
    if (theirs) both.push({ title: mine.title || theirs.title, poster: mine.poster || theirs.poster, myScore: mine.score, theirScore: theirs.score, genres: mine.genres || theirs.genres || [], myStatus: mine.status, theirStatus: theirs.status })
  }

  const bothScored = both.filter(a => a.myScore && a.theirScore)
  let compat = 0
  if (bothScored.length >= 3) compat = Math.max(0, Math.round(100 - avg(bothScored.map(a => Math.abs(a.myScore - a.theirScore))) * 15))

  const dispute = bothScored.filter(a => Math.abs(a.myScore - a.theirScore) >= 3)
    .sort((a, b) => Math.abs(b.myScore - b.theirScore) - Math.abs(a.myScore - a.theirScore))
  const bothLove = bothScored.filter(a => a.myScore >= HIGH && a.theirScore >= HIGH).length
  const watchTogether = both.filter(a => a.myStatus === 'planned' && a.theirStatus === 'planned')
    .map(a => ({ title: a.title, poster: a.poster, genres: a.genres, score: 0, why: ['в планах у вас обоих'] }))

  const myGenres = {}, theirGenres = {}
  myList.forEach(a => a.genres?.forEach(g => { myGenres[g] = (myGenres[g] || 0) + 1 }))
  theirList.forEach(a => a.genres?.forEach(g => { theirGenres[g] = (theirGenres[g] || 0) + 1 }))
  const commonGenres = Object.keys(myGenres).filter(g => theirGenres[g])
    .sort((a, b) => (myGenres[b] + theirGenres[b]) - (myGenres[a] + theirGenres[a])).slice(0, 5)

  return {
    both, dispute, watchTogether, compat, commonGenres, bothLove,
    bothScored: bothScored.length,
    forMe: suggest(theirList, myList, 'друг', 'ты'),
    forThem: suggest(myList, theirList, 'ты', 'друг'),
  }
}

export default function Together({ navigate, compareData }) {
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadPct, setLoadPct] = useState(0)
  const [tab, setTab] = useState('rec')
  const [recs, setRecs] = useState(null)   // null = still loading
  const [recMeta, setRecMeta] = useState({ shared: 0 })
  const [refining, setRefining] = useState(false)
  const [myLink, setMyLink] = useState(null) // { url, short }
  const [making, setMaking] = useState(false)
  const linkRef = useRef(null)

  const myList = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] } })()

  const doCompare = async (minimalList) => {
    setLoading(true)
    setLoadPct(0)
    try {
      const hydrated = await hydrateList(minimalList, pct => setLoadPct(Math.round(pct * 100)))
      setResult(compare(myList, hydrated))
      setTab('rec')
      const { seeds, shared } = pickSeeds(myList, hydrated)
      setRecMeta({ shared, seeds: seeds.length })
      setRecs(null)
      const seen = new Set([...myList, ...hydrated].map(a => String(a.shikiId)))
      setRefining(true)
      recommend(seeds, seen, { onPartial: setRecs }).then(r => { setRecs(r); setRefining(false) }).catch(() => { setRecs(prev => prev || []); setRefining(false) })
    } catch { setError('Ошибка загрузки данных') }
    setLoading(false)
  }

  const handleCompare = async () => {
    setError('')
    let hash = link.trim()
    const hashIdx = hash.indexOf('#')
    if (hashIdx >= 0) hash = hash.slice(hashIdx + 1)
    if (hash.startsWith('c=') || hash.startsWith('p=')) hash = hash.slice(2)
    if (!hash) { setError('Вставь ссылку друга'); return }

    let theirList
    if (hash.startsWith('s:')) {
      setLoading(true)
      theirList = await fetchShared(hash.slice(2))
      setLoading(false)
      if (!theirList?.length) { setError('Не получилось открыть короткую ссылку. Она устарела или сервис недоступен: попроси друга прислать ссылку ещё раз.'); return }
    } else {
      theirList = decodeList(hash)
      if (!theirList?.length) { setError('Не удалось расшифровать список. Ссылка неправильная?'); return }
    }
    doCompare(theirList)
  }

  useEffect(() => {
    if (compareData?.length) doCompare(compareData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMakeLink = async () => {
    setMaking(true)
    setCopied(false)
    const short = await buildShortUrl(myList, 'c')
    const url = short || buildCompareUrl(myList)
    setMyLink({ url, short: !!short })
    setMaking(false)
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2200) } catch { linkRef.current?.select() }
  }

  const recHint = recMeta.shared >= 4
    ? `Похоже на то, что вы оба оценили на 8+ (таких ${recMeta.shared}), по голосам зрителей AniList. Этого нет ни у тебя, ни у друга. Выше те, что советуют сразу по нескольким вашим любимым.`
    : `Общих любимых мало (${recMeta.shared}), поэтому к ним добавлены личные 9+ каждого из вас. Подборка по голосам зрителей AniList, всё это вы оба ещё не смотрели.`
  const tabs = result ? [
    { key: 'rec', label: 'Вам обоим зайдёт', n: recs ? recs.length : '…', hint: recHint },
    { key: 'forMe', label: 'Тебе глянуть', n: result.forMe.length, hint: 'Друг оценил на 8+, а у тебя этого нет (или лежит в планах). Выше те, что лучше оценены и ближе к жанрам, которые ты сам любишь.' },
    { key: 'forThem', label: 'Другу глянуть', n: result.forThem.length, hint: 'То же в обратную сторону: ты поставил 8+, а у друга этого нет. Порядок учитывает его вкусы по жанрам.' },
    { key: 'plan', label: 'Вместе в планах', n: result.watchTogether.length, hint: 'Тайтлы, которые у вас обоих в планах. Можно выбрать на вечер.' },
    { key: 'both', label: 'Общие', n: result.both.length, hint: 'Всё, что есть в обоих списках, с оценками обоих.' },
    { key: 'dispute', label: 'Спорные', n: result.dispute.length, hint: 'Общие тайтлы, где оценки отличаются на 3 и больше. Повод поругаться.' },
  ] : []
  const current = tabs.find(t => t.key === tab)

  const recItems = (recs || []).map(r => ({
    title: r.title, poster: r.poster, genres: [formatLabel(r.format), r.year].filter(Boolean),
    why: [`похоже на: ${r.hits.slice(0, 3).join(', ')}`, ...(r.viaSequel ? ['начни с первого сезона'] : [])],
    score: r.avg ? Math.round(r.avg / 10 * 10) / 10 : 0,
  }))
  const currentItems = !result ? [] : { rec: recItems, forMe: result.forMe, forThem: result.forThem, plan: result.watchTogether, both: result.both, dispute: result.dispute }[tab]
  const showScores = tab === 'both' || tab === 'dispute'
  const compatColor = result ? (result.compat >= 70 ? 'var(--acid)' : result.compat >= 40 ? 'var(--cy)' : 'var(--mag)') : 'var(--acid)'

  return (
    <div className="tg">
      <NavBar active="together" onNavigate={navigate} />

      <header className="tg-head">
        <div className="scan" />
        <div className="t-hud" style={{ color: 'var(--acid)', position: 'relative' }}>// сравнение списков / 一緒に</div>
        <h1 className="t-head tg-h1">Вместе<span className="t-out" style={{ '--stroke': 'var(--acid)' }}>?</span></h1>
        <div className="tg-vs t-impact" aria-hidden="true"><span>ТЫ</span><i>×</i><span>ДРУГ</span></div>
      </header>

      {loading ? (
        <section className="tg-center">
          <div className="t-hud" style={{ color: 'var(--acid)', marginBottom: 14 }}>// загрузка списка друга</div>
          <div className="t-out tg-pct">{loadPct}%</div>
          <div className="tg-bar"><i style={{ width: `${loadPct}%` }} /></div>
        </section>
      ) : !result ? (
        <section className="tg-steps">
          <div className="tg-step">
            <span className="t-out tg-n">01</span>
            <div className="tg-step-b">
              <div className="t-hud" style={{ color: 'var(--cy)' }}>// шаг 1</div>
              <h2 className="t-head tg-h2">Отправь свою ссылку другу</h2>
              <p className="tg-p">В ссылке твой список: названия, оценки и статусы. Друг вставит её у себя, а тебе пришлёт свою.</p>
              <button className="btn" onClick={handleMakeLink} disabled={making || myList.length === 0} style={{ opacity: myList.length === 0 ? .4 : 1 }}>
                {making ? 'Создаю ссылку…' : copied ? 'Скопировано' : myLink ? 'Скопировать снова' : 'Получить мою ссылку'}
              </button>
              {myLink && (
                <div style={{ marginTop: 16 }}>
                  <input ref={linkRef} className="tg-input" readOnly value={myLink.url} onFocus={e => e.target.select()} aria-label="Моя ссылка" />
                  <div className="tg-note">
                    {myLink.short ? 'Короткая ссылка. Работает, пока доступен сервис хранения.' : `Короткую сделать не вышло (сервис недоступен), вот полная ссылка на ${myLink.url.length} символов. Она работает всегда.`}
                  </div>
                </div>
              )}
              {myList.length === 0 && <div className="tg-err">Твой список пуст. Сначала добавь аниме в трекер.</div>}
            </div>
          </div>

          <div className="tg-step tg-step2">
            <span className="t-out tg-n" style={{ '--stroke': 'var(--mag)' }}>02</span>
            <div className="tg-step-b">
              <div className="t-hud" style={{ color: 'var(--mag)' }}>// шаг 2</div>
              <h2 className="t-head tg-h2">Вставь ссылку друга</h2>
              <div className="tg-form">
                <input className="tg-input" value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCompare()}
                  placeholder="Вставь ссылку сюда..." aria-label="Ссылка друга" />
                <button className="btn" onClick={handleCompare}>Сравнить</button>
              </div>
              {error && <div className="tg-err">{error}</div>}
            </div>
          </div>

          <div className="tg-how">
            <div className="t-hud" style={{ color: 'var(--mut)', marginBottom: 12 }}>// как это работает</div>
            <ul>
              <li><b>Совместимость</b> считается по тайтлам, которые есть у обоих с оценками: чем ближе оценки, тем выше. 100% значит оценки совпали, за каждый балл средней разницы минус 15%.</li>
              <li><b>«Тебе глянуть»</b>: друг оценил на 8+, а у тебя этого нет. Выше те, где жанры похожи на то, что ты сам оцениваешь высоко.</li>
              <li><b>Ничего не отправляется на сервер</b>, кроме самой ссылки: список сжимается в неё, сравнение идёт у тебя в браузере.</li>
            </ul>
          </div>
        </section>
      ) : (
        <>
          <section className="tg-compat">
            <div className="tg-c-main">
              <div className="t-hud" style={{ color: 'var(--mut)' }}>// совместимость</div>
              <div className="t-impact tg-c-num" style={{ color: result.bothScored >= 3 ? compatColor : 'var(--mut)' }}>
                {result.bothScored >= 3 ? `${result.compat}%` : '—'}
              </div>
              {result.bothScored < 3
                ? <div style={{ fontSize: 14, color: 'var(--mut)' }}>Мало общих оценок: нужно хотя бы 3 тайтла, оценённых вами обоими.</div>
                : <div className="tg-c-note">По {result.bothScored} общим оценкам. Средняя разница между вашими баллами {(((100 - result.compat) / 15)).toFixed(1)}. Любите одинаково (8+): {result.bothLove}.</div>}
            </div>
            <div className="tg-c-side">
              <div>
                <div className="t-hud" style={{ color: 'var(--mut)', marginBottom: 6 }}>общие аниме</div>
                <div className="t-impact" style={{ fontSize: 'clamp(48px,7vw,96px)' }}>{result.both.length}</div>
              </div>
              <div>
                <div className="t-hud" style={{ color: 'var(--mut)', marginBottom: 10 }}>общие жанры</div>
                <div className="tg-chips">
                  {result.commonGenres.map(g => <span key={g}>{g}</span>)}
                  {result.commonGenres.length === 0 && <span style={{ color: 'var(--mut)', boxShadow: 'none' }}>нет</span>}
                </div>
              </div>
            </div>
          </section>

          <div className="tg-tabs" role="tablist">
            {tabs.map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
                <span>{t.label} ({t.n})</span>
              </button>
            ))}
          </div>
          {current && <p className="tg-hint">{current.hint}{tab === 'rec' && refining && recs ? ' Уточняем: убираем продолжения того, что вы уже смотрели…' : ''}</p>}

          <section className="tg-list">
            {tab === 'rec' && recs === null ? (
              <div style={{ padding: '48px 0' }}>
                <div className="t-hud" style={{ color: 'var(--acid)', marginBottom: 10 }}>// подбираем похожее</div>
                <div className="tg-note">Смотрим, что советуют зрители к вашим общим любимым. Обычно до 10 секунд.</div>
              </div>
            ) : currentItems.length === 0 ? (
              <div className="t-out" style={{ fontSize: 56, padding: '48px 0', '--stroke': 'var(--mut)' }}>Пусто</div>
            ) : currentItems.map((item, i) => (
              <div key={i} className="tg-item">
                <span className="t-hud tg-i-n">{String(i + 1).padStart(2, '0')}</span>
                {item.poster ? <img className="tg-i-p" src={item.poster} alt="" loading="lazy" /> : <span className="tg-i-p tg-i-p0" aria-hidden="true" />}
                <div style={{ minWidth: 0 }}>
                  <div className="tg-i-t">{item.title}</div>
                  {item.why && <div className="tg-i-why">{item.why.map((w, k) => <span key={k}>{w}</span>)}</div>}
                  {item.genres?.length > 0 && <div className="tg-i-g">{item.genres.slice(0, 3).join(' · ')}</div>}
                </div>
                <div className="tg-i-s">
                  {showScores ? (
                    <>
                      <div>
                        <div className="t-hud">ты</div>
                        <div className="t-impact" style={{ fontSize: 28, color: item.myScore >= 8 ? 'var(--acid)' : 'var(--mut)' }}>{item.myScore || '—'}</div>
                      </div>
                      <i />
                      <div>
                        <div className="t-hud">друг</div>
                        <div className="t-impact" style={{ fontSize: 28, color: item.theirScore >= 8 ? 'var(--cy)' : 'var(--mut)' }}>{item.theirScore || '—'}</div>
                      </div>
                    </>
                  ) : item.score ? (
                    <div className="t-impact" style={{ fontSize: 28, color: 'var(--acid)' }}>{item.score}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </section>

          <section className="tg-back">
            <button className="btn ghost" onClick={() => { setResult(null); setLink(''); setTab('rec') }}>Сравнить с другим</button>
          </section>
        </>
      )}

      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
  .tg { padding-top: 52px; min-height: 100vh; overflow-x: hidden; background: var(--bg); color: var(--fg); }
  .tg *, .tg *::before, .tg *::after { box-sizing: border-box; }
  .tg h1, .tg h2, .tg p { margin: 0; }
  .tg button:focus-visible, .tg-input:focus-visible { outline: 3px solid var(--cy); outline-offset: 3px; }

  .tg-head { position: relative; padding: 7vh 5vw 14vh; background: var(--bg-2); clip-path: polygon(0 0, 100% 0, 100% calc(100% - 5vw), 0 100%); overflow: hidden; }
  .tg-h1 { position: relative; font-size: clamp(56px, 12.5vw, 210px); margin-top: 14px; }
  .tg-vs { position: absolute; right: 5vw; top: 9vh; font-size: clamp(22px, 3.4vw, 54px); display: flex; align-items: center; gap: 14px; transform: rotate(-4deg); }
  .tg-vs span { background: var(--acid); color: var(--bg); padding: 4px 14px; }
  .tg-vs span:last-child { background: var(--mag); color: var(--fg); }
  .tg-vs i { font-style: normal; color: var(--fg); }

  .tg-center { text-align: center; padding: 14vh 24px; }
  .tg-pct { font-size: clamp(80px, 18vw, 220px); --stroke: var(--acid); }
  .tg-bar { width: 260px; height: 12px; margin: 22px auto 0; background: rgba(244,244,255,.08); transform: skewX(-18deg); overflow: hidden; }
  .tg-bar i { display: block; height: 100%; background: var(--acid); transition: width .3s; }

  .tg-steps { max-width: 1100px; margin: 0 auto; padding: 4vw 5vw 10vw; }
  .tg-step { display: grid; grid-template-columns: auto 1fr; gap: 3vw; align-items: start; padding: 6vh 0; border-bottom: 1px solid var(--line); }
  .tg-step2 { margin-left: 8vw; border-bottom: 0; }
  .tg-n { font-size: clamp(80px, 13vw, 200px); line-height: .8; --stroke: var(--acid); }
  .tg-step-b { min-width: 0; padding-top: 1vw; }
  .tg-h2 { font-size: clamp(24px, 3.4vw, 50px); margin: 14px 0 18px !important; line-height: .95; }
  .tg-p { color: #c9c9e6; font-size: 16px; line-height: 1.55; max-width: 460px; margin-bottom: 26px !important; }
  .tg-err { margin-top: 16px; font-size: 15px; font-weight: 600; color: var(--mag); }
  .tg-form { display: flex; gap: 14px; align-items: stretch; flex-wrap: wrap; margin-top: 8px; }
  .tg-input { flex: 1 1 260px; min-width: 0; padding: 16px 18px; font: 500 16px var(--f-body); color: var(--fg); background: var(--bg-2); border: 0; border-bottom: 3px solid var(--acid); border-radius: 0; }
  .tg-input::placeholder { color: var(--mut); }

  .tg-compat { max-width: 1240px; margin: 0 auto; padding: 4vw 5vw 6vw; display: grid; grid-template-columns: 1.3fr 1fr; gap: 5vw; align-items: center; }
  .tg-c-num { font-size: clamp(88px, 20vw, 320px); line-height: .85; transform: rotate(-3deg); transform-origin: left; display: block; margin-top: 10px; }
  .tg-c-side { display: flex; flex-direction: column; gap: 32px; }
  .tg-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .tg-chips span { font: 600 14px var(--f-body); padding: 6px 12px; box-shadow: inset 0 0 0 1px var(--cy); color: var(--cy); }

  .tg-tabs { display: flex; gap: 6px; padding: 0 5vw; max-width: 1240px; margin: 0 auto; flex-wrap: wrap; }
  .tg-tabs button { background: none; border: 0; cursor: pointer; padding: 0; color: var(--mut); font: 700 11px var(--f-head); letter-spacing: .08em; text-transform: uppercase; }
  .tg-tabs button span { display: block; padding: 14px 20px; box-shadow: inset 0 0 0 1px var(--line); transform: skewX(-12deg); transition: background .15s, color .15s; }
  .tg-tabs button:hover { color: var(--fg); }
  .tg-tabs button.on { color: var(--bg); }
  .tg-tabs button.on span { background: var(--acid); box-shadow: none; }

  .tg-list { max-width: 1240px; margin: 0 auto; padding: 18px 5vw 4vw; }
  .tg-item { display: grid; grid-template-columns: 34px 44px 1fr auto; gap: 14px; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--line); }
  .tg-i-n { color: var(--acid); }
  .tg-i-t { font-size: 16px; font-weight: 600; overflow-wrap: break-word; }
  .tg-i-g { font-size: 14px; color: var(--mut); margin-top: 3px; }
  .tg-i-s { display: flex; gap: 14px; align-items: center; text-align: center; flex-shrink: 0; }
  .tg-i-s .t-hud { color: var(--mut); font-size: 9px; }
  .tg-i-s i { width: 1px; height: 30px; background: var(--line); }
  .tg-back { display: flex; justify-content: center; padding: 3vw 5vw 9vw; }

  @media (max-width: 760px) {
    .tg-head { padding-bottom: 30vw; }
    .tg-vs { position: relative; right: auto; bottom: auto; margin-top: 18px; width: fit-content; }
    .tg-step { grid-template-columns: 1fr; gap: 6px; }
    .tg-step2 { margin-left: 0; }
    .tg-n { font-size: 84px; }
    .tg-compat { grid-template-columns: 1fr; }
    .tg-tabs button span { padding: 12px 12px; font-size: 10px; }
    .tg-item { grid-template-columns: 24px 38px 1fr auto; gap: 10px; }
  }

  .tg-note { margin-top: 10px; font-size: 13px; line-height: 1.5; color: var(--mut); max-width: 520px; }
  .tg-how { margin-top: 6vh; padding: 28px 0 0; border-top: 1px solid var(--line); max-width: 760px; }
  .tg-how ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; }
  .tg-how li { font-size: 15px; line-height: 1.6; color: #c9c9e6; padding-left: 18px; position: relative; }
  .tg-how li::before { content: ''; position: absolute; left: 0; top: .7em; width: 8px; height: 3px; background: var(--acid); transform: skewX(-25deg); }
  .tg-how b { color: var(--fg); }
  .tg-c-note { margin-top: 10px; font-size: 14px; line-height: 1.55; color: var(--mut); max-width: 460px; }
  .tg-hint { max-width: 1240px; margin: 0 auto; padding: 18px 5vw 4px; font-size: 14px; line-height: 1.55; color: var(--mut); }
  .tg-i-p { width: 44px; height: 62px; object-fit: cover; flex-shrink: 0; background: var(--bg-2); display: block; }
  .tg-i-p0 { border: 1px solid var(--line); }
  .tg-i-why { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .tg-i-why span { font: 700 11px var(--f-body); letter-spacing: .02em; color: var(--bg); background: var(--acid); padding: 3px 8px; transform: skewX(-8deg); }
  .tg-i-why span:nth-child(2) { background: var(--cy); }
  .tg-i-why span:nth-child(3) { background: var(--mag); color: var(--fg); }
`
