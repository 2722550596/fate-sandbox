# Fate 残留侦查报告 — engine/tools/

## 概述

全目录扫描完成。发现 **FateToolDefinition 类型名扩散** 贯穿几乎所有工具文件（~30 处 import/use），此外有 **3 个测试文件** 使用 Fate/HGW 场景数据（包括「从者」「圣杯容器」「柳洞寺」「caster-ryudou」「宝具/令咒」等），以及 **多个工具 description 中残留 Fate 术语**。

---

## 🔴 红色 — 测试数据/场景为 Fate 特有设计

### 1. `scene/progress-scene-beat.test.ts` (全部行)

| 行号  | 内容                                                                           | 问题                                                              |
| ----- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 13    | `title: "柳洞寺外围侦察"`                                                      | 柳洞寺(Ryuudou Temple)是 Fate/stay night Caster 根据地            |
| 15    | `purpose: "进入柳洞寺外围侦察 beat。"`                                         | 同上                                                              |
| 17    | `threats: [{ summary: "山门附近有从者级别气息" }]`                             | "从者"(Servant)为 Fate 特有概念                                   |
| 31    | 断言 `"山门附近有从者级别气息"`                                                | 同上                                                              |
| 39-40 | `title: "真名与宝具揭示收口"` / `objectives: ["真名揭示成立", "宝具揭示成立"]` | "真名"(True Name)与"宝具"(Noble Phantasm)为 Fate Servant 特有机制 |
| 47    | `completionCriteria: ["真名揭示成立", "宝具揭示成立"]`                         | 同上                                                              |
| 57    | `outcome: "真名与宝具揭示成立，现场进入短暂停顿。"`                            | 同上                                                              |
| 60    | `title: "真名与宝具揭示成立"`                                                  | 同上                                                              |
| 65    | `statement: "真名与宝具揭示这一幕已经在现场发生。"`                            | 同上                                                              |

**判定**: 🔴 红 — 测试场景完全基于 Fate 世界观（柳洞寺、从者、真名与宝具揭示）。LOTM 不存在 Servant/从者概念，其非凡者序列也不对应真名揭晓机制。

---

### 2. `backstage/run-parallel-line.test.ts` (行 26-64)

| 行号  | 内容                                                                      | 问题                                       |
| ----- | ------------------------------------------------------------------------- | ------------------------------------------ |
| 32    | `lineId: "caster-ryudou"`                                                 | "caster" 为 Fate 职阶名，"ryudou" 指柳洞寺 |
| 34-35 | `timeWindow: { start: "2004-01-30T21:00:00.000Z", ... }`                  | 2004-01-30 是 Fate 正作剧情时间线          |
| 43    | `runId: "bl-caster-ryudou"`                                               | 同上                                       |
| 44    | `prompt 含 "lineId": "caster-ryudou"`                                     | 同上                                       |
| 54    | `result.details["runId"] == "bl-caster-ryudou"`                           | 同上                                       |
| 57    | `prompt.includes("caster-ryudou")`                                        | 同上                                       |
| 62-63 | `pending[0]?.runId == "bl-caster-ryudou"` / `?.lineId == "caster-ryudou"` | 同上                                       |

**判定**: 🔴 红 — 测试数据使用 Fate 职阶名+圣杯战争发生地点（柳洞寺）作为后台线标识，时间戳也是 Fate 剧情年份。该测试完全为 Fate/HGW 场景编写。

---

### 3. `backstage/manage-faction-clock.test.ts` (行 18-19)

| 行号 | 内容                    | 问题                               |
| ---- | ----------------------- | ---------------------------------- |
| 18   | `factionId: "matou"`    | "matou"(间桐)是 Fate/SN 御三家之一 |
| 19   | `label: "圣杯容器准备"` | "圣杯容器"是圣杯战争特有概念       |

**判定**: 🔴 红 — 使用间桐家 (matou) faction ID 与「圣杯容器准备」作为 faction clock 标签。LOTM 不存在圣杯战争相关阵营概念。

---

### 4. `actor/record-actor-knowledge.test.ts` (行 57)

| 行号 | 内容                                            | 问题                                       |
| ---- | ----------------------------------------------- | ------------------------------------------ |
| 57   | `forbiddenKnowledge: ["hidden noble phantasm"]` | "Noble Phantasm"(宝具)是 Fate 从者特有概念 |

**判定**: 🔴 红 — 测试数据直接使用 Fate 概念 "Noble Phantasm" 作为 forbiddenKnowledge 示例。LOTM 无此概念。

---

## 🟡 黄色 — 命名残留（Fate 命名/术语在 tool description 中）

### 5. `runtime/tool-definition.ts` (行 7)

```typescript
export type FateToolDefinition = Omit<ToolDefinition, "label">;
```

**影响**: 全目录约 **30 个文件** import/use 此类型，包括：
`actor/`(8 文件), `backstage/`(6 文件), `debug/`(3 文件), `economy/`, `inventory/`, `knowledge/`(4 文件), `lookup/`, `lotm/`(3 文件), `relationship/`, `runtime/`, `scene/`(4 文件), `system/`(4 文件), `registry.ts`

