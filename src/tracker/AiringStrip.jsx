import { Poster } from './SearchModal.jsx'
import { airingInfo } from '../data/index.js'
import { epCap } from './util.js'

/** "Выходит сейчас": what you're watching that is still airing, soonest episode first. */
export default function AiringStrip({ list, now, onPlus, onEdit }) {
  const items = list
    .filter(e => e.status === 'watching')
    .map(e => ({ e, info: airingInfo(e, now) }))
    .filter(x => x.info.state === 'airing')
    .sort((a, b) => (a.info.next?.at ?? Infinity) - (b.info.next?.at ?? Infinity))

  if (!items.length) return null
  return (
    <section className="tk-strip" aria-label="Выходит сейчас">
      <div className="t-hud tk-strip-h">// выходит сейчас · {items.length}</div>
      <div className="tk-strip-row">
        {items.map(({ e, info }, i) => (
          <article key={e.id} className="tk-air-card" style={{ transform: `rotate(${i % 2 ? .8 : -.8}deg)` }} onClick={() => onEdit([e], 0)}>
            <Poster src={e.poster} w={64} h={90} title={e.title} />
            <div className="tk-air-main">
              <div className="tk-air-title">{e.title}</div>
              <div className="tk-air-ep">
                {info.next ? <>Серия {info.next.episode || '?'}</> : 'Онгоинг'}
              </div>
              {info.next && <div className="tk-air-when"><b>{info.next.in}</b>{info.next.day ? ` · ${info.next.day}` : ''}</div>}
              <div className="tk-air-actions">
                <span className="tk-muted">{e.ep || 0}/{info.aired ?? '?'}</span>
                {info.behind > 0
                  ? <span className="tk-chip solid" style={{ '--c': 'var(--acid)' }}>отстал на {info.behind}</span>
                  : <span className="tk-chip outline" style={{ '--c': 'var(--cy)' }}>в курсе</span>}
                {(e.ep || 0) < epCap(e) && (
                  <button className="btn sm tk-plus" onClick={ev => { ev.stopPropagation(); onPlus(e.id) }} aria-label={`+1 серия: ${e.title}`}>+1</button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
