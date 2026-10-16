import { useState, useRef, useEffect } from 'react'
import NavBar from '../components/NavBar'

const STORAGE_KEY = 'anitrack_list'

const TIERS = [
  { key: 'S', color: 'var(--mag)', jp: '神' },
  { key: 'A', color: 'var(--acid)', jp: '良' },
  { key: 'B', color: 'var(--cy)', jp: '普' },
  { key: 'C', color: '#7b86ff', jp: '可' },
  { key: 'D', color: '#c3a8ff', jp: '低' },
  { key: 'F', color: '#8d8db3', jp: '糞' },
]

function loadList() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
}

function dedupeList(list) {
  const map = new Map()
  for (const a of list) {
    const key = a.seriesKey || a.titleRomaji || a.title || String(a.id)
    const existing = map.get(key)
    if (!existing || (a.score || 0) > (existing.score || 0)) map.set(key, a)
  }
  return [...map.values()]
}

function makeItems(list) {
  return dedupeList(list).map(a => ({
    id: String(a.id),
    title: a.title,
    poster: a.poster,
    score: a.score,
  }))
}

function scoreToTier(score) {
  if (!score) return null
  if (score >= 9) return 'S'
  if (score >= 7) return 'A'
  if (score >= 6) return 'B'
  if (score >= 5) return 'C'
  if (score >= 4) return 'D'
  return 'F'
}

function buildInitialState(items) {
  const tiers = Object.fromEntries(TIERS.map(t => [t.key, []]))
  const unranked = []
  for (const item of items) {
    const tier = scoreToTier(item.score)
    if (tier) tiers[tier].push(item)
    else unranked.push(item)
  }
  return { tiers, unranked }
}

function encodeHash(tiers, unranked) {
  try {
    const data = {
      t: Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, v.map(i => i.id)])),
      u: unranked.map(i => i.id),
    }
    return btoa(JSON.stringify(data))
  } catch { return '' }
}

function decodeHash(hash, items) {
  try {
    const data = JSON.parse(atob(hash))
    const byId = Object.fromEntries(items.map(i => [i.id, i]))
    const tiers = Object.fromEntries(TIERS.map(t => [t.key, []]))
    for (const [k, ids] of Object.entries(data.t || {})) {
      if (tiers[k] !== undefined) tiers[k] = ids.map(id => byId[id]).filter(Boolean)
    }
    const usedIds = new Set([...Object.values(data.t || {}).flat(), ...(data.u || [])])
    const unranked = [
      ...(data.u || []).map(id => byId[id]).filter(Boolean),
      ...items.filter(i => !usedIds.has(i.id)),
    ]
    return { tiers, unranked }
  } catch { return null }
}

