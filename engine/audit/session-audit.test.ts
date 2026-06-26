import assert from "node:assert/strict";
import test from "node:test";

import {
  auditSession,
  extractLatestSecrets,
  groupTurns,
  measureBackstageLedger,
  measureGetStatusUsage,
  measureLint,
  measureParallelLine,
  measurePressure,
  measureTimeCoverage,
  parseSessionJsonl,
  reconstructActivePath,
  renderAuditReport,
} from "./session-audit.ts";

// ---------- fixture 构造 ----------

interface ChainSpec {
  kind: "user" | "assistant" | "toolResult" | "state" | "prose";
  text?: string;
  toolCalls?: Array<{ id: string; name: string; args?: unknown }>;
  toolCallId?: string;
  isError?: boolean;
  secrets?: unknown;
}

/** 按线性链构造 session JSONL 文本，id 自动递增、parentId 自动连接 */
function buildJsonl(specs: readonly ChainSpec[]): string {
  const lines: string[] = [
    JSON.stringify({ type: "session", version: 3, id: "e0", timestamp: "t" }),
  ];
  let parent = "e0";
  specs.forEach((spec, i) => {
    const id = `e${i + 1}`;
    if (spec.kind === "state") {
      lines.push(
        JSON.stringify({
          type: "custom",
          customType: "fsn-state",
          id,
          parentId: parent,
          data: { v: 1, turn: i, state: { meta: {}, public: {}, secrets: spec.secrets ?? {} } },
        }),
      );
    } else if (spec.kind === "prose") {
      lines.push(
        JSON.stringify({
          type: "custom_message",
          customType: "fsn-prose",
          id,
          parentId: parent,
          content: spec.text ?? "",
          display: true,
        }),
      );
    } else if (spec.kind === "toolResult") {
      lines.push(
        JSON.stringify({
          type: "message",
          id,
          parentId: parent,
          message: {
            role: "toolResult",
            toolCallId: spec.toolCallId,
            isError: spec.isError ?? false,
            content: [],
          },
        }),
      );
    } else {
      const content: unknown[] = [];
      if (spec.text !== undefined) content.push({ type: "text", text: spec.text });
      for (const call of spec.toolCalls ?? []) {
        content.push({
          type: "toolCall",
          id: call.id,
          name: call.name,
          arguments: call.args ?? {},
        });
      }
      lines.push(
        JSON.stringify({
          type: "message",
          id,
          parentId: parent,
          message: { role: spec.kind, content },
        }),
      );
    }
    parent = id;
  });
  return lines.join("\n");
}

const ELAPSED_5 = { kind: "elapsed", elapsedMinutes: 5, reason: "对话" };
const ELAPSED_45 = { kind: "elapsed", elapsedMinutes: 45, reason: "休整" };

/** 一个普通轮：user → assistant(commit_turn) → result → assistant(正文) */
function plainTurn(
  callId: string,
  options: { time?: unknown; prose?: string; isError?: boolean } = {},
): ChainSpec[] {
  return [
    { kind: "user", text: "玩家行动" },
    {
      kind: "assistant",
      toolCalls: [{ id: callId, name: "commit_turn", args: { events: [], time: options.time } }],
    },
    { kind: "toolResult", toolCallId: callId, isError: options.isError ?? false },
    {
      kind: "assistant",
      text: options.prose ?? "她合上门，走廊重新陷入安静。脚步声停在第三级台阶。",
    },
  ];
}

/** 一个双 pass 轮：user → assistant(submit packet) → result → fsn-prose 渲染正文 */
function twoPassTurn(callId: string, prose: string): ChainSpec[] {
  return [
    { kind: "user", text: "玩家行动" },
    {
      kind: "assistant",
      text: "结算完成。",
      toolCalls: [{ id: callId, name: "submit_direction_packet", args: { needsRender: true } }],
    },
    { kind: "toolResult", toolCallId: callId },
    { kind: "prose", text: prose },
  ];
}

