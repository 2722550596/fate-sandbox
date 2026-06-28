import assert from "node:assert/strict";
import test from "node:test";

import { resetState } from "../../core/state/state-store.ts";
import { updateHookTool } from "./update-hook.ts";

function noopSessionManager(): unknown {
  return { appendCustomEntry: () => "entry-test" };
}

function openHook(label: string, sm: unknown): { text: string; hookId: string } {
  const result = updateHookTool({ kind: "open", label }, sm);
  const text = result.content[0]?.text ?? "";
  const hookId = text.match(/hook-\d+/)?.at(0) ?? "";
  return { text, hookId };
}

void test("updateHookTool opens a new hook", () => {
  resetState();

  const result = updateHookTool(
    { kind: "open", label: "廷根市教堂的秘密仪式" },
    noopSessionManager(),
  );

  assert.match(result.content[0]?.text ?? "", /悬念已登记并激活/);
  assert.match(result.content[0]?.text ?? "", /廷根市教堂的秘密仪式/);
});

void test("updateHookTool surfaces an existing hook", () => {
  resetState();
  const sm = noopSessionManager();
  const { hookId } = openHook("神秘的符号", sm);

  const result = updateHookTool({ kind: "surface", hookId, novelty: "符号再次出现" }, sm);

  assert.match(result.content[0]?.text ?? "", /悬念已复现/);
  assert.match(result.content[0]?.text ?? "", /神秘/);
});

void test("updateHookTool parks an active hook", () => {
  resetState();
  const sm = noopSessionManager();
  const { hookId } = openHook("跟踪者的身份", sm);

  const result = updateHookTool({ kind: "park", hookId, reason: "玩家选择绕道" }, sm);

  assert.match(result.content[0]?.text ?? "", /悬念已搁置/);
});

void test("updateHookTool escalates a hook", () => {
  resetState();
  const sm = noopSessionManager();
  const { hookId } = openHook("失踪的非凡者", sm);

  const result = updateHookTool({ kind: "escalate", hookId, novelty: "发现第3名失踪者" }, sm);

  assert.match(result.content[0]?.text ?? "", /悬念已升级/);
});

void test("updateHookTool pays a hook", () => {
  resetState();
  const sm = noopSessionManager();
  const { hookId } = openHook("生意的秘密", sm);

  const result = updateHookTool({ kind: "pay", hookId, payoff: "确认该商人是观众途径" }, sm);

  assert.match(result.content[0]?.text ?? "", /悬念已兑现/);
});

void test("updateHookTool retires a hook", () => {
  resetState();
  const sm = noopSessionManager();
  const { hookId } = openHook("废弃工厂的秘密", sm);

  const result = updateHookTool({ kind: "retire", hookId, reason: "线索链中断" }, sm);

  assert.match(result.content[0]?.text ?? "", /悬念已退场/);
});

void test("updateHookTool rejects invalid kind", () => {
  resetState();

  assert.throws(() => updateHookTool({ kind: "unknown" }, noopSessionManager()), /不支持的 kind/);
});
