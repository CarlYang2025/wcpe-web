/**
 * Export all data to src/data/remote.json (replaces JSONBlob)
 * Run: node --import tsx scripts/export-json.mjs
 *
 * V2.1: 合并现有 remote.json 的自动化产物，避免自动化预测被覆盖
 */
import { matches, predictions as staticPreds, postMatchReviews as staticReviews, modelState as staticModelState, keyLearnings as staticKeyLearnings, teamRatings, predictionRichData, reviewRichData } from '../src/data/matches.ts'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ELO weight factors with learning support
const staticFactorWeights = {
  eloDiff: 0.35,
  recentForm: 0.12,
  h2h: 0.21,
  marketConsensus: 0.29,
  tacticalMatchup: 0.03,
}

/**
 * 数据一致性验证（V2.2 硬性门禁版）
 * 
 * 返回值: { passed: boolean, criticals: string[], warnings: string[] }
 * - criticals: 必须修复的致命错误 → 拒绝写入, 保留上次有效数据
 * - warnings:  需要关注但不阻止部署的问题
 */
function validateDataConsistency(data, existingData) {
  const criticals = []
  const warnings = []

  // ================ 致命错误 (BLOCKING) ================

  // 0. 基本结构
  if (!data || typeof data !== 'object') {
    criticals.push('❌ data 不是有效对象')
    return { passed: false, criticals, warnings }
  }
  if (!Array.isArray(data.matches) || data.matches.length === 0) {
    criticals.push('❌ matches 数组为空或无效')
  }
  if (!data.predictions || typeof data.predictions !== 'object') {
    criticals.push('❌ predictions 对象无效')
  }

  // 1. 逐 prediction 结构校验 (hard-gate)
  if (data.predictions) {
    const requiredFields = ['top5Scores', 'riskWarnings', 'mviAnalysis', 'appliedLearnings', 'parlayRecommendations']
    const arrayFields = ['top5Scores', 'riskWarnings', 'mviAnalysis', 'appliedLearnings', 'parlayRecommendations']
    for (const [id, p] of Object.entries(data.predictions)) {
      if (!p || typeof p !== 'object') {
        criticals.push(`❌ prediction ${id} 不是有效对象`)
        continue
      }
      for (const f of arrayFields) {
        if (p[f] !== undefined && !Array.isArray(p[f])) {
          criticals.push(`❌ prediction ${id}.${f} 不是数组 (实际类型: ${typeof p[f]})`)
        }
      }
      // top5Scores 元素类型检查
      if (Array.isArray(p.top5Scores) && p.top5Scores.length > 0) {
        const badItem = p.top5Scores.find(s => s && typeof s === 'object' && s !== null && typeof s.score !== 'string')
        if (badItem) {
          criticals.push(`❌ prediction ${id}.top5Scores 包含无 score 字段的对象`)
        }
      }
      // predictedDirection 合法性
      if (p.predictedDirection !== undefined && !['home_win', 'draw', 'away_win'].includes(p.predictedDirection)) {
        criticals.push(`❌ prediction ${id}.predictedDirection 非法值: "${p.predictedDirection}"`)
      }
      // factorBreakdown 字段类型 (如果存在)
      if (p.factorBreakdown && typeof p.factorBreakdown === 'object' && !Array.isArray(p.factorBreakdown)) {
        for (const [fk, fv] of Object.entries(p.factorBreakdown)) {
          if (typeof fv !== 'number' || !Number.isFinite(fv)) {
            criticals.push(`❌ prediction ${id}.factorBreakdown.${fk} 不是有效数字: ${JSON.stringify(fv)}`)
          }
        }
      }
    }
  }

  // 2. keyLearnings 元素类型检查 (防止 React error #31)
  if (Array.isArray(data.keyLearnings)) {
    const nonString = data.keyLearnings.find(l => typeof l !== 'string')
    if (nonString) {
      criticals.push(`❌ keyLearnings 包含非字符串元素 (类型: ${typeof nonString}) — 这会触发 React error #31 白屏`)
    }
  } else if (data.keyLearnings !== undefined) {
    criticals.push(`❌ keyLearnings 不是数组 (类型: ${typeof data.keyLearnings}) — 这会触发 React error #31 白屏`)
  }

  // 3. modelState 一致性
  if (data.modelState) {
    const ms = data.modelState
    if (typeof ms.totalPredictions !== 'number' || ms.totalPredictions < 0) {
      criticals.push(`❌ modelState.totalPredictions 无效: ${ms.totalPredictions}`)
    }
    if (ms.totalPredictions > 0 && typeof ms.directionCorrect !== 'number') {
      criticals.push(`❌ modelState.directionCorrect 缺失`)
    }
    if (ms.totalPredictions < (ms.completedPredictions || 0)) {
      criticals.push(`❌ modelState.totalPredictions(${ms.totalPredictions}) < completedPredictions(${ms.completedPredictions})`)
    }
    if (typeof ms.directionAccuracy === 'number' && (ms.directionAccuracy < 0 || ms.directionAccuracy > 1)) {
      criticals.push(`❌ modelState.directionAccuracy 超出范围: ${ms.directionAccuracy}`)
    }
    if (ms.totalPredictions > 0 && ms.directionCorrect > ms.totalPredictions) {
      criticals.push(`❌ directionCorrect(${ms.directionCorrect}) > totalPredictions(${ms.totalPredictions})`)
    }
  }

  // 4. review factorEvaluation 结构
  if (data.reviews && typeof data.reviews === 'object') {
    for (const [id, r] of Object.entries(data.reviews)) {
      if (!r || typeof r !== 'object') continue
      const fe = r.factorEvaluation
      if (fe === undefined || fe === null) {
        criticals.push(`❌ review ${id} 缺少 factorEvaluation`)
      } else if (typeof fe === 'object' && !Array.isArray(fe)) {
        for (const [fk, fv] of Object.entries(fe)) {
          if (fv && typeof fv === 'object' && typeof fv.accuracy !== 'number') {
            criticals.push(`❌ review ${id}.factorEvaluation.${fk} 缺少 accuracy 字段`)
          }
        }
      } else if (typeof fe !== 'object') {
        criticals.push(`❌ review ${id}.factorEvaluation 类型错误: ${typeof fe}`)
      }
    }
  }

  // ================ 警告 (NON-BLOCKING) ================

  // Predictions 数量变化
  const existingPredCount = Object.keys(existingData?.predictions || {}).length
  const newPredCount = Object.keys(data.predictions || {}).length
  if (existingPredCount > 0 && newPredCount < existingPredCount) {
    warnings.push(`⚠️ predictions 减少: ${existingPredCount} → ${newPredCount} (减少 ${existingPredCount - newPredCount})`)
  }

  // 已完赛但无预测
  const finishedWithoutPred = data.matches?.filter(m => 
    m.status === 'finished' && !data.predictions?.[m.id]
  ) || []
  if (finishedWithoutPred.length > 10) {
    warnings.push(`⚠️ ${finishedWithoutPred.length} 场完赛比赛缺预测`)
  }

  // Reviews vs 已完赛
  const reviewCount = Object.keys(data.reviews || {}).length
  const finishedCount = data.matches?.filter(m => m.status === 'finished').length || 0
  if (reviewCount < finishedCount * 0.5) {
    warnings.push(`⚠️ reviews(${reviewCount}) 远少于已完赛(${finishedCount})`)
  }

  // 数据时效
  if (existingData?.lastUpdated) {
    const hoursSince = (Date.now() - new Date(existingData.lastUpdated).getTime()) / 3600000
    if (hoursSince > 24 && newPredCount === existingPredCount) {
      warnings.push(`⚠️ 上次更新 ${hoursSince.toFixed(1)}h 前，预测未变化`)
    }
  }

  // 输出
  if (criticals.length > 0) {
    console.log('\n🔴 致命错误 (将阻止写入):')
    criticals.forEach(e => console.log('  ' + e))
  }
  if (warnings.length > 0) {
    console.log('\n🟡 警告 (不阻止部署):')
    warnings.forEach(w => console.log('  ' + w))
  }
  if (criticals.length === 0 && warnings.length === 0) {
    console.log('✅ 数据一致性检查全部通过')
  } else if (criticals.length === 0) {
    console.log('✅ 无致命错误 (警告项见上)')
  }

  return { passed: criticals.length === 0, criticals, warnings }
}

