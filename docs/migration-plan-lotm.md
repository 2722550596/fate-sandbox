# 迁移计划：fate-sandbox → 诡秘之主 (LOTM) IP 替换

> 核心原则：**保留 fate-sandbox 的全部架构骨架，只替换领域内容。**
> 架构不变、工程纪律不变、工具链不变、文件分工不变。

---

## 0. 迁移策略总述

fate-sandbox 是第二代架构（模块化引擎 + 领域事件工具 + 分层 prompt + schema 版本管理 + 后台导演 + 严格工程链）。
LOTM 原项目是第一代架构（单体沙箱 + 单一 code_act 工具 + 单文件 prompt + 无 schema 版本管理）。

**迁移 = 用 LOTM 的领域内容填充 fate-sandbox 的架构骨架。**

不是把 LOTM 的代码搬过来，而是把 LOTM 的**世界观、数值公式、数据条目、判定逻辑**用 fate-sandbox 的工程标准重新实现。

### 保留不动的（fate-sandbox 基础设施）

| 层                   | 保留内容                                                                                                                                                                                           | 说明                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 工程链               | tsconfig.json, .oxlintrc.json, .oxfmtrc.json, package.json, pnpm                                                                                                                                   | 严格 TS + oxlint + oxfmt + pnpm 不变                         |
| AGENTS.md            | 工程纪律宪章                                                                                                                                                                                       | 只替换领域相关段落（叙事系统纪律中的 Fate 术语 → LOTM 术语） |
| engine/core/ 骨架    | state-store, state-migration, typebox-validation, seeded-rng, date-time, hooks, ids, string-enum, turn-log, turn-time, public-projection, session-hydration, state-file-projection, player-widgets | 这些是框架代码，与 IP 无关                                   |
| engine/direction/    | render-turn, settlement-compaction, settlement-prose-firewall, strip-thinking, packet-\*                                                                                                           | 渲染/结算管线与 IP 无关                                      |
| engine/gm-prompt/    | injection, preset                                                                                                                                                                                  | prompt 组装框架与 IP 无关                                    |
| extensions/          | player-panel, player-choices, rewind, two-pass-render, compaction-policy                                                                                                                           | UI 扩展与 IP 无关                                            |
| tools/runtime/       | tool-definition, tool-render, tool-result, domain-tool-runner                                                                                                                                      | 工具运行时框架与 IP 无关                                     |
| tools/debug/         | migrate-state, reset-state, get-state-schema, override-locked-fact                                                                                                                                 | debug 工具框架不变，具体实现随 state schema 变               |
| scripts/             | export-book, render-bench, audit-session                                                                                                                                                           | 脚本框架不变                                                 |
| start.sh / start.ps1 | 启动脚本                                                                                                                                                                                           | 只改项目名和默认参数                                         |

### 需要替换的（领域内容）

| 层                    | fate-sandbox 原内容                                                                                                          | 替换为 LOTM 内容                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| state schema & types  | 型月状态（servant, magecraft, fate rank, noble phantasm…）                                                                   | 诡秘状态（sequence, pathway, 六维属性, 神性, 消化进度, 失控进度…）                                                                                 |
| engine/core/ 领域模块 | actor, servant, scene, economy, memory, secret, combat-exchange, offscreen, campaign, faction-clock, new-game-initialization | pathway, sequence, judgment, status-effect, damage-calculator, economy, memory, secret, offscreen, campaign, scene, actor, new-game-initialization |
| tools/state/          | 30+ 型月领域事件工具                                                                                                         | LOTM 领域事件工具（保留工具模式，替换领域逻辑）                                                                                                    |
| tools/lookup/         | 型月世界数据查询                                                                                                             | LOTM 世界数据查询                                                                                                                                  |
| data/                 | 型月世界数据 (characters, locations, servants, world, timelines, campaign-presets)                                           | LOTM 世界数据 (characters, locations, organizations, items, pathways, mechanics, economy, narrative, system_rules, theater, dlc, world_lore)       |
| agents/               | 型月 GM prompt 分层（15 个 md）                                                                                              | LOTM GM prompt 分层（同样分层，替换内容）                                                                                                          |
| skills/               | start-game + social/romance/intimacy/time-sense/input-protocol                                                               | start-game（LOTM 版）+ 保留社交/亲密/时间感知技能框架                                                                                              |
| extensions/subagents/ | timeline-showrunner                                                                                                          | 保留框架，替换审计内容                                                                                                                             |
| .pi/agents/           | timeline-showrunner.md                                                                                                       | 同上                                                                                                                                               |

