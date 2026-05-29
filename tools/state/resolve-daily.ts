import { writeStateToDetails } from "../../engine/core/state";
import { resolveConsequenceTool } from "./resolve-consequence";

import { textResult, type ToolResult } from "../runtime/tool-result";

export interface RawDailyInput {
  activity: unknown;
  durationMinutes: unknown;
  isPublic?: unknown;
}

export interface DailyToolDetails {
  dailyActivity: string;
  durationMinutes: number;
  pressureSummary: string;
}

const DEFAULT_PUBLIC_VISIBILITY = true;

export function resolveDailyTool(params: RawDailyInput, sessionManager: unknown): ToolResult {
  const activity = assertActivity(params.activity);
  const isPublic = assertOptionalBoolean(params.isPublic, "isPublic", DEFAULT_PUBLIC_VISIBILITY);
  const validatedDuration = assertDuration(params.durationMinutes);
  const result = resolveConsequenceTool(
    {
      actionType: "日常",
      riskLevel: "低",
      durationMinutes: validatedDuration,
      isPublic,
      involvesMystery: false,
    },
    sessionManager,
  );
  const original = result.content[0];
  const text = original?.type === "text" ? original.text : "";
  const pressureSummary = readStringDetail(result.details, "pressureSummary");
  const details: DailyToolDetails & Record<string, unknown> = {
    ...result.details,
    dailyActivity: activity,
    durationMinutes: validatedDuration,
    pressureSummary,
  };
  writeStateToDetails(details);
  return textResult(rewriteHeading(text, activity), details);
}

function assertActivity(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`非法日常行动: ${formatUnknown(value)}。日常行动必须是字符串。`);
  }
  const activity = value.trim();
  if (activity.length === 0) {
    throw new Error("非法日常行动: activity 不能为空。");
  }
  if (activity.length > 80) {
    throw new Error("非法日常行动: activity 不能超过 80 个字符。");
  }
  return activity;
}

function assertDuration(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`非法日常耗时: ${value}。durationMinutes 必须是整数。`);
    }
    return assertDurationRange(value);
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throw new Error(`非法日常耗时: ${value}。durationMinutes 字符串必须是正整数。`);
    }
    return assertDurationRange(Number(normalized));
  }
  throw new Error(`非法日常耗时: ${formatUnknown(value)}。durationMinutes 必须是整数。`);
}

function assertDurationRange(value: number): number {
  if (value < 1 || value > 1440) {
    throw new Error(`非法日常耗时: ${value}。durationMinutes 必须在 1-1440 之间。`);
  }
  return value;
}

function assertOptionalBoolean(value: unknown, fieldName: string, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。${fieldName}必须是 boolean。`);
  }
  return value;
}

function rewriteHeading(text: string, activity: string): string {
  const lines = text.split("\n");
  lines[0] = `# 日常 · ${activity}`;
  return lines.join("\n");
}

function readStringDetail(details: Record<string, unknown>, key: string): string {
  const value = details[key];
  if (typeof value !== "string") {
    throw new Error(`工具结果缺少 ${key} 字段。`);
  }
  return value;
}

function formatUnknown(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value);
  if (value === undefined) return "undefined";
  return Object.prototype.toString.call(value);
}