/**
 * Normalize parlayRecommendations to use 'selections' field consistently.
 */
function normalizeParlayRecommendations(pr) {
  if (!Array.isArray(pr)) return []
  return pr.map(p => ({
    type: p.type || '未命名',
    selections: Array.isArray(p.selections) ? p.selections
      : (Array.isArray(p.matches) ? p.matches : []),
    odds: p.odds ?? p.estOdds ?? 0,
    probability: p.probability ?? p.hitProb ?? 0,
    risk: p.risk || 'Medium',
  }))
}

/**
 * Normalize reviews: ensure factorEvaluation is { accuracy: number } dict.
 * Automation variants we've seen:
 *   - "accuracy=0.5" (string)
 *   - { hitRate: 0.4 } (wrong field name)
 *   - { accuracy: 0.5 } (correct)
 *   - undefined / null (missing entirely)
 */
function normalizeReviews(reviews) {
  if (!reviews || typeof reviews !== 'object') return {}
  const result = {}
  const factors = ['eloDiff', 'recentForm', 'h2h', 'marketConsensus', 'tacticalMatchup', 'overall']
  for (const [id, review] of Object.entries(reviews)) {
    if (!review || typeof review !== 'object') {
      result[id] = review
      continue
    }
    const normalized = { ...review }
    let fe = review.factorEvaluation
    if (fe === undefined || fe === null) {
      // Missing entirely — create a minimal valid structure
      const evalObj = {}
      for (const f of factors) evalObj[f] = { accuracy: 0.5 }
      normalized.factorEvaluation = evalObj
    } else if (typeof fe === 'string') {
      // String format like "accuracy=0.5" — parse and convert
      const parsed = {}
      fe.split(/[,;]/).forEach(pair => {
        const m = pair.match(/(\w+)\s*[=:]\s*([\d.]+)/)
        if (m) parsed[m[1].trim()] = { accuracy: parseFloat(m[2]) || 0.5 }
      })
      if (Object.keys(parsed).length === 0) {
        for (const f of factors) parsed[f] = { accuracy: 0.5 }
      }
      normalized.factorEvaluation = parsed
    } else if (typeof fe === 'object' && !Array.isArray(fe) && fe !== null) {
      // Object format — ensure each factor has { accuracy: number }
      const evalObj = {}
      for (const [factorName, factorData] of Object.entries(fe)) {
        if (typeof factorData === 'number') {
          evalObj[factorName] = { accuracy: factorData }
        } else if (typeof factorData === 'object' && factorData !== null) {
          const acc = typeof factorData.accuracy === 'number' ? factorData.accuracy
            : (typeof factorData.hitRate === 'number' ? factorData.hitRate
            : (typeof factorData.correctRate === 'number' ? factorData.correctRate : 0.5))
          evalObj[factorName] = { ...factorData, accuracy: acc }
        } else {
          evalObj[factorName] = { accuracy: 0.5 }
        }
      }
      normalized.factorEvaluation = evalObj
    } else {
      // Unknown format — create default
      const evalObj = {}
      for (const f of factors) evalObj[f] = { accuracy: 0.5 }
      normalized.factorEvaluation = evalObj
    }
    result[id] = normalized
  }
  return result
}

/**
 * Reclassify a score into quadrant based purely on the score string.
 * Mirrors the classifyQuadrant() logic in analysis-engine.ts.
 * This ensures automation-generated quadrant values (which used the old
 * buggy match-level-probability logic) are corrected during normalization.
 */
function reclassifyQuadrant(score, homeWinProb, awayWinProb) {
  if (typeof score !== 'string') return 'Q2'
  const parts = score.split(/[:-]/)
  if (parts.length !== 2) return 'Q2'
  const h = parseInt(parts[0])
  const a = parseInt(parts[1])
  if (isNaN(h) || isNaN(a)) return 'Q2'

  const homeStrong = (homeWinProb ?? 0) > 0.45 && (homeWinProb - awayWinProb) >= 0.15
  const awayStrong = (awayWinProb ?? 0) > 0.45 && (awayWinProb - homeWinProb) >= 0.15
  const diff = Math.abs(h - a)
  const total = h + a

  // 冷门：强队输球
  if (homeStrong && h < a) return 'Q3'
  if (awayStrong && h > a) return 'Q3'

  // 碾压：强队赢球且净胜 >= 2
  if (homeStrong && h > a && diff >= 2) return 'Q1'
  if (awayStrong && h < a && diff >= 2) return 'Q1'

  // 对攻：双方都进 2+ 且总进球 >= 4
  if (total >= 4 && h >= 2 && a >= 2) return 'Q4'

  // 均势碾压：diff >= 3
  if (diff >= 3) return 'Q1'

  return 'Q2'
}

