#!/usr/bin/env node
/**
 * generate-portfolio.mjs — WCPE Portfolio Optimizer V5.1
 * 
 * 读取 remote.json + market-odds.json，运行投资委员会审查 + 组合优化引擎，
 * 生成 portfolio.json 供网站展示。
 * 
 * V5.1 改进:
 *   - 历史教训上下文感知匹配（只对实际场景应用相关教训）
 *   - 状态细节提取（从riskWarnings提取具体状态问题）
 *   - 因子短板精简显示（最多2个）
 * 
 * V5.0 核心理念:
 *   - 「投资委员会」：定量 + 定性深度融合
 *   - 定性分析层: 伤病/淘汰动态/心理因素/因子短板/历史教训/盘口压力
 *   - 方向一致性检查: 投注方向 vs WCPE预测 → 矛盾即降权/踢出
 *   - 3日滑动平均 + 对数EV衰减 + Poisson区间
 *   - 资金分散 + 波胆MVI分级 + 去集中化v2
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

// ========== 球队中文名称映射 ==========
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

// ========== 北京时间日期工具 ==========
function getTomorrowBJTString() {
  const now = Date.now()
  const bjtNow = now + 8 * 3600 * 1000
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
function kickoffBJTDate(kickoff) {
  if (!kickoff) return ''
  const m = kickoff.match(/(\d+)\/(\d+)/)
  return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : ''
}
function matchesByBJTDate(matches, bjtDateStr) {
  return matches.filter(m => kickoffBJTDate(m.kickoff) === bjtDateStr && m.status !== 'finished')
}

const TOMORROW_BJT = getTomorrowBJTString()

function loadJSON(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// ========== 基础计算 ==========
function calcEV(modelProb, odds) {
  if (!odds || odds <= 0) return 0
  return modelProb * odds - 1
}

function impliedProb(odds) {
  return odds > 0 ? 1 / odds : 0
}

/** 去水概率：Margin = Σ(1/odds)-1，去水概率 = 1/[odds×(1+Margin)] */
function dewateredProb(odds, allOdds) {
  if (!odds || odds <= 0) return 0
  const margin = allOdds.reduce((s, o) => s + (o > 0 ? 1 / o : 0), 0) - 1
  return 1 / (odds * (1 + margin))
}

// ===================================================================
// STEP 1: Yesterday Review + 策略权重学习
// ===================================================================

/**
 * V4.3: 获取指定日期偏移的北京时间日期字符串
 * @param {number} dayOffset - 0=今天, -1=昨天, -2=前天 ...
 */
function getBJTDateWithOffset(dayOffset = 0) {
  const now = Date.now()
  const bjtNow = now + 8 * 3600 * 1000
  const date = new Date(bjtNow + dayOffset * 24 * 3600 * 1000)
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
}

function analyzeYesterday(remote) {
  const todayBJT = getBJTDateWithOffset(0)
  const yesterdayBJT = getBJTDateWithOffset(-1)
  const day2BJT = getBJTDateWithOffset(-2)
  const day3BJT = getBJTDateWithOffset(-3)

  let matches = (remote.matches || []).filter(m => {
    return kickoffBJTDate(m.kickoff) === todayBJT && m.status === 'finished'
  })
  if (matches.length === 0) {
    matches = (remote.matches || []).filter(m => {
      return kickoffBJTDate(m.kickoff) === yesterdayBJT && m.status === 'finished'
    })
  }

  // V4.3: 3日滑动平均 — 加权合并多日数据
  // 权重: 最近日50%, 前日30%, 前前日20%
  const allResults = analyzeBJTDate(remote, matches)

  // 如果昨日比赛不足3场，尝试纳入前2-3天数据
  if (matches.length < 3) {
    const day2Matches = (remote.matches || []).filter(m => {
      return kickoffBJTDate(m.kickoff) === day2BJT && m.status === 'finished'
    })
    const day3Matches = (remote.matches || []).filter(m => {
      return kickoffBJTDate(m.kickoff) === day3BJT && m.status === 'finished'
    })

    if (day2Matches.length > 0 || day3Matches.length > 0) {
      // 合并多日数据并计算加权平均
      const d2Result = day2Matches.length > 0 ? analyzeBJTDate(remote, day2Matches) : null
      const d3Result = day3Matches.length > 0 ? analyzeBJTDate(remote, day3Matches) : null

      return mergeMultiDayStrategyWeights(allResults, d2Result, d3Result)
    }
  }

  return allResults
}

/**
 * V4.3: 合并多日复盘数据，计算加权滑动平均
 * 权重: 最近日50%, 前日30%, 前前日20%
 */
function mergeMultiDayStrategyWeights(d1, d2, d3) {
  const weights = []
  const results = []

  // d1: 50%
  if (d1 && d1.summary.n > 0) {
    weights.push(0.5)
    results.push(d1)
  }
  // d2: 30%
  if (d2 && d2.summary.n > 0) {
    weights.push(0.3)
    results.push(d2)
  }
  // d3: 20%
  if (d3 && d3.summary.n > 0) {
    weights.push(0.2)
    results.push(d3)
  }

  // 归一化权重
  const totalW = weights.reduce((s, w) => s + w, 0)
  const normW = weights.map(w => w / totalW)

  // 加权平均各指标
  const wDirRate = results.reduce((s, r, i) => s + r.summary.dirRate * normW[i], 0)
  const wOver25Rate = results.reduce((s, r, i) => s + r.summary.over25Rate * normW[i], 0)
  const wBttsRate = results.reduce((s, r, i) => s + r.summary.bttsRate * normW[i], 0)
  const wTop3Rate = results.reduce((s, r, i) => s + r.summary.top3Rate * normW[i], 0)

  // 合并所有比赛结果
  const allMatches = []
  for (const r of results) allMatches.push(...r.matches)

  const totalN = allMatches.length

  // 使用加权后的准确率生成策略权重
  // V4.3: 加入平滑系数，防止单日剧烈震荡（新权重 × 0.6 + 1.0 × 0.4）
  const SMOOTH = 0.6

  const strategyWeights = {
    direction: Math.max(0.6, Math.min(1.2, (wDirRate * 2) * SMOOTH + 1.0 * (1 - SMOOTH))),
    goals: Math.max(0.6, Math.min(1.2, (wOver25Rate * 1.5) * SMOOTH + 1.0 * (1 - SMOOTH))),
    btts: Math.max(0.6, Math.min(1.2, (wBttsRate * 1.5) * SMOOTH + 1.0 * (1 - SMOOTH))),
    score: Math.max(0.5, Math.min(1.0, (wTop3Rate * 1.2) * SMOOTH + 0.75 * (1 - SMOOTH))),
    safety: wDirRate > 0.55 ? 1.05 : 0.95,
    goals_range: Math.max(0.6, Math.min(1.1, (wOver25Rate * 1.3) * SMOOTH + 0.9 * (1 - SMOOTH))),
  }

  return {
    matches: allMatches,
    summary: {
      n: totalN,
      dirHits: Math.round(wDirRate * totalN),
      dirRate: wDirRate,
      over25Hits: Math.round(wOver25Rate * totalN),
      over25Rate: wOver25Rate,
      bttsHits: Math.round(wBttsRate * totalN),
      bttsRate: wBttsRate,
      top3Hits: Math.round(wTop3Rate * totalN),
      top3Rate: wTop3Rate,
      top1Hits: results.reduce((s, r) => s + r.summary.top1Hits, 0),
      top1Rate: results.reduce((s, r) => s + r.summary.top1Rate * normW[results.indexOf(r)], 0),
      draws: results.reduce((s, r) => s + r.summary.draws, 0),
      upsets: results.reduce((s, r) => s + r.summary.upsets, 0),
      _multiDay: true,
      _dayCount: results.length,
      _weightStr: normW.map((w, i) => `${results[i].summary.n}场×${(w * 100).toFixed(0)}%`).join(' + '),
    },
    strategyWeights,
  }
}

function analyzeBJTDate(remote, matches) {
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
      actualDir, predDir,
      dirCorrect: actualDir === predDir,
      over25, over25Correct: over25 === ((pred.over25Prob || 0.5) > 0.5),
      btts, bttsCorrect: btts === ((pred.bttsProb || 0.5) > 0.5),
      top3Hit: top5Scores.slice(0, 3).includes(actualScore),
      top1Hit: actualScore === top5Scores[0],
      confidence: pred.confidence || 0,
      risk: pred.riskLevel || 'Medium',
    })
  }

  const n = results.length || 1
  const dirRate = results.filter(r => r.dirCorrect).length / n
  const over25Rate = results.filter(r => r.over25Correct).length / n
  const bttsRate = results.filter(r => r.bttsCorrect).length / n
  const top3Rate = results.filter(r => r.top3Hit).length / n

  // V4.3: 动态策略权重 — 基于复盘准确率 + 平滑防止单日震荡
  // 单日数据：新权重 × 0.6 + 1.0 × 0.4（防过拟合）
  const SMOOTH_SINGLE_DAY = n <= 6 ? 0.6 : 0.8  // 6场以下加强平滑
  const rawDirW = Math.max(0.6, Math.min(1.2, dirRate * 2))
  const rawGoalsW = Math.max(0.6, Math.min(1.2, over25Rate * 1.5))
  const rawBttsW = Math.max(0.6, Math.min(1.2, bttsRate * 1.5))
  const rawScoreW = Math.max(0.5, Math.min(1.0, top3Rate * 1.2))
  const rawGoalsRangeW = Math.max(0.6, Math.min(1.1, over25Rate * 1.3))
  const rawSafetyW = dirRate > 0.6 ? 1.1 : 0.9

  const strategyWeights = {
    direction: rawDirW * SMOOTH_SINGLE_DAY + 1.0 * (1 - SMOOTH_SINGLE_DAY),
    goals: rawGoalsW * SMOOTH_SINGLE_DAY + 1.0 * (1 - SMOOTH_SINGLE_DAY),
    btts: rawBttsW * SMOOTH_SINGLE_DAY + 1.0 * (1 - SMOOTH_SINGLE_DAY),
    score: rawScoreW * SMOOTH_SINGLE_DAY + 0.75 * (1 - SMOOTH_SINGLE_DAY),
    safety: rawSafetyW * SMOOTH_SINGLE_DAY + 1.0 * (1 - SMOOTH_SINGLE_DAY),
    goals_range: rawGoalsRangeW * SMOOTH_SINGLE_DAY + 0.9 * (1 - SMOOTH_SINGLE_DAY),
  }

  return {
    matches: results,
    summary: {
      n, dirHits: results.filter(r => r.dirCorrect).length, dirRate,
      over25Hits: results.filter(r => r.over25Correct).length, over25Rate,
      bttsHits: results.filter(r => r.bttsCorrect).length, bttsRate,
      top3Hits: results.filter(r => r.top3Hit).length, top3Rate,
      top1Hits: results.filter(r => r.top1Hit).length,
      top1Rate: results.filter(r => r.top1Hit).length / n,
      draws: results.filter(r => r.actualDir === 'draw').length,
      upsets: results.filter(r => !r.dirCorrect && r.confidence > 0.55).length,
    },
    strategyWeights,
  }
}

