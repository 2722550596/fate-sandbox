# Actor-Condition 拆分调研报告

## 模糊点 1：Turn event 契约链 — `actor-condition` 已是 tracked-item 和 affliction 的混合体

### 文件 & 行号

| 文件                                           | 行范围         | 内容                                                                                        |
| ---------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `engine/core/state/turn-commit.ts`             | 26-32          | `TurnCommitEvent` discriminated union — `"actor-condition"` 作为单一 kind                   |
| `engine/core/state/turn-commit.ts`             | 78-95          | `applyTurnEvent` switch dispatch — 直接路由到 `updateActorCondition()`                      |
| `engine/core/actor/actor-condition.ts`         | 27-44          | `applyActorConditionEvent` switch — 7 个子 kind                                             |
| `engine/core/actor/actor-condition-schema.ts`  | 25-33, 109-116 | `ACTOR_CONDITION_EVENT_KINDS` 和 `ActorConditionEvent` 类型                                 |
| `engine/tools/scene/commit-turn-normalizer.ts` | 14-21, 49-56   | `TURN_EVENT_KINDS` 含 `"actor-condition"`；normalizer 分发到 `normalizeActorConditionEvent` |

### 结论

**这个引用同时承载了 affliction（add-affliction / resolve-condition / update-wound）和 tracked-item（add-tracked-item / update-tracked-item / transfer-tracked-item）以及 outfit（change-outfit）。** 它是一个已经混合了两种不同领域的概念实体。

### 证据

`ActorConditionEvent` discriminated union 的 7 个 variant：

- **affliction 相关**：`add-affliction`, `resolve-condition`, `update-wound`（作用于 `actor.condition.afflictions[]`）
- **outfit 相关**：`change-outfit`（作用于 `actor.presentation.outfit`）
- **tracked-item 相关**：`add-tracked-item`, `update-tracked-item`, `transfer-tracked-item`（作用于 `state.public.trackedItems[]`）

三者共享同一个 turn event kind `"actor-condition"`，同一个 normalizer `normalizeActorConditionEvent`，同一个 switch dispatch 入口 `updateActorCondition`。

### 拆分难点

**如果要新增一个独立的 `"tracked-item"` turn event kind：**

1. **`TurnCommitEvent`**（turn-commit.ts:26-32）：加 `| { kind: "tracked-item"; event: TrackedItemEvent }`
2. **`TurnCommitEventResult`**（turn-commit.ts:40-46）：加 `| { kind: "tracked-item"; result: TrackedItemEventResult }`
3. **`applyTurnEvent`**（turn-commit.ts:78-95）：加 `case "tracked-item":`
4. **`TURN_EVENT_KINDS`**（commit-turn-normalizer.ts:14-21）：加 `"tracked-item"`
5. **`normalizeTurnCommitEvent`**（commit-turn-normalizer.ts:35-79）：加 `case "tracked-item":`
6. **`normalizeTurnEventKind` 的 error message**：更新允许列表
7. **新建 `TrackedItemEvent` 类型**（analogous to `ActorConditionEvent`，但只含 tracked-item 的三个 variant）
8. **新建 `applyTrackedItemEvent`**：从 `actor-condition.ts` 中抽出 `addTrackedItem`, `updateTrackedItem`, `transferTrackedItem`
9. **新建 `tracked-item.ts` schema**（analogous to `actor-condition-schema.ts`，只含那三个 variant）
10. **新建 `tracked-item-normalizer.ts`**
11. **从 `actor-condition.ts` 中删除那三个函数**，`actor-condition-schema.ts` 中删除那三个 schema

### 拆分难度评估

**中高**。改动面涉及：

- 3 个核心引擎文件（turn-commit.ts, actor-condition.ts, actor-condition-schema.ts）
- 1 个 normalizer（commit-turn-normalizer.ts）
- 新增 3 个文件（tracked-item.ts, tracked-item-schema.ts, tracked-item-normalizer.ts）
- 约 150-200 行新增/移动代码
- 无协议兼容性问题（硬切即可，没有旧 state 需迁移）
- 风险在于：combat-exchange-lotm.ts 和 update-corruption.ts 中的 `"actor-condition"` 引用需要逐一判断真实语义（见下）

---

## 模糊点 2：obligation 系统中 `"actor-condition"` 的语义

### 文件 & 行号

| 文件                                | 行范围  | 内容                                                                                                  |
| ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `engine/core/state/state.ts`        | 115-122 | `TurnObligationKind` — 含 `"actor-condition"`                                                         |
| `engine/core/state/state-schema.ts` | 342-350 | `TURN_OBLIGATION_KINDS` — 含 `"actor-condition"`                                                      |
| `engine/core/obligations.ts`        | 50      | `OBLIGATION_KIND_GUIDANCE` — 描述为 `"actor-condition 事件（update_actor_condition 或 commit_turn）"` |

### 结论

**这个引用是泛化混合引用。** obligation kind `"actor-condition"` 覆盖了 affliction、tracked-item 和 outfit 所有三类子事件。`OBLIGATION_KIND_GUIDANCE` 的描述没有区分它们，说明目前设计上 obligation 系统把这三类视为同一个义务类别。

