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

const BUDGET = 100

// ========== 球队中文名称映射（与 matches.ts 保持一致） ==========
const teamNames = {
  'Mexico': '墨西哥', 'South Africa': '南非', 'South Korea': '韩国', 'Czechia': '捷克',
  'Canada': '加拿大', 'Bosnia': '波黑', 'Qatar': '卡塔尔', 'Switzerland': '瑞士',
  'Brazil': '巴西', 'Morocco': '摩洛哥', 'Haiti': '海地', 'Scotland': '苏格兰',
  'Spain': '西班牙', 'Cape Verde': '佛得角', 'Belgium': '比利时', 'Egypt': '埃及',
  'Saudi Arabia': '沙特', 'Uruguay': '乌拉圭', 'Iran': '伊朗', 'New Zealand': '新西兰',
  'France': '法国', 'Senegal': '塞内加尔', 'Iraq': '伊拉克', 'Norway': '挪威',
  'Argentina': '阿根廷', 'Algeria': '阿尔及利亚', 'Austria': '奥地利', 'Jordan': '约旦',
  'Portugal': '葡萄牙', 'DR Congo': '刚果(金)', 'England': '英格兰', 'Croatia': '克罗地亚',
  'Ghana': '加纳', 'Panama': '巴拿马', 'Colombia': '哥伦比亚', 'Uzbekistan': '乌兹别克',
  'Sweden': '瑞典', 'Tunisia': '突尼斯', 'Ivory Coast': '科特迪瓦', 'Ecuador': '厄瓜多尔',
  'Netherlands': '荷兰', 'Japan': '日本', 'Germany': '德国', 'Curacao': '库拉索',
  'Australia': '澳大利亚', 'Turkiye': '土耳其', 'USA': '美国', 'Paraguay': '巴拉圭',
}
const cn = name => teamNames[name] || name

// ========== 北京时间日期工具（基于 kickoff 字段匹配） ==========
// remote.json 中 date 字段是 UTC 日期，kickoff 如 "6/27 03:00" 才是北京时间
// 必须使用 getUTC*() 方法避免本地时区二次偏移
function getTomorrowBJTString() {
  const now = Date.now()
  const bjtNow = now + 8 * 3600 * 1000 // 当前北京时间戳
  const tomorrow = new Date(bjtNow + 24 * 3600 * 1000)
  return `${tomorrow.getUTCMonth() + 1}/${tomorrow.getUTCDate()}`
}
function getTodayBJTString() {
  const now = Date.now()
  const bjtNow = now + 8 * 3600 * 1000
  const today = new Date(bjtNow)
  return `${today.getUTCMonth() + 1}/${today.getUTCDate()}`
}
function getYesterdayBJTString() {
  const now = Date.now()
  const bjtNow = now + 8 * 3600 * 1000
  const yesterday = new Date(bjtNow - 24 * 3600 * 1000)
  return `${yesterday.getUTCMonth() + 1}/${yesterday.getUTCDate()}`
}
// 解析 kickoff "MM/DD HH:MM" → 北京时间日期 "M/D"
function kickoffBJTDate(kickoff) {
  if (!kickoff) return ''
  const m = kickoff.match(/(\d+)\/(\d+)/)
  return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : ''
}
// 从 matches 中筛选 kickoff 在指定北京时间日期的比赛
function matchesByBJTDate(matches, bjtDateStr) {
  return matches.filter(m => kickoffBJTDate(m.kickoff) === bjtDateStr && m.status !== 'finished')
}

const TOMORROW_BJT = getTomorrowBJTString()
const YESTERDAY_BJT = getYesterdayBJTString()

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
  // 22:00复盘：使用今天（北京时间）已结束的比赛（最新鲜的数据）
  const todayBJT = getTodayBJTString()
  const matches = (remote.matches || []).filter(m => {
    return kickoffBJTDate(m.kickoff) === todayBJT && m.status === 'finished'
  })
  // 如果今天没有已结束比赛（比如第一天运行），回退到昨天
  if (matches.length === 0) {
    const yesterdayBJT = getYesterdayBJTString()
    return analyzeBJTDate(remote, yesterdayBJT)
  }
  return analyzeBJTDate(remote, todayBJT)
}