// ===================================================================
// STEP 2: WCPE Validation（独立二次校验）
// ===================================================================
function validateWCPE(matchId, remote, market) {
  const pred = remote.predictions?.[matchId] || {}
  const odds = market.odds?.[matchId] || {}
  const m = remote.matches?.find(x => x.id === matchId) || {}
  const issues = []
  const confirmations = []

  // 1. 概率和校验
  const hwp = pred.homeWinProb || 0, dp = pred.drawProb || 0, awp = pred.awayWinProb || 0
  const total = hwp + dp + awp
  if (Math.abs(total - 1) > 0.08) issues.push(`概率和偏差(${total.toFixed(2)})`)
  else confirmations.push(`概率和正常(${total.toFixed(2)})`)

  // 2. 模型方向 vs 市场方向
  if (odds.homeWin && odds.awayWin) {
    const hImp = impliedProb(odds.homeWin), aImp = impliedProb(odds.awayWin)
    const marketDir = hImp > aImp ? 'home_win' : 'away_win'
    const modelDir = pred.predictedDirection || ''
    if (marketDir === modelDir) confirmations.push(`方向与市场一致(${modelDir})`)
    else issues.push(`方向分歧：模型(${modelDir}) vs 市场(${marketDir})`)
  }

  // 3. MVI信号质量
  const mviList = pred.mviAnalysis || []
  const highMVI = mviList.filter(m => (m.mvi || 0) >= 1.15)
  if (highMVI.length) confirmations.push(`${highMVI.length}个高价值MVI信号`)
  const lowMVI = mviList.filter(m => (m.mvi || 0) < 0.85)
  if (lowMVI.length >= 3 && mviList.length >= 4) issues.push(`多数MVI<0.85(${lowMVI.length}个)`)

  // 4. 风险评估一致性
  const riskWarnings = pred.riskWarnings || []
  if (riskWarnings.length > 2) issues.push(`${riskWarnings.length}个风险警告`)

  // 5. 小组赛阶段特殊风险（第三轮默契球等）
  const group = m.group || ''
  if (group.includes('组') && (m.round === 3 || kickoffBJTDate(m.kickoff || '') !== '')) {
    // 第三轮存在出线形势影响
    confirmations.push('小组赛阶段，需关注出线形势')
  }

  const agree = issues.length <= 1

  return { matchId, agree, issues, confirmations }
}

// ===================================================================
// STEP 3-4: Candidate Pool（候选池构建）+ 独立二次校验
// ===================================================================
// ========== 辅助：从比分分布估算总进球概率 ==========
/**
 * V4.3: 用 Poisson CDF 替代粗糙 Logistic S 曲线。
 * 复用 estimateScoreProbabilities 中的 Poisson 实现,
 * 计算 P(总进球 > hdp) 和 P(总进球 < hdp)，精度显著高于 Logistic 近似。
 *
 * @param {number} over25p - 模型大2.5球概率
 * @param {number} hdp - 目标盘口线 (如 2.0, 3.0, 3.5)
 * @param {number} homeWinProb - 主胜概率（用于推导 totalLambda）
 * @param {number} drawProb - 平局概率
 * @param {number} awayWinProb - 客胜概率
 * @returns {number} P(总进球 > hdp) — 即大hdp球的概率
 */
function estimateOverHdpProbPoisson(over25p, hdp, homeWinProb = 0.33, drawProb = 0.33, awayWinProb = 0.33) {
  // 从 over25Prob 反推总期望进球 λ（与 estimateScoreProbabilities 相同的二分法）
  const targetUnder25 = 1 - over25p
  let lo = 0.3, hi = 8.0
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2
    const pUnder25 = Math.exp(-mid) * (1 + mid + mid * mid / 2)
    if (pUnder25 > targetUnder25) lo = mid
    else hi = mid
  }
  const totalLambda = (lo + hi) / 2

  // Poisson PMF
  function poissonPMF(k, lambda) {
    if (lambda <= 0) return k === 0 ? 1 : 0
    let logP = -lambda + k * Math.log(lambda)
    let logFact = 0
    for (let i = 2; i <= k; i++) logFact += Math.log(i)
    return Math.exp(logP - logFact)
  }

  // P(总进球 > hdp) = 1 - P(总进球 ≤ floor(hdp))
  // 但 hdp 可能是 2.0 → ≤2, 3.5 → ≤3
  const maxGoals = Math.floor(hdp)
  let pUnder = 0
  for (let g = 0; g <= maxGoals; g++) {
    // P(总进球 = g) = Σ P(home=k) × P(away=g-k)
    let pEq = 0
    for (let h = 0; h <= g; h++) {
      const a = g - h
      pEq += poissonPMF(h, totalLambda * 0.5) * poissonPMF(a, totalLambda * 0.5)
    }
    pUnder += pEq
  }

  return 1 - pUnder
}

// 保留旧函数作为兼容（标记为 deprecated）
function estimateOverHdpProb(over25p, top5Scores, hdp) {
  // V4.3: 不再使用旧的 Logistic 方法，此函数仅作向后兼容
  // 实际调用点已改为 estimateOverHdpProbPoisson
  const expGoals = 2.5 + (over25p - 0.5) * 2.5
  return 1 / (1 + Math.exp(-(expGoals - hdp) / 0.8))
}

// ========== Poisson 波胆赔率估算器 ==========
/**
 * 当 Bet365 correctScore 赔率不可用时，用 Poisson 模型从 ML + O/U 赔率推导。
 * 行业标准方法：从 O/U 2.5 推导总期望进球 λ，从 ML 分配主客队 λ，Poisson 生成比分概率。
 *
 * @param {number} homeWinProb - 模型主胜概率
 * @param {number} drawProb - 模型平局概率
 * @param {number} awayWinProb - 模型客胜概率
 * @param {number} over25Prob - 模型大2.5球概率
 * @param {Array} top5Scores - WCPE top5 比分列表 [{score, probability, ...}]
 * @returns {Object} { "2-1": 8.5, "1-1": 6.0, ... } Bet365 格式（横杠）
 */
function estimateCorrectScoreOdds(homeWinProb, drawProb, awayWinProb, over25Prob, top5Scores) {
  // Step 1: 从 over25Prob 反推总期望进球 λ（二分法求解 Poisson CDF）
  // P(≤2 goals) = e^-λ × (1 + λ + λ²/2) = 1 - over25Prob
  const targetUnder25 = 1 - over25Prob
  let lo = 0.3, hi = 8.0
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2
    const pUnder25 = Math.exp(-mid) * (1 + mid + mid * mid / 2)
    if (pUnder25 > targetUnder25) lo = mid
    else hi = mid
  }
  const totalLambda = (lo + hi) / 2

  // Step 2: 用 ML 概率分配主客队 λ
  // 主胜概率高 → 主队进球多；用 logit 变换使分配更平滑
  const homeShare = homeWinProb + drawProb * 0.45 // 平局贡献部分给主队
  const awayShare = awayWinProb + drawProb * 0.55
  const shareSum = homeShare + awayShare
  const homeLambda = totalLambda * (homeShare / shareSum)
  const awayLambda = totalLambda * (awayShare / shareSum)

  // Step 3: Poisson PMF
  function poissonPMF(k, lambda) {
    if (lambda <= 0) return k === 0 ? 1 : 0
    let logP = -lambda + k * Math.log(lambda)
    // log(k!) via Stirling for large k, exact for small
    let logFact = 0
    for (let i = 2; i <= k; i++) logFact += Math.log(i)
    return Math.exp(logP - logFact)
  }

  // Step 4: 为 top5Scores 中的每个比分计算赔率
  const MARGIN = 0.25 // 25% bookmaker margin (Bet365 correct score 典型值)
  const result = {}

  for (const s of top5Scores) {
    const score = typeof s === 'string' ? s : s.score || ''
    const [h, a] = score.split(':').map(Number)
    if (isNaN(h) || isNaN(a)) continue

    // Poisson 概率
    const poissonProb = poissonPMF(h, homeLambda) * poissonPMF(a, awayLambda)

    // 混合：60% WCPE模型概率 + 40% Poisson（模型概率更精准，Poisson提供市场视角）
    const modelProb = typeof s === 'object' ? (s.probability || 0) : 0
    const blendedProb = modelProb > 0 ? (modelProb * 0.6 + poissonProb * 0.4) : poissonProb

    if (blendedProb > 0.001) {
      // 市场赔率 = (1/概率) / (1+margin)，模拟 bookmaker 定价
      const fairOdds = 1 / blendedProb
      const marketOdds = fairOdds / (1 + MARGIN)
      result[score.replace(':', '-')] = Math.round(marketOdds * 100) / 100
    }
  }

  return result
}

/**
 * 用 Poisson 模型为 top5Scores 中的每个比分估算概率（WCPE 格式 "2:1"）。
 * 当 WCPE 模型概率未校准（全为 0.01）时使用此函数替代。
 *
 * @returns {Object} { "2:1": 0.12, "1:1": 0.08, ... } WCPE 格式（冒号）
 */
function estimateScoreProbabilities(homeWinProb, drawProb, awayWinProb, over25Prob, top5Scores) {
  // Step 1: 从 over25Prob 反推总期望进球 λ
  const targetUnder25 = 1 - over25Prob
  let lo = 0.3, hi = 8.0
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2
    const pUnder25 = Math.exp(-mid) * (1 + mid + mid * mid / 2)
    if (pUnder25 > targetUnder25) lo = mid
    else hi = mid
  }
  const totalLambda = (lo + hi) / 2

  // Step 2: 用 ML 概率分配主客队 λ
  const homeShare = homeWinProb + drawProb * 0.45
  const awayShare = awayWinProb + drawProb * 0.55
  const shareSum = homeShare + awayShare
  const homeLambda = totalLambda * (homeShare / shareSum)
  const awayLambda = totalLambda * (awayShare / shareSum)

  // Step 3: Poisson PMF
  function poissonPMF(k, lambda) {
    if (lambda <= 0) return k === 0 ? 1 : 0
    let logP = -lambda + k * Math.log(lambda)
    let logFact = 0
    for (let i = 2; i <= k; i++) logFact += Math.log(i)
    return Math.exp(logP - logFact)
  }

  // Step 4: 计算每个比分的 Poisson 概率
  const result = {}
  let totalRaw = 0
  for (const s of top5Scores) {
    const score = typeof s === 'string' ? s : s.score || ''
    const [h, a] = score.split(':').map(Number)
    if (isNaN(h) || isNaN(a)) continue
    const prob = poissonPMF(h, homeLambda) * poissonPMF(a, awayLambda)
    result[score] = prob
    totalRaw += prob
  }

  // 归一化：让 top5 概率和 = min(sum, 0.8)（top5 通常覆盖 60-80% 的概率质量）
  const target = Math.min(totalRaw, 0.75)
  if (totalRaw > 0) {
    for (const k of Object.keys(result)) {
      result[k] = Math.round(result[k] / totalRaw * target * 10000) / 10000
    }
  }

  return result
}

