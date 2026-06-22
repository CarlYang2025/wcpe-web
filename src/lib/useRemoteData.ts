import { useState, useEffect } from 'react'

const DATA_URL = 'https://carlyang2025.github.io/wcpe-web/remote.json'

interface RemoteData {
  modelState?: any
  keyLearnings?: string[]
  matches?: any[]
  predictions?: Record<string, any>
  reviews?: Record<string, any>
  eloRatings?: any
  factorWeights?: any
  lastUpdated?: string
  version?: string
  [key: string]: any
}

export function useRemoteData(): { data: RemoteData | null; loading: boolean } {
  const [data, setData] = useState<RemoteData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Cache-bust: append timestamp to force fresh fetch every load
    const url = `${DATA_URL}?t=${Date.now()}`
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return { data, loading }
}
