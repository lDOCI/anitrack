import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { Poster } from './SearchModal.jsx'
import { quickMatch, prefetchMatches, searchAnime, groupByRelations, buildEntry, displayTitle, formatLabel } from '../data/index.js'
import { parseLines } from './importParse.js'
import { knownEntries, isKnown, applyGrouping } from './util.js'

const BATCH = 6
const PAUSE_MS = 0
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const PART_RE = /(?:част[ьи]|part|cour)\s*(?:2|ii)(?![\p{L}\p{N}])/iu
const hasPart2 = (t) => [t.titleRuLicense, t.titleRu, t.titleEn, t.titleRomaji, ...(t.synonyms || [])].some(n => n && PART_RE.test(n))

const describe = (l) => `${l.title}${l.season ? ` ${l.season} сезон` : ''}${l.hadPart ? ' часть 2' : ''}`
const rawLine = (l) => `${describe(l)}${l.score ? ` ${l.score}/10` : ''}`

async function matchLine(l) {
  // lists copied from animego carry the romaji title: an exact name match beats any Russian guesswork
  if (l.alt) {
    const a = await quickMatch(l.alt)
    if (a && a.score >= 80) return a // a confident romaji match needs no second guess by the Russian title
    const b = await quickMatch(l.title)
    if (a && b) return a.malId === b.malId || a.score >= b.score ? a : b
    return a || b
  }
  const base = l.season && l.season >= 2 ? `${l.title} ${l.season} сезон` : l.title
  if (l.hadPart) {
    const withPart = await quickMatch(`${base} часть 2`)
    if (withPart && hasPart2(withPart)) return withPart
  }
  return quickMatch(base)
}

async function matchWithRetry(l) {
  try { return await matchLine(l) } catch { await sleep(900); return matchLine(l) }
}

function makeEntry(l, t, ser) {
  const seriesKey = ser?.id || `t${t.key}`
  const e = buildEntry(t, { seriesKey, franchiseId: ser?.id || null })
  const isTv = e.kind === 'tv'
  let status = l.statusExplicit ? l.status : 'completed'
  if (!l.statusExplicit && t.status === 'RELEASING') status = 'watching'
  e.status = status
  e.score = typeof l.score === 'number' ? l.score : null
  e.ep = l.ep != null ? Math.min(l.ep, t.episodes || l.epTotal || l.ep) : status === 'completed' ? (t.episodes || 0) : 0
  if (status === 'completed' && (t.episodes || l.epTotal)) e.ep = t.episodes || l.epTotal
  if (!e.seasonLabel && isTv && l.season) e.seasonLabel = `Сезон ${l.season}${l.hadPart ? ' · часть 2' : ''}`
  else if (!e.seasonLabel && isTv && l.hadPart) e.seasonLabel = 'Сезон 1 · часть 2'
  if (isTv && e.season == null) e.season = l.season || 1
  return e
}

function dedupe(entries) {
  const ids = new Set(), keys = new Set()
  return entries.filter(e => {
    if (e.shikiId) { if (ids.has(e.shikiId)) return false; ids.add(e.shikiId) }
    if (e.seasonLabel) { const k = `${e.seriesKey}__${e.seasonLabel}`; if (keys.has(k)) return false; keys.add(k) }
    return true
  })
}