---

## 1. Phase 1 — State Schema 替换

**目标**：定义 LOTM 的 GameState 类型树和 TypeBox schema，替换全部型月字段。

### 1.1 类型替换映射

| fate-sandbox 字段/类型  | LOTM 替换              | 说明                                         |
| ----------------------- | ---------------------- | -------------------------------------------- |
| `ServantClass` enum     | `PathwayId` enum       | 途径标识：占卜家、偷盗者、观众…22 条途径     |
| `FateRank` type         | `SequenceRank` type    | 序列等级：序列9~序列0、旧日、支柱            |
| `NoblePhantasm`         | `ExtraordinaryAbility` | 非凡能力/技能                                |
| `MagecraftCircuitState` | `SpiritualityState`    | 灵性/灵性聚合度                              |
| `ServantFormState`      | `SequenceState`        | 当前序列、晋升体系、神性、消化进度、失控进度 |
| `WoundSeverity`         | `ConditionEffect`      | 状态效果（buff/debuff/risk/flag）            |
| `ContractStatus`        | `PactStatus`           | 契约/扮演法                                  |
| `CURRENCY_CODE_SCHEMA`  | LOTM 货币              | 便士、金镑等                                 |
| `ActorKind`             | LOTM ActorKind         | 玩家、NPC、非凡者、普通人                    |
| `FactionClock`          | 保留                   | 阵营钟不变，适配 LOTM 势力                   |
| `ScheduledEvent`        | 保留                   | 不变                                         |
| `OffscreenEvent`        | 保留                   | 不变                                         |

### 1.2 新增 LOTM 特有字段

```ts
// 诡秘特有的状态结构
interface SequenceState {
  currentSequence: string; // "序列9-偷盗者"
  pathway: PathwayId; // 所属途径
  promotionSystem: "potion" | "other";
  divinity: number; // 神性
  digestionProgress: number; // 消化进度 0-100
  lossOfControlProgress: number; // 失控进度 0-100
}

interface SixAttributesState {
  vitality: AttributePair; // 活力: { base, current }
  spirituality: AttributePair; // 灵性
  reason: AttributePair; // 理智
  humanity: AttributePair; // 人性
  agility: AttributePair; // 敏捷
  luck: number; // 运气（无 current，只有当前值）
}

interface AttributePair {
  base: number;
  current: number;
}

interface SourceCastleState {
  space: string; // 源堡空间
  weeklyChoice: string; // 本周目源堡选择
  spiritualityAlignment: number; // 灵性聚合度
}

interface AgeState {
  soulAge: number;
  soulAgeLimit: string | number;
  bodyAge: number;
  bodyAgeLimit: number;
}
```

### 1.3 schemaVersion

- 新项目从 `schemaVersion: 1` 开始
- 保留 state-migration.ts 框架，但迁移链从空开始
- 初始 state 由 `new-game-initialization.ts` 构建

### 1.4 涉及文件

| 文件                                     | 操作                                                   |
| ---------------------------------------- | ------------------------------------------------------ |
| `engine/core/state.ts`                   | **重写**：定义 LOTM GameState 接口树                   |
| `engine/core/state-schema.ts`            | **重写**：TypeBox schema 对应 LOTM 字段                |
| `engine/core/state-enum-schemas.ts`      | **重写**：LOTM 枚举（途径、序列、状态效果类型、货币…） |
| `engine/core/state-migration.ts`         | **重写**：v1 起步，迁移链为空                          |
| `engine/core/state-store.ts`             | 微调：protected paths 白名单更新                       |
| `engine/core/new-game-initialization.ts` | **重写**：LOTM 开局初始化逻辑                          |
| `engine/core/new-game-schema.ts`         | **重写**：开局参数 schema                              |
| `engine/core/seeded-rng.ts`              | 不变                                                   |
| `engine/core/date-time.ts`               | **改写**：LOTM 历法（第五纪 X年X月X日）                |

