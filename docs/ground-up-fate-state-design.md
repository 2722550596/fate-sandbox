# Ground-up 状态与机制设计：Fate 沙盒原卡重迁移

## 设计立场

不兼容现有 `State` schema。当前 `金钱 / 当前位置 / 身体状态 / 魔力负担 / 危险度` 是通用 RPG 状态，不足以承载原卡的 Fate 语义。

新设计从原卡意图出发：

- 玩家可能是普通人、魔术师、御主、从者、外来英灵化角色。
- 核心玩法是型月世界观沙盒，不是通用 d20 冒险。
- 长期稳定性来自结构化状态、剧情账本、Fate 参数与身份锁定。
- Prompt 只负责叙事和调用工具；机械事实由 engine 持有。
- 不迁移 SillyTavern 的 `setvar`、XML 状态栏、显式 `<combat_driver>`，只迁移其背后的游戏语义。

## 顶层 State

从工具调用和提示词注入角度看，顶层状态必须控制体积：只放本局会变化、会被工具读写、会进入 GM 简报的事实。世界书级资料留在 `data/` + lookup，不塞进 state。

```ts
interface GameState {
  meta: StateMeta;
  public: PublicGameState;
  secrets: SecretGameState;
}

interface PublicGameState {
  campaign: CampaignState;
  clock: ClockState;
  scene: SceneState;
  actors: Record<ActorId, PublicActorState>;
  trackedItems: Record<ItemId, TrackedItemState>;
  protagonistActorId: ActorId;
  allyActorIds: ActorId[];
  economy: EconomyState;
  memory: CampaignMemory;
}

interface SecretGameState {
  actorSecrets: Record<ActorId, ActorSecretSlots>;
  campaignSecrets: SecretCampaignFact[];
  secretEventLog: SecretEventMemory[];
}
```

`buildGmBrief`、`get_status`、普通更新工具默认只接收 `PublicGameState`。只有 Private Resolution 工具能同时读取 `public` 与 `secrets`，且返回时不能暴露 hidden truth。

`public.actors` 是本局已入场 actor registry，不是世界角色数据库。Actor 进入 registry 当且仅当：玩家本人、当前在场者、当前同行/契约对象，或有伤势、关系、死亡、契约、真名、记忆引用等本局状态需要追踪。

`public.trackedItems` 是重要物品 registry，不是完整物品数据库。普通随身物品留在 actor inventory；只有会跨场景、被争夺、破损、隐藏、有神秘性质、作为任务目标或记忆引用的物品才 materialize。

理由：物理分区比字段级 visibility 更安全。`buildGmBrief(state.public)` 类型上拿不到 secrets，因此不会因为某处忘记过滤而泄漏真名、幕后计划或未揭示宝具。

`factions`、`knownCharacters` 不做顶层常驻数组；若本局关系发生变化，用 `memory.pinnedFacts` 或 `allies` 记录最小变化。角色/阵营基础资料继续由 lookup 查询。

中文导出可继续给玩家看中文字段，但代码内部建议用英文类型名，避免 TypeScript 里中文路径过深导致维护困难。

## Meta

```ts
interface StateMeta {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
}
```

不做旧 schema migration。重置存档。

## Campaign

记录本局开局配置和世界线。

```ts
interface CampaignState {
  title: string;
  timeline: TimelineId;
  openingMode: OpeningMode;
  premise: string;
  activeRuleSetIds: RuleSetId[];
}

type RuleSetId = "fate-worldview-filter" | "fate-rank-combat" | "jpy-2004-economy" | "custom";

type TimelineId =
  | "fz"
  | "fsn"
  | "case-files"
  | "fsf"
  | "mahoyo"
  | "kara-no-kyoukai"
  | "tsukihime-2000"
  | "tsukihime-2021"
  | "custom";

type OpeningMode = "random" | "selected" | "custom";
```

用途：把原卡的多时间线选择、随机开局、启用规则固定下来。规则正文留在 `agents/gm-rules.md` 或 `data/rules.json`，state 只保存 `activeRuleSetIds`，避免把长规则文本注入每轮 prompt。

## Clock

时间系统必须继续使用 Temporal（`Temporal.Instant` / `Temporal.ZonedDateTime`），不要退回 `Date` 或手写时区换算。状态只持久化 ISO 字符串和 IANA timezone，engine 边界再转换成 Temporal 对象。

