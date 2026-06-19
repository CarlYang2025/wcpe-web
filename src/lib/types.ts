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
}

export interface Odds {
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
  bttsYes?: number;
  bttsNo?: number;
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
  cards?: { home: { yellow: number; red: number }; away: { yellow: number; red: number } };
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
  /** 8维因子权重表现 */
  factorWeights?: Record<string, { hitRate: number; weight: number; samples: number }>;
  /** 全局ELO评分快照 */
  eloRatings?: Record<string, number>;
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
