/**
 * /fuck 快速回退 — 废弃分支物理删除
 *
 * SessionManager 的公开 API 是 append-only 的（条目不可修改/删除），
 * 这里走文件级修剪：重写 JSONL 去掉废弃子树，再用公开的 setSessionFile()
 * 重载并用 branch()/resetLeaf() 恢复 leaf 指针。全程只用公开方法。
 *
 * 仅在 session 已持久化到磁盘时执行；未持久化时跳过（此时磁盘上本来就
 * 没有需要删除的垃圾，内存中的废弃条目只在「首条 GM 回复尚未出现」的
 * 极早期存在，无实际回退意义）。
 */

import type { SessionManager } from "@earendil-works/pi-coding-agent";

import { existsSync, writeFileSync } from "node:fs";

import { isRecord } from "../../engine/core/utils/typebox-validation.ts";
import { collectSubtreeIds } from "./rollback.ts";

/** 修剪需要的只读访问面（ctx.sessionManager 的只读视图可直接赋值）。 */
type SessionReadAccess = Pick<SessionManager, "getSessionFile" | "getHeader" | "getEntries">;

/** ctx.sessionManager 类型上是只读视图；物理修剪需要的可写方法在运行时存在。 */
interface PruneCapabilities {
  isPersisted(): boolean;
  setSessionFile(sessionFile: string): void;
  branch(branchFromId: string): void;
  resetLeaf(): void;
}

type PrunableSessionManager = SessionReadAccess & PruneCapabilities;

export function pruneAbandonedSubtree(
  sessionManager: SessionReadAccess,
  doomedRootId: string,
  newLeafId: string | null,
): boolean {
  if (!hasPruneCapabilities(sessionManager)) {
    return false;
  }
  const file = sessionManager.getSessionFile();
  if (!sessionManager.isPersisted() || file === undefined || !existsSync(file)) {
    return false;
  }
  const header = sessionManager.getHeader();
  if (header === null) {
    return false;
  }

  const entries = sessionManager.getEntries();
  const doomed = collectSubtreeIds(entries, doomedRootId);
  const surviving = entries.filter((entry) => !doomed.has(entry.id));

  const lines = [header as unknown, ...surviving].map((entry) => JSON.stringify(entry));
  writeFileSync(file, `${lines.join("\n")}\n`);

  // 重载文件重建索引（leaf 会被重置到文件末条），再显式恢复到回退点。
  sessionManager.setSessionFile(file);
  if (newLeafId === null) {
    sessionManager.resetLeaf();
  } else {
    sessionManager.branch(newLeafId);
  }
  return true;
}

function hasPruneCapabilities(
  sessionManager: SessionReadAccess,
): sessionManager is PrunableSessionManager {
  const raw: unknown = sessionManager;
  return (
    isRecord(raw) &&
    typeof raw["isPersisted"] === "function" &&
    typeof raw["setSessionFile"] === "function" &&
    typeof raw["branch"] === "function" &&
    typeof raw["resetLeaf"] === "function"
  );
}