```ts
interface ClockState {
  startedAt: string;
  currentAt: string;
  timezone: "Asia/Tokyo";
  lastLongRestAt: string | null;
}
```

时间系统只保存真实游戏内时间，不保存“当天高压分钟”这种派生状态。压力、休息等如果需要，应由事件和伤势系统推导或显式记录。

## Scene

```ts
interface SceneState {
  location: LocationState;
  situation: SituationKind;
  presentActorIds: string[];
  objectives: SceneObjective[];
  threats: SceneThreat[];
  lastResolvedAt: string;
}

interface SceneObjective {
  id: SceneObjectiveId;
  summary: string;
  status: "active" | "blocked" | "resolved";
}

interface SceneThreat {
  id: SceneThreatId;
  summary: string;
  severity: "low" | "medium" | "high" | "lethal";
}

interface LocationState {
  region: string;
  site: string;
  detail: string;
  boundary: BoundaryKind;
}

type BoundaryKind = "normal" | "bounded-field" | "reality-marble" | "otherworld";

type SituationKind =
  | "daily"
  | "investigation"
  | "social"
  | "combat"
  | "ritual"
  | "escape"
  | "downtime";
```

地点必须精确到原卡状态栏要求的“地域·场所·具体位置”。固有结界、异界化空间、结界内状态显式表达。

`scene` 是每轮 GM 简报的核心。`objectives` 和 `threats` 是当前场景短命对象，有 id 便于工具更新，但不是全局任务/威胁 registry。长期目标或危险在场景结束后写入 `memory.pinnedFacts`、actor state 或关系摘要。

## Protagonist

玩家扮演对象由 `public.protagonistActorId` 指向 `public.actors` 中的一个 actor。Protagonist 是 role，不是 actor type；不能假设玩家是御主或普通人。

如果玩家开局普通人，后来成为御主，`protagonistActorId` 不变，只更新该 actor 的 kind/capabilities。

## Actors

```ts
type PublicActorState = HumanActorState | OutsiderActorState | SpiritActorState | OtherActorState;

interface ActorBase {
  id: ActorId;
  kind: ActorKind;
  roles: ActorRole[];
  magecraft: MagecraftCapability | null;
  servantForm: ServantCoreState | null;
  identity: IdentityState;
  presentation: PresentationState;
  condition: ConditionState;
  inventory: InventoryState;
  abilities: AbilityState[];
  relationshipToProtagonist: RelationshipState;
}

interface RelationshipState {
  stance: "self" | "ally" | "friendly" | "neutral" | "wary" | "hostile" | "unknown";
  summary: string;
}

type ActorKind = "human" | "outsider" | "spirit" | "other";

type ActorRole = MasterRole | SocialRole | FactionRole;

interface MasterRole {
  kind: "master";
  commandSpells: CommandSpellState;
  contractedServantIds: ActorId[];
}

interface IdentityState {
  publicIdentity: string;
  background: string;
  lockedFacts: LockedFact[];
}
```

`public.actors` 是统一 actor registry。`scene.presentActorIds`、`protagonistActorId`、`allyActorIds`、memory subject references、secret slots 都通过 `ActorId` 指向这里的 player-safe skeleton。

不要建全局 relationship graph。每个 public actor 只保存 `relationshipToProtagonist`，供 GM brief 和工具判断与主角相关的同盟/戒备/敌对。非主角之间但有机械意义的关系用专用结构表达，例如 `MasterRole.contractedServantIds` 和 `ServantContractState.masterActorId`。

### Human actors

```ts
interface HumanActorState extends ActorBase {
  kind: "human";
}

interface MagecraftCapability {
  circuits: MagecraftCircuitState;
  disciplines: MagecraftDiscipline[];
  affiliation: string | null;
}
```

Magus 是 `magecraft` capability 和可能的社会身份，不是 `ActorKind`。远坂凛是 `kind:"human"` + `magecraft` + `MasterRole`；卫宫士郎是 `kind:"human"` + 弱 magecraft；无魔术回路普通人是 `kind:"human"` + `magecraft:null`。

### Servant Form / Outsider / Spirit actors