### 拆分影响

如果新增 `"tracked-item"` TurnObligationKind：

- `TurnObligationKind`（state.ts:115-122）：加 `"tracked-item"`
- `TURN_OBLIGATION_KINDS`（state-schema.ts:342-350）：加 `"tracked-item"`
- `OBLIGATION_KIND_GUIDANCE`（obligations.ts:47-55）：加一条
- `settleOldestObligation(draft, ["actor-condition"])` 的调用点需要决定是否同时清 `"tracked-item"` 义务，或各自独立
- **核心问题**：combat/update-corruption 设置的 `"actor-condition"` obligation 在新系统下该设成 `"actor-condition"` 还是 `"tracked-item"`？这取决于那些调用点的实际语义（见模糊点 3）

### 拆分难度评估

**低到中**。schema 改动约 5 行，但调用点的语义分析是前置条件。

---

## 模糊点 3：战斗系统与 corruption 中的 `"actor-condition"` 引用

### 3a. `engine/core/combat-exchange-lotm.ts`

| 行号    | 代码                                                                                                                                         | 用途                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 45      | `type LOTMStateLandingKind = ... \| "actor-condition" \| ...`                                                                                | 类型定义，注释"角色状态变化（伤势/异常/消耗）" |
| 228-233 | `landings.push({ kind: "actor-condition", required: true, reason: "失利或绝境交锋需要伤势、疲劳、失控值提升、灵感消耗或其他可审计代价。" })` | 代价落点                                       |
| 235-240 | `landings.push({ kind: "actor-condition", required: false, reason: "高风险代价可落在灵感消耗、失控值提升、暴露或消耗品..." })`               | 可选代价落点                                   |

### 结论

**这些引用是 affliction 相关，不是 tracked-item 相关。** 战斗系统用 `"actor-condition"` 表示"需要给角色施加伤势/异常/失控/消耗"，这些都是 affliction（状态效果），不是物品追踪。reason 文本明确说"伤势、疲劳、失控值提升、灵感消耗"。

**不需要改这些为 `"tracked-item"`。**

### 3b. `engine/tools/lotm/update-corruption.ts`

| 行号  | 代码                                                                                                                                   | 用途                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 81-82 | `// 清一条 actor-condition 类的义务（如果来自 consume_item 或 combat 的裁决）` + `settleOldestObligation(draft, ["actor-condition"]);` | 腐败值更新后清一条义务 |

### 结论

**这个引用是 affliction 相关，不是 tracked-item 相关。** corruption（失控值提升）是 affliction 的语义域（`lossOfControlProgress` 在 actor sequence 上）。consume_item 消耗品虽然涉及物品，但这里清的义务是 corruption 变化导致的"角色状态变化"义务，不是物品追踪义务。

**不需要改这些为 `"tracked-item"`。**

### 拆分影响

如果新增 `"tracked-item"` 的 obligation kind：

- `combat-exchange-lotm.ts` 仍产生 `"actor-condition"` obligation（语义是 affliction）
- `update-corruption.ts` 仍清 `["actor-condition"]`（语义是 affliction）
- 新增的 tracked-item 事件在 `applyTrackedItemEvent` 中应执行 `settleOldestObligation(draft, ["tracked-item"])`，而不是 `["actor-condition"]`
- 新增的 tracked-item 义务来源（如装备损坏、消耗品使用）由对应的工具（如 combat-exchange 的 `"equipment"` landing）来决定产生哪种 obligation

### 拆分难度评估

**低**。combat-exchange 和 corruption 的引用不需要改。只需要确认：

- 当前有没有任何 tracked-item 操作产生了 `"actor-condition"` obligation → **没有**。tracked-item 操作目前在 `actor-condition.ts` 中执行，它们也会调用 `settleOldestObligation(draft, ["actor-condition"])`，但这是在同一个函数里——如果拆开，tracked-item 函数要改成清 `"tracked-item"` obligation。

---

## 模糊点 4：state 中 tracked item 的 schema 完整定义

### 文件 & 行号

| 文件                                      | 行范围  | 内容                                                                                                |
| ----------------------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `engine/core/state/state.ts`              | 468-478 | `TrackedItemState` 接口                                                                             |
| `engine/core/state/state-schema.ts`       | 238-248 | `TRACKED_ITEM_STATE_SCHEMA`                                                                         |
| `engine/core/state/state-enum-schemas.ts` | 222-236 | `TRACKED_ITEM_KINDS`, `TRACKED_ITEM_CONDITIONS`, `TRACKED_ITEM_VISIBILITIES`（推断）                |
| `engine/core/state/state.ts`              | 92      | `trackedItems: Record<ItemId, TrackedItemState>` 在 `PublicGameState`                               |
| `engine/core/state/state-schema.ts`       | 407     | `trackedItems: Type.Record(Type.String(), TRACKED_ITEM_STATE_SCHEMA)` 在 `PUBLIC_GAME_STATE_SCHEMA` |

### 完整定义

**`TrackedItemState`**（state.ts:468-478）：

