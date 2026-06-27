/**
 * 结算侧确定性截断摘要（替代 LLM compaction）。
 *
 * 领域模型兑现后，旧轮次对话里唯一不可再生的信息只剩「事件顺序索引」——
 * 持久事实全在 state（每轮全量注入），结算器的旧推理过程丢弃无损。
 * 所以 compaction 不再花钱请 LLM 总结：从每轮 submit_direction_packet
 * 的参数机械提取一行摘要，零成本、零漂移、字节稳定。
 */

import { isRecord } from "../core/utils/typebox-validation.ts";
import { PROSE_CUSTOM_TYPE, SUBMIT_DIRECTION_PACKET_TOOL } from "./render-turn.ts";

/** 摘要行总数上限（含上次摘要折叠进来的行）。 */
const MAX_DIGEST_LINES = 80;
const PLAYER_INPUT_EXCERPT_CHARS = 30;

const SUMMARY_HEADER = [
  "[结算上下文截断摘要｜机械生成]",
  "本摘要只是事件顺序索引。一切当前事实（角色、伤势、资源、悬念、义务、时钟）以注入的 state 为准，不要从本摘要推断状态。",
  "",
].join("\n");

/**
 * 从被压缩的消息里提取每轮一行的事件索引，并折叠上次摘要的旧行。
 * 完全确定性：同样的输入永远产出同样的摘要。
 */
export function buildSettlementCompactionSummary(
  messages: ReadonlyArray<unknown>,
  previousSummary: string | undefined,
): string {
  const lines = [...previousDigestLines(previousSummary), ...extractTurnLines(messages)];
  const kept = lines.slice(-MAX_DIGEST_LINES);
  const dropped = lines.length - kept.length;
  const sections = [SUMMARY_HEADER];
  if (dropped > 0) {
    sections.push(`（更早的 ${dropped} 轮索引已丢弃；如需历史事实查 state 的 turnLog/memory）`);
  }
  sections.push(...kept);
  return sections.join("\n");
}

function extractTurnLines(messages: ReadonlyArray<unknown>): string[] {
  const lines: string[] = [];
  let currentInputs: string[] = [];
  let pendingProseExcerpt: string | undefined;
  for (const message of messages) {
    const userText = playerInputText(message);
    if (userText !== undefined) {
      currentInputs.push(userText);
      continue;
    }
    const prose = proseMessageText(message);
    if (prose !== undefined) {
      pendingProseExcerpt = excerpt(prose, PROSE_EXCERPT_CHARS);
      continue;
    }
    const args = submitPacketArgs(message);
    if (args !== undefined) {
      lines.push(formatTurnLine(currentInputs, args, pendingProseExcerpt));
      currentInputs = [];
      pendingProseExcerpt = undefined;
    }
  }
  return lines;
}

const PROSE_EXCERPT_CHARS = 60;

function formatTurnLine(
  inputs: readonly string[],
  args: Record<string, unknown>,
  proseExcerpt?: string,
): string {
  const input = excerpt(inputs.join(" / "), PLAYER_INPUT_EXCERPT_CHARS);
  if (args["needsRender"] === false) {
    return `- 玩家「${input}」｜meta/OOC 轮，直接作答`;
  }
  const playerAction =
    typeof args["playerAction"] === "string" ? args["playerAction"] : "（未知行动）";
  const changes = Array.isArray(args["resolvedChanges"])
    ? args["resolvedChanges"].filter((entry): entry is string => typeof entry === "string")
    : [];
  const changeText = changes.length > 0 ? `→ ${changes.join("；")}` : "";
  const proseText = proseExcerpt !== undefined ? ` ▸ 正文：${proseExcerpt}` : "";
  return `- 玩家「${input}」｜${playerAction}${changeText}${proseText}`;
}

function proseMessageText(message: unknown): string | undefined {
  if (!isRecord(message) || message["role"] !== "custom") return undefined;
  if (message["customType"] !== PROSE_CUSTOM_TYPE) return undefined;
  const content = message["content"];
  if (typeof content === "string") return content.trim() === "" ? undefined : content;
  return undefined;
}

/** 上次摘要里的索引行（"- " 开头）原样折叠进来，保持跨多次 compaction 的连续性。 */
function previousDigestLines(previousSummary: string | undefined): string[] {
  if (previousSummary === undefined) return [];
  return previousSummary.split("\n").filter((line) => line.startsWith("- "));
}

function excerpt(text: string, maxChars: number): string {
  const collapsed = text.replaceAll(/\s+/g, " ").trim();
  if (collapsed.length <= maxChars) return collapsed === "" ? "（无输入）" : collapsed;
  return `${collapsed.slice(0, maxChars)}…`;
}

function playerInputText(message: unknown): string | undefined {
  if (!isRecord(message) || message["role"] !== "user") return undefined;
  const content = message["content"];
  if (typeof content === "string") return content.trim() === "" ? undefined : content;
  if (!Array.isArray(content)) return undefined;
  const text = content
    .filter(
      (part): part is { type: "text"; text: string } =>
        isRecord(part) && part["type"] === "text" && typeof part["text"] === "string",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
  return text === "" ? undefined : text;
}

function submitPacketArgs(message: unknown): Record<string, unknown> | undefined {
  if (!isRecord(message) || message["role"] !== "assistant") return undefined;
  const content = message["content"];
  if (!Array.isArray(content)) return undefined;
  for (const part of content) {
    if (
      isRecord(part) &&
      part["type"] === "toolCall" &&
      part["name"] === SUBMIT_DIRECTION_PACKET_TOOL &&
      isRecord(part["arguments"])
    ) {
      return part["arguments"];
    }
  }
  return undefined;
}
