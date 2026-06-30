# Fix Phase 2 — Actor Schema 合并

## 改动项

将 `acting-schema.ts` 和 `actor-condition-schema.ts` 合并到 `actor-schema.ts`，然后删除这两个独立文件。

---

## 理由

### `acting-schema.ts`（52 行）

仅定义了 1 种工具事件（`advance-acting`）、1 个子结构（`CueEntry`）。操作的数据（`SequenceState.actingCues[]`）是完全内嵌在 Actor 里的字段。没有独立 state，不应有独立 schema 文件。

### `actor-condition-schema.ts`（85 行）

定义了 3 种工具事件（`add-affliction` / `resolve-condition` / `update-wound`）。操作的数据（`ConditionState.afflictions[]`）是完全内嵌在 Actor 里的字段。没有独立 state，不应有独立 schema 文件。

两个文件都不符合"子系统有独立 state 树 → 独立 schema 文件"的模式——对比 economy（有 `MoneyPurse[]`、`Debt[]`），tracked items（有 `Record<ItemId, TrackedItemState>`），它们的数据只是 Actor 上的一个小数组，直接在 `actor-schema.ts` 里定义完全合理。

---

## 合并内容

### 从 `acting-schema.ts` 搬入 `actor-schema.ts`

```typescript
// ===========================================================================
// Acting — 扮演消化事件
// ===========================================================================

const ACTING_CUE_ENTRY_SCHEMA = Type.Object({
  key: Type.String({ minLength: 1 }),
  label: Type.String({ minLength: 1 }),
});

export const ACTING_EVENT_KINDS = ["advance-acting"] as const;
const ACTING_EVENT_KIND_SCHEMA = stringEnumSchema(ACTING_EVENT_KINDS);

export const ADVANCE_ACTING_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("advance-acting"),
  actorId: Type.String({ minLength: 1 }),
  cues: Type.Array(ACTING_CUE_ENTRY_SCHEMA, { minItems: 1 }),
  reason: Type.String({ minLength: 1 }),
});

export type AdvanceActingInput = Static<typeof ADVANCE_ACTING_EVENT_SCHEMA>;
export type ActingEvent = AdvanceActingInput;

const ACTING_EVENT_KIND_VALIDATOR = Compile(ACTING_EVENT_KIND_SCHEMA);
const ADVANCE_ACTING_EVENT_VALIDATOR = Compile(ADVANCE_ACTING_EVENT_SCHEMA);

const ACTING_EVENT_VARIANT_VALIDATORS = {
  "advance-acting": ADVANCE_ACTING_EVENT_VALIDATOR,
} satisfies Record<ActingEvent["kind"], TypeBoxValidator<ActingEvent>>;

export function parseActingEvent(value: unknown, fieldName: string): ActingEvent {
  return parseTaggedTypeBoxUnion<ActingEvent["kind"], ActingEvent>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    ACTING_EVENT_KIND_VALIDATOR,
    ACTING_EVENT_VARIANT_VALIDATORS,
  );
}
```

### 从 `actor-condition-schema.ts` 搬入 `actor-schema.ts`

