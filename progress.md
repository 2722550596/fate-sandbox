# LOTM 迁移进度报告

> 基于 migration-plan-lotm.md 各 Phase/Milestone 逐项检查
> 生成时间：2026-06-27（已核实待确认项）
> LOTM路径在mnt/d/developpement/LOTM

---

## 总体进度

| 里程碑                        | 状态    | 完成度 |
| ----------------------------- | ------- | ------ |
| M1: 骨架可编译（Phase 1+9）   | ✅ 完成 | 100%   |
| M2: 引擎核心可运行（Phase 2） | ✅ 大部 | ~85%   |
| M3: 工具链可用（Phase 3）     | ✅ 完成 | 100%   |
| M4: 数据可用（Phase 4）       | ✅ 完成 | 100%   |
| M5: Prompt 可游玩（Phase 5）  | ❌ 未动 | 0%     |
| M6: 高级功能（Phase 6-7）     | ❌ 未动 | 0%     |
| M7: 发布就绪（Phase 9 余项）  | ❌ 未动 | 0%     |

---

## Phase 1 — State Schema ✅ 完全完成

### `engine/core/state.ts` ✅ 已重写（619 行）

- 导入 LOTM 专属类型：`PathwayId`, `SequenceRank`, `StatusEffectType`, `ValueType`, `DamageType`, `DifficultyLevel`, `JudgmentOutcome`, `PromotionSystem`, `AttributeKeys` 等
- `ActorKind`: `"human" | "beyonder" | "creature" | "other"`（移除了 `"outsider"`/`"spirit"`）
- `ActorBase`: 移除了 `magecraft` 和 `servantForm`，新增 `sequence: SequenceState | null`
- `SequenceState`: `{ currentSequence, rank, pathway, promotionSystem, divinity, digestionProgress, lossOfControlProgress }`
- `ConditionState`: 改为 `{ statusEffects: StatusEffectState[] }`（取代 `wounds/afflictions/permanentEffects`）
- `StatusEffectState`: `{ id, name, type, affectedAttribute, valueType, value, duration, source }`
- `ActorSecretSlots`: `pathwaySecret?` / `sequenceSecret?`（取代 `trueName?`/`hiddenNoblePhantasms`）
- `LocationState`: 新增 `coordinates: { x: number; y: number } | null`
- `TurnObligationKind`: `"sequence"`（取代 `"servant-form"`）

### `engine/core/state-schema.ts` ✅ 已重写（776 行）

- 完整 TypeBox schema 树
- `STATE_META_SCHEMA` 使用 `Type.Literal(1)`（从 v18 降到 v1）
- `CURRENT_STATE_SCHEMA_VERSION = 1`

### `engine/core/state-enum-schemas.ts` ✅ 已重写（310 行）

- `RULE_SET_IDS`: `lotm-worldview-filter`, `lotm-judgment-combat`, `lotm-economy`, `lotm-sequence-promotion`, `custom`
- `TIMELINE_IDS`: `tingen`, `backlund`, `bayam`, `condat`, `fifth-epoch-1349`, `custom`
- `TIMEZONE_IDS`: 仅 `UTC`
- `CURRENCY_CODES`: `penny`, `gold-pound`, `custom`
- `BOUNDARY_KINDS`: `normal`, `sacred-domain`, `otherworld`, `sealed`
- `TRACKED_ITEM_KINDS`: `mundane`, `weapon`, `sealed-artifact`, `mystical-item`, `document`, `key-item`, `consumable`, `other`
- 新增枚举：`PATHWAY_IDS`（22 途径）、`SEQUENCE_RANKS`、`STATUS_EFFECT_TYPES`、`VALUE_TYPES`、`DAMAGE_TYPES`、`DIFFICULTY_LEVELS`、`JUDGMENT_OUTCOMES`、`PROMOTION_SYSTEMS`、`ATTRIBUTE_KEYS`

### `engine/core/state-migration.ts` ✅ 已重写

- 迁移链从 v1 空起步

### `engine/core/state-store.ts` ✅ 已微调

- protected paths 白名单更新

### `engine/core/new-game-initialization.ts` ✅ 已重写（227 行）

- LOTM 开局初始化逻辑

### `engine/core/new-game-schema.ts` ✅ 已重写

