import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { isRecord } from "../core/utils/typebox-validation.ts";

/**
 * Writer 化散文摘要缓存（backlog #13，MiMo checkpoint-writer 思路）。
 *
 * 渲染摘要层默认从 direction packet 机械提取（零 LLM、rewind 安全）。
 * 本 store 缓存独立 writer 产出的更高质量单行摘要（事件 + 关系/态度变化），
 * 按 submit_direction_packet 的 toolCallId 索引：
 * - rewind/分叉后查不到的轮次自动回退机械摘要，永不阻塞渲染；
 * - single-writer 不变量：只有渲染扩展的 digest writer 调 saveProseDigest，
 *   渲染装配只读。
 */

const DEFAULT_PATH = "state/prose-digests.json";
/** 条目上限；超出时按插入顺序淘汰最旧（旧轮次早已滑出摘要窗口）。 */
const MAX_ENTRIES = 500;

export function loadProseDigests(path = DEFAULT_PATH): Map<string, string> {
  if (!existsSync(path)) {
    return new Map();
  }
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf-8"));
    if (!isRecord(raw) || raw["version"] !== 1 || !isRecord(raw["digests"])) {
      return new Map();
    }
    const digests = new Map<string, string>();
    for (const [key, value] of Object.entries(raw["digests"])) {
      if (typeof value === "string" && value.trim().length > 0) {
        digests.set(key, value.trim());
      }
    }
    return digests;
  } catch {
    // 损坏的缓存不值得让渲染失败：当作空缓存，writer 下次会重建。
    return new Map();
  }
}

export function saveProseDigest(toolCallId: string, digest: string, path = DEFAULT_PATH): void {
  const trimmed = digest.trim().replaceAll("\n", " ");
  if (toolCallId.length === 0 || trimmed.length === 0) {
    return;
  }
  const digests = loadProseDigests(path);
  digests.delete(toolCallId);
  digests.set(toolCallId, trimmed);
  while (digests.size > MAX_ENTRIES) {
    const oldest = digests.keys().next().value;
    if (oldest === undefined) break;
    digests.delete(oldest);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify({ version: 1, digests: Object.fromEntries(digests) }, null, 2)}\n`,
    "utf-8",
  );
}
