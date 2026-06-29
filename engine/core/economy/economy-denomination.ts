import type { CurrencyType } from "./economy-schema.ts";

// ===========================================================================
// 面值定义
// ===========================================================================

export interface DenominationDef {
  /** 匹配别名列表（中英文、简写全写皆可） */
  aliases: string[];
  /** 等于多少个最小单位（便士/戈比/科佩/德根） */
  toSmallest: number;
}

/** 每种货币制有多个面值，从大到小排序 */
const DENOMINATIONS: Record<CurrencyType, readonly DenominationDef[]> = {
  loen: [
    { aliases: ["金镑", "镑", "pound", "gold-pound", "gold pound"], toSmallest: 240 },
    { aliases: ["苏勒", "s", "shilling", "先令"], toSmallest: 12 },
    { aliases: ["便士", "d", "penny", "pence", "铜便士"], toSmallest: 1 },
  ],
  fesac: [
    { aliases: ["金霍恩", "霍恩", "gold-horn", "gold horn", "horn"], toSmallest: 100 },
    { aliases: ["弗银", "silver", "fesac-silver", "银币"], toSmallest: 10 },
    { aliases: ["戈比", "copeck", "kopek", "铜币"], toSmallest: 1 },
  ],
  intis: [
    { aliases: ["费尔金", "金路易", "ferkin", "gold-louis"], toSmallest: 100 },
    { aliases: ["里克", "rik"], toSmallest: 5 },
    { aliases: ["科佩", "kopeck", "copper", "铜"], toSmallest: 1 },
  ],
  feynapotter: [
    { aliases: ["金里索", "里索", "gold-riso", "gold riso", "riso"], toSmallest: 100 },
    { aliases: ["塞塔", "seta"], toSmallest: 10 },
    { aliases: ["德根", "degen"], toSmallest: 1 },
  ],
};

// ===========================================================================
// 最小单位标签
// ===========================================================================

export const SMALLEST_UNIT_LABELS: Record<CurrencyType, string> = {
  loen: "便士",
  fesac: "戈比",
  intis: "科佩",
  feynapotter: "德根",
};

// ===========================================================================
// 查找面值
// ===========================================================================

function findDenomination(label: string, currencyType: CurrencyType): DenominationDef | undefined {
  const needle = label.trim().toLowerCase();
  const defs = DENOMINATIONS[currencyType];
  for (const def of defs) {
    for (const alias of def.aliases) {
      if (alias.toLowerCase() === needle) return def;
    }
  }
  return undefined;
}

function listAliases(currencyType: CurrencyType): string {
  return DENOMINATIONS[currencyType]
    .flatMap((d) => d.aliases.slice(0, 1))
    .concat(SMALLEST_UNIT_LABELS[currencyType])
    .join(" / ");
}

// ===========================================================================
// 解析 GM 金额字符串 → 最小单位整数
// ===========================================================================

/**
 * 解析 GM 输入的金额字符串为最小单位（便士/戈比/科佩/德根）的整数。
 *
 * 支持格式：1金镑5苏勒  /  2pound  /  3s12d  /  5便士
 * 正则 /(\d+)\s*([^\d\s]+)/g 逐对匹配「数字+面值标签」。
 *
 * @returns 解析后的最小单位整数
 * @throws 含未知面值或解析结果为零时抛错
 */
export function parseAmountString(input: string, currencyType: CurrencyType): number {
  if (input.trim().length === 0) {
    throw new Error(`parseAmountString: 无效的金额字符串「${input}」。`);
  }

  // 只匹配数字 + 当前币种的中文单位名（如「1金镑5苏勒」），不匹配缩写（s/d/pound）
  const chineseUnits = DENOMINATIONS[currencyType]
    .map((d) => d.aliases[0])
    .filter((u): u is string => u !== undefined)
    .toSorted((a, b) => b.length - a.length) // 长名优先（金霍恩先于霍恩）
    .join("|");
  const pattern = new RegExp(`(\\d+)\\s*(${chineseUnits})`, "g");
  let match: RegExpExecArray | null;
  let total = 0;
  while ((match = pattern.exec(input)) !== null) {
    const rawAmount = match[1];
    const rawLabel = match[2];
    if (rawAmount === undefined || rawLabel === undefined) continue;
    const amount = parseInt(rawAmount, 10);
    if (amount <= 0) continue;
    const def = findDenomination(rawLabel, currencyType);
    if (def === undefined) {
      throw new Error(
        `未知面值「${rawLabel}」；${currencyType} 支持: ${listAliases(currencyType)}`,
      );
    }
    total += amount * def.toSmallest;
  }

  if (total <= 0) {
    throw new Error(`无法解析金额字符串「${input}」。格式示例: 1金镑5苏勒`);
  }

  return total;
}

// ===========================================================================
// 格式化输出：最小单位 → 紧凑表示
// ===========================================================================

/**
 * 将最小单位的金额转换为可读的紧凑面值表示。
 *
 * 规则：从大到小遍历面值，取整除部分显示，余数继续向小面值传递。
 * 零值跳过，结果为零时显示「0最小单位」。
 *
 * 示例（loen）：
 *   240 → 1金镑
 *   24  → 2苏勒
 *   300 → 1金镑5苏勒
 *   348 → 1金镑9苏勒
 *   5   → 5便士
 *   0   → 0便士
 */
export function formatAmount(amountSmallest: number, currencyType: CurrencyType): string {
  const defs = DENOMINATIONS[currencyType];
  const smallestLabel = SMALLEST_UNIT_LABELS[currencyType];

  if (!Number.isInteger(amountSmallest) || amountSmallest < 0) {
    return `${String(amountSmallest)}${smallestLabel}`;
  }
  if (amountSmallest === 0) return `0${smallestLabel}`;

  let remaining = amountSmallest;
  const parts: string[] = [];

  for (const def of defs) {
    if (remaining < def.toSmallest) continue;
    const count = Math.floor(remaining / def.toSmallest);
    remaining %= def.toSmallest;
    parts.push(`${count}${def.aliases[0]}`);
  }

  // 余数小于最小面值的兜底（正常不会跑到这里）
  if (remaining > 0) {
    parts.push(`${remaining}${smallestLabel}`);
  }

  return parts.join("");
}
