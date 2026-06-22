import assert from "node:assert/strict";
import test from "node:test";

import type { ToolResult } from "../runtime/tool-result.ts";

import { harvestBackstageCandidateTool } from "./harvest-backstage-candidate.ts";

function textOf(result: ToolResult): string {
  return result.content.map((part) => part.text).join("\n");
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

void test("harvest validates a bare candidate and guides record_offscreen_event for progress", () => {
  const raw = JSON.stringify(VALID_CANDIDATE);
  const result = harvestBackstageCandidateTool({ raw });

  const candidate = result.details["candidate"] as { outcome?: string } | undefined;
  assert.equal(candidate?.outcome, "progress");
  assert.match(textOf(result), /record_offscreen_event/);
  assert.match(textOf(result), /caster-ryudou/);
});

void test("harvest tolerates leading/trailing noise around the JSON", () => {
  const raw = "Here is the candidate:\n```json\n" + JSON.stringify(VALID_CANDIDATE) + "\n```\nDone.";
  const result = harvestBackstageCandidateTool({ raw });
  const candidate = result.details["candidate"] as { lineId?: string } | undefined;
  assert.equal(candidate?.lineId, "caster-ryudou");
});

void test("harvest routes no-change/blocked toward resolve_backstage_line", () => {
  const raw = JSON.stringify({ ...VALID_CANDIDATE, outcome: "no-change" });
  const result = harvestBackstageCandidateTool({ raw });
  assert.match(textOf(result), /resolve_backstage_line/);
});

void test("harvest rejects malformed candidate (structure firewall)", () => {
  assert.throws(() => harvestBackstageCandidateTool({ raw: "not json at all" }));
  // missing required fields
  assert.throws(() =>
    harvestBackstageCandidateTool({ raw: JSON.stringify({ lineId: "x", outcome: "progress" }) }),
  );
});

void test("harvest requires a non-empty raw string", () => {
  assert.throws(() => harvestBackstageCandidateTool({}));
  assert.throws(() => harvestBackstageCandidateTool({ raw: "" }));
});
