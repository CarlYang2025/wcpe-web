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

  // 5. appliedLearnings: always string[]
  let al = p.appliedLearnings
  if (!Array.isArray(al)) {
    al = []
  } else {
    al = al.filter(l => l != null).map(l => String(l))
  }

  // 6. factorBreakdown: ensure object or undefined (never null/array)
  let fb = p.factorBreakdown
  if (fb === null || Array.isArray(fb)) {
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

// Start with hardcoded data as the base (always authoritative for match definitions)
const hardcodedData = {
  version: '2.1',
  lastUpdated: new Date().toISOString(),
  matches,
  predictions: normalizePredictions(staticPreds),
  reviews: staticReviews,
  modelState: staticModelState,
  keyLearnings: staticKeyLearnings,
  eloRatings: teamRatings,
  factorWeights: staticFactorWeights,
  predictionRichData,
  reviewRichData,
}

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

// Merge strategy: existing automation data takes priority over hardcoded
const remoteData = {
  ...hardcodedData,
  // Merge matches: hardcoded is base, existing adds/overrides scores
  matches: mergeMatches(hardcodedData.matches, existingData?.matches),
  // Merge predictions: hardcoded as base, existing overlays (deep per-prediction merge)
  predictions: deepMergePredictions(hardcodedData.predictions, normalizePredictions(existingData?.predictions)),
  // Merge reviews: existing automation reviews win
  reviews: {
    ...hardcodedData.reviews,
    ...(existingData?.reviews || {}),
  },
  // Automation-driven fields: always take from existing if present
  modelState: existingData?.modelState || hardcodedData.modelState,
  keyLearnings: existingData?.keyLearnings || hardcodedData.keyLearnings,
  eloRatings: existingData?.eloRatings || hardcodedData.eloRatings,
  factorWeights: existingData?.factorWeights || hardcodedData.factorWeights,
  // Rich data: existing wins (automation may add more)
  predictionRichData: { ...hardcodedData.predictionRichData, ...(existingData?.predictionRichData || {}) },
  reviewRichData: { ...hardcodedData.reviewRichData, ...(existingData?.reviewRichData || {}) },
}

writeFileSync(outputPath, JSON.stringify(remoteData))
console.log(`✅ remote.json written to ${outputPath} (${(JSON.stringify(remoteData).length / 1024).toFixed(0)} KB)`)
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
