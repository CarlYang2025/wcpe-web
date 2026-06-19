import { useState, useMemo } from 'react'
import type { Match, Prediction, PostMatchReview } from '../lib/types'
import { cn, flag, teamRatings } from '../data/matches'

// 赔率 = 1/模型预测概率 × 博彩边际（模拟真实盘口抽水）
const _d = (n: number) => +(1 / n).toFixed(2)
const MARGIN_DIR = 0.93   // 胜平负 ~7%
const MARGIN_OU = 0.93    // 大小球  ~7%
const MARGIN_SCORE = 0.75 // 比分    ~25%（比分盘抽水远超其他盘口）
const dirOdds = (p: Prediction) => +(p.predictedDirection === 'home_win' ? _d(p.homeWinProb) * MARGIN_DIR : p.predictedDirection === 'away_win' ? _d(p.awayWinProb) * MARGIN_DIR : _d(p.drawProb) * MARGIN_DIR).toFixed(2)
const ouOdds = (p: Prediction, over: boolean) => +(_d(over ? p.over25Prob : p.under25Prob) * MARGIN_OU).toFixed(2)
const scoreOdds = (p: Prediction, pos: number) => +(_d(p.top5Scores[pos].probability) * MARGIN_SCORE).toFixed(2)

interface Props {
  allMatches: Match[]
  remainingMatches: Match[]
  predictions: Record<string, Prediction>
  postMatchReviews: Record<string, PostMatchReview>
  onSelectMatch?: (match: Match) => void
}