- LOTM 开局参数 schema

### `engine/core/date-time.ts` ✅ 已改写（119 行）

- LOTM 历法适配（第五纪）

---

## Phase 2 — Engine Core 领域模块 ✅ 大部完成

### 旧文件已删除

- `engine/core/servant.ts` ✅ 已删
- `engine/core/servant-schema.ts` ✅ 已删
- `engine/core/servant.test.ts` ✅ 已删
- `engine/core/combat-exchange.ts` ✅ 已删
- `engine/core/combat-exchange-schema.ts` ✅ 已删
- `engine/core/combat-exchange.test.ts` ✅ 已删
- `engine/core/fate-rank.ts` ✅ 已删
- `engine/core/fate-rank.test.ts` ✅ 已删

### 新 LOTM 核心模块已创建

| 文件                                  | 行数 | 内容                                                                                          |
| ------------------------------------- | ---- | --------------------------------------------------------------------------------------------- |
| `engine/core/judgment.ts`             | 133  | LOTM 判定系统：序列基准值表（普通人200~支柱5M）、DC 难度系数（0.08~0.4）、d100 判定、运气修正 |
| `engine/core/attribute-calculator.ts` | 130  | 六维属性动态计算：攻击力/防御力计算（物理/神秘/精神/混合）                                    |
| `engine/core/damage-calculator.ts`    | 60   | 伤害计算：神性修正、随机浮动 0.9~1.1                                                          |
| `engine/core/skill-cost-manager.ts`   | 70   | 技能消耗管理：消耗检查与扣除                                                                  |
| `engine/core/combat.ts`               | 104  | LOTM 战斗结算：combatant snapshot、roll 对战、伤害输出                                        |

### 现有文件已修改

| 文件                        | 操作    | 说明                                                                  |
| --------------------------- | ------- | --------------------------------------------------------------------- |
| `actor.ts`                  | ✅ 改写 | 移除 servant/magecraft 字段，新增 sequence                            |
| `actor-schema.ts`           | ✅ 改写 | 移除 Fate 专用 schema，新增 `SequenceInput`、`UPSERT_SEQUENCE` 变体   |
| `actor-condition.ts`        | ✅ 改写 | 改为 status effects（add/remove/change-outfit/transfer-tracked-item） |
| `actor-condition-schema.ts` | ✅ 改写 | 适配 status effect schema                                             |
| `economy.ts`                | ✅ 改写 | LOTM 货币（便士/金镑）                                                |
| `economy-schema.ts`         | ✅ 改写 | 货币 schema 适配                                                      |
| `secrets.ts`                | ✅ 改写 | 替换 servant true name → pathway/sequence 秘密                        |
| `secrets-schema.ts`         | ✅ 改写 | 秘密 schema 适配                                                      |
| `scene.ts`                  | ✅ 微调 | situation 枚举微调                                                    |
| `scene-schema.ts`           | ✅ 微调 | 同步修改                                                              |
| `campaign.ts`               | ✅ 改写 | LOTM 世界线适配                                                       |
| `campaign-schema.ts`        | ✅ 改写 | 同步修改                                                              |
| `offscreen-event.ts`        | ✅ 微调 | event kind 适配                                                       |
| `offscreen-event-schema.ts` | ✅ 微调 | 同步修改                                                              |
| `faction-clock.ts`          | ✅ 微调 | 框架不变，适配 LOTM 势力                                              |
| `actor-agenda.ts`           | ✅ 微调 | 框架不变                                                              |
| `actor-display.ts`          | ✅ 微调 | LOTM 角色展示                                                         |
| `actor-impression.ts`       | ✅ 不变 | 框架保留                                                              |
| `relationship-signal.ts`    | ✅ 微调 | 框架不变                                                              |
| `public-projection.ts`      | ✅ 微调 | 适配 LOTM 字段                                                        |
| `memory.ts`                 | ✅ 微调 | 移除 Fate 特有记忆类型                                                |
| `memory-schema.ts`          | ✅ 微调 | 同步修改                                                              |
| `turn-commit.ts`            | ✅ 微调 | event kind 枚举适配                                                   |
| `hooks.ts`                  | ✅ 不变 | 保留                                                                  |
| `turn-log.ts`               | ✅ 不变 | 保留                                                                  |
| `turn-time.ts`              | ✅ 微调 | 适配                                                                  |

