import { useState, useEffect } from 'react'

const DATA_URL = 'https://jsonblob.com/api/jsonBlob/019eea42-7a83-7313-8cd1-c1b4873b988e'

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
