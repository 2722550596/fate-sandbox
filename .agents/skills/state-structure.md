# state-structure — State 结构与变更流程

## 何时使用
- 改 state schema（新增/修改/删除字段）
- 加 migration
- 读状态 / 排查状态不一致
- 确定某个数据放 public 还是 secrets

## 必须先读
- `engine/core/state/state.ts` — `GameState`, `PublicGameState`, `SecretGameState` 类型定义
- `engine/core/state/state-schema.ts` — `STATE_SCHEMA`, `parseStateSchema`, `assertStateInvariants`
- `engine/core/state/state-store.ts` — `cloneState`, `commitState`, `getState`, `touchState`
- `engine/core/state/session-persistence.ts` — `persistStateAfterCommit`, `hydrateStateFromSessionEntries`
- `engine/core/state/state-enum-schemas.ts` — 所有枚举 schema（单一事实来源）
- `engine/core/state/public-projection.ts` — `buildGmBrief`, `buildStatusMarkdown`
- `engine/core/init/initial-state.ts` — `createInitialState`（初始值工厂）

## 核心 State 结构

```
State = GameState {
  meta:    StateMeta           // schemaVersion, timestamps, RNG
  public:  PublicGameState     // player/LM 可见（15 个字段）
  secrets: SecretGameState     // GM 专属（11 个字段）
}
```

## public/secrets 分层判断标准

| 放 public | 放 secrets |
|---|---|
| 剧情信息（scenario, clock, turnLog） | 演员秘密（agenda, knowledgeLens, secret slots） |
| 演员公开属性（kind, sequence, identity, presentation） | 隐藏世界事实 |
| 经济（funds, debts） | 幕后事件（offscreen events） |
| 主角已知的记忆（pinnedFacts, eventLog, dailySummaries） | 派系时钟 |
| 义务/钩子/承诺 | secret 可见性关系信号 |
| player-known 的关系信号 | 幕后义务/评审日志/压力状态/待收获 |
| 演员印象 | |

关键原则：
- 关系信号按 `visibility` 分开在两个数组写（public 中 `player-known`，secrets 中 `secret`）
- 不要把所有数据放 public，"玩家知道" ≠ public state

## parseStateSchema 验证管道

```
value → trimStringsDeep → applyDeserializationDefaults
     → parseTypeBoxValue(Convert → Clean → Check)
     → normalizeStateDatesInPlace → assertStateInvariants → State
```

关键行为：
- `trimStringsDeep`: 递归 trim 所有字符串
- `applyDeserializationDefaults`: **仅**补 `secrets.offscreenEventLog: []`（若缺失）
- `Convert`: 类型自动转换（有严格白名单）
- `Clean`: **静默移除未知字段**（TypeBox `additionalProperties: false` 默认行为）
- `Check`: 失败抛格式错误信息，成功返回
- `normalizeStateDatesInPlace`: 标准化所有 ISO 日期
- `assertStateInvariants`: 引用一致性检查（详见下文）

## assertStateInvariants 检查项

所有检查抛出 `Error`，任何不一致阻止 state 加载：

| 检查 | 内容 |
|---|---|
| Actor registry key | 每个 `actors[key].id === key` |
| 主角/盟友/场景引用 | protagonistActorId, allyActorIds, scene.presentActorIds 必须在 actors 中存在 |
| TrackedItem 引用 | item key 与 id 一致；ownerActorId/holderActorId 非空时必须在 actors 中存在 |
| Economy 引用 | 每个 purse 的 ownerActorId 和 debt 的 debtorActorId 存在 |
| Secret state 引用 | secrets.actorStates 每个 key 与 bundle.actorId 一致；对应演员在 public.actors 中存在 |
| Faction clock 完整性 | filled ≤ size |
| Relationship signal | sourceActorId/targetActorId 存在；ID 唯一 |
| Actor impression | 每个 impression 的 actorId 存在 |

## 当前 Migration 状况（⚠️ 重要）

- `CURRENT_STATE_SCHEMA_VERSION = 6`
- **没有任何 migration 函数** — schemaVersion 只写入不读取
- 唯一兼容机制：TypeBox `Clean()` 静默丢弃未知字段
- **这意味着**：如果旧 state 中有字段被重命名/分拆，运行时访问新字段会得到 `undefined`
- 补充 migration 是必须的

## 变更 checklist

### 新增字段
1. [ ] `state.ts` — 添加接口字段
2. [ ] `state-schema.ts` — 添加 TypeBox schema 字段
3. [ ] 若涉及枚举：`state-enum-schemas.ts` 添加枚举定义
4. [ ] `initial-state.ts` — 添加初始化值
5. [ ] 编译检查 `StateSchemaParityCheck` 双向验证
6. [ ] 若影响 GM 显示：`public-projection.ts` 更新投影函数
7. [ ] 若影响 timeline 投影：`state-file-projection.ts`
8. [ ] **创建 migration**：在线性迁移链中添加 `migrateVnToVn+1`
9. [ ] `state-store.test.ts` — 添加新字段测试

### 修改/重命名字段
1. [ ] 同上（initial-state.ts 可能不需要改）
2. [ ] **必须写 migration** — `Clean()` 会丢弃旧字段名，新字段名 load 后为 undefined

### 删除字段
1. [ ] 从各文件移除定义
2. [ ] 旧 state 中的该字段被 `Clean()` 静默丢弃 — 不需要 migration

### 变更 public/secrets 边界
1. [ ] 移动接口定义 + schema 定义
2. [ ] 更新 initial-state.ts 初始化位置
3. [ ] 更新投影函数
4. [ ] **必须写 migration** — 数据从 secrets 移到 public 或反之

## 验证命令

```bash
pnpm typecheck    # 零错误
pnpm test         # 所有测试通过（特别是 state-store.test.ts）
pnpm format
```

## 禁止事项

- ❌ 不要在 `state.ts` 类型定义中使用 `any`
- ❌ 不要使用 `!` 非空断言跳过 Record 访问检查 — 每个 `actors[id]` 访问前必须 `if (x === undefined) throw`
- ❌ 不要在 schema 中写 `additionalProperties: true`（除非有特殊理由）
- ❌ 不要写 `v1 → current` 的 migration — 必须线性逐版本
- ❌ 不要绕过 `parseStateSchema` 直接构造 State 对象
- ⚠️ `noUncheckedIndexedAccess` 未启用（tsconfig 中无此项），但建议在代码中自行检查 undefined
- ⚠️ `ActorId`, `ItemId` 是 `string` type alias 而非 branded type — 运行时无区别，注意不要混用