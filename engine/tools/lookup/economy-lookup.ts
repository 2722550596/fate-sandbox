/**
 * lookup_economy — 查询非凡世界物品/服务的公允价格表。
 *
 * JSON 数据格式（data/config/economy-prices.json）：
 *   - meta: 全局说明（货币、回收规则）
 *   - categories[]: 价格类别数组
 *     - id: 英文短标识（如 "potion-formula"），可用于精确查询
 *     - name: 中文全称，可用于模糊查询
 *     - prices: 键为序列等级（数字字符串 "9"～"1"），值为价格区间字符串
 *
 * 查询方式：
 *   1. 不传参 → 列出所有可用类别
 *   2. category + optional sequence → 查特定类别（可选按序列筛选）
 *   3. sequence only → 跨所有类别列出该序列等级的价格
 *   4. query → 关键词模糊匹配类别名（如 "魔药" 匹配所有含魔药的类别）
 */

import type { DomainToolDefinition } from "../runtime/tool-definition.ts";

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";

import { isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult, type ToolResult } from "../runtime/tool-result.ts";

// ===========================================================================
// Types
// ===========================================================================

interface PriceMeta {
  currency: string;
  note: string;
  recoveryNote: string;
}

interface PriceCategory {
  id: string;
  name: string;
  prices: Record<string, string>;
}

interface EconomyPriceTable {
  version: number;
  meta: PriceMeta;
  categories: PriceCategory[];
}

// ===========================================================================
// Constants
// ===========================================================================

const RANK_DISPLAY: Record<string, string> = {
  "1": "序列1",
  "2": "序列2",
  "3": "序列3",
  "4": "序列4",
  "5": "序列5",
  "6": "序列6",
  "7": "序列7",
  "8": "序列8",
  "9": "序列9",
};

const RANK_ORDER = ["9", "8", "7", "6", "5", "4", "3", "2", "1"];

// ===========================================================================
// Data loading
// ===========================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "..", "..", "data", "config", "economy-prices.json");

let cached: EconomyPriceTable | null = null;

function isEconomyPriceTable(value: unknown): value is EconomyPriceTable {
  if (typeof value !== "object" || value === null) return false;
  return "version" in value && "meta" in value && "categories" in value;
}

function load(): EconomyPriceTable {
  if (cached !== null) return cached;

  const raw: unknown = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  if (typeof raw !== "object" || raw === null || !("非凡物品价格表" in raw)) {
    throw new Error("economy-lookup: economy-prices.json 缺少顶层键「非凡物品价格表」");
  }
  const root = raw["非凡物品价格表"];
  if (!isEconomyPriceTable(root)) {
    throw new Error(
      "economy-lookup: economy-prices.json 格式异常" +
        "（预期顶层键「非凡物品价格表」下为 version/meta/categories 结构）",
    );
  }
  cached = root;
  return root;
}

// ===========================================================================
// Lookup helpers
// ===========================================================================

/** 捆绑类别组：一个关键词触发多个相关类别同时显示 */
const CATEGORY_GROUPS: Record<string, string[]> = {
  potion: ["potion-formula", "main-material", "auxiliary-material"],
  魔药: ["potion-formula", "main-material", "auxiliary-material"],
  配方: ["potion-formula", "main-material", "auxiliary-material"],
};
/** 按 id 精确匹配，再按 name 模糊匹配。返回匹配列表和匹配原因。 */
function matchCategories(
  cats: PriceCategory[],
  raw: string,
): Array<{ cat: PriceCategory; reason: string }> {
  const normalized = raw.trim();

  // Exact id match
  const byId = cats.find((c) => c.id === normalized);
  if (byId !== undefined) return [{ cat: byId, reason: "id 精确匹配" }];

  // Full name match
  const byName = cats.find((c) => c.name === normalized);
  if (byName !== undefined) return [{ cat: byName, reason: "名称精确匹配" }];

  // Fuzzy name match
  const results: Array<{ cat: PriceCategory; reason: string }> = [];
  for (const cat of cats) {
    if (cat.name.includes(normalized) || cat.id.includes(normalized)) {
      results.push({ cat, reason: "名称包含关键词" });
    }
  }
  if (results.length > 0) return results;

  // Fuzzy on any price value (e.g. "400" → match categories with 400 in prices)
  for (const cat of cats) {
    for (const price of Object.values(cat.prices)) {
      if (price.includes(normalized)) {
        results.push({ cat, reason: "价格区间包含关键词" });
        break;
      }
    }
  }

  return results;
}

