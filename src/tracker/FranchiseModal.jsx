import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { Poster } from './SearchModal.jsx'
import { getFranchise, buildEntry, displayTitle, formatLabel, countdown } from '../data/index.js'

const ROLE_COLOR = {
  season: 'var(--acid)', short: '#9aa3ff', movie: 'var(--cy)', ova: 'var(--mag)', special: '#c9c9e6', ona: '#9aa3ff', spinoff: '#ff9d4d', side: '#ff9d4d',
}

function statusText(e) {
  if (e.status === 'RELEASING') {
    const n = e.nextEp
    return n ? `Онгоинг · серия ${n.episode} ${countdown(n.at)}` : 'Онгоинг'
  }
  if (e.status === 'NOT_YET_RELEASED') return 'Анонс'
  if (e.status === 'CANCELLED') return 'Отменён'
  return null
}

function Row({ e, checked, added, onToggle }) {
  const st = statusText(e)
  const name = displayTitle(e)
  return (
    <label className={`tk-fr-row${added ? ' added' : ''}${checked ? ' on' : ''}`}>
      <input type="checkbox" checked={checked || added} disabled={added} onChange={onToggle} />
      <span className="tk-fr-box" aria-hidden="true">{(checked || added) ? '✓' : ''}</span>
      <Poster src={e.poster} w={40} h={56} title={name} />
      <span className="tk-fr-main">
        <span className="tk-fr-line">
          <span className="tk-chip solid" style={{ '--c': ROLE_COLOR[e.role] || 'var(--fg)' }}>{e.label}</span>
          {e.format && e.role !== 'season' && <span className="tk-muted">{formatLabel(e.format)}</span>}
          {added && <span className="tk-chip outline" style={{ '--c': 'var(--cy)' }}>в списке</span>}
        </span>
        <span className="tk-fr-name">{name}</span>
        <span className="tk-muted tk-fr-meta">
          {[e.year, e.episodes ? `${e.episodes} эп.` : '? эп.', st].filter(Boolean).join(' · ')}
        </span>
      </span>
    </label>
  )
}

export default function FranchiseModal({ seed, list, onClose, onAdd }) {
  const [fr, setFr] = useState(undefined) // undefined = loading, null = unavailable
  const [sel, setSel] = useState(() => new Set())

  useEffect(() => {
    let dead = false
    getFranchise({ malId: seed.malId, anilistId: seed.anilistId })
      .then(f => { if (!dead) setFr(f) })
      .catch(() => { if (!dead) setFr(null) })
    return () => { dead = true }
  }, [seed])

  const entries = useMemo(() => {
    if (fr === undefined) return []
    if (fr) return fr.entries
    const solo = seed.format === 'TV' || !seed.format
    return [{ ...seed, role: solo ? 'season' : (seed.format || 'special').toLowerCase(), seasonNum: solo ? 1 : null, label: solo ? 'Сезон 1' : formatLabel(seed.format) }]
  }, [fr, seed])

  const have = useMemo(() => new Set(list.map(a => String(a.shikiId))), [list])
  const isAdded = (e) => !!e.malId && have.has(String(e.malId))
  const idOf = (e) => e.key

  // preselect the title the user picked (when it isn't in the list yet)
  useEffect(() => {
    if (!entries.length) return
    const me = entries.find(e => e.key === seed.key || (e.anilistId && e.anilistId === seed.anilistId))
    setSel(me && !isAdded(me) ? new Set([idOf(me)]) : new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, seed])

  const commit = (picked) => {
    const members = new Set((fr?.memberMalIds || [seed.malId]).filter(Boolean).map(String))
    const anchor = list.find(a => a.shikiId && members.has(String(a.shikiId)))
    const seriesKey = anchor?.seriesKey || fr?.id || `t${seed.key}`
    const franchiseId = anchor ? (anchor.franchiseId || null) : (fr?.id || null)
    onAdd(picked.map(e => buildEntry(e, { seriesKey, franchiseId })))
  }

  // a title with no seasons/movies around it: nothing to choose, add straight away
  useEffect(() => {
    if (fr === undefined) return
    if (entries.length === 1 && !isAdded(entries[0])) commit([entries[0]])
    else if (entries.length === 1) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fr])

  const toggle = (e) => setSel(prev => { const n = new Set(prev); n.has(idOf(e)) ? n.delete(idOf(e)) : n.add(idOf(e)); return n })
  const pick = (pred) => setSel(new Set(entries.filter(e => !isAdded(e) && pred(e)).map(idOf)))

  const sections = [
    { name: 'Сезоны', items: entries.filter(e => e.role === 'season') },
    { name: 'Фильмы', items: entries.filter(e => e.role === 'movie') },
    { name: 'OVA, спешлы, спин-оффы', items: entries.filter(e => !['season', 'movie'].includes(e.role)) },
  ].filter(s => s.items.length)

  const picked = entries.filter(e => sel.has(idOf(e)) && !isAdded(e))
  const head = entries.find(e => e.role === 'season') || entries[0]
  const loading = fr === undefined

  return (
    <Modal
      title={fr?.name || displayTitle(seed)} jp="シーズン · сезоны и фильмы" onClose={onClose} wide
      footer={!loading && entries.length > 1 && (
        <>
          <button className="btn ghost sm" onClick={() => pick(() => true)}>Всё</button>
          <button className="btn ghost sm" onClick={() => pick(e => e.role === 'season')}>Все сезоны</button>
          <button className="btn ghost sm" onClick={() => setSel(new Set())}>Сбросить</button>
          <span style={{ flex: 1 }} />
          <button className="btn" disabled={!picked.length} style={{ opacity: picked.length ? 1 : .4 }} onClick={() => { commit(picked); onClose() }}>
            Добавить{picked.length ? ` · ${picked.length}` : ''}
          </button>
        </>
      )}
    >
      {loading && (
        <div className="tk-empty">
          <div className="t-hud" style={{ color: 'var(--acid)' }}>// собираем франшизу…</div>
          <p className="tk-muted">Сезоны, фильмы и OVA из Shikimori и AniList</p>
        </div>
      )}

      {!loading && entries.length > 1 && (
        <p className="tk-hint" style={{ marginBottom: 18 }}>
          {head && <><b>{displayTitle(head)}</b>: {entries.filter(e => e.role === 'season').length} сез., {entries.filter(e => e.role === 'movie').length} фильм., {entries.filter(e => !['season', 'movie'].includes(e.role)).length} др.</>}
          {' '}Отметь, что добавить в список.
        </p>
      )}

      {!loading && sections.map(s => (
        <div key={s.name} style={{ marginBottom: 20 }}>
          <span className="tk-label">{s.name} · {s.items.length}</span>
          <div className="tk-fr-list">
            {s.items.map(e => <Row key={e.key} e={e} checked={sel.has(idOf(e))} added={isAdded(e)} onToggle={() => toggle(e)} />)}
          </div>
        </div>
      ))}
    </Modal>
  )
}
