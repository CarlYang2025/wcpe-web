import { useState, useEffect, useCallback, useRef } from 'react'
import type { Match } from './types'
import { cn } from '../data/matches'

interface EspnEvent {
  status: string
  homeAbbr: string
  homeName: string
  awayAbbr: string
  awayName: string
  homeScore?: number
  awayScore?: number
}

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'

async function fetchEspnEvents(): Promise<EspnEvent[]> {
  try {
    const res = await fetch(ESPN_URL)
    if (!res.ok) return []
    const data = await res.json()
    return (data.events || []).map((e: any) => {
      const comp = e.competitions?.[0]
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')
      if (!home || !away) return null
      return {
        status: e.status?.type?.state === 'post' ? 'finished' : e.status?.type?.state === 'in' ? 'live' : 'upcoming',
        homeAbbr: home.team.abbreviation || '',
        homeName: home.team.displayName || '',
        awayAbbr: away.team.abbreviation || '',
        awayName: away.team.displayName || '',
        homeScore: home.score ? parseInt(home.score) : undefined,
        awayScore: away.score ? parseInt(away.score) : undefined,
      }
    }).filter(Boolean) as EspnEvent[]
  } catch { return [] }
}

interface AutoUpdaterResult {
  matches: Match[]
  isPolling: boolean
  lastUpdated: Date | null
}

export function useAutoUpdater(
  initialMatches: Match[],
): AutoUpdaterResult {
  const [matches, setMatches] = useState(initialMatches)
  const [isPolling] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  const doPoll = useCallback(async () => {
    const events = await fetchEspnEvents()
    if (events.length === 0) return

    setMatches(prev => prev.map(m => {
      // Match internal match to ESPN event by comparing team names
      const event = events.find(ev => {
        const hMatch = matchNames(cn(m.homeTeam), m.homeTeam, ev.homeName, ev.homeAbbr)
        const aMatch = matchNames(cn(m.awayTeam), m.awayTeam, ev.awayName, ev.awayAbbr)
        return hMatch && aMatch
      })
      if (!event) return m

      // Apply status and scores from ESPN (authoritative)
      return {
        ...m,
        status: event.status as Match['status'],
        homeScore: event.homeScore !== undefined ? event.homeScore : m.homeScore,
        awayScore: event.awayScore !== undefined ? event.awayScore : m.awayScore,
      }
    }))

    setLastUpdated(new Date())
  }, [])

  useEffect(() => {
    doPoll()
    pollRef.current = setInterval(doPoll, 120000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [doPoll])

  // Sync initialMatches when they change (e.g. remote data loaded with scores)
  useEffect(() => {
    setMatches(prev => {
      const lookup = new Map(initialMatches.map(m => [m.id, m]))
      return prev.map(m => {
        const updated = lookup.get(m.id)
        if (!updated) return m
        return {
          ...m,
          // Only update scores that weren't already set (ESPN takes priority)
          homeScore: m.homeScore ?? updated.homeScore,
          awayScore: m.awayScore ?? updated.awayScore,
          // Update status if remote says finished and we don't have a live/ESPN status
          status: m.status === 'upcoming' ? updated.status : m.status,
        }
      })
    })
  }, [initialMatches])

  return { matches, isPolling, lastUpdated }
}

/** Match team names across different representations */
function matchNames(cn: string, en: string, espnName: string, espnAbbr: string): boolean {
  const n = espnName.toLowerCase()
  const a = espnAbbr.toLowerCase()
  const c = cn.toLowerCase()
  const e = en.toLowerCase()
  // Direct match
  if (n.includes(c) || c.includes(n)) return true
  if (n.includes(e) || e.includes(n)) return true
  // Abbreviation match
  if (a === e.slice(0, 3) || e.includes(a)) return true
  // Special cases
  const specials: Record<string, string> = {
    '刚果(金)': 'congo', 'dr congo': 'congo', 'cod': 'congo',
    '捷克': 'czech', 'czechia': 'czech',
    '波黑': 'bosnia', 'bosnia': 'bosnia',
    '科特迪瓦': 'ivory', 'ivory coast': 'ivory',
    '库拉索': 'curacao', 'curaçao': 'curacao',
    '土耳其': 'turkey', 'turkiye': 'turkey', 'türkiye': 'turkey',
    '佛得角': 'cape verde',
  }
  for (const [key, val] of Object.entries(specials)) {
    if ((c.includes(key) || e.includes(key)) && (n.includes(val) || a.includes(val))) return true
  }
  return false
}
