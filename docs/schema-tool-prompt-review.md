# Schema review from tool-calling and prompt-injection perspective

## Thesis

Schema 是这个项目的地基。坏 schema 不只是状态难看，它会沿着三条路径污染整个系统：

1. **工具调用污染**：工具参数会被迫暴露烂字段，GM 开始用裸 patch 修补世界。
2. **提示词注入污染**：快照越像数据库 dump，模型越会复述字段、编造字段、绕开工具。
3. **叙事污染**：状态若不能表达 Fate 语义，GM 会把 Fate 写成通用 RPG。

因此 schema 不能按“现在有哪些字段”设计，必须按“GM 应该如何调用工具”和“每轮应该注入什么最小事实”反推。

## 当前系统暴露的问题

当前 prompt 注入路径大致是：

```txt
last user 前插入 gm-context
last user 后插入完整 state JSON + pressure notes
再插入 gm-rules
```

问题：

- 完整 JSON 快照会诱导模型把 schema 当作玩家可见文本。
- JSON 字段名会进入叙事，尤其是 `危险度`、`魔力负担` 这类抽象数值。
- 工具返回和注入快照有优先级竞争，虽然规则说“工具返回覆盖快照”，但模型仍可能混用旧快照。
- 状态字段越通用，工具 description 越通用，最后只剩 `patch_state` 万能口。
- `patch_state` 让 GM 面对路径，而不是面对游戏动作；路径一烂，所有工具调用都会烂。

## 设计原则

### 1. Canonical state 不等于 prompt snapshot

必须分三层：

```txt
Canonical State  # engine 真相源，结构完整，供工具读写
Tool View        # 每个工具的输入/输出 DTO，按动作设计
Prompt Brief     # 每轮注入给 GM 的极小只读摘要
```

禁止直接把 canonical state 整体 JSON 注入 prompt。

### 2. 工具应该表达动作，不表达字段路径

坏：

```txt
patch_state([{ path: "/protagonist/servant/manaSp", value: 42 }])
```

好：

```txt
update_servant_condition({
  target: "protagonist",
  manaDelta: -20,
  reason: "真名解放",
})
```

工具参数应该逼迫 GM 说明“为什么发生变化”，而不是只给“新值”。

### 3. Schema 字段必须服务工具决策

每个 canonical 字段都要回答：

- 哪个工具会写它？
- 哪个工具会读它？
- 它是否需要每轮注入？
- 它是否玩家可见？
- 它是否允许 GM 直接更新？
- 它是否会漂移？如果会，锁在哪里？

回答不了的字段不要进 schema。

### 4. 写模型和读模型分离

Canonical state 可以细，但 prompt brief 必须短。

例如 servant canonical state：

```ts
interface ServantCoreState {
  className: ServantClass;
  trueName: TrueNameState;
  spiritualCoreHp: Percent;
  manaSp: Percent;
  contract: ServantContractState;
  baseParams: FateParams;
  paramModifiers: ParamModifier[];
  classSkills: RankedSkill[];
  personalSkills: RankedSkill[];
  noblePhantasms: NoblePhantasm[];
  permanentDefects: PermanentDefect[];
}
```

但 prompt brief 只应注入：

```txt
从者：Saber，真名隐藏，灵基稳定，魔力平稳，契约稳定。
当前长期影响：右胸概念伤，HP 上限受限。
本轮注意：宝具未公开；不要让 GM 临场新增宝具。
```

### 5. 所有 list 必须有 id 和生命周期

坏：

```ts
abilities: string[];
wounds: string[];
```

好：

```ts
interface AbilityState {
  id: string;
  name: string;
  source: string;
  visibility: KnowledgeVisibility;
  locked: boolean;
}
```

没有 id 的数组会导致：

- 工具无法稳定更新。
- 记忆无法引用来源。
- prompt 摘要无法去重。
- GM 容易重复添加同一个能力/伤势。

### 6. 区分玩家可知、GM 可知、系统锁定

主状态只应记录“玩家视角下可用的机械事实”。幕后真相不要随便进 prompt brief。

建议每个容易泄密的对象有 visibility：

```ts
type KnowledgeVisibility = "player-known" | "suspected" | "hidden";
```

但注意：如果当前没有 subagent/secret store，不要把完整幕后真相塞进 `hidden` 字段再注入给 GM。`hidden` 字段只能存在于 canonical state，不进入 prompt brief。

