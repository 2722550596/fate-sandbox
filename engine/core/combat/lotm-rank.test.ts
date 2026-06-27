import type { SequenceRank } from "../state/state-enum-schemas.ts";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  compareLOTMRanks,
  lotmRankDelta,
  lotmRankSide,
  lotmRankValue,
  isLOTMRankHigher,
} from "./lotm-rank.ts";

void describe("RANK_POWER 等级序", () => {
  void test("等级越高 power value 越大", () => {
    const ranks: SequenceRank[] = [
      "ordinary",
      "seq-9",
      "seq-8",
      "seq-7",
      "seq-5",
      "seq-4",
      "seq-3",
      "seq-2",
      "seq-1",
      "seq-0",
      "old-one",
      "pillar",
    ];
    for (let i = 1; i < ranks.length; i++) {
      assert.ok(isLOTMRankHigher(ranks[i]!, ranks[i - 1]!), `${ranks[i]} 应高于 ${ranks[i - 1]}`);
    }
  });

  void test("ordinary 最弱，pillar 最强", () => {
    assert.equal(lotmRankValue("ordinary"), 0);
    assert.ok(lotmRankValue("pillar") > lotmRankValue("seq-0"));
  });
});

void describe("lotmRankDelta 级差", () => {
  void test("同层相邻级差 < 1", () => {
    const a = lotmRankDelta("seq-8", "seq-9"); // low 层内
    assert.ok(a > 0 && a < 1, `seq-8 vs seq-9 级差 ${a} 应 < 1`);

    const b = lotmRankDelta("seq-6", "seq-7"); // mid 层内
    assert.ok(b > 0 && b < 1, `seq-6 vs seq-7 级差 ${b} 应 < 1`);

    const c = lotmRankDelta("seq-3", "seq-4"); // saint 层内
    assert.ok(c > 0 && c < 1, `seq-3 vs seq-4 级差 ${c} 应 < 1`);

    const d = lotmRankDelta("seq-1", "seq-2"); // angel 层内
    assert.ok(d > 0 && d < 1, `seq-1 vs seq-2 级差 ${d} 应 < 1`);
  });

  void test("跨层相邻级差 ≥ 3", () => {
    const a = lotmRankDelta("seq-7", "seq-8"); // mid × low
    assert.ok(a >= 3, `seq-7 vs seq-8 级差 ${a} 应 ≥ 3`);

    const b = lotmRankDelta("seq-4", "seq-5"); // saint × mid
    assert.ok(b >= 3, `seq-4 vs seq-5 级差 ${b} 应 ≥ 3`);

    const c = lotmRankDelta("seq-2", "seq-3"); // angel × saint
    assert.ok(c >= 3, `seq-2 vs seq-3 级差 ${c} 应 ≥ 3`);

    const d = lotmRankDelta("seq-0", "seq-1"); // god × angel
    assert.ok(d >= 3, `seq-0 vs seq-1 级差 ${d} 应 ≥ 3`);

    const e = lotmRankDelta("old-one", "seq-0"); // old-one × god
    assert.ok(e >= 3, `old-one vs seq-0 级差 ${e} 应 ≥ 3`);

    const f = lotmRankDelta("pillar", "old-one"); // pillar × old-one
    assert.ok(f >= 3, `pillar vs old-one 级差 ${f} 应 ≥ 3`);
  });

  void test("跨两层必然秒杀级差（≥ 4）", () => {
    const a = lotmRankDelta("seq-5", "seq-8"); // mid bottom → low
    assert.ok(a >= 4, `seq-5 vs seq-8 级差 ${a} 应 ≥ 4`);

    const b = lotmRankDelta("seq-0", "seq-5"); // god → mid
    assert.ok(b >= 4, `seq-0 vs seq-5 级差 ${b} 应 ≥ 4`);
  });
});

void describe("lotmRankSide", () => {
  void test("每个等级都有 power value", () => {
    const ranks: SequenceRank[] = ["ordinary", "seq-9", "seq-5", "seq-0", "pillar"];
    for (const rank of ranks) {
      const side = lotmRankSide(rank);
      assert.equal(side.rank, rank);
      assert.equal(typeof side.index, "number");
      assert.equal(typeof side.baselineValue, "number");
    }
  });

  void test("高位者的 index 更大", () => {
    const high = lotmRankSide("pillar");
    const low = lotmRankSide("ordinary");
    assert.ok(high.index > low.index);
  });
});

void describe("compareLOTMRanks band", () => {
  void test("同级 → same-tier", () => {
    const r = compareLOTMRanks("seq-5", "seq-5");
    assert.equal(r.band, "same-tier");
    assert.equal(r.baselineTierDelta, 0);
  });

  void test("同层相邻 → edge", () => {
    const r = compareLOTMRanks("seq-8", "seq-9");
    assert.equal(r.band, "edge");
    assert.equal(r.baselineTierDelta, 0.5);
  });

  void test("actor 低一阶 → edge（负 delta）", () => {
    const r = compareLOTMRanks("seq-9", "seq-8");
    assert.equal(r.band, "edge");
    assert.equal(r.baselineTierDelta, -0.5);
  });

  void test("同层隔一级 → advantage", () => {
    const r = compareLOTMRanks("seq-5", "seq-7");
    assert.equal(r.band, "advantage");
    assert.ok(r.baselineTierDelta >= 1);
  });

  void test("跨层 → overwhelming", () => {
    const r = compareLOTMRanks("seq-7", "seq-8");
    assert.equal(r.band, "overwhelming");
    assert.equal(r.baselineTierDelta, 3);
  });

  void test("跨两层 → off-scale（秒杀）", () => {
    const r = compareLOTMRanks("seq-4", "seq-7");
    assert.equal(r.band, "off-scale");
    assert.ok(r.baselineTierDelta >= 4);
  });

  void test("ordinary vs seq-0 → off-scale", () => {
    const r = compareLOTMRanks("seq-0", "ordinary");
    assert.equal(r.band, "off-scale");
    assert.ok(r.baselineTierDelta >= 4);
  });

  void test("pillar vs ordinary → off-scale", () => {
    const r = compareLOTMRanks("pillar", "ordinary");
    assert.equal(r.band, "off-scale");
    assert.ok(r.baselineTierDelta >= 4);
  });

  void test("band 边界：delta=0.5 → edge", () => {
    assert.equal(compareLOTMRanks("seq-8", "seq-9").band, "edge");
  });
  void test("band 边界：delta=1 → advantage", () => {
    assert.equal(compareLOTMRanks("seq-8", "ordinary").band, "advantage");
  });
});
