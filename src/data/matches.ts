import type { Match, Prediction, PostMatchReview, ModelState, TeamRatings, Odds } from '../lib/types';

// ========== 球队中文名称映射 ==========
/** cn = Chinese Name，将球队英文名映射为中文名 */
export const teamNames: Record<string, string> = {
  'Mexico': '墨西哥', 'South Africa': '南非', 'South Korea': '韩国', 'Czechia': '捷克',
  'Canada': '加拿大', 'Bosnia': '波黑', 'Qatar': '卡塔尔', 'Switzerland': '瑞士',
  'Brazil': '巴西', 'Morocco': '摩洛哥', 'Haiti': '海地', 'Scotland': '苏格兰',
  'Spain': '西班牙', 'Cape Verde': '佛得角',
  'Belgium': '比利时', 'Egypt': '埃及',
  'Saudi Arabia': '沙特', 'Uruguay': '乌拉圭',
  'Iran': '伊朗', 'New Zealand': '新西兰',
  'France': '法国', 'Senegal': '塞内加尔',
  'Iraq': '伊拉克', 'Norway': '挪威',
  'Argentina': '阿根廷', 'Algeria': '阿尔及利亚',
  'Austria': '奥地利', 'Jordan': '约旦',
  'Portugal': '葡萄牙', 'DR Congo': '刚果(金)',
  'England': '英格兰', 'Croatia': '克罗地亚',
  'Ghana': '加纳', 'Panama': '巴拿马',
  'Colombia': '哥伦比亚', 'Uzbekistan': '乌兹别克',
  'Sweden': '瑞典', 'Tunisia': '突尼斯', 'Ivory Coast': '科特迪瓦', 'Ecuador': '厄瓜多尔',
  'Netherlands': '荷兰', 'Japan': '日本', 'Germany': '德国', 'Curacao': '库拉索',
  'Australia': '澳大利亚', 'Turkiye': '土耳其', 'USA': '美国', 'Paraguay': '巴拉圭',
};

// ========== 球队旗帜 ==========
export const teamFlags: Record<string, string> = {
  'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷', 'Czechia': '🇨🇿',
  'Canada': '🇨🇦', 'Bosnia': '🇧🇦', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭',
  'Brazil': '🇧🇷', 'Morocco': '🇲🇦', 'Haiti': '🇭🇹', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Spain': '🇪🇸', 'Cape Verde': '🇨🇻', 'Belgium': '🇧🇪', 'Egypt': '🇪🇬',
  'Saudi Arabia': '🇸🇦', 'Uruguay': '🇺🇾', 'Iran': '🇮🇷', 'New Zealand': '🇳🇿',
  'France': '🇫🇷', 'Senegal': '🇸🇳', 'Iraq': '🇮🇶', 'Norway': '🇳🇴',
  'Argentina': '🇦🇷', 'Algeria': '🇩🇿', 'Austria': '🇦🇹', 'Jordan': '🇯🇴',
  'Portugal': '🇵🇹', 'DR Congo': '🇨🇩', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Croatia': '🇭🇷',
  'Ghana': '🇬🇭', 'Panama': '🇵🇦',   'Colombia': '🇨🇴', 'Uzbekistan': '🇺🇿',
  'Sweden': '🇸🇪', 'Tunisia': '🇹🇳', 'Ivory Coast': '🇨🇮', 'Ecuador': '🇪🇨',
  'Netherlands': '🇳🇱', 'Japan': '🇯🇵', 'Germany': '🇩🇪', 'Curacao': '🇨🇼',
  'Australia': '🇦🇺', 'Turkiye': '🇹🇷', 'USA': '🇺🇸', 'Paraguay': '🇵🇾',
};

export function cn(name: string): string { return teamNames[name] || name; }
export function flag(name: string): string { return teamFlags[name] || ''; }

// ========== 模型状态 ==========
// ⚠️ 静态 modelState 已弃用（2026-06-23）
// 原因：export-json.mjs 会从实际比赛数据动态计算 modelState
// static modelState 与动态计算结果冲突，导致数据不一致
// 当前 modelState 由 export-json.mjs 的 computeModelState() 动态生成
export const modelState = {
  directionAccuracy: 0,
  scoreTop3Accuracy: 0,
  scoreTop1Accuracy: 0,
  totalPredictions: 0,
  completedPredictions: 0,
  directionCorrect: 0,
  scoreTop3Correct: 0,
  scoreTop1Correct: 0,
  overallDrawRate: 0,
  overallTotalMatches: 0,
  factorWeights: {},
};

// ========== 球队评分 ==========
export const teamRatings: Record<string, TeamRatings> = {
  'Spain': { attack: 88, defense: 85, form: 82, tournament: 90, elo: 1827 },
  'Cape Verde': { attack: 35, defense: 55, form: 48, tournament: 30, elo: 1463 },
  'Belgium': { attack: 82, defense: 76, form: 80, tournament: 78, elo: 1891 },
  'Egypt': { attack: 70, defense: 72, form: 65, tournament: 68, elo: 1689 },
  'Saudi Arabia': { attack: 50, defense: 45, form: 35, tournament: 40, elo: 1532 },
  'Uruguay': { attack: 78, defense: 80, form: 72, tournament: 82, elo: 1838 },
  'Iran': { attack: 60, defense: 68, form: 58, tournament: 55, elo: 1617 },
  'New Zealand': { attack: 55, defense: 58, form: 52, tournament: 35, elo: 1553 },
  'France': { attack: 90, defense: 84, form: 82, tournament: 92, elo: 1890 },
  'Senegal': { attack: 75, defense: 70, form: 68, tournament: 72, elo: 1740 },
  'Iraq': { attack: 45, defense: 50, form: 42, tournament: 45, elo: 1476 },
  'Norway': { attack: 85, defense: 72, form: 78, tournament: 60, elo: 1824 },
  'Argentina': { attack: 92, defense: 88, form: 95, tournament: 95, elo: 1925 },
  'Algeria': { attack: 68, defense: 65, form: 62, tournament: 58, elo: 1635 },
  'Austria': { attack: 75, defense: 78, form: 80, tournament: 65, elo: 1793 },
  'Jordan': { attack: 40, defense: 48, form: 38, tournament: 30, elo: 1407 },
  'Portugal': { attack: 87, defense: 83, form: 80, tournament: 85, elo: 1957 },
  'DR Congo': { attack: 55, defense: 62, form: 50, tournament: 35, elo: 1603 },
  'England': { attack: 85, defense: 82, form: 78, tournament: 80, elo: 1864 },
  'Croatia': { attack: 72, defense: 75, form: 65, tournament: 78, elo: 1786 },
  'Ghana': { attack: 62, defense: 58, form: 35, tournament: 60, elo: 1634 },
  'Panama': { attack: 58, defense: 62, form: 55, tournament: 40, elo: 1556 },
  'Colombia': { attack: 80, defense: 76, form: 75, tournament: 78, elo: 1866 },
  'Uzbekistan': { attack: 58, defense: 65, form: 55, tournament: 40, elo: 1584 },
  // ---- 补充 24 支缺失评分 ----
  'Brazil': { attack: 88, defense: 82, form: 85, tournament: 88, elo: 1872 },
  'Germany': { attack: 82, defense: 78, form: 75, tournament: 82, elo: 1853 },
  'Netherlands': { attack: 78, defense: 80, form: 76, tournament: 75, elo: 1793 },
  'Mexico': { attack: 72, defense: 70, form: 68, tournament: 72, elo: 1837 },
  'Japan': { attack: 70, defense: 72, form: 72, tournament: 68, elo: 1760 },
  'Switzerland': { attack: 68, defense: 75, form: 70, tournament: 68, elo: 1815 },
  'USA': { attack: 72, defense: 68, form: 70, tournament: 68, elo: 1783 },
  'Morocco': { attack: 70, defense: 75, form: 68, tournament: 72, elo: 1795 },
  'Sweden': { attack: 72, defense: 72, form: 70, tournament: 65, elo: 1726 },
  'South Korea': { attack: 68, defense: 65, form: 66, tournament: 62, elo: 1713 },
  'Ivory Coast': { attack: 72, defense: 65, form: 68, tournament: 62, elo: 1696 },
  'Turkiye': { attack: 68, defense: 62, form: 62, tournament: 60, elo: 1646 },
  'Czechia': { attack: 62, defense: 65, form: 60, tournament: 58, elo: 1668 },
  'Scotland': { attack: 60, defense: 62, form: 58, tournament: 52, elo: 1666 },
  'Ecuador': { attack: 65, defense: 65, form: 62, tournament: 58, elo: 1674 },
  'Canada': { attack: 66, defense: 62, form: 65, tournament: 55, elo: 1787 },
  'Paraguay': { attack: 60, defense: 68, form: 58, tournament: 55, elo: 1684 },
  'Australia': { attack: 65, defense: 68, form: 62, tournament: 60, elo: 1647 },
  'Tunisia': { attack: 58, defense: 62, form: 55, tournament: 52, elo: 1581 },
  'Bosnia': { attack: 58, defense: 55, form: 52, tournament: 48, elo: 1582 },
  'Qatar': { attack: 52, defense: 50, form: 48, tournament: 45, elo: 1506 },
  'South Africa': { attack: 50, defense: 52, form: 45, tournament: 42, elo: 1532 },
  'Haiti': { attack: 45, defense: 42, form: 40, tournament: 30, elo: 1450 },
  'Curacao': { attack: 40, defense: 38, form: 38, tournament: 25, elo: 1427 },
};

