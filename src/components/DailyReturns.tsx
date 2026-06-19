import { useState, useMemo } from 'react'
import type { Match, Prediction } from '../lib/types'
import { preciseMatchROI, oddsSourceLabel } from '../lib/preciseRoi'
import type { RoiResult } from '../lib/preciseRoi'
import { cn } from '../data/matches'

export default function DailyReturns({ historicalMatches, predictions }: {
  historicalMatches: Match[]
  predictions: Record<string, Prediction>
}) {
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
      const rows = ms.map((m, i) => {
        const r = rois[i]
        return { match: m, roi: r, home: cn(m.homeTeam), away: cn(m.awayTeam) }
      })
      return { date, count: ms.length, cons, bal, agg, rows }
    })
    return { days: result, total: { cons: totalCons, bal: totalBal, agg: totalAgg, fields: totalFields } }
  }, [historicalMatches, predictions])

  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  if (dailyData.days.length === 0) return (
    <section className="bg-[#141937] rounded-xl border border-[#1a1f3a] p-5">
      <h3 className="text-xs font-bold text-[#a0a0a0] mb-2 uppercase tracking-wider">💰 比赛日收益分析</h3>
      <p className="text-[10px] text-[#555555]">暂无完赛数据（历史比赛{historicalMatches.length}场，有预测{historicalMatches.filter(m => predictions[m.id]).length}场，可计算{predictions ? Object.keys(predictions).length : 0}条）</p>
    </section>
  )

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
                    <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: d.cons > 0 ? '#00ff88' : d.cons < 0 ? '#ff4757' : '#555555' }}>
                      {d.cons > 0 ? '+' : ''}{d.cons}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: d.bal > 0 ? '#00ff88' : d.bal < 0 ? '#ff4757' : '#555555' }}>
                      {d.bal > 0 ? '+' : ''}{d.bal}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: d.agg > 0 ? '#00ff88' : d.agg < 0 ? '#ff4757' : '#555555' }}>
                      {d.agg > 0 ? '+' : ''}{d.agg}%
                    </td>
                  </tr>
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
              <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: dailyData.total.cons > 0 ? '#00ff88' : dailyData.total.cons < 0 ? '#ff4757' : '#555555' }}>
                {dailyData.total.cons > 0 ? '+' : ''}{dailyData.total.cons}%
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: dailyData.total.bal > 0 ? '#00ff88' : dailyData.total.bal < 0 ? '#ff4757' : '#555555' }}>
                {dailyData.total.bal > 0 ? '+' : ''}{dailyData.total.bal}%
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: dailyData.total.agg > 0 ? '#00ff88' : dailyData.total.agg < 0 ? '#ff4757' : '#555555' }}>
                {dailyData.total.agg > 0 ? '+' : ''}{dailyData.total.agg}%
              </td>
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

function RoiMini({ v, label }: { v: number | null; label: string }) {
  if (v === null) return <span className="text-[#555555]">{label}:—</span>
  return (
    <span className="font-mono" style={{ color: v > 0 ? '#00ff88' : v < 0 ? '#ff4757' : '#555555' }}>
      {label}:{v > 0 ? '+' : ''}{v}%
    </span>
  )
}
