/**
 * Backstage director session read-back (engine-owned harvest retrieval — ADR 0005).
 *
 * The engine forks the director (backstage-spawn.ts); the child writes its
 * candidate to a durable session jsonl at
 * `<sessionDir>/<ISO-timestamp>_<runId>.jsonl`. This module closes the loop on the
 * READ side: given a runId, locate the run's newest session file and extract the
 * last assistant text part (the bare candidate JSON). No pi-actors / `inspect`:
 * the engine owns both spawn and harvest retrieval, symmetric per ADR 0005.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isRecord } from "../utils/typebox-validation.ts";
import { BACKSTAGE_SESSION_DIR } from "./backstage-substrate-config.ts";

/**
 * Pure: extract the last assistant text part from a director session jsonl body.
 * Each line is one session entry; the candidate lives in the final
 * `type:"message"` / `role:"assistant"` entry's `content[]` `type:"text"` part
 * (a sibling `thinking` part is skipped). Throws when no assistant text exists
 * yet (director not finished).
 */
export function extractLastAssistantText(jsonl: string): string {
  const lines = jsonl.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = (lines[i] ?? "").trim();
    if (line === "") {
      continue;
    }
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // tolerate a partially-flushed trailing line
    }
    if (!isRecord(entry) || entry["type"] !== "message") {
      continue;
    }
    const message = entry["message"];
    if (!isRecord(message) || message["role"] !== "assistant") {
      continue;
    }
    const content = message["content"];
    if (!Array.isArray(content)) {
      continue;
    }
    const text = content
      .filter((part): part is Record<string, unknown> => isRecord(part) && part["type"] === "text")
      .map((part) => (typeof part["text"] === "string" ? part["text"] : ""))
      .join("");
    if (text.trim() !== "") {
      return text;
    }
  }
  throw new Error("后台 director session 里还没有 assistant 候选（导演可能尚未跑完，稍后重试）。");
}

/**
 * Locate the newest session jsonl for a run and return its bare candidate text.
 * Files are named `<ISO-timestamp>_<runId>.jsonl`, so the ISO prefix sorts
 * chronologically — the lexicographically last match is the newest run.
 */
export function readBackstageCandidateRaw(
  runId: string,
  sessionDir: string = BACKSTAGE_SESSION_DIR,
): string {
  let files: string[];
  try {
    files = readdirSync(sessionDir);
  } catch {
    throw new Error(`后台 session 目录不存在：${sessionDir}（run_parallel_line 起过导演吗？）。`);
  }
  const suffix = `_${runId}.jsonl`;
  const matches = files.filter((name) => name.endsWith(suffix)).toSorted();
  const newest = matches.length > 0 ? matches[matches.length - 1] : undefined;
  if (newest === undefined) {
    throw new Error(`找不到 run_id=${runId} 的后台 director session（未起飞，或 run_id 拼错）。`);
  }
  return extractLastAssistantText(readFileSync(join(sessionDir, newest), "utf8"));
}