// ---------- 解析与路径重建 ----------

void test("parseSessionJsonl skips corrupted lines", () => {
  const content = `${JSON.stringify({ type: "session", id: "a" })}\nnot-json\n${JSON.stringify({ type: "message", id: "b", parentId: "a", message: { role: "user", content: [] } })}`;
  const entries = parseSessionJsonl(content);
  assert.equal(entries.length, 2);
});

void test("reconstructActivePath drops abandoned branches", () => {
  // e0 ← e1 ← e2(abandoned)；e1 ← e3 ← e4(leaf)
  const lines = [
    { type: "session", id: "e0" },
    { type: "message", id: "e1", parentId: "e0", message: { role: "user", content: [] } },
    { type: "message", id: "e2", parentId: "e1", message: { role: "assistant", content: [] } },
    { type: "message", id: "e3", parentId: "e1", message: { role: "assistant", content: [] } },
    { type: "message", id: "e4", parentId: "e3", message: { role: "user", content: [] } },
  ];
  const path = reconstructActivePath(
    parseSessionJsonl(lines.map((l) => JSON.stringify(l)).join("\n")),
  );
  assert.deepEqual(
    path.map((e) => e.id),
    ["e0", "e1", "e3", "e4"],
  );
});

void test("groupTurns maps tool results onto calls and tracks final prose", () => {
  const jsonl = buildJsonl([
    { kind: "user", text: "出发" },
    {
      kind: "assistant",
      text: "中间叙述。",
      toolCalls: [{ id: "c1", name: "commit_turn", args: { time: ELAPSED_5 } }],
    },
    { kind: "toolResult", toolCallId: "c1" },
    { kind: "assistant", text: "最终正文。" },
  ]);
  const turns = groupTurns(reconstructActivePath(parseSessionJsonl(jsonl)));
  assert.equal(turns.length, 1);
  const turn = turns[0];
  assert.ok(turn);
  assert.equal(turn.toolCalls.length, 1);
  assert.equal(turn.toolCalls[0]?.accepted, true);
  assert.equal(turn.finalProse, "最终正文。");
  assert.ok(turn.fullText.includes("中间叙述。"));
});

void test("groupTurns marks error results as not accepted", () => {
  const jsonl = buildJsonl(plainTurn("c1", { isError: true }));
  const turns = groupTurns(reconstructActivePath(parseSessionJsonl(jsonl)));
  assert.equal(turns[0]?.toolCalls[0]?.accepted, false);
});

// ---------- 指标 ----------

void test("measureTimeCoverage counts accepted canonical calls with top-level time", () => {
  const jsonl = buildJsonl([
    ...plainTurn("c1", { time: ELAPSED_5 }),
    ...plainTurn("c2", {}), // accepted but missing time
    ...plainTurn("c3", { time: ELAPSED_5, isError: true }), // rejected: not counted
  ]);
  const turns = groupTurns(reconstructActivePath(parseSessionJsonl(jsonl)));
  const tc = measureTimeCoverage(turns);
  assert.equal(tc.acceptedCanonicalCalls, 2);
  assert.equal(tc.acceptedWithTime, 1);
  assert.equal(tc.turnsWithCanonical, 2);
  assert.equal(tc.turnsCovered, 1);
  assert.deepEqual(tc.missingTimeTurns, [2]);
});

