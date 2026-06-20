import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import { Type } from "typebox";
import type { PublicActorState } from "../../engine/core/state.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { upsertActor } from "../../engine/core/actor.ts";
import { parseActorRegistryInput } from "../../engine/core/actor-schema.ts";
import { ACTOR_KINDS } from "../../engine/core/state-enum-schemas.ts";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner.ts";
import { isRecord } from "../../engine/core/typebox-validation.ts";

/**
 * upsert_actor 边界：结构校验交给 actor-schema；这里只保留领域归一化——
 * setup-protagonist 的 stripUndefined / magecraft / master role 缺省，
 * servant 的 nullable 缺省与玩家从者真名保护。
 */
export function upsertActorTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) =>
      upsertActor(draft, parseActorRegistryInput(prepareUpsertActorParams(params), "upsert_actor 参数")),
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
    case "upsert-servant":
      return { ...params, servant: normalizeServantInput(params["servant"]) };
    default:
      return params;
  }
}

function normalizeNpcInput(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  return { ...value, publicRoles: normalizeMasterRoles(value["publicRoles"]) };
}

function normalizeServantInput(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  guardProtagonistTrueName(value);
  return {
    ...value,
    masterActorId: value["masterActorId"] ?? null,
    masterName: value["masterName"] ?? null,
    publicRoles: normalizeMasterRoles(value["publicRoles"]),
  };
}

/**
 * 玩家从者初始化不得公开真名——指向 reveal_secret 的领域报错，先于 schema。
 * BACKLOG（换主角）：这里靠 id==="protagonist" 字面量识别“玩家从者”。该守卫处在无 state
 * 上下文的输入归一层，拿不到 protagonistActorId 指针，所以暂时只能靠种子约定。
 * 这是 prompt 兑底守卫（真防线是 commit 层 firewall）；待“换主角”真立项、重设 setup 流程时，
 * 改成靠 kind/指针而非 id 字面量。
 */
function guardProtagonistTrueName(servant: Record<string, unknown>): void {
  if (servant["id"] === "protagonist" && servant["trueNameStatus"] === "revealed") {
    throw new Error(
      "玩家从者初始化不得把 servant.trueNameStatus 写成 revealed；玩家知道真名也应保持 public trueName hidden/suspected，并用 reveal_secret 配置隐藏真名。",
    );
  }
}

/** master role 缺省字段：commandSpells {3,3}、contractedServantIds []。 */
function normalizeMasterRoles(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }
  return value.map((role) => {
    const stripped = stripUndefined(role);
    if (!isRecord(stripped) || stripped["kind"] !== "master") {
      return stripped;
    }
    return {
      ...stripped,
      commandSpells: stripped["commandSpells"] ?? { total: 3, remaining: 3 },
      contractedServantIds: stripped["contractedServantIds"] ?? [],
    };
  });
}

