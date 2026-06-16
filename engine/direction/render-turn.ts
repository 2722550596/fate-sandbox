import type { LintFinding } from "../audit/lint-rules.ts";
import type { DirectionPacket } from "./packet-schema.ts";

import {
  findSecretLeaks,
  lintFinalProse,
  lintProseLength,
  minimumProseUnits,
  proseLengthContextFromPacket,
} from "../audit/lint-rules.ts";
import { isRecord } from "../core/typebox-validation.ts";
import { resolveCanonicalCharacterName } from "../world-data/character-name.ts";
import { parseDirectionPacket } from "./packet-schema.ts";

/** 渲染产物落 session 的 customType；结算投影按它过滤，渲染史按它装配。 */
export const PROSE_CUSTOM_TYPE = "fsn-prose";
export const SUBMIT_DIRECTION_PACKET_TOOL = "submit_direction_packet";

/**
 * 散文史分层窗口（缓存友好：高低水位滞回，边界只在跨过高水位时
 * 按步长跳动，绝大多数轮次历史前缀字节级不变，provider 前缀缓存可逐轮命中）。
 *
 * - 全文层：最近 FULL_LOW..FULL_HIGH 轮的完整正文，语感连续性载体。
 * - 摘要层：更早轮次每轮一行，从该轮 direction packet 提取（零 LLM 成本）。
 */
const FULL_TURNS_HIGH = 16;
const FULL_TURNS_LOW = 10;
/** 全文层字符预算；heavy 轮堆积时按步长提前把旧转降级进摘要层。 */
const FULL_LAYER_CHAR_BUDGET = 45_000;
const DIGEST_TURNS_HIGH = 32;
const DIGEST_TURNS_LOW = 16;

export interface PendingDirectionPacket {
  packet: DirectionPacket;
  /** 提交该 packet 的 toolCall id，供扩展层去重（防竞态下双重渲染）。 */
  toolCallId: string;
}

/**
 * 从 agent loop 的消息流中找出「已提交、尚未渲染」的 direction packet。
 * 从尾部回扫：先遇到 prose 消息说明本轮已渲染过（或无新 packet），返回 undefined。
 */
export function findPendingDirectionPacket(
  messages: ReadonlyArray<unknown>,
): PendingDirectionPacket | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (isProseMessage(message)) {
      return undefined;
    }
    const call = findSubmitPacketCall(message);
    if (call !== undefined) {
      return {
        packet: parseDirectionPacket(call.args, "direction packet"),
        toolCallId: call.toolCallId,
      };
    }
  }
  return undefined;
}

/** 渲染器输入消息：扩展层映射成 pi-ai 消息后走 stream()。 */
export interface RendererMessage {
  role: "user" | "assistant";
  text: string;
}

interface RenderedTurn {
  /** 绝对轮号（1 起）；永不重编，保证摘要行字节稳定 */
  turn: number;
  playerInput: string;
  prose: string;
  digest: string;
}

/** writer 产出的高质量摘要，按 submit_direction_packet 的 toolCallId 索引。 */
export type ProseDigestOverrides = ReadonlyMap<string, string>;

/**
 * 装配渲染器（Pass B）输入：append-only 的多消息对话形。
 *
 * [user 摘要层?] + (user 玩家输入 / assistant 旧正文) \xd7 全文层
 * + user(本轮输入 + packet)。旧正文放 assistant 位：前缀逐轮可缓存，
 * 且模型把它们当「自己写的」，文风延续更自然。
 */
