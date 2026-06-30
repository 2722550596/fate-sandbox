# Fix Phase 6 — Scene 约束统一 + Beat Memory 松绑

## 改动项

两块独立修复，一起执行。

---

### 1. `setLocation` / `setSituation` 加 `assertActiveStoryWindow`

#### 现状

```
setLocation     → 无 storyWindow 检查
setSituation    → 无 storyWindow 检查
addObjective    → assertActiveStoryWindow ✅
resolveObjective → assertActiveStoryWindow ✅
addThreat       → assertActiveStoryWindow ✅
clearThreat     → assertActiveStoryWindow ✅
```

`situation` 可以在 beat 外随意切换。一旦切换成 combat，不能加 threat（因为 add-threat 需要 beat），出现操作缺口。

#### 目标

所有 scene 事件统一要求 active storyWindow，六种事件约束一致。

#### 改动

`scene.ts` 两处加一行：

```typescript
function setLocation(draft, event) {
  assertActiveStoryWindow(draft, "set-location"); // ← 加
  draft.public.scene.location = event.location;
  draft.public.scene.lastResolvedAt = draft.public.clock.currentAt;
  return { message: "地点已修正。" };
}

function setSituation(draft, event) {
  assertActiveStoryWindow(draft, "set-situation"); // ← 加
  draft.public.scene.situation = event.situation;
  draft.public.scene.lastResolvedAt = draft.public.clock.currentAt;
  return { message: `态势已更新为 ${event.situation}。` };
}
```

（注：`lastResolvedAt` 行是之前 Fix 4 已经加上的，这里不重复。）

---

### 2. `progress_scene_beat` 的 memory claims 松绑

#### 现状

`progress-scene-beat.ts` 工具 schema 中 `claims` 是必填数组：

```typescript
// sceneBeatMemorySchema()
claims: Type.Array(
  Type.Object({
    kind: Type.String({ ... }),
    statement: Type.String(),
    certainty: Type.String({ ... }),
    ...
  }),
),
```

`scene-beat-schema.ts` 业务 schema 中也是必填：

```typescript
export const SCENE_BEAT_MEMORY_INPUT_SCHEMA = Type.Object({
  ...
  claims: Type.Array(MEMORY_CLAIM_SCHEMA),  // 必填
});
```

#### 问题

这是 memory 系统强制 claims 的连锁反应——Fix 4 已经把 `memory.ts` 的 `validateClaims` 修正为对 `record-major-event` 之外放行，但 beat 系统的 schema 层还没松绑。

而且 `progress_scene_beat complete` 调用的 memory 事件固定是 `kind: "record-major-event"`（`buildMemoryEvent` 写死的），所以 claims 必填在这里是合理的——重大事件确实需要 claims。但 schema 层不应该比业务层更严格。

#### 目标

与 Fix 4 对齐：schema 放行 `Type.Optional`，业务逻辑在 `memory.ts` 的 `validateClaims` 里对 `record-major-event` 强制检查。

#### 改动

**`scene-beat-schema.ts`**：

```typescript
export const SCENE_BEAT_MEMORY_INPUT_SCHEMA = Type.Object({
  title: Type.String({ minLength: 1 }),
  summary: Type.String({ minLength: 1 }),
  consequences: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  claims: Type.Optional(Type.Array(MEMORY_CLAIM_SCHEMA)), // ← Optional
});
```

**`progress-scene-beat.ts`** 工具 schema：

```typescript
function sceneBeatMemorySchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    title: Type.String(),
    summary: Type.String(),
    consequences: Type.Optional(Type.Array(Type.String())),
    claims: Type.Optional(
      Type.Array(
        Type.Object({
          kind: Type.String({ description: "mundane / identity / location / ..." }),
          statement: Type.String(),
          certainty: Type.String({
            description: "observed / confirmed / inferred / rumor / hypothesis",
          }),
          subjectId: Type.Optional(Type.String()),
          relatedSecretSlotIds: Type.Optional(Type.Array(Type.String())),
          evidence: Type.Optional(Type.String()),
        }),
      ),
    ),
  });
}
```

`scene-beat-lifecycle.ts` 的 `buildMemoryEvent` 不变（`claims` 透传给 `recordMemory`，`validateClaims` 在 `memory.ts` 中按 `record-major-event` 强制检查）。

---

## 涉及文件

| 文件                                        | 改动                                                        |
| ------------------------------------------- | ----------------------------------------------------------- |
| `engine/core/scene/scene.ts`                | `setLocation` / `setSituation` 加 `assertActiveStoryWindow` |
| `engine/core/scene/scene-beat-schema.ts`    | `SCENE_BEAT_MEMORY_INPUT_SCHEMA` 的 `claims` 改为 Optional  |
| `engine/tools/scene/progress-scene-beat.ts` | `sceneBeatMemorySchema()` 的 `claims` 改为 Optional         |
| `engine/core/scene/scene.test.ts`           | 如果有 setLocation/setSituation 的无 beat 测试，更新或新增  |

---

## 与 Fix 1/2/3/4/5 的关系

**无冲突。** Fix 4 修正了 `memory.ts` 的 `validateClaims`，Fix 6 同步 schema 层。

---

## 执行步骤

1. `scene.ts` 两处加 `assertActiveStoryWindow`
2. `scene-beat-schema.ts` claims 加 `Type.Optional`
3. `progress-scene-beat.ts` 工具 schema 同步
4. 跑 `pnpm format && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
5. commit & push