function buildCandidatePool(remote, market) {
  const tomorrowMatches = matchesByBJTDate(remote.matches || [], TOMORROW_BJT)
  const tomorrowIds = tomorrowMatches.map(m => m.id)

  // 独立二次校验结果
  const validationResults = tomorrowIds.map(id => validateWCPE(id, remote, market))

  const pool = []
  const preRejected = []

  for (const mid of tomorrowIds) {
    const pred = remote.predictions?.[mid] || {}
    const odds = market.odds?.[mid] || {}
    const m = remote.matches?.find(x => x.id === mid) || {}
    const validation = validationResults.find(v => v.matchId === mid)

    if (validation && validation.issues.length >= 3) {
      preRejected.push({
        mid, match: `${cn(m.homeTeam || '')} vs ${cn(m.awayTeam || '')}`,
        reason: `WCPE校验失败：${validation.issues.join('; ')}`,
      })
    }

    const homeEn = m.homeTeam || '', awayEn = m.awayTeam || ''
    const home = cn(homeEn), away = cn(awayEn)
    const group = m.group || '', kickoff = m.kickoff || ''
    const hwp = pred.homeWinProb || 0.33, dp = pred.drawProb || 0.33, awp = pred.awayWinProb || 0.33
    const o25p = pred.over25Prob || 0.5, u25p = 1 - o25p
    const bttsP = pred.bttsProb || 0.5, nbttsP = 1 - bttsP
    const confidence = pred.confidence || 0.5, risk = pred.riskLevel || 'Medium'
    const wcpeIssues = (validation?.issues || []).length
    const top5Scores = pred.top5Scores || []

    const hOdd = odds.homeWin || 0, dOdd = odds.draw || 0, aOdd = odds.awayWin || 0
    const oOdd = odds.over25 || 0, uOdd = odds.under25 || 0
    const bYesOdd = odds.bttsYes || 0, bNoOdd = odds.bttsNo || 0

    // MVI map from WCPE
    const mviMap = {}
    for (const mvi of (pred.mviAnalysis || [])) {
      mviMap[mvi.bet || ''] = mvi.mvi || 1
    }
    const getMVI = (name) => mviMap[name] || 1

    const matchDisplay = `${home} vs ${away}`

    // 去水EV计算
    function dewateredEV(modelProb, oddsVal, allOddsArr) {
      if (!oddsVal || oddsVal <= 0) return { ev: 0, marketProb: 0 }
      const marketProb = dewateredProb(oddsVal, allOddsArr)
      return { ev: modelProb * oddsVal - 1, marketProb }
    }
    // 单市场MVI：模型概率 / 市场隐含概率（无去水，因为去水对两方等价）
    function calcMVI(modelProb, oddsVal) {
      if (!oddsVal || oddsVal <= 0) return 1.0
      return modelProb / (1 / oddsVal)
    }

    // ─── 胜平负 ───
    const dirAllOdds = [hOdd, dOdd, aOdd].filter(Boolean)
    if (hOdd) pool.push({ id: `${mid}_h`, mid, match: matchDisplay, group, kickoff, bet: `【胜平负】${home} 主胜`, market: '胜平负', odds: hOdd, prob: hwp, mvi: getMVI('主胜'), ev: dewateredEV(hwp, hOdd, dirAllOdds).ev, conf: confidence, risk, type: 'direction', wcpeIssues })
    if (dOdd) pool.push({ id: `${mid}_d`, mid, match: matchDisplay, group, kickoff, bet: `【胜平负】${home} vs ${away} 平局`, market: '胜平负', odds: dOdd, prob: dp, mvi: getMVI('平局'), ev: dewateredEV(dp, dOdd, dirAllOdds).ev, conf: confidence, risk, type: 'direction', wcpeIssues })
    if (aOdd) pool.push({ id: `${mid}_a`, mid, match: matchDisplay, group, kickoff, bet: `【胜平负】${away} 客胜`, market: '胜平负', odds: aOdd, prob: awp, mvi: getMVI('客胜'), ev: dewateredEV(awp, aOdd, dirAllOdds).ev, conf: confidence, risk, type: 'direction', wcpeIssues })

    // ─── 大小球 ───
    const goalAllOdds = [oOdd, uOdd].filter(Boolean)
    if (oOdd) pool.push({ id: `${mid}_o25`, mid, match: matchDisplay, group, kickoff, bet: `【大2.5球】${home} vs ${away}`, market: '大小球', odds: oOdd, prob: o25p, mvi: getMVI('Over 2.5'), ev: dewateredEV(o25p, oOdd, goalAllOdds).ev, conf: confidence, risk, type: 'goals', wcpeIssues, _o25p: o25p })
    if (uOdd) pool.push({ id: `${mid}_u25`, mid, match: matchDisplay, group, kickoff, bet: `【小2.5球】${home} vs ${away}`, market: '大小球', odds: uOdd, prob: u25p, mvi: getMVI('Under 2.5'), ev: dewateredEV(u25p, uOdd, goalAllOdds).ev, conf: confidence, risk, type: 'goals', wcpeIssues, _o25p: o25p })

    // ─── BTTS ───
    if (bYesOdd && bYesOdd > 0 && bYesOdd < 10) {
      pool.push({ id: `${mid}_btts_y`, mid, match: matchDisplay, group, kickoff, bet: `【BTTS】${home} vs ${away} 双方进球=是`, market: 'BTTS', odds: bYesOdd, prob: bttsP, mvi: getMVI('BTTS Yes'), ev: dewateredEV(bttsP, bYesOdd, [bYesOdd, bNoOdd].filter(Boolean)).ev, conf: confidence, risk: risk === 'High' ? 'Medium' : risk, type: 'btts', wcpeIssues })
    }
    if (bNoOdd && bNoOdd > 0 && bNoOdd < 10) {
      pool.push({ id: `${mid}_btts_n`, mid, match: matchDisplay, group, kickoff, bet: `【BTTS】${home} vs ${away} 双方进球=否`, market: 'BTTS', odds: bNoOdd, prob: nbttsP, mvi: getMVI('BTTS No'), ev: dewateredEV(nbttsP, bNoOdd, [bYesOdd, bNoOdd].filter(Boolean)).ev, conf: confidence, risk: risk === 'High' ? 'Medium' : risk, type: 'btts', wcpeIssues })
    }

    // ─── 双重机会（用Bet365真实盘口替代自算） ───
    if (odds.doubleChance) {
      const dc = odds.doubleChance
      if (dc.homeOrDraw && dc.homeOrDraw > 0) {
        const prob = hwp + dp
        pool.push({ id: `${mid}_dc_hd`, mid, match: matchDisplay, group, kickoff, bet: `【双重机会】${home} 或 平局`, market: '双重机会', odds: dc.homeOrDraw, prob, mvi: calcMVI(prob, dc.homeOrDraw), ev: calcEV(prob, dc.homeOrDraw), conf: confidence, risk: 'Low', type: 'safety', wcpeIssues })
      }
      if (dc.drawOrAway && dc.drawOrAway > 0) {
        const prob = dp + awp
        pool.push({ id: `${mid}_dc_da`, mid, match: matchDisplay, group, kickoff, bet: `【双重机会】${away} 或 平局`, market: '双重机会', odds: dc.drawOrAway, prob, mvi: calcMVI(prob, dc.drawOrAway), ev: calcEV(prob, dc.drawOrAway), conf: confidence, risk: 'Low', type: 'safety', wcpeIssues })
      }
      if (dc.homeOrAway && dc.homeOrAway > 0) {
        const prob = hwp + awp
        pool.push({ id: `${mid}_dc_ha`, mid, match: matchDisplay, group, kickoff, bet: `【双重机会】${home} 或 ${away}`, market: '双重机会', odds: dc.homeOrAway, prob, mvi: calcMVI(prob, dc.homeOrAway), ev: calcEV(prob, dc.homeOrAway), conf: confidence, risk: 'Low', type: 'safety', wcpeIssues })
      }
    }

    // ─── 平局退款 Draw No Bet（新市场） ───
    if (odds.drawNoBet) {
      const dnb = odds.drawNoBet
      // 模型的 DNB 概率 = 排除平局后的胜率比值
      const totalNoDraw = hwp + awp
      if (totalNoDraw > 0 && dnb.home > 0) {
        const probH = hwp / totalNoDraw
        pool.push({ id: `${mid}_dnb_h`, mid, match: matchDisplay, group, kickoff, bet: `【平局退款】${home} 不败`, market: '平局退款', odds: dnb.home, prob: probH, mvi: calcMVI(probH, dnb.home), ev: calcEV(probH, dnb.home), conf: confidence, risk: 'Low', type: 'safety', wcpeIssues })
      }
      if (totalNoDraw > 0 && dnb.away > 0) {
        const probA = awp / totalNoDraw
        pool.push({ id: `${mid}_dnb_a`, mid, match: matchDisplay, group, kickoff, bet: `【平局退款】${away} 不败`, market: '平局退款', odds: dnb.away, prob: probA, mvi: calcMVI(probA, dnb.away), ev: calcEV(probA, dnb.away), conf: confidence, risk: 'Low', type: 'safety', wcpeIssues })
      }
    }

    // ─── 波胆（正确比分）— 优先Bet365真实赔率，Poisson提供概率 ───
    const realCS = odds.correctScore || {}
    const hasRealCS = Object.keys(realCS).length > 0
    // 无真实赔率时，用 Poisson 模型从 ML+O/U 估算赔率
    const estimatedCS = !hasRealCS
      ? estimateCorrectScoreOdds(hwp, dp, awp, o25p, top5Scores)
      : {}
    const csSource = hasRealCS ? 'Bet365' : 'Poisson估算'
    const csOdds = hasRealCS ? realCS : estimatedCS

    // 检测模型概率是否未校准（全相同=0.01）→ 用 Poisson 重新估算
    const modelProbs = top5Scores.slice(0, 5).map(s => typeof s === 'object' ? (s.probability || 0) : 0)
    const modelUncalibrated = new Set(modelProbs).size <= 1 // 全相同=未校准
    const poissonProbs = (hasRealCS && modelUncalibrated)
      ? estimateScoreProbabilities(hwp, dp, awp, o25p, top5Scores)
      : null

    for (const s of top5Scores.slice(0, 5)) {
      const score = typeof s === 'string' ? s : s.score || ''
      let rawProb = typeof s === 'object' ? (s.probability || 0) : 0
      // 模型未校准时用 Poisson 概率替代
      if (poissonProbs) {
        rawProb = poissonProbs[score] || rawProb
      }
      if (rawProb <= 0) continue
      // Bet365 格式 "2-1"（横杠），WCPE 格式 "2:1"（冒号）
      const scoreHyphen = score.replace(':', '-')
      const csOdd = csOdds[scoreHyphen] || csOdds[score] || 0
      if (csOdd && csOdd > 0 && csOdd < 50) {
        const ev = calcEV(rawProb, csOdd)
        const rawMvi = calcMVI(rawProb, csOdd)
        // V4.3: 保留原始MVI用于评分排序，不做一刀切截断
        // Poisson估算的MVI天然偏高（未含庄家margin），加标签供展示层风险提示
        const isEstimated = csSource === 'Poisson估算'
        // Bet365真实赔率的波胆MVI不做任何限制，让错价信号充分体现
        // Poisson估算的波胆MVI轻微衰减（×0.85），因为Poisson概率偏高
        const mvi = isEstimated ? Math.min(rawMvi * 0.85, 1.25) : rawMvi
        pool.push({
          id: `${mid}_cs_${scoreHyphen}`, mid, match: matchDisplay, group, kickoff,
          bet: `【波胆】${home} vs ${away} 比分 ${score}`, market: '波胆',
          odds: csOdd, prob: rawProb, mvi, ev, conf: confidence, risk: 'High',
          type: 'score', wcpeIssues, _source: csSource,
          _rawMvi: rawMvi, _estimated: isEstimated,
        })
      }
    }

    // ─── 比分区间 (altGoalLines) ───
    if (odds.altGoalLines && odds.altGoalLines.length > 0) {
      // 选择流动性最好的几条线：2.0, 2.5, 3.0, 3.5
      const targetLines = [2.0, 2.5, 3.0, 3.5]
      for (const target of targetLines) {
        const line = odds.altGoalLines.find(l => Math.abs(l.hdp - target) < 0.01)
        if (!line || !line.over || !line.under) continue
        // V4.3: 用 Poisson CDF 替代 Logistic 估算
        const lineOverP = estimateOverHdpProbPoisson(o25p, target, hwp, dp, awp)
        const lineUnderP = 1 - lineOverP
        const allLineOdds = [line.over, line.under]

        // ═══ V4.4 独立分析层：投注方向与WCPE预测一致性检查 ═══
        // 模型预测的比分隐含了总进球数，如果投注方向与之矛盾，标记为可疑
        let contradictsModel = false
        let contradictionReason = ''
        const predictedGoalTotal = (() => {
          try {
            const ps = pred.predictedScore || ''
            const [ph, pa] = ps.split(':').map(Number)
            return isNaN(ph) || isNaN(pa) ? null : ph + pa
          } catch { return null }
        })()
        if (predictedGoalTotal !== null) {
          // 投注"小X球"但模型预测比分总进球 ≥ X → 矛盾
          if (target <= predictedGoalTotal) {
            const underBet = pool.find(b => b.id === `${mid}_un${target}`) || {}
            // 仅在推出 Under 方向时标记
          }
        }
        // 实际检查在加入pool后统一进行（见下方 consistencyCheck）
        // ════════════════════════════════════════════════════════

        // Over 方向
        if (target !== 2.5 || !oOdd) { // 2.5的已在大小球中产生，避免重复
          pool.push({ id: `${mid}_ov${target}`, mid, match: matchDisplay, group, kickoff, bet: `【大${target}球】${home} vs ${away}`, market: '比分区间', odds: line.over, prob: lineOverP, mvi: calcMVI(lineOverP, line.over), ev: dewateredEV(lineOverP, line.over, allLineOdds).ev, conf: confidence * 0.85, risk, type: 'goals_range', wcpeIssues, _predictedScore: pred.predictedScore, _o25p: o25p })
        }
        // Under 方向
        pool.push({ id: `${mid}_un${target}`, mid, match: matchDisplay, group, kickoff, bet: `【小${target}球】${home} vs ${away}`, market: '比分区间', odds: line.under, prob: lineUnderP, mvi: calcMVI(lineUnderP, line.under), ev: dewateredEV(lineUnderP, line.under, allLineOdds).ev, conf: confidence * 0.85, risk, type: 'goals_range', wcpeIssues, _predictedScore: pred.predictedScore, _o25p: o25p })
      }
    }
  }

  // ─── V4.4 独立分析：方向一致性检查 ───
  // 作为 Portfolio Manager，必须对每个投注项做独立的足球合理性判断
  // 而不是盲目相信 Poisson/赔率数学公式
  for (const c of pool) {
    // 检查1: 比分区间 vs 模型预测比分
    if (c.type === 'goals_range' && c._predictedScore) {
      try {
        const [ph, pa] = c._predictedScore.split(':').map(Number)
        const modelTotal = ph + pa
        // 提取盘口线: "小2球" → 2, "大3.5球" → 3.5
        const isUnder = c.bet.includes('小')
        const isOver = c.bet.includes('大')
        const targetMatch = c.bet.match(/[大小]([\d.]+)球/)
        const target = targetMatch ? parseFloat(targetMatch[1]) : 0

        // 逻辑核心：模型预测总进球数 vs 投注盘口线
        if (isUnder && modelTotal >= target) {
          // 例如：模型预测 3:1（4球），投注"小2球"→矛盾！即使赔率好也不行
          c._contradiction = true
          c._contradictionReason = `模型预测${c._predictedScore}(${modelTotal}球)，但推荐${c.bet.match(/【.*?】\s*/)?.[0]?.replace(/[【】]/g,'') || ''}小${target}球——方向矛盾`
          c._contradictionSeverity = modelTotal - target + 1 // 差距越大越严重
        } else if (isOver && modelTotal <= target) {
          // 例如：模型预测 1:0（1球），投注"大3球"→不合理
          c._contradiction = true
          c._contradictionReason = `模型预测${c._predictedScore}(${modelTotal}球)，但推荐大${target}球——模型不支撑此方向`
          c._contradictionSeverity = target - modelTotal + 1
        }
      } catch { /* 解析失败，跳过 */ }
    }

    // 检查2: Over 2.5/Under 2.5 vs 模型 o25p
    if (c.type === 'goals' && c._o25p !== undefined) {
      if (c.bet.includes('大2.5') && c._o25p < 0.45) {
        c._contradiction = true
        c._contradictionReason = `模型大2.5球概率仅${(c._o25p*100).toFixed(0)}%，推荐大2.5缺乏模型支撑`
        c._contradictionSeverity = Math.round((0.5 - c._o25p) * 10)
      }
      if (c.bet.includes('小2.5') && c._o25p > 0.55) {
        c._contradiction = true
        c._contradictionReason = `模型大2.5球概率${(c._o25p*100).toFixed(0)}%（倾向于大球），推荐小2.5与模型方向矛盾`
        c._contradictionSeverity = Math.round((c._o25p - 0.5) * 10)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // V5.0: 投资委员会审查 — 定性分析层
  // ═══════════════════════════════════════════════════════════
  const qualitativeProfiles = {}
  const tomorrowIdsSet = new Set(tomorrowIds)
  
  for (const mid of tomorrowIds) {
    const pred = remote.predictions?.[mid] || {}
    const m = remote.matches?.find(x => x.id === mid) || {}
    const homeEn = m.homeTeam || '', awayEn = m.awayTeam || ''
    const hwp = pred.homeWinProb || 0.33, o25p = pred.over25Prob || 0.5
    const confidence = pred.confidence || 0.5, riskLevel = pred.riskLevel || 'Medium'
    const riskWarnings = pred.riskWarnings || []
    const fb = pred.factorBreakdown || {}
    const appliedLearnings = pred.appliedLearnings || []

    const profile = {
      matchId: mid,
      matchDisplay: `${cn(homeEn)} vs ${cn(awayEn)}`,
      // 基础量化
      confidence, riskLevel, hwp, o25p,
      // 定性信号
      flags: [],
      adjustments: {},
      qualitativeConfidence: 1.0,
      thesis: '',
    }

    // ── 1. 风险警告分析 ──
    const warningCategories = {
      injury: riskWarnings.filter(w => /伤|缺阵|缺席|停赛|红牌|训练/.test(w)),
      elimination: riskWarnings.filter(w => /淘汰|出线|出局|已确定|保头名|保平|轮换/.test(w)),
      form: riskWarnings.filter(w => /哑火|状态|进球|进攻|防守|崩溃|低迷/.test(w)),
      tactical: riskWarnings.filter(w => /主帅|教练|战术|阵型|打法|轮换/.test(w)),
    }

    // 伤病/停赛影响
    if (warningCategories.injury.length > 0) {
      profile.flags.push('injury_concern')
      profile.adjustments.injuryPenalty = Math.min(0.15, warningCategories.injury.length * 0.05)
    }
    // 第三轮出线/淘汰动态 — 是最关键的非数据信号
    if (warningCategories.elimination.length > 0) {
      const eliminationText = warningCategories.elimination.join(' ')
      // 双方均已淘汰 → 比赛开放，倾向于大球
      if (/双方均.*淘汰/.test(eliminationText) || /均.*已淘汰/.test(eliminationText) || /表演赛/.test(eliminationText)) {
        profile.flags.push('both_eliminated_open_game')
        // 定性判断：无压力 = 更多进球的倾向
        profile.adjustments.goalsBias = 'over'  // 倾向于大球
        profile.adjustments.goalsBiasStrength = 0.15  // 大球概率上调15%
      }
      // 一方已出线 → 可能轮换，降低对其获胜的置信度
      if (/已出线|保头名|确保|锁定.*第一/.test(eliminationText)) {
        profile.flags.push('team_qualified_rotation_risk')
        profile.adjustments.rotationRisk = true
      }
      // 一方必须赢才能出线 → 背水一战溢价
      if (/必须赢|背水一战|不胜.*出局/.test(eliminationText)) {
        profile.flags.push('must_win_surge')
        profile.adjustments.mustWinBonus = 0.10
      }
      // 保平争胜 → 保守倾向，小球概率上升
      if (/保平|平局.*足够|平局.*可/.test(eliminationText)) {
        profile.flags.push('draw_sufficient_conservative')
        profile.adjustments.goalsBias = 'under'
        profile.adjustments.goalsBiasStrength = 0.10
      }
    }
    // 状态/心理因素
    if (warningCategories.form.length > 0) {
      profile.flags.push('form_concern')
    }

    // ── 2. 因子分解分析 ──
    const factorNames = { eloDiffScore: 'ELO差', recentFormScore: '近期状态', h2hScore: '历史交锋', marketScore: '市场共识', tacticalScore: '战术匹配', squadScore: '阵容完整', pressureScore: '赛程压力', psychologyScore: '心理因素' }
    const weakFactors = []
    const strongFactors = []
    for (const [key, val] of Object.entries(fb)) {
      if (typeof val === 'number' && val < 0.5) weakFactors.push(key)
      if (typeof val === 'number' && val >= 0.75) strongFactors.push(key)
    }
    if (weakFactors.length > 0) {
      profile.flags.push('factor_weakness')
      profile.adjustments.weakFactors = weakFactors
      // 特别是 pressureScore 极低 → 高压比赛 → 降低置信
      if (fb.pressureScore !== undefined && fb.pressureScore < 0.4) {
        profile.adjustments.pressureDiscount = (0.4 - fb.pressureScore) * 0.5
      }
    }

    // ── 3. 高置信+高风险 = 红旗 ──
    if (confidence >= 0.65 && riskLevel === 'High') {
      profile.flags.push('high_confidence_high_risk')
      // 昨天美国72%信心+高风险预测完全错误，这是已知的系统性陷阱
      profile.adjustments.highConfRiskDiscount = 0.15
    }

    // ── 4. 市场-模型严重分歧 ──
    if (o25p > 0.60) {
      profile.adjustments.marketGoalsLean = 'over'
    } else if (o25p < 0.40) {
      profile.adjustments.marketGoalsLean = 'under'
    }

    // ── 5. 从历史教训匹配当前场景 ──
    // V5.1: 上下文感知匹配 — 只对实际匹配场景应用相关教训
    const keyLearnings = remote.keyLearnings || []
    profile.adjustments.lessonsApplied = profile.adjustments.lessonsApplied || []

    // 仅当该场比赛确实存在轮换风险时，引用轮换历史教训
    if (profile.flags.includes('team_qualified_rotation_risk')) {
      const hasRotationLesson = keyLearnings.some(l =>
        typeof l === 'string' && /已出线.*轮换|轮换.*已出线|轮换.*影响|轮换.*低估/.test(l)
      )
      if (hasRotationLesson) profile.adjustments.lessonsApplied.push('rotation_risk_known')
    }

    // 仅当该场比赛存在已淘汰球队时，引用荣誉战历史教训
    if (profile.flags.includes('both_eliminated_open_game') || profile.flags.includes('must_win_surge')) {
      const hasHonorLesson = keyLearnings.some(l =>
        typeof l === 'string' && /淘汰.*荣誉战|荣誉战.*淘汰|最后一场/.test(l)
      )
      if (hasHonorLesson) profile.adjustments.lessonsApplied.push('honor_match_boost')
    }

    // 因子短板显著时，引用相关历史教训
    if (weakFactors.length >= 2) {
      const hasFactorLesson = keyLearnings.some(l =>
        typeof l === 'string' && /ELO.*偏差|ELO.*系统|因子.*失效|模型.*低估/.test(l)
      )
      if (hasFactorLesson) profile.adjustments.lessonsApplied.push('factor_breakdown_historical')
    }

    // ── 6. 综合定性置信度 ──
    let qualConf = 1.0
    if (profile.adjustments.injuryPenalty) qualConf -= profile.adjustments.injuryPenalty
    if (profile.adjustments.pressureDiscount) qualConf -= profile.adjustments.pressureDiscount
    if (profile.adjustments.highConfRiskDiscount) qualConf -= profile.adjustments.highConfRiskDiscount
    if (profile.adjustments.mustWinBonus) qualConf += profile.adjustments.mustWinBonus
    // 已淘汰双方开放比赛 → 进球预期上调但不一定影响胜负置信
    if (profile.flags.includes('both_eliminated_open_game')) {
      // 不对胜负置信度调降（双方平等），但标记大球倾向
      qualConf = Math.max(0.7, qualConf)  // 下限保护
    }
    profile.qualitativeConfidence = Math.max(0.5, Math.min(1.2, qualConf))

    // ── 7. 生成投资论点 ──
    const thesisParts = []
    if (profile.flags.includes('both_eliminated_open_game')) thesisParts.push('双方已淘汰，无压力开放对攻')
    if (profile.flags.includes('team_qualified_rotation_risk')) thesisParts.push('已出线方可能轮换')
    if (profile.flags.includes('must_win_surge')) thesisParts.push('背水一战意愿加成')
    if (profile.flags.includes('draw_sufficient_conservative')) thesisParts.push('平局足够→保守倾向')
    if (profile.flags.includes('injury_concern')) thesisParts.push('伤病缺阵影响阵容')
    if (profile.flags.includes('form_concern')) {
      // 提取具体的状态问题
      const formWarnings = (pred.riskWarnings || []).filter(w => /哑火|状态|进球|进攻|防守|崩溃|低迷/.test(w))
      if (formWarnings.length > 0) thesisParts.push(`状态隐患: ${formWarnings[0].substring(0, 25)}`)
      else thesisParts.push('近期状态存疑')
    }
    if (profile.flags.includes('factor_weakness')) {
      const wfNames = weakFactors.map(k => factorNames[k] || k).slice(0, 2).join('、')
      thesisParts.push(`因子短板: ${wfNames}`)
    }
    if (profile.flags.includes('high_confidence_high_risk')) thesisParts.push('⚠ 高置信+高风险=历史陷阱')
    if (profile.adjustments.lessonsApplied?.includes('rotation_risk_known')) thesisParts.push('历史教训: 已出线轮换被严重低估')
    if (profile.adjustments.lessonsApplied?.includes('honor_match_boost')) thesisParts.push('历史反馈: 淘汰队荣誉战有溢价')
    profile.thesis = thesisParts.join('；')

    qualitativeProfiles[mid] = profile
  }

  // ── 将定性分析应用到候选池 ──
  for (const c of pool) {
    const profile = qualitativeProfiles[c.mid]
    if (!profile) continue

    // 将定性配置挂到投注项上
    c._qualProfile = profile
    c._qualConfidence = profile.qualitativeConfidence

    // 定性方向检查：当比赛存在明确的进球方向倾向时
    if (profile.adjustments.goalsBias === 'over') {
      if (c.bet.includes('小') && (c.type === 'goals' || c.type === 'goals_range')) {
        // 投注小球方向但定性分析认为大球更可能 → 标记
        c._qualFlag = 'qualitative_goals_contradiction'
        c._qualNote = `定性分析: ${profile.thesis} → 倾向大球，该选项与定性判断矛盾`
        // 如果矛盾严重(read: 双方已淘汰开放比赛 + 小2球) → 降权
        if (c._contradictionSeverity === undefined || c._contradictionSeverity < 2) {
          // 只对未被定量层踢出的项施加额外降权
          c.mvi = Math.min(c.mvi, 0.90)
        }
      }
    }
    if (profile.adjustments.goalsBias === 'under') {
      if (c.bet.includes('大') && (c.type === 'goals' || c.type === 'goals_range')) {
        c._qualFlag = 'qualitative_goals_contradiction'
        c._qualNote = `定性分析: ${profile.thesis} → 倾向小球，该选项与定性判断矛盾`
        if (c._contradictionSeverity === undefined || c._contradictionSeverity < 2) {
          c.mvi = Math.min(c.mvi, 0.90)
        }
      }
    }

    // 轮换风险下，对该队获胜方向降置信
    if (profile.adjustments.rotationRisk && c.type === 'direction') {
      // 判断该投注是否针对已出线方
      const isHomeQualified = c.bet.includes('主胜') || c.bet.includes('或') && c.bet.includes(cn(m?.homeTeam || ''))
      if (isHomeQualified) {
        c._qualNote = (c._qualNote || '') + '已出线队可能轮换→方向风险'
        c.conf = Math.min(c.conf, 0.55)  // 降低置信度上限
      }
    }
  }

  // 将定性分析档案挂到 pool 上供后续使用
  pool._qualitativeProfiles = qualitativeProfiles
  // ═══════════════════════════════════════════════════════════

  // ─── V4增强过滤（含V4.4一致性检查 + V5.0定性分析） ───
  const accepted = [], rejected = []
  for (const c of pool) {
    const reasons = []

    if (c.ev < -0.08) reasons.push(`EV显著负(${(c.ev * 100).toFixed(1)}%)`)
    if (c.mvi < 0.80 && !['波胆', '双重机会', '平局退款'].includes(c.market)) reasons.push(`MVI过低(${c.mvi.toFixed(2)})`)
    if (c.conf < 0.40 && c.risk === 'High') reasons.push('极低置信+高风险')

    // V4.4: 独立分析 — 投注方向与WCPE模型预测矛盾的一律降权或踢出
    if (c._contradiction) {
      if (c._contradictionSeverity >= 3) {
        // 严重矛盾：如模型3:1却推荐小2球 → 直接踢出候选池
        reasons.push(`⚡方向矛盾(S${c._contradictionSeverity}): ${c._contradictionReason}`)
      } else if (c._contradictionSeverity >= 2) {
        // 中等矛盾：标记但不踢出，在评分环节严惩
        reasons.push(`方向存疑(S${c._contradictionSeverity}): ${c._contradictionReason}`)
        // 对中等矛盾，降低MVI分值来削弱其竞争力
        c.mvi = Math.min(c.mvi, 0.85)
      } else {
        // 轻微矛盾：仅标注
        c._contradictionNote = c._contradictionReason
      }
    }

    if (c.wcpeIssues >= 3 && c.type === 'direction') reasons.push('WCPE方向预测不可靠')
    if (c.market === '波胆' && c.prob < 0.008) reasons.push('比分概率极低(<0.8%)')
    if (c.market === '波胆' && c.prob < 0.015 && c.mvi < 0.85) reasons.push('低概率波胆无MVI支撑')
    if (c.market === '比分区间' && c.conf < 0.40) reasons.push('比分区间置信度不足')
    if (c.odds > 100 && c.ev < 0.2 && c.market !== '波胆') reasons.push('超高赔率无EV支撑')

    if (reasons.length) rejected.push({ ...c, reasons })
    else accepted.push(c)
  }

  const abandonedMatches = preRejected.map(pr => ({
    match: pr.match, reasons: [pr.reason], type: '整场放弃',
  }))

  return { accepted, rejected, matchIds: [...new Set(pool.map(c => c.mid))], validationResults, abandonedMatches, qualitativeProfiles }
}

// ===================================================================
// STEP 5: Generate Portfolio Combinations（不限制数量和腿数）
// ===================================================================
function generatePortfolios(pool) {
  const byMatch = {}
  for (const c of pool) {
    if (!byMatch[c.mid]) byMatch[c.mid] = []
    byMatch[c.mid].push(c)
  }
  const mids = Object.keys(byMatch)
  if (mids.length < 2) return []

  // V4: 对每个比赛排序候选（最高质量在前，用于采样）
  for (const mid of mids) {
    byMatch[mid].sort((a, b) => {
      const scoreA = a.mvi * 10 + a.ev * 5 + (a.type === 'goals' ? 2 : 0)
      const scoreB = b.mvi * 10 + b.ev * 5 + (b.type === 'goals' ? 2 : 0)
      return scoreB - scoreA
    })
  }

  const portfolios = []

  // 2-leg: 全量穷举
  for (let i = 0; i < mids.length; i++) {
    for (let j = i + 1; j < mids.length; j++) {
      for (const c1 of byMatch[mids[i]]) {
        for (const c2 of byMatch[mids[j]]) {
          portfolios.push([c1, c2])
        }
      }
    }
  }

  // 3-leg: 全量穷举（限制每个比赛最多前4个候选以防组合爆炸）
  if (mids.length >= 3) {
    for (let i = 0; i < mids.length; i++) {
      for (let j = i + 1; j < mids.length; j++) {
        for (let k = j + 1; k < mids.length; k++) {
          const limitI = Math.min(5, byMatch[mids[i]].length)
          const limitJ = Math.min(5, byMatch[mids[j]].length)
          const limitK = Math.min(5, byMatch[mids[k]].length)
          for (let xi = 0; xi < limitI; xi++) {
            for (let xj = 0; xj < limitJ; xj++) {
              for (let xk = 0; xk < limitK; xk++) {
                portfolios.push([byMatch[mids[i]][xi], byMatch[mids[j]][xj], byMatch[mids[k]][xk]])
              }
            }
          }
        }
      }
    }
  }

  // 4-leg: 智能采样（优先高质量候选）
  if (mids.length >= 4) {
    const sampleCount = Math.min(3000, Math.pow(mids.length, 3))
    for (let r = 0; r < sampleCount; r++) {
      const picked = new Set()
      const legs = []
      // 优先选择不同比赛
      const shuffled = [...mids].sort(() => Math.random() - 0.5)
      for (const mid of shuffled) {
        if (legs.length >= 4) break
        if (picked.has(mid)) continue
        picked.add(mid)
        const candidates = byMatch[mid]
        // 加权随机选择：前3个候选中选一个
        const idx = Math.random() < 0.7 ? Math.min(Math.floor(Math.random() * 3), candidates.length - 1) : Math.floor(Math.random() * candidates.length)
        legs.push(candidates[idx])
      }
      if (legs.length >= 4) portfolios.push(legs)
    }
  }

  // 5+ leg: 高质量采样（仅当足够多比赛时）
  if (mids.length >= 5) {
    const sampleCount = Math.min(2000, mids.length * 100)
    for (let r = 0; r < sampleCount; r++) {
      const n = Math.min(5 + Math.floor(Math.random() * (mids.length - 4)), mids.length)
      const sampled = [...mids].sort(() => Math.random() - 0.5).slice(0, n)
      const legs = sampled.map(m => {
        const candidates = byMatch[m]
        return Math.random() < 0.8 ? candidates[Math.min(Math.floor(Math.random() * 3), candidates.length - 1)] : candidates[Math.floor(Math.random() * candidates.length)]
      })
      if (legs.length >= 2) portfolios.push(legs)
    }
  }

  // 去重
  const seen = new Set()
  const unique = []
  for (const pf of portfolios) {
    const key = pf.map(c => c.id).sort().join('|')
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(pf)
    }
  }

  // V4: 不设置硬上限，但控制内存
  const maxN = 8000
  return unique.slice(0, maxN)
}

// ===================================================================
// STEP 6: Portfolio Scoring V4（12维评分 + 动态权重）
// ===================================================================
function scorePortfolio(legs, strategyWeights = {}) {
  const n = legs.length
  if (n < 2) return { score: 0, compOdds: 0, compProb: 0, compEV: 0, avgMVI: 0, hitPct: 0, n: 0, markets: [], breakdown: {} }

  const compOdds = legs.reduce((p, c) => p * c.odds, 1)
  const compProb = legs.reduce((p, c) => p * c.prob, 1)
  const compEV = compProb * compOdds - 1
  const hitPct = compProb * 100
  const avgMVI = legs.reduce((s, c) => s + c.mvi, 0) / n

  const riskMap = { Low: 1, Medium: 2, High: 3 }
  const avgRisk = legs.reduce((s, c) => s + (riskMap[c.risk] || 2), 0) / n

  // 动态策略权重（默认1.0）
  const wDir = strategyWeights.direction || 1.0
  const wGoals = strategyWeights.goals || 1.0
  const wBtts = strategyWeights.btts || 1.0
  const wScore = strategyWeights.score || 1.0
  const wSafety = strategyWeights.safety || 1.0
  const wGoalsRange = strategyWeights.goals_range || 1.0

  // 1. EV得分 (0-15分) — V4.3: 引入对数赔率衰减，降权极低概率高赔腿的EV放大
  // 原理：高赔腿的EV被prob×odds公式放大，但极低概率意味着实现路径极窄
  // 对数衰减：当单腿赔率>5且概率<0.4时，该腿的EV贡献乘以衰减因子
  let adjustedCompEV = compEV
  let evDecayApplied = false
  for (const leg of legs) {
    if (leg.odds > 5 && leg.prob < 0.4 && leg.ev > 0) {
      // 衰减因子 = log(prob×20) / log(odds/2)，将EV拉回现实范围
      const decay = Math.max(0.3, Math.log(leg.prob * 20 + 1) / Math.log(leg.odds / 2 + 1))
      adjustedCompEV = adjustedCompEV - leg.ev * (1 - decay) * 0.3 // 最多衰减30%
      evDecayApplied = true
    }
  }
  const evScore = adjustedCompEV > 0 ? Math.min(adjustedCompEV * 8 + 5, 15) : adjustedCompEV > -0.05 ? 3 : 0

  // 2. MVI得分 (0-15分) — 错价信号
  const mviScore = Math.min(avgMVI * 12, 15)

  // 3. 命中率得分 (0-15分) — 8-35%最优区间
  let hitScore = 0
  if (hitPct >= 8 && hitPct <= 35) hitScore = 15
  else if (hitPct >= 4 && hitPct < 8) hitScore = 10
  else if (hitPct >= 2 && hitPct < 4) hitScore = 6
  else if (hitPct > 35) hitScore = 9
  else if (hitPct >= 1) hitScore = 3

  // 波胆组合：命中率低是本质特征，不补偿（避免过度推波胆）
  const scoreLegs = legs.filter(c => c.market === '波胆')
  const highMviScoreLegs = scoreLegs.filter(c => c.mvi >= 1.15)

  // 4. 风险得分 (0-10分)
  const riskScore = Math.max(12 - avgRisk * 3.5, 0)

  // 5. 赔率效率 (0-10分)
  const oddsEfficiency = compOdds / Math.max(n * (1 + avgRisk * 0.4), 1)
  const effScore = Math.min(oddsEfficiency * 2, 10)

  // 6. 事件独立性 (0-10分)
  const matches = new Set(legs.map(c => c.mid))
  const matchIndScore = (matches.size / n) * 10

  // 7. 市场分散度 (0-10分)
  const markets = new Set(legs.map(c => c.market))
  const marketDivScore = Math.min((markets.size / n) * 14, 10)

  // 8. 相关性罚分（改进版）
  let corrPenalty = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (legs[i].mid === legs[j].mid) {
        // 同场比赛不同市场
        if (legs[i].type !== legs[j].type) corrPenalty += 2
        else corrPenalty += 10 // 同市场同场 = 极强相关
      }
      // 同市场+同组
      if (legs[i].market === legs[j].market && legs[i].group === legs[j].group) corrPenalty += 3
    }
  }

  // 9. 赛程特殊风险 (0-5分扣减)
  const has3rdRound = legs.some(c => c.group && /组/.test(c.group))
  const specialRisk = has3rdRound ? 2.5 : 0

  // 10. 盘口稳定性 (0-5分)
  const mviStd = Math.sqrt(legs.reduce((s, c) => s + Math.pow(c.mvi - avgMVI, 2), 0) / n)
  const stabilityScore = Math.max(5 - mviStd * 6, 0)

  // 11. V4新增: 外部风险评分 (0-5分扣减)
  let externalRiskPenalty = 0
  // 赔率过高（>80x）且命中率<3% → 额外风险
  if (compOdds > 80 && hitPct < 3) externalRiskPenalty += 2
  // 包含2+个波胆 → 增加不稳定性惩罚（波胆本命中率极低）
  if (scoreLegs.length >= 2) externalRiskPenalty += 2
  // 全部来自同一市场类型 → 缺乏多样性风险
  if (markets.size === 1) externalRiskPenalty += 2

  // 12. V4新增: 数据一致性 (0-5分)
  const evs = legs.map(c => c.ev)
  const posEvs = evs.filter(e => e > 0)
  const dataConsistencyScore = Math.min((posEvs.length / n) * 5 + (Math.abs(compEV) < 0.5 ? 1 : 0), 5)

  // 策略权重修正：根据昨日各市场表现调整个别leg的贡献
  let strategyBonus = 0
  for (const leg of legs) {
    if (leg.type === 'direction' && wDir > 1.0) strategyBonus += (wDir - 1) * 1.5
    if (leg.type === 'goals' && wGoals > 1.0) strategyBonus += (wGoals - 1) * 1.5
    if (leg.type === 'btts' && wBtts > 1.0) strategyBonus += (wBtts - 1) * 1.5
    if (leg.type === 'score' && wScore > 1.0) strategyBonus += (wScore - 1) * 0.5
    if (leg.type === 'safety' && wSafety > 1.0) strategyBonus += (wSafety - 1) * 1.0
    if (leg.type === 'goals_range' && wGoalsRange > 1.0) strategyBonus += (wGoalsRange - 1) * 1.0
  }
  strategyBonus = Math.min(strategyBonus, 5)

  // 13. V4.1新增: 价值捕获奖励 — 包含高MVI波胆的组合获得微量加分
  // 波胆本命中率极低(5-15%)，加分保守（避免过度推高波胆占比）
  let valueCaptureBonus = 0
  for (const leg of scoreLegs) {
    if (leg.mvi >= 1.30) valueCaptureBonus += 1.0  // 强错价，极微量加分
    else if (leg.mvi >= 1.15) valueCaptureBonus += 0.5  // 中等错价
  }
  valueCaptureBonus = Math.min(valueCaptureBonus, 1.5)  // 硬上限：最多加1.5分

  // 14. V5.0新增: 定性分析得分 (0-5分)
  // 投资委员会审查结论：各leg的定性置信度加权平均
  let qualitativeScore = 0
  let qualNotes = []
  for (const leg of legs) {
    if (leg._qualConfidence !== undefined) {
      qualitativeScore += leg._qualConfidence
    }
    if (leg._qualNote) qualNotes.push(leg._qualNote)
  }
  // 归一化：平均定性置信度映射到0-5分
  // qualConf 1.0 = 满分, qualConf 0.7 = 0分
  const avgQualConf = legs.length > 0 ? qualitativeScore / legs.length : 1.0
  qualitativeScore = Math.max(0, Math.min(5, (avgQualConf - 0.7) / 0.3 * 5))

  // 如果存在定性矛盾标记，额外扣分
  const qualContradictions = legs.filter(l => l._qualFlag === 'qualitative_goals_contradiction').length
  if (qualContradictions > 0) qualitativeScore = Math.max(0, qualitativeScore - qualContradictions * 1.5)

  let total = evScore + mviScore + hitScore + riskScore + effScore + matchIndScore + marketDivScore + stabilityScore + dataConsistencyScore + strategyBonus + valueCaptureBonus + qualitativeScore - corrPenalty - specialRisk - externalRiskPenalty
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
      ev: Math.round(evScore * 10) / 10,
      mvi: Math.round(mviScore * 10) / 10,
      hit: Math.round(hitScore * 10) / 10,
      risk: Math.round(riskScore * 10) / 10,
      eff: Math.round(effScore * 10) / 10,
      indep: Math.round(matchIndScore * 10) / 10,
      div: Math.round(marketDivScore * 10) / 10,
      corr: -Math.round(corrPenalty * 10) / 10,
      sRisk: -Math.round(specialRisk * 10) / 10,
      stab: Math.round(stabilityScore * 10) / 10,
      extRisk: -Math.round(externalRiskPenalty * 10) / 10,
      consist: Math.round(dataConsistencyScore * 10) / 10,
      strat: Math.round(strategyBonus * 10) / 10,
      valCap: Math.round(valueCaptureBonus * 10) / 10,
      qual: Math.round(qualitativeScore * 10) / 10,
    },
  }
}

