import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import NavBar from '../components/NavBar'
import AchievementToast from './AchievementToast'
import SearchModal from '../tracker/SearchModal'
import FranchiseModal from '../tracker/FranchiseModal'
import EditModal from '../tracker/EditModal'
import ImportModal from '../tracker/ImportModal'
import AnimeGroup from '../tracker/AnimeGroup'
import AiringStrip from '../tracker/AiringStrip'
import { STATUS_META, TABS, STORAGE_KEY, loadList } from '../tracker/constants'
import { groupStacks, stackKey, bumpEpisode, exportLine, knownEntries, isKnown, duplicateIds, applyGrouping } from '../tracker/util'
import { fetchAiring, airingInfo, groupByRelations } from '../data'
import '../tracker/tracker.css'

const REFRESH_MS = 10 * 60 * 1000
const plural = (n, one, few, many) => { const m = n % 100; const d = n % 10; return m > 10 && m < 15 ? many : d === 1 ? one : d > 1 && d < 5 ? few : many }

const keyOf = (a) => (a.shikiId ? String(a.shikiId) : a.anilistId ? `a${a.anilistId}` : null)
const needsAiring = (a) => {
  if (!keyOf(a) || a.status === 'dropped') return false
  if (a.status === 'completed') return !!a.isOngoing
  return !!a.isOngoing || !a.epTotal || !!a.nextEpisodeAt || (a.year || 0) >= new Date().getFullYear() - 1
}
const dedupeKey = (a) => (a.shikiId ? `m${a.shikiId}` : `${a.seriesKey}__${a.seasonLabel || a.season || ''}__${a.title}`)