---

## 2. Phase 2 — Engine Core 领域模块替换

**目标**：用 LOTM 的数值逻辑替换型月的战斗/判定/从者逻辑，但保持模块化架构。

### 2.1 模块替换映射

| fate-sandbox 模块                  | 操作                                                 | LOTM 替换模块                                                               |
| ---------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `actor.ts` + `actor-schema.ts`     | **改写**                                             | actor 保留框架，移除 servant/magecraft 字段，加入 sequence/pathway/六维属性 |
| `servant.ts` + `servant-schema.ts` | **删除** → 新建 `pathway.ts` + `pathway-schema.ts`   | 途径定义、序列晋升逻辑                                                      |
| `combat-exchange.ts` + schema      | **删除** → 新建 `judgment.ts` + `judgment-schema.ts` | LOTM 判定系统（序列基准值、DC 难度系数、d100 骰值）                         |
| `combat-exchange.ts`               | **删除** → 新建 `combat.ts` + `combat-schema.ts`     | LOTM 战斗结算（属性计算、伤害公式、神性修正）                               |
| —                                  | **新建** `status-effect.ts` + schema                 | 状态效果系统（buff/debuff/risk/flag，持续时间，效果结算）                   |
| —                                  | **新建** `attribute-calculator.ts`                   | 六维属性动态计算（攻击力/防御力，按伤害类型）                               |
| —                                  | **新建** `damage-calculator.ts`                      | 伤害计算（物理/神秘/精神/混合，神性修正）                                   |
| —                                  | **新建** `skill-cost-manager.ts`                     | 技能消耗管理（已删除，合并入 combat/ 模块）                                 |
| `economy.ts` + schema              | **改写**                                             | 保留框架，替换货币为便士/金镑                                               |
| `memory.ts` + schema               | 微调                                                 | 保留框架，移除型月特有记忆类型                                              |
| `secret.ts` + schema               | 微调                                                 | 保留框架，替换 servant true name → sequence/途径秘密                        |
| `scene.ts` + schema                | 微调                                                 | 保留框架，替换 situation 枚举                                               |
| `campaign.ts` + schema             | **改写**                                             | 替换 timeline/campaign preset 为 LOTM 世界线                                |
| `offscreen-event.ts` + schema      | 微调                                                 | 保留框架                                                                    |
| `faction-clock.ts`                 | 微调                                                 | 保留框架                                                                    |
| `actor-agenda.ts`                  | 微调                                                 | 保留框架                                                                    |
| `actor-condition.ts` + schema      | **改写**                                             | 替换 wound/outfit 为 LOTM 状态效果                                          |
| `actor-impression.ts`              | 不变                                                 | 保留                                                                        |
| `relationship-signal.ts`           | 不变                                                 | 保留                                                                        |
| `hooks.ts`                         | 不变                                                 | 保留                                                                        |
| `turn-commit.ts`                   | 微调                                                 | event kind 枚举适配 LOTM                                                    |
| `scene-beat-lifecycle.ts`          | 微调                                                 | 保留框架                                                                    |
| `public-projection.ts`             | 微调                                                 | 适配 LOTM 字段                                                              |
| `backstage-*.ts` (8个文件)         | 不变                                                 | 保留全部后台导演基础设施                                                    |

### 2.2 LOTM 核心数值逻辑迁移

从 LOTM 原项目的引擎中提取以下逻辑，用 fate-sandbox 工程标准重写：

