/**
 * ESPN Scoreboard API polling service.
 * Fetches live match data and converts to internal Match format.
 */

export interface EspnEvent {
  id: string
  status: { type: { state: string }; period?: number; displayClock?: string }
  competitions: Array<{
    competitors: Array<{
      homeAway: string
      team: { abbreviation: string; displayName: string; shortDisplayName: string }
      score: string
    }>
  }>
}

export interface LiveMatchUpdate {
  espnId: string
  status: 'upcoming' | 'live' | 'finished'
  homeScore?: number
  awayScore?: number
  period?: number
  clock?: string
}

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'

/** Map ESPN team abbreviations to our internal names */
const TEAM_MAP: Record<string, string> = {
  'MEX': 'Mexico', 'RSA': 'South Africa',
  'KOR': 'South Korea', 'CZE': 'Czechia',
  'CAN': 'Canada', 'BIH': 'Bosnia',
  'QAT': 'Qatar', 'SUI': 'Switzerland',
  'BRA': 'Brazil', 'MAR': 'Morocco',
  'HAI': 'Haiti', 'SCO': 'Scotland',
  'ESP': 'Spain', 'CPV': 'Cape Verde',
  'BEL': 'Belgium', 'EGY': 'Egypt',
  'KSA': 'Saudi Arabia', 'URU': 'Uruguay',
  'IRN': 'Iran', 'NZL': 'New Zealand',
  'FRA': 'France', 'SEN': 'Senegal',
  'IRQ': 'Iraq', 'NOR': 'Norway',
  'ARG': 'Argentina', 'ALG': 'Algeria',
  'AUT': 'Austria', 'JOR': 'Jordan',
  'POR': 'Portugal', 'COD': 'DR Congo',
  'ENG': 'England', 'CRO': 'Croatia',
  'GHA': 'Ghana', 'PAN': 'Panama',
  'COL': 'Colombia', 'UZB': 'Uzbekistan',
}

/** Map our team names to ESPN abbreviations */
const REVERSE_TEAM_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_MAP).map(([k, v]) => [v, k])
)
export { REVERSE_TEAM_MAP }

/** Match our internal IDs to ESPN match identifiers (hardcoded for known matches) */
const ESPN_MATCH_MAP: Record<string, string> = {
  'mex-rsa': 'mexico-south-africa',
  'kor-cze': 'south-korea-czechia',
  'qat-sui': 'qatar-switzerland',
  'bra-mar': 'brazil-morocco',
  'hai-sco': 'haiti-scotland',
  'esp-cpv': 'spain-cape-verde',
  'bel-egy': 'belgium-egypt',
  'ksa-uru': 'saudi-arabia-uruguay',
  'irn-nzl': 'iran-new-zealand',
  'fra-sen': 'france-senegal',
  'irq-nor': 'iraq-norway',
  'arg-alg': 'argentina-algeria',
  'aut-jor': 'austria-jordan',
  'por-cod': 'portugal-dr-congo',
  'eng-cro': 'england-croatia',
  'gha-pan': 'ghana-panama',
  'uzb-col': 'uzbekistan-colombia',
}

/**
 * Attempt to fetch live scores from ESPN.
 * Falls back gracefully if network/CORS issues.
 */
export async function fetchLiveMatches(): Promise<LiveMatchUpdate[]> {
  try {
    const urls = [
      ESPN_URL,
      // CORS proxy fallback
      'https://corsproxy.io/?' + encodeURIComponent(ESPN_URL),
    ]
    
    let data: any = null
    for (const url of urls) {
      try {
        const res = await fetch(url)
        if (res.ok) { data = await res.json(); break }
      } catch { continue }
    }

    if (!data?.events) return []

    return data.events.map((ev: any) => {
      const status = ev.status?.type?.state || 'pre'
      const comp = ev.competitions?.[0]
      if (!comp) return null

      const home = comp.competitors?.find((c: any) => c.homeAway === 'home')
      const away = comp.competitors?.find((c: any) => c.homeAway === 'away')
      if (!home || !away) return null

      return {
        espnId: ev.id,
        status: status === 'post' ? 'finished' : status === 'in' ? 'live' : 'upcoming',
        homeScore: home.score ? parseInt(home.score) : undefined,
        awayScore: away.score ? parseInt(away.score) : undefined,
        period: ev.status?.period,
        clock: ev.status?.displayClock,
      }
    }).filter(Boolean) as LiveMatchUpdate[]
  } catch {
    return []
  }
}

/**
 * Try to find tomorrow's World Cup matches from ESPN schedule API.
 */
export async function fetchTomorrowSchedule(): Promise<Array<{
  homeTeam: string; awayTeam: string; date: string; group?: string; kickoff?: string
}>> {
  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const y = tomorrow.getFullYear()
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const d = String(tomorrow.getDate()).padStart(2, '0')
    const dateStr = `${y}${m}${d}`

    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateStr}`
    
    let data: any = null
    for (const u of [url, 'https://corsproxy.io/?' + encodeURIComponent(url)]) {
      try {
        const res = await fetch(u)
        if (res.ok) { data = await res.json(); break }
      } catch { continue }
    }

    if (!data?.events) return []

    return data.events.map((ev: any) => {
      const comp = ev.competitions?.[0]
      const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
      const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')
      if (!home || !away) return null
      return {
        homeTeam: TEAM_MAP[home.team.abbreviation] || home.team.displayName,
        awayTeam: TEAM_MAP[away.team.abbreviation] || away.team.displayName,
        date: dateStr,
        group: comp?.groups?.[0]?.name,
        kickoff: ev.date,
      }
    }).filter(Boolean)
  } catch {
    return []
  }
}
