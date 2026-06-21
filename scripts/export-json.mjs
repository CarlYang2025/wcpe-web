/**
 * Export all data to src/data/remote.json (replaces JSONBlob)
 * Run: node --import tsx scripts/export-json.mjs
 */
import { matches, predictions, postMatchReviews, modelState, keyLearnings, teamRatings, predictionRichData, reviewRichData } from '../src/data/matches.ts'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ELO weight factors with learning support
const factorWeights = {
  eloDiff: 0.35,
  recentForm: 0.12,
  h2h: 0.21,
  marketConsensus: 0.29,
  tacticalMatchup: 0.03,
}

const remoteData = {
  version: '2.0',
  lastUpdated: new Date().toISOString(),
  matches,
  predictions,
  reviews: postMatchReviews,
  modelState,
  keyLearnings,
  eloRatings: teamRatings,
  factorWeights,
  predictionRichData,
  reviewRichData,
}

const outputPath = resolve(__dirname, '../src/data/remote.json')
writeFileSync(outputPath, JSON.stringify(remoteData))
console.log(`✅ remote.json written to ${outputPath} (${(JSON.stringify(remoteData).length / 1024).toFixed(0)} KB)`)
