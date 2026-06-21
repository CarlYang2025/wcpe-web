import type { Odds, Top5Score, MviItem, BankrollPlan, ParlayItem } from './types';

/**
 * Elo-based win probability calculation
 */
export function eloToProbability(eloHome: number, eloAway: number): { home: number; draw: number; away: number } {
  const diff = eloHome - eloAway;
  const homeWin = 1 / (1 + Math.pow(10, -diff / 400));
  const awayWin = 1 / (1 + Math.pow(10, diff / 400));
  const drawFromRemaining = (1 - homeWin - awayWin);
  const draw = Math.max(0.08, drawFromRemaining);
  const scale = (1 - draw) / (homeWin + awayWin);
  return {
    home: Math.round(homeWin * scale * 100) / 100,
    draw: Math.round(draw * 100) / 100,
    away: Math.round(awayWin * scale * 100) / 100,
  };
}

/**
 * Adjust probabilities using WCPE weights
 */
export function applyWeights(
  probs: { home: number; draw: number; away: number },
  weights: {
    drawPremiumFirstRound: number;
    drawPremiumStrongFavorite: number;
    underdogMotivation: number;
    isFirstRound: boolean;
    homeOdds: number;
    isDebutTeam: boolean;
  }
): { home: number; draw: number; away: number } {
  let { home, draw, away } = probs;

  // First round draw premium
  if (weights.isFirstRound) {
    draw *= weights.drawPremiumFirstRound;
    home *= (1 - (draw - probs.draw) / 2 / home);
    away *= (1 - (draw - probs.draw) / 2 / away);
  }

  // Strong favorite (odds < 1.50) draw premium
  if (weights.homeOdds < 1.5) {
    draw *= weights.drawPremiumStrongFavorite;
    home *= 0.93;
  }

  // Underdog motivation for World Cup debut
  if (weights.isDebutTeam) {
    away *= weights.underdogMotivation;
    home *= 0.95;
  }

  // Normalize
  const total = home + draw + away;
  return {
    home: Math.round((home / total) * 100) / 100,
    draw: Math.round((draw / total) * 100) / 100,
    away: Math.round((away / total) * 100) / 100,
  };
}

/**
 * Blend Elo probability with market-implied probability
 */
export function blendProbabilities(
  eloProbs: { home: number; draw: number; away: number },
  odds: Odds
): { home: number; draw: number; away: number } {
  // De-vig market probabilities
  const marketTotal = 1 / odds.homeWin + 1 / odds.draw + 1 / odds.awayWin;
  const marketHome = (1 / odds.homeWin) / marketTotal;
  const marketDraw = (1 / odds.draw) / marketTotal;
  const marketAway = (1 / odds.awayWin) / marketTotal;

  // Blend: 40% Elo + 60% market
  return {
    home: Math.round((eloProbs.home * 0.4 + marketHome * 0.6) * 100) / 100,
    draw: Math.round((eloProbs.draw * 0.4 + marketDraw * 0.6) * 100) / 100,
    away: Math.round((eloProbs.away * 0.4 + marketAway * 0.6) * 100) / 100,
  };
}

/**
 * Calculate MVI (Market Value Index) for a bet
 */
export function calculateMVI(modelProb: number, marketOdds: number): number {
  const marketProb = 1 / marketOdds;
  return Math.round((modelProb / marketProb) * 100) / 100;
}

/**
 * Rate MVI value
 */
export function rateMVI(mvi: number): string {
  if (mvi > 1.30) return '超级价值';
  if (mvi >= 1.15) return '高价值';
  if (mvi >= 1.00) return '一般价值';
  return '无价值';
}

/**
 * Classify score into quadrant
 */
export function classifyQuadrant(score: string, homeWinProb: number, over25Prob: number): string {
  const parts = score.split(/[:-]/);
  if (parts.length !== 2) return 'Q1';
  const h = parseInt(parts[0]);
  const a = parseInt(parts[1]);

  if (homeWinProb > 0.55 && h > a) {
    return 'Q1';
  } else if (over25Prob > 0.55 && h + a >= 4) {
    return 'Q4';
  } else if (homeWinProb < 0.45 && a > h) {
    return 'Q3';
  }
  return 'Q2';
}

/**
 * Generate TOP5 most likely scores
 */
export function generateTop5Scores(
  homeWinProb: number,
  drawProb: number,
  awayWinProb: number,
  over25Prob: number,
  homeTeam: string,
  awayTeam: string,
  homeElo: number,
  awayElo: number
): Top5Score[] {
  const eloDiff = homeElo - awayElo;
  const isHeavyFavorite = eloDiff > 200;

  const candidates: { score: string; base: number; reason: string }[] = [];

  if (isHeavyFavorite) {
    candidates.push(
      { score: '2:0', base: 0.18, reason: `${homeTeam}进攻碾压+${awayTeam}防守纪律限制` },
      { score: '1:0', base: 0.15, reason: `${awayTeam}密集防守+48队赛制首轮求稳` },
      { score: '3:0', base: 0.12, reason: `${homeTeam}进攻火力全开` },
      { score: '2:1', base: 0.10, reason: `${awayTeam}反击偷1球` },
      { score: '1:1', base: 0.08, reason: '首轮平局溢价' },
    );
  } else if (Math.abs(homeWinProb - awayWinProb) < 0.15) {
    candidates.push(
      { score: '1:1', base: 0.18, reason: '势均力敌+首轮平局溢价' },
      { score: '1:0', base: 0.12, reason: `${homeTeam}主场+大赛基因略占优` },
      { score: '0:0', base: 0.11, reason: '双方首战求稳' },
      { score: '2:1', base: 0.10, reason: `${homeTeam}个人能力闪光` },
      { score: '1:2', base: 0.08, reason: `${awayTeam}反击效率` },
    );
  } else {
    candidates.push(
      { score: '0:2', base: 0.16, reason: `${awayTeam}进攻碾压` },
      { score: '0:1', base: 0.13, reason: '客队控场求稳' },
      { score: '1:2', base: 0.12, reason: `${homeTeam}偷1球+${awayTeam}攻击力` },
      { score: '0:3', base: 0.10, reason: `${awayTeam}全力进攻` },
      { score: '1:1', base: 0.08, reason: '首轮平局溢价' },
    );
  }

  // Adjust for over/under
  if (over25Prob > 0.55) {
    candidates.forEach(c => {
      const parts = c.score.split(':');
      const total = parseInt(parts[0]) + parseInt(parts[1]);
      if (total < 3) c.base *= 0.85;
      if (total >= 3) c.base *= 1.15;
    });
  }

  // Normalize
  const total = candidates.reduce((sum, c) => sum + c.base, 0);
  candidates.forEach(c => c.base = Math.round((c.base / total) * 100) / 100);

  return candidates.map((c, i) => ({
    score: c.score,
    probability: c.base,
    quadrant: classifyQuadrant(c.score, homeWinProb, over25Prob) as 'Q1' | 'Q2' | 'Q3' | 'Q4',
    reason: c.reason,
  }));
}