| LOTM 原文件                                              | 逻辑                                               | 目标文件                              |
| -------------------------------------------------------- | -------------------------------------------------- | ------------------------------------- |
| `judgment-system.ts` (276行)                             | 序列基准值表、DC 难度系数、成功阈值计算、d100 判定 | `engine/core/judgment.ts`             |
| `damage-calculator.ts` (326行)                           | 伤害公式、神性修正、自定义计算器                   | `engine/core/damage-calculator.ts`    |
| `attribute-calculator.ts` (225行)                        | 攻击力/防御力动态计算、buff/debuff 修正            | `engine/core/attribute-calculator.ts` |
| `status-effect.ts` (254行)                               | 效果应用、持续时间递减、属性修正                   | `engine/core/status-effect.ts`        |
| `skill-cost-manager.ts` (232行)                          | 技能消耗计算、资源扣减                             | `engine/core/skill-cost-manager.ts`   |
| `hero.ts` (175行) + `move.ts` (321行)                    | 战斗角色/技能模型                                  | 合并进 `engine/core/combat.ts`        |
| `codeact.ts` 中的 advance/roll/move_to/attempt_promotion | 时间推进/骰子/移动/晋升                            | 拆分进对应领域模块                    |

**实际完成情况：** 上述 5 个 standalone 文件已删除，合并为 `engine/core/combat/` 模块化子目录（8 个文件、~450 行）。
原 combat.ts 保持转发层。`engine/config/` 新增配置系统为战斗模块提供数据（序列基准值、神性等）。

### 2.3 序列/途径数据结构

```ts
// 途径定义（从 LOTM pathways.json 提取）
interface Pathway {
  id: PathwayId;
  name: string; // "占卜家"
  sequences: SequenceDef[]; // 序列9~序列0
}

interface SequenceDef {
  rank: number; // 9~0
  name: string; // "序列9-占卜家"
  abilities: string[];
  digestionMethod?: string;
  ritualRequirements?: string;
}

// 序列基准值表（从 judgment-system.ts 提取）
const SEQUENCE_BASE_VALUES: Readonly<Record<string, number>> = {
  普通人: 200,
  序列9: 300,
  序列8: 450,
  // ... 序列0: 1200000, 旧日: 3000000, 支柱: 5000000
};

// DC 难度系数
const DIFFICULTY_COEFFICIENTS: Readonly<Record<string, number>> = {
  轻而易举: 0.08,
  寻常之事: 0.16,
  颇为棘手: 0.35,
  九死一生: 0.36,
  亵渎之举: 0.4,
};
```

---

## 3. Phase 3 — Tools 替换

**目标**：保持 fate-sandbox 的「领域事件工具」模式（每个工具是一个窄领域事件），替换为 LOTM 领域逻辑。

### 3.1 工具替换映射

