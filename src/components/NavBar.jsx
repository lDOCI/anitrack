import { useState, useEffect, useRef } from 'react'

const NAV_ITEMS = [
  { key: 'tracker',      label: 'Список',   jp: 'リスト' },
  { key: 'tierlist',     label: 'Тир-лист', jp: 'ティア' },
  { key: 'achievements', label: 'Ачивки',   jp: '実績' },
  { key: 'profile',      label: 'Профиль',  jp: 'プロフィール' },
  { key: 'together',     label: 'Вместе',   jp: '一緒に' },
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
      <nav className="nb">
        <button className="nb-logo" onClick={() => onNavigate('landing')} aria-label="AniTrack — на главную">
          <span className="nb-mark">ア</span>
          <span>ANI<em>TRACK</em></span>
        </button>

        <div className="nb-desk">
          {NAV_ITEMS.map(it => (
            <button
              key={it.key}
              className={`nb-link${active === it.key ? ' on' : ''}`}
              onClick={() => onNavigate(it.key)}
              aria-current={active === it.key ? 'page' : undefined}
            >
              {it.label}<span>{it.jp}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        {rightContent && <div className="nb-right">{rightContent}</div>}

        <div ref={menuRef} className="nb-burger">
          <button className={`nb-burger-btn${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(v => !v)} aria-label="Меню" aria-expanded={menuOpen}>
            <i /><i /><i />
          </button>
          {menuOpen && (
            <div className="nb-menu">
              {NAV_ITEMS.map(it => (
                <button key={it.key} className={`nb-menu-item${active === it.key ? ' on' : ''}`} onClick={() => { onNavigate(it.key); setMenuOpen(false) }}>
                  <span>{it.label}</span><span className="t-jp">{it.jp}</span>
                </button>
              ))}
              <button className="nb-menu-item home" onClick={() => { onNavigate('landing'); setMenuOpen(false) }}>← На главную</button>
            </div>
          )}
        </div>
      </nav>

      <style>{`
        .nb { position: fixed; top: 0; left: 0; right: 0; z-index: 500; height: 52px; display: flex; align-items: center; gap: 18px; padding: 0 22px;
          background: rgba(7,7,14,.82); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border-bottom: 1px solid var(--line); color: var(--fg); }
        .nb-logo { display: flex; align-items: center; gap: 10px; background: none; border: 0; padding: 0; cursor: pointer; color: var(--fg); font-family: var(--f-head); font-weight: 900; font-size: 15px; letter-spacing: -.02em; flex-shrink: 0; }
        .nb-logo em { font-style: normal; color: var(--acid); }
        .nb-mark { display: grid; place-items: center; width: 28px; height: 28px; background: var(--acid); color: var(--bg); font-family: var(--f-jp); font-weight: 900; font-size: 15px; clip-path: polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%); }
        .nb-desk { display: flex; gap: 2px; align-items: center; margin-left: 12px; }
        .nb-link { position: relative; display: flex; align-items: baseline; gap: 6px; background: none; border: 0; cursor: pointer; padding: 8px 12px; font-family: var(--f-head); font-weight: 700; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--mut); white-space: nowrap; transition: color .15s; }
        .nb-link span { font-family: var(--f-jp); font-weight: 900; font-size: 9px; letter-spacing: 0; opacity: .7; }
        .nb-link:hover { color: var(--fg); }
        .nb-link.on { color: var(--acid); }
        .nb-link.on::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: 2px; height: 3px; background: var(--acid); transform: skewX(-25deg); }
        .nb-right { display: flex; align-items: center; gap: 8px; }
        .nb-burger { position: relative; display: none; flex-shrink: 0; }
        .nb-burger-btn { width: 40px; height: 34px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; background: none; border: 1px solid var(--line); }
        .nb-burger-btn i { display: block; width: 16px; height: 2px; background: var(--fg); }
        .nb-burger-btn.open { background: var(--acid); } .nb-burger-btn.open i { background: var(--bg); }
        .nb-menu { position: absolute; top: calc(100% + 10px); right: 0; min-width: 230px; z-index: 600; background: var(--bg-2); border: 1px solid var(--line); box-shadow: 8px 8px 0 var(--acid); }
        .nb-menu-item { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 14px 16px; background: none; border: 0; border-bottom: 1px solid var(--line); cursor: pointer; font-family: var(--f-head); font-weight: 700; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--fg); text-align: left; }
        .nb-menu-item .t-jp { font-size: 12px; color: var(--mut); letter-spacing: 0; }
        .nb-menu-item.on { color: var(--bg); background: var(--acid); } .nb-menu-item.on .t-jp { color: var(--bg); }
        .nb-menu-item.home { border-bottom: 0; color: var(--mut); font-size: 10px; }
        @media (max-width: 760px) { .nb-desk, .nb-right { display: none !important; } .nb-burger { display: block; } .nb { padding: 0 12px; } }
      `}</style>
    </>
  )
}