```ts
interface HumanActorState extends ActorBase {
  kind: "human";
}

interface OutsiderActorState extends ActorBase {
  kind: "outsider";
  sourceProfile: string;
  fateTranslation: string;
  restrictions: string[];
}

interface SpiritActorState extends ActorBase {
  kind: "spirit";
  origin: string;
}

interface OtherActorState extends ActorBase {
  kind: "other";
  nature: string;
}
```

Servant is not `ActorKind`; an actor has `servantForm` when manifesting through a Servant-style Saint Graph/class container. Saber can be `kind:"spirit"` + `servantForm`; a normal ghost can be `kind:"spirit"` + `servantForm:null`; Mash-style demi-servants can be `kind:"human"` + `servantForm`; original-card outsiders can be `kind:"outsider"` + `servantForm`.

`spirit` is intentionally narrow: use it only for non-physical or spirit-bodied actors where spiritual existence affects resolution, such as spirit form, physical attack validity, or mana supply. Do not use it as a catch-all for every supernatural being; Dead Apostles, True Ancestors, automata, and similar cases start as `kind:"other"` with a precise `nature` unless spirit-bodied resolution matters.

## Tracked Items

普通 inventory 挂在 actor 上；重要物品进入 `public.trackedItems`。Noble Phantasm 不属于普通 inventory，留在 `servantForm.noblePhantasms`。

```ts
interface InventoryState {
  ordinaryItems: string[];
  heldTrackedItemIds: ItemId[];
}

interface TrackedItemState {
  id: ItemId;
  label: string;
  kind: "mundane" | "weapon" | "mystic-code" | "document" | "key-item" | "other";
  ownerActorId: ActorId | null;
  holderActorId: ActorId | null;
  location: LocationState | null;
  condition: "intact" | "damaged" | "broken" | "spent" | "unknown";
  visibility: "player-known" | "suspected";
  notes: string[];
}
```

Item 进入 `trackedItems` 当且仅当：神秘/礼装/重要武装；会被争夺、破坏、隐藏、追踪；属于场景目标或任务关键物；需要跨 actor 转移；需要记忆引用。

## Servant Form model

```ts
interface ServantActorState {
  id: string;
  nameForPlayer: string;
  core: ServantCoreState;
  relationship: RelationshipState;
  currentOrder: string;
}

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

interface ServantConditionState {
  spiritualCore: ResourceTrack;
  mana: ResourceTrack;
  spiritualCondition: string;
  permanentDefects: PermanentDefect[];
}

interface ResourceTrack {
  value: Percent;
}

type SpiritualCoreBand = "stable" | "damaged" | "cracked" | "collapsing" | "gone";
type ManaBand = "full" | "steady" | "low" | "depleted" | "exhausted";

interface ServantParameterState {
  base: FateParams;
  modifiers: ParamModifier[];
  baseLocked: true;
}

type ServantClass =
  | "Saber"
  | "Archer"
  | "Lancer"
  | "Rider"
  | "Caster"
  | "Assassin"
  | "Berserker"
  | "Avenger"
  | "Ruler"
  | "AlterEgo"
  | "Foreigner"
  | "Shielder"
  | "MoonCancer"
  | "Pretender"
  | "Custom";

interface TrueNameState {
  status: "hidden" | "suspected" | "revealed";
  value: string;
}

interface ServantContractState {
  masterName: string | null;
  status: "stable" | "weak" | "cut" | "masterless";
  manaSupply: "sufficient" | "strained" | "starved";
}
```

规则：

- `identity.className`、`identity.trueName.value`、`parameters.base`、`noblePhantasms` 一经确立默认锁定。
- 临时强化、狂化、诅咒、供魔不足写入 `parameters.modifiers`。
- 概念伤、不可恢复创伤写入 `condition.permanentDefects`。
- `spiritualCore.value` 和 `mana.value` 保留原卡百分比语义，供工具内部结算；GM brief 和普通叙事只显示派生 band，不直接显示百分比。
- 常规游玩工具只能更新 condition / contract / modifiers / current order；锁定字段只能由初始化工具或 debug override 写入。

## Fate ranks

```ts
type FateRankBase = "E" | "D" | "C" | "B" | "A" | "EX";
type FateRank = FateRankBase | `${FateRankBase}+` | `${FateRankBase}-`;

interface FateParams {
  strength: FateRank;
  endurance: FateRank;
  agility: FateRank;
  mana: FateRank;
  luck: FateRank;
  noblePhantasm: FateRank;
}
```