function classifyTier(odds) {
  if (odds <= 5) return '稳健收益型'
  if (odds <= 12) return '平衡收益型'
  if (odds <= 25) return '价值收益型'
  if (odds <= 80) return '高赔率冲击型'
  return '超级大奖型'
}

// V4: 更详细的分析理由
function generateRationale(p) {
  const markets = [...new Set(p.legs.map(l => l.market))]
  const topLeg = p.legs.sort((a, b) => b.mvi - a.mvi)[0]
  const legDescs = p.legs.map(l => l.bet.replace(/【.*?】/g, '').slice(0, 20)).join(' + ')
  const evDesc = p.compEV > 0.15 ? '强正EV' : p.compEV > 0.05 ? '正EV' : p.compEV > 0 ? '边际正EV' : 'EV偏低'
  
  // V5.0: 加入定性分析洞察
  const qualLegs = p.legs.filter(l => l._qualNote)
  const qualInsight = qualLegs.length > 0 
    ? `定性提示: ${qualLegs.map(l => l._qualNote).join(' | ')}` 
    : ''
  
  return `${p.legs.length}场组合[${markets.join('+')}]：${legDescs}。${evDesc}，命中${p.hitPct}%，评分${p.score}/100。${qualInsight}`.trim()
}

// V4: 为什么#1优于#2
function generateComparisonRationale(best, second) {
  if (!second) return '唯一可选组合。'
  const reasons = []
  if (best.score > second.score) reasons.push(`综合评分领先${(best.score - second.score).toFixed(1)}分`)
  if (best.compEV > second.compEV) reasons.push(`EV更高(+${((best.compEV - second.compEV) * 100).toFixed(1)}%)`)
  if (best.hitPct > second.hitPct) reasons.push(`命中率更高(${best.hitPct}% vs ${second.hitPct}%)`)
  if (best.avgMVI > second.avgMVI) reasons.push(`MVI信号更强(${best.avgMVI.toFixed(2)} vs ${second.avgMVI.toFixed(2)})`)
  return reasons.join('；') || '综合评分最优。'
}

