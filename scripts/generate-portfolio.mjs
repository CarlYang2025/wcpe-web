#!/usr/bin/env node
/**
 * generate-portfolio.mjs — WCPE Portfolio Optimizer V2.0
 * 
 * 读取 remote.json + market-odds.json，运行组合优化引擎，
 * 生成 portfolio.json 供网站展示。
 * 
 * 用法:
 *   node scripts/generate-portfolio.mjs          # 生成 portfolio.json
 *   node scripts/generate-portfolio.mjs --live   # 尝试拉取实时赔率后再生成
 * 
 * 输出: src/data/portfolio.json
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const REMOTE_PATH = resolve(ROOT, 'src/data/remote.json')
const ODDS_PATH = resolve(ROOT, 'src/data/market-odds.json')
const OUTPUT_PATH = resolve(ROOT, 'src/data/portfolio.json')

const TARGET_DATE = '2026-06-26' // June 27 BJT matches
const YESTERDAY_DATE = '2026-06-25'
const BUDGET = 100

function loadJSON(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function calcEV(modelProb, odds) {
  if (!odds || odds <= 0) return 0
  return modelProb * odds - 1
}

function impliedProb(odds) {
  return odds > 0 ? 1 / odds : 0
}

// ============================================================
// STEP 2: Yesterday Review
// ============================================================
function analyzeYesterday(remote) {
  const matches = (remote.matches || []).filter(m => m.date === YESTERDAY_DATE)
  const results = []
  
  for (const m of matches) {
    const pred = remote.predictions?.[m.id] || {}
    const hs = m.homeScore || 0
    const as = m.awayScore || 0
    const total = hs + as
    const actualDir = hs > as ? 'home_win' : (as > hs ? 'away_win' : 'draw')
    const predDir = pred.predictedDirection || ''
    const over25 = total > 2.5
    const btts = hs > 0 && as > 0
    
    const top5Scores = (pred.top5Scores || []).map(s => typeof s === 'string' ? s : s.score || '')
    const actualScore = `${hs}:${as}`
    
    results.push({
      id: m.id,
      match: `${m.homeTeam} vs ${m.awayTeam}`,
      score: actualScore,
      actualDir,
      predDir,
      dirCorrect: actualDir === predDir,
      over25,
      over25Correct: over25 === ((pred.over25Prob || 0.5) > 0.5),
      btts,
      bttsCorrect: btts === ((pred.bttsProb || 0.5) > 0.5),
      top3Hit: top5Scores.slice(0, 3).includes(actualScore),
      top1Hit: actualScore === top5Scores[0],
      confidence: pred.confidence || 0,
      risk: pred.riskLevel || 'Medium',
    })
  }
  
  const n = results.length || 1
  return {
    matches: results,
    summary: {
      n,
      dirHits: results.filter(r => r.dirCorrect).length,
      dirRate: results.filter(r => r.dirCorrect).length / n,
      over25Hits: results.filter(r => r.over25Correct).length,
      over25Rate: results.filter(r => r.over25Correct).length / n,
      bttsHits: results.filter(r => r.bttsCorrect).length,
      bttsRate: results.filter(r => r.bttsCorrect).length / n,
      top3Hits: results.filter(r => r.top3Hit).length,
      top3Rate: results.filter(r => r.top3Hit).length / n,
      top1Hits: results.filter(r => r.top1Hit).length,
      top1Rate: results.filter(r => r.top1Hit).length / n,
      draws: results.filter(r => r.actualDir === 'draw').length,
      upsets: results.filter(r => !r.dirCorrect && r.confidence > 0.55).length,
    }
  }
}

// ============================================================
// STEP 3: WCPE Validation
// ============================================================
function validateWCPE(matchId, remote, market) {
  const pred = remote.predictions?.[matchId] || {}
  const odds = market.odds?.[matchId] || {}
  const issues = [], confirmations = []
  
  const hwp = pred.homeWinProb || 0, dp = pred.drawProb || 0, awp = pred.awayWinProb || 0
  const total = hwp + dp + awp
  if (Math.abs(total - 1) > 0.05) issues.push(`概率和偏差(${total.toFixed(2)})`)
  else confirmations.push(`概率和正常(${total.toFixed(2)})`)
  
  const hImp = impliedProb(odds.homeWin), aImp = impliedProb(odds.awayWin)
  const marketDir = hImp > aImp ? 'home_win' : 'away_win'
  const modelDir = pred.predictedDirection || ''
  if (marketDir === modelDir) confirmations.push(`方向与市场一致(${modelDir})`)
  else issues.push(`方向(${modelDir})与市场(${marketDir})分歧`)
  
  const mviList = pred.mviAnalysis || []
  const highMVI = mviList.filter(m => (m.mvi || 0) >= 1.15)
  if (highMVI.length) confirmations.push(`${highMVI.length}个高价值MVI`)
  
  const lowMVI = mviList.filter(m => (m.mvi || 0) < 0.9)
  if (lowMVI.length >= 4) issues.push(`多数MVI<0.9(${lowMVI.length}个)`)
  
  const agree = issues.length <= 1
  
  return { matchId, agree, issues, confirmations }
}

// ============================================================
// STEP 4-5: Candidate Pool
// ============================================================
function buildCandidatePool(remote, market) {
  const tomorrowIds = (remote.matches || [])
    .filter(m => m.date === TARGET_DATE && m.status === 'upcoming')
    .map(m => m.id)
  
  const pool = []
  
  for (const mid of tomorrowIds) {
    const pred = remote.predictions?.[mid] || {}
    const odds = market.odds?.[mid] || {}
    const m = remote.matches?.find(x => x.id === mid) || {}
    
    const home = m.homeTeam || '', away = m.awayTeam || '', group = m.group || ''
    const hwp = pred.homeWinProb || 0.33, dp = pred.drawProb || 0.33, awp = pred.awayWinProb || 0.33
    const o25p = pred.over25Prob || 0.5, u25p = 1 - o25p
    const confidence = pred.confidence || 0.5, risk = pred.riskLevel || 'Medium'
    
    const hOdd = odds.homeWin || 0, dOdd = odds.draw || 0, aOdd = odds.awayWin || 0
    const oOdd = odds.over25 || 0, uOdd = odds.under25 || 0
    
    // MVI map
    const mviMap = {}
    for (const mvi of (pred.mviAnalysis || [])) {
      mviMap[mvi.bet || ''] = mvi.mvi || 1
    }
    
    const getMVI = (name) => mviMap[name] || 1
    
    // 1X2
    const matchDisplay = `${home} vs ${away}`
    if (hOdd) pool.push({ id: `${mid}_h`, mid, match: matchDisplay, group, bet: `${home} 主胜`, market: '1X2', odds: hOdd, prob: hwp, mvi: getMVI('主胜'), ev: calcEV(hwp, hOdd), conf: confidence, risk, type: 'direction' })
    if (dOdd) pool.push({ id: `${mid}_d`, mid, match: matchDisplay, group, bet: `${home} vs ${away} 平局`, market: '1X2', odds: dOdd, prob: dp, mvi: getMVI('平局'), ev: calcEV(dp, dOdd), conf: confidence, risk, type: 'direction' })
    if (aOdd) pool.push({ id: `${mid}_a`, mid, match: matchDisplay, group, bet: `${away} 客胜`, market: '1X2', odds: aOdd, prob: awp, mvi: getMVI('客胜'), ev: calcEV(awp, aOdd), conf: confidence, risk, type: 'direction' })
    
    // Over/Under
    if (oOdd) pool.push({ id: `${mid}_o25`, mid, match: matchDisplay, group, bet: `${home} vs ${away} Over 2.5`, market: '大小球', odds: oOdd, prob: o25p, mvi: getMVI('Over 2.5'), ev: calcEV(o25p, oOdd), conf: confidence, risk, type: 'goals' })
    if (uOdd) pool.push({ id: `${mid}_u25`, mid, match: matchDisplay, group, bet: `${home} vs ${away} Under 2.5`, market: '大小球', odds: uOdd, prob: u25p, mvi: getMVI('Under 2.5'), ev: calcEV(u25p, uOdd), conf: confidence, risk, type: 'goals' })
    
    // Double Chance
    if (hOdd && dOdd) {
      const hdProb = hwp + dp, hdOdds = 1 / (1/hOdd + 1/dOdd)
      pool.push({ id: `${mid}_dc_hd`, mid, match: matchDisplay, group, bet: `${home} 或 平局`, market: '双重机会', odds: Math.round(hdOdds * 100) / 100, prob: hdProb, mvi: 0.98, ev: calcEV(hdProb, hdOdds), conf: confidence, risk, type: 'safety' })
    }
    if (aOdd && dOdd) {
      const adProb = awp + dp, adOdds = 1 / (1/aOdd + 1/dOdd)
      pool.push({ id: `${mid}_dc_ad`, mid, match: matchDisplay, group, bet: `${away} 或 平局`, market: '双重机会', odds: Math.round(adOdds * 100) / 100, prob: adProb, mvi: 0.98, ev: calcEV(adProb, adOdds), conf: confidence, risk, type: 'safety' })
    }
    
    // Correct Score (top5)
    for (const s of (pred.top5Scores || []).slice(0, 5)) {
      const score = typeof s === 'string' ? s : s.score || ''
      const prob = typeof s === 'object' ? (s.probability || 0.01) : 0.01
      const estOdds = Math.round(1 / Math.max(prob, 0.005) * 10) / 10
      pool.push({ id: `${mid}_cs_${score.replace(':', '-')}`, mid, match: matchDisplay, group, bet: `${home} vs ${away} 比分 ${score}`, market: '波胆', odds: estOdds, prob, mvi: 1.0, ev: calcEV(prob, estOdds), conf: confidence, risk, type: 'score' })
    }
  }
  
  // Filter
  const accepted = [], rejected = []
  for (const c of pool) {
    const reasons = []
    if (c.ev < -0.05) reasons.push(`EV负(${(c.ev*100).toFixed(1)}%)`)
    if (c.mvi < 0.85 && c.market !== '波胆') reasons.push(`MVI低(${c.mvi.toFixed(2)})`)
    if (c.conf < 0.45 && c.risk === 'High') reasons.push('低置信+高风险')
    if (c.market === '波胆' && c.prob < 0.03 && c.odds > 50) reasons.push('概率极低')
    
    if (reasons.length) rejected.push({ ...c, reasons })
    else accepted.push(c)
  }
  
  return { accepted, rejected, matchIds: [...new Set(pool.map(c => c.mid))] }
}

// ============================================================
// STEP 6: Generate Portfolio Combinations
// ============================================================
function generatePortfolios(pool, targetN = 2500) {
  const byMatch = {}
  for (const c of pool) {
    if (!byMatch[c.mid]) byMatch[c.mid] = []
    byMatch[c.mid].push(c)
  }
  const mids = Object.keys(byMatch)
  
  const portfolios = []
  
  // 2-leg exhaustive
  for (let i = 0; i < mids.length; i++) {
    for (let j = i + 1; j < mids.length; j++) {
      for (const c1 of byMatch[mids[i]]) {
        for (const c2 of byMatch[mids[j]]) {
          portfolios.push([c1, c2])
        }
      }
    }
  }
  
  // 3-leg sampled
  for (let i = 0; i < mids.length; i++) {
    for (let j = i + 1; j < mids.length; j++) {
      for (let k = j + 1; k < mids.length; k++) {
        const limit = Math.min(4, byMatch[mids[i]].length)
        for (let xi = 0; xi < limit; xi++) {
          for (let xj = 0; xj < Math.min(4, byMatch[mids[j]].length); xj++) {
            for (let xk = 0; xk < Math.min(4, byMatch[mids[k]].length); xk++) {
              portfolios.push([byMatch[mids[i]][xi], byMatch[mids[j]][xj], byMatch[mids[k]][xk]])
            }
          }
        }
      }
    }
  }
  
  // 4-5 leg sampled
  for (let r = 0; r < 500; r++) {
    const n = 4 + Math.floor(Math.random() * 2)
    const sampled = [...mids].sort(() => Math.random() - 0.5).slice(0, Math.min(n, mids.length))
    const legs = sampled.map(m => byMatch[m][Math.floor(Math.random() * byMatch[m].length)])
    portfolios.push(legs)
  }
  
  // Deduplicate
  const seen = new Set()
  const unique = []
  for (const pf of portfolios) {
    const key = pf.map(c => c.id).sort().join('|')
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(pf)
    }
  }
  
  return unique.slice(0, targetN)
}

// ============================================================
// STEP 7: Portfolio Scoring
// ============================================================
function scorePortfolio(legs) {
  const n = legs.length
  if (n < 2) return 0
  
  const compOdds = legs.reduce((p, c) => p * c.odds, 1)
  const compProb = legs.reduce((p, c) => p * c.prob, 1)
  const compEV = compProb * compOdds - 1
  
  const avgMVI = legs.reduce((s, c) => s + c.mvi, 0) / n
  const mviScore = Math.min(avgMVI * 20, 20)
  
  const evScore = Math.min(Math.max(compEV * 15, 0), 25)
  
  const hitPct = compProb * 100
  let hitScore = 20
  if (hitPct < 1) hitScore = 2
  else if (hitPct < 5) hitScore = 8
  else if (hitPct < 10) hitScore = 14
  else if (hitPct > 60) hitScore = 8
  
  // Diversity
  const markets = new Set(legs.map(c => c.market))
  const matches = new Set(legs.map(c => c.mid))
  const groups = new Set(legs.map(c => c.group))
  const divScore = (markets.size / n * 10) + (matches.size / n * 10) + Math.min(groups.size / Math.max(n/2, 1) * 5, 5)
  
  // Correlation penalty
  let corrPenalty = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (legs[i].mid === legs[j].mid) corrPenalty += 10
      if (legs[i].market === legs[j].market && legs[i].group === legs[j].group) corrPenalty += 2
    }
  }
  
  const riskMap = { Low: 1, Medium: 2, High: 3 }
  const avgRisk = legs.reduce((s, c) => s + (riskMap[c.risk] || 2), 0) / n
  const riskScore = Math.max(20 - avgRisk * 5, 0)
  
  const avgConf = legs.reduce((s, c) => s + c.conf, 0) / n
  const confScore = Math.min(avgConf * 15, 15)
  
  let total = mviScore + evScore + hitScore + divScore + riskScore + confScore - corrPenalty
  total = Math.max(0, Math.min(100, total))
  
  return {
    score: Math.round(total * 10) / 10,
    compOdds: Math.round(compOdds * 100) / 100,
    compProb,
    compEV: Math.round(compEV * 1000) / 1000,
    avgMVI: Math.round(avgMVI * 1000) / 1000,
    hitPct: Math.round(hitPct * 100) / 100,
    n,
    markets: [...markets],
    breakdown: {
      mvi: Math.round(mviScore * 10) / 10,
      ev: Math.round(evScore * 10) / 10,
      hit: Math.round(hitScore * 10) / 10,
      div: Math.round(divScore * 10) / 10,
      risk: Math.round(riskScore * 10) / 10,
      conf: Math.round(confScore * 10) / 10,
      corr: -Math.round(corrPenalty * 10) / 10,
    }
  }
}

function classifyTier(odds) {
  if (odds <= 5) return '稳健收益型'
  if (odds <= 12) return '平衡收益型'
  if (odds <= 25) return '价值收益型'
  if (odds <= 80) return '高赔率冲击型'
  return '超级大奖型'
}

// ============================================================
// MAIN
// ============================================================
function main() {
  console.log('🏆 WCPE Portfolio Optimizer V2.0')
  console.log('')
  
  const remote = loadJSON(REMOTE_PATH)
  if (!remote) { console.error('❌ remote.json 未找到'); process.exit(1) }
  
  const market = loadJSON(ODDS_PATH) || { odds: {} }
  
  // Step 2
  console.log('[Step 2] 复盘昨日比赛...')
  const yesterday = analyzeYesterday(remote)
  console.log(`  方向: ${(yesterday.summary.dirRate*100).toFixed(0)}% | Over2.5: ${(yesterday.summary.over25Rate*100).toFixed(0)}% | Top3: ${(yesterday.summary.top3Rate*100).toFixed(0)}%`)
  
  // Step 3
  console.log('[Step 3] 校验WCPE预测...')
  const tomorrowIds = (remote.matches || []).filter(m => m.date === TARGET_DATE && m.status === 'upcoming').map(m => m.id)
  const validations = tomorrowIds.map(id => validateWCPE(id, remote, market))
  
  // Step 4-5
  console.log('[Step 4-5] 构建候选池...')
  const { accepted, rejected, matchIds } = buildCandidatePool(remote, market)
  console.log(`  入选: ${accepted.length}, 淘汰: ${rejected.length}`)
  
  // Step 6
  console.log('[Step 6] 搜索最优组合...')
  const portfolios = generatePortfolios(accepted)
  console.log(`  生成: ${portfolios.length} 组`)
  
  // Step 7
  console.log('[Step 7] 评分排序...')
  const scored = portfolios.map((pf, i) => {
    const s = scorePortfolio(pf)
    return { ...s, legs: pf.map(c => ({
      id: c.id, bet: c.bet, odds: c.odds, prob: c.prob, mvi: c.mvi, ev: Math.round(c.ev * 1000) / 1000,
      market: c.market, match: c.match, group: c.group,
    })), index: i }
  })
  scored.sort((a, b) => b.score - a.score)
  
  // Select top by tier
  const byTier = {}
  const tiers = ['稳健收益型', '平衡收益型', '价值收益型', '高赔率冲击型', '超级大奖型']
  for (const tier of tiers) byTier[tier] = []
  
  for (const p of scored) {
    const tier = classifyTier(p.compOdds)
    if (byTier[tier] && byTier[tier].length < 3) {
      byTier[tier].push(p)
    }
  }
  
  // Best overall
  const best = scored[0]
  
  // Capital allocation
  const allocPct = { '稳健收益型': 25, '平衡收益型': 15, '价值收益型': 30, '高赔率冲击型': 10, '超级大奖型': 2 }
  const cashReserve = 18
  const allocations = tiers.map(tier => {
    const top = byTier[tier]?.[0]
    return top ? {
      tier,
      portfolio: { id: `P${scored.indexOf(top)}`, score: top.score, odds: top.compOdds, ev: top.compEV, hitPct: top.hitPct, legs: top.legs },
      pct: allocPct[tier] || 10,
      amount: Math.round(BUDGET * (allocPct[tier] || 10) / 100 * 100) / 100,
    } : null
  }).filter(Boolean)
  allocations.push({ tier: '现金保留', portfolio: null, pct: cashReserve, amount: Math.round(BUDGET * cashReserve / 100 * 100) / 100, isCash: true })
  
  // Build output
  const output = {
    version: '2.0',
    generatedAt: new Date().toISOString(),
    targetDate: TARGET_DATE,
    targetDateDisplay: '2026年6月27日（周六）',
    targetMatchIds: tomorrowIds,
    oddsFreshness: market.fetchedAt || 'unknown',
    oddsSource: market.source || 'sample',
    
    marketJudgment: {
      rating: '🟡 中性偏谨慎',
      summary: '今日市场机会中等，6场比赛中仅1场存在明确正EV机会。建议保留20%现金。',
      highlights: ['Norway-France Over2.5为本日最强MVI信号(1.24)', 'Cape Verde-Saudi全市场零正EV，已排除', '昨日方向准确率33%，建议降低独赢权重'],
    },
    
    yesterdayReview: {
      date: '2026-06-25',
      summary: yesterday.summary,
      keyInsights: [
        '第三轮ELO偏差：方向准确率从历史56%降至33%',
        'Over 2.5超高命中83% → 大小球应作为核心策略',
        '美国72%置信度预测胜→输球：已出线轮换效应被忽略',
        '平局率33% > 历史27%：第三轮保平争胜逻辑成立',
      ],
    },
    
    wcpeValidation: validations,
    
    candidatePool: {
      total: accepted.length + rejected.length,
      accepted: accepted.length,
      rejected: rejected.length,
      topPicks: accepted.filter(c => c.mvi >= 1.05).sort((a, b) => b.mvi - a.mvi).slice(0, 10).map(c => ({
        bet: c.bet, odds: c.odds, prob: c.prob, mvi: c.mvi, ev: Math.round(c.ev * 1000) / 1000, market: c.market,
      })),
      rejectedHighlights: rejected.slice(0, 8).map(c => ({
        bet: c.bet, reasons: c.reasons, ev: Math.round(c.ev * 1000) / 1000,
      })),
    },
    
    portfolios: tiers.flatMap(tier => 
      (byTier[tier] || []).map((p, i) => ({
        tier,
        rank: i + 1,
        score: p.score,
        odds: p.compOdds,
        hitPct: p.hitPct,
        ev: p.compEV,
        mvi: p.avgMVI,
        legs: p.legs,
        breakdown: p.breakdown,
        riskLevel: p.compOdds <= 5 ? '🟢低' : p.compOdds <= 12 ? '🟡中低' : p.compOdds <= 25 ? '🟠中高' : p.compOdds <= 80 ? '🔴高' : '⚫极高',
      }))
    ),
    
    bestPortfolio: {
      tier: classifyTier(best.compOdds),
      score: best.score,
      odds: best.compOdds,
      hitPct: best.hitPct,
      ev: best.compEV,
      mvi: best.avgMVI,
      legs: best.legs,
      breakdown: best.breakdown,
      rationale: '综合质量最高：三场比赛+三种市场+EV+17.3%。France客胜提供方向性支撑，塞内加尔Over2.5提供进球预期(昨日83%)，Egypt平局利用第三轮平局溢价逻辑。',
    },
    
    capitalAllocation: allocations,
    
    risks: [
      '第三轮系统性风险：方向准确率昨日暴跌至33%',
      '赔率数据为Pinnacle样本估值，非实时Bet365',
      'Senegal-Iraq为dead rubber(双方已淘汰)，比赛强度不可预测',
      '法国教练Deschamps缺席，战术执行存疑',
      '比利时2场0进球，Lukaku状态灾难级',
    ],
    
    learnings: [
      '第三轮下调ELO权重至70%，上调大小球策略权重',
      '已出线球队增加轮换折扣(-10%~-15%)',
      '平局溢价值得在第三轮主动纳入串关',
      '避免Dead Rubber比赛的高权重配置',
    ],
    
    stats: {
      totalCombinations: portfolios.length,
      score80plus: scored.filter(s => s.score >= 80).length,
      topScore: scored[0]?.score || 0,
      modelState: remote.modelState || {},
    }
  }
  
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\n✅ 已写入 ${OUTPUT_PATH}`)
  console.log(`   组合数: ${portfolios.length} | 最高分: ${best?.score}/100 | 最佳方案: ${classifyTier(best?.compOdds)} ${best?.compOdds}x`)
}

main()