/** 渲染单个类别的价格表，可选按序列等级筛选 */
function renderCategory(
  cat: PriceCategory,
  rankFilter: string | undefined,
  currency: string,
): string[] {
  const lines: string[] = [`【${cat.name}】（${cat.id}）`];

  const keys = rankFilter !== undefined ? [rankFilter] : RANK_ORDER;

  let found = false;
  for (const key of keys) {
    const price = cat.prices[key];
    if (price === undefined) continue;
    const label = RANK_DISPLAY[key] ?? `序列${key}`;
    const hireLabel = cat.id === "combat-hire" ? `雇佣1名${label}` : label;
    lines.push(`  ${hireLabel}：${price}${currency}`);
    found = true;
  }

  if (!found) {
    lines.push("  （无该序列等级的价格信息）");
  }

  return lines;
}

// ===========================================================================
// Public API
// ===========================================================================

export interface EconomyQuery {
  /** 价格类别 id 或名称关键词（如 "potion-formula" 或 "魔药"） */
  category?: string;
  /** 序列等级（数字 1-9，如 7） */
  sequence?: number;
  /** 关键词搜索（标题/名称/价格区间模糊匹配） */
  query?: string;
}

export interface EconomyLookupResult {
  text: string;
}
export function lookupEconomyPrice(query: EconomyQuery): EconomyLookupResult {
  const data = load();

  const { meta, categories } = data;
  const currency = meta.currency;

  // --- Validate sequence ---
  const seq = query.sequence;
  const seqKey = seq !== undefined ? String(seq) : undefined;

  // --- Mode 1: category + optional sequence ---
  if (query.category !== undefined) {
    const category = query.category;

    // Check for category groups first
    const groupKeys = CATEGORY_GROUPS[category];
    if (groupKeys !== undefined) {
      const groupedMatches: Array<{ cat: PriceCategory; reason: string }> = [];
      for (const key of groupKeys) {
        const cat = categories.find((c) => c.id === key);
        if (cat) groupedMatches.push({ cat, reason: `魔药相关（${cat.name}）` });
      }
      if (groupedMatches.length > 0) {
        const lines: string[] = [];
        lines.push(`📋 ${meta.note}`);
        lines.push(`💡 ${meta.recoveryNote}`);
        lines.push("");
        lines.push(`🔍 魔药相关价格一览（${category}）：`);
        for (const { cat } of groupedMatches) {
          lines.push(`━━━ ${cat.name}━━━`);
          lines.push(...renderCategory(cat, seqKey, currency));
          lines.push("");
        }
        return { text: lines.join("\n").trimEnd() };
      }
    }
    const matches = matchCategories(categories, category);
    if (matches.length === 0) {
      // Suggest available categories
      const allCats = categories.map((c) => `  - ${c.id}：${c.name}`).join("\n");
      return {
        text: [
          `未找到匹配「${category}」的价格类别。`,
          "",
          "可用类别（支持 id 或名称关键词匹配）：",
          allCats,
        ].join("\n"),
      };
    }

    const lines: string[] = [];
    lines.push(`📋 ${meta.note}`);
    lines.push(`💡 ${meta.recoveryNote}`);
    lines.push("");

    for (const { cat, reason } of matches) {
      if (matches.length > 1) {
        lines.push(`━━━ ${cat.name}（${reason}）━━━`);
      }
      lines.push(...renderCategory(cat, seqKey, currency));
      lines.push("");
    }

    return { text: lines.join("\n").trimEnd() };
  }

  // --- Mode 2: sequence only (cross-category) ---
  if (seqKey !== undefined) {
    const label = RANK_DISPLAY[seqKey]!;
    const lines: string[] = [
      `📋 ${meta.note}`,
      `💡 ${meta.recoveryNote}`,
      "",
      `🔍 以下为【${label}】在所有类别中的价格：`,
      "",
    ];
    for (const cat of categories) {
      const price = cat.prices[seqKey];
      if (price !== undefined) {
        const hireLabel = cat.id === "combat-hire" ? `雇佣1名${label}` : label;
        lines.push(`  【${cat.name}】${hireLabel}：${price}${currency}`);
      }
    }
    return { text: lines.join("\n") };
  }

  // --- Mode 3: free query ---
  if (query.query !== undefined) {
    const q = query.query.trim();
    const matches = matchCategories(categories, q);
    if (matches.length === 0) {
      return { text: `未找到匹配「${q}」的价格信息。尝试不传参数查看所有类别。` };
    }

    const lines: string[] = [
      `📋 ${meta.note}`,
      `💡 ${meta.recoveryNote}`,
      "",
      `🔍 关键词「${q}」匹配结果：`,
      "",
    ];
    for (const { cat, reason } of matches) {
      if (matches.length > 1) {
        lines.push(`━━━ ${cat.name}（${reason}）━━━`);
      }
      lines.push(...renderCategory(cat, undefined, currency));
      lines.push("");
    }

    return { text: lines.join("\n").trimEnd() };
  }

  // --- Mode 4: no params — list all ---
  const lines: string[] = [
    `📋 ${meta.note}`,
    `💡 ${meta.recoveryNote}`,
    "",
    `📑 共 ${categories.length} 个价格类别（id / 名称）：`,
    "",
  ];
  for (const cat of categories) {
    const seqCount = Object.keys(cat.prices).length;
    lines.push(`  🔹 ${cat.id}`);
    lines.push(`     ${cat.name}（${seqCount} 个序列等级）`);
  }
  lines.push("");
  lines.push("查询方式：");
  lines.push('  lookup_economy({ category: "potion-formula" })        → 按 id 查魔药配方价格');
  lines.push(
    '  lookup_economy({ category: "potion" })                → 一键看魔药配方+主材料+辅助材料',
  );
  lines.push("  lookup_economy({ sequence: 7 })                      → 跨类别查序列7的所有价格");
  lines.push('  lookup_economy({ category: "characteristic", sequence: 5 }) → 精确筛选');
  lines.push('  lookup_economy({ query: "封印物" })                  → 关键词自由搜索');

  return { text: lines.join("\n") };
}

