import type { Match } from './types'

/**
 * 总冠军归属预测引擎
 * ------------------------------------------------------------------
 * 设计目标：实时、动态、100% 精确解析（非蒙特卡洛模拟）、可解释。
 *
 * 核心思路：
 * 1. 从 matches 数据动态识别当前淘汰赛进度（frontier 轮次）。
 * 2. 以 frontier 轮次为叶层，向上两两配对推演出完整对阵树，直到决赛。
 *    - 已完赛比赛 → 该 slot 直接落位为胜者（确定球队）。
 *    - 未完赛比赛 → 该 slot 是一个待决的对阵节点。
 * 3. 单场胜负用 Elo 概率公式（淘汰赛最终必分胜负，含加时/点球）。
 * 4. 用「分布传播」自底向上精确计算每个节点的球队概率分布，
 *    根节点（决赛）的分布即为各队夺冠概率。所有概率之和恒等于 1。
 *
 * 「实时动态」体现在：引擎为纯函数，输入 = 当前 matches + 动态 Elo 快照。
 * 每当有比赛出结果（status→finished）或 Elo 随赛后复盘更新，
 * 重新调用即得到最新冠军概率，无需任何手工干预。
 */

export interface ChampionEntry {
  team: string
  /** 夺冠概率 0~1 */
  prob: number
  /** 进入决赛概率 0~1 */
  reachFinalProb: number
  /** 半区：'top' = 上半区，'bottom' = 下半区 */
  region: 'top' | 'bottom'
  /** 是否已锁定晋级到下一轮（当前轮已赢） */
  advanced: boolean
}

export interface FixtureProb {
  /** 轮次中文名 */
  round: string
  home: string
  away: string
  /** home 晋级概率（Elo，含点球） */
  pHome: number
  pAway: number
  /** 该场是否已开打/待开打 */
  decided: boolean
}

export interface ChampionModel {
  /** 是否已进入淘汰赛阶段（否则模块不显示） */
  ready: boolean
  /** 当前阶段中文名，如 "8强" */
  stage: string
  /** 存活球队冠军概率，降序 */
  entries: ChampionEntry[]
  /** 已确定对阵（两边球队均已落位）的晋级概率，供 bracket 展示 */
  fixtures: FixtureProb[]
  /** 最近一轮出局的球队（英文名） */
  recentlyOut: string[]
  /** 仍存活球队数 */
  aliveCount: number
}

// 淘汰赛轮次顺序（由早到晚）
const KNOCKOUT_ORDER = ['Round of 32', 'Round of 16', 'Quarter-Finals', 'Semi-Finals', 'Final']
const FINAL_INDEX = KNOCKOUT_ORDER.length - 1
const STAGE_CN: Record<string, string> = {
  'Round of 32': '32强',
  'Round of 16': '16强',
  'Quarter-Finals': '8强',
  'Semi-Finals': '半决赛',
  'Final': '决赛',
}

/** Elo 单场胜率：淘汰赛最终必分胜负（含加时/点球），无平局 */
export function eloWinProb(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400))
}

type BracketNode =
  | { kind: 'team'; team: string }
  | { kind: 'match'; left: BracketNode; right: BracketNode }

/** 已完赛比赛的胜者；平分（点球）时无法从本场直接判定，返回 null */
function winnerOf(m: Match): string | null {
  if (m.status !== 'finished' || m.homeScore == null || m.awayScore == null) return null
  if (m.homeScore > m.awayScore) return m.homeTeam
  if (m.awayScore < m.homeScore) return m.awayTeam
  return null
}

