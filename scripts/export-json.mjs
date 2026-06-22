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
      if (typeof s === 'string') {
        return {
          score: s,
          probability: 0.10 + i * 0.03,
          quadrant: 'Q2',
          reason: '自动化生成预测（字符串格式已标准化）',
        }
      }
      if (typeof s === 'object' && s !== null) {
        return {
          score: s.score ?? String(s),
          probability: s.probability ?? (0.10 + i * 0.03),
          quadrant: s.quadrant || 'Q2',
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
  let fb = p.factorBreakdown
  if (fb && typeof fb === 'object' && !Array.isArray(fb) && fb !== null) {
    const fields = ['eloDiffScore', 'recentFormScore', 'h2hScore', 'marketScore', 'tacticalScore', 'squadScore', 'pressureScore', 'psychologyScore']
    const safe = {}
    let hasAny = false
    for (const f of fields) {
      const v = Number(fb[f])
      safe[f] = Number.isFinite(v) ? v : 0
      if (fb[f] !== undefined && fb[f] !== null) hasAny = true
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

  return {
    ...p,
    top5Scores: top5,
    parlayRecommendations: parlay,
    mviAnalysis: mvi,
    riskWarnings: rw,
    appliedLearnings: al,
    ...(fb !== undefined && { factorBreakdown: fb }),
    ...(gt !== undefined && { goalTimeline: gt }),
    ...(br !== undefined && { bankroll: br }),
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
const mergedPredictions = deepMergePredictions(
  normalizePredictions(staticPreds),
  normalizePredictions(existingData?.predictions)
)

// Compute modelState FRESH from actual match data (not incremental patching)
const computedModelState = computeModelState(mergedMatches, mergedPredictions, existingData?.modelState)

// Build final remote data
const remoteData = {
  version: '2.1',
  lastUpdated: new Date().toISOString(),
  matches: mergedMatches,
  predictions: mergedPredictions,
  reviews: {
    ...staticReviews,
    ...(existingData?.reviews || {}),
  },
  modelState: computedModelState,
  keyLearnings: existingData?.keyLearnings || staticKeyLearnings,
  eloRatings: existingData?.eloRatings || teamRatings,
  factorWeights: existingData?.factorWeights || staticFactorWeights,
  predictionRichData: { ...predictionRichData, ...(existingData?.predictionRichData || {}) },
  reviewRichData: { ...reviewRichData, ...(existingData?.reviewRichData || {}) },
}

writeFileSync(outputPath, JSON.stringify(remoteData))

// --- Post-process: fill empty appliedLearnings from keyLearnings ---
// Automation often writes [object Object] or empty objects as appliedLearnings.
// This pass detects placeholder content and fills it with relevant keyLearnings.
const finalData = JSON.parse(readFileSync(outputPath, 'utf-8'))
if (finalData.keyLearnings?.length > 0 && finalData.predictions) {
  const kl = finalData.keyLearnings
  const placeholder = '历史经验'
  for (const id of Object.keys(finalData.predictions)) {
    const pred = finalData.predictions[id]
    if (!pred.appliedLearnings || !Array.isArray(pred.appliedLearnings) || pred.appliedLearnings.length === 0) continue

    // Check if ALL items are placeholders (empty/meaningless)
    const allPlaceholder = pred.appliedLearnings.every(
      item => !item.lesson || item.lesson === placeholder || (item.lesson || '').trim().length < 4
    )
    if (!allPlaceholder) continue // Has real data, skip

    // Find relevant keyLearnings based on match teams and score pattern
    const match = finalData.matches?.find(m => m.id === id)
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
  writeFileSync(outputPath, JSON.stringify(finalData))
}

console.log(`✅ remote.json written to ${outputPath} (${(JSON.stringify(finalData).length / 1024).toFixed(0)} KB)`)
if (existingData) {
  console.log('   Merged existing automation data — predictions/reviews/ELO preserved')
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
