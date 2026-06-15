import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Direction packet 契约在两处维护：
 * - agents/gm-direction.md（结算器：怎么写 packet）
 * - agents/system-render.md（渲染器：怎么读 packet）
 * 本测试锁住两份文件的共享语义，防止单边修改造成漂移。
 */

const direction = readFileSync("agents/gm-direction.md", "utf-8");
const renderSystem = readFileSync("agents/system-render.md", "utf-8");

const PACKET_FIELDS = [
  "playerAction",
  "resolvedChanges",
  "npcStances",
  "sensoryAnchors",
  "endWindow",
  "eventWeight",
  "canonFacts",
] as const;

void test("packet contract files describe the same field set", () => {
  for (const field of PACKET_FIELDS) {
    assert.match(direction, new RegExp(`\\b${field}\\b`, "u"), `gm-direction.md missing ${field}`);
    assert.match(
      renderSystem,
      new RegExp(`\\b${field}\\b`, "u"),
      `system-render.md missing ${field}`,
    );
  }
});

void test("packet contract files agree on eventWeight semantics", () => {
  // 三个档位在两侧都存在
  for (const weight of ["light", "normal", "heavy"]) {
    assert.match(
      direction,
      new RegExp(`\\b${weight}\\b`, "u"),
      `gm-direction.md missing ${weight}`,
    );
    assert.match(
      renderSystem,
      new RegExp(`\\b${weight}\\b`, "u"),
      `system-render.md missing ${weight}`,
    );
  }
  // 2026-06-12 横评后的语义：eventWeight 是完整度契约而非字数配额。
  // 结算侧不得重新引入字数指令（模型会据此撑字数）。
  assert.doesNotMatch(
    direction,
    /eventWeight[^\n]*\d{3,}/u,
    "gm-direction.md: eventWeight 不应携带字数阈值（completeness contract, not word quota）",
  );
  assert.match(
    renderSystem,
    /completeness contract, not a word quota/u,
    "system-render.md: eventWeight 必须声明完整度契约语义",
  );
  // 反 padding 条款必须在场
  assert.match(renderSystem, /padding[^\n]*worse failure than running short/u);
});

void test("packet contract files agree on binding fields", () => {
  for (const field of ["playerAction", "resolvedChanges", "endWindow"]) {
    const bindingPattern = new RegExp(`\`${field}\`[^\\n]*binding`, "u");
    assert.match(direction, bindingPattern, `gm-direction.md: ${field} must be marked binding`);
    assert.match(
      renderSystem,
      bindingPattern,
      `system-render.md: ${field} must be marked binding`,
    );
  }
});
