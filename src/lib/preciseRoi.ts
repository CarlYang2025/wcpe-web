/**
 * 方案盈亏计算器 — 模型赔率版
 *
 * 核心理念：「如果按照网站当天显示的方案投注，我的盈亏是多少？」
 * 所有赔率均使用模型概率反推（1/prob × 抽水），与 MatchdaySummary 页面显示完全一致。
 *
 * 资金分配：与 MatchdaySummary 三道方案完全一致
 *   保守：胜平负60 + 大小球25 + 比分10 + 串关5
 *   平衡：胜平负40 + 比分25 + 串关20 + 大小球15
 *   激进：串关35 + 比分30 + 胜平负20 + 大小球15
 */

import type { Match, Prediction } from './types'

// 抽水系数（与 MatchdaySummary.tsx 中的 MARGIN_* 完全一致）
const MARGIN_DIR = 0.93   // 胜平负 ~7%
const MARGIN_OU = 0.93    // 大小球 ~7%
const MARGIN_SCORE = 0.75 // 比分 ~25%

// 资金分配（与 MatchdaySummary.tsx bankrollPlans 完全一致）
const ALLOC = {
  cons: { '胜平负': 60, '大小球': 25, '比分': 10, '串关': 5 },
  bal: { '胜平负': 40, '比分': 25, '串关': 20, '大小球': 15 },
  agg: { '串关': 35, '比分': 30, '胜平负': 20, '大小球': 15 },
}

export interface RoiDetail {
  dirHit: boolean
  top3Hit: boolean
  top1Hit: boolean
  ouHit: boolean | null
  parlayHit: boolean
  predicted: string
  actual: string
  odds: {
    dir: number
    ou: number
    score: number
    parlay: number
  }
}

export interface RoiResult {
  cons: number | null
  bal: number | null
  agg: number | null
  detail: RoiDetail
}

function notEmpty(o?: Record<string, number>): o is Record<string, number> {
  return !!o && Object.keys(o).length > 0
}

/**
 * 模型方向赔率 = 1/预测方向概率 × 0.93
 * 与 MatchdaySummary dirOdds() 完全一致
 */
function modelDirOdds(pred: Prediction): number {
  const prob = pred.predictedDirection === 'home_win' ? pred.homeWinProb
    : pred.predictedDirection === 'away_win' ? pred.awayWinProb : pred.drawProb
  return +((1 / prob) * MARGIN_DIR).toFixed(2)
}

/**
 * 模型大小球赔率 = 1/预测O/U概率 × 0.93
 * 与 MatchdaySummary ouOdds() 完全一致
 */
function modelOuOdds(pred: Prediction): number {
  const over = pred.over25Prob > pred.under25Prob
  const prob = over ? pred.over25Prob : pred.under25Prob
  return +((1 / prob) * MARGIN_OU).toFixed(2)
}

/**
 * 模型比分赔率 = 1/比分概率 × 0.75
 * 与 MatchdaySummary scoreOdds() 完全一致
 */
function modelScoreOdds(pred: Prediction, top1Hit: boolean, top3Hit: boolean, actualScore: string): number {
  if (!top1Hit && !top3Hit) return 0
  if (top1Hit && pred.top5Scores?.[0]) {
    return +((1 / pred.top5Scores[0].probability) * MARGIN_SCORE).toFixed(2)
  }
  if (top3Hit && pred.top5Scores?.length >= 3) {
    const avgProb = pred.top5Scores.slice(0, 3).reduce((s, sc) => s + sc.probability, 0) / 3
    return +((1 / avgProb) * MARGIN_SCORE).toFixed(2)
  }
  if (top3Hit) {
    const found = pred.top5Scores?.find(s => s.score === actualScore)
    if (found) return +((1 / found.probability) * MARGIN_SCORE).toFixed(2)
  }
  return 0
}

/**
 * 串关命中检测 + 赔率提取
 * 串关赔率直接使用 parlayRecommendations 中给出的 odds
 */
function parlayResult(pred: Prediction, dirHit: boolean): {
  hit: boolean; odds: number; count: number; hitCount: number
} {
  if (!pred.parlayRecommendations?.length) {
    return { hit: false, odds: 0, count: 0, hitCount: 0 }
  }
  let hitCount = 0
  let totalOdds = 0
  for (const p of pred.parlayRecommendations) {
    // 兼容两种数据格式：selections (旧) / matches (新)
    const sels = p.selections ?? p.matches ?? []
    if (!Array.isArray(sels)) continue
    let allHit = true
    for (const sel of sels) {
      const s = sel.toLowerCase()
      if (s.includes('胜') || s.includes('win')) {
        if (!dirHit) allHit = false
      }
      if (s.includes('平') || s.includes('draw')) {
        if (pred.predictedDirection !== 'draw') allHit = false
      }
    }
    if (allHit) {
      hitCount++
      // 兼容两种赔率字段：odds (旧) / estOdds (新)
      totalOdds += (p.odds ?? p.estOdds ?? 0)
    }
  }
  return { hit: hitCount > 0, odds: totalOdds, count: pred.parlayRecommendations.length, hitCount }
}

