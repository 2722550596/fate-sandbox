import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { Type } from "typebox";

import { exportStateTool } from "./debug/export-state";
import { getStateSchemaTool } from "./debug/get-state-schema";
import { migrateStateTool } from "./debug/migrate-state";
import { overrideLockedFactTool } from "./debug/override-locked-fact";
import { resetStateTool } from "./debug/reset-state";
import { lookupTool } from "./lookup/lookup";
import { commitTurnTool } from "./state/commit-turn";
import { configureCampaignTool } from "./state/configure-campaign";
import { getStatusTool } from "./state/get-status";
import { initializeNewGameTool } from "./state/initialize-new-game";
import { patchStateTool } from "./state/patch-state";
import { privateResolveTool } from "./state/private-resolve";
import { progressSceneBeatTool } from "./state/progress-scene-beat";
import { recordMemoryTool } from "./state/record-memory";
import { recordOffscreenEventTool } from "./state/record-offscreen-event";
import { resolveCombatExchangeTool } from "./state/resolve-combat-exchange";
import { retireActorTool } from "./state/retire-actor";
import { revealSecretTool } from "./state/reveal-secret";
import { setScenePresenceTool } from "./state/set-scene-presence";
import { updateActorConditionTool } from "./state/update-actor-condition";
import { updateEconomyTool } from "./state/update-economy";
import { updateServantFormTool } from "./state/update-servant-form";
import { upsertActorTool } from "./state/upsert-actor";

