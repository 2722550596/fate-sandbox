import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  clearActorKnowledgeLens,
  recordActorKnowledgeFact,
  removeActorKnowledgeFact,
  upsertActorKnowledgeLens,
  type KnowledgeLensCategory,
} from "../../core/actor/actor-agenda.ts";
import type { ActorKnowledgeLens, State } from "../../core/state/state.ts";
import { stringEnumSchema } from "../../core/state/state-enum-schemas.ts";
import {
  assertNonEmptyString,
  isRecord,
  parseTypeBoxValue,
} from "../../core/utils/typebox-validation.ts";

import { runDomainEventTool } from "./domain-tool-runner.ts";

const RECORD_ACTOR_KNOWLEDGE_KINDS = ["upsert-lens", "add-fact", "remove-fact", "clear"] as const;
const KNOWLEDGE_LENS_CATEGORIES = [
  "knows",
  "suspects",
  "falseBeliefs",
  "forbiddenKnowledge",
] as const;

type RecordActorKnowledgeResult =
  | { kind: "upsert-lens"; lens: ActorKnowledgeLens; reason: string }
  | { kind: "add-fact"; lens: ActorKnowledgeLens; category: KnowledgeLensCategory; fact: string }
  | { kind: "remove-fact"; lens: ActorKnowledgeLens; category: KnowledgeLensCategory; fact: string }
  | { kind: "clear"; lens: ActorKnowledgeLens; reason: string };

export function recordActorKnowledgeTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => executeRecordActorKnowledge(draft, params),
    details: (result) => ({ result }),
    message: formatResult,
  });
}

function executeRecordActorKnowledge(draft: State, params: unknown): RecordActorKnowledgeResult {
  if (!isRecord(params)) {
    throw new Error("record_actor_knowledge 参数必须是对象。");
  }
  const kind = assertNonEmptyString(params["kind"], "kind");
  switch (kind) {
    case "upsert-lens": {
      const input = parseTypeBoxValue(params, "upsert-lens 参数", UPSERT_VALIDATOR);
      const lens = upsertActorKnowledgeLens(draft, {
        actorId: input.actorId,
        knows: input.knows,
        suspects: input.suspects,
        falseBeliefs: input.falseBeliefs,
        forbiddenKnowledge: input.forbiddenKnowledge,
      });
      return { kind, lens, reason: input.reason };
    }
    case "add-fact": {
      const input = parseTypeBoxValue(params, "add-fact 参数", ADD_FACT_VALIDATOR);
      const lens = recordActorKnowledgeFact(draft, input.actorId, input.category, input.fact);
      return { kind, lens, category: input.category, fact: input.fact };
    }
    case "remove-fact": {
      const input = parseTypeBoxValue(params, "remove-fact 参数", REMOVE_FACT_VALIDATOR);
      const lens = removeActorKnowledgeFact(draft, input.actorId, input.category, input.fact);
      return { kind, lens, category: input.category, fact: input.fact };
    }
    case "clear": {
      const input = parseTypeBoxValue(params, "clear 参数", CLEAR_VALIDATOR);
      const lens = clearActorKnowledgeLens(draft, input.actorId);
      return { kind, lens, reason: input.reason };
    }
    default:
      throw new Error(
        `不支持的 kind: ${kind}。允许: ${RECORD_ACTOR_KNOWLEDGE_KINDS.join(" / ")}。`,
      );
  }
}

function formatResult(result: RecordActorKnowledgeResult): string {
  switch (result.kind) {
    case "upsert-lens":
      return `NPC 认知边界已替换：${formatLens(result.lens)}（${result.reason}）`;
    case "add-fact":
      return `NPC 认知边界已追加：${result.lens.actorId}.${result.category} += ${result.fact}`;
    case "remove-fact":
      return `NPC 认知边界已移除：${result.lens.actorId}.${result.category} -= ${result.fact}`;
    case "clear":
      return `NPC 认知边界已清除：${result.lens.actorId}（${result.reason}）`;
  }
}

