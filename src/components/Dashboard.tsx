import { useState, useMemo } from 'react'
import type { Match, Prediction, PostMatchReview, ModelState } from '../lib/types'
import { teamRatings, cn, flag } from '../data/matches'
import { preciseMatchROI, oddsSourceLabel } from '../lib/preciseRoi'
import type { RoiResult } from '../lib/preciseRoi'
import MatchCard from './MatchCard'
import RecapTable from './RecapTable'

interface Props {
  historicalMatches: Match[]
  todayMatches: Match[]
  predictions: Record<string, Prediction>
  postMatchReviews: Record<string, PostMatchReview>
  modelState: ModelState
  keyLearnings: string[]
  onSelectMatch: (match: Match) => void
}

export default function Dashboard({
  historicalMatches, todayMatches, predictions, postMatchReviews, modelState, keyLearnings, onSelectMatch,
}: Props) {
  const todayTitle = todayMatches.length > 0 ? `${todayMatches[0].date} 比赛日` : '预测'
  const [historyPage, setHistoryPage] = useState(1)
  const perPage = 10
  const totalPages = Math.ceil(historicalMatches.length / perPage)
  const pagedMatches = historicalMatches.slice((historyPage - 1) * perPage, historyPage * perPage)

  return (
    <div className="animate-fade-in space-y-8">
      <div className="text-center py-4">
        <h1 className="text-2xl font-black tracking-wide">
          <span className="text-[#ffd700]">WC</span><span className="text-white">PE</span>
          <span className="text-[#a0a0a0] text-sm font-normal ml-2">世界杯智能预测引擎</span>
        </h1>
        <p className="text-[10px] text-[#555555] mt-1">
          Bayesian + Elo + Market Analysis · {modelState.totalPredictions} 场已分析 · 杨观观
        </p>
      </div>

      {/* Today */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-[#ffd700]">🔮 {todayTitle}</h2>
          <span className="text-[10px] text-[#a0a0a0]">
            {todayMatches.length} 场 · {todayMatches[0]?.date || '--'} 北京时间
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {todayMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictions[match.id]}
              onClick={() => onSelectMatch(match)}
            />
          ))}
        </div>
      </section>

      {/* History */}
      <section>
        <h2 className="text-lg font-bold text-[#ffd700] mb-3">
          📊 历史比赛
          <span className="text-sm font-normal text-[#a0a0a0] ml-2">({historicalMatches.length} 场)</span>
        </h2>
        <div className="bg-[#141937] rounded-xl border border-[#1a1f3a] overflow-hidden">
          <RecapTable matches={pagedMatches} predictions={predictions} reviews={postMatchReviews} onSelect={onSelectMatch} />
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}
              className="text-[10px] px-3 py-1 rounded bg-[#141937] border border-[#1a1f3a] text-[#a0a0a0] hover:text-white disabled:opacity-30">
              上一页
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setHistoryPage(i + 1)}
                className={`text-[10px] w-7 h-7 rounded ${historyPage === i + 1 ? 'bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700]/50' : 'bg-[#141937] text-[#a0a0a0] border border-[#1a1f3a] hover:text-white'}`}>
                {i + 1}
              </button>
            ))}
            <button onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))} disabled={historyPage === totalPages}
              className="text-[10px] px-3 py-1 rounded bg-[#141937] border border-[#1a1f3a] text-[#a0a0a0] hover:text-white disabled:opacity-30">
              下一页
            </button>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {keyLearnings.map((l, i) => (
            <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-[#141937] border border-[#1a1f3a] text-[#a0a0a0] max-w-full truncate">
              💡 {l.length > 50 ? l.slice(0, 50) + '...' : l}
            </span>
          ))}
        </div>
      </section>

      {/* P&L */}
      <DailyReturns historicalMatches={historicalMatches} predictions={predictions} />

      {/* Model */}
      <section className="bg-[#141937] rounded-xl border border-[#1a1f3a] p-5">
        <h3 className="text-xs font-bold text-[#a0a0a0] mb-4 uppercase tracking-wider">模型状态</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <MetricBox label="总预测" value={String(modelState.completedPredictions)} unit={`/${modelState.totalPredictions}`} />
          <MetricBox label="方向命中" value={`${Math.round(modelState.directionAccuracy * 100)}`} unit="%" color="#00ff88" detail={`${modelState.directionCorrect}/${modelState.completedPredictions}`} />
          <MetricBox label="TOP3比分" value={`${Math.round(modelState.scoreTop3Accuracy * 100)}`} unit="%" color="#ffa502" detail={`${modelState.scoreTop3Correct}/${modelState.completedPredictions}`} />
          <MetricBox label="TOP1比分" value={`${Math.round(modelState.scoreTop1Accuracy * 100)}`} unit="%" color="#54a0ff" detail={`${modelState.scoreTop1Correct}/${modelState.completedPredictions}`} />
          <MetricBox label="赛事平局率" value={`${Math.round(modelState.overallDrawRate * 100)}`} unit="%" color="#a0a0a0" detail={`${modelState.overallTotalMatches}场`} />
        </div>
      </section>

      {/* ELO 排行榜 + 因子权重 */}
      <section className="bg-[#141937] rounded-xl border border-[#1a1f3a] p-5">
        <h3 className="text-xs font-bold text-[#a0a0a0] mb-4 uppercase tracking-wider">模型进化</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <h4 className="text-[10px] text-[#54a0ff] font-bold mb-2">📈 ELO 排行榜</h4>
            <div className="space-y-1">
              {Object.entries(teamRatings)
                .sort(([, a], [, b]) => b.elo - a.elo)
                .slice(0, 10)
                .map(([name, rating], i) => (
                  <div key={name} className="flex items-center gap-2 text-[10px]">
                    <span className="w-4 text-[#555555] text-right">{i + 1}</span>
                    <span className="text-xs">{flag(name)}</span>
                    <span className="text-[#a0a0a0] flex-1">{cn(name)}</span>
                    <span className="font-mono text-white font-bold">{rating.elo}</span>
                  </div>
              ))}
            </div>
          </div>
          {modelState.factorWeights && (
            <div>
              <h4 className="text-[10px] text-[#ffa502] font-bold mb-2">🎯 因子权重动态</h4>
              <div className="space-y-1.5">
                {([
                  { key: 'eloDiff', label: 'ELO差值' },
                  { key: 'recentForm', label: '近期状态' },
                  { key: 'h2h', label: '历史交锋' },
                  { key: 'marketConsensus', label: '市场共识' },
                  { key: 'tacticalMatchup', label: '战术匹配' },
                ]).map(f => {
                  const fw = modelState.factorWeights![f.key]
                  const hitColor = fw.hitRate > 0.5 ? '#00ff88' : fw.hitRate > 0.35 ? '#ffa502' : '#ff4757'
                  const weightPct = Math.round(fw.weight * 100)
                  return (
                    <div key={f.key} className="flex items-center gap-2 text-[10px]">
                      <span className="w-16 text-[#a0a0a0] text-right">{f.label}</span>
                      <div className="flex-1 h-4 rounded bg-[#1a1f3a] relative overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${weightPct}%`, backgroundColor: hitColor, opacity: 0.25 }} />
                        <div className="absolute inset-0 flex items-center px-2 justify-between">
                          <span className="font-mono font-bold" style={{ color: hitColor }}>{Math.round(fw.hitRate * 100)}%</span>
                          <span className="text-[#555555] font-mono">w={weightPct}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="text-[9px] text-[#555555] mt-2">权重和=100%，基于16场已完赛学习</div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function MetricBox({ label, value, unit, color = '#ffffff', detail }: {
  label: string; value: string; unit: string; color?: string; detail?: string
}) {
  return (
    <div className="text-center p-2 rounded-lg bg-[#1a1f3a]/50">
      <div className="text-3xl font-black tracking-tight" style={{ color }}>
        {value}<span className="text-lg">{unit}</span>
      </div>
      <div className="text-[10px] text-[#a0a0a0] mt-1">{label}</div>
      {detail && <div className="text-[9px] text-[#555555] mt-0.5">{detail}</div>}
    </div>
  )
}

function DailyReturns({ historicalMatches, predictions }: { historicalMatches: Match[]; predictions: Record<string, Prediction> }) {
  const dailyData = useMemo(() => {
    const map = new Map<string, { matches: Match[]; rois: RoiResult[] }>()
    for (const m of historicalMatches) {
      const pred = predictions[m.id]
      if (!pred) continue
      const roi = preciseMatchROI(m, pred)
      if (!roi) continue
      const date = m.date
      if (!map.has(date)) map.set(date, { matches: [], rois: [] })
      map.get(date)!.matches.push(m)
      map.get(date)!.rois.push(roi)
    }
    const entries = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
    let totalCons = 0, totalBal = 0, totalAgg = 0, totalFields = 0
    const result = entries.map(([date, { matches: ms, rois }]) => {
      const cons = rois.reduce((s, r) => s + (r.cons ?? 0), 0)
      const bal = rois.reduce((s, r) => s + (r.bal ?? 0), 0)
      const agg = rois.reduce((s, r) => s + (r.agg ?? 0), 0)
      totalCons += cons; totalBal += bal; totalAgg += agg; totalFields += ms.length
      // bundle match names + roi details for expand
      const rows = ms.map((m, i) => {
        const r = rois[i]
        return { match: m, roi: r, home: cn(m.homeTeam), away: cn(m.awayTeam) }
      })
      return { date, count: ms.length, cons, bal, agg, rows }
    })
    return { days: result, total: { cons: totalCons, bal: totalBal, agg: totalAgg, fields: totalFields } }
  }, [historicalMatches, predictions])

  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  if (dailyData.days.length === 0) return null

  // Strategy summary card data
  const strategyCards = [
    { key: 'cons', label: '🛡️ 保守方案', color: '#54a0ff', v: dailyData.total.cons },
    { key: 'bal', label: '⚖️ 平衡方案', color: '#ffd700', v: dailyData.total.bal },
    { key: 'agg', label: '🔥 激进方案', color: '#ffa502', v: dailyData.total.agg },
  ] as const

  return (
    <section className="bg-[#141937] rounded-xl border border-[#1a1f3a] p-5">
      <h3 className="text-xs font-bold text-[#a0a0a0] mb-4 uppercase tracking-wider">💰 比赛日收益分析</h3>
      <p className="text-[10px] text-[#555555] mb-1">基于当日方案资金分配 × 真实赔率（Bet365→MVI→模型概率）计算</p>
      <p className="text-[8px] text-[#555555] mb-4">赔率来源缩写：B=Bet365 M=MVI P=概率 S=串关 | 点击日期展开单场明细</p>

      {/* Strategy Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {strategyCards.map(sc => (
          <div key={sc.key} className="bg-[#1a1f3a] rounded-lg p-3 text-center border border-[#252b4a]">
            <div className="text-[10px] text-[#a0a0a0] mb-1">{sc.label}</div>
            <div className="text-2xl font-black font-mono" style={{ color: sc.v > 0 ? '#00ff88' : sc.v < 0 ? '#ff4757' : sc.color }}>
              {sc.v > 0 ? '+' : ''}{sc.v}%
            </div>
            <div className="text-[9px] text-[#555555] mt-1">
              {sc.v > 10 ? '🟢 显著盈利' : sc.v > 0 ? '🟢 小幅盈利' : sc.v === 0 ? '⚪ 持平' : sc.v > -10 ? '🟡 小幅亏损' : '🔴 显著亏损'}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1a1f3a] text-[#a0a0a0]">
              <th className="text-left py-2 px-2 w-6"></th>
              <th className="text-left py-2 px-2">日期</th>
              <th className="text-center py-2 px-2">场次</th>
              <th className="text-right py-2 px-3">保守</th>
              <th className="text-right py-2 px-3">平衡</th>
              <th className="text-right py-2 px-3">激进</th>
            </tr>
          </thead>
          <tbody>
            {dailyData.days.map(d => {
              const isOpen = expandedDate === d.date
              return (
                <>
                  <tr
                    className="border-b border-[#1a1f3a] hover:bg-[#1a1f3a] transition-colors cursor-pointer"
                    onClick={() => setExpandedDate(isOpen ? null : d.date)}
                  >
                    <td className="py-2 px-2 text-[#555555] text-[10px]">{isOpen ? '▼' : '▶'}</td>
                    <td className="py-2 px-2 text-white font-mono text-[10px]">{d.date.slice(5)}</td>
                    <td className="py-2 px-2 text-center text-[#555555]">{d.count}场</td>
                    <RoiCell v={d.cons} />
                    <RoiCell v={d.bal} />
                    <RoiCell v={d.agg} />
                  </tr>
                  {/* Expandable detail rows */}
                  {isOpen && d.rows.map(r => (
                    <tr key={r.match.id} className="border-b border-[#1a1f3a] bg-[#0d1127]">
                      <td></td>
                      <td className="py-1.5 px-2" colSpan={5}>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                            <span className="text-white">{r.home} vs {r.away}</span>
                            <span className="text-[#555555]">预<span className="text-[#ffd700] font-mono ml-0.5">{r.roi?.detail?.predicted || '-'}</span></span>
                            <span className="text-[#555555]">实<span className="text-white font-mono font-bold ml-0.5">{r.roi?.detail?.actual || '-'}</span></span>
                            <span style={{ color: r.roi?.detail?.dirHit ? '#00ff88' : '#ff4757' }}>
                              方向{r.roi?.detail?.dirHit ? '✓' : '✗'}
                              <span className="text-[8px] text-[#555555] ml-0.5">({oddsSourceLabel(r.roi?.detail?.oddsSource?.dir || '')}@{r.roi?.detail?.odds?.dir})</span>
                            </span>
                            <span style={{ color: r.roi?.detail?.top3Hit ? '#ffa502' : '#555555' }}>
                              TOP3{r.roi?.detail?.top3Hit ? (r.roi?.detail?.top1Hit ? '🎯' : '✓') : '✗'}
                              <span className="text-[8px] text-[#555555] ml-0.5">({oddsSourceLabel(r.roi?.detail?.oddsSource?.score || '')}@{r.roi?.detail?.odds?.score})</span>
                            </span>
                            <RoiMini v={r.roi?.cons ?? null} label="保守" />
                            <RoiMini v={r.roi?.bal ?? null} label="平衡" />
                            <RoiMini v={r.roi?.agg ?? null} label="激进" />
                          </div>
                          {r.roi?.detail?.oddsSource?.ou !== 'model' && r.roi?.detail?.ouHit !== null && (
                            <div className="text-[9px] text-[#555555]">
                              大小球: {r.roi?.detail?.ouHit ? '✓' : '✗'}
                              <span className="ml-0.5">({oddsSourceLabel(r.roi?.detail?.oddsSource?.ou || '')}@{r.roi?.detail?.odds?.ou})</span>
                              {r.roi?.detail?.parlayHit && <span className="ml-2">串关: ✓@{r.roi?.detail?.odds?.parlay}</span>}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#ffd700]/30 bg-[#1a1f3a]">
              <td></td>
              <td className="py-2.5 px-2 text-[#ffd700] font-bold text-[10px]">历史累计</td>
              <td className="py-2.5 px-2 text-center text-[#555555]">{dailyData.total.fields}场</td>
              <RoiCell v={dailyData.total.cons} />
              <RoiCell v={dailyData.total.bal} />
              <RoiCell v={dailyData.total.agg} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="text-[10px] text-[#a0a0a0] border-t border-[#1a1f3a] pt-3">
        <p>• 大盘口赔率按市场均价估算 · 大小球/串关按退回本金处理 · 实际以 Bet365 即时赔率为准</p>
      </div>
    </section>
  )
}

function RoiCell({ v }: { v: number }) {
  return (
    <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: v > 0 ? '#00ff88' : v < 0 ? '#ff4757' : '#555555' }}>
      {v > 0 ? '+' : ''}{v}%
    </td>
  )
}

function RoiMini({ v, label }: { v: number | null; label: string }) {
  if (v === null) return <span className="text-[#555555]">{label}:—</span>
  return (
    <span className="font-mono" style={{ color: v > 0 ? '#00ff88' : v < 0 ? '#ff4757' : '#555555' }}>
      {label}:{v > 0 ? '+' : ''}{v}%
    </span>
  )
}