比较规则：

- 主序：`E < D < C < B < A < EX`。
- `+/-` 只做同级内微调。
- 相差 2 个主等级以上形成压制。
- 相差 1 个主等级以内进入交锋、消耗或轻伤区间。
- 技能、宝具、地形、御主供魔、真名暴露、相性可以覆盖纯参数结论。

## Magecraft circuits

```ts
interface MagecraftCircuitState {
  count: string;
  quality: FateRank | "none";
  od: Percent;
  status: "normal" | "overheated" | "depleted" | "dormant" | "damaged";
  traits: string[];
}
```

普通人可以 `circuits:null`，不要用“魔力负担”泛化所有情况。

## Economy

```ts
interface EconomyState {
  currency: "JPY";
  accessibleFunds: MoneyPurse[];
  debts: DebtState[];
}

interface MoneyPurse {
  id: string;
  ownerActorId: ActorId;
  label: string;
  amount: number;
  access: "held" | "shared" | "requires-permission";
}
```

规则：

- 物价锚定 2004 年日本。
- 交易非免费。
- 食宿、装备、服务、情报都需要合理结算。
- 无钱不能默认兜底，除非剧情中有人明确资助或赊账。
- `economy` 是玩家当前可访问资金视图，不是世界经济真相；每笔资金必须有 `ownerActorId` 和 `access`。
- `spend_money` 必须指定 `purseId` 和 reason，禁止把同行者资金说成玩家随身现金。

## Memory

替代原卡 `世界书日常记忆存储 / 世界书重大记忆存储 / 世界书玩家身世背景`。`public.memory` 只记录玩家已知/主角经历过的记忆；幕后事件、NPC 私密动机、未揭示真相属于 `SecretGameState.secretEventLog` 或 secret slots。

```ts
interface CampaignMemory {
  pinnedFacts: MemoryFact[];
  eventLog: MajorEventMemory[];
  dailySummaries: DailySummaryMemory[];
}

interface MemoryFact {
  id: string;
  scope: "protagonist" | "npc" | "faction" | "world";
  subject: string;
  text: string;
  since: string;
  sourceEventId: string | null;
}

interface MajorEventMemory {
  id: string;
  time: string;
  title: string;
  summary: string;
  consequences: string[];
}

interface DailySummaryMemory {
  id: string;
  startDate: string;
  endDate: string;
  summary: string;
}
```

不要把玩家身世同时复制到 `memory` 和 `protagonist.identity.background`。`protagonist.identity.background` 是真相源；`memory.pinnedFacts` 只记录“身世已确定”这类可引用事实，避免双写漂移。

必须记录：

- 玩家身世确定。
- 契约成立、解除、变更。
- NPC 死亡、失踪、重伤。
- 真名公开、宝具首次解放、令咒使用。
- 阵营变化、同盟成立或破裂。
- 概念伤、永久缺损。
- 圣杯战争局势变化。
- 半天以上时间跳过或章节结束。

禁止记录：

- GM 猜测。
- 玩家未确认的幕后真相。
- 普通闲聊。
- 短暂情绪。
- 无长期影响的动作。

## Characters and factions

```ts
interface KnownCharacterState {
  id: string;
  displayName: string;
  publicRole: string;
  knownStatus: "alive" | "dead" | "missing" | "unknown";
  relationship: RelationshipState;
  knownSecrets: string[];
  lastKnownLocation: LocationState | null;
}

interface FactionState {
  id: string;
  name: string;
  stanceToProtagonist: "ally" | "neutral" | "hostile" | "unknown";
  knownMembers: string[];
  notes: string[];
}
```

只记录玩家已知内容。GM 不应把幕后真相写进主状态。

## Condition, wounds, defects, effects

`ConditionState` 不包含通用 HP / 身体百分比。普通 actor 用离散伤势和异常；Servant Form 用自己的灵基 HP / 魔力 SP；魔术回路用 magecraft circuits status。

```ts
interface ConditionState {
  wounds: WoundState[];
  afflictions: AfflictionState[];
  permanentEffects: PermanentEffect[];
}

interface WoundState {
  id: string;
  severity: "minor" | "moderate" | "severe" | "critical";
  text: string;
  recoverable: boolean;
  treatment: string | null;
}

interface AfflictionState {
  id: string;
  source: string;
  text: string;
  expectedDuration: string | null;
}

interface PermanentDefect {
  id: string;
  source: string;
  text: string;
  mechanicalEffect: string;
}

interface PermanentEffect {
  id: string;
  source: string;
  text: string;
  mechanicalEffect: string;
}
```