export default function Tracker({ navigate }) {
  const [animeList, setAnimeList] = useState(loadList)
  const [tab, setTab] = useState('all')
  const [sortBy, setSortBy] = useState('added')
  const [listSearch, setListSearch] = useState('')
  const [modal, setModal] = useState(null) // 'search' | 'import'
  const [seed, setSeed] = useState(null)   // Title being expanded into a franchise picker
  const [edit, setEdit] = useState(null)   // { entries, initialIdx }
  const [now, setNow] = useState(() => Date.now())
  const listRef = useRef(animeList)
  const findRef = useRef(null)

  useEffect(() => { listRef.current = animeList }, [animeList])
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(animeList)) } catch { /* quota / private mode */ } }, [animeList])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])
  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setModal('search') } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── old lists: stack seasons of the same show (needs MAL ids; cheap Shikimori lookup, cached) ──
  const unlinked = animeList.filter(a => a.shikiId && !a.franchiseId).map(a => a.shikiId).sort().join(',')
  useEffect(() => {
    if (!unlinked) return
    let dead = false
    groupByRelations(listRef.current.filter(a => a.shikiId).map(a => a.shikiId)).then(groups => {
      if (dead || !groups.size) return
      setAnimeList(prev => {
        const fixed = new Map(applyGrouping(prev.filter(a => a.shikiId && !a.franchiseId), prev, groups).map(e => [e.id, e]))
        return prev.map(a => fixed.get(a.id) || a)
      })
    }).catch(() => {})
    return () => { dead = true }
  }, [unlinked])

  // ── airing: fresh episode counts + next episode time, on open and every 10 min ──
  const refreshAiring = useCallback(async () => {
    const targets = listRef.current.filter(needsAiring)
    if (!targets.length) return
    const map = await fetchAiring(targets.map(a => ({ malId: a.shikiId ? Number(a.shikiId) : undefined, anilistId: a.anilistId || undefined })))
    if (!map.size) return
    setAnimeList(prev => prev.map(a => {
      const k = keyOf(a)
      const v = k && needsAiring(a) ? map.get(k) : null
      if (!v) return a
      return {
        ...a,
        isOngoing: v.status === 'RELEASING',
        epTotal: v.episodes ?? a.epTotal,
        epAired: v.epAired ?? a.epAired,
        nextEpisodeAt: v.nextEp ? new Date(v.nextEp.at).toISOString() : null,
        nextEp: v.nextEp?.episode ?? null,
        format: a.format || v.format,
      }
    }))
  }, [])
  useEffect(() => {
    const first = setTimeout(() => { refreshAiring().catch(() => {}) }, 400)
    const t = setInterval(() => { refreshAiring().catch(() => {}) }, REFRESH_MS)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [refreshAiring])

  // ── mutations ──
  const addItems = useCallback((items) => setAnimeList(prev => {
    const have = new Set(prev.map(dedupeKey))
    const known = knownEntries(prev)
    const fresh = []
    for (const it of items) {
      const k = dedupeKey(it)
      const dup = have.has(k) || isKnown(known, { shikiId: it.shikiId, titles: [it.title, it.titleRomaji, it.season > 1 ? `${it.title} ${it.season}` : null] })
      if (!dup) { have.add(k); fresh.push(it) }
    }
    return [...fresh, ...prev]
  }), [])
  const dupIds = useMemo(() => duplicateIds(animeList), [animeList])
  const removeDuplicates = () => {
    if (!dupIds.size) return
    if (confirm(`Найдено повторов: ${dupIds.size}. Оставить у каждого вариант с оценкой и прогрессом, остальное убрать?`)) {
      setAnimeList(prev => prev.filter(a => !dupIds.has(a.id)))
    }
  }
  const updateEntry = useCallback((u) => setAnimeList(prev => prev.map(a => (a.id === u.id ? u : a))), [])
  const deleteEntry = useCallback((id) => setAnimeList(prev => prev.filter(a => a.id !== id)), [])
  const plusOne = useCallback((id) => setAnimeList(prev => prev.map(a => (a.id === id ? bumpEpisode(a, 1) : a))), [])
  const resetList = () => { if (confirm('Сбросить весь список? Это нельзя отменить.')) setAnimeList([]) }

  const exportList = () => {
    const blob = new Blob([animeList.map(exportLine).join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url; el.download = 'anitrack_export.txt'; el.click()
    URL.revokeObjectURL(url)
  }

  // ── view ──
  const groups = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    const rows = animeList.filter(a => {
      if (tab !== 'all' && a.status !== tab) return false
      if (!q) return true
      return [a.title, a.titleRomaji, a.titleJp, a.seasonLabel].some(x => x && x.toLowerCase().includes(q))
    })
    const sorted = [...rows].sort((a, b) => {
      if (sortBy === 'score') return (b.score || 0) - (a.score || 0)
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'ru')
      return (b.addedAt || b.id) - (a.addedAt || a.id)
    })
    return groupStacks(sorted)
  }, [animeList, tab, sortBy, listSearch])

  const counts = Object.fromEntries(Object.keys(STATUS_META).map(k => [k, animeList.filter(a => a.status === k).length]))
  const epsWatched = animeList.reduce((s, a) => s + (a.ep || 0), 0)
  const behind = animeList.filter(a => a.status === 'watching').reduce((s, a) => s + airingInfo(a, now).behind, 0)
  const stackCount = useMemo(() => new Set(animeList.map(a => a.franchiseId || a.seriesKey || a.id)).size, [animeList])

  return (
    <div className="tk">
      <NavBar active="tracker" onNavigate={navigate} rightContent={animeList.length > 0 && (
        <button className="btn ghost sm" onClick={resetList} style={{ color: 'var(--mag)', boxShadow: 'inset 0 0 0 2px var(--mag)' }}>Сбросить</button>
      )} />

      <div className="tk-wrap">
        <header className="tk-hero">
          <div className="t-hud" style={{ color: 'var(--acid)' }}>// list.sys · {stackCount} {plural(stackCount, 'тайтл', 'тайтла', 'тайтлов')} · <span className="t-jp">リスト</span></div>
          <h1 className="t-impact tk-h1">Список</h1>

          {animeList.length > 0 && (
            <div className="tk-stats">
              <div className="tk-stat hot"><b>{counts.watching}</b><span>смотрю</span></div>
              <div className="tk-stat"><b>{counts.completed}</b><span>просмотрено</span></div>
              <div className="tk-stat"><b>{epsWatched}</b><span>серий</span></div>
              {behind > 0 && <div className="tk-stat hot"><b>{behind}</b><span>ждут тебя</span></div>}
            </div>
          )}

          <div className="tk-actions" style={animeList.length ? undefined : { marginTop: 26 }}>
            <button className="btn" onClick={() => setModal('search')}>Добавить аниме</button>
            <button className="btn ghost" onClick={() => setModal('import')}>Импорт текстом</button>
            {animeList.length > 0 && <button className="btn ghost" onClick={exportList}>Экспорт</button>}
            {dupIds.size > 0 && <button className="btn ghost" onClick={removeDuplicates} style={{ color: 'var(--mag)', boxShadow: 'inset 0 0 0 2px var(--mag)' }}>Убрать дубли ({dupIds.size})</button>}
            <span className="tk-kbd" aria-hidden="true">⌘K</span>
          </div>
        </header>

        <AiringStrip list={animeList} now={now} onPlus={plusOne} onEdit={(entries, i) => setEdit({ entries, initialIdx: i })} />
      </div>

      {animeList.length > 0 && (
        <div className="tk-tool">
          <div className="tk-wrap tk-tool-in">
            <div className="tk-tabs-row" role="tablist">
              {TABS.map(t => (
                <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tk-tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
                  <span className="t-jp">{t.jp}</span>{t.label}<em>{t.key === 'all' ? animeList.length : counts[t.key] || 0}</em>
                </button>
              ))}
            </div>
            <div className="tk-find">
              <input ref={findRef} value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="Найти в списке" aria-label="Найти в списке"
                onKeyDown={e => { if (e.key === 'Escape') setListSearch('') }} />
              <div className="tk-sort" role="group" aria-label="Сортировка">
                {[['added', 'Дата'], ['score', 'Оценка'], ['title', 'А–Я']].map(([k, l]) => (
                  <button key={k} className={sortBy === k ? 'on' : ''} onClick={() => setSortBy(k)}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="tk-wrap tk-list">
        {animeList.length === 0 && (
          <div className="tk-void">
            <h2>Пусто</h2>
            <p className="tk-muted" style={{ marginBottom: 26, fontSize: 15 }}>Добавь первое аниме или вставь свой старый список текстом.</p>
            <button className="btn" onClick={() => setModal('search')}>Добавить аниме</button>
          </div>
        )}

        {animeList.length > 0 && groups.length === 0 && (
          <div className="tk-void">
            <h2 style={{ fontSize: 'clamp(40px, 9vw, 100px)' }}>Не найдено</h2>
            <p className="tk-muted">{listSearch ? <>По запросу «{listSearch}» ничего нет.</> : 'В этом разделе пока пусто.'}</p>
            {listSearch && <button className="btn ghost sm" style={{ marginTop: 16 }} onClick={() => setListSearch('')}>Сбросить поиск</button>}
          </div>
        )}

        {groups.map(entries => (
          <AnimeGroup key={stackKey(entries)} entries={entries} now={now}
            onEdit={(ents, i) => setEdit({ entries: ents, initialIdx: i })}
            onPlus={plusOne}
            onAddMore={(head) => setSeed(head.shikiId ? { key: String(head.shikiId), malId: Number(head.shikiId), anilistId: head.anilistId || null, titleRu: head.title } : null)} />
        ))}
      </main>

      {modal === 'search' && <SearchModal onClose={() => setModal(null)} onSelect={(t) => { setModal(null); setSeed(t) }} />}
      {modal === 'import' && <ImportModal list={animeList} onClose={() => setModal(null)} onImport={addItems} />}
      {seed && <FranchiseModal seed={seed} list={animeList} onClose={() => setSeed(null)} onAdd={addItems} />}
      {edit && (
        <EditModal entries={edit.entries} initialIdx={edit.initialIdx || 0}
          onClose={() => setEdit(null)} onSave={updateEntry} onDelete={deleteEntry} onUpdateEntry={updateEntry}
          onAddFromFranchise={(head) => setSeed(head.shikiId ? { key: String(head.shikiId), malId: Number(head.shikiId), anilistId: head.anilistId || null, titleRu: head.title } : null)} />
      )}
      <AchievementToast list={animeList} />
    </div>
  )
}
