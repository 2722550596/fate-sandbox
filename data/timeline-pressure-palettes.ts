import type { TimelineId } from "../engine/core/state.ts";

const SHORT_COOLDOWN_TURNS = 1;
const DEFAULT_COOLDOWN_TURNS = 2;
const LONG_COOLDOWN_TURNS = 3;

export interface TimelinePressureSlot {
  id: string;
  timelineId: TimelineId;
  label: string;
  pressureType: string;
  actorOrFactionHints: string[];
  playerSafeProjectionKinds: string[];
  cooldownTurns: number;
  forbiddenWhen: string[];
}

const TIMELINE_PRESSURE_PALETTES: readonly TimelinePressureSlot[] = [
  {
    id: "tingen-nightwatcher-patrol",
    timelineId: "tingen",
    label: "值夜人巡逻",
    pressureType: "authority-surveillance",
    actorOrFactionHints: ["值夜人", "廷根分局巡逻队", "教会调派员"],
    playerSafeProjectionKinds: ["脚步声", "被拦查的证人", "宵禁通告", "灯笼光"],
    cooldownTurns: DEFAULT_COOLDOWN_TURNS,
    forbiddenWhen: ["当前场景在值夜人管辖范围之外", "玩家在源堡内"],
  },
  {
    id: "tingen-machinery-heart-investigation",
    timelineId: "tingen",
    label: "机械之心调查",
    pressureType: "institutional-investigation",
    actorOrFactionHints: ["机械之心", "蒸汽与机械之神教会", "情报分析员"],
    playerSafeProjectionKinds: ["不明机械残骸", "异常蒸汽管道", "工厂停电", "齿轮卡死报告"],
    cooldownTurns: LONG_COOLDOWN_TURNS,
    forbiddenWhen: ["机械之心未在当前剧情线建立存在"],
  },
  {
    id: "tingen-street-crime",
    timelineId: "tingen",
    label: "街头犯罪",
    pressureType: "civilian-society",
    actorOrFactionHints: ["码头帮派", "扒手", "走私贩", "普通市民目击者"],
    playerSafeProjectionKinds: ["巷子里的争吵", "丢失的钱包", "码头上的可疑货物", "酒馆传闻"],
    cooldownTurns: SHORT_COOLDOWN_TURNS,
    forbiddenWhen: ["当前地点远离廷根市区"],
  },
  {
    id: "tingen-hidden-beyonder-activity",
    timelineId: "tingen",
    label: "隐秘非凡者活动",
    pressureType: "beyonder-autonomy",
    actorOrFactionHints: ["未知非凡者", "偷盗者途径", "观众途径", "占卜家途径"],
    playerSafeProjectionKinds: ["异常的精神波动", "不该出现的影子", "丢失的记忆碎片", "梦中窥视"],
    cooldownTurns: DEFAULT_COOLDOWN_TURNS,
    forbiddenWhen: ["当前 beat 禁止非凡者压力", "玩家在纯 OOC/meta 回合"],
  },
  {
    id: "backlund-faction-politics",
    timelineId: "backlund",
    label: "贝克兰德派系政治",
    pressureType: "mage-association-politics",
    actorOrFactionHints: ["值夜人总部", "机械之心核心", "教会高层", "贵族院"],
    playerSafeProjectionKinds: ["正式传唤", "闭门会议传闻", "情报封锁", "高层调动通知"],
    cooldownTurns: LONG_COOLDOWN_TURNS,
    forbiddenWhen: ["当前剧情线尚未建立派系存在"],
  },
  {
    id: "backlund-underground-market",
    timelineId: "backlund",
    label: "地下黑市波动",
    pressureType: "covert-violence",
    actorOrFactionHints: ["黑市商人", "走私网络", "情报掮客", "封印物贩子"],
    playerSafeProjectionKinds: ["价格异动", "货架空缺", "线人失联", "封印物泄漏迹象"],
    cooldownTurns: DEFAULT_COOLDOWN_TURNS,
    forbiddenWhen: ["当前地点远离贝克兰德地下区域"],
  },
  {
    id: "backlund-industrial-accident",
    timelineId: "backlund",
    label: "工业区异常",
    pressureType: "territory-environment",
    actorOrFactionHints: ["工厂区", "蒸汽管道", "工人群体", "机械之心巡查员"],
    playerSafeProjectionKinds: ["蒸汽泄漏", "齿轮暴走", "工人集体晕厥", "不明金属残片"],
    cooldownTurns: DEFAULT_COOLDOWN_TURNS,
    forbiddenWhen: ["当前场景不在工业区"],
  },
  {
    id: "bayam-pirate-raid",
    timelineId: "bayam",
    label: "海盗袭击",
    pressureType: "faction-war-front",
    actorOrFactionHints: ["海盗团伙", "私掠船", "港口守卫", "走私船"],
    playerSafeProjectionKinds: ["远处炮声", "码头骚乱", "商船改航", "海上黑烟"],
    cooldownTurns: DEFAULT_COOLDOWN_TURNS,
    forbiddenWhen: ["当前场景不在港口或海岸"],
  },
  {
    id: "bayam-colonial-authority",
    timelineId: "bayam",
    label: "殖民当局巡查",
    pressureType: "authority-surveillance",
    actorOrFactionHints: ["殖民政府", "驻军", "海关", "教会南大陆分部"],
    playerSafeProjectionKinds: ["通关检查", "宵禁令", "搜查令", "驱逐通告"],
    cooldownTurns: LONG_COOLDOWN_TURNS,
    forbiddenWhen: ["殖民当局未在当前剧情线建立存在"],
  },
  {
    id: "bayam-native-resistance",
    timelineId: "bayam",
    label: "本地反抗活动",
    pressureType: "civilian-society",
    actorOrFactionHints: ["本地反抗组织", "部落民", "地下印刷所", "走私情报网"],
    playerSafeProjectionKinds: ["传单", "夜间集会声", "仓库异动", "线人警告"],
    cooldownTurns: DEFAULT_COOLDOWN_TURNS,
    forbiddenWhen: ["当前地点远离本地居民区"],
  },
  {
    id: "condat-revolutionary-underground",
    timelineId: "condat",
    label: "革命党地下活动",
    pressureType: "covert-violence",
    actorOrFactionHints: ["革命党", "密探", "印刷所", "地下集会"],
    playerSafeProjectionKinds: ["传单碎片", "夜间敲门暗号", "咖啡馆低语", "突然消失的熟人"],
    cooldownTurns: DEFAULT_COOLDOWN_TURNS,
    forbiddenWhen: ["当前场景不涉及政治活动"],
  },
  {
    id: "condat-church-survey",
    timelineId: "condat",
    label: "教会暗中巡查",
    pressureType: "church-supervision",
    actorOrFactionHints: ["教会调派员", "值夜人地方分支", "告解室情报"],
    playerSafeProjectionKinds: ["教堂钟声异常", "神父暗示", "告解室警告", "圣物反应"],
    cooldownTurns: DEFAULT_COOLDOWN_TURNS,
    forbiddenWhen: ["教会未在当前剧情线建立存在"],
  },
];

export function getTimelinePressureSlots(timelineId: TimelineId): TimelinePressureSlot[] {
  return TIMELINE_PRESSURE_PALETTES.filter((slot) => slot.timelineId === timelineId).map(cloneSlot);
}

function cloneSlot(slot: TimelinePressureSlot): TimelinePressureSlot {
  return {
    ...slot,
    actorOrFactionHints: [...slot.actorOrFactionHints],
    playerSafeProjectionKinds: [...slot.playerSafeProjectionKinds],
    forbiddenWhen: [...slot.forbiddenWhen],
  };
}