| fate-sandbox 工具             | 操作                           | LOTM 替换工具                                           |
| ----------------------------- | ------------------------------ | ------------------------------------------------------- |
| `initialize_new_game`         | **改写**                       | LOTM 开局初始化（序列、途径、六维、初始现金）           |
| `configure_campaign`          | **改写**                       | LOTM 世界线/战役配置                                    |
| `commit_turn`                 | 微调                           | event kind 适配 LOTM                                    |
| `progress_scene_beat`         | 微调                           | 保留                                                    |
| `get_status`                  | 微调                           | 适配 LOTM 字段                                          |
| `resolve_combat_exchange`     | **删除** → `resolve_combat`    | LOTM 战斗结算（基于 judgment + damage）                 |
| `update_servant_form`         | **删除** → `update_sequence`   | 序列/途径/神性/消化/失控变更                            |
| `update_actor_condition`      | **改写**                       | 状态效果（buff/debuff/risk/flag）变更                   |
| `update_economy`              | 微调                           | 货币替换为便士/金镑                                     |
| `record_memory`               | 微调                           | 保留                                                    |
| `record_offscreen_event`      | 微调                           | 保留                                                    |
| `record_relationship_signal`  | 不变                           | 保留                                                    |
| `record_actor_knowledge`      | 不变                           | 保留                                                    |
| `recall_memory`               | 不变                           | 保留                                                    |
| `update_actor_agenda`         | 不变                           | 保留                                                    |
| `update_actor_impression`     | 不变                           | 保留                                                    |
| `upsert_actor`                | **改写**                       | 适配 LOTM 角色字段                                      |
| `set_scene_presence`          | 不变                           | 保留                                                    |
| `reveal_secret`               | **改写**                       | 替换 servant true name → 途径/序列/真名秘密             |
| `retire_actor`                | 不变                           | 保留                                                    |
| `manage_faction_clock`        | 不变                           | 保留                                                    |
| `update_hook`                 | 不变                           | 保留                                                    |
| `run_parallel_line`           | 不变                           | 保留                                                    |
| `harvest_backstage_candidate` | 不变                           | 保留                                                    |
| `resolve_backstage_line`      | 不变                           | 保留                                                    |
| `private_resolve`             | 不变                           | 保留                                                    |
| `submit_direction_packet`     | 不变                           | 保留                                                    |
| `lookup`                      | **改写**                       | LOTM 世界数据查询（NPC/地点/组织/物品/途径/机制/经济…） |
| `patch_state`                 | 不变                           | debug 工具                                              |
| `override_locked_fact`        | 微调                           | 适配 LOTM locked fact                                   |
| `migrate_state`               | 微调                           | 适配 LOTM schema                                        |
| `reset_state`                 | 不变                           | debug 工具                                              |
| `get_state_schema`            | 不变                           | debug 工具                                              |
| —                             | **新增** `attempt_promotion`   | 序列晋升（魔药消化、仪式、失控风险）                    |
| —                             | **新增** `apply_status_effect` | 施加/移除状态效果                                       |
| —                             | **新增** `roll_dice`           | 独立骰子工具                                            |
| —                             | **新增** `move_to`             | 位置移动（含坐标）                                      |

### 3.2 工具描述风格

保持 fate-sandbox 的风格：紧凑的「一行用途 + 使用边界 bullet + 禁区 bullet」，不写 reasoning-bait 长清单。

### 3.3 涉及文件

| 目录                     | 操作                    |
| ------------------------ | ----------------------- |
| `tools/registry.ts`      | 更新工具清单            |
| `tools/state/`           | 逐文件改写/新建/删除    |
| `tools/lookup/lookup.ts` | **重写**：LOTM 数据查询 |
| `tools/runtime/`         | 不变                    |

---

## 4. Phase 4 — Data 替换

**目标**：用 LOTM 世界书数据替换型月世界数据，保留 fate-sandbox 的数据组织方式。

### 4.1 数据替换映射

| fate-sandbox 数据                    | 操作     | LOTM 替换数据                                  |
| ------------------------------------ | -------- | ---------------------------------------------- |
| `data/characters.json` (517行)       | **替换** | LOTM characters.json (1019行, 76 NPC)          |
| `data/locations.json` (962行)        | **替换** | LOTM locations.json (1434行, 91 地点)          |
| `data/servants.json` (2031行)        | **删除** | 不需要从者数据                                 |
| `data/world.json` (29行)             | **替换** | LOTM world_lore.json (119行)                   |
| `data/timelines.json` (20行)         | **替换** | LOTM 世界线定义（第五纪时间线）                |
| `data/campaign-presets.ts` (587行)   | **替换** | LOTM 战役预设（廷根线、贝克兰德线、拜亚姆线…） |
| `data/timeline-pressure-palettes.ts` | **替换** | LOTM 压力调色板（适配 LOTM 势力）              |
| `data/NOTICE.md`                     | 更新     | LOTM 数据来源说明                              |
| —                                    | **新增** | `data/organizations.json` (300行, 21 组织)     |
| —                                    | **新增** | `data/items.json` (772行, 52 物品)             |
| —                                    | **新增** | `data/pathways.json` (166行, 22 途径)          |
| —                                    | **新增** | `data/mechanics.json` (610行)                  |
| —                                    | **新增** | `data/economy.json` (101行)                    |
| —                                    | **新增** | `data/narrative.json` (150行)                  |
| —                                    | **新增** | `data/system_rules.json` (221行)               |
| —                                    | **新增** | `data/theater.json` (230行)                    |
| —                                    | **新增** | `data/dlc.json` (203行)                        |

