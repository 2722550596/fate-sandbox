import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ToolResult } from "../runtime/tool-result.ts";

import { resetState } from "../../engine/core/state-store.ts";

import { harvestBackstageCandidateTool } from "./harvest-backstage-candidate.ts";

function textOf(result: ToolResult): string {
  return result.content.map((part) => part.text).join("\n");
}

function noopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}

const VALID_CANDIDATE = {
  lineId: "caster-ryudou",
  timelineId: "fsn",
  actorIds: ["caster-ryudou"],
  timeRange: { start: "2004-02-03T22:10:00.000Z", end: "2004-02-04T01:00:00.000Z" },
  outcome: "progress",
  privateSummary: "Caster siphons a trickle of prana from sleeping households.",
  secretStateChanges: ["bounded field widened toward foothills"],
  publicLeakCandidates: ["townsfolk report unusual fatigue"],
  futureHooks: ["harvest accelerates next night"],
  toneDriftRisk: "none",
  genreFitNotes: ["quiet escalation fits FSN"],
  riskFlags: [],
  optionalNarrativeSnippet: null,
};

/** Write a director session jsonl whose final assistant message carries `rawText`. */
function writeSession(
  dir: string,
  runId: string,
  rawText: string,
  timestamp = "2026-06-22T07-42-09-399Z",
): void {
  const lines = [
    JSON.stringify({ type: "session", id: "s1" }),
    JSON.stringify({
      type: "message",
      id: "u1",
      message: { role: "user", content: [{ type: "text", text: "director prompt" }] },
    }),
    JSON.stringify({
      type: "message",
      id: "a1",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "deciding the candidate" },
          { type: "text", text: rawText },
        ],
      },
    }),
  ];
  writeFileSync(join(dir, `${timestamp}_${runId}.jsonl`), lines.join("\n") + "\n");
}

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), "fsn-harvest-"));
}

void test("harvest reads a run by run_id and guides record_offscreen_event for progress", () => {
  const dir = freshDir();
  writeSession(dir, "bl-caster-ryudou", JSON.stringify(VALID_CANDIDATE));

  resetState();
  const result = harvestBackstageCandidateTool({ run_id: "bl-caster-ryudou" }, noopSessionManager(), dir);
  const candidate = result.details["candidate"] as { outcome?: string } | undefined;
  assert.equal(candidate?.outcome, "progress");
  assert.equal(result.details["runId"], "bl-caster-ryudou");
  assert.match(textOf(result), /record_offscreen_event/);
  assert.match(textOf(result), /caster-ryudou/);
});

void test("harvest tolerates leading/trailing noise around the JSON", () => {
  const dir = freshDir();
  const raw = "Here is the candidate:\n```json\n" + JSON.stringify(VALID_CANDIDATE) + "\n```\nDone.";
  writeSession(dir, "bl-caster-ryudou", raw);

  resetState();
  const result = harvestBackstageCandidateTool({ run_id: "bl-caster-ryudou" }, noopSessionManager(), dir);
  const candidate = result.details["candidate"] as { lineId?: string } | undefined;
  assert.equal(candidate?.lineId, "caster-ryudou");
});

void test("harvest picks the NEWEST session when a run was re-spawned", () => {
  const dir = freshDir();
  writeSession(dir, "bl-x", JSON.stringify({ ...VALID_CANDIDATE, outcome: "no-change" }), "2026-06-22T07-00-00-000Z");
  writeSession(dir, "bl-x", JSON.stringify({ ...VALID_CANDIDATE, outcome: "progress" }), "2026-06-22T09-30-00-000Z");

  resetState();
  const result = harvestBackstageCandidateTool({ run_id: "bl-x" }, noopSessionManager(), dir);
  const candidate = result.details["candidate"] as { outcome?: string } | undefined;
  assert.equal(candidate?.outcome, "progress");
});

void test("harvest routes no-change/blocked toward resolve_backstage_line", () => {
  const dir = freshDir();
  writeSession(dir, "bl-caster-ryudou", JSON.stringify({ ...VALID_CANDIDATE, outcome: "no-change" }));

  resetState();
  const result = harvestBackstageCandidateTool({ run_id: "bl-caster-ryudou" }, noopSessionManager(), dir);
  assert.match(textOf(result), /resolve_backstage_line/);
});

void test("harvest rejects a malformed candidate (structure firewall)", () => {
  resetState();
  const dir = freshDir();
  writeSession(dir, "bl-bad", "not json at all");
  assert.throws(() => harvestBackstageCandidateTool({ run_id: "bl-bad" }, noopSessionManager(), dir));

  const dir2 = freshDir();
  writeSession(dir2, "bl-partial", JSON.stringify({ lineId: "x", outcome: "progress" }));
  assert.throws(() => harvestBackstageCandidateTool({ run_id: "bl-partial" }, noopSessionManager(), dir2));
});

void test("harvest requires a non-empty run_id", () => {
  resetState();
  const dir = freshDir();
  assert.throws(() => harvestBackstageCandidateTool({}, noopSessionManager(), dir));
  assert.throws(() => harvestBackstageCandidateTool({ run_id: "" }, noopSessionManager(), dir));
});

void test("harvest reports a clear error when the run is not found", () => {
  resetState();
  const dir = freshDir();
  assert.throws(
    () => harvestBackstageCandidateTool({ run_id: "bl-missing" }, noopSessionManager(), dir),
    /找不到 run_id=bl-missing/,
  );
});
