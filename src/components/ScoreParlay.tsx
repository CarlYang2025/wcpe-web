import { useMemo, useState } from 'react'
import type { Match, Prediction, Top5Score } from '../lib/types'
import { QUADRANT_COLORS } from '../lib/types'
import { cn, flag } from '../data/matches'

// ── Types ──────────────────────────────────────────────

interface ScoreLeg {
  matchId: string
  homeTeam: string
  awayTeam: string
  score: string
  prob: number
  quadrant: string
  reason: string
}

interface ScoreParlayCombo {
  legs: ScoreLeg[]
  totalProb: number
  combinedModelOdds: number
  matchCount: number
  tier: '高概率核心' | '中高概率' | '中等概率'
}

interface Props {
  matches: Match[]
  predictions: Record<string, Prediction>
}

// ── Utility ────────────────────────────────────────────

const SCORE_MARGIN = 0.75
const _d = (n: number) => (n > 0 && Number.isFinite(n) ? 1 / n : 0)

function scoreModelOdds(prob: number): number {
  if (prob <= 0) return 0
  return _d(prob) * SCORE_MARGIN
}

function fmtProb(p: number): string {
  return (p * 100).toFixed(2) + '%'
}

function fmtOdds(o: number): string {
  return o.toFixed(2) + 'x'
}

// ── Cartesian Generator ─────────────────────────────────

/** Depth-first cartesian product with probability pruning */
function generateCombos(
  matchData: Array<{ match: Match; scores: Top5Score[] }>,
  maxCombos: number,
): ScoreParlayCombo[] {
  const result: ScoreParlayCombo[] = []

  function dfs(index: number, currentLegs: ScoreLeg[], currentProb: number) {
    // Prune: if already have enough and this branch won't beat the threshold
    if (result.length >= maxCombos) {
      // Check if this branch can possibly enter top maxCombos
      const threshold = result[result.length - 1].totalProb
      if (currentProb * Math.pow(0.2, matchData.length - index) < threshold) return
    }

    if (index >= matchData.length) {
      if (currentLegs.length >= 1) {
        const combo: ScoreParlayCombo = {
          legs: [...currentLegs],
          totalProb: currentProb,
          combinedModelOdds: currentLegs.reduce((acc, l) => acc * scoreModelOdds(l.prob), 1),
          matchCount: currentLegs.length,
          tier: currentProb >= 0.12 ? '高概率核心' : currentProb >= 0.05 ? '中高概率' : '中等概率',
        }
        // Insert sorted by probability descending
        let insertAt = result.findIndex(c => c.totalProb < combo.totalProb)
        if (insertAt === -1) insertAt = result.length
        result.splice(insertAt, 0, combo)
        if (result.length > maxCombos) result.pop()
      }
      return
    }

    const { match, scores } = matchData[index]

    // Skip match (allows 2-match combos from 4+ match days)
    dfs(index + 1, currentLegs, currentProb)

    // Try each score
    for (const s of scores) {
      if (s.probability <= 0) continue
      dfs(index + 1, [
        ...currentLegs,
        {
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          score: s.score,
          prob: s.probability,
          quadrant: s.quadrant,
          reason: s.reason,
        },
      ], currentProb * s.probability)
    }
  }

  dfs(0, [], 1)
  return result
}

// ── Main Component ──────────────────────────────────────

