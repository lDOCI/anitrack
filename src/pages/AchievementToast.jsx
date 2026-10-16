/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, no-empty -- toast logic unchanged (visual restyle only) */
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

  const KF = `@keyframes slideIn{from{transform:translateX(120%);opacity:0}to{transform:none;opacity:1}} @media (prefers-reduced-motion: reduce){.at-toast{animation:none!important}}`
  const base = {
    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
    cursor: 'pointer', maxWidth: 'min(340px, calc(100vw - 32px))',
    animation: 'slideIn 0.35s cubic-bezier(0.16,1,0.3,1)',
    display: 'flex', alignItems: 'center',
  }

  if (current.type === 'levelup') {
    const lvl = current.data
    return (
      <div className="at-toast" role="status" onClick={dismiss} style={{
        ...base, background: lvl.color, color: 'var(--bg)',
        boxShadow: '8px 8px 0 var(--bg-2), 8px 8px 0 1px var(--line)',
        padding: '16px 26px 16px 20px', gap: 16,
        clipPath: 'polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%)',
      }}>
        <style>{KF}</style>
        <div className="t-impact" style={{ fontSize: 60, lineHeight: 1, flexShrink: 0 }}>{lvl.level}</div>
        <div>
          <div className="t-hud" style={{ marginBottom: 4 }}>Новый уровень</div>
          <div className="t-head" style={{ fontSize: 18, lineHeight: 1, marginBottom: 4 }}>{lvl.title}</div>
          <div className="t-jp" style={{ fontSize: 13 }}>{lvl.jp}</div>
        </div>
      </div>
    )
  }

  const ach = current.data
  return (
    <div className="at-toast" role="status" onClick={dismiss} style={{
      ...base, background: 'var(--bg-2)', color: 'var(--fg)',
      border: '1px solid var(--line)', borderLeft: '6px solid var(--acid)',
      boxShadow: '8px 8px 0 var(--acid)',
      padding: '14px 18px', gap: 14,
    }}>
      <style>{KF}</style>
      <div style={{ flexShrink: 0, background: 'var(--acid)', padding: 6 }}><AchIcon id={ach.icon || ach.id} size={36} color="#07070e" /></div>
      <div style={{ minWidth: 0 }}>
        <div className="t-hud" style={{ color: 'var(--acid)', marginBottom: 5 }}>Новая ачивка · +{ach.xp} XP</div>
        <div className="t-head" style={{ fontSize: 15, lineHeight: 1.05, marginBottom: 4 }}>{ach.name}</div>
        <div style={{ fontSize: 14, color: 'var(--mut)', lineHeight: 1.35 }}>{ach.desc}</div>
      </div>
    </div>
  )
}
