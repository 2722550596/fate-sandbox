/**
 * semantic-reveal.ts — 推理型秘密揭示判断引擎
 *
 * 这不是语义匹配（RAG 式文本相似度），而是**推理判断**：
 * 玩家的声称（claim/trigger）+ 证据（evidence）是否构成足够的逻辑链条
 * 来推导出某个隐藏秘密成立？
 *
 * 使用 SiliconFlow 上的 Qwen3.5-4B（或通过 .env 配置的其他模型），
 * 通过 pi-ai 库调用 OpenAI-compatible chat/completions API。
 */

import type { Model } from "@earendil-works/pi-ai";

import { complete } from "@earendil-works/pi-ai";

import { loadEnv, requireEnv } from "../utils/env-loader.ts";

// ===========================================================================
// 类型定义
// ===========================================================================

export interface SecretCandidate {
  id: string;
  kind: "actor-beyonder" | "actor-private" | "world-fact";
  value: string;
  conditions: string[];
}

export type RevealKind = "claim-reveal" | "observed-reveal";

export interface RevealInput {
  kind: RevealKind;
  needle: string;
  evidence: string;
}

export interface SlotJudgment {
  id: string;
  needleMatch: boolean;
  evidenceMatch: boolean;
}

// ===========================================================================
// 快速通道：子串匹配
// ===========================================================================

/**
 * 快速通道：纯子串匹配。
 * 返回 (已匹配的, 未匹配的)。
 * 只有 needle + evidence 都子串命中才算"已匹配"。
 */
export function findMatchesFast(
  input: RevealInput,
  candidates: SecretCandidate[],
): [SlotJudgment[], SecretCandidate[]] {
  const matched: SlotJudgment[] = [];
  const unmatched: SecretCandidate[] = [];

  const needleLower = input.needle.toLowerCase();
  const evidenceLower = input.evidence.toLowerCase();

  for (const c of candidates) {
    const valueLower = c.value.toLowerCase();
    const needleOk = valueLower.length > 0 && needleLower.includes(valueLower);
    const evidenceOk = c.conditions.some(
      (cond) => cond.length > 0 && evidenceLower.includes(cond.toLowerCase()),
    );

    if (needleOk && evidenceOk) {
      matched.push({ id: c.id, needleMatch: true, evidenceMatch: true });
    } else {
      unmatched.push(c);
    }
  }

  return [matched, unmatched];
}

// ===========================================================================
// LLM 推理判断
// ===========================================================================

/**
 * 推理揭示的系统提示词。
 *
 * 关键设计：这不是语义匹配，而是推理评估。
 * 模型需要理解 claim/trigger + evidence 中的逻辑线索、因果关系、隐含信息，
 * 判断它们是否足以推导出秘密成立。
 */
