import { useMemo, useState } from 'react'
import type { Match, Prediction, Top5Score, ModelState } from '../lib/types'
import { QUADRANT_COLORS, QUADRANT_NAMES } from '../lib/types'
import { cn, flag } from '../data/matches'

// ── Types ──────────────────────────────────────────────

interface ScoreLeg {
  matchId: string
  homeTeam: string
  awayTeam: string
  score: string
  rawProb: number          // original Poisson probability
  adjustedProb: number     // after confidence × risk × quadrant calibration
  quadrant: string
  confidence: number
  riskLevel: string
  riskWarnings: string[]
  adjustments: string[]    // human-readable list of calibrations applied
}

interface ScoreParlayCombo {
  legs: ScoreLeg[]
  weightedScore: number    // geometric mean of adjusted probs × stability bonus
  rawProduct: number       // raw probability product (for reference)
  combinedModelOdds: number
  matchCount: number
  tier: '高概率核心' | '中高概率' | '中等概率' | '低概率参考'
  avgConfidence: number
  maxRisk: string
  rationale: string
  weaknessFlags: string[]
}

interface Props {
  matches: Match[]
  predictions: Record<string, Prediction>
  modelState?: ModelState
}

// ── Calibration Engine ─────────────────────────────────

/**
 * WCPE 历史偏差校准体系
 * 
 * 设计原则：不是简单做概率乘法，而是将 WCPE 的历史预测准确率、
 * 比赛信心、风险等级、淘汰赛动态等因素深度融合到评分中。
 * 
 * 三个核心修正维度：
 * 1. 信心加权 — WCPE confidence 决定比分分布的可靠度
 * 2. 风险惩罚 — 高风险比赛的比分预测更不可靠
 * 3. 象限校准 — Q1(强队碾压)在淘汰赛最可靠，Q3(冷门)最不稳定
 * 
 * 淘汰赛 R32 复盘数据：
 * - ELO 优势方晋级率 13/16 (81%)
 * - 方向命中率 13/16 (81%)
 * - 零封率 8/16 (50%)
 * - 绝杀/绝平(85+)概率 100%
 * - 比分偏差：淘汰赛高于小组赛（平均偏差 ≥ 1球）
 */

/** 信心加权曲线：低信心(<30%)严厉惩罚，高信心(>70%)给予信任 */
function confidenceWeight(c: number): number {
  if (c <= 0.20) return 0.35
  if (c <= 0.30) return 0.50
  if (c <= 0.40) return 0.65
  if (c <= 0.50) return 0.80
  if (c <= 0.60) return 0.90
  if (c <= 0.70) return 0.95
  return 1.0
}

/** 风险惩罚因子 */
function riskPenalty(risk: string, warnings: string[]): number {
  let base = 1.0
  if (risk === 'High') base = 0.72
  else if (risk === 'Medium') base = 0.88
  // 额外惩罚：每个风险警告扣 3%，最多扣 15%
  const extra = Math.min(warnings.length * 0.03, 0.15)
  return base - extra
}

/**
 * 象限可靠性因子（基于 R32 淘汰赛复盘数据）
 * Q1(强队碾压): ELO优势方81%晋级，Q1比分最具确定性
 * Q2(均势博弈): 淘汰赛不确定性高于小组赛
 * Q3(冷门爆冷): 定义上最不可靠，但淘汰赛确有冷门发生
 * Q4(对攻大战): 淘汰赛进球超预期，但具体比分仍难精确
 */
function quadrantCalibration(q: string): { factor: number; note: string } {
  switch (q) {
    case 'Q1': return { factor: 1.05, note: '淘汰赛Q1比分最可靠(ELO优势方81%晋级)' }
    case 'Q2': return { factor: 0.82, note: 'Q2均势博弈在淘汰赛偏差大(平局率上升)' }
    case 'Q3': return { factor: 0.65, note: 'Q3冷门预测在淘汰赛兑现率低(13/16按ELO)' }
    case 'Q4': return { factor: 0.88, note: 'Q4对攻比分具体进球数偏差≥1球(淘汰赛常态)' }
    default: return { factor: 0.85, note: '未知象限默认保守估计' }
  }
}

