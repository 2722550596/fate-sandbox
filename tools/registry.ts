import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { Type } from "typebox";

import { exportStateTool } from "./debug/export-state";
import { getStateSchemaTool } from "./debug/get-state-schema";
import { switchToolsetTool } from "./debug/switch-toolset";
import { lookupTool } from "./lookup/lookup";
import { getStatusTool } from "./state/get-status";
import { patchStateTool } from "./state/patch-state";
import { recordMemoryTool } from "./state/record-memory";
import { updateActorConditionTool } from "./state/update-actor-condition";
import { updateEconomyTool } from "./state/update-economy";
import { updateSceneTool } from "./state/update-scene";
import { updateServantFormTool } from "./state/update-servant-form";

export function registerAllTools(pi: ExtensionAPI): void {
  const toolLabel = "FSN 沙盒";

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
    name: "update_scene",
    description:
      "按领域事件更新时间、地点、场景态势、目标、威胁。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家移动地点或时间推进\n" +
      "- 场景态势切换为日常、调查、社交、战斗、仪式、逃跑、整备\n" +
      "- 新增/解决当前场景目标，或新增/清除即时威胁\n\n" +
      "【严禁的行为】\n" +
      "- 用叙事直接跳过时间或改变地点但不调用工具\n" +
      "- 把长期目标塞进 scene；场景结束后应写入 memory",
    parameters: Type.Object({
      kind: Type.Union([
        Type.Literal("move-location"),
        Type.Literal("set-situation"),
        Type.Literal("add-objective"),
        Type.Literal("resolve-objective"),
        Type.Literal("add-threat"),
        Type.Literal("clear-threat"),
      ]),
      location: Type.Optional(locationSchema()),
      elapsedMinutes: Type.Optional(Type.Union([Type.Integer(), Type.String()])),
      situation: Type.Optional(situationSchema()),
      summary: Type.Optional(Type.String()),
      objectiveId: Type.Optional(Type.String()),
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
      "写入玩家已知的长期事实、重大事件或日常摘要。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家身世确定；契约成立/解除/变更；NPC 死亡、失踪、重伤\n" +
      "- 真名公开、宝具首次解放、令咒使用、阵营变化、永久缺损\n" +
      "- 半天以上时间跳过或章节结束\n\n" +
      "【严禁的行为】\n" +
      "- 记录 GM 猜测、幕后真相、普通闲聊或短暂情绪\n" +
      "- 把玩家未确认秘密写进 public memory",
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
      sourceEventId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
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
    name: "update_actor_condition",
    description:
      "更新 actor 的伤势、异常、长期影响、外观装备，或转移 tracked item。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家或已入场 actor 受伤、感染、诅咒、获得永久影响\n" +
      "- 更换外观/装备呈现\n" +
      "- 重要物品跨 actor 转移\n\n" +
      "【严禁的行为】\n" +
      "- 改写锁定身份事实、真名或基础参数\n" +
      "- 用通用 HP 百分比替代离散伤势",
    parameters: Type.Object({
      kind: Type.Union([
        Type.Literal("add-wound"),
        Type.Literal("add-affliction"),
        Type.Literal("add-permanent-effect"),
        Type.Literal("change-outfit"),
        Type.Literal("transfer-tracked-item"),
      ]),
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
      outfit: Type.Optional(Type.Unknown()),
      itemId: Type.Optional(Type.String()),
      holderActorId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      reason: Type.Optional(Type.String()),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      updateActorConditionTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "update_economy",
    description:
      "更新 2004 年日本円经济状态；每笔资金必须指定 purse/account 与 reason。\n\n" +
      "【必须调用的场景】\n" +
      "- 消费、获得现金、增加可访问资金账户或记录债务\n" +
      "- 食宿、装备、服务、情报等交易发生时\n\n" +
      "【严禁的行为】\n" +
      "- 把同行者资金说成玩家随身现金\n" +
      "- 资金不足时默认免费兜底",
    parameters: Type.Object({
      kind: Type.Union([
        Type.Literal("spend-money"),
        Type.Literal("gain-money"),
        Type.Literal("add-purse"),
        Type.Literal("add-debt"),
      ]),
      purseId: Type.Optional(Type.String()),
      ownerActorId: Type.Optional(Type.String()),
      debtorActorId: Type.Optional(Type.String()),
      creditor: Type.Optional(Type.String()),
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
      kind: Type.Union([
        Type.Literal("spend-mana"),
        Type.Literal("restore-mana"),
        Type.Literal("damage-spiritual-core"),
        Type.Literal("add-param-modifier"),
        Type.Literal("change-contract"),
        Type.Literal("add-permanent-defect"),
      ]),
      actorId: Type.String(),
      amount: Type.Optional(Type.Union([Type.Integer(), Type.String()])),
      modifier: Type.Optional(Type.Unknown()),
      contract: Type.Optional(Type.Unknown()),
      defect: Type.Optional(Type.Unknown()),
      reason: Type.String(),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      updateServantFormTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "lookup",
    description:
      "查询型月世界的权威设定——角色、从者、地点、概念、时间线的唯一数据入口。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家遇到或提及任何预设角色/从者/NPC——必须先查再叙述\n" +
      "- 玩家进入预设地点——先查地点设定再描述环境\n" +
      "- 需要引用型月世界观概念（圣杯、魔术、英灵等）\n\n" +
      "【严禁的行为】\n" +
      "- 凭记忆编造角色外貌/性格/背景\n" +
      "- 即兴发明型月设定",
    parameters: Type.Object({
      query: Type.String({ description: "搜索关键词——角色名、地点名、概念名等" }),
      category: Type.Optional(
        Type.String({ description: "可选过滤: 角色、从者、地点、设定、时间线" }),
      ),
    }),
    execute: async (_toolCallId, params) => lookupTool(params),
  });

  pi.registerTool({
    label: toolLabel,
    name: "switch_toolset",
    description: "切换可用工具组。debug 工具组包含调试/维护工具。",
    parameters: Type.Object({
      toolset: Type.String({ description: "工具组名: always 或 debug" }),
    }),
    execute: async (_toolCallId, params) => switchToolsetTool(params),
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
