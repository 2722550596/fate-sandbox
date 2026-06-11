import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import { updateActorCondition } from "../../engine/core/actor-condition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner.ts";
import { normalizeActorConditionEvent } from "./actor-condition-normalizer.ts";

export function updateActorConditionTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => updateActorCondition(draft, normalizeActorConditionEvent(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}


export const updateActorConditionToolDefinition: FsnToolDefinition = {
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
};
