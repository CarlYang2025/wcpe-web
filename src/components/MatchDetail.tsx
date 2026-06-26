import type { Match, Prediction, PostMatchReview } from '../lib/types'
import { QUADRANT_NAMES, QUADRANT_COLORS, RISK_COLORS } from '../lib/types'
import { teamRatings, cn, flag } from '../data/matches'
import { useLiveMinute } from '../lib/useMatchTimer'
import QuadrantChart from './QuadrantChart'
import MviTable from './MviTable'
import BankrollBreakdown from './BankrollBreakdown'

/**
 * Reclassify a score into quadrant based purely on the score itself.
 * Mirrors classifyQuadrant() in analysis-engine.ts.
 * Corrects stale quadrant values from old automation data.
 */
function reclassifyQuadrant(score: string, homeWinProb: number, awayWinProb: number): string {
  const parts = score.split(/[:-]/);
  if (parts.length !== 2) return 'Q2';
  const h = parseInt(parts[0]);
  const a = parseInt(parts[1]);
  if (isNaN(h) || isNaN(a)) return 'Q2';

  const homeStrong = homeWinProb > 0.45 && (homeWinProb - awayWinProb) >= 0.15;
  const awayStrong = awayWinProb > 0.45 && (awayWinProb - homeWinProb) >= 0.15;
  const diff = Math.abs(h - a);
  const total = h + a;

  if (homeStrong && h < a) return 'Q3';
  if (awayStrong && h > a) return 'Q3';

  if (homeStrong && h > a && diff >= 2) return 'Q1';
  if (awayStrong && h < a && diff >= 2) return 'Q1';

  if (total >= 4 && h >= 2 && a >= 2) return 'Q4';

  if (diff >= 3) return 'Q1';

  return 'Q2';
}

interface Props {
  match: Match
  prediction?: Prediction
  review?: PostMatchReview
  onBack: () => void
}

const dimLabels: Record<string, string> = { attack: '进攻', defense: '防守', form: '状态', tournament: '大赛' }
const hColors = ['#00ff88', '#54a0ff', '#ffd700', '#a55eea']
const aColors = ['#ff4757', '#ffa502', '#ff4757', '#54a0ff']

