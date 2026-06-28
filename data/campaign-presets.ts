import type {
  CurrencyCode,
  LocationState,
  OpeningMode,
  RuleSetId,
  SituationKind,
  TimelineId,
  TimeZoneId,
} from "../engine/core/state/state.ts";

/**
 * Per-protagonist-archetype first-frame anchors.
 * Each value is a 1–2 sentence concrete sensory/spatial/temporal hook
 * that tells the agent exactly what the player perceives in the opening's
 * first moment.
 *
 * Keys: `human` (civilian / ordinary person), `beyonder` (extraordinary
 * being PC), `custom` (catch-all for presets where the standard types
 * don't fit).
 */
export interface OpeningHooks {
  human?: string;
  beyonder?: string;
  custom?: string;
}

export interface CampaignPreset {
  id: string;
  title: string;
  timeline: TimelineId;
  openingMode: OpeningMode;
  premise: string;
  openingHooks?: OpeningHooks;
  activeRuleSetIds: RuleSetId[];
  timezone: TimeZoneId;
  startedAt: string;
  currentAt: string;
  location: LocationState;
  situation: SituationKind;
  economy: {
    currency: CurrencyCode;
    purseLabel: string;
    startingFunds: number;
  };
}

export const CAMPAIGN_PRESETS = {
  tingen_1349: {
    id: "tingen_1349",
    title: "诡秘之主·廷根线",
    timeline: "tingen",
    openingMode: "selected",
    premise:
      "第五纪1349年，鲁恩王国廷根市。非凡者社会的暗流在维多利亚时代的都市下涌动；值夜人、机械之心、教会与隐秘组织在各条街道的阴影里角力。玩家角色的身份与卷入方式由开局确认。",
    openingHooks: {
      human:
        "廷根大学的晨钟刚响过，雾气还没散尽。霍伊大街的面包店门口排着队，你排在第三个。旁边的报童喊号外——昨夜码头区又有失踪案。",
      beyonder:
        "偷盗者魔药的余味在喉咙里发苦。昨夜你在源堡里看到了一道模糊的灰色光门，醒来后手心多了一层薄薄的灰烬。廷根的雾比昨天更浓了。",
    },
    activeRuleSetIds: [
      "lotm-worldview-filter",
      "lotm-judgment-combat",
      "lotm-economy",
      "lotm-sequence-promotion",
    ],
    timezone: "UTC",
    startedAt: "1349-01-01T07:00:00.000Z",
    currentAt: "1349-01-01T07:00:00.000Z",
    location: {
      region: "鲁恩王国",
      site: "廷根",
      detail: "廷根大学·校门外",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "penny", purseLabel: "随身便士", startingFunds: 24 },
  },
  backlund_1350: {
    id: "backlund_1350",
    title: "诡秘之主·贝克兰德线",
    timeline: "backlund",
    openingMode: "selected",
    premise:
      "第五纪1350年，鲁恩王国首都贝克兰德。工业革命的烟囱与神秘学的暗影并存；值夜人总部、机械之心核心部门与各大教会的上层建筑在此汇聚。玩家角色的身份与卷入方式由开局确认。",
    openingHooks: {
      human:
        "贝克兰德的雾霾浓得能嚼。你从通勤火车上下来，站台上挤满了穿深色大衣的人。广场方向传来号角声——又有工厂罢工了。",
      beyonder:
        "你在贝克兰德的地下黑市交割完情报，口袋里的便士还剩几枚。上方的街道传来蒸汽汽车的喇叭声，夹杂着一声不属于这个时代的低频嗡鸣。",
    },
    activeRuleSetIds: [
      "lotm-worldview-filter",
      "lotm-judgment-combat",
      "lotm-economy",
      "lotm-sequence-promotion",
    ],
    timezone: "UTC",
    startedAt: "1350-03-15T08:00:00.000Z",
    currentAt: "1350-03-15T08:00:00.000Z",
    location: {
      region: "鲁恩王国",
      site: "贝克兰德",
      detail: "贝克兰德十字地铁站·出口",
      boundary: "normal",
    },
    situation: "investigation",
    economy: { currency: "penny", purseLabel: "随身便士", startingFunds: 120 },
  },
  bayam_1351: {
    id: "bayam_1351",
    title: "诡秘之主·拜亚姆线",
    timeline: "bayam",
    openingMode: "selected",
    premise:
      "第五纪1351年，南大陆港口城市拜亚姆。殖民地的热带气息与非凡者的隐秘活动交织；海盗、走私贩、教会特工与本地反抗者在码头的阴影里交锋。玩家角色的身份与卷入方式由开局确认。",
    openingHooks: {
      human:
        "拜亚姆港口的湿热空气裹着鱼腥和香料味扑面而来。你刚从商船上下来，脚踩在木栈道上，远处传来一声炮响——不知道是海盗还是值夜人在清场。",
      beyonder:
        "你站在拜亚姆灯塔的阴影里，海风把斗篷吹得猎猎作响。手中的封印物微微发烫——有人在附近使用了非凡能力，而且不是你认识的人。",
    },
    activeRuleSetIds: ["lotm-worldview-filter", "lotm-judgment-combat", "lotm-economy"],
    timezone: "UTC",
    startedAt: "1351-07-20T06:00:00.000Z",
    currentAt: "1351-07-20T06:00:00.000Z",
    location: {
      region: "南大陆",
      site: "拜亚姆",
      detail: "拜亚姆港口·商船栈桥",
      boundary: "normal",
    },
    situation: "investigation",
    economy: { currency: "penny", purseLabel: "随身便士", startingFunds: 56 },
  },
  condat_1349: {
    id: "condat_1349",
    title: "诡秘之主·孔达特线",
    timeline: "condat",
    openingMode: "selected",
    premise:
      "第五纪1349年，因蒂斯共和国孔达特地区。革命前夜的政治气压与神秘学的暗潮在此交汇；密探、革命者、教会势力与隐秘组织在小镇的街巷里互相试探。玩家角色的身份与卷入方式由开局确认。",
    openingHooks: {
      human:
        "孔达特的晨雾里混着煤烟味。你走进镇中心的咖啡馆，墙上贴着最新的通缉令——又是几个革命党人。角落里有人在低声争论，声音压得很低。",
      beyonder:
        "你在孔达特的小旅馆醒来，窗外传来巡逻队的脚步声。昨夜你在源堡看到了一条不属于这个时代的红色丝线，它指向镇广场方向。",
    },
    activeRuleSetIds: ["lotm-worldview-filter", "lotm-judgment-combat", "lotm-sequence-promotion"],
    timezone: "UTC",
    startedAt: "1349-11-05T07:00:00.000Z",
    currentAt: "1349-11-05T07:00:00.000Z",
    location: {
      region: "因蒂斯共和国",
      site: "孔达特",
      detail: "镇中心·咖啡馆",
      boundary: "normal",
    },
    situation: "social",
    economy: { currency: "penny", purseLabel: "随身便士", startingFunds: 18 },
  },
  custom_worldline: {
    id: "custom_worldline",
    title: "自定义世界线叙事",
    timeline: "custom",
    openingMode: "custom",
    premise:
      "诡秘之主世界观下的自定义世界线：年代、城市、途径与阵营关系全部由开局问答确认；本 preset 的时间、地点、货币仅为占位，初始化时应被覆盖。",
    openingHooks: {
      custom: "由开局问答确定——入口锚点随世界线设计生成。",
    },
    activeRuleSetIds: ["lotm-worldview-filter", "custom"],
    timezone: "UTC",
    startedAt: "1349-01-01T07:00:00.000Z",
    currentAt: "1349-01-01T07:00:00.000Z",
    location: {
      region: "待定",
      site: "待定",
      detail: "待定",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "custom", purseLabel: "随身资金", startingFunds: 0 },
  },
} as const satisfies Record<string, CampaignPreset>;

const CAMPAIGN_PRESET_INDEX: Readonly<Record<string, CampaignPreset>> = CAMPAIGN_PRESETS;

export type CampaignPresetId = keyof typeof CAMPAIGN_PRESETS;

export function getCampaignPreset(id: string): CampaignPreset {
  const preset = CAMPAIGN_PRESET_INDEX[id];
  if (preset === undefined) {
    throw new Error(
      `campaign preset 不存在: ${id}。可用 preset: ${Object.keys(CAMPAIGN_PRESETS).join(", ")}。`,
    );
  }
  return structuredClone(preset);
}
