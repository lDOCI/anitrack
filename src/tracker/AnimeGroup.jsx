import { useState } from 'react'
import { Poster } from './SearchModal.jsx'
import { STATUS_META } from './constants.js'
import { typeLabel, stackHead, epCap } from './util.js'
import { airingInfo } from '../data/index.js'

/** Episode progress: one skewed segment per episode (<=26), a bar for long runs. Hollow = aired, not watched yet. */
export function Progress({ entry, now }) {
  const info = airingInfo(entry, now)
  const total = entry.epTotal || info.aired || 0
  const color = STATUS_META[entry.status]?.color
  if (!total) return <span className="tk-muted">{entry.ep || 0} эп.</span>
  if (total > 26) {
    const w = Math.min(100, ((entry.ep || 0) / total) * 100)
    const a = info.aired != null ? Math.min(100, (info.aired / total) * 100) : 0
    return (
      <div className="tk-bar" style={{ '--c': color }} role="img" aria-label={`${entry.ep || 0} из ${total}`}>
        {a > w && <i className="a" style={{ width: `${a}%` }} />}
        <i style={{ width: `${w}%` }} />
      </div>
    )
  }
  return (
    <div className="tk-seg" style={{ gridTemplateColumns: `repeat(${total}, 1fr)`, '--c': color }} role="img" aria-label={`${entry.ep || 0} из ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < (entry.ep || 0) ? 'f' : info.aired != null && i < info.aired ? 'a' : ''} />
      ))}
    </div>
  )
}

export function AiringLine({ entry, now }) {
  const info = airingInfo(entry, now)
  if (entry.status === 'completed' || entry.status === 'dropped') return null
  if (info.state === 'upcoming') return <span className="tk-air up">Анонс{info.next ? ` · ${info.next.in}` : ''}</span>
  if (info.state !== 'airing') return null
  return (
    <span className="tk-air">
      {info.next
        ? <>Серия {info.next.episode || '?'} <b>{info.next.in}</b>{info.next.day ? ` · ${info.next.day}` : ''}</>
        : 'Онгоинг'}
      {info.behind > 0 && entry.status === 'watching' && <em>отстал на {info.behind}</em>}
    </span>
  )
}

function PlusOne({ entry, onPlus }) {
  if (entry.status === 'completed' || entry.status === 'dropped') return null
  if ((entry.ep || 0) >= epCap(entry)) return null
  return (
    <button className="btn sm tk-plus" onClick={ev => { ev.stopPropagation(); onPlus(entry.id) }} aria-label={`+1 серия: ${entry.title}`}>+1</button>
  )
}

function StatusChip({ status }) {
  const m = STATUS_META[status]
  return <span className="tk-chip outline" style={{ '--c': m.color }}><span className="t-jp" style={{ fontSize: 10 }}>{m.jp}</span>{m.label}</span>
}

export default function AnimeGroup({ entries, now, onEdit, onPlus, onAddMore }) {
  const [open, setOpen] = useState(false)
  const head = stackHead(entries)
  const multi = entries.length > 1

  if (!multi) {
    const e = entries[0]
    return (
      <article className="tk-g" onClick={() => onEdit(entries, 0)}>
        <Poster src={e.poster} w={78} h={110} title={e.title} />
        <div className="tk-g-main">
          <div className="tk-g-top">
            <span className="tk-chip solid" style={{ '--c': e.role && e.role !== 'season' ? 'var(--cy)' : 'var(--fg)' }}>{typeLabel(e)}</span>
            {e.isOngoing && <span className="tk-chip outline" style={{ '--c': 'var(--acid)' }}>Онгоинг</span>}
          </div>
          <h3 className="tk-g-title">{e.title}</h3>
          <div className="tk-muted tk-g-sub">{[e.titleRomaji && e.titleRomaji !== e.title && e.titleRomaji, e.studio !== '—' && e.studio, e.year].filter(Boolean).join(' · ')}</div>
          <Progress entry={e} now={now} />
          <div className="tk-g-foot"><span className="tk-muted">{e.ep || 0}{e.epTotal ? ` / ${e.epTotal}` : ''} эп.</span><AiringLine entry={e} now={now} /></div>
        </div>
        <div className="tk-g-right">
          <div className="tk-score-big" data-empty={!e.score}>{e.score || '—'}{e.score ? <small>/10</small> : null}</div>
          <StatusChip status={e.status} />
          <PlusOne entry={e} onPlus={onPlus} />
        </div>
      </article>
    )
  }

  const scored = entries.filter(e => e.score)
  const avg = scored.length ? Math.round(scored.reduce((s, e) => s + e.score, 0) / scored.length * 10) / 10 : null
  const done = entries.filter(e => e.status === 'completed').length
  const watching = entries.find(e => e.status === 'watching')
  const summary = entries.every(e => e.status === 'completed') ? 'completed' : watching ? 'watching' : entries.find(e => e.status !== 'completed')?.status || 'planned'
  const seasons = entries.filter(e => e.role ? e.role === 'season' : e.season).length

  return (
    <article className={`tk-stack${open ? ' open' : ''}`}>
      <div className="tk-g" onClick={() => setOpen(o => !o)} role="button" tabIndex={0} aria-expanded={open}
        onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setOpen(o => !o) } }}>
        <Poster src={head.poster} w={78} h={110} title={head.title} />
        <div className="tk-g-main">
          <div className="tk-g-top">
            {entries.slice(0, 8).map(e => (
              <span key={e.id} className="tk-chip outline" style={{ '--c': STATUS_META[e.status].color }}>{typeLabel(e)}</span>
            ))}
            {entries.length > 8 && <span className="tk-muted">+{entries.length - 8}</span>}
          </div>
          <h3 className="tk-g-title">{head.title}</h3>
          <div className="tk-muted tk-g-sub">{[head.titleRomaji && head.titleRomaji !== head.title && head.titleRomaji, head.studio !== '—' && head.studio, head.year].filter(Boolean).join(' · ')}</div>
          <div className="tk-g-foot">
            <span className="tk-muted">{done} из {entries.length} просмотрено{seasons ? ` · ${seasons} сез.` : ''}</span>
            {watching && <AiringLine entry={watching} now={now} />}
          </div>
        </div>
        <div className="tk-g-right">
          <div className="tk-score-big" data-empty={!avg}>{avg || '—'}{avg ? <small>/10</small> : null}</div>
          <StatusChip status={summary} />
          <span className="tk-caret" aria-hidden="true">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="tk-sub">
          {entries.map((e, i) => (
            <div key={e.id} className="tk-sub-row" onClick={() => onEdit(entries, i)}>
              <span className="tk-chip solid" style={{ '--c': STATUS_META[e.status].color }}>{typeLabel(e)}</span>
              <div className="tk-sub-main">
                {(e.role && e.role !== 'season') && <div className="tk-sub-name">{e.title}</div>}
                <Progress entry={e} now={now} />
                <div className="tk-g-foot"><span className="tk-muted">{e.ep || 0}{e.epTotal ? ` / ${e.epTotal}` : ''} эп.</span><AiringLine entry={e} now={now} /></div>
              </div>
              <span className="tk-sub-score">{e.score ? `${e.score}/10` : '—'}</span>
              <PlusOne entry={e} onPlus={onPlus} />
            </div>
          ))}
          <button className="tk-addmore" onClick={() => onAddMore(head)}>＋ Сезоны, фильмы и OVA этой франшизы</button>
        </div>
      )}
    </article>
  )
}
