import { useState } from 'react'

interface PortfolioLeg {
  id: string; bet: string; odds: number; prob: number; mvi: number; ev: number
  market: string; match: string; group: string; type?: string
}
interface PortfolioItem {
  rank: number; score: number; odds: number; hitPct: number; ev: number; mvi: number
  legs: PortfolioLeg[]; breakdown: Record<string, number>; tier: string; rationale: string
  comparisonNote?: string
}
interface AllocationItem {
  tier: string; pct: number; amount: number; isCash?: boolean; isCore?: boolean
  portfolio?: { id?: string; odds: number; hitPct: number; ev: number; legs?: PortfolioLeg[]; score?: number } | null
}

interface AbandonedOpportunity {
  category: string; reason: string; count: number
  examples: { match: string; bet: string; odds: number; ev: number; mvi: number }[]
}

interface PortfolioData {
  version: string; generatedAt: string; targetDateDisplay: string
  targetMatchIds: string[]; oddsSource: string
  marketRating: {
    verdict: string; investableCount: number; highMviCount: number
    positiveEvCount: number; suggestedExposure: string; summary: string; highlights: string[]
  }
  investmentPool: { match: string; market: string; bet: string; odds: number; ev: number; mvi: number; reason: string; type?: string }[]
  portfolios: PortfolioItem[]
  capitalAllocation: AllocationItem[]
  finalVerdict: { verdict: string; reason: string; oddsAssessment?: string; bestPortfolio?: { score: number; odds: number; legs: PortfolioLeg[] } | null }
  yesterdayReview?: { date: string; summary: Record<string, number>; keyInsights: string[]; strategyWeights?: Record<string, number> }
  candidatePool?: { total: number; accepted: number; rejected: number; abandonedMatches?: number }
  bestPortfolio?: { tier: string; score: number; odds: number; hitPct: number; ev: number; mvi: number; legs: PortfolioLeg[]; breakdown: Record<string, number>; rationale: string; decisionLogic?: { whyBest: string; keyDifferentiator: string } } | null
  stats?: { totalCombinations: number; topScore: number; scoredCount?: number; byMarket?: Record<string, number>; byLegs?: Record<string, number> }
  abandonedOpportunities?: AbandonedOpportunity[]
  wcpeValidations?: { total: number; valid: number; withIssues: number }
}