export function buildRendererMessages(
  messages: ReadonlyArray<unknown>,
  packet: DirectionPacket,
  digestOverrides?: ProseDigestOverrides,
): RendererMessage[] {
  const { turns, currentInputs } = collectRenderedTurns(messages, digestOverrides);
  const fullStart = resolveFullLayerStart(turns);
  const digestStart = hysteresisStart(fullStart, DIGEST_TURNS_HIGH, DIGEST_TURNS_LOW);

  const result: RendererMessage[] = [];
  const digestTurns = turns.slice(digestStart, fullStart);
  if (digestTurns.length > 0) {
    result.push({
      role: "user",
      text: [
        "# Early Turn Digest (event continuity reference only)",
        "",
        ...digestTurns.map((turn) => turn.digest),
      ].join("\n"),
    });
  }
  for (const turn of turns.slice(fullStart)) {
    result.push({ role: "user", text: turn.playerInput });
    result.push({ role: "assistant", text: turn.prose });
  }

  const currentPlayerInput =
    currentInputs.length > 0
      ? currentInputs.join("\n\n")
      : "(No current player input was captured. Use packet.playerAction only.)";
  const finalSections: string[] = ["# Current Player Input", "", currentPlayerInput, ""];
  finalSections.push(...buildNameContinuitySection(packet));
  finalSections.push(
    "# Direction Packet",
    "",
    "```json",
    JSON.stringify(packet, null, 2),
    "```",
    "",
    ...buildLengthFloorSection(packet),
    "Render this turn under the system-prompt contract. First turn # Current Player Input into in-scene action or speech, then render consequences under the Direction Packet constraints. Output only Chinese body prose.",
  );
  result.push({ role: "user", text: finalSections.join("\n") });
  return result;
}

function buildNameContinuitySection(packet: DirectionPacket): string[] {
  if (!packet.needsRender) {
    return [];
  }
  const entries: string[] = [];
  const seen = new Set<string>();
  for (const displayName of actorDisplayNamesFromPacket(packet)) {
    if (seen.has(displayName)) {
      continue;
    }
    seen.add(displayName);
    const canonicalName = resolveCanonicalCharacterName(displayName);
    if (canonicalName !== undefined && canonicalName !== displayName) {
      entries.push(`- ${displayName} -> ${canonicalName}`);
    }
  }
  if (entries.length === 0) {
    return [];
  }
  return [
    "# Canonical Name Lock (binding)",
    "",
    "When rendering Chinese prose, use these canonical Chinese names exactly. Do not transliterate, translate, or invent homophones.",
    ...entries,
    "",
  ];
}

function actorDisplayNamesFromPacket(packet: DirectionPacket): string[] {
  if (!packet.needsRender) {
    return [];
  }
  return [
    ...packet.canonFacts.flatMap(extractDisplayNamesFromText),
    packet.playerAction,
    ...packet.resolvedChanges,
    ...packet.npcStances.flatMap((stance) => [stance.stance, stance.wants, stance.refusesToSay]),
    ...packet.sensoryAnchors,
    packet.endWindow,
  ].flatMap(extractDisplayNamesFromText);
}

const DISPLAY_NAME_PATTERN = /\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+\b/gu;

function extractDisplayNamesFromText(text: string): string[] {
  return Array.from(text.matchAll(DISPLAY_NAME_PATTERN), (match) => match[0] ?? "");
}

function buildLengthFloorSection(packet: DirectionPacket): string[] {
  const context = proseLengthContextFromPacket(packet);
  if (context === undefined) {
    return [];
  }
  const minimum = minimumProseUnits(context);
  return [
    "# Render Length Floor (linted)",
    "",
    `Minimum readable units for this turn: ${minimum} 字.`,
    `Lint context: eventWeight=${context.eventWeight}; resolvedChanges=${context.resolvedChangeCount}; npcStances=${context.npcStanceCount}.`,
    "This floor is checked before and after the lint retry. Count CJK characters and Latin/number words; punctuation, headings, labels, XML, and Markdown do not help.",
    "Meet the floor by unfolding real process: player action, every resolvedChange, NPC reaction or silence, body cost, space or object change, and endWindow pressure. Do not pad, summarize, or repeat.",
    "",
  ];
}