export function registerAllTools(pi: ExtensionAPI): void {
  const toolLabel = "FSN 沙盒";

  pi.registerTool({
    label: toolLabel,
    name: "initialize_new_game",
    description:
      "初始化新游戏 Game State 的单入口 recipe：重置 state、配置 campaign、写入 protagonist、设置在场 actor、必要时配置 protagonist 从者隐藏真名。\n\n" +
      "【必须调用的场景】\n" +
      "- /skill:start-game 已收集好时间线、玩家立场和开场身份，准备进入正式剧情前\n" +
      "- 新游戏或重新开始，需要一次性建立可运行 campaign state\n" +
      "- protagonist 是从者/非人现界者，且真名或宝具需要 hidden-canonical secret slot\n\n" +
      "【严禁的行为】\n" +
      "- 用它续局、修档或在剧情中重置后果\n" +
      "- 把 player-only 原作知识写成 public world fact\n" +
      "- protagonist 从者开局直接 public revealed 真名；未剧情内公开必须 hidden/suspected 并用 hiddenTrueName 配置 secret\n" +
      "- 用它替代后续剧情中的领域事件工具",
    parameters: Type.Object({
      kind: Type.String({ description: "human-protagonist / servant-protagonist" }),
      campaign: Type.Object({
        presetId: Type.String({
          description:
            "fsn_2004_fuyuki / fsf_2008_snowfield / extra_2032_seraph / extra_ccc_2032_far_side",
        }),
        title: Type.Optional(Type.String()),
        premise: Type.Optional(Type.String()),
        startedAt: Type.Optional(Type.String({ description: "UTC ISO instant" })),
        currentAt: Type.Optional(Type.String({ description: "UTC ISO instant" })),
        reason: Type.Optional(Type.String()),
      }),
      protagonist: Type.Unknown({
        description:
          "human: displayName/publicIdentity/background/apparentAge/outfit/demeanor；servant additionally className/trueNameDisplay/trueNameStatus(hidden|suspected)。",
      }),
      presence: Type.Optional(
        Type.Object({
          presentActorIds: Type.Array(Type.String()),
          allyActorIds: Type.Optional(Type.Array(Type.String())),
        }),
      ),
      hiddenTrueName: Type.Optional(
        Type.Object({
          value: Type.String(),
          revealConditions: Type.Array(Type.String()),
        }),
      ),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      initializeNewGameTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "configure_campaign",
    description:
      "配置开局 campaign preset、时间线、本地时区、起始时间、地点和经济规则；这是进入正式剧情前的第一步，也可用于修正当前存档的 campaign 元数据。\n\n" +
      "【必须调用的场景】\n" +
      "- 开局确认时间线/城市/本地时区/货币/开场地点后，正式剧情推进前\n" +
      "- 用户把 FSN 改成 FSF、EXTRA、空境、月姬或 custom 线，需要同步 campaign 与 clock\n" +
      "- 当前存档 campaign.timeline/timezone 与实际地点不一致，需要热修\n\n" +
      "【严禁的行为】\n" +
      "- 在剧情中随意改时间线或时区来逃避后果\n" +
      "- 用它替代 Scene Beat 或普通地点移动；复杂 beat 用 progress_scene_beat，普通移动用 commit_turn\n" +
      "- 未写 reason 就修改 campaign 语义",
    parameters: Type.Object({
      presetId: Type.String({
        description:
          "fsn_2004_fuyuki / fsf_2008_snowfield / extra_2032_seraph / extra_ccc_2032_far_side",
      }),
      title: Type.Optional(Type.String()),
      timeline: Type.Optional(
        Type.String({ description: "fsn / fsf / extra / extra-ccc / custom 等" }),
      ),
      openingMode: Type.Optional(Type.String({ description: "random / selected / custom" })),
      premise: Type.Optional(Type.String()),
      activeRuleSetIds: Type.Optional(Type.Array(Type.String())),
      timezone: Type.Optional(Type.String({ description: "Asia/Tokyo / America/Denver / UTC" })),
      startedAt: Type.Optional(Type.String({ description: "UTC ISO instant" })),
      currentAt: Type.Optional(Type.String({ description: "UTC ISO instant" })),
      location: Type.Optional(
        Type.Object({
          region: Type.String(),
          site: Type.String(),
          detail: Type.String(),
          boundary: Type.String({
            description: "normal / bounded-field / reality-marble / otherworld",
          }),
        }),
      ),
      situation: Type.Optional(Type.String()),
      currency: Type.Optional(Type.String({ description: "JPY / USD / custom" })),
      startingFunds: Type.Optional(Type.Integer()),
      purseLabel: Type.Optional(Type.String()),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      configureCampaignTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "commit_turn",
    description:
      "每轮叙事结束时一次性提交本轮发生的领域事件；用于降低 GM 对多个状态工具顺序的注意力负担。\n\n" +
      "【必须调用的场景】\n" +
      "- 每次 canonical turn 都必须提交 time；等待、休息、睡眠、过夜、守夜、调查、治疗、移动都必须在顶层 time 裁决\n" +
      "- 一轮回复同时改变时间/地点、Scene Objective、伤势、物品、资金、记忆或从者资源中的多个状态\n" +
      "- 叙事已经发生购买、治疗、移动、揭示、消耗、战斗结算等 canonical Game State 变化\n" +
      "- 一轮回复同时改变非 beat lifecycle 的多个状态；Scene Beat 开启/收口必须优先用 progress_scene_beat\n" +
      "- 只覆盖当前玩家行动窗口及其直接后果；重大结算后应停止前台推进并先写足正文\n\n" +
      "【严禁的行为】\n" +
      "- 把它当裸 patch；events 必须是已有领域事件\n" +
      "- 在 events 里写时间或移动；时间与移动只写顶层 time\n" +
      "- 提交 Hidden Fact 到 Public Game State；秘密仍必须走 reveal_secret/private_resolve/record_offscreen_event\n" +
      "- 没有状态变化时为了形式调用\n" +
      "- 在同一 assistant 回复中连续提交多个前台 canonical turn，跳过玩家可回应窗口",
    parameters: Type.Object({
      summary: Type.Optional(
        Type.String({
          description: "本轮玩家可见状态变化摘要；省略时工具会从事件 reason 自动生成",
        }),
      ),
      time: timePolicySchema(),
      events: Type.Array(
        Type.Object({
          kind: Type.String({
            description:
              "领域事件类别，只允许: scene / scene-presence / actor-condition / servant-form / economy / memory。Scene Beat lifecycle 不走 commit_turn，改用 progress_scene_beat。",
          }),
          event: Type.Unknown({
            description:
              "对应领域事件载荷；scene event 不包含时间/移动，只允许 scene 态势、目标、威胁、地点修正；resolve-objective 只用于当前 GM brief 列出的目标，objectiveSummary 必须逐字复制。当前目标为无时不要使用 resolve-objective。",
          }),
        }),
      ),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      commitTurnTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "progress_scene_beat",
    description:
      "推进当前 Scene Beat lifecycle；这是 Scene Beat 的唯一 GM-facing Adapter，用 begin 开启有界行动窗口，用 complete 收口当前 beat（失败、撤退、逃离也属于 complete）。\n\n" +
      "【必须调用的场景】\n" +
      "- 进入新的调查、潜入、对峙、撤退、战斗准备等复杂场景，需要 1-5 个当前目标：kind=begin\n" +
      "- 当前 GM brief 显示存在剧情窗口，且当前 beat 已经收口，需要一次性解决全部 active Scene Objective、清理 Scene Threat、可选记录 Campaign Memory、可选进入 nextBeat：kind=complete\n" +
      "- 进入或收口 beat 时必须填写 time；移动用 time.kind=travel；非移动事件用 time.kind=elapsed，最小 1 分钟\n" +
      "- begin 或 complete 形成新的玩家行动窗口后，应停止继续游玩下一窗口，先输出足量场景正文\n\n" +
      "【严禁的行为】\n" +
      "- 用它记录长期目标或幕后真相；长期后果写 memory，秘密走 reveal/private_resolve/offscreen\n" +
      "- 当前 GM brief 显示剧情窗口未设定或当前目标为无时调用 complete\n" +
      "- 未满足当前 completionCriteria 就强行 complete；失败/撤退可以 complete，但 outcome 必须写明代价或后果\n" +
      "- nextBeat 继续复读同一中心冲突：撤退/逃亡完成后必须转为落脚、治疗、隐蔽、休整、交涉或新信息处理\n" +
      "- 用 memory 写入未揭示 secret；公开记忆仍必须提供 claims 并遵守证据门禁\n" +
      "- 手写 set-story-window/add-objective 或 commit_turn scene-beat AST 来绕过 Scene Beat lifecycle\n" +
      "- complete 后立刻继续结算下一 foreground beat，把多个可回应窗口压进一条最终回复",
    parameters: Type.Object({
      kind: Type.String({ description: "允许: begin / complete" }),
      title: Type.Optional(Type.String({ description: "begin 必填：Scene Beat 标题" })),
      objectives: Type.Optional(
        Type.Array(
          Type.String({ description: "begin/nextBeat 必填：1-5 个玩家可见 Scene Objective" }),
        ),
      ),
      purpose: Type.Optional(Type.String({ description: "begin 必填：为什么进入这个 beat" })),
      outcome: Type.Optional(Type.String({ description: "complete 必填：当前 beat 收口结果" })),
      time: timePolicySchema(),
      beatId: Type.Optional(Type.String({ description: "可选；begin 省略时自动生成" })),
      actionPolicy: Type.Optional(sceneBeatActionPolicySchema()),
      threats: Type.Optional(
        Type.Array(
          Type.Object({
            summary: Type.String(),
            severity: threatSeveritySchema(),
          }),
        ),
      ),
      presence: Type.Optional(sceneBeatPresenceSchema()),
      situation: Type.Optional(situationSchema()),
      memory: Type.Optional(sceneBeatMemorySchema()),
      nextBeat: Type.Optional(
        Type.Unknown({
          description:
            "complete 可选：下一 Scene Beat 对象或 null；对象可含 title/objectives/beatId/actionPolicy/threats/presence/situation。",
        }),
      ),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      progressSceneBeatTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "get_status",
    description:
      "查看玩家可见状态摘要；返回 GM brief 风格读模型，不展示完整 JSON。\n\n" +
      "【必须调用的场景】\n" +
      "- 当前回合没有可用 GM brief 或工具结果，必须先取得玩家可见状态\n" +
      "- 玩家明确询问当前状态、同行者、资源或剧情账本\n" +
      "- 工具失败后需要一次性重新同步玩家可见状态\n\n" +
      "【严禁的行为】\n" +
      "- 状态未变化时重复调用\n" +
      "- 已有当前 GM brief 或本轮工具结果时，把它当刷新按钮\n" +
      "- 凭记忆叙述机械事实——以工具返回为准\n" +
      "- 要求或输出 canonical state JSON",
    parameters: Type.Object({}),
    execute: async (_toolCallId, _params, _signal, _onUpdate, ctx) =>
      getStatusTool(ctx.sessionManager),
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
      kind: Type.String({
        description: "允许: pin-fact / record-major-event / record-daily-summary",
      }),
      scope: Type.Optional(
        Type.String({ description: "可选范围，允许: protagonist / npc / faction / world" }),
      ),
      subject: Type.Optional(Type.String()),
      text: Type.Optional(Type.String()),
      sourceEventId: Type.Optional(Type.String()),
      claims: Type.Array(
        Type.Object({
          kind: Type.String({
            description:
              "claim 类型，允许: mundane / identity / location / affiliation / motive / ability / resource / relationship / event-cause / world-fact",
          }),
          statement: Type.String(),
          certainty: Type.String({
            description: "证据确信度，允许: observed / confirmed / inferred / rumor / hypothesis",
          }),
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
      visibility: Type.String({ description: "允许: secret / foreshadowed" }),
      summary: Type.String(),
      consequences: Type.Array(Type.String()),
      futureHooks: Type.Array(Type.String()),
      createdFrom: Type.String({ description: "允许: parallel-line-subagent / gm / debug" }),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      recordOffscreenEventTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "retire_actor",
    description:
      "将已经退场、死亡、离开当前可见叙事或不再需要持续追踪的 public actor 从 actor registry 移除。\n\n" +
      "【必须调用的场景】\n" +
      "- 临时敌人/路人/一次性从者被击退或退场，继续留在 public actors 会污染当前状态\n" +
      "- actor 不在场、不是 ally、没有持有 tracked item，也不再需要 condition/servantForm 持续追踪\n\n" +
      "【严禁的行为】\n" +
      "- retire protagonist\n" +
      "- 删除仍被契约、master role 或 tracked item 引用的 actor\n" +
      "- 用它隐藏仍应作为 active threat 的敌人；active threat 应留在 scene/threat 或 offscreen/memory 中结算",
    parameters: Type.Object({
      actorId: Type.String(),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      retireActorTool(params, ctx.sessionManager),
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
      "- 将新获得的关键物加入 trackedItems 追踪列表：关键物指跨 3 回合以上持续影响选择、所有权/位置重要、损坏/消耗会影响战斗/潜入/结界/reveal/交易，或属于证据、圣遗物、魔术礼装、宝石、符纸、令咒相关载体\n" +
      "- 玩家明确说要保留、携带、改造或研究某物，且该物会跨场景持续存在\n" +
      "- 人类或其他非从者 actor 的魔术回路状态、Od、纪律或隶属需要更新\n\n" +
      "【严禁的行为】\n" +
      "- 改写锁定身份事实、真名或基础参数\n" +
      "- 用通用 HP 百分比替代离散伤势\n" +
      "- 叙事声称人类魔力/Od 已消耗或恢复，却不更新 actor.magecraft.circuits.od/status\n" +
      "- 把换衣/伪装/灵装外观变化误写成 update-wound；update-wound 只能更新已有 wound conditionId\n" +
      "- 把便当、绷带、电池、雨衣、普通工具、临时木棍、一次性临时护具、普通衣物破损等普通库存塞进 trackedItems；这类只在当场叙事或必要 memory 中结算",
    parameters: Type.Object({
      kind: Type.String({
        description:
          "允许: add-wound, update-wound, add-affliction, add-permanent-effect, update-magecraft-circuits, resolve-condition, change-outfit, update-outfit(别名), change-clothes(别名), transfer-tracked-item, update-tracked-item, add-tracked-item。更换服装只用 change-outfit/update-outfit，不要用 update-wound。",
      }),
      actorId: Type.Optional(Type.String()),
      severity: Type.Optional(
        Type.String({ description: "伤势严重度，允许: minor / moderate / severe / critical" }),
      ),
      text: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      recoverable: Type.Optional(Type.Boolean()),
      expectedDuration: Type.Optional(
        Type.Unknown({ description: "异常预计持续时间；可填字符串或 null。" }),
      ),
      mechanicalEffect: Type.Optional(Type.String()),
      circuits: Type.Optional(
        Type.Object({
          count: Type.String({ description: "魔术回路数量摘要，如 27" }),
          quality: Type.String({ description: "Fate rank 或 none" }),
          od: Type.Integer({ description: "0-100 的内部 Od / 人类魔力余量" }),
          status: Type.String({
            description: "魔术回路状态，允许: normal / overheated / depleted / dormant / damaged",
          }),
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
      holderActorId: Type.Optional(
        Type.Unknown({ description: "持有者 actorId；可填字符串或 null。" }),
      ),
      ownerActorId: Type.Optional(
        Type.Unknown({ description: "所有者 actorId；可填字符串或 null。" }),
      ),
      label: Type.Optional(
        Type.String({ description: "add-tracked-item 必填：物品的玩家可见标签" }),
      ),
      itemKind: Type.Optional(
        Type.String({
          description:
            "物品类型，允许: mundane / weapon / mystic-code / document / key-item / other",
        }),
      ),
      condition: Type.Optional(
        Type.String({ description: "物品状态，允许: intact / damaged / broken / spent / unknown" }),
      ),
      visibility: Type.Optional(
        Type.String({ description: "玩家可见性，允许: player-known / suspected" }),
      ),
      notes: Type.Optional(Type.Array(Type.String())),
      treatment: Type.Optional(
        Type.String({ description: "update-wound 可用：伤势当前治疗/处理状态" }),
      ),
      conditionKind: Type.Optional(
        Type.String({ description: "resolve-condition 专用，允许: wound / affliction" }),
      ),
      conditionId: Type.Optional(Type.String()),
      outcome: Type.Optional(
        Type.String({
          description:
            "resolve-condition 专用：只能是 recovered 或 stabilized。add-wound/update-wound 等其它 kind 不要写 outcome；误写会被忽略。",
        }),
      ),
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
      "- 场景切换但不需要 progress_scene_beat 时\n\n" +
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
      "- 消费、获得现金、增加可访问资金账户、修正资金账户名称或记录债务\n" +
      "- 食宿、装备、服务、情报等交易发生时\n\n" +
      "【严禁的行为】\n" +
      "- 把同行者资金说成玩家随身现金\n" +
      "- 资金不足时默认免费兜底\n" +
      "- 用 gain-money 把现金设为目标数值或凭空发财；gain-money 必须提供 source 和 counterparty",
    parameters: Type.Object({
      kind: Type.String({
        description: "允许: spend-money / gain-money / add-purse / rename-purse / add-debt",
      }),
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
        Type.String({
          description:
            "资金来源，允许: earned / refund / found / gift / withdrawal / sale / quest-reward",
        }),
      ),
      counterparty: Type.Optional(Type.String({ description: "gain-money 必填：付款方/来源说明" })),
      label: Type.Optional(
        Type.String({ description: "add-purse / rename-purse 必填：资金账户玩家可见名称" }),
      ),
      amount: Type.Optional(
        Type.Unknown({ description: "金额；可填 number 或数字字符串，由领域工具校验。" }),
      ),
      access: Type.Optional(
        Type.String({ description: "资金访问权限，允许: held / shared / requires-permission" }),
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
      amount: Type.Optional(
        Type.Unknown({ description: "数值；可填 number 或数字字符串，由领域工具校验。" }),
      ),
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
      kind: Type.String({
        description:
          "允许: claim-reveal / observed-reveal / configure-servant-secrets / configure-actor-secrets",
      }),
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
              status: Type.String({
                description: "隐藏宝具状态，允许: hidden / suspected / revealed",
              }),
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
    name: "resolve_combat_exchange",
    description:
      "定性裁决当前战斗交锋窗口；比较 Fate 参数/尺度、资源投入、已知优势/劣势和伤势压力，返回结果 band 与必须落地的状态约束。不写 HP，不直接改状态。\n\n" +
      "【必须调用的场景】\n" +
      "- 战斗、撤退、保护、破除拘束、试探能力、宝具前摇/解放等高风险交锋需要机械裁决\n" +
      "- 双方有从者参数、魔术资质、伤势、地形、情报或资源投入差异，不能只靠 GM 口胡胜负\n" +
      "- 玩家行动试图争取局部目标：挡下一击、逼退、撤离、保护 NPC、打断术式、识破能力或创造出手机会\n" +
      "- 工具会自动加入战场变数，等级压制不是静态锁死；变数只能兑现为局部窗口、资源交换或后果扩大\n" +
      "- tactic=noble-phantasm 且比较 noblePhantasm 时，具体宝具 rank 与面板宝具参数分开；多宝具必须指定公开宝具名\n\n" +
      "【严禁的行为】\n" +
      "- 用它一次结算完整战斗或跳过玩家可回应窗口\n" +
      "- 把交锋结果写成原地僵持；每次结果都必须改变位置、距离、资源、情报、阵型或目标进度\n" +
      "- 让模型先决定胜负再反填优势/劣势；输入必须是玩家可见事实、已投入资源和已知压力\n" +
      "- 把 outcome 当成自动状态变更；伤势、魔力、目标、记忆、秘密揭示仍必须用对应领域工具落地\n" +
      "- 输出内部 score、HP、DC 或未揭示真名/宝具/弱点给玩家",
    parameters: Type.Object({
      actorId: Type.String({ description: "发起/承受当前交锋动作的 actor id" }),
      opponentId: Type.String({ description: "主要对手 actor id" }),
      intent: Type.String({ description: "当前动作意图，如 破除拘束 / 护住绫香撤退 / 逼退 Rider" }),
      tactic: Type.String({
        description:
          "允许: direct-attack / defense / escape / protect / probe / break-restraint / noble-phantasm / support",
      }),
      actorParameter: Type.String({
        description:
          "本方主要参数轴，允许: strength / endurance / agility / mana / luck / noblePhantasm",
      }),
      opponentParameter: Type.String({
        description:
          "对手主要参数轴，允许: strength / endurance / agility / mana / luck / noblePhantasm",
      }),
      actorNoblePhantasmName: Type.Optional(
        Type.String({
          description: "本方明确释放具体宝具时，逐字复制公开宝具名；若只有一个公开宝具可省略。",
        }),
      ),
      opponentNoblePhantasmName: Type.Optional(
        Type.String({
          description: "对手明确使用具体宝具时，逐字复制公开宝具名；若只有一个公开宝具可省略。",
        }),
      ),
      targetObjective: Type.Optional(
        Type.String({ description: "若交锋服务当前 Scene Objective，逐字写目标摘要" }),
      ),
      committedResources: Type.Optional(
        Type.Array(
          Type.String({
            description: "已明确投入的资源、技能、令咒风险、宝具、地形布置等；无则省略",
          }),
        ),
      ),
      knownAdvantages: Type.Optional(
        Type.Array(Type.String({ description: "玩家可见或工具已确认的有利事实；不要写幕后秘密" })),
      ),
      knownDisadvantages: Type.Optional(
        Type.Array(
          Type.String({
            description: "玩家可见或工具已确认的不利事实、伤势、距离、压制、未知能力等",
          }),
        ),
      ),
      riskTolerance: Type.String({ description: "允许: low / medium / high / desperate" }),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      resolveCombatExchangeTool(params, ctx.sessionManager),
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
      kind: Type.String({ description: "允许: hidden-reaction / secret-compatibility" }),
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
      "查询型月世界的权威设定——角色、从者、地点、概念、时间线的唯一数据入口。默认跨全库搜索；支持单关键词，也支持用空格/逗号分隔的少量关键词（如“绫香 沙条 Fate strange Fake”“两仪式 空之境界”）。\n\n" +
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
      kind: Type.String({
        description: "允许: servant-class / servant-true-name / servant-base-params",
      }),
      actorId: Type.String(),
      className: Type.Optional(Type.String()),
      display: Type.Optional(Type.String()),
      status: Type.Optional(
        Type.String({
          description: "servant-true-name 可选；允许 hidden / suspected / revealed，默认 revealed",
        }),
      ),
      base: Type.Optional(Type.Unknown()),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      overrideLockedFactTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "migrate_state",
    description:
      "【调试工具】把旧 Game State 程序化迁移到当前 schemaVersion；默认只返回迁移结果，apply=true 时覆盖当前内存状态。必须写明 reason。",
    parameters: Type.Object({
      state: Type.Optional(Type.Unknown()),
      apply: Type.Optional(Type.Boolean()),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params) => migrateStateTool(params),
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

function sceneBeatActionPolicySchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    allowedActions: Type.Optional(Type.Array(Type.String())),
    forbiddenEscalations: Type.Optional(Type.Array(Type.String())),
    completionCriteria: Type.Optional(Type.Array(Type.String())),
    nextBeatHints: Type.Optional(Type.Array(Type.String())),
  });
}

function sceneBeatPresenceSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    presentActorIds: Type.Optional(Type.Array(Type.String())),
    allyActorIds: Type.Optional(Type.Array(Type.String())),
  });
}

function sceneBeatMemorySchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    title: Type.String(),
    summary: Type.String(),
    consequences: Type.Optional(Type.Array(Type.String())),
    claims: Type.Array(
      Type.Object({
        kind: Type.String({
          description:
            "claim 类型，允许: mundane / identity / location / affiliation / motive / ability / resource / relationship / event-cause / world-fact",
        }),
        statement: Type.String(),
        certainty: Type.String({
          description: "证据确信度，允许: observed / confirmed / inferred / rumor / hypothesis",
        }),
        subjectId: Type.Optional(Type.String()),
        relatedSecretSlotIds: Type.Optional(Type.Array(Type.String())),
        evidence: Type.Optional(Type.String()),
      }),
    ),
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
    masterActorId: Type.Optional(
      Type.Unknown({ description: "当前御主 actor id；无主从者可省略、填 null 或填 none" }),
    ),
    masterName: Type.Optional(
      Type.Unknown({ description: "当前御主玩家可见姓名；无主从者可省略、填 null 或填 无" }),
    ),
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
    kind: Type.String({ description: "actor 类型，允许: human / outsider / spirit / other" }),
    roles: Type.Array(looseActorRoleSchema()),
    magecraft: Type.Unknown({
      description: "魔术回路对象或 null；内部字段由 upsert_actor 工具校验。",
    }),
    servantForm: Type.Unknown({
      description: "从者形态对象或 null；内部字段由 upsert_actor 工具校验。",
    }),
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
      stance: Type.String({
        description: "关系立场，允许: self / ally / friendly / neutral / wary / hostile / unknown",
      }),
      summary: Type.String(),
    }),
  });
}

function servantContractSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    masterActorId: Type.Optional(
      Type.Unknown({ description: "当前御主 actor id；无主从者可省略、填 null 或填 none" }),
    ),
    masterName: Type.Optional(
      Type.Unknown({ description: "当前御主玩家可见姓名；无主从者可省略、填 null 或填 无" }),
    ),
    status: Type.String({ description: "契约状态，允许: stable / weak / cut / masterless" }),
    manaSupply: Type.String({ description: "供魔状态，允许: sufficient / strained / starved" }),
  });
}

function paramModifierSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    id: Type.Optional(Type.String()),
    source: Type.String(),
    affectedParams: Type.Array(
      Type.String({
        description:
          "受影响参数，允许: strength / endurance / agility / mana / luck / noblePhantasm",
      }),
    ),
    summary: Type.String(),
    expiresAt: Type.Unknown({ description: "过期时间 ISO 字符串或 null。" }),
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
    boundary: Type.String({
      description: "地点边界类型，允许: normal / bounded-field / reality-marble / otherworld",
    }),
  });
}

function timePolicySchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    kind: Type.String({ description: "允许: elapsed / travel" }),
    elapsedMinutes: Type.Optional(
      Type.Unknown({ description: "kind=elapsed/travel 必填；大于 0 的整数" }),
    ),
    location: Type.Optional(locationSchema()),
    reason: Type.String({ description: "为什么本轮耗时、移动，或为什么没有耗时" }),
  });
}

function situationSchema(): ReturnType<typeof Type.String> {
  return Type.String({
    description:
      "场景类型，允许: daily / investigation / social / combat / ritual / escape / downtime",
  });
}

function threatSeveritySchema(): ReturnType<typeof Type.String> {
  return Type.String({ description: "威胁等级，允许: low / medium / high / lethal" });
}
