import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { recordRelationshipSignal } from "../../core/utils/relationship-signal.ts";
import type { RelationshipSignal, State } from "../../core/state/state.ts";
import { stringEnumSchema } from "../../core/state/state-enum-schemas.ts";
import { RELATIONSHIP_SIGNAL_VISIBILITIES } from "../../core/state/state-schema.ts";
import {
  assertNonEmptyString,
  parseTypeBoxValue,
} from "../../core/utils/typebox-validation.ts";

import { runDomainEventTool } from "./domain-tool-runner.ts";

interface RecordRelationshipSignalResult {
  signal: RelationshipSignal;
}

export function recordRelationshipSignalTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => executeRecordRelationshipSignal(draft, params),
    details: (result) => ({ result }),
    message: formatResult,
  });
}

function executeRecordRelationshipSignal(
  draft: State,
  params: unknown,
): RecordRelationshipSignalResult {
  const input = parseTypeBoxValue(params, "record_relationship_signal 参数", RECORD_VALIDATOR);
  const signal = recordRelationshipSignal(draft, {
    actorId: input.actorId,
    targetActorId: input.targetActorId,
    signal: input.signal,
    interpretation: input.interpretation,
    boundary: input.boundary,
    sourceEventId: normalizeSourceEventId(input.sourceEventId),
    visibility: input.visibility,
  });
  return { signal };
}

function normalizeSourceEventId(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return assertNonEmptyString(value, "sourceEventId");
}

function formatResult(result: RecordRelationshipSignalResult): string {
  const signal = result.signal;
  const layer = signal.visibility === "player-known" ? "玩家已知" : "隐藏";
  return `关系信号已记账（${layer}）：${signal.id}｜${signal.actorId} → ${signal.targetActorId}｜${signal.signal}`;
}

const VISIBILITY_SCHEMA = stringEnumSchema(RELATIONSHIP_SIGNAL_VISIBILITIES);

const RECORD_SCHEMA = Type.Object({
  actorId: Type.String({ minLength: 1 }),
  targetActorId: Type.String({ minLength: 1 }),
  signal: Type.String({ minLength: 1 }),
  interpretation: Type.String({ minLength: 1 }),
  boundary: Type.String({ minLength: 1 }),
  sourceEventId: Type.Optional(Type.Unknown()),
  visibility: VISIBILITY_SCHEMA,
});

const RECORD_VALIDATOR = Compile(RECORD_SCHEMA);

export const recordRelationshipSignalToolDefinition: FateToolDefinition = {
  name: "record_relationship_signal",
  description:
    "记录关系信号账本：可回放的行为证据+当下解读+边界。不是好感度数值，也不是公开 NPC 内心独白；player-known 进 public ledger，secret 进 hidden ledger。\n\n" +
    "【使用边界】\n" +
    "- 重要关系发生可持续变化：信任/警惕/亏欠/保护/疏远/试探/越界/边界重设\n" +
    "- 需落地行为证据（称呼、距离、停顿、回避、照料、让路、挡前、换话题）\n" +
    "- 公开表现用 player-known，隐藏动机/误解用 secret\n\n" +
    "禁区：\n" +
    "- 记闲聊、一次性礼貌、无后续意义的情绪形容\n" +
    "- 把未揭示真名/隐藏宝具/幕后动机写进 player-known（需隐藏用 secret）\n" +
    "- 用抽象判词代替行为证据\n" +
    "- 把 boundary 写成未来剧情指令",
  parameters: Type.Object({
    actorId: Type.String({ description: "发出信号的 actor id；必须已存在于 public actors" }),
    targetActorId: Type.String({
      description: "信号指向的 actor id；必须已存在于 public actors；通常是 protagonist，也可以是 NPC",
    }),
    signal: Type.String({ description: "行为证据：动作、称呼、距离、停顿、回避、照料或选择" }),
    interpretation: Type.String({ description: "当前解读：为什么这条行为改变关系读法" }),
    boundary: Type.String({ description: "边界：这条信号不能被过度解读成什么" }),
    sourceEventId: Type.Optional(Type.Unknown({ description: "可选来源 event/fact/offscreen id；无来源填 null 或省略" })),
    visibility: Type.String({ description: "player-known / secret" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    recordRelationshipSignalTool(params, ctx.sessionManager),
};