function collectRenderedTurns(
  messages: ReadonlyArray<unknown>,
  digestOverrides?: ProseDigestOverrides,
): {
  turns: RenderedTurn[];
  currentInputs: string[];
} {
  const turns: RenderedTurn[] = [];
  let currentInputs: string[] = [];
  let pendingPacket: { args: Record<string, unknown>; toolCallId: string } | undefined;
  for (const message of messages) {
    const call = findSubmitPacketCall(message);
    if (call !== undefined) {
      pendingPacket = call;
    }
    if (isProseMessage(message)) {
      const turn = turns.length + 1;
      const writerDigest =
        pendingPacket === undefined ? undefined : digestOverrides?.get(pendingPacket.toolCallId);
      turns.push({
        turn,
        playerInput: currentInputs.join("\n\n") || "(No player input captured for this turn.)",
        prose: customMessageText(message),
        digest:
          writerDigest !== undefined
            ? `Turn ${turn}: ${writerDigest}`
            : buildTurnDigest(turn, pendingPacket?.args),
      });
      currentInputs = [];
      pendingPacket = undefined;
      continue;
    }
    const userText = playerInputText(message);
    if (userText !== undefined) {
      currentInputs.push(userText);
    }
  }
  return { turns, currentInputs };
}

/**
 * 从该轮 packet 参数提取一行摘要；旧 packet 不重新验证，防御式读取。
 * 格式刻意避开箭头/分号的报告体：摘要层是渲染器上下文的第一段文本，
 * 机械调性会污染整轮文风（见 06-12 反模式回归复盘）。
 */
function buildTurnDigest(turn: number, args: Record<string, unknown> | undefined): string {
  const playerAction =
    typeof args?.["playerAction"] === "string" ? args["playerAction"] : "（未知行动）";
  const changes = Array.isArray(args?.["resolvedChanges"])
    ? args["resolvedChanges"].filter((entry): entry is string => typeof entry === "string")
    : [];
  const changeText = changes.length > 0 ? `。${changes.join("，")}` : "";
  return `Turn ${turn}: ${playerAction}${changeText}`;
}

/**
 * 滞回起点：total ≤ high 时全部保留；超出后边界按 step=high-low 对齐跳动，
 * 窗口在 (low, high] 间振荡，每 step 轮才作废一次前缀。
 */
function hysteresisStart(total: number, high: number, low: number): number {
  if (total <= high) return 0;
  const step = high - low;
  return Math.ceil((total - high) / step) * step;
}

/** 全文层起点：轮数滞回 + 字符预算（超预算时按同一步长继续前移）。 */
function resolveFullLayerStart(turns: readonly RenderedTurn[]): number {
  const step = FULL_TURNS_HIGH - FULL_TURNS_LOW;
  let start = hysteresisStart(turns.length, FULL_TURNS_HIGH, FULL_TURNS_LOW);
  while (
    turns.length - start > FULL_TURNS_LOW &&
    totalProseChars(turns, start) > FULL_LAYER_CHAR_BUDGET
  ) {
    start = Math.min(start + step, turns.length - FULL_TURNS_LOW);
  }
  return start;
}

function totalProseChars(turns: readonly RenderedTurn[], start: number): number {
  return turns.slice(start).reduce((chars, turn) => chars + turn.prose.length, 0);
}

export interface ProseLintReport {
  findings: LintFinding[];
  /** block 级（未揭示秘密泄漏）命中 */
  leaks: LintFinding[];
}

export function lintRenderedProse(
  prose: string,
  unrevealedSecrets: readonly string[],
  packet?: DirectionPacket,
): ProseLintReport {
  const leaks = findSecretLeaks(prose, unrevealedSecrets);
  const lengthContext = proseLengthContextFromPacket(packet);
  const lengthFindings = lengthContext === undefined ? [] : lintProseLength(prose, lengthContext);
  return { findings: [...lintFinalProse(prose), ...lengthFindings, ...leaks], leaks };
}