/**
 * Normalize a single prediction to standard format.
 * This is the single choke point — no matter what format the automation
 * produces, this function ensures every field meets the expected contract.
 *
 * Standard format for each field:
 *   top5Scores: Array<{score:string, probability:number, quadrant:string, reason:string}>
 *   parlayRecommendations: Array<{type:string, selections:string[], odds:number, probability:number, risk:string}>
 *   mviAnalysis: Array<{bet:string, modelProb:number, marketProb:number, mvi:number, rating:string}>
 *   riskWarnings: string[]
 *   appliedLearnings: string[]
 *   bankroll: { conservative: {allocations:Record<string,number>, expectedReturn:number},
 *               balanced: ..., aggressive: ... }
 */
function normalizeSinglePrediction(p) {
  if (!p || typeof p !== 'object') return p

  // 1. top5Scores: always array of objects. String elements → {score, probability, quadrant, reason}
  let top5 = p.top5Scores
  if (!Array.isArray(top5)) {
    top5 = []
  } else {
    top5 = top5.map((s, i) => {
      const hwp = p.homeWinProb ?? 0
      const awp = p.awayWinProb ?? 0
      if (typeof s === 'string') {
        return {
          score: s,
          probability: 0.10 + i * 0.03,
          quadrant: reclassifyQuadrant(s, hwp, awp),
          reason: '自动化生成预测（字符串格式已标准化）',
        }
      }
      if (typeof s === 'object' && s !== null) {
        const scoreStr = s.score ?? String(s)
        return {
          score: scoreStr,
          probability: s.probability ?? (0.10 + i * 0.03),
          quadrant: reclassifyQuadrant(scoreStr, hwp, awp),
          reason: s.reason || '预测生成',
        }
      }
      return { score: String(s), probability: 0.08, quadrant: 'Q2', reason: '标准化兜底' }
    })
  }

  // 2. parlayRecommendations: already normalized by parent, ensure array
  const parlay = normalizeParlayRecommendations(p.parlayRecommendations)

  // 3. mviAnalysis: always array of objects
  let mvi = p.mviAnalysis
  if (!Array.isArray(mvi)) {
    mvi = []
  } else {
    mvi = mvi.filter(item => item && typeof item === 'object').map(item => ({
      bet: item.bet ?? '',
      modelProb: item.modelProb ?? 0,
      marketProb: item.marketProb ?? 0,
      mvi: item.mvi ?? 0,
      rating: item.rating || '未评估',
    }))
  }

  // 4. riskWarnings: always string[]
  let rw = p.riskWarnings
  if (!Array.isArray(rw)) {
    rw = []
  } else {
    rw = rw.filter(w => w != null).map(w => String(w))
  }

  // 5. appliedLearnings: always array of objects with lesson/adjustment/impact
  let al = p.appliedLearnings
  if (!Array.isArray(al)) {
    al = []
  } else {
    al = al.filter(l => l != null).map(l => {
      if (typeof l === 'object' && l !== null && !Array.isArray(l)) {
        // Already an object — preserve structure, ensure fields
        return {
          lesson: String(l.lesson ?? ''),
          adjustment: String(l.adjustment ?? ''),
          impact: (l.impact === '上调' || l.impact === '下调' || l.impact === '中性') ? l.impact : '中性',
        }
      }
      // String or other primitive — wrap in lesson field
      const raw = String(l).replace(/^\[object Object\]$/i, '历史经验')
      return { lesson: raw, adjustment: '', impact: '中性' }
    })
  }

  // 6. factorBreakdown: ensure object with all 8 sub-fields, or undefined
  // CRITICAL: 自动化产出使用不同字段名 (eloDiff, recentForm, marketConsensus 等)
  // 这里做二阶段检测：先尝试标准名，再用自动化别名映射。两种都失败才算无效。
  let fb = p.factorBreakdown
  if (fb && typeof fb === 'object' && !Array.isArray(fb) && fb !== null) {
    const standardFields = ['eloDiffScore', 'recentFormScore', 'h2hScore', 'marketScore', 'tacticalScore', 'squadScore', 'pressureScore', 'psychologyScore']
    // 自动化别名映射表：不区分大小写
    const aliasMap = {
      eloDiff: 'eloDiffScore',
      elodiff: 'eloDiffScore',
      elo_diff: 'eloDiffScore',
      recentForm: 'recentFormScore',
      recentform: 'recentFormScore',
      recent_form: 'recentFormScore',
      h2h: 'h2hScore',
      H2H: 'h2hScore',
      headToHead: 'h2hScore',
      'head-to-head': 'h2hScore',
      marketConsensus: 'marketScore',
      marketconsensus: 'marketScore',
      market: 'marketScore',
      oddsConsensus: 'marketScore',
      tacticalMatchup: 'tacticalScore',
      tacticalmatchup: 'tacticalScore',
      tactical: 'tacticalScore',
      matchup: 'tacticalScore',
      squad: 'squadScore',
      squadStrength: 'squadScore',
      benchDepth: 'squadScore',
      benchdepth: 'squadScore',
      roster: 'squadScore',
      pressure: 'pressureScore',
      pressureIndex: 'pressureScore',
      psychological: 'psychologyScore',
      psychology: 'psychologyScore',
      mentality: 'psychologyScore',
    }
    const safe = {}
    let hasAny = false
    for (const f of standardFields) {
      // 一阶段：直接用标准字段名读取
      let raw = fb[f]
      // 二阶段：遍历别名映射表查找
      if (raw === undefined || raw === null) {
        for (const [alias, target] of Object.entries(aliasMap)) {
          if (target === f && fb[alias] !== undefined && fb[alias] !== null) {
            raw = fb[alias]
            break
          }
        }
      }
      const v = Number(raw)
      safe[f] = Number.isFinite(v) ? v : 0
      if (raw !== undefined && raw !== null) hasAny = true
    }
    fb = hasAny ? safe : undefined
  } else if (fb !== undefined) {
    fb = undefined
  }

  // 7. goalTimeline: ensure array or undefined
  let gt = p.goalTimeline
  if (gt !== undefined && !Array.isArray(gt)) {
    gt = undefined
  }

  // 8. bankroll: ensure valid structure
  let br = p.bankroll
  if (br && typeof br === 'object') {
    const plans = ['conservative', 'balanced', 'aggressive']
    const normalizedBr = {}
    for (const plan of plans) {
      const pl = br[plan]
      if (pl && typeof pl === 'object') {
        normalizedBr[plan] = {
          allocations: (pl.allocations && typeof pl.allocations === 'object') ? pl.allocations : {},
          expectedReturn: typeof pl.expectedReturn === 'number' ? pl.expectedReturn : 0,
        }
      } else {
        normalizedBr[plan] = { allocations: {}, expectedReturn: 0 }
      }
    }
    br = normalizedBr
  } else {
    br = undefined
  }

  // 9. eloChanges: ensure array or undefined
  let ec = p.eloChanges
  if (ec !== undefined && !Array.isArray(ec)) {
    ec = undefined
  }

  // 10. predictedDirection: normalize to one of 'home_win'|'draw'|'away_win'
  let pd = p.predictedDirection
  const validDirs = ['home_win', 'draw', 'away_win']
  if (typeof pd === 'string') {
    // Map common automation variants to canonical form
    const lower = pd.toLowerCase().replace(/[_-]/g, '')
    if (lower === 'homewin' || lower === 'home' || lower === '1') pd = 'home_win'
    else if (lower === 'draw' || lower === 'tie' || lower === 'x') pd = 'draw'
    else if (lower === 'awaywin' || lower === 'away' || lower === '2') pd = 'away_win'
    else if (!validDirs.includes(pd)) pd = undefined
  } else if (typeof pd !== 'string') {
    pd = undefined
  }

  // 11. over25Prob / under25Prob: cross-fill missing values (automation often omits one)
  // Also round to 2dp to avoid IEEE 754 artifacts
  let over = typeof p.over25Prob === 'number' && !isNaN(p.over25Prob) ? p.over25Prob : undefined
  let under = typeof p.under25Prob === 'number' && !isNaN(p.under25Prob) ? p.under25Prob : undefined
  if (over !== undefined && under === undefined) under = 1 - over
  if (under !== undefined && over === undefined) over = 1 - under
  if (over !== undefined) over = Math.round(over * 100) / 100
  if (under !== undefined) under = Math.round(under * 100) / 100

  // 12. bankroll: infer allocations from prediction data when all empty
  let resolvedBr = br
  if (resolvedBr && typeof resolvedBr === 'object') {
    const planOrder = ['conservative', 'balanced', 'aggressive']
    // Default allocation templates keyed by plan
    const defaultAllocs = {
      conservative: { '胜平负': 100 },
      balanced: { '胜平负': 50, '大小球': 30, '比分': 20 },
      aggressive: { '胜平负': 30, '大小球': 20, '比分': 25, '串关': 25 },
    }
    // Default expected returns ~= parlayRecommendations[planIndex].odds * 100 (roughly)
    const planEreturns = parlay.filter(pr => pr.odds && pr.odds > 0).map(pr => Math.round(pr.odds * 100))
    const defaultReturns = planEreturns.length >= 3 ? planEreturns : [105, 150, 210] // fallback

    for (let pi = 0; pi < planOrder.length; pi++) {
      const plan = planOrder[pi]
      const pl = resolvedBr[plan]
      if (pl && typeof pl === 'object') {
        const allocs = pl.allocations
        const totalAlloc = (allocs && typeof allocs === 'object')
          ? Object.values(allocs).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
          : 0
        if (totalAlloc === 0) {
          // All empty — use inferred defaults
          resolvedBr[plan] = {
            allocations: { ...defaultAllocs[plan] },
            expectedReturn: typeof pl.expectedReturn === 'number' && pl.expectedReturn > 0
              ? pl.expectedReturn
              : (defaultReturns[pi] ?? 100),
          }
        } else {
          resolvedBr[plan] = {
            allocations: allocs,
            expectedReturn: typeof pl.expectedReturn === 'number' ? pl.expectedReturn : 0,
          }
        }
      }
    }
  }

  return {
    ...p,
    ...(over !== undefined && { over25Prob: over }),
    ...(under !== undefined && { under25Prob: under }),
    top5Scores: top5,
    parlayRecommendations: parlay,
    mviAnalysis: mvi,
    riskWarnings: rw,
    appliedLearnings: al,
    ...(fb !== undefined && { factorBreakdown: fb }),
    ...(gt !== undefined && { goalTimeline: gt }),
    ...(resolvedBr !== undefined && { bankroll: resolvedBr }),
    ...(ec !== undefined && { eloChanges: ec }),
    ...(pd !== undefined && { predictedDirection: pd }),
  }
}

