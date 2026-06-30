import type { DomainToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult } from "../runtime/tool-result.ts";

export function rollDiceTool(params: unknown): ToolResult {
  const { diceType, count } = parseDiceParams(params);
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollDie(diceType));
  }
  const total = results.reduce((sum, val) => sum + val, 0);
  const label = count > 1 ? `骰面 [${results.join(", ")}] 合计=${total}` : `骰面 [${results[0]}]`;
  return textResult(`骰子结果 (${count}d${diceType})：${label}`, {
    diceType,
    count,
    results,
    total,
  });
}

function parseDiceParams(params: unknown): { diceType: number; count: number } {
  const raw = isRecord(params) ? params : {};
  const diceType = typeof raw.diceType === "number" ? raw.diceType : 100;
  const count =
    typeof raw.count === "number" ? Math.max(1, Math.min(10, Math.floor(raw.count))) : 1;
  return { diceType, count };
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export const rollDiceToolDefinition: DomainToolDefinition = {
  name: "roll_dice",
  description:
    "掷一次骰子（默认 d100），返回骰面结果。用于剧情分歧点时判断运气。骰面越小越成功。\n\n" +
    "使用边界：纯粹的随机骰子检定；晋升/战斗等有固定公式的场景应走工具内建计算，不单独调用本工具。\n" +
    "禁区：不替代 judgment/combat 的内建随机；不用于修饰已写死的骰面。",
  parameters: Type.Object({
    diceType: Type.Optional(
      Type.Number({
        description: "骰面类型（默认 100=百分骰），如 20=d20, 6=d6",
      }),
    ),
    count: Type.Optional(
      Type.Number({
        description: "骰子数量（默认 1，最大 10）",
      }),
    ),
  }),
  execute: async (_toolCallId, params) => rollDiceTool(params),
};
