import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { parseScenePresenceInput } from "../../core/actor/actor-schema.ts";
import { setScenePresence } from "../../core/actor/actor.ts";
import { resultDetails, runDomainEventTool } from "../system/domain-tool-runner.ts";

export function setScenePresenceTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      setScenePresence(draft, parseScenePresenceInput(params, "set_scene_presence 参数")),
    details: resultDetails,
    message: (result) => result.message,
  });
}

export const setScenePresenceToolDefinition: DomainToolDefinition = {
  name: "set_scene_presence",
  description: "更新当前场景的在场角色和同行者名单。谁在场、谁不在场——用这个工具声明，不要用 upsert_actor 或 update_scene 顺带处理。\n\n" +
    "【参数关系】\n" +
    "- allyActorIds 是 presentActorIds 的子集：每个 ally 必须先在场\n" +
    "- 想让某角色成为同行者（ally），必须同时出现在 presentActorIds 和 allyActorIds 中\n" +
    "- 想让某角色在场但不列为同行者，只放入 presentActorIds\n\n" +
    "【什么时候用】\n" +
    "- 已有角色入场、离场\n" +
    "- 用 upsert_actor 创建新角色后，声明他是否在当前场景中\n" +
    "- 场景切换但不需要开启新的 Scene Beat 时\n\n" +
    "【不要这样做】\n" +
    "- 写入不存在的 actorId（先用 upsert_actor 创建角色）\n" +
    "- 用 upsert_actor 隐含地在场变化\n" +
    "- 把秘密角色或隐藏身份暴露到公开角色列表里",
  parameters: Type.Object({
    presentActorIds: Type.Array(Type.String()),
    allyActorIds: Type.Array(Type.String()),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    setScenePresenceTool(params, ctx.sessionManager),
};
