import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { Type } from "typebox";

import { exportStateTool } from "./debug/export-state";
import { getStateSchemaTool } from "./debug/get-state-schema";
import { overrideLockedFactTool } from "./debug/override-locked-fact";
import { resetStateTool } from "./debug/reset-state";
import { lookupTool } from "./lookup/lookup";
import { commitTurnTool } from "./state/commit-turn";
import { finishCurrentBeatTool } from "./state/finish-current-beat";
import { getStatusTool } from "./state/get-status";
import { patchStateTool } from "./state/patch-state";
import { privateResolveTool } from "./state/private-resolve";
import { recordMemoryTool } from "./state/record-memory";
import { recordOffscreenEventTool } from "./state/record-offscreen-event";
import { revealSecretTool } from "./state/reveal-secret";
import { setScenePresenceTool } from "./state/set-scene-presence";
import { startSceneBeatTool } from "./state/start-scene-beat";
import { updateActorConditionTool } from "./state/update-actor-condition";
import { updateEconomyTool } from "./state/update-economy";
import { updateSceneTool } from "./state/update-scene";
import { updateServantFormTool } from "./state/update-servant-form";
import { upsertActorTool } from "./state/upsert-actor";

export function registerAllTools(pi: ExtensionAPI): void {
  const toolLabel = "FSN 沙盒";

  pi.registerTool({
    label: toolLabel,
    name: "commit_turn",
    description:
      "每轮叙事结束时一次性提交本轮发生的领域事件；用于降低 GM 对多个状态工具顺序的注意力负担。\n\n" +
      "【必须调用的场景】\n" +
      "- 一轮回复同时改变时间/地点、Scene Objective、伤势、物品、资金、记忆或从者资源中的多个状态\n" +
      "- 叙事已经发生购买、治疗、移动、揭示、消耗、战斗结算等 canonical Game State 变化\n" +
      "- 复杂 beat 收口时需要按顺序提交内部 scene-beat transition、移动、memory 等多个事件；常规收口优先用 finish_current_beat\n\n" +
      "【严禁的行为】\n" +
      "- 把它当裸 patch；events 必须是已有领域事件\n" +
      "- 提交 Hidden Fact 到 Public Game State；秘密仍必须走 reveal_secret/private_resolve/record_offscreen_event\n" +
      "- 没有状态变化时为了形式调用",
    parameters: Type.Object({
      summary: Type.Optional(
        Type.String({
          description: "本轮玩家可见状态变化摘要；省略时工具会从事件 reason 自动生成",
        }),
      ),
      events: Type.Array(
        Type.Object({
          kind: Type.Union([
            Type.Literal("scene"),
            Type.Literal("scene-presence"),
            Type.Literal("scene-beat"),
            Type.Literal("actor-condition"),
            Type.Literal("servant-form"),
            Type.Literal("economy"),
            Type.Literal("memory"),
          ]),
          event: Type.Unknown({
            description:
              "对应领域事件载荷；scene-presence 使用 {presentActorIds, allyActorIds}，也可兼容 scene event kind='set-scene-presence'；scene-beat 使用 {kind:'begin-beat'|'transition-beat'|'move-location', input:{...}}。transition-beat 未提供 resolvedObjectiveIds/resolvedObjectiveSummaries 时默认解决当前 beat 全部目标；resolve-objective 可用 objectiveSummary，不要传 undefined",
          }),
        }),
      ),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      commitTurnTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "finish_current_beat",
    description:
      "以当前 storyWindow 为上下文收口当前 Scene Beat；这是常用叙事 macro tool，避免手写 commit_turn 的 transition-beat/memory/presence 事务 AST。\n\n" +
      "【必须调用的场景】\n" +
      "- 当前 beat 的目标已经在叙事中全部满足，需要收口并进入短暂停顿或下一个 beat\n" +
      "- 玩家完成调查/揭示/对峙/撤离后，需要同时 transition 当前 beat、可选记录 memory、可选更新在场角色\n" +
      "- 你只知道“当前 beat 已完成”，不想手填 completedBeatId/objectiveIds/storyWindow.currentArcId\n\n" +
      "【严禁的行为】\n" +
      "- 当前没有 storyWindow 时调用；普通多事件状态变化用 commit_turn\n" +
      "- 未满足当前 completionCriteria 就强行收口\n" +
      "- 用 memory 写入未揭示 secret；公开记忆仍必须提供 claims 并遵守证据门禁",
    parameters: Type.Object({
      outcome: Type.String({ description: "当前 beat 收口结果摘要，也会作为事务 summary/reason" }),
      memory: Type.Optional(
        Type.Object({
          title: Type.String(),
          summary: Type.String(),
          consequences: Type.Optional(Type.Array(Type.String())),
          claims: Type.Array(
            Type.Object({
              kind: Type.Union([
                Type.Literal("mundane"),
                Type.Literal("identity"),
                Type.Literal("location"),
                Type.Literal("affiliation"),
                Type.Literal("motive"),
                Type.Literal("ability"),
                Type.Literal("resource"),
                Type.Literal("relationship"),
                Type.Literal("event-cause"),
                Type.Literal("world-fact"),
              ]),
              statement: Type.String(),
              certainty: Type.Union([
                Type.Literal("observed"),
                Type.Literal("confirmed"),
                Type.Literal("inferred"),
                Type.Literal("rumor"),
                Type.Literal("hypothesis"),
              ]),
              subjectId: Type.Optional(Type.String()),
              relatedSecretSlotIds: Type.Optional(Type.Array(Type.String())),
              evidence: Type.Optional(Type.String()),
            }),
          ),
        }),
      ),
      nextBeat: Type.Optional(
        Type.Union([
          Type.Object({
            title: Type.String(),
            objectives: Type.Array(Type.String({ description: "下一 beat 的 1-5 个玩家可见目标" })),
            beatId: Type.Optional(Type.String()),
            allowedActions: Type.Optional(Type.Array(Type.String())),
            forbiddenEscalations: Type.Optional(Type.Array(Type.String())),
            completionCriteria: Type.Optional(Type.Array(Type.String())),
            nextBeatHints: Type.Optional(Type.Array(Type.String())),
            presentActorIds: Type.Optional(Type.Array(Type.String())),
            allyActorIds: Type.Optional(Type.Array(Type.String())),
            situation: Type.Optional(situationSchema()),
          }),
          Type.Null(),
        ]),
      ),
      presentActorIds: Type.Optional(Type.Array(Type.String())),
      allyActorIds: Type.Optional(Type.Array(Type.String())),
      situation: Type.Optional(situationSchema()),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      finishCurrentBeatTool(params, ctx.sessionManager),
  });
  pi.registerTool({
    label: toolLabel,
    name: "get_status",
    description:
      "查看玩家可见状态摘要；返回 GM brief 风格读模型，不展示完整 JSON。\n\n" +
      "【必须调用的场景】\n" +
      "- 需要确认时间、地点、玩家角色、资金、伤势、目标、威胁或近期记忆时\n" +
      "- 玩家询问当前状态、同行者、资源或剧情账本时\n\n" +
      "【严禁的行为】\n" +
      "- 凭记忆叙述机械事实——以工具返回为准\n" +
      "- 要求或输出 canonical state JSON",
    parameters: Type.Object({}),
    execute: async () => getStatusTool(),
  });

  pi.registerTool({
    label: toolLabel,
    name: "start_scene_beat",
    description:
      "以叙事意图开启复杂 Scene Beat；这是常用 macro tool，会自动生成 beat id、继承当前 arc，并建立 storyWindow/objectives/threats/presence。\n\n" +
      "【必须调用的场景】\n" +
      "- 进入新的调查、潜入、对峙、撤退、战斗准备等复杂场景，需要 1-5 个当前目标\n" +
      "- 不想手写 storyWindow.currentArcId/currentBeatId/allowedActions 等账本字段\n" +
      "- 进入复杂 beat 的同时发生移动或时间推进：同时提供 location 和 elapsedMinutes\n\n" +
      "【严禁的行为】\n" +
      "- 用它记录长期目标或幕后真相；长期后果写 memory，秘密走 reveal/private_resolve/offscreen\n" +
      "- 只有简单移动或几分钟日常过渡时调用；简单变化用 update_scene\n" +
      "- location 和 elapsedMinutes 只提供其一；同步移动必须两者都有",
    parameters: Type.Object({
      title: Type.String(),
      objectives: Type.Array(Type.String({ description: "当前 beat 的 1-5 个玩家可见目标" })),
      purpose: Type.String({ description: "为什么进入这个 beat；也会作为事务 summary/reason" }),
      arcId: Type.Optional(
        Type.String({ description: "可选；省略时继承当前 arc，没有当前 arc 时使用 main" }),
      ),
      beatId: Type.Optional(Type.String({ description: "可选；省略时自动生成" })),
      allowedActions: Type.Optional(Type.Array(Type.String())),
      forbiddenEscalations: Type.Optional(Type.Array(Type.String())),
      completionCriteria: Type.Optional(Type.Array(Type.String())),
      nextBeatHints: Type.Optional(Type.Array(Type.String())),
      threats: Type.Optional(
        Type.Array(
          Type.Object({
            summary: Type.String(),
            severity: threatSeveritySchema(),
          }),
        ),
      ),
      presentActorIds: Type.Optional(Type.Array(Type.String())),
      allyActorIds: Type.Optional(Type.Array(Type.String())),
      situation: Type.Optional(situationSchema()),
      location: Type.Optional(locationSchema()),
      elapsedMinutes: Type.Optional(Type.Union([Type.Integer(), Type.String()])),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      startSceneBeatTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "update_scene",
    description:
      "按领域事件更新时间、地点、场景态势、剧情窗口、目标、威胁。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家移动地点或时间推进，且本轮没有其他状态变化\n" +
      "- 用户/续局明确声明当前地点与状态不一致，只需修正地点且不推进时间：用 kind=set-location\n" +
      "- 场景态势切换为日常、调查、社交、战斗、仪式、逃跑、整备\n" +
      "- 单个当前目标/威胁变化；复杂 beat 开始用 start_scene_beat，当前 beat 收口用 finish_current_beat，多事件非常规组合用 commit_turn\n\n" +
      "【严禁的行为】\n" +
      "- 用叙事直接跳过时间或改变地点但不调用工具\n" +
      "- 用 set-location 表示剧情中的移动；剧情移动必须用 move-location 并提供 elapsedMinutes > 0\n" +
      "- 在复杂 beat 中手动拼 set-story-window/add-objective；改用 start_scene_beat\n" +
      "- 一轮内同时移动、完成目标、记录 memory，却绕过 commit_turn\n" +
      "- 越过当前 storyWindow.forbiddenEscalations 或未满足 completionCriteria 就提前进入下一战斗\n" +
      "- 在场 NPC 尚未写入 actor registry 时调用 private_resolve 或把 actorId 编出来\n" +
      "- 把长期目标塞进 scene；场景结束后应写入 memory",
    parameters: Type.Object({
      kind: Type.Union([
        Type.Literal("move-location"),
        Type.Literal("set-location"),
        Type.Literal("set-situation"),
        Type.Literal("set-story-window"),
        Type.Literal("clear-story-window"),
        Type.Literal("add-objective"),
        Type.Literal("resolve-objective"),
        Type.Literal("add-threat"),
        Type.Literal("clear-threat"),
      ]),
      location: Type.Optional(locationSchema()),
      elapsedMinutes: Type.Optional(Type.Union([Type.Integer(), Type.String()])),
      situation: Type.Optional(situationSchema()),
      storyWindow: Type.Optional(storyWindowSchema()),
      summary: Type.Optional(
        Type.String({ description: "add-objective/add-threat 必填：目标或威胁的玩家可见摘要" }),
      ),
      objectiveId: Type.Optional(
        Type.String({ description: "resolve-objective 可选；不确定 id 时用 objectiveSummary" }),
      ),
      objectiveSummary: Type.Optional(
        Type.String({ description: "resolve-objective 可选：目标原文或片段；不要传 undefined" }),
      ),
      threatId: Type.Optional(Type.String()),
      severity: Type.Optional(threatSeveritySchema()),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      updateSceneTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "record_memory",
    description:
      "写入玩家已知的长期事实、重大事件或日常摘要。每条 public memory 必须提供 claims：用结构化 claim 表达事实类型、确定性和证据；普通事实用 kind=mundane。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家身世确定；契约成立/解除/变更；NPC 死亡、失踪、重伤\n" +
      "- 真名公开、宝具首次解放、令咒使用、阵营变化、永久缺损\n" +
      "- 单次采购、调查发现、战斗结论等需要长期保留的事件：用 record-major-event，并提供 claims\n" +
      "- 半天以上时间跳过、日终或章节结束摘要：才用 record-daily-summary\n\n" +
      "【严禁的行为】\n" +
      "- 记录 GM 猜测、幕后真相、普通闲聊或短暂情绪\n" +
      "- 把玩家未确认秘密写进 public memory\n" +
      "- 非 mundane claim 缺少 evidence 或 relatedSecretSlotIds 却写成 confirmed/observed/inferred\n" +
      "- 用 record-daily-summary 绕过 claims 记录单次采购、单次调查或单次战斗结论",
    parameters: Type.Object({
      kind: Type.Union([
        Type.Literal("pin-fact"),
        Type.Literal("record-major-event"),
        Type.Literal("record-daily-summary"),
      ]),
      scope: Type.Optional(
        Type.Union([
          Type.Literal("protagonist"),
          Type.Literal("npc"),
          Type.Literal("faction"),
          Type.Literal("world"),
        ]),
      ),
      subject: Type.Optional(Type.String()),
      text: Type.Optional(Type.String()),
      sourceEventId: Type.Optional(Type.String()),
      claims: Type.Array(
        Type.Object({
          kind: Type.Union([
            Type.Literal("mundane"),
            Type.Literal("identity"),
            Type.Literal("location"),
            Type.Literal("affiliation"),
            Type.Literal("motive"),
            Type.Literal("ability"),
            Type.Literal("resource"),
            Type.Literal("relationship"),
            Type.Literal("event-cause"),
            Type.Literal("world-fact"),
          ]),
          statement: Type.String(),
          certainty: Type.Union([
            Type.Literal("observed"),
            Type.Literal("confirmed"),
            Type.Literal("inferred"),
            Type.Literal("rumor"),
            Type.Literal("hypothesis"),
          ]),
          subjectId: Type.Optional(Type.String()),
          relatedSecretSlotIds: Type.Optional(Type.Array(Type.String())),
          evidence: Type.Optional(Type.String()),
        }),
      ),
      title: Type.Optional(Type.String()),
      summary: Type.Optional(Type.String()),
      consequences: Type.Optional(Type.Array(Type.String())),
      startDate: Type.Optional(Type.String()),
      endDate: Type.Optional(Type.String()),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      recordMemoryTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "record_offscreen_event",
    description:
      "写入玩家不可见或仅预示的幕后事件；用于平行线 subagent 候选结果落地。\n\n" +
      "【必须调用的场景】\n" +
      "- 平行线 subagent 返回 offscreen/secret 事件，需要成为 canonical secret state\n" +
      "- NPC 阵营在玩家视野外完成侦察、准备、转移、结界调整或命令传达\n" +
      "- 需要保存 future hooks，但暂不写入 public memory\n\n" +
      "【严禁的行为】\n" +
      "- 写入 player-known；公开事实必须用 record_memory 或对应 update 工具\n" +
      "- 把 privateSummary 原样展示给玩家\n" +
      "- 越过当前剧情窗口或违反 forbiddenEscalations",
    parameters: Type.Object({
      lineId: Type.String(),
      actorIds: Type.Array(Type.String()),
      timeRange: Type.Object({ start: Type.String(), end: Type.String() }),
      visibility: Type.Union([Type.Literal("secret"), Type.Literal("foreshadowed")]),
      summary: Type.String(),
      consequences: Type.Array(Type.String()),
      futureHooks: Type.Array(Type.String()),
      createdFrom: Type.Union([
        Type.Literal("parallel-line-subagent"),
        Type.Literal("gm"),
        Type.Literal("debug"),
      ]),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      recordOffscreenEventTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "update_actor_condition",
    description:
      "更新 actor 的伤势、异常、长期影响、外观装备，或 tracked item。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家或已入场 actor 受伤、感染、诅咒、获得永久影响\n" +
      "- 伤势治疗状态发生变化，需要就地更新伤势描述/treatment\n" +
      "- 伤势/异常状态已自然恢复或稳定，需要从当前状态中移除\n" +
      "- 更换外观/装备呈现；换衣、伪装、灵装显现/灵子化导致可见服装变化时使用 kind=change-outfit（也兼容 update-outfit/change-clothes）\n" +
      "- 重要物品跨 actor 转移、状态变化或消耗明细变化\n" +
      "- 人类或其他非从者 actor 的魔术回路状态、Od、纪律或隶属需要更新\n" +
      "- 将新获得的关键物加入 trackedItems 追踪列表（跨场景持续影响选择的物品）\n\n" +
      "【严禁的行为】\n" +
      "- 改写锁定身份事实、真名或基础参数\n" +
      "- 用通用 HP 百分比替代离散伤势\n" +
      "- 叙事声称人类魔力/Od 已消耗或恢复，却不更新 actor.magecraft.circuits.od/status\n" +
      "- 把换衣/伪装/灵装外观变化误写成 update-wound；update-wound 只能更新已有 wound conditionId",
    parameters: Type.Object({
      kind: Type.String({
        description:
          "允许: add-wound, update-wound, add-affliction, add-permanent-effect, update-magecraft-circuits, resolve-condition, change-outfit, update-outfit(别名), change-clothes(别名), transfer-tracked-item, update-tracked-item, add-tracked-item。更换服装只用 change-outfit/update-outfit，不要用 update-wound。",
      }),
      actorId: Type.Optional(Type.String()),
      severity: Type.Optional(
        Type.Union([
          Type.Literal("minor"),
          Type.Literal("moderate"),
          Type.Literal("severe"),
          Type.Literal("critical"),
        ]),
      ),
      text: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      recoverable: Type.Optional(Type.Boolean()),
      expectedDuration: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      mechanicalEffect: Type.Optional(Type.String()),
      circuits: Type.Optional(
        Type.Object({
          count: Type.String({ description: "魔术回路数量摘要，如 27" }),
          quality: Type.String({ description: "Fate rank 或 none" }),
          od: Type.Integer({ description: "0-100 的内部 Od / 人类魔力余量" }),
          status: Type.Union([
            Type.Literal("normal"),
            Type.Literal("overheated"),
            Type.Literal("depleted"),
            Type.Literal("dormant"),
            Type.Literal("damaged"),
          ]),
          traits: Type.Array(Type.String()),
        }),
      ),
      outfit: Type.Optional(
        Type.Object({
          label: Type.String({ description: "外观/服装标签" }),
          details: Type.String({ description: "可见外貌与装备细节" }),
        }),
      ),
      itemId: Type.Optional(Type.String()),
      holderActorId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      ownerActorId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      label: Type.Optional(
        Type.String({ description: "add-tracked-item 必填：物品的玩家可见标签" }),
      ),
      itemKind: Type.Optional(
        Type.Union([
          Type.Literal("mundane"),
          Type.Literal("weapon"),
          Type.Literal("mystic-code"),
          Type.Literal("document"),
          Type.Literal("key-item"),
          Type.Literal("other"),
        ]),
      ),
      condition: Type.Optional(
        Type.Union([
          Type.Literal("intact"),
          Type.Literal("damaged"),
          Type.Literal("broken"),
          Type.Literal("spent"),
          Type.Literal("unknown"),
        ]),
      ),
      visibility: Type.Optional(
        Type.Union([Type.Literal("player-known"), Type.Literal("suspected")]),
      ),
      notes: Type.Optional(Type.Array(Type.String())),
      treatment: Type.Optional(
        Type.String({ description: "update-wound 可用：伤势当前治疗/处理状态" }),
      ),
      conditionKind: Type.Optional(Type.Union([Type.Literal("wound"), Type.Literal("affliction")])),
      conditionId: Type.Optional(Type.String()),
      outcome: Type.Optional(Type.Union([Type.Literal("recovered"), Type.Literal("stabilized")])),
      reason: Type.Optional(Type.String()),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      updateActorConditionTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "set_scene_presence",
    description:
      "更新当前场景在场 actor 与同行者；actor materialization 与 physical presence 分离，避免 upsert_actor 兼做入场/离场。\n\n" +
      "【必须调用的场景】\n" +
      "- 已存在 actor 入场、离场、同行者变化\n" +
      "- 使用 upsert_actor materialize 新 actor 后，需要声明其是否在当前 scene\n" +
      "- 场景切换但不需要 start_scene_beat / finish_current_beat 时\n\n" +
      "【严禁的行为】\n" +
      "- 写入不存在的 actorId；先用 upsert_actor materialize Player-Safe Skeleton\n" +
      "- 用 upsert_actor 的 actor registry 语义暗示在场变化\n" +
      "- 把秘密角色或 Hidden Fact 暴露到 Public Actor Registry",
    parameters: Type.Object({
      presentActorIds: Type.Array(Type.String()),
      allyActorIds: Type.Array(Type.String()),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      setScenePresenceTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "upsert_actor",
    description:
      "将 protagonist setup、玩家可见 NPC 摘要、NPC 安全 skeleton、或从者完整数据写入 public actor registry。\n\n" +
      "【必须调用的场景】\n" +
      "- 重要 NPC 正式入场且只需要可被 scene/presence 引用：使用 kind=ensure-public-npc（幂等，不覆盖已有 actor）\n" +
      "- 重要 NPC 需要完整公开投影：使用 kind=upsert-public-npc（仅公开身份/外观/关系）\n" +
      "- 开局 setup 确认玩家角色身份后：使用 kind=setup-protagonist\n" +
      "- 从者入场（有完整职阶/参数/技能/宝具）：使用 kind=upsert-servant\n" +
      "- 创建无主从者时 contractStatus 填 masterless，并省略 masterActorId/masterName，或填 null/none/无\n\n" +
      "【严禁的行为】\n" +
      "- 对普通 NPC 使用 upsert-servant\n" +
      "- 用 upsert-public-npc 写入魔术、真名、宝具、隐藏身份\n" +
      "- 把世界角色数据库全量塞进 state；只写本局需要追踪的 actor",
    parameters: Type.Object({
      kind: Type.String({
        description:
          "允许: setup-protagonist, ensure-public-npc, upsert-public-npc, upsert-servant",
      }),
      actor: Type.Optional(publicActorSchema()),
      npc: Type.Optional(loosePublicNpcSchema()),
      servant: Type.Optional(looseServantSchema()),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      upsertActorTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "update_economy",
    description:
      "更新 2004 年日本円经济状态；每笔资金必须指定 purse/account 与 reason，资金增加必须说明可审计来源。\n\n" +
      "【必须调用的场景】\n" +
      "- 消费、获得现金、增加可访问资金账户或记录债务\n" +
      "- 食宿、装备、服务、情报等交易发生时\n\n" +
      "【严禁的行为】\n" +
      "- 把同行者资金说成玩家随身现金\n" +
      "- 资金不足时默认免费兜底\n" +
      "- 用 gain-money 把现金设为目标数值或凭空发财；gain-money 必须提供 source 和 counterparty",
    parameters: Type.Object({
      kind: Type.Union([
        Type.Literal("spend-money"),
        Type.Literal("gain-money"),
        Type.Literal("add-purse"),
        Type.Literal("add-debt"),
      ]),
      purseId: Type.Optional(
        Type.String({
          description:
            "资金账户 id；可省略并提供 ownerActorId，让工具自动选择该 actor 唯一 held purse",
        }),
      ),
      ownerActorId: Type.Optional(
        Type.String({
          description: "不确定 purseId 时填写 actorId；若该 actor 只有一个 held purse 会自动选择",
        }),
      ),
      debtorActorId: Type.Optional(Type.String()),
      creditor: Type.Optional(Type.String()),
      source: Type.Optional(
        Type.Union([
          Type.Literal("earned"),
          Type.Literal("refund"),
          Type.Literal("found"),
          Type.Literal("gift"),
          Type.Literal("withdrawal"),
          Type.Literal("sale"),
          Type.Literal("quest-reward"),
        ]),
      ),
      counterparty: Type.Optional(Type.String({ description: "gain-money 必填：付款方/来源说明" })),
      label: Type.Optional(Type.String()),
      amount: Type.Optional(Type.Union([Type.Integer(), Type.String()])),
      access: Type.Optional(
        Type.Union([
          Type.Literal("held"),
          Type.Literal("shared"),
          Type.Literal("requires-permission"),
        ]),
      ),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      updateEconomyTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "update_servant_form",
    description:
      "更新从者形态的魔力、灵核、契约、参数修正和永久缺损；锁定字段不可改。\n\n" +
      "【必须调用的场景】\n" +
      "- 从者消耗或恢复魔力\n" +
      "- 灵核受损、契约状态变化、供魔不足\n" +
      "- 临时强化/诅咒/地形影响造成参数修正\n" +
      "- 概念伤或不可恢复创伤进入永久缺损\n\n" +
      "【严禁的行为】\n" +
      "- 改写已确立职阶、真名、基础参数或宝具\n" +
      "- 临场新增宝具或把资源写成免费恢复",
    parameters: Type.Object({
      kind: Type.String({
        description:
          "允许: spend-mana, restore-mana, damage-spiritual-core, add-param-modifier, change-contract, add-permanent-defect。锁定字段不可用本工具修改。",
      }),
      actorId: Type.String(),
      amount: Type.Optional(Type.Union([Type.Integer(), Type.String()])),
      modifier: Type.Optional(paramModifierSchema()),
      contract: Type.Optional(servantContractSchema()),
      defect: Type.Optional(permanentDefectSchema()),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      updateServantFormTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "reveal_secret",
    description:
      "根据玩家可见 claim/evidence 尝试揭示隐藏事实；或在 actor 首次入场时配置 secret slots。\n\n" +
      "【必须调用的场景】\n" +
      "- 从者首次入场且使用 upsert_actor(kind=upsert-servant) 后：调用 kind=configure-servant-secrets 写入真名/隐藏宝具揭示条件\n" +
      "- 重要非从者 NPC 首次入场且后续 private_resolve 需要隐藏反应时：调用 kind=configure-actor-secrets 写入 privateMotives/unrevealedAffiliations\n" +
      "- 玩家推理真名、宝具、隐藏身份或触发公开揭示条件\n" +
      "- GM 准备把 foreshadowed 线索升级为已揭示事实\n\n" +
      "【严禁的行为】\n" +
      "- 对同一从者反复配置相同 secret；首次入场配置一次，后续只追加新隐藏宝具\n" +
      "- 要求列出 secret slots 或幕后真相\n" +
      "- 证据不足时泄露正确答案",
    parameters: Type.Object({
      kind: Type.Union([
        Type.Literal("claim-reveal"),
        Type.Literal("observed-reveal"),
        Type.Literal("configure-servant-secrets"),
        Type.Literal("configure-actor-secrets"),
      ]),
      actorId: Type.String(),
      claim: Type.Optional(Type.String()),
      trigger: Type.Optional(Type.String()),
      evidence: Type.Optional(Type.String()),
      trueName: Type.Optional(
        Type.Object({
          value: Type.String({ description: "隐藏真名，如 美狄亚" }),
          revealConditions: Type.Array(
            Type.String({ description: "玩家证据里出现任一关键词即可触发，如 科尔基斯" }),
          ),
        }),
      ),
      hiddenNoblePhantasms: Type.Optional(
        Type.Array(
          Type.Object({
            value: Type.Object({
              name: Type.String(),
              rank: Type.String({ description: "Fate rank；非真正宝具/无宝具可填 none" }),
              kind: Type.String({ description: "宝具类型，如 对魔术宝具" }),
              status: Type.Union([
                Type.Literal("hidden"),
                Type.Literal("suspected"),
                Type.Literal("revealed"),
              ]),
              summary: Type.String(),
            }),
            revealConditions: Type.Array(Type.String()),
          }),
        ),
      ),
      privateMotives: Type.Optional(
        Type.Array(
          Type.Object({
            value: Type.String({ description: "NPC 隐藏动机；不会直接公开给玩家" }),
            revealConditions: Type.Array(Type.String()),
          }),
        ),
      ),
      unrevealedAffiliations: Type.Optional(
        Type.Array(
          Type.Object({
            value: Type.String({ description: "NPC 未公开隶属/身份；不会直接公开给玩家" }),
            revealConditions: Type.Array(Type.String()),
          }),
        ),
      ),
      reason: Type.Optional(Type.String()),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      revealSecretTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "private_resolve",
    description:
      "窄口私密结算：隐藏反应或隐藏相性；只返回玩家安全叙事约束。\n\n" +
      "【必须调用的场景】\n" +
      "- 需要隐藏事实参与 NPC 反应，但不能公开真相\n" +
      "- 判断两个 actor 互动是否触发隐藏相性\n\n" +
      "【严禁的行为】\n" +
      "- 询问完整隐藏真相或幕后动机\n" +
      "- 用它替代 reveal_secret",
    parameters: Type.Object({
      kind: Type.Union([Type.Literal("hidden-reaction"), Type.Literal("secret-compatibility")]),
      actorId: Type.String(),
      targetActorId: Type.Optional(Type.String()),
      stimulus: Type.Optional(Type.String()),
      publicContext: Type.Optional(Type.String()),
      interaction: Type.Optional(Type.String()),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      privateResolveTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "lookup",
    description:
      "查询型月世界的权威设定——角色、从者、地点、概念、时间线的唯一数据入口。支持单关键词，也支持用空格/逗号分隔的少量关键词（如“新都 商业街”）。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家遇到或提及任何预设角色/从者/NPC——必须先查再叙述\n" +
      "- 玩家进入预设地点——先查地点设定再描述环境\n" +
      "- 需要引用型月世界观概念（圣杯、魔术、英灵等）\n\n" +
      "【严禁的行为】\n" +
      "- 凭记忆编造角色外貌/性格/背景\n" +
      "- 即兴发明型月设定",
    parameters: Type.Object({
      query: Type.String({
        description: "搜索关键词——角色名、地点名、概念名等；多关键词用空格分隔，不要写整句",
      }),
      category: Type.Optional(
        Type.String({ description: "可选过滤: 角色、从者、地点、设定、时间线" }),
      ),
    }),
    execute: async (_toolCallId, params) => lookupTool(params),
  });

  pi.registerTool({
    label: toolLabel,
    name: "patch_state",
    description: "【调试工具】裸 JSON Patch 已禁用；常规玩法必须使用领域 update 工具。",
    parameters: Type.Object({
      ops: Type.Array(
        Type.Object({
          op: Type.Literal("replace"),
          path: Type.String(),
          value: Type.Unknown(),
        }),
      ),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      patchStateTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "override_locked_fact",
    description:
      "【调试工具】覆盖已锁定的从者职阶、真名或基础参数。仅用于开发修档，必须写明 reason。",
    parameters: Type.Object({
      kind: Type.Union([
        Type.Literal("servant-class"),
        Type.Literal("servant-true-name"),
        Type.Literal("servant-base-params"),
      ]),
      actorId: Type.String(),
      className: Type.Optional(Type.String()),
      display: Type.Optional(Type.String()),
      base: Type.Optional(Type.Unknown()),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      overrideLockedFactTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "reset_state",
    description:
      "【调试工具】重置为新 Fate schema 初始状态；不做旧 schema migration。必须写明 reason。",
    parameters: Type.Object({ reason: Type.String() }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      resetStateTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "get_state_schema",
    description: "【调试工具】查看当前状态 schema 版本与聚合根。",
    parameters: Type.Object({}),
    execute: async () => getStateSchemaTool(),
  });

  pi.registerTool({
    label: toolLabel,
    name: "export_state",
    description: "【调试工具】将当前内存状态导出到 state/state.json。严禁把 secrets 泄露给玩家。",
    parameters: Type.Object({}),
    execute: async () => exportStateTool(),
  });
}

function storyWindowSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    currentArcId: Type.String({ description: "当前 arc id，如 B2" }),
    currentBeatId: Type.String({ description: "当前 beat id，如 ryudou-scouting-wrapup" }),
    title: Type.String({ description: "玩家可见剧情窗口标题" }),
    allowedActions: Type.Array(Type.String({ description: "本 beat 允许推进的行动边界" })),
    forbiddenEscalations: Type.Array(
      Type.String({ description: "本 beat 禁止提前触发或公开的升级" }),
    ),
    completionCriteria: Type.Array(Type.String({ description: "本 beat 完成条件" })),
    nextBeatHints: Type.Array(Type.String({ description: "不泄密的后续问题或钩子" })),
  });
}

function loosePublicNpcSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    id: Type.Optional(Type.String({ description: "upsert-public-npc 使用：actor id" })),
    actorId: Type.Optional(Type.String({ description: "ensure-public-npc 使用：actor id" })),
    kind: Type.Optional(
      Type.String({ description: "upsert-public-npc 使用：human / outsider / spirit / other" }),
    ),
    npcKind: Type.Optional(
      Type.String({ description: "ensure-public-npc 使用：human / outsider / spirit / other" }),
    ),
    displayName: Type.String({ description: "玩家可见称呼/姓名" }),
    publicIdentity: Type.String({ description: "玩家当前可知身份摘要；不得写隐藏身份" }),
    apparentAge: Type.Optional(Type.String()),
    outfit: Type.Optional(Type.Object({ label: Type.String(), details: Type.String() })),
    demeanor: Type.Optional(Type.String({ description: "玩家可见举止；不得写私密动机" })),
    publicRoles: Type.Optional(Type.Array(looseActorRoleSchema())),
    relationshipToProtagonist: Type.Optional(
      Type.Object({
        stance: Type.String({
          description: "self / ally / friendly / neutral / wary / hostile / unknown",
        }),
        summary: Type.String(),
      }),
    ),
    ordinaryItems: Type.Optional(Type.Array(Type.String())),
  });
}

function looseActorRoleSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    kind: Type.String({ description: "social / faction / master" }),
    label: Type.Optional(Type.String()),
    factionId: Type.Optional(Type.String()),
    commandSpells: Type.Optional(Type.Object({ total: Type.Integer(), remaining: Type.Integer() })),
    contractedServantIds: Type.Optional(Type.Array(Type.String())),
  });
}

function looseServantSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    id: Type.String({ description: "从者 actor id，如 caster 或 assassin" }),
    displayName: Type.String({ description: "玩家可见称呼，如 Caster 或 佐佐木小次郎" }),
    publicIdentity: Type.String({ description: "玩家当前可知的公开身份摘要" }),
    apparentAge: Type.String(),
    outfit: Type.Object({ label: Type.String(), details: Type.String() }),
    demeanor: Type.String(),
    className: Type.String({
      description: "Saber / Archer / Lancer / Rider / Caster / Assassin / Berserker",
    }),
    trueNameDisplay: Type.String({ description: "真名显示文本；hidden 时填职阶名如 Caster" }),
    trueNameStatus: Type.String({ description: "hidden / suspected / revealed" }),
    parameters: Type.Object({
      strength: Type.String({ description: "Fate rank，如 B 或 A+" }),
      endurance: Type.String(),
      agility: Type.String(),
      mana: Type.String(),
      luck: Type.String(),
      noblePhantasm: Type.String(),
    }),
    classSkills: Type.Array(
      Type.Object({
        name: Type.String(),
        rank: Type.String({ description: "Fate rank 或 none" }),
        summary: Type.String(),
      }),
    ),
    personalSkills: Type.Array(
      Type.Object({
        name: Type.String(),
        rank: Type.String({ description: "Fate rank 或 none" }),
        summary: Type.String(),
      }),
    ),
    noblePhantasms: Type.Array(
      Type.Object({
        name: Type.String(),
        rank: Type.String({ description: "Fate rank" }),
        kind: Type.String({ description: "宝具类型，如 对魔术宝具" }),
        status: Type.String({ description: "hidden / suspected / revealed" }),
        summary: Type.String(),
      }),
    ),
    spiritualCore: Type.Integer({ description: "0-100 灵核完整度" }),
    mana: Type.Integer({ description: "0-100 从者魔力余量" }),
    spiritualCondition: Type.String({ description: "灵核状态描述，如 完好" }),
    masterActorId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    masterName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    contractStatus: Type.String({ description: "stable / weak / cut / masterless" }),
    manaSupply: Type.String({ description: "sufficient / strained / starved" }),
    currentOrder: Type.String({ description: "当前御主命令或自主行动目标" }),
    publicRoles: Type.Optional(Type.Array(looseActorRoleSchema())),
    relationshipToProtagonist: Type.Optional(
      Type.Object({
        stance: Type.String({
          description: "self / ally / friendly / neutral / wary / hostile / unknown",
        }),
        summary: Type.String(),
      }),
    ),
    ordinaryItems: Type.Optional(Type.Array(Type.String())),
  });
}

function publicActorSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    id: Type.String(),
    kind: Type.Union([
      Type.Literal("human"),
      Type.Literal("outsider"),
      Type.Literal("spirit"),
      Type.Literal("other"),
    ]),
    roles: Type.Array(
      Type.Union([
        Type.Object({ kind: Type.Literal("social"), label: Type.String() }),
        Type.Object({
          kind: Type.Literal("faction"),
          factionId: Type.String(),
          label: Type.String(),
        }),
        Type.Object({
          kind: Type.Literal("master"),
          commandSpells: Type.Object({ total: Type.Integer(), remaining: Type.Integer() }),
          contractedServantIds: Type.Array(Type.String()),
        }),
      ]),
    ),
    magecraft: Type.Union([
      Type.Null(),
      Type.Object({
        circuits: Type.Object({
          count: Type.String(),
          quality: Type.String({ description: "Fate rank 或 none" }),
          od: Type.Integer({ description: "0-100" }),
          status: Type.Union([
            Type.Literal("normal"),
            Type.Literal("overheated"),
            Type.Literal("depleted"),
            Type.Literal("dormant"),
            Type.Literal("damaged"),
          ]),
          traits: Type.Array(Type.String()),
        }),
        disciplines: Type.Array(
          Type.Object({
            name: Type.String(),
            rank: Type.String({ description: "Fate rank 或 none" }),
            notes: Type.String(),
          }),
        ),
        affiliation: Type.Union([Type.String(), Type.Null()]),
      }),
    ]),
    servantForm: Type.Union([servantFormSchema(), Type.Null()]),
    identity: Type.Object({
      publicIdentity: Type.String(),
      background: Type.String(),
      lockedFacts: Type.Array(Type.Object({ id: Type.String(), text: Type.String() })),
    }),
    presentation: Type.Object({
      displayName: Type.String(),
      apparentAge: Type.String(),
      outfit: Type.Object({ label: Type.String(), details: Type.String() }),
      demeanor: Type.String(),
    }),
    condition: Type.Object({
      wounds: Type.Array(Type.Unknown()),
      afflictions: Type.Array(Type.Unknown()),
      permanentEffects: Type.Array(Type.Unknown()),
    }),
    inventory: Type.Object({
      ordinaryItems: Type.Array(Type.String()),
      heldTrackedItemIds: Type.Array(Type.String()),
    }),
    abilities: Type.Array(
      Type.Object({ id: Type.String(), label: Type.String(), summary: Type.String() }),
    ),
    relationshipToProtagonist: Type.Object({
      stance: Type.Union([
        Type.Literal("self"),
        Type.Literal("ally"),
        Type.Literal("friendly"),
        Type.Literal("neutral"),
        Type.Literal("wary"),
        Type.Literal("hostile"),
        Type.Literal("unknown"),
      ]),
      summary: Type.String(),
    }),
  });
}

function servantFormSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    identity: Type.Object({
      className: Type.String({ description: "Servant class, e.g. Saber" }),
      trueName: Type.Object({
        status: Type.Union([
          Type.Literal("hidden"),
          Type.Literal("suspected"),
          Type.Literal("revealed"),
        ]),
        display: Type.String({ description: "玩家可见真名显示；隐藏时可用 ???" }),
      }),
      locked: Type.Literal(true),
    }),
    condition: Type.Object({
      spiritualCore: Type.Object({ value: Type.Integer({ description: "0-100" }) }),
      mana: Type.Object({ value: Type.Integer({ description: "0-100" }) }),
      spiritualCondition: Type.String(),
      permanentDefects: Type.Array(permanentDefectSchema()),
    }),
    contract: servantContractSchema(),
    parameters: Type.Object({
      base: Type.Object({
        strength: Type.String(),
        endurance: Type.String(),
        agility: Type.String(),
        mana: Type.String(),
        luck: Type.String(),
        noblePhantasm: Type.String(),
      }),
      modifiers: Type.Array(paramModifierSchema()),
      baseLocked: Type.Literal(true),
    }),
    skills: Type.Object({
      classSkills: Type.Array(
        Type.Object({ name: Type.String(), rank: Type.String(), summary: Type.String() }),
      ),
      personalSkills: Type.Array(
        Type.Object({ name: Type.String(), rank: Type.String(), summary: Type.String() }),
      ),
    }),
    noblePhantasms: Type.Array(
      Type.Object({
        name: Type.String(),
        rank: Type.String(),
        kind: Type.String(),
        status: Type.Union([
          Type.Literal("hidden"),
          Type.Literal("suspected"),
          Type.Literal("revealed"),
        ]),
        summary: Type.String(),
      }),
    ),
    currentOrder: Type.String(),
  });
}

function servantContractSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    masterActorId: Type.Optional(
      Type.Union([
        Type.String({ description: "当前御主 actor id；无主从者可省略、填 null 或填 none" }),
        Type.Null(),
      ]),
    ),
    masterName: Type.Optional(
      Type.Union([
        Type.String({ description: "当前御主玩家可见姓名；无主从者可省略、填 null 或填 无" }),
        Type.Null(),
      ]),
    ),
    status: Type.Union([
      Type.Literal("stable"),
      Type.Literal("weak"),
      Type.Literal("cut"),
      Type.Literal("masterless"),
    ]),
    manaSupply: Type.Union([
      Type.Literal("sufficient"),
      Type.Literal("strained"),
      Type.Literal("starved"),
    ]),
  });
}

function paramModifierSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    id: Type.Optional(Type.String()),
    source: Type.String(),
    affectedParams: Type.Array(
      Type.Union([
        Type.Literal("strength"),
        Type.Literal("endurance"),
        Type.Literal("agility"),
        Type.Literal("mana"),
        Type.Literal("luck"),
        Type.Literal("noblePhantasm"),
      ]),
    ),
    summary: Type.String(),
    expiresAt: Type.Union([Type.String(), Type.Null()]),
  });
}

function permanentDefectSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    id: Type.Optional(Type.String()),
    source: Type.String(),
    text: Type.String(),
    mechanicalEffect: Type.String(),
  });
}

function locationSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    region: Type.String(),
    site: Type.String(),
    detail: Type.String(),
    boundary: Type.Union([
      Type.Literal("normal"),
      Type.Literal("bounded-field"),
      Type.Literal("reality-marble"),
      Type.Literal("otherworld"),
    ]),
  });
}

function situationSchema(): ReturnType<typeof Type.Union> {
  return Type.Union([
    Type.Literal("daily"),
    Type.Literal("investigation"),
    Type.Literal("social"),
    Type.Literal("combat"),
    Type.Literal("ritual"),
    Type.Literal("escape"),
    Type.Literal("downtime"),
  ]);
}

function threatSeveritySchema(): ReturnType<typeof Type.Union> {
  return Type.Union([
    Type.Literal("low"),
    Type.Literal("medium"),
    Type.Literal("high"),
    Type.Literal("lethal"),
  ]);
}
