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
 * Handles both 'matches' (new format) and 'selections' (old format) keys.
 * Also normalizes odds/probability field names.
 */
function normalizeParlayRecommendations(pr) {
  if (!Array.isArray(pr)) return pr
  return pr.map(p => ({
    type: p.type,
    selections: Array.isArray(p.selections) ? p.selections : (Array.isArray(p.matches) ? p.matches : (p.selections || p.matches || [])),
    odds: p.odds ?? p.estOdds ?? 0,
    probability: p.probability ?? p.hitProb ?? 0,
    risk: p.risk || 'Medium',
  }))
}

/**
 * Normalize predictions: ensure parlayRecommendations use 'selections' field
 */
function normalizePredictions(preds) {
  if (!preds || typeof preds !== 'object') return {}
  const result = {}
  for (const [id, p] of Object.entries(preds)) {
    result[id] = {
      ...p,
      parlayRecommendations: normalizeParlayRecommendations(p.parlayRecommendations || []),
    }
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
