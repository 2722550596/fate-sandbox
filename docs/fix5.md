# Fix Phase 5 — DirectionPacket 补全场景上下文

## 问题

渲染器（Pass B）通过 `DirectionPacket` 接收"导演指令本"产出正文，但当前 packet 不包含任何结构化时间、地点或场景信息。渲染器只能从 `resolvedChanges` 的自由文本中猜测"现在是几点""在哪""什么态势"——如果 GM 忘了写，渲染器就完全不知道。

## 改动项

两块：加字段 + 填数据。

---

### 1. `packet-schema.ts` — 新增 `sceneTime` + `sceneContext`

```typescript
// 新增
import { SITUATION_KIND_SCHEMA } from "../core/state/state-enum-schemas.ts";

export const SCENE_TIME_SCHEMA = Type.Object({
  /** 格式化当前时间，如「第五纪1349年1月15日 星期二 14:30」 */
  display: Type.String({ minLength: 1 }),
  /** 本轮经过分钟数 */
  elapsedMinutes: Type.Integer({ minimum: 1 }),
});

export const SCENE_CONTEXT_SCHEMA = Type.Object({
  /** 地点文本，如「廷根市·霍伊大学·值夜者据点」 */
  location: Type.String({ minLength: 1 }),
  /** 态势 */
  situation: SITUATION_KIND_SCHEMA,
  /** 在场 actor 的 renderName 列表 */
  presentActors: Type.Array(Type.String({ minLength: 1 })),
  /** 仅在 beat 激活时出现 */
  beat: Type.Optional(
    Type.Object({
      title: Type.String({ minLength: 1 }),
      objectives: Type.Array(Type.String({ minLength: 1 })),
      threats: Type.Array(Type.String({ minLength: 1 })),
    }),
  ),
});

// RENDER_DIRECTION_PACKET_SCHEMA 中新增两个字段
export const RENDER_DIRECTION_PACKET_SCHEMA = Type.Object({
  needsRender: Type.Literal(true),
  playerAction: Type.String({ minLength: 1 }),
  resolvedChanges: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),

  // ——— 新增 ———
  sceneTime: SCENE_TIME_SCHEMA,
  sceneContext: SCENE_CONTEXT_SCHEMA,

  // ——— 不变 ———
  npcStances: Type.Array(NPC_STANCE_SCHEMA),
  npcOmissions: Type.Optional(Type.Array(NPC_OMISSION_SCHEMA)),
  sensoryAnchors: Type.Array(Type.String({ minLength: 1 })),
  endWindow: Type.String({ minLength: 1 }),
  eventWeight: stringEnumSchema(EVENT_WEIGHTS),
  canonFacts: Type.Array(Type.String({ minLength: 1 })),
  suggestedActions: Type.Optional(
    Type.Array(SUGGESTED_ACTION_SCHEMA, { minItems: 1, maxItems: 4 }),
  ),
});

// Type 推导同步
export type SceneTime = Static<typeof SCENE_TIME_SCHEMA>;
export type SceneContext = Static<typeof SCENE_CONTEXT_SCHEMA>;
```

### 2. `submit-direction-packet.ts`（或新文件 `packet-builder.ts`）— 填充逻辑

```typescript
import { formatHumanTime } from "../../core/state/date-time.ts";
import type { State } from "../../core/state/state.ts";
import type { SceneTime, SceneContext } from "../../direction/packet-schema.ts";

export function buildSceneTime(state: State, elapsedMinutes?: number): SceneTime {
  const human = formatHumanTime(state.public.clock.currentAt, state.public.clock.timezone);
  return {
    display: human.display,
    elapsedMinutes: elapsedMinutes ?? 1,
  };
}

export function buildSceneContext(state: State): SceneContext {
  const scene = state.public.scene;
  const context: SceneContext = {
    location: `${scene.location.region}·${scene.location.site}·${scene.location.detail}`,
    situation: scene.situation,
    presentActors: scene.presentActorIds
      .map((id) => state.public.actors[id]?.presentation.renderName)
      .filter((name): name is string => name !== undefined),
  };

  if (scene.storyWindow !== null) {
    context.beat = {
      title: scene.storyWindow.title,
      objectives: scene.objectives.map((o) => o.summary),
      threats: scene.threats.map((t) => t.summary),
    };
  }
  return context;
}
```

在 `submit-direction-packet.ts` 的 `execute` 回调中调用，向 packet 注入 `sceneTime` 和 `sceneContext`。注意：`submit-direction-packet` 当前不改 state（它只是防火墙验证），所以填充逻辑可以放在验证之后、返回之前，或者放在 `buildRendererMessages()` 中作为渲染器侧的后处理。

**推荐方案**：在 `buildRendererMessages()` 中填充。`packet` 参数已经有 `RenderDirectionPacket` 类型，`buildRendererMessages` 调用时 state 已经在 `getState()` 中可达。这样不改 packet schema 的 required 字段（保持向后兼容），渲染器侧自行读取 state 填充 `sceneTime` 和 `sceneContext`。

### 3. `buildRendererMessages()` — 渲染器输入中加入展示

在 `finalSections` 拼装中加入：

```typescript
const timeSection = buildSceneTimeSection(state);
const contextSection = buildSceneContextSection(state);
finalSections.push(timeSection, contextSection);
```

```typescript
function buildSceneTimeSection(state: State): string {
  const human = formatHumanTime(state.public.clock.currentAt, state.public.clock.timezone);
  return ["# Current Game Time", "", `${human.display}`, ""].join("\n");
}

function buildSceneContextSection(state: State): string {
  const scene = state.public.scene;
  const lines = [
    "# Scene Context",
    "",
    `Location: ${scene.location.region}·${scene.location.site}·${scene.location.detail}`,
    `Situation: ${scene.situation}`,
  ];
  const presentNames = scene.presentActorIds
    .map((id) => state.public.actors[id]?.presentation.renderName)
    .filter(Boolean);
  if (presentNames.length > 0) {
    lines.push(`Present: ${presentNames.join("、")}`);
  }
  if (scene.storyWindow !== null) {
    lines.push("");
    lines.push(`Active Beat: ${scene.storyWindow.title}`);
    const objectives = scene.objectives.map((o) => `  - ${o.summary}`);
    const threats = scene.threats.map((t) => `  - [威胁] ${t.summary}`);
    lines.push(...objectives, ...threats);
  }
  lines.push("");
  return lines.join("\n");
}
```

---

## 涉及文件

| 文件                                    | 改动                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `engine/direction/packet-schema.ts`     | 新增 `SCENE_TIME_SCHEMA` + `SCENE_CONTEXT_SCHEMA`；并入 `RENDER_DIRECTION_PACKET_SCHEMA` |
| `engine/direction/render-turn.ts`       | `buildRendererMessages()` 中注入 time/context 展示                                       |
| `engine/direction/packet-validation.ts` | 验证逻辑同步更新（如涉及新字段校验）                                                     |
| `extensions/render/index.ts`            | 不变（`buildRendererMessages` 已封装）                                                   |

---

## 与 Fix 1/2/3/4 的关系

**无冲突。** 操作的是方向层和渲染层，不碰 state 结构。

---

## 执行步骤

1. `packet-schema.ts` 新增 `SCENE_TIME_SCHEMA` + `SCENE_CONTEXT_SCHEMA`
2. `RENDER_DIRECTION_PACKET_SCHEMA` 中加入两个新字段
3. `render-turn.ts` 的 `buildRendererMessages()` 加入 time/context 展示块
4. 跑 `pnpm format && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
5. commit & push
