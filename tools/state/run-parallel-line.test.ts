import assert from "node:assert/strict";
import test from "node:test";

import {
  setBackstageDirectorSpawnerForTest,
  type BackstageDirectorHandle,
} from "../../engine/core/backstage/backstage-spawn.ts";
import { getState, resetState } from "../../engine/core/state/state-store.ts";

import { runParallelLineTool } from "./run-parallel-line.ts";

/** Capture the engine-direct spawn without launching a real `pi` process. */
function captureSpawn(): { calls: Array<{ prompt: string; runId: string }> } {
  const calls: Array<{ prompt: string; runId: string }> = [];
  setBackstageDirectorSpawnerForTest((prompt, runId): BackstageDirectorHandle => {
    calls.push({ prompt, runId });
    return { runId, pid: 4242, model: "deepseek-v4-pro", sessionDir: ".pi/agent/backstage-sessions" };
  });
  return { calls };
}

void test("runParallelLineTool engine-forks the async director (no main-loop spawn)", () => {
  resetState();
  const { calls } = captureSpawn();
  try {
    const result = runParallelLineTool(
      {
        lineId: "caster-ryudou",
        timeWindow: {
          start: "2004-01-30T21:00:00.000Z",
          end: "2004-01-30T23:00:00.000Z",
        },
      },
      undefined,
    );

    // the engine fired the director itself, exactly once
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.runId, "bl-caster-ryudou");
    assert.match(calls[0]?.prompt ?? "", /"lineId": "caster-ryudou"/);

    const text = result.content[0]?.text ?? "";
    assert.match(text, /异步起飞/);
    assert.match(text, /run_id=bl-caster-ryudou/);
    assert.match(text, /harvest_backstage_candidate/);
    // GM is no longer asked to spawn anything
    assert.doesNotMatch(text, /请【异步 spawn】/);
    assert.doesNotMatch(text, /agentScope/);

    assert.equal(result.details["runId"], "bl-caster-ryudou");
    assert.equal(result.details["pid"], 4242);
    const prompt = result.details["directorPrompt"];
    assert.ok(typeof prompt === "string" && prompt.includes("caster-ryudou"));

    // a pending-harvest marker is persisted so a forgotten harvest is dunned + guarded
    const pending = getState().secrets.backstagePendingHarvests;
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.runId, "bl-caster-ryudou");
    assert.equal(pending[0]?.lineId, "caster-ryudou");
  } finally {
    setBackstageDirectorSpawnerForTest(null);
  }
});

void test("runParallelLineTool rejects missing lineId", () => {
  resetState();

  assert.throws(
    () =>
      runParallelLineTool(
        {
          timeWindow: { start: "2004-01-30T21:00:00.000Z", end: "2004-01-30T23:00:00.000Z" },
        },
        undefined,
      ),
    /lineId 必须是非空字符串/,
  );
});

void test("runParallelLineTool rejects missing timeWindow", () => {
  resetState();

  assert.throws(
    () => runParallelLineTool({ lineId: "test" }, undefined),
    /timeWindow 必须是.*对象/,
  );
});
