import assert from "node:assert/strict";
import test from "node:test";

import { compareFateRanks, assertFateRank } from "./fate-rank";

void test("Fate rank comparison treats two main ranks as overwhelming", () => {
  const result = compareFateRanks("A", "C");

  assert.equal(result.mainRankDelta, 2);
  assert.equal(result.band, "overwhelming");
});

void test("Fate rank comparison treats plus-minus as same-tier edge", () => {
  const result = compareFateRanks("B+", "B-");

  assert.equal(result.mainRankDelta, 0);
  assert.equal(result.modifierDelta, 2);
  assert.equal(result.band, "edge");
});

void test("Fate rank validation rejects invalid rank grammar", () => {
  assert.throws(() => assertFateRank("S", "rank"), /非法 Fate rank/);
});