const JUDGE_SYSTEM_PROMPT = `你是一个秘密揭示推理引擎。你的任务不是做文本匹配，而是进行逻辑推理。

玩家通过调查、观察或推理得出一个结论（claim/trigger），并提供了支持性证据（evidence）。
你需要判断：这些信息是否足以**推理出**某个隐藏秘密。

推理判断的两个维度：

1. **needleMatch（推理指向性）**：
   玩家的声称/观察本身（不依赖证据）是否指向/暗示/涉及该秘密？
   - "他身上的气息让我想起灵教团" → 指向灵教团相关秘密
   - "他在刻意避开占卜" → 可能指向与占卜有关的秘密
   - 不是文本相似，而是逻辑关联

2. **evidenceMatch（证据支撑度）**：
   证据文本是否支撑/印证了该秘密的揭示条件？
   - 秘密的揭示条件可能不是关键词匹配，而是概念层面的支撑
   - 例如条件"占卜家途径"可以被"他能用灵摆追踪人"支撑
   - 证据不需要提到条件原文，只要合理支撑即可

判断原则：
- **needleMatch 严格**：只凭玩家的声称/观察本身，不看证据。如果声称本身没有直接或强暗示指向秘密，就不算匹配。
- 排除间接：如果 claim 只是描述了无关表象（如"穿蓝衬衫"）而证据让模型联想到秘密，仍不能算 needleMatch
- **evidenceMatch 宽松**：只要证据文本包含或合理暗示了任意一个揭示条件，就算匹配。即使只是关键词或近似概念也算。
- 允许多种表达：同义词、比喻、婉转暗示、乃至部分关键词的出现都算 evidenceMatch
- 条件满足其一即算 evidenceMatch

输出格式：纯 JSON 数组，不要包含其他任何文字。
每条：{"id": "秘密ID", "needleMatch": true/false, "evidenceMatch": true/false}

示例：
输入：
  类型: claim-reveal
  声称: "我怀疑他是命运途径的非凡者。他能让硬币在每次关键时刻都落在正确的一面。"
  证据: "我观察到他每次做重大决策前都会抛硬币，而且结果总是对他有利。"
  候选: [{"id": "s0", "value": "序列7幸运儿", "conditions": ["命运", "怪物", "幸运"]}]
推理：
  声称中"命运途径"+"硬币落在正确一面" → 指向幸运儿（命运途径的序列7）
  证据中"抛硬币"+"总是对他有利" → 支撑条件"幸运"和"命运"
输出：
  [{"id": "s0", "needleMatch": true, "evidenceMatch": true}]`;

function buildUserPrompt(input: RevealInput, candidates: SecretCandidate[]): string {
  const lines: string[] = [
    `类型: ${input.kind}`,
    `玩家声称/观察: ${input.needle}`,
    `证据: ${input.evidence}`,
    "",
    "候选秘密:",
  ];

  for (const c of candidates) {
    const conds = c.conditions.join(", ");
    lines.push(
      `  {"id": "${c.id}", "kind": "${c.kind}", "value": "${c.value}", "conditions": ["${conds}"]}`,
    );
  }

  lines.push("");
  lines.push("对每个候选进行推理判断。只输出 JSON 数组，不要包含任何其他文字。");

  return lines.join("\n");
}

// ===========================================================================
// 模型定义
// ==========================================================================

loadEnv();

const API_BASE = process.env["SILICONFLOW_BASE_URL"] ?? "https://api.siliconflow.cn/v1";
const API_KEY = requireEnv("SILICONFLOW_API_KEY");
const JUDGE_MODEL_ID = process.env["LLM_JUDGE_MODEL"] ?? "Qwen/Qwen3.5-4B";

const judgeModel: Model<"openai-completions"> = {
  id: JUDGE_MODEL_ID,
  name: JUDGE_MODEL_ID,
  api: "openai-completions",
  provider: "siliconflow",
  baseUrl: API_BASE,
  reasoning: true,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 32768,
  maxTokens: 4096,
  compat: {
    thinkingFormat: "qwen", // ← 新增：用 enable_thinking 参数
    supportsDeveloperRole: false, // ← 新增：不用 developer role
  },
};

// ===========================================================================
// LLM 调用与回复解析
// ===========================================================================

export interface JudgeResponse {
  id: string;
  needleMatch: boolean;
  evidenceMatch: boolean;
}

function isJudgeResponseArray(value: unknown): value is JudgeResponse[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item): item is JudgeResponse =>
      typeof item === "object" &&
      item !== null &&
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      typeof (item as Record<string, unknown>)["id"] === "string",
  );
}

function parseJudgmentResponse(raw: string): JudgeResponse[] {
  const trimmed = raw.trim();

  // 提取 JSON 数组
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`无法从 LLM 回复中提取 JSON 数组:\n${trimmed.slice(0, 500)}`);
  }

  const jsonText = trimmed.slice(start, end + 1);
  const parsed: unknown = JSON.parse(jsonText);

  if (!isJudgeResponseArray(parsed)) {
    throw new Error(`LLM 回复格式不符合预期`);
  }

  // 标准化布尔值
  const items: JudgeResponse[] = parsed;
  return items.map((item) => ({
    id: item.id,
    // oxlint-disable-next-line typescript/no-unnecessary-type-conversion
    needleMatch: !!item.needleMatch,
    // oxlint-disable-next-line typescript/no-unnecessary-type-conversion
    evidenceMatch: !!item.evidenceMatch,
  }));
}

