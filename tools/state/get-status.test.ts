import type { SessionEntry } from "@earendil-works/pi-coding-agent";

import assert from "node:assert/strict";
import test from "node:test";

import { resetState } from "../../engine/core/state-store.ts";
import { sessionKey } from "../../engine/core/state-persistence.ts";
import { commitTurnTool } from "./commit-turn.ts";
import { getStatusTool } from "./get-status.ts";

void test("getStatusTool rejects repeated reads of an unchanged session state", () => {
  resetState();
  const sessionManager = createMockSessionManager();

  const first = getStatusTool(sessionManager);
  assert.match(first.content[0]?.text ?? "", /当前 GM 简报/);

  assert.throws(
    () => getStatusTool(sessionManager),
    /状态未变化/,
  );

  commitTurnTool(
    {
      summary: "推进一个最小时间单位。",
      time: { kind: "elapsed", elapsedMinutes: 1, reason: "测试状态变化。" },
      events: [],
    },
    sessionManager,
  );

  const afterChange = getStatusTool(sessionManager);
  assert.match(afterChange.content[0]?.text ?? "", /当前 GM 简报/);
});

interface MockSessionManager {
  entries: SessionEntry[];
  appendCustomEntry(customType: string, data?: unknown): string;
  getBranch(): readonly SessionEntry[];
}

function createMockSessionManager(): MockSessionManager {
  return {
    entries: [],
    appendCustomEntry(customType: string, data?: unknown): string {
      const entryId = `entry-${this.entries.length + 1}`;
      this.entries.push({
        type: "custom",
        id: entryId,
        parentId: null,
        timestamp: "2004-01-30T07:00:00.000Z",
        customType,
        data,
      });
      return entryId;
    },
    getBranch(): readonly SessionEntry[] {
      return this.entries.filter((entry) => entry.type !== "custom" || entry.customType === sessionKey());
    },
  };
}
