import { useState, useEffect, useRef } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, ResponsiveContainer, Cell, Tooltip,
} from 'recharts'
import { computeStats } from '../utils/statsCalc'
import { buildShareUrl, hydrateList } from '../utils/listCodec'
import NavBar from '../components/NavBar'

const STORAGE_KEY = 'anitrack_list'

function AnimBar({ value, max, delay, color = '#0a0a0a' }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setW((value / max) * 100), delay)
    return () => clearTimeout(t)
  }, [value, max, delay])
  return (
    <div style={{ height: 6, background: 'rgba(10,10,10,0.1)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: color, width: `${w}%`, transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)' }} />
    </div>
  )
}

function Hatch({ angle = 45, gap = 7, opacity = 0.05, color = '#0a0a0a' }) {
  const id = `h${angle}${gap}${Math.random().toString(36).slice(2, 6)}`
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
          <line x1="0" y1="0" x2="0" y2={gap} stroke={color} strokeWidth="0.8" opacity={opacity * 12} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

function SpeedLines({ opacity = 0.04, color = '#0a0a0a' }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 40 }).map((_, i) => {
        const a = (i / 40) * 360 * Math.PI / 180
        return <line key={i} x1="200" y1="200" x2={200 + Math.cos(a) * 600} y2={200 + Math.sin(a) * 600}
          stroke={color} strokeWidth={i % 5 === 0 ? 1.2 : 0.4} opacity={opacity} />
      })}
    </svg>
  )
}

