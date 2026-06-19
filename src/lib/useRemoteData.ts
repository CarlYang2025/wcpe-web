import { useState, useEffect } from 'react'

const DATA_URL = 'https://jsonblob.com/api/jsonBlob/019edb19-4cc7-7b7f-90f3-c51f403b0da4'

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
    // Try fetch but don't depend on it - static data has everything now
    fetch(DATA_URL)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return { data, loading }
}
