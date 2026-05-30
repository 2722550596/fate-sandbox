import type { FateRank } from "./state";

export type FateRankComparisonBand = "same-tier" | "edge" | "advantage" | "overwhelming";

export interface FateRankComparison {
  left: FateRank;
  right: FateRank;
  mainRankDelta: number;
  modifierDelta: number;
  band: FateRankComparisonBand;
  narrative: string;
}

type FateRankMain = "E" | "D" | "C" | "B" | "A" | "EX";

const MAIN_RANK_ORDER: readonly FateRankMain[] = ["E", "D", "C", "B", "A", "EX"];

export function compareFateRanks(left: FateRank, right: FateRank): FateRankComparison {
  const parsedLeft = parseFateRank(left);
  const parsedRight = parseFateRank(right);
  const mainRankDelta = parsedLeft.mainValue - parsedRight.mainValue;
  const modifierDelta = parsedLeft.modifier - parsedRight.modifier;
  const band = comparisonBand(mainRankDelta, modifierDelta);
  return {
    left,
    right,
    mainRankDelta,
    modifierDelta,
    band,
    narrative: comparisonNarrative(band, mainRankDelta),
  };
}

export function assertFateRank(value: unknown, fieldName: string): FateRank {
  if (typeof value !== "string") {
    throw new Error(`非法${fieldName}: 必须是 Fate rank 字符串。`);
  }
  return parseFateRank(value).rank;
}

function parseFateRank(rank: string): { rank: FateRank; mainValue: number; modifier: number } {
  const match = /^(E|D|C|B|A|EX)([+-])?$/.exec(rank);
  if (match === null) {
    throw new Error(`非法 Fate rank: ${rank}。允许 E/D/C/B/A/EX 与可选 +/-。`);
  }
  const base = match[1];
  if (!isFateRankMain(base)) {
    throw new Error(`非法 Fate rank: ${rank}。`);
  }
  const modifierText = match[2];
  const mainValue = MAIN_RANK_ORDER.indexOf(base);
  const modifier = parseModifier(modifierText);
  return { rank: buildFateRank(base, modifierText), mainValue, modifier };
}

function parseModifier(modifier: string | undefined): number {
  if (modifier === "+") return 1;
  if (modifier === "-") return -1;
  return 0;
}

function isFateRankMain(value: unknown): value is FateRankMain {
  return (
    value === "E" ||
    value === "D" ||
    value === "C" ||
    value === "B" ||
    value === "A" ||
    value === "EX"
  );
}

function buildFateRank(base: FateRankMain, modifier: string | undefined): FateRank {
  if (modifier === "+") {
    return `${base}+`;
  }
  if (modifier === "-") {
    return `${base}-`;
  }
  return base;
}

function comparisonBand(mainRankDelta: number, modifierDelta: number): FateRankComparisonBand {
  const absoluteMainDelta = Math.abs(mainRankDelta);
  if (absoluteMainDelta >= 2) return "overwhelming";
  if (absoluteMainDelta === 1) return "advantage";
  if (Math.abs(modifierDelta) > 0) return "edge";
  return "same-tier";
}

function comparisonNarrative(band: FateRankComparisonBand, mainRankDelta: number): string {
  const direction = mainRankDelta >= 0 ? "左侧" : "右侧";
  switch (band) {
    case "overwhelming":
      return `${direction}形成两级以上参数压制；技能、宝具、地形或相性才可能逆转。`;
    case "advantage":
      return `${direction}有一个主等级优势；进入优势交锋或消耗区间。`;
    case "edge":
      return "双方同主等级，+/- 只提供微弱边缘。";
    case "same-tier":
      return "双方参数同级；结果应由技能、位置、准备与代价决定。";
    default:
      throw new Error("unreachable Fate rank comparison band");
  }
}