/**
 * Normalize predictions: full structural standardization for every prediction
 */
function normalizePredictions(preds) {
  if (!preds || typeof preds !== 'object') return {}
  const result = {}
  for (const [id, p] of Object.entries(preds)) {
    result[id] = normalizeSinglePrediction(p)
  }
  return result
}

// ============================================================
// 市场赔率混合引擎
// 将真实庄家赔率与 ELO 模型概率混合，生成 MVI 分析
// ============================================================

/** 读取 market-odds.json */
function readMarketOdds() {
  const marketOddsPath = resolve(__dirname, '../src/data/market-odds.json')
  if (!existsSync(marketOddsPath)) return { odds: {} }
  try {
    const raw = JSON.parse(readFileSync(marketOddsPath, 'utf-8'))
    return { odds: raw.odds || {}, source: raw.source, fetchedAt: raw.fetchedAt }
  } catch {
    return { odds: {} }
  }
}

/**
 * 从庄家赔率去水计算市场隐含概率
 * 使用 additive method（与 Pinnacle 去水一致）
 */
function devigOdds(homeWin, draw, awayWin) {
  const overround = 1 / homeWin + 1 / draw + 1 / awayWin
  return {
    home: Math.round((1 / homeWin) / overround * 100) / 100,
    draw: Math.round((1 / draw) / overround * 100) / 100,
    away: Math.round((1 / awayWin) / overround * 100) / 100,
    overround: Math.round((overround - 1) * 1000) / 10, // 抽水百分比
  }
}

/**
 * 混合 ELO 概率与市场概率: 40% ELO + 60% 市场
 */
function blendWithMarket(eloProbs, marketOdds) {
  const { home: mHome, draw: mDraw, away: mAway } = devigOdds(
    marketOdds.homeWin, marketOdds.draw, marketOdds.awayWin
  )
  return {
    home: Math.round((eloProbs.home * 0.4 + mHome * 0.6) * 100) / 100,
    draw: Math.round((eloProbs.draw * 0.4 + mDraw * 0.6) * 100) / 100,
    away: Math.round((eloProbs.away * 0.4 + mAway * 0.6) * 100) / 100,
  }
}

/**
 * 计算 MVI（市场价值指数）= 模型概率 / 市场隐含概率
 */
function calcMVI(modelProb, marketOdds) {
  const marketProb = 1 / marketOdds
  return Math.round((modelProb / marketProb) * 100) / 100
}

/**
 * MVI 评级
 */
