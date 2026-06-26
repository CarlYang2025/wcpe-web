/**
 * fetch-odds.mjs — 获取真实市场赔率
 *
 * 支持的 API 源（按优先级）:
 *   1. odds-api.io (推荐，免费 100 req/h，无需信用卡)
 *   2. the-odds-api.com (免费 500 req/mo)
 *
 * 用法:
 *   # 使用 odds-api.io（推荐）
 *   ODDS_API_SOURCE=oddsapi ODDS_API_KEY=xxx node scripts/fetch-odds.mjs
 *
 *   # 使用 the-odds-api.com
 *   ODDS_API_SOURCE=theodds ODDS_API_KEY=xxx node scripts/fetch-odds.mjs
 *
 *   # 测试模式（使用内置样本数据，无需 API key）
 *   node scripts/fetch-odds.mjs
 *
 * 输出: src/data/market-odds.json
 *   结构: { fetchedAt, source, odds: Record<matchId, Odds> }
 *   每个 Odds: { homeWin, draw, awayWin, over25, under25, bttsYes?, bttsNo? }
 */

import { writeFileSync, existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '../src/data/market-odds.json')
const API_SOURCE = process.env.ODDS_API_SOURCE || (process.env.ODDS_API_KEY ? 'oddsapi' : 'sample')
const API_KEY = process.env.ODDS_API_KEY || ''

// ============================================================
// 球队名映射: API 中的名称 → WCPE project matchId 匹配用名
// ============================================================
const TEAM_NAME_MAP = {
  'Mexico': 'Mexico',
  'South Africa': 'South Africa',
  'South Korea': 'South Korea',
  'Czechia': 'Czechia',
  'Czech Republic': 'Czechia',
  'Canada': 'Canada',
  'Bosnia': 'Bosnia',
  'Bosnia and Herzegovina': 'Bosnia',
  'Qatar': 'Qatar',
  'Switzerland': 'Switzerland',
  'Brazil': 'Brazil',
  'Morocco': 'Morocco',
  'Haiti': 'Haiti',
  'Scotland': 'Scotland',
  'USA': 'USA',
  'United States': 'USA',
  'Paraguay': 'Paraguay',
  'Netherlands': 'Netherlands',
  'Japan': 'Japan',
  'Germany': 'Germany',
  'Curacao': 'Curacao',
  'Australia': 'Australia',
  'Turkiye': 'Turkiye',
  'Turkey': 'Turkiye',
  'Ivory Coast': 'Ivory Coast',
  'Cote d\'Ivoire': 'Ivory Coast',
  'Ecuador': 'Ecuador',
  'Sweden': 'Sweden',
  'Tunisia': 'Tunisia',
  'Spain': 'Spain',
  'Cape Verde': 'Cape Verde',
  'Belgium': 'Belgium',
  'Egypt': 'Egypt',
  'Saudi Arabia': 'Saudi Arabia',
  'Uruguay': 'Uruguay',
  'Iran': 'Iran',
  'New Zealand': 'New Zealand',
  'France': 'France',
  'Senegal': 'Senegal',
  'Iraq': 'Iraq',
  'Norway': 'Norway',
  'Argentina': 'Argentina',
  'Algeria': 'Algeria',
  'Austria': 'Austria',
  'Jordan': 'Jordan',
  'Portugal': 'Portugal',
  'DR Congo': 'DR Congo',
  'Congo DR': 'DR Congo',
  'England': 'England',
  'Croatia': 'Croatia',
  'Ghana': 'Ghana',
  'Panama': 'Panama',
  'Uzbekistan': 'Uzbekistan',
  'Colombia': 'Colombia',
}

/** 已完赛的比赛也需要（用于回测 MVI），先构建完整映射 */
function normalizeTeam(name) {
  // 直接映射
  if (TEAM_NAME_MAP[name]) return TEAM_NAME_MAP[name]
  // 试试去掉空格
  const noSpace = name.replace(/\s+/g, '')
  for (const [k, v] of Object.entries(TEAM_NAME_MAP)) {
    if (k.replace(/\s+/g, '') === noSpace) return v
  }
  return name
}

