import { advanceClock } from "./state";

export interface ConsequenceInput {
  actionType: string;
  riskLevel: string;
  durationMinutes: number;
  isPublic: boolean;
  involvesMystery: boolean;
}

export interface ConsequenceResult {
  actionType: string;
  riskLevel: string;
  durationMinutes: number;
  narrativeConstraints: string[];
}

export type RawConsequenceInput = Record<string, unknown>;

export function assertConsequenceInput(raw: RawConsequenceInput): ConsequenceInput {
  return {
    actionType: assertString(raw["actionType"], "actionType"),
    riskLevel: assertString(raw["riskLevel"], "riskLevel"),
    durationMinutes: assertNonNegativeInteger(raw["durationMinutes"], "durationMinutes"),
    isPublic: assertBoolean(raw["isPublic"], "isPublic"),
    involvesMystery: assertBoolean(raw["involvesMystery"], "involvesMystery"),
  };
}

export function resolveConsequence(input: ConsequenceInput): ConsequenceResult {
  advanceClock(input.durationMinutes, `${input.actionType}:${input.riskLevel}`);
  return {
    actionType: input.actionType,
    riskLevel: input.riskLevel,
    durationMinutes: input.durationMinutes,
    narrativeConstraints: buildConstraints(input),
  };
}

function buildConstraints(input: ConsequenceInput): string[] {
  const constraints = [
    `${input.actionType} 已消耗 ${input.durationMinutes} 分钟；世界不会暂停等待玩家。`,
  ];
  if (input.riskLevel === "高" || input.riskLevel === "致命") {
    constraints.push("高风险行动必须留下可见压力、代价或未解除威胁。");
  }
  if (input.involvesMystery) {
    constraints.push("涉及神秘的行动必须遵守型月世界观，不得写成免费万能资源。");
  }
  if (input.isPublic) {
    constraints.push("公开行动可能留下目击、监控或组织记录。 ");
  }
  return constraints;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`非法${fieldName}: 必须是非空字符串。`);
  }
  return value.trim();
}

function assertBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`非法${fieldName}: 必须是 boolean。`);
  }
  return value;
}

function assertNonNegativeInteger(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  throw new Error(`非法${fieldName}: 必须是非负整数。`);
}
