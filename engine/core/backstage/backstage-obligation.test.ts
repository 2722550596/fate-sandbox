import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/state-store.ts";
import {
  assertNoOpenBackstageObligation,
  recordCanonicalTurnForBackstage,
  settleOldestBackstageObligation,
} from "./backstage-obligation.ts";

void test("time advance >=30min raises a time-advance obligation", () => {
  const draft = createInitialState();
  const raised = recordCanonicalTurnForBackstage(draft, {
    elapsedMinutes: 45,
    hasCost: true,
    beatBoundary: false,
  });
  assert.equal(raised?.trigger, "time-advance");
  assert.equal(draft.secrets.backstageObligations.length, 1);
});

void test("beat completion raises a beat-complete obligation", () => {
  const draft = createInitialState();
  const raised = recordCanonicalTurnForBackstage(draft, {
    elapsedMinutes: 5,
    hasCost: true,
    beatBoundary: true,
  });
  assert.equal(raised?.trigger, "beat-complete");
});

void test("two consecutive no-cost turns raise a no-cost-streak obligation", () => {
  const draft = createInitialState();
  const first = recordCanonicalTurnForBackstage(draft, {
    elapsedMinutes: 5,
    hasCost: false,
    beatBoundary: false,
  });
  assert.equal(first, null);
  const second = recordCanonicalTurnForBackstage(draft, {
    elapsedMinutes: 5,
    hasCost: false,
    beatBoundary: false,
  });
  assert.equal(second?.trigger, "no-cost-streak");
});

void test("mechanical cost resets the no-cost streak", () => {
  const draft = createInitialState();
  recordCanonicalTurnForBackstage(draft, {
    elapsedMinutes: 5,
    hasCost: false,
    beatBoundary: false,
  });
  recordCanonicalTurnForBackstage(draft, { elapsedMinutes: 5, hasCost: true, beatBoundary: false });
  const third = recordCanonicalTurnForBackstage(draft, {
    elapsedMinutes: 5,
    hasCost: false,
    beatBoundary: false,
  });
  assert.equal(third, null);
  assert.equal(draft.secrets.backstageObligations.length, 0);
});

void test("does not stack a second obligation while one is open", () => {
  const draft = createInitialState();
  recordCanonicalTurnForBackstage(draft, {
    elapsedMinutes: 45,
    hasCost: true,
    beatBoundary: false,
  });
  const second = recordCanonicalTurnForBackstage(draft, {
    elapsedMinutes: 45,
    hasCost: true,
    beatBoundary: false,
  });
  assert.equal(second, null);
  assert.equal(draft.secrets.backstageObligations.length, 1);
});

void test("assertNoOpenBackstageObligation throws when one is open", () => {
  const draft = createInitialState();
  recordCanonicalTurnForBackstage(draft, {
    elapsedMinutes: 45,
    hasCost: true,
    beatBoundary: false,
  });
  assert.throws(() => assertNoOpenBackstageObligation(draft), /未清账的后台世界推进义务/);
});

void test("settleOldestBackstageObligation clears and logs a review entry", () => {
  const draft = createInitialState();
  recordCanonicalTurnForBackstage(draft, {
    elapsedMinutes: 45,
    hasCost: true,
    beatBoundary: false,
  });
  const settled = settleOldestBackstageObligation(draft, {
    outcome: "landed",
    reasonCode: "candidate-landed",
    note: "Caster 推进了结界。",
  });
  assert.ok(settled);
  assert.equal(draft.secrets.backstageObligations.length, 0);
  assert.equal(draft.secrets.backstageReviewLog.length, 1);
  assert.equal(draft.secrets.backstageReviewLog[0]?.outcome, "landed");
  assert.doesNotThrow(() => assertNoOpenBackstageObligation(draft));
});

void test("settleOldestBackstageObligation returns undefined when none open", () => {
  const draft = createInitialState();
  const settled = settleOldestBackstageObligation(draft, {
    outcome: "no-change",
    reasonCode: "advanced-recently",
    note: "无新进展。",
  });
  assert.equal(settled, undefined);
  assert.equal(draft.secrets.backstageReviewLog.length, 0);
});
