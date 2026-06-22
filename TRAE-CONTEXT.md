# TRAE 项目上下文文档
# 供 AI 代码工具（Trae/Cursor/CodeBuddy等）阅读
# 最后更新：2026-06-22（所有近期修复已完成并部署）

---

## 一、项目概述

**WCPE（世界杯智能预测引擎）V2.0** — 静态 React 单页应用，部署于 GitHub Pages。

- **仓库**：`carlyang2025/wcpe-web` (main 分支)
- **线上地址**：https://carlyang2025.github.io/wcpe-web/
- **构建**：`npm run build` → Vite 构建到 `dist/`，GitHub Actions 自动部署
- **数据来源**：`dist/remote.json`（Git 管理，构建时生成，运行时从 CDN 拉取）
- **技术栈**：React 19 + TypeScript + Vite 6 + Tailwind 4

---

## 二、数据流（关键：理解这个才能正确修改）

```
src/data/matches.ts  (硬编码静态数据)
        │
        ▼
scripts/export-json.mjs  (构建时运行：读取 matches.ts + 合并 remote.json + 标准化所有字段)
        │
        ▼
dist/remote.json  (Git 提交，GitHub Pages 托管)
        │
        ▼
src/lib/useRemoteData.ts  (运行时 fetch，带时间戳防缓存)
        │
        ▼
App.tsx: mergePredictionFields()  (字段级深合并 static + remote)
        │
        ▼
App.tsx: ensureSafePrediction()  (运行时兜底，防格式异常)
        │
        ▼
各组件渲染 (MatchDetail / Dashboard / BankrollBreakdown 等)
```

### 关键约束

1. **`matches.ts` 是所有比赛的单一事实来源** — 新增/修改比赛必须改这个文件，不能只改 remote.json
2. **`remote.json` 由 `export-json.mjs` 生成** — 不要手动编辑 remote.json，改了也会被下次 build 覆盖
3. **自动化写入的是 `predictionRichData` 字段** — 在 `export-json.mjs` 的 `predictionRichData` 节点，不是直接覆盖 `predictions`
4. **App.tsx 的合并逻辑是字段级深合并** — remote 覆盖 static，但 static 的非空数组（如 riskWarnings）不会被 remote 的空值覆盖

---

## 三、近期修复记录（防止重复引入相同 bug）

> **重要**：以下 bug 均已修复并部署。如果 Trae 看到"类似问题"，先检查是否这些修复被意外 revert 了，而不是从头重写。

| 日期 | 问题 | 根因 | 修复位置 |
|------|------|------|----------|
| 2026-06-22 | 点击历史比赛详情页崩溃（白屏） | App.tsx 用 `{...static, ...remote}` 浅合并，remote 缺少的字段（riskWarnings 等）把 static 安全值覆盖了 | `App.tsx` 新增 `mergePredictionFields()` + `ensureSafePrediction()` |
| 2026-06-22 | 因子权重显示 `NaN%` | `export-json.mjs` 的 `appliedLearnings` 标准化用了 `String(l)`，`[object Object]` 被转成字符串，factorBreakdown 子字段未校验 | `export-json.mjs` 改为按类型分支处理；`App.tsx` `ensureSafePrediction` 逐字段校验 |
| 2026-06-22 | 历史教训应用显示"历史经验"四个字（无内容） | automation 写入的 appliedLearnings 是 `[object Object]`，被 String() 销毁 | `export-json.mjs` 构建后处理：从 `keyLearnings` 按球队名/比分匹配填充 |
| 2026-06-22 | 战术分析所有场次同一段话 | 无 `richAnalysis.tactics` 数据时使用硬编码 fallback（3 行中 2 行完全相同） | `MatchDetail.tsx` 重写为基于全量数据动态合成段落 |
| 2026-06-22 | 平局率分母错误（28 而非 40） | `computeModelState` 只统计有预测的比赛，漏掉无预测比赛的平局 | `export-json.mjs` 新增 `drawCountAll` 统计全部已完赛 |
| 2026-06-22 | 模型进化显示"基于16场"（硬编码） | Dashboard 文本硬编码 | 改为动态读取 `factorWeights.eloDiff.samples` |
| 2026-06-22 | 浏览器缓存导致数据不刷新 | `useRemoteData.ts` 的 fetch URL 无时间戳 | 改为 `url + '?t=' + Date.now()` |
| 2026-06-19 | automation 可靠性仅 25% | JSONBlob 频繁过期 + 构建错误 | 迁移到 Git 管理 remote.json + GitHub Actions 分离构建 |

---

## 四、关键文件职责

### `src/App.tsx`
- **`mergePredictionFields(staticPred, remotePred)`**（行 230-244）：字段级深合并。remote 的 undefined 跳过；static 非空数组不被 remote 空数组覆盖。
- **`ensureSafePrediction(p)`**（行 251-295）：运行时兜底。确保 top5Scores/riskWarnings/mviAnalysis/appliedLearnings/factorBreakdown 格式合法。
- **⚠️ 不要改成浅合并**：`{...static, ...remote}` 是已修复的 bug，不要用。

