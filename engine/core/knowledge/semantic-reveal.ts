/**
 * semantic-reveal.ts — 推理型秘密揭示判断引擎
 *
 * 纯 LLM 推理系统：所有判断通过 LLM 完成，使用自然语言揭示条件描述。
 * LLM 调用失败时回退到基础关键词匹配，保证功能不中断。
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
  /** 自然语言描述的秘密揭示条件 */
  revealCondition: string;
}

export type RevealKind = "claim-reveal" | "observed-reveal";

export interface RevealInput {
  kind: RevealKind;
  needle: string;
  evidence: string;
}

/** 单条秘密的判断结果 */
export interface SlotJudgment {
  id: string;
  /** 综合揭示度 */
  verdict: "revealed" | "hinted" | "unrelated";
  /** 各维度评估 */
  assessment: {
    /** 声称关联度：独立于证据，只评估声称本身 */
    claimRelevance: "direct" | "related" | "unrelated";
    /** 证据支撑度：只依赖证据文本 */
    evidenceSupport: "confirms" | "suggests" | "contradicts" | "absent";
  };
  reason: string;
}

// ===========================================================================
// 秘密揭示判断（reveal_secret）
// ===========================================================================

const JUDGE_SYSTEM_PROMPT = `你是一个秘密揭示推理引擎。你的任务是为每条候选秘密做出推理判断。

对于每条候选秘密，你需要从两个维度评估，然后给出综合结论：

1. **claimRelevance（声称关联度）**：玩家的声称/观察本身是否指向该秘密？
   - "direct"：直接提到秘密核心（人物、事件、物件等）
   - "related"：间接关联或暗示
   - "unrelated"：完全没有指向

2. **evidenceSupport（证据支撑度）**：证据文本对秘密揭示条件的支撑程度
   - "confirms"：证据直接印证秘密
   - "suggests"：证据包含相关暗示
   - "contradicts"：证据与秘密矛盾
   - "absent"：证据中没有相关信息

3. **verdict（综合揭示度）**：综合以上两个维度
   - "revealed"：秘密已被充分揭示
   - "hinted"：有暗示但不足以确认
   - "unrelated"：与秘密无关

**重要原则**：
- claimRelevance 独立于 evidenceSupport —— 即使证据不足，声称本身仍可能直接指向秘密
- evidenceSupport 只依赖证据文本本身，不受声称影响
- verdict 是两者的综合结论

输出格式：纯 JSON 数组，不要包含任何其他文字。
每条：{"id": "秘密ID", "verdict": "revealed|hinted|unrelated", "assessment": {"claimRelevance": "direct|related|unrelated", "evidenceSupport": "confirms|suggests|contradicts|absent"}, "reason": "用一两句话简要说明判断理由"}`;

function buildUserPrompt(input: RevealInput, candidates: SecretCandidate[]): string {
  const lines: string[] = [
    `类型: ${input.kind}`,
    `玩家声称/观察: ${input.needle}`,
    `证据: ${input.evidence}`,
    "",
    "候选秘密:",
  ];

  for (const c of candidates) {
    lines.push(
      `  {"id": "${c.id}", "kind": "${c.kind}", "value": "${c.value}", "revealCondition": "${c.revealCondition}"}`,
    );
  }

  lines.push("");
  lines.push(
    "对每个候选进行推理判断。每条 JSON 必须包含 id、verdict、assessment、reason 字段。只输出 JSON 数组，不要包含任何其他文字。",
  );

  return lines.join("\n");
}

// ===========================================================================
// 模型定义
// ===========================================================================

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
    thinkingFormat: "qwen",
    supportsDeveloperRole: false,
  },
};

// ===========================================================================
// LLM 调用与回复解析
// ===========================================================================

export interface JudgeResponse {
  id: string;
  verdict: "revealed" | "hinted" | "unrelated";
  assessment: {
    claimRelevance: "direct" | "related" | "unrelated";
    evidenceSupport: "confirms" | "suggests" | "contradicts" | "absent";
  };
  reason: string;
}

function isJudgeResponseArray(value: unknown): value is JudgeResponse[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item): item is JudgeResponse =>
      typeof item === "object" &&
      item !== null &&
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      typeof (item as Record<string, unknown>)["id"] === "string" &&
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      typeof (item as Record<string, unknown>)["verdict"] === "string",
  );
}

function parseJudgmentResponse(raw: string): JudgeResponse[] {
  const trimmed = raw.trim();
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
  return parsed.map((item) => ({
    id: item.id,
    verdict: item.verdict,
    assessment: item.assessment,
    reason: item.reason,
  }));
}

/** LLM 失败时的关键词回退：evidence 包含 revealCondition 中的关键词即 hint */
function keywordEvidenceFallback(
  candidates: readonly SecretCandidate[],
  evidenceText: string,
): SlotJudgment[] {
  const lower = evidenceText.toLowerCase();
  return candidates.map((c) => {
    const keywords = c.revealCondition.split(/[,，、\s]+/).filter(Boolean);
    const evidenceMatch = keywords.some((kw) => kw.length > 0 && lower.includes(kw.toLowerCase()));
    return {
      id: c.id,
      verdict: evidenceMatch ? "hinted" : "unrelated",
      assessment: {
        claimRelevance: "unrelated",
        evidenceSupport: evidenceMatch ? "suggests" : "absent",
      },
      reason: evidenceMatch
        ? "关键词匹配：evidence 包含揭示条件中的相关词汇"
        : "关键词未匹配：evidence 不包含揭示条件中的相关词汇",
    };
  });
}

