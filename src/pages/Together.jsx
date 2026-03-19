import { useState, useEffect } from 'react'
import { decodeList, buildCompareUrl, hydrateList } from '../utils/listCodec'
import NavBar from '../components/NavBar'

const STORAGE_KEY = 'anitrack_list'

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

function compare(myList, theirList) {
  const myMap = new Map(myList.map(a => [Number(a.shikiId), a]))
  const theirMap = new Map(theirList.map(a => [Number(a.shikiId), a]))

  const both = []         // оба смотрели
  const onlyMe = []       // только я
  const onlyThem = []     // только у друга
  const recommend = []    // друг оценил высоко, я не смотрел

  for (const [id, mine] of myMap) {
    const theirs = theirMap.get(id)
    if (theirs) {
      both.push({ title: mine.title || theirs.title, myScore: mine.score, theirScore: theirs.score, genres: mine.genres || theirs.genres || [] })
    } else {
      onlyMe.push({ title: mine.title, score: mine.score, genres: mine.genres || [] })
    }
  }
  for (const [id, theirs] of theirMap) {
    if (!myMap.has(id)) {
      onlyThem.push({ title: theirs.title, score: theirs.score, genres: theirs.genres || [] })
      if (theirs.score >= 8) {
        recommend.push({ title: theirs.title, score: theirs.score, genres: theirs.genres || [] })
      }
    }
  }

  // Compatibility score
  const bothScored = both.filter(a => a.myScore && a.theirScore)
  let compat = 0
  if (bothScored.length >= 3) {
    const diffs = bothScored.map(a => Math.abs(a.myScore - a.theirScore))
    const avgDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length
    compat = Math.max(0, Math.round(100 - avgDiff * 15))
  }

  // Common genres
  const myGenres = {}
  myList.forEach(a => a.genres?.forEach(g => { myGenres[g] = (myGenres[g] || 0) + 1 }))
  const theirGenres = {}
  theirList.forEach(a => a.genres?.forEach(g => { theirGenres[g] = (theirGenres[g] || 0) + 1 }))
  const commonGenres = Object.keys(myGenres).filter(g => theirGenres[g])
    .sort((a, b) => (myGenres[b] + theirGenres[b]) - (myGenres[a] + theirGenres[a]))
    .slice(0, 5)

  recommend.sort((a, b) => b.score - a.score)

  return { both, onlyMe, onlyThem, recommend, compat, commonGenres, bothScored: bothScored.length }
}