这样替代“身体状态 0-100”这种过粗字段，防止工具退化成通用扣 HP。

## Prompt injection boundary

Canonical `GameState` 物理分为 `public` 与 `secrets`。每轮注入必须经 `buildGmBrief(state.public)` 生成短简报；禁止整段 JSON 注入 prompt。

```txt
[当前 GM 简报]
时间：2004-01-30 周五 16:00 JST
地点：冬木市 · 深山镇 · 穗群原学园 · 校门外
态势：daily
玩家角色：从者 / Saber / 真名隐藏 / 魔力平稳 / 契约稳定
同行者：远坂凛（临时同盟，戒备）
资源：现金 50,000 円；关键装备：...
伤势/长期影响：...
最近重大记忆：...
本轮工具纪律：状态变化必须调用对应 update 工具；不要输出 JSON、数值表、schema 字段。
```

`get_status` 是玩家可见读模型；`buildGmBrief` 是 GM 内部读模型；二者都不能直接 dump canonical state。

## Secret boundary

隐藏事实保存在 `SecretGameState`，但 secret slice 不保存另一份完整 actor。Public 保存玩家安全实体骨架，Secret 只保存按 `ActorId` 挂接的隐藏补丁/真相槽。

```ts
interface ActorSecretSlots {
  actorId: ActorId;
  trueName?: SecretSlot<string>;
  hiddenNoblePhantasms: SecretSlot<NoblePhantasm>[];
  privateMotives: SecretSlot<string>[];
  unrevealedAffiliations: SecretSlot<string>[];
}

interface SecretSlot<T> {
  id: SecretId;
  value: T;
  revealState: "hidden" | "foreshadowed" | "revealed";
  revealConditions: string[];
}

interface SecretCampaignFact {
  id: SecretId;
  text: string;
  relatedActorIds: ActorId[];
  revealState: "hidden" | "foreshadowed" | "revealed";
}

interface SecretEventMemory {
  id: SecretId;
  time: string;
  summary: string;
  relatedActorIds: ActorId[];
}
```

公开侧只保存玩家安全标签和已揭示投影：

```ts
interface TrueNameState {
  status: "hidden" | "suspected" | "revealed";
  display: string;
}
```

reveal 是显式领域事件：从 secret slot 投影必要内容到 public skeleton，更新 `revealState`，并记录 memory event。禁止维护 public actor 与 secret actor 两份完整实体。

## Tool API

常规工具按聚合根分组，但参数必须是领域事件 discriminated union。禁止常规工具提交 raw object patch 或替换完整对象。

第一批常规工具：

```txt
get_status
update_scene
update_actor_condition
update_servant_form
update_economy
record_memory
reveal_secret
private_resolve
```

Debug-only：

```txt
export_state
override_locked_fact
reset_state
```

禁止常规暴露：

```txt
patch_state
update_actor_raw
replace_state
```

### `get_status`

玩家可见状态摘要，不展示完整 JSON。

展示：

- 时间、地点、场景态势。
- 玩家角色摘要。
- 金钱与关键装备。
- 若玩家/同伴是从者，显示灵基 HP、魔力 SP、契约、真名状态、永久缺损。
- 长期事实、最近重大事件、最近日常摘要。

不展示完整 JSON。

### `patch_state`

常规 toolset 不提供裸 `patch_state`。它只能保留在 debug toolset，用于开发和修档。

原因：裸 path patch 会让 GM 面对 schema 路径而不是领域动作；schema 一旦变差，所有叙事更新都会跟着变差。

### `record_memory`

写入 `CampaignMemory`。

### `update_scene`

按领域事件更新时间、地点、场景态势、目标、威胁。必须带 `reason`，并由 engine 使用 Temporal 推进时间。

```ts
type SceneEvent =
  | { kind: "move-location"; location: LocationState; elapsedMinutes: number; reason: string }
  | { kind: "set-situation"; situation: SituationKind; reason: string }
  | { kind: "add-objective"; summary: string; reason: string }
  | { kind: "resolve-objective"; objectiveId: SceneObjectiveId; reason: string }
  | { kind: "add-threat"; summary: string; severity: SceneThreatSeverity; reason: string }
  | { kind: "clear-threat"; threatId: SceneThreatId; reason: string };
```