function analyzeBJTDate(remote, bjtDateStr) {
  const matches = (remote.matches || []).filter(m => {
    return kickoffBJTDate(m.kickoff) === bjtDateStr && m.status === 'finished'
  })
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
      match: `${cn(m.homeTeam || '')} vs ${cn(m.awayTeam || '')}`,
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
  const tomorrowIds = matchesByBJTDate(remote.matches || [], TOMORROW_BJT).map(m => m.id)
  
  const pool = []
  
  for (const mid of tomorrowIds) {
    const pred = remote.predictions?.[mid] || {}
    const odds = market.odds?.[mid] || {}
    const m = remote.matches?.find(x => x.id === mid) || {}
    
    const homeEn = m.homeTeam || '', awayEn = m.awayTeam || ''
    const home = cn(homeEn), away = cn(awayEn)
    const group = m.group || '', kickoff = m.kickoff || ''
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
    
    // 胜平负
    const matchDisplay = `${home} vs ${away}`
    if (hOdd) pool.push({ id: `${mid}_h`, mid, match: matchDisplay, group, kickoff, bet: `【胜平负】${home} 主胜`, market: '胜平负', odds: hOdd, prob: hwp, mvi: getMVI('主胜'), ev: calcEV(hwp, hOdd), conf: confidence, risk, type: 'direction' })
    if (dOdd) pool.push({ id: `${mid}_d`, mid, match: matchDisplay, group, kickoff, bet: `【胜平负】${home} vs ${away} 平局`, market: '胜平负', odds: dOdd, prob: dp, mvi: getMVI('平局'), ev: calcEV(dp, dOdd), conf: confidence, risk, type: 'direction' })
    if (aOdd) pool.push({ id: `${mid}_a`, mid, match: matchDisplay, group, kickoff, bet: `【胜平负】${away} 客胜`, market: '胜平负', odds: aOdd, prob: awp, mvi: getMVI('客胜'), ev: calcEV(awp, aOdd), conf: confidence, risk, type: 'direction' })
    
    // 大小球
    if (oOdd) pool.push({ id: `${mid}_o25`, mid, match: matchDisplay, group, kickoff, bet: `【大小球】${home} vs ${away} 大2.5球`, market: '大小球', odds: oOdd, prob: o25p, mvi: getMVI('Over 2.5'), ev: calcEV(o25p, oOdd), conf: confidence, risk, type: 'goals' })
    if (uOdd) pool.push({ id: `${mid}_u25`, mid, match: matchDisplay, group, kickoff, bet: `【大小球】${home} vs ${away} 小2.5球`, market: '大小球', odds: uOdd, prob: u25p, mvi: getMVI('Under 2.5'), ev: calcEV(u25p, uOdd), conf: confidence, risk, type: 'goals' })
    
    // 双重机会
    if (hOdd && dOdd) {
      const hdProb = hwp + dp, hdOdds = 1 / (1/hOdd + 1/dOdd)
      pool.push({ id: `${mid}_dc_hd`, mid, match: matchDisplay, group, kickoff, bet: `【双重机会】${home} 或 平局`, market: '双重机会', odds: Math.round(hdOdds * 100) / 100, prob: hdProb, mvi: 0.98, ev: calcEV(hdProb, hdOdds), conf: confidence, risk, type: 'safety' })
    }
    if (aOdd && dOdd) {
      const adProb = awp + dp, adOdds = 1 / (1/aOdd + 1/dOdd)
      pool.push({ id: `${mid}_dc_ad`, mid, match: matchDisplay, group, kickoff, bet: `【双重机会】${away} 或 平局`, market: '双重机会', odds: Math.round(adOdds * 100) / 100, prob: adProb, mvi: 0.98, ev: calcEV(adProb, adOdds), conf: confidence, risk, type: 'safety' })
    }
    
    // 波胆（正确比分）
    for (const s of (pred.top5Scores || []).slice(0, 5)) {
      const score = typeof s === 'string' ? s : s.score || ''
      const prob = typeof s === 'object' ? (s.probability || 0.01) : 0.01
      const estOdds = Math.round(1 / Math.max(prob, 0.005) * 10) / 10
      pool.push({ id: `${mid}_cs_${score.replace(':', '-')}`, mid, match: matchDisplay, group, kickoff, bet: `【波胆】${home} vs ${away} 比分 ${score}`, market: '波胆', odds: estOdds, prob, mvi: 1.0, ev: calcEV(prob, estOdds), conf: confidence, risk, type: 'score' })
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
// STEP 7: Portfolio Scoring (V4 — 10维评分)
// ============================================================
function scorePortfolio(legs) {
  const n = legs.length
  if (n < 1) return { score: 0, compOdds: 0, compProb: 0, compEV: 0, avgMVI: 0, hitPct: 0, n: 0, markets: [], breakdown: {} }
  
  const compOdds = legs.reduce((p, c) => p * c.odds, 1)
  const compProb = legs.reduce((p, c) => p * c.prob, 1)
  const compEV = compProb * compOdds - 1
  const hitPct = compProb * 100
  
  // 1. EV得分 (0-15分) — 正EV越高越好，负EV直接0分
  const evScore = compEV > 0 ? Math.min(compEV * 10 + 5, 15) : 0
  
  // 2. MVI得分 (0-15分) — 错价信号强度
  const avgMVI = legs.reduce((s, c) => s + c.mvi, 0) / n
  const mviScore = Math.min(avgMVI * 12, 15)
  
  // 3. 命中率得分 (0-15分) — 确定性优先，15-40%区间最优
  let hitScore = 0
  if (hitPct >= 15 && hitPct <= 40) hitScore = 15
  else if (hitPct >= 8 && hitPct < 15) hitScore = 10
  else if (hitPct >= 5 && hitPct < 8) hitScore = 6
  else if (hitPct > 40) hitScore = 8
  
  // 4. 风险得分 (0-10分) — 低风险优于高风险
  const riskMap = { Low: 1, Medium: 2, High: 3 }
  const avgRisk = legs.reduce((s, c) => s + (riskMap[c.risk] || 2), 0) / n
  const riskScore = Math.max(12 - avgRisk * 3, 0)
  
  // 5. 赔率效率得分 (0-10分) — 单位风险的赔率产出
  const oddsEfficiency = compOdds / (n * (1 + avgRisk * 0.5))
  const effScore = Math.min(oddsEfficiency * 2, 10)
  
  // 6. 事件独立性 (0-10分) — 不同比赛、不同市场
  const matches = new Set(legs.map(c => c.mid))
  const matchIndScore = (matches.size / n) * 10
  
  // 7. 市场分散度 (0-10分) — 不同投注市场类型
  const markets = new Set(legs.map(c => c.market))
  const marketDivScore = (markets.size / Math.max(n, 1)) * 10
  
  // 8. 相关性罚分 (0-10分扣减) — 强相关投注项扣分
  let corrPenalty = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (legs[i].mid === legs[j].mid) corrPenalty += 8        // 同场比赛 → 强相关
      if (legs[i].market === legs[j].market && legs[i].group === legs[j].group) corrPenalty += 3 // 同市场+同组
      // 大小球 + 胜平负同场 = 弱相关
      if (legs[i].mid === legs[j].mid && legs[i].type !== legs[j].type) corrPenalty += 2
    }
  }
  
  // 9. 赛程特殊风险 (0-5分) — 第三轮/淘汰赛等特殊阶段
  const has3rdRound = legs.some(c => c.group && c.group.includes('组'))
  const specialRiskPenalty = has3rdRound ? 2 : 0
  
  // 10. 盘口稳定性 (0-5分) — 基于赔率合理性（简化版：MVI标准差作为稳定性指标）
  const mviStd = Math.sqrt(legs.reduce((s, c) => s + Math.pow(c.mvi - avgMVI, 2), 0) / n)
  const stabilityScore = Math.max(5 - mviStd * 8, 0)
  
  let total = evScore + mviScore + hitScore + riskScore + effScore + matchIndScore + marketDivScore + stabilityScore - corrPenalty - specialRiskPenalty
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
      ev:    Math.round(evScore * 10) / 10,
      mvi:   Math.round(mviScore * 10) / 10,
      hit:   Math.round(hitScore * 10) / 10,
      risk:  Math.round(riskScore * 10) / 10,
      eff:   Math.round(effScore * 10) / 10,
      indep: Math.round(matchIndScore * 10) / 10,
      div:   Math.round(marketDivScore * 10) / 10,
      corr:  -Math.round(corrPenalty * 10) / 10,
      sRisk: -Math.round(specialRiskPenalty * 10) / 10,
      stab:  Math.round(stabilityScore * 10) / 10,
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

// V4 辅助函数
function generateRationale(p) {
  const markets = [...new Set(p.legs.map(l => l.market))]
  const topLeg = p.legs.sort((a, b) => b.mvi - a.mvi)[0]
  return `${p.legs.length}场组合，${markets.join('+')}混合。最强信号：${topLeg?.bet?.replace(/【.*?】/g,'')?.slice(0,30)||''}(MVI ${topLeg?.mvi?.toFixed(2)||'N/A'})。命中率${p.hitPct}%，评分${p.score}/100。`
}

function buildFinalVerdict(scored, accepted, yesterday) {
  if (!scored.length || accepted.length < 5) {
    return { verdict: '今日建议空仓，不投注', reason: `可投注项仅${accepted.length}个，正EV机会不足。保留资金等待下一比赛日。`, bestPortfolio: null }
  }
  const best = scored[0]
  const tier = classifyTier(best.compOdds)
  const bestLegsDesc = best.legs.map(l => l.bet.replace(/【.*?】/g,'').slice(0,25)).join(' + ')
  
  return {
    verdict: `今日最佳：${tier}组合 ${best.compOdds}x`,
    reason: `${bestLegsDesc}。Portfolio Score=${best.score}/100，EV=${best.compEV > 0 ? '+' : ''}${(best.compEV*100).toFixed(1)}%，命中率${best.hitPct}%。${
      best.compEV > 0.15 ? '正期望值显著，优先配置。' : 
      best.compEV > 0.05 ? '正期望值可接受，建议适量配置。' : 
      '边际正期望值，降低仓位。'
    }`,
    bestPortfolio: { score: best.score, odds: best.compOdds, legs: best.legs },
  }
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
  const tomorrowIds = matchesByBJTDate(remote.matches || [], TOMORROW_BJT).map(m => m.id)
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
  const tomorrowBJDate = new Date()
  tomorrowBJDate.setDate(tomorrowBJDate.getDate() + 1)
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const targetDateDisplay = `${tomorrowBJDate.getFullYear()}年${tomorrowBJDate.getMonth()+1}月${tomorrowBJDate.getDate()}日（${weekDays[tomorrowBJDate.getDay()]}）`

  // Build Chinese market highlights
  const topMviBet = accepted.sort((a, b) => b.mvi - a.mvi)[0]
  const mviHighlight = topMviBet ? `${topMviBet.bet.replace('【胜平负】','').replace('【大小球】','').replace('【波胆】','').replace('【双重机会】','')} 为本日最强MVI信号(${topMviBet.mvi.toFixed(2)})` : '暂无高MVI信号'
  
  const output = {
    version: '4.0',
    generatedAt: new Date().toISOString(),
    targetDate: TOMORROW_BJT,
    targetDateDisplay,
    targetMatchIds: tomorrowIds,
    oddsFreshness: market.fetchedAt || 'unknown',
    oddsSource: market.source || 'sample',
    
    // ① 今日市场评级
    marketRating: {
      verdict: accepted.length >= 30 ? '✅ 值得下注' : accepted.length >= 15 ? '🟡 机会有限' : '⚠️ 机会稀缺',
      investableCount: accepted.length,
      highMviCount: accepted.filter(c => c.mvi >= 1.05).length,
      positiveEvCount: accepted.filter(c => c.ev > 0).length,
      suggestedExposure: accepted.length >= 30 ? '70-80%' : accepted.length >= 15 ? '50-70%' : '30-50%或建议空仓',
      summary: `${tomorrowIds.length}场比赛，${accepted.length}个可投注项（${accepted.filter(c => c.ev > 0).length}个正EV），${accepted.filter(c => c.mvi >= 1.05).length}个高MVI信号。`,
      highlights: [
        mviHighlight,
        `昨日${yesterday.summary.dirRate < 0.4 ? '方向准确率低' : '方向准确率正常'}(${Math.round(yesterday.summary.dirRate*100)}%)，${yesterday.summary.over25Rate > 0.7 ? '大2.5球策略表现优异' : ''}`,
        `已自动排除${rejected.length}个${rejected.filter(r => r.reasons?.some(rs => rs.includes('EV'))).length > 0 ? 'EV为负或' : ''}MVI过低的投注项`,
      ].filter(Boolean),
    },
    
    // ② 今日最佳投资池（按Portfolio Score排序的全部值得投资的投注项）
    investmentPool: accepted
      .sort((a, b) => b.mvi - a.mvi)
      .filter(c => c.ev > -0.03 || c.mvi >= 1.05)
      .map(c => ({
        match: c.match,
        market: c.market,
        bet: c.bet,
        odds: c.odds,
        ev: Math.round(c.ev * 1000) / 1000,
        mvi: c.mvi,
        prob: c.prob,
        reason: c.mvi >= 1.15 ? '高错价信号' : c.ev > 0.05 ? '正EV' : c.mvi >= 1.05 ? 'MVI达标' : '边际价值',
        type: c.type,
      })),

    // ③ Portfolio搜索结果（Top 10，按Portfolio Score排序）
    portfolios: scored.slice(0, 10).map((p, i) => ({
      rank: i + 1,
      score: p.score,
      odds: p.compOdds,
      hitPct: p.hitPct,
      ev: p.compEV,
      mvi: p.avgMVI,
      legs: p.legs,
      breakdown: p.breakdown,
      tier: classifyTier(p.compOdds),
      rationale: generateRationale(p),
    })),

    // ④ 今日资金配置
    capitalAllocation: allocations,

    // ⑤ 今日最终结论
    finalVerdict: buildFinalVerdict(scored, accepted, yesterday),

    // 保留旧结构兼容
    yesterdayReview: {
      date: getTodayBJTString(),
      summary: yesterday.summary,
      keyInsights: [
        `方向准确率${Math.round(yesterday.summary.dirRate*100)}%`,
        `大2.5球命中${Math.round(yesterday.summary.over25Rate*100)}%`,
        `平局率${Math.round(yesterday.summary.draws/yesterday.summary.n*100)}%`,
      ],
    },
    candidatePool: {
      total: accepted.length + rejected.length,
      accepted: accepted.length,
      rejected: rejected.length,
    },
    bestPortfolio: scored[0] ? {
      tier: classifyTier(scored[0].compOdds),
      score: scored[0].score,
      odds: scored[0].compOdds,
      hitPct: scored[0].hitPct,
      ev: scored[0].compEV,
      mvi: scored[0].avgMVI,
      legs: scored[0].legs,
      breakdown: scored[0].breakdown,
      rationale: generateRationale(scored[0]),
    } : null,

    // Stats
    stats: {
      totalCombinations: portfolios.length,
      topScore: scored[0]?.score || 0,
    }
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\n✅ 已写入 ${OUTPUT_PATH}`)
  console.log(`   组合数: ${portfolios.length} | 最高分: ${scored[0]?.score}/100 | 最佳: ${classifyTier(scored[0]?.compOdds)} ${scored[0]?.compOdds}x`)
}

main()
