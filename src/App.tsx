import { useState, useMemo, Component } from 'react'
import { matches as rawMatches, predictions as staticPreds, postMatchReviews as staticReviews, modelState, keyLearnings, predictionRichData, reviewRichData } from './data/matches'
import { useMatchTimer } from './lib/useMatchTimer'
import { useAutoUpdater } from './lib/useAutoUpdater'
import { useRemoteData } from './lib/useRemoteData'
import Dashboard from './components/Dashboard'
import MatchDetail from './components/MatchDetail'
import MatchdaySummary from './components/MatchdaySummary'
import type { Match } from './lib/types'

type Tab = 'dashboard' | 'matchday' | 'match'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [sourceTab, setSourceTab] = useState<Tab>('dashboard')
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)

  // Remote data source (fetched once on mount from jsonblob)
  const { data: remoteData, loading: remoteLoading } = useRemoteData()

  // Merge remote predictions/reviews (remote takes priority over static)
  const mergedPreds = useMemo(() => ({ ...staticPreds, ...(remoteData?.predictions || {}) }), [staticPreds, remoteData])
  const mergedReviews = useMemo(() => ({ ...staticReviews, ...(remoteData?.reviews || {}) }), [staticReviews, remoteData])

  // Merge rich data (factorBreakdown, appliedLearnings, eloChanges, etc.) into predictions and reviews
  const enrichedPreds = useMemo(() => {
    const result = { ...mergedPreds }
    for (const id in predictionRichData) {
      if (result[id]) {
        result[id] = { ...result[id], ...predictionRichData[id as keyof typeof predictionRichData] }
      }
    }
    return result
  }, [mergedPreds])

  const enrichedReviews = useMemo(() => {
    const result = { ...mergedReviews }
    for (const id in reviewRichData) {
      if (result[id]) {
        result[id] = { ...result[id], ...reviewRichData[id as keyof typeof reviewRichData] }
      }
    }
    return result
  }, [mergedReviews])

  // Use remote data when available, fall back to static
  const displayModelState = useMemo(() => remoteData?.modelState || modelState, [remoteData])
  const displayKeyLearnings = useMemo(() => remoteData?.keyLearnings || keyLearnings, [remoteData])

  // Merge remote matches with static (remote takes priority, but preserve static scores if remote lacks them)
  const fullMatches = useMemo(() => {
    if (!remoteData?.matches || !Array.isArray(remoteData.matches) || remoteData.matches.length === 0) {
      return rawMatches
    }
    const remoteMap = new Map(remoteData.matches.map((m: Match) => [m.id, m]))
    // Update existing matches with remote data
    const merged = rawMatches.map(m => {
      const rm = remoteMap.get(m.id)
      if (!rm) return m
      return {
        ...rm,
        // Preserve static scores if remote doesn't have them (remote score undefined → use static)
        homeScore: rm.homeScore ?? m.homeScore,
        awayScore: rm.awayScore ?? m.awayScore,
        // Preserve static status if remote doesn't provide one
        status: rm.status || m.status,
      }
    })
    // Append new matches from remote that don't exist in static
    for (const rm of remoteData.matches) {
      if (!rawMatches.find(m => m.id === rm.id)) {
        merged.push(rm)
      }
    }
    return merged
  }, [rawMatches, remoteData])

  // Timer: switches upcoming→live→finished based on kickoff time
  const timerMatches = useMatchTimer(fullMatches)

  // Auto-updater: polls ESPN every 2min for live scores
  const {
    matches: liveMatches,
    isPolling,
    lastUpdated,
  } = useAutoUpdater(timerMatches)

  // Apply timer on top of live-updated matches
  const matches = useMatchTimer(liveMatches)

  // Recalculate todayDate after auto-updater
  const effectiveToday = useMemo(() => {
    const dates = [...new Set(matches.map(m => m.date))].sort()
    const active = dates.find(d => matches.some(m => m.date === d && m.status !== 'finished'))
    return active || dates[dates.length - 1] || '2026-06-18'
  }, [matches])

  const predictions = enrichedPreds
  const postMatchReviews = enrichedReviews

  const historicalMatches = useMemo(() => matches.filter(m => m.status === 'finished').sort((a, b) => b.date.localeCompare(a.date) || b.kickoff.localeCompare(a.kickoff)), [matches])
  const todayMatches = useMemo(() => matches.filter(m => m.date === effectiveToday), [matches, effectiveToday])
  const upcomingOnly = useMemo(() => todayMatches.filter(m => m.status !== 'finished'), [matches, effectiveToday])

  const handleSelectMatch = (match: Match) => { setSourceTab(tab); setSelectedMatch(match); setTab('match') }
  const goTab = (t: Tab) => { setTab(t); if (t !== 'match') setSelectedMatch(null) }

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white">
      <header className="bg-[#1a1f3a] border-b border-[#141937] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => goTab('dashboard')}>
            <span className="text-[#ffd700] text-2xl font-bold">⚡</span>
            <span className="text-lg font-bold tracking-wide">
              <span className="text-[#ffd700]">WC</span>PE
            </span>
            {isPolling && (
              <span className="text-[8px] text-[#555555] animate-pulse">
                ● 实时 {lastUpdated ? lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 bg-[#0a0e27] rounded-lg p-0.5">
            <TabBtn active={tab === 'dashboard'} onClick={() => goTab('dashboard')} label="📊 首页" />
            <TabBtn active={tab === 'matchday'} onClick={() => goTab('matchday')} label="🎯 比赛日方案" />
          </div>

          <div className="flex items-center gap-3 text-[10px] text-[#a0a0a0]">
            <span>方向 <span className="text-[#00ff88] font-bold">{Math.round(displayModelState.directionAccuracy * 100)}%</span></span>
            <span>TOP3 <span className="text-[#ffa502] font-bold">{Math.round(displayModelState.scoreTop3Accuracy * 100)}%</span></span>
            <span>TOP1 <span className="text-[#54a0ff] font-bold">{Math.round(displayModelState.scoreTop1Accuracy * 100)}%</span></span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Remote data loading indicator */}
        {remoteLoading && (
          <div className="text-center text-[10px] text-[#a0a0a0] mb-4 animate-pulse">
            ⏳ 正在拉取最新数据...
          </div>
        )}

        {/* Auto-status bar */}
        {lastUpdated && (
          <div className="text-center text-[9px] text-[#555555] mb-2">
            🤖 自动更新于 {lastUpdated.toLocaleTimeString('zh-CN')} · 每 2 分钟轮询 ESPN 数据
          </div>
        )}

        <ErrorBoundary>
        {tab === 'dashboard' && (
          <Dashboard
            historicalMatches={historicalMatches}
            todayMatches={todayMatches}
            predictions={predictions}
            postMatchReviews={postMatchReviews}
            modelState={displayModelState}
            keyLearnings={displayKeyLearnings}
            onSelectMatch={handleSelectMatch}
          />
        )}
        {tab === 'matchday' && (
          <MatchdaySummary
            allMatches={todayMatches}
            remainingMatches={upcomingOnly}
            predictions={predictions}
            postMatchReviews={postMatchReviews}
            onSelectMatch={handleSelectMatch}
          />
        )}
        {tab === 'match' && selectedMatch && (
          <MatchDetail
            match={selectedMatch}
            prediction={predictions[selectedMatch.id]}
            review={postMatchReviews[selectedMatch.id]}
            onBack={() => goTab(sourceTab)}
          />
        )}
        </ErrorBoundary>
      </main>

      <footer className="border-t border-[#141937] py-3 text-center text-[10px] text-[#555555]">
        基于概率模型推演，仅供参考，不构成投注建议 | WCPE V2.0 | 作者：杨观观 | 数据：ESPN API
      </footer>
    </div>
  )
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${active ? 'bg-[#1a1f3a] text-[#ffd700] shadow-sm' : 'text-[#a0a0a0] hover:text-white hover:bg-[#141937]'}`}>
      {label}
    </button>
  )
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-20 space-y-4">
          <div className="text-4xl">⚠️</div>
          <p className="text-[#a0a0a0]">页面出现异常，请刷新重试</p>
          <p className="text-[10px] text-[#555555] font-mono">{this.state.error?.message}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            className="px-4 py-2 text-xs rounded-lg bg-[#1a1f3a] text-[#ffd700] hover:bg-[#252b4a] transition-colors">
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