// ========== 比赛数据 ==========
export const matches: Match[] = [
  // ---- 6/11 已完成 ----
  { id: 'mex-rsa', date: '2026-06-11', tournament: '2026 FIFA World Cup', group: 'A组', round: '第一轮', matchday: 1, homeTeam: 'Mexico', awayTeam: 'South Africa', venue: 'Estadio Azteca, Mexico City', kickoff: '6/11 23:00', localKickoff: '6/11 11:00', localTZ: 'CT', status: 'finished',
    matchStats: {
    possession: { home: 61, away: 40 },
    shots: { home: 16, away: 3 },
    shotsOnTarget: { home: 4, away: 2 },
    xg: { home: 0, away: 0 },
    corners: { home: 3, away: 1 },
    fouls: { home: 12, away: 11 },
    cards: { home: { yellow: 2, red: 0 }, away: { yellow: 4, red: 0 } },
    offsides: { home: 1, away: 1 },
    crosses: { home: 12, away: 8 },
    interceptions: { home: 8, away: 7 },
    saves: { home: 2, away: 2 }
  }, homeScore: 2, awayScore: 0 },
  { id: 'kor-cze', date: '2026-06-11', tournament: '2026 FIFA World Cup', group: 'A组', round: '第一轮', matchday: 1, homeTeam: 'South Korea', awayTeam: 'Czechia', venue: 'SoFi Stadium, Los Angeles', kickoff: '6/12 03:00', localKickoff: '6/11 14:00', localTZ: 'PT', status: 'finished',
    matchStats: {
    possession: { home: 62, away: 38 },
    shots: { home: 15, away: 7 },
    shotsOnTarget: { home: 6, away: 4 },
    xg: { home: 0, away: 0 },
    corners: { home: 4, away: 5 },
    fouls: { home: 9, away: 16 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 0, red: 0 } },
    offsides: { home: 2, away: 2 },
    crosses: { home: 12, away: 15 },
    interceptions: { home: 11, away: 7 },
    saves: { home: 3, away: 4 }
  }, homeScore: 2, awayScore: 1 },
  // ---- 6/12 已完成 ----
  { id: 'can-bih', date: '2026-06-12', tournament: '2026 FIFA World Cup', group: 'B组', round: '第一轮', matchday: 2, homeTeam: 'Canada', awayTeam: 'Bosnia', venue: 'BMO Field, Toronto', kickoff: '6/13 03:00', localKickoff: '6/12 15:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 61, away: 39 },
    shots: { home: 13, away: 8 },
    shotsOnTarget: { home: 4, away: 3 },
    xg: { home: 0, away: 0 },
    corners: { home: 9, away: 4 },
    fouls: { home: 10, away: 20 },
    cards: { home: { yellow: 2, red: 0 }, away: { yellow: 3, red: 0 } },
    offsides: { home: 1, away: 0 },
    crosses: { home: 24, away: 10 },
    interceptions: { home: 4, away: 10 },
    saves: { home: 2, away: 1 }
  }, homeScore: 1, awayScore: 1 },
  // ---- 6/13 已完成 ----
  { id: 'qat-sui', date: '2026-06-13', tournament: '2026 FIFA World Cup', group: 'B组', round: '第一轮', matchday: 3, homeTeam: 'Qatar', awayTeam: 'Switzerland', venue: 'BC Place, Vancouver', kickoff: '6/13 22:00', localKickoff: '6/13 10:00', localTZ: 'PT', status: 'finished',
    matchStats: {
    possession: { home: 32, away: 68 },
    shots: { home: 7, away: 26 },
    shotsOnTarget: { home: 4, away: 7 },
    xg: { home: 0, away: 0 },
    corners: { home: 3, away: 10 },
    fouls: { home: 12, away: 11 },
    cards: { home: { yellow: 2, red: 0 }, away: { yellow: 1, red: 0 } },
    offsides: { home: 0, away: 1 },
    crosses: { home: 8, away: 35 },
    interceptions: { home: 10, away: 7 },
    saves: { home: 5, away: 3 }
  }, homeScore: 1, awayScore: 1 },
  { id: 'bra-mar', date: '2026-06-13', tournament: '2026 FIFA World Cup', group: 'C组', round: '第一轮', matchday: 3, homeTeam: 'Brazil', awayTeam: 'Morocco', venue: 'MetLife Stadium, New York', kickoff: '6/14 01:00', localKickoff: '6/13 13:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 51, away: 49 },
    shots: { home: 12, away: 14 },
    shotsOnTarget: { home: 5, away: 3 },
    xg: { home: 0, away: 0 },
    corners: { home: 6, away: 2 },
    fouls: { home: 16, away: 14 },
    cards: { home: { yellow: 2, red: 0 }, away: { yellow: 0, red: 0 } },
    offsides: { home: 0, away: 1 },
    crosses: { home: 16, away: 15 },
    interceptions: { home: 5, away: 4 },
    saves: { home: 2, away: 4 }
  }, homeScore: 1, awayScore: 1 },
  { id: 'hai-sco', date: '2026-06-13', tournament: '2026 FIFA World Cup', group: 'D组', round: '第一轮', matchday: 3, homeTeam: 'Haiti', awayTeam: 'Scotland', venue: 'Gillette Stadium, Boston', kickoff: '6/14 04:00', localKickoff: '6/13 16:00', localTZ: 'ET', status: 'finished', homeScore: 0, awayScore: 1 },
  // ---- 6/13-14 其他场次 ----
  { id: 'usa-par', date: '2026-06-13', tournament: '2026 FIFA World Cup', group: 'E组', round: '第一轮', matchday: 3, homeTeam: 'USA', awayTeam: 'Paraguay', venue: 'SoFi Stadium, Los Angeles', kickoff: '6/14 09:00', localKickoff: '6/13 21:00', localTZ: 'PT', status: 'finished',
    matchStats: {
    possession: { home: 65, away: 35 },
    shots: { home: 16, away: 9 },
    shotsOnTarget: { home: 6, away: 1 },
    xg: { home: 0, away: 0 },
    corners: { home: 3, away: 1 },
    fouls: { home: 13, away: 17 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 4, red: 0 } },
    offsides: { home: 2, away: 1 },
    crosses: { home: 17, away: 5 },
    interceptions: { home: 11, away: 9 },
    saves: { home: 0, away: 3 }
  }, homeScore: 4, awayScore: 1 },
  { id: 'ned-jpn', date: '2026-06-14', tournament: '2026 FIFA World Cup', group: 'E组', round: '第一轮', matchday: 4, homeTeam: 'Netherlands', awayTeam: 'Japan', venue: 'AT&T Stadium, Dallas', kickoff: '6/15 04:00', localKickoff: '6/14 16:00', localTZ: 'CT', status: 'finished', homeScore: 2, awayScore: 2 },
  { id: 'ger-cuw', date: '2026-06-14', tournament: '2026 FIFA World Cup', group: 'F组', round: '第一轮', matchday: 4, homeTeam: 'Germany', awayTeam: 'Curacao', venue: 'NRG Stadium, Houston', kickoff: '6/15 06:00', localKickoff: '6/14 18:00', localTZ: 'CT', status: 'finished', homeScore: 7, awayScore: 1 },
  { id: 'aus-tur', date: '2026-06-14', tournament: '2026 FIFA World Cup', group: 'F组', round: '第一轮', matchday: 4, homeTeam: 'Australia', awayTeam: 'Turkiye', venue: 'BC Place, Vancouver', kickoff: '6/15 00:00', localKickoff: '6/14 12:00', localTZ: 'PT', status: 'finished', homeScore: 2, awayScore: 0 },
  { id: 'civ-ecu', date: '2026-06-14', tournament: '2026 FIFA World Cup', group: 'G组', round: '第一轮', matchday: 4, homeTeam: 'Ivory Coast', awayTeam: 'Ecuador', venue: 'Lincoln Financial Field, Philadelphia', kickoff: '6/15 07:00', localKickoff: '6/14 19:00', localTZ: 'ET', status: 'finished', homeScore: 1, awayScore: 0 },
  { id: 'swe-tun', date: '2026-06-15', tournament: '2026 FIFA World Cup', group: 'G组', round: '第一轮', matchday: 5, homeTeam: 'Sweden', awayTeam: 'Tunisia', venue: 'Estadio Monterrey, Mexico', kickoff: '6/16 02:00', localKickoff: '6/15 14:00', localTZ: 'CT', status: 'finished', homeScore: 5, awayScore: 1 },
  // ---- 6/16 已完成（北京时间）----
  { id: 'esp-cpv', date: '2026-06-16', tournament: '2026 FIFA World Cup', group: 'H组', round: '第一轮', matchday: 5, homeTeam: 'Spain', awayTeam: 'Cape Verde', venue: 'Mercedes-Benz Stadium, Atlanta', kickoff: '6/16 07:00', localKickoff: '6/15 19:00', localTZ: 'ET', status: 'finished', homeScore: 0, awayScore: 0 },
  { id: 'bel-egy', date: '2026-06-16', tournament: '2026 FIFA World Cup', group: 'G组', round: '第一轮', matchday: 5, homeTeam: 'Belgium', awayTeam: 'Egypt', venue: 'Lumen Field, Seattle', kickoff: '6/16 04:00', localKickoff: '6/15 16:00', localTZ: 'PT', status: 'finished', homeScore: 1, awayScore: 1 },
  { id: 'ksa-uru', date: '2026-06-16', tournament: '2026 FIFA World Cup', group: 'H组', round: '第一轮', matchday: 5, homeTeam: 'Saudi Arabia', awayTeam: 'Uruguay', venue: 'Hard Rock Stadium, Miami', kickoff: '6/16 10:00', localKickoff: '6/15 22:00', localTZ: 'ET', status: 'finished', homeScore: 1, awayScore: 1 },
  { id: 'irn-nzl', date: '2026-06-16', tournament: '2026 FIFA World Cup', group: 'G组', round: '第一轮', matchday: 5, homeTeam: 'Iran', awayTeam: 'New Zealand', venue: 'SoFi Stadium, Los Angeles', kickoff: '6/16 01:00', localKickoff: '6/15 13:00', localTZ: 'PT', status: 'finished', homeScore: 2, awayScore: 2 },
  // ---- 6/17 已完成（北京时间）----
  { id: 'fra-sen', date: '2026-06-17', tournament: '2026 FIFA World Cup', group: 'I组', round: '第一轮', matchday: 6, homeTeam: 'France', awayTeam: 'Senegal', venue: 'MetLife Stadium, New Jersey', kickoff: '6/17 07:00', localKickoff: '6/16 19:00', localTZ: 'ET', status: 'finished', homeScore: 3, awayScore: 1 },
  { id: 'irq-nor', date: '2026-06-17', tournament: '2026 FIFA World Cup', group: 'I组', round: '第一轮', matchday: 6, homeTeam: 'Iraq', awayTeam: 'Norway', venue: 'Gillette Stadium, Boston', kickoff: '6/17 04:00', localKickoff: '6/16 16:00', localTZ: 'ET', status: 'finished', homeScore: 1, awayScore: 4 },
  { id: 'arg-alg', date: '2026-06-17', tournament: '2026 FIFA World Cup', group: 'J组', round: '第一轮', matchday: 6, homeTeam: 'Argentina', awayTeam: 'Algeria', venue: 'Arrowhead Stadium, Kansas City', kickoff: '6/17 10:00', localKickoff: '6/16 22:00', localTZ: 'CT', status: 'finished', homeScore: 3, awayScore: 0 },
  { id: 'aut-jor', date: '2026-06-17', tournament: '2026 FIFA World Cup', group: 'J组', round: '第一轮', matchday: 6, homeTeam: 'Austria', awayTeam: 'Jordan', venue: 'AT&T Stadium, Dallas', kickoff: '6/17 01:00', localKickoff: '6/16 13:00', localTZ: 'CT', status: 'finished', homeScore: 3, awayScore: 1 },
  // ---- 6/18 今日（北京时间）----
  { id: 'por-cod', date: '2026-06-18', tournament: '2026 FIFA World Cup', group: 'K组', round: '第一轮', matchday: 7, homeTeam: 'Portugal', awayTeam: 'DR Congo', venue: 'NRG Stadium, Houston', kickoff: '6/18 06:00', localKickoff: '6/17 18:00', localTZ: 'CT', status: 'finished', homeScore: 1, awayScore: 1 },
  { id: 'eng-cro', date: '2026-06-18', tournament: '2026 FIFA World Cup', group: 'L组', round: '第一轮', matchday: 7, homeTeam: 'England', awayTeam: 'Croatia', venue: 'AT&T Stadium, Arlington', kickoff: '6/18 04:00', localKickoff: '6/17 16:00', localTZ: 'CT', status: 'finished', homeScore: 4, awayScore: 2 },
  { id: 'gha-pan', date: '2026-06-18', tournament: '2026 FIFA World Cup', group: 'L组', round: '第一轮', matchday: 7, homeTeam: 'Ghana', awayTeam: 'Panama', venue: 'BMO Field, Toronto', kickoff: '6/18 07:00', localKickoff: '6/17 19:00', localTZ: 'ET', status: 'finished', homeScore: 1, awayScore: 0 },
  { id: 'uzb-col', date: '2026-06-18', tournament: '2026 FIFA World Cup', group: 'K组', round: '第一轮', matchday: 7, homeTeam: 'Uzbekistan', awayTeam: 'Colombia', venue: 'Estadio Azteca, Mexico City', kickoff: '6/18 10:00', localKickoff: '6/17 22:00', localTZ: 'CT', status: 'finished', homeScore: 1, awayScore: 3 },
  // ---- 6/19 第二轮（北京时间）----
  { id: 'cze-rsa-2', date: '2026-06-19', tournament: '2026 FIFA World Cup', group: 'A组', round: '第二轮', matchday: 8, homeTeam: 'Czechia', awayTeam: 'South Africa', venue: 'Mercedes-Benz Stadium, Atlanta', kickoff: '6/19 00:00', localKickoff: '6/18 12:00', localTZ: 'ET', status: 'finished',
    homeScore: 1, awayScore: 1 },
  { id: 'sui-bih-2', date: '2026-06-19', tournament: '2026 FIFA World Cup', group: 'B组', round: '第二轮', matchday: 8, homeTeam: 'Switzerland', awayTeam: 'Bosnia', venue: 'SoFi Stadium, Inglewood', kickoff: '6/19 03:00', localKickoff: '6/18 15:00', localTZ: 'PT', status: 'finished',
    homeScore: 4, awayScore: 1 },
  { id: 'can-qat-2', date: '2026-06-19', tournament: '2026 FIFA World Cup', group: 'B组', round: '第二轮', matchday: 8, homeTeam: 'Canada', awayTeam: 'Qatar', venue: 'BC Place, Vancouver', kickoff: '6/19 06:00', localKickoff: '6/18 18:00', localTZ: 'PT', status: 'finished',
    matchStats: {
    possession: { home: 79, away: 21 },
    shots: { home: 32, away: 2 },
    shotsOnTarget: { home: 10, away: 0 },
    xg: { home: 0, away: 0 },
    corners: { home: 19, away: 1 },
    fouls: { home: 9, away: 10 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 3, red: 0 } },
    offsides: { home: 1, away: 1 },
    crosses: { home: 55, away: 3 },
    interceptions: { home: 6, away: 11 },
    saves: { home: 0, away: 4 }
  },
    homeScore: 6, awayScore: 0 },
  { id: 'mex-kor-2', date: '2026-06-19', tournament: '2026 FIFA World Cup', group: 'A组', round: '第二轮', matchday: 8, homeTeam: 'Mexico', awayTeam: 'South Korea', venue: 'Estadio Akron, Guadalajara', kickoff: '6/19 09:00', localKickoff: '6/18 21:00', localTZ: 'CT', status: 'finished',
    homeScore: 1, awayScore: 0 },
  // ---- 6/20 第二轮（北京时间）----
  { id: 'usa-aus-2', date: '2026-06-20', tournament: '2026 FIFA World Cup', group: 'D组', round: '第二轮', matchday: 8, homeTeam: 'USA', awayTeam: 'Australia', venue: 'Lumen Field, Seattle', kickoff: '6/20 03:00', localKickoff: '6/19 12:00', localTZ: 'PT', status: 'finished',
    matchStats: {
    possession: { home: 62, away: 38 },
    shots: { home: 10, away: 5 },
    shotsOnTarget: { home: 2, away: 2 },
    xg: { home: 0, away: 0 },
    corners: { home: 7, away: 4 },
    fouls: { home: 12, away: 16 },
    cards: { home: { yellow: 3, red: 0 }, away: { yellow: 4, red: 0 } },
    offsides: { home: 1, away: 0 },
    crosses: { home: 14, away: 19 },
    interceptions: { home: 21, away: 7 },
    saves: { home: 2, away: 1 }
  }, homeScore: 2, awayScore: 0 },
  { id: 'sco-mar-2', date: '2026-06-20', tournament: '2026 FIFA World Cup', group: 'C组', round: '第二轮', matchday: 8, homeTeam: 'Scotland', awayTeam: 'Morocco', venue: 'Gillette Stadium, Boston', kickoff: '6/20 03:00', localKickoff: '6/19 15:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 41, away: 59 },
    shots: { home: 6, away: 12 },
    shotsOnTarget: { home: 0, away: 2 },
    xg: { home: 0, away: 0 },
    corners: { home: 2, away: 5 },
    fouls: { home: 11, away: 8 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 1, red: 0 } },
    offsides: { home: 1, away: 0 },
    crosses: { home: 13, away: 10 },
    interceptions: { home: 9, away: 5 },
    saves: { home: 1, away: 0 }
  }, homeScore: 0, awayScore: 1 },
  { id: 'bra-hai-2', date: '2026-06-20', tournament: '2026 FIFA World Cup', group: 'C组', round: '第二轮', matchday: 8, homeTeam: 'Brazil', awayTeam: 'Haiti', venue: 'Lincoln Financial Field, Philadelphia', kickoff: '6/20 09:00', localKickoff: '6/19 21:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 57, away: 43 },
    shots: { home: 8, away: 7 },
    shotsOnTarget: { home: 5, away: 3 },
    xg: { home: 0, away: 0 },
    corners: { home: 4, away: 4 },
    fouls: { home: 13, away: 14 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 3, red: 0 } },
    offsides: { home: 8, away: 4 },
    crosses: { home: 9, away: 11 },
    interceptions: { home: 10, away: 9 },
    saves: { home: 3, away: 2 }
  }, homeScore: 3, awayScore: 0 },
  { id: 'tur-par-2', date: '2026-06-20', tournament: '2026 FIFA World Cup', group: 'D组', round: '第二轮', matchday: 8, homeTeam: 'Turkiye', awayTeam: 'Paraguay', venue: 'Levi Stadium, Santa Clara', kickoff: '6/20 12:00', localKickoff: '6/19 21:00', localTZ: 'PT', status: 'finished',
    matchStats: {
    possession: { home: 79, away: 22 },
    shots: { home: 32, away: 7 },
    shotsOnTarget: { home: 5, away: 2 },
    xg: { home: 0, away: 0 },
    corners: { home: 12, away: 0 },
    fouls: { home: 14, away: 15 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 2, red: 0 } },
    offsides: { home: 2, away: 3 },
    crosses: { home: 42, away: 6 },
    interceptions: { home: 6, away: 9 },
    saves: { home: 1, away: 5 }
  }, homeScore: 0, awayScore: 1 },
  // ---- 6/21 MD10 已完赛（北京时间）----
  { id: 'ned-swe-2', date: '2026-06-21', tournament: '2026 FIFA World Cup', group: 'F组', round: '第二轮', matchday: 9, homeTeam: 'Netherlands', awayTeam: 'Sweden', venue: 'NRG Stadium, Houston', kickoff: '6/21 01:00', localKickoff: '6/20 12:00', localTZ: 'CT', status: 'finished',
    matchStats: {
    possession: { home: 51, away: 49 },
    shots: { home: 10, away: 16 },
    shotsOnTarget: { home: 7, away: 8 },
    xg: { home: 0, away: 0 },
    corners: { home: 2, away: 5 },
    fouls: { home: 9, away: 12 },
    cards: { home: { yellow: 0, red: 0 }, away: { yellow: 3, red: 0 } },
    offsides: { home: 3, away: 3 },
    crosses: { home: 15, away: 21 },
    interceptions: { home: 8, away: 6 },
    saves: { home: 7, away: 2 }
  }, homeScore: 5, awayScore: 1 },
  { id: 'ger-civ-2', date: '2026-06-21', tournament: '2026 FIFA World Cup', group: 'E组', round: '第二轮', matchday: 9, homeTeam: 'Germany', awayTeam: 'Ivory Coast', venue: 'BMO Field, Toronto', kickoff: '6/21 04:00', localKickoff: '6/20 16:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 59, away: 41 },
    shots: { home: 16, away: 9 },
    shotsOnTarget: { home: 7, away: 2 },
    xg: { home: 0, away: 0 },
    corners: { home: 8, away: 3 },
    fouls: { home: 5, away: 7 },
    cards: { home: { yellow: 0, red: 0 }, away: { yellow: 0, red: 0 } },
    offsides: { home: 0, away: 1 },
    crosses: { home: 21, away: 9 },
    interceptions: { home: 7, away: 13 },
    saves: { home: 1, away: 5 }
  }, homeScore: 2, awayScore: 1 },
  { id: 'ecu-cuw-2', date: '2026-06-21', tournament: '2026 FIFA World Cup', group: 'E组', round: '第二轮', matchday: 9, homeTeam: 'Ecuador', awayTeam: 'Curacao', venue: 'Arrowhead Stadium, Kansas City', kickoff: '6/21 08:00', localKickoff: '6/20 19:00', localTZ: 'CT', status: 'finished',
    matchStats: {
    possession: { home: 75, away: 25 },
    shots: { home: 27, away: 10 },
    shotsOnTarget: { home: 15, away: 3 },
    xg: { home: 0, away: 0 },
    corners: { home: 9, away: 0 },
    fouls: { home: 7, away: 10 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 5, red: 0 } },
    offsides: { home: 1, away: 2 },
    crosses: { home: 32, away: 1 },
    interceptions: { home: 7, away: 8 },
    saves: { home: 3, away: 15 }
  }, homeScore: 0, awayScore: 0 },
  { id: 'tun-jpn-2', date: '2026-06-21', tournament: '2026 FIFA World Cup', group: 'F组', round: '第二轮', matchday: 9, homeTeam: 'Tunisia', awayTeam: 'Japan', venue: 'Estadio BBVA, Monterrey', kickoff: '6/21 12:00', localKickoff: '6/20 23:00', localTZ: 'CT', status: 'finished',
    matchStats: {
    possession: { home: 38, away: 62 },
    shots: { home: 2, away: 11 },
    shotsOnTarget: { home: 0, away: 5 },
    xg: { home: 0, away: 0 },
    corners: { home: 3, away: 5 },
    fouls: { home: 8, away: 15 },
    cards: { home: { yellow: 0, red: 0 }, away: { yellow: 0, red: 0 } },
    offsides: { home: 1, away: 1 },
    crosses: { home: 10, away: 11 },
    interceptions: { home: 14, away: 6 },
    saves: { home: 1, away: 0 }
  }, homeScore: 0, awayScore: 4 },
  // ---- 6/22 第二轮（北京时间）----
  { id: 'esp-ksa-2', date: '2026-06-22', tournament: '2026 FIFA World Cup', group: 'H组', round: '第二轮', matchday: 10, homeTeam: 'Spain', awayTeam: 'Saudi Arabia', venue: 'Mercedes-Benz Stadium, Atlanta', kickoff: '6/22 00:00', localKickoff: '6/21 12:00', localTZ: 'ET', status: 'finished' },
  { id: 'bel-irn-2', date: '2026-06-22', tournament: '2026 FIFA World Cup', group: 'G组', round: '第二轮', matchday: 10, homeTeam: 'Belgium', awayTeam: 'Iran', venue: 'SoFi Stadium, Inglewood', kickoff: '6/22 03:00', localKickoff: '6/21 12:00', localTZ: 'PT', status: 'finished' },
  { id: 'uru-cpv-2', date: '2026-06-22', tournament: '2026 FIFA World Cup', group: 'H组', round: '第二轮', matchday: 10, homeTeam: 'Uruguay', awayTeam: 'Cape Verde', venue: 'Hard Rock Stadium, Miami', kickoff: '6/22 06:00', localKickoff: '6/21 18:00', localTZ: 'ET', status: 'finished' },
  { id: 'nzl-egy-2', date: '2026-06-22', tournament: '2026 FIFA World Cup', group: 'G组', round: '第二轮', matchday: 10, homeTeam: 'New Zealand', awayTeam: 'Egypt', venue: 'BC Place, Vancouver', kickoff: '6/22 09:00', localKickoff: '6/21 18:00', localTZ: 'PT', status: 'finished' },
  // ---- 6/23 第二轮（北京时间）----
  { id: 'arg-aut-2', date: '2026-06-22', tournament: '2026 FIFA World Cup', group: 'J组', round: '第二轮', matchday: 11, homeTeam: 'Argentina', awayTeam: 'Austria', venue: 'AT&T Stadium, Arlington', kickoff: '6/23 01:00', localKickoff: '6/22 12:00', localTZ: 'CT', status: 'finished', homeScore: 2, awayScore: 0 },
  { id: 'fra-irq-2', date: '2026-06-22', tournament: '2026 FIFA World Cup', group: 'I组', round: '第二轮', matchday: 11, homeTeam: 'France', awayTeam: 'Iraq', venue: 'Lincoln Financial Field, Philadelphia', kickoff: '6/23 05:00', localKickoff: '6/22 17:00', localTZ: 'ET', status: 'finished', homeScore: 3, awayScore: 0 },
  { id: 'nor-sen-2', date: '2026-06-22', tournament: '2026 FIFA World Cup', group: 'I组', round: '第二轮', matchday: 11, homeTeam: 'Norway', awayTeam: 'Senegal', venue: 'MetLife Stadium, East Rutherford', kickoff: '6/23 08:00', localKickoff: '6/22 20:00', localTZ: 'ET', status: 'finished', homeScore: 3, awayScore: 2 },
  { id: 'jor-alg-2', date: '2026-06-22', tournament: '2026 FIFA World Cup', group: 'J组', round: '第二轮', matchday: 11, homeTeam: 'Jordan', awayTeam: 'Algeria', venue: 'Levi Stadium, Santa Clara', kickoff: '6/23 11:00', localKickoff: '6/22 20:00', localTZ: 'PT', status: 'finished', homeScore: 1, awayScore: 2 },
  // ---- 6/23 第二轮 Groups K+L（北京时间6/24）----
  { id: 'eng-gha-2', date: '2026-06-23', tournament: '2026 FIFA World Cup', group: 'L组', round: '第二轮', matchday: 12, homeTeam: 'England', awayTeam: 'Ghana', venue: 'Gillette Stadium, Foxborough', kickoff: '6/24 04:00', localKickoff: '6/23 16:00', localTZ: 'ET', status: 'finished',
    homeScore: 0,
    awayScore: 0 },
  { id: 'pan-cro-2', date: '2026-06-23', tournament: '2026 FIFA World Cup', group: 'L组', round: '第二轮', matchday: 12, homeTeam: 'Panama', awayTeam: 'Croatia', venue: 'BMO Field, Toronto', kickoff: '6/24 07:00', localKickoff: '6/23 19:00', localTZ: 'ET', status: 'finished',
    homeScore: 0,
    awayScore: 1 },
  { id: 'por-uzb-2', date: '2026-06-23', tournament: '2026 FIFA World Cup', group: 'K组', round: '第二轮', matchday: 12, homeTeam: 'Portugal', awayTeam: 'Uzbekistan', venue: 'NRG Stadium, Houston', kickoff: '6/24 01:00', localKickoff: '6/23 13:00', localTZ: 'CT', status: 'finished',
    homeScore: 5,
    awayScore: 0 },
  { id: 'col-cod-2', date: '2026-06-23', tournament: '2026 FIFA World Cup', group: 'K组', round: '第二轮', matchday: 12, homeTeam: 'Colombia', awayTeam: 'DR Congo', venue: 'Estadio Akron, Guadalajara', kickoff: '6/24 09:00', localKickoff: '6/23 20:00', localTZ: 'CT', status: 'finished',
    homeScore: 1,
    awayScore: 0 },

  // ========== 第三轮小组赛 (6/24-6/27) ==========

  // ---- 6月24日 (周三) 第13比赛日 ----
  { id: 'can-sui-3', date: '2026-06-24', tournament: '2026 FIFA World Cup', group: 'B组', round: '第三轮', matchday: 13, homeTeam: 'Canada', awayTeam: 'Switzerland', venue: 'BC Place, Vancouver', kickoff: '6/25 03:00', localKickoff: '6/24 15:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 45, away: 55 },
    shots: { home: 13, away: 6 },
    shotsOnTarget: { home: 7, away: 4 },
    xg: { home: 1.56, away: 0.5 },
    corners: { home: 7, away: 2 },
    fouls: { home: 13, away: 19 },
    cards: { home: { yellow: 2, red: 0 }, away: { yellow: 1, red: 0 } },
    offsides: { home: 3, away: 1 },
    crosses: { home: 27, away: 9 },
    interceptions: { home: 11, away: 5 },
    saves: { home: 1, away: 6 }
  }, homeScore: 1, awayScore: 2 },
  { id: 'qat-bih-3', date: '2026-06-24', tournament: '2026 FIFA World Cup', group: 'B组', round: '第三轮', matchday: 13, homeTeam: 'Qatar', awayTeam: 'Bosnia', venue: 'MetLife Stadium, New Jersey', kickoff: '6/25 03:00', localKickoff: '6/24 15:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 45, away: 55 },
    shots: { home: 9, away: 15 },
    shotsOnTarget: { home: 3, away: 5 },
    xg: { home: 0.84, away: 0.84 },
    corners: { home: 5, away: 5 },
    fouls: { home: 14, away: 9 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 1, red: 0 } },
    offsides: { home: 3, away: 1 },
    crosses: { home: 17, away: 25 },
    interceptions: { home: 5, away: 5 },
    saves: { home: 3, away: 2 }
  }, homeScore: 1, awayScore: 3 },
  { id: 'sco-bra-3', date: '2026-06-24', tournament: '2026 FIFA World Cup', group: 'C组', round: '第三轮', matchday: 13, homeTeam: 'Scotland', awayTeam: 'Brazil', venue: 'AT&T Stadium, Dallas', kickoff: '6/25 06:00', localKickoff: '6/24 18:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 46, away: 54 },
    shots: { home: 11, away: 21 },
    shotsOnTarget: { home: 5, away: 8 },
    xg: { home: 0.89, away: 3.12 },
    corners: { home: 7, away: 6 },
    fouls: { home: 10, away: 11 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 2, red: 0 } },
    offsides: { home: 0, away: 1 },
    crosses: { home: 26, away: 15 },
    interceptions: { home: 3, away: 7 },
    saves: { home: 5, away: 4 }
  }, homeScore: 0, awayScore: 3 },
  { id: 'mar-hai-3', date: '2026-06-24', tournament: '2026 FIFA World Cup', group: 'C组', round: '第三轮', matchday: 13, homeTeam: 'Morocco', awayTeam: 'Haiti', venue: 'Mercedes-Benz Stadium, Atlanta', kickoff: '6/25 06:00', localKickoff: '6/24 18:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 69, away: 31 },
    shots: { home: 19, away: 7 },
    shotsOnTarget: { home: 12, away: 2 },
    xg: { home: 2.13, away: 0.33 },
    corners: { home: 9, away: 1 },
    fouls: { home: 10, away: 18 },
    cards: { home: { yellow: 0, red: 0 }, away: { yellow: 3, red: 0 } },
    offsides: { home: 5, away: 0 },
    crosses: { home: 34, away: 4 },
    interceptions: { home: 6, away: 8 },
    saves: { home: 1, away: 7 }
  }, homeScore: 4, awayScore: 2 },
  { id: 'mex-cze-3', date: '2026-06-24', tournament: '2026 FIFA World Cup', group: 'A组', round: '第三轮', matchday: 13, homeTeam: 'Mexico', awayTeam: 'Czechia', venue: 'Estadio Azteca, Mexico City', kickoff: '6/25 09:00', localKickoff: '6/24 21:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 49, away: 51 },
    shots: { home: 11, away: 12 },
    shotsOnTarget: { home: 5, away: 1 },
    xg: { home: 1.62, away: 0.74 },
    corners: { home: 1, away: 5 },
    fouls: { home: 13, away: 9 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 0, red: 0 } },
    offsides: { home: 0, away: 1 },
    crosses: { home: 14, away: 22 },
    interceptions: { home: 9, away: 7 },
    saves: { home: 1, away: 2 }
  }, homeScore: 3, awayScore: 0 },
  { id: 'kor-rsa-3', date: '2026-06-24', tournament: '2026 FIFA World Cup', group: 'A组', round: '第三轮', matchday: 13, homeTeam: 'South Korea', awayTeam: 'South Africa', venue: 'SoFi Stadium, Los Angeles', kickoff: '6/25 09:00', localKickoff: '6/24 21:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 69, away: 31 },
    shots: { home: 7, away: 14 },
    shotsOnTarget: { home: 2, away: 4 },
    xg: { home: 0.84, away: 0.92 },
    corners: { home: 6, away: 4 },
    fouls: { home: 9, away: 7 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 1, red: 0 } },
    offsides: { home: 0, away: 3 },
    crosses: { home: 45, away: 11 },
    interceptions: { home: 4, away: 9 },
    saves: { home: 3, away: 2 }
  }, homeScore: 0, awayScore: 1 },

  // ---- 6月25日 (周四) 第14比赛日 ----
  { id: 'ecu-ger-3', date: '2026-06-25', tournament: '2026 FIFA World Cup', group: 'E组', round: '第三轮', matchday: 14, homeTeam: 'Ecuador', awayTeam: 'Germany', venue: 'NRG Stadium, Houston', kickoff: '6/26 04:00', localKickoff: '6/25 16:00', localTZ: 'ET', status: 'finished' },
  { id: 'cuw-civ-3', date: '2026-06-25', tournament: '2026 FIFA World Cup', group: 'E组', round: '第三轮', matchday: 14, homeTeam: 'Curacao', awayTeam: 'Ivory Coast', venue: 'Hard Rock Stadium, Miami', kickoff: '6/26 04:00', localKickoff: '6/25 16:00', localTZ: 'ET', status: 'finished' },
  { id: 'tun-ned-3', date: '2026-06-25', tournament: '2026 FIFA World Cup', group: 'F组', round: '第三轮', matchday: 14, homeTeam: 'Tunisia', awayTeam: 'Netherlands', venue: 'Lincoln Financial Field, Philadelphia', kickoff: '6/26 07:00', localKickoff: '6/25 19:00', localTZ: 'ET', status: 'finished' },
  { id: 'jpn-swe-3', date: '2026-06-25', tournament: '2026 FIFA World Cup', group: 'F组', round: '第三轮', matchday: 14, homeTeam: 'Japan', awayTeam: 'Sweden', venue: 'Gillette Stadium, Foxborough', kickoff: '6/26 07:00', localKickoff: '6/25 19:00', localTZ: 'ET', status: 'finished' },
  { id: 'usa-tur-3', date: '2026-06-25', tournament: '2026 FIFA World Cup', group: 'D组', round: '第三轮', matchday: 14, homeTeam: 'USA', awayTeam: 'Turkiye', venue: 'Levi\'s Stadium, Santa Clara', kickoff: '6/26 10:00', localKickoff: '6/25 22:00', localTZ: 'ET', status: 'finished' },
  { id: 'par-aus-3', date: '2026-06-25', tournament: '2026 FIFA World Cup', group: 'D组', round: '第三轮', matchday: 14, homeTeam: 'Paraguay', awayTeam: 'Australia', venue: 'Lumen Field, Seattle', kickoff: '6/26 10:00', localKickoff: '6/25 22:00', localTZ: 'ET', status: 'finished' },

  // ---- 6月26日 (周五) 第15比赛日 ----
  { id: 'nor-fra-3', date: '2026-06-26', tournament: '2026 FIFA World Cup', group: 'I组', round: '第三轮', matchday: 15, homeTeam: 'Norway', awayTeam: 'France', venue: 'MetLife Stadium, New Jersey', kickoff: '6/27 03:00', localKickoff: '6/26 15:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 38, away: 62 },
    shots: { home: 8, away: 18 },
    shotsOnTarget: { home: 3, away: 8 },
    xg: { home: 0.62, away: 2.78 },
    corners: { home: 3, away: 6 },
    fouls: { home: 10, away: 12 },
    cards: { home: { yellow: 2, red: 0 }, away: { yellow: 1, red: 0 } },
    offsides: { home: 1, away: 2 },
    crosses: { home: 12, away: 22 },
    interceptions: { home: 8, away: 6 },
    saves: { home: 4, away: 2 }
  }, homeScore: 1, awayScore: 4 },
  { id: 'sen-irq-3', date: '2026-06-26', tournament: '2026 FIFA World Cup', group: 'I组', round: '第三轮', matchday: 15, homeTeam: 'Senegal', awayTeam: 'Iraq', venue: 'Mercedes-Benz Stadium, Atlanta', kickoff: '6/27 03:00', localKickoff: '6/26 15:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 65, away: 35 },
    shots: { home: 22, away: 4 },
    shotsOnTarget: { home: 10, away: 1 },
    xg: { home: 3.24, away: 0.18 },
    corners: { home: 8, away: 2 },
    fouls: { home: 14, away: 9 },
    cards: { home: { yellow: 0, red: 0 }, away: { yellow: 1, red: 1 } },
    offsides: { home: 3, away: 1 },
    crosses: { home: 18, away: 6 },
    interceptions: { home: 5, away: 12 },
    saves: { home: 1, away: 5 }
  }, homeScore: 5, awayScore: 0 },
  { id: 'uru-esp-3', date: '2026-06-26', tournament: '2026 FIFA World Cup', group: 'H组', round: '第三轮', matchday: 15, homeTeam: 'Uruguay', awayTeam: 'Spain', venue: 'AT&T Stadium, Dallas', kickoff: '6/27 08:00', localKickoff: '6/26 20:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 33, away: 67 },
    shots: { home: 5, away: 6 },
    shotsOnTarget: { home: 1, away: 1 },
    xg: { home: 0.2, away: 0.86 },
    corners: { home: 2, away: 5 },
    fouls: { home: 14, away: 14 },
    cards: { home: { yellow: 1, red: 1 }, away: { yellow: 0, red: 0 } },
    offsides: { home: 1, away: 2 },
    crosses: { home: 8, away: 16 },
    interceptions: { home: 12, away: 7 },
    saves: { home: 0, away: 2 }
  }, homeScore: 0, awayScore: 1 },
  { id: 'cpv-ksa-3', date: '2026-06-26', tournament: '2026 FIFA World Cup', group: 'H组', round: '第三轮', matchday: 15, homeTeam: 'Cape Verde', awayTeam: 'Saudi Arabia', venue: 'Hard Rock Stadium, Miami', kickoff: '6/27 08:00', localKickoff: '6/26 20:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 47, away: 53 },
    shots: { home: 9, away: 12 },
    shotsOnTarget: { home: 3, away: 4 },
    xg: { home: 0.72, away: 0.88 },
    corners: { home: 4, away: 5 },
    fouls: { home: 13, away: 11 },
    cards: { home: { yellow: 2, red: 0 }, away: { yellow: 2, red: 0 } },
    offsides: { home: 2, away: 3 },
    crosses: { home: 15, away: 18 },
    interceptions: { home: 10, away: 8 },
    saves: { home: 4, away: 3 }
  }, homeScore: 0, awayScore: 0 },
  { id: 'nzl-bel-3', date: '2026-06-26', tournament: '2026 FIFA World Cup', group: 'G组', round: '第三轮', matchday: 15, homeTeam: 'New Zealand', awayTeam: 'Belgium', venue: 'Levi\'s Stadium, Santa Clara', kickoff: '6/27 11:00', localKickoff: '6/26 23:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 28, away: 72 },
    shots: { home: 6, away: 35 },
    shotsOnTarget: { home: 2, away: 10 },
    xg: { home: 0.24, away: 3.65 },
    corners: { home: 1, away: 9 },
    fouls: { home: 8, away: 10 },
    cards: { home: { yellow: 1, red: 0 }, away: { yellow: 0, red: 0 } },
    offsides: { home: 2, away: 1 },
    crosses: { home: 8, away: 28 },
    interceptions: { home: 14, away: 4 },
    saves: { home: 5, away: 1 }
  }, homeScore: 1, awayScore: 5 },
  { id: 'egy-irn-3', date: '2026-06-26', tournament: '2026 FIFA World Cup', group: 'G组', round: '第三轮', matchday: 15, homeTeam: 'Egypt', awayTeam: 'Iran', venue: 'Lumen Field, Seattle', kickoff: '6/27 11:00', localKickoff: '6/26 23:00', localTZ: 'ET', status: 'finished',
    matchStats: {
    possession: { home: 45, away: 55 },
    shots: { home: 10, away: 13 },
    shotsOnTarget: { home: 4, away: 5 },
    xg: { home: 0.88, away: 1.12 },
    corners: { home: 4, away: 5 },
    fouls: { home: 15, away: 16 },
    cards: { home: { yellow: 3, red: 0 }, away: { yellow: 4, red: 0 } },
    offsides: { home: 2, away: 3 },
    crosses: { home: 14, away: 18 },
    interceptions: { home: 9, away: 8 },
    saves: { home: 4, away: 3 }
  }, homeScore: 1, awayScore: 1 },

  // ---- 6月27日 (周六) 第16比赛日 (已完赛) ----
  { id: 'pan-eng-3', date: '2026-06-27', tournament: '2026 FIFA World Cup', group: 'L组', round: '第三轮', matchday: 16, homeTeam: 'Panama', awayTeam: 'England', venue: 'NRG Stadium, Houston', kickoff: '6/28 05:00', localKickoff: '6/27 17:00', localTZ: 'ET', status: 'finished', homeScore: 0, awayScore: 2 },
  { id: 'cro-gha-3', date: '2026-06-27', tournament: '2026 FIFA World Cup', group: 'L组', round: '第三轮', matchday: 16, homeTeam: 'Croatia', awayTeam: 'Ghana', venue: 'Gillette Stadium, Foxborough', kickoff: '6/28 05:00', localKickoff: '6/27 17:00', localTZ: 'ET', status: 'finished', homeScore: 2, awayScore: 1 },
  { id: 'col-por-3', date: '2026-06-27', tournament: '2026 FIFA World Cup', group: 'K组', round: '第三轮', matchday: 16, homeTeam: 'Colombia', awayTeam: 'Portugal', venue: 'BC Place, Vancouver', kickoff: '6/28 07:30', localKickoff: '6/27 19:30', localTZ: 'ET', status: 'finished', homeScore: 0, awayScore: 0 },
  { id: 'uzb-cod-3', date: '2026-06-27', tournament: '2026 FIFA World Cup', group: 'K组', round: '第三轮', matchday: 16, homeTeam: 'Uzbekistan', awayTeam: 'DR Congo', venue: 'Estadio Akron, Guadalajara', kickoff: '6/28 07:30', localKickoff: '6/27 19:30', localTZ: 'ET', status: 'finished', homeScore: 1, awayScore: 3 },
  { id: 'jor-arg-3', date: '2026-06-27', tournament: '2026 FIFA World Cup', group: 'J组', round: '第三轮', matchday: 16, homeTeam: 'Jordan', awayTeam: 'Argentina', venue: 'MetLife Stadium, New Jersey', kickoff: '6/28 10:00', localKickoff: '6/27 22:00', localTZ: 'ET', status: 'finished', homeScore: 1, awayScore: 3 },
  { id: 'alg-aut-3', date: '2026-06-27', tournament: '2026 FIFA World Cup', group: 'J组', round: '第三轮', matchday: 16, homeTeam: 'Algeria', awayTeam: 'Austria', venue: 'Mercedes-Benz Stadium, Atlanta', kickoff: '6/28 10:00', localKickoff: '6/27 22:00', localTZ: 'ET', status: 'finished', homeScore: 3, awayScore: 3 },

  // ---- 6月28日 (周日) Round of 32 第18比赛日 ----
  { id: 'rsa-can-r32', date: '2026-06-28', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 18, homeTeam: 'South Africa', awayTeam: 'Canada', venue: 'SoFi Stadium, Los Angeles', kickoff: '6/29 03:00', localKickoff: '6/28 12:00', localTZ: 'PT', status: 'finished', homeScore: 0, awayScore: 1 },
  { id: 'ger-par-r32', date: '2026-06-29', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 19, homeTeam: 'Germany', awayTeam: 'Paraguay', venue: 'Gillette Stadium, Foxborough', kickoff: '6/30 04:30', localKickoff: '6/29 16:30', localTZ: 'ET', status: 'finished', homeScore: 1, awayScore: 1 },
  { id: 'ned-mar-r32', date: '2026-06-29', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 19, homeTeam: 'Netherlands', awayTeam: 'Morocco', venue: 'Estadio Monterrey, Monterrey', kickoff: '6/30 09:00', localKickoff: '6/29 19:00', localTZ: 'CT', status: 'finished', homeScore: 1, awayScore: 1 },
  { id: 'bra-jpn-r32', date: '2026-06-29', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 19, homeTeam: 'Brazil', awayTeam: 'Japan', venue: 'NRG Stadium, Houston', kickoff: '6/30 01:00', localKickoff: '6/29 12:00', localTZ: 'CT', status: 'finished', homeScore: 2, awayScore: 1 },

  // ---- 6月30日 (周二) Round of 32 第20比赛日 (北京时间7月1日) ----
  { id: 'civ-nor-r32', date: '2026-06-30', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 20, homeTeam: 'Ivory Coast', awayTeam: 'Norway', venue: 'AT&T Stadium, Dallas', kickoff: '7/1 01:00', localKickoff: '6/30 12:00', localTZ: 'CT', status: 'finished', homeScore: 1, awayScore: 2 },
  { id: 'fra-swe-r32', date: '2026-06-30', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 20, homeTeam: 'France', awayTeam: 'Sweden', venue: 'MetLife Stadium, East Rutherford', kickoff: '7/1 05:00', localKickoff: '6/30 17:00', localTZ: 'ET', status: 'finished', homeScore: 3, awayScore: 0 },
  { id: 'mex-ecu-r32', date: '2026-06-30', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 20, homeTeam: 'Mexico', awayTeam: 'Ecuador', venue: 'Estadio Azteca, Mexico City', kickoff: '7/1 09:00', localKickoff: '6/30 21:00', localTZ: 'CT', status: 'finished', homeScore: 2, awayScore: 0 },

  // ---- 7月1日 (周三) Round of 32 第21比赛日 (北京时间7月2日) ----
  { id: 'eng-cod-r32', date: '2026-07-01', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 21, homeTeam: 'England', awayTeam: 'DR Congo', venue: 'Mercedes-Benz Stadium, Atlanta', kickoff: '7/2 00:00', localKickoff: '7/1 12:00', localTZ: 'ET', status: 'finished', homeScore: 2, awayScore: 1 },
  { id: 'bel-sen-r32', date: '2026-07-01', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 21, homeTeam: 'Belgium', awayTeam: 'Senegal', venue: 'Lumen Field, Seattle', kickoff: '7/2 04:00', localKickoff: '7/1 13:00', localTZ: 'PT', status: 'finished', homeScore: 3, awayScore: 2 },
  { id: 'usa-bih-r32', date: '2026-07-01', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 21, homeTeam: 'USA', awayTeam: 'Bosnia', venue: "Levi's Stadium, Santa Clara", kickoff: '7/2 08:00', localKickoff: '7/1 17:00', localTZ: 'PT', status: 'finished', homeScore: 2, awayScore: 0 },

  // ---- 7月2日 (周四) Round of 32 第22比赛日 (北京时间7月3日) ----
  { id: 'esp-aut-r32', date: '2026-07-02', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 22, homeTeam: 'Spain', awayTeam: 'Austria', venue: 'SoFi Stadium, Los Angeles', kickoff: '7/3 03:00', localKickoff: '7/2 12:00', localTZ: 'PT', status: 'finished', homeScore: 3, awayScore: 0 },
  { id: 'por-cro-r32', date: '2026-07-02', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 22, homeTeam: 'Portugal', awayTeam: 'Croatia', venue: 'BMO Field, Toronto', kickoff: '7/3 06:00', localKickoff: '7/2 19:00', localTZ: 'ET', status: 'finished', homeScore: 2, awayScore: 1 },
  { id: 'sui-alg-r32', date: '2026-07-02', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 22, homeTeam: 'Switzerland', awayTeam: 'Algeria', venue: 'BC Place, Vancouver', kickoff: '7/3 11:00', localKickoff: '7/2 20:00', localTZ: 'PT', status: 'finished', homeScore: 2, awayScore: 0 },

  // ---- 7月3日 (周五) Round of 32 第23比赛日 (北京时间7月4日) ----
  { id: 'aus-egy-r32', date: '2026-07-03', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 23, homeTeam: 'Australia', awayTeam: 'Egypt', venue: 'AT&T Stadium, Dallas', kickoff: '7/4 02:00', localKickoff: '7/3 13:00', localTZ: 'CT', status: 'finished', homeScore: 1, awayScore: 1 },
  { id: 'arg-cpv-r32', date: '2026-07-03', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 23, homeTeam: 'Argentina', awayTeam: 'Cape Verde', venue: 'Hard Rock Stadium, Miami', kickoff: '7/4 06:00', localKickoff: '7/3 18:00', localTZ: 'ET', status: 'finished', homeScore: 3, awayScore: 2 },
  { id: 'col-gha-r32', date: '2026-07-03', tournament: '2026 FIFA World Cup', group: 'Round of 32', round: 'Round of 32', matchday: 23, homeTeam: 'Colombia', awayTeam: 'Ghana', venue: 'Arrowhead Stadium, Kansas City', kickoff: '7/4 09:30', localKickoff: '7/3 20:30', localTZ: 'CT', status: 'finished', homeScore: 1, awayScore: 0 },

  // ---- 7月4-5日 Round of 16 第24/25比赛日 ----
  { id: 'can-mar-r16', date: '2026-07-04', tournament: '2026 FIFA World Cup', group: 'Round of 16', round: 'Round of 16', matchday: 24, homeTeam: 'Canada', awayTeam: 'Morocco', venue: 'NRG Stadium, Houston', kickoff: '7/5 01:00', localKickoff: '7/4 13:00', localTZ: 'CT', status: 'upcoming' },
  { id: 'par-fra-r16', date: '2026-07-04', tournament: '2026 FIFA World Cup', group: 'Round of 16', round: 'Round of 16', matchday: 24, homeTeam: 'Paraguay', awayTeam: 'France', venue: 'Lincoln Financial Field, Philadelphia', kickoff: '7/5 05:00', localKickoff: '7/4 17:00', localTZ: 'ET', status: 'upcoming' },
  // ---- 7月5-6日 Round of 16 第25/26比赛日 ----
  { id: 'bra-nor-r16', date: '2026-07-05', tournament: '2026 FIFA World Cup', group: 'Round of 16', round: 'Round of 16', matchday: 25, homeTeam: 'Brazil', awayTeam: 'Norway', venue: 'MetLife Stadium, East Rutherford', kickoff: '7/6 04:00', localKickoff: '7/5 16:00', localTZ: 'ET', status: 'upcoming' },
  { id: 'mex-eng-r16', date: '2026-07-05', tournament: '2026 FIFA World Cup', group: 'Round of 16', round: 'Round of 16', matchday: 25, homeTeam: 'Mexico', awayTeam: 'England', venue: 'Estadio Azteca, Mexico City', kickoff: '7/6 08:00', localKickoff: '7/5 18:00', localTZ: 'CT', status: 'upcoming' },
  // ---- 7月6-7日 Round of 16 第26/27比赛日 ----
  { id: 'por-esp-r16', date: '2026-07-06', tournament: '2026 FIFA World Cup', group: 'Round of 16', round: 'Round of 16', matchday: 26, homeTeam: 'Portugal', awayTeam: 'Spain', venue: 'AT&T Stadium, Arlington', kickoff: '7/7 03:00', localKickoff: '7/6 15:00', localTZ: 'CT', status: 'upcoming' },
  { id: 'usa-bel-r16', date: '2026-07-06', tournament: '2026 FIFA World Cup', group: 'Round of 16', round: 'Round of 16', matchday: 26, homeTeam: 'USA', awayTeam: 'Belgium', venue: 'Lumen Field, Seattle', kickoff: '7/7 08:00', localKickoff: '7/6 20:00', localTZ: 'PT', status: 'upcoming' },
  // ---- 7月7-8日 Round of 16 第27/28比赛日 ----
  { id: 'arg-egy-r16', date: '2026-07-07', tournament: '2026 FIFA World Cup', group: 'Round of 16', round: 'Round of 16', matchday: 27, homeTeam: 'Argentina', awayTeam: 'Egypt', venue: 'Mercedes-Benz Stadium, Atlanta', kickoff: '7/8 00:00', localKickoff: '7/7 12:00', localTZ: 'ET', status: 'upcoming' },
  { id: 'sui-col-r16', date: '2026-07-07', tournament: '2026 FIFA World Cup', group: 'Round of 16', round: 'Round of 16', matchday: 27, homeTeam: 'Switzerland', awayTeam: 'Colombia', venue: 'BC Place, Vancouver', kickoff: '7/8 04:00', localKickoff: '7/7 16:00', localTZ: 'PT', status: 'upcoming' },
];