### 后台导演基础设施

全部 8+ 个 `backstage-*.ts` 文件 ✅ 不变

---

## Phase 3 — Tools ✅ 完成

### 已删除的工具

- `tools/state/resolve-combat-exchange.ts` ✅ 已删
- `tools/state/update-servant-form.ts` ✅ 已删

### 已修改的工具

| 文件                                    | 修改内容                                       |
| --------------------------------------- | ---------------------------------------------- |
| `tools/state/upsert-actor.ts`           | LOTM actor registry（含 upsert-sequence 变体） |
| `tools/state/reveal-secret.ts`          | LOTM 秘密揭示                                  |
| `tools/state/commit-turn-normalizer.ts` | event kind 适配                                |
| `tools/state/configure-campaign.ts`     | LOTM 战役配置                                  |
| `tools/state/update-economy.ts`         | LOTM 货币                                      |
| `tools/registry.ts`                     | 移除已删除工具注册                             |
| `tools/lookup/lookup.ts`                | 微调                                           |

### ✅ `update_actor_condition` 工具——引擎已改、工具层未同步 —— 已修复

**确认结论：** `apply_status_effect` **已合并进 `update_actor_condition`**，不单独新建工具。

**2026-06-27 修复：** 工具层描述和 schema 已重写，匹配引擎的 `add-status-effect` / `remove-status-effect` / `change-outfit` / `transfer-tracked-item` / `update-tracked-item` / `add-tracked-item`。已删除所有 Fate 术语（wound/affliction/magecraft-circuits/Fate rank 等）。

### ✅ 已完成的新工具

| 工具名              | 迁移计划要求                             | 状态      |
| ------------------- | ---------------------------------------- | --------- |
| `attempt_promotion` | 序列晋升（魔药消化、仪式、失控风险）     | ✅ 已创建 |
| `roll_dice`         | 独立骰子工具                             | ✅ 已创建 |
| `move_to`           | 位置移动（含坐标）                       | ✅ 已创建 |
| `resolve_combat`    | 战斗结算（替代 resolve_combat_exchange） | ✅ 已创建 |

### ✅ 工具层残留 Fate 引用 —— 已全部清理

| 文件                                          | 修复内容                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `tools/state/commit-turn.ts:18`               | `COST_EVENT_KINDS`: `"servant-form"` → `"sequence"`                     |
| `tools/state/commit-turn.ts:57`               | 工具描述 `resolve_combat_exchange` → `resolve_combat`                   |
| `tools/state/commit-turn.ts:74`               | event kind: `"servant-form"` → `"sequence"`                             |
| `tools/debug/get-state-schema.ts:31`          | 移除 `update_servant_form`                                              |
| `engine/audit/session-audit.ts:354`           | `resolve_combat_exchange` → `resolve_combat`                            |
| `engine/core/obligations.ts:4`                | 注释更新                                                                |
| `tools/state/retire-actor.ts:25,28`           | `servantForm` / `master role` → `sequence` / `契约`                     |
| `tools/state/record-offscreen-event.ts:69,72` | 压力类型示例更新                                                        |
| `tools/state/initialize-new-game.ts`          | 全工具描述重写，从 Fate 到 LOTM                                         |
| `tools/state/update-actor-condition.ts`       | 全工具描述 + schema 重写，匹配引擎                                      |
| `engine/core/offscreen-pressure.ts`           | 关键词改为 LOTM（值夜人、机械之心、非凡者、序列等）                     |
| `engine/core/state-file-projection.ts`        | `TimelineActorContext` 字段改为 LOTM；`classifyPressureType` 关键词更新 |

---

## Phase 4 — Data ✅ 完成

### 架构变更

从硬编码 JSON 切换为 **目录 + Markdown + Frontmatter** 架构：

- 每个实体一个 .md 文件，frontmatter 存元数据（title/type/tags/aliases）
- 按类别分目录：characters/、locations/、organizations/、items/、pathways/、lore/、mechanics/
- lookup 引擎启动时扫描 data/ 下所有 .md，解析 frontmatter + 正文，构建内存索引
- 后续 RAG 只需把 MD 喂给 embedding 模型，不改代码

