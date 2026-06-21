/**
 * Create a new JSONBlob with all current data from matches.ts
 */
import { matches, predictions, postMatchReviews, modelState, keyLearnings, teamRatings, predictionRichData, reviewRichData } from '../src/data/matches.ts'

// ELO weight factors (fixed)
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

const url = 'https://jsonblob.com/api/jsonBlob'
console.log('Creating new JSONBlob...')
const resp = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  body: JSON.stringify(remoteData),
})

if (!resp.ok) {
  console.error('Failed to create blob:', resp.status, resp.statusText)
  const text = await resp.text()
  console.error('Response:', text.substring(0, 500))
  process.exit(1)
}

const text = await resp.text()
console.log('Raw response:', text)

// The response URL contains the blob ID
const location = resp.headers.get('location')
console.log('Location header:', location)

// Extract blob ID from response
try {
  const json = JSON.parse(text)
  console.log('JSON response:', JSON.stringify(json, null, 2))
} catch {
  console.log('Could not parse JSON from body')
}

// Print the full response for debugging
console.log('\n=== BLOB CREATED ===')
console.log('Full URL from Location:', location)
if (location) {
  const id = location.split('/').pop()
  console.log('BLOB ID:', id)
}