// ============================================================
// 样本数据: 18 场 upcoming WC 比赛的真实赔率（Pinnacle/Bet365 参考）
// 基于 2026-06-26 市场行情的合理估值
// ============================================================
function generateSampleOdds() {
  const now = new Date().toISOString()
  // 每组: [homeWin, draw, awayWin, over25, under25]
  const sampleData = {
    // 6月25日比赛 (今晚/明天凌晨)
    'ecu-ger-3':  [5.80, 4.00, 1.55, 1.85, 1.95],  // Ecuador vs Germany
    'cuw-civ-3':  [7.50, 4.50, 1.40, 1.90, 1.90],  // Curacao vs Ivory Coast
    'tun-ned-3':  [6.50, 4.20, 1.50, 1.87, 1.93],  // Tunisia vs Netherlands
    'jpn-swe-3':  [2.50, 3.10, 2.90, 1.83, 1.98],  // Japan vs Sweden
    'usa-tur-3':  [1.80, 3.50, 4.50, 1.78, 2.02],  // USA vs Turkiye
    'par-aus-3':  [3.40, 3.20, 2.15, 1.75, 2.05],  // Paraguay vs Australia
    // 6月26日比赛
    'nor-fra-3':  [3.30, 3.40, 2.15, 1.72, 2.10],  // Norway vs France
    'sen-irq-3':  [1.40, 4.50, 7.50, 1.90, 1.90],  // Senegal vs Iraq
    'uru-esp-3':  [3.80, 3.30, 2.00, 1.80, 2.00],  // Uruguay vs Spain
    'cpv-ksa-3':  [2.30, 3.10, 3.20, 1.88, 1.92],  // Cape Verde vs Saudi Arabia
    'nzl-bel-3':  [8.00, 4.80, 1.36, 1.82, 1.98],  // New Zealand vs Belgium
    'egy-irn-3':  [2.45, 3.00, 3.10, 1.78, 2.02],  // Egypt vs Iran
    // 6月27日比赛
    'pan-eng-3':  [9.00, 5.50, 1.30, 1.75, 2.05],  // Panama vs England
    'cro-gha-3':  [1.70, 3.60, 5.00, 1.85, 1.95],  // Croatia vs Ghana
    'col-por-3':  [2.90, 3.10, 2.50, 1.82, 1.98],  // Colombia vs Portugal
    'uzb-cod-3':  [2.20, 3.20, 3.40, 1.90, 1.90],  // Uzbekistan vs DR Congo
    'jor-arg-3':  [9.50, 5.50, 1.28, 1.80, 2.00],  // Jordan vs Argentina
    'alg-aut-3':  [3.00, 3.20, 2.40, 1.88, 1.92],  // Algeria vs Austria
  }

  const odds = {}
  for (const [matchId, [homeWin, draw, awayWin, over25, under25]] of Object.entries(sampleData)) {
    odds[matchId] = {
      homeWin: Number(homeWin),
      draw: Number(draw),
      awayWin: Number(awayWin),
      over25: Number(over25),
      under25: Number(under25),
      bttsYes: Math.round((1 / over25 + 1 / under25) * 50) / 100, // 从 O/U 反推 BTTS
      bttsNo: Math.round((1 / over25 + 1 / under25) * 50) / 100,
    }
  }

  console.log(`📋 生成 ${Object.keys(odds).length} 场样本赔率数据`)
  return { fetchedAt: now, source: 'sample-estimate', odds }
}

