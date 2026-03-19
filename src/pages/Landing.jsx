import { useEffect, useRef, useState } from 'react'

function useInView(ref, threshold = 0.1) {
  const [v, setV] = useState(false)
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold })
    if (ref.current) o.observe(ref.current)
    return () => o.disconnect()
  }, [])
  return v
}

// Speech bubble SVG paths
function SpeechBubble({ text, style, textStyle, tail = 'bottom-left' }) {
  return (
    <div style={{
      position: 'relative', display: 'inline-block',
      background: '#fff', border: '3px solid #0a0a0a',
      borderRadius: tail === 'round' ? '50%' : '8px 8px 8px 8px',
      padding: '12px 18px',
      ...style,
    }}>
      <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: 18, letterSpacing: '0.05em', color: '#0a0a0a', ...textStyle }}>{text}</span>
      {tail === 'bottom-left' && (
        <div style={{
          position: 'absolute', bottom: -18, left: 20,
          width: 0, height: 0,
          borderLeft: '14px solid transparent',
          borderRight: '0px solid transparent',
          borderTop: '18px solid #0a0a0a',
        }} />
      )}
      {tail === 'bottom-left' && (
        <div style={{
          position: 'absolute', bottom: -13, left: 23,
          width: 0, height: 0,
          borderLeft: '10px solid transparent',
          borderTop: '13px solid #fff',
        }} />
      )}
      {tail === 'bottom-right' && (
        <div style={{
          position: 'absolute', bottom: -18, right: 20,
          width: 0, height: 0,
          borderRight: '14px solid transparent',
          borderTop: '18px solid #0a0a0a',
        }} />
      )}
      {tail === 'bottom-right' && (
        <div style={{
          position: 'absolute', bottom: -13, right: 23,
          width: 0, height: 0,
          borderRight: '10px solid transparent',
          borderTop: '13px solid #fff',
        }} />
      )}
    </div>
  )
}

// Jagged/explosion speech bubble
function ShoutBubble({ text, style }) {
  return (
    <div style={{
      position: 'relative',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 200 80" preserveAspectRatio="none">
        <polygon points="0,10 15,0 30,12 50,2 70,14 90,0 110,12 130,2 150,14 170,0 185,10 200,5 195,25 200,40 185,35 200,55 185,70 170,80 150,68 130,80 110,68 90,80 70,68 50,80 30,68 15,80 0,70 10,55 0,40 10,25 0,10"
          fill="white" stroke="#0a0a0a" strokeWidth="3" />
      </svg>
      <span style={{
        position: 'relative', zIndex: 1,
        fontFamily: "'Bangers', sans-serif", fontSize: 22,
        letterSpacing: '0.08em', color: '#0a0a0a',
        padding: '0 20px',
      }}>{text}</span>
    </div>
  )
}

// Speed lines SVG
function SpeedLines({ style, color = '#0a0a0a', opacity = 0.06 }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', ...style }}
      viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 48 }).map((_, i) => {
        const angle = (i / 48) * 360
        const r = angle * Math.PI / 180
        const x2 = 200 + Math.cos(r) * 600
        const y2 = 200 + Math.sin(r) * 600
        return <line key={i} x1="200" y1="200" x2={x2} y2={y2}
          stroke={color} strokeWidth={i % 4 === 0 ? 1.5 : 0.5} opacity={opacity} />
      })}
    </svg>
  )
}

// Hatching pattern
function Hatch({ style, angle = 45, gap = 6, color = '#0a0a0a', opacity = 0.07 }) {
  const id = `hatch-${angle}-${gap}`
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', ...style }}>
      <defs>
        <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
          <line x1="0" y1="0" x2="0" y2={gap} stroke={color} strokeWidth="0.8" opacity={opacity * 10} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

// Ink splatter dots
function InkDots({ style }) {
  const dots = Array.from({ length: 12 }).map((_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    r: Math.random() * 4 + 1,
  }))
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', ...style }} viewBox="0 0 100 100">
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#0a0a0a" opacity="0.08" />)}
    </svg>
  )
}