### `scripts/export-json.mjs`
- **`normalizeSinglePrediction(p)`**（行 ~70-170）：构建时标准化每条预测的 10 个字段。修改时注意：
  - `appliedLearnings`：保留对象结构 `{lesson, adjustment, impact}`，不要 `String(l)`
  - `factorBreakdown`：确保 8 个子字段都是 `Number.isFinite`，否则设为 0
  - `predictedDirection`：映射变体（`home` → `home_win`，`draw` → `draw` 等）
- **`computeModelState()`**（行 ~200-280）：从实际比赛结果实时计算准确率，不依赖 automation 手动写入。
- **构建后处理**（行 ~300-340）：写入 remote.json 后，自动填充空的 `appliedLearnings`（从 `keyLearnings` 匹配）。

### `src/components/MatchDetail.tsx`
- **战术分析生成**（行 ~105-160）：无 `richAnalysis.tactics` 时，基于预测数据动态合成段落。**⚠️ 不要 revert 回硬编码 fallback**。
- **防卫性渲染**：所有数组访问用 `(arr ?? []).map()`，所有可选字段用 `?.`。修改时保持这个模式。

### `src/lib/useRemoteData.ts`
- fetch URL 已加 `?t=Date.now()` 防缓存。**⚠️ 不要去掉时间戳**。

---

## 五、Trae 修改注意事项

### ✅ DO（建议这样做）

1. **改之前先读 `TRAE-CONTEXT.md`**（就是这份文档）
2. **修改 `matches.ts` 后必须运行 `npm run build`** — 因为 `export-json.mjs` 是从 `matches.ts` 读取数据生成 `remote.json`
3. **新增字段时，同步修改三个位置**：
   - `export-json.mjs` 的 `normalizeSinglePrediction()`（构建时标准化）
   - `App.tsx` 的 `ensureSafePrediction()`（运行时兜底）
   - 对应组件的防卫性渲染（可选链/`?? []`）
4. **用 `(arr ?? []).map()` 遍历数组** — 不要直接 `arr.map()`
5. **提交前运行 `npm run build` 和 `npx tsc --noEmit`** — 确保零错误

### ❌ DON'T（不要这样做）

1. **不要手动编辑 `dist/remote.json`** — 改了也会被下次 build 覆盖
2. **不要把 `mergePredictionFields()` 改回 `{...static, ...remote}`** — 这是导致页面崩溃的根因
3. **不要在 `export-json.mjs` 中对 `appliedLearnings` 使用 `String(l)`** — 会把对象转成 `"[object Object]"`
4. **不要把战术分析 revert 回硬编码 fallback** — 当前是动态生成，每场比赛不同
5. **不要去掉 `useRemoteData.ts` 的时间戳** — 会导致浏览器缓存旧数据
6. **不要直接修改 `predictions` 对象的结构** — 影响所有依赖 `prediction.homeWinProb` / `prediction.predictedScore` 等字段的组件

---

## 六、已知技术债和待优化项

> 这些是可以改的方向，但改之前请理解上面的数据流。

1. **`automation prompt` 需要更新** — 当前 automation 产出的 `appliedLearnings` 格式不稳定，依赖 `export-json.mjs` 的构建后处理来修复。更好的做法是让 automation prompt 直接产出正确格式。
2. **`richAnalysis` 数据覆盖率低** — 仅 7/32 场有真实 `richAnalysis.tactics`，其余 25 场靠动态生成。可以让 automation 在写入时生成更丰富的 `richAnalysis`。
3. **`matches.ts` 手动维护** — 新增比赛需要手动编辑 TypeScript 文件。可以考虑写一个 `scripts/add-match.mjs` 脚本来自动化。
4. **没有单元测试** — 当前靠手动验证。可以考虑用 Vitest 为 `mergePredictionFields` / `ensureSafePrediction` / `normalizeSinglePrediction` 添加单元测试。
5. **ESPN API 依赖** — 实时比分来自 ESPN API，如果 ESPN 改版/CORS 变化，比分更新会失效。当前无备份数据源。

---

## 七、紧急回滚方案

如果改崩了：

```bash
# 回滚到最后一个稳定版本
cd /Users/yangkanghua/Desktop/世界杯预测网站开发/wcpe-web
git log --oneline | head -20   # 找到稳定 commit
git reset --hard <commit-hash>
git push origin main --force
```

当前最新稳定 commit：`cb1c2f0`（战术分析重写，2026-06-22）

---

## 八、联系方式

- **项目所有者**：杨康华（Marvis）
- **AI 搭档**：Kai（WorkBuddy）
- **项目路径**：`/Users/yangkanghua/Desktop/世界杯预测网站开发/wcpe-web/`
