import type { PublicActorState } from "../../core/state/state.ts";
import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { parseActorRegistryInput } from "../../core/actor/actor-schema.ts";
import { upsertActor } from "../../core/actor/actor.ts";
import { ACTOR_KINDS } from "../../core/state/state-enum-schemas.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { resultDetails, runDomainEventTool } from "../system/domain-tool-runner.ts";

/**
 * upsert_actor 边界：结构校验交给 actor-schema；这里只保留领域归一化——
 * setup-protagonist 的 stripUndefined / sequence 缺省。
 */
export function upsertActorTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      upsertActor(
        draft,
        parseActorRegistryInput(prepareUpsertActorParams(params), "upsert_actor 参数"),
      ),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function prepareUpsertActorParams(params: unknown): unknown {
  if (!isRecord(params)) {
    return params;
  }
  switch (params["kind"]) {
    case "setup-protagonist":
      return { ...params, actor: normalizeSetupProtagonistActor(params["actor"]) };
    case "upsert-public-npc":
    case "ensure-public-npc":
      return { ...params, npc: normalizeNpcInput(params["npc"]) };
    case "upsert-sequence":
      return { ...params, sequence: normalizeSequenceInput(params["sequence"]) };
    default:
      return params;
  }
}

function normalizeNpcInput(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  return { ...value };
}

function normalizeSequenceInput(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  return {
    ...value,
    actorId: value["actorId"] ?? value["id"],
  };
}

function normalizeSetupProtagonistActor(actor: unknown): PublicActorState {
  const normalized = stripUndefinedRecord(assertRecord(actor, "actor"));
  if (normalized["sequence"] === undefined) {
    normalized["sequence"] = null;
  }
  const presentation = normalized["presentation"];
  if (isRecord(presentation) && presentation["renderName"] === undefined) {
    presentation["renderName"] = presentation["internalName"];
  }
  assertPublicActorStateCandidate(normalized);
  return normalized;
}

function assertPublicActorStateCandidate(value: unknown): asserts value is PublicActorState {
  const actor = assertRecord(value, "actor");
  assertString(actor["id"], "actor.id");
  assertActorKind(actor["kind"], "actor.kind");
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  if (!isRecord(value)) {
    return value;
  }
  return stripUndefinedRecord(value);
}

function stripUndefinedRecord(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      result[key] = stripUndefined(value);
    }
  }
  return result;
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
}

function assertActorKind(value: unknown, fieldName: string): void {
  if (typeof value !== "string" || !ACTOR_KINDS.some((kind) => kind === value)) {
    throw new Error(`非法 ${fieldName}: ${String(value)}。允许值: ${ACTOR_KINDS.join(", ")}。`);
  }
}

export const upsertActorToolDefinition: FateToolDefinition = {
  name: "upsert_actor",
  description:
    "将 protagonist、公开 NPC 或序列信息写入 public actor registry。\n\n" +
    "【使用边界】\n" +
    "- 重要 NPC 只需可被 scene/presence 引用：ensure-public-npc\n" +
    "- 重要 NPC 需要完整公开投影：upsert-public-npc\n" +
    "- 开局确认玩家角色：setup-protagonist\n" +
    "- 更新角色序列信息：upsert-sequence\n\n" +
    "禁区：\n" +
    "- 对普通 NPC 使用 upsert-sequence\n" +
    "- 把本局不需要追踪的角色全量写进 state",
  parameters: Type.Object({
    kind: Type.String({
      description: "setup-protagonist / ensure-public-npc / upsert-public-npc / upsert-sequence",
    }),
    actor: Type.Optional(publicActorSchema()),
    npc: Type.Optional(loosePublicNpcSchema()),
    sequence: Type.Optional(looseSequenceSchema()),
    reason: Type.String(),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    upsertActorTool(params, ctx.sessionManager),
};

function loosePublicNpcSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    id: Type.Optional(Type.String({ description: "upsert-public-npc：actor id" })),
    actorId: Type.Optional(Type.String({ description: "ensure-public-npc：actor id" })),
    kind: Type.Optional(
      Type.String({ description: "upsert-public-npc：human / beyonder / creature / other" }),
    ),
    npcKind: Type.Optional(
      Type.String({ description: "ensure-public-npc：human / beyonder / creature / other" }),
    ),
    internalName: Type.String({
      description: "内部/绑定层用名（可含玩家尚未得知的真名）；正文不直接使用",
    }),
    renderName: Type.Optional(
      Type.String({ description: "正文固定用名；缺省时拷贝 internalName" }),
    ),
    publicIdentity: Type.String({ description: "玩家当前可知的身份摘要" }),
    apparentAge: Type.Optional(Type.String()),
    outfit: Type.Optional(Type.Object({ label: Type.String(), details: Type.String() })),
    demeanor: Type.Optional(Type.String({ description: "玩家可见举止" })),
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
    kind: Type.String({ description: "social / faction" }),
    label: Type.Optional(Type.String()),
    factionId: Type.Optional(Type.String()),
  });
}

function looseSequenceSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    actorId: Type.String({ description: "actor id to set sequence on" }),
    id: Type.Optional(Type.String({ description: "alias for actorId" })),
    currentSequence: Type.String({
      description: "序列显示名，如 序列9-偷盗者",
    }),
    rank: Type.String({
      description:
        "seq-9 / seq-8 / seq-7 / seq-6 / seq-5 / seq-4 / seq-3 / seq-2 / seq-1 / seq-0 / old-one / pillar / ordinary",
    }),
    pathway: Type.String({
      description:
        "seer / apprentice / thief / mystery-prayer / spectator / sailor / bard / reader / warrior / sleepless / grave-keeper / hunter / assassin / savant / secret-pryer / monster / apothecary / cultivator / ruffian / arbiter / lawyer / broker",
    }),
    promotionSystem: Type.Optional(Type.String({ description: "potion / other" })),
    divinity: Type.Optional(Type.Number({ description: "神性值，默认 1" })),
    digestionProgress: Type.Optional(Type.Integer({ description: "0-100 消化进度，默认 0" })),
    lossOfControlProgress: Type.Optional(Type.Integer({ description: "0-100 失控进度，默认 0" })),
  });
}

function publicActorSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    id: Type.String(),
    kind: Type.String({ description: "human / beyonder / creature / other" }),
    roles: Type.Array(looseActorRoleSchema()),
    sequence: Type.Unknown({
      description: "序列对象或 null",
    }),
    identity: Type.Object({
      publicIdentity: Type.String(),
      background: Type.String(),
      lockedFacts: Type.Array(Type.Object({ id: Type.String(), text: Type.String() })),
    }),
    presentation: Type.Object({
      internalName: Type.String(),
      renderName: Type.Optional(Type.String()),
      apparentAge: Type.String(),
      outfit: Type.Object({ label: Type.String(), details: Type.String() }),
      demeanor: Type.String(),
    }),
    condition: Type.Object({
      statusEffects: Type.Array(Type.Unknown()),
    }),
    inventory: Type.Object({
      ordinaryItems: Type.Array(Type.String()),
    }),
    abilities: Type.Array(
      Type.Object({ id: Type.String(), label: Type.String(), summary: Type.String() }),
    ),
    relationshipToProtagonist: Type.Object({
      stance: Type.String({
        description: "self / ally / friendly / neutral / wary / hostile / unknown",
      }),
      summary: Type.String(),
    }),
  });
}
