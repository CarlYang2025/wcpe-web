export interface Match {
  id: string;
  date: string;
  tournament: string;
  group: string;
  round: string;
  matchday: number;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  kickoff: string;
  localKickoff: string;
  localTZ: string;
  status: 'upcoming' | 'live' | 'finished';
  homeScore?: number;
  awayScore?: number;
  /** FBref 赛后详细统计数据（仅 finished 比赛有效） */
  matchStats?: MatchStats;
}

export interface Odds {
  // === 核心胜负 ===
  homeWin: number;
  draw: number;
  awayWin: number;
  // === 大小球 ===
  over25: number;
  under25: number;
  // === 双方进球 ===
  bttsYes?: number;
  bttsNo?: number;
  // === 正确比分 (score → odds) ===
  correctScore?: Record<string, number>;
  // === 平局退款 ===
  drawNoBet?: { home: number; away: number };
  // === 双重机会 ===
  doubleChance?: { homeOrDraw: number; drawOrAway: number; homeOrAway: number };
  // === 让球盘 ===
  spread?: { hdp: number; home: number; away: number };
  // === 多线 O/U (hdp → {over, under}) ===
  altGoalLines?: Array<{ hdp: number; over: number; under: number }>;
  // === 欧洲让球 ===
  europeanHandicap?: Array<{ hdp: number; home?: number; draw?: number; away?: number }>;
  // === 半场 ===
  halfTime?: {
    result?: { home: number; draw: number; away: number };
    btts?: { yes: number; no: number };
    spread?: { hdp: number; home: number; away: number };
    totals?: { hdp: number; over: number; under: number };
  };
  // === 元数据 ===
  _source?: string;
  _updatedAt?: string;
}

export interface Top5Score {
  score: string;
  probability: number;
  quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  reason: string;
}

export interface MviItem {
  bet: string;
  modelProb: number;
  marketProb: number;
  mvi: number;
  rating: '无价值' | '一般价值' | '高价值' | '超级价值';
}

export interface BankrollPlan {
  allocations: Record<string, number>;
  expectedReturn: number;
}

export interface FactorBreakdown {
  eloDiffScore: number;
  recentFormScore: number;
  h2hScore: number;
  marketScore: number;
  tacticalScore: number;
  squadScore: number;
  pressureScore: number;
  psychologyScore: number;
}

export interface AppliedLearning {
  /** 引用的历史教训 */
  lesson: string;
  /** 如何应用到本场比赛 */
  adjustment: string;
  /** 影响方向 */
  impact: '上调' | '下调' | '中性';
}

export interface Prediction {
  matchId: string;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  over25Prob: number;
  under25Prob: number;
  top5Scores: Top5Score[];
  mviAnalysis: MviItem[];
  parlayRecommendations: ParlayItem[];
  bankroll: {
    conservative: BankrollPlan;
    balanced: BankrollPlan;
    aggressive: BankrollPlan;
  };
  confidence: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  riskWarnings: string[];
  predictedScore: string;
  predictedDirection: 'home_win' | 'draw' | 'away_win';
  /** Detailed analysis: 1=overview, 2=data, 3=tactics, 4=market */
  richAnalysis?: {
    overview?: string;
    formData?: string;
    h2h?: string;
    lineup?: string;
    tactics?: string;
    market?: string;
  };
  /** 自进化记录：8维因子评分 */
  factorBreakdown?: FactorBreakdown;
  /** 自进化记录：本场应用的历史教训 */
  appliedLearnings?: AppliedLearning[];
  /** 信心调整理由 */
  confidenceAdjustment?: string;
}

export interface MatchStats {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  xg: { home: number; away: number };
  corners?: { home: number; away: number };
  fouls?: { home: number; away: number };
  cards?: { home: { yellow: number; red: number }; away: { yellow: number; red: number } };
  offsides?: { home: number; away: number };
  crosses?: { home: number; away: number };
  interceptions?: { home: number; away: number };
  saves?: { home: number; away: number };
  tackles?: { home: number; away: number };
  passes?: { home: number; away: number };
  passCompletion?: { home: number; away: number };
  scorers?: { player: string; team: 'home' | 'away'; minute: number }[];
}

export interface FactorEvaluation {
  eloPrediction: '准确' | '偏高' | '偏低';
  recentFormPrediction: '准确' | '偏高' | '偏低';
  h2hPrediction: '准确' | '偏高' | '偏低';
  marketOddsPrediction: '准确' | '偏高' | '偏低';
  tacticalMatchupPrediction: '准确' | '偏高' | '偏低';
}

export interface EloChange {
  team: string;
  oldElo: number;
  newElo: number;
  change: number;
}

export interface PostMatchReview {
  matchId: string;
  hitItems: string[];
  missItems: string[];
  errorReasons: string[];
  optimizationSuggestions: string[];
  xgHome?: number;
  xgAway?: number;
  /** Detailed match stats for review */
  matchStats?: MatchStats;
  /** 失误根因（模型层面） */
  rootCause?: string;
  /** 各预测因子表现评估 */
  factorEvaluation?: FactorEvaluation;
  /** ELO变化 */
  eloChanges?: EloChange[];
}

export interface ParlayItem {
  type: '稳健' | '平衡' | '高赔';
  selections: string[];
  odds: number;
  probability: number;
  risk: 'Low' | 'Medium' | 'High';
}

export interface TeamRatings {
  attack: number;
  defense: number;
  form: number;
  tournament: number;
  elo: number;
}

export interface ModelState {
  directionAccuracy: number;
  scoreTop3Accuracy: number;
  scoreTop1Accuracy: number;
  totalPredictions: number;
  completedPredictions: number;
  directionCorrect: number;
  scoreTop3Correct: number;
  scoreTop1Correct: number;
  overallDrawRate: number;
  overallTotalMatches: number;
  /** 8维因子权重表现；历史数据可能是纯权重数字，新数据可能带 hitRate/samples */
  factorWeights?: Record<string, number | { hitRate?: number; weight: number; samples?: number }>;
  /** 全局ELO评分快照；remote.json 顶层兼容结构可能携带完整 TeamRatings 对象 */
  eloRatings?: Record<string, number | TeamRatings>;
}

export const QUADRANT_NAMES: Record<string, string> = {
  Q1: '强队碾压',
  Q2: '均势博弈',
  Q3: '冷门爆冷',
  Q4: '对攻大战',
};

export const QUADRANT_COLORS: Record<string, string> = {
  Q1: '#00ff88',
  Q2: '#54a0ff',
  Q3: '#ff4757',
  Q4: '#ffa502',
};

export const RISK_COLORS: Record<string, string> = {
  Low: '#00ff88',
  Medium: '#ffa502',
  High: '#ff4757',
};
