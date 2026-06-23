/**
 * 数据验证脚本 - 检查 remote.json 数据一致性
 * 运行: node --import tsx scripts/validate-data.mjs
 * 
 * 2026-06-23 新增
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataPath = resolve(__dirname, '../src/data/remote.json')

function validateData() {
  console.log('📋 WCPE 数据验证脚本')
  console.log('='.repeat(50))
  console.log(`读取文件: ${dataPath}\n`)

  let data
  try {
    data = JSON.parse(readFileSync(dataPath, 'utf-8'))
  } catch (e) {
    console.error('❌ 无法读取 remote.json:', e.message)
    process.exit(1)
  }

  const warnings = []
  const errors = []
  const info = []

  // 1. 检查文件基本信息
  info.push(`📦 文件大小: ${(JSON.stringify(data).length / 1024).toFixed(1)} KB`)
  info.push(`🕐 最后更新: ${data.lastUpdated || '未知'}`)
  info.push(`📊 比赛总数: ${data.matches?.length || 0}`)
  info.push(`🎯 预测总数: ${Object.keys(data.predictions || {}).length}`)
  info.push(`📝 复盘总数: ${Object.keys(data.reviews || {}).length}`)

  // 2. 检查 modelState 一致性
  if (data.modelState) {
    const ms = data.modelState
    info.push(`\n📈 模型状态:`)
    info.push(`   方向准确率: ${(ms.directionAccuracy * 100).toFixed(1)}%`)
    info.push(`   TOP3 比分准确率: ${(ms.scoreTop3Accuracy * 100).toFixed(1)}%`)
    info.push(`   TOP1 比分准确率: ${(ms.scoreTop1Accuracy * 100).toFixed(1)}%`)
    info.push(`   总预测数: ${ms.totalPredictions}`)
    info.push(`   已完成预测: ${ms.completedPredictions}`)
    info.push(`   方向正确数: ${ms.directionCorrect}`)
    info.push(`   平局率: ${(ms.overallDrawRate * 100).toFixed(1)}%`)

    // 逻辑检查
    if (ms.totalPredictions < ms.completedPredictions) {
      errors.push(`❌ totalPredictions (${ms.totalPredictions}) < completedPredictions (${ms.completedPredictions})`)
    }
    if (ms.totalPredictions === 0 && ms.directionCorrect > 0) {
      errors.push(`❌ totalPredictions=0 但 directionCorrect=${ms.directionCorrect}`)
    }
    if (ms.totalPredictions > 0) {
      const calcAccuracy = ms.directionCorrect / ms.totalPredictions
      const diff = Math.abs(calcAccuracy - ms.directionAccuracy)
      if (diff > 0.01) {
        errors.push(`❌ 方向准确率计算不匹配: ${(calcAccuracy * 100).toFixed(1)}% vs ${(ms.directionAccuracy * 100).toFixed(1)}%`)
      }
    }
  }

  // 3. 检查已完赛比赛
  const finishedMatches = data.matches?.filter(m => m.status === 'finished') || []
  info.push(`\n🏁 已完赛比赛: ${finishedMatches.length}`)

  const finishedWithScores = finishedMatches.filter(m => m.homeScore !== undefined && m.awayScore !== undefined)
  info.push(`   有比分数据: ${finishedWithScores.length}`)

  const finishedWithoutScores = finishedMatches.filter(m => m.homeScore === undefined || m.awayScore === undefined)
  if (finishedWithoutScores.length > 0) {
    warnings.push(`⚠️ ${finishedWithoutScores.length} 场已完赛比赛缺少比分: ${finishedWithoutScores.map(m => m.id).join(', ')}`)
  }

  // 4. 检查未完赛比赛
  const upcomingMatches = data.matches?.filter(m => m.status !== 'finished') || []
  info.push(`\n📅 未完赛比赛: ${upcomingMatches.length}`)

  // 5. 检查 predictions
  const predCount = Object.keys(data.predictions || {}).length
  const finishedPredCount = finishedMatches.filter(m => data.predictions?.[m.id]).length
  info.push(`\n🎯 预测分析:`)
  info.push(`   总预测数: ${predCount}`)
  info.push(`   已完赛有预测: ${finishedPredCount}`)
  info.push(`   未完赛有预测: ${predCount - finishedPredCount}`)

  const noPredFinished = finishedMatches.filter(m => !data.predictions?.[m.id])
  if (noPredFinished.length > 0) {
    warnings.push(`⚠️ ${noPredFinished.length} 场已完赛比赛缺少预测`)
  }

  // 6. 检查 reviews
  const reviewCount = Object.keys(data.reviews || {}).length
  info.push(`\n📝 复盘分析:`)
  info.push(`   总复盘数: ${reviewCount}`)
  info.push(`   已完赛有复盘: ${finishedMatches.filter(m => data.reviews?.[m.id]).length}`)

  const noReviewFinished = finishedMatches.filter(m => !data.reviews?.[m.id])
  if (noReviewFinished.length > 0 && noReviewFinished.length > finishedMatches.length * 0.3) {
    warnings.push(`⚠️ ${noReviewFinished.length} 场已完赛比赛缺少复盘 (>30%)`)
  }

  // 7. 检查数据时效性
  if (data.lastUpdated) {
    const lastUpdate = new Date(data.lastUpdated)
    const now = new Date()
    const hoursSince = (now - lastUpdate) / (1000 * 60 * 60)
    info.push(`\n⏰ 时效性:`)
    info.push(`   距最后更新: ${hoursSince.toFixed(1)} 小时`)
    
    if (hoursSince > 48) {
      errors.push(`❌ 数据超过 48 小时未更新，可能需要手动检查`)
    } else if (hoursSince > 24) {
      warnings.push(`⚠️ 数据超过 24 小时未更新`)
    }
  }

  // 输出结果
  console.log('\n' + info.join('\n'))

  if (errors.length > 0) {
    console.log('\n🔴 错误:')
    errors.forEach(e => console.log('  ' + e))
  }

  if (warnings.length > 0) {
    console.log('\n🟡 警告:')
    warnings.forEach(w => console.log('  ' + w))
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n✅ 所有检查通过!')
  }

  console.log('\n' + '='.repeat(50))

  // 返回状态码
  return errors.length === 0 ? 0 : 1
}

process.exit(validateData())