/**
 * Generate MVI analysis
 */
export function generateMviAnalysis(
  homeWinProb: number, drawProb: number, awayWinProb: number,
  over25Prob: number, under25Prob: number,
  odds: Odds
): MviItem[] {
  const marketHome = 1 / odds.homeWin;
  const marketDraw = 1 / odds.draw;
  const marketAway = 1 / odds.awayWin;
  const marketOver = 1 / odds.over25;
  const marketUnder = 1 / odds.under25;

  const items: MviItem[] = [
    {
      bet: '主胜', modelProb: homeWinProb, marketProb: Math.round(marketHome * 100) / 100,
      mvi: calculateMVI(homeWinProb, odds.homeWin),
      rating: rateMVI(calculateMVI(homeWinProb, odds.homeWin)) as '无价值' | '一般价值' | '高价值' | '超级价值',
    },
    {
      bet: '平局', modelProb: drawProb, marketProb: Math.round(marketDraw * 100) / 100,
      mvi: calculateMVI(drawProb, odds.draw),
      rating: rateMVI(calculateMVI(drawProb, odds.draw)) as '无价值' | '一般价值' | '高价值' | '超级价值',
    },
    {
      bet: '客胜', modelProb: awayWinProb, marketProb: Math.round(marketAway * 100) / 100,
      mvi: calculateMVI(awayWinProb, odds.awayWin),
      rating: rateMVI(calculateMVI(awayWinProb, odds.awayWin)) as '无价值' | '一般价值' | '高价值' | '超级价值',
    },
    {
      bet: 'Over 2.5', modelProb: over25Prob, marketProb: Math.round(marketOver * 100) / 100,
      mvi: calculateMVI(over25Prob, odds.over25),
      rating: rateMVI(calculateMVI(over25Prob, odds.over25)) as '无价值' | '一般价值' | '高价值' | '超级价值',
    },
    {
      bet: 'Under 2.5', modelProb: under25Prob, marketProb: Math.round(marketUnder * 100) / 100,
      mvi: calculateMVI(under25Prob, odds.under25),
      rating: rateMVI(calculateMVI(under25Prob, odds.under25)) as '无价值' | '一般价值' | '高价值' | '超级价值',
    },
  ];

  return items.sort((a, b) => b.mvi - a.mvi);
}

/**
 * Generate parlay recommendations
 */
export function generateParlays(predictions: { match: string; direction: string; odds: number; prob: number }[]): ParlayItem[] {
  if (predictions.length < 2) return [];

  const highProb = predictions.filter(p => p.prob > 0.55).sort((a, b) => b.prob - a.prob);
  const midProb = predictions.filter(p => p.prob >= 0.35);

  const result: ParlayItem[] = [];

  if (highProb.length >= 2) {
    const sel = highProb.slice(0, 2);
    result.push({
      type: '稳健', selections: sel.map(s => `${s.match} ${s.direction === 'home_win' ? '主胜' : s.direction === 'away_win' ? '客胜' : '平'}`),
      odds: Math.round(sel.reduce((a, b) => a * b.odds, 1) * 100) / 100,
      probability: Math.round(sel.reduce((a, b) => a * b.prob, 1) * 100) / 100,
      risk: 'Low',
    });
  }

  if (midProb.length >= 3) {
    const sel = midProb.slice(0, 3);
    result.push({
      type: '平衡', selections: sel.map(s => `${s.match} ${s.direction === 'home_win' ? '主胜' : s.direction === 'away_win' ? '客胜' : '平'}`),
      odds: Math.round(sel.reduce((a, b) => a * b.odds, 1) * 100) / 100,
      probability: Math.round(sel.reduce((a, b) => a * b.prob, 1) * 100) / 100,
      risk: 'Medium',
    });
  }

  return result;
}

/**
 * Generate bankroll allocation
 */
export function generateBankroll(): { conservative: BankrollPlan; balanced: BankrollPlan; aggressive: BankrollPlan } {
  return {
    conservative: {
      allocations: { '胜平负': 60, '大小球': 25, '比分': 10, '串关': 5 },
      expectedReturn: 8,
    },
    balanced: {
      allocations: { '胜平负': 40, '比分': 25, '串关': 20, '大小球': 15 },
      expectedReturn: 18,
    },
    aggressive: {
      allocations: { '串关': 35, '比分': 30, '胜平负': 20, '大小球': 15 },
      expectedReturn: 40,
    },
  };
}