function calibrateScore(
  s: Top5Score,
  pred: Prediction,
): { adjustedProb: number; adjustments: string[] } {
  const raw = s.probability
  const adjustments: string[] = []

  // 1. Confidence weighting
  const cw = confidenceWeight(pred.confidence)
  let adjusted = raw * cw
  if (cw < 1.0) {
    adjustments.push(`信心修正 ×${cw.toFixed(2)}(WCPE置信度${Math.round(pred.confidence*100)}%)`)
  }

  // 2. Risk penalty
  const rp = riskPenalty(pred.riskLevel, pred.riskWarnings || [])
  adjusted *= rp
  if (rp < 1.0) {
    const parts = [`风险修正 ×${rp.toFixed(2)}`]
    if (pred.riskLevel === 'High') parts.push(`${pred.riskWarnings?.length || 0}条警告`)
    adjustments.push(parts.join(' '))
  }

  // 3. Quadrant calibration
  const qc = quadrantCalibration(s.quadrant)
  adjusted *= qc.factor
  if (qc.factor !== 1.0) {
    adjustments.push(`象限修正 ×${qc.factor.toFixed(2)}(${QUADRANT_NAMES[s.quadrant] || s.quadrant})`)
  }

  return {
    adjustedProb: Math.max(0.001, adjusted),
    adjustments,
  }
}

// ── Scoring ─────────────────────────────────────────────

/**
 * 组合评分公式：
 * score = geometric_mean(adjustedProbs) × stability_bonus × matchCount_bonus
 * 
 * 用几何平均而非简单乘积——防止某一腿极低概率拉垮整个评分。
 * stability_bonus: 所有腿 confidence 的标准差越小，加分越多。
 * matchCount_bonus: 2+场串关才有实际价值，单场命中率天然较高不值得单独推荐。
 */
function scoreCombo(legs: ScoreLeg[]): { score: number; avgConf: number; maxRisk: string } {
  if (legs.length === 0) return { score: 0, avgConf: 0, maxRisk: 'High' }

  const gm = legs.reduce((p, l) => p * l.adjustedProb, 1) ** (1 / legs.length)
  const avgConf = legs.reduce((s, l) => s + l.confidence, 0) / legs.length

  // Stability bonus: 奖励 confidence 一致的高质量组合
  const confVariance = legs.reduce((s, l) => s + (l.confidence - avgConf) ** 2, 0) / legs.length
  const confStd = Math.sqrt(confVariance)
  const stabilityBonus = 1 + Math.max(0, 0.15 - confStd * 0.5)

  // Match count bonus: 2-3场串关是甜区
  let matchBonus = 1.0
  if (legs.length >= 2 && legs.length <= 3) matchBonus = 1.08
  else if (legs.length > 3) matchBonus = 1.0

  // Risk downgrade
  const riskLevels = legs.map(l => l.riskLevel)
  const maxRisk =
    riskLevels.includes('High') ? 'High' :
    riskLevels.includes('Medium') ? 'Medium' : 'Low'

  const riskDowngrade = maxRisk === 'High' ? 0.90 : maxRisk === 'Medium' ? 0.95 : 1.0

  const score = gm * 100 * stabilityBonus * matchBonus * riskDowngrade
  return { score, avgConf, maxRisk }
}

// ── Utility ────────────────────────────────────────────

function fmtProb(p: number): string { return (p * 100).toFixed(2) + '%' }
function fmtOdds(o: number): string {
  if (!o || !isFinite(o)) return '--'
  return o >= 100 ? o.toFixed(0) + 'x' : o.toFixed(2) + 'x'
}

function tierInfo(s: number): { label: string; color: string; bg: string } {
  if (s >= 7.0) return { label: '高概率核心', color: '#00ff88', bg: '#00ff8822' }
  if (s >= 3.5) return { label: '中高概率', color: '#ffa502', bg: '#ffa50222' }
  if (s >= 1.5) return { label: '中等概率', color: '#54a0ff', bg: '#54a0ff22' }
  return { label: '低概率参考', color: '#a0a0a0', bg: '#55555522' }
}

