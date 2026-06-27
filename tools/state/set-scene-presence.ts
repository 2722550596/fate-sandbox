import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { ToolResult } from "../runtime/tool-result.ts";

import { setScenePresence } from "../../engine/core/actor/actor.ts";
import { parseScenePresenceInput } from "../../engine/core/actor/actor-schema.ts";

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

export const setScenePresenceToolDefinition: FateToolDefinition = {
  name: "set_scene_presence",
  description:
    "更新当前场景在场 actor 与同行者；materialization 与 physical presence 分离，避免 upsert_actor 兼做入/离场。\n\n" +
    "【使用边界】\n" +
    "- 已存在 actor 入场/离场/同行者变化\n" +
    "- upsert_actor materialize 新 actor 后声明是否在场\n" +
    "- 场景切换但不需 progress_scene_beat\n\n" +
    "禁区：\n" +
    "- 写入不存在的 actorId（先用 upsert_actor materialize）\n" +
    "- 用 upsert_actor 暗示在场变化\n" +
    "- 把秘密角色/Hidden Fact 暴露到 Public Actor Registry",
  parameters: Type.Object({
    presentActorIds: Type.Array(Type.String()),
    allyActorIds: Type.Array(Type.String()),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    setScenePresenceTool(params, ctx.sessionManager),
};
