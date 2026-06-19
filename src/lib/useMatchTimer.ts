import { useState, useEffect, useCallback } from 'react'
import type { Match } from './types'

/**
 * Parse a kickoff string like "6/18 06:00" (Beijing time) into a Date.
 */
function parseBeijingTime(kickoff: string, year = 2026): Date {
  const parts = kickoff.match(/(\d+)\/(\d+)\s+(\d+):(\d+)/)
  if (!parts) return new Date(0)
  const [, m, d, h, min] = parts
  return new Date(Date.UTC(year, parseInt(m) - 1, parseInt(d), parseInt(h) - 8, parseInt(min), 0))
}

/** Match duration estimation: 90 + 15 HT + ~10 injury = 115 minutes */
const MATCH_DURATION_MS = 115 * 60 * 1000

export function useMatchTimer(matches: Match[]): Match[] {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000) // check every 15s
    return () => clearInterval(interval)
  }, [])

  return matches.map(m => {
    if (m.status === 'finished') return m
    const kickoff = parseBeijingTime(m.kickoff)

    // upcoming → live when kickoff time passes
    if (now >= kickoff.getTime() && m.status === 'upcoming') {
      return { ...m, status: 'live' as const }
    }

    // live → finished after estimated match duration (115 min) as fallback
    // ESPN polling provides authoritative status + scores; this prevents stuck "live" state
    if (m.status === 'live' && now >= kickoff.getTime() + MATCH_DURATION_MS) {
      return { ...m, status: 'finished' as const }
    }

    return m
  })
}

/** Format remaining time for display */
export function formatCountdown(kickoff: string, status?: string): string {
  if (status === 'live') return '进行中'
  if (status === 'finished') return '已完赛'
  const ko = parseBeijingTime(kickoff)
  const diff = ko.getTime() - Date.now()
  if (diff <= 0) return '即将开始'
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 24) return `${Math.floor(hours / 24)}天后`
  if (hours > 0) return `${hours}时${mins}分后`
  return `${mins}分钟后`
}