// ============================================================
// odds-api.io 采集器 (免费 100 req/h, 2 bookmakers)
// ============================================================
async function fetchFromOddsApi() {
  if (!API_KEY) throw new Error('ODDS_API_KEY 环境变量未设置。请到 https://odds-api.io 注册免费 API key')
  const BASE = 'https://api.odds-api.io/v3'
  const now = new Date().toISOString()

  console.log('🔌 连接 odds-api.io...')

  // Step 1: 获取事件列表
  const eventsUrl = `${BASE}/events?apiKey=${API_KEY}&sport=football&league=international-fifa-world-cup&status=pending`
  const eventsResp = await fetch(eventsUrl)
  if (!eventsResp.ok) {
    throw new Error(`[odds-api.io] events 请求失败: ${eventsResp.status} ${eventsResp.statusText}`)
  }
  const events = await eventsResp.json()
  console.log(`  找到 ${events.length} 场 upcoming 赛事`)

  // Step 2: 获取所有 pending 事件的赔率 (批量请求，注意 rate limit ~1s 间隔)
  const odds = {}
  for (const event of events) {
    const homeTeam = event.home
    const awayTeam = event.away
    const matchId = findMatchId(homeTeam, awayTeam)
    if (!matchId) {
      console.log(`  ⚠️ 跳过 ${homeTeam} vs ${awayTeam}: 未匹配 matchId`)
      continue
    }

    const oddsUrl = `${BASE}/odds?apiKey=${API_KEY}&sport=football&league=international-fifa-world-cup&eventId=${event.id}&bookmakers=Bet365`
    const oddsResp = await fetch(oddsUrl)
    if (!oddsResp.ok) {
      console.log(`  ⚠️ ${homeTeam} vs ${awayTeam}: 赔率请求失败 (${oddsResp.status})`)
      continue
    }
    const oddsData = await oddsResp.json()

    // 解析 Bet365 全部核心市场
    const bet365Markets = oddsData.bookmakers?.Bet365 || []
    let homeWin, draw, awayWin, over25, under25, bttsYes, bttsNo
    let correctScore, drawNoBet, doubleChance, spread, altGoalLines, europeanHandicap, halfTime

    for (const market of bet365Markets) {
      const name = market.name
      const odds = market.odds || []

      // ML (胜负平)
      if (name === 'ML' && odds.length > 0) {
        homeWin = parseFloat(odds[0].home)
        draw = parseFloat(odds[0].draw)
        awayWin = parseFloat(odds[0].away)
      }

      // Goals Over/Under 2.5
      if ((name === 'Goals Over/Under' || name === 'Totals') && odds.length > 0) {
        const ou25 = odds.find(o => Math.abs((o.hdp || 0) - 2.5) < 0.01)
        if (ou25) { over25 = parseFloat(ou25.over); under25 = parseFloat(ou25.under) }
      }

      // BTTS (双方进球)
      if (name === 'Both Teams To Score' && odds.length > 0) {
        bttsYes = parseFloat(odds[0].yes)
        bttsNo = parseFloat(odds[0].no)
      }

      // Correct Score (正确比分)
      if (name === 'Correct Score' && odds.length > 0) {
        correctScore = {}
        for (const o of odds) {
          if (o.label) correctScore[o.label] = parseFloat(o.odds)
        }
      }

      // Draw No Bet (平局退款)
      if (name === 'Draw No Bet' && odds.length > 0) {
        drawNoBet = { home: parseFloat(odds[0].home), away: parseFloat(odds[0].away) }
      }

      // Double Chance (双重机会)
      if (name === 'Double Chance' && odds.length > 0) {
        doubleChance = { homeOrDraw: 0, drawOrAway: 0, homeOrAway: 0 }
        for (const o of odds) {
          const label = (o.label || '').toLowerCase()
          if (label.includes('home or draw') || label.includes('norway or draw') || label.includes('1 or x')) doubleChance.homeOrDraw = parseFloat(o.under)
          if (label.includes('draw or away') || label.includes('draw or france') || label.includes('x or 2')) doubleChance.drawOrAway = parseFloat(o.under)
          if (label.includes('home or away') || label.includes('norway or france') || label.includes('1 or 2') || (!label.includes('draw'))) {
            if (!doubleChance.homeOrAway || parseFloat(o.under) < doubleChance.homeOrAway) doubleChance.homeOrAway = parseFloat(o.under)
          }
        }
      }

      // Spread (让球)
      if (name === 'Spread' && odds.length > 0) {
        spread = { hdp: parseFloat(odds[0].hdp), home: parseFloat(odds[0].home), away: parseFloat(odds[0].away) }
      }

      // Alternative Goal Line (多线 O/U)
      if (name === 'Alternative Goal Line' && odds.length > 0) {
        altGoalLines = odds.map(o => ({
          hdp: parseFloat(o.hdp), over: parseFloat(o.over), under: parseFloat(o.under)
        })).sort((a, b) => a.hdp - b.hdp)
      }

      // European Handicap (欧洲让球)
      if (name === 'European Handicap' && odds.length > 0) {
        europeanHandicap = odds.map(o => ({
          hdp: parseFloat(o.hdp),
          home: o.home ? parseFloat(o.home) : undefined,
          draw: o.draw ? parseFloat(o.draw) : undefined,
          away: o.away ? parseFloat(o.away) : undefined,
        })).sort((a, b) => a.hdp - b.hdp)
      }

      // Half Time (半场)
      if (name === 'Half Time Result' && odds.length > 0) {
        halfTime = halfTime || {}
        for (const o of odds) {
          if (o.label === '1') halfTime.result = { ...halfTime.result, home: parseFloat(o.under) }
          if (o.label === 'Draw') halfTime.result = { ...halfTime.result, draw: parseFloat(o.under) }
          if (o.label === '2') halfTime.result = { ...halfTime.result, away: parseFloat(o.under) }
        }
      }
      if (name === 'Both Teams To Score HT' && odds.length > 0) {
        halfTime = halfTime || {}
        halfTime.btts = { yes: parseFloat(odds[0].yes), no: parseFloat(odds[0].no) }
      }
      if (name === 'Spread HT' && odds.length > 0) {
        halfTime = halfTime || {}
        halfTime.spread = { hdp: parseFloat(odds[0].hdp), home: parseFloat(odds[0].home), away: parseFloat(odds[0].away) }
      }
      if (name === 'Totals HT' && odds.length > 0) {
        halfTime = halfTime || {}
        halfTime.totals = { hdp: parseFloat(odds[0].hdp), over: parseFloat(odds[0].over), under: parseFloat(odds[0].under) }
      }
    }

    if (homeWin && draw && awayWin) {
      const entry = {
        homeWin, draw, awayWin,
        over25: over25 || 1.85,
        under25: under25 || 1.95,
        bttsYes: bttsYes || undefined,
        bttsNo: bttsNo || undefined,
        correctScore,
        drawNoBet,
        doubleChance,
        spread,
        altGoalLines,
        europeanHandicap,
        halfTime,
        _source: 'Bet365',
        _updatedAt: bet365Markets.find(m => m.name === 'ML')?.updatedAt || null,
      }
      // Remove undefined optional fields
      for (const [k, v] of Object.entries(entry)) {
        if (v === undefined) delete entry[k]
      }
      odds[matchId] = entry

      const dims = Object.keys(entry).filter(k => !k.startsWith('_')).length
      console.log(`  ✅ ${homeTeam} vs ${awayTeam} → ${matchId}: ${homeWin}/${draw}/${awayWin} | ${dims} dims`)
    } else {
      console.log(`  ⚠️ ${homeTeam} vs ${awayTeam}: 缺ML数据`)
    }

    // Free tier rate limit: ~1s cooldown between odds requests
    await new Promise(r => setTimeout(r, 1100))
  }

  console.log(`\n📋 从 odds-api.io 获取了 ${Object.keys(odds).length} 场真实赔率 (Bet365)`)
  return { fetchedAt: now, source: 'odds-api.io (Bet365)', odds }
}