### `update_protagonist`

删除该工具名。Protagonist 是 role，不是 aggregate。使用 `update_actor_condition` 更新 `protagonistActorId` 指向的 actor。

### `update_actor_condition`

更新 actor 的当前呈现、装备、能力、伤势。禁止直接改锁定身份事实。

```ts
type ActorConditionEvent =
  | {
      kind: "add-wound";
      actorId: ActorId;
      severity: WoundSeverity;
      text: string;
      source: string;
      recoverable: boolean;
    }
  | {
      kind: "add-affliction";
      actorId: ActorId;
      text: string;
      source: string;
      expectedDuration: string | null;
    }
  | {
      kind: "add-permanent-effect";
      actorId: ActorId;
      text: string;
      source: string;
      mechanicalEffect: string;
    }
  | { kind: "change-outfit"; actorId: ActorId; outfit: OutfitState; reason: string }
  | {
      kind: "transfer-tracked-item";
      itemId: ItemId;
      holderActorId: ActorId | null;
      reason: string;
    };
```

### `update_servant_form`

更新 Servant Resource、契约状态、灵体状况、参数修正、永久缺损、当前指令。

禁止：

- 改写已确立的职阶。
- 改写已确立的真名。
- 改写基础参数。
- 临场新增宝具。

如确需破例，必须使用专门 `override_locked_fact` debug 工具，并写明原因。

```ts
type ServantFormEvent =
  | { kind: "spend-mana"; actorId: ActorId; amount: number; reason: string }
  | { kind: "restore-mana"; actorId: ActorId; amount: number; reason: string }
  | { kind: "damage-spiritual-core"; actorId: ActorId; amount: number; reason: string }
  | { kind: "add-param-modifier"; actorId: ActorId; modifier: ParamModifier; reason: string }
  | { kind: "change-contract"; actorId: ActorId; contract: ServantContractState; reason: string }
  | { kind: "add-permanent-defect"; actorId: ActorId; defect: PermanentDefect; reason: string };
```

### `reveal_secret`

普通 GM 可调用，但不能传 secret id。工具接受玩家可见 claim/evidence，内部匹配 secret slots 并决定是否 reveal。

```ts
type RevealSecretEvent =
  | { kind: "claim-reveal"; actorId: ActorId; claim: string; evidence: string }
  | { kind: "observed-reveal"; actorId: ActorId; trigger: string; evidence: string };

type RevealSecretOutcome = "revealed" | "foreshadowed" | "insufficient-evidence" | "incorrect";
```

工具返回必须玩家安全。猜错或证据不足时，只能说“没有足够证据确认”或“判断暂未成立”，禁止泄漏正确答案或 secret id。

### `private_resolve`

窄口私密结算工具，只支持少数需要隐藏事实参与、但返回玩家安全约束的事件。禁止作为通用真相查询工具。

```ts
type PrivateResolveEvent =
  | { kind: "hidden-reaction"; actorId: ActorId; stimulus: string; publicContext: string }
  | { kind: "secret-compatibility"; actorId: ActorId; targetActorId: ActorId; interaction: string };

interface PrivateResolveResult {
  outcome: "no-special-effect" | "subtle-reaction" | "strong-reaction" | "dangerous-escalation";
  narrativeConstraints: string[];
}
```

严禁：

- 询问完整隐藏真相。
- 列出 secret slots。
- 要求解释幕后动机全文。
- 用它替代 `reveal_secret`。

### `resolve_fate_rank`

纯比较工具或 engine 函数：

- 比较敏捷、攻防、魔术/对魔力、宝具、幸运边缘判定。
- 返回结构化结果，不输出思维链。

第一版可只做 engine 函数，不暴露工具。

## Engine modules

```txt
engine/core/state.ts          # store + validation only
engine/core/gm-brief.ts       # prompt 注入用短简报，禁止 JSON dump
engine/core/fate-rank.ts      # rank parsing/comparison
engine/core/memory.ts         # campaign memory operations
engine/core/protagonist.ts    # protagonist validation/update
engine/core/servant.ts        # servant validation/update
engine/core/scene.ts          # Temporal time/location/situation update
engine/core/economy.ts        # JPY transaction validation
```

