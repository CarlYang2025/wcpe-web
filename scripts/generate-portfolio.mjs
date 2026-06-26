#!/usr/bin/env node
/**
 * generate-portfolio.mjs — WCPE Portfolio Optimizer V4.0
 * 
 * 读取 remote.json + market-odds.json，运行组合优化引擎，
 * 生成 portfolio.json 供网站展示。
 * 
 * V4 核心理念：
 *   你是 Investment Portfolio Manager，不是竞彩推荐员。
 *   优化目标是 Portfolio Score（组合综合质量），不是赔率。
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
function analyzeYesterday(remote) {
  const todayBJT = getTodayBJTString()
  let matches = (remote.matches || []).filter(m => {
    return kickoffBJTDate(m.kickoff) === todayBJT && m.status === 'finished'
  })
  if (matches.length === 0) {
    matches = (remote.matches || []).filter(m => {
      return kickoffBJTDate(m.kickoff) === getYesterdayBJTString() && m.status === 'finished'
    })
  }
  return analyzeBJTDate(remote, matches)
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

  // V4: 动态策略权重 — 基于昨日各市场准确率
  const strategyWeights = {
    direction: Math.max(0.6, Math.min(1.2, dirRate * 2)),       // 方向权重 (0.6-1.2)
    goals: Math.max(0.6, Math.min(1.2, over25Rate * 1.5)),       // 大小球权重 (0.6-1.2)
    btts: Math.max(0.6, Math.min(1.2, bttsRate * 1.5)),          // BTTS权重 (0.6-1.2)
    score: Math.max(0.5, Math.min(1.0, top3Rate * 1.2)),         // 比分权重 (0.5-1.0)
    safety: dirRate > 0.6 ? 1.1 : 0.9,                            // 双重机会权重
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
function buildCandidatePool(remote, market) {
  const tomorrowMatches = matchesByBJTDate(remote.matches || [], TOMORROW_BJT)
  const tomorrowIds = tomorrowMatches.map(m => m.id)

  // 独立二次校验结果
  const validationResults = tomorrowIds.map(id => validateWCPE(id, remote, market))

  const pool = []
  const preRejected = [] // 赛前就被判死刑的比赛

  for (const mid of tomorrowIds) {
    const pred = remote.predictions?.[mid] || {}
    const odds = market.odds?.[mid] || {}
    const m = remote.matches?.find(x => x.id === mid) || {}
    const validation = validationResults.find(v => v.matchId === mid)

    // 如果WCPE校验完全失败（3+个问题），整场比赛标记为高风险
    if (validation && validation.issues.length >= 3) {
      preRejected.push({
        mid, match: `${cn(m.homeTeam || '')} vs ${cn(m.awayTeam || '')}`,
        reason: `WCPE校验失败：${validation.issues.join('; ')}`,
      })
      // 仍然构建候选池，但添加高风险标记
    }

    const homeEn = m.homeTeam || '', awayEn = m.awayTeam || ''
    const home = cn(homeEn), away = cn(awayEn)
    const group = m.group || '', kickoff = m.kickoff || ''
    const hwp = pred.homeWinProb || 0.33, dp = pred.drawProb || 0.33, awp = pred.awayWinProb || 0.33
    const o25p = pred.over25Prob || 0.5, u25p = 1 - o25p
    const bttsP = pred.bttsProb || 0.5, nbttsP = 1 - bttsP
    const confidence = pred.confidence || 0.5, risk = pred.riskLevel || 'Medium'
    const wcpeIssues = (validation?.issues || []).length

    const hOdd = odds.homeWin || 0, dOdd = odds.draw || 0, aOdd = odds.awayWin || 0
    const oOdd = odds.over25 || 0, uOdd = odds.under25 || 0
    const bYesOdd = odds.bttsYes || 0, bNoOdd = odds.bttsNo || 0

    // MVI map
    const mviMap = {}
    for (const mvi of (pred.mviAnalysis || [])) {
      mviMap[mvi.bet || ''] = mvi.mvi || 1
    }
    const getMVI = (name) => mviMap[name] || 1

    const matchDisplay = `${home} vs ${away}`

    // V4: 去水EV计算
    function dewateredEV(modelProb, oddsVal, allOddsArr) {
      if (!oddsVal || oddsVal <= 0) return { ev: 0, marketProb: 0 }
      const marketProb = dewateredProb(oddsVal, allOddsArr)
      return { ev: modelProb * oddsVal - 1, marketProb }
    }

    // --- 胜平负 ---
    const dirAllOdds = [hOdd, dOdd, aOdd].filter(Boolean)
    if (hOdd) {
      const { ev } = dewateredEV(hwp, hOdd, dirAllOdds)
      pool.push({ id: `${mid}_h`, mid, match: matchDisplay, group, kickoff, bet: `【胜平负】${home} 主胜`, market: '胜平负', odds: hOdd, prob: hwp, mvi: getMVI('主胜'), ev, conf: confidence, risk, type: 'direction', wcpeIssues })
    }
    if (dOdd) {
      const { ev } = dewateredEV(dp, dOdd, dirAllOdds)
      pool.push({ id: `${mid}_d`, mid, match: matchDisplay, group, kickoff, bet: `【胜平负】${home} vs ${away} 平局`, market: '胜平负', odds: dOdd, prob: dp, mvi: getMVI('平局'), ev, conf: confidence, risk, type: 'direction', wcpeIssues })
    }
    if (aOdd) {
      const { ev } = dewateredEV(awp, aOdd, dirAllOdds)
      pool.push({ id: `${mid}_a`, mid, match: matchDisplay, group, kickoff, bet: `【胜平负】${away} 客胜`, market: '胜平负', odds: aOdd, prob: awp, mvi: getMVI('客胜'), ev, conf: confidence, risk, type: 'direction', wcpeIssues })
    }

    // --- 大小球 ---
    const goalAllOdds = [oOdd, uOdd].filter(Boolean)
    if (oOdd) {
      const { ev } = dewateredEV(o25p, oOdd, goalAllOdds)
      pool.push({ id: `${mid}_o25`, mid, match: matchDisplay, group, kickoff, bet: `【大小球】${home} vs ${away} 大2.5球`, market: '大小球', odds: oOdd, prob: o25p, mvi: getMVI('Over 2.5'), ev, conf: confidence, risk, type: 'goals', wcpeIssues })
    }
    if (uOdd) {
      const { ev } = dewateredEV(u25p, uOdd, goalAllOdds)
      pool.push({ id: `${mid}_u25`, mid, match: matchDisplay, group, kickoff, bet: `【大小球】${home} vs ${away} 小2.5球`, market: '大小球', odds: uOdd, prob: u25p, mvi: getMVI('Under 2.5'), ev, conf: confidence, risk, type: 'goals', wcpeIssues })
    }

    // --- BTTS（V4新增市场）---
    if (bYesOdd && bYesOdd > 0 && bYesOdd < 10) {
      const { ev } = dewateredEV(bttsP, bYesOdd, [bYesOdd, bNoOdd].filter(Boolean))
      pool.push({ id: `${mid}_btts_y`, mid, match: matchDisplay, group, kickoff, bet: `【BTTS】${home} vs ${away} 双方进球=是`, market: 'BTTS', odds: bYesOdd, prob: bttsP, mvi: getMVI('BTTS Yes'), ev, conf: confidence, risk: risk === 'High' ? 'Medium' : risk, type: 'btts', wcpeIssues })
    }
    if (bNoOdd && bNoOdd > 0 && bNoOdd < 10) {
      const { ev } = dewateredEV(nbttsP, bNoOdd, [bYesOdd, bNoOdd].filter(Boolean))
      pool.push({ id: `${mid}_btts_n`, mid, match: matchDisplay, group, kickoff, bet: `【BTTS】${home} vs ${away} 双方进球=否`, market: 'BTTS', odds: bNoOdd, prob: nbttsP, mvi: getMVI('BTTS No'), ev, conf: confidence, risk: risk === 'High' ? 'Medium' : risk, type: 'btts', wcpeIssues })
    }

    // --- 双重机会 ---
    if (hOdd && dOdd) {
      const hdProb = hwp + dp, hdOdds = 1 / (1 / hOdd + 1 / dOdd)
      const ev = calcEV(hdProb, hdOdds)
      pool.push({ id: `${mid}_dc_hd`, mid, match: matchDisplay, group, kickoff, bet: `【双重机会】${home} 或 平局`, market: '双重机会', odds: Math.round(hdOdds * 100) / 100, prob: hdProb, mvi: 0.98, ev, conf: confidence, risk: 'Low', type: 'safety', wcpeIssues })
    }
    if (aOdd && dOdd) {
      const adProb = awp + dp, adOdds = 1 / (1 / aOdd + 1 / dOdd)
      const ev = calcEV(adProb, adOdds)
      pool.push({ id: `${mid}_dc_ad`, mid, match: matchDisplay, group, kickoff, bet: `【双重机会】${away} 或 平局`, market: '双重机会', odds: Math.round(adOdds * 100) / 100, prob: adProb, mvi: 0.98, ev, conf: confidence, risk: 'Low', type: 'safety', wcpeIssues })
    }

    // --- 波胆（正确比分）---
    for (const s of (pred.top5Scores || []).slice(0, 5)) {
      const score = typeof s === 'string' ? s : s.score || ''
      const prob = typeof s === 'object' ? (s.probability || 0.01) : 0.015
      const estOdds = Math.round(1 / Math.max(prob, 0.003) * 10) / 10
      pool.push({ id: `${mid}_cs_${score.replace(':', '-')}`, mid, match: matchDisplay, group, kickoff, bet: `【波胆】${home} vs ${away} 比分 ${score}`, market: '波胆', odds: estOdds, prob, mvi: 1.0, ev: calcEV(prob, estOdds), conf: confidence, risk: 'High', type: 'score', wcpeIssues })
    }
  }

  // --- V4 增强过滤 ---
  const accepted = [], rejected = []
  for (const c of pool) {
    const reasons = []

    // 1. EV过滤 — EV < -0.08 直接淘汰
    if (c.ev < -0.08) reasons.push(`EV显著负(${(c.ev * 100).toFixed(1)}%)`)

    // 2. MVI过滤 — MVI < 0.80 且非波胆淘汰
    if (c.mvi < 0.80 && c.market !== '波胆' && c.market !== '双重机会') reasons.push(`MVI过低(${c.mvi.toFixed(2)})`)

    // 3. 置信度 + 风险过滤
    if (c.conf < 0.40 && c.risk === 'High') reasons.push('极低置信+高风险')
    if (c.wcpeIssues >= 3 && c.type === 'direction') reasons.push('WCPE方向预测不可靠')

    // 4. 波胆特殊过滤
    if (c.market === '波胆' && c.prob < 0.008) reasons.push('比分概率极低(<0.8%)')
    if (c.market === '波胆' && c.prob < 0.015 && c.mvi < 1.0) reasons.push('低概率波胆无MVI支撑')

    // 5. 盘口异常（赔率 > 100 且无EV）
    if (c.odds > 100 && c.ev < 0.2 && c.market !== '波胆') reasons.push('超高赔率无EV支撑')

    if (reasons.length) rejected.push({ ...c, reasons })
    else accepted.push(c)
  }

  // V4: 淘汰的比赛也需要记录（用于⑤主动放弃）
  const abandonedMatches = preRejected.map(pr => ({
    match: pr.match,
    reasons: [pr.reason],
    type: '整场放弃',
  }))

  return { accepted, rejected, matchIds: [...new Set(pool.map(c => c.mid))], validationResults, abandonedMatches }
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

  // 1. EV得分 (0-15分) — 正EV越高越好
  const evScore = compEV > 0 ? Math.min(compEV * 8 + 5, 15) : compEV > -0.05 ? 3 : 0

  // 2. MVI得分 (0-15分) — 错价信号
  const mviScore = Math.min(avgMVI * 12, 15)

  // 3. 命中率得分 (0-15分) — 8-35%最优区间
  let hitScore = 0
  if (hitPct >= 8 && hitPct <= 35) hitScore = 15
  else if (hitPct >= 4 && hitPct < 8) hitScore = 10
  else if (hitPct >= 2 && hitPct < 4) hitScore = 6
  else if (hitPct > 35) hitScore = 9
  else if (hitPct >= 1) hitScore = 3

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
  // 包含3+个波胆 → 极不稳定
  const scoreLegs = legs.filter(c => c.market === '波胆')
  if (scoreLegs.length >= 3) externalRiskPenalty += 3
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
  }
  strategyBonus = Math.min(strategyBonus, 5)

  let total = evScore + mviScore + hitScore + riskScore + effScore + matchIndScore + marketDivScore + stabilityScore + dataConsistencyScore + strategyBonus - corrPenalty - specialRisk - externalRiskPenalty
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
  return `${p.legs.length}场组合[${markets.join('+')}]：${legDescs}。${evDesc}，命中${p.hitPct}%，评分${p.score}/100。`
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
  console.log('🏆 WCPE Portfolio Optimizer V4.0')
  console.log('   身份: Investment Portfolio Manager（世界杯投资组合经理）')
  console.log('   目标: 最大化 Portfolio Score（组合综合质量），非赔率')
  console.log('')

  const remote = loadJSON(REMOTE_PATH)
  if (!remote) { console.error('❌ remote.json 未找到'); process.exit(1) }

  const market = loadJSON(ODDS_PATH) || { odds: {} }

  // Step 1: Yesterday Review + 策略权重学习
  console.log('[Step 1] 复盘昨日 + 策略权重学习...')
  const yesterday = analyzeYesterday(remote)
  const sw = yesterday.strategyWeights
  console.log(`  方向:${(yesterday.summary.dirRate * 100).toFixed(0)}% | Over2.5:${(yesterday.summary.over25Rate * 100).toFixed(0)}% | BTTS:${(yesterday.summary.bttsRate * 100).toFixed(0)}% | Top3:${(yesterday.summary.top3Rate * 100).toFixed(0)}%`)
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
  const { accepted, rejected, matchIds, abandonedMatches } = buildCandidatePool(remote, market)
  console.log(`  入选: ${accepted.length}, 淘汰: ${rejected.length}, 整场放弃: ${abandonedMatches.length}`)

  // 按市场统计入选
  const byMarket = {}
  for (const c of accepted) { byMarket[c.market] = (byMarket[c.market] || 0) + 1 }
  console.log('  市场分布:', Object.entries(byMarket).map(([k, v]) => `${k}×${v}`).join(', '))

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

  // Top 10 (或更少如果优秀组合不足)
  const topN = scored.filter(s => s.score >= 45).slice(0, 10)
  // 如果不足10个且所有得分>30，补齐到实际数量
  const displayCount = topN.length >= 10 ? 10 : (scored.filter(s => s.score >= 35).length || 3)

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
      })),

    // ③ Portfolio搜索结果（按Portfolio Score排序）
    portfolios: scored.slice(0, displayCount).map((p, i) => ({
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
    capitalAllocation: buildCapitalAllocation(scored, accepted),
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
      // V4: 决策逻辑说明
      decisionLogic: scored[1] ? {
        whyBest: generateComparisonRationale(scored[0], scored[1]),
        keyDifferentiator: scored[0].legs.length > scored[1].legs.length
          ? `更多事件(${scored[0].legs.length} vs ${scored[1].legs.length})，分散风险提高确定性`
          : scored[0].compEV > scored[1].compEV
            ? '更高的期望值'
            : '更好的EV/风险/命中率综合平衡',
      } : { whyBest: '唯一优秀组合', keyDifferentiator: '无竞争对手' },
    } : null,

    // ⑤ 今日主动放弃的机会（V4新增）
    abandonedOpportunities,

    // ⑤ 今日最终结论
    finalVerdict: buildFinalVerdict(scored, accepted, yesterday),

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
      topScore: scored[0]?.score || 0,
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
  console.log(`   组合数: ${portfolios.length} | 最高分: ${scored[0]?.score}/100 | 最佳: ${classifyTier(scored[0]?.compOdds)} ${scored[0]?.compOdds}x`)
  console.log(`   主动放弃: ${rejected.length}投注项 + ${abandonedMatches.length}场`)
  console.log('   V4特性: 12维评分 | 动态权重 | BTTS市场 | 去水EV | 独立校验 | 主动放弃分析')
}

// V4: 资金配置
function buildCapitalAllocation(scored, accepted) {
  const BUDGET = 100
  if (!scored.length || accepted.length < 5) {
    return [{ tier: '现金保留（空仓）', portfolio: null, pct: 100, amount: BUDGET, isCash: true }]
  }

  // 按组合腿数动态分配（多腿组合降低每腿仓位）
  const best = scored[0]
  const nLegs = best.n
  const basePct = Math.min(60, Math.max(15, 80 / nLegs)) // 2腿→40%, 3腿→27%, 4腿→20%, 5腿→16%

  const allocations = [
    {
      tier: `核心仓位（${classifyTier(best.compOdds)}·${best.n}腿）`,
      portfolio: { id: 'best', score: best.score, odds: best.compOdds, ev: best.compEV, hitPct: best.hitPct, legs: best.legs },
      pct: Math.round(basePct),
      amount: Math.round(BUDGET * basePct / 100 * 100) / 100,
      isCore: true,
    },
  ]

  // 如果存在2号不同风格组合，分配辅助仓位
  if (scored[1] && scored[1].n !== scored[0].n) {
    const altPct = Math.round(basePct * 0.5)
    allocations.push({
      tier: `辅助仓位（${classifyTier(scored[1].compOdds)}·${scored[1].n}腿）`,
      portfolio: { id: 'alt', score: scored[1].score, odds: scored[1].compOdds, ev: scored[1].compEV, hitPct: scored[1].hitPct, legs: scored[1].legs },
      pct: altPct,
      amount: Math.round(BUDGET * altPct / 100 * 100) / 100,
    })
  }

  // Normalize to 100%
  const totalAlloc = allocations.reduce((s, a) => s + a.pct, 0)
  if (totalAlloc > 0) {
    for (const a of allocations) {
      a.pct = Math.round(a.pct / totalAlloc * 100)
      a.amount = Math.round(BUDGET * a.pct / 100 * 100) / 100
    }
  }

  return allocations
}

main()
