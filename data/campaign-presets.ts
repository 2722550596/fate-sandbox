import type {
  CurrencyCode,
  LocationState,
  OpeningMode,
  RuleSetId,
  SituationKind,
  TimelineId,
  TimeZoneId,
} from "../engine/core/state.ts";

/**
 * Per-protagonist-archetype first-frame anchors.
 * Each value is a 1–2 sentence concrete sensory/spatial/temporal hook
 * that tells the agent exactly what the player perceives in the opening’s
 * first moment. The agent must NOT improvise an opening from scratch;
 * it must use these anchors as the skeleton.
 *
 * Keys: `master` (human mage), `servant` (heroic spirit PC), `human`
 * (civilian / local / traveller), `custom` (catch-all for presets where
 * the three standard types don’t fit).
 */
export interface OpeningHooks {
  master?: string;
  servant?: string;
  human?: string;
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
  fsn_2004_fuyuki: {
    id: "fsn_2004_fuyuki",
    title: "Fate/stay night 叙事",
    timeline: "fsn",
    openingMode: "selected",
    premise: "2004 年冬木，圣杯战争即将开幕；玩家角色身份与卷入方式由开局确认。",
    openingHooks: {
      master:
        "深夜回家路上，街灯下自己的影子旁边贴着第二个。左手背发烫，皮肤底下三划令咒的红痕正在往外顶。",
      servant:
        "灵基凝聚的瞬间，召唤阵的蓝光打在地下室的水泥墙上；魔力供给细如游丝——面前的人类御主魔力量极低。",
      human: "放学后的冬木大桥，对岸新都方向冒着橘红色的烟柱，但晚间新闻只播了天气预报。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "jpy-2004-economy"],
    timezone: "Asia/Tokyo",
    startedAt: "2004-01-30T07:00:00.000Z",
    currentAt: "2004-01-30T07:00:00.000Z",
    location: {
      region: "冬木市",
      site: "深山镇",
      detail: "穗群原学园·校门外",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "JPY", purseLabel: "随身现金", startingFunds: 50000 },
  },
  fsf_2008_snowfield: {
    id: "fsf_2008_snowfield",
    title: "Fate/strange Fake 叙事",
    timeline: "fsf",
    openingMode: "selected",
    premise:
      "2008 年斯诺菲尔德，虚假圣杯战争与真实从者机制交叠；具体替换角色与阵营关系由开局确认。",
    openingHooks: {
      master:
        "斯诺菲尔德的沙漠公路尽头，令咒在手背浮现。干风里混着铁锈和臭氧的味道——地面在脚底下嗡了一下，像是深处的管道全开了。",
      servant:
        "现界的瞬间就感到不对：灵脉被人为拧过了，流向全是乱的，圣杯战争的骨架是拿别处的零件拼起来的。御主站在面前，沙漠的热风灌进来。",
      human:
        "斯诺菲尔德市警署接到第三通失踪报告的那个早上，警车的无线电里混进了不属于任何频道的低频杂音。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "custom"],
    timezone: "America/Denver",
    startedAt: "2008-06-03T03:00:00.000Z",
    currentAt: "2008-06-03T03:00:00.000Z",
    location: {
      region: "斯诺菲尔德",
      site: "歌剧院",
      detail: "后台更衣区",
      boundary: "normal",
    },
    situation: "escape",
    economy: { currency: "USD", purseLabel: "随身现金", startingFunds: 200 },
  },
  extra_2032_seraph: {
    id: "extra_2032_seraph",
    title: "Fate/EXTRA 叙事",
    timeline: "extra",
    openingMode: "selected",
    premise:
      "2032 年，Moon Cell 内部的霊子虚构世界 SE.RA.PH 举行月之圣杯战争；日期是开局占位，具体回合与对手由开局确认。",
    openingHooks: {
      master:
        "方才还在教室里上课，下一秒视野剥离成纯白——SE.RA.PH 的走廊在脚下重新构筑，手背多了三划令咒。公告栏弹出第一轮对阵表，对手的名字亮了。",
      servant:
        "灵基被 Moon Cell 的数据流拽出座，以电子体重新编译。面前的御主还在发愣，Arena 入口的倒计时读数跳到了三位数。",
      human: "在 SE.RA.PH 的宿舍醒来，窗外是被数据模拟出的蓝天。走廊公告栏上贴着第一轮的对阵表。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "moon-cell-seraph"],
    timezone: "UTC",
    startedAt: "2032-01-01T00:00:00.000Z",
    currentAt: "2032-01-01T00:00:00.000Z",
    location: {
      region: "Moon Cell",
      site: "SE.RA.PH",
      detail: "月海原学园·教室",
      boundary: "otherworld",
    },
    situation: "daily",
    economy: { currency: "custom", purseLabel: "SE.RA.PH 资源", startingFunds: 0 },
  },
  extra_ccc_2032_far_side: {
    id: "extra_ccc_2032_far_side",
    title: "Fate/EXTRA CCC 叙事",
    timeline: "extra-ccc",
    openingMode: "selected",
    premise:
      "2032 年，Moon Cell 月之裏側出现致命异常；旧校舍成为安全据点，Sakura Labyrinth 与 BB 侧压力包围被卷入者。日期是开局占位，具体 Servant、路线与卷入时点由开局确认。",
    openingHooks: {
      master:
        "旧校舍的门在身后关上，SE.RA.PH 表侧的信号断了。走廊的墙壁在脉动，拐角处 Sakura Labyrinth 的入口张着一个人形大小的口子，里面传出心跳一样的低频。",
      servant:
        "灵基的数据通道被强制改写，Arena 的规则不再适用；御主和你被推入了月之裏侧——这里的法则由 BB 说了算。",
      human:
        "保健室的天花板在头顶慢慢融化成别的什么。门外是旧校舍，走廊尽头多出了一扇没见过的门，门缝里漏出淡粉色的光。",
    },
    activeRuleSetIds: [
      "fate-worldview-filter",
      "fate-rank-combat",
      "moon-cell-seraph",
      "moon-cell-far-side",
    ],
    timezone: "UTC",
    startedAt: "2032-01-01T00:00:00.000Z",
    currentAt: "2032-01-01T00:00:00.000Z",
    location: {
      region: "Moon Cell",
      site: "月之裏側",
      detail: "旧校舍",
      boundary: "otherworld",
    },
    situation: "investigation",
    economy: { currency: "custom", purseLabel: "Sakura迷宫资源", startingFunds: 0 },
  },
  fz_1994_fuyuki: {
    id: "fz_1994_fuyuki",
    title: "Fate/Zero 叙事",
    timeline: "fz",
    openingMode: "selected",
    premise:
      "1994 年冬木，第四次圣杯战争即将开幕；七位御主多为老谋深算的成年魔术师，战争气质比第五次更冷酷。玩家角色身份与卷入方式由开局确认。",
    openingHooks: {
      master:
        "教堂的监督已通知：第四次圣杯战争的参加资格确认完毕。圣遗物就在手边，召唤阵画好了——只差最后一句咏唱。",
      servant:
        "召唤阵的光芒收敛后，一座陌生的日式仓库；御主站在阵前，周围残留着浓重的魔力余韵。这场战争的空气比通常更冷。",
      human: "冬木市新都的酒吧里，电视播着深夜新闻——连续纵火事件第三天了。窗外有人影掠过屋顶。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "custom"],
    timezone: "Asia/Tokyo",
    startedAt: "1994-01-24T10:00:00.000Z",
    currentAt: "1994-01-24T10:00:00.000Z",
    location: {
      region: "冬木市",
      site: "新都",
      detail: "冬木车站前广场",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "JPY", purseLabel: "随身现金", startingFunds: 50000 },
  },
  ha_2004_fuyuki: {
    id: "ha_2004_fuyuki",
    title: "Fate/hollow ataraxia 叙事",
    timeline: "fsn",
    openingMode: "selected",
    premise:
      "第五次圣杯战争结束半年后的冬木，表面是平稳日常，底下有未解释的异象与反复的四日异闻。日常与怪异的配比、存留角色的状态由开局确认。",
    openingHooks: {
      master: "早上醒来，卧室窗外是熟悉的冬木街景。日历上的日期不对——这一天你确定经历过了。",
      servant:
        "契约的维持感完好，但记忆有半拍延迟——昨天发生了什么？御主正在楼下叫你吃早饭，声音和平时一样。",
      human: "商店街的鱼贩说今天是星期二，但你的手机显示星期四。柳洞寺的方向今天总觉得有些亮。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "jpy-2004-economy"],
    timezone: "Asia/Tokyo",
    startedAt: "2004-10-08T07:00:00.000Z",
    currentAt: "2004-10-08T07:00:00.000Z",
    location: {
      region: "冬木市",
      site: "深山镇",
      detail: "商店街",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "JPY", purseLabel: "随身现金", startingFunds: 50000 },
  },
  apocrypha_2004_trifas: {
    id: "apocrypha_2004_trifas",
    title: "Fate/Apocrypha 叙事",
    timeline: "apocrypha",
    openingMode: "selected",
    premise:
      "2000 年代罗马尼亚特里凡，大圣杯被千界树阵营夺取，红黑两阵营各七骑的大圣杯战争即将开打。阵营归属、裁定者与具体参战者由开局确认；日期是开局占位。",
    openingHooks: {
      master:
        "罗马尼亚千界树城塞的灯火在山脊上闪动。令咒发烫，阵营的颜色印在手背——红或者黑。身边的空气沉了一截，从者正在实体化。",
      servant:
        "召唤的光散去，城堡石壁的火把照亮同阵营的另外六骑从者。七对七的战争，城堡对面那座山头上亮着对家的营火。",
      human:
        "布加勒斯特飞特里凡的末班巴士上，窗外的天空亮了一下。那道光从地面往天上去，拖了很长的尾迹。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "custom"],
    timezone: "Europe/Bucharest",
    startedAt: "2004-07-01T18:00:00.000Z",
    currentAt: "2004-07-01T18:00:00.000Z",
    location: {
      region: "特里凡",
      site: "镇中心",
      detail: "旅馆门前",
      boundary: "normal",
    },
    situation: "investigation",
    economy: { currency: "custom", purseLabel: "随身现金（列伊）", startingFunds: 800 },
  },
  case_files_2003_london: {
    id: "case_files_2003_london",
    title: "君主·埃尔梅罗二世事件簿 叙事",
    timeline: "case-files",
    openingMode: "selected",
    premise:
      "2003 年伦敦时钟塔，魔术世界的阶级、派阀与谜案交织；没有圣杯战争，主调是魔术谜题与政治周旋。玩家身份（学生/外来者/事件关系人）由开局确认。",
    openingHooks: {
      master: "不适用",
      human:
        "时钟塔的走廊比外面冷三度。公告栏上又多了一张失踪启事——这个月第四张了。二世教室的门半开着，里面传来讲义的声音。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "custom"],
    timezone: "Europe/London",
    startedAt: "2003-10-13T08:00:00.000Z",
    currentAt: "2003-10-13T08:00:00.000Z",
    location: {
      region: "伦敦",
      site: "时钟塔",
      detail: "现代魔术科讲师楼·走廊",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "custom", purseLabel: "随身现金（英镑）", startingFunds: 120 },
  },
  tsukihime_2000_misaki: {
    id: "tsukihime_2000_misaki",
    title: "月姬（原作）叙事",
    timeline: "tsukihime-2000",
    openingMode: "selected",
    premise:
      "世纪之交的三咲市，连续猞取事件流言四起，夜晚的街道不再安全。死徒、真祖与退魔世家的阴影在日常之下涌动；玩家身份与卷入方式由开局确认。日期是开局占位。",
    openingHooks: {
      human:
        "回三咲的末班公交上，窗外的月亮把整条河照成白的。下车时站台路灯灭了一盏——灯罩内侧沾了一片半干的黑色粘液。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "custom"],
    timezone: "Asia/Tokyo",
    startedAt: "2000-10-16T07:30:00.000Z",
    currentAt: "2000-10-16T07:30:00.000Z",
    location: {
      region: "三咲市",
      site: "学园区",
      detail: "校门前坡道",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "JPY", purseLabel: "随身现金", startingFunds: 30000 },
  },
  tsukihime_2021_souya: {
    id: "tsukihime_2021_souya",
    title: "月姬 -A piece of blue glass moon- 叙事",
    timeline: "tsukihime-2021",
    openingMode: "selected",
    premise:
      "现代都市总谷，连续猞取事件登上新闻，城市的夜被戏称为「吸血鬼出没」。重制版世界观：场景更都市化，代行者与埋葬机关的压力更近。玩家身份由开局确认；日期是开局占位。",
    openingHooks: {
      human:
        "总谷市的地铁早高峰，手机推送了第三条「夜间袭击事件」。出站后人行道上有一小片被围起来的深色痕迹，清洁车已经到了但迟迟不动手。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "custom"],
    timezone: "Asia/Tokyo",
    startedAt: "2021-10-18T07:30:00.000Z",
    currentAt: "2021-10-18T07:30:00.000Z",
    location: {
      region: "总谷市",
      site: "市街地",
      detail: "通学路·天桥",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "JPY", purseLabel: "随身现金", startingFunds: 30000 },
  },
  knk_1998_mifune: {
    id: "knk_1998_mifune",
    title: "空之境界 叙事",
    timeline: "kara-no-kyoukai",
    openingMode: "selected",
    premise:
      "1998 年观布子市，超常事件以都市怪谈的形态零星发生；伽蓝的魔术与直死之魔眼的问题都在事务所半径内。玩家身份（事务所委托人/卷入者/旁观者）由开局确认。",
    openingHooks: {
      human:
        "伽蓝堂事务所的门铃响了。橙子正用小刀削木偶的手指，头也没抬说「请进」。桌上有一份晨报，角落的标题是「观布子高楼坠落事件·第五例」。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "custom"],
    timezone: "Asia/Tokyo",
    startedAt: "1998-09-14T10:00:00.000Z",
    currentAt: "1998-09-14T10:00:00.000Z",
    location: {
      region: "观布子市",
      site: "市区",
      detail: "伽蓝事务所楼下",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "JPY", purseLabel: "随身现金", startingFunds: 40000 },
  },
  mahoyo_1989_misaki: {
    id: "mahoyo_1989_misaki",
    title: "魔法使之夜 叙事",
    timeline: "mahoyo",
    openingMode: "selected",
    premise:
      "1980 年代末的三咲市，坤波尔拉坎的魔法使与见习魔术师住在山上洋馆；现代化浪潮与神秘的退潮互相拉扯。玩家身份与入局方式由开局确认。",
    openingHooks: {
      human:
        "山坡上的洋馆在十二月的雾里只剩一个轮廓。按了三次门铃没人应，但二楼的窗户亮着光。推门进去的时候闻到了烤面包的味道和一股极淡的焦糊气。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "custom"],
    timezone: "Asia/Tokyo",
    startedAt: "1989-12-04T09:00:00.000Z",
    currentAt: "1989-12-04T09:00:00.000Z",
    location: {
      region: "三咲市",
      site: "市街地",
      detail: "商店街·入口",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "JPY", purseLabel: "随身现金", startingFunds: 20000 },
  },
  prototype_fragments_1991_tokyo: {
    id: "prototype_fragments_1991_tokyo",
    title: "Fate/Prototype 蒼銀のフラグメンツ 叙事",
    timeline: "prototype",
    openingMode: "selected",
    premise:
      "1991 年东京，第一次东京圣杯战争；八骑从者体制，沙条爱歌以异常资质参战，「兽」的预兆笼罩战局。玩家角色身份与阵营由开局确认。",
    openingHooks: {
      master:
        "东京夜空下，令咒的热度刺穿手套。八骑——比标准多一骑。三条街外的方向，空气薄了一层，呼吸都带着压迫感。",
      servant:
        "灵基凝聚在东京的某条后巷；八骑——比通常多一骑。夜风带着现代都市的废气和另一个从者的残留魔力。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "custom"],
    timezone: "Asia/Tokyo",
    startedAt: "1991-02-14T09:00:00.000Z",
    currentAt: "1991-02-14T09:00:00.000Z",
    location: {
      region: "东京",
      site: "新宿区",
      detail: "�的舞伎町外围·街路",
      boundary: "normal",
    },
    situation: "investigation",
    economy: { currency: "JPY", purseLabel: "随身现金", startingFunds: 50000 },
  },
  prototype_199x_tokyo: {
    id: "prototype_199x_tokyo",
    title: "Fate/Prototype 叙事",
    timeline: "prototype",
    openingMode: "selected",
    premise:
      "199X 年东京，第二次东京圣杯战争；沙条绫香与男性 Saber（亚瑟王）的搭档，第一次战争的遗留阴影与爱歌的残响仍在。玩家角色身份与卷入方式由开局确认。",
    openingHooks: {
      master:
        "绫香放学回家路上，街角的猫突然全跑了。左手背的令咒是爸爸留下来的——红色的三划纹路，和他生前照片上的一模一样。",
      servant:
        "第二次东京圣杯战争的召唤。御主是个十几岁的少女，手上有继承来的令咒——上次战争的气味还残留在这座城市里。",
      human:
        "东京某区的便利店夜班，监控画面里有一帧：两个人形从三号楼天台跳到五号楼，中间隔了十二米的车道。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "custom"],
    timezone: "Asia/Tokyo",
    startedAt: "1999-03-01T09:00:00.000Z",
    currentAt: "1999-03-01T09:00:00.000Z",
    location: {
      region: "东京",
      site: "港区",
      detail: "市街地·交叉路口",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "JPY", purseLabel: "随身现金", startingFunds: 50000 },
  },
  samurai_1651_edo: {
    id: "samurai_1651_edo",
    title: "Fate/Samurai Remnant 叙事",
    timeline: "samurai-remnant",
    openingMode: "selected",
    premise:
      "1651 年（庆安四年）江户，「盈月之仪」即将展开；七组御主与从者之外还有逸れのサーヴァント在暗中行动。玩家角色身份与立场由开局确认。",
    openingHooks: {
      master:
        "盈月的光透过障子纸落在榻榻米上。左手背的纹样在月光下浮动——盈月之仪今夜开始。庭院石灯笼旁站着一个人形，影子比灯笼高出一截。",
      servant:
        "灵基在江户的月夜凝聚。脚下铺石路，头顶木造町屋的檐瓦，空气里有木炭、味噌和铁锈。一六五一年的夜风比记忆中任何一次现界都暖。",
      human:
        "江户街头的早市还没收摊，两国桥方向传来一声闷响，水花澆过桥栏。鱼贩抬头看了一眼，说今天是第三回了。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "custom"],
    timezone: "Asia/Tokyo",
    startedAt: "1651-06-15T06:00:00.000Z",
    currentAt: "1651-06-15T06:00:00.000Z",
    location: {
      region: "江户",
      site: "浅草",
      detail: "浅草寺门前町",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "custom", purseLabel: "所持金（文）", startingFunds: 5000 },
  },
  redline_1945_teito: {
    id: "redline_1945_teito",
    title: "Fate/type Redline 帝都圣杯奇谭 叙事",
    timeline: "redline",
    openingMode: "selected",
    premise:
      "1945 年帝都（东京），太平洋战争末期的帝都圣杯战争；军部、魔术师与从者在空袭废墟间交锋。玩家角色身份与卷入方式由开局确认。",
    openingHooks: {
      master:
        "灯火管制下的帝都，月光是唯一的照明。手背的令咒在防空壕的黑暗里发出微光，军部的人管这叫「圣杯战争」。头顶的防空警报刚停，耳朵还在嗡。",
      servant:
        "召唤完成时，头顶的水泥板在抖灰。爆击的余波从地下传上来，御主的军装沾着灰尘，防空壕外面是 1945 年的战时帝都。",
      human:
        "空袭结束后的黎明，废墟里的砖堆下露出一小截金属棱角，凉的，没有被火烤过的痕迹。周围的砖头全烧红了，只有这块冷得扳手。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "custom"],
    timezone: "Asia/Tokyo",
    startedAt: "1945-03-10T06:00:00.000Z",
    currentAt: "1945-03-10T06:00:00.000Z",
    location: {
      region: "帝都（东京）",
      site: "浅草区",
      detail: "烧毁街区边缘",
      boundary: "normal",
    },
    situation: "investigation",
    economy: { currency: "custom", purseLabel: "所持金（军票/日圆）", startingFunds: 500 },
  },
  prisma_2004_fuyuki: {
    id: "prisma_2004_fuyuki",
    title: "Fate/kaleid liner 魔法少女伊莉雅 叙事",
    timeline: "prisma-illya",
    openingMode: "selected",
    premise:
      "平行世界的冬木市，第四次圣杯战争被卫宫切嗣提前拆解，圣杯系统未完成启动。职阶卡散落于镜面世界，远坂凛与露维亚受命回收。伊莉雅作为普通小学生被卷入魔法少女日常。玩家角色身份与卷入方式由开局确认。",
    openingHooks: {
      custom:
        "放学后的穗群原学园，伊莉雅的书包拉链卡住了——然后一根银色的棒状物从天上掉下来，直直插在操场中央。红宝石的声音从里面传出来。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "custom"],
    timezone: "Asia/Tokyo",
    startedAt: "2004-09-01T07:00:00.000Z",
    currentAt: "2004-09-01T07:00:00.000Z",
    location: {
      region: "冬木市",
      site: "穗群原",
      detail: "穗群原小学·校门前",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "JPY", purseLabel: "零花钱", startingFunds: 3000 },
  },
  carnival_phantasm: {
    id: "carnival_phantasm",
    title: "幻想嘉年华 叙事",
    timeline: "carnival-phantasm",
    openingMode: "selected",
    premise:
      "型月全明星喜剧世界——FSN、月姬等作品角色在 Ahnenerbe 咖啡厅为据点的搞笑空间共存；没有真正的死亡与严肃战争，只有无限的闹剧与吐槽。角色组合与闹剧方向由开局确认。",
    openingHooks: {
      custom:
        "Ahnenerbe 咖啡厅的门铃响了第 147 次。Saber 跟 Arcueid 一人捏着蛋糕盘子的一边僵在那里，Lancer 趴在地上，今天第二回了。",
    },
    activeRuleSetIds: ["custom"],
    timezone: "Asia/Tokyo",
    startedAt: "2004-01-01T10:00:00.000Z",
    currentAt: "2004-01-01T10:00:00.000Z",
    location: {
      region: "冬木市（喜剧版）",
      site: "商店街",
      detail: "Ahnenerbe 咖啡厅",
      boundary: "normal",
    },
    situation: "daily",
    economy: { currency: "JPY", purseLabel: "随身现金", startingFunds: 10000 },
  },
  labyrinth_fuyuki_grail: {
    id: "labyrinth_fuyuki_grail",
    title: "Fate/Labyrinth 叙事",
    timeline: "labyrinth",
    openingMode: "selected",
    premise:
      "科巴克·阿尔卡特拉斯的第七迷宫中的亚种圣杯战争。多数从者无御主——亚种圣杯直接将英灵拉入迷宫实体化，仅维持最低限度现界；Saber 是例外：探索队全灭后诺玛成功召唤阿尔托莉雅，召唤完成同时被沙条爱歌憑依，随后由爱歌以御主身份同行。玩家可扮演四骑中任一、沙条爱歌或诺玛；扮演 Saber 时，原作前半部默认御主是占据诺玛身体的爱歌。",
    openingHooks: {
      servant:
        "意识在石壁的冰凉中重新聚拢。若你不是 Saber，灵基只靠亚种圣杯最低限度维持；若你是 Saber，召唤阵残光旁站着占据诺玛身体的沙条爱歌，契约线从她那边接过来。甬道深处传来水滴声，和一种贴着地面走的沉重拖曳音。",
      human:
        "探索队的通讯水晶在三小时前碎了，最后一个同伴的喊声也消失了很久。手电筒照在石壁上，石头泛着不该有的蓝色。拐角后面传来四足踏水的声音，节奏很慢，在靠近。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "fate-rank-combat", "custom"],
    timezone: "Asia/Tokyo",
    startedAt: "2004-02-01T00:00:00.000Z",
    currentAt: "2004-02-01T00:00:00.000Z",
    location: {
      region: "大圣杯内部",
      site: "迷宫·第一层",
      detail: "入口大厅",
      boundary: "otherworld",
    },
    situation: "investigation",
    economy: { currency: "custom", purseLabel: "携带品", startingFunds: 0 },
  },
  custom_worldline: {
    id: "custom_worldline",
    title: "自定义世界线叙事",
    timeline: "custom",
    openingMode: "custom",
    premise:
      "型月世界观下的自定义世界线：年代、城市、是否有圣杯战争及其规模全部由开局问答确认；本 preset 的时间、地点、货币仅为占位，初始化时应被覆盖。",
    openingHooks: {
      custom: "由开局问答确定——入口锚点随世界线设计生成。",
    },
    activeRuleSetIds: ["fate-worldview-filter", "custom"],
    timezone: "UTC",
    startedAt: "2000-01-01T00:00:00.000Z",
    currentAt: "2000-01-01T00:00:00.000Z",
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