/** 关键词回退 hidden-reaction：stimulus 包含 revealCondition 关键词即 triggered */
function keywordStimulusFallback(
  candidates: readonly SecretCandidate[],
  stimulus: string,
): HiddenReactionJudgment[] {
  const lower = stimulus.toLowerCase();
  return candidates.map((c) => {
    const keywords = c.revealCondition.split(/[,，、\s]+/).filter(Boolean);
    const triggered = keywords.some((kw) => kw.length > 0 && lower.includes(kw.toLowerCase()));
    return {
      id: c.id,
      triggered,
      reason: triggered ? "关键词匹配：stimulus 包含揭示条件中的相关词汇" : "关键词未匹配",
    };
  });
}

// ===========================================================================
// 主入口：秘密揭示判断
// ===========================================================================

/**
 * 对候选秘密进行推理判断。LLM 路径，失败时回退到关键词匹配。
 */
export async function judgeSecrets(
  input: RevealInput,
  candidates: SecretCandidate[],
): Promise<SlotJudgment[]> {
  if (candidates.length === 0) return [];

  try {
    const prompt = buildUserPrompt(input, candidates);
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

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock?.text ?? "";
    if (rawText.length === 0) {
      console.warn("[semantic-reveal] LLM 回复无文本内容，降级为关键词匹配");
      return keywordEvidenceFallback(candidates, input.evidence);
    }

    const llmJudgments = parseJudgmentResponse(rawText);
    const resultMap = new Map<string, SlotJudgment>();
    for (const j of llmJudgments) {
      resultMap.set(j.id, {
        id: j.id,
        verdict: j.verdict,
        assessment: j.assessment,
        reason: j.reason,
      });
    }

    return candidates.map(
      (c) =>
        resultMap.get(c.id) ?? {
          id: c.id,
          verdict: "unrelated",
          assessment: { claimRelevance: "unrelated", evidenceSupport: "absent" },
          reason: "LLM 未返回该候选的判断结果",
        },
    );
  } catch (e) {
    console.warn("[semantic-reveal] judgeSecrets LLM 调用失败，降级为关键词匹配:", e);
    return keywordEvidenceFallback(candidates, input.evidence);
  }
}

// ===========================================================================
// 隐藏反应判断（for private_resolve hidden-reaction）
// ===========================================================================

export interface HiddenReactionJudgment {
  id: string;
  triggered: boolean;
  reason: string;
}

const HIDDEN_REACTION_SYSTEM_PROMPT = `你是一个隐藏反应推理引擎。你的任务是判断玩家的言行（stimulus）是否触及了一个角色的隐藏秘密。

你需要判断 stimulus（玩家说了什么/做了什么）是否与某个隐藏秘密有语义关联。

判断原则：
- 只要 stimulus 与秘密的内容、主题、相关人物或事件有合理关联，即视为触发（triggered: true）
- 不需要确凿证据，只要有合理联想空间就算
- 排除泛泛：如果 stimulus 只是"他很奇怪"这种空泛描述，没有具体指向，不算触发
- 允许多种表达：同义词、比喻、婉转暗示都算

输出格式：纯 JSON 数组，不要包含任何其他文字。
每条：{"id": "秘密ID", "triggered": true/false, "reason": "简要说明判断理由"}`;

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
    lines.push(
      `  {"id": "${c.id}", "kind": "${c.kind}", "value": "${c.value}", "revealCondition": "${c.revealCondition}"}`,
    );
  }

  lines.push("");
  lines.push("对每个秘密判断是否被触及，并简要说明理由。只输出 JSON 数组，不要包含任何其他文字。");

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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const record = item as Record<string, unknown>;
    const id = record["id"];
    if (typeof id !== "string") throw new Error(`missing id`);
    return {
      id,
      triggered: Boolean(record["triggered"]),
      reason: typeof record["reason"] === "string" ? record["reason"] : "",
    };
  });
}

/**
 * 判断刺激是否触及角色的隐藏秘密。LLM 路径，失败时回退到关键词匹配。
 */
export async function judgeHiddenReaction(
  stimulus: string,
  publicContext: string,
  candidates: SecretCandidate[],
): Promise<HiddenReactionJudgment[]> {
  if (candidates.length === 0) return [];

  try {
    const prompt = buildHiddenReactionPrompt(stimulus, publicContext, candidates);
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
      console.warn("[semantic-reveal] hidden-reaction LLM 回复无文本内容，降级为关键词匹配");
      return keywordStimulusFallback(candidates, stimulus);
    }

    const llmJudgments = parseHiddenReactionResponse(rawText);
    const resultMap = new Map<string, HiddenReactionJudgment>();
    for (const j of llmJudgments) resultMap.set(j.id, j);

    return candidates.map(
      (c) => resultMap.get(c.id) ?? { id: c.id, triggered: false, reason: "无判断结果" },
    );
  } catch (e) {
    console.warn("[semantic-reveal] hidden-reaction LLM 调用失败，降级为关键词匹配:", e);
    return keywordStimulusFallback(candidates, stimulus);
  }
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

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const record = parsed as Record<string, unknown>;
  return {
    compatible: record["compatible"] === true,
  };
}

/**
 * 判断两个角色之间的隐藏秘密是否存在兼容性关联。LLM 路径，失败时安全降级。
 */
export async function judgeCompatibility(
  input: CompatibilityInput,
): Promise<CompatibilityJudgment> {
  if (input.secretsA.length === 0 || input.secretsB.length === 0) {
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
    console.warn("[semantic-reveal] judgeCompatibility LLM 调用失败，安全降级:", e);
    return { compatible: false };
  }
}