export function computeChampionModel(
  matches: Match[],
  eloMap: Record<string, number>,
  fallbackElo: Record<string, number>,
): ChampionModel {
  const elo = (t: string): number => {
    const v = eloMap[t]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    const f = fallbackElo[t]
    return typeof f === 'number' && Number.isFinite(f) ? f : 1500
  }

  const empty: ChampionModel = {
    ready: false, stage: '小组赛', entries: [], fixtures: [], recentlyOut: [], aliveCount: 0,
  }

  // 存在于数据中的淘汰赛轮次
  const presentRounds = KNOCKOUT_ORDER.filter(r => matches.some(m => m.round === r))
  if (presentRounds.length === 0) return empty

  // frontier = 第一个仍含未完赛比赛的轮次；若全部完赛则取最靠后的一轮
  let frontier = presentRounds[presentRounds.length - 1]
  for (const r of presentRounds) {
    if (matches.some(m => m.round === r && m.status !== 'finished')) { frontier = r; break }
  }
  const frontierIndex = KNOCKOUT_ORDER.indexOf(frontier)

  // frontier 轮次比赛，按开赛时间排序（对阵树的固定叶层顺序）
  const frontierMatches = matches
    .filter(m => m.round === frontier)
    .sort((a, b) => (a.date + a.kickoff).localeCompare(b.date + b.kickoff))

  if (frontierMatches.length === 0) return empty

  // 构建叶层：完赛→确定球队；未完赛→待决对阵
  let nodes: BracketNode[] = frontierMatches.map(m => {
    if (m.status === 'finished') {
      // 平分（点球）时用 Elo 高者兜底判定晋级方
      const w = winnerOf(m) ?? (elo(m.homeTeam) >= elo(m.awayTeam) ? m.homeTeam : m.awayTeam)
      return { kind: 'team', team: w } as BracketNode
    }
    return { kind: 'match', left: { kind: 'team', team: m.homeTeam }, right: { kind: 'team', team: m.awayTeam } } as BracketNode
  })

  // 向上两两配对，直到只剩根（决赛）
  while (nodes.length > 1) {
    const next: BracketNode[] = []
    for (let i = 0; i < nodes.length; i += 2) {
      if (i + 1 < nodes.length) next.push({ kind: 'match', left: nodes[i], right: nodes[i + 1] })
      else next.push(nodes[i]) // 奇数兜底
    }
    nodes = next
  }
  const root = nodes[0]

  // 分布传播：返回该子树各球队「胜出（晋级到该节点之上）」的概率分布
  const distCache = new Map<BracketNode, Record<string, number>>()
  const dist = (node: BracketNode): Record<string, number> => {
    if (node.kind === 'team') return { [node.team]: 1 }
    const cached = distCache.get(node)
    if (cached) return cached
    const L = dist(node.left)
    const R = dist(node.right)
    const Lteams = Object.keys(L)
    const Rteams = Object.keys(R)
    const out: Record<string, number> = {}
    for (const t of Lteams) {
      let s = 0
      for (const u of Rteams) s += R[u] * eloWinProb(elo(t), elo(u))
      out[t] = (out[t] || 0) + L[t] * s
    }
    for (const u of Rteams) {
      let s = 0
      for (const t of Lteams) s += L[t] * eloWinProb(elo(u), elo(t))
      out[u] = (out[u] || 0) + R[u] * s
    }
    distCache.set(node, out)
    return out
  }

  // 冠军分布 = 根节点分布
  const champ = root.kind === 'team' ? { [root.team]: 1 } : dist(root)

  // 进决赛概率 = 根的两个子树各自的胜出分布之和
  const reachFinal: Record<string, number> = {}
  const regionOf: Record<string, 'top' | 'bottom'> = {}
  if (root.kind === 'match') {
    const topDist = dist(root.left)
    const botDist = dist(root.right)
    for (const [t, p] of Object.entries(topDist)) { reachFinal[t] = p; regionOf[t] = 'top' }
    for (const [t, p] of Object.entries(botDist)) { reachFinal[t] = p; regionOf[t] = 'bottom' }
  } else if (root.kind === 'team') {
    reachFinal[root.team] = 1
    regionOf[root.team] = 'top'
  }

  // 已锁定晋级的球队（frontier 轮已赢 → 出现在叶层的 team 节点）
  const advancedSet = new Set<string>()
  for (const m of frontierMatches) {
    if (m.status === 'finished') {
      const w = winnerOf(m) ?? (elo(m.homeTeam) >= elo(m.awayTeam) ? m.homeTeam : m.awayTeam)
      advancedSet.add(w)
    }
  }

  const entries: ChampionEntry[] = Object.entries(champ)
    .map(([team, prob]) => ({
      team,
      prob,
      reachFinalProb: reachFinal[team] ?? 0,
      region: regionOf[team] ?? 'top',
      advanced: advancedSet.has(team),
    }))
    .sort((a, b) => b.prob - a.prob)

  // 收集「已确定对阵」（两边均为确定球队）用于 bracket 展示，带轮次
  const fixtures: FixtureProb[] = []
  const walk = (node: BracketNode, depth: number) => {
    if (node.kind !== 'match') return
    if (node.left.kind === 'team' && node.right.kind === 'team') {
      const roundName = KNOCKOUT_ORDER[FINAL_INDEX - depth] || frontier
      const home = node.left.team
      const away = node.right.team
      // 是否为真实待决比赛（frontier 轮的 upcoming/live）
      const realMatch = frontierMatches.find(
        m => (m.homeTeam === home && m.awayTeam === away) || (m.homeTeam === away && m.awayTeam === home),
      )
      const decided = realMatch ? realMatch.status !== 'finished' : false
      fixtures.push({
        round: STAGE_CN[roundName] || roundName,
        home,
        away,
        pHome: eloWinProb(elo(home), elo(away)),
        pAway: eloWinProb(elo(away), elo(home)),
        decided,
      })
    }
    walk(node.left, depth + 1)
    walk(node.right, depth + 1)
  }
  walk(root, 0)
  // 轮次由近到远排序（8强在前，半决赛其次）
  fixtures.sort((a, b) => KNOCKOUT_ORDER.indexOf(cnToRound(b.round)) - KNOCKOUT_ORDER.indexOf(cnToRound(a.round)))

  // 最近一轮出局：frontier 轮已完赛比赛的败者
  const recentlyOut: string[] = []
  for (const m of frontierMatches) {
    if (m.status === 'finished') {
      const w = winnerOf(m) ?? (elo(m.homeTeam) >= elo(m.awayTeam) ? m.homeTeam : m.awayTeam)
      const loser = w === m.homeTeam ? m.awayTeam : m.homeTeam
      recentlyOut.push(loser)
    }
  }

  return {
    ready: true,
    stage: STAGE_CN[frontier] || frontier,
    entries,
    fixtures,
    recentlyOut,
    aliveCount: entries.length,
  }
}

function cnToRound(cn: string): string {
  for (const [k, v] of Object.entries(STAGE_CN)) if (v === cn) return k
  return cn
}