## 对 ground-up schema 的修正建议

当前 `GameState` 草案方向正确，但从工具调用角度还需要收紧。

### Revised top-level shape

```ts
interface GameState {
  meta: StateMeta;
  campaign: CampaignState;
  clock: ClockState;
  scene: SceneState;
  protagonist: ProtagonistState;
  allies: AllyState[];
  economy: EconomyState;
  memory: CampaignMemory;
  locks: StateLock[];
}
```

建议暂时移除顶层：

```ts
factions: FactionState[];
knownCharacters: KnownCharacterState[];
party: PartyState;
```

理由：

- `knownCharacters` 和 `factions` 很容易膨胀，注入时变成世界书 dump。
- 大多数角色/阵营事实应在 `data/` + lookup；状态只记录“本局发生的变化”。
- `party` 可以简化成 `allies`，避免 allied servants / companions 双数组导致工具选择困难。

更好的表达：

```ts
type AllyState = ServantAllyState | HumanAllyState | OtherAllyState;
```

### CampaignState 应只放本局配置，不放长规则文本

坏：

```ts
worldviewFilters: WorldviewFilter[]; // 里面塞长 rule 字符串
```

建议：

```ts
interface CampaignState {
  title: string;
  timeline: TimelineId;
  openingMode: OpeningMode;
  premise: string;
  activeRuleSetIds: RuleSetId[];
}
```

规则文本留在 `agents/gm-rules.md` 或 `data/rules.json`，state 只保存启用哪些规则。

### SceneState 要成为 prompt brief 的核心

`scene` 是每轮最该注入的东西，必须短而稳定。

```ts
interface SceneState {
  location: LocationState;
  situation: SituationKind;
  presentActorIds: string[];
  activeObjectiveIds: string[];
  threatIds: string[];
  lastResolvedAt: string;
}
```

`ObjectiveState` / `ThreatState` 可以存在 canonical state 里，但 prompt brief 只展示 active 的摘要。

### ProtagonistState 需要拆“身份锁定”和“当前状态”

现在的 `ProtagonistBase` 混了永久设定和当前可变状态。

建议：

```ts
interface ProtagonistBase {
  kind: ProtagonistKind;
  identity: IdentityState;
  presentation: PresentationState;
  condition: ConditionState;
  inventory: InventoryState;
  abilities: AbilityState[];
}

interface IdentityState {
  publicIdentity: string;
  background: string;
  lockedFacts: LockedFact[];
}
```

原因：

- 身世、职阶、真名、基础参数是锁定事实。
- 服装、伤势、装备、当前位置是当前状态。
- 工具调用必须区分“更新当前状态”和“改变身份事实”。

### ServantCoreState 要显式声明锁定字段

不要只靠 prompt 说“不能改”。schema 里要表达。

```ts
interface ServantCoreState {
  identity: ServantIdentityState;
  condition: ServantConditionState;
  contract: ServantContractState;
  parameters: ServantParameterState;
  skills: ServantSkillState;
  noblePhantasms: NoblePhantasm[];
}

interface ServantIdentityState {
  className: ServantClass;
  trueName: TrueNameState;
  locked: true;
}

interface ServantParameterState {
  base: FateParams;
  modifiers: ParamModifier[];
  baseLocked: true;
}
```

工具 `update_servant` 只能写：

- `condition`
- `contract`
- `parameters.modifiers`
- `currentOrder`
- `permanentDefects`

不能写：

- `identity.className`
- `identity.trueName.value`
- `parameters.base`
- `noblePhantasms`，除非使用 debug/initialization 专用工具。

### Memory 需要分“事实”和“日志”

现有 `CampaignMemory` 可以，但工具调用角度建议明确：

```ts
interface CampaignMemory {
  pinnedFacts: MemoryFact[];
  eventLog: MajorEventMemory[];
  dailySummaries: DailySummaryMemory[];
}
```

不要把 `protagonistBackground` 同时放在 `memory` 和 `protagonist.background`，否则双写必然漂移。

建议：

- `protagonist.identity.background` 是真相源。
- `memory.pinnedFacts` 可以有一条引用它的事实，但不要复制全文。

## Prompt injection redesign

### 不再注入完整 state JSON

当前 `buildStatePressureMessage()` 应替换为：

```txt
buildGmBriefMessage()
```

内容结构：