function rateMviValue(mvi) {
  if (mvi > 1.30) return '超级价值'
  if (mvi >= 1.15) return '高价值'
  if (mvi >= 1.00) return '一般价值'
  return '无价值'
}

/**
 * 生成 MVI 分析数组（5个基础方向 + BTTS + 比分校准）
 */
function generateMviAnalysis(homeWinProb, drawProb, awayWinProb, over25Prob, under25Prob, odds) {
  const items = [
    { bet: '主胜', modelProb: homeWinProb, marketProb: Math.round((1 / odds.homeWin) * 100) / 100,
      mvi: calcMVI(homeWinProb, odds.homeWin),
      rating: rateMviValue(calcMVI(homeWinProb, odds.homeWin)) },
    { bet: '平局', modelProb: drawProb, marketProb: Math.round((1 / odds.draw) * 100) / 100,
      mvi: calcMVI(drawProb, odds.draw),
      rating: rateMviValue(calcMVI(drawProb, odds.draw)) },
    { bet: '客胜', modelProb: awayWinProb, marketProb: Math.round((1 / odds.awayWin) * 100) / 100,
      mvi: calcMVI(awayWinProb, odds.awayWin),
      rating: rateMviValue(calcMVI(awayWinProb, odds.awayWin)) },
    { bet: 'Over 2.5', modelProb: over25Prob, marketProb: Math.round((1 / odds.over25) * 100) / 100,
      mvi: calcMVI(over25Prob, odds.over25),
      rating: rateMviValue(calcMVI(over25Prob, odds.over25)) },
    { bet: 'Under 2.5', modelProb: under25Prob, marketProb: Math.round((1 / odds.under25) * 100) / 100,
      mvi: calcMVI(under25Prob, odds.under25),
      rating: rateMviValue(calcMVI(under25Prob, odds.under25)) },
  ]
  // BTTS: 从 O/U 隐含估算模型 BTTS 概率 (有过2.5球 ≈ 双方都有进球的趋势)
  const impliedBttsProb = Math.min(over25Prob * 1.1, 0.95)
  if (odds.bttsYes && odds.bttsNo) {
    items.push({
      bet: 'BTTS Yes', modelProb: Math.round(impliedBttsProb * 100) / 100,
      marketProb: Math.round((1 / odds.bttsYes) * 100) / 100,
      mvi: calcMVI(impliedBttsProb, odds.bttsYes),
      rating: rateMviValue(calcMVI(impliedBttsProb, odds.bttsYes)),
    })
  }
  return items.sort((a, b) => b.mvi - a.mvi)
}

/**
 * Poisson 估算 top5 比分概率 — 当模型概率未校准时（全 0.01）替代硬编码占位值。
 * 从 over25Prob 反推 λ → 按 ML 概率分配主客队 λ → Poisson PMF 计算各比分概率 → 归一化。
 * 与 generate-portfolio.mjs 的 estimateScoreProbabilities() 逻辑一致。
 */
function enrichTop5WithPoisson(top5Scores, homeWinProb, drawProb, awayWinProb, over25Prob) {
  if (!Array.isArray(top5Scores) || top5Scores.length === 0) return top5Scores

  // 检测是否需要 enrichment：所有概率都一样（或都为 0.01）
  const probs = top5Scores.map(s => (typeof s === 'object' ? s.probability : undefined))
  const uniqueProbs = new Set(probs)
  const needsEnrichment = uniqueProbs.size <= 1 || (uniqueProbs.size === 2 && uniqueProbs.has(undefined))

  if (!needsEnrichment) return top5Scores

  const hwp = typeof homeWinProb === 'number' ? homeWinProb : 0.33
  const dp  = typeof drawProb === 'number' ? drawProb : 0.34
  const awp = typeof awayWinProb === 'number' ? awayWinProb : 0.33
  const o25p = typeof over25Prob === 'number' ? over25Prob : 0.5

  // Step 1: 从 over25Prob 反推总期望进球 λ（二分法求解 Poisson CDF）
  const targetUnder25 = 1 - o25p
  let lo = 0.3, hi = 8.0
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2
    const pUnder25 = Math.exp(-mid) * (1 + mid + mid * mid / 2)
    if (pUnder25 > targetUnder25) lo = mid
    else hi = mid
  }
  const totalLambda = (lo + hi) / 2

  // Step 2: 用 ML 概率分配主客队 λ
  const homeShare = hwp + dp * 0.45
  const awayShare = awp + dp * 0.55
  const shareSum = homeShare + awayShare
  const homeLambda = shareSum > 0 ? totalLambda * (homeShare / shareSum) : totalLambda * 0.5
  const awayLambda = shareSum > 0 ? totalLambda * (awayShare / shareSum) : totalLambda * 0.5

  // Step 3: Poisson PMF
  function poissonPMF(k, lambda) {
    if (lambda <= 0) return k === 0 ? 1 : 0
    let logP = -lambda + k * Math.log(lambda)
    let logFact = 0
    for (let i = 2; i <= k; i++) logFact += Math.log(i)
    return Math.exp(logP - logFact)
  }

  // Step 4: 计算每个比分的 Poisson 概率
  const rawProbs = {}
  let totalRaw = 0
  for (const s of top5Scores) {
    const scoreStr = typeof s === 'string' ? s : s.score || ''
    const parts = scoreStr.split(/[:-]/)
    if (parts.length !== 2) continue
    const h = parseInt(parts[0]), a = parseInt(parts[1])
    if (isNaN(h) || isNaN(a)) continue
    const prob = poissonPMF(h, homeLambda) * poissonPMF(a, awayLambda)
    rawProbs[scoreStr] = prob
    totalRaw += prob
  }

  // Step 5: 归一化 → top5 概率和 = min(totalRaw, 0.75)
  const target = Math.min(totalRaw, 0.75)
  const enriched = top5Scores.map(s => {
    const scoreStr = typeof s === 'string' ? s : s.score || ''
    const rawProb = totalRaw > 0 ? (rawProbs[scoreStr] || 0) / totalRaw * target : 0.01
    const prob = Math.round(rawProb * 10000) / 10000
    if (typeof s === 'object') {
      return { ...s, probability: prob > 0 ? prob : 0.01, _poissonEnriched: true }
    }
    return { score: s, probability: prob > 0 ? prob : 0.01, _poissonEnriched: true }
  })

  // Step 6: 按概率降序排序，确保 #1 就是真正概率最高的比分
  enriched.sort((a, b) => (b.probability || 0) - (a.probability || 0))

  return enriched
}

/**
 * 用市场比分赔率校准 top5Scores
 * 将市场隐含的比分概率与模型概率混合 (30% market + 70% model)
 */
