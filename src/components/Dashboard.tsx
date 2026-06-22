import { useState, useMemo } from 'react'
import type { Match, Prediction, PostMatchReview, ModelState } from '../lib/types'
import { teamRatings, cn, flag } from '../data/matches'
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


      {/* Model */}
      <section className="bg-[#141937] rounded-xl border border-[#1a1f3a] p-5">
        <h3 className="text-xs font-bold text-[#a0a0a0] mb-4 uppercase tracking-wider">模型状态</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <MetricBox label="总预测" value={String(modelState.completedPredictions)} unit={`/${modelState.totalPredictions}`} />
          <MetricBox label="方向命中" value={`${Math.round(modelState.directionAccuracy * 100)}`} unit="%" color="#00ff88" detail={`${modelState.directionCorrect}/${modelState.completedPredictions}`} />
          <MetricBox label="TOP3比分" value={`${Math.round(modelState.scoreTop3Accuracy * 100)}`} unit="%" color="#ffa502" detail={`${modelState.scoreTop3Correct}/${modelState.completedPredictions}`} />
          <MetricBox label="TOP1比分" value={`${Math.round(modelState.scoreTop1Accuracy * 100)}`} unit="%" color="#54a0ff" detail={`${modelState.scoreTop1Correct}/${modelState.completedPredictions}`} />
          <MetricBox label="赛事平局率" value={`${Math.round(modelState.overallDrawRate * 100)}`} unit="%" color="#a0a0a0" detail={`${(modelState as any).overallDrawCount ?? 0}平/${modelState.overallTotalMatches}场`} />
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
              <div className="text-[9px] text-[#555555] mt-2">权重和=100%，基于{modelState.factorWeights?.eloDiff?.samples ?? modelState.completedPredictions ?? 0}场已完赛学习</div>
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
