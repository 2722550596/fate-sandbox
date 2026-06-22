import assert from "node:assert/strict";
import test from "node:test";

import { buildBackstageGmBrief } from "./backstage-brief.ts";
import { recordPendingHarvest } from "./backstage-pending.ts";
import { createInitialState } from "./state-store.ts";

void test("empty ledgers produce a calm idle brief", () => {
  const brief = buildBackstageGmBrief(createInitialState());
  assert.match(brief, /无未清义务/);
  assert.match(brief, /run_parallel_line/);
});

void test("pending runs are listed with their run_id and line", () => {
  const state = createInitialState();
  recordPendingHarvest(state, { runId: "bl-caster-ryudou", lineId: "caster-ryudou" });
  const brief = buildBackstageGmBrief(state);
  assert.match(brief, /待 harvest/);
  assert.match(brief, /bl-caster-ryudou/);
  assert.match(brief, /harvest_backstage_candidate/);
});

void test("open obligations are surfaced with the hard-block warning", () => {
  const state = createInitialState();
  state.secrets.backstageObligations.push({
    id: "ob-1",
    trigger: "no-cost-streak",
    summary: "连续 2 个 no-cost 回合：推进一条后台平行线。",
    createdAt: state.public.clock.currentAt,
  });
  const brief = buildBackstageGmBrief(state);
  assert.match(brief, /未清后台义务 1 条/);
  assert.match(brief, /硬阻断/);
});

void test("no-cost streak nearing the threshold raises an early pressure warning", () => {
  const state = createInitialState();
  state.secrets.backstagePressure.consecutiveNoCostTurns = 1;
  const brief = buildBackstageGmBrief(state);
  assert.match(brief, /后台压力/);
  assert.match(brief, /阈值 2/);
});
