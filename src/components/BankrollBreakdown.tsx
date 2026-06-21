import type { BankrollPlan, Match, Prediction } from '../lib/types'
import { cn, flag } from '../data/matches'

interface Props {
  bankroll: {
    conservative: BankrollPlan
    balanced: BankrollPlan
    aggressive: BankrollPlan
  }
  match: Match
  prediction: Prediction
}

type BetLine = { what: string; odds: string; alloc: number; returns: number }

export default function BankrollBreakdown({ bankroll, match, prediction }: Props) {
  const home = cn(match.homeTeam)
  const away = cn(match.awayTeam)
  const dir = prediction.predictedDirection === 'home_win' ? `${home}胜`
    : prediction.predictedDirection === 'away_win' ? `${away}胜` : '平局'
  const dirOdds = prediction.predictedDirection === 'home_win' ? '1.29'
    : prediction.predictedDirection === 'away_win' ? '1.43' : '3.90'
  const topScores = prediction.top5Scores.slice(0, 3)
  const over = prediction.over25Prob > 0.5
  const ouLabel = over ? '大2.5' : '小2.5'
  const ouOdds = over ? '1.90' : '1.87'

  function planLines(alloc: Record<string, number>): BetLine[] {
    const lines: BetLine[] = []
    if (alloc['胜平负']) {
      const a = alloc['胜平负']
      lines.push({ what: `${dir}`, odds: `@${dirOdds}`, alloc: a, returns: Math.round(a * parseFloat(dirOdds)) })
    }
    if (alloc['比分']) {
      const a = alloc['比分']
      const numScores = Math.min(topScores.length, 3)
      const base = Math.floor(a / numScores)
      const remainder = a - base * numScores
      topScores.slice(0, numScores).forEach((s, i) => {
        const scoreOdds = i === 0 ? 6.00 : i === 1 ? 7.00 : 8.00
        const piece = base + (i < remainder ? 1 : 0)
        lines.push({ what: `比分 ${s.score}`, odds: `@${scoreOdds.toFixed(2)}`, alloc: piece, returns: Math.round(piece * scoreOdds) })
      })
    }
    if (alloc['大小球']) {
      const a = alloc['大小球']
      lines.push({ what: `${ouLabel}`, odds: `@${ouOdds}`, alloc: a, returns: Math.round(a * parseFloat(ouOdds)) })
    }
    if (alloc['串关']) {
      const a = alloc['串关']
      lines.push({ what: '串关预留', odds: '', alloc: a, returns: 0 })
    }
    return lines
  }

  const plans = [
    { key: 'conservative', name: '保守', plan: bankroll.conservative, color: '#00ff88' },
    { key: 'balanced', name: '平衡', plan: bankroll.balanced, color: '#ffa502' },
    { key: 'aggressive', name: '激进', plan: bankroll.aggressive, color: '#ff4757' },
  ]

  return (
    <div className="space-y-5">
      {plans.map(({ name, plan, color }) => {
        const lines = planLines(plan.allocations)

        return (
          <div key={name} className="border border-[#1a1f3a] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: color + '10' }}>
              <span className="text-sm font-black" style={{ color }}>{name}方案</span>
              <span className="text-[10px] text-[#a0a0a0]">100%预算 · 预期回报 <span style={{ color }}>+{plan.expectedReturn}%</span></span>
            </div>
            <div className="p-4">
              <div className="divide-y divide-[#1a1f3a]">
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono">{l.what}</span>
                      <span className="text-[#a0a0a0] font-mono">{l.odds}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#555555]">投<span className="text-white">{l.alloc}%</span>
                        {l.returns > 0 ? ` → 回<span className="text-[#ffd700]">${l.returns}%</span>` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-[#1a1f3a] text-[9px] text-[#555555]">
                总计 {lines.reduce((s, l) => s + l.alloc, 0)}% → 预期回收 ~{100 + plan.expectedReturn}%
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
