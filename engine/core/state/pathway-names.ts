import type { PathwayId, SequenceRank } from "./state-enum-schemas.ts";

/** PathwayId → 中文途径名（与 data/config/神之途径.json 的 key 一致） */
export const PATHWAY_DISPLAY_NAMES: Record<PathwayId, string> = {
  // —— 22 条标准途径 ——
  "seer": "占卜家",
  "apprentice": "学徒",
  "marauder": "偷盗者",
  "spectator": "观众",
  "bard": "歌颂者",
  "sailor": "水手",
  "reader": "阅读者",
  "secrets-suppliant": "秘祈人",
  "sleepless": "不眠者",
  "corpse-collector": "收尸人",
  "warrior": "战士",
  "mystery-pryer": "窥秘人",
  "savant": "通识者",
  "hunter": "猎人",
  "assassin": "刺客",
  "apothecary": "药师",
  "planter": "耕种者",
  "lawyer": "律师",
  "arbiter": "仲裁人",
  "prisoner": "囚犯",
  "criminal": "罪犯",
  "monster": "怪物",
  // —— 10 条外神/非标准途径 ——
  "dancer": "舞蹈家",
  "villain": "恶棍",
  "patient": "病患",
  "scrooge": "吝啬鬼",
  "broker": "掮客",
  "astronomy-aficionado": "天文爱好者",
  "tramp": "流浪汉",
  "dreamless": "失梦人",
  "babbler": "入门者",
  "prayermonger": "萨满",
  "custom": "自定义",
};

/** SequenceRank → 中文等级标签 */
export const RANK_DISPLAY_NAMES: Record<SequenceRank, string> = {
  "seq-9": "序列9",
  "seq-8": "序列8",
  "seq-7": "序列7",
  "seq-6": "序列6",
  "seq-5": "序列5",
  "seq-4": "序列4",
  "seq-3": "序列3",
  "seq-2": "序列2",
  "seq-1": "序列1",
  "seq-0": "序列0",
  "old-one": "旧日",
  "pillar": "支柱",
  "ordinary": "普通人",
};

/** 构建 ability-lookup 查询键，如 "占卜家途径-序列9" */
export function abilityLookupKey(pathway: PathwayId, rank: SequenceRank): string {
  const display = PATHWAY_DISPLAY_NAMES[pathway] ?? pathway;
  const rankLabel = RANK_DISPLAY_NAMES[rank] ?? rank;
  return `${display}途径-${rankLabel}`;
}