// ========== 去集中：确保 Top N 中没有单个投注项过度出现 ==========
/**
 * V4.3: 增强去集中化 — 检测同场比赛的高相关腿
 * 同一场比赛的"小2球"和"小3球"虽然leg ID不同，但高度相关（进球总数决定两者结果）。
 * 相关性≥0.85的腿组合视为"实质上重复"。
 */
function areLegsHighlyCorrelated(legA, legB) {
  // 必须是同一场比赛
  if (legA.match !== legB.match) return false
  // 必须是同类市场（goals/goals_range 互检）
  const goalsTypes = new Set(['goals', 'goals_range'])
  if (!goalsTypes.has(legA.type) || !goalsTypes.has(legB.type)) return false
  // 同方向（都是Over，或都是Under，或都是BTTS）→ 高度相关
  const dirA = legA.bet.includes('大') ? 'over' : legA.bet.includes('小') ? 'under' : legA.bet.includes('进球=是') ? 'btts_y' : ''
  const dirB = legB.bet.includes('大') ? 'over' : legB.bet.includes('小') ? 'under' : legB.bet.includes('进球=是') ? 'btts_y' : ''
  if (dirA === dirB) return true
  // 不同方向（Over vs Under）→ 负相关，但也算"重复"（同一比赛同类型不可兼得）
  if (dirA && dirB && dirA !== dirB) return true
  return false
}