// ===========================================================================
// 主入口
// ===========================================================================

export interface JudgeSecretsOptions {
  /** 跳过 LLM 调用，仅使用子串匹配（降级用） */
  skipLlm?: boolean;
}

/**
 * 对候选秘密进行推理判断。
 *
 * 两阶段：
 * 1. 快速通道——子串匹配（零成本，已有命中直接揭示）
 * 2. LLM 推理通道——剩余候选走 Qwen3.5-4B 做推理判断
 *
 * LLM 调用失败时自动降级为纯子串匹配，保证运行不中断。
 */
export async function judgeSecrets(
  input: RevealInput,
  candidates: SecretCandidate[],
  options: JudgeSecretsOptions = {},
): Promise<SlotJudgment[]> {
  if (candidates.length === 0) return [];

  // 阶段 1：快速通道
  const [fastMatched, remaining] = findMatchesFast(input, candidates);

  // 没有剩余候选——所有都已匹配
  if (remaining.length === 0 || options.skipLlm) {
    return buildFullResult(candidates, fastMatched, remaining);
  }

  // 阶段 2：LLM 推理通道
  try {
    const prompt = buildUserPrompt(input, remaining);
    const response = await complete(
      judgeModel,
      {
        systemPrompt: JUDGE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
      },
      {
        apiKey: API_KEY,
        temperature: 0.7,
        maxTokens: 2048,
      },
    );

    // 提取文本回复
    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock?.text ?? "";
    if (rawText.length === 0) {
      // LLM 回复没有文本内容（可能只有 tool call 或其他），降级
      return buildFullResult(candidates, fastMatched, remaining);
    }

    const llmJudgments = parseJudgmentResponse(rawText);

    // 合并
    const resultMap = new Map<string, SlotJudgment>();
    for (const j of fastMatched) resultMap.set(j.id, j);
    for (const j of llmJudgments)
      resultMap.set(j.id, {
        id: j.id,
        needleMatch: j.needleMatch,
        evidenceMatch: j.evidenceMatch,
      });

    // 按原始顺序返回
    return candidates
      .map((c) => resultMap.get(c.id))
      .filter((j): j is SlotJudgment => j !== undefined);
  } catch (e) {
    // LLM 调用失败——降级：未匹配的候选全部标为不匹配
    console.error("[semantic-reveal] LLM 调用失败，降级为子串匹配:", e);
    return buildFullResult(candidates, fastMatched, remaining);
  }
}

/**
 * 构建完整结果（非 LLM 路径用）：快速匹配的结果 + 未匹配的标为 false。
 */
function buildFullResult(
  allCandidates: SecretCandidate[],
  fastMatched: SlotJudgment[],
  remaining: SecretCandidate[],
): SlotJudgment[] {
  const resultMap = new Map<string, SlotJudgment>();
  for (const j of fastMatched) resultMap.set(j.id, j);
  for (const c of remaining) {
    if (!resultMap.has(c.id)) {
      resultMap.set(c.id, { id: c.id, needleMatch: false, evidenceMatch: false });
    }
  }
  return allCandidates
    .map((c) => resultMap.get(c.id))
    .filter((j): j is SlotJudgment => j !== undefined);
}

// ===========================================================================
// 隐藏反应判断（for private_resolve hidden-reaction）
// ===========================================================================

export interface HiddenReactionJudgment {
  id: string;
  triggered: boolean;
}

/**
 * 隐藏反应快速通道：子串匹配。
 * stimulus 包含某个 condition 即视为触发。
 */
