/**
 * Seeded PRNG（backlog #9）。
 *
 * 确定性随机源：seed 进 state.meta，每次消耗推进 counter。
 * 结果可复现、可测试；rewind 后重放行为一致。
 *
 * 算法：xoshiro128** —— 快、周期长、统计质量好、纯 JS 无依赖。
 * seed → splitmix32 × 4 → xoshiro128** state。
 */

import type { State } from "../state/state.ts";

/**
 * 从 state.meta.rngSeed + rngCounter 生成下一个 [0, bound) 整数。
 * 副作用：推进 state.meta.rngCounter。
 */
export function seededRandomInt(state: State, bound: number): number {
  if (bound < 1 || !Number.isInteger(bound)) {
    throw new Error(`seededRandomInt bound 必须是正整数，收到 ${bound}。`);
  }
  const s = initXoshiro128ss(state.meta.rngSeed, state.meta.rngCounter);
  const raw = xoshiro128ss(s);
  state.meta.rngCounter += 1;
  return (raw >>> 0) % bound;
}

/**
 * 从 state 生成一个 [0, 1) 浮点数。副作用同上。
 */
export function seededRandomFloat(state: State): number {
  const s = initXoshiro128ss(state.meta.rngSeed, state.meta.rngCounter);
  const raw = xoshiro128ss(s);
  state.meta.rngCounter += 1;
  return (raw >>> 0) / 0x100000000;
}

/**
 * 生成一个新的随机 seed（不使用 state，用于初始化）。
 */
export function generateSeed(): number {
  // 用 crypto.getRandomValues 生成一个 32-bit seed
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues !== undefined) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0]!;
  }
  // fallback: Date + Math.random
  return (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
}

// ─── xoshiro128** implementation ─────────────────────────────────

interface Xoshiro128State {
  0: number;
  1: number;
  2: number;
  3: number;
}

/**
 * 从 seed + counter 初始化 xoshiro128** 内部状态。
 * 先用 splitmix32 从 seed 生成 4 × 32-bit 初始向量，
 * 再跳过 counter 步（通过快进）。
 */
function initXoshiro128ss(seed: number, counter: number): Xoshiro128State {
  // splitmix32 expander
  const z = seed >>> 0;
  const s0 = splitmix32Step(z);
  const s1 = splitmix32Step(s0.next);
  const s2 = splitmix32Step(s1.next);
  const s3 = splitmix32Step(s2.next);
  const s: Xoshiro128State = { 0: s0.value, 1: s1.value, 2: s2.value, 3: s3.value };
  // 快进到 counter 位置
  for (let i = 0; i < counter; i++) {
    xoshiro128ss(s);
  }
  return s;
}

/**
 * xoshiro128** 生成一个 32-bit 整数并推进状态。
 */
function xoshiro128ss(s: Xoshiro128State): number {
  const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9);
  const t = (s[1] << 9) >>> 0;
  s[2] = (s[2] ^ s[0]) >>> 0;
  s[3] = (s[3] ^ s[1]) >>> 0;
  s[1] = (s[1] ^ s[2]) >>> 0;
  s[0] = (s[0] ^ s[3]) >>> 0;
  s[2] = (s[2] ^ t) >>> 0;
  s[3] = rotl(s[3], 11);
  return result;
}

function splitmix32Step(z: number): { value: number; next: number } {
  const next = (z + 0x9e3779b9) | 0;
  let t = next ^ (next >>> 16);
  t = Math.imul(t, 0x21f0aaad);
  t = t ^ (t >>> 15);
  t = Math.imul(t, 0x735a2d97);
  t = t ^ (t >>> 15);
  return { value: t >>> 0, next };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}