### 数据量统计

| 目录           | 文件数 | 说明                         |
| -------------- | ------ | ---------------------------- |
| characters/    | 59     | 核心 NPC + 角色              |
| locations/     | 82     | 城市、区域、地标             |
| organizations/ | 18     | 教会、组织、学派             |
| items/         | 41     | 封印物、源质、奇特物品       |
| pathways/      | 6      | 途径定义                     |
| lore/          | 15     | 世界观、历史、文风指南       |
| mechanics/     | 23     | 判定、魔药、仪式、神性等规则 |
| economy.md     | 1      | 经济/货币规则（5 条目合并）  |

### 已删除的旧 JSON 文件

- data/characters.json（Fate 角色）
- data/locations.json（Fate 地点）
- data/world.json（Fate 世界观）
- data/timelines.json（Fate 时间线）
- data/servants.json（Fate 从者）

### 引擎改动

- `engine/world-data/frontmatter.ts` — 新增轻量 YAML frontmatter 解析器
- `engine/world-data/lookup.ts` — 重写为 MD 扫描 + 索引搜索（API 不变）
- lookup 工具 `tools/lookup/lookup.ts` — 无需改动

### ✅ 实际已迁移的 LOTM 数据

| 文件                                 | 确认状态          | 说明                                                                                                                                              |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/campaign-presets.ts`           | ✅ **已 LOTM 化** | 5 个 LOTM 战役预设：`tingen_1349`、`backlund_1350`、`bayam_1351`、`condat_1349`、`custom_worldline`。包含 LOTM 风格 OpeningHooks（`beyonder` 等） |
| `data/timeline-pressure-palettes.ts` | ✅ **已 LOTM 化** | 值夜人巡逻、机械之心调查、廷根地下冒险者公会、风暴教会码头检查、代罚者突袭等 LOTM 压力槽                                                          |

### ❌ 仍未迁移的 Fate 数据

| 文件                   | 现状                            |
| ---------------------- | ------------------------------- |
| `data/characters.json` | Fate 角色（远坂凛等）           |
| `data/locations.json`  | Fate 地点（冬木市等）           |
| `data/servants.json`   | Fate 从者数据                   |
| `data/world.json`      | Fate 世界观设定（魔术、魔法等） |
| `data/timelines.json`  | Fate 世界线                     |
| `data/NOTICE.md`       | Fate 版本                       |

### ✅ 工具/引擎层数据依赖已同步

`state-file-projection.ts`（timeline subagent context）现已读取 LOTM 字段：

- `wounds` / `afflictions` / `servantModifiers` → `statusEffects` / `sequence`
- `classifyPressureType` 正则关键词已更新为 LOTM 势力
- `offscreen-pressure.ts` 兜底分类正则同步更新（值夜人、机械之心、非凡者、序列等）

### ❌ 待新增的文件

- `data/organizations.json` — 21 组织
- `data/items.json` — 52 物品
- `data/pathways.json` — 22 途径
- `data/mechanics.json` — 610 行规则
- `data/economy.json`
- `data/narrative.json`
- `data/system_rules.json`
- `data/theater.json`
- `data/dlc.json`

---

## Phase 5 — Agents/Prompts ❌ 未动

全部 15 个 agent prompt 文件仍为 Fate/Type-Moon 内容：
`gm-context.md`、`gm-rules.md`、`gm-tool-policy.md`、`gm-story-driver.md`、`gm-render.md`、`gm-style-rules.md`、`gm-style-blacklist.md`、`gm-input-guide.md`、`gm-output-contract.md`、`gm-direction.md`、`gm-settlement-principles.md`、`gm-social-guide.md`、`gm-turn-reminder.md`、`system-settlement.md`、`system-render.md`、`protagonist-impression.md`、`preset-render.json`、`preset-settlement.json`、`parallel-lines/README.md`

---

## Phase 6 — Skills ❌ 未动

- `skills/start-game/SKILL.md` — Fate 开局流程
- `skills/time-sense/SKILL.md` — Fate 历法
- `skills/romance/SKILL.md` — Fate 社交
- `skills/social-protocol/SKILL.md` — Fate
- `skills/intimacy/SKILL.md` — Fate
- `skills/input-protocol/SKILL.md` — 不变

---

## Phase 7 — Extensions & Subagents ❌ 未动

- `extensions/player-panel/index.ts` — 仍显示 Fate 字段（servant、magecraft）
- `extensions/subagents/timeline/` — 仍为 Fate 审计
- `.pi/agents/timeline-showrunner.md` — 仍为 Fate
- `extensions/compaction-policy/`、`rewind/`、`two-pass-render/` — 框架不变

---

## Phase 8 — 测试

### 当前测试状态

```
tests 342 | suites 6 | pass 341 | fail 0 | skipped 1 | duration_ms 6384ms
```

✅ 341 通过，0 失败。

### 待新建的测试（来自迁移计划）

| 测试                              | 确认状态                |
| --------------------------------- | ----------------------- |
| `judgment.test.ts`                | ❌ 不存在               |
| `damage-calculator.test.ts`       | ❌ 不存在               |
| `attribute-calculator.test.ts`    | ❌ 不存在               |
| `status-effect.test.ts`           | ❌ 不存在               |
| `sequence-promotion.test.ts`      | ❌ 不存在               |
| `state-schema.test.ts`            | ✅ 已存在（可能已适配） |
| `state-migration.test.ts`         | ✅ 已存在               |
| `new-game-initialization.test.ts` | ✅ 已存在               |
| `economy.test.ts`                 | ✅ 已存在               |

---

## Phase 9 — 项目配置 & 发布 🔶 部分完成

| 文件                                | 确认状态                                    |
| ----------------------------------- | ------------------------------------------- |
| `package.json`                      | ✅ 已改（name: `lotm-sandbox`, 描述已更新） |
| `tsconfig.json`                     | ✅ 不变                                     |
| `.oxlintrc.json`                    | ✅ 不变                                     |
| `.oxfmtrc.json`                     | ✅ 不变                                     |
| `knip.json`                         | ✅ 不变                                     |
| `.gitignore`                        | ✅ 不变                                     |
| `.pi/settings.json`                 | ❌ 未改                                     |
| `.pi/agents/timeline-showrunner.md` | ❌ 未改                                     |
| `AGENTS.md`                         | ❌ 未改                                     |
| `README.md`                         | ❌ 未改                                     |
| `context.md`                        | ❌ 未改                                     |
| `CONTEXT.md`                        | ❌ 未改                                     |
| `start.sh`                          | ❌ 未改                                     |
| `start.ps1`                         | ❌ 未改                                     |

---

## 执行时序总结

| 步骤                                 | 完成情况                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------- |
| 项目基础配置 (Phase 9 部分)          | ✅ package.json 已改                                                       |
| State Schema (Phase 1)               | ✅ 完整重写，typecheck 零错，341 测试通过                                  |
| Engine Core 领域模块 (Phase 2)       | ✅ 核心数值逻辑已实现，旧 Fate 模块已清                                    |
| **~~Tools"工具层"断层~~（Phase 3）** | ✅ 已修复（工具描述/schema + 12 处残留引用 + pressure 关键词全部清理）     |
| **新工具缺失（Phase 3）**            | ✅ `attempt_promotion` / `roll_dice` / `move_to` / `resolve_combat` 已完成 |
| **Data 半迁移（Phase 4）**           | ✅ 目录+MD 架构，244 个 MD 文件，旧 JSON 已全部删除                        |
| Agents/Prompts (Phase 5)             | ❌ 完全未动                                                                |
| Skills (Phase 6)                     | ❌ 完全未动                                                                |
| Extensions/Subagents (Phase 7)       | ❌ 完全未动                                                                |
| 新测试 (Phase 8)                     | ❌ 5 个引擎逻辑测试未创建                                                  |

### 建议下一步行动

1. ✅ ~~修断层（Phase 3）~~ **已全部清理（工具描述/schema + 12 处残留 Fate 引用）**
2. ✅ ~~补新工具（Phase 3）~~ **`attempt_promotion`、`roll_dice`、`move_to`、`resolve_combat` 已创建**
3. ✅ ~~补数据（Phase 4）~~ **已替换为目录+MD 架构，244 个文件**
4. **写测试（Phase 8）：** judgment、damage-calculator、attribute-calculator、status-effect、sequence-promotion