export default function TierList({ navigate }) {
  const list = loadList()
  const allItems = makeItems(list)

  const [state, setState] = useState(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      const decoded = decodeHash(hash, allItems)
      if (decoded) return decoded
    }
    return buildInitialState(allItems)
  })

  const { tiers, unranked } = state
  const [dragging, setDragging] = useState(null)   // { id, fromZone }
  const [overZone, setOverZone] = useState(null)   // zone key
  const dragRef = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const hash = encodeHash(tiers, unranked)
    if (hash) window.history.replaceState(null, '', `#${hash}`)
  }, [tiers, unranked])

  function moveItem(itemId, fromZone, toZone) {
    setState(prev => {
      const nt = Object.fromEntries(Object.entries(prev.tiers).map(([k, v]) => [k, [...v]]))
      let nu = [...prev.unranked]
      let item

      if (fromZone === 'unranked') {
        const idx = nu.findIndex(i => i.id === itemId)
        if (idx === -1) return prev
        ;[item] = nu.splice(idx, 1)
      } else {
        const idx = nt[fromZone]?.findIndex(i => i.id === itemId)
        if (idx == null || idx === -1) return prev
        ;[item] = nt[fromZone].splice(idx, 1)
      }

      if (toZone === 'unranked') nu.push(item)
      else nt[toZone].push(item)

      return { tiers: nt, unranked: nu }
    })
  }

  function onDragStart(e, id, fromZone) {
    dragRef.current = { id, fromZone }
    setDragging({ id, fromZone })
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragEnd() {
    setDragging(null)
    setOverZone(null)
    dragRef.current = null
  }

  function onDrop(e, toZone) {
    e.preventDefault()
    const { id, fromZone } = dragRef.current || {}
    if (!id || fromZone === toZone) { setOverZone(null); return }
    moveItem(id, fromZone, toZone)
    setDragging(null)
    setOverZone(null)
  }

  function share() {
    const url = window.location.href
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const resetBtn = (
    <button className="tl-ghost" onClick={() => setState(buildInitialState(allItems))}>Сброс</button>
  )
  const shareBtn = (
    <button className="btn sm" onClick={share} style={copied ? { background: 'var(--cy)' } : undefined}>
      {copied ? 'Скопировано' : 'Поделиться'}
    </button>
  )

  if (list.length === 0) return (
    <div className="tl">
      <NavBar active="tierlist" onNavigate={navigate} />
      <div className="tl-empty">
        <div className="t-out" style={{ fontSize: 'clamp(64px,16vw,200px)', '--stroke': 'var(--acid)' }}>Пусто</div>
        <div style={{ fontSize: 17, color: 'var(--mut)', margin: '10px 0 30px' }}>Сначала добавь аниме в трекер</div>
        <button className="btn" onClick={() => navigate('tracker')}>← В список</button>
      </div>
      <style>{CSS}</style>
    </div>
  )

  return (
    <div className="tl">
      <NavBar active="tierlist" onNavigate={navigate} rightContent={<>
        <span className="t-hud" style={{ color: 'var(--mut)' }}>{allItems.length} аниме</span>
        {resetBtn}
        {shareBtn}
      </>} />

      <header className="tl-head">
        <div>
          <div className="t-hud" style={{ color: 'var(--acid)' }}>// тир-лист / ティア</div>
          <h1 className="t-head tl-h1">Расставь<br /><span className="t-out">по местам</span></h1>
        </div>
        <div className="tl-head-r">
          <div className="t-impact tl-count">{allItems.length}</div>
          <div className="t-hud" style={{ color: 'var(--mut)' }}>тайтлов в игре</div>
          <div className="tl-mobile-actions">{resetBtn}{shareBtn}</div>
        </div>
      </header>

      <div className="tl-body">
        {TIERS.map(tier => {
          const items = tiers[tier.key] || []
          const isOver = overZone === tier.key
          return (
            <div key={tier.key} className="tl-row" style={{ '--tc': tier.color }}>
              <div className="tl-label">
                <span className="t-impact tl-letter">{tier.key}</span>
                <span className="t-jp tl-jp">{tier.jp}</span>
              </div>
              <div
                className={`dzone ${isOver ? 'ov' : ''}`}
                onDragOver={e => { e.preventDefault(); setOverZone(tier.key) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverZone(null) }}
                onDrop={e => onDrop(e, tier.key)}
              >
                {items.map(item => (
                  <Card key={item.id} item={item}
                    isDragging={dragging?.id === item.id}
                    onDragStart={e => onDragStart(e, item.id, tier.key)}
                    onDragEnd={onDragEnd}
                  />
                ))}
                {items.length === 0 && <div className="tl-hint t-hud">перетащи сюда</div>}
              </div>
            </div>
          )
        })}

        <div className="tl-un-h">
          <span className="t-hud" style={{ color: 'var(--cy)' }}>// не оценено · 未評価</span>
          <i />
        </div>

        <div
          className={`dzone tl-un ${overZone === 'unranked' ? 'ov' : ''}`}
          onDragOver={e => { e.preventDefault(); setOverZone('unranked') }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverZone(null) }}
          onDrop={e => onDrop(e, 'unranked')}
        >
          {unranked.map(item => (
            <Card key={item.id} item={item}
              isDragging={dragging?.id === item.id}
              onDragStart={e => onDragStart(e, item.id, 'unranked')}
              onDragEnd={onDragEnd}
            />
          ))}
          {unranked.length === 0 && <div className="tl-hint t-hud">все аниме распределены</div>}
        </div>

        <div className="t-hud tl-foot">Перетаскивай постеры. «Поделиться» копирует ссылку с твоим тир-листом.</div>
      </div>

      <style>{CSS}</style>
    </div>
  )
}

