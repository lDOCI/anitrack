import { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { Poster } from './SearchModal.jsx'
import { STATUS_META } from './constants.js'
import { typeLabel, epCap } from './util.js'
import { airingInfo, quickMatch, buildEntry } from '../data/index.js'

export default function EditModal({ entries, initialIdx = 0, onClose, onSave, onDelete, onAddFromFranchise, onUpdateEntry }) {
  const [idx, setIdx] = useState(initialIdx)
  const [vals, setVals] = useState(() => Object.fromEntries(entries.map(e => [e.id, { score: e.score || 0, status: e.status || 'planned', ep: e.ep || 0 }])))
  const [draft, setDraft] = useState(null) // raw text while typing in the episode box
  const [linkDone, setLinkDone] = useState(() => new Set())
  const triedLink = useRef(new Set())

  const anime = entries[idx]
  const v = (anime && vals[anime.id]) || { score: 0, status: 'planned', ep: 0 }
  const setV = (patch) => setVals(prev => ({ ...prev, [anime.id]: { ...prev[anime.id], ...patch } }))

  // entries added from an old text import have no MAL id: try to link them once so airing + seasons work
  useEffect(() => {
    if (!anime || anime.shikiId || triedLink.current.has(anime.id)) return
    triedLink.current.add(anime.id)
    let dead = false
    quickMatch(anime.title).then(t => {
      if (dead || !t) return
      const fresh = buildEntry(t)
      onUpdateEntry({
        ...anime,
        shikiId: fresh.shikiId, anilistId: fresh.anilistId, poster: anime.poster || fresh.poster,
        titleJp: anime.titleJp || fresh.titleJp, epTotal: anime.epTotal || fresh.epTotal, epAired: fresh.epAired,
        isOngoing: fresh.isOngoing, nextEpisodeAt: fresh.nextEpisodeAt, nextEp: fresh.nextEp,
        genres: anime.genres?.length ? anime.genres : fresh.genres, studio: anime.studio && anime.studio !== '—' ? anime.studio : fresh.studio,
        year: anime.year || fresh.year, format: fresh.format,
      })
    }).catch(() => {}).finally(() => { if (!dead) setLinkDone(prev => new Set(prev).add(anime.id)) })
    return () => { dead = true }
  }, [anime, onUpdateEntry])

  if (!anime) return null
  const linking = !anime.shikiId && !linkDone.has(anime.id)
  const live = { ...anime, ep: v.ep }
  const info = airingInfo(live)
  const cap = epCap(anime)

  const saveAll = () => {
    for (const e of entries) {
      const ev = vals[e.id]
      if (ev) onSave({ ...e, score: ev.score || null, status: ev.status, ep: ev.ep })
    }
  }
  const close = () => { saveAll(); onClose() }
  const head = entries[0]

  return (
    <Modal
      title={head.title} jp={head.titleJp || '編集 · правка'} onClose={close}
      footer={(
        <>
          <button className="btn ghost sm" style={{ color: 'var(--mag)', boxShadow: 'inset 0 0 0 2px var(--mag)' }}
            onClick={() => { if (confirm(`Удалить «${typeLabel(anime)} — ${anime.title}»?`)) { onDelete(anime.id); onClose() } }}>Удалить</button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={close}>Сохранить</button>
        </>
      )}
    >
      <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
        <Poster src={anime.poster} w={84} h={120} title={anime.title} />
        <div style={{ minWidth: 0 }}>
          <div className="t-hud" style={{ color: 'var(--acid)', marginBottom: 6 }}>{typeLabel(anime)}{anime.year ? ` · ${anime.year}` : ''}</div>
          {entries.length > 1 && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{anime.title}</div>}
          <div className="tk-muted">{[anime.studio !== '—' && anime.studio, (anime.genres || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ')}</div>
          {linking && <div className="t-hud" style={{ color: 'var(--cy)', marginTop: 8 }}>// ищем в базе…</div>}
          {info.state === 'airing' && (
            <div style={{ marginTop: 10, fontSize: 13 }}>
              <span className="tk-chip solid" style={{ '--c': 'var(--acid)' }}>Онгоинг</span>
              {info.next && <span style={{ marginLeft: 10 }}>серия {info.next.episode || '?'} {info.next.in}{info.next.day ? ` · ${info.next.day}` : ''}</span>}
            </div>
          )}
        </div>
      </div>

      {entries.length > 1 && (
        <div className="tk-tabs" role="tablist">
          {entries.map((e, i) => (
            <button key={e.id} role="tab" aria-selected={i === idx} className={i === idx ? 'on' : ''} onClick={() => { setDraft(null); setIdx(i) }}>
              <i style={{ background: STATUS_META[vals[e.id]?.status || e.status]?.color }} />{typeLabel(e)}
            </button>
          ))}
          {onAddFromFranchise && <button onClick={() => { saveAll(); onClose(); onAddFromFranchise(entries[0]) }} title="Добавить сезон или фильм">＋</button>}
        </div>
      )}

      <span className="tk-label">Статус</span>
      <div className="tk-status-grid">
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <button key={key} className={v.status === key ? 'on' : ''} style={{ '--c': meta.color }}
            onClick={() => {
              const patch = { status: key }
              if (key === 'completed' && anime.epTotal) patch.ep = anime.epTotal
              if (key === 'planned') patch.ep = 0
              setV(patch)
            }}>
            <span className="t-jp">{meta.jp}</span>{meta.label}
          </button>
        ))}
      </div>

      <span className="tk-label" style={{ marginTop: 22 }}>Оценка {v.score > 0 ? `· ${v.score}/10` : '· не выставлена'}</span>
      <div className="tk-score">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button key={n} className={v.score >= n ? 'on' : ''} aria-label={`Оценка ${n}`} onClick={() => setV({ score: v.score === n ? 0 : n })}>{n}</button>
        ))}
      </div>

      <span className="tk-label" style={{ marginTop: 22 }}>
        Прогресс{anime.isOngoing && info.aired != null ? ` · вышло ${info.aired} из ${anime.epTotal || '?'}` : anime.epTotal ? ` · всего ${anime.epTotal}` : ''}
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <button className="tk-step" aria-label="Минус серия" onClick={() => { setDraft(null); setV({ ep: Math.max(0, v.ep - 1) }) }}>−</button>
        <input className="tk-input" type="text" inputMode="numeric" autoComplete="off" aria-label="Просмотрено серий"
          value={draft ?? String(v.ep)}
          style={{ textAlign: 'center', fontFamily: 'var(--f-head)', fontWeight: 900, fontSize: 20 }}
          onFocus={e => e.target.select()}
          onChange={e => {
            let raw = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 5)
            if (raw !== '' && cap < 9999 && Number(raw) > cap) raw = String(cap)
            setDraft(raw)
            if (raw !== '') setV({ ep: Math.min(cap, Number(raw)) })
          }}
          onBlur={() => { if (draft === '') setV({ ep: 0 }); setDraft(null) }} />
        <button className="tk-step" aria-label="Плюс серия" onClick={() => { setDraft(null); setV({ ep: Math.min(cap, v.ep + 1) }) }}>+</button>
        {cap < 9999 && <button className="btn ghost sm" onClick={() => { setDraft(null); setV({ ep: cap, ...(anime.epTotal && cap >= anime.epTotal ? { status: 'completed' } : {}) }) }}>Все</button>}
      </div>
      {info.behind > 0 && info.state === 'airing' && <p className="tk-muted" style={{ marginTop: 10 }}>Отстаёшь на {info.behind} {info.behind === 1 ? 'серию' : 'серий'}.</p>}
    </Modal>
  )
}
