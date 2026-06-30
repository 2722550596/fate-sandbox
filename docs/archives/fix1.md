# Fix Phase 1 — Actor 模型精简

## 改动项

共三处，一起执行。

---

### 1. `roles` 字段精简 + 移入 `IdentityState`

#### 现状

`ActorBase` 有独立字段 `roles: ActorRole[]`：

```typescript
// ActorRole 是一个 tagged union
type ActorRole = SocialRole | FactionRole;

// SocialRole = { kind: "social", label: string }   — 纯 verbose string
// FactionRole = { kind: "faction", factionId: string, label: string } — 半成品
```

`factionId` 没有对应的 faction schema/registry，只在 faction clock 上自持，Actor 无需承载。

#### 目标

```typescript
interface IdentityState {
  publicIdentity: string;
  background: string;
  lockedFacts: LockedFact[];
  roles: string[]; // ← 社会身份标签列表
}

interface ActorBase {
  id: ActorId;
  kind: ActorKind;
  sequence: SequenceState | null;
  identity: IdentityState;
  presentation: PresentationState;
  condition: ConditionState;
  inventory: InventoryState;
  abilities: AbilityState[];
  relationshipToProtagonist: RelationshipState;
  // roles 已删除 —— 在 identity 里
}
```

#### 删除

- `state.ts`: `ActorRole` / `SocialRole` / `FactionRole` 三个类型
- `state-schema.ts`: `SOCIAL_ROLE_SCHEMA` / `FACTION_ROLE_SCHEMA` / `ACTOR_ROLE_SCHEMA` 三个 schema
- `actor-schema.ts`: `SOCIAL_ROLE_SCHEMA` / `FACTION_ROLE_SCHEMA` / `ACTOR_ROLE_SCHEMA` 三套 import 与定义
- `actor-schema.ts`: `PUBLIC_NPC_INPUT_SCHEMA` / `PUBLIC_NPC_SKELETON_INPUT_SCHEMA` 中的 `publicRoles` 字段
- `actor.ts`: `toSafePublicActor()` 中的 `roles: npc.publicRoles` 映射
- `upsert-actor.ts`: `looseActorRoleSchema()` / `loosePublicNpcSchema()` 中的 `publicRoles` 字段
- 所有测试文件中手写 `roles: []` 的 fixture
- `initialize-new-game.ts` 中 `roles: input.roles ?? []` 赋值

#### 补充

如果 faction clock 确实需要知道「哪些 actor 属于这个 faction」，正确的做法是在 `FactionClockState` 上加 `memberActorIds: ActorId[]`，而不是反推 Actor。

---

### 2. `ActorSecretSlots` — pathwaySecret + sequenceSecret 合并

#### 现状

```typescript
interface ActorSecretSlots {
  actorId: ActorId;
  pathwaySecret?: SecretSlot<string>; // 单独字段
  sequenceSecret?: SecretSlot<string>; // 单独字段
  privateMotives: Array<SecretSlot<string>>;
  unrevealedAffiliations: Array<SecretSlot<string>>;
}
```

两个字段结构完全一致，所有扫描逻辑都要写两次分支（`secrets.ts` 第 76-89 行、第 230-243 行、第 362-377 行）。

#### 目标

```typescript
interface ActorSecretSlots {
  actorId: ActorId;
  beyonderSecrets: Array<SecretSlot<string>>; // 替代 pathwaySecret + sequenceSecret
  privateMotives: Array<SecretSlot<string>>;
  unrevealedAffiliations: Array<SecretSlot<string>>;
}
```

每个 slot 的 `id` 区分种类：`"protagonist-pathway"`、`"protagonist-sequence"`、`"npc-123-pathway"` 等。

业务逻辑变化：

- `configureSequenceSecrets`（`secrets.ts` 第 56-93 行）：不再分 pathwaySecret / sequenceSecret 两个分支写入，统一 `beyonderSecrets.push()`。
- `applyRevealSecret`（`secrets.ts` 第 220-273 行）：`pathwaySecret` / `sequenceSecret` 分支合并为一次 `beyonderSecrets.find()`。
- `markForeshadowed`（`secrets.ts` 第 362-377 行）：不再需要手动 spread optional 字段。

---

### 3. `currentOrder` → `currentAssignment`

#### 现状

```typescript
interface ActorAgendaState {
  actorId: ActorId;
  goal: string;
  fear: string;
  currentOrder: string | null; // ← "order" 属于 fate 残留（从者的命令）
  lastIndependentActionAt: string | null;
}
```

#### 目标

```typescript
interface ActorAgendaState {
  actorId: ActorId;
  goal: string;
  fear: string;
  currentAssignment: string | null; // ← 当前委派/指令
  lastIndependentActionAt: string | null;
}
```

