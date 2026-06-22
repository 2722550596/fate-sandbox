import assert from "node:assert/strict";
import test from "node:test";

import { resetState } from "../../engine/core/state-store.ts";

import { runParallelLineTool } from "./run-parallel-line.ts";

void test("runParallelLineTool emits async spawn instructions + full director prompt", () => {
  resetState();

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

  const text = result.content[0]?.text ?? "";
  // async spawn flow, not the retired sync subagent
  assert.match(text, /异步 spawn/);
  assert.match(text, /recipe=parallel_line/);
  assert.match(text, /model=deepseek-v4-pro/);
  assert.match(text, /session_dir=~\/\.pi\/agent\/backstage-sessions/);
  assert.match(text, /harvest_backstage_candidate/);
  assert.doesNotMatch(text, /agentScope/);
  // the full director prompt is embedded for the GM to pass to spawn
  assert.match(text, /DIRECTOR PROMPT/);
  assert.match(text, /"lineId": "caster-ryudou"/);

  const prompt = result.details["directorPrompt"];
  assert.ok(typeof prompt === "string" && prompt.includes("caster-ryudou"));
  assert.equal(result.details["recipe"], "parallel_line");
  assert.equal(result.details["runId"], "bl-caster-ryudou");
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