export default function MatchDetail({ match, prediction, review, onBack }: Props) {
  if (!prediction) {
    return (
      <div className="text-center py-20 text-[#a0a0a0]">
        该比赛尚未生成预测报告
        <button onClick={onBack} className="block mx-auto mt-4 text-[#ffd700] underline">返回首页</button>
      </div>
    )
  }

  const homeRating = teamRatings[match.homeTeam]
  const awayRating = teamRatings[match.awayTeam]
  const homeName = cn(match.homeTeam)
  const awayName = cn(match.awayTeam)
  const homeFlag = flag(match.homeTeam)
  const awayFlag = flag(match.awayTeam)
  const ra = prediction.richAnalysis

  const liveMinute = useLiveMinute(match)
  const statusText = match.status === 'finished' ? '已完赛'
    : match.status === 'live' ? `● ${liveMinute !== null ? liveMinute + "' " : ''}进行中`
    : '待开赛'
  const statusColor = match.status === 'finished' ? '#a0a0a0' : match.status === 'live' ? '#ff4757' : '#ffa502'

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-[#a0a0a0] hover:text-[#ffd700] transition-colors text-sm">← 返回首页</button>

      {/* ====== 1. 比赛概览 ====== */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <M num="1" label="比赛概览" />
        <div className="text-center mb-3">
          <div className="text-[10px] text-[#a0a0a0] mb-2">
            <span className="text-white">{match.tournament}</span> · {match.group} · {match.round} · 第{match.matchday}比赛日
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: statusColor + '20', color: statusColor }}>{statusText}</span>
          <div className="flex items-center justify-center gap-8 my-5">
            <div className="text-center"><div className="text-4xl mb-1">{homeFlag}</div><div className="text-xl font-black text-white">{homeName}</div><div className="text-[9px] text-[#a0a0a0] mt-1">主队</div></div>
            <div className="text-center"><div className="text-4xl font-black text-[#ffd700] font-mono">{match.homeScore !== undefined ? `${match.homeScore} : ${match.awayScore}` : 'VS'}</div></div>
            <div className="text-center"><div className="text-4xl mb-1">{awayFlag}</div><div className="text-xl font-black text-white">{awayName}</div><div className="text-[9px] text-[#a0a0a0] mt-1">客队</div></div>
          </div>
          <div className="text-[11px] text-[#555555] mt-2 flex items-center justify-center gap-6">
            <span>📍 当地 {match.localKickoff} {match.localTZ}</span><span>🕐 北京 {match.kickoff}</span>
          </div>
        </div>
      </section>

      {/* ====== 2. 数据分析 ====== */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <M num="2" label="数据分析" />
        {ra && (ra.formData || ra.h2h || ra.lineup) ? (
          <div className="space-y-3 text-xs text-[#a0a0a0] leading-relaxed">
            {ra.formData && <div><h4 className="text-[#54a0ff] font-bold mb-1">📈 近期战绩</h4><p>{ra.formData}</p></div>}
            {ra.h2h && <div className="pt-1"><h4 className="text-[#ffa502] font-bold mb-1">🤝 历史交锋</h4><p>{ra.h2h}</p></div>}
            {ra.lineup && <div className="pt-1"><h4 className="text-[#a55eea] font-bold mb-1">👥 阵容情况</h4><p>{ra.lineup}</p></div>}
          </div>
        ) : (
          homeRating && awayRating && (
            <div className="mb-4">
              <h4 className="text-xs text-[#a0a0a0] mb-4 font-bold">球队四维评分对比</h4>
              <div className="space-y-2.5">
                {(['attack', 'defense', 'form', 'tournament'] as const).map((key, idx) => {
                  const hv = homeRating[key], av = awayRating[key], hp = hv / 100, ap = av / 100
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-[44%] flex items-center gap-1">
                        <span className="text-sm">{homeFlag}</span><span className="text-[10px] font-mono font-bold w-6 text-right" style={{ color: hColors[idx] }}>{hv}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-[#1a1f3a] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${hp * 100}%`, backgroundColor: hColors[idx] }} /></div>
                      </div>
                      <span className="text-[10px] text-[#555555] w-8 text-center">{dimLabels[key]}</span>
                      <div className="w-[44%] flex items-center gap-1 justify-end">
                        <div className="flex-1 h-2.5 rounded-full bg-[#1a1f3a] overflow-hidden"><div className="h-full rounded-full ml-auto" style={{ width: `${ap * 100}%`, backgroundColor: aColors[idx] }} /></div>
                        <span className="text-[10px] font-mono font-bold w-6 text-left" style={{ color: aColors[idx] }}>{av}</span><span className="text-sm">{awayFlag}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        )}
        <div className="text-[9px] text-[#555555] border-t border-[#1a1f3a] pt-2 mt-3">数据源: FootballExplorer · Bet365 · 101GreatGoals | {match.date} 比赛日</div>
      </section>

      {/* ====== 3. 战术分析 ====== */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <M num="3" label="战术分析" />
        {ra?.tactics ? (
          <p className="text-xs text-[#a0a0a0] leading-relaxed">{ra.tactics}</p>
        ) : (
          <p className="text-xs text-[#a0a0a0] leading-relaxed">
            {(() => {
              const { predictedDirection, predictedScore, homeWinProb, drawProb, awayWinProb, over25Prob, factorBreakdown, confidence, riskLevel, riskWarnings, top5Scores, mviAnalysis } = prediction
              const ft = factorBreakdown
              const isFinished = match.status === 'finished'
              const actualScore = isFinished && match.homeScore !== undefined && match.awayScore !== undefined
                ? `${match.homeScore}:${match.awayScore}` : null
              const predCorrect = actualScore && predictedScore === actualScore

              // Build a natural-language paragraph from all available data
              const parts: string[] = []

              // Opening: direction & key insight from top5Scores reason
              const topReason = top5Scores?.[0]?.reason || ''
              const secondReason = top5Scores?.[1]?.reason || ''
              if (predictedDirection === 'home_win') {
                const edge = ft?.eloDiffScore != null
                  ? (ft.eloDiffScore > 0.7 ? '实力碾压' : ft.eloDiffScore > 0.45 ? '明显占优' : '稍占优势')
                  : (homeWinProb > 0.65 ? '实力碾压' : homeWinProb > 0.5 ? '明显占优' : '稍占优势')
                const reason = topReason || `${homeName}预计占据主动`
                parts.push(`${homeName}${edge}。${reason}。`)
              } else if (predictedDirection === 'away_win') {
                const edge = ft?.eloDiffScore != null
                  ? (ft.eloDiffScore < -0.7 ? '客队实力碾压' : ft.eloDiffScore < -0.45 ? '客队明显占优' : '客队稍占优势')
                  : (awayWinProb > 0.65 ? '客队实力碾压' : awayWinProb > 0.5 ? '客队明显占优' : '客队稍占优势')
                const reason = topReason || `${awayName}预计反客为主`
                parts.push(`${awayName}${edge}。${reason}。`)
              } else {
                const h = Math.round(homeWinProb * 100)
                const d = Math.round(drawProb * 100)
                parts.push(`双方势均力敌（主胜${h}%/平${d}%/客胜${Math.round(awayWinProb*100)}%）。${secondReason || '预计进入慢节奏拉锯战。'}`)
              }

              // Middle: use riskWarnings as the most match-specific insight
              if (riskWarnings && Array.isArray(riskWarnings) && riskWarnings.length > 0) {
                // Pick the most concrete warning (not generic) - look for specific player names or stats
                const concrete = riskWarnings.find(w => /[→]/.test(w)) || riskWarnings[0]
                // Clean up the warning format: remove "→ 结论：" prefix if present, ensure trailing period
                let cleaned = concrete
                  .replace(/\s*→\s*结论[：:]?\s*/g, '：')
                  .replace(/^\s*[-•]\s*/, '')
                  .trim()
                if (cleaned.length > 15) {
                  if (!/[.!?。！？]$/.test(cleaned)) cleaned += '。'
                  parts.push(cleaned)
                }
              }

              // Goal context: use MVI if available for added nuance
              const over25MVI = mviAnalysis?.find((m: any) => m.bet?.includes('2.5'))
              const goalBet = over25MVI?.rating === '高价值' || over25MVI?.rating === '超级价值'
                ? (over25MVI.bet?.startsWith('大') ? '大球价值偏高' : '小球价值偏高')
                : null

              const score = predictedScore || ''
              const [h, a] = score.split(':').map(Number)
              const total = isNaN(h) || isNaN(a) ? null : h + a
              if (total && actualScore) {
                // Finished match: compare prediction to actual
                parts.push(`预测比分${predictedScore}${predCorrect ? '✓命中' : '，实际' + actualScore}。`)
              } else if (total) {
                const goalDesc = total >= 3 ? '偏向大球' : total <= 1 ? '偏向小球' : '攻守平衡'
                const mviNote = goalBet ? `，${goalBet}` : ''
                const ouPct = typeof over25Prob === 'number' && !isNaN(over25Prob) ? Math.round(over25Prob * 100) : 0
                parts.push(`预计比分${predictedScore}，${goalDesc}（大球概率${ouPct}%${mviNote}）。`)
              }

              // Closing: confidence + key factor insight
              if (ft) {
                // Find the highest and lowest factor scores to highlight
                const factors = [
                  { label: 'ELO差', val: ft.eloDiffScore },
                  { label: '近期状态', val: ft.recentFormScore },
                  { label: '交锋记录', val: ft.h2hScore },
                  { label: '战术克制', val: ft.tacticalScore },
                  { label: '阵容深度', val: ft.squadScore },
                  { label: '市场预期', val: ft.marketScore },
                  { label: '赛程压力', val: ft.pressureScore },
                  { label: '心理因素', val: ft.psychologyScore },
                ].filter(f => f.val != null && !isNaN(f.val))
                if (factors.length >= 2) {
                  const highest = factors.reduce((a, b) => a.val > b.val ? a : b)
                  const lowest = factors.reduce((a, b) => a.val < b.val ? a : b)
                  if (highest.val > 0.7) {
                    parts.push(`关键驱动：${highest.label}(${Math.round(highest.val*100)}分)${highest.val > 0.85 ? '显著' : '较'}强。`)
                  }
                  if (lowest.val < 0.45) {
                    parts.push(`风险因子：${lowest.label}(${Math.round(lowest.val*100)}分)偏低。`)
                  }
                }
              }

              // If we couldn't build anything meaningful, show simple data
              if (parts.length === 0) {
                return `预测方向${predictedDirection === 'home_win' ? homeName + '胜' : predictedDirection === 'away_win' ? awayName + '胜' : '平'}，预计比分${predictedScore}，置信度${Math.round(confidence*100)}%。`
              }

              return parts.join('')
            })()}
          </p>
        )}
      </section>

      {/* ====== 4. 市场分析 ====== */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <M num="4" label="市场分析" />
        {ra?.market && <p className="text-xs text-[#a0a0a0] leading-relaxed mb-3">{ra.market}</p>}
        <div className="grid grid-cols-3 gap-3 text-center mb-3">
          <div className="bg-[#1a1f3a] rounded-lg p-3"><div className="text-xl font-black text-[#00ff88]">{Math.round(prediction.homeWinProb * 100)}%</div><div className="text-[10px] text-[#a0a0a0]">主胜</div></div>
          <div className="bg-[#1a1f3a] rounded-lg p-3"><div className="text-xl font-black text-[#54a0ff]">{Math.round(prediction.drawProb * 100)}%</div><div className="text-[10px] text-[#a0a0a0]">平局</div></div>
          <div className="bg-[#1a1f3a] rounded-lg p-3"><div className="text-xl font-black text-[#ff4757]">{Math.round(prediction.awayWinProb * 100)}%</div><div className="text-[10px] text-[#a0a0a0]">客胜</div></div>
        </div>
        {(prediction as any)._blended && (
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#ffa50220] text-[#ffa502] border border-[#ffa50233]">
              市场混合 · 40%模型 + 60%庄家赔率
            </span>
          </div>
        )}
        <div className="flex justify-center gap-4 text-[10px] text-[#a0a0a0]">
          <span>O 2.5: <b className="text-[#ffa502]">{typeof prediction.over25Prob === 'number' && !isNaN(prediction.over25Prob) ? Math.round(prediction.over25Prob * 100) + '%' : '—'}</b></span>
          <span>U 2.5: <b className="text-[#54a0ff]">{typeof prediction.under25Prob === 'number' && !isNaN(prediction.under25Prob) ? Math.round(prediction.under25Prob * 100) + '%' : '—'}</b></span>
        </div>
      </section>

      {/* ====== 因子权重分析 ====== */}
      {prediction.factorBreakdown && (
        <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
          <M num="5" label="因子权重分析" />
          <p className="text-[10px] text-[#555555] mb-3">8维因子加权组合 → 综合概率。条越长表示该因子对本场判断的影响越大。</p>
          <div className="space-y-1.5">
            {([
              { key: 'eloDiffScore', label: 'ELO差值', value: prediction.factorBreakdown.eloDiffScore },
              { key: 'recentFormScore', label: '近期状态', value: prediction.factorBreakdown.recentFormScore },
              { key: 'h2hScore', label: '历史交锋', value: prediction.factorBreakdown.h2hScore },
              { key: 'marketScore', label: '市场共识', value: prediction.factorBreakdown.marketScore },
              { key: 'tacticalScore', label: '战术匹配', value: prediction.factorBreakdown.tacticalScore },
              { key: 'squadScore', label: '阵容完整', value: prediction.factorBreakdown.squadScore },
              { key: 'pressureScore', label: '出线压力', value: prediction.factorBreakdown.pressureScore },
              { key: 'psychologyScore', label: '心理状态', value: prediction.factorBreakdown.psychologyScore },
            ] as const).map(f => {
              const pct = Math.round(f.value * 100)
              const color = f.value > 0.6 ? '#00ff88' : f.value > 0.4 ? '#ffa502' : '#ff4757'
              return (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="w-16 text-[10px] text-[#a0a0a0] text-right">{f.label}</span>
                  <div className="flex-1 h-5 rounded bg-[#1a1f3a] relative overflow-hidden">
                    <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.3 }} />
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-[10px] font-mono font-bold" style={{ color }}>{pct}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {prediction.confidenceAdjustment && (
            <div className="mt-3 pt-3 border-t border-[#1a1f3a] text-[10px] text-[#555555]">
              ⚙️ 信心调整：{prediction.confidenceAdjustment}
            </div>
          )}
        </section>
      )}

      {/* ====== 历史教训应用 ====== */}
      {prediction.appliedLearnings && prediction.appliedLearnings.length > 0 && (() => {
        // Only show if at least one item has meaningful lesson content (>4 chars)
        const hasRealContent = prediction.appliedLearnings.some(
          (al: any) => al?.lesson && al.lesson.length > 4 && al.lesson !== '历史经验'
        )
        return hasRealContent
      })() && (
        <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
          <M num="6" label="历史教训应用" />
          <p className="text-[10px] text-[#555555] mb-3">本场比赛借鉴了以下从已完赛中积累的经验：</p>
          <div className="space-y-2">
            {prediction.appliedLearnings.map((al, i) => (
              <div key={i} className="flex items-start gap-2 bg-[#1a1f3a] rounded-lg p-2.5 text-xs">
                <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{
                  backgroundColor: al.impact === '上调' ? '#00ff8820' : al.impact === '下调' ? '#ff475720' : '#55555520',
                  color: al.impact === '上调' ? '#00ff88' : al.impact === '下调' ? '#ff4757' : '#a0a0a0'
                }}>{al.impact}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[#a0a0a0] leading-relaxed">{al.lesson}</p>
                  <p className="text-[10px] text-[#ffd700] mt-0.5">→ {al.adjustment}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ====== 5. TOP5 比分 ====== */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <M num="7" label="TOP5 比分预测" />
        <div className="space-y-2 mb-3">
          {(prediction.top5Scores || []).map((s: any, i: number) => {
            const quadrant = reclassifyQuadrant(s.score, prediction.homeWinProb, prediction.awayWinProb)
            const c = QUADRANT_COLORS[quadrant]
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-5 text-[#ffd700] font-bold">#{i + 1}</span>
                <span className="w-10 text-white font-mono font-bold">{s.score}</span>
                <div className="flex-1 h-6 rounded bg-[#1a1f3a] relative"><div className="absolute inset-0 flex items-center px-2"><span className="text-[10px] text-[#a0a0a0] truncate">{s.reason}</span></div><div className="h-full rounded" style={{ width: `${Math.min(s.probability * 5 * 100, 100)}%`, backgroundColor: c, opacity: 0.15 }} /></div>
                <span className="w-10 text-right font-mono font-bold" style={{ color: c }}>{Math.round(s.probability * 100)}%</span>
                <span className="w-16 text-right text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c + '20', color: c }}>{QUADRANT_NAMES[quadrant]}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ====== 6. 象限 ====== */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <M num="8" label="比分象限分类" />
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-64 h-64 flex-shrink-0"><QuadrantChart top5Scores={prediction.top5Scores} homeWinProb={prediction.homeWinProb} awayWinProb={prediction.awayWinProb} /></div>
          <div className="flex-1 text-xs text-[#a0a0a0] space-y-2">
            <p>主推 <span className="text-[#ffd700] font-mono font-bold text-base">{prediction.predictedScore}</span></p>
            {(() => {
              const topQuadrant = reclassifyQuadrant(prediction.top5Scores[0]?.score || '0:0', prediction.homeWinProb, prediction.awayWinProb)
              return (
                <>
                  <p className="text-sm font-bold" style={{ color: QUADRANT_COLORS[topQuadrant] }}>{QUADRANT_NAMES[topQuadrant]}</p>
                  <p className="leading-relaxed">{qd(topQuadrant)}</p>
                </>
              )
            })()}
          </div>
        </div>
      </section>

      {/* ====== 7. MVI ====== */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <M num="9" label="错价机会分析 (MVI)" />
        <div className="bg-[#1a1f3a] rounded-lg p-3 mb-4 text-[10px] text-[#a0a0a0] leading-relaxed">
          <p><span className="text-white font-bold">MVI（Market Value Index）</span> = 我们模型认为的概率 ÷ 博彩市场给出的概率。</p>
          <ul className="mt-2 space-y-1">
            <li>• <span className="text-[#00ff88]">MVI &gt; 1.00</span>：市场低估了这个选项，存在潜在价值</li>
            <li>• <span className="text-[#a55eea]">MVI &gt; 1.15</span>：高价值信号，模型与市场分歧显著</li>
            <li>• <span className="text-[#ff4757]">MVI &lt; 1.00</span>：市场已经充分定价甚至高估，不值得碰</li>
          </ul>
          <p className="mt-2 text-[9px] text-[#555555]">
            举例：MVI=1.18 的"葡萄牙 -1.5"表示我们模型认为这个盘口被市场低估了18%，可能是值得关注的机会。
            这不等同于"一定会赢"，只是概率上的定价偏差。
          </p>
        </div>
        <MviTable items={prediction.mviAnalysis} />
      </section>

      {/* ====== 资金 ====== */}
      {prediction.bankroll ? (
        <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
          <M num="10" label="资金配置建议" />
          <p className="text-[10px] text-[#555555] mb-3">基于 100% 预算</p>
          <BankrollBreakdown bankroll={prediction.bankroll} match={match} prediction={prediction} />
        </section>
      ) : (
        <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
          <M num="10" label="资金配置建议" />
          <p className="text-xs text-[#555555]">资金配置数据生成中，请稍后刷新...</p>
        </section>
      )}

      {/* ====== 10. 风险 ====== */}
      <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5">
        <M num="11" label="风险提示" />
        <div className="space-y-2 mb-4">
          {(prediction.riskWarnings ?? []).map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[#a0a0a0]"><span className="text-[#ff4757] font-bold">!</span><span>{r}</span></div>
          ))}
        </div>
        <div className="flex items-center gap-4 pt-3 border-t border-[#1a1f3a]">
          <span className="text-[10px] text-[#a0a0a0]">信心</span>
          <span className="text-sm font-bold" style={{ color: prediction.confidence > 0.7 ? '#00ff88' : prediction.confidence > 0.5 ? '#ffa502' : '#ff4757' }}>{Math.round(prediction.confidence * 100)}%</span>
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: RISK_COLORS[prediction.riskLevel] + '20', color: RISK_COLORS[prediction.riskLevel] }}>{prediction.riskLevel === 'High' ? '高' : prediction.riskLevel === 'Medium' ? '中' : '低'}风险</span>
        </div>
      </section>

      {/* ====== 11. 复盘 ====== */}
      {review && (
        <section className="bg-[#141937] border border-[#1a1f3a] rounded-xl p-5 animate-slide-up">
          <M num="12" label="赛后复盘" />
          <div className="space-y-3">
            {/* Match Stats */}
            {review.matchStats && (
              <div className="bg-[#1a1f3a] rounded-lg p-3 mb-3">
                <h4 className="text-[10px] text-[#a0a0a0] font-bold mb-2">📊 比赛数据</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[10px]">
                  {review.matchStats.possession && <StatRow label="控球率" h={`${review.matchStats.possession.home}%`} a={`${review.matchStats.possession.away}%`} />}
                  {review.matchStats.shots && <StatRow label="射门" h={String(review.matchStats.shots.home)} a={String(review.matchStats.shots.away)} />}
                  {review.matchStats.shotsOnTarget && <StatRow label="射正" h={String(review.matchStats.shotsOnTarget.home)} a={String(review.matchStats.shotsOnTarget.away)} />}
                  {review.matchStats.xg && <StatRow label="xG" h={review.matchStats.xg.home > 0 ? review.matchStats.xg.home.toFixed(1) : '-'} a={review.matchStats.xg.away > 0 ? review.matchStats.xg.away.toFixed(1) : '-'} />}
                  {review.matchStats.corners && <StatRow label="角球" h={String(review.matchStats.corners.home)} a={String(review.matchStats.corners.away)} />}
                  {review.matchStats.fouls && <StatRow label="犯规" h={String(review.matchStats.fouls.home)} a={String(review.matchStats.fouls.away)} />}
                  {review.matchStats.cards && (review.matchStats.cards.home.yellow > 0 || review.matchStats.cards.away.yellow > 0) && <StatRow label="黄牌" h={String(review.matchStats.cards.home.yellow)} a={String(review.matchStats.cards.away.yellow)} />}
                  {review.matchStats.offsides && <StatRow label="越位" h={String(review.matchStats.offsides.home)} a={String(review.matchStats.offsides.away)} />}
                  {review.matchStats.crosses && <StatRow label="传中" h={String(review.matchStats.crosses.home)} a={String(review.matchStats.crosses.away)} />}
                  {review.matchStats.interceptions && <StatRow label="拦截" h={String(review.matchStats.interceptions.home)} a={String(review.matchStats.interceptions.away)} />}
                  {review.matchStats.saves && <StatRow label="扑救" h={String(review.matchStats.saves.home)} a={String(review.matchStats.saves.away)} />}
                </div>
                {review.matchStats.scorers && (
                  <div className="mt-2 pt-2 border-t border-[#141937] text-[9px] text-[#a0a0a0]">
                    ⚽ 进球：{review.matchStats.scorers.map(s => `${s.minute}' ${s.player}(${s.team === 'home' ? cn(match.homeTeam) : cn(match.awayTeam)})`).join('、')}
                  </div>
                )}
              </div>
            )}
            {review.hitItems?.length > 0 && (
              <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-lg p-3">
                <h4 className="text-xs text-[#00ff88] font-bold mb-1">✅ 命中项</h4>
                <ul className="space-y-0.5">{review.hitItems.map((h, i) => <li key={i} className="text-[10px] text-[#a0a0a0]">• {h}</li>)}</ul>
              </div>
            )}
            {review.missItems?.length > 0 && (
              <div className="bg-[#ff4757]/5 border border-[#ff4757]/20 rounded-lg p-3">
                <h4 className="text-xs text-[#ff4757] font-bold mb-1">❌ 失误项</h4>
                <ul className="space-y-0.5">{review.missItems.map((m, i) => <li key={i} className="text-[10px] text-[#a0a0a0]">• {m}</li>)}</ul>
              </div>
            )}
            {review.errorReasons?.length > 0 && (
              <div className="bg-[#ffa502]/5 border border-[#ffa502]/20 rounded-lg p-3">
                <h4 className="text-xs text-[#ffa502] font-bold mb-1">🔎 原因分析</h4>
                <ul className="space-y-0.5">{review.errorReasons.map((e, i) => <li key={i} className="text-[10px] text-[#a0a0a0]">• {e}</li>)}</ul>
              </div>
            )}
            {review.optimizationSuggestions?.length > 0 && (
              <div className="bg-[#a55eea]/5 border border-[#a55eea]/20 rounded-lg p-3">
                <h4 className="text-xs text-[#a55eea] font-bold mb-1">💡 模型优化</h4>
                <ul className="space-y-0.5">{review.optimizationSuggestions.map((o, i) => <li key={i} className="text-[10px] text-[#a0a0a0]">• {o}</li>)}</ul>
              </div>
            )}
            {/* 因子评估 */}
            {review.factorEvaluation && typeof review.factorEvaluation === 'object' && (
              <div className="bg-[#ffd700]/5 border border-[#ffd700]/20 rounded-lg p-3">
                <h4 className="text-xs text-[#ffd700] font-bold mb-1">🎯 因子表现评估</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  {([
                    { label: 'ELO差值', key: 'eloDiff' },
                    { label: '近期状态', key: 'recentForm' },
                    { label: '历史交锋', key: 'h2h' },
                    { label: '市场共识', key: 'marketConsensus' },
                    { label: '战术匹配', key: 'tacticalMatchup' },
                  ]).map(f => {
                    const factorData = (review.factorEvaluation as any)[f.key]
                    // factorData may be { accuracy: number } or a number directly
                    const accuracy = typeof factorData === 'object' && factorData !== null
                      ? factorData.accuracy
                      : (typeof factorData === 'number' ? factorData : undefined)
                    const pct = typeof accuracy === 'number' ? Math.round(accuracy * 100) : null
                    const color = pct !== null
                      ? (accuracy as number > 0.5 ? '#00ff88' : accuracy as number > 0.35 ? '#ffa502' : '#ff4757')
                      : '#555555'
                    return (
                      <div key={f.key} className="flex justify-between items-center">
                        <span className="text-[#a0a0a0]">{f.label}</span>
                        <span className="font-mono font-bold text-xs" style={{ color }}>
                          {pct !== null ? `${pct}%` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {/* 根因分析 */}
            {review.rootCause && (
              <div className="bg-[#ff4757]/5 border border-[#ff4757]/20 rounded-lg p-3">
                <h4 className="text-xs text-[#ff4757] font-bold mb-1">🔬 模型根因</h4>
                <p className="text-[10px] text-[#a0a0a0] leading-relaxed">{typeof review.rootCause === 'string' ? review.rootCause : JSON.stringify(review.rootCause)}</p>
              </div>
            )}
            {/* ELO变化 */}
            {review.eloChanges && review.eloChanges.length > 0 && (
              <div className="bg-[#54a0ff]/5 border border-[#54a0ff]/20 rounded-lg p-3">
                <h4 className="text-xs text-[#54a0ff] font-bold mb-1">📈 ELO 更新</h4>
                <div className="space-y-1 text-[10px]">
                  {review.eloChanges.map((ec, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-white w-24">{ec.team}</span>
                      <span className="text-[#555555] font-mono w-10">{ec.oldElo}</span>
                      <span className="text-[#555555]">→</span>
                      <span className="text-white font-mono font-bold w-10">{ec.newElo}</span>
                      <span className="font-mono font-bold" style={{ color: ec.change > 0 ? '#00ff88' : '#ff4757' }}>
                        {ec.change > 0 ? '+' : ''}{ec.change}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function M({ num, label }: { num: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-5 h-5 rounded-full bg-[#ffa502]/20 border border-[#ffa502]/40 flex items-center justify-center text-[10px] text-[#ffa502] font-bold">{num}</span>
      <span className="text-xs font-bold text-white tracking-wide">{label}</span>
    </div>
  )
}

function qd(q?: string): string {
  switch (q) {
    case 'Q1': return '强队优势明显，比分向强队零封方向收敛。准确率历史最高但赔率偏低。'
    case 'Q2': return '双方实力接近，细微变量可改变结果。平局概率被系统性低估。'
    case 'Q3': return '弱队获胜预期低但存在结构性机会。回报最高但命中率最低。'
    case 'Q4': return '双方均具进攻能力且防守存在漏洞。适合大小球大于方向。'
    default: return ''
  }
}

function StatRow({ label, h, a }: { label: string; h: string; a: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#555555] w-8">{label}</span>
      <span className="text-white font-mono">{h}</span>
      <span className="text-[#555555]">-</span>
      <span className="text-white font-mono">{a}</span>
    </div>
  )
}