void test("measureGetStatusUsage flags repeat reads without state change", () => {
  const jsonl = buildJsonl([
    { kind: "user", text: "看状态" },
    { kind: "assistant", toolCalls: [{ id: "s1", name: "get_status" }] },
    { kind: "toolResult", toolCallId: "s1" },
    { kind: "assistant", toolCalls: [{ id: "s2", name: "get_status" }] }, // 冗余
    { kind: "toolResult", toolCallId: "s2" },
    {
      kind: "assistant",
      toolCalls: [{ id: "c1", name: "commit_turn", args: { time: ELAPSED_5 } }],
    },
    { kind: "toolResult", toolCallId: "c1" },
    { kind: "assistant", toolCalls: [{ id: "s3", name: "get_status" }] }, // 合法：state 已变
    { kind: "toolResult", toolCallId: "s3" },
    { kind: "assistant", text: "正文。" },
  ]);
  const usage = measureGetStatusUsage(groupTurns(reconstructActivePath(parseSessionJsonl(jsonl))));
  assert.equal(usage.calls, 3);
  assert.equal(usage.redundant, 1);
});

void test("measurePressure tracks no-cost streaks", () => {
  const costTurn: ChainSpec[] = [
    { kind: "user", text: "进攻" },
    { kind: "assistant", toolCalls: [{ id: "x1", name: "resolve_combat", args: {} }] },
    { kind: "toolResult", toolCallId: "x1" },
    { kind: "assistant", text: "正文。" },
  ];
  const jsonl = buildJsonl([
    ...plainTurn("c1", { time: ELAPSED_5 }),
    ...plainTurn("c2", { time: ELAPSED_5 }),
    ...costTurn,
    ...plainTurn("c3", { time: ELAPSED_5 }),
  ]);
  const pressure = measurePressure(groupTurns(reconstructActivePath(parseSessionJsonl(jsonl))));
  assert.equal(pressure.noCostTurns, 3);
  assert.equal(pressure.longestStreak, 2);
  assert.deepEqual(pressure.streaks, [2, 1]);
});

void test("add-threat scene event counts as cost", () => {
  const jsonl = buildJsonl([
    { kind: "user", text: "前进" },
    {
      kind: "assistant",
      toolCalls: [
        {
          id: "c1",
          name: "commit_turn",
          args: {
            time: ELAPSED_5,
            events: [{ kind: "update-scene", event: { kind: "add-threat", threatId: "t" } }],
          },
        },
      ],
    },
    { kind: "toolResult", toolCallId: "c1" },
    { kind: "assistant", text: "正文。" },
  ]);
  const pressure = measurePressure(groupTurns(reconstructActivePath(parseSessionJsonl(jsonl))));
  assert.equal(pressure.noCostTurns, 0);
});

void test("groupTurns takes fsn-prose custom message as final prose in two-pass sessions", () => {
  const turns = groupTurns(
    reconstructActivePath(
      parseSessionJsonl(
        buildJsonl([
          ...twoPassTurn("c1", "雨停了。她把伞收进门后的桶里。"),
          ...twoPassTurn("c2", "走廊尽头的灯还亮着。"),
        ]),
      ),
    ),
  );

  assert.equal(turns.length, 2);
  assert.equal(turns[0]?.finalProse, "雨停了。她把伞收进门后的桶里。");
  // 结算轮可见文本也进 fullText（泄密扫描覆盖），但最终正文是渲染产出
  assert.match(turns[0]?.fullText ?? "", /结算完成/);
  assert.equal(turns[1]?.finalProse, "走廊尽头的灯还亮着。");
});

void test("measureLint reports prose violations and secret leaks", () => {
  const secrets = {
    actorStates: {
      saber: {
        actorId: "saber",
        secrets: { trueName: { value: "两仪式", revealState: "hidden" }, hiddenNoblePhantasms: [] },
      },
    },
  };
  const jsonl = buildJsonl([
    { kind: "state", secrets },
    ...plainTurn("c1", { prose: "好的，以下是剧情。她说：你就是两仪式吧。" }),
  ]);
  const lint = measureLint(groupTurns(reconstructActivePath(parseSessionJsonl(jsonl))));
  assert.equal(lint.turnsWithFindings, 1);
  assert.ok((lint.findingsByRule["opening-delivery-wrapper"] ?? 0) >= 1);
  assert.equal(lint.blockFindings.length, 1);
  assert.equal(lint.blockFindings[0]?.finding.match, "两仪式");
});