function selectDiversifiedTop(scored, n = 10, maxPerLeg = 1, maxPerMatch = 4) {
  const selected = []
  const legCount = new Map()   // leg id → count
  const matchCount = new Map()  // match id → count
  
  for (const pf of scored) {
    // 检查是否有腿超过限制
    const legExceeds = pf.legs.some(l => (legCount.get(l.id) || 0) >= maxPerLeg)
    // 检查同场比赛投注项是否过度集中
    const matchExceeds = pf.legs.some(l => (matchCount.get(l.match || '') || 0) >= maxPerMatch)
    
    // V4.3: 额外检查——该组合是否与已选组合中的任何组合"实质上相同"
    // （类似的相关腿组合共享>60%的相关腿则视为重复）
    let duplicative = false
    if (!legExceeds && !matchExceeds && selected.length > 0) {
      for (const existing of selected) {
        let correlatedScore = 0
        for (const newLeg of pf.legs) {
          for (const existingLeg of existing.legs) {
            if (newLeg.id === existingLeg.id) correlatedScore += 2
            else if (areLegsHighlyCorrelated(newLeg, existingLeg)) correlatedScore += 1.5
            else if (newLeg.match === existingLeg.match) correlatedScore += 0.5
          }
        }
        // 相似度 > 60% 视为重复
        const maxPossible = pf.legs.length * existing.legs.length
        if (maxPossible > 0 && correlatedScore / maxPossible > 0.6) {
          duplicative = true
          break
        }
      }
    }
    
    if (!legExceeds && !matchExceeds && !duplicative) {
      for (const l of pf.legs) {
        legCount.set(l.id, (legCount.get(l.id) || 0) + 1)
        matchCount.set(l.match || '', (matchCount.get(l.match || '') || 0) + 1)
      }
      selected.push(pf)
    }
    
    if (selected.length >= n) break
  }
  
  // 如果还不够 N 个，逐步放开限制
  if (selected.length < n) {
    let relaxed = maxPerLeg + 1
    while (selected.length < n && relaxed <= 5) {
      for (const pf of scored) {
        if (selected.includes(pf)) continue
        const legExceeds = pf.legs.some(l => (legCount.get(l.id) || 0) >= relaxed)
        const matchExceeds = pf.legs.some(l => (matchCount.get(l.match || '') || 0) >= relaxed + 1)
        if (!legExceeds && !matchExceeds) {
          for (const l of pf.legs) {
            legCount.set(l.id, (legCount.get(l.id) || 0) + 1)
            matchCount.set(l.match || '', (matchCount.get(l.match || '') || 0) + 1)
          }
          selected.push(pf)
        }
        if (selected.length >= n) break
      }
      relaxed++
    }
  }
  
  // 兜底：如果仍不够，直接取剩余最高分（去重后）
  for (const pf of scored) {
    if (selected.includes(pf)) continue
    if (selected.length >= n) break
    for (const l of pf.legs) {
      legCount.set(l.id, (legCount.get(l.id) || 0) + 1)
      matchCount.set(l.match || '', (matchCount.get(l.match || '') || 0) + 1)
    }
    selected.push(pf)
  }
  
  // 重新按分数降序排列
  selected.sort((a, b) => b.score - a.score)
  
  return selected
}