```typescript
// ===========================================================================
// Actor Condition — 状态效果事件
// ===========================================================================

const AFFLICTION_SOURCE_SCHEMA = stringEnumSchema([
  "combat",
  "beyonder-ability",
  "environment",
  "item",
  "other",
]);

const AFFLICTION_OUTCOME_SCHEMA = stringEnumSchema(["recovered", "stabilized"]);

export const ACTOR_CONDITION_EVENT_KINDS = [
  "add-affliction",
  "resolve-condition",
  "update-wound",
] as const;
const ACTOR_CONDITION_EVENT_KIND_SCHEMA = stringEnumSchema(ACTOR_CONDITION_EVENT_KINDS);

export const ADD_AFFLICTION_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-affliction"),
  actorId: Type.String({ minLength: 1 }),
  source: AFFLICTION_SOURCE_SCHEMA,
  text: Type.String({ minLength: 1 }),
  expectedDuration: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  reason: Type.String({ minLength: 1 }),
});

export const RESOLVE_CONDITION_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("resolve-condition"),
  actorId: Type.String({ minLength: 1 }),
  conditionId: Type.String({ minLength: 1 }),
  outcome: AFFLICTION_OUTCOME_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export const UPDATE_WOUND_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("update-wound"),
  actorId: Type.String({ minLength: 1 }),
  conditionId: Type.String({ minLength: 1 }),
  text: Type.Optional(Type.String({ minLength: 1 })),
  source: Type.Optional(AFFLICTION_SOURCE_SCHEMA),
  expectedDuration: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  reason: Type.String({ minLength: 1 }),
});

export type ActorConditionEvent =
  | Static<typeof ADD_AFFLICTION_EVENT_SCHEMA>
  | Static<typeof RESOLVE_CONDITION_EVENT_SCHEMA>
  | Static<typeof UPDATE_WOUND_EVENT_SCHEMA>;

const ACTOR_CONDITION_EVENT_KIND_VALIDATOR = Compile(ACTOR_CONDITION_EVENT_KIND_SCHEMA);
const ADD_AFFLICTION_EVENT_VALIDATOR = Compile(ADD_AFFLICTION_EVENT_SCHEMA);
const RESOLVE_CONDITION_EVENT_VALIDATOR = Compile(RESOLVE_CONDITION_EVENT_SCHEMA);
const UPDATE_WOUND_EVENT_VALIDATOR = Compile(UPDATE_WOUND_EVENT_SCHEMA);

const ACTOR_CONDITION_EVENT_VARIANT_VALIDATORS = {
  "add-affliction": ADD_AFFLICTION_EVENT_VALIDATOR,
  "resolve-condition": RESOLVE_CONDITION_EVENT_VALIDATOR,
  "update-wound": UPDATE_WOUND_EVENT_VALIDATOR,
} satisfies Record<ActorConditionEvent["kind"], TypeBoxValidator<ActorConditionEvent>>;

export function parseActorConditionEvent(value: unknown, fieldName: string): ActorConditionEvent {
  return parseTaggedTypeBoxUnion<ActorConditionEvent["kind"], ActorConditionEvent>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    ACTOR_CONDITION_EVENT_KIND_VALIDATOR,
    ACTOR_CONDITION_EVENT_VARIANT_VALIDATORS,
  );
}
```

---

## 删除的文件

```
engine/core/actor/acting-schema.ts           → 删
engine/core/actor/actor-condition-schema.ts  → 删
```

---

## 更新 import 路径

| 文件                                               | 原 import                                                                                             | 改为                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------- |
| `engine/core/actor/actor-condition.ts`             | `from "./actor-condition-schema.ts"`                                                                  | `from "./actor-schema.ts"` |
| `engine/tools/actor/actor-condition-normalizer.ts` | `from "../../core/actor/actor-condition-schema.ts"` 以及 `from "../../core/actor/actor-condition.ts"` | 调整到 `actor-schema.ts`   |
| 其他引用 `acting-schema` 的地方                    | 原 import                                                                                             | 改到 `actor-schema.ts`     |

---

## 执行步骤

1. 打开 `actor-schema.ts`，在末尾添加两个分区（Condition 和 Acting）
2. 更新 `actor-condition.ts` 的 import：`actor-condition-schema` → `actor-schema`
3. 更新 `actor-condition-normalizer.ts` 的 import
4. 更新其他引用 `acting-schema` 的地方
5. 删除两个文件
6. 跑 `pnpm format && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
7. commit & push

---

## 与 Fix Phase 1 的关系

**无冲突，可合并执行。** Fix Phase 1 删除的是 `ActorRole` 类型 + `factionId` + 字段改名；Fix Phase 2 做的是文件合并。两个 Phase 的操作对象不同（类型定义 vs 文件组织），可以同步进行，也可以先后进行。
