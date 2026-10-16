import { useEffect, useState } from 'react'

const KEY = 'anitrack:covers:v1'
const QUERY = `{Page(perPage:12){media(type:ANIME,sort:POPULARITY_DESC,isAdult:false){id title{romaji} coverImage{extraLarge}}}}`

function readCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY))
    return Array.isArray(c) && c.length ? c : null
  } catch { return null }
}

/** Popular anime covers from AniList (public, CORS-enabled). Empty array until loaded / when offline. */
export function useCovers() {
  const [covers, setCovers] = useState(() => readCache() || [])
  useEffect(() => {
    if (covers.length) return
    let dead = false
    fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY }),
    })
      .then(r => r.json())
      .then(j => {
        const list = j.data.Page.media.map(m => ({ id: m.id, title: m.title.romaji, src: m.coverImage.extraLarge }))
        try { sessionStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private mode */ }
        if (!dead) setCovers(list)
      })
      .catch(() => {})
    return () => { dead = true }
  }, [covers.length])
  return covers
}