// V4: 构建最终结论
function buildFinalVerdict(scored, accepted, yesterday) {
  if (!scored.length || accepted.length < 4) {
    return {
      verdict: '今日建议空仓，不投注',
      reason: `可投注项仅${accepted.length}个（需≥4），正EV机会不足。保留资金等待下一比赛日。`,
      bestPortfolio: null,
    }
  }
  const best = scored[0]
  const tier = classifyTier(best.compOdds)
  const bestLegsDesc = best.legs.map(l => l.bet.replace(/【.*?】/g, '').slice(0, 30)).join(' + ')
  const evDesc = best.compEV > 0.15 ? '正期望值显著，优先配置。' : best.compEV > 0.05 ? '正期望值可接受，建议适量配置。' : '边际正期望值，控制仓位。'

  // 赔率区间说明
  let oddsNote = ''
  if (best.compOdds < 15) oddsNote = '⚠️ 综合赔率低于15倍，但组合综合投资价值最高。'
  else if (best.compOdds > 50) oddsNote = '⚠️ 综合赔率超过50倍，已确认无冷门/比分依赖，Portfolio Score仍然最高。'
  else oddsNote = '✅ 处于15-50倍推荐区间。'

  return {
    verdict: `今日最佳：${tier}组合 ${best.compOdds}x`,
    reason: `${bestLegsDesc}。Portfolio Score=${best.score}/100，EV=${best.compEV > 0 ? '+' : ''}${(best.compEV * 100).toFixed(1)}%，命中率${best.hitPct}%。${evDesc} ${oddsNote}`,
    bestPortfolio: { score: best.score, odds: best.compOdds, legs: best.legs },
    oddsAssessment: oddsNote,
  }
}