export default function ScoreParlay({ matches, predictions }: Props) {
  const [showAll, setShowAll] = useState(false)

  // Filter today's upcoming matches with valid score predictions
  const matchData = useMemo(() => {
    const todayDate = [...new Set(matches.map(m => m.date))].sort().find(d =>
      matches.some(m => m.date === d && m.status !== 'finished')
    )
    if (!todayDate) return []

    return matches
      .filter(m => m.date === todayDate && m.status !== 'finished')
      .map(m => {
        const pred = predictions[m.id]
        if (!pred) return null
        const scores = (pred.top5Scores || []).filter(s => {
          const prob = typeof s === 'object' ? s.probability : 0
          return prob > 0.005 // exclude near-zero prob scores
        })
        if (scores.length === 0) return null
        // Take top 4 scores per match to keep combinatorics manageable
        const topScores = scores
          .map(s => (typeof s === 'object' ? s : { score: String(s), probability: 0.01, quadrant: 'Q2', reason: '' }))
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 4) as Top5Score[]

        return { match: m, scores: topScores }
      })
      .filter(Boolean) as Array<{ match: Match; scores: Top5Score[] }>
  }, [matches, predictions])

  // Generate all combos
  const allCombos = useMemo(() => {
    if (matchData.length === 0) return []
    const N = matchData.length

    // Adaptive max combos based on match count
    const maxCombos = N <= 2 ? 25 : N <= 4 ? 80 : 200
    return generateCombos(matchData, maxCombos)
  }, [matchData])

  const displayCombos = showAll ? allCombos : allCombos.slice(0, 15)

  if (matchData.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="text-4xl">⚽</div>
        <p className="text-[#a0a0a0] text-sm">今日无即将开始的比赛，无法生成比分串关</p>
        <p className="text-[10px] text-[#555555]">等待赛程更新后自动生成推荐</p>
      </div>
    )
  }

  // Compute combinatorics summary
  const totalPossible = matchData.reduce((acc, m) => acc * m.scores.length, 1)
  const topThreshold = allCombos.length > 0 ? allCombos[0].totalProb : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-[#ffd700]">🎯 比分串关预测</h2>
            <p className="text-[10px] text-[#a0a0a0] mt-1">
              {matchData.length} 场比赛 · {totalPossible} 种组合 · 按综合概率从高到低排序
            </p>
          </div>
          <div className="text-right">
            <div className="text-[#00ff88] text-lg font-bold">{fmtProb(topThreshold)}</div>
            <div className="text-[9px] text-[#555555]">最高命中概率</div>
          </div>
        </div>
        <p className="text-[10px] text-[#555555] leading-relaxed">
          从每场比赛的 TOP 比分中穷举所有合理组合，以综合命中概率为核心排序。
          优先推荐高概率方案，追求最大成功率而非盲目追求高赔率。
        </p>
      </div>

      {/* ── Match Score Breakdown ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(matchData.length, 4)}, 1fr)` }}>
        {matchData.map(({ match, scores }) => {
          const pred = predictions[match.id]
          const dir = pred?.predictedDirection
          const dirLabel = dir === 'home_win' ? `${cn(match.homeTeam)}胜` : dir === 'away_win' ? `${cn(match.awayTeam)}胜` : '平局'
          const dirColor = dir === 'home_win' ? '#00ff88' : dir === 'away_win' ? '#54a0ff' : '#ffa502'

          return (
            <div key={match.id} className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-4">
              <div className="text-center mb-3">
                <div className="text-xs font-bold">
                  <span className="text-[#a0a0a0]">{flag(match.homeTeam)}</span>
                  <span className="mx-1">{cn(match.homeTeam)}</span>
                  <span className="text-[#555555] text-[10px]">vs</span>
                  <span className="mx-1">{cn(match.awayTeam)}</span>
                  <span className="text-[#a0a0a0]">{flag(match.awayTeam)}</span>
                </div>
                <div className="text-[9px] mt-1">
                  <span style={{ color: dirColor }} className="font-bold">{dirLabel}</span>
                  <span className="text-[#555555] ml-2">{match.kickoff}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                {scores.map((s, i) => (
                  <div key={s.score} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#555555] w-4 text-right">{i + 1}</span>
                      <span className="font-mono font-bold" style={{ color: QUADRANT_COLORS[s.quadrant] || '#a0a0a0' }}>
                        {s.score}
                      </span>
                      <span className="text-[8px] px-1 rounded" style={{ background: (QUADRANT_COLORS[s.quadrant] || '#555') + '22', color: QUADRANT_COLORS[s.quadrant] || '#555' }}>
                        {s.quadrant}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-[#0a0e27] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: Math.max(4, s.probability * 400) + '%',
                            background: `linear-gradient(90deg, ${QUADRANT_COLORS[s.quadrant] || '#a0a0a0'}, ${QUADRANT_COLORS[s.quadrant] || '#a0a0a0'}88)`
                          }}
                        />
                      </div>
                      <span className="text-[#a0a0a0] w-10 text-right">{fmtProb(s.probability)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Top Parlay Combinations ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#ffd700]">
            📋 比分串关推荐 <span className="text-[10px] text-[#a0a0a0] font-normal">（综合概率从高到低）</span>
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-[#555555]">
            <span>显示 {displayCombos.length}/{allCombos.length} 组</span>
            {allCombos.length > 15 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-[#54a0ff] hover:text-[#ffd700] transition-colors underline"
              >
                {showAll ? '收起' : '展开全部'}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {displayCombos.map((combo, idx) => {
            const tierColor = combo.tier === '高概率核心' ? '#00ff88' : combo.tier === '中高概率' ? '#ffa502' : '#54a0ff'
            const tierBg = combo.tier === '高概率核心' ? '#00ff8822' : combo.tier === '中高概率' ? '#ffa50222' : '#54a0ff22'

            return (
              <div
                key={idx}
                className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-4 hover:border-[#ffd700]/30 transition-all card-hover"
              >
                {/* Rank + Tier Badge */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-full bg-[#0a0e27] border border-[#1a1f3a] flex items-center justify-center text-xs font-bold text-[#ffd700]">
                    {idx + 1}
                  </div>
                  <span
                    className="text-[9px] px-2 py-0.5 rounded font-bold"
                    style={{ background: tierBg, color: tierColor }}
                  >
                    {combo.tier}
                  </span>
                  <span className="text-[10px] text-[#a0a0a0]">
                    {combo.matchCount} 场串关
                  </span>
                </div>

                {/* Legs */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {combo.legs.map((leg, li) => (
                    <div key={li} className="flex items-center gap-1.5">
                      <div
                        className="bg-[#0a0e27] rounded-lg px-3 py-2 border"
                        style={{ borderColor: QUADRANT_COLORS[leg.quadrant] + '40' }}
                      >
                        <div className="text-[9px] text-[#555555] leading-tight">
                          {flag(leg.homeTeam)} {cn(leg.homeTeam)} vs {cn(leg.awayTeam)} {flag(leg.awayTeam)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-sm font-mono font-bold" style={{ color: QUADRANT_COLORS[leg.quadrant] || '#a0a0a0' }}>
                            {leg.score}
                          </span>
                          <span className="text-[9px] text-[#a0a0a0]">({fmtProb(leg.prob)})</span>
                        </div>
                      </div>
                      {li < combo.legs.length - 1 && (
                        <span className="text-[#ffd700] text-xs font-bold">×</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className="text-[#555555]">综合概率</span>
                    <span className="font-bold" style={{ color: tierColor }}>{fmtProb(combo.totalProb)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[#555555]">模型赔率</span>
                    <span className="font-bold text-[#ffa502]">{fmtOdds(combo.combinedModelOdds)}</span>
                  </div>
                  {/* Probability bar */}
                  <div className="flex-1 bg-[#0a0e27] rounded-full h-1.5 overflow-hidden ml-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: Math.min(100, combo.totalProb / allCombos[0].totalProb * 100) + '%',
                        background: `linear-gradient(90deg, ${tierColor}, ${tierColor}44)`
                      }}
                    />
                  </div>
                </div>

                {/* Rationale for top 3 */}
                {idx < 3 && (
                  <div className="mt-2 pt-2 border-t border-[#1a1f3a] text-[9px] text-[#555555]">
                    {combo.matchCount === 1
                      ? `单场置信度最高的比分预测，${combo.legs[0].reason || 'WCPE模型TOP1比分'}`
                      : combo.tier === '高概率核心'
                        ? `各场Q1象限最优比分组合，${combo.legs.map(l => cn(l.homeTeam) + l.score).join(' + ')} 为今日命中确定性最高的比分串关方案`
                        : `跨象限混合组合，在保持${fmtProb(combo.totalProb)}命中率前提下平衡赔率空间`
                    }
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Methodology Note ── */}
      <div className="text-center text-[9px] text-[#555555] pb-2">
        💡 比分串关基于 WCPE Poisson 模型 + Bet365 赔率校准的比分概率分布生成，综合概率 = 各场比分概率的乘积。
        仅作概率推演参考，不构成投注建议。
      </div>
    </div>
  )
}
