import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/initial-state.ts";
import {
  assertNoUnharvestedPending,
  clearPendingHarvestByLine,
  clearPendingHarvestByRun,
  formatPendingHarvestReminder,
  recordPendingHarvest,
} from "./backstage-pending.ts";

void test("recordPendingHarvest adds a marker and is idempotent per runId", () => {
  const draft = createInitialState();
  recordPendingHarvest(draft, { runId: "bl-a", lineId: "line-a" });
  recordPendingHarvest(draft, { runId: "bl-a", lineId: "line-a-renamed" });
  assert.equal(draft.secrets.backstagePendingHarvests.length, 1);
  assert.equal(draft.secrets.backstagePendingHarvests[0]?.lineId, "line-a-renamed");
});

void test("clearPendingHarvestByRun removes only the matching run", () => {
  const draft = createInitialState();
  recordPendingHarvest(draft, { runId: "bl-a", lineId: "line-a" });
  recordPendingHarvest(draft, { runId: "bl-b", lineId: "line-b" });
  assert.equal(clearPendingHarvestByRun(draft, "bl-a"), true);
  assert.equal(clearPendingHarvestByRun(draft, "bl-missing"), false);
  assert.deepEqual(
    draft.secrets.backstagePendingHarvests.map((entry) => entry.runId),
    ["bl-b"],
  );
});

void test("clearPendingHarvestByLine removes every run for that line", () => {
  const draft = createInitialState();
  recordPendingHarvest(draft, { runId: "bl-a1", lineId: "line-a" });
  recordPendingHarvest(draft, { runId: "bl-a2", lineId: "line-a" });
  recordPendingHarvest(draft, { runId: "bl-b", lineId: "line-b" });
  assert.equal(clearPendingHarvestByLine(draft, "line-a"), 2);
  assert.deepEqual(
    draft.secrets.backstagePendingHarvests.map((entry) => entry.runId),
    ["bl-b"],
  );
});

void test("assertNoUnharvestedPending throws only while a marker exists", () => {
  const draft = createInitialState();
  assert.doesNotThrow(() => assertNoUnharvestedPending(draft));
  recordPendingHarvest(draft, { runId: "bl-a", lineId: "line-a" });
  assert.throws(() => assertNoUnharvestedPending(draft), /拒绝 resolve_backstage_line/);
});

void test("formatPendingHarvestReminder is null when empty, lists runs otherwise", () => {
  const draft = createInitialState();
  assert.equal(formatPendingHarvestReminder(draft), null);
  recordPendingHarvest(draft, { runId: "bl-a", lineId: "line-a" });
  assert.match(formatPendingHarvestReminder(draft) ?? "", /bl-a/);
});