### 4.2 数据格式对齐

LOTM 原数据是 SillyTavern 世界书格式（id/position/comment/content/keys/constant/selective/status）。
fate-sandbox 的 lookup 引擎期望结构化数据。

**策略**：保留世界书条目格式作为底层存储，在 `engine/world-data/lookup.ts` 中做查询适配。
或者将关键数据提取为结构化 JSON（推荐，因为 fate-sandbox 的 lookup 已经是结构化的）。

### 4.3 原著小说数据

LOTM 项目包含 `data/novel/` 目录（8 部，1400+ 章节 markdown）。
这些是参考资料，**不进发布包**，但可作为 GM 的 lookup 数据源。
建议放在 `data/novel/` 并加入 `.gitignore` 或作为可选下载。

---

## 5. Phase 5 — Agents/Prompts 替换

**目标**：保持 fate-sandbox 的分层 prompt 架构，替换全部型月内容为 LOTM 内容。

### 5.1 Prompt 替换映射

| fate-sandbox prompt 文件             | 行数 | 操作                 | LOTM 替换内容                                            |
| ------------------------------------ | ---- | -------------------- | -------------------------------------------------------- |
| `agents/system-settlement.md`        | 12   | **改写**             | 结算器系统提示（移除型月术语）                           |
| `agents/system-render.md`            | 77   | **改写**             | 渲染器系统提示（移除型月术语）                           |
| `agents/gm-context.md`               | 28   | **改写**             | 世界边界：诡秘之主世界观、非凡者体系、维多利亚时代       |
| `agents/gm-rules.md`                 | 43   | **改写**             | 硬规则：序列层级、魔药消化、失控风险、扮演法、神秘学边界 |
| `agents/gm-tool-policy.md`           | 67   | **改写**             | 工具路由：LOTM 工具调用边界                              |
| `agents/gm-story-driver.md`          | 36   | **改写**             | 剧情推进纪律：序列晋升、途径选择、阵营周旋               |
| `agents/gm-render.md`                | 49   | **改写**             | 渲染规则：维多利亚时代都市 + 神秘学风                    |
| `agents/gm-style-rules.md`           | 288  | **改写**             | 文风规则：诡秘之主原著文风                               |
| `agents/gm-style-blacklist.md`       | 32   | **改写**             | 文风黑名单                                               |
| `agents/gm-input-guide.md`           | 28   | **改写**             | 输入解释                                                 |
| `agents/gm-output-contract.md`       | 35   | **改写**             | 输出格式                                                 |
| `agents/gm-direction.md`             | 39   | **改写**             | 方向包                                                   |
| `agents/gm-settlement-principles.md` | 19   | **改写**             | 结算原则                                                 |
| `agents/gm-social-guide.md`          | 41   | **改写**             | 社交指南                                                 |
| `agents/gm-turn-reminder.md`         | 5    | **改写**             | 回合提醒                                                 |
| `agents/protagonist-impression.md`   | 29   | **改写**             | 主角印象卡                                               |
| `agents/preset-render.json`          | 更新 | 渲染 preset 槽位映射 |
| `agents/preset-settlement.json`      | 更新 | 结算 preset 槽位映射 |
| `agents/parallel-lines/README.md`    | 更新 | 后台平行线说明       |

### 5.2 prompt 内容要点

从 LOTM 原项目的 `agents/gm.md`（32行）提取核心叙事要求，扩展到 fate-sandbox 的分层结构中：

- 第二人称叙事
- 维多利亚时代都市与神秘学并存的世界感
- 尊重玩家选择，允许失败带来后果
- 序列晋升必须调用工具
- 判定难度固定枚举
- 地点/NPC 必须先 lookup 再写叙事

---