不要把所有逻辑堆进 `state.ts`。

如果需要 GM brief 展示锁定事实，使用 `deriveLockedFactSummary(publicState)` 从对象内部派生，不持久化顶层 `locks`。

## Prompt changes

### `gm-system.md`

保持极简：GM 身份、工具纪律、机械事实来自工具。

### `gm-context.md`

放工具速查和资料查询说明。

### `gm-rules.md`

放硬规则：

- 记忆纪律。
- Fate rank 战斗纪律。
- 状态不漂移纪律。
- 世界观过滤。
- 金钱纪律。
- 不输出工具推理/状态 XML。

## Data migration from card

原卡条目去向：

| 原卡条目            | 去向                                                      |
| ------------------- | --------------------------------------------------------- |
| 记忆相关            | `CampaignMemory` + `record_memory`                        |
| 玩家身世背景        | `protagonist.background` + `memory.protagonistBackground` |
| 玩家身世(从者/外来) | `ServantProtagonist` 或 `OutsiderProtagonist`             |
| 时间线-\*           | `campaign.timeline` + `data/timelines.json`               |
| 战斗思维链          | `fate-rank.ts` + `gm-rules.md`                            |
| 状态栏:默认         | `ProtagonistState` / `SceneState` / `EconomyState`        |
| 状态栏:从者         | `ServantCoreState`                                        |
| 世界观校验/过滤     | `campaign.worldviewFilters` + `gm-rules.md`               |
| 金钱                | `EconomyState` + transaction validation                   |
| 核心设定            | `data/world.json` + lookup                                |
| 角色                | `data/characters.json` + lookup + `KnownCharacterState`   |
| 英灵                | `data/servants.json` + lookup                             |
| 地点                | `data/locations.json` + lookup                            |

## Implementation plan

### Phase 1：新 schema 骨架

- 删除现有 state schema 兼容逻辑。
- 新建 `GameState` 初始状态。
- 写 validation。
- `get_status` 改为读取新结构。
- `resetState` 直接生成新局状态。

### Phase 2：记忆闭环

- 实现 `memory.ts`。
- 实现 `record_memory`。
- GM rules 加记忆纪律。
- 测试记录玩家身世、重大事件、日常摘要、事实。

### Phase 3：Fate rank 与从者模型

- 实现 `fate-rank.ts`。
- 实现 `servant.ts` validation。
- 测试 rank 比较、非法 rank 拒绝、HP/SP 范围、锁定字段更新拒绝。

### Phase 4：工具重建

- `update_scene`
- `update_protagonist`
- 锁定字段在对象内部表达，不做顶层 `locks`。

删除或降级旧工具：

- `resolve_daily`：暂删。日常时间跳跃走 `update_scene` + `record_memory`。
- `resolve_consequence`：暂删或重写为 scene consequence。
- `resolve_check`：暂保留通用检定，但不再承担 Fate 从者战。
- `patch_state`：移到 debug-only 或删除，避免裸 patch 破坏锁定字段。

### Phase 5：原卡数据重整

- `data/timelines.json`
- `data/characters.json`
- `data/servants.json`
- `data/locations.json`
- `data/world.json`

### Phase 6：游玩验证

覆盖：

- 玩家是普通人。
- 玩家是御主。
- 玩家是从者。
- 玩家是外来英灵化角色。
- 真名隐藏到公开。
- 宝具首次解放。
- 契约断绝或供魔不足。
- 半天以上时间跳跃并记录日常摘要。
- 概念伤进入永久缺损。

## Explicit non-goals

不做：

- 旧 schema migration。
- XML 状态栏。
- `<combat_driver>` 输出。
- 大字符串世界书变量。
- 自动 NPC 私密真相状态。
- 完整战斗模拟器。
- 完整宝具数据库。

## Recommended first commit

第一刀应该只做 schema + get_status + record_memory，不碰战斗：

```txt
feat: redesign game state around Fate campaign semantics
```

包含：

- 新 `GameState`。
- 新初始状态。
- 新 `CampaignMemory`。
- `record_memory`。
- `get_status` 适配。
- 删除旧 generic pressure/daily 依赖或暂时从 registry 下线。

这样能最快把原卡最容易漂移的部分稳住。