void test("measureLint reports underlength two-pass prose from packet context", () => {
  const jsonl = buildJsonl([
    { kind: "user", text: "玩家行动" },
    {
      kind: "assistant",
      toolCalls: [
        {
          id: "p1",
          name: "submit_direction_packet",
          args: {
            needsRender: true,
            eventWeight: "normal",
            resolvedChanges: ["她抵达门前"],
            npcStances: [],
          },
        },
      ],
    },
    { kind: "toolResult", toolCallId: "p1" },
    { kind: "prose", text: "她抵达门前。" },
  ]);
  const lint = measureLint(groupTurns(reconstructActivePath(parseSessionJsonl(jsonl))));
  assert.equal(lint.findingsByRule["underlength-prose"], 1);
});

void test("measureLint uses latest secrets snapshot inside the turn", () => {
  const secrets = {
    actorStates: {
      a: { actorId: "a", secrets: { trueName: { value: "美狄亚", revealState: "hidden" } } },
    },
  };
  // 秘密在轮内才配置（state 快照出现在 toolResult 后）
  const jsonl = buildJsonl([
    { kind: "user", text: "行动" },
    { kind: "assistant", toolCalls: [{ id: "c1", name: "reveal_secret", args: {} }] },
    { kind: "toolResult", toolCallId: "c1" },
    { kind: "state", secrets },
    { kind: "assistant", text: "幕后，美狄亚冷笑。" },
  ]);
  const lint = measureLint(groupTurns(reconstructActivePath(parseSessionJsonl(jsonl))));
  assert.equal(lint.blockFindings.length, 1);
});

void test("measureParallelLine computes trigger hit ratio", () => {
  const parallelCall: ChainSpec[] = [
    {
      kind: "assistant",
      toolCalls: [{ id: "p1", name: "subagent", args: { agent: "parallel-line", task: "推进" } }],
    },
    { kind: "toolResult", toolCallId: "p1" },
  ];
  const jsonl = buildJsonl([
    // turn 1：45 分钟推进（触发）且调用了 parallel-line
    { kind: "user", text: "休整" },
    {
      kind: "assistant",
      toolCalls: [{ id: "c1", name: "commit_turn", args: { time: ELAPSED_45 } }],
    },
    { kind: "toolResult", toolCallId: "c1" },
    ...parallelCall,
    { kind: "assistant", text: "正文。" },
    // turn 2：45 分钟推进（触发）但未调用
    ...plainTurn("c2", { time: ELAPSED_45 }),
  ]);
  const turns = groupTurns(reconstructActivePath(parseSessionJsonl(jsonl)));
  const pl = measureParallelLine(turns);
  assert.equal(pl.calls, 1);
  assert.equal(pl.triggeredTurns, 2);
  assert.equal(pl.triggeredTurnsWithCall, 1);
});

void test("measureParallelLine detects the run_parallel_line engine-fork form", () => {
  const jsonl = buildJsonl([
    // turn 1: 45min advance (triggers) + run_parallel_line
    { kind: "user", text: "休整" },
    {
      kind: "assistant",
      toolCalls: [{ id: "c1", name: "commit_turn", args: { time: ELAPSED_45 } }],
    },
    { kind: "toolResult", toolCallId: "c1" },
    {
      kind: "assistant",
      toolCalls: [{ id: "p1", name: "run_parallel_line", args: { run_id: "bl-caster" } }],
    },
    { kind: "toolResult", toolCallId: "p1" },
    { kind: "assistant", text: "正文。" },
    // turn 2: 45min advance (triggers) + run_parallel_line
    { kind: "user", text: "过夜" },
    {
      kind: "assistant",
      toolCalls: [{ id: "c2", name: "commit_turn", args: { time: ELAPSED_45 } }],
    },
    { kind: "toolResult", toolCallId: "c2" },
    {
      kind: "assistant",
      toolCalls: [{ id: "p2", name: "run_parallel_line", args: { run_id: "bl-assassin" } }],
    },
    { kind: "toolResult", toolCallId: "p2" },
    { kind: "assistant", text: "正文。" },
  ]);
  const turns = groupTurns(reconstructActivePath(parseSessionJsonl(jsonl)));
  const pl = measureParallelLine(turns);
  assert.equal(pl.calls, 2);
  assert.equal(pl.triggeredTurnsWithCall, 2);
});