**判定**: 🟡 黄 — 仅命名残留。类型定义本身是泛用工具契约，功能无 Fate 语义。但类型名 `FateToolDefinition` 是项目前身(fate-sandbox)的最大残留。修改影响面广但纯机械替换。

---

### 6. `debug/reset-state.ts` (行 21)

```
description: "【调试工具】重置为新 Fate schema 初始状态；不做旧 schema migration。必须写明 reason。"
```

**判定**: 🟡 黄 — description 中 "Fate schema" 是项目前身命名残留。

---

### 7. `runtime/narrative-hints.ts` (行 4)

```
return "Fate 领域状态已启用：伤势、魔力、危险以 actor/scene/memory 表达。";
```

**判定**: 🟡 黄 — "Fate 领域" 命名残留。LOTM 不称自己为 Fate 领域。

---

### 8. `knowledge/record-memory.ts` (行 52)

```
"- 身世/契约/生死/真名/宝具/令咒/阵营/永久缺损等重大变化：record-major-event + claims"
```

**判定**: 🟡 黄 — "宝具/令咒"(Noble Phantasm/Command Spell) 是从者-御主体系术语。LOTM 不存在宝具和令咒。作为 tool description 中的示例分类保留。

---

### 9. `actor/record-actor-knowledge.ts` (行 153)

```
"- 把玩家现实知识/GM lookup/未揭示真名/隐藏宝具塞进 knows（除非剧情已成立）"
```

**判定**: 🟡 黄 — "隐藏宝具" 是 Fate 特有概念。

---

### 10. `relationship/record-relationship-signal.ts` (行 81)

```
"- 把未揭示真名/隐藏宝具/幕后动机写进 player-known（需隐藏用 secret）"
```

**判定**: 🟡 黄 — "隐藏宝具" 同上。

---

### 11. `scene/submit-direction-packet.ts` (行 65)

```
"禁区：调用前后输出叙事正文、泄露未揭示真名/隐藏宝具名、替代领域工具落账"
```

**判定**: 🟡 黄 — "隐藏宝具名" 同上。

---

### 12. `backstage/harvest-backstage-candidate.ts` (行 86)

```
description: "run_parallel_line 返回的 run_id（如 bl-archer-floor1-scout）；..."
```

**判定**: 🟡 黄 — "bl-archer-floor1-scout" 示例中的 "archer" 是 Fate 职阶名。

---

### 13. `backstage/run-parallel-line.ts` (行 143)

```
lineId: Type.String({ description: "后台线标识，如 caster-ryudou、lancer-church" })
```

**判定**: 🟡 黄 — description 示例使用 Fate 职阶名 (caster, lancer) + 地点(ryudou=柳洞寺, church=教会)。作为非测试文档示例残留。

---

## 🟢 绿色 — 已确认 LOTM 专用，无需报告

- `actor/upsert-actor.ts` (行 202): pathway 列表包含 `assassin` — 此为 LOTM 非凡者途径(序列9刺客)，不是 Fate 职阶 Assassin。
- `tools/lotm/` (所有文件): 全部为 LOTM 特有设计（update-corruption, roll-dice, attempt-promotion），无 Fate 残留。
- `tools/economy/`、`tools/inventory/`、`tools/system/`、`tools/lookup/`: 功能与命名均为 LOTM 通用设计，无 Fate 特定内容。
- `tools/registry.ts`: 仅聚合注册各 tool definition，引用 FateToolDefinition 但不引入 Fate 语义。

---

## 汇总统计

| 严重度 | 数量                                       | 涉及文件                                                                                                                                                                                                                               |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 红  | 4 文件                                     | `progress-scene-beat.test.ts`, `run-parallel-line.test.ts`, `manage-faction-clock.test.ts`, `record-actor-knowledge.test.ts`                                                                                                           |
| 🟡 黄  | 9 处（含 30 文件 FateToolDefinition 扩散） | `tool-definition.ts`, `reset-state.ts`, `narrative-hints.ts`, `record-memory.ts`, `record-actor-knowledge.ts`, `record-relationship-signal.ts`, `submit-direction-packet.ts`, `harvest-backstage-candidate.ts`, `run-parallel-line.ts` |
| 🟢 绿  | N/A                                        | 其余全部文件                                                                                                                                                                                                                           |

---

## 修复优先级建议

1. **P0** — 清理 4 个 **🔴 红** 测试文件中的 Fate/HGW 测试数据，替换为 LOTM 场景数据。这些是真正残留逻辑验证。
2. **P1** — 重命名 `FateToolDefinition` → `LOTMToolDefinition` 或 `DomainToolDefinition`，同步更新 30 个引用处。机械替换，风险低。
3. **P2** — 清理 6 个 tool description 中的宝具/令咒/从者/Fate 领域等字眼，替换为 LOTM 对应概念。