## 6. Phase 6 — Skills 替换

### 6.1 start-game 技能

| 项       | fate-sandbox                         | LOTM 替换                                        |
| -------- | ------------------------------------ | ------------------------------------------------ |
| 流程     | 型月开局（时间线/立场/开场身份选择） | LOTM 开局（性别/途径/起点确认）                  |
| 默认值   | 型月默认（Fuyuki, Saber…）           | LOTM 默认（男, 序列9-偷盗者, 廷根）              |
| 知识分层 | 型月 public/secrets/player           | LOTM public/secrets/player（途径秘密、序列秘密） |
| 新手模式 | 不了解 Fate 的玩家                   | 不了解 LOTM 的玩家                               |
| 真名防线 | 从者真名防泄露                       | 途径/序列秘密防泄露（如有穿越者设定）            |

### 6.2 其他技能

| 技能              | 操作                          |
| ----------------- | ----------------------------- |
| `social-protocol` | 微调：适配 LOTM 社交场景      |
| `romance`         | 微调：适配 LOTM 浪漫线        |
| `intimacy`        | 微调：适配 LOTM 亲密关系      |
| `time-sense`      | **改写**：LOTM 历法（第五纪） |
| `input-protocol`  | 不变                          |

---

## 7. Phase 7 — Extensions & Subagents

### 7.1 extensions/

| 扩展                  | 操作                                              |
| --------------------- | ------------------------------------------------- |
| `player-panel/`       | **改写**：UI panel 适配 LOTM 字段（序列等）       |
| `player-choices/`     | 不变                                              |
| `rewind/`             | 不变                                              |
| `two-pass-render/`    | 不变                                              |
| `compaction-policy/`  | 微调：compaction 触发条件适配                     |
| `subagents/timeline/` | **改写**：timeline 审计内容替换为 LOTM 世界线审计 |

### 7.2 .pi/agents/

| 文件                     | 操作                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| `timeline-showrunner.md` | **改写**：替换型月审计规则为 LOTM 审计规则（途径 drift、序列滥用、世界运转…） |

### 7.3 extensions/subagents/timeline/

| 文件                | 操作                               |
| ------------------- | ---------------------------------- |
| `index.ts`          | 微调：lookup 数据源适配 LOTM       |
| `task-injection.ts` | 微调：state context 适配 LOTM 字段 |

---

## 8. Phase 8 — 测试 & 脚本

### 8.1 测试策略

- 所有引擎确定性逻辑必须有测试（判定公式、伤害计算、状态效果、序列晋升、时间推进）
- 不测 LLM 行为
- 测试文件跟源文件同目录

### 8.2 需要新建的测试

| 测试                              | 说明                                     |
| --------------------------------- | ---------------------------------------- |
| `judgment.test.ts`                | 序列基准值、DC 计算、d100 判定、运气修正 |
| `damage-calculator.test.ts`       | 四种伤害类型、神性修正、buff/debuff 修正 |
| `attribute-calculator.test.ts`    | 攻击力/防御力计算、各种伤害类型          |
| `sequence-promotion.test.ts`      | 晋升成功/失败、消化进度、失控风险        |
| `state-schema.test.ts`            | LOTM state schema 校验                   |
| `state-migration.test.ts`         | v1 迁移（初始为空）                      |
| `new-game-initialization.test.ts` | 开局初始化                               |
| `economy.test.ts`                 | 便士/金镑经济                            |

### 8.3 脚本

| 脚本                       | 操作                  |
| -------------------------- | --------------------- |
| `scripts/audit-session.ts` | 微调：适配 LOTM state |
| `scripts/export-book.ts`   | 不变                  |
| `scripts/render-bench.ts`  | 不变                  |

---

## 9. Phase 9 — 项目配置 & 发布

### 9.1 项目配置

