import { useState, useEffect } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, ResponsiveContainer, Cell, Tooltip,
} from 'recharts'
import { computeStats } from '../utils/statsCalc'
import { buildShareUrl, hydrateList } from '../utils/listCodec'
import NavBar from '../components/NavBar'

const STORAGE_KEY = 'anitrack_list'

function AnimBar({ value, max, delay, color = 'var(--fg)' }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setW((value / max) * 100), delay)
    return () => clearTimeout(t)
  }, [value, max, delay])
  return (
    <div className="pf-bar">
      <i style={{ background: color, width: `${w}%` }} />
    </div>
  )
}

const TIP = { background: '#101022', border: '1px solid rgba(244,244,255,.3)', borderRadius: 0, fontFamily: 'Onest, sans-serif', fontSize: 14, color: '#f4f4ff' }
const AXIS = { fill: '#a9a9cc', fontSize: 12, fontFamily: 'Unbounded, sans-serif', fontWeight: 700 }

export default function Profile({ sharedList, navigate }) {
  const isOwn = !sharedList
  const [list, setList] = useState(() => {
    if (!isOwn) return null
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
  })
  const [loading, setLoading] = useState(!isOwn)
  const [loadPct, setLoadPct] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOwn) return
    hydrateList(sharedList, pct => setLoadPct(Math.round(pct * 100)))
      .then(h => { setList(h); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleShare = () => {
    if (!list?.length) return
    const url = buildShareUrl(list)
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }


  const shareBtn = isOwn ? (
    <button className="btn sm" onClick={handleShare} style={copied ? { background: 'var(--cy)' } : undefined}>
      {copied ? 'Скопировано' : 'Поделиться'}
    </button>
  ) : null

  if (loading || !list) {
    return (
      <div className="pf">
        <NavBar active="profile" onNavigate={navigate} />
        <div className="pf-load">
          <div className="t-hud" style={{ color: 'var(--acid)', marginBottom: 14 }}>// загрузка профиля</div>
          <div className="t-out pf-load-n">{loadPct}%</div>
          <div className="pf-bar" style={{ width: 260, margin: '18px auto 0' }}><i style={{ background: 'var(--acid)', width: `${loadPct}%` }} /></div>
        </div>
        <style>{CSS}</style>
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
    <div className="pf">
      <NavBar active="profile" onNavigate={navigate} rightContent={shareBtn} />

      {list.length === 0 ? (
        <div className="pf-empty">
          <div className="t-out pf-empty-h">Пусто</div>
          <div style={{ fontSize: 17, color: 'var(--mut)', margin: '10px 0 30px' }}>Список пуст. Добавь первое аниме, и тут появится статистика.</div>
          <button className="btn" onClick={() => navigate('tracker')}>Перейти в список</button>
        </div>
      ) : (<>

        {/* ═════ HERO ═════ */}
        <section className="pf-hero">
          <div className="scan" />
          <div className="pf-hero-in">
            <div className="t-hud" style={{ color: 'var(--acid)' }}>// {isOwn ? 'мой профиль / プロフィール' : 'профиль друга / 共有'}</div>
            <h1 className="t-head pf-h1">
              {isOwn ? <>Моя<br /><span className="t-impact mark">статистика</span></> : <>Профиль<br /><span className="t-impact mark">друга</span></>}
            </h1>
            <div className="pf-hero-meta t-hud">
              <span>{stats.scored} с оценкой</span><span>{stats.topGenres.length} жанров</span><span>{stats.topStudios.length} студий</span>
            </div>
          </div>
          <div className="pf-hero-num" aria-label={`${stats.total} аниме`}>
            <span className="t-out pf-big">{stats.total}</span>
            <span className="t-hud pf-big-l">аниме в списке · アニメ</span>
          </div>
        </section>

        {/* ═════ BIG NUMBERS ═════ */}
        <section className="pf-nums">
          <div className="pf-nums-in">
            {[
              { num: stats.totalEp.toLocaleString('ru'), label: 'серий', jp: 'エピソード' },
              { num: stats.totalHours.toLocaleString('ru'), label: 'часов жизни', jp: '時間' },
              { num: stats.avgScore, label: 'средняя оценка', jp: '平均点', hot: true },
            ].map(s => (
              <div key={s.label} className={`pf-num${s.hot ? ' hot' : ''}`}>
                <div className="t-hud pf-num-l">{s.jp} · {s.label}</div>
                <div className="t-impact pf-num-v">{s.num}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ═════ GENRES + SCORES ═════ */}
        <section className="pf-sec">
          <div className="pf-two">
            <div>
              <div className="t-hud pf-eye">// ジャンル</div>
              <h2 className="t-head pf-h2">Топ <span className="t-out">жанры</span></h2>
              <div className="pf-rows">
                {stats.topGenres.map(([g, v], i) => (
                  <div key={g} className="pf-row">
                    <span className="t-hud pf-row-n" style={{ color: i === 0 ? 'var(--acid)' : 'var(--mut)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="pf-row-t">{g}</span>
                    <span className="t-impact pf-row-v" style={{ color: i === 0 ? 'var(--acid)' : 'var(--fg)' }}>{v}</span>
                    <div className="pf-row-b"><AnimBar value={v} max={maxGenre} delay={i * 80} color={i === 0 ? 'var(--acid)' : 'var(--cy)'} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="t-hud pf-eye" style={{ color: 'var(--mag)' }}>// 評価分布</div>
              <h2 className="t-head pf-h2">Оценки</h2>
              <div className="pf-chart">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={stats.scoreDist} barCategoryGap="14%">
                    <XAxis dataKey="s" axisLine={{ stroke: 'rgba(244,244,255,.16)' }} tickLine={false} tick={AXIS} />
                    <Tooltip
                      cursor={{ fill: 'rgba(244,244,255,0.06)' }}
                      contentStyle={TIP} itemStyle={{ color: '#f4f4ff' }}
                      formatter={(v) => [`${v} аниме`, '']}
                      labelFormatter={(l) => `Оценка ${l}`}
                    />
                    <Bar dataKey="v" radius={0}>
                      {stats.scoreDist.map((s, i) => (
                        <Cell key={i} fill={s.v === 0 ? 'rgba(244,244,255,0.1)' : Number(s.s) >= 9 ? '#d6ff1f' : Number(s.s) >= 7 ? '#27e1ff' : Number(s.s) >= 6 ? '#2a3cff' : '#ff2d87'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="pf-mini">
                {[
                  ['Средняя', stats.avgScore],
                  ['Оценено', `${stats.scored}/${stats.total}`],
                  ['Любимых (10)', stats.favorites],
                  ['Мусор (≤5)', stats.trash],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div className="t-hud" style={{ color: 'var(--mut)', marginBottom: 6 }}>{l}</div>
                    <div className="t-impact" style={{ fontSize: 30 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═════ STUDIOS / EPOCHS / RADAR ═════ */}
        <section className="pf-slab">
          <div className="pf-three">
            <div>
              <div className="t-hud pf-eye">// スタジオ</div>
              <h2 className="t-head pf-h3">Топ студии</h2>
              <div className="pf-rows">
                {stats.topStudios.map(([s, v], i) => (
                  <div key={s} className="pf-row">
                    <span className="pf-row-t" style={{ gridColumn: '1 / 3' }}>{s}</span>
                    <span className="t-impact pf-row-v" style={{ fontSize: 20 }}>{v}</span>
                    <div className="pf-row-b"><AnimBar value={v} max={maxStudio} delay={i * 80} color={i === 0 ? 'var(--mag)' : 'var(--mut)'} /></div>
                  </div>
                ))}
                {stats.topStudios.length === 0 && <div style={{ color: 'var(--mut)', fontSize: 14 }}>Нет данных</div>}
              </div>
            </div>

            <div>
              <div className="t-hud pf-eye" style={{ color: 'var(--cy)' }}>// 時代</div>
              <h2 className="t-head pf-h3">Эпохи</h2>
              {stats.epochs.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={stats.epochs} barCategoryGap="16%">
                      <XAxis dataKey="y" axisLine={{ stroke: 'rgba(244,244,255,.16)' }} tickLine={false} tick={{ ...AXIS, fontSize: 11 }} />
                      <Tooltip cursor={{ fill: 'rgba(244,244,255,0.06)' }} contentStyle={TIP} itemStyle={{ color: '#f4f4ff' }} formatter={(v) => [`${v} аниме`, '']} />
                      <Bar dataKey="v" radius={0}>
                        {stats.epochs.map((e, i) => <Cell key={i} fill={e.v === maxEpoch ? '#d6ff1f' : '#27e1ff'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="pf-fav">
                    <div className="t-hud" style={{ color: 'var(--bg)', opacity: .75, marginBottom: 4 }}>Любимая эпоха</div>
                    <div className="t-impact" style={{ fontSize: 30, color: 'var(--bg)' }}>{stats.epochs.reduce((a, b) => a.v > b.v ? a : b).y}</div>
                  </div>
                </>
              ) : <div style={{ color: 'var(--mut)', fontSize: 14 }}>Нет данных</div>}
            </div>

            <div>
              <div className="t-hud pf-eye" style={{ color: 'var(--mag)' }}>// 好み</div>
              <h2 className="t-head pf-h3">Профиль вкусов</h2>
              {radarData.length >= 3 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <PolarGrid stroke="rgba(244,244,255,0.2)" />
                    <PolarAngleAxis dataKey="genre" tick={{ fill: '#c9c9e6', fontSize: 11, fontFamily: 'Onest, sans-serif', fontWeight: 600 }} />
                    <Radar dataKey="value" stroke="#d6ff1f" fill="#d6ff1f" fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', fontSize: 14, color: 'var(--mut)' }}>Нужно минимум 3 жанра</div>
              )}
            </div>
          </div>
        </section>

        {/* ═════ SHARE ═════ */}
        {isOwn && (
          <section className="pf-share">
            <div>
              <div className="t-hud" style={{ color: 'var(--acid)', marginBottom: 10 }}>// поделиться профилем</div>
              <div style={{ fontSize: 16, color: '#c9c9e6', maxWidth: 420, lineHeight: 1.5 }}>Ссылка содержит весь твой список. Без регистрации.</div>
            </div>
            <button className="btn" onClick={handleShare} style={copied ? { background: 'var(--cy)' } : undefined}>
              {copied ? 'Скопировано' : 'Поделиться →'}
            </button>
          </section>
        )}
      </>)}

      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
  .pf { padding-top: 52px; min-height: 100vh; overflow-x: hidden; color: var(--fg); background: var(--bg); }
  .pf *, .pf *::before, .pf *::after { box-sizing: border-box; }
  .pf h1, .pf h2, .pf p { margin: 0; }
  .pf button:focus-visible { outline: 3px solid var(--cy); outline-offset: 3px; }
  .pf-bar { height: 12px; position: relative; overflow: hidden; background: rgba(244,244,255,.08); transform: skewX(-18deg); }
  .pf-bar > i { position: absolute; inset: 0 auto 0 0; display: block; transition: width 1.1s cubic-bezier(.16,1,.3,1); }
  .pf-load, .pf-empty { min-height: calc(100vh - 52px); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; }
  .pf-load-n, .pf-empty-h { font-size: clamp(64px, 16vw, 200px); --stroke: var(--acid); }

  .pf-hero { position: relative; display: grid; grid-template-columns: minmax(0,1.6fr) minmax(0,1fr); align-items: end; gap: 4vw; padding: 7vh 5vw 14vh; background: linear-gradient(115deg, var(--bg-2) 0 55%, var(--bg) 55%); overflow: hidden; }
  .pf-hero-in { position: relative; z-index: 2; max-width: 1240px; min-width: 0; }
  .pf-h1 { font-size: clamp(36px, 5.1vw, 104px); margin-top: 18px; } /* sized to its column: 'СТАТИСТИКА' must not run into the number */
  .pf-h1 .mark { font-size: .82em; margin-top: .1em; }
  .pf-hero-meta { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 28px; color: var(--mut); }
  .pf-hero-num { min-width: 0; position: relative; z-index: 2; display: flex; flex-direction: column; align-items: flex-end; }
  .pf-big { font-size: clamp(80px, 10vw, 210px); line-height: .8; padding-right: 2vw; --stroke: var(--acid); transform: rotate(-4deg); display: block; }
  .pf-big-l { color: var(--acid); margin-top: 18px; }

  .pf-nums { position: relative; background: var(--acid); color: var(--bg); clip-path: polygon(0 5vw, 100% 0, 100% calc(100% - 5vw), 0 100%); margin-top: -6vw; padding: 11vw 0 10vw; }
  .pf-nums-in { max-width: 1240px; margin: 0 auto; padding: 0 5vw; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3vw; }
  .pf-num { padding: 0 0 0 18px; border-left: 3px solid var(--bg); min-width: 0; }
  .pf-num-l { color: rgba(7,7,14,.8); margin-bottom: 10px; font-size: 11px; }
  .pf-num-v { font-size: clamp(34px, 6vw, 104px); color: var(--bg); white-space: nowrap; }
  .pf-num.hot { background: var(--bg); padding: 16px 18px 18px; border-left: 0; transform: rotate(2deg); box-shadow: 10px 10px 0 var(--mag); }
  .pf-num.hot .pf-num-l { color: var(--mut); }
  .pf-num.hot .pf-num-v { color: var(--acid); }

  .pf-sec { max-width: 1240px; margin: 0 auto; padding: 9vw 5vw 7vw; }
  .pf-two { display: grid; grid-template-columns: 1.15fr 1fr; gap: 6vw; align-items: start; }
  .pf-eye { color: var(--acid); margin-bottom: 14px; }
  .pf-h2 { font-size: clamp(32px, 4.6vw, 68px); margin-bottom: 36px !important; }
  .pf-h3 { font-size: clamp(24px, 2.8vw, 40px); margin-bottom: 26px !important; }
  .pf-rows { display: flex; flex-direction: column; gap: 18px; }
  .pf-row { display: grid; grid-template-columns: 28px 1fr auto; align-items: baseline; gap: 4px 12px; }
  .pf-row-t { font-size: 16px; font-weight: 600; min-width: 0; overflow-wrap: break-word; }
  .pf-row-v { font-size: 24px; }
  .pf-row-b { grid-column: 1 / -1; padding-left: 6px; }
  .pf-chart { margin: 0 -6px; }
  .pf-mini { display: grid; grid-template-columns: 1fr 1fr; gap: 22px 18px; margin-top: 22px; padding-top: 22px; border-top: 1px solid var(--line); }

  .pf-slab { background: var(--bg-2); clip-path: polygon(0 4vw, 100% 0, 100% 100%, 0 100%); padding: 10vw 5vw 7vw; }
  .pf-three { max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4vw; }
  .pf-three > div { min-width: 0; }
  .pf-fav { margin-top: 14px; padding: 12px 16px; background: var(--acid); display: inline-block; transform: rotate(-2deg); }

  .pf-share { max-width: 1240px; margin: 0 auto; padding: 7vw 5vw 9vw; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 28px; }

  @media (max-width: 820px) {
    .pf-hero { grid-template-columns: 1fr; padding-bottom: 12vh; background: var(--bg-2); }
    .pf-hero-num { align-items: flex-start; }
    .pf-nums-in { grid-template-columns: 1fr 1fr; gap: 28px 5vw; }
    .pf-num.hot { grid-column: 1 / -1; margin: 6px 8px 0 0; }
    .pf-two, .pf-three { grid-template-columns: 1fr; gap: 56px; }
    .pf-nums { padding: 16vw 0 14vw; }
  }
  @media (prefers-reduced-motion: reduce) { .pf-bar > i { transition: none; } }
`