export default function Together({ navigate, compareData }) {
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadPct, setLoadPct] = useState(0)
  const [tab, setTab] = useState('both')

  const myList = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] } })()

  const doCompare = async (minimalList) => {
    setLoading(true)
    setLoadPct(0)
    try {
      const hydrated = await hydrateList(minimalList, pct => setLoadPct(Math.round(pct * 100)))
      setResult(compare(myList, hydrated))
    } catch { setError('Ошибка загрузки данных') }
    setLoading(false)
  }

  const handleCompare = () => {
    setError('')
    let hash = link.trim()
    const hashIdx = hash.indexOf('#')
    if (hashIdx >= 0) hash = hash.slice(hashIdx + 1)
    if (hash.startsWith('c=')) hash = hash.slice(2)
    else if (hash.startsWith('p=')) hash = hash.slice(2)

    if (!hash) { setError('Вставь ссылку друга'); return }

    const theirList = decodeList(hash)
    if (!theirList || theirList.length === 0) { setError('Не удалось расшифровать список. Ссылка неправильная?'); return }

    doCompare(theirList)
  }

  useEffect(() => {
    if (compareData?.length) doCompare(compareData)
  }, [])

  const handleCopyMyLink = () => {
    const url = buildCompareUrl(myList)
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const tabs = result ? [
    { key: 'both', label: `ОБЩИЕ (${result.both.length})` },
    { key: 'recommend', label: `РЕКОМЕНДАЦИИ (${result.recommend.length})` },
    { key: 'onlyMe', label: `ТОЛЬКО У МЕНЯ (${result.onlyMe.length})` },
    { key: 'onlyThem', label: `ТОЛЬКО У ДРУГА (${result.onlyThem.length})` },
  ] : []

  const currentItems = result ? (
    tab === 'both' ? result.both :
    tab === 'recommend' ? result.recommend :
    tab === 'onlyMe' ? result.onlyMe :
    result.onlyThem
  ) : []

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
        @media (max-width:640px) {
          .compat-row { grid-template-columns: 1fr !important; }
          .compat-row > div { border-right: none !important; border-bottom: 3px solid #0a0a0a; }
          .tab-row { flex-wrap: wrap !important; }
          .tab-row button { font-size: 11px !important; padding: 10px 4px !important; }
        }
      `}</style>

      <div className="ht" />

      <NavBar active="together" onNavigate={navigate} />

      <div style={{ paddingTop: 52, maxWidth: 900, margin: '0 auto' }}>

        {/* HEADER */}
        <section style={{
          padding: '20px 32px', borderBottom: '3px solid #0a0a0a',
          background: '#0a0a0a', position: 'relative', overflow: 'hidden',
        }}>
          <SpeedLines opacity={0.06} color="#fff" />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, color: '#555', letterSpacing: '0.12em', marginBottom: 4 }}>
              СРАВНЕНИЕ СПИСКОВ / 一緒に
            </div>
            <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 36, letterSpacing: '0.04em', color: '#f0ede6', lineHeight: 1 }}>ВМЕСТЕ</div>
          </div>
        </section>

        {loading ? (
          <section style={{ padding: '60px 32px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 36, color: '#ccc', marginBottom: 12 }}>読み込み中...</div>
            <div style={{ fontSize: 14, color: '#aaa', marginBottom: 16 }}>Загрузка списка друга... {loadPct}%</div>
            <div style={{ width: 200, height: 6, background: 'rgba(10,10,10,0.1)', margin: '0 auto' }}>
              <div style={{ height: '100%', background: '#d62828', width: `${loadPct}%`, transition: 'width 0.3s' }} />
            </div>
          </section>
        ) : !result ? (
          /* INPUT SCREEN */
          <section style={{ borderBottom: '3px solid #0a0a0a' }}>
            {/* Step 1: Share your link */}
            <div style={{ padding: '32px', borderBottom: '3px solid #0a0a0a', position: 'relative' }}>
              <Hatch angle={30} gap={8} opacity={0.03} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#aaa', marginBottom: 6 }}>ШАГ 1</div>
                <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#0a0a0a', lineHeight: 1, marginBottom: 16 }}>
                  ОТПРАВЬ СВОЮ ССЫЛКУ ДРУГУ
                </div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
                  Ссылка содержит твой список. Друг вставит её к себе, а тебе отправит свою.
                </div>
                <button onClick={handleCopyMyLink} style={{
                  fontFamily: "'Bangers', sans-serif", fontSize: 18, letterSpacing: '0.08em',
                  padding: '10px 24px', background: copied ? '#166534' : '#0a0a0a', color: '#f0ede6',
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {copied ? 'СКОПИРОВАНО!' : 'КОПИРОВАТЬ МОЮ ССЫЛКУ'}
                </button>
                {myList.length === 0 && (
                  <div style={{ marginTop: 12, fontSize: 13, color: '#d62828' }}>
                    Твой список пуст — сначала добавь аниме в трекер
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Paste friend's link */}
            <div style={{ padding: '32px', position: 'relative' }}>
              <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#aaa', marginBottom: 6 }}>ШАГ 2</div>
              <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#0a0a0a', lineHeight: 1, marginBottom: 16 }}>
                ВСТАВЬ ССЫЛКУ ДРУГА
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCompare()}
                  placeholder="Вставь ссылку сюда..."
                  style={{
                    flex: 1, padding: '12px 16px', fontSize: 14,
                    border: '3px solid #0a0a0a', background: '#fff',
                    fontFamily: "'Space Grotesk',sans-serif", outline: 'none',
                  }}
                />
                <button onClick={handleCompare} style={{
                  fontFamily: "'Bangers', sans-serif", fontSize: 20, letterSpacing: '0.08em',
                  padding: '10px 28px', background: '#d62828', color: '#f0ede6',
                  border: '3px solid #d62828', cursor: 'pointer', transition: 'all 0.15s',
                  flexShrink: 0,
                }}>
                  СРАВНИТЬ
                </button>
              </div>
              {error && <div style={{ marginTop: 12, fontSize: 13, color: '#d62828', fontWeight: 600 }}>{error}</div>}
            </div>
          </section>
        ) : (
          /* RESULTS */
          <>
            {/* Compatibility */}
            <section className="compat-row" style={{ borderBottom: '3px solid #0a0a0a', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div style={{ padding: '28px 24px', borderRight: '3px solid #0a0a0a', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <Hatch angle={45} gap={7} opacity={0.04} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#aaa', marginBottom: 8 }}>СОВМЕСТИМОСТЬ</div>
                  <div style={{
                    fontFamily: "'Bangers', sans-serif", fontSize: 64, lineHeight: 0.95,
                    color: result.compat >= 70 ? '#2a9d2a' : result.compat >= 40 ? '#e68a00' : '#d62828',
                  }}>
                    {result.bothScored >= 3 ? `${result.compat}%` : '—'}
                  </div>
                  {result.bothScored < 3 && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>мало общих оценок</div>}
                </div>
              </div>

              <div style={{ padding: '28px 24px', borderRight: '3px solid #0a0a0a', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#aaa', marginBottom: 8 }}>ОБЩИЕ АНИМЕ</div>
                <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 64, lineHeight: 0.95, color: '#0a0a0a' }}>{result.both.length}</div>
              </div>

              <div style={{ padding: '28px 24px', textAlign: 'center', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
                <SpeedLines opacity={0.05} color="#fff" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontFamily: "'Noto Sans JP'", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#555', marginBottom: 8 }}>ОБЩИЕ ЖАНРЫ</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {result.commonGenres.map(g => (
                      <span key={g} style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                        padding: '3px 8px', border: '2px solid #333', color: '#888',
                      }}>{g}</span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Tabs */}
            <div className="tab-row" style={{ display: 'flex', borderBottom: '3px solid #0a0a0a' }}>
              {tabs.map((t, i) => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  flex: 1, padding: '14px 8px',
                  fontFamily: "'Bangers', sans-serif", fontSize: 14, letterSpacing: '0.06em',
                  background: tab === t.key ? '#0a0a0a' : 'transparent',
                  color: tab === t.key ? '#f0ede6' : '#888',
                  border: 'none', borderRight: i < tabs.length - 1 ? '3px solid #0a0a0a' : 'none',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* List */}
            <section style={{ borderBottom: '3px solid #0a0a0a' }}>
              {currentItems.length === 0 ? (
                <div style={{ padding: '48px 32px', textAlign: 'center', color: '#bbb', fontFamily: "'Bangers', sans-serif", fontSize: 24 }}>
                  ПУСТО
                </div>
              ) : currentItems.map((item, i) => (
                <div key={i} style={{
                  padding: '14px 24px',
                  borderBottom: i < currentItems.length - 1 ? '1px solid rgba(10,10,10,0.1)' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0a0a0a' }}>{item.title}</div>
                    {item.genres?.length > 0 && (
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{item.genres.slice(0, 3).join(' · ')}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                    {tab === 'both' ? (
                      <>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: '#aaa', letterSpacing: '0.06em' }}>ТЫ</div>
                          <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 22, color: item.myScore >= 8 ? '#0a0a0a' : '#888' }}>
                            {item.myScore || '—'}
                          </div>
                        </div>
                        <div style={{ width: 1, height: 24, background: 'rgba(10,10,10,0.15)' }} />
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: '#aaa', letterSpacing: '0.06em' }}>ДРУГ</div>
                          <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 22, color: item.theirScore >= 8 ? '#0a0a0a' : '#888' }}>
                            {item.theirScore || '—'}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontFamily: "'Bangers', sans-serif", fontSize: 22, color: item.score >= 8 ? '#d62828' : item.score ? '#0a0a0a' : '#ccc' }}>
                        {item.score || '—'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </section>

            {/* Back to input */}
            <section style={{ padding: '24px 32px', display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => { setResult(null); setLink(''); setTab('both') }} style={{
                fontFamily: "'Bangers', sans-serif", fontSize: 18, letterSpacing: '0.08em',
                padding: '10px 28px', background: 'transparent', color: '#888',
                border: '2px solid #ddd', cursor: 'pointer',
              }}>
                СРАВНИТЬ С ДРУГИМ
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