| 文件                | 操作                                            |
| ------------------- | ----------------------------------------------- |
| `package.json`      | 改 name/description/keywords                    |
| `tsconfig.json`     | 不变                                            |
| `.oxlintrc.json`    | 不变                                            |
| `.oxfmtrc.json`     | 不变                                            |
| `knip.json`         | 不变                                            |
| `.gitignore`        | 不变                                            |
| `.pi/settings.json` | 更新 name/description                           |
| `.pi/agents/`       | 更新 timeline-showrunner                        |
| `AGENTS.md`         | **改写**：领域段落替换为 LOTM，工程纪律段落不变 |
| `README.md`         | **重写**：LOTM 项目说明                         |
| `start.sh`          | 改项目名、默认参数                              |
| `start.ps1`         | 同上                                            |
| `context.md`        | **重写**：LOTM 项目上下文                       |

### 9.2 发布纪律

- 不提交 `sessions/`、`state/`、`.pi/agent/`、`.pi/npm/`
- 不提交 `agents/user/`（本地玩家印象）
- 不提交 `data/novel/`（原著小说，版权风险）
- `docs/` 不进 release zip
- License: LOTM 世界观权利归爱潜水的乌贼所有；代码 GPL-3.0-or-later

---

## 10. 执行顺序 & 里程碑

### Milestone 1: 骨架可编译（1-2 天）

1. 复制 fate-sandbox 为新项目（或原地改）
2. Phase 9 项目配置
3. Phase 1 State Schema（types + schema + migration）
4. `pnpm typecheck` 通过（引擎核心编译通过）

### Milestone 2: 引擎核心可运行（2-3 天）

1. Phase 2 Engine Core 领域模块
2. Phase 8 测试（随引擎同步写）
3. `pnpm typecheck && pnpm lint && pnpm test` 通过

### Milestone 3: 工具链可用（1-2 天）

1. Phase 3 Tools 替换
2. 工具注册 + schema 校验

### Milestone 4: 数据可用（1 天）

1. Phase 4 Data 替换
2. lookup 查询可用

### Milestone 5: Prompt 可游玩（2-3 天）

1. Phase 5 Agents/Prompts
2. Phase 6 Skills
3. 端到端测试：开局 → 几轮游玩

### Milestone 6: 高级功能（2-3 天）

1. Phase 7 Extensions & Subagents
2. 后台导演适配
3. UI panel 适配

### Milestone 7: 发布就绪（1 天）

1. 全量 `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
2. 发布包检查
3. README + 文档

---

## 11. 风险 & 注意事项

### 11.1 数据迁移风险

- LOTM 原数据是世界书格式（comment/content/keys），需要确认是保留原格式还是结构化（已经改为MD，可读性更强）

### 11.2 数值平衡风险

- LOTM 原项目的判定/伤害公式来自 SillyTavern 角色卡的 JS 脚本
- 迁移到领域事件工具后，不要用复杂公式了，没必要，直接用简单的计算

### 11.3 工具粒度变化

- LOTM 原项目用单一 `code_act` 执行任意 JS
- fate-sandbox 用 30+ 窄领域事件工具
- 迁移后不要再用复杂的逻辑了，直接用领域事件逻辑
- GM 不能再写任意代码，必须走工具
- 这意味着 prompt 中的工具路由说明需要非常清晰
- 也意味着需要让 GM prompt 粒度与 fate-sandbox 对齐

### 11.4 后台导演适配

- fate-sandbox 的后台导演是为型月多阵营圣杯战争设计的
- LOTM 的世界运转逻辑不同（非凡者社会、教会/值夜者/机械之心等势力）
- 导演 persona 和 prompt 需要重写（但可以直接仿制）

### 11.5 时间系统

- fate-sandbox 用 ISO 8601 时间 + timezone
- LOTM 用「第五纪 X年X月X日 星期X HH:MM」
- 需要重写 date-time.ts，但保持接口兼容（startedAt/currentAt 用 ISO 内部存储，显示时转换）

### 11.6 坐标系统

- LOTM 有坐标系统（x, y 经纬度）
- fate-sandbox 的 location 是结构化对象
- 直接复用结构化对象，不要搞复杂的坐标系统，还得专门做一个move_to，不值得
