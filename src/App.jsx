import { useState, useEffect, useCallback } from 'react'
import Landing from './pages/Landing'
import Tracker from './pages/Tracker'
import TierList from './pages/TierList'
import Achievements from './pages/Achievements'
import Profile from './pages/Profile'
import Together from './pages/Together'
import { parseHash } from './utils/listCodec'

function App() {
  const [page, setPage] = useState('landing')
  const [sharedData, setSharedData] = useState(null)

  // Auto-route on hash
  useEffect(() => {
    const hash = location.hash
    if (!hash || hash.length < 4) return
    const parsed = parseHash(hash)
    if (!parsed || !parsed.data) return
    if (parsed.type === 'profile') {
      setSharedData(parsed.data)
      setPage('profile')
    } else if (parsed.type === 'compare') {
      setSharedData(parsed.data)
      setPage('together')
    }
    // Clear hash so refresh doesn't re-trigger
    history.replaceState(null, '', location.pathname)
  }, [])

  const navigate = useCallback((p) => {
    if (p === 'landing') setSharedData(null)
    // stats больше нет — редирект на profile
    setPage(p === 'stats' ? 'profile' : p)
  }, [])

  return (
    <div className="min-h-screen bg-[#f0ede6]">
      {page === 'landing' && (
        <Landing navigate={navigate} />
      )}
      {page === 'tracker' && (
        <Tracker navigate={navigate} />
      )}
      {page === 'tierlist' && (
        <TierList navigate={navigate} />
      )}
      {page === 'achievements' && (
        <Achievements navigate={navigate} />
      )}
      {page === 'profile' && (
        <Profile navigate={navigate} sharedList={sharedData} />
      )}
      {page === 'together' && (
        <Together navigate={navigate} compareData={sharedData} />
      )}
    </div>
  )
}

export default App