function normalizeSetupProtagonistActor(actor: unknown): PublicActorState {
  const normalized = stripUndefinedRecord(assertRecord(actor, "actor"));
  normalized["roles"] = normalizeMasterRoles(normalized["roles"]);
  normalized["magecraft"] = normalizeSetupMagecraft(normalized["magecraft"]);
  if (normalized["servantForm"] === undefined) {
    normalized["servantForm"] = null;
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
  // Full actor shape is intentionally validated by the Domain Event Tool Runner commit (assertState) after cleanup; this assertion only narrows the tool-boundary record type.
}

function normalizeSetupMagecraft(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  const magecraft = stripUndefined(value);
  if (!isRecord(magecraft)) {
    return magecraft;
  }

  const circuits = normalizeSetupCircuits(magecraft["circuits"]);
  const disciplines = magecraft["disciplines"];
  const affiliation = magecraft["affiliation"];
  const hasDisciplines = Array.isArray(disciplines) && disciplines.length > 0;
  const hasAffiliation = typeof affiliation === "string" && affiliation.trim().length > 0;
  if (circuits === undefined && !hasDisciplines && !hasAffiliation) {
    return null;
  }

  return {
    circuits: circuits ?? defaultUnknownCircuits(),
    disciplines: disciplines ?? [],
    affiliation: hasAffiliation ? affiliation.trim() : null,
  };
}

function normalizeSetupCircuits(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  const circuits = stripUndefined(value);
  if (!isRecord(circuits)) {
    return circuits;
  }
  return {
    count: circuits["count"] ?? "未确认",
    quality: circuits["quality"] ?? "none",
    od: circuits["od"] ?? 100,
    status: circuits["status"] ?? "normal",
    traits: circuits["traits"] ?? [],
  };
}

function defaultUnknownCircuits(): Record<string, unknown> {
  return { count: "未确认", quality: "none", od: 100, status: "normal", traits: [] };
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
    "将 protagonist、公开 NPC skeleton、公开 NPC 摘要或从者数据写入 public actor registry。\n\n" +
    "【使用边界】\n" +
    "- 重要 NPC 只需可被 scene/presence 引用：ensure-public-npc\n" +
    "- 重要 NPC 需要完整公开投影：upsert-public-npc\n" +
    "- 开局确认玩家角色：setup-protagonist\n" +
    "- 从者正式入场：upsert-servant\n" +
    "- 无主从者用 masterless，并省略或置空 masterActorId/masterName\n\n" +
    "【严禁】\n" +
    "- 对普通 NPC 使用 upsert-servant\n" +
    "- 用 upsert-public-npc 写入魔术、真名、宝具或隐藏身份\n" +
    "- 把本局不需要追踪的角色全量写进 state",
  parameters: Type.Object({
    kind: Type.String({
      description:
        "setup-protagonist / ensure-public-npc / upsert-public-npc / upsert-servant",
    }),
    actor: Type.Optional(publicActorSchema()),
    npc: Type.Optional(loosePublicNpcSchema()),
    servant: Type.Optional(looseServantSchema()),
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
      Type.String({ description: "upsert-public-npc：human / outsider / spirit / other" }),
    ),
    npcKind: Type.Optional(
      Type.String({ description: "ensure-public-npc：human / outsider / spirit / other" }),
    ),
    internalName: Type.String({
      description: "内部/绑定层用名（可含玩家尚未得知的真名）；正文不直接使用",
    }),
    renderName: Type.Optional(
      Type.String({ description: "正文固定用名（玩家当前可见的称呼）；缺省时拷贝 internalName" }),
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
    kind: Type.String({ description: "social / faction / master" }),
    label: Type.Optional(Type.String()),
    factionId: Type.Optional(Type.String()),
    commandSpells: Type.Optional(Type.Object({ total: Type.Integer(), remaining: Type.Integer() })),
    contractedServantIds: Type.Optional(Type.Array(Type.String())),
  });
}
function looseServantSchema(): ReturnType<typeof Type.Object> {
  return Type.Object({
    id: Type.String({ description: "从者 actor id" }),
    internalName: Type.String({
      description: "内部/绑定层用名（可含玩家尚未得知的真名）；正文不直接使用",
    }),
    renderName: Type.Optional(
      Type.String({ description: "正文固定用名（玩家当前可见的称呼）；缺省时拷贝 internalName" }),
    ),
    publicIdentity: Type.String({ description: "玩家当前可知的公开身份摘要" }),
    apparentAge: Type.String(),
    outfit: Type.Object({ label: Type.String(), details: Type.String() }),
    demeanor: Type.String(),
    className: Type.String({
      description: "Saber / Archer / Lancer / Rider / Caster / Assassin / Berserker",
    }),
    trueNameDisplay: Type.String({ description: "真名显示文本；hidden 时填职阶名" }),
    trueNameStatus: Type.String({ description: "hidden / suspected / revealed" }),
    parameters: Type.Object({
      strength: Type.String({ description: "Fate rank" }),
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
        kind: Type.String({ description: "宝具类型" }),
        status: Type.String({ description: "hidden / suspected / revealed" }),
        summary: Type.String(),
      }),
    ),
    spiritualCore: Type.Integer({ description: "0-100 灵核完整度" }),
    mana: Type.Integer({ description: "0-100 从者魔力余量" }),
    spiritualCondition: Type.String({ description: "灵核状态描述" }),
    masterActorId: Type.Optional(Type.Unknown({ description: "当前御主 actor id；无主可置空" })),
    masterName: Type.Optional(Type.Unknown({ description: "当前御主玩家可见姓名；无主可置空" })),
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
    kind: Type.String({ description: "human / outsider / spirit / other" }),
    roles: Type.Array(looseActorRoleSchema()),
    magecraft: Type.Unknown({
      description: "魔术回路对象或 null；内部字段由工具校验",
    }),
    servantForm: Type.Unknown({
      description: "从者形态对象或 null；内部字段由工具校验",
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
      wounds: Type.Array(Type.Unknown()),
      afflictions: Type.Array(Type.Unknown()),
      permanentEffects: Type.Array(Type.Unknown()),
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