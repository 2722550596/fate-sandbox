# Fix Phase 4 — Knowledge 系统补全

## 改动项

两块独立修复，一起执行。

---

### 1. `secretEventLog` — 从死字段变成活跃审计日志

#### 现状

`secretEventLog` 目前只被 `faction-clock.ts` 写入（阵营时钟满归零、定时事件兑现），**不被 secret 系统自身写入，也不被任何业务逻辑读取**。

#### 问题链

```
configureSecrets  → 写 secret slot      ❌ 不写日志
revealSecret      → 改 revealState      ❌ 不写日志
privateResolve    → 返回 outcome        ❌ 不留持久化痕迹
factionClock      → 兑现时钟            ✅ 写日志（唯一正确使用的）
parallel-line     → 装配子代理上下文    ❌ 不消费 secretEventLog
```

#### 目标

**让 `secretEventLog` 成为 secret 系统的审计日志，同时被 backstage 消费。**

#### 改动内容

##### a) `secrets.ts` 新增辅助函数

```typescript
function recordSecretEvent(draft: State, summary: string, relatedActorIds: string[] = []): void {
  draft.secrets.secretEventLog.push({
    id: createId(draft, "secret-event"),
    time: draft.public.clock.currentAt,
    summary,
    relatedActorIds,
  });
}
```

##### b) `configureSequenceSecrets` 写入日志

```typescript
// 配置成功后
recordSecretEvent(draft, `${input.actorId} 的非凡秘密已配置`, [input.actorId]);
```

##### c) `configureActorSecrets` 写入日志

```typescript
recordSecretEvent(draft, `${input.actorId} 的隐藏动机/归属已配置`, [input.actorId]);
```

##### d) `revealSecret` 写入日志

在 `applyRevealSecret` 返回 `"revealed"` 时记录：

```typescript
// revealSecret() 中，outcome === "revealed" 时
const actorLabel = draft.public.actors[event.actorId]?.presentation.renderName ?? event.actorId;
recordSecretEvent(draft, `${actorLabel} 的隐藏秘密已被揭示：${result.playerSafeMessage}`, [
  event.actorId,
]);
```

`"foreshadowed"` 时也可选择性记录。

##### e) `privateResolve` 写入日志

```typescript
// hiddenReaction() 判定有相关秘密时
recordSecretEvent(draft, `${actorLabel} 隐藏反应事件`, [event.actorId]);

// secretCompatibility() 判定双方都有秘密时
recordSecretEvent(draft, `${actorLabel} 与 ${targetLabel} 的隐藏相性事件`, [
  event.actorId,
  event.targetActorId,
]);
```

##### f) `parallel-line-assembler.ts` 消费 recent secret events

在 `buildRecentOffscreenEvents` 同一区域，新增读取最近 secretEventLog 的逻辑：

```typescript
/** 构建最近隐藏事件摘要，注入子代理上下文。 */
function buildRecentSecretEvents(state: State): string[] {
  return state.secrets.secretEventLog.slice(-RECENT_SECRET_LIMIT).map((event) => {
    const actors = event.relatedActorIds
      .map((id) => state.public.actors[id]?.presentation.renderName ?? id)
      .join("、");
    return `[${event.time}] ${event.summary}（涉及：${actors}）`;
  });
}
```

`RECENT_SECRET_LIMIT` 设为 3-5 条即可，跟 offscreen 的 limit 一致。

##### g) `faction-clock.ts` 保持现有写入

无需修改，它已经正确使用 `secretEventLog`。

##### h) `state-file-projection.ts` — 显示层消费

当前 GM timeline 投影已经在展示 `recentOffscreenEvents`，
在同区域加入 `recentSecretEvents`：

```typescript
// state-file-projection.ts，在 offscreenEventLog 之后
const recentSecretEvents = secrets.secretEventLog
  .slice(-RECENT_SECRET_LIMIT)
  .map((event, index) => secretEventContext(event, index));

// 新增渲染函数
function secretEventContext(value: unknown, index: number): TimelineSecretEventContext {
  const event = requireRecord(value, `secretEventLog[${index}]`);
  return {
    time: requireString(event["time"], `secretEventLog[${index}].time`),
    summary: requireString(event["summary"], `secretEventLog[${index}].summary`),
    actorIds: stringArray(event["relatedActorIds"], `secretEventLog[${index}].relatedActorIds`),
  };
}
```

GM timeline 投影中会同时出现：

```
📌 最近幕后事件：
  蒸汽教会调查取得突破（offscreen）
  阿兹克对神秘刺激产生隐藏反应（secret）
  protagonist 的占卜家途径秘密已配置（secret）
```

不需要新工具、不改 recall_memory——只是把 `secretEventLog` 加入已有的投影视图。

---

### 2. Memory Claim 验证修正

#### 现状

`memory-schema.ts` 中 `claims` 已是 `Type.Optional`（第 66 行），但 `memory.ts` 的 `validateClaims()` 仍然强制抛出：

```typescript
// memory.ts 第 90-95 行
function validateClaims(draft: State, claims: readonly MemoryClaim[] | undefined): void {
  if (claims === undefined || claims.length === 0) {
    throw new Error("record_memory 必须提供 claims...");
  }
  // ...
}
```

**Schema 已放行，业务逻辑没跟上。**

#### 目标

对 `pin-fact` 和 `record-daily-summary` 放行空 claims；`record-major-event` 仍强制要求 claims。

#### 改动内容

`memory.ts` 修改 `validateClaims` 的签名和逻辑：

```typescript
function validateClaims(
  draft: State,
  claims: readonly MemoryClaim[] | undefined,
  eventKind: string, // ← 新增参数
): void {
  // pin-fact 和 daily-summary 允许不传 claims
  if (eventKind !== "record-major-event" && (claims === undefined || claims.length === 0)) {
    return;
  }
  // record-major-event 必须带 claims
  if (claims === undefined || claims.length === 0) {
    throw new Error(
      "record-major-event 必须提供 claims；用结构化 claim 表达 public memory 的事实类型、确定性和证据。普通事实用 kind=mundane。",
    );
  }
  // 剩余验证逻辑不变...
}
```

调用处同步更新：

```typescript
// recordPinnedFact (第 51 行)
validateClaims(draft, event.claims, event.kind);

// recordMajorEvent (第 71 行)
validateClaims(draft, event.claims, event.kind);
```

---

## 涉及文件

| 文件                                               | 改动                                                                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `engine/core/knowledge/secrets.ts`                 | 新增 `recordSecretEvent()`；`configureSequenceSecrets` / `configureActorSecrets` / `revealSecret` / `privateResolve` 写入日志 |
| `engine/core/backstage/parallel-line-assembler.ts` | 新增 `buildRecentSecretEvents()`，装配子代理上下文时注入                                                                      |
| `engine/core/state/state-file-projection.ts`       | 新增 `recentSecretEvents` 投影，与 `recentOffscreenEvents` 并列展示                                                           |
| `engine/core/knowledge/memory.ts`                  | `validateClaims` 对 pin-fact/daily-summary 放行空 claims                                                                      |

---

## 与 Fix 1/2/3 的关系

**无冲突。** 操作的是不同文件集。

---

## 执行步骤

1. `secrets.ts` 加 `recordSecretEvent` 辅助函数
2. `secrets.ts` 四处关键点接入记录
3. `parallel-line-assembler.ts` 加最近 secret events 注入
4. `state-file-projection.ts` 加入 `recentSecretEvents` 投影
5. `memory.ts` 改 `validateClaims` 签名 + 逻辑
6. 跑 `pnpm format && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
7. commit & push
