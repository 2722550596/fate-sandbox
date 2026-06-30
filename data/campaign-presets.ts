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
  /**
   * 周明瑞刚刚穿越的那一刻。
   * 绯红之月、太阳穴的枪伤、书桌上"所有人都会死，包括我"的笔记——他还没做转运仪式，
   * 没进入灰雾，不知道非凡世界为何物。只有混沌的头脑和强烈的回家愿望。
   */
  tingen_1349_klein: {
    id: "tingen_1349_klein",
    title: "克莱恩·莫雷蒂·穿越",
    timeline: "tingen",
    openingMode: "selected",
    premise:
      "第五纪1349年6月28日凌晨，星期四，鲁恩王国阿霍瓦郡廷根市。\n\n" +
      "头痛撕裂了你的意识。你在一个陌生的房间里醒来——煤气管道的壁灯、原木色书桌、一本摊开的泛黄笔记。窗外挂着一轮绯红的满月，不属于你记忆中的任何一个月亮。\n\n" +
      "你叫周明瑞。至少，几分钟前你确信自己叫这个名字。但现在你的太阳穴有一个被子弹贯穿的创口——它正在以肉眼可见的速度愈合。桌上有一把黄铜转轮手枪，弹巢里少了一发。你继承了一个叫克莱恩·莫雷蒂的年轻人的记忆碎片：霍伊大学历史系刚毕业、有两日后的廷根大学面试、贫寒的家境、一个叫班森的哥哥、一个叫梅丽莎的妹妹。\n\n" +
      "以及，书桌上那句用赫密斯文写下的——'所有人都会死，包括我。'\n\n" +
      "你怀疑这一切与昨晚做的一个'转运仪式'有关。你决定：如果可能，再做一次，试一试能不能回家。",
    openingHooks: {
      human:
        "头痛欲裂。你从书桌前撑起身体，睁眼便看见窗外一轮绯红的满月——那赤红色的光华笼罩着整个房间。陌生的墙壁、陌生的书桌，摊开的笔记上是一行你明明不该认识却读懂了的话：'所有人都会死，包括我。'旁边搁着一把黄铜转轮手枪。你挣扎着走向穿衣镜，看见镜中人的太阳穴上有一个狰狞的贯穿伤——但你确实还活着。这一切好像与你昨晚做的那场'转运仪式'有关。",
      beyonder:
        "你还没有尝试重新做一次那个'福生玄黄天尊'的仪式。此刻你只是一个头痛欲裂的穿越者，在铁十字街的廉价公寓里，面对镜中死而复生的陌生人和一行诡异的笔记。窗外绯红的月亮冷冷注视着一切。",
    },
    activeRuleSetIds: [
      "lotm-worldview-filter",
      "lotm-judgment-combat",
      "lotm-economy",
      "lotm-sequence-promotion",
    ],
    timezone: "UTC",
    startedAt: "1349-06-28T02:00:00.000Z",
    currentAt: "1349-06-28T02:00:00.000Z",
    location: {
      region: "鲁恩王国",
      site: "廷根市",
      detail: "铁十字街·水仙花街交汇处·莫雷蒂公寓二楼",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "penny", purseLabel: "随身便士", startingFunds: 24 },
  },

  /**
   * 经历了前九章剧情的克莱恩。
   * 已经做过转运仪式、进入过灰雾、以"愚者"的身份建立了塔罗会、
   * 翻阅了原主的笔记、知道第四纪安提哥努斯家族笔记的存在和那句预言。
   * 塔罗会将在下周一（四天后）首次正式聚会，目前他正坐在书桌前，
   * 面对笔记中的谜团——门外突然传来了敲门声。
   */
  tingen_1349_default: {
    id: "tingen_1349_default",
    title: "诡秘之主·廷根线（默认开局）",
    timeline: "tingen",
    openingMode: "selected",
    premise:
      "第五纪1349年6月28日，星期四，鲁恩王国阿霍瓦郡廷根市。\n\n" +
      "霍伊大学历史系毕业生克莱恩·莫雷蒂已经不再是那个他——来自异世界的灵魂占据了这具刚自尽的身体。短短数小时之内，他经历了穿越的混乱、转运仪式的诡异、被拉入灰雾之上的神秘灰雾、意外将两位陌生人拖入那片空间，并以'愚者'之名成立了塔罗会。\n\n" +
      "但他现在更紧迫的问题是：原主为什么会自杀？那本第四纪安提哥努斯家族的古老笔记究竟藏着什么？同学韦尔奇和娜娅那边发生了什么？笔记最后一页那句'所有人都会死，包括我'究竟意味着什么？\n\n" +
      "两天后他还有廷根大学历史系的面试。家里的积蓄只够再撑几天，妹妹梅丽莎期待着他能通过面试改善家境。而门外，突然响起了急促的敲门声。",
    openingHooks: {
      human:
        "你已经翻阅完了克莱恩留下的这本笔记——从5月10日的日常到6月26日关于'霍纳奇斯山脉夜之国'的记述，再到那唯一没有日期、只有一行赫密斯文的话语：'所有人都会死，包括我。'你的手指停在泛黄的纸页上，脑海里拼凑着原主最后的轨迹：第四纪的笔记、安提哥努斯家族、与韦尔奇和娜娅的解读、以及那条通向六千米山峰之上'夜之国'的神秘任务。窗外的阳光已经升高，你正坐在铁十字街公寓的书桌前——然后门外传来了敲门声。",
      beyonder:
        "灰雾的触感还残留在皮肤上。你刚从神奇的灰雾之上归来，指尖的深红印记正缓缓褪去。'愚者'——你在那张青铜长桌的上首对两位陌生人如此自称。现在你回到铁十字街的廉价公寓里，煤气灯的光线下，书桌上那句'所有人都会死，包括我'还在泛黄纸页上等待答案。胃里翻涌着转运仪式残留的幻觉低语，而门外——突然传来了急促的敲门声。",
    },
    activeRuleSetIds: [
      "lotm-worldview-filter",
      "lotm-judgment-combat",
      "lotm-economy",
      "lotm-sequence-promotion",
    ],
    timezone: "UTC",
    startedAt: "1349-06-28T12:30:00.000Z",
    currentAt: "1349-06-28T12:30:00.000Z",
    location: {
      region: "鲁恩王国",
      site: "廷根市",
      detail: "铁十字街·水仙花街交汇处·莫雷蒂公寓二楼",
      boundary: "normal",
    },
    situation: "investigation",
    economy: { currency: "penny", purseLabel: "随身便士", startingFunds: 5 },
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
        "你在孔达特的小旅馆醒来，窗外传来巡逻队的脚步声。昨夜你在灰雾看到了一条不属于这个时代的红色丝线，它指向镇广场方向。",
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