export default function Portfolio({ data }: { data: PortfolioData | null }) {
  if (!data) return <EmptyState message="暂无投资组合数据" hint="运行 generate-portfolio.mjs 生成最新方案" />

  const genTime = data.generatedAt ? new Date(data.generatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold"><span className="text-[#ffd700]">📊 WCPE</span> 每日投资组合 <span className="text-[10px] text-[#555555]">V{data.version}</span></h1>
        <p className="text-sm text-[#a0a0a0]">{data.targetDateDisplay} · {data.targetMatchIds?.length || 0}场比赛</p>
        <div className="flex justify-center gap-3 text-[10px] text-[#555555]">
          <span>{data.stats?.totalCombinations?.toLocaleString() || '?'} 组合搜索</span>
          <span>最高分 {data.stats?.topScore || data.bestPortfolio?.score || '?'}/100</span>
          {data.wcpeValidations && (
            <span title="WCPE校验通过/总数">校验 {data.wcpeValidations.valid}/{data.wcpeValidations.total}</span>
          )}
          <span>赔率: {data.oddsSource || '?'}</span>
          <span>生成于 {genTime}</span>
        </div>
      </div>

      {/* ① Market Rating */}
      <MarketRating rating={data.marketRating} />

      {/* Yesterday Review */}
      {data.yesterdayReview && <YesterdayReview review={data.yesterdayReview} />}

      {/* ② Investment Pool */}
      <InvestmentPool pool={data.investmentPool} candidatePool={data.candidatePool} />

      {/* 🏆 Today's Best Portfolio */}
      {data.bestPortfolio && data.bestPortfolio.legs?.length > 0 && (
        <BestPortfolioCard best={data.bestPortfolio} />
      )}

      {/* ③ Portfolio Search Results */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white">③ 投资组合搜索结果 <span className="text-[10px] text-[#555555]">(Top {Math.min(data.portfolios?.length || 0, 10)})</span></h2>
        <div className="space-y-3">
          {(data.portfolios || []).map((p, i) => (
            <PortfolioCard key={i} portfolio={p} isBest={p.score === (data.bestPortfolio?.score || 0)} />
          ))}
        </div>
      </div>

      {/* ④ Capital Allocation */}
      <CapitalAllocation allocations={data.capitalAllocation || []} />

      {/* ⑤ Abandoned Opportunities (V4新增) */}
      {data.abandonedOpportunities && data.abandonedOpportunities.length > 0 && (
        <AbandonedSection opportunities={data.abandonedOpportunities} />
      )}

      {/* ⑥ Final Verdict */}
      {data.finalVerdict && (
        <div className="bg-gradient-to-r from-[#1a1f3a] via-[#1e2445] to-[#1a1f3a] border-2 border-[#ffd700] rounded-xl p-5">
          <h2 className="text-sm font-bold text-[#ffd700] mb-2">⑥ 今日最终结论</h2>
          <p className="text-lg font-bold text-white">{data.finalVerdict.verdict}</p>
          <p className="text-xs text-[#a0a0a0] mt-1 leading-relaxed">{data.finalVerdict.reason}</p>
          {data.finalVerdict.oddsAssessment && (
            <p className="text-[10px] text-[#ffa502] mt-2">{data.finalVerdict.oddsAssessment}</p>
          )}
        </div>
      )}

      <div className="text-center text-[9px] text-[#555555] py-2">
        基于概率模型推演，仅供参考，不构成投注建议 | Portfolio Optimizer V{data.version} · Investment Portfolio Manager
      </div>
    </div>
  )
}

// ===== ① Market Rating =====
function MarketRating({ rating }: { rating: PortfolioData['marketRating'] }) {
  const verdictBg = rating.verdict.includes('✅') ? 'border-[#00ff88]' : rating.verdict.includes('🟡') ? 'border-[#ffa502]' : 'border-[#ff6b6b]'
  return (
    <div className={`bg-[#1a1f3a] border-l-4 ${verdictBg} rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-white">① 今日市场评级</h2>
        <span className="text-lg">{rating.verdict}</span>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-3">
        <MiniStat label="可投注项" value={String(rating.investableCount)} color="#ffd700" />
        <MiniStat label="高MVI" value={String(rating.highMviCount)} color="#00ff88" />
        <MiniStat label="正EV" value={String(rating.positiveEvCount)} color="#54a0ff" />
        <MiniStat label="建议仓位" value={rating.suggestedExposure} color="#ffa502" />
      </div>
      <p className="text-xs text-[#a0a0a0]">{rating.summary}</p>
      {(rating.highlights || []).filter(Boolean).length > 0 && (
        <div className="mt-2 space-y-1">
          {(rating.highlights || []).filter(Boolean).slice(0, 4).map((h, i) => (
            <div key={i} className="text-[10px] text-[#cccccc] flex items-start gap-1.5"><span className="text-[#ffd700]">▸</span>{h}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== Yesterday Review =====
function YesterdayReview({ review }: { review: NonNullable<PortfolioData['yesterdayReview']> }) {
  const [expanded, setExpanded] = useState(false)
  const s = review.summary || {}
  const sw = review.strategyWeights
  return (
    <div className="bg-[#1a1f3a] border border-[#141937] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <h2 className="text-sm font-bold text-white">📋 昨日复盘 <span className="text-[10px] text-[#a0a0a0]">({review.date})</span></h2>
        <span className="text-[10px] text-[#555555]">{expanded ? '收起 ▲' : '展开 ▼'}</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <MiniStat label="方向" value={`${Math.round((s.dirRate || 0) * 100)}%`} color={(s.dirRate || 0) < 0.45 ? '#ff6b6b' : '#00ff88'} />
        <MiniStat label="大2.5球" value={`${Math.round((s.over25Rate || 0) * 100)}%`} color={(s.over25Rate || 0) > 0.7 ? '#00ff88' : '#ffa502'} />
        <MiniStat label="BTTS" value={`${Math.round((s.bttsRate || 0) * 100)}%`} color="#54a0ff" />
        <MiniStat label="Top3比分" value={`${Math.round((s.top3Rate || 0) * 100)}%`} color="#a855f7" />
        <MiniStat label="平局" value={`${s.draws || 0}/${s.n || 0}`} color="#ffa502" />
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[#141937] space-y-2">
          {(review.keyInsights || []).map((insight, i) => (
            <div key={i} className="text-[10px] text-[#a0a0a0] flex items-start gap-1.5">
              <span className="text-[#ffd700]">{i + 1}.</span><span>{insight}</span>
            </div>
          ))}
          {sw && (
            <div className="mt-2 pt-2 border-t border-[#141937]">
              <p className="text-[10px] text-[#555555] mb-1">动态策略权重（影响今日Portfolio评分）</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(sw).map(([k, v]) => (
                  <span key={k} className={`text-[9px] px-2 py-0.5 rounded ${v >= 1.05 ? 'bg-[#00ff88]/10 text-[#00ff88]' : v <= 0.95 ? 'bg-[#ff6b6b]/10 text-[#ff6b6b]' : 'bg-[#555555]/10 text-[#a0a0a0]'}`}>
                    {k}: {v.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===== ② Investment Pool =====
function InvestmentPool({ pool, candidatePool }: { pool: PortfolioData['investmentPool']; candidatePool?: PortfolioData['candidatePool'] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-[#1a1f3a] border border-[#141937] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <h2 className="text-sm font-bold text-white">② 今日投资池 <span className="text-[10px] text-[#555555]">({pool?.length || 0}项{candidatePool ? `，淘汰${candidatePool.rejected}项` : ''})</span></h2>
        <span className="text-[10px] text-[#555555]">{expanded ? '收起 ▲' : `展开全部 ${pool?.length || 0} 项 ▼`}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {(pool || []).slice(0, expanded ? 100 : 8).map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-[#0a0e27] rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[8px] text-[#ffd700] w-5">#{i + 1}</span>
              <span className="text-[10px] text-white truncate">{item.bet?.replace(/【.*?】/g, '')}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-[#ffd700] font-bold">@{item.odds}</span>
              <Badge label={item.reason} mvi={item.mvi} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===== Best Portfolio Card =====
function BestPortfolioCard({ best }: { best: NonNullable<PortfolioData['bestPortfolio']> }) {
  if (!best || !best.legs?.length) return null
  return (
    <div className="bg-gradient-to-r from-[#1a1f3a] via-[#1e2445] to-[#1a1f3a] border-2 border-[#ffd700] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🏆</span>
        <div>
          <h2 className="text-lg font-bold text-[#ffd700]">今日最佳 {best.tier}</h2>
          <p className="text-[10px] text-[#a0a0a0]">优化目标：Portfolio Score 最大化，非赔率最大化</p>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3 mb-4 text-center">
        <MetricBox label="评分" value={`${best.score}/100`} color="#ffd700" />
        <MetricBox label="赔率" value={`${best.odds}x`} color="#54a0ff" />
        <MetricBox label="命中率" value={`${best.hitPct}%`} color="#00ff88" />
        <MetricBox label="EV" value={`${best.ev > 0 ? '+' : ''}${(best.ev * 100).toFixed(1)}%`} color="#ffa502" />
        <MetricBox label="MVI" value={best.mvi?.toFixed(3)} color="#a855f7" />
      </div>
      <div className="space-y-2 mb-3">
        {best.legs.map((leg, i) => <LegRow key={i} leg={leg} index={i} />)}
      </div>
      {best.decisionLogic && (
        <div className="mb-3 p-3 bg-[#0a0e27] rounded-lg">
          <p className="text-[10px] text-[#a0a0a0]">🎯 决策逻辑</p>
          <p className="text-[11px] text-white mt-1">{best.decisionLogic.whyBest}</p>
          <p className="text-[10px] text-[#ffd700] mt-0.5">关键区分：{best.decisionLogic.keyDifferentiator}</p>
        </div>
      )}
      <p className="text-[11px] text-[#a0a0a0] border-t border-[#ffd700]/20 pt-3">💡 {best.rationale}</p>
    </div>
  )
}

// ===== Portfolio Card =====
function PortfolioCard({ portfolio, isBest }: { portfolio: PortfolioItem; isBest: boolean }) {
  return (
    <div className={`bg-[#141937] rounded-lg p-4 ${isBest ? 'ring-2 ring-[#ffd700]' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#ffd700] font-bold">#{portfolio.rank}</span>
          <span className="text-xs text-white">评分 {portfolio.score}/100</span>
          <span className="text-[9px] text-[#a0a0a0]">{portfolio.tier}</span>
          {isBest && <span className="text-[9px] bg-[#ffd700]/20 text-[#ffd700] px-1 rounded">🏆</span>}
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-[#ffd700] font-bold">{portfolio.odds}x</span>
          <span className="text-[#a0a0a0]">命中 {portfolio.hitPct}%</span>
          <span className={portfolio.ev > 0 ? 'text-[#00ff88]' : 'text-[#ff6b6b]'}>
            EV {portfolio.ev > 0 ? '+' : ''}{(portfolio.ev * 100).toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        {portfolio.legs.map((leg, i) => <LegRow key={i} leg={leg} index={i} compact />)}
      </div>
      {portfolio.breakdown && (
        <div className="mt-3 pt-3 border-t border-[#1a1f3a] flex flex-wrap gap-2">
          {Object.entries(portfolio.breakdown).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="text-[8px] text-[#555555]">{key}</span>
              <span className={`text-[9px] font-mono ${val >= 0 ? 'text-[#a0a0a0]' : 'text-[#ff6b6b]'}`}>{val > 0 ? '+' : ''}{val}</span>
            </div>
          ))}
        </div>
      )}
      {portfolio.rationale && <p className="text-[10px] text-[#555555] mt-2">{portfolio.rationale}</p>}
      {portfolio.comparisonNote && (
        <p className="text-[9px] text-[#ffa502] mt-1 italic">{portfolio.comparisonNote}</p>
      )}
    </div>
  )
}

// ===== ④ Capital Allocation =====
function CapitalAllocation({ allocations }: { allocations: AllocationItem[] }) {
  if (!allocations?.length) return null
  const realAllocations = allocations.filter(a => !a.isCash)
  if (!realAllocations.length) return null
  return (
    <div className="bg-[#1a1f3a] border border-[#141937] rounded-xl p-5">
      <h2 className="text-sm font-bold text-white mb-4">④ 资金配置（100% 分配）</h2>
      <div className="space-y-2">
        {realAllocations.map((a, i) => (
          <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${a.isCore ? 'bg-[#ffd700]/5 border border-[#ffd700]/20' : 'bg-[#141937]'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-bold text-white truncate">{a.tier}</span>
              {a.portfolio && <span className="text-[10px] text-[#a0a0a0] shrink-0">{a.portfolio.odds}x · {a.portfolio.hitPct}%命中</span>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-20 h-2 bg-[#0a0e27] rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${a.isCore ? 'bg-[#ffd700]' : 'bg-[#54a0ff]'}`} style={{ width: `${a.pct}%` }} />
              </div>
              <span className="text-xs text-[#ffd700] font-bold w-14 text-right">{a.amount} 单位</span>
              <span className="text-[10px] text-[#555555] w-8 text-right">{a.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===== ⑤ Abandoned Opportunities (V4新增) =====
function AbandonedSection({ opportunities }: { opportunities: AbandonedOpportunity[] }) {
  const [expanded, setExpanded] = useState(false)
  const totalCount = opportunities.reduce((s, o) => s + o.count, 0)
  const byCategory = opportunities.reduce((acc, o) => {
    acc[o.category] = (acc[o.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="bg-[#1a1f3a] border border-[#ff6b6b]/30 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <h2 className="text-sm font-bold text-white">
          ⑤ 今日主动放弃的机会
          <span className="text-[10px] text-[#ff6b6b] ml-2">({totalCount}项，{Object.keys(byCategory).length}类原因)</span>
        </h2>
        <span className="text-[10px] text-[#555555]">{expanded ? '收起 ▲' : '展开详情 ▼'}</span>
      </div>
      {/* Summary */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(byCategory).map(([cat, count]) => (
          <span key={cat} className="text-[10px] bg-[#ff6b6b]/10 text-[#ff6b6b] px-2 py-1 rounded">
            {cat} ×{count}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-[#a0a0a0] mb-2">放弃一个机会与抓住一个机会，同样重要。</p>
      {expanded && (
        <div className="space-y-2 mt-3 pt-3 border-t border-[#141937]">
          {opportunities.map((opp, i) => (
            <div key={i} className="bg-[#0a0e27] rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[#ff6b6b] font-bold">{opp.category}</span>
                <span className="text-[9px] text-[#a0a0a0]">{opp.count}项</span>
              </div>
              <p className="text-[9px] text-[#a0a0a0]">原因：{opp.reason}</p>
              {opp.examples.filter(e => e.match).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {opp.examples.filter(e => e.match).slice(0, 3).map((ex, j) => (
                    <span key={j} className="text-[8px] bg-[#ff6b6b]/5 text-[#a0a0a0] px-1.5 py-0.5 rounded">
                      {ex.match} {ex.bet} {ex.odds > 0 ? `@${ex.odds}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== Reusable Components =====
function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="text-center py-20 text-[#a0a0a0]">
      <div className="text-4xl mb-4">📊</div>
      <p>{message}</p>
      {hint && <p className="text-[10px] mt-2">{hint}</p>}
    </div>
  )
}

function LegRow({ leg, index, compact }: { leg: PortfolioLeg; index: number; compact?: boolean }) {
  const mviColor = leg.mvi >= 1.15 ? '#00ff88' : leg.mvi >= 1.05 ? '#ffa502' : '#a0a0a0'
  const marketColors: Record<string, string> = { '胜平负': '#54a0ff', '大小球': '#00ff88', 'BTTS': '#a855f7', '双重机会': '#ffa502', '波胆': '#ff6b6b', '平局退款': '#22d3ee', '比分区间': '#f59e0b' }
  const marketColor = marketColors[leg.market] || '#555555'
  return (
    <div className={`flex items-center justify-between ${compact ? 'py-1' : 'py-2'} px-3 bg-[#0a0e27] rounded-lg`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[10px] text-[#555555] w-4">{index + 1}</span>
        <span className="text-[8px] px-1 rounded" style={{ backgroundColor: marketColor + '20', color: marketColor }}>{leg.market}</span>
        <div className="min-w-0"><p className="text-[11px] text-white truncate">{leg.bet}</p></div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[11px] text-[#ffd700] font-bold">@{leg.odds}</span>
        <span style={{ color: mviColor, fontSize: '10px' }}>MVI {leg.mvi?.toFixed(2)}</span>
        <span className={`text-[9px] ${leg.ev > 0 ? 'text-[#00ff88]' : 'text-[#ff6b6b]'}`}>{leg.ev > 0 ? '+' : ''}{(leg.ev * 100).toFixed(1)}%</span>
      </div>
    </div>
  )
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="text-center"><p className="text-sm font-bold" style={{ color }}>{value}</p><p className="text-[9px] text-[#555555] mt-0.5">{label}</p></div>
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-[#0a0e27] rounded-lg p-2 text-center"><p className="text-sm font-bold" style={{ color }}>{value}</p><p className="text-[9px] text-[#555555]">{label}</p></div>
}

function Badge({ label, mvi }: { label: string; mvi: number }) {
  const bg = mvi >= 1.15 ? 'bg-[#00ff88]/20 text-[#00ff88]' : mvi >= 1.05 ? 'bg-[#ffa502]/20 text-[#ffa502]' : 'bg-[#555555]/20 text-[#a0a0a0]'
  return <span className={`text-[8px] px-1.5 py-0.5 rounded ${bg}`}>{label}</span>
}