```ts
export interface TrackedItemState {
  id: ItemId;
  label: string;
  kind: TrackedItemKind; // "mundane" | "weapon" | "sealed-artifact" | "beyonder-item" | "consumable" | "other"
  ownerActorId: ActorId | null;
  holderActorId: ActorId | null;
  location: LocationState | null;
  condition: TrackedItemCondition; // "intact" | "damaged" | "broken" | "spent" | "unknown"
  visibility: TrackedItemVisibility;
  notes: string[];
}
```

**`TRACKED_ITEM_STATE_SCHEMA`**（state-schema.ts:238-248）：

```ts
export const TRACKED_ITEM_STATE_SCHEMA = Type.Object({
  id: NON_EMPTY_STRING_SCHEMA,
  label: NON_EMPTY_STRING_SCHEMA,
  kind: TRACKED_ITEM_KIND_SCHEMA,
  ownerActorId: nullable(NON_EMPTY_STRING_SCHEMA),
  holderActorId: nullable(NON_EMPTY_STRING_SCHEMA),
  location: nullable(LOCATION_STATE_SCHEMA),
  condition: TRACKED_ITEM_CONDITION_SCHEMA,
  visibility: TRACKED_ITEM_VISIBILITY_SCHEMA,
  notes: NON_EMPTY_STRING_ARRAY_SCHEMA,
});
```

### 结论

tracked-item 有自己独立且完整的 schema、state 字段（`state.public.trackedItems`）、枚举系统。它与 actor-condition 的耦合纯粹是**事件层**的——三个 tracked-item 事件的 kind（`add-tracked-item`, `update-tracked-item`, `transfer-tracked-item`）被放在了 `ActorConditionEvent` 的 discriminated union 下，但 state 层完全独立。

### 拆分难度评估

**低**。State schema 完全不需要改。只有事件层（事件类型、schema、dispatch、normalizer）需要拆。

---

## 模糊点 5：其他引用 actor-condition 的工具

### 文件 & 行号

| 文件                                               | 行      | 内容                                                            |
| -------------------------------------------------- | ------- | --------------------------------------------------------------- |
| `engine/tools/registry.ts`                         | 9, 55   | import 和注册 `updateActorConditionToolDefinition`              |
| `engine/tools/actor/update-actor-condition.ts`     | 6, 8    | import `updateActorCondition` 和 `normalizeActorConditionEvent` |
| `engine/tools/actor/actor-condition-normalizer.ts` | 1, 3    | import `ActorConditionEvent` 和 `parseActorConditionEvent`      |
| `engine/core/actor/actor-condition.ts`             | 1, 2, 8 | import `ActorConditionEvent`, re-export                         |
| `engine/core/state/turn-commit.ts`                 | 1, 9    | import types 和 `updateActorCondition` 函数                     |

### 结论

Import 链确认：

- `registry.ts` → `update-actor-condition.ts` → `actor-condition-normalizer.ts` → `core/actor/actor-condition.ts` → `core/actor/actor-condition-schema.ts`
- `commit-turn-normalizer.ts` → `actor-condition-normalizer.ts`
- `turn-commit.ts` → `core/actor/actor-condition.ts` （同时 import type 和 function）

**无遗漏。** 没有其他工具直接绕过这个链。

### 拆分影响

如果拆分 tracked-item 为独立事件系统：

- `update-actor-condition.ts` 要删掉 tracked-item 相关的三个 variant
- 新增 `update-tracked-item.ts` 工具，注册到 `registry.ts`
- 新增 `tracked-item-normalizer.ts`
- `commit-turn-normalizer.ts` 要 import 新的 normalizer

---

## 汇总：按最需要关心的顺序

| 优先级 | 模糊点                    | 难度 | 关键结论                                                                                                                                            |
| ------ | ------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | 1. Turn event 契约链      | 中高 | actor-condition 承载了 affliction + outfit + tracked-item 三个领域。新增 `"tracked-item"` kind 涉及 3 个核心引擎文件 + 1 个 normalizer + 3 个新文件 |
| **P0** | 2. Obligation 系统        | 低中 | 需要加 `"tracked-item"` obligation kind，但语义判定需前置——combat/affliction 仍用 `"actor-condition"`                                               |
| **P0** | 3. 战斗 & corruption 引用 | 低   | **都是 affliction 语义**，不需要改；确认即可                                                                                                        |
| **P1** | 4. Tracked item schema    | 低   | State schema 完全独立，不需要改                                                                                                                     |
| **P1** | 5. 工具链引用             | 中   | 需拆分工具注册和 normalizer                                                                                                                         |

### 前置条件

在任何拆分工作开始前必须确认：

1. `combat-exchange-lotm.ts` 和 `update-corruption.ts` 中的 `"actor-condition"` 引用仍应产生/清除 affliction 类义务，不需要改为 `"tracked-item"`
2. 如果从 `actor-condition.ts` 中移除 tracked-item 三个函数，要确保 no tracked-item 操作目前依赖 `settleOldestObligation(draft, ["actor-condition"])` 来清 affliction 义务 — 拆完后 tracked-item 事件应清 `["tracked-item"]` 义务
3. 无旧 state 迁移需求：state 层 schema 不变，事件层是硬切