void test("beat complete triggers parallel-line expectation", () => {
  const jsonl = buildJsonl([
    { kind: "user", text: "收尾" },
    {
      kind: "assistant",
      toolCalls: [
        { id: "c1", name: "progress_scene_beat", args: { kind: "complete", time: ELAPSED_5 } },
      ],
    },
    { kind: "toolResult", toolCallId: "c1" },
    { kind: "assistant", text: "正文。" },
  ]);
  const pl = measureParallelLine(groupTurns(reconstructActivePath(parseSessionJsonl(jsonl))));
  assert.equal(pl.triggeredTurns, 1);
  assert.equal(pl.triggeredTurnsWithCall, 0);
});

// ---------- backstage 账本 ----------

void test("measureBackstageLedger reads outcome + open ledger from secrets snapshot", () => {
  const report = measureBackstageLedger({
    backstageReviewLog: [
      {
        id: "r1",
        obligationId: "o1",
        outcome: "landed",
        reasonCode: "candidate-landed",
        note: "x",
      },
      {
        id: "r2",
        obligationId: "o2",
        outcome: "no-change",
        reasonCode: "advanced-recently",
        note: "y",
      },
      {
        id: "r3",
        obligationId: "o3",
        outcome: "no-change",
        reasonCode: "actors-on-scene",
        note: "z",
      },
    ],
    backstageObligations: [{ id: "o4", trigger: "time-advance", summary: "s", createdAt: "t" }],
  });
  assert.equal(report.reviewed, 3);
  assert.equal(report.byOutcome["landed"], 1);
  assert.equal(report.byOutcome["no-change"], 2);
  assert.equal(report.openAtEnd, 1);
  assert.deepEqual(report.openTriggers, ["time-advance"]);
  assert.ok(Math.abs(report.nonLandedRatio - 2 / 3) < 1e-9);
});

void test("measureBackstageLedger defaults to an empty ledger on legacy secrets", () => {
  const report = measureBackstageLedger({ secretActors: {} });
  assert.equal(report.reviewed, 0);
  assert.equal(report.openAtEnd, 0);
  assert.equal(report.nonLandedRatio, 0);
});

void test("extractLatestSecrets returns the last fsn-state snapshot's secrets", () => {
  const jsonl = buildJsonl([
    { kind: "user", text: "一" },
    { kind: "state", secrets: { backstageObligations: [{ id: "old" }] } },
    { kind: "assistant", text: "正文。" },
    { kind: "state", secrets: { backstageObligations: [{ id: "new", trigger: "beat-complete" }] } },
  ]);
  const secrets = extractLatestSecrets(reconstructActivePath(parseSessionJsonl(jsonl)));
  const report = measureBackstageLedger(secrets);
  assert.deepEqual(report.openTriggers, ["beat-complete"]);
});

// ---------- 端到端 ----------

void test("auditSession end-to-end smoke", () => {
  const jsonl = buildJsonl([...plainTurn("c1", { time: ELAPSED_5 }), ...plainTurn("c2", {})]);
  const report = auditSession(jsonl);
  assert.equal(report.turnCount, 2);
  assert.equal(report.timeCoverage.acceptedCanonicalCalls, 2);
  const rendered = renderAuditReport(report);
  assert.ok(rendered.includes("[时间推进覆盖率]"));
  assert.ok(rendered.includes("commit_turn"));
});