/** 终防线：重试后仍泄漏时遮蔽秘密字符串，保证正文可发而秘密不可读。 */
export function redactSecrets(prose: string, secrets: readonly string[]): string {
  let redacted = prose;
  for (const secret of secrets) {
    if (secret.length === 0) {
      continue;
    }
    redacted = redacted.replaceAll(secret, "▮".repeat(Math.min(secret.length, 4)));
  }
  return redacted;
}

/** 重试输入：原消息序列 + 首稿（assistant 位） + 违规清单；前缀与首次调用完全一致，缓存可复用。 */
export function buildLintRetryMessages(
  baseMessages: readonly RendererMessage[],
  firstProse: string,
  findings: readonly LintFinding[],
): RendererMessage[] {
  const rewriteInstruction = findings.some((finding) => finding.ruleId === "underlength-prose")
    ? "保持事件与对白语义不变，但补足必要过程与篇幅：把玩家行动、每条已结算变化、NPC 反应、空间或物件变化、结尾风险锚写到页面上。不要用空镜、复述、报告句或废话填字数。"
    : "保持事件、对白语义与篇幅不变。";
  return [
    ...baseMessages,
    { role: "assistant", text: firstProse },
    {
      role: "user",
      text: [
        "你刚才的产出违反了以下输出契约条目，请重写全文修正：",
        ...findings.map((finding) => `- [${finding.ruleId}] ${finding.match}`),
        "",
        rewriteInstruction,
        "只输出修正后的正文。",
      ].join("\n"),
    },
  ];
}

function isProseMessage(message: unknown): message is Record<string, unknown> {
  return isRecord(message) && message["customType"] === PROSE_CUSTOM_TYPE;
}

function customMessageText(message: Record<string, unknown>): string {
  const content = message["content"];
  if (typeof content === "string") {
    return content;
  }
  return joinTextParts(content);
}

/** 玩家输入：user 消息的文本部分；非 user（assistant/toolResult/bash 等）返回 undefined。 */
function playerInputText(message: unknown): string | undefined {
  if (!isRecord(message) || message["role"] !== "user") {
    return undefined;
  }
  const content = message["content"];
  const text = (typeof content === "string" ? content : joinTextParts(content)).trim();
  if (text.length === 0 || isInjectedPromptText(text)) {
    return undefined;
  }
  return text;
}

const INJECTED_PROMPT_HEADERS = [
  "settlement_principles",
  "world_context",
  "input_guide",
  "social_guide",
  "tool_policy",
  "hard_rules",
  "story_driver",
  "mechanical_state",
  "prose_continuity",
  "turn_reminder",
  "direction_contract",
] as const;

function isInjectedPromptText(text: string): boolean {
  const match = /^<([a-z][a-z0-9_-]*)>\n[\s\S]*\n<\/\1>$/u.exec(text.trim());
  const header = match?.[1];
  return header !== undefined && INJECTED_PROMPT_HEADERS.some((value) => value === header);
}

function joinTextParts(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        isRecord(part) && part["type"] === "text" && typeof part["text"] === "string",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function findSubmitPacketCall(
  message: unknown,
): { args: Record<string, unknown>; toolCallId: string } | undefined {
  if (!isRecord(message) || message["role"] !== "assistant") {
    return undefined;
  }
  const content = message["content"];
  if (!Array.isArray(content)) {
    return undefined;
  }
  for (let index = content.length - 1; index >= 0; index--) {
    const part: unknown = content[index];
    if (
      isRecord(part) &&
      part["type"] === "toolCall" &&
      part["name"] === SUBMIT_DIRECTION_PACKET_TOOL &&
      isRecord(part["arguments"])
    ) {
      const id = part["id"];
      return {
        args: part["arguments"],
        toolCallId: typeof id === "string" ? id : "unknown-tool-call",
      };
    }
  }
  return undefined;
}