function findHiddenReactionFast(
  stimulus: string,
  candidates: SecretCandidate[],
): [HiddenReactionJudgment[], SecretCandidate[]] {
  const matched: HiddenReactionJudgment[] = [];
  const unmatched: SecretCandidate[] = [];
  const stimulusLower = stimulus.toLowerCase();

  for (const c of candidates) {
    const triggered = c.conditions.some(
      (cond) => cond.length > 0 && stimulusLower.includes(cond.toLowerCase()),
    );
    if (triggered) {
      matched.push({ id: c.id, triggered: true });
    } else {
      unmatched.push(c);
    }
  }

  return [matched, unmatched];
}

const HIDDEN_REACTION_SYSTEM_PROMPT = `你是一个隐藏反应推理引擎。你的任务是判断玩家的言行（stimulus）是否触及了一个角色的隐藏秘密。

你需要判断 stimulus（玩家说了什么/做了什么）是否与某个隐藏秘密有语义关联。

判断原则：
- 只要 stimulus 与秘密的内容、主题、相关人物或事件有合理关联，即视为触发（triggered: true）
- 不需要确凿证据，只要有合理联想空间就算
- 排除泛泛：如果 stimulus 只是"他很奇怪"这种空泛描述，没有具体指向，不算触发
- 允许多种表达：同义词、比喻、婉转暗示都算

输出格式：纯 JSON 数组，不要包含其他任何文字。
每条：{"id": "秘密ID", "triggered": true/false}`;

function buildHiddenReactionPrompt(
  stimulus: string,
  publicContext: string,
  candidates: SecretCandidate[],
): string {
  const lines: string[] = [
    `当前的言行（stimulus）: ${stimulus}`,
    `场景上下文（publicContext）: ${publicContext}`,
    "",
    "角色的隐藏秘密:",
  ];

  for (const c of candidates) {
    const conds = c.conditions.join(", ");
    lines.push(
      `  {"id": "${c.id}", "kind": "${c.kind}", "value": "${c.value}", "conditions": ["${conds}"]}`,
    );
  }

  lines.push("");
  lines.push("对每个秘密判断是否被触及。只输出 JSON 数组，不要包含任何其他文字。");

  return lines.join("\n");
}

function parseHiddenReactionResponse(raw: string): HiddenReactionJudgment[] {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`无法从 LLM 回复中提取 JSON 数组:\n${trimmed.slice(0, 500)}`);
  }
  const jsonText = trimmed.slice(start, end + 1);
  const parsed: unknown = JSON.parse(jsonText);

  if (!Array.isArray(parsed)) {
    throw new Error(`LLM 回复格式不符合预期`);
  }

  return parsed.map((item: unknown) => {
    // oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const record = item as Record<string, unknown>;
    if (typeof record["id"] !== "string") throw new Error(`missing id`);
    return {
      id: record["id"],
      // oxlint-disable-next-line typescript/no-unnecessary-type-conversion
      triggered: !!record["triggered"],
    };
  });
}

/**
 * 判断刺激是否触及角色的隐藏秘密。
 * 两阶段：快速子串匹配 + LLM 推理回退。
 */
export async function judgeHiddenReaction(
  stimulus: string,
  publicContext: string,
  candidates: SecretCandidate[],
  options: JudgeSecretsOptions = {},
): Promise<HiddenReactionJudgment[]> {
  if (candidates.length === 0) return [];

  // 阶段 1：快速通道
  const [fastMatched, remaining] = findHiddenReactionFast(stimulus, candidates);

  if (remaining.length === 0 || options.skipLlm) {
    return buildHiddenFullResult(candidates, fastMatched, remaining);
  }

  // 阶段 2：LLM 推理通道
  try {
    const prompt = buildHiddenReactionPrompt(stimulus, publicContext, remaining);
    const response = await complete(
      judgeModel,
      {
        systemPrompt: HIDDEN_REACTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
      },
      {
        apiKey: API_KEY,
        temperature: 0.3,
        maxTokens: 2048,
      },
    );

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock?.text ?? "";
    if (rawText.length === 0) {
      return buildHiddenFullResult(candidates, fastMatched, remaining);
    }

    const llmJudgments = parseHiddenReactionResponse(rawText);

    // 合并
    const resultMap = new Map<string, HiddenReactionJudgment>();
    for (const j of fastMatched) resultMap.set(j.id, j);
    for (const j of llmJudgments) resultMap.set(j.id, j);

    return candidates
      .map((c) => resultMap.get(c.id))
      .filter((j): j is HiddenReactionJudgment => j !== undefined);
  } catch (e) {
    console.error("[semantic-reveal] hidden-reaction LLM 调用失败，降级:", e);
    return buildHiddenFullResult(candidates, fastMatched, remaining);
  }
}

