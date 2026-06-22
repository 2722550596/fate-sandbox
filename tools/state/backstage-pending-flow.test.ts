import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  setBackstageDirectorSpawnerForTest,
  type BackstageDirectorHandle,
} from "../../engine/core/backstage-spawn.ts";
import { getState, resetState } from "../../engine/core/state-store.ts";

import { commitTurnTool } from "./commit-turn.ts";
import { harvestBackstageCandidateTool } from "./harvest-backstage-candidate.ts";
import { recordOffscreenEventTool } from "./record-offscreen-event.ts";
import { resolveBackstageLineTool } from "./resolve-backstage-line.ts";
import { runParallelLineTool } from "./run-parallel-line.ts";

const BIG_TIME = { kind: "elapsed", elapsedMinutes: 45, reason: "守夜数小时。" };
const MIN_TIME = { kind: "elapsed", elapsedMinutes: 1, reason: "推进一个最小时间单位。" };

function noopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}

function stubSpawner(): void {
  setBackstageDirectorSpawnerForTest(
    (_prompt, runId): BackstageDirectorHandle => ({
      runId,
      pid: 4242,
      model: "deepseek-v4-pro",
      sessionDir: ".pi/agent/backstage-sessions",
    }),
  );
}

function candidate(lineId: string, outcome: string): Record<string, unknown> {
  return {
    lineId,
    timelineId: "fsn",
    actorIds: [lineId],
    timeRange: { start: "2004-02-03T22:10:00.000Z", end: "2004-02-04T01:00:00.000Z" },
    outcome,
    privateSummary: "Quiet offscreen motion.",
    secretStateChanges: outcome === "no-change" ? [] : ["a field widened"],
    publicLeakCandidates: outcome === "no-change" ? [] : ["unusual fatigue reported"],
    futureHooks: [],
    toneDriftRisk: "none",
    genreFitNotes: ["fits FSN"],
    riskFlags: [],
    optionalNarrativeSnippet: null,
  };
}

function writeSession(dir: string, runId: string, candidateObj: Record<string, unknown>): void {
  const lines = [
    JSON.stringify({ type: "session", id: "s1" }),
    JSON.stringify({
      type: "message",
      id: "a1",
      message: {
        role: "assistant",
        content: [{ type: "text", text: JSON.stringify(candidateObj) }],
      },
    }),
  ];
  writeFileSync(join(dir, `2026-06-22T07-42-09-399Z_${runId}.jsonl`), lines.join("\n") + "\n");
}

function spawnLine(lineId: string): void {
  runParallelLineTool(
    { lineId, timeWindow: { start: "2004-01-30T21:00:00.000Z", end: "2004-01-30T23:00:00.000Z" } },
    noopSessionManager(),
  );
}

void test("run_parallel_line persists a pending-harvest marker", () => {
  resetState();
  stubSpawner();
  try {
    spawnLine("caster-ryudou");
    const pending = getState().secrets.backstagePendingHarvests;
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.runId, "bl-caster-ryudou");
  } finally {
    setBackstageDirectorSpawnerForTest(null);
  }
});

void test("resolve_backstage_line REFUSES while an unharvested run is pending, then works after harvest", () => {
  resetState();
  stubSpawner();
  const dir = mkdtempSync(join(tmpdir(), "fsn-pending-flow-"));
  try {
    // raise an obligation so resolve has something to settle once unblocked
    commitTurnTool({ summary: "守夜。", time: BIG_TIME, events: [] }, noopSessionManager());
    spawnLine("caster-ryudou");

    // footgun guard: cannot discard the produced candidate via no-change
    assert.throws(
      () =>
        resolveBackstageLineTool(
          { outcome: "no-change", reasonCode: "advanced-recently", note: "x。" },
          noopSessionManager(),
        ),
      /拒绝 resolve_backstage_line/,
    );

    // harvest retrieves + reviews → clears the pending marker
    writeSession(dir, "bl-caster-ryudou", candidate("caster-ryudou", "no-change"));
    harvestBackstageCandidateTool({ run_id: "bl-caster-ryudou" }, noopSessionManager(), dir);
    assert.equal(getState().secrets.backstagePendingHarvests.length, 0);

    // now a reviewed no-change resolve is allowed
    resolveBackstageLineTool(
      { outcome: "no-change", reasonCode: "advanced-recently", note: "审查后确无推进。" },
      noopSessionManager(),
    );
    assert.equal(getState().secrets.backstageObligations.length, 0);
  } finally {
    setBackstageDirectorSpawnerForTest(null);
  }
});

void test("record_offscreen_event clears the pending marker for its line", () => {
  resetState();
  stubSpawner();
  try {
    commitTurnTool({ summary: "守夜。", time: BIG_TIME, events: [] }, noopSessionManager());
    spawnLine("caster-ryudou");
    assert.equal(getState().secrets.backstagePendingHarvests.length, 1);

    const now = getState().public.clock.currentAt;
    recordOffscreenEventTool(
      {
        lineId: "caster-ryudou",
        actorIds: ["caster-ryudou"],
        timeRange: { start: now, end: now },
        visibility: "secret",
        summary: "Caster 抽取微量魔力。",
        consequences: ["结界外扩。"],
        futureHooks: ["明夜加速。"],
        createdFrom: "parallel-line-subagent",
        pressureType: "servant-autonomy",
      },
      noopSessionManager(),
    );

    assert.equal(getState().secrets.backstagePendingHarvests.length, 0);
    assert.equal(getState().secrets.backstageObligations.length, 0);
  } finally {
    setBackstageDirectorSpawnerForTest(null);
  }
});

void test("commit_turn surfaces a pending-harvest reminder in its return", () => {
  resetState();
  stubSpawner();
  try {
    spawnLine("caster-ryudou");
    const result = commitTurnTool({ summary: "继续。", time: MIN_TIME, events: [] }, noopSessionManager());
    assert.match(result.content[0]?.text ?? "", /待 harvest/);
    assert.match(result.content[0]?.text ?? "", /bl-caster-ryudou/);
  } finally {
    setBackstageDirectorSpawnerForTest(null);
  }
});
