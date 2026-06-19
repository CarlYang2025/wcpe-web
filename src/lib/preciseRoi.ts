/**
 * 精确方案盈亏计算器
 *
 * 赔率来源优先级：
 *   方向赔率：richAnalysis.market 的 Bet365 欧赔 → MVI marketProb → 模型概率反推
 *   大小球赔率：richAnalysis.market 的 O/U 赔率 → MVI marketProb → 模型概率反推
 *   比分赔率：概率反推（1/probability，天然等价于公平赔率，无真实比分赔率数据）
 *   串关赔率：parlayRecommendations 中明确给出的 odds
 *
 * 资金分配来源：
 *   prediction.bankroll.{conservative,balanced,aggressive}.allocations
 *   若为空对象或缺失 → 回退 DEFAULT_ALLOC
 */

import type { Match, Prediction } from './types'

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
  oddsSource: {
    dir: 'bet365' | 'mvi' | 'model'
    ou: 'bet365' | 'mvi' | 'model'
    score: 'probability' | 'none'
    parlay: 'explicit' | 'none'
  }
}

export interface RoiResult {
  cons: number | null
  bal: number | null
  agg: number | null
  detail: RoiDetail
}

const DEFAULT_ALLOC = {
  cons: { '胜平负': 50, '大小球': 30, '比分': 15, '串关': 5 },
  bal: { '胜平负': 40, '比分': 25, '串关': 20, '大小球': 15 },
  agg: { '比分': 35, '串关': 30, '胜平负': 20, '大小球': 15 },
}

function notEmpty(o?: Record<string, number>): o is Record<string, number> {
  return !!o && Object.keys(o).length > 0
}

/** 从 richAnalysis.market 提取 Bet365 方向赔率 */
function extractBet365DirOdds(market: string | undefined, predictedDir: string): number {
  if (!market) return 0
  const m = market.match(/(\d+\.?\d*)\/(\d+\.?\d*)\/(\d+\.?\d*)/)
  if (!m) return 0
  const [home, draw, away] = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]
  if (predictedDir === 'home_win') return home
  if (predictedDir === 'draw') return draw
  return away
}

/** 从 richAnalysis.market 提取 Bet365 O/U 赔率 */
function extractBet365OuOdds(market: string | undefined, predictedOver: boolean): number {
  if (!market) return 0
  const m = market.match(/Over\s+(\d+\.?\d*)[\s\S]*?Under\s+(\d+\.?\d*)/i)
  if (!m) return 0
  return predictedOver ? parseFloat(m[1]) : parseFloat(m[2])
}

/** 从 MVI 提取方向隐含赔率 */
function extractMviDirOdds(pred: Prediction, predictedDir: string): number {
  if (!pred.mviAnalysis?.length) return 0
  const keywords: Record<string, string[]> = {
    'home_win': ['胜', '主胜', 'home', '-0', '无平'],
    'draw': ['平局', '平', 'draw'],
    'away_win': ['客胜', 'away', '+0'],
  }
  const item = pred.mviAnalysis.find(mvi =>
    keywords[predictedDir]?.some(k => mvi.bet.toLowerCase().includes(k.toLowerCase()))
  )
  return item ? 1 / item.marketProb : 0
}

/** 从 MVI 提取大小球隐含赔率 */
function extractMviOuOdds(pred: Prediction, predictedOver: boolean): number {
  if (!pred.mviAnalysis?.length) return 0
  const item = pred.mviAnalysis.find(mvi => {
    const b = mvi.bet.toLowerCase()
    if (predictedOver) return b.includes('大') || b.includes('over')
    return b.includes('小') || b.includes('under')
  })
  return item ? 1 / item.marketProb : 0
}

/** 从模型概率反推方向赔率 */
function modelDirOdds(pred: Prediction): number {
  const map: Record<string, number> = {
    'home_win': pred.homeWinProb,
    'draw': pred.drawProb,
    'away_win': pred.awayWinProb,
  }
  return 1 / (map[pred.predictedDirection] || 0.33)
}

/** 提取比分赔率（从概率反推） */
function extractScoreOdds(pred: Prediction, top1Hit: boolean, top3Hit: boolean, actualScore: string): number {
  if (!top1Hit && !top3Hit) return 0
  if (top1Hit && pred.top5Scores?.[0]) {
    return 1 / pred.top5Scores[0].probability
  }
  if (top3Hit && pred.top5Scores?.length >= 3) {
    const avgProb = pred.top5Scores.slice(0, 3).reduce((s, sc) => s + sc.probability, 0) / 3
    return (1 / avgProb) * 0.7
  }
  if (top3Hit && pred.top5Scores?.length > 0) {
    const found = pred.top5Scores.find(s => s.score === actualScore)
    if (found) return 1 / found.probability
  }
  return 0
}

