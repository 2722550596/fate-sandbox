import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../engine/core/state-store.ts";
import {
  buildTimelineStateContextBlock,
  injectTimelineContextIntoSubagentInput,
} from "../extensions/subagents/timeline/task-injection.ts";

const BLOCK = "<timeline_state_context>\n{}\n</timeline_state_context>";

void test("single 模式给 timeline 子代理 task 追加上下文块", () => {
  const input: Record<string, unknown> = { agent: "timeline-showrunner", task: "推进教会线" };
  assert.equal(injectTimelineContextIntoSubagentInput(input, BLOCK), 1);
  assert.equal(input["task"], `推进教会线\n\n${BLOCK}`);
});

void test("single 模式支持 package 限定名与缺省 task", () => {
  const input: Record<string, unknown> = { agent: "fsn.timeline-showrunner" };
  assert.equal(injectTimelineContextIntoSubagentInput(input, BLOCK), 1);
  assert.equal(input["task"], BLOCK);
});

void test("非 timeline 子代理不被改写", () => {
  const input: Record<string, unknown> = { agent: "reviewer", task: "审一下" };
  assert.equal(injectTimelineContextIntoSubagentInput(input, BLOCK), 0);
  assert.equal(input["task"], "审一下");
});

void test("已包含上下文块的 task 幂等跳过", () => {
  const task = `输入\n\n${BLOCK}`;
  const input: Record<string, unknown> = { agent: "timeline-showrunner", task };
  assert.equal(injectTimelineContextIntoSubagentInput(input, BLOCK), 0);
  assert.equal(input["task"], task);
});

void test("parallel 模式只改写 tasks[] 里的 timeline 子代理", () => {
  const timelineEntry: Record<string, unknown> = { agent: "timeline-showrunner", task: "线 A" };
  const otherEntry: Record<string, unknown> = { agent: "oracle", task: "无关任务" };
  const input: Record<string, unknown> = { tasks: [timelineEntry, otherEntry] };
  assert.equal(injectTimelineContextIntoSubagentInput(input, BLOCK), 1);
  assert.equal(timelineEntry["task"], `线 A\n\n${BLOCK}`);
  assert.equal(otherEntry["task"], "无关任务");
});

void test("chain 模式覆盖顺序步骤、静态 parallel 与动态 parallel 模板", () => {
  const sequentialStep: Record<string, unknown> = {
    agent: "timeline-showrunner",
    task: "审计 {task}",
  };
  // 省略 task 的 chain 步骤默认 {previous}，注入后必须保住该语义
  const defaultTaskStep: Record<string, unknown> = { agent: "timeline-showrunner" };
  const staticTimelineEntry: Record<string, unknown> = { agent: "timeline-showrunner", task: "线 B" };
  const staticOtherEntry: Record<string, unknown> = { agent: "worker", task: "x" };
  const dynamicTemplate: Record<string, unknown> = { agent: "timeline-showrunner" };
  const input: Record<string, unknown> = {
    chain: [
      sequentialStep,
      defaultTaskStep,
      { parallel: [staticTimelineEntry, staticOtherEntry] },
      { expand: { from: { output: "o", path: "/items" } }, parallel: dynamicTemplate },
    ],
  };
  assert.equal(injectTimelineContextIntoSubagentInput(input, BLOCK), 4);
  assert.equal(sequentialStep["task"], `审计 {task}\n\n${BLOCK}`);
  assert.equal(defaultTaskStep["task"], `{previous}\n\n${BLOCK}`);
  assert.equal(staticTimelineEntry["task"], `线 B\n\n${BLOCK}`);
  assert.equal(staticOtherEntry["task"], "x");
  assert.equal(dynamicTemplate["task"], `{previous}\n\n${BLOCK}`);
});

void test("上下文块由当前 state 投影生成且不含 secrets 原文", () => {
  const block = buildTimelineStateContextBlock(createInitialState());
  assert.match(block, /^<timeline_state_context>\n/);
  assert.match(block, /<\/timeline_state_context>$/);
  assert.match(block, /"currentAtUtc": "2004-01-30T07:00:00\.000Z"/);
  assert.match(block, /由主 GM 进程在调用瞬间注入/);
  assert.doesNotMatch(block, /actorSecrets|secretEventLog|campaignSecrets/);
});
