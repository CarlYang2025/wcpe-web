#!/usr/bin/env node
/**
 * FBref HTML 解析器 —— 从 FBref 比赛页面的 HTML 提取赛后统计数据
 * 
 * 此脚本不直接发 HTTP 请求（FBref 有 Cloudflare 防护）。
 * 数据采集通过 WorkBuddy WebFetch 工具完成，此脚本负责解析。
 *
 * 用法:
 *   # 从文件读取 HTML
 *   node scripts/parse-fbref.mjs --html match.html --id mex-rsa
 *
 *   # 从 stdin 读取
 *   cat match.html | node scripts/parse-fbref.mjs --stdin --id mex-rsa
 *
 *   # 批量解析目录下所有 HTML
 *   node scripts/parse-fbref.mjs --dir ./fbref-html/ --output stats.json
 *
 * 输出: JSON 格式的 matchStats
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

// ========== HTML 解析核心 ==========

function extractCellValue(cellHtml) {
  const text = cellHtml.replace(/<[^>]+>/g, '').trim();
  const num = parseFloat(text);
  if (!isNaN(num)) return num;
  const pctMatch = text.match(/([\d.]+)\s*%/);
  if (pctMatch) return parseFloat(pctMatch[1]);
  return text;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#x27;/g, "'").trim();
}

/**
 * 从 FBref 比赛页面 HTML 提取 Team Stats 表格
 */