/** 提取串关结果 */
function extractParlayResult(
  pred: Prediction,
  dirHit: boolean,
): { hit: boolean; odds: number; count: number; hitCount: number } {
  if (!pred.parlayRecommendations?.length) {
    return { hit: false, odds: 0, count: 0, hitCount: 0 }
  }
  let hitCount = 0
  let totalOdds = 0
  for (const p of pred.parlayRecommendations) {
    let allHit = true
    for (const sel of p.selections) {
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
      totalOdds += p.odds
    }
  }
  return { hit: hitCount > 0, odds: totalOdds, count: pred.parlayRecommendations.length, hitCount }
}

/** 精确计算单场三方案盈亏 */
export function preciseMatchROI(match: Match, pred: Prediction): RoiResult | null {
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

  // ---- 赔率提取 ----
  const market = pred.richAnalysis?.market

  let dirOdds = extractBet365DirOdds(market, pred.predictedDirection)
  let dirSource: RoiDetail['oddsSource']['dir'] = 'bet365'
  if (dirOdds === 0) {
    dirOdds = extractMviDirOdds(pred, pred.predictedDirection)
    dirSource = 'mvi'
  }
  if (dirOdds === 0) {
    dirOdds = modelDirOdds(pred)
    dirSource = 'model'
  }

  let ouOdds = extractBet365OuOdds(market, predictedOver)
  let ouSource: RoiDetail['oddsSource']['ou'] = 'bet365'
  if (ouOdds === 0) {
    ouOdds = extractMviOuOdds(pred, predictedOver)
    ouSource = 'mvi'
  }
  if (ouOdds === 0) {
    ouOdds = predictedOver ? 1 / pred.over25Prob : 1 / pred.under25Prob
    ouSource = 'model'
  }

  const scoreOdds = extractScoreOdds(pred, top1Hit, top3Hit, actualScore)
  const scoreSource: RoiDetail['oddsSource']['score'] = top1Hit || top3Hit ? 'probability' : 'none'

  const parlayResult = extractParlayResult(pred, dirHit)
  const parlaySource: RoiDetail['oddsSource']['parlay'] = parlayResult.count > 0 ? 'explicit' : 'none'

  // ---- 盈亏计算 ----
  const calc = (a: Record<string, number>): number | null => {
    const sum = Object.values(a).reduce((s, v) => s + v, 0)
    if (sum === 0) return null
    let r = 0
    if (dirHit) r += (a['胜平负'] || 0) * dirOdds
    if (ouHit === true && (a['大小球'] || 0) > 0) r += (a['大小球'] || 0) * ouOdds
    else if (ouHit === null) r += (a['大小球'] || 0)
    if (scoreOdds > 0) r += (a['比分'] || 0) * scoreOdds
    if (parlayResult.hit) r += (a['串关'] || 0) * parlayResult.odds
    return Math.round(r - 100)
  }

  const b = pred.bankroll
  const allocCons = notEmpty(b?.conservative.allocations) ? b.conservative.allocations : DEFAULT_ALLOC.cons
  const allocBal = notEmpty(b?.balanced.allocations) ? b.balanced.allocations : DEFAULT_ALLOC.bal
  const allocAgg = notEmpty(b?.aggressive.allocations) ? b.aggressive.allocations : DEFAULT_ALLOC.agg

  return {
    cons: calc(allocCons),
    bal: calc(allocBal),
    agg: calc(allocAgg),
    detail: {
      dirHit, top3Hit, top1Hit, ouHit,
      parlayHit: parlayResult.hit,
      predicted: pred.predictedScore,
      actual: actualScore,
      odds: {
        dir: Math.round(dirOdds * 100) / 100,
        ou: Math.round(ouOdds * 100) / 100,
        score: Math.round(scoreOdds * 100) / 100,
        parlay: Math.round(parlayResult.odds * 100) / 100,
      },
      oddsSource: { dir: dirSource, ou: ouSource, score: scoreSource, parlay: parlaySource },
    },
  }
}

/** 赔率来源标签 */
export function oddsSourceLabel(source: string): string {
  const map: Record<string, string> = {
    bet365: 'B', mvi: 'M', model: 'P', probability: 'P', explicit: 'S', none: '-',
  }
  return map[source] || source
}
