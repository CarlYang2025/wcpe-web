import type { Match, Prediction, PostMatchReview } from '../lib/types'
import { cn } from '../data/matches'
import { preciseMatchROI } from '../lib/preciseRoi'

function Roi({ v, label }: { v: number; label: string }) {
  const color = v > 0 ? '#00ff88' : v < 0 ? '#ff4757' : '#555555'
  const sign = v > 0 ? '+' : ''
  return <span className="text-[9px] font-mono" style={{ color }} title={`${label}：${sign}${v}%`}>{sign}{v}%</span>
}

interface Props {
  matches: Match[]
  predictions: Record<string, Prediction>
  reviews: Record<string, PostMatchReview>
  onSelect?: (match: Match) => void
}

export default function RecapTable({ matches, predictions, reviews, onSelect }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1a1f3a] text-[#a0a0a0]">
            <th className="text-left py-2.5 px-3">日期</th>
            <th className="text-left py-2.5 px-3">比赛</th>
            <th className="text-center py-2.5 px-3 whitespace-nowrap">预 → 实</th>
            <th className="text-center py-2.5 px-2 whitespace-nowrap">方向</th>
            <th className="text-center py-2.5 px-2 whitespace-nowrap">TOP3</th>
            <th className="text-center py-2.5 px-2 whitespace-nowrap">TOP1</th>
            <th className="text-center py-2.5 px-2 hidden md:table-cell whitespace-nowrap">方案收益</th>
            <th className="text-left py-2.5 px-3 hidden md:table-cell">复盘</th>
          </tr>
        </thead>
        <tbody>
          {matches.map(match => {
            const pred = predictions[match.id]
            const review = reviews[match.id]
            const hasPrediction = !!pred
            const hasResult = match.homeScore !== undefined && match.awayScore !== undefined

            // 方向判断：有预测 + 有比分即可，不需要依赖 review
            let directionHit: boolean | null = null
            if (hasPrediction && hasResult) {
              const actualDirection = match.homeScore! > match.awayScore! ? 'home_win'
                : match.homeScore! < match.awayScore! ? 'away_win' : 'draw'
              directionHit = pred!.predictedDirection === actualDirection
            }

            // 比分判断：有预测 + 有比分即可，不需要依赖 review
            let scoreHitTop3: boolean | null = null
            let scoreHitTop1: boolean | null = null
            if (hasPrediction && hasResult) {
              const actualScore = `${match.homeScore}:${match.awayScore}`
              const top5 = pred!.top5Scores
              if (Array.isArray(top5) && top5.length > 0) {
                scoreHitTop3 = top5.slice(0, 3).some(s => (typeof s === 'object' && s !== null ? (s as any).score : s) === actualScore)
                const first = top5[0]
                scoreHitTop1 = (typeof first === 'object' && first !== null ? (first as any).score : first) === actualScore
              }
            }

            return (
              <tr key={match.id} className="border-b border-[#1a1f3a] hover:bg-[#1a1f3a] transition-colors cursor-pointer"
                onClick={() => onSelect?.(match)}>
                <td className="py-2.5 px-3 text-[#555555] font-mono text-[10px]">{match.date.slice(5)}</td>
                <td className="py-2.5 px-3">
                  <div className="font-medium text-white text-[11px]">
                    <span className="text-[8px] px-1 py-0.5 rounded bg-[#00ff88]/20 text-[#00ff88] mr-1">主</span>
                    {cn(match.homeTeam)}
                    <span className="text-[#555555] mx-1">vs</span>
                    <span className="text-[8px] px-1 py-0.5 rounded bg-[#ff4757]/20 text-[#ff4757] mr-1">客</span>
                    {cn(match.awayTeam)}
                  </div>
                  <div className="text-[9px] text-[#555555]">{match.group}</div>
                </td>
                <td className="text-center py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                  <span style={{ color: hasPrediction ? '#ffd700' : '#555555' }}>{hasPrediction ? pred!.predictedScore : '-'}</span>
                  <span className="text-[#555555] mx-0.5">→</span>
                  <span className="font-bold" style={{ color: hasResult ? '#ffffff' : '#555555' }}>{hasResult ? `${match.homeScore}:${match.awayScore}` : '-'}</span>
                </td>
                <td className="text-center py-2.5 px-2">
                  {directionHit === true
                    ? <span className="text-[#00ff88] text-xs">✓</span>
                    : directionHit === false
                      ? <span className="text-[#ff4757] text-xs">✗</span>
                      : <span className="text-[#555555] text-xs">-</span>
                  }
                </td>
                <td className="text-center py-2.5 px-2">
                  {scoreHitTop3 === true
                    ? <span className="text-sm">🎯</span>
                    : scoreHitTop3 === false
                      ? <span className="text-[#ff4757] text-xs">✗</span>
                      : <span className="text-[#555555] text-xs">-</span>
                  }
                </td>
                <td className="text-center py-2.5 px-2">
                  {scoreHitTop1 === true
                    ? <span className="text-sm">🎯</span>
                    : scoreHitTop1 === false
                      ? <span className="text-[#ff4757] text-xs">✗</span>
                      : <span className="text-[#555555] text-xs">-</span>
                  }
                </td>
                <td className="py-2.5 px-2 hidden md:table-cell">
                  {(() => {
                    const roi = pred ? preciseMatchROI(match, pred) : null
                    if (!roi) return <span className="text-[#555555] text-[9px]">-</span>
                    return (
                      <div className="flex flex-col gap-0.5">
                        <Roi v={roi.cons} label="保守" />
                        <Roi v={roi.bal} label="平衡" />
                        <Roi v={roi.agg} label="激进" />
                      </div>
                    )
                  })()}
                </td>
                <td className="py-2.5 px-3 hidden md:table-cell">
                  <span className="text-[#a0a0a0] text-[10px] line-clamp-2 leading-relaxed">
                    {review ? ((Array.isArray(review.errorReasons) ? review.errorReasons[0] : undefined) || (Array.isArray(review.hitItems) ? review.hitItems[0] : undefined) || '—') : (hasPrediction ? '—' : '未预测')}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
