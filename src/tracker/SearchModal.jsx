import { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { searchAnime, displayTitle, formatLabel, countdown } from '../data/index.js'

const STATUS_NOTE = {
  RELEASING: { t: 'Онгоинг', c: 'var(--acid)' },
  NOT_YET_RELEASED: { t: 'Анонс', c: 'var(--cy)' },
  CANCELLED: { t: 'Отменён', c: 'var(--mag)' },
}

export function Poster({ src, w = 52, h = 74, title }) {
  return src
    ? <img src={src} alt={title || ''} loading="lazy" style={{ width: w, height: h, objectFit: 'cover', objectPosition: 'top', flexShrink: 0, background: 'var(--bg)' }} />
    : <div aria-hidden="true" style={{ width: w, height: h, flexShrink: 0, background: 'var(--bg)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--mut)', fontFamily: 'var(--f-jp)', fontWeight: 900, fontSize: Math.round(w / 2.4) }}>ア</div>
}

export default function SearchModal({ onClose, onSelect }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [state, setState] = useState('idle') // idle | loading | done
  const reqRef = useRef(0)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const text = q.trim()
    const id = ++reqRef.current
    if (text.length < 2) return
    const t = setTimeout(async () => {
      setState('loading')
      let res = []
      try { res = await searchAnime(text, { limit: 10 }) } catch { res = [] }
      if (id !== reqRef.current) return // a newer query is in flight
      setResults(res)
      setState('done')
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  return (
    <Modal title="Добавить аниме" jp="検索 · поиск" onClose={onClose} wide>
      <label className="tk-label" htmlFor="tk-q">Название на русском, английском или romaji, можно с номером сезона</label>
      <input
        id="tk-q" ref={inputRef} className="tk-input" value={q} onChange={e => setQ(e.target.value)}
        placeholder="магическая битва 2 сезон, aot, sao, твоё имя…" autoComplete="off"
      />

      <div className="tk-results" aria-live="polite">
        {(q.trim().length < 2 || state === 'idle') && <p className="tk-muted tk-empty">Введи хотя бы 2 символа. Ищем сразу в Shikimori и AniList, понимаем сокращения и опечатки.</p>}
        {q.trim().length >= 2 && state === 'loading' && <p className="tk-muted tk-empty">Ищем…</p>}
        {q.trim().length >= 2 && state === 'done' && results.length === 0 && <p className="tk-muted tk-empty">Ничего не нашлось. Попробуй английское или оригинальное название.</p>}

        {q.trim().length >= 2 && results.map(r => {
          const note = STATUS_NOTE[r.status]
          const next = r.nextEp?.at ? countdown(r.nextEp.at) : null
          const sub = [r.titleEn, r.titleRomaji].filter((x, i, a) => x && a.indexOf(x) === i && x !== displayTitle(r)).join(' · ')
          return (
            <button key={r.key} className="tk-res" onClick={() => onSelect(r)}>
              <Poster src={r.poster} title={displayTitle(r)} />
              <span className="tk-res-main">
                <span className="tk-res-title">{displayTitle(r)}</span>
                {sub && <span className="tk-res-sub">{sub}</span>}
                <span className="tk-res-meta">
                  <span className="tk-chip outline" style={{ '--c': 'var(--fg)' }}>{formatLabel(r.format)}</span>
                  {r.year && <span className="tk-muted">{r.year}</span>}
                  <span className="tk-muted">{r.episodes ? `${r.episodes} эп.` : '? эп.'}</span>
                  {note && <span className="tk-chip outline" style={{ '--c': note.c }}>{note.t}{next ? ` · ${next}` : ''}</span>}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