// ========== 预测数据 ==========
export const predictions: Record<string, Prediction> = {
  // ---- 历史预测 (6/15-16) ----
  'esp-cpv': {
    matchId: 'esp-cpv', homeWinProb: 0.89, drawProb: 0.08, awayWinProb: 0.03, over25Prob: 0.62, under25Prob: 0.38,
    top5Scores: [
      { score: '3:0', probability: 0.22, quadrant: 'Q1', reason: '西班牙进攻碾压，佛得角首次世界杯' },
      { score: '2:0', probability: 0.18, quadrant: 'Q1', reason: '西班牙控制型胜利' },
      { score: '4:0', probability: 0.12, quadrant: 'Q1', reason: '完全碾压' },
      { score: '2:1', probability: 0.08, quadrant: 'Q1', reason: '佛得角定位球偷1球' },
      { score: '1:1', probability: 0.05, quadrant: 'Q2', reason: '奇迹平局' },
    ],
    mviAnalysis: [], parlayRecommendations: [], bankroll: { conservative: { allocations: {}, expectedReturn: 0 }, balanced: { allocations: {}, expectedReturn: 0 }, aggressive: { allocations: {}, expectedReturn: 0 } },
    confidence: 0.90, riskLevel: 'Low', riskWarnings: ['未知对手的信息盲区', '世界杯首战紧张'], predictedScore: '3:0', predictedDirection: 'home_win', analysisText: '',
  },
  'bel-egy': {
    matchId: 'bel-egy', homeWinProb: 0.60, drawProb: 0.25, awayWinProb: 0.15, over25Prob: 0.52, under25Prob: 0.48,
    top5Scores: [
      { score: '2:1', probability: 0.15, quadrant: 'Q1', reason: '比利时攻击力+埃及能进球' },
      { score: '1:0', probability: 0.12, quadrant: 'Q1', reason: '比利时险胜' },
      { score: '1:1', probability: 0.12, quadrant: 'Q2', reason: '历史交锋埃及占优' },
      { score: '2:0', probability: 0.10, quadrant: 'Q1', reason: '比利时控制比赛' },
      { score: '0:0', probability: 0.08, quadrant: 'Q2', reason: '双方谨慎' },
    ],
    mviAnalysis: [], parlayRecommendations: [], bankroll: { conservative: { allocations: {}, expectedReturn: 0 }, balanced: { allocations: {}, expectedReturn: 0 }, aggressive: { allocations: {}, expectedReturn: 0 } },
    confidence: 0.55, riskLevel: 'High', riskWarnings: ['埃及历史克制比利时', '埃及0-0逼平西班牙证明防守'], predictedScore: '2:1', predictedDirection: 'home_win', analysisText: '',
  },
  'ksa-uru': {
    matchId: 'ksa-uru', homeWinProb: 0.12, drawProb: 0.22, awayWinProb: 0.69, over25Prob: 0.45, under25Prob: 0.55,
    top5Scores: [
      { score: '0:2', probability: 0.20, quadrant: 'Q1', reason: '乌拉圭碾压' },
      { score: '0:1', probability: 0.15, quadrant: 'Q1', reason: '乌拉圭控场求稳' },
      { score: '1:2', probability: 0.12, quadrant: 'Q1', reason: '沙特反击偷1球' },
      { score: '0:3', probability: 0.10, quadrant: 'Q1', reason: '完全碾压' },
      { score: '1:1', probability: 0.08, quadrant: 'Q2', reason: '首轮平局' },
    ],
    mviAnalysis: [], parlayRecommendations: [], bankroll: { conservative: { allocations: {}, expectedReturn: 0 }, balanced: { allocations: {}, expectedReturn: 0 }, aggressive: { allocations: {}, expectedReturn: 0 } },
    confidence: 0.70, riskLevel: 'Medium', riskWarnings: ['沙特热身赛0-4惨败', '换帅仅4月'], predictedScore: '0:2', predictedDirection: 'away_win', analysisText: '',
  },
  'irn-nzl': {
    matchId: 'irn-nzl', homeWinProb: 0.51, drawProb: 0.28, awayWinProb: 0.21, over25Prob: 0.42, under25Prob: 0.58,
    top5Scores: [
      { score: '1:0', probability: 0.16, quadrant: 'Q1', reason: '伊朗防守纪律' },
      { score: '0:0', probability: 0.14, quadrant: 'Q2', reason: '沉闷的比赛' },
      { score: '2:0', probability: 0.10, quadrant: 'Q1', reason: '伊朗技术优势' },
      { score: '1:1', probability: 0.12, quadrant: 'Q2', reason: '新西兰高空轰炸扳平' },
      { score: '2:1', probability: 0.08, quadrant: 'Q1', reason: '伊朗险胜' },
    ],
    mviAnalysis: [], parlayRecommendations: [], bankroll: { conservative: { allocations: {}, expectedReturn: 0 }, balanced: { allocations: {}, expectedReturn: 0 }, aggressive: { allocations: {}, expectedReturn: 0 } },
    confidence: 0.40, riskLevel: 'High', riskWarnings: ['最接近五五开的比赛', '新西兰世界杯零胜陷阱'], predictedScore: '1:0', predictedDirection: 'home_win', analysisText: '',
  },
  'fra-sen': {
    matchId: 'fra-sen', homeWinProb: 0.62, drawProb: 0.23, awayWinProb: 0.15, over25Prob: 0.58, under25Prob: 0.42,
    top5Scores: [
      { score: '2:1', probability: 0.16, quadrant: 'Q1', reason: '法国攻击群+塞内加尔反击' },
      { score: '3:1', probability: 0.14, quadrant: 'Q1', reason: '法国全面碾压' },
      { score: '2:0', probability: 0.12, quadrant: 'Q1', reason: '法国控制型胜利' },
      { score: '1:0', probability: 0.10, quadrant: 'Q1', reason: '法国艰难取胜' },
      { score: '1:1', probability: 0.08, quadrant: 'Q2', reason: '2002年揭幕战重演' },
    ],
    mviAnalysis: [], parlayRecommendations: [], bankroll: { conservative: { allocations: {}, expectedReturn: 0 }, balanced: { allocations: {}, expectedReturn: 0 }, aggressive: { allocations: {}, expectedReturn: 0 } },
    confidence: 0.65, riskLevel: 'Medium', riskWarnings: ['法国对非洲队魔咒', '马内回归塞内加尔'], predictedScore: '2:1', predictedDirection: 'home_win', analysisText: '',
  },
  'irq-nor': {
    matchId: 'irq-nor', homeWinProb: 0.07, drawProb: 0.13, awayWinProb: 0.80, over25Prob: 0.55, under25Prob: 0.45,
    top5Scores: [
      { score: '0:3', probability: 0.20, quadrant: 'Q1', reason: '哈兰德+厄德高碾压' },
      { score: '1:3', probability: 0.14, quadrant: 'Q1', reason: '伊拉克偷1球' },
      { score: '0:2', probability: 0.14, quadrant: 'Q1', reason: '挪威控制求稳' },
      { score: '0:4', probability: 0.10, quadrant: 'Q1', reason: '完全碾压' },
      { score: '1:4', probability: 0.08, quadrant: 'Q1', reason: '挪威火力全开' },
    ],
    mviAnalysis: [], parlayRecommendations: [], bankroll: { conservative: { allocations: {}, expectedReturn: 0 }, balanced: { allocations: {}, expectedReturn: 0 }, aggressive: { allocations: {}, expectedReturn: 0 } },
    confidence: 0.88, riskLevel: 'Low', riskWarnings: ['实力差最大的比赛', '哈兰德状态'], predictedScore: '0:3', predictedDirection: 'away_win', analysisText: '',
  },
  'arg-alg': {
    matchId: 'arg-alg', homeWinProb: 0.71, drawProb: 0.20, awayWinProb: 0.09, over25Prob: 0.55, under25Prob: 0.45,
    top5Scores: [
      { score: '3:0', probability: 0.20, quadrant: 'Q1', reason: '阿根廷5战全胜进14球仅失1球' },
      { score: '2:0', probability: 0.16, quadrant: 'Q1', reason: '梅西+劳塔罗双核' },
      { score: '2:1', probability: 0.12, quadrant: 'Q1', reason: '阿尔及利亚反击1球' },
      { score: '4:0', probability: 0.10, quadrant: 'Q1', reason: '完全碾压' },
      { score: '1:1', probability: 0.06, quadrant: 'Q2', reason: '奇迹平局' },
    ],
    mviAnalysis: [], parlayRecommendations: [], bankroll: { conservative: { allocations: {}, expectedReturn: 0 }, balanced: { allocations: {}, expectedReturn: 0 }, aggressive: { allocations: {}, expectedReturn: 0 } },
    confidence: 0.85, riskLevel: 'Low', riskWarnings: ['阿尔及利亚1-0荷兰的底气', '卫冕冠军首场压力'], predictedScore: '3:0', predictedDirection: 'home_win', analysisText: '',
  },
  'aut-jor': {
    matchId: 'aut-jor', homeWinProb: 0.73, drawProb: 0.17, awayWinProb: 0.10, over25Prob: 0.50, under25Prob: 0.50,
    top5Scores: [
      { score: '2:0', probability: 0.18, quadrant: 'Q1', reason: '奥地利8场预选赛22进球' },
      { score: '1:0', probability: 0.12, quadrant: 'Q1', reason: '奥地利控制求稳' },
      { score: '3:0', probability: 0.12, quadrant: 'Q1', reason: '约旦头号射手重伤' },
      { score: '2:1', probability: 0.10, quadrant: 'Q1', reason: '约旦偷1球' },
      { score: '1:1', probability: 0.06, quadrant: 'Q2', reason: '约旦奇迹' },
    ],
    mviAnalysis: [], parlayRecommendations: [], bankroll: { conservative: { allocations: {}, expectedReturn: 0 }, balanced: { allocations: {}, expectedReturn: 0 }, aggressive: { allocations: {}, expectedReturn: 0 } },
    confidence: 0.78, riskLevel: 'Medium', riskWarnings: ['28年首次重返世界杯心理压力', '约旦头号射手阿尔-纳伊马特膝盖重伤'], predictedScore: '2:0', predictedDirection: 'home_win', analysisText: '',
  },

  // ---- 最新预测 (6/17-18) ----
  'por-cod': {
    matchId: 'por-cod', homeWinProb: 0.72, drawProb: 0.22, awayWinProb: 0.06, over25Prob: 0.57, under25Prob: 0.43,
    top5Scores: [
      { score: '2:0', probability: 0.18, quadrant: 'Q1', reason: '葡萄牙进攻碾压+刚果防守纪律限制进球数' },
      { score: '1:0', probability: 0.15, quadrant: 'Q1', reason: '刚果密集防守+48队赛制首轮求稳' },
      { score: '3:0', probability: 0.12, quadrant: 'Q1', reason: '葡萄牙进攻火力全开' },
      { score: '2:1', probability: 0.10, quadrant: 'Q1', reason: '刚果Wissa反击偷1球' },
      { score: '1:1', probability: 0.08, quadrant: 'Q2', reason: '首轮平局溢价+刚果9场仅失5球的防守' },
    ],
    mviAnalysis: [
      { bet: '葡萄牙 -1.5', modelProb: 0.65, marketProb: 0.55, mvi: 1.18, rating: '高价值' },
      { bet: 'BTTS No', modelProb: 0.62, marketProb: 0.58, mvi: 1.07, rating: '一般价值' },
      { bet: '刚果 +2', modelProb: 0.58, marketProb: 0.55, mvi: 1.05, rating: '一般价值' },
      { bet: '葡萄牙 -2', modelProb: 0.42, marketProb: 0.45, mvi: 0.93, rating: '无价值' },
      { bet: 'Under 2.5', modelProb: 0.43, marketProb: 0.48, mvi: 0.90, rating: '无价值' },
    ],
    parlayRecommendations: [
      { type: '稳健', selections: ['葡萄牙胜', 'Under 3.5'], odds: 1.45, probability: 0.65, risk: 'Low' },
      { type: '平衡', selections: ['葡萄牙胜', 'Colombia胜'], odds: 1.85, probability: 0.45, risk: 'Medium' },
      { type: '高赔', selections: ['葡萄牙 2:0', 'Ghana平'], odds: 35.0, probability: 0.03, risk: 'High' },
    ],
    bankroll: {
      conservative: { allocations: { '胜平负': 50, '大小球': 30, '比分': 15, '串关': 5 }, expectedReturn: 8 },
      balanced: { allocations: { '胜平负': 40, '比分': 25, '串关': 20, '大小球': 15 }, expectedReturn: 15 },
      aggressive: { allocations: { '比分': 40, '串关': 30, '胜平负': 20, '大小球': 10 }, expectedReturn: 35 },
    },
    confidence: 0.75, riskLevel: 'Medium',
    riskWarnings: [
      '刚果(金)非洲预选9场仅失5球，防守纪律远高于FIFA#58排名所暗示，且世界杯首秀精神加成不可忽视 → 结论：葡萄牙赢但可能无法净胜2球以上，让球盘风险偏高',
      '葡萄牙3月曾0-0闷平墨西哥——面对密集防守时缺乏破局能力并非首次。本场刚果(金)预计摆大巴，若上半场无法破门可能陷入焦灼 → 结论：半全场"平/葡萄牙"比"葡萄牙/葡萄牙"更有价值',
      '48队赛制首轮强队求稳已是本届规律（西班牙0-0、巴西1-1、比利时1-1），葡萄牙无需抢净胜球 → 结论：2-0比3-0更可靠，请参考TOP5比分第1第2选项',
    ],
    predictedScore: '2:0', predictedDirection: 'home_win', analysisText: '',
  },
  'eng-cro': {
    matchId: 'eng-cro', homeWinProb: 0.53, drawProb: 0.28, awayWinProb: 0.19, over25Prob: 0.48, under25Prob: 0.52,
    top5Scores: [
      { score: '1:1', probability: 0.15, quadrant: 'Q2', reason: 'Tuchel务实+克罗地亚中场硬度+首轮平局溢价' },
      { score: '2:1', probability: 0.13, quadrant: 'Q1', reason: '英格兰攻击深度撕开老化防线' },
      { score: '1:0', probability: 0.12, quadrant: 'Q1', reason: 'Kane关键时刻定胜负' },
      { score: '0:0', probability: 0.10, quadrant: 'Q2', reason: '双方首战求稳+Modric控节奏' },
      { score: '2:0', probability: 0.09, quadrant: 'Q1', reason: '英格兰全面压制+克罗地亚锋线无力' },
    ],
    mviAnalysis: [
      { bet: '平局', modelProb: 0.28, marketProb: 0.25, mvi: 1.12, rating: '一般价值' },
      { bet: 'Under 2.5', modelProb: 0.52, marketProb: 0.48, mvi: 1.08, rating: '一般价值' },
      { bet: '克罗地亚 +1', modelProb: 0.47, marketProb: 0.45, mvi: 1.04, rating: '一般价值' },
      { bet: 'BTTS No', modelProb: 0.55, marketProb: 0.53, mvi: 1.04, rating: '一般价值' },
      { bet: '英格兰胜', modelProb: 0.53, marketProb: 0.56, mvi: 0.95, rating: '无价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 45, '大小球': 35, '比分': 15, '串关': 5 }, expectedReturn: 6 },
      balanced: { allocations: { '胜平负': 35, '比分': 25, '串关': 25, '大小球': 15 }, expectedReturn: 12 },
      aggressive: { allocations: { '比分': 35, '串关': 30, '胜平负': 20, '大小球': 15 }, expectedReturn: 30 },
    },
    confidence: 0.55, riskLevel: 'High',
    riskWarnings: [
      'Saka轻微肌肉不适，若缺阵右路攻击力预计下降20%——Gordon可能左移、Foden右移，整体攻击流畅度受影响 → 结论：若赛前首发Saka缺阵，英格兰胜率从53%下调至48%，建议等首发公布后再决策',
      '克罗地亚核心Modric(40岁)、Perisic(37岁)虽仍为战术支点，但德州午后高温(预计32°C)对高龄球员消耗极大——下半场60分钟后可能出现体能断崖 → 结论：关注"下半场进球更多"和"75分钟后进球"市场',
      '2018世界杯半决赛克罗地亚2-1逆转英格兰，Tuchel赛前多次强调"不要低估克罗地亚的大赛韧性"——即便英格兰领先也不等于稳赢 → 结论：不建议重仓英格兰独赢，平局保护是必要的',
    ],
    predictedScore: '1:1', predictedDirection: 'draw',
    richAnalysis: {
      overview: 'L组首轮焦点战，2018世界杯半决赛重演（克罗地亚2-1淘汰英格兰）。Tuchel治下的英格兰极度务实——对阵强队优先不失位。双方近11次交锋，英格兰6胜3负2平占优，但大赛对决克罗地亚2胜1负略占心理优势。',
      formData: '英格兰预选赛8战全胜，22进球0失球，攻防皆为欧洲顶级。近5场4胜1平。克罗地亚近5场2胜1平2负，欧预赛小组第二出线。Modric（40岁）仍为进攻节拍器，但锋线依赖FC达拉斯的Musa（非五大联赛主力），整体攻击力相较2018年明显下滑。',
      h2h: '近4次交锋：英格兰2胜2平保持不败（含2020欧洲杯1-0、2022欧国联1-0）。但世界杯唯一一次交手即2018年半决赛克罗地亚加时2-1逆转英格兰，心理阴影存在。',
      lineup: '英格兰预计4-2-3-1：Pickford；James, Stones, Konsa, Trippier；Rice, Bellingham；Saka(伤疑), Foden, Gordon；Kane。克罗地亚预计3-4-3：Livakovic；Stanisic, Sutalo, Gvardiol；Perisic, Modric, Kovacic, Baturina；Kramaric, Musa, Budimir。Saka轻微肌肉不适可能替补，若缺阵右路攻击力下降20%。',
      tactics: '英格兰偏好控球压迫（场均控球62%），Bellingham回撤组织+前插双威胁。克罗地亚3-4-3低位防守反击，Gvardiol左路出球是反击发动机。风格克制：英格兰高位防线 vs Perisic+Musa反击速度——Tuchel对阵强队时防线不冒进，预计不会给太多身后空间。48队赛制效应：首轮拿1分=80%锁定出线，双方没有必须互爆的动力。',
      market: 'Bet365欧赔：1.74/3.90/4.90（隐含概率56%/25%/20%）。O/U 2.5：Over 1.91/Under 1.98。赔率变化：英格兰初盘1.80→1.74（资金流入英格兰），平局3.50→3.90（市场低看平局）。模型应用首轮平局溢价1.4x后，平局概率从市场25%升至28%。',
    },
  },
  'gha-pan': {
    matchId: 'gha-pan', homeWinProb: 0.44, drawProb: 0.31, awayWinProb: 0.25, over25Prob: 0.48, under25Prob: 0.52,
    top5Scores: [
      { score: '1:1', probability: 0.18, quadrant: 'Q2', reason: '概率最接近五五开+xG 1.2vs1.1+首轮平局溢价' },
      { score: '1:0', probability: 0.12, quadrant: 'Q1', reason: '加纳大赛基因+非洲杯经验' },
      { score: '0:0', probability: 0.11, quadrant: 'Q2', reason: '双方首战求稳+进攻效率均不高' },
      { score: '2:1', probability: 0.10, quadrant: 'Q1', reason: '加纳个人能力闪光+巴拿马防守失误' },
      { score: '1:2', probability: 0.08, quadrant: 'Q3', reason: '加纳近6场不胜+巴拿马反击效率' },
    ],
    mviAnalysis: [
      { bet: '平局', modelProb: 0.31, marketProb: 0.27, mvi: 1.15, rating: '高价值' },
      { bet: 'Under 2.5', modelProb: 0.52, marketProb: 0.48, mvi: 1.08, rating: '一般价值' },
      { bet: '巴拿马 +0.5', modelProb: 0.56, marketProb: 0.52, mvi: 1.08, rating: '一般价值' },
      { bet: 'BTTS No', modelProb: 0.50, marketProb: 0.48, mvi: 1.04, rating: '一般价值' },
      { bet: '加纳胜', modelProb: 0.44, marketProb: 0.47, mvi: 0.94, rating: '无价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 40, '大小球': 35, '比分': 20, '串关': 5 }, expectedReturn: 5 },
      balanced: { allocations: { '胜平负': 30, '比分': 30, '串关': 25, '大小球': 15 }, expectedReturn: 10 },
      aggressive: { allocations: { '比分': 35, '串关': 35, '胜平负': 15, '大小球': 15 }, expectedReturn: 25 },
    },
    confidence: 0.42, riskLevel: 'High',
    riskWarnings: [
      '加纳近6场0胜1平4负（进2球失7球），攻击端效率极低，团队配合严重缺乏默契——仅靠个人能力难以突破组织严密的防线 → 结论：加纳独赢风险极高，即便FIFA排名#74也需谨慎对待',
      '巴拿马FIFA排名#33实际高于加纳#74，CONCACAF预选赛对抗墨西哥、美国等强队积累了大量防守经验。赔率给出加纳让平半并不意味着真实实力差距 → 结论：巴拿马+0.5是不错的对冲选择',
      '巴拿马主帅Thomas Christiansen曾在非洲执教，对非洲球队的比赛节奏和心态了解深入——这是数据无法量化的情报优势 → 结论：本场是四场中最不可预测的，仓位控制在15%以内',
    ],
    predictedScore: '1:1', predictedDirection: 'draw',
    richAnalysis: {
      overview: 'L组首轮另一场对决，也是整个比赛日最接近五五开的比赛。加纳FIFA排名#74甚至低于巴拿马#33（非洲杯积分权重低所致）。双方首次在国际大赛交锋，信息盲区较大。',
      formData: '加纳近6场0胜1平4负，状态极差——包括1-2负佛得角、0-1负阿尔及利亚。但非洲杯经验+世界杯大赛基因是隐形资产。巴拿马近5场2胜1平2负，CONCACAF磨练出的防守纪律是核心武器。xG模型预测：加纳1.2 vs 巴拿马1.1，体现极度接近。',
      h2h: '双方历史上未曾交锋，无可参考数据。非洲vs中美洲球队在世界杯交手记录有限，样本不足。',
      lineup: '加纳预计4-3-3：Kudus, Partey领衔中场，锋线依赖个人能力突破。巴拿马预计5-4-1低位防守阵型，主帅Thomas Christiansen曾在非洲执教，对非洲足球风格有深入了解。',
      tactics: '加纳偏好个人能力驱动型进攻，但团队配合效率低（近6场只进2球）。巴拿马偏好5-4-1低位防守→长传反击，中北美预选赛多次以此战术逼平强敌。风格克制：巴拿马的防守纪律恰好克制加纳散乱的进攻组织。48队赛制下双方都可能满足于1分，进一步压低进球预期。',
      market: 'Bet365欧赔：2.07/3.59/3.66（隐含概率47%/27%/26%）。O/U 2.5：Over 2.02/Under 1.87，市场倾向小球。加纳让平半盘口。模型应用首轮平局溢价1.4x后，平局概率从市场27%升至31%，成为本场MVI最高选项（1.15，高价值）。',
    },
  },
  'uzb-col': {
    matchId: 'uzb-col', homeWinProb: 0.11, drawProb: 0.27, awayWinProb: 0.62, over25Prob: 0.48, under25Prob: 0.52,
    top5Scores: [
      { score: '0:2', probability: 0.16, quadrant: 'Q1', reason: '哥伦比亚Luis Diaz+James进攻碾压' },
      { score: '0:1', probability: 0.13, quadrant: 'Q1', reason: '阿兹特克高原消耗+哥伦比亚控场求稳' },
      { score: '1:2', probability: 0.12, quadrant: 'Q1', reason: '乌兹别克Shomurodov偷1球' },
      { score: '0:3', probability: 0.10, quadrant: 'Q1', reason: '哥伦比亚全力进攻' },
      { score: '1:1', probability: 0.08, quadrant: 'Q2', reason: '首轮平局溢价+乌兹别克4场仅失2球' },
    ],
    mviAnalysis: [
      { bet: '平局', modelProb: 0.27, marketProb: 0.21, mvi: 1.29, rating: '高价值' },
      { bet: '哥伦比亚 -1', modelProb: 0.58, marketProb: 0.52, mvi: 1.12, rating: '一般价值' },
      { bet: 'Under 2.5', modelProb: 0.52, marketProb: 0.50, mvi: 1.04, rating: '一般价值' },
      { bet: 'BTTS No', modelProb: 0.60, marketProb: 0.59, mvi: 1.02, rating: '一般价值' },
      { bet: '哥伦比亚胜', modelProb: 0.62, marketProb: 0.67, mvi: 0.93, rating: '无价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 50, '大小球': 30, '比分': 15, '串关': 5 }, expectedReturn: 7 },
      balanced: { allocations: { '胜平负': 40, '比分': 25, '串关': 20, '大小球': 15 }, expectedReturn: 14 },
      aggressive: { allocations: { '比分': 35, '串关': 30, '胜平负': 20, '大小球': 15 }, expectedReturn: 32 },
    },
    confidence: 0.70, riskLevel: 'Medium',
    riskWarnings: [
      '阿兹特克球场海拔2240米，空气密度比平原低约22%——球速更快、球员体能消耗更大。乌兹别克中亚高原出身可能适应更好，而哥伦比亚球员南美高原经验也不算劣势 → 结论：海拔因素对双方影响接近对称，不值得因此大幅调低哥伦比亚胜率',
      '乌兹别克亚洲预选赛4场仅失2球，Cannavaro(06年金球奖后卫)调教的防线纪律性极强——哥伦比亚难以在开场阶段就取得进球 → 结论：上半场平局概率偏高，半全场"平/哥伦比亚"值得关注',
      'Khusanov(曼城21岁中卫) vs Luis Diaz(拜仁边锋)的欧冠级别对位是本场胜负手——Khusanov速度够用但经验远逊Diaz，若Diaz开场即进入状态可能打破僵局 → 结论：Diaz进球、哥伦比亚零封都不是必然，谨慎选择相关盘口',
    ],
    predictedScore: '0:2', predictedDirection: 'away_win',
    richAnalysis: {
      overview: 'K组第一轮最后一场，在海拔2240米的阿兹特克球场进行。哥伦比亚FIFA#15远高于乌兹别克#60，南美区预选赛强度远超亚洲区。乌兹别克由卡纳瓦罗执教，防线纪律性极强——亚洲区预选赛4场仅失2球。',
      formData: '哥伦比亚近5场3胜2负，含2-0智利、1-0秘鲁，南美区预选赛攻防均衡。乌兹别克近5场1胜2平2负，亚洲区预选赛小组第一出线。核心对位：Khusanov（曼城，21岁）vs Luis Diaz（拜仁），欧冠经验差距显著。',
      h2h: '双方首次交锋，无历史参考数据。亚洲vs南美球队在世界杯实力差通常为一到两球。',
      lineup: '哥伦比亚预计4-3-3：Ospina；Munoz, Sanchez, Lucumi, Mojica；Lerma, James(C), Rios；Arias, Cordoba, Diaz。洛塞尔索未入选本届阵容，James重获组织核心地位。乌兹别克预计4-2-3-1：Yusupov；Khusanov, Ashurmatov, Nasrullaev, Alijonov；Hamrobekov, Masharipov；Fayzullaev；Urunov, Shomurodov(C), Sergeev。',
      tactics: '哥伦比亚偏好4-3-3控球渗透，James中路调度+Luis Diaz左路爆点是双重武器。乌兹别克偏好4-2-3-1防守反击，Cannavaro的意大利式防守体系（防线紧凑、高位逼抢少、中场拦截多）。风格克制：哥伦比亚的边路速度恰好克制乌兹别克宽防线；但高原消耗和乌兹别克钢铁防线可能限制比分。',
      market: 'Bet365欧赔：8.50/4.56/1.43（隐含概率11%/21%/67%）。O/U 2.5：Over 1.99/Under 1.90。哥伦比亚让一球。赔率变化：哥伦比亚初盘1.45→1.43（稳定）。模型应用首轮平局溢价1.4x后平局概率从21%→27%，MVI达1.29（高价值）。',
    },
  },
  // ---- 6/19 第二轮 ----
  'usa-aus-2': {
    matchId: 'usa-aus-2', homeWinProb: 0.55, drawProb: 0.24, awayWinProb: 0.21, over25Prob: 0.55, under25Prob: 0.45,
    top5Scores: [
      { score: '2:0', probability: 0.18, quadrant: 'Q1', reason: '美国主场Lumen Field 69k观众+首轮4:1大胜' },
      { score: '1:0', probability: 0.16, quadrant: 'Q1', reason: '双方防守优先+小比分决战' },
      { score: '2:1', probability: 0.10, quadrant: 'Q1', reason: '澳洲反击破门但美国拿下三分' },
      { score: '1:1', probability: 0.10, quadrant: 'Q2', reason: '第二轮平局溢价+双方可接受平局' },
      { score: '0:0', probability: 0.06, quadrant: 'Q2', reason: '极端保守局' },
    ],
    mviAnalysis: [
      { bet: '大 2.5 球', modelProb: 0.55, marketProb: 0.45, mvi: 1.22, rating: '高价值' },
      { bet: '美国 -0.5', modelProb: 0.60, marketProb: 0.55, mvi: 1.09, rating: '一般价值' },
      { bet: '小 2.5 球', modelProb: 0.45, marketProb: 0.55, mvi: 0.82, rating: '无价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 50, '大小球': 30, '比分': 15, '串关': 5 }, expectedReturn: 8 },
      balanced: { allocations: { '胜平负': 40, '比分': 25, '串关': 20, '大小球': 15 }, expectedReturn: 15 },
      aggressive: { allocations: { '比分': 35, '串关': 30, '胜平负': 20, '大小球': 15 }, expectedReturn: 32 },
    },
    confidence: 0.73, riskLevel: 'Medium',
    riskWarnings: [
      '澳洲首轮2:0完胜土耳其，Souttar防线纪律极强 → 美国久攻不下风险',
      'D组头名之争，胜者基本出线 → 平局双方均可接受，不排除默契球',
    ],
    predictedScore: '2:0', predictedDirection: 'home_win',
    factorBreakdown: { eloDiffScore: 0.72, recentFormScore: 0.80, h2hScore: 0.65, marketScore: 0.68, tacticalScore: 0.55, squadScore: 0.78, pressureScore: 0.60, psychologyScore: 0.72 },
    appliedLearnings: [
      { lesson: '首轮后半程强队回归正常 → 美国4:1已经证明火力', adjustment: '上调美国攻击效率+10%', impact: '上调' },
      { lesson: '第二轮出线生死战保守倾向', adjustment: '下调进球总数预期，首选2:0而非2:1', impact: '下调' },
    ],
    confidenceAdjustment: '-0.05（澳洲防线比预期坚固，美国可能需70分钟后才破门）',
  },
  'sco-mar-2': {
    matchId: 'sco-mar-2', homeWinProb: 0.22, drawProb: 0.30, awayWinProb: 0.48, over25Prob: 0.53, under25Prob: 0.47,
    top5Scores: [
      { score: '0:1', probability: 0.16, quadrant: 'Q3', reason: '摩洛哥战术成熟+逼平巴西证明实力' },
      { score: '1:1', probability: 0.15, quadrant: 'Q2', reason: '苏格兰主场球迷支持+擅长低位防守' },
      { score: '0:0', probability: 0.12, quadrant: 'Q2', reason: '极端小球+双方均可接受1分' },
      { score: '1:2', probability: 0.10, quadrant: 'Q4', reason: '摩洛哥Hakimi+Ziyech右侧打开局面' },
      { score: '0:2', probability: 0.08, quadrant: 'Q3', reason: '苏格兰久攻不下被反击' },
    ],
    mviAnalysis: [
      { bet: '平局', modelProb: 0.35, marketProb: 0.29, mvi: 1.20, rating: '高价值' },
      { bet: '苏格兰 +0.5', modelProb: 0.55, marketProb: 0.48, mvi: 1.15, rating: '高价值' },
      { bet: '摩洛哥 -0.25', modelProb: 0.45, marketProb: 0.52, mvi: 0.86, rating: '无价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 40, '比分': 10, '大小球': 30, '串关': 20 }, expectedReturn: 12 },
      balanced: { allocations: { '胜平负': 30, '比分': 25, '串关': 25, '大小球': 20 }, expectedReturn: 20 },
      aggressive: { allocations: { '比分': 30, '串关': 30, '胜平负': 20, '大小球': 20 }, expectedReturn: 35 },
    },
    confidence: 0.62, riskLevel: 'Medium',
    riskWarnings: [
      '苏格兰McTominay+McGinn中场硬朗但创造不足 → 结论：关注苏格兰少射或0射正',
      '摩洛哥Hakimi右路对Robertson左侧 → 结论：边路对决决定胜负',
    ],
    predictedScore: '0:1', predictedDirection: 'away_win',
    factorBreakdown: { eloDiffScore: 0.45, recentFormScore: 0.48, h2hScore: 0.42, marketScore: 0.55, tacticalScore: 0.65, squadScore: 0.58, pressureScore: 0.50, psychologyScore: 0.60 },
    appliedLearnings: [
      { lesson: '非洲球队大赛基因被系统性低估 → 摩洛哥已经逼平巴西验证', adjustment: '上调摩洛哥客场赢球概率+8%', impact: '上调' },
      { lesson: '低控球率防反球队在第二轮更危险', adjustment: '摩洛哥防反效率上调，苏格兰进攻效率下调', impact: '上调' },
    ],
    confidenceAdjustment: '-0.08（两队风格克制明显但数据离散，摩洛哥平巴西的实际意义仍需验证）',
  },
  'bra-hai-2': {
    matchId: 'bra-hai-2', homeWinProb: 0.85, drawProb: 0.10, awayWinProb: 0.05, over25Prob: 0.64, under25Prob: 0.36,
    top5Scores: [
      { score: '3:0', probability: 0.22, quadrant: 'Q1', reason: '巴西首轮平摩洛哥憋怒，海地首轮0进球' },
      { score: '4:0', probability: 0.18, quadrant: 'Q1', reason: 'Vinicius+Rodrygo组合碾压海地防线' },
      { score: '2:0', probability: 0.13, quadrant: 'Q1', reason: '保守走法巴西控场求稳' },
      { score: '5:0', probability: 0.10, quadrant: 'Q1', reason: '完全碾压，海地世界杯经验为零' },
      { score: '3:1', probability: 0.07, quadrant: 'Q1', reason: '海地定位球偷袭一球' },
    ],
    mviAnalysis: [
      { bet: '巴西 -2.5', modelProb: 0.55, marketProb: 0.42, mvi: 1.31, rating: '超级价值' },
      { bet: '大 3.5 球', modelProb: 0.52, marketProb: 0.43, mvi: 1.22, rating: '高价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 60, '比分': 10, '大小球': 25, '串关': 5 }, expectedReturn: 5 },
      balanced: { allocations: { '胜平负': 50, '比分': 20, '串关': 20, '大小球': 10 }, expectedReturn: 12 },
      aggressive: { allocations: { '比分': 35, '串关': 30, '胜平负': 20, '大小球': 15 }, expectedReturn: 28 },
    },
    confidence: 0.88, riskLevel: 'Low',
    riskWarnings: [
      '巴西首轮1:1平摩洛哥暴露进攻效率问题 → 结论：即使赢球可能仅2球',
      '海地首轮0:1苏格兰防守并非完全崩溃 → 结论：-2.5盘口有一定风险',
    ],
    predictedScore: '3:0', predictedDirection: 'home_win',
    factorBreakdown: { eloDiffScore: 0.95, recentFormScore: 0.82, h2hScore: 0.70, marketScore: 0.90, tacticalScore: 0.85, squadScore: 0.92, pressureScore: 0.75, psychologyScore: 0.55 },
    appliedLearnings: [
      { lesson: '强队低赔(<1.50)时平局溢价→巴西首轮1:1验证', adjustment: '巴西赔率1.08极为安全，但下调穿盘信心10%', impact: '下调' },
      { lesson: '海地首轮仅0:1负苏格兰，防守并非鱼腩', adjustment: '上调巴西最可能比分从4:0修正为3:0', impact: '下调' },
    ],
    confidenceAdjustment: '-0.05（巴西首轮让人失望，豪华阵容未必等于豪华比分）',
  },
  // ---- 6/19 第二轮 ----
  'cze-rsa-2': {
    matchId: 'cze-rsa-2', homeWinProb: 0.52, drawProb: 0.28, awayWinProb: 0.20, over25Prob: 0.48, under25Prob: 0.52,
    top5Scores: [
      { score: '2:0', probability: 0.18, quadrant: 'Q1', reason: '捷克首轮1:2憾负韩国实力不弱+南非0:2负墨西哥攻击乏力' },
      { score: '1:0', probability: 0.15, quadrant: 'Q1', reason: '捷克Soucek+Schick中场压制南非年轻阵容' },
      { score: '1:1', probability: 0.13, quadrant: 'Q2', reason: '双方首轮均败求稳+第二轮平局趋势' },
      { score: '2:1', probability: 0.10, quadrant: 'Q1', reason: '南非定位球偷一球' },
      { score: '0:0', probability: 0.08, quadrant: 'Q2', reason: '出线压力导致双方极度保守' },
    ],
    mviAnalysis: [
      { bet: '小 2.5 球', modelProb: 0.52, marketProb: 0.45, mvi: 1.15, rating: '高价值' },
      { bet: '捷克 -0.5', modelProb: 0.53, marketProb: 0.50, mvi: 1.06, rating: '一般价值' },
      { bet: '平局', modelProb: 0.30, marketProb: 0.27, mvi: 1.11, rating: '一般价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 50, '大小球': 30, '比分': 15, '串关': 5 }, expectedReturn: 6 },
      balanced: { allocations: { '胜平负': 35, '比分': 25, '串关': 25, '大小球': 15 }, expectedReturn: 12 },
      aggressive: { allocations: { '比分': 35, '串关': 30, '胜平负': 20, '大小球': 15 }, expectedReturn: 28 },
    },
    confidence: 0.62, riskLevel: 'Medium',
    riskWarnings: [
      '捷克首轮1:2输韩国暴露后防漏洞 → 结论：南非可能进球但捷克进攻线更可靠',
      'A组出线形势：败者基本出局 → 结论：双方前20分钟可能过度紧张',
    ],
    predictedScore: '2:0', predictedDirection: 'home_win',
    richAnalysis: {
      overview: 'A组第二轮。捷克首轮1:2惜败韩国，Schick+Soucek中场核心表现出色但防线漏洞被Son惩罚。南非首轮0:2负墨西哥，攻击线缺乏创造力，全场仅1次射正。',
      formData: '捷克近5场2胜1平2负，欧预赛曾2-0胜波兰、1-1平英格兰。南非近5场1胜1平3负，非洲区预选赛小组第二。',
      h2h: '双方首次世界杯交锋。捷克对非洲球队3胜1平；南非对欧洲球队1胜2平5负。',
      lineup: '捷克4-2-3-1：Stanek；Coufal, Holes, Krejci, Jurasek；Soucek(C), Sadilek；Cerny, Provod, Hlozek；Schick。南非4-4-2：Williams(C)；Modiba, Xulu, Maela, Mudau；Zwane, Mokoena, Sithole, Tau；Makgopa, Foster。',
      tactics: '捷克高位压迫+中场控制，Soucek后插上+Schick禁区内终结。南非防守反击+定位球。风格克制：捷克中场身体对抗碾压南非年轻中场。',
      market: 'Bet365欧赔：1.73/3.60/4.50（隐含概率53%/27%/20%）。O/U 2.5：Over 2.00/Under 1.80。让球：捷克-0.75。',
    },
  },
  'sui-bih-2': {
    matchId: 'sui-bih-2', homeWinProb: 0.38, drawProb: 0.34, awayWinProb: 0.28, over25Prob: 0.42, under25Prob: 0.58,
    top5Scores: [
      { score: '1:1', probability: 0.20, quadrant: 'Q2', reason: '瑞士首轮1:1卡塔尔+波黑1:1加拿大，双方均为平局型队伍' },
      { score: '0:0', probability: 0.14, quadrant: 'Q2', reason: '瑞士防守纪律+波黑Dzeko攻坚效率下降' },
      { score: '1:0', probability: 0.12, quadrant: 'Q1', reason: '瑞士大赛经验碾压波黑世界杯新军' },
      { score: '0:1', probability: 0.10, quadrant: 'Q4', reason: '波黑Pjanic定位球制胜' },
      { score: '2:1', probability: 0.08, quadrant: 'Q1', reason: '瑞士下半场发力' },
    ],
    mviAnalysis: [
      { bet: '平局', modelProb: 0.34, marketProb: 0.28, mvi: 1.22, rating: '高价值' },
      { bet: '小 2.5 球', modelProb: 0.58, marketProb: 0.49, mvi: 1.18, rating: '高价值' },
      { bet: '双方不进球', modelProb: 0.55, marketProb: 0.50, mvi: 1.10, rating: '一般价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 45, '大小球': 35, '比分': 15, '串关': 5 }, expectedReturn: 5 },
      balanced: { allocations: { '胜平负': 35, '比分': 25, '串关': 25, '大小球': 15 }, expectedReturn: 10 },
      aggressive: { allocations: { '比分': 30, '串关': 30, '胜平负': 20, '大小球': 20 }, expectedReturn: 22 },
    },
    confidence: 0.58, riskLevel: 'Medium',
    riskWarnings: [
      '两队首轮均平局，B组出线形势混沌 → 结论：平局双方接受，攻击欲望低',
      '瑞士世界杯经验丰富(连续6届)，波黑首次入围 → 结论：经验差在70分钟后体现',
    ],
    predictedScore: '1:1', predictedDirection: 'draw',
    richAnalysis: {
      overview: 'B组第二轮。瑞士首轮1:1平卡塔尔表现低于预期，Xhaka+Freuler中场控制力仍在但前场终结效率低。波黑首轮1:1平加拿大，Dzeko头球破门证明老将仍有关键能力。',
      formData: '瑞士近5场2胜2平1负，世界杯连续6届参赛经验丰富。波黑近5场2胜2平1负，世界杯首秀首轮拿分自信心足。',
      h2h: '双方历史交手2次均平局（2020欧国联1:1、2023热身1:0瑞士）。世界杯首次交锋。',
      lineup: '瑞士3-4-3：Sommer；Schar, Akanji, Rodriguez；Widmer, Xhaka(C), Freuler, Ndoye；Shaqiri, Amdouni, Vargas。波黑4-3-1-2：Sehic；Dedic, Ahmedhodzic(C), Sanicanin, Kolasinac；Pjanic, Krunic, Hadziahmetovic；Gojak；Dzeko, Prevljak。',
      tactics: '瑞士3-4-3控球渗透+Xhaka长传调度。波黑防守反击+Pjanic定位球+Dzeko空中威胁。风格克制：瑞士三中卫制空正好克制Dzeko。',
      market: 'Bet365欧赔：2.10/3.25/3.60。O/U 2.5：Over 2.10/Under 1.73。',
    },
  },
  'can-qat-2': {
    matchId: 'can-qat-2', homeWinProb: 0.42, drawProb: 0.32, awayWinProb: 0.26, over25Prob: 0.50, under25Prob: 0.50,
    top5Scores: [
      { score: '1:1', probability: 0.17, quadrant: 'Q2', reason: '加拿大首轮1:1波黑+卡塔尔1:1瑞士，两队均拿1分' },
      { score: '2:1', probability: 0.15, quadrant: 'Q1', reason: '加拿大主场(Davies+David)攻击力+卡塔尔防线可破' },
      { score: '1:0', probability: 0.12, quadrant: 'Q1', reason: '加拿大零封+卡塔尔攻击转化率低' },
      { score: '0:0', probability: 0.10, quadrant: 'Q2', reason: '双方保平优先' },
      { score: '2:0', probability: 0.08, quadrant: 'Q1', reason: '加拿大若先进球可能打花' },
    ],
    mviAnalysis: [
      { bet: '平局', modelProb: 0.32, marketProb: 0.29, mvi: 1.12, rating: '一般价值' },
      { bet: '加拿大 -0.5', modelProb: 0.48, marketProb: 0.46, mvi: 1.05, rating: '一般价值' },
      { bet: '大 2.5 球', modelProb: 0.50, marketProb: 0.49, mvi: 1.02, rating: '一般价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 50, '大小球': 30, '比分': 15, '串关': 5 }, expectedReturn: 6 },
      balanced: { allocations: { '胜平负': 35, '比分': 25, '串关': 25, '大小球': 15 }, expectedReturn: 12 },
      aggressive: { allocations: { '比分': 35, '串关': 30, '胜平负': 20, '大小球': 15 }, expectedReturn: 28 },
    },
    confidence: 0.55, riskLevel: 'Medium',
    riskWarnings: [
      '加拿大以逸待劳连续主场作战(多伦多→温哥华) → 结论：体能优势可兑现为下半场进球',
      '卡塔尔首轮逼平瑞士含金量高，但"亚洲杯冠军溢价"可能被高估 → 结论：加拿大不败是合理选择',
    ],
    predictedScore: '2:1', predictedDirection: 'home_win',
    richAnalysis: {
      overview: 'B组第二轮。加拿大首轮1:1平波黑，Davies左路突破+Buchanan反击速度为核心武器。卡塔尔首轮1:1平瑞士爆冷，AFC亚洲杯冠军证明实力但连续客场能力待考。',
      formData: '加拿大近5场2胜2平1负，中北美区预选赛小组第一。卡塔尔近5场2胜2平1负，亚洲杯冠军+世界杯首秀拿分。',
      h2h: '双方首次交手。加拿大对亚洲球队3胜1平；卡塔尔对中北美球队1胜1平1负。',
      lineup: '加拿大4-4-2：Crepeau；Johnston, Miller, Cornelius, Davies；Buchanan, Eustaquio, Osorio, Laryea；David, Larin。卡塔尔5-3-2：Barsham；Al-Rawi, Salman, Khoukhi, Miguel, Waad；Boudiaf, Al-Haydos(C), Madibo；Afif, Ali。',
      tactics: '加拿大高位转换+Davies左路爆点。卡塔尔5后卫深度防守+Afif反击。风格克制：加拿大边路速度克制卡塔尔防线到位慢弱点。',
      market: 'Bet365：2.25/3.40/3.10。O/U 2.5：Over 2.00/Under 1.80。',
    },
  },
  'mex-kor-2': {
    matchId: 'mex-kor-2', homeWinProb: 0.45, drawProb: 0.30, awayWinProb: 0.25, over25Prob: 0.55, under25Prob: 0.45,
    top5Scores: [
      { score: '1:1', probability: 0.16, quadrant: 'Q2', reason: 'A组榜首大战，墨西哥首轮2:0南非+韩国2:1捷克均为胜利队伍' },
      { score: '2:1', probability: 0.15, quadrant: 'Q1', reason: '墨西哥Guadalajara主场+韩国远途奔波' },
      { score: '1:0', probability: 0.12, quadrant: 'Q1', reason: '墨西哥防守零封南非证明组织力' },
      { score: '2:2', probability: 0.10, quadrant: 'Q2', reason: '双方放手一搏对攻战' },
      { score: '0:1', probability: 0.08, quadrant: 'Q4', reason: '韩国Son+Lee攻击力延续' },
    ],
    mviAnalysis: [
      { bet: '平局', modelProb: 0.30, marketProb: 0.27, mvi: 1.10, rating: '一般价值' },
      { bet: '大 2.5 球', modelProb: 0.55, marketProb: 0.52, mvi: 1.06, rating: '一般价值' },
      { bet: '墨西哥 0', modelProb: 0.48, marketProb: 0.47, mvi: 1.03, rating: '一般价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 50, '大小球': 30, '比分': 15, '串关': 5 }, expectedReturn: 6 },
      balanced: { allocations: { '胜平负': 35, '比分': 25, '串关': 25, '大小球': 15 }, expectedReturn: 12 },
      aggressive: { allocations: { '比分': 35, '串关': 30, '胜平负': 20, '大小球': 15 }, expectedReturn: 28 },
    },
    confidence: 0.60, riskLevel: 'Medium',
    riskWarnings: [
      '双方首轮均胜，胜者基本锁定小组第一 → 结论：不会保守，可能对攻',
      '墨西哥海拔1500m的Guadalajara主场优势+韩国从LA飞来的旅途疲劳 → 结论：墨西哥不败概率高',
      '韩国Son+Kang-in Lee攻击力已证明可突破任何防线 → 结论：墨西哥零封难度大',
    ],
    predictedScore: '2:1', predictedDirection: 'home_win',
    richAnalysis: {
      overview: 'A组榜首大战。墨西哥首轮2:0完胜南非，攻防均衡。韩国首轮2:1胜捷克，Son+Lee攻击组合火热。胜者基本锁定小组第一。',
      formData: '墨西哥近5场3胜1平1负。韩国近5场2胜2平1负，亚洲区预选赛第一。',
      h2h: '历史交手8次墨西哥4胜2平2负，最近2022世界杯2:0胜韩国。',
      lineup: '墨西哥4-3-3：Ochoa；Sanchez, Montes, Vasquez, Gallardo；Alvarez, Chavez, Pineda；Antuna, Jimenez, Lozano(C)。韩国4-2-3-1：Kim Seunggyu；Kim Moonhwan, Kim Minjae, Kim Younggwon, Kim Jinsu；Jung, Hwang；Lee Kangin, Son(C), Hwang Heechan；Cho。',
      tactics: '墨西哥攻守平衡+定位球。韩国宽度进攻+Son内切。风格克制：墨西哥中场拦截恰好掐断韩国中路渗透。',
      market: 'Bet365：2.25/3.30/3.20。O/U 2.5：Over 2.05/Under 1.78。',
    },
  },
  'tur-par-2': {
    matchId: 'tur-par-2', homeWinProb: 0.73, drawProb: 0.19, awayWinProb: 0.08, over25Prob: 0.57, under25Prob: 0.43,
    top5Scores: [
      { score: '2:0', probability: 0.20, quadrant: 'Q1', reason: '土耳其主场攻势+巴拉圭首轮惨败防线崩盘' },
      { score: '2:1', probability: 0.15, quadrant: 'Q1', reason: '土耳其领先后松懈被偷一球' },
      { score: '1:0', probability: 0.12, quadrant: 'Q1', reason: '保守局土耳其控场稳赢' },
      { score: '3:0', probability: 0.10, quadrant: 'Q1', reason: '巴拉圭首轮1:4暴露防线全线崩溃' },
      { score: '3:1', probability: 0.08, quadrant: 'Q1', reason: '土耳其大胜但巴拉圭扳回颜面球' },
    ],
    mviAnalysis: [
      { bet: '土耳其 -0.75', modelProb: 0.60, marketProb: 0.48, mvi: 1.25, rating: '高价值' },
      { bet: '大 2.5 球', modelProb: 0.57, marketProb: 0.46, mvi: 1.23, rating: '高价值' },
      { bet: '平局', modelProb: 0.22, marketProb: 0.28, mvi: 0.78, rating: '无价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 55, '比分': 10, '大小球': 25, '串关': 10 }, expectedReturn: 10 },
      balanced: { allocations: { '胜平负': 45, '比分': 25, '串关': 15, '大小球': 15 }, expectedReturn: 18 },
      aggressive: { allocations: { '比分': 30, '串关': 30, '胜平负': 25, '大小球': 15 }, expectedReturn: 35 },
    },
    confidence: 0.80, riskLevel: 'Low',
    riskWarnings: [
      '土耳其主场近9场7胜1平1负场均2球 → 结论：主场优势巨大，关键是穿几球',
      '巴拉圭首轮1:4惨败美国心理状态成疑 → 结论：可能崩盘或触底反弹两种极端',
    ],
    predictedScore: '2:0', predictedDirection: 'home_win',
    factorBreakdown: { eloDiffScore: 0.68, recentFormScore: 0.72, h2hScore: 0.55, marketScore: 0.75, tacticalScore: 0.62, squadScore: 0.70, pressureScore: 0.58, psychologyScore: 0.65 },
    appliedLearnings: [
      { lesson: '主场优势在第一轮验证有效（加拿大6:0、墨西哥1:0）', adjustment: '土耳其半个主场+巴拉圭跨洲旅行 → 上调主胜概率+10%', impact: '上调' },
      { lesson: '开场30分钟内失球球队几乎全败', adjustment: '巴拉圭首轮对美国前20分钟丢2球，防守开局极易崩盘', impact: '上调' },
    ],
    confidenceAdjustment: '+0.05（土耳其主场优势被市场低估，1.97赔率有显著价值）',
  },
  // ---- 6/21 第二轮 ----
  'ned-swe-2': {
    matchId: 'ned-swe-2', homeWinProb: 0.55, drawProb: 0.25, awayWinProb: 0.20, over25Prob: 0.58, under25Prob: 0.42,
    top5Scores: [
      { score: '2:1', probability: 0.18, quadrant: 'Q1', reason: '荷兰Gakpo+Depay双核破防，瑞典Isak反击破门' },
      { score: '1:0', probability: 0.15, quadrant: 'Q1', reason: '荷兰控场稳胜，瑞典大巴难破' },
      { score: '1:1', probability: 0.14, quadrant: 'Q2', reason: '双方均可接受各取1分保出线' },
      { score: '2:0', probability: 0.12, quadrant: 'Q1', reason: '荷兰防线零封瑞典单核Isak' },
      { score: '3:1', probability: 0.08, quadrant: 'Q1', reason: '荷兰下半场发力拉开比分' },
    ],
    mviAnalysis: [
      { bet: '荷兰 -0.5', modelProb: 0.55, marketProb: 0.48, mvi: 1.15, rating: '一般价值' },
      { bet: '大 2.5 球', modelProb: 0.58, marketProb: 0.50, mvi: 1.16, rating: '一般价值' },
      { bet: '平局', modelProb: 0.25, marketProb: 0.28, mvi: 0.89, rating: '无价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 50, '大小球': 25, '比分': 15, '串关': 10 }, expectedReturn: 10 },
      balanced: { allocations: { '胜平负': 40, '比分': 25, '串关': 20, '大小球': 15 }, expectedReturn: 18 },
      aggressive: { allocations: { '比分': 30, '串关': 30, '胜平负': 25, '大小球': 15 }, expectedReturn: 32 },
    },
    confidence: 0.62, riskLevel: 'Medium',
    riskWarnings: [
      '瑞典首轮1:5惨败防线严重漏风 → 荷兰破门概率高但需防瑞典反弹',
      'F组头名之争，荷兰日本各2分 → 荷兰必须赢才能掌握主动',
    ],
    predictedScore: '2:1', predictedDirection: 'home_win',
    factorBreakdown: { eloDiffScore: 0.58, recentFormScore: 0.52, h2hScore: 0.48, marketScore: 0.55, tacticalScore: 0.60, squadScore: 0.62, pressureScore: 0.55, psychologyScore: 0.50 },
    appliedLearnings: [
      { lesson: '首轮惨败队伍第二轮反弹被低估', adjustment: '瑞典1:5惨败后可能触底反弹 → 下调荷兰穿盘概率', impact: '下调' },
      { lesson: '第二轮平局率下降趋势', adjustment: '下调平局概率至0.25（首轮均值0.36）', impact: '下调' },
    ],
    confidenceAdjustment: '-0.03（瑞典首轮惨败后不可预测性高，数据离散大）',
  },
  'ger-civ-2': {
    matchId: 'ger-civ-2', homeWinProb: 0.80, drawProb: 0.13, awayWinProb: 0.07, over25Prob: 0.70, under25Prob: 0.30,
    top5Scores: [
      { score: '3:0', probability: 0.24, quadrant: 'Q1', reason: '德国首轮7:1后信心爆棚，科特迪瓦防线难挡' },
      { score: '2:0', probability: 0.18, quadrant: 'Q1', reason: '德国控制节奏稳中求胜' },
      { score: '4:0', probability: 0.15, quadrant: 'Q1', reason: '德国锋线继续大开杀戒' },
      { score: '3:1', probability: 0.12, quadrant: 'Q1', reason: '科特迪瓦定位球破门但难以撼动大局' },
      { score: '1:0', probability: 0.08, quadrant: 'Q1', reason: '极端保守局' },
    ],
    mviAnalysis: [
      { bet: '德国 -2', modelProb: 0.55, marketProb: 0.42, mvi: 1.31, rating: '高价值' },
      { bet: '大 3 球', modelProb: 0.68, marketProb: 0.50, mvi: 1.36, rating: '高价值' },
      { bet: '德国胜', modelProb: 0.82, marketProb: 0.80, mvi: 1.03, rating: '一般价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 55, '比分': 15, '大小球': 20, '串关': 10 }, expectedReturn: 12 },
      balanced: { allocations: { '胜平负': 40, '比分': 25, '串关': 20, '大小球': 15 }, expectedReturn: 22 },
      aggressive: { allocations: { '比分': 30, '串关': 30, '胜平负': 20, '大小球': 20 }, expectedReturn: 40 },
    },
    confidence: 0.78, riskLevel: 'Low',
    riskWarnings: [
      '德国首轮7:1大胜后可能轻敌 → 需防轻敌心态',
      '科特迪瓦首轮0:1惜败厄瓜多尔表现不差 → 可能给德国制造麻烦',
    ],
    predictedScore: '3:0', predictedDirection: 'home_win',
    factorBreakdown: { eloDiffScore: 0.82, recentFormScore: 0.88, h2hScore: 0.70, marketScore: 0.80, tacticalScore: 0.72, squadScore: 0.85, pressureScore: 0.40, psychologyScore: 0.65 },
    appliedLearnings: [
      { lesson: '强队大胜后次轮继续强势概率高（加拿大6:0验证）', adjustment: '德国首轮7:1后士气峰值 → 上调进球预期+0.5', impact: '上调' },
      { lesson: '非洲球队大赛基因不可忽视', adjustment: '科特迪瓦逼平厄瓜多尔说明防守硬朗 → 保守估计2球起步', impact: '下调' },
    ],
    confidenceAdjustment: '+0.03（德国攻击力在第二轮已被充分验证，科特迪瓦攻弱守强但实力差显著）',
  },
  'ecu-cuw-2': {
    matchId: 'ecu-cuw-2', homeWinProb: 0.75, drawProb: 0.17, awayWinProb: 0.08, over25Prob: 0.60, under25Prob: 0.40,
    top5Scores: [
      { score: '3:0', probability: 0.20, quadrant: 'Q1', reason: '厄瓜多尔首轮1:0胜科特迪瓦证明实力，库拉索无法抗衡' },
      { score: '2:0', probability: 0.16, quadrant: 'Q1', reason: '厄瓜多尔稳中求三分' },
      { score: '4:0', probability: 0.11, quadrant: 'Q1', reason: '实力碾压局' },
      { score: '1:0', probability: 0.10, quadrant: 'Q1', reason: '保守局厄瓜多尔小胜即安' },
      { score: '2:1', probability: 0.08, quadrant: 'Q1', reason: '库拉索偷一球但厄瓜多尔仍胜' },
    ],
    mviAnalysis: [
      { bet: '厄瓜多尔 -1.5', modelProb: 0.55, marketProb: 0.42, mvi: 1.31, rating: '高价值' },
      { bet: '大 2.5 球', modelProb: 0.60, marketProb: 0.52, mvi: 1.15, rating: '一般价值' },
      { bet: '厄瓜多尔胜', modelProb: 0.78, marketProb: 0.75, mvi: 1.04, rating: '一般价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 60, '比分': 10, '大小球': 20, '串关': 10 }, expectedReturn: 10 },
      balanced: { allocations: { '胜平负': 45, '比分': 20, '串关': 20, '大小球': 15 }, expectedReturn: 18 },
      aggressive: { allocations: { '比分': 35, '串关': 30, '胜平负': 20, '大小球': 15 }, expectedReturn: 35 },
    },
    confidence: 0.70, riskLevel: 'Low',
    riskWarnings: [
      '库拉索首轮1:7惨败德国后士气可能崩盘 → 但FIFA排名#82仍有基本防守能力',
      '厄瓜多尔需确保出线但不能过度消耗（下一轮关键）',
    ],
    predictedScore: '3:0', predictedDirection: 'home_win',
    factorBreakdown: { eloDiffScore: 0.80, recentFormScore: 0.72, h2hScore: 0.65, marketScore: 0.78, tacticalScore: 0.68, squadScore: 0.75, pressureScore: 0.35, psychologyScore: 0.70 },
    appliedLearnings: [
      { lesson: '首轮惨败队伍第二轮继续崩盘概率高（巴西3:0海地验证）', adjustment: '库拉索首轮1:7德国防线信心崩溃 → 上调厄瓜多尔穿盘概率', impact: '上调' },
    ],
    confidenceAdjustment: '+0.05（实力悬殊+库拉索首轮惨败心理阴影未消）',
  },
  'tun-jpn-2': {
    matchId: 'tun-jpn-2', homeWinProb: 0.25, drawProb: 0.28, awayWinProb: 0.47, over25Prob: 0.52, under25Prob: 0.48,
    top5Scores: [
      { score: '1:2', probability: 0.16, quadrant: 'Q4', reason: '日本技术优势+突尼斯换帅不确定性' },
      { score: '0:1', probability: 0.14, quadrant: 'Q3', reason: '日本控场小胜格局' },
      { score: '1:1', probability: 0.13, quadrant: 'Q2', reason: '双方均接受1分保出线' },
      { score: '0:2', probability: 0.10, quadrant: 'Q3', reason: '日本下半场发力扩大比分' },
      { score: '2:1', probability: 0.08, quadrant: 'Q1', reason: '突尼斯新帅效应爆冷' },
    ],
    mviAnalysis: [
      { bet: '日本 -0.25', modelProb: 0.48, marketProb: 0.42, mvi: 1.14, rating: '一般价值' },
      { bet: '平局', modelProb: 0.28, marketProb: 0.30, mvi: 0.93, rating: '无价值' },
      { bet: '大 2.5 球', modelProb: 0.52, marketProb: 0.48, mvi: 1.08, rating: '一般价值' },
    ],
    parlayRecommendations: [],
    bankroll: {
      conservative: { allocations: { '胜平负': 45, '大小球': 30, '比分': 15, '串关': 10 }, expectedReturn: 8 },
      balanced: { allocations: { '胜平负': 35, '比分': 30, '串关': 20, '大小球': 15 }, expectedReturn: 15 },
      aggressive: { allocations: { '比分': 35, '串关': 30, '胜平负': 20, '大小球': 15 }, expectedReturn: 30 },
    },
    confidence: 0.58, riskLevel: 'High',
    riskWarnings: [
      '突尼斯换帅效应不可预测 → 新教练可能带来战术突变',
      '日本首轮1:1荷兰证明实力 → 但F组竞争激烈日本必须赢才能确保出线',
    ],
    predictedScore: '1:2', predictedDirection: 'away_win',
    factorBreakdown: { eloDiffScore: 0.48, recentFormScore: 0.52, h2hScore: 0.45, marketScore: 0.50, tacticalScore: 0.55, squadScore: 0.58, pressureScore: 0.60, psychologyScore: 0.42 },
    appliedLearnings: [
      { lesson: '亚洲强队（日本、韩国）大赛表现稳定', adjustment: '日本首轮1:1荷兰证明实力 → 上调日本客胜概率', impact: '上调' },
      { lesson: '换帅效应需额外风险溢价', adjustment: '突尼斯世界杯前换帅 → 下调大概率预测置信度', impact: '下调' },
    ],
    confidenceAdjustment: '-0.07（突尼斯换帅不确定性+日本客场作战双重风险）',
  },
  // ---- 6/22 第二轮 ----
  'esp-ksa-2': {
    matchId: 'esp-ksa-2', homeWinProb: 0.85, drawProb: 0.11, awayWinProb: 0.04, over25Prob: 0.58, under25Prob: 0.42,
    predictedScore: '2:0', predictedDirection: 'home_win', confidence: 0.78, riskLevel: 'Medium',
    top5Scores: [{score:'2:0',probability:0.22,quadrant:'Q1',reason:'西班牙传控压制，沙特大巴首轮被乌拉圭攻破'},{score:'3:0',probability:0.18,quadrant:'Q1',reason:'下半场沙特体能下降门户大开'},{score:'1:0',probability:0.15,quadrant:'Q1',reason:'西班牙破大巴困难小胜即安'},{score:'0:0',probability:0.10,quadrant:'Q2',reason:'佛得角平西班牙复制剧本'},{score:'4:0',probability:0.08,quadrant:'Q1',reason:'轮换登场额外发力'}],
    riskWarnings: ['西班牙R1 0:0佛得角暴露破大巴难题→警惕再哑火', 'H组四队1分→西班牙必须赢', '沙特逼平乌拉圭证明世界杯正赛专注度'],
    quadrant: 'Q1', quadrantLabel: '强队碾压',
    mviAnalysis: [
      { bet: '西班牙 -1.5/2', modelProb: 0.62, marketProb: 0.52, mvi: 1.19, rating: '高价值' },
      { bet: '西班牙胜', modelProb: 0.87, marketProb: 0.83, mvi: 1.05, rating: '一般价值' },
      { bet: '小 2.5 球', modelProb: 0.42, marketProb: 0.48, mvi: 0.88, rating: '无价值' },
    ],
    parlayRecommendations: [
      { type: '稳健', selections: ['esp-ksa-2 西班牙胜', 'nzl-egy-2 埃及胜'], odds: 2.15, probability: 0.58, risk: 'Low' },
    ],
    bankroll: {
      conservative: { allocations: { '胜平负': 55, '比分': 10, '大小球': 25, '串关': 10 }, expectedReturn: 9 },
      balanced: { allocations: { '胜平负': 40, '比分': 20, '串关': 25, '大小球': 15 }, expectedReturn: 16 },
      aggressive: { allocations: { '比分': 35, '串关': 30, '胜平负': 20, '大小球': 15 }, expectedReturn: 30 },
    },
    factorBreakdown: { eloDiffScore: 0.82, recentFormScore: 0.65, h2hScore: 0.60, marketScore: 0.85, tacticalScore: 0.55, squadScore: 0.82, pressureScore: 0.40, psychologyScore: 0.58 },
    appliedLearnings: [
      { lesson: '首轮平局溢价1.4x——但西班牙首轮0:0已是平局，次轮继续平的先例极少', adjustment: '下调平局概率至0.11（低于首轮均值0.33）', impact: '下调' },
      { lesson: '第二轮非平局趋势延续（8/10=80%非平局）', adjustment: '西班牙胜率上调至0.85', impact: '上调' },
      { lesson: '强队赔率<1.50时仍需警惕平局，但西班牙出线压力巨大', adjustment: '保留10%平局底线', impact: '下调' },
    ],
    confidenceAdjustment: '+0.03（西班牙出线压力+沙特首轮消耗巨大，实力差距在第二轮扩大）',
  },
  'bel-irn-2': {
    matchId: 'bel-irn-2', homeWinProb: 0.65, drawProb: 0.26, awayWinProb: 0.09, over25Prob: 0.52, under25Prob: 0.48,
    predictedScore: '2:0', predictedDirection: 'home_win', confidence: 0.65, riskLevel: 'Medium',
    top5Scores: [{score:'2:0',probability:0.18,quadrant:'Q1',reason:'De Bruyne破局，比利时经验胜出'},{score:'1:0',probability:0.15,quadrant:'Q1',reason:'伊朗大巴消耗战比利时小胜'},{score:'1:1',probability:0.14,quadrant:'Q2',reason:'伊朗5-3-2铁桶复制佛得角'},{score:'3:0',probability:0.10,quadrant:'Q1',reason:'比利时下半场发力'},{score:'0:0',probability:0.08,quadrant:'Q2',reason:'双方均保守极端局'}],
    riskWarnings: ['伊朗5-3-2低block→可能复制佛得角策略', '比利时R1 1:1埃及低于预期→但仍比西班牙多进1球', 'De Bruyne是破局关键→但伊朗针对性防守可能限制'],
    quadrant: 'Q1', quadrantLabel: '强队碾压',
    mviAnalysis: [
      { bet: '比利时 -1', modelProb: 0.48, marketProb: 0.40, mvi: 1.20, rating: '高价值' },
      { bet: '比利时胜', modelProb: 0.67, marketProb: 0.65, mvi: 1.03, rating: '一般价值' },
      { bet: '平局', modelProb: 0.26, marketProb: 0.25, mvi: 1.04, rating: '一般价值' },
    ],
    parlayRecommendations: [
      { type: '稳健', selections: ['bel-irn-2 比利时胜', 'esp-ksa-2 西班牙胜'], odds: 2.30, probability: 0.55, risk: 'Low' },
      { type: '平衡', selections: ['bel-irn-2 比利时胜', 'nzl-egy-2 埃及胜', 'esp-ksa-2 西班牙胜'], odds: 3.80, probability: 0.38, risk: 'Medium' },
    ],
    bankroll: {
      conservative: { allocations: { '胜平负': 50, '大小球': 30, '比分': 10, '串关': 10 }, expectedReturn: 8 },
      balanced: { allocations: { '胜平负': 40, '比分': 20, '串关': 25, '大小球': 15 }, expectedReturn: 14 },
      aggressive: { allocations: { '比分': 30, '串关': 30, '胜平负': 25, '大小球': 15 }, expectedReturn: 28 },
    },
    factorBreakdown: { eloDiffScore: 0.68, recentFormScore: 0.58, h2hScore: 0.55, marketScore: 0.65, tacticalScore: 0.45, squadScore: 0.72, pressureScore: 0.50, psychologyScore: 0.52 },
    appliedLearnings: [
      { lesson: 'ELO差<150不应给出>52%胜率——但比利时1900 vs 伊朗1550=350分', adjustment: 'ELO差支持65%胜率但下调5%因伊朗防守', impact: '下调' },
      { lesson: '第二轮平局率持续下降（2/8→2/4=25%）', adjustment: '平局概率下调至0.26', impact: '下调' },
      { lesson: '首轮惨败反弹存在（巴拉圭1:0土），伊朗首轮2:2新西兰非惨败', adjustment: '伊朗无反弹溢价，正常发挥', impact: '上调' },
    ],
    confidenceAdjustment: '-0.05（伊朗5-3-2大巴策略在首轮成功限制西班牙，可能复制到比利时）',
  },
  'uru-cpv-2': {
    matchId: 'uru-cpv-2', homeWinProb: 0.60, drawProb: 0.28, awayWinProb: 0.12, over25Prob: 0.50, under25Prob: 0.50,
    predictedScore: '2:0', predictedDirection: 'home_win', confidence: 0.58, riskLevel: 'High',
    top5Scores: [{score:'2:0',probability:0.16,quadrant:'Q1',reason:'乌拉圭实力溢出但佛得角大巴难破'},{score:'1:0',probability:0.15,quadrant:'Q1',reason:'南美经验最终胜出'},{score:'0:0',probability:0.13,quadrant:'Q2',reason:'佛得角复制0:0西班牙剧本'},{score:'1:1',probability:0.10,quadrant:'Q2',reason:'双方各取1分均接受'},{score:'3:0',probability:0.08,quadrant:'Q1',reason:'乌拉圭下半场连进3球'}],
    riskWarnings: ['佛得角0:0逼平西班牙→防守能力远超ELO暗示', '乌拉圭R1 1:1沙特表现平平→攻击力待验证', '非洲球队世界杯加成+100 ELO→佛得角=ELO 1550'],
    quadrant: 'Q1', quadrantLabel: '强队碾压',
    mviAnalysis: [
      { bet: '平局', modelProb: 0.28, marketProb: 0.26, mvi: 1.08, rating: '一般价值' },
      { bet: '乌拉圭 -0.5', modelProb: 0.60, marketProb: 0.59, mvi: 1.02, rating: '一般价值' },
      { bet: '小 2.5 球', modelProb: 0.50, marketProb: 0.48, mvi: 1.04, rating: '一般价值' },
    ],
    parlayRecommendations: [
      { type: '高赔', selections: ['uru-cpv-2 平局保护', 'nzl-egy-2 埃及胜'], odds: 5.20, probability: 0.18, risk: 'High' },
    ],
    bankroll: {
      conservative: { allocations: { '胜平负': 40, '平局保护': 20, '大小球': 20, '比分': 10, '串关': 10 }, expectedReturn: 6 },
      balanced: { allocations: { '胜平负': 35, '比分': 15, '串关': 25, '大小球': 15, '平局保护': 10 }, expectedReturn: 10 },
      aggressive: { allocations: { '串关': 35, '比分': 25, '胜平负': 20, '大小球': 10, '平局保护': 10 }, expectedReturn: 22 },
    },
    factorBreakdown: { eloDiffScore: 0.60, recentFormScore: 0.50, h2hScore: 0.40, marketScore: 0.58, tacticalScore: 0.38, squadScore: 0.62, pressureScore: 0.45, psychologyScore: 0.55 },
    appliedLearnings: [
      { lesson: '首轮大巴策略有效性极高——佛得角0:0西班牙、库拉索0:0厄瓜多尔', adjustment: '佛得角防守评分额外+15点', impact: '下调' },
      { lesson: '非洲球队世界杯加成不可忽视——已连续多场验证', adjustment: '佛得角ELO隐性+100点', impact: '下调' },
      { lesson: '乌拉圭首轮1:1沙特暴露攻击乏力', adjustment: '乌拉圭进攻评分下调5点', impact: '下调' },
    ],
    confidenceAdjustment: '-0.12（佛得角大巴已验证难破+乌拉圭攻击力未验证，本场不确定性极高）',
  },
  'nzl-egy-2': {
    matchId: 'nzl-egy-2', homeWinProb: 0.10, drawProb: 0.22, awayWinProb: 0.68, over25Prob: 0.40, under25Prob: 0.60,
    predictedScore: '0:2', predictedDirection: 'away_win', confidence: 0.68, riskLevel: 'Low',
    top5Scores: [{score:'0:2',probability:0.20,quadrant:'Q1',reason:'Salah+Marmoush双核碾压新西兰防线'},{score:'0:1',probability:0.16,quadrant:'Q1',reason:'埃及控场小胜'},{score:'1:2',probability:0.12,quadrant:'Q1',reason:'NZ反击得分埃及仍胜'},{score:'0:3',probability:0.10,quadrant:'Q1',reason:'下半场埃及连进3球'},{score:'1:1',probability:0.10,quadrant:'Q2',reason:'NZ顽强逼平'}],
    riskWarnings: ['埃及预选赛6场0失球→防守铁壁', 'Salah+Marmoush攻击群→非洲最强锋线组合', 'NZ Elijah Just R1 2球→有反击威胁不可轻视'],
    quadrant: 'Q1', quadrantLabel: '强队碾压',
    mviAnalysis: [
      { bet: '埃及 -1', modelProb: 0.45, marketProb: 0.38, mvi: 1.18, rating: '高价值' },
      { bet: '小 2.5 球', modelProb: 0.60, marketProb: 0.55, mvi: 1.09, rating: '一般价值' },
      { bet: '埃及胜', modelProb: 0.70, marketProb: 0.65, mvi: 1.08, rating: '一般价值' },
    ],
    parlayRecommendations: [
      { type: '稳健', selections: ['nzl-egy-2 埃及胜', 'esp-ksa-2 西班牙胜'], odds: 2.15, probability: 0.58, risk: 'Low' },
      { type: '平衡', selections: ['nzl-egy-2 埃及胜', 'bel-irn-2 比利时胜', 'esp-ksa-2 西班牙胜'], odds: 3.50, probability: 0.35, risk: 'Medium' },
    ],
    bankroll: {
      conservative: { allocations: { '胜平负': 55, '比分': 10, '大小球': 25, '串关': 10 }, expectedReturn: 8 },
      balanced: { allocations: { '胜平负': 40, '比分': 20, '串关': 25, '大小球': 15 }, expectedReturn: 15 },
      aggressive: { allocations: { '比分': 30, '串关': 35, '胜平负': 20, '大小球': 15 }, expectedReturn: 28 },
    },
    factorBreakdown: { eloDiffScore: 0.78, recentFormScore: 0.82, h2hScore: 0.65, marketScore: 0.72, tacticalScore: 0.70, squadScore: 0.80, pressureScore: 0.52, psychologyScore: 0.62 },
    appliedLearnings: [
      { lesson: '埃及首轮1:1比利时证明防守+反击能力→实力远超ELO暗示', adjustment: '埃及攻击评分+10,Salah在关键战能力上调', impact: '上调' },
      { lesson: '新西兰首轮2:2伊朗靠Elijah Just个人能力→难以复制', adjustment: 'NZ进攻依赖单人→埃及防线针对性限制', impact: '上调' },
      { lesson: '非洲球队防守纪律已多次验证', adjustment: '埃及防守铁壁预期0失球', impact: '上调' },
    ],
    confidenceAdjustment: '+0.05（埃及整体实力已验证+新西兰单核依赖可限制）',
  },
  // ---- 6/23 第二轮 ----
  'arg-aut-2': {
    matchId: 'arg-aut-2', homeWinProb: 0.62, drawProb: 0.25, awayWinProb: 0.13, over25Prob: 0.58, under25Prob: 0.42,
    predictedScore: '2:1', predictedDirection: 'home_win', confidence: 0.68, riskLevel: 'Medium',
    top5Scores: [{score:'2:1',probability:0.20,quadrant:'Q1',reason:'阿根廷整体实力碾压但轮换后效率下降'},{score:'1:0',probability:0.17,quadrant:'Q1',reason:'双方均3分各自求稳'},{score:'1:1',probability:0.14,quadrant:'Q2',reason:'平局各自可接受+双方保存实力'},{score:'3:0',probability:0.12,quadrant:'Q1',reason:'Messi爆发能力'},{score:'0:0',probability:0.10,quadrant:'Q2',reason:'轮换混战双方默契球'}],
    mviAnalysis: [{bet:'阿根廷 -1',modelProb:0.45,marketProb:0.42,mvi:1.07,rating:'一般价值'},{bet:'大球 2.5',modelProb:0.58,marketProb:0.55,mvi:1.05,rating:'一般价值'},{bet:'1:0',modelProb:0.17,marketProb:0.20,mvi:0.85,rating:'无价值'}],
    parlayRecommendations: [
      { type: '稳健', selections: ['阿根廷胜', '法国胜'], odds: 1.60, probability: 0.53, risk: 'Low' },
      { type: '平衡', selections: ['阿根廷胜', '阿尔及利亚胜'], odds: 2.30, probability: 0.33, risk: 'Medium' },
    ],
    bankroll: { conservative:{allocations:{'胜平负':60,'大小球':25,'比分':10,'串关':5},expectedReturn:8}, balanced:{allocations:{'胜平负':45,'比分':25,'串关':15,'大小球':15},expectedReturn:18}, aggressive:{allocations:{'比分':35,'串关':30,'胜平负':20,'大小球':15},expectedReturn:35} },
    riskWarnings: ['Messi可能被轮换→攻击力下降但阿根廷整体仍强', '双方均3分，平局各自可接受→平局保护必要','奥地利Arnautovic关键→能给阿根廷制造麻烦'],
    quadrant: 'Q1', quadrantLabel: '强队碾压',
  },
  'fra-irq-2': {
    matchId: 'fra-irq-2', homeWinProb: 0.86, drawProb: 0.10, awayWinProb: 0.04, over25Prob: 0.68, under25Prob: 0.32,
    predictedScore: '3:0', predictedDirection: 'home_win', confidence: 0.85, riskLevel: 'Low',
    top5Scores: [{score:'3:0',probability:0.25,quadrant:'Q1',reason:'法国轮换仍碾压世界杯新军'},{score:'2:0',probability:0.20,quadrant:'Q1',reason:'伊拉克死守半场后崩盘'},{score:'4:0',probability:0.15,quadrant:'Q1',reason:'替补锋线刷数据'},{score:'1:0',probability:0.12,quadrant:'Q1',reason:'法国小胜求稳+保存体力'},{score:'2:1',probability:0.08,quadrant:'Q1',reason:'伊拉克终场前破门挽尊球'}],
    mviAnalysis: [{bet:'法国 -2.5',modelProb:0.62,marketProb:0.55,mvi:1.13,rating:'高价值'},{bet:'大球 3.5',modelProb:0.55,marketProb:0.50,mvi:1.10,rating:'一般价值'},{bet:'法国 -1.5',modelProb:0.78,marketProb:0.75,mvi:1.04,rating:'一般价值'}],
    parlayRecommendations: [
      { type: '稳健', selections: ['法国胜', '阿根廷胜'], odds: 1.60, probability: 0.53, risk: 'Low' },
      { type: '平衡', selections: ['法国胜', '大球 2.5'], odds: 1.85, probability: 0.58, risk: 'Medium' },
    ],
    bankroll: { conservative:{allocations:{'胜平负':60,'大小球':25,'比分':10,'串关':5},expectedReturn:10}, balanced:{allocations:{'胜平负':45,'比分':20,'串关':20,'大小球':15},expectedReturn:20}, aggressive:{allocations:{'串关':35,'比分':30,'胜平负':20,'大小球':15},expectedReturn:45} },
    riskWarnings: ['伊拉克首次世界杯经验不足→防守可能崩溃', '法国3分在手可能轮换→进球数可能低于预期'],
    quadrant: 'Q1', quadrantLabel: '强队碾压',
  },
  'nor-sen-2': {
    matchId: 'nor-sen-2', homeWinProb: 0.45, drawProb: 0.28, awayWinProb: 0.27, over25Prob: 0.55, under25Prob: 0.45,
    predictedScore: '2:1', predictedDirection: 'home_win', confidence: 0.55, riskLevel: 'High',
    top5Scores: [{score:'2:1',probability:0.16,quadrant:'Q3',reason:'Haaland终结能力+挪威主场气势'},{score:'1:1',probability:0.15,quadrant:'Q2',reason:'双方实力接近互有攻守'},{score:'1:2',probability:0.13,quadrant:'Q4',reason:'塞内加尔非洲韧性+挪威防守漏洞'},{score:'2:2',probability:0.12,quadrant:'Q2',reason:'对攻战双方各进2球'},{score:'1:0',probability:0.10,quadrant:'Q1',reason:'挪威小胜苟住出线形势'}],
    mviAnalysis: [{bet:'挪威胜',modelProb:0.45,marketProb:0.42,mvi:1.07,rating:'一般价值'},{bet:'大球 2.5',modelProb:0.55,marketProb:0.52,mvi:1.06,rating:'一般价值'},{bet:'塞内加尔胜',modelProb:0.27,marketProb:0.30,mvi:0.90,rating:'无价值'}],
    parlayRecommendations: [
      { type: '平衡', selections: ['挪威/塞内加尔 大球', '法国胜'], odds: 2.40, probability: 0.47, risk: 'Medium' },
    ],
    bankroll: { conservative:{allocations:{'胜平负':55,'大小球':25,'比分':15,'串关':5},expectedReturn:5}, balanced:{allocations:{'胜平负':40,'比分':25,'串关':20,'大小球':15},expectedReturn:15}, aggressive:{allocations:{'比分':35,'串关':30,'胜平负':20,'大小球':15},expectedReturn:30} },
    riskWarnings: ['塞内加尔必须赢→可能踢得更激进→大球概率上升', 'Haaland状态火热→挪威进球概率>85%', '非洲球队世界杯加成→塞内加尔被低估'],
    quadrant: 'Q3', quadrantLabel: '实力接近',
  },
  'jor-alg-2': {
    matchId: 'jor-alg-2', homeWinProb: 0.18, drawProb: 0.28, awayWinProb: 0.54, over25Prob: 0.52, under25Prob: 0.48,
    predictedScore: '0:2', predictedDirection: 'away_win', confidence: 0.62, riskLevel: 'Medium',
    top5Scores: [{score:'0:2',probability:0.18,quadrant:'Q4',reason:'阿尔及利亚实力明显占优'},{score:'0:1',probability:0.15,quadrant:'Q1',reason:'约旦密集防守限制比分'},{score:'1:1',probability:0.13,quadrant:'Q2',reason:'双方均0分各自抢1分'},{score:'0:3',probability:0.12,quadrant:'Q4',reason:'约旦防守全面崩溃'},{score:'1:2',probability:0.10,quadrant:'Q4',reason:'约旦挽回颜面球'}],
    mviAnalysis: [{bet:'阿尔及利亚胜',modelProb:0.54,marketProb:0.50,mvi:1.08,rating:'一般价值'},{bet:'大球 2.5',modelProb:0.52,marketProb:0.48,mvi:1.08,rating:'一般价值'},{bet:'阿尔及利亚 -1',modelProb:0.38,marketProb:0.40,mvi:0.95,rating:'无价值'}],
    parlayRecommendations: [
      { type: '稳健', selections: ['阿尔及利亚胜', '法国胜'], odds: 1.50, probability: 0.46, risk: 'Low' },
    ],
    bankroll: { conservative:{allocations:{'胜平负':60,'大小球':25,'比分':10,'串关':5},expectedReturn:10}, balanced:{allocations:{'胜平负':45,'比分':20,'串关':20,'大小球':15},expectedReturn:20}, aggressive:{allocations:{'串关':35,'比分':30,'胜平负':20,'大小球':15},expectedReturn:35} },
    riskWarnings: ['约旦近6场场均失2.6球→防守严重漏洞', '阿尔及利亚赛前4场零封→反弹潜力大', '双方均0分必须赢→输即出局'],
    quadrant: 'Q4', quadrantLabel: '弱队守不住',
  },
};

// ========== 赛后复盘 ==========
export const postMatchReviews: Record<string, PostMatchReview> = {
  'esp-cpv': {
    matchId: 'esp-cpv', hitItems: [], missItems: ['胜负方向(预测西班牙胜，实际平)', '比分(预测3:0，实际0:0)'],
    errorReasons: ['低估佛得角大巴能力', '48队赛制首轮平局溢价未纳入', '西班牙面对密集防守破局能力被高估'],
    optimizationSuggestions: ['首轮平局溢价权重 +1.3x', '强队低赔时(<1.50)平局概率系统性上调', '新参赛队首次世界杯动力 +1.2x'],
  },
  'bel-egy': {
    matchId: 'bel-egy', hitItems: [], missItems: ['胜负方向(预测比利时胜，实际平)', '比分(预测2:1，实际1:1)'],
    errorReasons: ['明知埃及历史克制比利时仍未给平局足够权重', '埃及0-0逼平西班牙的实力被低估'],
    optimizationSuggestions: ['已知风险必须体现在预测中', '非洲强队防守纪律需系统性上调'],
  },
  'ksa-uru': {
    matchId: 'ksa-uru', hitItems: [], missItems: ['胜负方向(预测乌拉圭胜，实际平)', '比分(预测0:2，实际1:1)'],
    errorReasons: ['热身赛惨败导致严重低估沙特', '世界杯正赛专注度完全不同'],
    optimizationSuggestions: ['热身赛惨败 ≠ 正赛无力，添加灰区判断'],
  },
  'irn-nzl': {
    matchId: 'irn-nzl', hitItems: [], missItems: ['胜负方向(预测伊朗胜，实际平)'],
    errorReasons: ['新西兰世界杯零胜的统计学陷阱导致低估'],
    optimizationSuggestions: ['历史数据不足时提高先验方差'],
  },
  'fra-sen': {
    matchId: 'fra-sen', hitItems: ['方向正确(法国胜)'], missItems: ['比分(预测2:1，实际3:1，差1球)'],
    errorReasons: [], optimizationSuggestions: [],
  },
  'irq-nor': {
    matchId: 'irq-nor', hitItems: ['方向正确(挪威胜)'], missItems: ['比分(预测0:3，实际1:4，差1球)'],
    errorReasons: [], optimizationSuggestions: [],
  },
  'arg-alg': {
    matchId: 'arg-alg', hitItems: ['方向正确(阿根廷胜)', '比分正确(3:0)🎯'], missItems: [],
    errorReasons: [], optimizationSuggestions: ['卫冕冠军状态火热时需放大权重'],
  },
  'aut-jor': {
    matchId: 'aut-jor', hitItems: ['方向正确(奥地利胜)'], missItems: ['比分(预测2:0，实际3:1，差1球)'],
    errorReasons: [], optimizationSuggestions: [],
  },
  'por-cod': {
    matchId: 'por-cod', hitItems: [], missItems: ['胜负方向❌（预测葡萄牙胜）', '比分预测❌（预测2:0，实际1:1）', 'BTTS预测❌（模型倾向No 62%，实际Yes）'],
    errorReasons: [
      '葡萄牙全场75%控球率但仅1次射正（射正率4%），伪控球陷阱虽未触发检查，但进攻转化率严重低于预期（预选赛场均3.3球→本场1球）',
      '刚果(金)角球战术效率超预期：补时阶段通过角球头球扳平，世界杯历史首球带来的士气加成低估了',
      '刚果(金)世界杯首秀(自1974年扎伊尔后重返)的精神动力——原设定1.2x加成不足以反映50年回归的额外心理因素',
      'C罗两次绝佳机会偏出，球星状态低于正常水平',
      'Joao Cancelo倒钩进球被VAR取消（越位），运气因素影响结果',
    ],
    optimizationSuggestions: [
      '首轮平局溢价基准从1.3x上调至1.4x',
      '世界杯新参赛队/久违回归队(>20年)士气加成从1.2x升至1.3x',
      '新增规则：控球率>70%且赛前射正/射门比<30%时，触发无效控球预警，主胜概率×0.9',
      'BTTS(双方进球)概率在首轮比赛中被系统性低估——首轮BTTS Yes率5/9=56%，远超预选赛平均40%',
    ],
    matchStats: {
      possession: { home: 75, away: 25 },
      shots: { home: 12, away: 4 },
      shotsOnTarget: { home: 1, away: 2 },
      xg: { home: 0.9, away: 0.3 },
      corners: { home: 7, away: 2 },
      cards: { home: { yellow: 2, red: 0 }, away: { yellow: 2, red: 0 } },
      scorers: [
        { player: 'João Neves', team: 'home', minute: 6 },
        { player: 'Yoane Wissa', team: 'away', minute: 45 },
      ],
    },
  },
  // ---- 6/18 赛后复盘 ----
  'eng-cro': {
    matchId: 'eng-cro',
    hitItems: [],
    missItems: ['方向错误（预测平局→实际英格兰4:2胜）', '比分错误（预测1:1→实际4:2）'],
    errorReasons: [
      '严重低估英格兰攻击力：预测平局过度依赖首轮平局趋势，忽略英格兰对阵克罗地亚的历史交锋优势',
      'Kane双响+Bellingham破门超出预期，中场创造力完全被低估',
      '克罗地亚高峰龄球员在32°C高温下确实下半场体能下降（预测正确）但英格兰火力太强',
    ],
    optimizationSuggestions: [
      '首轮后半程平局溢价权重需下调：前半程6平/12场 vs 后半程3平/12场，模型应区分首轮前半段和后半段',
      '主场/准主场队伍（如英格兰在达拉斯AT&T球场）攻击加成因子上调至1.2x',
      '历史交锋中英格兰对克罗地亚3胜2平优势被忽视，权重应提升',
    ],
  },
  'gha-pan': {
    matchId: 'gha-pan',
    hitItems: ['比赛过程判断部分正确（低比分、焦灼）'],
    missItems: ['方向错误（预测平局→实际加纳1:0胜）', '比分错误（预测1:1→实际1:0）'],
    errorReasons: [
      '加纳FIFA排名#74低于巴拿马#33，但非洲球队的大赛基因被市场低估',
      'Yirenkyi补时绝杀属于随机事件，预测1:1在90分钟时仍然成立',
      '赔率市场给出平局概率最高但实际结果偏向主场签队伍',
    ],
    optimizationSuggestions: [
      'FIFA排名在世界杯正赛中的权重应下调，非洲球队大赛基因加分',
      'L组首场比赛分析中应参考K组（葡萄牙1:1刚果）的"伪强队"现象',
    ],
  },
  'uzb-col': {
    matchId: 'uzb-col',
    hitItems: ['方向正确（预测哥伦比亚胜）', '比分走势正确（哥伦比亚实力优势明显）'],
    missItems: ['比分错误（预测0:2→实际1:3）', '乌兹别克进球超出预期'],
    errorReasons: [
      '低估乌兹别克高原适应能力：中亚球队海拔适应优于南美球队的假设被验证',
      '预测Cannavaro防线4场失2球，但实际哥伦比亚Diaz攻击力远强乌兹别克预选赛对手',
      '比分差3-1大于0-2，说明攻防两端均被低估',
    ],
    optimizationSuggestions: [
      '高原因素对双方影响对称（预测正确），但南美强队在高原的体能优势被低估',
      'Diaz级别边锋对亚洲防线破坏力加权上调至+0.5球',
    ],
  },
  // ========== 6/19 第二轮复盘 ==========
  'cze-rsa-2': {
    matchId: 'cze-rsa-2',
    hitItems: ['比分正确（1:1在TOP5第三位🎯）'],
    missItems: ['方向错误（预测捷克胜→实际1:1平）'],
    errorReasons: [
      'A组出线生死战双方极度保守，捷克Soucek+Schick中场控制未转化为进球',
      '南非定位球破局+防守纪律远超FIFA排名所暗示（首轮仅0:2负墨西哥但防守端组织有序）',
      '48队赛制下第二轮平局概率延续（A组两场均分出胜负但B组继续平局）',
    ],
    optimizationSuggestions: [
      '第二轮出线生死战保守趋势需纳入战术分析',
      '非洲球队第二轮防守纪律系统性上调',
    ],
  },
  'sui-bih-2': {
    matchId: 'sui-bih-2',
    hitItems: [],
    missItems: ['方向错误（预测平局→实际瑞士4:1胜）', '比分严重偏差（预测1:1→实际4:1）'],
    errorReasons: [
      '严重低估瑞士攻击力：首轮1:1卡塔尔造成瑞士"攻击乏力"的错觉，但第二轮面对波黑暴露真实火力',
      '波黑世界杯首秀首轮逼平加拿大后，第二轮体能+经验双重劣势暴露——Dzeko（38岁）下半场完全失位',
      'Xhaka+Shaqiri在第二轮中前场连接效率远超首轮（首轮0助攻→次轮3助攻）',
    ],
    optimizationSuggestions: [
      '首轮表现对欧洲强队的评估权重应下调（首轮求稳≠真实实力）',
      '世界杯经验差（连续6届 vs 首次参赛）在第二轮扩大效应需上调权重',
    ],
  },
  'can-qat-2': {
    matchId: 'can-qat-2',
    hitItems: ['方向正确（加拿大胜✓）', '过程判断正确（加拿大主场优势+下半场发力）'],
    missItems: ['比分严重偏差（预测2:1→实际6:0）'],
    errorReasons: [
      '卡塔尔首轮逼平瑞士的"亚洲杯冠军溢价"被严重高估，实际瑞士自误而非卡塔尔强大',
      '加拿大主场连续作战（多伦多→温哥华）体能优势远超预期',
      'Davies+David+Larin三叉戟同时爆发（合进5球），攻击效率远超预选赛数据',
    ],
    optimizationSuggestions: [
      '亚洲球队vs中北美球队实力差应区分西亚vs东亚，非东亚亚洲球队需打折评估',
      '连续主场作战体能溢价从1.1x上调至1.2x（加拿大已验证）',
    ],
  },
  'mex-kor-2': {
    matchId: 'mex-kor-2',
    hitItems: ['方向正确（墨西哥胜✓）', '比分正确（1:0在TOP5第三位🎯）'],
    missItems: [],
    errorReasons: ['预测几乎完美命中，无重大偏差'],
    optimizationSuggestions: [
      '墨西哥主场海拔优势（Guadalajara 1500m）+韩国跨地旅行疲劳的判断被验证正确',
      'A组实力梯度判断基本准确：墨西哥>韩国>捷克>南非',
    ],
  },
  // ========== 6/20 第二轮复盘 ==========
  'usa-aus-2': {
    matchId: 'usa-aus-2',
    hitItems: ['方向正确（美国胜）', '比分正确（2:0🎯）'],
    missItems: [],
    errorReasons: ['预测几乎完美命中'],
    optimizationSuggestions: ['主场优势在第二轮延续有效（Lumen Field 69k观众）'],
  },
  'sco-mar-2': {
    matchId: 'sco-mar-2',
    hitItems: ['方向正确（摩洛哥胜）', '比分正确（0:1🎯）'],
    missItems: [],
    errorReasons: ['预测精准命中'],
    optimizationSuggestions: ['非洲球队大赛基因系统性上调得到验证'],
  },
  'bra-hai-2': {
    matchId: 'bra-hai-2',
    hitItems: ['方向正确（巴西胜）', '比分正确（3:0🎯）'],
    missItems: [],
    errorReasons: ['预测精准命中'],
    optimizationSuggestions: ['强队憋怒后次轮爆发模式被验证（巴西首轮平摩洛哥→次轮3:0）'],
  },
  'tur-par-2': {
    matchId: 'tur-par-2',
    hitItems: [],
    missItems: ['方向错误（预测土耳其胜→实际0:1巴拉圭胜）', '比分错误（预测2:0→实际0:1）'],
    errorReasons: [
      '严重低估巴拉圭反弹能力：首轮1:4惨败美国后，次轮防守纪律全面改善',
      '土耳其主场预测过度乐观：首轮0:2输澳洲已暴露防线问题，次轮未调整预期',
      '首轮惨败队伍的"触底反弹"效应未被模型捕捉——连续第二个案例',
    ],
    optimizationSuggestions: [
      '首轮惨败(失球≥3)队伍第二轮反弹溢价上调至1.3x',
      '土耳其防线漏洞需作为持续性风险而非一次性事件',
      '第二轮士气逆转因子需新增独立权重',
    ],
    matchStats: {
      possession: { home: 58, away: 42 },
      shots: { home: 10, away: 8 },
      shotsOnTarget: { home: 3, away: 4 },
      xg: { home: 0.8, away: 1.1 },
      corners: { home: 6, away: 3 },
      cards: { home: { yellow: 3, red: 0 }, away: { yellow: 2, red: 0 } },
      scorers: [
        { player: 'Miguel Almiron', team: 'away', minute: 62 },
      ],
    },
  },
  // ---- 6/21 复盘 ----
  'ned-swe-2': {
    matchId: 'ned-swe-2',
    hitItems: ['方向正确（荷兰胜）', '大球方向正确'],
    missItems: ['比分偏差大（预测2:1，实际5:1，净胜差3球）'],
    errorReasons: [
      '严重低估荷兰攻击力——Gakpo+Depay+Malen三叉戟爆发被首轮2:2日本的表现掩盖',
      '瑞典1:5惨败后防线信心彻底崩溃而非触底反弹，与巴拉圭反弹案例相反',
      '首轮惨败队伍的两种极端走向（反弹vs崩溃）未能有效区分',
    ],
    optimizationSuggestions: [
      '首轮惨败队伍需区分两种路径：实力型反弹（巴拉圭）vs信心崩溃型（瑞典）',
      '荷兰攻击群评分需上调，Gakpo+Depay双核至少+15攻击力',
      '引入"防线信心指数"因子，首轮失球≥4的队伍次轮继续失球概率+20%',
    ],
    matchStats: {
      possession: { home: 58, away: 42 },
      shots: { home: 18, away: 7 },
      shotsOnTarget: { home: 9, away: 3 },
      xg: { home: 3.2, away: 0.7 },
      corners: { home: 8, away: 3 },
      cards: { home: { yellow: 1, red: 0 }, away: { yellow: 2, red: 0 } },
      scorers: [
        { player: 'Cody Gakpo', team: 'home', minute: 12 },
        { player: 'Memphis Depay', team: 'home', minute: 28 },
        { player: 'Alexander Isak', team: 'away', minute: 45 },
        { player: 'Donyell Malen', team: 'home', minute: 55 },
        { player: 'Cody Gakpo', team: 'home', minute: 72 },
        { player: 'Memphis Depay', team: 'home', minute: 84 },
      ],
    },
  },
  'ger-civ-2': {
    matchId: 'ger-civ-2',
    hitItems: ['方向正确（德国胜）', '大球方向正确'],
    missItems: ['比分偏差1球（预测3:0，实际2:1）'],
    errorReasons: [
      '低估科特迪瓦进攻能力——首轮1:0胜厄瓜多尔表现被7:1大胜德国的光环掩盖',
      '德国轻敌心态明显，前30分钟未进球反而被科特迪瓦反击得分',
      '穿盘预测（-2）过于激进，德国第二轮与首轮差距大（7:1 vs 2:1）',
    ],
    optimizationSuggestions: [
      '首轮大胜后次轮进球数预期下调1.5球',
      'ELO差>400时穿盘概率上限设为65%',
      '次轮强队不穿盘因子增加+10%权重',
    ],
    matchStats: {
      possession: { home: 62, away: 38 },
      shots: { home: 16, away: 9 },
      shotsOnTarget: { home: 7, away: 4 },
      xg: { home: 2.4, away: 1.0 },
      corners: { home: 7, away: 4 },
      cards: { home: { yellow: 1, red: 0 }, away: { yellow: 3, red: 0 } },
      scorers: [
        { player: 'Sebastien Haller', team: 'away', minute: 22 },
        { player: 'Jamal Musiala', team: 'home', minute: 41 },
        { player: 'Kai Havertz', team: 'home', minute: 68 },
      ],
    },
  },
  'ecu-cuw-2': {
    matchId: 'ecu-cuw-2',
    hitItems: [],
    missItems: ['方向错误（预测厄瓜多尔胜，实际0:0平）', '比分完全错误（预测3:0）'],
    errorReasons: [
      '高估厄瓜多尔终结能力——库拉索7后卫大巴完全奏效',
      '库拉索1:7德国后痛定思痛，教练临场战术调整远超预期',
      '厄瓜多尔保平出线的积分形势导致进攻投入不足',
      '首轮惨败后选择大巴而非崩溃——第三种路径未被模型捕捉',
    ],
    optimizationSuggestions: [
      '首轮惨败三路径：反弹(巴拉圭)、崩溃(瑞典)、大巴(库拉索)',
      '出线已稳队伍进攻保守溢价上调至1.3x',
      'FIFA排名差>40弱队大巴时平局概率上调+15%',
      '厄瓜多尔进攻评分需下调（面对弱队大巴终结能力不足）',
    ],
    matchStats: {
      possession: { home: 68, away: 32 },
      shots: { home: 14, away: 3 },
      shotsOnTarget: { home: 3, away: 1 },
      xg: { home: 1.0, away: 0.2 },
      corners: { home: 9, away: 2 },
      cards: { home: { yellow: 2, red: 0 }, away: { yellow: 4, red: 0 } },
      scorers: [],
    },
  },
  'tun-jpn-2': {
    matchId: 'tun-jpn-2',
    hitItems: ['方向正确（日本胜）', '大球方向正确'],
    missItems: ['比分偏差（预测1:2，实际0:4，低估日本进攻2球）'],
    errorReasons: [
      '低估日本攻击力对弱队的碾压能力',
      '突尼斯换帅后防线毫无改善，从1:5到0:4',
      '上半场落后即战术放弃——心理崩盘因子未纳入',
    ],
    optimizationSuggestions: [
      '日本面对FIFA排名40+球队攻击预期+0.8球',
      '换帅混乱持续性因子延长至2场',
      '落后时球队心理评级——投降型vs反抗型',
    ],
    matchStats: {
      possession: { home: 35, away: 65 },
      shots: { home: 6, away: 20 },
      shotsOnTarget: { home: 2, away: 10 },
      xg: { home: 0.4, away: 3.6 },
      corners: { home: 2, away: 8 },
      cards: { home: { yellow: 3, red: 1 }, away: { yellow: 0, red: 0 } },
      scorers: [
        { player: 'Takefusa Kubo', team: 'away', minute: 18 },
        { player: 'Kaoru Mitoma', team: 'away', minute: 52 },
        { player: 'Ritsu Doan', team: 'away', minute: 67 },
        { player: 'Takefusa Kubo', team: 'away', minute: 83 },
      ],
    },
  },
};

// ========== 预测富数据（因子分析+历史教训） ==========
import type { FactorBreakdown, AppliedLearning, FactorEvaluation, EloChange } from '../lib/types'

export const predictionRichData: Record<string, { factorBreakdown: FactorBreakdown; appliedLearnings: AppliedLearning[]; confidenceAdjustment: string }> = {
  'por-cod': {
    factorBreakdown: { eloDiffScore: 0.85, recentFormScore: 0.78, h2hScore: 0.70, marketScore: 0.80, tacticalScore: 0.55, squadScore: 0.75, pressureScore: 0.40, psychologyScore: 0.60 },
    appliedLearnings: [
      { lesson: '伪强队识别：赔率<1.50时平局溢价1.4x', adjustment: '葡萄牙赔率仅1.35 → 已上调平局概率至22%（但实际仍低估）', impact: '上调' },
      { lesson: '非洲球队大赛基因被系统性低估', adjustment: '刚果(金)50年回归世界杯精神动力+10%', impact: '上调' },
    ],
    confidenceAdjustment: '-0.10（48队赛制首轮求稳倾向强，高位控球球队进球转化率被系统性高估）',
  },
  'arg-alg': {
    factorBreakdown: { eloDiffScore: 0.92, recentFormScore: 0.88, h2hScore: 0.65, marketScore: 0.82, tacticalScore: 0.70, squadScore: 0.85, pressureScore: 0.45, psychologyScore: 0.55 },
    appliedLearnings: [
      { lesson: '卫冕冠军首场动力充足但压力并存', adjustment: '下调主场优势溢价0.5x（Arrowhead中立场地），上调攻击效率+15%', impact: '上调' },
    ],
    confidenceAdjustment: '+0.05（两队实力差显著，梅西+劳塔罗组合状态火热）',
  },
  'sui-bih-2': {
    factorBreakdown: { eloDiffScore: 0.60, recentFormScore: 0.45, h2hScore: 0.50, marketScore: 0.58, tacticalScore: 0.42, squadScore: 0.55, pressureScore: 0.35, psychologyScore: 0.65 },
    appliedLearnings: [
      { lesson: '首轮表现对欧洲强队的评估权重应下调（首轮求稳≠真实实力）', adjustment: '瑞士首轮1:1卡塔尔造成攻击乏力假象 → 下调平局倾向10%', impact: '上调' },
      { lesson: '世界杯经验差在第二轮扩大效应', adjustment: '波黑首次世界杯 vs 瑞士连续6届 → 上调瑞士优势', impact: '下调' },
    ],
    confidenceAdjustment: '-0.12（首轮表现迷惑性强，真实实力差被首轮结果掩盖）',
  },
  'can-qat-2': {
    factorBreakdown: { eloDiffScore: 0.55, recentFormScore: 0.50, h2hScore: 0.45, marketScore: 0.52, tacticalScore: 0.60, squadScore: 0.55, pressureScore: 0.30, psychologyScore: 0.70 },
    appliedLearnings: [
      { lesson: '首轮爆冷队伍第二轮真实实力暴露', adjustment: '卡塔尔首轮平瑞士被严重过誉 → 下调卡塔尔竞争力20%', impact: '上调' },
      { lesson: '连续主场作战体能溢价', adjustment: '加拿大从多伦多到温哥华连续主场 → +10%攻防效率', impact: '上调' },
    ],
    confidenceAdjustment: '-0.08（两队首轮表现均有欺骗性，真实实力差被首轮结果模糊）',
  },
  'mex-kor-2': {
    factorBreakdown: { eloDiffScore: 0.72, recentFormScore: 0.68, h2hScore: 0.60, marketScore: 0.65, tacticalScore: 0.70, squadScore: 0.72, pressureScore: 0.55, psychologyScore: 0.48 },
    appliedLearnings: [
      { lesson: '海拔+旅途疲劳判断已验证正确（墨西哥1:0韩国）', adjustment: 'Guadalajara 1500m海拔 → 墨西哥体能溢价+10%，韩国跨地疲劳-10%', impact: '上调' },
    ],
    confidenceAdjustment: '+0.05（海拔因素判断准确，A组实力梯度清晰）',
  },
};

// ========== 复盘富数据（ELO变化+根因+因子评估） ==========
export const reviewRichData: Record<string, { rootCause: string; factorEvaluation: FactorEvaluation; eloChanges: EloChange[] }> = {
  'por-cod': {
    rootCause: '葡萄牙全场75%控球率但仅1次射正——模型的"伪控球陷阱"在葡萄牙身上表现突出。高控球+低射正率本质上应触发强队概率修正，但由于预选赛场均3.3球的惯性，模型未下调葡萄牙攻击效率预期。刚果(金)的50年回归精神动力被低估（原1.2x → 应1.3x）',
    factorEvaluation: { eloPrediction: '偏高', recentFormPrediction: '偏高', h2hPrediction: '准确', marketOddsPrediction: '准确', tacticalMatchupPrediction: '偏低' },
    eloChanges: [
      { team: 'Portugal', oldElo: 1980, newElo: 1965, change: -15 },
      { team: 'DR Congo', oldElo: 1550, newElo: 1570, change: 20 },
    ],
  },
  'arg-alg': {
    rootCause: '实力悬殊的比赛模型表现出色。ELO差值（阿根廷2050 vs 阿尔及利亚1650=400分）完美映射了3:0的比分。唯一小幅偏差在于以为阿尔及利亚能进1球（被零封），需微调非洲球队面对顶级防守时的进攻折损率。',
    factorEvaluation: { eloPrediction: '准确', recentFormPrediction: '准确', h2hPrediction: '准确', marketOddsPrediction: '准确', tacticalMatchupPrediction: '准确' },
    eloChanges: [
      { team: 'Argentina', oldElo: 2050, newElo: 2065, change: 15 },
      { team: 'Algeria', oldElo: 1650, newElo: 1635, change: -15 },
    ],
  },
  'sui-bih-2': {
    rootCause: '首轮表现的系统性误导是最核心问题。瑞士1:1卡塔尔创造了"瑞士攻击乏力"的假象，但卡塔尔是亚洲强队而非鱼腩。波黑世界杯首秀（Dzeko 38岁高龄）第二轮体能崩溃是本场最大变量，模型未能捕捉"首秀球队第二轮体能断崖"这一模式。',
    factorEvaluation: { eloPrediction: '偏低', recentFormPrediction: '偏低', h2hPrediction: '偏低', marketOddsPrediction: '偏低', tacticalMatchupPrediction: '偏低' },
    eloChanges: [
      { team: 'Switzerland', oldElo: 1880, newElo: 1900, change: 20 },
      { team: 'Bosnia', oldElo: 1700, newElo: 1670, change: -30 },
    ],
  },
  'can-qat-2': {
    rootCause: '卡塔尔被首轮逼平瑞士的表现严重过誉。实际是瑞士自误（红牌+点球）而非卡塔尔真正强大。模型对亚洲球队的评估未区分东亚vs西亚——卡塔尔作为西亚球队面对中北美主场强势的加拿大差距被低估。连续主场作战体能溢价也需上调。',
    factorEvaluation: { eloPrediction: '偏低', recentFormPrediction: '偏低', h2hPrediction: '准确', marketOddsPrediction: '偏低', tacticalMatchupPrediction: '准确' },
    eloChanges: [
      { team: 'Canada', oldElo: 1750, newElo: 1780, change: 30 },
      { team: 'Qatar', oldElo: 1600, newElo: 1550, change: -50 },
    ],
  },
  'mex-kor-2': {
    rootCause: '预测几乎完美命中。海拔+旅途疲劳+实力梯度三重判断均被比赛结果验证。墨西哥在中北美1500m主场的体能优势、韩国跨太平洋+跨美国大陆再入墨西哥的旅途消耗，以及两队真实实力差（ELO差>100分），三者叠加产生1:0的精确结果。',
    factorEvaluation: { eloPrediction: '准确', recentFormPrediction: '准确', h2hPrediction: '准确', marketOddsPrediction: '准确', tacticalMatchupPrediction: '准确' },
    eloChanges: [
      { team: 'Mexico', oldElo: 1900, newElo: 1910, change: 10 },
      { team: 'South Korea', oldElo: 1780, newElo: 1765, change: -15 },
    ],
  },
};

export const keyLearnings = [
  '第二轮加拿大6:0卡塔尔揭示：首轮爆冷队伍第二轮真实实力暴露',
  '瑞士4:1波黑揭示：世界杯经验差在第二轮被放大',
  '墨西哥1:0韩国验证：海拔+旅途疲劳判断正确',
  '土耳其0:1巴拉圭揭示：首轮惨败反弹溢价1.3x',
  '首轮惨败队伍三路径分类：反弹(巴拉圭) vs 崩溃(瑞典1:5→1:5) vs 大巴(库拉索1:7→0:0)',
  '荷兰攻击群严重低估：Gakpo+Depay+Malen三叉戟爆发→≥2核心队进攻溢价上调',
  '首轮大胜后次轮进球下调1.5球：德国7:1→2:1为典型案例',
  '出线已稳队伍进攻保守溢价1.3x：厄瓜多尔保平即出线→0:0库拉索',
  '日本面对FIFA排名40+球队攻击预期+0.8球：0:4突尼斯验证',
  '换帅混乱持续性因子延长至2场：突尼斯1:5→0:4',
  'R1回溯：12场首轮比赛复盘完成——ELO差>250强主胜85%准确（墨西哥2-0、德国7-1、瑞典5-1），ELO差<30按50/50（韩国2-1正确，荷兰2-2正确）',
  '东道主效应：卡塔尔1-1瑞士揭示ELO差>300+东道主=强制冷平警告，不能仅靠ELO差做预测',
  '摩洛哥/塞内加尔非洲强队ELO需全面上调30-50点：巴西1-1摩洛哥并非偶然，2022世界杯四强底蕴',
  '首轮>4球屠杀后第二轮防守升级1.3x：库拉索1-7→0-0厄瓜多尔、德国7-1→2-1象牙海岸均验证',
  '首轮溃败队伍第二轮反弹分类：巴拉圭型(反弹胜)、突尼斯型(继续崩溃)、库拉索型(死守大巴)',
  '换帅混乱持续性≥2场验证：突尼斯1-5瑞典→0-4日本，混乱因子不可低估',
  'R1全部36场完赛数据：平局率30.6%(11/36)，ELO从未低于2400（最高1957葡萄牙），世界杯无超级强队',
  '世界杯首秀球队防守投入被低估：海地0-1苏格兰、库拉索0-0厄瓜多尔均为典型',
  '亚洲球队美洲世界杯适应性差异：日本+10(不败)、韩国+10(2胜)、澳大利亚+20(2-0土耳其)',
  '加拿大6-0卡塔尔+1-1波黑揭示两极分化：对弱旅碾压、对韧性队攻不下',
  // --- 6/23 复盘新增 ---
  '[eloDiff] 第二轮ELO差>300分的比赛(法国vs伊拉克): 方向+比分双100%准确。此类差距的强队主场置信度可上调至88%基线。',
  '[tacticalMatchup] Haaland因子: 拥有世界级终结者的球队在生死战中胜率远超ELO预期。第二轮淘汰边缘战+顶级射手=平局概率系统性下调10%。',
  '[eloDiff] 阿根廷进攻意愿衰减: 面对已淘汰边缘对手, 2-0后收力不施压。强队领先即收力因子应从次轮起引入。',
  '[recentForm] 世界杯新军荣誉进球效应: 约旦在淘汰战中先破门阿尔及利亚。弱队在最后一搏中存在+0.3球的尊严溢价。',
  '[tacticalMatchup] 非洲球队防守系统性高估(第5次复现): 塞内加尔被灌3球。非洲球队def评分应全体×0.85世界杯惩罚系数。',
  '[eloDiff] 暴雨天气对比赛节奏影响显著, 但强队适应力远超弱队——实际进球=预期进球, 天气因子对强队影响<对弱队影响。',
];