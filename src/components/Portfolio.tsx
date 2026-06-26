import { useMemo, useState } from 'react'

interface PortfolioLeg {
  id: string
  bet: string
  odds: number
  prob: number
  mvi: number
  ev: number
  market: string
  match: string
  group: string
}

interface PortfolioItem {
  tier: string
  rank: number
  score: number
  odds: number
  hitPct: number
  ev: number
  mvi: number
  legs: PortfolioLeg[]
  breakdown: Record<string, number>
  riskLevel: string
}

interface AllocationItem {
  tier: string
  portfolio: { id: string; score: number; odds: number; ev: number; hitPct: number; legs: PortfolioLeg[] } | null
  pct: number
  amount: number
  isCash?: boolean
}

interface PortfolioData {
  version: string
  generatedAt: string
  targetDateDisplay: string
  marketJudgment: { rating: string; summary: string; highlights: string[] }
  yesterdayReview: {
    date: string
    summary: Record<string, number>
    keyInsights: string[]
  }
  candidatePool: {
    total: number
    accepted: number
    rejected: number
    topPicks: { bet: string; odds: number; prob: number; mvi: number; ev: number; market: string }[]
    rejectedHighlights: { bet: string; reasons: string[]; ev: number }[]
  }
  portfolios: PortfolioItem[]
  bestPortfolio: {
    tier: string
    score: number
    odds: number
    hitPct: number
    ev: number
    mvi: number
    legs: PortfolioLeg[]
    breakdown: Record<string, number>
    rationale: string
  }
  capitalAllocation: AllocationItem[]
  risks: string[]
  learnings: string[]
  stats: { totalCombinations: number; score80plus: number; topScore: number }
}

