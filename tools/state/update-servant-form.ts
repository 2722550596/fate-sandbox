import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { ServantFormEvent } from "../../engine/core/servant.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { updateServantForm } from "../../engine/core/servant.ts";
import {
  parseServantFormEvent,
  SERVANT_FORM_EVENT_KINDS,
} from "../../engine/core/servant-schema.ts";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner.ts";
import { isRecord } from "../../engine/core/typebox-validation.ts";

/** 锁定字段的 kind 有专属指引（指向 override_locked_fact），必须先于 schema 枚举报错。 */
const LOCKED_FIELD_KINDS = [
  "change-true-name",
  "change-class",
  "change-base-params",
  "change-noble-phantasm",
] as const;

export function updateServantFormTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => updateServantForm(draft, parseServantFormEventBoundary(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function parseServantFormEventBoundary(params: unknown): ServantFormEvent {
  assertNotLockedFieldKind(params);
  return parseServantFormEvent(
    normalizeNullableFields(params),
    "update_servant_form 参数",
  );
}

function assertNotLockedFieldKind(params: unknown): void {
  const kind = isRecord(params) ? params["kind"] : undefined;
  if (typeof kind !== "string" || !LOCKED_FIELD_KINDS.some((locked) => locked === kind)) {
    return;
  }
  throw new Error(
    `非法 update_servant_form.kind: ${JSON.stringify(kind)}。真名、职阶、基础参数、宝具是锁定字段，必须使用 debug 工具 override_locked_fact（宝具当前无常规增删事件），严禁使用 patch_state。允许值: ${SERVANT_FORM_EVENT_KINDS.join(", ")}。`,
  );
}

/** contract/modifier 的 nullable 字段容错：缺省归一为 null——领域归一化，不是校验。 */
function normalizeNullableFields(params: unknown): unknown {
  if (!isRecord(params)) {
    return params;
  }
  const next = { ...params };
  if (isRecord(next["contract"])) {
    next["contract"] = {
      ...next["contract"],
      masterActorId: next["contract"]["masterActorId"] ?? null,
      masterName: next["contract"]["masterName"] ?? null,
    };
  }
  if (isRecord(next["modifier"])) {
    next["modifier"] = {
      ...next["modifier"],
      expiresAt: next["modifier"]["expiresAt"] ?? null,
    };
  }
  return next;
}

export const updateServantFormToolDefinition: FsnToolDefinition = {
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
};

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