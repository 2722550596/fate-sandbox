import type { FsnToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { ToolResult } from "../runtime/tool-result.ts";

import { setScenePresence } from "../../engine/core/actor.ts";
import { parseScenePresenceInput } from "../../engine/core/actor-schema.ts";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner.ts";

export function setScenePresenceTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      setScenePresence(draft, parseScenePresenceInput(params, "set_scene_presence 参数")),
    details: resultDetails,
    message: (result) => result.message,
  });
}

export const setScenePresenceToolDefinition: FsnToolDefinition = {
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
};