function Card({ item, isDragging, onDragStart, onDragEnd }) {
  return (
    <div
      className={`tcard ${isDragging ? 'ghost' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={item.title}
    >
      {item.poster
        ? <img src={item.poster} alt={item.title} />
        : <div className="nop">{item.title.slice(0, 14)}</div>
      }
      <div className="tip">{item.title}</div>
    </div>
  )
}

const CSS = `
  .tl { padding-top: 52px; min-height: 100vh; overflow-x: hidden; background: var(--bg); color: var(--fg); }
  .tl *, .tl *::before, .tl *::after { box-sizing: border-box; }
  .tl h1 { margin: 0; }
  .tl-empty { min-height: calc(100vh - 52px); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; }
  .tl button:focus-visible { outline: 3px solid var(--cy); outline-offset: 3px; }
  .tl-ghost { background: none; border: 0; box-shadow: inset 0 0 0 1px var(--line); color: var(--fg); font: 700 10px var(--f-head); letter-spacing: .14em; text-transform: uppercase; padding: 10px 14px; cursor: pointer; transition: background .15s, color .15s; }
  .tl-ghost:hover { background: var(--fg); color: var(--bg); }
  .tl-mobile-actions { display: none; gap: 10px; margin-top: 16px; flex-wrap: wrap; }

  .tl-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; padding: 6vh 5vw 11vh; background: linear-gradient(115deg, var(--bg-2) 0 60%, var(--bg) 60%); clip-path: polygon(0 0, 100% 0, 100% calc(100% - 4vw), 0 100%); margin-bottom: -3vw; }
  .tl-h1 { font-size: clamp(40px, 7.4vw, 120px); margin-top: 16px; }
  .tl-head-r { text-align: right; flex-shrink: 0; }
  .tl-count { font-size: clamp(64px, 11vw, 180px); color: var(--acid); transform: rotate(-3deg); display: block; }

  .tl-body { max-width: 1240px; margin: 0 auto; padding: 4vw 5vw 8vw; }
  .tl-row { display: flex; margin-bottom: 8px; background: var(--bg-2); border-left: 6px solid var(--tc); position: relative; }
  .tl-label { width: 96px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: var(--tc); color: var(--bg); clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%); padding-right: 10px; }
  .tl-letter { font-size: 54px; line-height: 1; letter-spacing: 0; }
  .tl-jp { font-size: 12px; opacity: .85; }
  .dzone { display: flex; flex-wrap: wrap; gap: 10px; flex: 1; padding: 12px 14px; min-height: 126px; align-content: flex-start; transition: background .12s; min-width: 0; }
  .dzone.ov { background: rgba(214,255,31,.08); outline: 2px dashed var(--acid); outline-offset: -4px; }
  .tl-un { background: var(--bg-2); border: 1px dashed var(--line); min-height: 140px; }
  .tl-hint { align-self: center; color: var(--mut); pointer-events: none; padding-left: 6px; }
  .tl-un-h { display: flex; align-items: center; gap: 16px; margin: 40px 0 14px; }
  .tl-un-h i { flex: 1; height: 1px; background: var(--line); }
  .tl-foot { margin-top: 28px; color: var(--mut); line-height: 1.7; font-size: 10px; }

  .tcard { width: 72px; height: 102px; flex-shrink: 0; cursor: grab; position: relative; user-select: none; background: var(--bg); transition: transform .14s, box-shadow .14s; }
  .tcard:hover { transform: translate(-3px,-3px) rotate(-2deg); box-shadow: 5px 5px 0 var(--tc, var(--acid)); z-index: 2; }
  .tl-un .tcard:hover { box-shadow: 5px 5px 0 var(--cy); }
  .tcard.ghost { opacity: .3; transform: scale(.93) !important; box-shadow: none !important; }
  .tcard img, .tcard .nop { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; pointer-events: none; }
  .tcard .nop { background: var(--blue); display: flex; align-items: center; justify-content: center; font: 400 10px var(--f-impact); text-transform: uppercase; color: var(--fg); text-align: center; padding: 4px; line-height: 1.2; overflow: hidden; overflow-wrap: anywhere; hyphens: auto; }
  .tcard .tip { display: none; position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); background: var(--acid); color: var(--bg); padding: 5px 10px; font: 600 13px var(--f-body); white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; pointer-events: none; z-index: 20; }
  .tcard:hover .tip { display: block; }

  @media (max-width: 760px) {
    .tl-head { flex-direction: column; align-items: flex-start; background: var(--bg-2); }
    .tl-head-r { text-align: left; }
    .tl-count { display: inline-block; }
    .tl-mobile-actions { display: flex; }
    .tl-label { width: 56px; padding-right: 8px; }
    .tl-letter { font-size: 34px; }
    .tl-jp { display: none; }
    .tcard { width: 60px; height: 86px; }
    .dzone { gap: 8px; padding: 10px; min-height: 106px; }
    .tl-body { padding-left: 3vw; padding-right: 3vw; }
  }
  @media (prefers-reduced-motion: reduce) { .tcard, .tcard:hover { transition: none; } }
`