/**
 * 单场盈亏计算
 *
 * 核心逻辑：当日总预算 100% 均分到当天每场比赛。
 *   - 每场本金 = 100 / matchCount
 *   - 每场分配 = 方案比例 × (1/matchCount)
 *
 * 盈亏 = 命中回报 - 单场本金
 *   方向命中 → (分配% / N) × 赔率
 *   比分命中 → (分配% / N) × 赔率
 *   ...
 *   全部不中 → 0 - (100/N) = 单场最多亏 100/N %
 *   当日最多亏 (100/N) × N = 100%
 */
export function preciseMatchROI(match: Match, pred: Prediction, matchCount: number = 1): RoiResult | null {
  if (match.homeScore === undefined || match.awayScore === undefined) return null

  const actualScore = `${match.homeScore}:${match.awayScore}`
  const totalGoals = match.homeScore + match.awayScore

  // ---- 命中判断 ----
  const actual = match.homeScore === match.awayScore ? 'draw'
    : match.homeScore > match.awayScore ? 'home_win' : 'away_win'
  const dirHit = pred.predictedDirection === actual
  const top3Hit = pred.top5Scores?.slice(0, 3).some(s => s.score === actualScore) ?? false
  const top1Hit = pred.top5Scores?.[0]?.score === actualScore

  const predictedOver = pred.over25Prob > pred.under25Prob
  const ouEqual = pred.over25Prob === pred.under25Prob
  const actualOver = totalGoals > 2.5
  const actualUnder = totalGoals < 2.5
  const ouHit: boolean | null = ouEqual || totalGoals === 2.5
    ? null
    : predictedOver === actualOver

  // ---- 模型赔率（与网站显示完全一致） ----
  const dirOdds = modelDirOdds(pred)
  const ouOdds = modelOuOdds(pred)
  const scoreOddsVal = modelScoreOdds(pred, top1Hit, top3Hit, actualScore)
  const parlayRes = parlayResult(pred, dirHit)

  const share = 1 / matchCount

  // ---- 盈亏计算 ----
  const calc = (a: Record<string, number>): number | null => {
    const sum = Object.values(a).reduce((s, v) => s + v, 0)
    if (sum === 0) return null
    let r = 0
    if (dirHit) r += (a['胜平负'] || 0) * share * dirOdds
    if (ouHit === true && (a['大小球'] || 0) > 0) r += (a['大小球'] || 0) * share * ouOdds
    else if (ouHit === null) r += (a['大小球'] || 0) * share // push，退还本金
    if (scoreOddsVal > 0) r += (a['比分'] || 0) * share * scoreOddsVal
    if (parlayRes.hit) r += (a['串关'] || 0) * share * parlayRes.odds
    // stake = 方案中该比赛日均摊的本金（sum × share，约等于 100/N）
    return Math.round(r - sum * share)
  }

  // 优先使用 prediction.bankroll 的自定义分配，否则用统一 ALLOC
  const b = pred.bankroll
  // 防御式可选链：b?.conservative?.allocations 确保 b 和 b.conservative 都为非 null 时才访问
  // Terser 会把 b?.conservative.allocations 编译成 null==v ? void 0 : v.conservative.allocations
  // 如果 v 存在但 v.conservative 为 undefined，会在传参给 notEmpty 之前就抛出 TypeError
  // 因此必须在每一层属性访问都使用 ?.
  const allocCons = notEmpty(b?.conservative?.allocations) ? b.conservative.allocations : ALLOC.cons
  const allocBal = notEmpty(b?.balanced?.allocations) ? b.balanced.allocations : ALLOC.bal
  const allocAgg = notEmpty(b?.aggressive?.allocations) ? b.aggressive.allocations : ALLOC.agg

  return {
    cons: calc(allocCons),
    bal: calc(allocBal),
    agg: calc(allocAgg),
    detail: {
      dirHit, top3Hit, top1Hit, ouHit,
      parlayHit: parlayRes.hit,
      predicted: pred.predictedScore,
      actual: actualScore,
      odds: {
        dir: dirOdds,
        ou: ouOdds,
        score: scoreOddsVal,
        parlay: Math.round(parlayRes.odds * 100) / 100,
      },
    },
  }
}

/** 赔率来源标签（现统一为 M = 模型赔率） */
export function oddsSourceLabel(source: string): string {
  return 'M'
}