function calibrateScoresWithMarket(top5Scores, correctScoreOdds, homeWinProb, awayWinProb) {
  if (!correctScoreOdds || Object.keys(correctScoreOdds).length === 0) return top5Scores
  if (!Array.isArray(top5Scores) || top5Scores.length === 0) return top5Scores

  // 从比分赔率计算市场隐含概率
  const scoreProbs = {}
  let totalImp = 0
  for (const [score, odds] of Object.entries(correctScoreOdds)) {
    const prob = 1 / (odds || 100)
    scoreProbs[score] = prob
    totalImp += prob
  }

  // 去水
  for (const score of Object.keys(scoreProbs)) {
    scoreProbs[score] = Math.round(scoreProbs[score] / totalImp * 1000) / 1000
  }

  // 混合: 70% 模型 + 30% 市场（仅当市场有该比分数据时才混合）
  return top5Scores.map((s, i) => {
    const scoreStr = typeof s.score === 'string' ? s.score : String(s)
    const marketProb = scoreProbs[scoreStr] || 0
    const modelProb = s.probability || 0.10
    const blended = marketProb > 0
      ? Math.round((modelProb * 0.7 + marketProb * 0.3) * 100) / 100
      : modelProb
    return {
      ...s,
      probability: blended > 0 ? blended : modelProb,
      _marketScoreProb: marketProb > 0 ? marketProb : undefined,
    }
  })
}

/**
 * 将市场赔率应用到 predictions
 * - upcoming 比赛: 混合概率 + 生成 MVI
 * - finished 比赛: 保留原始概率（不做混合，结果已定）
 */
function applyMarketOdds(predictions, matches, marketOddsData) {
  if (!marketOddsData?.odds || Object.keys(marketOddsData.odds).length === 0) {
    return predictions // 无市场赔率，跳过
  }

  const mOdds = marketOddsData.odds
  const matchMap = new Map(matches.map(m => [m.id, m]))
  let blendedCount = 0
  let mviCount = 0

  for (const [matchId, pred] of Object.entries(predictions)) {
    const match = matchMap.get(matchId)
    const market = mOdds[matchId]

    // 只处理 upcoming 且有市场赔率的比赛
    if (!market || !match || match.status === 'finished') continue

    const hwp = typeof pred.homeWinProb === 'number' ? pred.homeWinProb : 0.33
    const dp  = typeof pred.drawProb === 'number' ? pred.drawProb : 0.34
    const awp = typeof pred.awayWinProb === 'number' ? pred.awayWinProb : 0.33
    const o25p = typeof pred.over25Prob === 'number' ? pred.over25Prob : 0.5
    const u25p = typeof pred.under25Prob === 'number' ? pred.under25Prob : 0.5

    // 保存原始纯模型概率
    pred._modelHomeWinProb = hwp
    pred._modelDrawProb = dp
    pred._modelAwayWinProb = awp
    pred._modelOver25Prob = o25p
    pred._modelUnder25Prob = u25p

    // 混合概率
    const blended = blendWithMarket(
      { home: hwp, draw: dp, away: awp },
      market
    )
    pred.homeWinProb = blended.home
    pred.drawProb = blended.draw
    pred.awayWinProb = blended.away
    pred._blended = true // 标记已混合
    blendedCount++

    // 更新 predictedDirection
    // V4.3 修复: 当主胜/客胜概率相等且都高于平局时，不应默认平局
    const EPS = 0.005
    if (blended.home > blended.away + EPS && blended.home > blended.draw + EPS) {
      pred.predictedDirection = 'home_win'
    } else if (blended.away > blended.home + EPS && blended.away > blended.draw + EPS) {
      pred.predictedDirection = 'away_win'
    } else if (blended.draw > blended.home + EPS && blended.draw > blended.away + EPS) {
      pred.predictedDirection = 'draw'
    } else {
      // 势均力敌：取最高概率方向，平局作为最低优先级
      // 因为势均力敌时平局概率往往被低估，但应尊重数据
      const maxProb = Math.max(blended.home, blended.away, blended.draw)
      if (Math.abs(blended.home - maxProb) <= EPS) {
        pred.predictedDirection = 'home_win'
      } else if (Math.abs(blended.away - maxProb) <= EPS) {
        pred.predictedDirection = 'away_win'
      } else {
        pred.predictedDirection = 'draw'
      }
    }

    // 生成 MVI 分析
    pred.mviAnalysis = generateMviAnalysis(blended.home, blended.draw, blended.away, o25p, u25p, market)
    mviCount++

    // 比分校准：先用 Poisson 修复 0.01 占位概率，再用市场 Correct Score 混合
    pred.top5Scores = enrichTop5WithPoisson(pred.top5Scores, blended.home, blended.draw, blended.away, o25p)
    if (market.correctScore && Object.keys(market.correctScore).length > 0) {
      pred.top5Scores = calibrateScoresWithMarket(pred.top5Scores, market.correctScore, blended.home, blended.away)
      // 市场校准后重新排序
      pred.top5Scores.sort((a, b) => (b.probability || 0) - (a.probability || 0))
    }
    // 同步 predictedScore：拆掉 LLM 与 Poisson 之间的墙
    if (pred.top5Scores.length > 0) {
      pred.predictedScore = pred.top5Scores[0].score
    }

    // 附上完整市场赔率数据（前端展示用，compact 格式）
    pred._marketOdds = {
      btts: market.bttsYes ? { yes: market.bttsYes, no: market.bttsNo } : undefined,
      drawNoBet: market.drawNoBet,
      doubleChance: market.doubleChance,
      spread: market.spread,
      altGoalLines: market.altGoalLines,
      halfTime: market.halfTime,
    }
    // 清理 undefined 值
    for (const [k, v] of Object.entries(pred._marketOdds)) {
      if (v === undefined) delete pred._marketOdds[k]
    }

    // 更新 marketScore（因子评分）
    if (pred.factorBreakdown && typeof pred.factorBreakdown === 'object') {
      // marketScore = 1.0 表示模型与市场完全一致，偏差越大分数越低
      const marketProbs = devigOdds(market.homeWin, market.draw, market.awayWin)
      const consensusDiff = Math.abs(blended.home - marketProbs.home) +
                           Math.abs(blended.draw - marketProbs.draw) +
                           Math.abs(blended.away - marketProbs.away)
      const consensusScore = Math.max(0, Math.round((1 - consensusDiff) * 100) / 100)
      pred.factorBreakdown.marketScore = consensusScore
    }
  }

  if (blendedCount > 0) {
    console.log(`  📊 市场赔率混合: ${blendedCount} 场比赛 (${marketOddsData.source || 'unknown'})`)
    console.log(`  🎯 MVI 分析生成: ${mviCount} 场比赛`)
  }
  return predictions
}

