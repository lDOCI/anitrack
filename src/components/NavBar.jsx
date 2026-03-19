import { useState, useEffect, useRef } from 'react'

const B = "'Bangers', sans-serif"
const F = "'Space Grotesk', sans-serif"
const J = "'Noto Sans JP', sans-serif"

const NAV_ITEMS = [
  { key: 'tracker',      label: 'СПИСОК',   jp: 'リスト' },
  { key: 'tierlist',     label: 'ТИР-ЛИСТ',  jp: 'ティア' },
  { key: 'achievements', label: 'АЧИВКИ',     jp: '実績' },
  { key: 'profile',     label: 'ПРОФИЛЬ',   jp: 'プロフィール' },
  { key: 'together',    label: 'ВМЕСТЕ',    jp: '一緒に' },
]

export default function NavBar({ active, onNavigate, rightContent }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
        background: '#f0ede6', borderBottom: '3px solid #0a0a0a',
        display: 'flex', alignItems: 'center', padding: '0 16px', height: 52, gap: 8,
      }}>
        {/* Logo */}
        <button
          onClick={() => onNavigate('landing')}
          style={{
            fontFamily: B, fontSize: 22, letterSpacing: '0.06em', color: '#0a0a0a',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            flexShrink: 0, lineHeight: 1,
          }}
        >
          ANI<span style={{ color: '#d62828' }}>TRACK</span>
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(10,10,10,0.12)', flexShrink: 0, margin: '0 4px' }} />

        {/* Desktop nav */}
        <div className="nb-desk" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {NAV_ITEMS.map(it => {
            const isActive = active === it.key
            return (
              <button
                key={it.key}
                onClick={() => onNavigate(it.key)}
                style={{
                  fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isActive ? '#0a0a0a' : '#aaa',
                  borderBottom: isActive ? '2px solid #d62828' : '2px solid transparent',
                  padding: '0 0 2px', display: 'flex', alignItems: 'center', gap: 3,
                  transition: 'color 0.15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#555' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#aaa' }}
              >
                {it.label}
                <span style={{ fontFamily: J, fontSize: 8, color: isActive ? '#d62828' : '#ccc' }}>{it.jp}</span>
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Right content */}
        {rightContent && (
          <div className="nb-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {rightContent}
          </div>
        )}

        {/* Mobile hamburger */}
        <div ref={menuRef} className="nb-burger" style={{ position: 'relative', flexShrink: 0, display: 'none' }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              width: 36, height: 36, background: menuOpen ? '#0a0a0a' : 'none',
              border: '2px solid #0a0a0a', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              transition: 'background 0.12s',
            }}
          >
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 16, height: 2, background: menuOpen ? '#f0ede6' : '#0a0a0a', transition: 'background 0.12s' }} />
            ))}
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: '#fff', border: '3px solid #0a0a0a',
              boxShadow: '6px 6px 0 rgba(10,10,10,0.15)',
              minWidth: 200, zIndex: 600,
            }}>
              {NAV_ITEMS.map(it => {
                const isActive = active === it.key
                return (
                  <button
                    key={it.key}
                    onClick={() => { onNavigate(it.key); setMenuOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '14px 18px',
                      background: isActive ? 'rgba(214,40,40,0.06)' : 'none',
                      border: 'none', borderBottom: '1px solid rgba(10,10,10,0.06)',
                      cursor: 'pointer', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isActive ? 'rgba(214,40,40,0.08)' : 'rgba(10,10,10,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = isActive ? 'rgba(214,40,40,0.06)' : 'none'}
                  >
                    <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: isActive ? '#d62828' : '#0a0a0a' }}>
                      {it.label}
                    </span>
                    <span style={{ fontFamily: J, fontSize: 10, color: '#bbb' }}>{it.jp}</span>
                  </button>
                )
              })}
              <button
                onClick={() => { onNavigate('landing'); setMenuOpen(false) }}
                style={{
                  display: 'block', width: '100%', padding: '12px 18px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: F, fontSize: 11, fontWeight: 600, color: '#aaa',
                  letterSpacing: '0.04em', textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#555'}
                onMouseLeave={e => e.currentTarget.style.color = '#aaa'}
              >
                ← НА ГЛАВНУЮ
              </button>
            </div>
          )}
        </div>
      </nav>

      <style>{`
        @media (max-width: 700px) {
          .nb-desk { display: none !important; }
          .nb-burger { display: block !important; }
          .nb-right { display: none !important; }
        }
      `}</style>
    </>
  )
}