```txt
[当前 GM 简报]
时间：2004-01-30 周五 16:00 JST
地点：冬木市 · 深山镇 · 穗群原学园 · 校门外
态势：daily / investigation / combat

玩家角色：从者 / Saber / 真名隐藏 / 魔力平稳 / 契约稳定
同行者：远坂凛（临时同盟，戒备）
资源：现金 50,000 円；关键装备：...
伤势/长期影响：...

本局锁定事实：
- 玩家职阶一经确立，禁止改写。
- 宝具列表已锁定，禁止临场新增。

最近重大记忆：
- ...

本轮工具纪律：
- 状态变化必须调用对应 update 工具。
- 不要输出数值、schema 字段、JSON、内部规则名。
```

### Prompt brief 应由专门函数生成

新增：

```ts
export interface GmBrief {
  text: string;
  sourceStateUpdatedAt: string;
}

export function buildGmBrief(state: GameState): GmBrief;
```

它是唯一允许进入 prompt 的状态表示。

### 工具返回优先级要减少冲突

工具返回也不要 dump state。每个写工具返回：

```txt
已更新：魔力 SP 下降，原因：宝具真名解放。
叙事约束：必须表现供魔压力；禁止写成无消耗。
```

并在 `details` 中携带 machine-readable delta，供 TUI render，不供 GM 叙事复述。

## Tool set redesign

### 禁用裸 `patch_state`

`patch_state` 只能保留为 debug toolset，不给常规 GM。

常规工具：

```txt
get_status
update_scene
spend_money / receive_money
record_memory
update_protagonist_condition
update_servant_condition
set_initial_protagonist
set_initial_servant
```

### 初始化工具与游玩工具分离

很多锁定字段只应在开局阶段写入。

初始化工具：

- `set_initial_protagonist`
- `set_initial_servant_profile`
- `set_campaign_timeline`

游玩工具：

- `update_scene`
- `update_condition`
- `record_memory`
- `spend_money`

Debug 工具：

- `export_state`
- `override_locked_fact`
- `reset_state`

### 工具参数不要要求模型提交大对象

坏：

```ts
update_protagonist({ protagonist: FullProtagonistState })
```

好：

```ts
update_protagonist_condition({
  woundChanges: [...],
  outfitChange: ...,
  reason: string,
})
```

每次工具调用应该是一个领域事件，不是覆盖整个对象。

## Final recommended schema skeleton

```ts
interface GameState {
  meta: StateMeta;
  campaign: CampaignState;
  clock: ClockState;
  scene: SceneState;
  protagonist: ProtagonistState;
  allies: AllyState[];
  economy: EconomyState;
  memory: CampaignMemory;
  locks: StateLock[];
}
```

```ts
interface CampaignState {
  title: string;
  timeline: TimelineId;
  openingMode: OpeningMode;
  premise: string;
  activeRuleSetIds: RuleSetId[];
}
```

```ts
interface ProtagonistBase {
  kind: ProtagonistKind;
  identity: IdentityState;
  presentation: PresentationState;
  condition: ConditionState;
  inventory: InventoryState;
  abilities: AbilityState[];
}
```

```ts
interface ServantCoreState {
  identity: ServantIdentityState;
  condition: ServantConditionState;
  contract: ServantContractState;
  parameters: ServantParameterState;
  skills: ServantSkillState;
  noblePhantasms: NoblePhantasm[];
}
```

```ts
interface CampaignMemory {
  pinnedFacts: MemoryFact[];
  eventLog: MajorEventMemory[];
  dailySummaries: DailySummaryMemory[];
}
```

## Implementation consequences

第一刀不要先写完整 schema，而是先写四个边界：

1. `GameState` canonical type。
2. `buildGmBrief(state)` prompt read model。
3. `get_status` player-readable read model。
4. 一个写工具，例如 `record_memory` 或 `update_scene`。

这四个边界同时成立，schema 才算站稳。

如果只写 canonical type，不写 brief 和工具 DTO，很容易设计出漂亮但不可用的数据库。

## Decision

Ground-up schema 应从“工具与注入边界”倒推：

- canonical state 完整但不直接进 prompt；
- prompt brief 极短、玩家视角、无 JSON；
- 常规工具按领域事件写入；
- 裸 patch 只留 debug；
- 锁定字段在 schema 和工具两层同时锁；
- 大世界资料留 data lookup，不进 campaign state；
- 记忆只记录本局变化，不复制角色卡世界书。
