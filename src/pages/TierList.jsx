import { useState, useRef, useEffect } from 'react'
import NavBar from '../components/NavBar'

const STORAGE_KEY = 'anitrack_list'

const TIERS = [
  { key: 'S', color: '#d62828', bg: '#ffeaea', jp: '神' },
  { key: 'A', color: '#c05621', bg: '#fff2e8', jp: '良' },
  { key: 'B', color: '#a16207', bg: '#fefce8', jp: '普' },
  { key: 'C', color: '#166534', bg: '#f0fdf4', jp: '可' },
  { key: 'D', color: '#1e40af', bg: '#eff6ff', jp: '低' },
  { key: 'F', color: '#4b5563', bg: '#f9fafb', jp: '糞' },
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

  if (list.length === 0) return (
    <div style={{ background: '#f0ede6', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 52, color: '#ccc', letterSpacing: '0.04em' }}>リスト空</div>
      <div style={{ fontFamily: "'Space Grotesk'", fontSize: 14, color: '#aaa' }}>Сначала добавь аниме в трекер</div>
      <button onClick={() => navigate('tracker')} style={{ marginTop: 8, fontFamily: "'Bangers', sans-serif", fontSize: 18, letterSpacing: '0.08em', padding: '8px 28px', background: '#0a0a0a', color: '#f0ede6', border: '3px solid #0a0a0a', cursor: 'pointer' }}>← В СПИСОК</button>
    </div>
  )

  return (
    <div style={{ background: '#f0ede6', minHeight: '100vh' }}>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#f0ede6!important}
        .tcard{width:62px;height:88px;flex-shrink:0;cursor:grab;position:relative;border:2px solid transparent;transition:transform 0.12s,box-shadow 0.12s,border-color 0.1s;user-select:none}
        .tcard:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 8px 20px rgba(10,10,10,0.2);border-color:#0a0a0a;z-index:2}
        .tcard.ghost{opacity:0.3;transform:scale(0.93)!important;box-shadow:none!important}
        .tcard img,.tcard .nop{width:100%;height:100%;object-fit:cover;object-position:top;display:block;pointer-events:none}
        .tcard .nop{background:#e0ddd6;display:flex;align-items:center;justify-content:center;font-family:'Bangers', sans-serif;font-size:11px;color:#bbb;text-align:center;padding:4px;line-height:1.2}
        .tcard .tip{display:none;position:absolute;bottom:calc(100% + 5px);left:50%;transform:translateX(-50%);background:#0a0a0a;color:#f0ede6;padding:3px 8px;font-family:'Space Grotesk',sans-serif;font-size:10px;font-weight:600;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;pointer-events:none;z-index:20}
        .tcard:hover .tip{display:block}
        .dzone{display:flex;flex-wrap:wrap;gap:4px;flex:1;padding:5px;min-height:98px;align-content:flex-start;transition:background 0.1s}
        .dzone.ov{background:rgba(214,40,40,0.06);outline:2px dashed rgba(214,40,40,0.3);outline-offset:-2px}
        .ht::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:9998;opacity:0.025;background-image:radial-gradient(circle,#000 1px,transparent 1px);background-size:5px 5px}
      `}</style>

      <div className="ht" />

      <NavBar active="tierlist" onNavigate={navigate} rightContent={<>
        <span style={{ fontFamily: "'Space Grotesk'", fontSize: 11, color: '#bbb', fontWeight: 600 }}>{allItems.length} аниме</span>
        <button onClick={() => setState(buildInitialState(allItems))}
          style={{ fontFamily: "'Space Grotesk'", fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '4px 12px', background: 'none', border: '1.5px solid #ddd', cursor: 'pointer', color: '#aaa', transition: 'all 0.1s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#0a0a0a'; e.currentTarget.style.color = '#0a0a0a' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.color = '#aaa' }}>СБРОС</button>
        <button onClick={share}
          style={{ fontFamily: "'Bangers', sans-serif", fontSize: 14, letterSpacing: '0.08em', padding: '4px 16px', background: copied ? '#166534' : '#0a0a0a', color: '#f0ede6', border: `2px solid ${copied ? '#166534' : '#0a0a0a'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
          {copied ? '✓ СКОПИРОВАНО' : 'ПОДЕЛИТЬСЯ'}
        </button>
      </>} />

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '72px 16px 20px' }}>

        {TIERS.map(tier => {
          const items = tiers[tier.key] || []
          const isOver = overZone === tier.key
          return (
            <div key={tier.key} style={{ display: 'flex', marginBottom: 3, border: '2px solid rgba(10,10,10,0.1)', background: '#fff' }}>
              <div style={{ width: 64, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: tier.bg, borderRight: '2px solid rgba(10,10,10,0.08)', gap: 1, minHeight: 98 }}>
                <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: 42, color: tier.color, lineHeight: 1 }}>{tier.key}</span>
                <span style={{ fontFamily: "'Noto Sans JP'", fontSize: 9, color: tier.color, opacity: 0.55 }}>{tier.jp}</span>
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
                {items.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 10, color: '#e5e3de', fontFamily: "'Noto Sans JP'", fontSize: 10, pointerEvents: 'none', minHeight: 88 }}>
                    перетащи сюда
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Unranked */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 10px' }}>
          <div style={{ flex: 1, height: 2, background: 'rgba(10,10,10,0.07)' }} />
          <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: 12, letterSpacing: '0.08em', color: '#bbb' }}>НЕ ОЦЕНЕНО · 未評価</span>
          <div style={{ flex: 1, height: 2, background: 'rgba(10,10,10,0.07)' }} />
        </div>

        <div
          className={`dzone ${overZone === 'unranked' ? 'ov' : ''}`}
          style={{ border: '2px dashed rgba(10,10,10,0.1)', background: '#fafaf8', minHeight: 110 }}
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
          {unranked.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 12, color: '#d5d3ce', fontFamily: "'Noto Sans JP'", fontSize: 10, pointerEvents: 'none', minHeight: 100 }}>
              все аниме распределены ✓
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, textAlign: 'center', fontFamily: "'Space Grotesk'", fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#ccc' }}>
          ПЕРЕТАСКИВАЙ ПОСТЕРЫ · «ПОДЕЛИТЬСЯ» КОПИРУЕТ ССЫЛКУ С ТВОИМ ТИРЛИСТОМ
        </div>
      </div>
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
    >
      {item.poster
        ? <img src={item.poster} alt={item.title} />
        : <div className="nop">{item.title.slice(0, 14)}</div>
      }
      <div className="tip">{item.title}</div>
    </div>
  )
}