export default function MatchdaySummary({ allMatches, remainingMatches, predictions, postMatchReviews, onSelectMatch }: Props) {
  const matches = allMatches
  const validMatches = matches.filter(m => predictions[m.id])
  const matchCount = validMatches.length

  if (matchCount === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <div className="text-4xl">📭</div>
        <p className="text-[#a0a0a0]">暂无预测数据</p>
      </div>
    )
  }

  const validRemaining = remainingMatches.filter(m => predictions[m.id])
  const remainingCount = validRemaining.length
  const finishedCount = matchCount - remainingCount
  const avgConf = Math.round(validMatches.reduce((s, m) => s + (predictions[m.id]?.confidence || 0), 0) / matchCount * 100)
  const highRiskCount = validMatches.filter(m => predictions[m.id]?.riskLevel === 'High').length
  const overallRisk = highRiskCount >= 2 ? 'High' : highRiskCount === 1 ? 'Medium' : 'Low'
  const riskLabel = overallRisk === 'High' ? '高风险比赛日' : overallRisk === 'Medium' ? '中等风险' : '低风险比赛日'
  const riskColor = overallRisk === 'High' ? '#ff4757' : overallRisk === 'Medium' ? '#ffa502' : '#00ff88'

  // Build parlay data per match
  const parlayData = validMatches.map(m => {
    const p = predictions[m.id]!
    const isHome = p.predictedDirection === 'home_win'
    const isAway = p.predictedDirection === 'away_win'
    const label = isHome ? `${cn(m.homeTeam)}胜` : isAway ? `${cn(m.awayTeam)}胜` : '平'
    const prob = isHome ? p.homeWinProb : isAway ? p.awayWinProb : p.drawProb
    const odds = dirOdds(p)
    return {
      match: `${cn(m.homeTeam)} vs ${cn(m.awayTeam)}`,
      direction: label, odds, prob,
      predictedScore: p.predictedScore,
      confidence: p.confidence,
    }
  })

  // Parlay tiers
  const parlays = [
    {
      type: '稳健', risk: 'Low' as const,
      selections: parlayData.filter(p => p.prob > 0.5 && p.confidence > 0.5).slice(0, 3),
      desc: '高概率方向（>50%）+ 高信心（>50%），2-3场串关',
    },
    {
      type: '平衡', risk: 'Medium' as const,
      selections: parlayData.sort((a, b) => b.prob - a.prob).slice(0, 3),
      desc: '按概率排序取前3场，兼顾命中与赔率回报',
    },
    {
      type: '激进', risk: 'High' as const,
      selections: parlayData.slice(0, Math.min(4, matchCount)),
      desc: '全部比赛方向串关，以高赔换取高回报弹性',
    },
  ]

  // Bankroll plans
  const bankrollPlans = [
    {
      name: '保守', color: '#00ff88',
      desc: '以胜平负为主，每场均注，少量串关对冲',
      alloc: [
        { label: '胜平负', pct: 60, amount: 60, detail: `${matchCount}场均注，各${Math.round(60/matchCount)}%` },
        { label: '大小球', pct: 25, amount: 25, detail: '选取最有把握的1-2场' },
        { label: '比分', pct: 10, amount: 10, detail: '只投主推比分，小额试探' },
        { label: '串关', pct: 5, amount: 5, detail: '仅2场稳健串关对冲' },
      ],
      expectedReturn: 8,
    },
    {
      name: '平衡', color: '#ffa502',
      desc: '胜平负与比分并重，串关提高收益弹性',
      alloc: [
        { label: '胜平负', pct: 40, amount: 40, detail: '按信心加权，非均注' },
        { label: '比分', pct: 25, amount: 25, detail: '每场覆盖TOP2比分' },
        { label: '串关', pct: 20, amount: 20, detail: '2-3场平衡串关' },
        { label: '大小球', pct: 15, amount: 15, detail: '选取1-2场' },
      ],
      expectedReturn: 18,
    },
    {
      name: '激进', color: '#ff4757',
      desc: '重仓串关和比分，高赔换取高弹性',
      alloc: [
        { label: '串关', pct: 35, amount: 35, detail: '3-4场串关为主力仓位' },
        { label: '比分', pct: 30, amount: 30, detail: '每场覆盖TOP3比分' },
        { label: '胜平负', pct: 20, amount: 20, detail: '只选最强信心的2场' },
        { label: '大小球', pct: 15, amount: 15, detail: '高赔Over/Under' },
      ],
      expectedReturn: 40,
    },
  ]

  const barColors: Record<string, string> = { '胜平负': '#00ff88', '比分': '#ffd700', '串关': '#ff4757', '大小球': '#54a0ff' }

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center py-4">
        <h2 className="text-xl font-black tracking-wide">
          <span className="text-[#ffd700]">{validMatches[0].date}</span>
          <span className="text-[#a0a0a0] text-sm font-normal ml-2">比赛日投注方案</span>
        </h2>
        <p className="text-[10px] text-[#555555] mt-1">{matchCount} 场比赛 · {validMatches[0].date} 比赛日数据 · 北京时间</p>
      </div>

      {/* Risk Card */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[#a0a0a0] mb-1">比赛日风控评估</div>
            <div className="text-lg font-bold" style={{ color: riskColor }}>{riskLabel}</div>
            <div className="text-[10px] text-[#555555] mt-1">
              平均信心 {avgConf}% · {matchCount}场中 {highRiskCount} 场高风险
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#a0a0a0] mb-1">总预算</div>
            <div className="text-2xl font-black text-[#ffd700]">100<span className="text-sm text-[#a0a0a0] font-normal">%</span></div>
          </div>
        </div>
      </section>

      {/* Match Overview */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <h3 className="text-xs font-bold text-[#a0a0a0] mb-4 uppercase tracking-wider">📋 比赛一览</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {validMatches.map(m => {
            const p = predictions[m.id]!
            const dirLabel = p.predictedDirection === 'home_win' ? cn(m.homeTeam) + '胜'
              : p.predictedDirection === 'away_win' ? cn(m.awayTeam) + '胜' : '平局'
            const dirColor = p.predictedDirection === 'home_win' ? '#00ff88'
              : p.predictedDirection === 'away_win' ? '#54a0ff' : '#ffa502'
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1f3a] cursor-pointer"
                onClick={() => onSelectMatch?.(m)}>
                <div className="text-xl">{flag(m.homeTeam)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-white flex items-center gap-1">
                    <span className="text-[8px] px-1 py-0.5 rounded bg-[#00ff88]/20 text-[#00ff88]">主</span>
                    {cn(m.homeTeam)}
                    <span className="text-[#a0a0a0] mx-1">vs</span>
                    {cn(m.awayTeam)}
                    <span className="text-[8px] px-1 py-0.5 rounded bg-[#ff4757]/20 text-[#ff4757]">客</span>
                  </div>
                  <div className="text-[9px] text-[#555555]">{m.group} · 当地{m.localKickoff} {m.localTZ} / 北京{m.kickoff}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono font-bold text-[#ffd700]">{p.predictedScore}</div>
                  <div className="text-[9px] font-bold" style={{ color: dirColor }}>{dirLabel}</div>
                  <div className="text-[8px] text-[#555555]">信{Math.round(p.confidence*100)}%</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Cross-match Parlays */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <h3 className="text-xs font-bold text-[#a0a0a0] mb-4 uppercase tracking-wider">🎰 跨场串关推荐</h3>
        <div className="space-y-3">
          {parlays.map((p, i) => {
            if (p.selections.length < 2) return null
            const totalOdds = Math.round(p.selections.reduce((a, b) => a * b.odds, 1) * 100) / 100
            const totalProb = Math.round(p.selections.reduce((a, b) => a * b.prob, 1) * 10000) / 100
            const riskBg = p.risk === 'Low' ? '#00ff88' : p.risk === 'Medium' ? '#ffa502' : '#ff4757'
            return (
              <div key={i} className="bg-[#1a1f3a] rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: riskBg + '20', color: riskBg }}>
                    {p.type}串关
                  </span>
                  <span className="text-[10px] text-[#555555]">{p.desc}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {p.selections.map((s, j) => (
                    <span key={j} className="text-[10px] px-2 py-1 rounded-full bg-[#141937] text-[#a0a0a0]">
                      {s.match} → <span className="text-white font-bold">{s.direction}</span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-[10px]">
                  <span className="font-mono text-[#ffd700] font-bold">@ {totalOdds}</span>
                  <span className="text-[#a0a0a0]">命中率 <span className="text-white">{totalProb.toFixed(1)}%</span></span>
                  <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ backgroundColor: riskBg + '20', color: riskBg }}>
                    {p.risk === 'Low' ? '低风险' : p.risk === 'Medium' ? '中风险' : '高风险'}
                  </span>
                </div>
              </div>
            )
          })}
          {parlays.every(p => p.selections.length < 2) && (
            <p className="text-xs text-[#555555]">高概率比赛不足2场，无法生成稳健串关</p>
          )}
        </div>
      </section>

      {/* Bankroll */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <h3 className="text-xs font-bold text-[#a0a0a0] mb-2 uppercase tracking-wider">💼 比赛日资金配置</h3>
        <div className="bg-[#1a1f3a] rounded-lg p-3 mb-4 text-[10px] text-[#a0a0a0] leading-relaxed">
          将你的预算视为 <span className="text-white font-bold">100%</span>，以下三个方案告诉你如何按比例分配到今天全部 {matchCount} 场比赛。
          无论实际金额多少，按此比例缩放即可。
        </div>

        {bankrollPlans.map((plan, i) => (
          <div key={i} className="mb-5 last:mb-0 border border-[#1a1f3a] rounded-lg overflow-hidden">
            {/* Plan Header */}
            <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: plan.color + '10' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black" style={{ color: plan.color }}>{plan.name}方案</span>
                <span className="text-[10px] text-[#a0a0a0]">{plan.desc}</span>
              </div>
              <span className="text-[10px] font-bold" style={{ color: plan.color }}>
                预期回报 +{plan.expectedReturn}%
              </span>
            </div>

            {/* Bet breakdown */}
            <div className="p-4 space-y-3">
              {plan.alloc.map((alloc, j) => {
                // Generate per-match examples for this allocation type
                const examples = generateAllocExamples(alloc.label, alloc.amount, plan.name, validMatches, predictions, cn, flag)
                return (
                  <div key={j}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: barColors[alloc.label] }} />
                      <span className="text-[11px] font-bold text-white">{alloc.label}</span>
                      <span className="text-[10px] text-[#a0a0a0]">— {alloc.detail}</span>
                      <span className="ml-auto text-[10px] font-mono font-bold" style={{ color: barColors[alloc.label] }}>
                        {alloc.amount}%
                      </span>
                    </div>
                    <div className="ml-4 space-y-1">
                      {examples.map((ex, k) => (
                        <div key={k} className="flex items-center text-[9px] text-[#555555]">
                          <span className="w-4">{k + 1}.</span>
                          <span className="flex-1">{ex}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Summary line */}
              <div className="pt-3 border-t border-[#141937] flex items-center justify-between text-[10px]">
                <span className="text-[#a0a0a0]">
                  总预算 <span className="text-white font-bold">100%</span>
                  · {plan.name === '保守' ? '追求稳定小盈' : plan.name === '平衡' ? '兼顾收益与安全' : '搏取高回报'}
                </span>
                <span className="font-bold" style={{ color: plan.color }}>
                  预期回收 ~{100 + plan.expectedReturn}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Per-match scores */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <h3 className="text-xs font-bold text-[#a0a0a0] mb-4 uppercase tracking-wider">🎯 各场比分参考</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {validMatches.map(m => {
            const p = predictions[m.id]!
            return (
              <div key={m.id} className="bg-[#1a1f3a] rounded-lg p-3 cursor-pointer hover:bg-[#252b4a] transition-colors"
                onClick={() => onSelectMatch?.(m)}>
                <div className="text-[10px] text-[#a0a0a0] mb-2">
                  {flag(m.homeTeam)} {cn(m.homeTeam)} vs {cn(m.awayTeam)} {flag(m.awayTeam)}
                </div>
                {p.top5Scores.slice(0, 5).map((s, idx) => (
                  <div key={idx} className="flex items-center text-[10px] py-0.5">
                    <span className="w-4 text-[#ffd700] font-bold">#{idx + 1}</span>
                    <span className="w-8 font-mono text-white font-bold">{s.score}</span>
                    <span className="text-[#a0a0a0] ml-1">{Math.round(s.probability * 100)}%</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-[#141937] text-[9px] text-[#ff4757] truncate">
                  ⚠️ {p.riskWarnings[0]?.slice(0, 35) || '无'}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ---- Remaining Match Optimization ---- */}
      {validRemaining.length > 0 && validRemaining.length < matchCount && (
        <section className="bg-[#141937] border border-[#ff4757]/30 rounded-xl p-5">
          <h3 className="text-xs font-bold text-[#ff4757] mb-2 uppercase tracking-wider">
            🔄 剩余 {validRemaining.length} 场比赛 · 投注优化
          </h3>
          <div className="bg-[#1a1f3a] rounded-lg p-3 mb-4 text-[10px] text-[#a0a0a0] leading-relaxed">
            {allMatches.filter(m => m.status === 'finished').map(m => {
              const review = postMatchReviews[m.id]
              return (
                <div key={m.id} className="mb-1 last:mb-0">
                  {flag(m.homeTeam)} {cn(m.homeTeam)} {m.homeScore}:{m.awayScore} {cn(m.awayTeam)} {flag(m.awayTeam)}
                  <span className="text-[#ff4757] ml-1">
                    （{review?.missItems[0]?.includes('方向') ? '方向×' : '方向×'}，已结束）
                  </span>
                </div>
              )
            })}
          </div>
          <RemainingOptimization matches={validRemaining} predictions={predictions} cn={cn} flag={flag} />
        </section>
      )}

      <div className="text-center text-[9px] text-[#555555] pb-4">
        以上方案基于概率模型推演，仅供参考，不构成投注建议
      </div>

    </div>
  )
}

/** Generate concrete allocation examples per bet type */
function generateAllocExamples(
  label: string, amount: number, planName: string,
  matches: Match[], predictions: Record<string, Prediction>,
  cn: (n: string) => string, flag: (n: string) => string
): string[] {
  const examples: string[] = []
  const sorted = [...matches].sort((a, b) => {
    const pa = predictions[a.id], pb = predictions[b.id]
    return (pb?.confidence || 0) - (pa?.confidence || 0)
  })

  if (label === '胜平负') {
    const perMatch = amount / matches.length
    sorted.forEach(m => {
      const p = predictions[m.id]
      if (!p) return
      const isHome = p.predictedDirection === 'home_win'
      const dir = isHome ? cn(m.homeTeam) + '胜' : p.predictedDirection === 'away_win' ? cn(m.awayTeam) + '胜' : '平'
      const odds = dirOdds(p).toFixed(2)
      const ret = Math.round(perMatch * parseFloat(odds))
      examples.push(`${cn(m.homeTeam)} vs ${cn(m.awayTeam)} → ${dir} @${odds} 投${Math.round(perMatch)}% → 回${ret}%`)
    })
    if (planName === '保守') {
      examples.push('说明：每场均注，只要对1场就不亏，对2场以上盈利')
    }
  } else if (label === '比分') {
    sorted.slice(0, 2).forEach(m => {
      const p = predictions[m.id]
      if (!p) return
      const piece = Math.floor(amount / 4)
      const s1 = p.top5Scores[0], s2 = p.top5Scores[1]
      if (s1) { const o1 = scoreOdds(p, 0); examples.push(`${cn(m.homeTeam)} vs ${cn(m.awayTeam)} → ${s1.score} @${o1.toFixed(2)} 投${piece}% → 回${Math.round(piece * o1)}%`) }
      if (s2) { const o2 = scoreOdds(p, 1); examples.push(`                    → ${s2.score} @${o2.toFixed(2)} 投${piece}% → 回${Math.round(piece * o2)}%`) }
    })
  } else if (label === '串关') {
    const picks = sorted.slice(0, 3)
    const names = picks.map(m => {
      const p = predictions[m.id]
      if (!p) return ''
      return p.predictedDirection === 'home_win' ? cn(m.homeTeam) + '胜'
        : p.predictedDirection === 'away_win' ? cn(m.awayTeam) + '胜' : cn(m.homeTeam) + 'vs' + cn(m.awayTeam) + '平'
    }).join('+')
    const oddsTotal = picks.reduce((a, m) => {
      const p = predictions[m.id]
      if (!p) return a
      return a * dirOdds(p)
    }, 1)
    const ret = Math.round(amount * oddsTotal)
    examples.push(`${picks.length}场串: ${names} @${oddsTotal.toFixed(1)} 投${amount}% → 回${ret}%`)
    if (planName === '激进' && picks.length >= 3) {
      const picks2 = sorted.slice(0, 2)
      const odds2 = picks2.reduce((a, m) => { const p = predictions[m.id]; if (!p) return a; return a * dirOdds(p) }, 1)
      const ret2 = Math.round((amount * 0.5) * odds2)
      const n2 = picks2.map(m => { const p = predictions[m.id]; return p ? (p.predictedDirection === 'home_win' ? cn(m.homeTeam) + '胜' : cn(m.awayTeam) + '胜') : '' }).join('+')
      const half = Math.floor(amount * 0.5)
      examples.push(`2场对冲: ${n2} @${odds2.toFixed(1)} 投${half}% → 回${ret2}%`)
    }
  } else if (label === '大小球') {
    sorted.slice(0, 2).forEach(m => {
      const p = predictions[m.id]
      if (!p) return
      const over = p.over25Prob > 0.5
      const ou = over ? '大2.5' : '小2.5'
      const odds = ouOdds(p, over).toFixed(2)
      const piece = Math.floor(amount / 2)
      const ret = Math.round(piece * parseFloat(odds))
      examples.push(`${cn(m.homeTeam)} vs ${cn(m.awayTeam)} → ${ou} @${odds} 投${piece}% → 回${ret}%`)
    })
  }
  if (examples.length === 0) examples.push('无需分配')
  return examples
}

/** 剩余比赛投注优化建议 */
function RemainingOptimization({
  matches, predictions, cn, flag,
}: {
  matches: Match[]
  predictions: Record<string, Prediction>
  cn: (n: string) => string
  flag: (n: string) => string
}) {
  const remaining = matches.filter(m => predictions[m.id])
  if (remaining.length === 0) return null

  // Build concrete bets per remaining match
  type BetSuggestion = { match: string; bet: string; odds: number; alloc: number; reason: string }
  const suggestions: BetSuggestion[] = []

  remaining.forEach(m => {
    const p = predictions[m.id]!
    const name = `${cn(m.homeTeam)} vs ${cn(m.awayTeam)}`

    // Direction bet
    const isHome = p.predictedDirection === 'home_win'
    const isAway = p.predictedDirection === 'away_win'
    const dirBet = isHome ? `${cn(m.homeTeam)}胜` : isAway ? `${cn(m.awayTeam)}胜` : '平局'
    const dOdds = dirOdds(p)
    const dirAlloc = p.confidence > 0.65 ? 12 : p.confidence > 0.5 ? 10 : 8
    suggestions.push({ match: name, bet: `${dirBet} @${dOdds}`, odds: dOdds, alloc: dirAlloc,
      reason: `方向预测${isHome ? '主' : isAway ? '客' : '平'}，信${Math.round(p.confidence*100)}%` })

    // TOP2 score bets
    const s1 = p.top5Scores[0], s2 = p.top5Scores[1]
    if (s1) { const o1 = scoreOdds(p, 0); suggestions.push({ match: name, bet: `${s1.score} @${o1.toFixed(2)}`, odds: o1, alloc: 6,
      reason: `TOP1比分，概率${Math.round(s1.probability*100)}%` }) }
    if (s2) { const o2 = scoreOdds(p, 1); suggestions.push({ match: name, bet: `${s2.score} @${o2.toFixed(2)}`, odds: o2, alloc: 4,
      reason: `TOP2比分，概率${Math.round(s2.probability*100)}%` }) }

    // O/U bet
    const over = p.over25Prob > 0.5
    const ouBet = over ? '大2.5' : '小2.5'
    const oOdds = ouOdds(p, over)
    suggestions.push({ match: name, bet: `${ouBet} @${oOdds.toFixed(2)}`, odds: oOdds, alloc: 5,
      reason: `O/U倾向${over ? '大' : '小'}球` })
  })

  // Cross-match parlay (only if >=2 remaining)
  const parlaySuggestion = remaining.length >= 2 ? (() => {
    const picks = remaining.map(m => {
      const p = predictions[m.id]!
      return {
        name: cn(m.homeTeam) + 'vs' + cn(m.awayTeam),
        dir: p.predictedDirection === 'home_win' ? cn(m.homeTeam) + '胜' : p.predictedDirection === 'away_win' ? cn(m.awayTeam) + '胜' : '平',
        odds: dirOdds(p),
        prob: p.predictedDirection === 'home_win' ? p.homeWinProb : p.predictedDirection === 'away_win' ? p.awayWinProb : p.drawProb,
      }
    })
    const totalOdds = Math.round(picks.reduce((a, b) => a * b.odds, 1) * 100) / 100
    const totalProb = Math.round(picks.reduce((a, b) => a * b.prob, 1) * 1000) / 10
    return { picks, totalOdds, totalProb }
  })() : null

  return (
    <div className="space-y-4">
      {/* Redistribution summary */}
      <div className="bg-[#ff4757]/5 border border-[#ff4757]/20 rounded-lg p-3 text-[10px] text-[#a0a0a0]">
        葡萄牙 1:1 刚果(金) — 原方案中该场分配已失效。以下将预算集中到剩余 {remaining.length} 场：
      </div>

      {/* Betting slip */}
      <div className="bg-[#1a1f3a] rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-[#141937] text-[10px] text-[#a0a0a0] font-bold uppercase tracking-wider">
          投注单
        </div>
        <div className="divide-y divide-[#141937]">
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-[10px]">
              <div className="flex-1 min-w-0">
                <span className="text-[#555555]">{s.match}</span>
                <span className="mx-1">→</span>
                <span className="text-white font-mono">{s.bet}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[9px] text-[#555555]">{s.reason}</span>
                <span className="text-[#ffd700] font-mono font-bold w-8 text-right">{s.alloc}%</span>
              </div>
            </div>
          ))}
        </div>
        {parlaySuggestion && (
          <div className="px-3 py-2 bg-[#ffa502]/5 border-t border-[#ffa502]/20">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#ffa502] font-bold">
                {remaining.length}场串关 · {parlaySuggestion.picks.map(p => p.dir).join('+')}
                <span className="text-[#555555] ml-1">@ {parlaySuggestion.totalOdds.toFixed(1)}</span>
              </span>
              <span className="text-[#ffa502] font-mono font-bold w-8 text-right">10%</span>
            </div>
            <div className="text-[8px] text-[#555555] mt-0.5">
              命中率 {parlaySuggestion.totalProb}% · 投10% → 回{Math.round(10 * parlaySuggestion.totalOdds)}%
            </div>
          </div>
        )}
      </div>

      {/* Action summary */}
      <div className="text-[10px] text-[#a0a0a0] leading-relaxed">
        <span className="text-white font-bold">怎么用：</span>
        每行是一个具体的投注建议。百分比 = 占你总预算的比例。如果你投 100 块，就把金额乘以百分比。
        串关单独占 10%，其余按比例均分。由于已有一场出冷，建议比分仓位比原方案多加 5%。
      </div>
    </div>
  )
}
