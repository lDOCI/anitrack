import { useState, useEffect, useRef } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
} from 'recharts'
import NavBar from '../components/NavBar'

const STORAGE_KEY = 'anitrack_list'

function useInView(ref) {
  const [v, setV] = useState(false)
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold: 0.1 })
    if (ref.current) o.observe(ref.current)
    return () => o.disconnect()
  }, [])
  return v
}

function AnimBar({ value, max, delay, inView, color = '#0a0a0a' }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!inView) return
    const t = setTimeout(() => setW((value / max) * 100), delay)
    return () => clearTimeout(t)
  }, [inView, value, max, delay])
  return (
    <div style={{ height: 6, background: 'rgba(10,10,10,0.1)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: color, width: `${w}%`, transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)' }} />
    </div>
  )
}

// Hatch pattern
function Hatch({ angle = 45, gap = 7, opacity = 0.05, color = '#0a0a0a' }) {
  const id = `h${angle}${gap}${Math.random().toString(36).slice(2,6)}`
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

// Speed lines
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

// Custom radar dot
const CustomRadarDot = (props) => {
  const { cx, cy } = props
  return <circle cx={cx} cy={cy} r={4} fill="#0a0a0a" stroke="#f0ede6" strokeWidth={2} />
}

export default function Stats({ navigate }) {
  const list = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] } })()

  const genresRef = useRef(null)
  const studiosRef = useRef(null)
  const epochRef = useRef(null)
  const genresInView = useInView(genresRef)
  const studiosInView = useInView(studiosRef)
  const epochInView = useInView(epochRef)

  // ── Compute stats ─────────────────────────────────────
  const completed = list.filter(a => a.status === 'completed' || a.status === 'watching')
  const totalEp = list.reduce((s, a) => s + (a.ep || 0), 0)
  const totalHours = Math.round(totalEp * 23.5 / 60)
  const scored = list.filter(a => a.score)
  const avgScore = scored.length ? (scored.reduce((s, a) => s + a.score, 0) / scored.length).toFixed(1) : '—'

  // Scores distribution
  const scoreDist = Array.from({ length: 10 }, (_, i) => ({
    s: String(i + 1),
    v: list.filter(a => a.score === i + 1).length,
  }))

  // Genres — нормализуем EN→RU перед подсчётом чтобы не было дублей
  const GENRE_RU_STATS = {
    'Action': 'Экшен', 'Adventure': 'Приключения', 'Comedy': 'Комедия',
    'Drama': 'Драма', 'Ecchi': 'Этти', 'Fantasy': 'Фэнтези',
    'Horror': 'Ужасы', 'Mahou Shoujo': 'Махо-сёдзё', 'Mecha': 'Меха',
    'Music': 'Музыка', 'Mystery': 'Детектив', 'Psychological': 'Психологическое',
    'Romance': 'Романтика', 'Sci-Fi': 'Фантастика', 'Slice of Life': 'Повседневность',
    'Sports': 'Спорт', 'Supernatural': 'Сверхъестественное', 'Thriller': 'Триллер',
    'Hentai': 'Хентай', 'Isekai': 'Исэкай',
  }
  const normalizeGenre = g => GENRE_RU_STATS[g] || g

  const genreMap = {}
  list.forEach(a => a.genres?.forEach(g => {
    const key = normalizeGenre(g)
    genreMap[key] = (genreMap[key] || 0) + 1
  }))
  const topGenres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxGenre = topGenres[0]?.[1] || 1

  // Studios
  const studioMap = {}
  list.forEach(a => { if (a.studio && a.studio !== '—') studioMap[a.studio] = (studioMap[a.studio] || 0) + 1 })
  const topStudios = Object.entries(studioMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxStudio = topStudios[0]?.[1] || 1

  // Epochs
  const epochMap = {}
  list.forEach(a => {
    if (!a.year) return
    const decade = Math.floor(a.year / 10) * 10
    epochMap[decade] = (epochMap[decade] || 0) + 1
  })
  const epochs = Object.entries(epochMap).sort((a, b) => a[0] - b[0]).map(([y, v]) => ({ y: `${y}е`, v }))
  const maxEpoch = Math.max(...epochs.map(e => e.v), 1)

  // Radar — top 6 genres as axes
  const radarGenres = topGenres.slice(0, 6)
  const maxG = radarGenres[0]?.[1] || 1
  const radarData = radarGenres.map(([g, v]) => ({ genre: g, value: Math.round((v / maxG) * 100) }))

  const isEmpty = list.length === 0

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

        .snav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 500;
          background: #f0ede6; border-bottom: 3px solid #0a0a0a;
          display: flex; align-items: center; padding: 0 24px; height: 52px; gap: 16px;
        }

        .back-btn {
          font-family: 'Bangers', sans-serif; font-size: 14px; letter-spacing: 0.08em;
          background: none; border: none; cursor: pointer; color: #888; transition: color 0.1s;
        }
        .back-btn:hover { color: #0a0a0a; }

        /* panel border util */
        .panel { border: 3px solid #0a0a0a; position: relative; overflow: hidden; }

        .section-label {
          font-family: 'Noto Sans JP', sans-serif; font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; color: #aaa;
          margin-bottom: 6px;
        }

        .big-num {
          font-family: 'Bangers', sans-serif; letter-spacing: 0.02em; line-height: 0.95;
          color: #0a0a0a;
        }

        /* Radar tooltip */
        .recharts-tooltip-wrapper { z-index: 100; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: none; }
        }
        .fade-up { animation: fadeUp 0.6s ease forwards; }

        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .mid-grid { grid-template-columns: 1fr !important; }
          .bottom-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="ht" />

      <NavBar active="stats" onNavigate={navigate} />

      <div style={{ paddingTop: 52, maxWidth: 1000, margin: '0 auto' }}>

        {isEmpty ? (
          /* Empty state */
          <div style={{ padding: '100px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 72, color: '#ccc', letterSpacing: '0.02em', marginBottom: 16 }}>データなし</div>
            <div style={{ fontFamily: "'Space Grotesk'", fontSize: 16, color: '#aaa', marginBottom: 32 }}>Список пуст — статистика появится после добавления аниме</div>
            <button onClick={() => navigate('tracker')} style={{
                fontFamily: "'Bangers', sans-serif", fontSize: 22, letterSpacing: '0.08em',
                padding: '12px 36px', background: '#0a0a0a', color: '#f0ede6',
                border: '3px solid #0a0a0a', cursor: 'pointer',
              }}>ПЕРЕЙТИ В СПИСОК</button>
          </div>
        ) : (<>

          {/* ── HERO — big numbers ── */}
          <section style={{ borderBottom: '3px solid #0a0a0a' }}>
            {/* Chapter header */}
            <div style={{
              padding: '20px 32px', borderBottom: '3px solid #0a0a0a',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#0a0a0a', position: 'relative', overflow: 'hidden',
            }}>
              <SpeedLines opacity={0.06} color="#fff" />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, color: '#555', letterSpacing: '0.12em', marginBottom: 4 }}>CHAPTER 01 / 統計概要</div>
                <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 36, letterSpacing: '0.04em', color: '#f0ede6', lineHeight: 1 }}>ОБЩАЯ СТАТИСТИКА</div>
              </div>
              <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 11, color: '#444', position: 'relative', zIndex: 1, textAlign: 'right' }}>
                <div>на основе {list.length} аниме</div>
                <div style={{ color: '#666', marginTop: 2 }}>{scored.length} с оценкой</div>
              </div>
            </div>

            {/* Big numbers grid */}
            <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {[
                { num: list.length, label: 'Аниме', jp: 'アニメ', big: true },
                { num: totalEp.toLocaleString('ru'), label: 'Серий', jp: 'エピソード', big: false },
                { num: totalHours.toLocaleString('ru'), label: 'Часов', jp: '時間', big: false },
                { num: avgScore, label: 'Средняя оценка', jp: '平均点', big: false, accent: true },
              ].map((s, i) => (
                <div key={i} style={{
                  padding: '32px 28px',
                  borderRight: i < 3 ? '3px solid #0a0a0a' : 'none',
                  background: s.accent ? '#d62828' : 'transparent',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {i === 0 && <Hatch angle={45} gap={7} opacity={0.04} />}
                  <div className="section-label" style={{ color: s.accent ? 'rgba(255,255,255,0.6)' : undefined, position: 'relative', zIndex: 1 }}>
                    <span style={{ fontFamily: "'Noto Sans JP'" }}>{s.jp}</span> · {s.label}
                  </div>
                  <div className="big-num fade-up" style={{
                    fontSize: 'clamp(40px, 5vw, 64px)',
                    color: s.accent ? '#fff' : '#0a0a0a',
                    position: 'relative', zIndex: 1,
                  }}>{s.num}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── MID — Genres + Score dist ── */}
          <section className="mid-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', borderBottom: '3px solid #0a0a0a' }}>

            {/* Genres */}
            <div ref={genresRef} style={{ borderRight: '3px solid #0a0a0a', padding: '32px', position: 'relative' }}>
              <Hatch angle={-30} gap={9} opacity={0.03} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 28 }}>
                  <div>
                    <div className="section-label"><span style={{ fontFamily: "'Noto Sans JP'" }}>CHAPTER 02 / ジャンル</span></div>
                    <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 32, letterSpacing: '0.04em', color: '#0a0a0a', lineHeight: 1 }}>ТОП ЖАНРЫ</div>
                  </div>
                  <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, color: '#bbb' }}>{topGenres.length} жанров</div>
                </div>

                {topGenres.length === 0 ? (
                  <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 12, color: '#bbb', padding: '20px 0' }}>Нет данных</div>
                ) : topGenres.map(([g, v], i) => (
                  <div key={g} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: 13, color: '#bbb', letterSpacing: '0.04em', minWidth: 20 }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span style={{ fontFamily: "'Space Grotesk'", fontSize: 14, fontWeight: 700, color: '#0a0a0a' }}>{g}</span>
                      </div>
                      <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: 18, color: i === 0 ? '#d62828' : '#0a0a0a' }}>{v}</span>
                    </div>
                    <AnimBar value={v} max={maxGenre} delay={i * 80} inView={genresInView} color={i === 0 ? '#d62828' : '#0a0a0a'} />
                  </div>
                ))}
              </div>
            </div>

            {/* Score distribution */}
            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ marginBottom: 28 }}>
                <div className="section-label"><span style={{ fontFamily: "'Noto Sans JP'" }}>CHAPTER 03 / 評価分布</span></div>
                <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 32, letterSpacing: '0.04em', color: '#0a0a0a', lineHeight: 1 }}>ОЦЕНКИ</div>
              </div>

              <div style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={scoreDist} barCategoryGap="18%">
                    <XAxis dataKey="s" axisLine={false} tickLine={false}
                      tick={{ fill: '#999', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(10,10,10,0.04)' }}
                      contentStyle={{ background: '#f0ede6', border: '2px solid #0a0a0a', borderRadius: 0, fontFamily: 'Space Grotesk', fontSize: 12 }}
                      formatter={(v) => [`${v} аниме`, '']}
                      labelFormatter={(l) => `Оценка ${l}`}
                    />
                    <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                      {scoreDist.map((s, i) => (
                        <Cell key={i} fill={
                          s.v === 0 ? 'rgba(10,10,10,0.08)' :
                          Number(s.s) >= 9 ? '#0a0a0a' :
                          Number(s.s) >= 7 ? '#555' : '#aaa'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Score stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(10,10,10,0.1)', marginTop: 16, border: '2px solid rgba(10,10,10,0.1)' }}>
                {[
                  ['Средняя', avgScore],
                  ['Оценено', `${scored.length}/${list.length}`],
                  ['Любимых (10)', list.filter(a => a.score === 10).length],
                  ['Мусор (≤5)', list.filter(a => a.score && a.score <= 5).length],
                ].map(([l, v]) => (
                  <div key={l} style={{ padding: '12px 14px', background: '#f0ede6' }}>
                    <div style={{ fontFamily: "'Space Grotesk'", fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>{l}</div>
                    <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 22, color: '#0a0a0a' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── BOTTOM — Studios + Epochs + Radar ── */}
          <section className="bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '3px solid #0a0a0a' }}>

            {/* Studios */}
            <div ref={studiosRef} style={{ borderRight: '3px solid #0a0a0a', padding: '28px', position: 'relative' }}>
              <div className="section-label" style={{ marginBottom: 6 }}><span style={{ fontFamily: "'Noto Sans JP'" }}>CHAPTER 04 / スタジオ</span></div>
              <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#0a0a0a', marginBottom: 24, lineHeight: 1 }}>ТОП СТУДИИ</div>

              {topStudios.length === 0 ? (
                <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 12, color: '#bbb' }}>Нет данных</div>
              ) : topStudios.map(([s, v], i) => (
                <div key={s} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontFamily: "'Space Grotesk'", fontSize: 13, fontWeight: 700, color: '#0a0a0a' }}>{s}</span>
                    <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: 16, color: '#666' }}>{v}</span>
                  </div>
                  <AnimBar value={v} max={maxStudio} delay={i * 80} inView={studiosInView} color={i === 0 ? '#0a0a0a' : '#555'} />
                </div>
              ))}
            </div>

            {/* Epochs */}
            <div ref={epochRef} style={{ borderRight: '3px solid #0a0a0a', padding: '28px', position: 'relative' }}>
              <Hatch angle={60} gap={8} opacity={0.03} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="section-label" style={{ marginBottom: 6 }}><span style={{ fontFamily: "'Noto Sans JP'" }}>CHAPTER 05 / 時代</span></div>
                <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#0a0a0a', marginBottom: 24, lineHeight: 1 }}>ЛЮБИМЫЕ ЭПОХИ</div>

                {epochs.length === 0 ? (
                  <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 12, color: '#bbb' }}>Нет данных</div>
                ) : (
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={epochs} barCategoryGap="20%">
                      <XAxis dataKey="y" axisLine={false} tickLine={false}
                        tick={{ fill: '#999', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700 }} />
                      <Tooltip
                        cursor={{ fill: 'rgba(10,10,10,0.04)' }}
                        contentStyle={{ background: '#f0ede6', border: '2px solid #0a0a0a', borderRadius: 0, fontFamily: 'Space Grotesk', fontSize: 12 }}
                        formatter={(v) => [`${v} аниме`, '']}
                      />
                      <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                        {epochs.map((e, i) => (
                          <Cell key={i} fill={e.v === maxEpoch ? '#d62828' : '#0a0a0a'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {epochs.length > 0 && (
                  <div style={{ marginTop: 16, padding: '10px 14px', background: '#0a0a0a' }}>
                    <div style={{ fontFamily: "'Space Grotesk'", fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Любимая эпоха</div>
                    <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 24, color: '#f0ede6' }}>
                      {epochs.reduce((a, b) => a.v > b.v ? a : b).y}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Radar */}
            <div style={{ padding: '28px', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
              <SpeedLines opacity={0.05} color="#fff" />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="section-label" style={{ color: '#444', marginBottom: 6 }}><span style={{ fontFamily: "'Noto Sans JP'" }}>CHAPTER 06 / 好み</span></div>
                <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#f0ede6', marginBottom: 20, lineHeight: 1 }}>ПРОФИЛЬ ВКУСОВ</div>

                {radarData.length >= 3 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <PolarGrid stroke="rgba(255,255,255,0.15)" />
                      <PolarAngleAxis dataKey="genre"
                        tick={{ fill: '#888', fontSize: 10, fontFamily: 'Space Grotesk', fontWeight: 700 }} />
                      <Radar dataKey="value" stroke="#f0ede6" fill="#f0ede6" fillOpacity={0.15} strokeWidth={2}
                        dot={<CustomRadarDot />} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Sans JP'", fontSize: 12, color: '#555' }}>
                    Нужно минимум 3 жанра
                  </div>
                )}

                {/* Top 3 genres as legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {radarData.slice(0, 3).map((d, i) => (
                    <div key={d.genre} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, background: i === 0 ? '#d62828' : '#f0ede6', flexShrink: 0 }} />
                      <span style={{ fontFamily: "'Space Grotesk'", fontSize: 12, fontWeight: 700, color: '#888' }}>{d.genre}</span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                      <span style={{ fontFamily: "'Bangers', sans-serif", fontSize: 16, color: '#666' }}>{d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── FOOTER SHARE ── */}
          <section style={{ padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 13, letterSpacing: '0.1em', color: '#bbb', marginBottom: 4 }}>ПОДЕЛИТЬСЯ СТАТИСТИКОЙ</div>
              <div style={{ fontFamily: "'Space Grotesk'", fontSize: 13, color: '#aaa' }}>Скоро: публичный профиль по ссылке</div>
            </div>
            <button style={{
              fontFamily: "'Bangers', sans-serif", fontSize: 18, letterSpacing: '0.08em',
              padding: '10px 24px', background: 'transparent', color: '#bbb',
              border: '2px solid #ddd', cursor: 'not-allowed', opacity: 0.5,
            }}>ПОДЕЛИТЬСЯ →</button>
          </section>

        </>)}
      </div>
    </div>
  )
}