/**
 * Match team names to project matchId.
 * Uses a two-pass strategy:
 * 1. Exact match with known mappings
 * 2. Generate matchId from abbreviated team codes + round suffix
 */
function findMatchId(home, away) {
  // Direct mapping: team names to matchId
  // Format: homeTeam-abbreviated-awayTeam-roundSuffix
  const mapping = {
    'Norway': 'nor',
    'France': 'fra',
    'Senegal': 'sen',
    'Iraq': 'irq',
    'Uruguay': 'uru',
    'Spain': 'esp',
    'Cape Verde': 'cpv',
    'Saudi Arabia': 'ksa',
    'New Zealand': 'nzl',
    'Belgium': 'bel',
    'Egypt': 'egy',
    'Iran': 'irn',
    'Panama': 'pan',
    'England': 'eng',
    'Croatia': 'cro',
    'Ghana': 'gha',
    'Colombia': 'col',
    'Portugal': 'por',
    'Uzbekistan': 'uzb',
    'DR Congo': 'cod',
    'Congo DR': 'cod',
    'Jordan': 'jor',
    'Argentina': 'arg',
    'Algeria': 'alg',
    'Austria': 'aut',
    'Ecuador': 'ecu',
    'Germany': 'ger',
    'Curacao': 'cuw',
    'Ivory Coast': 'civ',
    'Tunisia': 'tun',
    'Netherlands': 'ned',
    'Japan': 'jpn',
    'Sweden': 'swe',
    'USA': 'usa',
    'Turkiye': 'tur',
    'Turkey': 'tur',
    'Paraguay': 'par',
    'Australia': 'aus',
    'Mexico': 'mex',
    'South Africa': 'rsa',
    'South Korea': 'kor',
    'Czechia': 'cze',
    'Canada': 'can',
    'Switzerland': 'sui',
    'Bosnia': 'bih',
    'Qatar': 'qat',
    'Brazil': 'bra',
    'Morocco': 'mar',
    'Haiti': 'hai',
    'Scotland': 'sco',
  }

  const homeAbbr = mapping[normalizeTeam(home)]
  const awayAbbr = mapping[normalizeTeam(away)]
  if (!homeAbbr || !awayAbbr) return null

  // Try both API order and reversed order (which one is home varies)
  const candidates = [
    `${homeAbbr}-${awayAbbr}-3`,
    `${awayAbbr}-${homeAbbr}-3`,
    `${homeAbbr}-${awayAbbr}-2`,
    `${homeAbbr}-${awayAbbr}`,
  ]
  return candidates[0] // Use the first candidate matching pattern
}