export default function Portfolio({ data }: { data: PortfolioData | null }) {
  if (!data) {
    return (
      <div className="text-center py-20 text-[#a0a0a0]">
        <div className="text-4xl mb-4">📊</div>
        <p>暂无投资组合数据</p>
        <p className="text-[10px] mt-2">运行 generate-portfolio.mjs 生成最新方案</p>
      </div>
    )
  }

  const tierOrder = ['稳健收益型', '平衡收益型', '价值收益型', '高赔率冲击型', '超级大奖型']
  const tierColors: Record<string, string> = {
    '稳健收益型': 'border-[#00ff88]',
    '平衡收益型': 'border-[#54a0ff]',
    '价值收益型': 'border-[#ffd700]',
    '高赔率冲击型': 'border-[#ff6b6b]',
    '超级大奖型': 'border-[#a855f7]',
  }
  const tierBgColors: Record<string, string> = {
    '稳健收益型': 'bg-[#00ff88]/10',
    '平衡收益型': 'bg-[#54a0ff]/10',
    '价值收益型': 'bg-[#ffd700]/10',
    '高赔率冲击型': 'bg-[#ff6b6b]/10',
    '超级大奖型': 'bg-[#a855f7]/10',
  }

  // Format time
  const genTime = data.generatedAt ? new Date(data.generatedAt).toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold">
          <span className="text-[#ffd700]">📊 WCPE</span> 每日投资组合
        </h1>
        <p className="text-sm text-[#a0a0a0]">
          {data.targetDateDisplay} · Portfolio Optimizer V{data.version}
        </p>
        <p className="text-[9px] text-[#555555]">
          {data.stats.totalCombinations.toLocaleString()} 组合搜索 · 最高分 {data.stats.topScore}/100 · 生成于 {genTime}
        </p>
      </div>

      {/* Market Judgment */}
      <div className="bg-[#1a1f3a] border border-[#ffd700]/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{data.marketJudgment.rating.split(' ')[0]}</span>
          <h2 className="text-sm font-bold text-white">今日市场判断</h2>
        </div>
        <p className="text-xs text-[#a0a0a0] mb-3">{data.marketJudgment.summary}</p>
        <div className="space-y-1.5">
          {data.marketJudgment.highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-[#cccccc]">
              <span className="text-[#ffd700] mt-0.5">▸</span>
              <span>{h}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Yesterday Review */}
      <YesterdayReview review={data.yesterdayReview} />

      {/* Candidate Pool */}
      <CandidateSection pool={data.candidatePool} />

      {/* 🏆 Best Portfolio */}
      <div className="bg-gradient-to-r from-[#1a1f3a] via-[#1e2445] to-[#1a1f3a] border-2 border-[#ffd700] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🏆</span>
          <h2 className="text-lg font-bold text-[#ffd700]">今日最佳投资组合</h2>
          <span className="text-[10px] bg-[#ffd700]/20 text-[#ffd700] px-2 py-0.5 rounded-full">{data.bestPortfolio.tier}</span>
        </div>
        <div className="grid grid-cols-5 gap-3 mb-4 text-center">
          <MetricBox label="综合评分" value={`${data.bestPortfolio.score}/100`} color="#ffd700" size="lg" />
          <MetricBox label="综合赔率" value={`${data.bestPortfolio.odds}x`} color="#54a0ff" />
          <MetricBox label="命中率" value={`${data.bestPortfolio.hitPct}%`} color="#00ff88" />
          <MetricBox label="EV" value={`+${(data.bestPortfolio.ev * 100).toFixed(1)}%`} color="#ffa502" />
          <MetricBox label="MVI" value={data.bestPortfolio.mvi.toFixed(3)} color="#a855f7" />
        </div>
        <div className="space-y-2 mb-4">
          {data.bestPortfolio.legs.map((leg, i) => (
            <LegCard key={i} leg={leg} index={i} />
          ))}
        </div>
        <p className="text-[11px] text-[#a0a0a0] leading-relaxed border-t border-[#ffd700]/20 pt-3">
          💡 {data.bestPortfolio.rationale}
        </p>
      </div>

      {/* Portfolios by Tier */}
      <div className="space-y-5">
        {tierOrder.map(tier => {
          const tierPortfolios = data.portfolios.filter(p => p.tier === tier)
          if (!tierPortfolios.length) return null
          return (
            <div key={tier} className={`bg-[#1a1f3a] border-l-4 ${tierColors[tier] || 'border-[#555555]'} rounded-xl p-5`}>
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${tierBgColors[tier]}`}>{tier}</span>
                <span className="text-[10px] text-[#a0a0a0]">
                  {tier === '稳健收益型' ? '目标 2-5x' : tier === '平衡收益型' ? '目标 5-12x' : tier === '价值收益型' ? '目标 12-25x ⭐重点' : tier === '高赔率冲击型' ? '目标 25-80x' : '目标 80x+ ⚠️娱乐'}
                </span>
              </h3>
              <div className="space-y-3">
                {tierPortfolios.map((p, i) => (
                  <TierPortfolioCard key={i} portfolio={p} isBest={p.score === data.bestPortfolio.score} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Capital Allocation */}
      <div className="bg-[#1a1f3a] border border-[#141937] rounded-xl p-5">
        <h2 className="text-sm font-bold text-white mb-4">💰 资金配置建议（预算: 100 单位）</h2>
        <div className="space-y-2">
          {data.capitalAllocation.map((alloc, i) => (
            <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${alloc.isCash ? 'bg-[#00ff88]/5 border border-[#00ff88]/20' : 'bg-[#141937]'}`}>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white font-bold w-16">{alloc.tier}</span>
                {alloc.portfolio && (
                  <span className="text-[10px] text-[#a0a0a0]">{alloc.portfolio.odds}x · {alloc.portfolio.hitPct}%命中 · EV {alloc.portfolio.ev > 0 ? '+' : ''}{(alloc.portfolio.ev * 100).toFixed(1)}%</span>
                )}
                {alloc.isCash && <span className="text-[10px] text-[#00ff88]">保留灵活资金，明日可用</span>}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 h-2 bg-[#0a0e27] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${alloc.isCash ? 'bg-[#00ff88]' : 'bg-[#ffd700]'}`} style={{ width: `${alloc.pct}%` }} />
                </div>
                <span className="text-xs text-[#ffd700] font-bold w-16 text-right">{alloc.amount} 单位</span>
                <span className="text-[10px] text-[#555555] w-10 text-right">{alloc.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risks & Learnings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1a1f3a] border border-[#ff6b6b]/30 rounded-xl p-4">
          <h3 className="text-xs font-bold text-[#ff6b6b] mb-2">⚠️ 风险提示</h3>
          <ul className="space-y-1">
            {data.risks.map((r, i) => (
              <li key={i} className="text-[10px] text-[#a0a0a0] flex items-start gap-1.5">
                <span className="text-[#ff6b6b] mt-0.5">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[#1a1f3a] border border-[#54a0ff]/30 rounded-xl p-4">
          <h3 className="text-xs font-bold text-[#54a0ff] mb-2">📝 今日学习</h3>
          <ul className="space-y-1">
            {data.learnings.map((l, i) => (
              <li key={i} className="text-[10px] text-[#a0a0a0] flex items-start gap-1.5">
                <span className="text-[#54a0ff] mt-0.5">•</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[9px] text-[#555555] py-2">
        基于概率模型推演，仅供参考，不构成投注建议 | Portfolio Optimizer V{data.version} | 组合数: {data.stats.totalCombinations.toLocaleString()}
      </div>
    </div>
  )
}

function YesterdayReview({ review }: { review: PortfolioData['yesterdayReview'] }) {
  const [expanded, setExpanded] = useState(false)
  const s = review.summary
  return (
    <div className="bg-[#1a1f3a] border border-[#141937] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          📋 昨日复盘
          <span className="text-[10px] text-[#a0a0a0]">({review.date})</span>
        </h2>
        <span className="text-[10px] text-[#555555]">{expanded ? '收起 ▲' : '展开 ▼'}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        <MiniStat label="方向" value={`${(s.dirRate * 100).toFixed(0)}%`} color={s.dirRate < 0.45 ? '#ff6b6b' : '#00ff88'} />
        <MiniStat label="Over2.5" value={`${(s.over25Rate * 100).toFixed(0)}%`} color={s.over25Rate > 0.7 ? '#00ff88' : '#ffa502'} />
        <MiniStat label="Top3比分" value={`${(s.top3Rate * 100).toFixed(0)}%`} color="#54a0ff" />
        <MiniStat label="平局" value={`${s.draws}/${s.n}`} color="#a855f7" />
      </div>
      {expanded && (
        <div className="space-y-1.5 mt-3 pt-3 border-t border-[#141937]">
          {review.keyInsights.map((insight, i) => (
            <div key={i} className="text-[10px] text-[#a0a0a0] flex items-start gap-1.5">
              <span className="text-[#ffd700] mt-0.5">{i + 1}.</span>
              <span>{insight}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CandidateSection({ pool }: { pool: PortfolioData['candidatePool'] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-[#1a1f3a] border border-[#141937] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          🎯 候选投注池
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#00ff88]">{pool.accepted} 入选</span>
          <span className="text-[10px] text-[#ff6b6b]">{pool.rejected} 淘汰</span>
          <span className="text-[10px] text-[#555555]">{expanded ? '收起 ▲' : '展开 ▼'}</span>
        </div>
      </div>
      {/* Top picks always visible */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {pool.topPicks.slice(0, 6).map((pick, i) => (
          <div key={i} className="flex items-center justify-between bg-[#141937] rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[9px] text-[#ffd700] font-mono w-5">#{i + 1}</span>
              <span className="text-[10px] text-white truncate">{pick.bet}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-[#ffd700] font-bold">@{pick.odds}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${pick.mvi >= 1.15 ? 'bg-[#00ff88]/20 text-[#00ff88]' : pick.mvi >= 1.05 ? 'bg-[#ffa502]/20 text-[#ffa502]' : 'bg-[#555555]/20 text-[#a0a0a0]'}`}>
                MVI {pick.mvi.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[#141937]">
          <h4 className="text-[10px] text-[#ff6b6b] mb-2">被淘汰投注项（部分）</h4>
          <div className="space-y-1">
            {pool.rejectedHighlights.map((r, i) => (
              <div key={i} className="text-[9px] text-[#a0a0a0] flex items-start gap-1.5">
                <span className="text-[#ff6b6b]">✕</span>
                <span className="truncate">{r.bet}</span>
                <span className="text-[#555555] shrink-0">{r.reasons.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TierPortfolioCard({ portfolio, isBest }: { portfolio: PortfolioItem; isBest: boolean }) {
  return (
    <div className={`bg-[#141937] rounded-lg p-4 ${isBest ? 'ring-2 ring-[#ffd700]' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#ffd700] font-bold">#{portfolio.rank}</span>
          <span className="text-xs text-white">评分 {portfolio.score}/100</span>
          {isBest && <span className="text-[9px] bg-[#ffd700]/20 text-[#ffd700] px-1.5 py-0.5 rounded">🏆 BEST</span>}
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-[#ffd700] font-bold">{portfolio.odds}x</span>
          <span className="text-[#a0a0a0]">命中 {portfolio.hitPct}%</span>
          <span className={portfolio.ev > 0 ? 'text-[#00ff88]' : 'text-[#ff6b6b]'}>
            EV {portfolio.ev > 0 ? '+' : ''}{(portfolio.ev * 100).toFixed(1)}%
          </span>
          <span className="text-[10px]">{portfolio.riskLevel}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {portfolio.legs.map((leg, i) => (
          <LegCard key={i} leg={leg} index={i} compact />
        ))}
      </div>
      {/* Score breakdown */}
      <div className="mt-3 pt-3 border-t border-[#1a1f3a] flex gap-3">
        {Object.entries(portfolio.breakdown).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1">
            <span className="text-[8px] text-[#555555] uppercase">{key}</span>
            <span className={`text-[9px] font-mono ${val >= 0 ? 'text-[#a0a0a0]' : 'text-[#ff6b6b]'}`}>{val > 0 ? '+' : ''}{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LegCard({ leg, index, compact }: { leg: PortfolioLeg; index: number; compact?: boolean }) {
  const mviColor = leg.mvi >= 1.15 ? '#00ff88' : leg.mvi >= 1.05 ? '#ffa502' : '#a0a0a0'
  return (
    <div className={`flex items-center justify-between ${compact ? 'py-1' : 'py-2'} px-3 bg-[#0a0e27] rounded-lg`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[10px] text-[#555555] font-mono w-4">{index + 1}</span>
        <div className="min-w-0">
          <p className="text-[11px] text-white truncate">{leg.bet}</p>
          <p className="text-[9px] text-[#555555]">{leg.market} · {leg.group}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[11px] text-[#ffd700] font-bold">@{leg.odds}</span>
        <span className="text-[9px] text-[#a0a0a0]">{(leg.prob * 100).toFixed(0)}%</span>
        <span className="text-[9px] font-mono" style={{ color: mviColor }}>MVI {leg.mvi.toFixed(2)}</span>
        <span className={`text-[9px] ${leg.ev > 0 ? 'text-[#00ff88]' : leg.ev < -0.02 ? 'text-[#ff6b6b]' : 'text-[#a0a0a0]'}`}>
          {leg.ev > 0 ? '+' : ''}{(leg.ev * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

function MetricBox({ label, value, color, size }: { label: string; value: string; color: string; size?: 'lg' }) {
  return (
    <div className="text-center">
      <p className={`${size === 'lg' ? 'text-xl' : 'text-sm'} font-bold`} style={{ color }}>{value}</p>
      <p className="text-[9px] text-[#555555] mt-0.5">{label}</p>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0a0e27] rounded-lg p-2 text-center">
      <p className="text-sm font-bold" style={{ color }}>{value}</p>
      <p className="text-[9px] text-[#555555]">{label}</p>
    </div>
  )
}