/**
 * Recalculate modelState from actual match results + predictions.
 * Runs on every build, so accuracy stats are ALWAYS fresh.
 */
function computeModelState(matches, predictions, existingModelState) {
  const finished = matches.filter(m =>
    m.status === 'finished' &&
    m.homeScore !== undefined &&
    m.awayScore !== undefined
  )

  let directionCorrect = 0
  let scoreTop3Correct = 0
  let scoreTop1Correct = 0
  let totalPredicted = 0
  let drawCountPredicted = 0   // draws among matches with predictions
  let drawCountAll = 0         // draws among ALL finished matches

  for (const m of finished) {
    const isDraw = m.homeScore === m.awayScore
    if (isDraw) drawCountAll++

    const pred = predictions[m.id]
    if (!pred) continue
    totalPredicted++

    const actualScore = `${m.homeScore}:${m.awayScore}`
    const actualDir = m.homeScore > m.awayScore ? 'home_win'
      : m.homeScore < m.awayScore ? 'away_win' : 'draw'
    if (actualDir === 'draw') drawCountPredicted++

    let predDir = pred.predictedDirection
    if (!predDir && typeof pred.homeWinProb === 'number' && typeof pred.awayWinProb === 'number') {
      // Infer direction from probabilities when explicit field is missing
      if (pred.homeWinProb > pred.awayWinProb && pred.homeWinProb > (pred.drawProb || 0)) predDir = 'home_win'
      else if (pred.awayWinProb > pred.homeWinProb && pred.awayWinProb > (pred.drawProb || 0)) predDir = 'away_win'
      else predDir = 'draw'
    }
    if (predDir === actualDir) {
      directionCorrect++
    }

    // Score accuracy
    const top5 = pred.top5Scores
    if (Array.isArray(top5) && top5.length > 0) {
      const scores = top5.slice(0, 5).map(s =>
        typeof s === 'object' && s !== null ? s.score : s
      )
      if (scores[0] === actualScore) scoreTop1Correct++
      if (scores.slice(0, 3).includes(actualScore)) scoreTop3Correct++
    }
  }

  const base = {
    directionAccuracy: totalPredicted > 0 ? directionCorrect / totalPredicted : 0,
    scoreTop3Accuracy: totalPredicted > 0 ? scoreTop3Correct / totalPredicted : 0,
    scoreTop1Accuracy: totalPredicted > 0 ? scoreTop1Correct / totalPredicted : 0,
    totalPredictions: totalPredicted,
    completedPredictions: totalPredicted,
    directionCorrect,
    scoreTop3Correct,
    scoreTop1Correct,
    /** 平局率 = 所有已完赛中平局场次 / 总已完赛场次 */
    overallDrawRate: finished.length > 0 ? drawCountAll / finished.length : 0,
    /** 所有已完赛中的平局场次 */
    overallDrawCount: drawCountAll,
    overallTotalMatches: finished.length,
    totalReviews: Object.keys(existingModelState?.totalReviews ? {} : {}).length || existingModelState?.totalReviews || 0,
  }

  // Preserve automation-learned fields: factorWeights, totalLearnings, lastReviewDate
  if (existingModelState) {
    return {
      ...base,
      factorWeights: existingModelState.factorWeights || {},
      totalLearnings: existingModelState.totalLearnings || 0,
      lastReviewDate: existingModelState.lastReviewDate || new Date().toISOString(),
      totalReviews: existingModelState.totalReviews || base.totalReviews,
    }
  }

  return {
    ...base,
    factorWeights: {},
    totalLearnings: 0,
    lastReviewDate: new Date().toISOString(),
  }
}

/**
 * Deep merge predictions: hardcoded provides complete structural baseline,
 * existing provides runtime updates. Hardcoded never loses fields to incomplete existing data.
 */
function deepMergePredictions(hardcoded, existing) {
  if (!existing || typeof existing !== 'object') return hardcoded
  const result = { ...hardcoded }
  for (const [id, exPred] of Object.entries(existing)) {
    const hcPred = hardcoded[id]
    if (hcPred) {
      // Per-prediction merge: hardcoded as base, existing overrides
      // EXCEPT: don't let existing empty/null arrays override hardcoded non-empty arrays
      result[id] = mergePredictionFields(hcPred, exPred)
    } else {
      // New prediction from automation — keep as-is
      result[id] = exPred
    }
  }
  return result
}

/**
 * Merge two prediction objects: hardcoded base + existing overrides.
 * Structural arrays (top5Scores, mviAnalysis, parlayRecommendations) from
 * hardcoded are preserved when existing provides an empty/null version.
 */
function mergePredictionFields(hc, ex) {
  const merged = {}
  // Start with all hardcoded fields
  for (const key of Object.keys(hc)) {
    const exVal = ex[key]
    const hcVal = hc[key]
    // Preserve hardcoded non-empty arrays when existing provides empty/null
    if (Array.isArray(hcVal) && hcVal.length > 0 && (!Array.isArray(exVal) || exVal.length === 0)) {
      merged[key] = hcVal
    } else {
      merged[key] = exVal !== undefined ? exVal : hcVal
    }
  }
  // Add any new fields from existing that hardcoded doesn't have
  for (const key of Object.keys(ex)) {
    if (!(key in merged)) {
      merged[key] = ex[key]
    }
  }
  return merged
}

// --- Build remote data ---

// Read existing remote.json (if any) to preserve automation outputs
const outputPath = resolve(__dirname, '../src/data/remote.json')
let existingData = null
if (existsSync(outputPath)) {
  try {
    existingData = JSON.parse(readFileSync(outputPath, 'utf-8'))
  } catch {
    // Corrupted file, ignore
  }
}

// Build merged matches and predictions first (needed for modelState computation)
const mergedMatches = mergeMatches(matches, existingData?.matches)
let mergedPredictions = deepMergePredictions(
  normalizePredictions(staticPreds),
  normalizePredictions(existingData?.predictions)
)

// Apply market odds: blend probabilities + generate MVI for upcoming matches
const marketOddsData = readMarketOdds()
mergedPredictions = applyMarketOdds(mergedPredictions, mergedMatches, marketOddsData)

