/**
 * /fuck 快速回退 — 纯逻辑部分
 *
 * 在当前分支上定位倒数第 N 条用户输入，并计算以它为根的废弃子树。
 * 不触碰 SessionManager / 文件系统，方便单测。
 */

import type { SessionEntry } from "@earendil-works/pi-coding-agent";

import { isRecord } from "../../engine/core/utils/typebox-validation.ts";

/** 解析 /fuck 的参数：空串默认 1 步，其余必须是 >=1 的整数。 */
export function parseRollbackSteps(args: string): number | undefined {
  const trimmed = args.trim();
  if (trimmed === "") {
    return 1;
  }
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const steps = Number.parseInt(trimmed, 10);
  return steps >= 1 ? steps : undefined;
}

/** 在当前分支上从后往前找第 steps 条用户输入。 */
export function findRollbackTarget(
  branch: readonly SessionEntry[],
  steps: number,
): SessionEntry | undefined {
  let remaining = steps;
  for (let index = branch.length - 1; index >= 0; index--) {
    const entry = branch[index];
    if (entry !== undefined && isUserMessageEntry(entry)) {
      remaining -= 1;
      if (remaining === 0) {
        return entry;
      }
    }
  }
  return undefined;
}

/**
 * 计算以 rootId 为根的整棵子树的条目 id。
 * 条目按追加顺序排列、父节点必然先于子节点出现，单次遍历即可覆盖。
 */
export function collectSubtreeIds(entries: readonly SessionEntry[], rootId: string): Set<string> {
  const doomed = new Set<string>([rootId]);
  for (const entry of entries) {
    if (entry.parentId !== null && doomed.has(entry.parentId)) {
      doomed.add(entry.id);
    }
  }
  return doomed;
}

/** 从用户消息条目中提取可编辑的纯文本（用于回填输入框）。 */
export function extractUserMessageText(entry: SessionEntry): string {
  if (!isUserMessageEntry(entry)) {
    return "";
  }
  const content: unknown = entry.message.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  const texts: string[] = [];
  for (const part of content as unknown[]) {
    if (isRecord(part) && part["type"] === "text" && typeof part["text"] === "string") {
      texts.push(part["text"]);
    }
  }
  return texts.join("\n");
}

export function isUserMessageEntry(
  entry: SessionEntry,
): entry is SessionEntry & { type: "message"; message: { role: "user"; content: unknown } } {
  return entry.type === "message" && entry.message.role === "user";
}
