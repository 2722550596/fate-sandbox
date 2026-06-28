import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { parseRetireActorInput } from "../../core/actor/actor-schema.ts";
import { retireActor } from "../../core/actor/actor.ts";
import { resultDetails, runDomainEventTool } from "../system/domain-tool-runner.ts";

export function retireActorTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => retireActor(draft, parseRetireActorInput(params, "retire_actor 参数")),
    details: resultDetails,
    message: (result) => result.message,
  });
}

export const retireActorToolDefinition: DomainToolDefinition = {
  name: "retire_actor",
  description:
    "将已退场/死亡/离开可见叙事或不再需持续追踪的 public actor 从 registry 移除。\n\n" +
    "【使用边界】\n" +
    "- 临时敌人/路人/一次性角色退场，留在 public actors 会污染状态\n" +
    "- actor 不在场、非 ally、无 tracked item、也无需 condition/sequence 追踪\n\n" +
    "禁区：\n" +
    "- retire protagonist\n" +
    "- 删除仍被契约/tracked item 引用的 actor\n" +
    "- 用它隐藏仍属 active threat 的敌人（应留在 scene/threat 或 offscreen/memory 结算）",
  parameters: Type.Object({
    actorId: Type.String({ description: "要退场的 actor id；必须已存在于 public actors" }),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    retireActorTool(params, ctx.sessionManager),
};