/** Inline search to replace a wrong match (or find a title that wasn't found). */
function Picker({ initial, onPick, onCancel }) {
  const [q, setQ] = useState(initial)
  const [res, setRes] = useState(null)
  const reqRef = useRef(0)

  useEffect(() => {
    const id = ++reqRef.current
    const text = q.trim()
    if (text.length < 2) return
    const t = setTimeout(async () => {
      let out = []
      try { out = await searchAnime(text, { limit: 6 }) } catch { out = [] }
      if (id === reqRef.current) setRes(out)
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="tk-pick">
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="tk-input" value={q} onChange={e => { setQ(e.target.value); setRes(null) }} autoFocus aria-label="Название для поиска" />
        <button type="button" className="btn ghost sm" onClick={onCancel}>Отмена</button>
      </div>
      {res === null && q.trim().length >= 2 && <div className="tk-muted" style={{ padding: '10px 2px' }}>Ищем…</div>}
      {res && res.length === 0 && <div className="tk-muted" style={{ padding: '10px 2px' }}>Ничего. Попробуй английское или оригинальное название.</div>}
      {res && res.map(r => (
        <button key={r.key} type="button" className="tk-res" onClick={() => onPick(r)}>
          <Poster src={r.poster} w={36} h={52} title={displayTitle(r)} />
          <span className="tk-res-main">
            <span className="tk-res-title" style={{ fontSize: 14 }}>{displayTitle(r)}</span>
            <span className="tk-res-sub">{[r.titleEn || r.titleRomaji, r.year, formatLabel(r.format), r.episodes ? `${r.episodes} эп.` : null].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

export default function ImportModal({ list = [], onClose, onImport }) {
  const [text, setText] = useState('')
  const [phase, setPhase] = useState('input') // input | running | review
  const [rows, setRows] = useState([])        // { ...line, state, t, include }
  const [stage, setStage] = useState('')
  const [pre, setPre] = useState({ d: 0, t: 0 }) // progress of the batched first pass
  const [open, setOpen] = useState(null)      // row index with the picker open
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)
  const alive = useRef(true)
  const cancelled = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; cancelled.current = true }
  }, [])

  const parsed = useMemo(() => parseLines(text), [text])
  const known = useMemo(() => knownEntries(list), [list])
  // a matched title that is already in the list (same MAL id, or same name for old entries without an id)
  const isDup = (t, l) => isKnown(known, { malId: t.malId, titles: [displayTitle(t), t.titleRu, t.titleEn, t.titleRomaji, t.titleNative, l?.title] })
  const running = phase === 'running'
  const patch = (i, p) => { if (alive.current) setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r))) }

  async function search() {
    const lines = parseLines(text)
    if (!lines.length || running) return
    cancelled.current = false
    setRows(lines.map(l => ({ ...l, state: 'pending', t: null, include: true })))
    setStage('Ищу тайтлы')
    setPhase('running')

    const run = async (idxs) => {
      idxs.forEach(i => patch(i, { state: 'searching' }))
      await Promise.all(idxs.map(async (i) => {
        try {
          const t = await matchWithRetry(lines[i])
          if (t) patch(i, { state: 'found', t, dup: isDup(t, lines[i]), include: !isDup(t, lines[i]) })
          else patch(i, { state: cancelled.current ? 'pending' : 'notfound' })
        } catch { patch(i, { state: 'error' }) }
      }))
    }

    try {
      // one pass of batched Shikimori searches warms the cache; the per-line matching below then mostly just reads it
      setStage('Быстрый поиск')
      await prefetchMatches(lines.map(l => l.alt || (l.season && l.season >= 2 ? `${l.title} ${l.season} сезон` : l.title)), { onProgress: (d, t) => { if (alive.current) setPre({ d, t }) } })
      setStage('Сопоставляю')
      for (let b = 0; b < lines.length && !cancelled.current; b += BATCH) {
        await run(lines.slice(b, b + BATCH).map((_, k) => b + k))
        if (b + BATCH < lines.length && !cancelled.current) await sleep(PAUSE_MS)
      }
      // second pass for misses: most are rate limits that have recovered by now
      if (!cancelled.current && alive.current) {
        setStage('Повторяю не найденные')
        await sleep(600)
        const misses = []
        setRows(prev => { prev.forEach((r, i) => { if (r.state === 'notfound' || r.state === 'error') misses.push(i) }); return prev })
        for (const i of misses) {
          if (cancelled.current) break
          await run([i])
          await sleep(500)
        }
      }
    } catch { /* never throw to the page */ }
    if (alive.current) { setStage(''); setPhase('review') }
  }

  const included = rows.filter(r => r.t && r.include)
  const missed = rows.filter(r => !r.t)
  const finished = rows.filter(r => r.state !== 'pending' && r.state !== 'searching').length

  async function addAll() {
    if (!included.length || adding) return
    setAdding(true)
    // seasons are stacked in the background by the list page (it resolves franchises for entries without one)
    const entries = []
    for (const r of included) {
      try { entries.push(makeEntry(r, r.t, null)) } catch { /* skip a broken row */ }
    }
    // stack seasons / movies by franchise now (a few bulk requests), joining stacks the list already has
    let grouped = entries
    try {
      const groups = await groupByRelations([...entries, ...list].map(e => e.shikiId).filter(Boolean))
      grouped = applyGrouping(entries, list, groups)
    } catch { /* the list page will group them in the background */ }
    const final = dedupe(grouped)
    if (alive.current) {
      try { if (final.length) onImport?.(final) } catch { /* the page must not break the modal */ }
      onClose()
    }
  }

  const missedText = missed.map(rawLine).join('\n')
  async function copyMissed() {
    try { await navigator.clipboard.writeText(missedText); setCopied(true); setTimeout(() => { if (alive.current) setCopied(false) }, 1800) } catch { setCopied(false) }
  }

  let footer
  if (phase === 'input') {
    footer = (
      <>
        <button type="button" className="btn ghost sm" onClick={onClose}>Отмена</button>
        <button type="button" className="btn sm" onClick={search} disabled={!parsed.length} style={!parsed.length ? { opacity: .35, pointerEvents: 'none' } : undefined}>
          Найти ({parsed.length})
        </button>
      </>
    )
  } else if (running) {
    footer = (
      <>
        <span className="tk-muted" style={{ flex: 1 }}>Дальше можно будет проверить совпадения</span>
        <button type="button" className="btn ghost sm" onClick={() => { cancelled.current = true; setStage('Останавливаю') }}>Остановить поиск</button>
      </>
    )
  } else {
    footer = (
      <>
        <button type="button" className="btn ghost sm" onClick={() => { setPhase('input'); setRows([]); setOpen(null) }}>Назад</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={addAll} disabled={!included.length || adding} style={!included.length ? { opacity: .4, pointerEvents: 'none' } : undefined}>
          {adding ? 'Группирую сезоны…' : `Добавить в список · ${included.length}`}
        </button>
      </>
    )
  }

  return (
    <Modal title="Импорт текстом" jp="テキストインポート" onClose={onClose} locked={running || adding} wide footer={footer}>
      {phase === 'input' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="tk-hint">
            Каждая строка — одно аниме. Можно писать сезон, оценку и статус:<br />
            <b>Атака титанов 3 сезон 9/10</b> · <b>Тетрадь смерти — 9/10</b><br />
            Теги: <b>дроп</b>, <b>смотрю</b>, <b>план</b>. «Часть 2» понимается как продолжение сезона.
            Перед добавлением ты увидишь, что с чем сопоставилось, и сможешь поправить.
          </div>
          <div>
            <label className="tk-label" htmlFor="import-text">Список аниме</label>
            <textarea id="import-text" className="tk-textarea" rows={9} autoFocus value={text} onChange={e => setText(e.target.value)}
              placeholder={'Атака титанов 3 сезон 9/10\nТетрадь смерти — 9/10\nФрирен\nВинланд сага смотрю'} />
          </div>
          <div className="tk-muted" aria-live="polite">{parsed.length ? `Распознано строк: ${parsed.length}` : 'Вставьте список — по одному аниме в строке'}</div>
        </div>
      )}

      {phase !== 'input' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {running ? (
              <>
                <span className="t-hud" style={{ color: 'var(--acid)' }}>{stage || 'Ищу тайтлы'}</span>
                <span>Обработано {stage === 'Быстрый поиск' && pre.t ? pre.d : finished} из {stage === 'Быстрый поиск' && pre.t ? pre.t : rows.length}</span>
              </>
            ) : (
              <>
                <span className="t-head" style={{ fontSize: 22, letterSpacing: '-.03em' }}>Найдено {rows.length - missed.length} из {rows.length}</span>
                <span className="tk-muted">Проверь совпадения. «Не то?» заменит тайтл, галочка убирает строку из импорта. Тайтлы, которые уже есть в списке, отключены.</span>
              </>
            )}
          </div>
          <div style={{ height: 6, background: 'var(--line)' }} aria-hidden="true">
            <div style={{ height: '100%', width: `${stage === 'Быстрый поиск' && pre.t ? (pre.d / pre.t) * 100 : rows.length ? (finished / rows.length) * 100 : 0}%`, background: 'var(--acid)', transition: 'width .25s' }} />
          </div>

          <ul aria-label="Результаты по строкам" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {rows.map((r, i) => (
              <li key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', opacity: r.t && !r.include ? .45 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {phase === 'review' && r.t ? (
                    <input type="checkbox" className="tk-imp-check" checked={r.include} onChange={e => patch(i, { include: e.target.checked })} aria-label={`Добавить: ${describe(r)}`} />
                  ) : (
                    <span className="tk-chip outline" style={{ '--c': r.state === 'found' ? 'var(--acid)' : r.state === 'searching' ? 'var(--cy)' : r.state === 'pending' ? 'var(--mut)' : 'var(--mag)', minWidth: 92, justifyContent: 'center' }}>
                      {{ pending: 'Ждёт', searching: 'Поиск', found: 'Найдено', notfound: 'Не найдено', error: 'Ошибка' }[r.state]}
                    </span>
                  )}
                  {r.t && <Poster src={r.t.poster} w={34} h={48} title={displayTitle(r.t)} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={describe(r)}>{describe(r)}</div>
                    {r.t ? (
                      <div className="tk-muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        → {displayTitle(r.t)}{r.t.year ? ` · ${r.t.year}` : ''}{r.t.format ? ` · ${formatLabel(r.t.format)}` : ''}
                        {r.dup && <span className="tk-chip outline" style={{ '--c': 'var(--cy)', marginLeft: 8 }}>уже в списке</span>}
                      </div>
                    ) : phase === 'review' ? <div className="tk-muted" style={{ fontSize: 12, color: 'var(--mag)' }}>не нашлось, поищи вручную</div> : null}
                  </div>
                  {phase === 'review' && (
                    <button type="button" className="btn ghost sm" onClick={() => setOpen(open === i ? null : i)}>{r.t ? 'Не то?' : 'Найти'}</button>
                  )}
                </div>
                {open === i && (
                  <Picker initial={r.title}
                    onCancel={() => setOpen(null)}
                    onPick={(t) => { patch(i, { t, state: 'found', dup: isDup(t, r), include: !isDup(t, r) }); setOpen(null) }} />
                )}
              </li>
            ))}
          </ul>

          {phase === 'review' && missed.length > 0 && (
            <div>
              <button type="button" className="btn ghost sm" onClick={copyMissed}>{copied ? 'Скопировано' : 'Скопировать не найденные'}</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
