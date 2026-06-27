/**
 * ParallelLineOutput TypeBox 验证器（backlog #5）。
 *
 * 子代理返回裸 JSON 字符串；engine 用 TypeBox 严格验证结构，
 * 解析失败自动报错让调用方重试——从 prompt 恳求变成代码验收。
 */

import type { ParallelLineOutput } from "../state/state.ts";
import type { TypeBoxValidator } from "../utils/typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { TIMELINE_ID_SCHEMA, stringEnumSchema } from "../state/state-enum-schemas.ts";
import { parseTypeBoxValue, trimStringsDeep } from "../utils/typebox-validation.ts";

const PARALLEL_LINE_OUTCOME_SCHEMA = stringEnumSchema([
  "no-change",
  "progress",
  "escalation",
  "blocked",
]);

const TONE_DRIFT_RISK_SCHEMA = stringEnumSchema(["none", "watch", "drifting"]);

const TIME_WINDOW_SCHEMA = Type.Object({
  start: Type.String({ minLength: 1 }),
  end: Type.String({ minLength: 1 }),
});

const PARALLEL_LINE_OUTPUT_SCHEMA = Type.Object({
  lineId: Type.String({ minLength: 1 }),
  timelineId: TIMELINE_ID_SCHEMA,
  actorIds: Type.Array(Type.String({ minLength: 1 })),
  timeRange: TIME_WINDOW_SCHEMA,
  outcome: PARALLEL_LINE_OUTCOME_SCHEMA,
  privateSummary: Type.String({ minLength: 1 }),
  secretStateChanges: Type.Array(Type.String({ minLength: 1 })),
  publicLeakCandidates: Type.Array(Type.String({ minLength: 1 })),
  futureHooks: Type.Array(Type.String({ minLength: 1 })),
  toneDriftRisk: TONE_DRIFT_RISK_SCHEMA,
  genreFitNotes: Type.Array(Type.String()),
  riskFlags: Type.Array(Type.String()),
  optionalNarrativeSnippet: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
});

const COMPILED_VALIDATOR = Compile(PARALLEL_LINE_OUTPUT_SCHEMA);

// Static<typeof schema> → ParallelLineOutput 双向兼容由 TypeBoxValidator 泛型约束保证
const VALIDATOR: TypeBoxValidator<ParallelLineOutput> = COMPILED_VALIDATOR;

/**
 * 从子代理返回的裸 JSON 字符串解析 ParallelLineOutput。
 * 解析失败抛出 Error（调用方可捕获后重试一次）。
 */
export function parseParallelLineOutput(raw: string): ParallelLineOutput {
  const parsed = parseRawJson(raw);
  return parseTypeBoxValue(trimStringsDeep(parsed), "ParallelLineOutput", VALIDATOR);
}

function parseRawJson(raw: string): unknown {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error("parallel-line 子代理未返回有效 JSON 对象。输出必须以 { 开头、} 结尾。");
  }
  try {
    return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
  } catch (cause) {
    throw new Error("parallel-line 子代理返回的 JSON 无法解析。", { cause });
  }
}