function formatLens(lens: ActorKnowledgeLens): string {
  return `${lens.actorId}｜knows ${lens.knows.length}｜suspects ${lens.suspects.length}｜false ${lens.falseBeliefs.length}｜forbidden ${lens.forbiddenKnowledge.length}`;
}

const CATEGORY_SCHEMA = stringEnumSchema(KNOWLEDGE_LENS_CATEGORIES);
const STRING_ARRAY_SCHEMA = Type.Array(Type.String({ minLength: 1 }));

const UPSERT_SCHEMA = Type.Object({
  kind: Type.Literal("upsert-lens"),
  actorId: Type.String({ minLength: 1 }),
  knows: STRING_ARRAY_SCHEMA,
  suspects: STRING_ARRAY_SCHEMA,
  falseBeliefs: STRING_ARRAY_SCHEMA,
  forbiddenKnowledge: STRING_ARRAY_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

const ADD_FACT_SCHEMA = Type.Object({
  kind: Type.Literal("add-fact"),
  actorId: Type.String({ minLength: 1 }),
  category: CATEGORY_SCHEMA,
  fact: Type.String({ minLength: 1 }),
});

const REMOVE_FACT_SCHEMA = Type.Object({
  kind: Type.Literal("remove-fact"),
  actorId: Type.String({ minLength: 1 }),
  category: CATEGORY_SCHEMA,
  fact: Type.String({ minLength: 1 }),
});

const CLEAR_SCHEMA = Type.Object({
  kind: Type.Literal("clear"),
  actorId: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

const UPSERT_VALIDATOR = Compile(UPSERT_SCHEMA);
const ADD_FACT_VALIDATOR = Compile(ADD_FACT_SCHEMA);
const REMOVE_FACT_VALIDATOR = Compile(REMOVE_FACT_SCHEMA);
const CLEAR_VALIDATOR = Compile(CLEAR_SCHEMA);

export const recordActorKnowledgeToolDefinition: FateToolDefinition = {
  name: "record_actor_knowledge",
  description:
    "记录 NPC 认知边界（secret state）：知道/怀疑/误信/绝不应凭空知道的事。防止 NPC 说出 GM 视角事实、隐藏真名、幕后真相。\n\n" +
    "【使用边界】\n" +
    "- NPC 获新情报/误判/被欺/被告知：add-fact\n" +
    "- 重建整个认知边界：upsert-lens（四数组显式给出）\n" +
    "- 谣言证伪/误信纠正/信息过期：remove-fact\n" +
    "- NPC 离开本局跟踪：clear + reason\n\n" +
    "禁区：\n" +
    "- 用它公开秘密：它只写 secret state\n" +
    "- 把玩家现实知识/GM lookup/未揭示真名/隐藏宝具塞进 knows（除非剧情已成立）\n" +
    "- 让 NPC 说出 forbiddenKnowledge；需揭示先走 reveal_secret 或前台证据",
  parameters: Type.Object({
    kind: Type.String({ description: "允许: upsert-lens / add-fact / remove-fact / clear" }),
    actorId: Type.String({ description: "目标 actor id；必须已存在于 public actors" }),
    category: Type.Optional(
      Type.String({ description: "add/remove 必填：knows / suspects / falseBeliefs / forbiddenKnowledge" }),
    ),
    fact: Type.Optional(Type.String({ description: "add/remove 必填：一条具体认知事实" })),
    knows: Type.Optional(Type.Array(Type.String({ description: "upsert-lens 必填" }))),
    suspects: Type.Optional(Type.Array(Type.String({ description: "upsert-lens 必填" }))),
    falseBeliefs: Type.Optional(Type.Array(Type.String({ description: "upsert-lens 必填" }))),
    forbiddenKnowledge: Type.Optional(Type.Array(Type.String({ description: "upsert-lens 必填" }))),
    reason: Type.Optional(Type.String({ description: "upsert-lens/clear 必填：为何替换或清除" })),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    recordActorKnowledgeTool(params, ctx.sessionManager),
};
