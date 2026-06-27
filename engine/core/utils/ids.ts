import type { State } from "../state/state.ts";

import { assertNonEmptyString, isRecord } from "./typebox-validation.ts";

/**
 * 在给定 Game State draft 内分配确定性递增 ID。
 * 扫描 draft（含未提交实体）避让既有编号；同一 draft 内连续创建不会撞 ID。
 */
export function createId(draft: State, prefix: string): string {
  const idPrefix = assertNonEmptyString(prefix, "idPrefix");
  return `${idPrefix}-${highestExistingIdNumber(draft, idPrefix) + 1}`;
}

function highestExistingIdNumber(state: State, prefix: string): number {
  const marker = `${prefix}-`;
  let highest = 0;
  for (const id of collectIds(state)) {
    if (!id.startsWith(marker)) continue;
    const suffix = id.slice(marker.length);
    if (!/^\d+$/.test(suffix)) continue;
    highest = Math.max(highest, Number(suffix));
  }
  return highest;
}

function collectIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectIds(entry));
  }
  if (!isRecord(value)) {
    return [];
  }
  const ids: string[] = [];
  const id = value["id"];
  if (typeof id === "string") {
    ids.push(id);
  }
  for (const entry of Object.values(value)) {
    ids.push(...collectIds(entry));
  }
  return ids;
}