function buildHiddenFullResult(
  allCandidates: SecretCandidate[],
  fastMatched: HiddenReactionJudgment[],
  remaining: SecretCandidate[],
): HiddenReactionJudgment[] {
  const resultMap = new Map<string, HiddenReactionJudgment>();
  for (const j of fastMatched) resultMap.set(j.id, j);
  for (const c of remaining) {
    if (!resultMap.has(c.id)) {
      resultMap.set(c.id, { id: c.id, triggered: false });
    }
  }
  return allCandidates
    .map((c) => resultMap.get(c.id))
    .filter((j): j is HiddenReactionJudgment => j !== undefined);
}

// ===========================================================================
// 秘密兼容性判断（for private_resolve secret-compatibility）
// ===========================================================================

export interface CompatibilityInput {
  secretsA: string[];
  secretsB: string[];
  interaction: string;
}

export interface CompatibilityJudgment {
  compatible: boolean;
}

const COMPATIBILITY_SYSTEM_PROMPT = `你是一个秘密兼容性推理引擎。你的任务是判断两个角色的隐藏秘密之间是否存在关联。

"兼容"的定义：
- 两个角色共享相同的秘密（都在寻找同一件东西、属于同一组织）
- 一个角色的秘密与另一个角色的秘密有直接冲突（一个要保护某物，另一个要摧毁它）
- 两个秘密涉及相同的人物、事件或组织

判断原则：
- 只要存在合理关联即视为兼容（compatible: true）
- 不要求完全相同的秘密，概念层面有关联即可
- 无关的秘密不兼容

输出格式：纯 JSON。
{"compatible": true/false}`;

function buildCompatibilityPrompt(input: CompatibilityInput): string {
  return [
    `角色 A 的隐藏秘密:`,
    ...input.secretsA.map((s) => `- ${s}`),
    "",
    `角色 B 的隐藏秘密:`,
    ...input.secretsB.map((s) => `- ${s}`),
    "",
    `当前互动类型: ${input.interaction}`,
    "",
    "判断是否存在隐藏兼容性。只输出 JSON，不要包含任何其他文字。",
  ].join("\n");
}

function parseCompatibilityResponse(raw: string): CompatibilityJudgment {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`无法从 LLM 回复中提取 JSON 对象:\n${trimmed.slice(0, 500)}`);
  }
  const jsonText = trimmed.slice(start, end + 1);
  const parsed: unknown = JSON.parse(jsonText);

  // oxlint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const record = parsed as Record<string, unknown>;
  return {
    // oxlint-disable-next-line typescript/no-unnecessary-type-conversion
    compatible: !!record["compatible"],
  };
}

/**
 * 判断两个角色之间的隐藏秘密是否存在兼容性关联。
 */
export async function judgeCompatibility(
  input: CompatibilityInput,
  options: JudgeSecretsOptions = {},
): Promise<CompatibilityJudgment> {
  if (input.secretsA.length === 0 || input.secretsB.length === 0 || options.skipLlm) {
    return { compatible: false };
  }

  try {
    const prompt = buildCompatibilityPrompt(input);
    const response = await complete(
      judgeModel,
      {
        systemPrompt: COMPATIBILITY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
      },
      {
        apiKey: API_KEY,
        temperature: 0.3,
        maxTokens: 1024,
      },
    );

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock?.text ?? "";
    if (rawText.length === 0) {
      return { compatible: false };
    }

    return parseCompatibilityResponse(rawText);
  } catch (e) {
    console.error("[semantic-reveal] compatibility LLM 调用失败，降级:", e);
    return { compatible: false };
  }
}