// ===================================================================
// MAIN
// ===================================================================
function main() {
  console.log('🏆 WCPE Portfolio Optimizer V5.0')
  console.log('   角色: Investment Committee（投资委员会）')
  console.log('   目标: 定量×定性深度融合，不只做数学计算器')
  console.log('   新特性: 投资委员会审查 | 独立矛盾检查 | 3日滑动平均 | 对数EV衰减 | 资金分散')
  console.log('')

  const remote = loadJSON(REMOTE_PATH)
  if (!remote) { console.error('❌ remote.json 未找到'); process.exit(1) }

  const market = loadJSON(ODDS_PATH) || { odds: {} }

  // Step 1: Yesterday Review + 策略权重学习
  console.log('[Step 1] 复盘昨日 + 策略权重学习（V4.3 3日滑动平均）...')
  const yesterday = analyzeYesterday(remote)
  const sw = yesterday.strategyWeights
  if (yesterday.summary._multiDay) {
    console.log(`  多日加权: ${yesterday.summary._weightStr || ''}`)
  }
  console.log(`  ${yesterday.summary.n}场复盘 → 方向:${(yesterday.summary.dirRate * 100).toFixed(0)}% | Over2.5:${(yesterday.summary.over25Rate * 100).toFixed(0)}% | BTTS:${(yesterday.summary.bttsRate * 100).toFixed(0)}% | Top3:${(yesterday.summary.top3Rate * 100).toFixed(0)}%`)
  console.log(`  策略权重 → 方向:${sw.direction.toFixed(2)} 大小球:${sw.goals.toFixed(2)} BTTS:${sw.btts.toFixed(2)} 比分:${sw.score.toFixed(2)} 安全:${sw.safety.toFixed(2)}`)

  // Step 2: WCPE独立校验
  console.log('[Step 2] 独立校验WCPE预测...')
  const tomorrowMatches = matchesByBJTDate(remote.matches || [], TOMORROW_BJT)
  const tomorrowIds = tomorrowMatches.map(m => m.id)
  const validations = tomorrowIds.map(id => validateWCPE(id, remote, market))
  const fullyValidated = validations.filter(v => v.agree).length
  const hasIssues = validations.filter(v => v.issues.length > 1).length
  console.log(`  校验通过: ${fullyValidated}/${tomorrowIds.length}, 存在争议: ${hasIssues}`)

  // Step 3-4: Candidate Pool
  console.log('[Step 3-4] 构建候选池 + 独立筛选...')
  const { accepted, rejected, matchIds, abandonedMatches, qualitativeProfiles } = buildCandidatePool(remote, market)
  console.log(`  入选: ${accepted.length}, 淘汰: ${rejected.length}, 整场放弃: ${abandonedMatches.length}`)

  // 按市场统计入选
  const byMarket = {}
  for (const c of accepted) { byMarket[c.market] = (byMarket[c.market] || 0) + 1 }
  console.log('  市场分布:', Object.entries(byMarket).map(([k, v]) => `${k}×${v}`).join(', '))

  // 波胆来源统计
  const csAccepted = accepted.filter(c => c.market === '波胆')
  const csSource = csAccepted.length > 0 ? (csAccepted[0]._source || '?') : '无'
  console.log(`  波胆: ${csAccepted.length}个入选 (来源: ${csSource})`)

  // Step 5: Portfolio search
  console.log('[Step 5] 搜索全部合理Portfolio...')
  const portfolios = generatePortfolios(accepted)
  console.log(`  生成: ${portfolios.length} 组`)

  // Step 6: Scoring
  console.log('[Step 6] 12维评分排序（动态权重）...')
  const scored = portfolios.map((pf, i) => {
    const s = scorePortfolio(pf, yesterday.strategyWeights)
    return {
      ...s,
      legs: pf.map(c => ({
        id: c.id, bet: c.bet, odds: c.odds, prob: c.prob, mvi: c.mvi,
        ev: Math.round(c.ev * 1000) / 1000, market: c.market, match: c.match, group: c.group, type: c.type,
        source: c._source || '',
      })),
      index: i,
    }
  })
  scored.sort((a, b) => b.score - a.score)

  // 统计各腿数分布
  const distByLegs = {}
  for (const s of scored) { const k = `${s.n}腿`; distByLegs[k] = (distByLegs[k] || 0) + 1 }
  console.log(`  腿数分布: ${Object.entries(distByLegs).map(([k, v]) => `${k}×${v}`).join(', ')}`)
  console.log(`  最高分: ${scored[0]?.score}/100 (${scored[0]?.n}腿, ${scored[0]?.compOdds}x)`)

  // --- 构建输出 ---

  // V4.2: 去集中选择 — 同一投注项最多 1 次，同一比赛最多 4 次
  const topSelected = selectDiversifiedTop(scored, 10, 1, 4)
  const displayCount = topSelected.length
  console.log(`  去集中后: ${displayCount} 组 (原 Top ${scored.slice(0, 10).length} 组)`)

  const tomorrowBJDate = new Date()
  tomorrowBJDate.setDate(tomorrowBJDate.getDate() + 1)
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const targetDateDisplay = `${tomorrowBJDate.getFullYear()}年${tomorrowBJDate.getMonth() + 1}月${tomorrowBJDate.getDate()}日（${weekDays[tomorrowBJDate.getDay()]}）`

  // MVI高亮
  const topMviBet = accepted.sort((a, b) => b.mvi - a.mvi)[0]
  const mviHighlight = topMviBet ? `${topMviBet.bet.replace(/【.*?】/g, '')} 为本日最强MVI信号(${topMviBet.mvi.toFixed(2)})` : '暂无高MVI信号'

  // 昨日复盘洞察
  const reviewInsights = []
  reviewInsights.push(`方向准确率${Math.round(yesterday.summary.dirRate * 100)}%${yesterday.summary.dirRate < 0.4 ? '（偏低，今日方向类降低权重）' : ''}`)
  reviewInsights.push(`大2.5球命中${Math.round(yesterday.summary.over25Rate * 100)}%${yesterday.summary.over25Rate > 0.7 ? '（优秀，今日大小球提升权重）' : ''}`)
  reviewInsights.push(`BTTS命中${Math.round(yesterday.summary.bttsRate * 100)}%${yesterday.summary.bttsRate > 0.6 ? '（良好）' : ''}`)
  reviewInsights.push(`Top3比分命中${Math.round(yesterday.summary.top3Rate * 100)}%（${yesterday.summary.top3Hits}/${yesterday.summary.n}场）`)

  // ⑤ 主动放弃的机会
  const abandonedOpportunities = []

  // 淘汰的投注项按原因分组
  const byRejectReason = {}
  for (const r of rejected) {
    const key = (r.reasons || ['未分类'])[0] || '未分类'
    if (!byRejectReason[key]) byRejectReason[key] = []
    byRejectReason[key].push(r)
  }
  for (const [reason, items] of Object.entries(byRejectReason)) {
    abandonedOpportunities.push({
      category: '投注项淘汰',
      reason,
      count: items.length,
      examples: items.slice(0, 3).map(r => ({
        match: r.match || '',
        bet: (r.bet || '').replace(/【.*?】/g, ''),
        odds: r.odds,
        ev: Math.round((r.ev || 0) * 1000) / 1000,
        mvi: r.mvi,
      })),
    })
  }

  // 整场放弃
  for (const am of abandonedMatches) {
    abandonedOpportunities.push({
      category: '整场放弃',
      reason: am.reasons.join('; '),
      count: 1,
      examples: [{ match: am.match, bet: '全部投注市场', odds: 0, ev: 0, mvi: 0 }],
    })
  }

  // 低分淘汰的组合
  const lowScoreCount = scored.filter(s => s.score < 35).length
  if (lowScoreCount > 0) {
    abandonedOpportunities.push({
      category: '低分组合',
      reason: `Portfolio Score < 35（综合质量不足）`,
      count: lowScoreCount,
      examples: [],
    })
  }

  // --- 最终输出 ---
  // 生成投资委员会定性档案
  const qualitativeReport = Object.entries(qualitativeProfiles || {}).map(([mid, prof]) => ({
    matchId: mid,
    matchDisplay: prof.matchDisplay,
    flags: prof.flags,
    thesis: prof.thesis,
    qualitativeConfidence: prof.qualitativeConfidence,
    adjustments: prof.adjustments,
  }))

  const output = {
    version: '5.0',
    generatedAt: new Date().toISOString(),
    targetDate: TOMORROW_BJT,
    targetDateDisplay,
    targetMatchIds: tomorrowIds,
    oddsFreshness: market.fetchedAt || 'unknown',
    oddsSource: market.source || 'sample',

    // ① 今日市场评级
    marketRating: {
      verdict: accepted.length >= 25 ? '✅ 值得下注' : accepted.length >= 12 ? '🟡 机会有限' : '⚠️ 机会稀缺',
      investableCount: accepted.length,
      highMviCount: accepted.filter(c => c.mvi >= 1.05).length,
      positiveEvCount: accepted.filter(c => c.ev > 0).length,
      suggestedExposure: accepted.length >= 25 ? '70-80%' : accepted.length >= 12 ? '50-70%' : '30-50%或建议空仓',
      summary: `${tomorrowIds.length}场比赛，${accepted.length}个可投注项（${accepted.filter(c => c.ev > 0).length}个正EV），${accepted.filter(c => c.mvi >= 1.05).length}个高MVI信号。涵盖${Object.keys(byMarket).length}种市场类型。`,
      highlights: [
        mviHighlight,
        `昨日${yesterday.summary.dirRate < 0.4 ? '方向准确率低' : '方向准确率正常'}(${Math.round(yesterday.summary.dirRate * 100)}%)，已动态调整策略权重`,
        `已自动排除${rejected.length}个低质量投注项+${abandonedMatches.length}场高风险比赛`,
        Object.keys(byMarket).length >= 4 ? `多市场覆盖：${Object.keys(byMarket).join('、')}` : null,
      ].filter(Boolean),
    },

    // ①.① 投资委员会定性审查报告 V5.0
    qualitativeReport,

    // ② 今日最佳投资池（按MVI排序）
    investmentPool: accepted
      .sort((a, b) => b.mvi * 0.5 + b.ev * 5 - (a.mvi * 0.5 + a.ev * 5))
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
        source: c._source || '',
      })),

    // ③ Portfolio搜索结果（按Portfolio Score排序，去集中后）
    portfolios: topSelected.map((p, i) => ({
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
      // V4: 前3名输出为什么优于后面的
      comparisonNote: i === 0 && scored[1]
        ? `优于#2的理由：${generateComparisonRationale(scored[0], scored[1])}`
        : i === 1 && scored[2]
          ? `落后#1的理由：综合评分差${(scored[0].score - scored[1].score).toFixed(1)}分`
          : '',
    })),

    // ④ 今日最佳Portfolio + 资金配置
    capitalAllocation: buildCapitalAllocation(topSelected, accepted),
    bestPortfolio: topSelected[0] ? {
      tier: classifyTier(topSelected[0].compOdds),
      score: topSelected[0].score,
      odds: topSelected[0].compOdds,
      hitPct: topSelected[0].hitPct,
      ev: topSelected[0].compEV,
      mvi: topSelected[0].avgMVI,
      legs: topSelected[0].legs,
      breakdown: topSelected[0].breakdown,
      rationale: generateRationale(topSelected[0]),
      // V4: 决策逻辑说明
      decisionLogic: topSelected[1] ? {
        whyBest: generateComparisonRationale(topSelected[0], topSelected[1]),
        keyDifferentiator: topSelected[0].legs.length > topSelected[1].legs.length
          ? `更多事件(${topSelected[0].legs.length} vs ${topSelected[1].legs.length})，分散风险提高确定性`
          : topSelected[0].compEV > topSelected[1].compEV
            ? '更高的期望值'
            : '更好的EV/风险/命中率综合平衡',
      } : { whyBest: '唯一优秀组合', keyDifferentiator: '无竞争对手' },
    } : null,

    // ⑤ 今日主动放弃的机会（V4新增）
    abandonedOpportunities,

    // ⑤ 今日最终结论
    finalVerdict: buildFinalVerdict(topSelected, accepted, yesterday),

    // 兼容旧结构
    yesterdayReview: {
      date: getTodayBJTString(),
      summary: yesterday.summary,
      keyInsights: reviewInsights,
      strategyWeights: yesterday.strategyWeights,
    },
    candidatePool: {
      total: accepted.length + rejected.length,
      accepted: accepted.length,
      rejected: rejected.length,
      abandonedMatches: abandonedMatches.length,
    },
    stats: {
      totalCombinations: portfolios.length,
      topScore: topSelected[0]?.score || 0,
      scoredCount: scored.length,
      byMarket,
      byLegs: distByLegs,
    },
    wcpeValidations: {
      total: validations.length,
      valid: fullyValidated,
      withIssues: hasIssues,
    },
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\n✅ 已写入 ${OUTPUT_PATH}`)
  console.log(`   组合数: ${portfolios.length} | 最高分: ${scored[0]?.score}/100 | 最佳: ${classifyTier(topSelected[0]?.compOdds)} ${topSelected[0]?.compOdds}x`)
  console.log(`   主动放弃: ${rejected.length}投注项 + ${abandonedMatches.length}场`)
  console.log('   V5.0特性: 投资委员会审查(定性+定量) | 矛盾检查 | 3日滑动平均 | 对数EV衰减 | 去集中化v2 | 资金分散')
}

// V4.3: 资金配置（分散风险 — 核心≤70%，辅助≥20%，现金5-10%）
function buildCapitalAllocation(scored, accepted) {
  const BUDGET = 100
  if (!scored.length || accepted.length < 5) {
    return [{ tier: '现金保留（空仓）', portfolio: null, pct: 100, amount: BUDGET, isCash: true }]
  }

  const best = scored[0]
  const nLegs = best.n

  // V4.3: 多腿组合降低每腿仓位，但核心+辅助覆盖率应≥85%
  const basePct = Math.min(70, Math.max(20, 100 / (nLegs + 1)))

  const allocations = []

  // 核心仓位
  allocations.push({
    tier: `核心仓位（${classifyTier(best.compOdds)}·${best.n}腿）`,
    portfolio: { id: 'best', score: best.score, odds: best.compOdds, ev: best.compEV, hitPct: best.hitPct, legs: best.legs },
    pct: Math.round(basePct),
    amount: Math.round(BUDGET * basePct / 100 * 100) / 100,
    isCore: true,
  })

  // 辅助仓位 — 只要存在#2就分配（不再要求不同腿数）
  let alt = null
  if (scored[1]) {
    alt = scored[1]
  }
  if (alt && best.legs && alt.legs) {
    const bestIds = new Set(best.legs.map(l => l.id))
    const sameCount = alt.legs.filter(l => bestIds.has(l.id)).length
    if (sameCount === alt.legs.length && scored[2]) alt = scored[2]
  }

  if (alt) {
    const altPct = Math.max(15, Math.round(basePct * 0.6))
    allocations.push({
      tier: `辅助仓位（${classifyTier(alt.compOdds)}·${alt.n}腿）`,
      portfolio: { id: 'alt', score: alt.score, odds: alt.compOdds, ev: alt.compEV, hitPct: alt.hitPct, legs: alt.legs },
      pct: altPct,
      amount: Math.round(BUDGET * altPct / 100 * 100) / 100,
    })
  }

  // V4.3: 现金保留 — 固定10%风险缓冲
  // 核心+辅助归一化到90%，现金固定10%
  const CASH_PCT = 10
  const investablePct = 100 - CASH_PCT
  const allocTotal = allocations.reduce((s, a) => s + a.pct, 0)

  // 归一化核心+辅助到 investablePct%
  if (allocTotal > 0) {
    for (const a of allocations) {
      a.pct = Math.round(a.pct / allocTotal * investablePct)
      a.amount = Math.round(BUDGET * a.pct / 100 * 100) / 100
    }
  }

  // 添加现金
  allocations.push({
    tier: '现金保留（风险缓冲）',
    portfolio: null,
    pct: CASH_PCT,
    amount: Math.round(BUDGET * CASH_PCT / 100 * 100) / 100,
    isCash: true,
  })

  return allocations
}

main()