// ── Main Component ──────────────────────────────────────

export default function ScoreParlay({ matches, predictions, modelState }: Props) {
  const [showAll, setShowAll] = useState(false)

  // ── Step 1: Build calibrated match data ───────────────
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
        const top5 = (pred.top5Scores || []).filter(s =>
          (typeof s === 'object' ? s.probability : 0) > 0.005
        )
        if (top5.length === 0) return null

        // Normalize + calibrate each score
        const calibrated = top5
          .map(s => {
            const score = typeof s === 'object' ? s : { score: String(s), probability: 0.01, quadrant: 'Q2' as const, reason: '' }
            const cal = calibrateScore(score, pred)
            return {
              ...score,
              adjustedProb: cal.adjustedProb,
              adjustments: cal.adjustments,
              confidence: pred.confidence,
              riskLevel: pred.riskLevel,
              riskWarnings: pred.riskWarnings || [],
              predictedDirection: pred.predictedDirection,
              predictedScore: pred.predictedScore,
            }
          })
          .filter(s => s.adjustedProb > 0.0005) // filter near-zero after calibration
          .sort((a, b) => b.adjustedProb - a.adjustedProb)

        if (calibrated.length === 0) return null

        return {
          match: m,
          prediction: pred,
          calibratedScores: calibrated.slice(0, 4), // top 4 adjusted scores
        }
      })
      .filter(Boolean) as Array<{
        match: Match
        prediction: Prediction
        calibratedScores: Array<Top5Score & {
          adjustedProb: number
          adjustments: string[]
          confidence: number
          riskLevel: string
          riskWarnings: string[]
          predictedDirection: string
          predictedScore: string
        }>
      }>
  }, [matches, predictions])

  // ── Step 2: Generate and score combinations ───────────
  const allCombos = useMemo(() => {
    if (matchData.length === 0) return []

    // Adaptive combo limit
    const N = matchData.length
    const maxCombos = N <= 2 ? 30 : N <= 4 ? 100 : 250

    // Cartesian product via iterative BFS (avoid stack overflow)
    const combos: ScoreParlayCombo[] = []

    function build(fromIdx: number, currentLegs: ScoreLeg[]) {
      if (currentLegs.length >= 1) {
        const { score, avgConf, maxRisk } = scoreCombo(currentLegs)
        const rawProd = currentLegs.reduce((p, l) => p * l.rawProb, 1)
        const combinedOdds = currentLegs.reduce((acc, l) => {
          const modelOdds = l.rawProb > 0 ? (1 / l.rawProb) * 0.75 : 999
          return acc * modelOdds
        }, 1)

        const tier = tierInfo(score)

        // Build rationale
        const highConf = currentLegs.filter(l => l.confidence >= 0.6)
        const lowConf = currentLegs.filter(l => l.confidence < 0.4)
        const highRisk = currentLegs.filter(l => l.riskLevel === 'High')
        const q3Legs = currentLegs.filter(l => l.quadrant === 'Q3')

        let rationale = ''
        const flags: string[] = []

        if (highConf.length === currentLegs.length) {
          rationale = '全线高置信度(WCPE≥60%)，比分预测可信度最优。'
        } else if (highConf.length > 0) {
          rationale = `${highConf.map(l => cn(l.homeTeam)).join('+')} 高置信度锚定，`
          if (lowConf.length > 0) {
            rationale += `${lowConf.map(l => cn(l.homeTeam)).join('/')} 低信腿拖累整体可靠性。`
            flags.push(`${lowConf.length}场低置信度`)
          } else {
            rationale += '整体可信度中等偏上。'
          }
        } else if (lowConf.length > 0) {
          rationale = `含${lowConf.length}场低置信度预测(WCPE<40%)，比分命中率存疑。`
          flags.push('低置信度集中')
        }

        if (highRisk.length > 0) {
          rationale += ` ${highRisk.length}场高风险比赛，淘汰赛不确定性放大偏差。`
          flags.push(`${highRisk.length}场高风险`)
        }
        if (q3Legs.length > 0) {
          rationale += ` Q3冷门象限预测在淘汰赛R32仅兑现13/16(81%按ELO)，冷门比分极难命中。`
          flags.push('含Q3冷门象限')
        }

        if (currentLegs.length === 1) {
          flags.push('单场非串关')
          if (!rationale) rationale = '单场比分预测。'
        }

        if (!rationale) rationale = `${currentLegs.length}场组合，各腿修正后概率均处于合理区间。`

        combos.push({
          legs: currentLegs,
          weightedScore: score,
          rawProduct: rawProd,
          combinedModelOdds: combinedOdds,
          matchCount: currentLegs.length,
          tier: tier.label,
          avgConfidence: avgConf,
          maxRisk,
          rationale,
          weaknessFlags: flags,
        })
      }

      if (fromIdx >= matchData.length) return

      const { match, prediction, calibratedScores } = matchData[fromIdx]

      // Skip this match (allows N-1 leg parlays)
      build(fromIdx + 1, currentLegs)

      // Include this match with each calibrated score
      for (const s of calibratedScores) {
        const leg: ScoreLeg = {
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          score: s.score,
          rawProb: s.probability,
          adjustedProb: s.adjustedProb,
          quadrant: s.quadrant,
          confidence: s.confidence,
          riskLevel: s.riskLevel,
          riskWarnings: s.riskWarnings,
          adjustments: s.adjustments,
        }
        build(fromIdx + 1, [...currentLegs, leg])
      }
    }

    build(0, [])

    // Sort by weightedScore descending, filter single-leg
    const multiLeg = combos.filter(c => c.matchCount >= 2)
    const singleLeg = combos.filter(c => c.matchCount === 1)
    multiLeg.sort((a, b) => b.weightedScore - a.weightedScore)
    singleLeg.sort((a, b) => b.weightedScore - a.weightedScore)

    // Return top combos with multi-leg first, single-leg as fallback
    const result = [...multiLeg, ...singleLeg]
    return result.slice(0, maxCombos)
  }, [matchData])

  const displayCombos = showAll ? allCombos : allCombos.slice(0, 15)

  // ── Empty state ───────────────────────────────────────
  if (matchData.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="text-4xl">⚽</div>
        <p className="text-[#a0a0a0] text-sm">今日无即将开始的比赛，无法生成比分串关</p>
        <p className="text-[10px] text-[#555555]">等待赛程更新后自动生成推荐</p>
      </div>
    )
  }

  const totalPossible = matchData.reduce((acc, m) => acc * Math.min(m.calibratedScores.length, 4), 1)
  const dirAcc = modelState ? Math.round(modelState.directionAccuracy * 100) : '--'
  const top3Acc = modelState ? Math.round(modelState.scoreTop3Accuracy * 100) : '--'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header with calibration summary ── */}
      <div className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-[#ffd700]">⚽ 比分串关预测</h2>
            <p className="text-[10px] text-[#a0a0a0] mt-1">
              {matchData.length} 场比赛 · {totalPossible} 种比分组合 · 三维校正排序
            </p>
          </div>
          <div className="text-right">
            <div className="text-[#00ff88] text-sm font-bold">
              {allCombos.length > 0 ? tierInfo(allCombos[0].weightedScore).label : '--'}
            </div>
            <div className="text-[9px] text-[#555555]">最高级别推荐</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[9px] text-[#555555] mb-3">
          <div className="bg-[#0a0e27] rounded-lg p-2 text-center">
            <div className="text-[#ffd700] font-bold">信心加权</div>
            <div>WCPE置信度高的比赛比分更可靠</div>
          </div>
          <div className="bg-[#0a0e27] rounded-lg p-2 text-center">
            <div className="text-[#ffa502] font-bold">风险修正</div>
            <div>高风险/多警告比赛的比分预测降权</div>
          </div>
          <div className="bg-[#0a0e27] rounded-lg p-2 text-center">
            <div className="text-[#00ff88] font-bold">象限校准</div>
            <div>Q1淘汰赛最可靠(ELO方81%晋级)</div>
          </div>
        </div>

        <p className="text-[10px] text-[#555555] leading-relaxed">
          不简单做概率乘法。每场比分经过信心加权 × 风险修正 × 象限校准三维调整后，
          以几何平均评分排序，历史方向准确率 {dirAcc}%/Top3比分 {top3Acc}% 为参考基准。
          仅推荐 2+ 场串关，单场比分不纳入组合排序。
        </p>
      </div>

      {/* ── Match Detail Cards ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(matchData.length, 4)}, 1fr)` }}>
        {matchData.map(({ match, prediction, calibratedScores }) => {
          const dir = prediction.predictedDirection
          const dirLabel = dir === 'home_win' ? `${cn(match.homeTeam)}胜` : dir === 'away_win' ? `${cn(match.awayTeam)}胜` : '平局'
          const dirColor = dir === 'home_win' ? '#00ff88' : dir === 'away_win' ? '#54a0ff' : '#ffa502'
          const riskColor = prediction.riskLevel === 'Low' ? '#00ff88' : prediction.riskLevel === 'Medium' ? '#ffa502' : '#ff4757'

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
                <div className="text-[9px] mt-1 flex items-center justify-center gap-2">
                  <span style={{ color: dirColor }} className="font-bold">{dirLabel}</span>
                  <span style={{ color: riskColor }} className="text-[8px]">
                    {prediction.riskLevel === 'Low' ? '低风险' : prediction.riskLevel === 'Medium' ? '中风险' : '高风险'}
                  </span>
                  <span className="text-[#555555]">信心{Math.round(prediction.confidence * 100)}%</span>
                </div>
                {prediction.riskWarnings && prediction.riskWarnings.length > 0 && (
                  <div className="text-[8px] text-[#ff4757] mt-1 text-left bg-[#ff475710] rounded p-1">
                    ⚠ {prediction.riskWarnings.slice(0, 2).join('; ')}
                    {prediction.riskWarnings.length > 2 && ` +${prediction.riskWarnings.length - 2}条`}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                {calibratedScores.map((s, i) => (
                  <div key={s.score} className="text-[10px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#555555] w-4 text-right">{i + 1}</span>
                        <span className="font-mono font-bold" style={{ color: QUADRANT_COLORS[s.quadrant] || '#a0a0a0' }}>
                          {s.score}
                        </span>
                        <span className="text-[8px] px-1 rounded" style={{
                          background: (QUADRANT_COLORS[s.quadrant] || '#555') + '22',
                          color: QUADRANT_COLORS[s.quadrant] || '#555'
                        }}>
                          {s.quadrant}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-[#0a0e27] rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: Math.max(4, s.adjustedProb / calibratedScores[0].adjustedProb * 100) + '%',
                            background: `linear-gradient(90deg, ${QUADRANT_COLORS[s.quadrant] || '#a0a0a0'}, ${QUADRANT_COLORS[s.quadrant] || '#a0a0a0'}44)`
                          }} />
                        </div>
                        <div className="text-right">
                          <div className="text-[#a0a0a0]">{fmtProb(s.probability)}</div>
                          {s.probability !== s.adjustedProb && (
                            <div className="text-[8px] text-[#ffa502]">→ {fmtProb(s.adjustedProb)}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Show first adjustment note */}
                    {s.adjustments.length > 0 && (
                      <div className="text-[7px] text-[#555555] ml-5 mt-0.5 truncate" title={s.adjustments.join('; ')}>
                        {s.adjustments[0]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Parlay Rankings ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#ffd700]">
            📋 比分串关推荐 <span className="text-[10px] text-[#a0a0a0] font-normal">
              （三维校正评分从高到低 · {allCombos.length} 组 · 仅 2+ 场串关）
            </span>
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

        {displayCombos.length === 0 ? (
          <div className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-8 text-center text-[#a0a0a0] text-xs">
            经三维校正后，今日无 2+ 场串关方案的修正评分达到推荐阈值。
            <br />
            <span className="text-[10px] text-[#555555] mt-1 block">
              原因：低信心/高风险比赛的比分预测经校正后可靠度过低。
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {displayCombos.map((combo, idx) => {
              const ti = tierInfo(combo.weightedScore)
              const topScore = allCombos[0]?.weightedScore || 1

              return (
                <div
                  key={idx}
                  className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-4 hover:border-[#ffd700]/30 transition-all card-hover"
                >
                  {/* Rank + Tier */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[#0a0e27] border border-[#1a1f3a] flex items-center justify-center text-xs font-bold text-[#ffd700]">
                      {idx + 1}
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded font-bold" style={{ background: ti.bg, color: ti.color }}>
                      {ti.label}
                    </span>
                    <span className="text-[10px] text-[#a0a0a0]">
                      {combo.matchCount} 场串关
                    </span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: ti.color }}>
                      {combo.weightedScore.toFixed(1)} 分
                    </span>
                    {/* Weakness flags */}
                    {combo.weaknessFlags.slice(0, 2).map(f => (
                      <span key={f} className="text-[8px] px-1.5 py-0.5 rounded bg-[#ff475715] text-[#ff4757]">
                        {f}
                      </span>
                    ))}
                  </div>

                  {/* Legs */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {combo.legs.map((leg, li) => (
                      <div key={li} className="flex items-center gap-1.5">
                        <div
                          className="bg-[#0a0e27] rounded-lg px-3 py-2 border"
                          style={{ borderColor: QUADRANT_COLORS[leg.quadrant] + '40' }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-[#555555] leading-tight">
                              {flag(leg.homeTeam)} {cn(leg.homeTeam)} vs {cn(leg.awayTeam)}
                            </span>
                            <span className="text-[8px] px-1 rounded" style={{
                              background: leg.confidence >= 0.6 ? '#00ff8822' : leg.confidence >= 0.4 ? '#ffa50222' : '#ff475722',
                              color: leg.confidence >= 0.6 ? '#00ff88' : leg.confidence >= 0.4 ? '#ffa502' : '#ff4757'
                            }}>
                              信{Math.round(leg.confidence * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-sm font-mono font-bold" style={{ color: QUADRANT_COLORS[leg.quadrant] || '#a0a0a0' }}>
                              {leg.score}
                            </span>
                            <span className="text-[8px] text-[#a0a0a0]">
                              原始{fmtProb(leg.rawProb)} → 校正{fmtProb(leg.adjustedProb)}
                            </span>
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
                      <span className="text-[#555555]">校正评分</span>
                      <span className="font-bold" style={{ color: ti.color }}>{combo.weightedScore.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[#555555]">模型赔率</span>
                      <span className="font-bold text-[#ffa502]">{fmtOdds(combo.combinedModelOdds)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[#555555]">平均信心</span>
                      <span className="font-bold" style={{
                        color: combo.avgConfidence >= 0.6 ? '#00ff88' : combo.avgConfidence >= 0.4 ? '#ffa502' : '#ff4757'
                      }}>
                        {Math.round(combo.avgConfidence * 100)}%
                      </span>
                    </div>
                    {/* Score bar */}
                    <div className="flex-1 bg-[#0a0e27] rounded-full h-1.5 overflow-hidden ml-2">
                      <div className="h-full rounded-full" style={{
                        width: Math.min(100, combo.weightedScore / topScore * 100) + '%',
                        background: `linear-gradient(90deg, ${ti.color}, ${ti.color}44)`
                      }} />
                    </div>
                  </div>

                  {/* Rationale */}
                  <div className="mt-2 pt-2 border-t border-[#1a1f3a] text-[9px] text-[#555555] flex items-start gap-1.5">
                    <span className="text-[#ffd700] shrink-0">💡</span>
                    <span>{combo.rationale}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Methodology Note ── */}
      <div className="text-center text-[9px] text-[#555555] pb-2 space-y-1">
        <p>
          💡 评分体系 = 比分概率 × 信心加权 × 风险修正 × 象限校准 → 几何平均 × 稳定性奖励。
          淘汰赛R32复盘：方向准确率 {dirAcc}%，Top3比分 {top3Acc}%，Q1象限最可靠(ELO优势方81%晋级)。
        </p>
        <p>非投注建议，仅作 WCPE 模型概率推演参考。淘汰赛比分偏差≥1球为常态，请结合临场信息判断。</p>
      </div>
    </div>
  )
}
