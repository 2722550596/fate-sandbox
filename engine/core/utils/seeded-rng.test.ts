import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../state/state-store.ts";
import { generateSeed, seededRandomFloat, seededRandomInt } from "./seeded-rng.ts";

void test("seededRandomInt is deterministic for same seed and counter", () => {
  const state1 = createInitialState();
  const state2 = createInitialState();
  // Force same seed
  state1.meta.rngSeed = 42;
  state1.meta.rngCounter = 0;
  state2.meta.rngSeed = 42;
  state2.meta.rngCounter = 0;

  const results1: number[] = [];
  const results2: number[] = [];
  for (let i = 0; i < 20; i++) {
    results1.push(seededRandomInt(state1, 100));
    results2.push(seededRandomInt(state2, 100));
  }

  assert.deepEqual(results1, results2);
  assert.equal(state1.meta.rngCounter, 20);
  assert.equal(state2.meta.rngCounter, 20);
});

void test("seededRandomInt increments counter", () => {
  const state = createInitialState();
  state.meta.rngSeed = 42;
  state.meta.rngCounter = 0;

  seededRandomInt(state, 100);
  assert.equal(state.meta.rngCounter, 1);
  seededRandomInt(state, 100);
  assert.equal(state.meta.rngCounter, 2);
});

void test("seededRandomInt produces values in [0, bound)", () => {
  const state = createInitialState();
  state.meta.rngSeed = 12345;
  state.meta.rngCounter = 0;

  for (let i = 0; i < 100; i++) {
    const value = seededRandomInt(state, 10);
    assert.ok(value >= 0 && value < 10, `value ${value} out of range`);
  }
});

void test("seededRandomInt rejects non-positive bound", () => {
  const state = createInitialState();
  assert.throws(() => seededRandomInt(state, 0), /正整数/);
  assert.throws(() => seededRandomInt(state, -1), /正整数/);
  assert.throws(() => seededRandomInt(state, 1.5), /正整数/);
});

void test("different seeds produce different sequences", () => {
  const state1 = createInitialState();
  const state2 = createInitialState();
  state1.meta.rngSeed = 1;
  state1.meta.rngCounter = 0;
  state2.meta.rngSeed = 2;
  state2.meta.rngCounter = 0;

  const results1: number[] = [];
  const results2: number[] = [];
  for (let i = 0; i < 10; i++) {
    results1.push(seededRandomInt(state1, 1000));
    results2.push(seededRandomInt(state2, 1000));
  }

  // Extremely unlikely to be all equal
  assert.notDeepEqual(results1, results2);
});

void test("seededRandomFloat produces values in [0, 1)", () => {
  const state = createInitialState();
  state.meta.rngSeed = 99;
  state.meta.rngCounter = 0;

  for (let i = 0; i < 100; i++) {
    const value = seededRandomFloat(state);
    assert.ok(value >= 0 && value < 1, `value ${value} out of range`);
  }
});

void test("generateSeed produces a number", () => {
  const seed = generateSeed();
  assert.equal(typeof seed, "number");
  assert.ok(Number.isFinite(seed));
});

void test("counter fast-forward produces correct sequence", () => {
  const state1 = createInitialState();
  state1.meta.rngSeed = 42;
  state1.meta.rngCounter = 0;

  // Consume 5 values
  for (let i = 0; i < 5; i++) {
    seededRandomInt(state1, 100);
  }
  const afterSkip = seededRandomInt(state1, 100);

  // Start fresh at counter=5
  const state2 = createInitialState();
  state2.meta.rngSeed = 42;
  state2.meta.rngCounter = 5;
  const directSkip = seededRandomInt(state2, 100);

  assert.equal(afterSkip, directSkip);
});