// ===========================================================================
// Tool definition
// ===========================================================================

export function lookupEconomyTool(params: unknown): ToolResult {
  const record = isRecord(params) ? params : {};

  const rawCategory = record["category"];
  const rawSequence = record["sequence"];
  const rawQuery = record["query"];

  const category =
    typeof rawCategory === "string" && rawCategory.length > 0 ? rawCategory : undefined;
  const sequence =
    typeof rawSequence === "number" && rawSequence >= 1 && rawSequence <= 9
      ? rawSequence
      : undefined;
  const query = typeof rawQuery === "string" && rawQuery.length > 0 ? rawQuery : undefined;

  const result = lookupEconomyPrice({ category, sequence, query });
  return textResult(result.text);
}

export const lookupEconomyToolDefinition: DomainToolDefinition = {
  name: "lookup_economy",
  description:
    "查询非凡世界物品/服务的公允价格表。单位为金镑。\n\n" +
    "参数说明：\n" +
    "  - 不传任何参数 → 列出所有可查的价格类别（含 id 和名称）\n" +
    '  - category（字符串）→ 类别 id（如 "potion-formula"）或中文名称关键词（如 "魔药"）\n' +
    "  - sequence（数字 1-9）→ 筛选序列等级，可单独使用跨类别查询，或与 category 组合\n" +
    "  - query（字符串）→ 关键词自由搜索，匹配类别名和价格区间\n\n" +
    "使用边界：判断物品/服务公允价、魔药配方/非凡特性/神奇物品/灵性材料/雇佣/服务定价参考。\n" +
    "禁区：不要编造表中不存在的价格类别或序列数据，一切以本表为准。",
  parameters: Type.Object({
    category: Type.Optional(
      Type.String({
        description:
          '价格类别标识或名称关键词。id 精确匹配（如 "potion-formula"），' +
          '也支持中文名称模糊匹配（如 "魔药"、"神奇物品"）。',
      }),
    ),
    sequence: Type.Optional(
      Type.Number({
        description:
          "序列等级，数字 1-9。可单独使用（跨类别查看该序列所有价格），" +
          "也可与 category 结合精确筛选。",
      }),
    ),
    query: Type.Optional(
      Type.String({
        description: '关键词自由搜索，匹配类别名称和价格区间值。例如 "封印物" 或 "400"。',
      }),
    ),
  }),
  execute: async (_toolCallId, params) => lookupEconomyTool(params),
};
