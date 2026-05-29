import type { ConsequenceAction, ConsequenceRisk, RawConsequenceInput } from "../../engine/core/consequence";

import { assertConsequenceInput, resolveConsequence } from "../../engine/core/consequence";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { writeStateToDetails } from "../../engine/core/state";
import { formatPressureSummary, noNumberNarrativeHint } from "../runtime/narrative-hints";
import { textResult, type ToolResult } from "../runtime/tool-result";

export interface ConsequenceToolDetails {
  actionType: ConsequenceAction;
  riskLevel: ConsequenceRisk;
  pressureSummary: string;
}

export function resolveConsequenceTool(params: RawConsequenceInput, sessionManager: unknown): ToolResult {
  const validated = assertConsequenceInput(params);
  const result = resolveConsequence(validated);
  persistCurrentState(sessionManager);

  const pressureSummary = formatPressureSummary(result.after);
  const delta = result.delta;

  // Net-effect narrative hints — computed from total delta so contradictory
  // per-effect hints (e.g. +4 fatigue from action, -2 from passive recovery)
  // don't both appear.
  const netHints = buildNetHints(delta);

  // Keep per-effect hints only for non-numeric paths (time).
  const timeHints = result.effects
    .filter((e) => typeof e.before === "string" || typeof e.after === "string")
    .map((e) => e.narrativeHint);

  const text = [
    `# ${validated.actionType} · ${validated.riskLevel} · ${validated.durationMinutes}min`,
    "",
    ...result.effects.map(
      (effect) =>
        `- **${effect.reason}**：${formatValueChange(effect.before, effect.after, effect.delta)}`,
    ),
    "",
    `## 当前压力：${pressureSummary}`,
    "",
    "## 叙事约束",
    ...uniqueHints(
      [...timeHints, ...netHints],
      [...result.narrativeConstraints, noNumberNarrativeHint()],
    ).map((hint) => `- ${hint}`),
  ].join("\n");

  const details: Record<string, unknown> = {
    actionType: validated.actionType,
    riskLevel: validated.riskLevel,
    pressureSummary,
    effects: result.effects.map((e) => ({
      reason: e.reason,
      before: e.before,
      after: e.after,
      delta: e.delta,
    })),
  };
  writeStateToDetails(details);
  return textResult(text, details);
}

function formatValueChange(
  before: number | string,
  after: number | string,
  delta: number | undefined,
): string {
  if (delta === undefined) {
    return `${String(before)} → ${String(after)}`;
  }
  const sign = delta >= 0 ? "+" : "";
  return `${String(before)} → ${String(after)} (${sign}${delta})`;
}

function uniqueHints(primary: string[], secondary: string[]): string[] {
  const seen = new Set<string>();
  const hints: string[] = [];
  for (const hint of [...primary, ...secondary]) {
    const normalized = hint.trim();
    if (normalized.length > 0 && !seen.has(normalized)) {
      seen.add(normalized);
      hints.push(normalized);
    }
  }
  return hints;
}

// --- Net-effect narrative hints ---

interface DeltaLike {
  疲劳: number;
  魔力负担: number;
  身体状态: number;
  危险度: number;
}

function buildNetHints(delta: DeltaLike): string[] {
  const hints: string[] = [];
  hints.push(...fatigueNetHint(delta.疲劳));
  hints.push(...manaNetHint(delta.魔力负担));
  hints.push(...bodyNetHint(delta.身体状态));
  hints.push(...dangerNetHint(delta.危险度));
  return hints;
}

function fatigueNetHint(delta: number): string[] {
  if (delta === 0) return [];
  const abs = Math.abs(delta);
  if (delta > 0) {
    return abs >= 10
      ? ["疲劳明显上升；需要体现在动作迟缓、呼吸、疼痛或注意力下降中。"]
      : ["疲劳轻微上升，只需用一两个感官细节暗示。"];
  }
  return abs >= 10 ? ["疲劳明显下降，但时间已经流逝。"] : ["疲劳轻微缓和，可用节奏变化带过。"];
}

function manaNetHint(delta: number): string[] {
  if (delta === 0) return [];
  const abs = Math.abs(delta);
  if (delta > 0) {
    return abs >= 10
      ? ["魔力负担明显上升；必须体现魔术回路或供魔压力，禁止把神秘当免费资源。"]
      : ["魔力负担轻微上升，可用回路刺痛、呼吸紊乱等细节暗示。"];
  }
  return abs >= 10
    ? ["魔力负担明显缓和，但不能抹去此前代价。"]
    : ["魔力负担轻微缓和，可低调处理。"];
}

function bodyNetHint(delta: number): string[] {
  if (delta === 0) return [];
  const abs = Math.abs(delta);
  if (delta > 0) {
    return abs >= 5
      ? ["身体有所恢复，但不能写成立刻完全无伤。"]
      : ["身体状态只轻微好转，可用细节带过。"];
  }
  return abs >= 5
    ? ["伤势必须影响行动、疼痛或判断。"]
    : ["伤势变化轻微，不必夸大。"];
}

function dangerNetHint(delta: number): string[] {
  if (delta === 0) return [];
  if (delta > 0) {
    return delta >= 3
      ? ["危险度大幅上升，当前场景危急，不能写成完全安全。"]
      : ["危险度上升，叙事中保留压力即可。"];
  }
  return ["危险暂时下降，但不是世界停止行动。"];
}