export default function Profile({ sharedList, navigate }) {
  const isOwn = !sharedList
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadPct, setLoadPct] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOwn) {
      try { setList(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []) } catch { setList([]) }
    } else {
      setLoading(true)
      hydrateList(sharedList, pct => setLoadPct(Math.round(pct * 100)))
        .then(h => { setList(h); setLoading(false) })
    }
  }, [])

  const handleShare = () => {
    if (!list?.length) return
    const url = buildShareUrl(list)
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading || !list) {
    return (
      <div style={{ background: '#f0ede6', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk',sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 48, color: '#ccc', marginBottom: 12 }}>読み込み中...</div>
          <div style={{ fontSize: 14, color: '#aaa', marginBottom: 16 }}>Загрузка профиля... {loadPct}%</div>
          <div style={{ width: 200, height: 6, background: 'rgba(10,10,10,0.1)', margin: '0 auto' }}>
            <div style={{ height: '100%', background: '#d62828', width: `${loadPct}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>
    )
  }

  const stats = computeStats(list)
  const maxGenre = stats.topGenres[0]?.[1] || 1
  const maxStudio = stats.topStudios[0]?.[1] || 1
  const maxEpoch = Math.max(...stats.epochs.map(e => e.v), 1)
  const radarGenres = stats.topGenres.slice(0, 6)
  const maxG = radarGenres[0]?.[1] || 1
  const radarData = radarGenres.map(([g, v]) => ({ genre: g, value: Math.round((v / maxG) * 100) }))

  return (
    <div style={{ background: '#f0ede6', minHeight: '100vh', fontFamily: "'Space Grotesk',sans-serif" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #d62828; color: #fff; }
        body { background: #f0ede6 !important; }
        .ht::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 9998;
          opacity: 0.03;
          background-image: radial-gradient(circle, #000 1px, transparent 1px);
          background-size: 5px 5px;
        }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:none } }
        .fade-up { animation: fadeUp 0.6s ease forwards; }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .mid-grid { grid-template-columns: 1fr !important; }
          .bottom-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="ht" />

      <NavBar active="profile" onNavigate={navigate} rightContent={isOwn ? (
        <button onClick={handleShare} style={{
          fontFamily: "'Bangers', sans-serif", fontSize: 14, letterSpacing: '0.08em',
          padding: '4px 16px', background: copied ? '#166534' : '#d62828', color: '#f0ede6',
          border: 'none', cursor: 'pointer', transition: 'all 0.15s',
        }}>
          {copied ? 'СКОПИРОВАНО!' : 'ПОДЕЛИТЬСЯ →'}
        </button>
      ) : null} />

      <div style={{ paddingTop: 52, maxWidth: 1000, margin: '0 auto' }}>
        {list.length === 0 ? (
          <div style={{ padding: '100px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 72, color: '#ccc', marginBottom: 16 }}>データなし</div>
            <div style={{ fontSize: 16, color: '#aaa', marginBottom: 32 }}>Список пуст</div>
            <button onClick={() => navigate('tracker')} style={{
                fontFamily: "'Bangers', sans-serif", fontSize: 22, letterSpacing: '0.08em',
                padding: '12px 36px', background: '#0a0a0a', color: '#f0ede6',
                border: '3px solid #0a0a0a', cursor: 'pointer',
              }}>ПЕРЕЙТИ В СПИСОК</button>
          </div>
        ) : (<>

          {/* HEADER */}
          <section style={{ borderBottom: '3px solid #0a0a0a' }}>
            <div style={{
              padding: '20px 32px', borderBottom: '3px solid #0a0a0a',
              background: '#0a0a0a', position: 'relative', overflow: 'hidden',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <SpeedLines opacity={0.06} color="#fff" />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, color: '#555', letterSpacing: '0.12em', marginBottom: 4 }}>
                  {isOwn ? 'МОЙ ПРОФИЛЬ / プロフィール' : 'ПРОФИЛЬ / 共有'}
                </div>
                <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 36, letterSpacing: '0.04em', color: '#f0ede6', lineHeight: 1 }}>
                  {isOwn ? 'МОЯ СТАТИСТИКА' : 'ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ'}
                </div>
              </div>
              <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 11, color: '#444', position: 'relative', zIndex: 1, textAlign: 'right' }}>
                <div>{stats.total} аниме</div>
                <div style={{ color: '#666', marginTop: 2 }}>{stats.scored} с оценкой</div>
              </div>
            </div>

            {/* Big numbers */}
            <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {[
                { num: stats.total, label: 'Аниме', jp: 'アニメ' },
                { num: stats.totalEp.toLocaleString('ru'), label: 'Серий', jp: 'エピソード' },
                { num: stats.totalHours.toLocaleString('ru'), label: 'Часов', jp: '時間' },
                { num: stats.avgScore, label: 'Средняя', jp: '平均点', accent: true },
              ].map((s, i) => (
                <div key={i} style={{
                  padding: '32px 28px',
                  borderRight: i < 3 ? '3px solid #0a0a0a' : 'none',
                  background: s.accent ? '#d62828' : 'transparent',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {i === 0 && <Hatch angle={45} gap={7} opacity={0.04} />}
                  <div style={{
                    fontFamily: "'Noto Sans JP'", fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: s.accent ? 'rgba(255,255,255,0.6)' : '#aaa',
                    marginBottom: 6, position: 'relative', zIndex: 1,
                  }}>
                    <span style={{ fontFamily: "'Noto Sans JP'" }}>{s.jp}</span> · {s.label}
                  </div>
                  <div className="fade-up" style={{
                    fontFamily: "'Bangers', sans-serif", fontSize: 'clamp(40px,5vw,64px)',
                    letterSpacing: '0.02em', lineHeight: 0.95,
                    color: s.accent ? '#fff' : '#0a0a0a',
                    position: 'relative', zIndex: 1,
                  }}>{s.num}</div>
                </div>
              ))}
            </div>
          </section>

          {/* GENRES + SCORES */}
          <section className="mid-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', borderBottom: '3px solid #0a0a0a' }}>
            <div style={{ borderRight: '3px solid #0a0a0a', padding: 32, position: 'relative' }}>
              <Hatch angle={-30} gap={9} opacity={0.03} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#aaa', marginBottom: 6 }}>ジャンル</div>
                <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 32, letterSpacing: '0.04em', color: '#0a0a0a', lineHeight: 1, marginBottom: 28 }}>ТОП ЖАНРЫ</div>
                {stats.topGenres.map(([g, v], i) => (
                  <div key={g} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: 13, color: '#bbb', letterSpacing: '0.04em', minWidth: 20 }}>{String(i + 1).padStart(2, '0')}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0a0a0a' }}>{g}</span>
                      </div>
                      <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: 18, color: i === 0 ? '#d62828' : '#0a0a0a' }}>{v}</span>
                    </div>
                    <AnimBar value={v} max={maxGenre} delay={i * 80} color={i === 0 ? '#d62828' : '#0a0a0a'} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 32 }}>
              <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#aaa', marginBottom: 6 }}>評価分布</div>
              <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 32, letterSpacing: '0.04em', color: '#0a0a0a', lineHeight: 1, marginBottom: 28 }}>ОЦЕНКИ</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={stats.scoreDist} barCategoryGap="18%">
                  <XAxis dataKey="s" axisLine={false} tickLine={false}
                    tick={{ fill: '#999', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(10,10,10,0.04)' }}
                    contentStyle={{ background: '#f0ede6', border: '2px solid #0a0a0a', borderRadius: 0, fontFamily: 'Space Grotesk', fontSize: 12 }}
                    formatter={(v) => [`${v} аниме`, '']}
                    labelFormatter={(l) => `Оценка ${l}`}
                  />
                  <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                    {stats.scoreDist.map((s, i) => (
                      <Cell key={i} fill={s.v === 0 ? 'rgba(10,10,10,0.08)' : Number(s.s) >= 9 ? '#0a0a0a' : Number(s.s) >= 7 ? '#555' : '#aaa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(10,10,10,0.1)', marginTop: 16, border: '2px solid rgba(10,10,10,0.1)' }}>
                {[
                  ['Средняя', stats.avgScore],
                  ['Оценено', `${stats.scored}/${stats.total}`],
                  ['Любимых (10)', stats.favorites],
                  ['Мусор (≤5)', stats.trash],
                ].map(([l, v]) => (
                  <div key={l} style={{ padding: '12px 14px', background: '#f0ede6' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>{l}</div>
                    <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 22, color: '#0a0a0a' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* STUDIOS + EPOCHS + RADAR */}
          <section className="bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '3px solid #0a0a0a' }}>
            <div style={{ borderRight: '3px solid #0a0a0a', padding: 28 }}>
              <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#aaa', marginBottom: 6 }}>スタジオ</div>
              <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#0a0a0a', marginBottom: 24, lineHeight: 1 }}>ТОП СТУДИИ</div>
              {stats.topStudios.map(([s, v], i) => (
                <div key={s} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0a' }}>{s}</span>
                    <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: 16, color: '#666' }}>{v}</span>
                  </div>
                  <AnimBar value={v} max={maxStudio} delay={i * 80} color={i === 0 ? '#0a0a0a' : '#555'} />
                </div>
              ))}
            </div>

            <div style={{ borderRight: '3px solid #0a0a0a', padding: 28, position: 'relative' }}>
              <Hatch angle={60} gap={8} opacity={0.03} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#aaa', marginBottom: 6 }}>時代</div>
                <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#0a0a0a', marginBottom: 24, lineHeight: 1 }}>ЭПОХИ</div>
                {stats.epochs.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={stats.epochs} barCategoryGap="20%">
                        <XAxis dataKey="y" axisLine={false} tickLine={false}
                          tick={{ fill: '#999', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700 }} />
                        <Tooltip
                          cursor={{ fill: 'rgba(10,10,10,0.04)' }}
                          contentStyle={{ background: '#f0ede6', border: '2px solid #0a0a0a', borderRadius: 0, fontFamily: 'Space Grotesk', fontSize: 12 }}
                          formatter={(v) => [`${v} аниме`, '']}
                        />
                        <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                          {stats.epochs.map((e, i) => (
                            <Cell key={i} fill={e.v === maxEpoch ? '#d62828' : '#0a0a0a'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 16, padding: '10px 14px', background: '#0a0a0a' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Любимая эпоха</div>
                      <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 24, color: '#f0ede6' }}>
                        {stats.epochs.reduce((a, b) => a.v > b.v ? a : b).y}
                      </div>
                    </div>
                  </>
                ) : <div style={{ fontSize: 12, color: '#bbb' }}>Нет данных</div>}
              </div>
            </div>

            <div style={{ padding: 28, background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
              <SpeedLines opacity={0.05} color="#fff" />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#444', marginBottom: 6 }}>好み</div>
                <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#f0ede6', marginBottom: 20, lineHeight: 1 }}>ПРОФИЛЬ ВКУСОВ</div>
                {radarData.length >= 3 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <PolarGrid stroke="rgba(255,255,255,0.15)" />
                      <PolarAngleAxis dataKey="genre"
                        tick={{ fill: '#888', fontSize: 10, fontFamily: 'Space Grotesk', fontWeight: 700 }} />
                      <Radar dataKey="value" stroke="#f0ede6" fill="#f0ede6" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#555' }}>
                    Нужно минимум 3 жанра
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SHARE FOOTER */}
          {isOwn && (
            <section style={{ padding: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 13, letterSpacing: '0.1em', color: '#bbb', marginBottom: 4 }}>ПОДЕЛИТЬСЯ ПРОФИЛЕМ</div>
                <div style={{ fontSize: 13, color: '#aaa' }}>Ссылка содержит весь твой список — без регистрации</div>
              </div>
              <button onClick={handleShare} style={{
                fontFamily: "'Bangers', sans-serif", fontSize: 18, letterSpacing: '0.08em',
                padding: '10px 24px', background: copied ? '#166534' : '#d62828', color: '#f0ede6',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {copied ? 'СКОПИРОВАНО!' : 'ПОДЕЛИТЬСЯ →'}
              </button>
            </section>
          )}
        </>)}
      </div>
    </div>
  )
}
