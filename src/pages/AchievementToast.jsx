import { useState, useEffect, useRef } from 'react'
import { getEarned, ACHIEVEMENTS, getLevelInfo, AchIcon } from './Achievements'

const STORAGE_KEY = 'anitrack_list'
const SEEN_KEY = 'anitrack_achievements_seen'

function getSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []) } catch { return new Set() }
}
function saveSeen(set) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])) } catch {}
}

export default function AchievementToast({ list }) {
  const [queue, setQueue] = useState([])   // { type: 'ach'|'levelup', data }
  const [current, setCurrent] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const earned = getEarned(list)
    const seen = getSeen()
    const newOnes = earned.filter(a => !seen.has(a.id))
    if (!newOnes.length) return

    // Считаем XP до и после
    const xpBefore = ACHIEVEMENTS.filter(a => seen.has(a.id)).reduce((s, a) => s + a.xp, 0)
    const xpAfter  = earned.reduce((s, a) => s + a.xp, 0)
    const lvlBefore = getLevelInfo(xpBefore).current
    const lvlAfter  = getLevelInfo(xpAfter).current

    const newSeen = new Set(seen)
    newOnes.forEach(a => newSeen.add(a.id))
    saveSeen(newSeen)

    const toasts = newOnes.map(a => ({ type: 'ach', data: a }))

    // Если повысился уровень — добавляем тост в конец
    if (lvlAfter.level > lvlBefore.level) {
      toasts.push({ type: 'levelup', data: lvlAfter })
    }

    setQueue(prev => [...prev, ...toasts])
  }, [list.length, list.filter(a => a.status === 'completed').length])

  useEffect(() => {
    if (current || !queue.length) return
    const [next, ...rest] = queue
    setCurrent(next)
    setQueue(rest)
    timerRef.current = setTimeout(() => setCurrent(null), 4500)
    return () => clearTimeout(timerRef.current)
  }, [queue, current])

  if (!current) return null

  const dismiss = () => { clearTimeout(timerRef.current); setCurrent(null) }

  if (current.type === 'levelup') {
    const lvl = current.data
    return (
      <div onClick={dismiss} style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        background: lvl.color, color: '#fff',
        border: '3px solid #0a0a0a',
        boxShadow: '6px 6px 0 rgba(10,10,10,0.35)',
        padding: '16px 22px',
        display: 'flex', alignItems: 'center', gap: 16,
        maxWidth: 340, cursor: 'pointer',
        animation: 'slideIn 0.35s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <style>{`@keyframes slideIn{from{transform:translateX(120%);opacity:0}to{transform:none;opacity:1}}`}</style>
        <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 52, lineHeight: 1, flexShrink: 0, textShadow: '2px 2px 0 rgba(0,0,0,0.2)' }}>{lvl.level}</div>
        <div>
          <div style={{ fontFamily: "'Space Grotesk'", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.8, marginBottom: 3 }}>
            НОВЫЙ УРОВЕНЬ
          </div>
          <div style={{ fontFamily: "'Noto Sans'", fontWeight: 900, fontStyle: 'italic', fontSize: 18, lineHeight: 1.1, marginBottom: 2 }}>
            {lvl.title}
          </div>
          <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 12, opacity: 0.75 }}>{lvl.jp}</div>
        </div>
      </div>
    )
  }

  const ach = current.data
  return (
    <div onClick={dismiss} style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: '#0a0a0a', color: '#f0ede6',
      border: '3px solid #0a0a0a',
      boxShadow: '6px 6px 0 rgba(10,10,10,0.3)',
      padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      maxWidth: 320, cursor: 'pointer',
      animation: 'slideIn 0.35s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <style>{`@keyframes slideIn{from{transform:translateX(120%);opacity:0}to{transform:none;opacity:1}}`}</style>
      <div style={{ flexShrink: 0 }}><AchIcon id={ach.icon} size={40} color="#f0ede6" /></div>
      <div>
        <div style={{ fontFamily: "'Space Grotesk'", fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#d62828', marginBottom: 3 }}>
          НОВАЯ АЧИВКА · +{ach.xp} XP
        </div>
        <div style={{ fontFamily: "'Noto Sans'", fontWeight: 900, fontStyle: 'italic', fontSize: 15, lineHeight: 1.2, marginBottom: 2 }}>
          {ach.name}
        </div>
        <div style={{ fontFamily: "'Space Grotesk'", fontSize: 11, color: '#aaa', fontWeight: 600 }}>
          {ach.desc}
        </div>
      </div>
    </div>
  )
}