工具描述同步改：`"当前委派/指令；无委派填 null 或省略"`。

所有引用点（10+ 处）逐一改名，无逻辑变化。

---

## 影响文件清单（可能不止）

### 核心层

| 文件                                         | 改动                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/core/state/state.ts`                 | 删除 `ActorRole` / `SocialRole` / `FactionRole`；`ActorBase` 删 `roles`；`IdentityState` 加 `roles: string[]`；`ActorSecretSlots` 合并字段；`ActorAgendaState` 改字段名 |
| `engine/core/state/state-schema.ts`          | 删除三个 role schema；actor identity schema 加 `roles`；actor secret slots 合并字段；agenda schema 改字段名                                                             |
| `engine/core/state/state-file-projection.ts` | 字段名同步（如果涉及）                                                                                                                                                  |
| `engine/core/state/initial-state.ts`         | `roles` 相关初始化调整                                                                                                                                                  |

### Actor 子系统

| 文件                                     | 改动                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `engine/core/actor/actor.ts`             | `toSafePublicActor()` 去掉 `roles: npc.publicRoles`                                                     |
| `engine/core/actor/actor-schema.ts`      | 删除三个 role schema；`PUBLIC_NPC_INPUT_SCHEMA` / `PUBLIC_NPC_SKELETON_INPUT_SCHEMA` 删除 `publicRoles` |
| `engine/core/actor/actor.test.ts`        | 所有 fixture 删除 `roles: []`                                                                           |
| `engine/core/actor/actor-agenda.ts`      | `currentOrder` → `currentAssignment`；`UpsertActorAgendaInput` 同步改                                   |
| `engine/core/actor/actor-agenda.test.ts` | `currentOrder` → `currentAssignment`                                                                    |

### 知识/秘密子系统

| 文件                                      | 改动                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `engine/core/knowledge/secrets.ts`        | `configureSequenceSecrets` / `applyRevealSecret` / `markForeshadowed` 合并 pathway/sequence 分支 |
| `engine/core/knowledge/secrets-schema.ts` | `CONFIGURE_SEQUENCE_SECRETS_SCHEMA` 中对应的字段合并                                             |
| `engine/core/knowledge/secrets.test.ts`   | 测试数据同步                                                                                     |
| `engine/core/knowledge/memory.ts`         | 如果引用到相关类型                                                                               |

### 初始化 + 工具层

| 文件                                      | 改动                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `engine/core/init/initialize-new-game.ts` | 删除 `roles: input.roles ?? []`                                                                              |
| `engine/tools/actor/upsert-actor.ts`      | 删除 `publicRoles` 相关工具 schema；删除 `looseActorRoleSchema()`；`prepareUpsertActorParams` 中去掉角色映射 |

### 工具层测试 + 后台

| 文件                                                  | 改动                                               |
| ----------------------------------------------------- | -------------------------------------------------- |
| `engine/tools/actor/update-actor-agenda.ts`           | `currentOrder` → `currentAssignment`               |
| `engine/tools/actor/update-actor-agenda.test.ts`      | `currentOrder` → `currentAssignment`               |
| `engine/core/backstage/parallel-line-assembler.ts`    | agenda 渲染中 `currentOrder` → `currentAssignment` |
| `engine/core/backstage/faction-clock.ts`              | 如果 role schema 引用                              |
| `engine/core/backstage/faction-clock.test.ts`         | 同上                                               |
| `engine/tools/backstage/manage-faction-clock.ts`      | 同上                                               |
| `engine/tools/backstage/manage-faction-clock.test.ts` | 同上                                               |

### 审计

| 文件                                 | 改动               |
| ------------------------------------ | ------------------ |
| `engine/audit/lint-rules.ts`         | 如果引用 role 相关 |
| `engine/audit/lint-rules.test.ts`    | 同上               |
| `engine/audit/session-audit.test.ts` | 同上               |

---

## 执行顺序（建议）

全在一个 Phase 里做。步骤：

1. 改 `state.ts` 类型定义（三处改动一起上）
2. 改 `state-schema.ts` schema + 删除 role schema
3. 改 `actor-schema.ts` 删除 role schema + 更新 input schema
4. 改 `actor.ts` 删除 `roles` 映射 + `toSafePublicActor` 调整
5. 改 `actor.test.ts` 删除所有 fixture 中的 `roles: []`
6. 改 `secrets.ts` 合并 pathway/sequence 分支
7. 改 `secrets-schema.ts` 同步字段
8. 改 `actor-agenda.ts` / `actor-agenda.test.ts` 改名
9. 改 `initialize-new-game.ts` 删除 roles 引用
10. 改 `upsert-actor.ts` 删除 publicRoles 工具 schema
11. 改工具测试 / 后台文件中的引用
12. 跑 `pnpm format && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
13. commit & push