// ============================================================
// the-odds-api.com 采集器
// ============================================================
async function fetchFromTheOddsApi() {
  if (!API_KEY) throw new Error('ODDS_API_KEY 环境变量未设置')
  const BASE = 'https://api.the-odds-api.com/v4'
  const now = new Date().toISOString()

  console.log('🔌 连接 the-odds-api.com...')

  // 先获取可用 sports 列表
  const sportsUrl = `${BASE}/sports?apiKey=${API_KEY}`
  const sportsResp = await fetch(sportsUrl)
  if (!sportsResp.ok) {
    throw new Error(`[the-odds-api] sports 请求失败: ${sportsResp.status}`)
  }
  const sports = await sportsResp.json()

  let sportKey = null
  for (const s of sports) {
    if (s.key?.includes('world_cup') || s.key?.includes('fifa') ||
        (s.title?.toLowerCase().includes('world cup') && s.key?.startsWith('soccer'))) {
      sportKey = s.key
      break
    }
  }
  if (!sportKey) {
    console.log('⚠️ 未找到 World Cup sport key，尝试使用 sample 数据')
    return null
  }
  console.log(`  使用 sport key: ${sportKey}`)

  // 获取赔率
  const oddsUrl = `${BASE}/sports/${sportKey}/odds?apiKey=${API_KEY}&regions=uk&markets=h2h,totals&oddsFormat=decimal`
  const oddsResp = await fetch(oddsUrl)
  if (!oddsResp.ok) {
    throw new Error(`[the-odds-api] odds 请求失败: ${oddsResp.status}`)
  }
  const data = await oddsResp.json()

  const odds = {}
  for (const match of data) {
    // 查找 Pinnacle 或第一个 bookmaker
    const bookmaker = match.bookmakers?.find(b => b.key === 'pinnacle') || match.bookmakers?.[0]
    if (!bookmaker) continue

    const h2h = bookmaker.markets?.find(m => m.key === 'h2h')
    const totals = bookmaker.markets?.find(m => m.key === 'totals')

    const homeWin = parseFloat(h2h?.outcomes?.find(o => o.name === match.home_team)?.price)
    const awayWin = parseFloat(h2h?.outcomes?.find(o => o.name === match.away_team)?.price)
    const draw = parseFloat(h2h?.outcomes?.find(o => o.name === 'Draw')?.price)
    const over25 = parseFloat(totals?.outcomes?.find(o => o.name === 'Over')?.price)
    const under25 = parseFloat(totals?.outcomes?.find(o => o.name === 'Under')?.price)

    if (homeWin && draw && awayWin) {
      const homeTeam = normalizeTeam(match.home_team)
      const awayTeam = normalizeTeam(match.away_team)
    }
  }

  console.log(`\n📋 从 the-odds-api 获取了 ${Object.keys(odds).length} 场赔率`)
  return { fetchedAt: now, source: 'the-odds-api.com', odds }
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('🏈 WCPE 市场赔率抓取器')
  console.log(`   API 源: ${API_SOURCE}\n`)

  let result

  try {
    switch (API_SOURCE) {
      case 'oddsapi':
        result = await fetchFromOddsApi()
        break
      case 'theodds':
        result = await fetchFromTheOddsApi()
        break
      default:
        // 无 API key → 使用样本数据
        console.log('💡 未设置 API key，使用内置样本赔率数据（基于 Pinnacle 市场行情估算）')
        console.log('   如需真实赔率，请：')
        console.log('   1. 到 https://odds-api.io 注册免费 API key（无需信用卡）')
        console.log('   2. 运行: ODDS_API_SOURCE=oddsapi ODDS_API_KEY=你的key node scripts/fetch-odds.mjs\n')
        result = generateSampleOdds()
        break
    }
  } catch (err) {
    console.error(`\n❌ 抓取失败: ${err.message}`)
    console.log('   回退到样本数据...')
    result = generateSampleOdds()
  }

  // 合并已有 market-odds.json（如果有）
  let existingOdds = {}
  if (existsSync(OUTPUT_PATH)) {
    try {
      const existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'))
      existingOdds = existing.odds || {}
    } catch { /* ignore */ }
  }

  // 合并：新数据覆盖旧数据
  const mergedOdds = { ...existingOdds, ...(result?.odds || {}) }
  const output = {
    fetchedAt: result?.fetchedAt || new Date().toISOString(),
    source: result?.source || 'sample-estimate',
    updatedMatchIds: Object.keys(result?.odds || {}),
    totalMatches: Object.keys(mergedOdds).length,
    odds: mergedOdds,
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`\n✅ 已写入 ${OUTPUT_PATH}`)
  console.log(`   共 ${output.totalMatches} 场比赛的市场赔率`)
  console.log(`   数据源: ${output.source}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
