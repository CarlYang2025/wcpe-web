import type { Match, Prediction } from '../lib/types'
import { QUADRANT_NAMES, QUADRANT_COLORS, RISK_COLORS } from '../lib/types'
import { cn, flag } from '../data/matches'
import { formatCountdown, useLiveMinute } from '../lib/useMatchTimer'

interface Props {
  match: Match
  prediction?: Prediction
  onClick: () => void
}

export default function MatchCard({ match, prediction, onClick }: Props) {
  if (!prediction) {
    return (
      <div className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-4 cursor-pointer opacity-50 hover:opacity-75 transition-opacity">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1f3a] text-[#a0a0a0]">
            {match.group} · {match.round} · 第{match.matchday}比赛日
          </span>
          <StatusBadge match={match} />
        </div>
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="text-center"><div className="text-2xl mb-1">{flag(match.homeTeam)}</div><div className="text-base font-bold text-white">{cn(match.homeTeam)}</div></div>
          <div className="text-[#a0a0a0] text-xs font-bold px-2">VS</div>
          <div className="text-center"><div className="text-2xl mb-1">{flag(match.awayTeam)}</div><div className="text-base font-bold text-white">{cn(match.awayTeam)}</div></div>
        </div>
        <div className="text-center py-4">
          <div className="text-sm text-[#555555]">⏳ 预测生成中...</div>
          <div className="text-[9px] text-[#555555] mt-1">数据将在比赛日前自动生成</div>
        </div>
      </div>
    )
  }

  const quadrantColor = QUADRANT_COLORS[prediction.top5Scores?.[0]?.quadrant] || '#ffffff'
  const riskColor = RISK_COLORS[prediction.riskLevel]

  return (
    <div
      onClick={onClick}
      className="card-hover bg-[#141937] border border-[#1a1f3a] rounded-xl p-4 cursor-pointer"
    >
      {/* Status badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1f3a] text-[#a0a0a0]">
          {match.group} · {match.round} · 第{match.matchday}比赛日
        </span>
        <StatusBadge match={match} />
      </div>

      {/* Teams */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl mb-1">{flag(match.homeTeam)}</div>
          <div className="text-base font-bold text-white flex items-center justify-center gap-1">
            <span className="text-[8px] px-1 py-0.5 rounded bg-[#00ff88]/20 text-[#00ff88] font-bold">主</span>
            {cn(match.homeTeam)}
          </div>
        </div>
        <div className="text-[#a0a0a0] text-xs font-bold px-2">VS</div>
        <div className="text-center">
          <div className="text-2xl mb-1">{flag(match.awayTeam)}</div>
          <div className="text-base font-bold text-white flex items-center justify-center gap-1">
            {cn(match.awayTeam)}
            <span className="text-[8px] px-1 py-0.5 rounded bg-[#ff4757]/20 text-[#ff4757] font-bold">客</span>
          </div>
        </div>
      </div>

      {/* Score display */}
      <div className="text-center mb-3">
        {match.status === 'finished' && match.homeScore !== undefined ? (
          <>
            <span className="text-3xl font-black text-white">{match.homeScore}:{match.awayScore}</span>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="text-[9px] text-[#555555]">已完赛</span>
              <span className="text-[9px] text-[#ffd700]/50 line-through">预测 {prediction.predictedScore}</span>
            </div>
          </>
        ) : (
          <>
            <span className="text-3xl font-black text-[#ffd700]">{prediction.predictedScore}</span>
            <div className="text-[10px] text-[#a0a0a0] mt-1">预测比分</div>
          </>
        )}
      </div>

      {/* Probability bars */}
      <div className="space-y-1 mb-3">
        <ProbBar label={cn(match.homeTeam)} value={prediction.homeWinProb} color="#00ff88" />
        <ProbBar label="平" value={prediction.drawProb} color="#54a0ff" />
        <ProbBar label={cn(match.awayTeam)} value={prediction.awayWinProb} color="#ff4757" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1a1f3a]">
        <span className="text-[10px] px-2 py-0.5 rounded" style={{
          backgroundColor: quadrantColor + '20', color: quadrantColor,
        }}>
          {QUADRANT_NAMES[prediction.top5Scores?.[0]?.quadrant]}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#a0a0a0]">
            信心 {(prediction.confidence * 100).toFixed(0)}%
          </span>
          <span className="text-[10px]" style={{ color: riskColor }}>
            {prediction.riskLevel === 'High' ? '高' : prediction.riskLevel === 'Medium' ? '中' : '低'}风险
          </span>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ match }: { match: Match }) {
  const liveMinute = useLiveMinute(match)

  if (match.status === 'finished') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#555555]/20 text-[#555555]">
        已完赛 {match.homeScore}:{match.awayScore}
      </span>
    )
  }
  if (match.status === 'live') {
    const minuteText = liveMinute !== null ? `${liveMinute}'` : ''
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ff4757]/20 text-[#ff4757]">
        <span className="animate-pulse">●</span> {minuteText} 进行中
      </span>
    )
  }
  // upcoming
  const cd = formatCountdown(match.kickoff)
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffa502]/20 text-[#ffa502]">
      {cd}
    </span>
  )
}

function ProbBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#a0a0a0] w-12 text-right">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[#1a1f3a] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{
          width: `${value * 100}%`, backgroundColor: color,
        }} />
      </div>
      <span className="text-[10px] font-mono w-8" style={{ color }}>{(value * 100).toFixed(0)}%</span>
    </div>
  )
}
