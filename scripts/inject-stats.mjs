#!/usr/bin/env node
/**
 * FBref 统计数据注入器
 * 读取 fbref-stats.json，将赛后统计数据嵌入 matches.ts
 *
 * 用法:
 *   node scripts/inject-stats.mjs                          # 读取 fbref-stats.json → matches.ts
 *   node scripts/inject-stats.mjs --stats custom.json      # 指定 stats 文件
 *   node scripts/inject-stats.mjs --dry-run                # 仅检查，不写入
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const MATCHES_PATH = resolve(import.meta.dirname || process.cwd(), '../src/data/matches.ts');
const DEFAULT_STATS_PATH = resolve(import.meta.dirname || process.cwd(), '../src/data/fbref-stats.json');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatStatsTS(stats) {
  const h = (v) => (typeof v === 'number' ? v : 0);
  const s = stats;
  return `{
    possession: { home: ${h(s.possession?.home)}, away: ${h(s.possession?.away)} },
    shots: { home: ${h(s.shots?.home)}, away: ${h(s.shots?.away)} },
    shotsOnTarget: { home: ${h(s.shotsOnTarget?.home)}, away: ${h(s.shotsOnTarget?.away)} },
    xg: { home: ${h(s.xg?.home)}, away: ${h(s.xg?.away)} },
    corners: { home: ${h(s.corners?.home)}, away: ${h(s.corners?.away)} },
    fouls: { home: ${h(s.fouls?.home)}, away: ${h(s.fouls?.away)} },
    cards: { home: { yellow: ${h(s.cards?.home?.yellow)}, red: ${h(s.cards?.home?.red)} }, away: { yellow: ${h(s.cards?.away?.yellow)}, red: ${h(s.cards?.away?.red)} } },
    offsides: { home: ${h(s.offsides?.home)}, away: ${h(s.offsides?.away)} },
    crosses: { home: ${h(s.crosses?.home)}, away: ${h(s.crosses?.away)} },
    interceptions: { home: ${h(s.interceptions?.home)}, away: ${h(s.interceptions?.away)} },
    saves: { home: ${h(s.saves?.home)}, away: ${h(s.saves?.away)} }
  }`;
}

function injectStats(matchesPath, allStats, dryRun = false) {
  let content = readFileSync(matchesPath, 'utf-8');
  let modified = 0;
  let skipped = 0;

  for (const [matchId, stats] of Object.entries(allStats)) {
    if (!stats) continue;

    // 检查是否已经注入过
    if (content.includes(`matchStats:`) && content.includes(`id: '${matchId}'`)) {
      const idx = content.indexOf(`id: '${matchId}'`);
      const after = content.substring(idx, idx + 500);
      if (after.includes('matchStats:')) {
        skipped++;
        console.log(`  ⏭ ${matchId}: 已有 matchStats，跳过`);
        continue;
      }
    }

    // 在 status: 'finished' 后插入 matchStats（保留原有逗号分隔）
    const pattern = new RegExp(
      `(id:\\s*'${escapeRegex(matchId)}'[\\s\\S]*?status:\\s*'finished'[^,\\n]*)`,
      'g'
    );

    const statsTS = formatStatsTS(stats);
    const newContent = content.replace(pattern, (match) => {
      modified++;
      return `${match},\n    matchStats: ${statsTS}`;
    });

    if (newContent !== content) {
      content = newContent;
      console.log(`  ✓ ${matchId}: 已注入 matchStats`);
    } else {
      console.log(`  ✗ ${matchId}: 未找到匹配的比赛定义`);
    }
  }

  if (!dryRun && modified > 0) {
    writeFileSync(matchesPath, content, 'utf-8');
    console.log(`\n✅ 已保存: ${modified} 注入, ${skipped} 跳过, ${Object.keys(allStats).length - modified - skipped} 未找到`);
  } else if (dryRun) {
    console.log(`\n🔍 DRY RUN: 将注入 ${modified} 场, 跳过 ${skipped} 场`);
  }

  return { modified, skipped };
}

// ========== 命令行 ==========

const args = process.argv.slice(2);
let statsPath = DEFAULT_STATS_PATH;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--stats') statsPath = resolve(args[++i]);
  else if (args[i] === '--dry-run') dryRun = true;
}

try {
  const stats = JSON.parse(readFileSync(statsPath, 'utf-8'));
  console.log(`\n📊 读取 ${Object.keys(stats).length} 场比赛统计数据\n`);
  const { modified, skipped } = injectStats(MATCHES_PATH, stats, dryRun);
  if (!dryRun && modified > 0) {
    console.log(`\n📝 请运行 "npm run build" 重新构建`);
  }
} catch (e) {
  if (e.code === 'ENOENT') {
    console.error(`❌ 未找到文件: ${statsPath}`);
    console.error('   请先运行数据采集生成该文件');
  } else {
    throw e;
  }
}