export default function Landing({ navigate }) {
  const onStart = () => navigate('tracker')
  const onTogether = () => navigate('together')
  const onProfile = () => navigate('profile')
  const [vis, setVis] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const statsRef = useRef(null)
  const statsInView = useInView(statsRef)
  const featRef = useRef(null)
  const featInView = useInView(featRef)

  useEffect(() => {
    setTimeout(() => setVis(true), 80)
    const h = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <div style={{ background: '#f0ede6', color: '#0a0a0a', overflowX: 'hidden', cursor: 'crosshair' }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #d62828; color: #fff; }

        /* Halftone overlay */
        body::after {
          content: '';
          position: fixed; inset: 0; pointer-events: none; z-index: 9999;
          opacity: 0.04;
          background-image: radial-gradient(circle, #000 1px, transparent 1px);
          background-size: 5px 5px;
        }

        .font-body { font-family: 'Space Grotesk', sans-serif; }
        .font-bang { font-family: 'Bangers', sans-serif; }
        .font-jp { font-family: 'Noto Sans JP', sans-serif; }

        /* NAV */
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 500;
          background: #f0ede6;
          border-bottom: 3px solid #0a0a0a;
          padding: 0 32px; height: 52px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .nav-logo {
          font-family: 'Bangers', sans-serif;
          font-size: 30px; letter-spacing: 0.08em; color: #0a0a0a;
        }
        .nav-logo em { color: #d62828; font-style: normal; }
        .nav-links { display: flex; gap: 24px; }
        .nav-links button {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase; color: #888;
          background: none; border: none; cursor: crosshair; transition: color 0.15s;
        }
        .nav-links button:hover { color: #0a0a0a; }
        .nav-open {
          font-family: 'Bangers', sans-serif; font-size: 20px; letter-spacing: 0.1em;
          padding: 4px 20px; background: #0a0a0a; color: #f0ede6;
          border: 3px solid #0a0a0a; cursor: crosshair; transition: all 0.12s;
        }
        .nav-open:hover { background: #d62828; border-color: #d62828; transform: rotate(-1deg); }

        /* PANEL borders */
        .panel { border: 3px solid #0a0a0a; position: relative; overflow: hidden; }

        /* FX text styles */
        .fx-huge {
          font-family: 'Bangers', sans-serif;
          letter-spacing: 0.03em; line-height: 0.9;
          color: #0a0a0a;
        }
        .fx-outline {
          -webkit-text-stroke: 3px #0a0a0a;
          color: transparent;
        }
        .fx-red { color: #d62828; }
        .fx-shadow {
          text-shadow: 4px 4px 0 #0a0a0a;
        }

        /* Torn edge effect */
        .torn-bottom::after {
          content: '';
          position: absolute; bottom: -2px; left: 0; right: 0; height: 12px;
          background: #f0ede6;
          clip-path: polygon(0% 100%, 2% 0%, 5% 80%, 8% 10%, 11% 70%, 14% 0%, 17% 60%, 20% 20%, 23% 80%, 26% 0%, 29% 90%, 32% 10%, 35% 70%, 38% 0%, 41% 60%, 44% 30%, 47% 90%, 50% 5%, 53% 75%, 56% 15%, 59% 85%, 62% 0%, 65% 65%, 68% 25%, 71% 80%, 74% 5%, 77% 70%, 80% 20%, 83% 90%, 86% 10%, 89% 75%, 92% 0%, 95% 65%, 98% 15%, 100% 50%, 100% 100%);
          z-index: 10;
        }

        .skewed {
          transform: skewY(-2deg);
          transform-origin: left;
        }

        /* Action lines animated */
        @keyframes actionPulse { 0%,100%{opacity:0.06} 50%{opacity:0.12} }
        .action-lines { animation: actionPulse 3s ease-in-out infinite; }

        /* Panel hover */
        .feat-panel {
          transition: transform 0.15s, box-shadow 0.15s;
          cursor: crosshair;
        }
        .feat-panel:hover {
          transform: translate(-3px, -3px) rotate(-0.5deg);
          box-shadow: 6px 6px 0 #0a0a0a;
          z-index: 10;
        }

        /* Bar anim */
        .bar-fill { transition: width 1.2s cubic-bezier(0.16,1,0.3,1); }

        /* Marquee */
        @keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .mq { animation: marquee 16s linear infinite; }

        /* Appear anims */
        @keyframes smashIn {
          0% { opacity:0; transform: scale(1.4) rotate(-3deg); }
          60% { transform: scale(0.95) rotate(0.5deg); }
          100% { opacity:1; transform: scale(1) rotate(0); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(32px); }
          to { opacity:1; transform:translateY(0); }
        }
        .smash { opacity:0; }
        .smash.v { animation: smashIn 0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
        .slide { opacity:0; }
        .slide.v { animation: slideUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
        .d1 { animation-delay: 0.05s !important; }
        .d2 { animation-delay: 0.15s !important; }
        .d3 { animation-delay: 0.25s !important; }
        .d4 { animation-delay: 0.4s !important; }

        @media (max-width:768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none; }
          .stats-row { grid-template-columns: 1fr 1fr !important; }
          .feat-grid { grid-template-columns: 1fr !important; }
          .feat-grid .panel { border-right: none !important; border-bottom: 3px solid #0a0a0a !important; }
          .cta-grid { grid-template-columns: 1fr !important; min-height: auto !important; }
          .cta-grid > div { border-right: none !important; padding: 40px 24px !important; }
          .nav { padding: 0 16px; }
          .panel { padding: 24px 16px !important; }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav font-body">
        <span className="nav-logo">ANI<em>TRACK</em></span>
        <div className="nav-links">
          <button onClick={onStart}>Список</button>
          <button onClick={onStart}>Тир-лист</button>
          <button onClick={onProfile}>Профиль</button>
        </div>
        <button className="nav-open" onClick={onStart}>ОТКРЫТЬ</button>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section style={{ paddingTop: 52, minHeight: '100vh', position: 'relative' }}>

        {/* BIG SPEED LINES behind everything */}
        <SpeedLines style={{ zIndex: 0 }} opacity={0.05} />

        {/* HERO GRID — broken asymmetric panels */}
        <div className="hero-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gridTemplateRows: 'auto auto',
          gap: 0, position: 'relative', zIndex: 1,
        }}>

          {/* PANEL 1 — Big title, skewed */}
          <div className="panel" style={{
            gridColumn: '1', gridRow: '1',
            padding: '60px 48px 48px',
            background: '#f0ede6',
            borderBottom: '3px solid #0a0a0a',
          }}>
            <Hatch style={{ zIndex: 0 }} angle={45} gap={8} opacity={0.04} />

            <div className={`font-jp smash d1 ${vis ? 'v' : ''}`} style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
              color: '#d62828', marginBottom: 16, textTransform: 'uppercase',
              position: 'relative', zIndex: 1,
            }}>
              アニメトラッカー — Трекер аниме на русском
            </div>

            <h1 className={`fx-huge smash d2 ${vis ? 'v' : ''}`} style={{
              fontSize: 'clamp(72px, 9vw, 130px)',
              position: 'relative', zIndex: 1, marginBottom: 0,
            }}>
              ТВОЙ<br />
              <span className="fx-red">СПИСОК.</span><br />
              <span className="fx-outline">ТВОЯ</span><br />
              СТАТА.
            </h1>
          </div>

          {/* PANEL 2 — top right, dark with speech bubble */}
          <div className="panel" style={{
            gridColumn: '2', gridRow: '1',
            background: '#0a0a0a',
            padding: '40px 32px',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between',
            borderLeft: '3px solid #0a0a0a',
          }}>
            <SpeedLines color="#fff" opacity={0.04} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <SpeechBubble
                text="Бесплатно и без регистрации!"
                tail="bottom-left"
                style={{ marginBottom: 40 }}
              />
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="font-jp" style={{ fontSize: 11, color: '#666', letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>
                Часов просмотрено
              </div>
              <div className="fx-huge fx-shadow" style={{
                fontSize: 'clamp(64px, 7vw, 100px)',
                color: '#f0ede6', lineHeight: 0.9,
              }}>
                847
              </div>
              <div style={{ fontFamily: "'Space Grotesk'", fontSize: 13, color: '#555', marginTop: 8 }}>
                +12 часов за этот месяц
              </div>
            </div>

            <ShoutBubble
              text="НОВЫЙ РЕКОРД!!"
              style={{ width: '100%', height: 64, marginTop: 24, position: 'relative', zIndex: 1 }}
            />
          </div>

          {/* PANEL 3 — bottom left, genres */}
          <div className="panel" style={{
            gridColumn: '1', gridRow: '2',
            padding: '40px 48px',
            background: '#f0ede6',
            borderTop: '3px solid #0a0a0a',
            display: 'flex', gap: 40, alignItems: 'center',
          }}>
            <div style={{ flex: 1 }}>
              <div className={`font-jp slide d1 ${vis ? 'v' : ''}`} style={{
                fontSize: 11, fontWeight: 700, color: '#888',
                letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20,
              }}>
                Топ жанры / ジャンル
              </div>
              {[['Экшн', 87], ['Фэнтези', 80], ['Драма', 72], ['Исекай', 65], ['Триллер', 58]].map(([g, v], i) => (
                <div key={g} style={{ marginBottom: 14 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontFamily: "'Space Grotesk'", fontSize: 13, fontWeight: 600,
                    marginBottom: 5,
                  }}>
                    <span>{g}</span>
                    <span style={{ color: '#888' }}>{v}%</span>
                  </div>
                  <div style={{ height: 5, background: '#d8d4cc', position: 'relative' }}>
                    <div className="bar-fill" style={{
                      position: 'absolute', top: 0, left: 0, height: '100%',
                      background: i === 0 ? '#d62828' : '#0a0a0a',
                      width: vis ? `${v}%` : '0%',
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Skewed score block */}
            <div style={{
              background: '#0a0a0a', padding: '24px 28px',
              transform: 'rotate(2deg)',
              border: '3px solid #0a0a0a',
              flexShrink: 0,
            }}>
              <div className="font-jp" style={{ fontSize: 10, color: '#666', letterSpacing: '0.1em', marginBottom: 8 }}>СРЕДНЯЯ ОЦЕНКА</div>
              <div className="fx-huge" style={{ fontSize: 64, color: '#f0ede6', lineHeight: 1 }}>9.1</div>
              <div style={{ fontFamily: "'Space Grotesk'", fontSize: 11, color: '#555', marginTop: 4 }}>из 10</div>
            </div>
          </div>

          {/* PANEL 4 — bottom right, CTA */}
          <div className="panel" style={{
            gridColumn: '2', gridRow: '2',
            background: '#d62828',
            padding: '40px 32px',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'flex-start',
            gap: 20,
            borderLeft: '3px solid #0a0a0a',
            borderTop: '3px solid #0a0a0a',
            position: 'relative', overflow: 'hidden',
          }}>
            <Hatch angle={-45} gap={6} color="#fff" opacity={0.08} />
            <div className="fx-huge" style={{ fontSize: 'clamp(32px, 4vw, 52px)', color: '#f0ede6', position: 'relative', zIndex: 1, lineHeight: 1 }}>
              НАЧНИ<br />ПРЯМО<br />СЕЙЧАС
            </div>
            <button onClick={onStart} style={{
              fontFamily: "'Bangers', sans-serif", fontSize: 24, letterSpacing: '0.1em',
              padding: '10px 28px', background: '#f0ede6', color: '#0a0a0a',
              border: '3px solid #0a0a0a', cursor: 'crosshair',
              position: 'relative', zIndex: 1, transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.target.style.transform = 'translate(-3px,-3px)'; e.target.style.boxShadow = '5px 5px 0 #0a0a0a' }}
              onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = 'none' }}
            >
              ОТКРЫТЬ →
            </button>
          </div>
        </div>
      </section>

      {/* ═══════ MARQUEE ═══════ */}
      <div style={{
        background: '#0a0a0a', borderTop: '3px solid #0a0a0a',
        borderBottom: '3px solid #0a0a0a',
        padding: '10px 0', overflow: 'hidden',
      }}>
        <div className="mq" style={{ display: 'flex', whiteSpace: 'nowrap' }}>
          {[...Array(3)].map((_, ri) => (
            ['СПИСОК', 'アニメ', 'СТАТИСТИКА', '統計', 'ТИР-ЛИСТ', 'タイマー', 'ТАЙМЕР', 'プロフィール', 'ВМЕСТЕ', '一緒に'].map((t, i) => (
              <span key={`${ri}-${i}`} style={{
                fontFamily: "'Bangers', sans-serif", fontSize: 18,
                letterSpacing: '0.12em', color: '#f0ede6',
                padding: '0 28px', display: 'inline-flex', alignItems: 'center', gap: 28,
              }}>
                {t}
                {(i % 3 === 0) && <span style={{ width: 8, height: 8, background: '#d62828', borderRadius: '50%', display: 'inline-block' }} />}
              </span>
            ))
          ))}
        </div>
      </div>

      {/* ═══════ STATS ROW ═══════ */}
      <div ref={statsRef} className="stats-row" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        borderBottom: '3px solid #0a0a0a',
      }}>
        {[['847', 'часов просмотрено'], ['142', 'аниме в списке'], ['9.1', 'средняя оценка'], ['2340', 'серий']].map(([n, l], i) => (
          <div key={i} style={{
            padding: '40px 28px', borderRight: i < 3 ? '3px solid #0a0a0a' : 'none',
            position: 'relative', overflow: 'hidden',
            background: i === 0 ? '#0a0a0a' : '#f0ede6',
          }}>
            {i === 0 && <Hatch angle={45} gap={6} color="#fff" opacity={0.06} />}
            <div className="fx-huge" style={{
              fontSize: 'clamp(48px, 5vw, 72px)', lineHeight: 0.9,
              color: i === 0 ? '#f0ede6' : '#0a0a0a',
              position: 'relative', zIndex: 1,
              opacity: 0,
              animation: statsInView ? `slideUp 0.7s ${i * 0.1}s cubic-bezier(0.16,1,0.3,1) forwards` : 'none',
            }}>{n}</div>
            <div style={{
              fontFamily: "'Space Grotesk'", fontSize: 12, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: i === 0 ? '#666' : '#888', marginTop: 8,
              position: 'relative', zIndex: 1,
            }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ═══════ FEATURES — broken panel grid ═══════ */}
      <section ref={featRef} style={{ position: 'relative' }}>
        <div style={{
          padding: '48px 40px 24px',
          borderBottom: '3px solid #0a0a0a',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        }}>
          <h2 className="fx-huge" style={{ fontSize: 'clamp(48px, 6vw, 80px)', lineHeight: 1 }}>
            ВОЗМОЖНОСТИ<br />
            <span className="fx-outline">機能</span>
          </h2>
          <SpeechBubble text="6 инструментов!" tail="bottom-right" style={{ marginBottom: 8 }} />
        </div>

        {/* Irregular panel grid */}
        <div className="feat-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr', gridTemplateRows: 'auto auto', borderBottom: '3px solid #0a0a0a' }}>
          {[
            { jp: 'リスト', title: 'СПИСОК', desc: 'Поиск с автодополнением или импорт текстом. Оценки, статусы, заметки.', dark: false, skew: false, action: onStart },
            { jp: 'プロフィール', title: 'ПРОФИЛЬ', desc: 'Статистика, жанры, студии — и публичная ссылка для друзей.', dark: true, skew: false, action: onProfile },
            { jp: 'タイマー', title: 'ТАЙМЕР', desc: 'Обратный отсчёт до следующей серии онгоингов.', dark: false, skew: false, action: onStart },
            { jp: 'ティア', title: 'ТИР-ЛИСТ', desc: 'Расставь аниме drag & drop. Поделись ссылкой.', dark: false, skew: false, action: onStart },
            { jp: '一緒に', title: 'ВМЕСТЕ', desc: 'Сравни два списка, найди что смотреть с другом.', dark: false, skew: true, action: onTogether },
            { jp: '実績', title: 'АЧИВКИ', desc: 'Открывай достижения, набирай XP и повышай уровень.', dark: true, skew: false, action: () => navigate('achievements') },
          ].map((f, i) => (
            <div key={i} className="panel feat-panel" onClick={f.action} style={{
              padding: '36px 32px',
              background: f.dark ? '#0a0a0a' : '#f0ede6',
              borderRight: (i % 3 < 2) ? '3px solid #0a0a0a' : 'none',
              borderBottom: i < 3 ? '3px solid #0a0a0a' : 'none',
              borderTop: 'none', borderLeft: 'none',
              opacity: 0,
              animation: featInView ? `slideUp 0.6s ${0.05 + i * 0.08}s cubic-bezier(0.16,1,0.3,1) forwards` : 'none',
              position: 'relative', overflow: 'hidden',
            }}>
              {f.skew && <Hatch angle={30} gap={5} opacity={0.05} />}
              <div className="font-jp" style={{
                fontSize: 28, fontWeight: 900,
                color: f.dark ? '#333' : '#d8d4cc', marginBottom: 8,
                position: 'relative', zIndex: 1,
              }}>{f.jp}</div>
              <div className="fx-huge" style={{
                fontSize: 36, color: f.dark ? '#f0ede6' : '#0a0a0a',
                marginBottom: 10, lineHeight: 1,
                position: 'relative', zIndex: 1,
              }}>{f.title}</div>
              <div style={{
                fontFamily: "'Space Grotesk'", fontSize: 13, lineHeight: 1.6,
                color: f.dark ? '#888' : '#555',
                position: 'relative', zIndex: 1,
              }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ BOTTOM CTA ═══════ */}
      <section className="cta-grid" style={{
        display: 'grid', gridTemplateColumns: '1.5fr 1fr',
        borderBottom: '3px solid #0a0a0a', minHeight: 320,
      }}>
        <div style={{
          padding: '64px 60px', borderRight: '3px solid #0a0a0a',
          position: 'relative', overflow: 'hidden',
        }}>
          <SpeedLines opacity={0.05} />
          <h2 className="fx-huge" style={{ fontSize: 'clamp(60px, 7vw, 100px)', lineHeight: 0.9, position: 'relative', zIndex: 1 }}>
            НАЧНИ<br />
            <span className="fx-outline">ПРЯМО</span><br />
            СЕЙЧАС
          </h2>
        </div>
        <div style={{
          padding: '64px 48px', background: '#0a0a0a',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: 24,
          position: 'relative', overflow: 'hidden',
        }}>
          <Hatch angle={-45} gap={7} color="#fff" opacity={0.05} />
          <p style={{ fontFamily: "'Space Grotesk'", fontSize: 15, color: '#888', lineHeight: 1.7, position: 'relative', zIndex: 1 }}>
            Никакой регистрации. Просто открой и добавь первое аниме — за 10 секунд.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            {['Бесплатно', 'Без регистрации', 'На русском'].map(b => (
              <span key={b} style={{
                fontFamily: "'Space Grotesk'", fontSize: 11, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '5px 12px', border: '2px solid #333', color: '#666',
              }}>{b}</span>
            ))}
          </div>
          <button onClick={onStart} style={{
            fontFamily: "'Bangers', sans-serif", fontSize: 26, letterSpacing: '0.1em',
            padding: '12px 36px', background: '#d62828', color: '#f0ede6',
            border: '3px solid #d62828', cursor: 'crosshair',
            position: 'relative', zIndex: 1, transition: 'all 0.12s',
            alignSelf: 'flex-start',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-3px,-3px)'; e.currentTarget.style.boxShadow = '5px 5px 0 #f0ede6' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
          >
            ОТКРЫТЬ ANITRACK →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        padding: '20px 40px', borderTop: '3px solid #0a0a0a',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span className="nav-logo" style={{ fontFamily: "'Bangers', sans-serif", fontSize: 24, letterSpacing: '0.08em' }}>
          ANI<span style={{ color: '#d62828' }}>TRACK</span>
        </span>
        <span style={{ fontFamily: "'Space Grotesk'", fontSize: 12, color: '#888', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Данные: Shikimori API
        </span>
      </footer>
    </div>
  )
}