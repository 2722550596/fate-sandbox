import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { ToolResult } from "../runtime/tool-result.ts";

import { retireActor } from "../../engine/core/actor.ts";
import { parseRetireActorInput } from "../../engine/core/actor-schema.ts";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner.ts";

export function retireActorTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => retireActor(draft, parseRetireActorInput(params, "retire_actor 参数")),
    details: resultDetails,
    message: (result) => result.message,
  });
}

export const retireActorToolDefinition: FsnToolDefinition = {
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
};