function parseTeamStats(html) {
  const stats = {};

  // 定位到 Team Stats 区域
  const tsIdx = html.indexOf('Team Stats');
  if (tsIdx === -1) return stats;

  const snippet = html.substring(tsIdx, tsIdx + 20000);

  // FBref 结构: <th scope="row">Stat Name</th><td>Home</td><td>Away</td>
  const rowRegex = /<th[^>]*scope="row"[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let rm;
  while ((rm = rowRegex.exec(snippet)) !== null) {
    const label = stripTags(rm[1]);
    const homeVal = extractCellValue(rm[2]);
    const awayVal = extractCellValue(rm[3]);
    if (label) {
      stats[label] = { home: homeVal, away: awayVal };
    }
  }

  return stats;
}

/**
 * 从 Team Stats 原始数据映射为标准字段
 */
function normalizeStats(rawStats, html) {
  const s = {
    possession: { home: 0, away: 0 },
    shots: { home: 0, away: 0 },
    shotsOnTarget: { home: 0, away: 0 },
    corners: { home: 0, away: 0 },
    fouls: { home: 0, away: 0 },
    cards: { home: { yellow: 0, red: 0 }, away: { yellow: 0, red: 0 } },
    offsides: { home: 0, away: 0 },
    passes: { home: 0, away: 0 },
    passCompletion: { home: 0, away: 0 },
    saves: { home: 0, away: 0 },
    tackles: { home: 0, away: 0 },
    interceptions: { home: 0, away: 0 },
    crosses: { home: 0, away: 0 },
    xg: { home: 0, away: 0 },
  };

  // 字段映射
  for (const [rawLabel, rawVal] of Object.entries(rawStats)) {
    const low = rawLabel.toLowerCase();

    if (low.includes('possession')) {
      s.possession = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if ((low.includes('shot') || low.includes('shot')) && low.includes('target')) {
      s.shotsOnTarget = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if (low.includes('total shot') || low === 'shots') {
      s.shots = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if (low.includes('corner')) {
      s.corners = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if (low.includes('foul')) {
      s.fouls = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if (low.includes('offside')) {
      s.offsides = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if (low.includes('save')) {
      s.saves = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if (low.includes('pass comp')) {
      s.passCompletion = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if (low.includes('pass')) {
      s.passes = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if (low.includes('tackle')) {
      s.tackles = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if (low.includes('intercept')) {
      s.interceptions = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if (low.includes('cross')) {
      s.crosses = { home: num(rawVal.home), away: num(rawVal.away) };
    } else if (low.includes('yellow')) {
      s.cards.home.yellow = num(rawVal.home);
      s.cards.away.yellow = num(rawVal.away);
    } else if (low.includes('red')) {
      s.cards.home.red = num(rawVal.home);
      s.cards.away.red = num(rawVal.away);
    }
  }

  // 从注释中提取 xG
  const xgMatch = html.match(/Expected Goals[^<]*?([\d.]+)[\s\S]{0,300}?([\d.]+)/i);
  if (xgMatch) {
    s.xg = { home: parseFloat(xgMatch[1]) || 0, away: parseFloat(xgMatch[2]) || 0 };
  }

  // 特殊处理：FBref 有时在 tfoot 中汇总 Shots on Target
  // 如果 shotsOnTarget 为 0 但 shots 有值，可能需要备选解析
  if (s.shotsOnTarget.home === 0 && s.shotsOnTarget.away === 0 && s.shots.home > 0) {
    // 尝试从文本描述中提取 "X of Y" 格式
    const sotMatch = html.match(/Shots on Target[^<]*?(\d+)\s*of\s*(\d+)[^<]*?(\d+)\s*of\s*(\d+)/i);
    if (sotMatch) {
      s.shotsOnTarget = { home: parseInt(sotMatch[1]), away: parseInt(sotMatch[3]) };
      if (s.shots.home === 0) s.shots = { home: parseInt(sotMatch[2]), away: parseInt(sotMatch[4]) };
    }
  }

  return s;
}

function num(v) { return typeof v === 'number' ? v : parseFloat(v) || 0; }

/**
 * 完整解析：HTML → 标准化 matchStats
 */
function parseMatchHTML(html, matchId) {
  const rawStats = parseTeamStats(html);
  const stats = normalizeStats(rawStats, html);
  return {
    matchId,
    ...stats,
    _rawFields: Object.keys(rawStats),
  };
}

// ========== matches.ts 嵌入逻辑 ==========

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatStatsTS(stats) {
  const s = stats;
  const h = (v) => (typeof v === 'number' ? v : 0);
  return `{
    possession: { home: ${h(s.possession?.home)}, away: ${h(s.possession?.away)} },
    shots: { home: ${h(s.shots?.home)}, away: ${h(s.shots?.away)} },
    shotsOnTarget: { home: ${h(s.shotsOnTarget?.home)}, away: ${h(s.shotsOnTarget?.away)} },
    corners: { home: ${h(s.corners?.home)}, away: ${h(s.corners?.away)} },
    fouls: { home: ${h(s.fouls?.home)}, away: ${h(s.fouls?.away)} },
    cards: { home: { yellow: ${h(s.cards?.home?.yellow)}, red: ${h(s.cards?.home?.red)} }, away: { yellow: ${h(s.cards?.away?.yellow)}, red: ${h(s.cards?.away?.red)} } },
    offsides: { home: ${h(s.offsides?.home)}, away: ${h(s.offsides?.away)} },
    passes: { home: ${h(s.passes?.home)}, away: ${h(s.passes?.away)} },
    passCompletion: { home: ${h(s.passCompletion?.home)}, away: ${h(s.passCompletion?.away)} },
    saves: { home: ${h(s.saves?.home)}, away: ${h(s.saves?.away)} },
    tackles: { home: ${h(s.tackles?.home)}, away: ${h(s.tackles?.away)} },
    interceptions: { home: ${h(s.interceptions?.home)}, away: ${h(s.interceptions?.away)} },
    crosses: { home: ${h(s.crosses?.home)}, away: ${h(s.crosses?.away)} },
    xg: { home: ${h(s.xg?.home)}, away: ${h(s.xg?.away)} }
  }`;
}

function injectStats(matchesPath, allStats) {
  let content = readFileSync(matchesPath, 'utf-8');

  for (const [matchId, stats] of Object.entries(allStats)) {
    if (!stats) continue;
    const pattern = new RegExp(
      `(id:\\s*'${escapeRegex(matchId)}'[\\s\\S]*?status:\\s*'finished'[^,\\n]*)`,
      'g'
    );
    content = content.replace(pattern, `$1,\n    matchStats: ${formatStatsTS(stats)}`);
  }

  return content;
}

// ========== 命令行 ==========

async function main() {
  const args = process.argv.slice(2);
  let htmlInput = null;
  let matchId = null;
  let dirInput = null;
  let outputFile = null;
  let writeMatches = false;
  const MATCHES_PATH = resolve(process.cwd(), 'src/data/matches.ts');

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--html': htmlInput = resolve(args[++i]); break;
      case '--id': matchId = args[++i]; break;
      case '--stdin': htmlInput = 'stdin'; break;
      case '--dir': dirInput = resolve(args[++i]); break;
      case '--output': outputFile = resolve(args[++i]); break;
      case '--write-matches': writeMatches = true; break;
      case '--matches-path': /* deprecated, always uses default */ args[i++]; break;
    }
  }

  if (!htmlInput && !dirInput) {
    console.error('用法: --html <file> --id <match_id> | --dir <html_dir> | --stdin --id <match_id>');
    console.error('可选: --output <json_file> --write-matches');
    process.exit(1);
  }

  const allResults = {};

  if (htmlInput) {
    // 单文件模式
    const html = htmlInput === 'stdin'
      ? readFileSync(0, 'utf-8')
      : readFileSync(htmlInput, 'utf-8');

    if (!matchId) {
      // 尝试从文件名提取 matchId
      const fn = htmlInput.split('/').pop().replace('.html', '');
      matchId = fn;
    }

    const result = parseMatchHTML(html, matchId);
    allResults[matchId] = result;
    console.log(JSON.stringify(result, null, 2));
  }

  if (dirInput) {
    // 目录批量模式: 文件名即 matchId
    const files = readdirSync(dirInput).filter(f => f.endsWith('.html'));
    for (const file of files) {
      const mid = file.replace('.html', '');
      const html = readFileSync(resolve(dirInput, file), 'utf-8');
      const result = parseMatchHTML(html, mid);
      allResults[mid] = result;
      console.log(`${mid}: 控球 ${result.possession?.home}%-${result.possession?.away}% | 射门 ${result.shots?.home}-${result.shots?.away} | 射正 ${result.shotsOnTarget?.home}-${result.shotsOnTarget?.away}`);
    }
  }

  // 输出 JSON
  if (outputFile || Object.keys(allResults).length > 1) {
    const outPath = outputFile || resolve(process.cwd(), 'fbref-stats.json');
    writeFileSync(outPath, JSON.stringify(allResults, null, 2), 'utf-8');
    console.log(`\n✅ 输出: ${outPath} (${Object.keys(allResults).length} 场)`);
  }

  // 回写
  if (writeMatches) {
    const updated = injectStats(MATCHES_PATH, allResults);
    writeFileSync(MATCHES_PATH, updated, 'utf-8');
    console.log(`✅ matches.ts 已更新`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
