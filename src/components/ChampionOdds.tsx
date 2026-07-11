import { useMemo } from 'react'
import type { Match } from '../lib/types'
import { teamRatings, cn, flag } from '../data/matches'
import { computeChampionModel } from '../lib/championModel'

interface Props {
  matches: Match[]
  eloRatings: Record<string, number>
  lastUpdated?: Date | null
}

export default function ChampionOdds({ matches, eloRatings, lastUpdated }: Props) {
  const fallbackElo = useMemo(() => {
    const m: Record<string, number> = {}
    for (const [team, r] of Object.entries(teamRatings)) m[team] = r.elo
    return m
  }, [])

  const model = useMemo(
    () => computeChampionModel(matches, eloRatings, fallbackElo),
    [matches, eloRatings, fallbackElo],
  )

  // 未进入淘汰赛则不显示模块
  if (!model.ready || model.entries.length === 0) return null

  const top = model.entries[0]
  const maxProb = model.entries[0]?.prob || 1
  const updatedText = lastUpdated
    ? lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#ffd700]/30 bg-gradient-to-br from-[#1a1608] via-[#141937] to-[#0d1030] p-5 shadow-[0_0_40px_-12px_rgba(255,215,0,0.25)]">
      {/* 顶部装饰光晕 */}
      <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-[#ffd700]/10 blur-3xl" />

      {/* 头部 */}
      <div className="relative flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <div>
            <h2 className="text-base font-black tracking-wide text-[#ffd700]">总冠军归属预测</h2>
            <p className="text-[9px] text-[#8a8fa8]">Elo 概率 × 赛程推演 · 精确解析 · 实时动态</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ffd700]/15 text-[#ffd700] border border-[#ffd700]/30">
            当前阶段 · {model.stage}
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] text-[#00ff88]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff88] opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
            </span>
            实时{updatedText && ` · ${updatedText}`}
          </span>
        </div>
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 左：冠军概率榜 */}
        <div className="lg:col-span-2">
          {/* 夺冠热门横幅 */}
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#ffd700]/10 border border-[#ffd700]/25 px-4 py-2.5">
            <span className="text-2xl">{flag(top.team)}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-[#ffd700]/70 font-bold tracking-widest uppercase">夺冠热门</div>
              <div className="text-sm font-black text-white truncate">
                {cn(top.team)}
                <span className="ml-2 text-[10px] font-normal text-[#8a8fa8]">
                  进决赛 {(top.reachFinalProb * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="text-2xl font-black text-[#ffd700] tabular-nums">
              {(top.prob * 100).toFixed(1)}<span className="text-sm">%</span>
            </div>
          </div>

          {/* 概率条列表 */}
          <div className="space-y-1.5">
            {model.entries.map((e, i) => {
              const pct = e.prob * 100
              const barW = Math.max(3, (e.prob / maxProb) * 100)
              const isTop = i === 0
              const color = isTop ? '#ffd700' : i === 1 ? '#54a0ff' : i === 2 ? '#00d2a0' : '#5a6180'
              return (
                <div key={e.team} className="flex items-center gap-2.5 text-[11px]">
                  <span className="w-4 text-right text-[#555b78] font-mono">{i + 1}</span>
                  <span className="text-sm w-5 text-center">{flag(e.team)}</span>
                  <span className="w-16 shrink-0 truncate text-[#c9cde0] font-medium">{cn(e.team)}</span>
                  {/* 进度条 */}
                  <div className="flex-1 h-5 rounded-md bg-[#0a0e27]/60 relative overflow-hidden">
                    <div
                      className="h-full rounded-md transition-all duration-700 ease-out"
                      style={{
                        width: `${barW}%`,
                        background: `linear-gradient(90deg, ${color}66, ${color})`,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center px-2 gap-1.5">
                      {e.advanced && (
                        <span className="text-[8px] px-1 rounded bg-[#00ff88]/20 text-[#00ff88] font-bold border border-[#00ff88]/30">
                          已进{model.stage === '8强' ? '4强' : '下轮'}
                        </span>
                      )}
                      <span className="text-[8px] text-[#8a8fa8]">
                        {e.region === 'top' ? '上半区' : '下半区'}
                      </span>
                    </div>
                  </div>
                  <span className="w-12 text-right font-mono font-black tabular-nums" style={{ color }}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>

          {model.recentlyOut.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap text-[9px] text-[#6b7192]">
              <span className="text-[#555b78]">本轮出局：</span>
              {model.recentlyOut.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0a0e27]/60 line-through decoration-[#ff4757]/60">
                  {flag(t)} {cn(t)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 右：关键对阵推演 */}
        <div className="rounded-xl bg-[#0a0e27]/40 border border-[#1a1f3a] p-3">
          <h3 className="text-[10px] font-bold text-[#8a8fa8] uppercase tracking-wider mb-2.5">关键对阵推演</h3>
          <div className="space-y-2.5">
            {model.fixtures.map((f, idx) => {
              const homeFav = f.pHome >= f.pAway
              return (
                <div key={idx} className="text-[10px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-bold text-[#ffa502]">{f.round}</span>
                    {f.decided
                      ? <span className="text-[8px] text-[#00ff88]">待赛</span>
                      : <span className="text-[8px] text-[#555b78]">推演</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`flex-1 text-right truncate ${homeFav ? 'text-white font-bold' : 'text-[#8a8fa8]'}`}>
                      {cn(f.home)} {flag(f.home)}
                    </span>
                    <span className="text-[8px] text-[#555b78] px-1">vs</span>
                    <span className={`flex-1 truncate ${!homeFav ? 'text-white font-bold' : 'text-[#8a8fa8]'}`}>
                      {flag(f.away)} {cn(f.away)}
                    </span>
                  </div>
                  {/* 晋级概率条 */}
                  <div className="flex h-2 rounded-full overflow-hidden mt-1 bg-[#0a0e27]">
                    <div className="h-full bg-[#54a0ff]/70" style={{ width: `${f.pHome * 100}%` }} />
                    <div className="h-full bg-[#ff6b6b]/60" style={{ width: `${f.pAway * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-[8px] text-[#6b7192] mt-0.5 tabular-nums">
                    <span>{(f.pHome * 100).toFixed(0)}%</span>
                    <span>{(f.pAway * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )
            })}
            {model.fixtures.length === 0 && (
              <p className="text-[9px] text-[#555b78]">对阵待定，等待本轮比赛结果</p>
            )}
          </div>
        </div>
      </div>

      <p className="relative mt-4 text-[8px] text-[#555b78] leading-relaxed">
        算法：单场胜负采用 Elo 概率公式 P = 1/(1+10^((Eб−Eа)/400))，淘汰赛按加时/点球最终分胜负；
        对阵树自底向上分布传播精确求解，全场概率之和恒为 100%。已完赛结果锁定晋级方，
        未决对阵按当前动态 Elo 推演。数据随比赛结果与 Elo 复盘实时刷新 · 仅供参考，不构成投注建议。
      </p>
    </section>
  )
}