// Poisson enrichment fallback: 处理没有市场赔率的 upcoming 比赛
// 即使 market-odds.json 缺失，也要修复 0.01 占位概率
for (const [matchId, pred] of Object.entries(mergedPredictions)) {
  const match = mergedMatches.find(m => m.id === matchId)
  if (!match || match.status === 'finished') continue
  const top5 = pred.top5Scores
  if (!Array.isArray(top5) || top5.length === 0) continue
  // 检查是否需要 enrichment（概率是否已经多样化）
  const probs = top5.map(s => (typeof s === 'object' ? s.probability : undefined))
  const uniqueProbs = new Set(probs)
  if (uniqueProbs.size <= 1 || (uniqueProbs.size === 2 && uniqueProbs.has(undefined))) {
    const hwp = typeof pred.homeWinProb === 'number' ? pred.homeWinProb : 0.33
    const dp  = typeof pred.drawProb === 'number' ? pred.drawProb : 0.34
    const awp = typeof pred.awayWinProb === 'number' ? pred.awayWinProb : 0.33
    const o25p = typeof pred.over25Prob === 'number' ? pred.over25Prob : 0.5
    pred.top5Scores = enrichTop5WithPoisson(top5, hwp, dp, awp, o25p)
    if (pred.top5Scores.length > 0) {
      pred.predictedScore = pred.top5Scores[0].score
    }
  }
}

// Compute modelState FRESH from actual match data (not incremental patching)
const computedModelState = computeModelState(mergedMatches, mergedPredictions, existingData?.modelState)

// Build final remote data
const remoteData = {
  version: '2.2',
  lastUpdated: new Date().toISOString(),
  matches: mergedMatches,
  predictions: mergedPredictions,
  reviews: normalizeReviews({
    ...staticReviews,
    ...(existingData?.reviews || {}),
  }),
  modelState: computedModelState,
  keyLearnings: existingData?.keyLearnings || staticKeyLearnings,
  eloRatings: existingData?.eloRatings || teamRatings,
  factorWeights: existingData?.factorWeights || staticFactorWeights,
  predictionRichData: { ...predictionRichData, ...(existingData?.predictionRichData || {}) },
  reviewRichData: { ...reviewRichData, ...(existingData?.reviewRichData || {}) },
  // 市场赔率数据 (供前端展示)
  marketOdds: {
    source: marketOddsData?.source || 'none',
    fetchedAt: marketOddsData?.fetchedAt || null,
    availableMatches: Object.keys(marketOddsData?.odds || {}),
  },
}

// --- 写入前验证：硬性门禁 ---
// 先做预写验证（在 normalize 之后、写入之前）
const preValidation = validateDataConsistency(remoteData, existingData)

if (!preValidation.passed) {
  console.log('\n⛔ 硬性门禁拦截：数据包含致命错误，拒绝写入！')
  console.log('   保留上次有效 remote.json，不更新文件。')
  console.log(`   致命错误数: ${preValidation.criticals.length}`)
  
  // 保留上次有效版本
  if (existingData) {
    writeFileSync(outputPath, JSON.stringify(existingData))
    console.log('✅ 已回退到上次有效 remote.json')
  }
  process.exit(1)
}

writeFileSync(outputPath, JSON.stringify(remoteData))

// --- Post-process: fill empty appliedLearnings from keyLearnings ---
// Automation often writes [object Object] or empty objects as appliedLearnings.
// This pass detects placeholder content and fills it with relevant keyLearnings.
if (remoteData.keyLearnings?.length > 0 && remoteData.predictions) {
  const kl = remoteData.keyLearnings
  const placeholder = '历史经验'
  for (const id of Object.keys(remoteData.predictions)) {
    const pred = remoteData.predictions[id]
    if (!pred.appliedLearnings || !Array.isArray(pred.appliedLearnings) || pred.appliedLearnings.length === 0) continue

    // Check if ALL items are placeholders (empty/meaningless)
    const allPlaceholder = pred.appliedLearnings.every(
      item => !item.lesson || item.lesson === placeholder || (item.lesson || '').trim().length < 4
    )
    if (!allPlaceholder) continue // Has real data, skip

    // Find relevant keyLearnings based on match teams and score pattern
    const match = remoteData.matches?.find(m => m.id === id)
    const homeTeam = (match?.homeTeam || '').toLowerCase()
    const awayTeam = (match?.awayTeam || '').toLowerCase()
    const scorePattern = `${match?.homeScore ?? ''}:${match?.awayScore ?? ''}`

    // Score-based matching: find learnings that mention this score or these teams
    const relevant = kl.filter(lesson => {
      const l = lesson.toLowerCase()
      return (
        l.includes(scorePattern) ||
        l.includes(homeTeam) ||
        l.includes(awayTeam)
      )
    }).slice(0, 3)

    // Fallback: pick the most recent learnings if no direct match found
    const selected = relevant.length > 0 ? relevant : kl.slice(-Math.min(3, kl.length))

    pred.appliedLearnings = selected.map((text, i) => ({
      lesson: text,
      adjustment: '',
      impact: i % 2 === 0 ? '上调' : '下调',
    }))
  }
  // Re-write after post-processing
  writeFileSync(outputPath, JSON.stringify(remoteData))
}

console.log(`✅ remote.json written to ${outputPath} (${(JSON.stringify(remoteData).length / 1024).toFixed(0)} KB)`)
if (existingData) {
  console.log('   Merged existing automation data — predictions/reviews/ELO preserved')
}

// --- 数据一致性验证 (写入后) ---
console.log('\n📋 数据一致性验证...')
const postValidation = validateDataConsistency(remoteData, existingData)
if (!postValidation.passed) {
  console.log('\n⛔ 写入后验证未通过，但文件已写入（预写门禁已通过，这里列出的是边缘警告）')
}

/**
 * Merge two match arrays.
 * Hardcoded matches are the authoritative base.
 * Existing matches provide score/status updates and new match entries.
 */
function mergeMatches(hardcoded, existing) {
  if (!Array.isArray(existing) || existing.length === 0) return hardcoded

  const existingMap = new Map(existing.map(m => [m.id, m]))

  // Update hardcoded matches with existing score/status data
  const merged = hardcoded.map(m => {
    const ex = existingMap.get(m.id)
    if (!ex) return m
    return {
      ...m,
      // Use existing scores if available (from automation or ESPN)
      homeScore: ex.homeScore ?? m.homeScore,
      awayScore: ex.awayScore ?? m.awayScore,
      status: ex.status || m.status,
      // Preserve matchStats from existing if not in hardcoded
      matchStats: m.matchStats || ex.matchStats,
    }
  })

  // Append new matches from existing that don't exist in hardcoded
  for (const ex of existing) {
    if (!merged.find(m => m.id === ex.id)) {
      merged.push(ex)
    }
  }

  return merged
}


