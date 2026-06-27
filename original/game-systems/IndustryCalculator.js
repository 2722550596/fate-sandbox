// 文件: IndustryCalculator.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================

// --- L15300-17027: // ========================================== ---

// ==========================================
// 1. 阵营 (Camp) Schema
// ==========================================
const CampSchema = z
  .object({
    名称: z.string().prefault(""),
    职位: z.string().prefault(""),
    影响力: z.coerce
      .number()
      .transform((v) => _.clamp(v, 0, 100))
      .prefault(0),
    阵营性质: z.string().prefault("中立"),
    声望: z.coerce
      .number()
      .transform((v) => _.clamp(v, 0, 100000))
      .prefault(0),
    核心成员: z.string().prefault(""),
    当前任务: z.string().prefault(""),
    任务描述: z.string().prefault(""),
    任务奖励: z.string().prefault(""),
    敌对阵营: z.string().prefault(""),
    阵营资源: z.record(z.string(), z.string()).prefault({}),
  })
  .passthrough();

// ==========================================
// 2. 军队单位 (Army Unit) Schema
// ==========================================
const ArmyUnitSchema = z.object({
  部队名: z.string().prefault(""),
  部队类型: z.string().prefault(""), // 实例化时会被外层覆盖（如海军、陆军）
  部队精锐等级: z.enum(["1级", "2级", "3级", "4级", "5级"]).prefault("1级"),
  部队数量: z.coerce.number().prefault(0),
  initialized: z.boolean().prefault(false),
  战斗属性: z
    .object({
      活力: z.coerce.number().prefault(0),
      敏捷: z.coerce.number().prefault(0),
      人性: z.coerce.number().prefault(0),
      理智: z.coerce.number().prefault(0),
      当前活力: z.coerce.number().prefault(0),
      当前敏捷: z.coerce.number().prefault(0),
      当前人性: z.coerce.number().prefault(0),
      当前理智: z.coerce.number().prefault(0),
    })
    .prefault({}),
  部队概述: z.string().prefault(""),
});

// ==========================================
// 3. 势力 (Faction) Schema (包含领地、神祇、军队)
// ==========================================
const GodInfoSchema = z.object({
  "半神/真神名称": z.string().prefault(""),
  序列: z.string().prefault(""),
  职位: z.string().prefault(""),
});

const FactionSchema = z
  .object({
    势力名: z.string().prefault("未命名势力"),
    势力类型: z.enum(["世俗领地", "教会", "其它"]).prefault("世俗领地"),
    "<User>的职位": z.string().prefault(""),
    人口数量: z.coerce.number().prefault(0),
    锚的供给量: z.coerce.number().prefault(0),
    锚的需求: z.string().or(z.coerce.number()).prefault(0),
    直辖的半神和真神信息: recordWithMeta(GodInfoSchema).prefault({}),
    实控区域: z
      .object({
        实控区域汇总名单: z.string().prefault(""),
        总面积: z.coerce.number().prefault(0),
      })
      .passthrough()
      .prefault({}),
    世俗军队: z
      .object({
        海军: recordWithMeta(ArmyUnitSchema).prefault({}),
        陆军: recordWithMeta(ArmyUnitSchema).prefault({}),
        空军: recordWithMeta(ArmyUnitSchema).prefault({}),
      })
      .prefault({}),
    势力生产力总需求: z
      .object({
        "1级农产品需求": z.coerce.number().prefault(0),
        "2级农产品需求": z.coerce.number().prefault(0),
        "3级农产品需求": z.coerce.number().prefault(0),
        "4级农产品需求": z.coerce.number().prefault(0),
        "5级农产品需求": z.coerce.number().prefault(0),
        "1级工业品需求": z.coerce.number().prefault(0),
        "2级工业品需求": z.coerce.number().prefault(0),
        "3级工业品需求": z.coerce.number().prefault(0),
        "4级工业品需求": z.coerce.number().prefault(0),
        "5级工业品需求": z.coerce.number().prefault(0),
        "1级服务需求": z.coerce.number().prefault(0),
        "2级服务需求": z.coerce.number().prefault(0),
        "3级服务需求": z.coerce.number().prefault(0),
        "4级服务需求": z.coerce.number().prefault(0),
        "5级服务需求": z.coerce.number().prefault(0),
      })
      .prefault({}),
    势力概述: z.string().prefault(""),
  })
  .passthrough();

// ==========================================
// 4. 生产力总量 (Productivity) Schema
// ==========================================
const ProductivitySchema = z
  .object({
    "1级农产品": z.coerce.number().prefault(0),
    "2级农产品": z.coerce.number().prefault(0),
    "3级农产品": z.coerce.number().prefault(0),
    "4级农产品": z.coerce.number().prefault(0),
    "5级农产品": z.coerce.number().prefault(0),
    "1级工业品": z.coerce.number().prefault(0),
    "2级工业品": z.coerce.number().prefault(0),
    "3级工业品": z.coerce.number().prefault(0),
    "4级工业品": z.coerce.number().prefault(0),
    "5级工业品": z.coerce.number().prefault(0),
    "1级服务": z.coerce.number().prefault(0),
    "2级服务": z.coerce.number().prefault(0),
    "3级服务": z.coerce.number().prefault(0),
    "4级服务": z.coerce.number().prefault(0),
    "5级服务": z.coerce.number().prefault(0),
  })
  .prefault({});

// ==========================================
// 5. 商业产业 (Industry) Schema
// ==========================================

// ----- 产业派生：常量定义 -----

// 基线常量（无负责人的小型产业 → 月收益 5%）
const INDUSTRY_BASELINE = Object.freeze({
  S: 10, // 市场饱和度
  T: 0, // 技术先进指数
  E: 50, // 运营效率
  F: 4, // 固定成本率
  R: 22, // 月均资本回报率
});

// 13 档属性总表（索引 0~12 对应档 0~12）
const INDUSTRY_TIER_TABLE = Object.freeze([
  /*  0 */ Object.freeze({ S: 10, T: 0, E: 50, F: 4, R: 22 }), // 无负责人/识别失败/关系未建立
  /*  1 */ Object.freeze({ S: 13, T: 0, E: 55, F: 4, R: 22 }), // 普通人/兜底
  /*  2 */ Object.freeze({ S: 15, T: 30, E: 60, F: 4, R: 22 }), // 序列9
  /*  3 */ Object.freeze({ S: 16, T: 50, E: 65, F: 4, R: 22 }), // 序列8
  /*  4 */ Object.freeze({ S: 17, T: 80, E: 70, F: 4, R: 22 }), // 序列7
  /*  5 */ Object.freeze({ S: 19, T: 100, E: 70, F: 4, R: 22 }), // 序列6
  /*  6 */ Object.freeze({ S: 21, T: 130, E: 75, F: 4, R: 22 }), // 序列5
  /*  7 */ Object.freeze({ S: 23, T: 170, E: 80, F: 4, R: 22 }), // 序列4
  /*  8 */ Object.freeze({ S: 25, T: 200, E: 85, F: 4, R: 22 }), // 序列3
  /*  9 */ Object.freeze({ S: 27, T: 240, E: 88, F: 4, R: 22 }), // 序列2
  /* 10 */ Object.freeze({ S: 28, T: 270, E: 90, F: 4, R: 22 }), // 序列1
  /* 11 */ Object.freeze({ S: 30, T: 300, E: 94, F: 4, R: 22 }), // 序列0
  /* 12 */ Object.freeze({ S: 30, T: 300, E: 100, F: 3.5, R: 22 }), // 支柱/旧日
]);

// DEBUFF 表
const INDUSTRY_DEBUFF_COLD = Object.freeze({ S: 10, T: 0, E: 50, F: 5, R: 22 }); // 0~29 冷淡档
const INDUSTRY_DEBUFF_LAZY = Object.freeze({ S: 10, T: 0, E: 50, F: 6, R: 22 }); // ≤ -1 怠工档（含 ≤ -70 封底）

// 偏科匹配表：key = 产业类型，value = 命中后享受 +2 档加成的途径名集合
const INDUSTRY_SPECIALTY = Object.freeze({
  第一产业: new Set(["耕种者", "药师", "流浪汉", "萨满", "恶棍"]),
  第二产业: new Set(["通识者", "窥秘人", "学徒"]),
  第三产业: new Set(["掮客", "律师", "仲裁人", "占卜家", "吝啬鬼", "刺客", "天文爱好者"]),
  独立领地: new Set(["水手", "战士", "猎人"]),
});

// 万金油途径（不论产业类型都享受 +1 档加成）
const INDUSTRY_GENERALIST = new Set(["歌颂者", "入门者", "观众", "怪物", "失梦人", "阅读者"]);

// ----- 产业派生：辅助函数 -----

// 数值四舍五入到 1 位小数
function roundFieldToOneDecimal(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 10) / 10;
}

// 线性插值
function lerp(a, b, k) {
  return a + (b - a) * k;
}

// 根据 NPC 当前序列字符串反查所属途径名
//   输入 "序列5-守护者" → 输出 "战士"
//   输入 "" 或查不到 → 输出 ""
function resolvePathwayFromSequence(sequenceStr) {
  const s = String(sequenceStr || "").trim();
  if (!s) return "";
  const pathways =
    typeof GameDBManager !== "undefined" && GameDBManager.DB ? GameDBManager.DB.godPathways : null;
  if (!pathways || typeof pathways !== "object") return "";
  for (const [pathwayFullName, sequenceList] of Object.entries(pathways)) {
    if (Array.isArray(sequenceList) && sequenceList.includes(s)) {
      return pathwayFullName.replace(/途径$/, "").trim();
    }
  }
  return "";
}

// 解析当前序列字符串到 13 档之一
//   返回 { tier, source } 其中 source 是档位来源标签
function parsePrincipalTier(sequenceStr, npcMatched, subjectiveExists) {
  if (!npcMatched) return { tier: 0, source: "unrecognized" };
  if (!subjectiveExists) return { tier: 0, source: "no-relation" };
  const s = String(sequenceStr || "").trim();
  if (s.includes("普通人")) return { tier: 1, source: "normal-person" };
  const seqMatch = s.match(/^序列([0-9])-/);
  if (seqMatch) {
    const seqNum = parseInt(seqMatch[1], 10);
    return { tier: 11 - seqNum, source: "sequence-" + seqNum };
  }
  if (s.startsWith("旧日-")) return { tier: 12, source: "old-day" };
  if (s.startsWith("支柱-")) return { tier: 12, source: "pillar" };
  return { tier: 1, source: "normal-person" }; // 兜底
}

// 应用偏科 / 万金油 / 白板的等效进位规则
function applyPathwaySpecialty(baseTier, pathway, industryType, sourceType) {
  if (
    sourceType === "normal-person" ||
    sourceType === "no-principal" ||
    sourceType === "unrecognized" ||
    sourceType === "no-relation"
  ) {
    return { finalTier: baseTier, specialty: "none" };
  }
  if (baseTier >= 12) return { finalTier: 12, specialty: "none" };
  if (!pathway) return { finalTier: baseTier, specialty: "none" };
  const specialtySet = INDUSTRY_SPECIALTY[industryType];
  if (specialtySet && specialtySet.has(pathway)) {
    return { finalTier: Math.min(12, baseTier + 2), specialty: "matched" };
  }
  if (INDUSTRY_GENERALIST.has(pathway)) {
    return { finalTier: Math.min(12, baseTier + 1), specialty: "generalist" };
  }
  return { finalTier: baseTier, specialty: "none" };
}

// 根据档位与好感度算出 5 个核心字段的最终生效值
function applyAffinityModulation(finalTier, affinity, sourceType) {
  // 第 0 档场景：无负责人/识别失败/关系未建立 → 直接基线，不受好感度影响
  if (
    sourceType === "no-principal" ||
    sourceType === "unrecognized" ||
    sourceType === "no-relation"
  ) {
    return Object.assign({}, INDUSTRY_BASELINE);
  }
  // DEBUFF 区
  if (affinity < 30) {
    return Object.assign({}, affinity <= -1 ? INDUSTRY_DEBUFF_LAZY : INDUSTRY_DEBUFF_COLD);
  }
  // 正效果区：线性插值
  const k = Math.max(0, Math.min(1, (affinity - 30) / 100));
  const target = INDUSTRY_TIER_TABLE[finalTier];
  const baseline = INDUSTRY_BASELINE;
  return {
    S: lerp(baseline.S, target.S, k),
    T: lerp(baseline.T, target.T, k),
    E: lerp(baseline.E, target.E, k),
    F: lerp(baseline.F, target.F, k),
    R: lerp(baseline.R, target.R, k),
  };
}

// 产业 schema 跨表派生规则的 compute 实现（按 8 步顺序）
function computeIndustryFiveFields(value, ctx, helpers) {
  const npcName = String(value["负责人"] || "").trim();

  let sequence = "";
  let affinity = NaN;
  let npcMatched = false;
  let subjectiveExists = false;

  if (npcName) {
    const npcSeq = helpers.readContext("npc_data." + npcName + ".当前序列", undefined);
    if (npcSeq !== undefined) {
      npcMatched = true;
      sequence = String(npcSeq || "");
    }
    const subjAff = helpers.readContext("stat_data.人物关系列表." + npcName + ".好感度", undefined);
    if (subjAff !== undefined) {
      subjectiveExists = true;
      const num = Number(subjAff);
      affinity = Number.isFinite(num) ? Math.max(-200, Math.min(200, num)) : 0;
    }
  }

  // 解析序列归档
  let baseTier, source;
  if (!npcName) {
    baseTier = 0;
    source = "no-principal";
  } else {
    const parsed = parsePrincipalTier(sequence, npcMatched, subjectiveExists);
    baseTier = parsed.tier;
    source = parsed.source;
  }

  // 偏科 / 万金油加成
  const pathway = npcMatched ? resolvePathwayFromSequence(sequence) : "";
  const industryType = String(value["类型"] || "");
  const specialtyResult = applyPathwaySpecialty(baseTier, pathway, industryType, source);
  const finalTier = specialtyResult.finalTier;

  // 好感度调制
  const safeAffinity = Number.isFinite(affinity) ? affinity : 0;
  const finalFields = applyAffinityModulation(finalTier, safeAffinity, source);

  // 写回 5 个核心字段（保留 1 位小数）
  value["市场饱和度"] = roundFieldToOneDecimal(finalFields.S);
  value["技术先进指数"] = roundFieldToOneDecimal(finalFields.T);
  value["运营效率"] = roundFieldToOneDecimal(finalFields.E);
  value["固定成本率"] = roundFieldToOneDecimal(finalFields.F);
  value["月均资本回报率"] = roundFieldToOneDecimal(finalFields.R);

  return value;
}

// ----- 产业 Schema 定义 -----

const IndustrySchema = z
  .object({
    名称: z.string().prefault("未命名产业"),
    类型: z.enum(["独立领地", "第一产业", "第二产业", "第三产业"]).prefault("第一产业"),
    当前投入资本总额: z.string().prefault("0"),
    规模: z.enum(["小型", "中型", "大型"]).prefault("小型"),
    月均资本回报率: z.coerce
      .number()
      .transform((v) => _.clamp(v, -10, 30))
      .prefault(0),
    技术先进指数: z.coerce
      .number()
      .transform((v) => _.clamp(v, -200, 1000))
      .prefault(50),
    固定成本率: z.coerce
      .number()
      .transform((v) => Math.max(0, v))
      .prefault(8),
    运营效率: z.coerce
      .number()
      .transform((v) => _.clamp(v, 0, 100))
      .prefault(50),
    市场饱和度: z.coerce
      .number()
      .transform((v) => _.clamp(v, 0, 100))
      .prefault(50),
    产业情况概述: z.string().optional().prefault(""),
    负责人: z.string().optional().prefault(""), // 🌟 新增：NPC 名字字符串（AI 与玩家可写）
    资产: z.string().optional().prefault(""),
    收入来源: z.string().optional().prefault(""),
    创建时间: z.string().optional(),
    上次结算时间: z.string().optional(),
    生产分配_1级: z.coerce
      .number()
      .transform((v) => _.clamp(v, 0, 100))
      .prefault(100),
    生产分配_2级: z.coerce
      .number()
      .transform((v) => _.clamp(v, 0, 100))
      .prefault(0),
    生产分配_3级: z.coerce
      .number()
      .transform((v) => _.clamp(v, 0, 100))
      .prefault(0),
    生产分配_4级: z.coerce
      .number()
      .transform((v) => _.clamp(v, 0, 100))
      .prefault(0),
    生产分配_5级: z.coerce
      .number()
      .transform((v) => _.clamp(v, 0, 100))
      .prefault(0),
  })
  .passthrough()
  .transform((value) => {
    // 🌟 跨表派生：调用基础设施做强制覆盖（5 个核心字段）
    return window.SchemaDerivation.applyAll("industry", value);
  });

// 注册产业派生规则
window.SchemaDerivation.register({
  id: "industry-five-fields",
  schemaId: "industry",
  compute: computeIndustryFiveFields,
});

// 人物Schema (即NPCSchema)
const CharacterSchema = z
  .object({
    名称: z.string().prefault(""),
    身份: z.string().optional(),
    性格: z.string().optional(),
    外貌: z.string().optional(),
    当前序列: z.string().prefault("普通人"),
    神性: z.coerce.number().prefault(1),
    模板: z.string().prefault("普通"),
    能力体系: z.string().prefault(""),
    当前状态: z.preprocess(
      aiRecordFixer("当前状态"),
      recordWithMeta(z.string(), { $meta: { extensible: true } }),
    ),
    initialized: z.boolean().prefault(false), // 新增标志位，默认 false
    _lastSequence: z.string().optional(), // 用于检测序列变动
    能力清单: z
      .union([
        z.string(), // 兼容旧数据
        z.array(
          z
            .object({
              名称: z.string(),
              描述: z.string().optional().default(""),
              类型: z.string().optional().default("非凡能力"),
            })
            .passthrough(),
        ), // 只校验核心字段，其他字段全部放行
      ])
      .transform((val) => {
        // 如果是字符串，转换为数组格式（兼容旧数据）
        if (typeof val === "string") {
          if (!val || val === "无") return [];
          // 将 "能力1、能力2、能力3" 拆分为数组
          return val.split(/[、，]/).map((name) => ({
            名称: name.trim(),
            描述: "",
            类型: "非凡能力",
          }));
        }
        return val || [];
      })
      .default([]),
    "对<User>的称呼": z.string().prefault(""),
    好感度: z.coerce
      .number()
      .transform((v) => _.clamp(v, -200, 200))
      .prefault(0),
    关系: z.string().optional(),
    持有物品: z.string().optional(),
    所处地点: z.string().optional(),
    正在做的事: z.string().optional(), // 动态行为描述
    事件历史: z.preprocess(aiRecordFixer("记录"), z.record(z.string(), z.string())),
    长期目标: z.string().optional(), // 人物的核心动机
    近期打算: z.string().optional(), // 格式 "Action|Status|Timestamp"
    关键记忆: z
      .preprocess(aiRecordFixer("片段"), z.record(z.string(), z.string()))
      .prefault({})
      .nullable()
      .transform((v) => {
        // 这里的 v 已经是绝对安全的 Record 了，因为上面已经被洗刷+校验过了
        if (v === null || typeof v !== "object") return {};
        const entries = Object.entries(v).filter(([key]) => key !== "$meta");
        const latestEntries = entries.slice(-5);
        return Object.fromEntries(latestEntries);
      })
      .prefault({}),
  })
  .merge(BaseAttributesSchema)
  .merge(CurrentAttributesSchema)
  .passthrough()
  .transform((value) => {
    // ================= 🔥 关键：序列变动检测必须在最前面！ =================
    // 检测序列是否发生变动（必须在属性同步之前执行）
    if (value.initialized && value._lastSequence && value._lastSequence !== value.当前序列) {
      // 序列发生变动，重置初始化标志
      value.initialized = false;
      console.log(
        `[NPC序列变动] ${value.名称} 的序列从 [${value._lastSequence}] 变为 [${value.当前序列}]，触发重新初始化`,
      );
    }

    // 1. 解析神性与分配属性
    const seqRank = parseSequenceRank(value.当前序列);
    value.神性 = getSequenceDivinity(seqRank);
    // 🌟 新增：从世界书动态读取能力体系映射并更新
    // 在初始化过程中强制更新能力体系
    const forceUpdate = !value.initialized;
    value.能力体系 = getAbilitySystemFromWorldbook(value.当前序列, value.能力体系, forceUpdate);

    const baseValue = getSequenceBaseValue(seqRank);
    const multiplier = getAndFixNpcTemplateMultiplier(value, seqRank);
    const totalQuota = baseValue * multiplier;
    const allocatedAttrs = allocateAttributes(totalQuota, value.能力体系);

    Object.keys(BaseAttributesSchema.shape).forEach((attr) => {
      value[attr] = allocatedAttrs[attr];
    });

    // 2. 核心：属性同步与空值修复
    Object.entries(ATTR_MAP).forEach(([currKey, { max: maxKey }]) => {
      const maxVal = Number(value[maxKey]) || 0;

      // 💡 强力捕获：不论是 null, undefined, 还是 NaN，通通判定为失效数据
      const isInvalid = value[currKey] == null || Number.isNaN(Number(value[currKey]));

      // 【核心目标】：未初始化，或当前值已损坏，强行同步为上限值
      if (!value.initialized || isInvalid) {
        value[currKey] = maxVal;
      } else {
        // 确保参与计算的必定是合法数字
        value[currKey] = Math.min(Number(value[currKey]), maxVal);
      }
    });

    // ================= 关键新增区：首次初始化拦截 =================
    if (!value.initialized) {
      const seqRank = parseSequenceRank(value.当前序列);

      // 如果不是普通人，直接强制覆盖 AI 生成的能力，进行严谨的算法抽取
      if (value.当前序列 && !value.当前序列.includes("普通人")) {
        const isAbilityLocked = false; // NPC 无需受玩家的序列能力锁限制
        const abilitiesPool = fetchAvailableAbilities(value.当前序列, isAbilityLocked);

        // 执行抽取，覆盖 AI 填入的数据
        value.能力清单 = generateNpcAbilities(abilitiesPool, seqRank);
      } else {
        // 普通人清空能力
        value.能力清单 = [];
      }

      value.initialized = true;
    }

    // 更新上次序列记录
    value._lastSequence = value.当前序列;

    // // 3. 执行防超模约束（兜底）
    // value = constrainNpcAttributes(value);

    // 🌟 给 NPC 同样挂上动态洗刷探针！
    value = applyDynamicStatus(value, true);
    return value;
  });

// ==========================================
// 1. 玩家主观认知 Schema (stat_data.人物关系列表专用)
// 代表玩家眼中“认为”的NPC状态。一切默认未知。
// ==========================================

// 🌟 态度派生函数：根据好感度自动派生 NPC 对玩家的态度
//   AI 不可写：在 NpcSubjectiveSchema.transform 中强制覆盖
//   阈值与文案对照（左闭右闭区间）：
//     [130, 200] 知己 / [80, 129] 信赖 / [30, 79] 友善
//     [-9, 29]   点头之交 / [-29, -10] 排斥 / [-69, -30] 厌恶 / [-200, -70] 仇视
function deriveAttitudeFromAffinity(affinity) {
  const a = Number(affinity);
  if (!Number.isFinite(a)) return "点头之交";
  if (a >= 130) return "知己";
  if (a >= 80) return "信赖";
  if (a >= 30) return "友善";
  if (a >= -9) return "点头之交";
  if (a >= -29) return "排斥";
  if (a >= -69) return "厌恶";
  return "仇视";
}

const NpcSubjectiveSchema = z
  .object({
    名称: z.string().prefault("未知"),
    身份: z.string().prefault("未知"),
    性格: z.string().prefault("未知"),
    外貌: z.string().prefault("未知"),
    当前序列: z.string().prefault("未知"),
    能力体系: z.string().prefault("未知"),
    // 纯主观独占字段
    "对<User>的称呼": z.string().prefault(""),
    "对<User>的态度": z.string().prefault("点头之交"), // 🌟 新增：派生自好感度，AI 不可写
    好感度: z.coerce
      .number()
      .transform((v) => _.clamp(v, -200, 200))
      .prefault(0),
    关系: z.string().prefault("未知"),
    持有物品: z.string().prefault("未知"),
    所处地点: z.string().prefault("未知"),
  })
  .transform((value) => {
    // 🌟 单 schema 派生：根据 好感度 强制覆盖 对<User>的态度
    //   AI / 编辑器 / _.set 写入的态度值在此被无条件覆盖
    value["对<User>的态度"] = deriveAttitudeFromAffinity(value.好感度);
    return value;
  });
// 🛑 绝对不加 .passthrough()！这是自动洗掉旧版客观冗余数据的关键！
// 剧情中可以体现为由玩家自己猜

// ==========================================
// 2. 客观真实 Schema (npc_data 专用)
// 代表上帝视角下的世界真实记录。
// ==========================================
const NpcObjectiveSchema = z
  .object({
    名称: z.string().prefault(""),
    身份: z.string().prefault(""), // 兼容原本的 optional
    性格: z.string().prefault(""),
    外貌: z.string().prefault(""),
    当前序列: z.string().prefault("普通人"),
    神性: z.coerce.number().prefault(1),
    模板: z.string().prefault("普通"),
    能力体系: z.string().prefault(""),
    当前状态: z
      .preprocess(
        aiRecordFixer("当前状态"),
        recordWithMeta(z.string(), { $meta: { extensible: true } }),
      )
      .prefault({}),

    initialized: z.boolean().prefault(false),
    isImportant: z.boolean().prefault(false),
    _lastSequence: z.string().optional(), // 用于检测序列变动

    能力清单: z
      .union([
        z.string(), // 兼容旧数据
        z.array(
          z
            .object({
              名称: z.string(),
              描述: z.string().optional().default(""),
              类型: z.string().optional().default("非凡能力"),
            })
            .passthrough(),
        ), // 只校验核心字段，其他字段全部放行
      ])
      .transform((val) => {
        // 如果是字符串，转换为数组格式（兼容旧数据）
        if (typeof val === "string") {
          if (!val || val === "无") return [];
          // 将 "能力1、能力2、能力3" 拆分为数组
          return val.split(/[、，]/).map((name) => ({
            名称: name.trim(),
            描述: "",
            类型: "非凡能力",
          }));
        }
        return val || [];
      })
      .default([]),
    持有物品: z.string().prefault(""),
    所处地点: z.string().prefault(""),
    正在做的事: z.string().prefault(""),
    行为链片段: z.string().prefault(""),

    事件历史: z.preprocess(aiRecordFixer("记录"), z.record(z.string(), z.string())).prefault({}),
    长期目标: z.string().prefault(""),
    近期打算: z.string().prefault(""),
    关键记忆: z
      .preprocess(aiRecordFixer("片段"), z.record(z.string(), z.string()))
      .prefault({})
      .nullable()
      .transform((v) => {
        if (v === null || typeof v !== "object") return {};
        const entries = Object.entries(v).filter(([key]) => key !== "$meta");
        return Object.fromEntries(entries.slice(-5));
      })
      .prefault({}),
  })
  .merge(BaseAttributesSchema)
  .merge(CurrentAttributesSchema)
  .passthrough() // 客观域允许扩展，保留 passthrough
  .transform((value) => {
    // ================= 🔥 关键：序列变动检测必须在最前面！ =================
    // 检测序列是否发生变动（必须在属性同步之前执行）
    if (value.initialized && value._lastSequence && value._lastSequence !== value.当前序列) {
      // 序列发生变动，重置初始化标志
      value.initialized = false;
      console.log(
        `[NPC序列变动] ${value.名称} 的序列从 [${value._lastSequence}] 变为 [${value.当前序列}]，触发重新初始化`,
      );
    }

    // 1. 解析神性与分配属性
    const seqRank = parseSequenceRank(value.当前序列);
    value.神性 = getSequenceDivinity(seqRank);
    // 🌟 新增：从世界书动态读取能力体系映射并更新
    // 在初始化过程中强制更新能力体系
    const forceUpdate = !value.initialized;
    value.能力体系 = getAbilitySystemFromWorldbook(value.当前序列, value.能力体系, forceUpdate);

    const baseValue = getSequenceBaseValue(seqRank);
    const multiplier = getAndFixNpcTemplateMultiplier(value, seqRank);
    const totalQuota = baseValue * multiplier;
    const allocatedAttrs = allocateAttributes(totalQuota, value.能力体系);

    Object.keys(BaseAttributesSchema.shape).forEach((attr) => {
      value[attr] = allocatedAttrs[attr];
    });

    // 2. 核心：属性同步与空值修复
    Object.entries(ATTR_MAP).forEach(([currKey, { max: maxKey }]) => {
      const maxVal = Number(value[maxKey]) || 0;

      // 💡 强力捕获：不论是 null, undefined, 还是 NaN，通通判定为失效数据
      const isInvalid = value[currKey] == null || Number.isNaN(Number(value[currKey]));

      // 【核心目标】：未初始化，或当前值已损坏，强行同步为上限值
      if (!value.initialized || isInvalid) {
        value[currKey] = maxVal;
      } else {
        // 确保参与计算的必定是合法数字
        value[currKey] = Math.min(Number(value[currKey]), maxVal);
      }
    });

    // ================= 关键新增区：首次初始化拦截 =================
    if (!value.initialized) {
      const seqRank = parseSequenceRank(value.当前序列);

      // 如果不是普通人，直接强制覆盖 AI 生成的能力，进行严谨的算法抽取
      if (value.当前序列 && !value.当前序列.includes("普通人")) {
        const isAbilityLocked = false; // NPC 无需受玩家的序列能力锁限制
        const abilitiesPool = fetchAvailableAbilities(value.当前序列, isAbilityLocked);

        // 执行抽取，覆盖 AI 填入的数据
        value.能力清单 = generateNpcAbilities(abilitiesPool, seqRank);
      } else {
        // 普通人清空能力
        value.能力清单 = [];
      }

      value.initialized = true;
    }

    // 更新上次序列记录
    value._lastSequence = value.当前序列;

    // // 3. 执行防超模约束（兜底）
    // value = constrainNpcAttributes(value);

    // 🌟 给 NPC 同样挂上动态洗刷探针！
    value = applyDynamicStatus(value, true);
    return value;
  });

// ==========================================
// 3. 全局挂载新的数据池结构
// ==========================================
window.npcDataSchema = recordWithMeta(NpcObjectiveSchema);

window.worldDataSchema = z
  .object({
    当前时间纪元: z.string().prefault(""),
    世界线状态: z.string().prefault("全新的世界线，尚未受到任何蝴蝶效应影响。"),
    // 🕒 时间引擎使用：上次成功处理过的时间纪元（diff 基线）
    _lastTimeEra: z.string().optional(),
    // 🕒 时间引擎使用：每个触发器的累积余数（按分钟），key 为 trigger.id
    _timeTriggerState: z.record(z.string(), z.any()).optional(),
  })
  .passthrough();

// ****************************************************************
// 🕒 TimePassageEngine —— 时间流逝引擎（MVP）
// ----------------------------------------------------------------
// 职责：在每次数据落盘前，比较 world_data.当前时间纪元 与 _lastTimeEra，
//       按"分钟"为内部单位计算前进/倒流，触发已注册的时间触发器。
// 接入：validateAndMigrateStatData 末尾自动调用，覆盖 AI 推数据 / 读档 / 手动编辑等所有路径。
// 用法：window.TimePassageEngine.registerTrigger({ id, unit, interval, handler })
// ****************************************************************
window.TimePassageEngine = (function () {
  // ---------------- 内部时间解析（自包含，不依赖其它模块）----------------
  const CN_DIGIT = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const TIME_REGEX = /第([一二三四五六七八九十\d]+)纪(\d+)年(\d+)月(\d+)日星期(.)(\d+):(\d+)/;

  function parseEra(timeString) {
    if (typeof timeString !== "string" || !timeString.trim()) return null;
    const cleaned = timeString.replace(/\s+/g, "");
    const m = cleaned.match(TIME_REGEX);
    if (!m) return null;
    let era = CN_DIGIT[m[1]] != null ? CN_DIGIT[m[1]] : parseInt(m[1], 10);
    if (Number.isNaN(era)) return null;
    return {
      era,
      year: parseInt(m[2], 10),
      month: parseInt(m[3], 10),
      day: parseInt(m[4], 10),
      hour: parseInt(m[6], 10),
      minute: parseInt(m[7], 10),
    };
  }

  // 把时间转成"绝对分钟"（标准化历法：1年=365天、1月=30天、1日=24小时）
  function toMinutes(t) {
    if (!t) return null;
    return (
      t.era * 10000 * 365 * 24 * 60 +
      t.year * 365 * 24 * 60 +
      t.month * 30 * 24 * 60 +
      t.day * 24 * 60 +
      t.hour * 60 +
      t.minute
    );
  }

  // 单位换算到分钟
  function unitToMinutes(unit) {
    switch (unit) {
      case "minute":
        return 1;
      case "hour":
        return 60;
      case "day":
        return 24 * 60;
      default:
        return null;
    }
  }

  // ---------------- 触发器注册表 ----------------
  const TIME_TRIGGERS = [];

  function registerTrigger(config) {
    if (!config || typeof config !== "object") {
      console.warn("[TimePassage] registerTrigger: 无效配置");
      return;
    }
    const { id, unit, interval, handler } = config;
    if (!id || typeof id !== "string") {
      console.warn("[TimePassage] registerTrigger: 缺少 id");
      return;
    }
    if (unitToMinutes(unit) == null) {
      console.warn(`[TimePassage] registerTrigger(${id}): unit 必须是 minute/hour/day`);
      return;
    }
    if (!Number.isFinite(interval) || interval <= 0) {
      console.warn(`[TimePassage] registerTrigger(${id}): interval 必须是正数`);
      return;
    }
    if (typeof handler !== "function") {
      console.warn(`[TimePassage] registerTrigger(${id}): handler 必须是函数`);
      return;
    }
    // 同 id 覆盖，方便热更新
    const existingIdx = TIME_TRIGGERS.findIndex((t) => t.id === id);
    if (existingIdx >= 0) TIME_TRIGGERS[existingIdx] = config;
    else TIME_TRIGGERS.push(config);
  }

  function listTriggers() {
    return TIME_TRIGGERS.map((t) => ({ id: t.id, unit: t.unit, interval: t.interval }));
  }

  // ---------------- 主入口：应用时间流逝 ----------------
  function applyTimePassage(mvuState) {
    if (!mvuState || typeof mvuState !== "object") return;
    if (!mvuState.world_data) mvuState.world_data = {};
    const wd = mvuState.world_data;

    const newEra = wd.当前时间纪元;
    const oldEra = wd._lastTimeEra;

    // 首次：建立基线，不触发任何 handler
    if (!oldEra) {
      if (newEra) {
        wd._lastTimeEra = newEra;
        console.log(`[TimePassage] 首次记录基线: ${newEra}`);
      }
      return;
    }

    if (!newEra) return; // 当前时间为空，不动

    const oldMin = toMinutes(parseEra(oldEra));
    const newMin = toMinutes(parseEra(newEra));

    // 解析失败：不更新基线，避免坏数据污染下次比对
    if (oldMin == null || newMin == null) {
      console.warn(`[TimePassage] 时间解析失败 old="${oldEra}" new="${newEra}"，跳过`);
      return;
    }

    const diff = newMin - oldMin;

    if (diff === 0) return;

    // 准备触发器状态容器
    if (!wd._timeTriggerState || typeof wd._timeTriggerState !== "object") {
      wd._timeTriggerState = {};
    }
    const state = wd._timeTriggerState;

    // 倒流：按倒流分钟数扣减各触发器余数，clamp 至 0；不调 handler
    if (diff < 0) {
      const absDiff = -diff;
      console.warn(`[TimePassage] 时间倒流 ${absDiff} 分钟，扣减触发器余数`);
      for (const trig of TIME_TRIGGERS) {
        const slot = state[trig.id] || (state[trig.id] = { _remainder: 0 });
        const before = Number(slot._remainder) || 0;
        slot._remainder = Math.max(0, before - absDiff);
      }
      wd._lastTimeEra = newEra;
      return;
    }

    // 正常推进：按分钟累积，floor 出整数 cycles 调 handler
    console.log(`[TimePassage] 时间推进 ${diff} 分钟（${(diff / 1440).toFixed(2)} 天）`);
    for (const trig of TIME_TRIGGERS) {
      const intervalMin = unitToMinutes(trig.unit) * trig.interval;
      const slot = state[trig.id] || (state[trig.id] = { _remainder: 0 });
      const accumulator = (Number(slot._remainder) || 0) + diff;
      const cycles = Math.floor(accumulator / intervalMin);
      slot._remainder = accumulator % intervalMin;

      if (cycles > 0) {
        try {
          trig.handler(cycles, mvuState);
          console.log(
            `[TimePassage] 触发器 "${trig.id}" 触发 ${cycles} 次（余 ${slot._remainder} 分钟）`,
          );
        } catch (err) {
          console.warn(`[TimePassage] 触发器 "${trig.id}" handler 抛出异常:`, err);
        }
      }
    }

    wd._lastTimeEra = newEra;
  }

  return {
    registerTrigger,
    listTriggers,
    applyTimePassage,
    // 暴露内部工具供调试/单测
    _parseEra: parseEra,
    _toMinutes: toMinutes,
  };
})();

// ============================================================
// 💱 CurrencyHelper —— 全局货币工具集
// ----------------------------------------------------------------
// 把"币种字符串 → 货币栏路径 → 加减写入"封装成可复用工具，
// 服务于产业结算 / 长期收入 / 长期支出 / 未来其它资金流模块。
// ============================================================
window.CurrencyHelper = (function () {
  // schema 已声明的 17 种主要币种 → 货币栏路径
  const CURRENCY_PATH_MAP = {
    金镑: ["鲁恩王国", "金镑"],
    银苏勒: ["鲁恩王国", "银苏勒"],
    铜便士: ["鲁恩王国", "铜便士"],
    金霍恩: ["弗萨克帝国", "金霍恩"],
    弗银: ["弗萨克帝国", "弗银"],
    戈比: ["弗萨克帝国", "戈比"],
    费尔金: ["因蒂斯共和国", "费尔金"],
    里克: ["因蒂斯共和国", "里克"],
    科佩: ["因蒂斯共和国", "科佩"],
    金里索: ["费内波特王国", "金里索"],
    塞塔: ["费内波特王国", "塞塔"],
    德根: ["费内波特王国", "德根"],
    萨森金: ["其他", "萨森金"],
    波特金: ["其他", "波特金"],
    兹罗提: ["其他", "兹罗提"],
    花纹金币: ["其他", "花纹金币"],
    德力西: ["其他", "德力西"],
  };

  // 缩写别名（精确等于匹配，不做包含）
  const CURRENCY_ALIASES = {
    镑: "金镑",
    磅: "金镑", // 错别字兼容
    苏勒: "银苏勒",
    便士: "铜便士",
    霍恩: "金霍恩",
    里索: "金里索",
    萨森: "萨森金",
    波特: "波特金",
  };

  // 解析"金额 + 币种"字符串。兼容多种排版：
  //   "1000 金镑" / "1000金镑" / "1000 镑" / "1000镑"
  //   "金镑：1000" / "金镑:1000" / "金镑 1000"
  //   "-50 苏勒"（负数）
  function parseCapitalString(str) {
    if (typeof str === "number") return { value: Math.round(str), currency: "" };
    if (typeof str !== "string" || !str.trim()) return { value: 0, currency: "" };
    const cleaned = str.trim().replace(/[\s,_：:]/g, "");
    const numMatch = cleaned.match(/(-?\d+(?:\.\d+)?)/);
    const value = numMatch ? Math.round(parseFloat(numMatch[1]) || 0) : 0;
    const currency = numMatch ? cleaned.replace(numMatch[0], "").trim() : "";
    return { value, currency };
  }

  // 缩写规整：命中别名则替换，否则原样返回
  function normalizeCurrencyName(raw) {
    if (!raw) return "";
    return CURRENCY_ALIASES[raw] || raw;
  }

  // 找货币栏路径：
  //   空字符串 → 鲁恩王国.金镑
  //   规整后命中 17 种 → 精确入栏
  //   未识别 → 其他.{原字符串}（保留 AI 自定义币种原貌）
  function resolveWalletPath(currency) {
    const trimmed = (currency || "").trim();
    if (!trimmed) return ["鲁恩王国", "金镑"];
    const normalized = normalizeCurrencyName(trimmed);
    if (CURRENCY_PATH_MAP[normalized]) return CURRENCY_PATH_MAP[normalized];
    return ["其他", trimmed];
  }

  // 一站式：解析币种 → 找路径 → 在 wallet 上加减
  // 返回 true 表示成功；false 表示 wallet 损坏跳过。
  // amount 可正可负；label 用于日志。
  function applyCurrencyDelta(wallet, currency, amount, label = "") {
    if (!wallet || typeof wallet !== "object") return false;
    if (!Number.isFinite(amount) || amount === 0) return true;

    const path = resolveWalletPath(currency);
    if (!wallet[path[0]] || typeof wallet[path[0]] !== "object") {
      console.warn(`[货币] 货币栏分组 ${path[0]} 不存在 | ${label}`);
      return false;
    }
    const oldVal = Number(wallet[path[0]][path[1]]) || 0;
    wallet[path[0]][path[1]] = oldVal + amount;

    const sign = amount > 0 ? "+" : "";
    const trimmed = (currency || "").trim();
    console.log(`[货币] ${label} ${sign}${amount} ${trimmed || "金镑"} → ${path.join(".")}`);
    return true;
  }

  return {
    parseCapitalString,
    normalizeCurrencyName,
    resolveWalletPath,
    applyCurrencyDelta,
    // 暴露常量供调试/扩展
    CURRENCY_PATH_MAP,
    CURRENCY_ALIASES,
  };
})();

// ----------------------------------------------------------------
// 🎂 业务触发器：每过 1 年（365 天），自动给玩家身体年龄 / 灵魂年龄 +1n// 累积说明：若一次性推进 N 年，则年龄一次性 +N，余数（不足 1 年的天数）自动结转下次。
// 类型保护：仅在字段能解析为有限数字时才修改，"未知" 等字符串不动。
// ----------------------------------------------------------------
window.TimePassageEngine.registerTrigger({
  id: "auto_age_growth",
  unit: "day",
  interval: 365,
  handler: (cycles, mvuState) => {
    if (!mvuState || !mvuState.stat_data) return;
    const sd = mvuState.stat_data;
    const changes = [];

    const bodyAge = Number(sd.身体年龄);
    if (Number.isFinite(bodyAge)) {
      sd.身体年龄 = bodyAge + cycles;
      changes.push(`身体年龄 ${bodyAge} → ${sd.身体年龄}`);
    }

    const soulAge = Number(sd.灵魂年龄);
    if (Number.isFinite(soulAge)) {
      sd.灵魂年龄 = soulAge + cycles;
      changes.push(`灵魂年龄 ${soulAge} → ${sd.灵魂年龄}`);
    }

    if (changes.length > 0) {
      console.log(`[年龄增长] +${cycles} 年 | ${changes.join("，")}`);
    } else {
      console.log(`[年龄增长] +${cycles} 年 | 无可计算的年龄字段（均为非数字）`);
    }
  },
});

// ----------------------------------------------------------------
// 💚 业务触发器：每天为玩家与所有 NPC 恢复 10% 的当前属性，封顶至上限
// 涵盖：当前活力 / 当前敏捷 / 当前灵性 / 当前理智 / 当前人性（运气无对应当前值）
// 死亡判定：当前活力 ≤ 0（含负数）视为死亡，整个实体跳过恢复，不能复活。
// 其他属性：即使为 0 或负数也照常恢复，向上限靠近。
// 累积说明：若一次性推进 N 天，则一次性按 N 倍恢复，并 clamp 到上限。
// 类型保护：上限或当前值非有限数（含 null、"未知" 等）时跳过该字段；已满则静默跳过。
// ----------------------------------------------------------------
window.TimePassageEngine.registerTrigger({
  id: "auto_attribute_regen",
  unit: "day",
  interval: 1,
  handler: (cycles, mvuState) => {
    if (!mvuState) return;

    const REGEN_RATIO = 0.1; // 每天恢复 10%
    const ATTR_PAIRS = [
      ["当前活力", "活力"],
      ["当前敏捷", "敏捷"],
      ["当前灵性", "灵性"],
      ["当前理智", "理智"],
      ["当前人性", "人性"],
    ];

    const regenEntity = (entity, label) => {
      if (!entity || typeof entity !== "object") return;

      // 💀 死亡判定：当前活力 ≤ 0 视为死亡，整个实体跳过恢复（不能复活）
      // 注：当前活力 可能为负，负值同样代表死亡。
      const vitality = Number(entity.当前活力);
      if (Number.isFinite(vitality) && vitality <= 0) {
        console.log(`[属性恢复] ${label} | 已死亡（当前活力=${vitality}），跳过`);
        return;
      }

      const changes = [];
      for (const [currKey, maxKey] of ATTR_PAIRS) {
        const max = Number(entity[maxKey]);
        const curr = Number(entity[currKey]);
        if (!Number.isFinite(max) || max <= 0) continue;
        if (!Number.isFinite(curr)) continue;
        if (curr >= max) continue;

        const regenPerCycle = Math.floor(max * REGEN_RATIO);
        if (regenPerCycle <= 0) continue; // 上限太小（<10）时无法整数恢复，跳过
        const totalRegen = regenPerCycle * cycles;
        const newVal = Math.min(curr + totalRegen, max);
        if (newVal === curr) continue;

        entity[currKey] = newVal;
        changes.push(`${currKey} ${curr}→${newVal}/${max}`);
      }
      if (changes.length > 0) {
        console.log(`[属性恢复] ${label} | ${changes.join("，")}`);
      }
    };

    // 1. 玩家
    regenEntity(mvuState.stat_data, "<玩家>");

    // 2. 所有 NPC（跳过 $meta 容器键）
    const npcData = mvuState.npc_data;
    if (npcData && typeof npcData === "object") {
      for (const npcName of Object.keys(npcData)) {
        if (npcName === "$meta") continue;
        regenEntity(npcData[npcName], npcName);
      }
    }
  },
});

// ----------------------------------------------------------------
// 🏭 业务触发器：每 7 天自动结算所有产业的收益，直接打入玩家钱包
// 计算方式：复用 IndustrySystem.calculateIndustryReturn 公式（与原手动结算一致）
//   设产业资本 capital，月率 monthlyRate，cycles=N（过了 N 周）。
//   newCapital = calculateIndustryReturn(capital, weeklyRate, N, industry)
//   利润 = newCapital - capital（可正可负）
//   → 利润累加到 stat_data.货币 中对应国家的对应面额
//   → 产业的 当前投入资本总额 不变（不再滚入复利），仅更新 上次结算时间
// 币种映射：根据 当前投入资本总额 字符串里的币种关键字映射到货币栏路径，
//   未识别的币种或自定义币种统一进入 stat_data.货币.其他；空单位默认金镑。
//
// 每个产业利润结算后立即累加对负责人的好感度扣减意图，
//                  循环结束统一应用地板（≤10 不再扣）后写回 人物关系列表。
// ----------------------------------------------------------------

// ----- 好感度扣减辅助函数 -----

// 累加单个产业对负责人的扣减意图
//   阈值需与 GameDBManager.DB.industryConfig.scaleThresholds 同步：
//   小型 < 5000 → 1，中型 [5000, 50000) → 2，大型 ≥ 50000 → 4
function accumulateAffinityDeduction(industry, capital, cycles, affinityDeductions) {
  const npcName = String(industry["负责人"] || "").trim();
  if (!npcName) return;

  let perWeek = 1;
  let scale = "小型";
  if (capital >= 50000) {
    perWeek = 4;
    scale = "大型";
  } else if (capital >= 5000) {
    perWeek = 2;
    scale = "中型";
  }

  const intent = perWeek * cycles;
  const industryName = String(industry["名称"] || "未命名产业");

  if (!affinityDeductions.has(npcName)) {
    affinityDeductions.set(npcName, { totalIntent: 0, sources: [] });
  }
  const slot = affinityDeductions.get(npcName);
  slot.totalIntent += intent;
  slot.sources.push({ industryName: industryName, scale: scale, perWeek: perWeek, intent: intent });
}

// 统一应用地板规则后将扣减写回 人物关系列表
function flushAffinityDeductions(sd, affinityDeductions, mvuState, cycles) {
  if (affinityDeductions.size === 0) return;

  const relationList = sd.人物关系列表;
  if (!relationList || typeof relationList !== "object") {
    console.warn("[产业结算] stat_data.人物关系列表 不存在，跳过好感度扣减");
    return;
  }

  const npcDataPool = mvuState.npc_data || {};

  for (const [npcName, slot] of affinityDeductions.entries()) {
    if (!npcDataPool[npcName]) {
      console.log(`[产业结算] NPC「${npcName}」不在 npc_data，跳过扣减`);
      continue;
    }
    const subj = relationList[npcName];
    if (!subj || typeof subj !== "object") {
      console.log(`[产业结算] NPC「${npcName}」不在 人物关系列表，跳过扣减`);
      continue;
    }

    const hInitial = Number(subj.好感度);
    if (!Number.isFinite(hInitial)) {
      console.warn(`[产业结算] NPC「${npcName}」好感度非数字，跳过扣减`);
      continue;
    }

    if (hInitial <= 10) continue; // 地板：好感度 ≤ 10 不再扣

    const actualDeduction = Math.max(0, Math.min(slot.totalIntent, hInitial - 10));
    if (actualDeduction <= 0) continue;

    subj.好感度 = hInitial - actualDeduction;

    console.log(
      `[产业结算] NPC「${npcName}」好感度 -${actualDeduction}（来自 ${slot.sources.length} 个产业，cycles=${cycles}）`,
    );
  }
}

window.TimePassageEngine.registerTrigger({
  id: "industry_weekly_settle",
  unit: "day",
  interval: 7,
  handler: (cycles, mvuState) => {
    if (!mvuState || !mvuState.stat_data) return;
    const sd = mvuState.stat_data;
    const industries = sd.产业;
    if (!industries || typeof industries !== "object") return;
    if (!sd.货币 || typeof sd.货币 !== "object") {
      console.warn("[产业结算] stat_data.货币 不存在，跳过");
      return;
    }

    const helper = window.CurrencyHelper;
    if (!helper) return;
    const settledTime = mvuState.world_data?.当前时间纪元 || "";
    let settledCount = 0;

    // 🌟 好感度扣减聚合容器
    const affinityDeductions = new Map();

    for (const [industryId, industry] of Object.entries(industries)) {
      if (industryId === "$meta") continue;
      if (!industry || typeof industry !== "object") continue;

      const { value: capital, currency } = helper.parseCapitalString(industry.当前投入资本总额);
      if (capital <= 0) continue;

      // 用现有公式算 N 周后的"假设资本"（cycles 即过了几个 7 天）
      const monthlyRate = Number(industry.月均资本回报率) || 0;
      const weeklyRate = monthlyRate / 4;

      let newCapitalStr;
      try {
        newCapitalStr = window.GAME_DATA?.IndustrySystem?.calculateIndustryReturn?.(
          industry.当前投入资本总额 || "0",
          weeklyRate,
          cycles,
          industry,
        );
      } catch (err) {
        console.warn(`[产业结算] ${industry.名称 || industryId} 计算失败:`, err);
        continue;
      }
      if (typeof newCapitalStr !== "string") continue;

      const { value: newCapital } = helper.parseCapitalString(newCapitalStr);
      const profit = newCapital - capital;
      if (profit === 0) {
        // 利润 0 也更新 上次结算时间
        industry.上次结算时间 = settledTime || industry.上次结算时间;
        // 利润 0 也累加好感度扣减（NPC 仍在岗）
        accumulateAffinityDeduction(industry, capital, cycles, affinityDeductions);
        continue;
      }

      const ok = helper.applyCurrencyDelta(
        sd.货币,
        currency,
        profit,
        `产业「${industry.名称 || industryId}」${cycles}周收益`,
      );
      if (!ok) continue;

      // 更新产业的 上次结算时间（资本不变）
      industry.上次结算时间 = settledTime || industry.上次结算时间;
      settledCount++;

      // 🌟 利润入账后立即累加好感度扣减意图
      accumulateAffinityDeduction(industry, capital, cycles, affinityDeductions);
    }

    // 🌟 循环结束统一应用地板并写回
    flushAffinityDeductions(sd, affinityDeductions, mvuState, cycles);

    if (settledCount > 0) {
      console.log(`[产业结算] 本轮共结算 ${settledCount} 个产业（${cycles}周）`);
    }
  },
});

// ----------------------------------------------------------------
// 💵 业务触发器：每天检查所有"稳定长期收入/支出"条目，按各自周期自动结算
// 数据来源：stat_data.稳定长期收入 / stat_data.稳定长期支出
// 每条目结构：{ 金额: "10 金镑", 周期: "天/周/月/年", 上次结算时间: "..." }
// 计算方式：
//   periods = floor((当前游戏时间 - 上次结算时间) / 周期天数)
//   总额 = 单次金额 × periods，收入 +、支出 -
//   命中后立即把 上次结算时间 推进到当前时间（吃掉余数，与产业系统一致）
// 首次未填 上次结算时间 时：仅初始化为当前时间，本次不结算（防止刚加条目就扣钱）
// 周期天数：天=1, 周=7, 月=30, 年=365（标准化历法，跟项目其它模块一致）
// ----------------------------------------------------------------
window.TimePassageEngine.registerTrigger({
  id: "stable_cashflow_settle",
  unit: "day",
  interval: 1,
  handler: (cycles, mvuState) => {
    if (!mvuState || !mvuState.stat_data) return;
    const sd = mvuState.stat_data;
    if (!sd.货币 || typeof sd.货币 !== "object") return;

    const settledTime = mvuState.world_data?.当前时间纪元 || "";
    if (!settledTime) return;

    const helper = window.CurrencyHelper;
    if (!helper) return;

    // 用 TimePassageEngine 自带的时间工具算天数差
    const engine = window.TimePassageEngine;
    const newMin = engine?._toMinutes?.(engine?._parseEra?.(settledTime));
    if (!Number.isFinite(newMin)) return;

    const PERIOD_DAYS = { 天: 1, 周: 7, 月: 30, 年: 365 };

    const processGroup = (group, sign, label) => {
      if (!group || typeof group !== "object") return;
      for (const [name, entry] of Object.entries(group)) {
        if (name === "$meta") continue;
        if (!entry || typeof entry !== "object") continue;

        const { value: amount, currency } = helper.parseCapitalString(entry.金额);
        if (amount <= 0) continue; // 只接受正数金额，方向由 sign 决定

        const periodKey = String(entry.周期 || "月");
        const periodDays = PERIOD_DAYS[periodKey];
        if (!Number.isFinite(periodDays) || periodDays <= 0) continue;

        // 首次未填 上次结算时间 → 初始化基线，本次不结算
        if (!entry.上次结算时间) {
          entry.上次结算时间 = settledTime;
          continue;
        }

        const oldMin = engine._toMinutes(engine._parseEra(entry.上次结算时间));
        if (!Number.isFinite(oldMin)) {
          // 时间字符串损坏，重置为当前时间
          entry.上次结算时间 = settledTime;
          continue;
        }

        const daysDiff = (newMin - oldMin) / 1440;
        if (daysDiff <= 0) continue; // 时间未推进或倒流，跳过

        const periods = Math.floor(daysDiff / periodDays);
        if (periods <= 0) continue;

        const totalDelta = amount * periods * sign; // 收入正 / 支出负
        const ok = helper.applyCurrencyDelta(
          sd.货币,
          currency,
          totalDelta,
          `${label}「${name}」${periods}${periodKey}`,
        );
        if (!ok) continue;

        // 推进基线（吃掉余数，跟产业系统一致）
        entry.上次结算时间 = settledTime;
      }
    };

    processGroup(sd.稳定长期收入, +1, "稳定长期收入");
    processGroup(sd.稳定长期支出, -1, "稳定长期支出");
  },
});

// ****************************************************************
// 💰 货币 Schema（玩家钱包）
// ----------------------------------------------------------------
// 4 个主要国家有明确换算关系（写在 CURRENCY_RULES）：
//   - 鲁恩王国: 1 金镑 = 20 银苏勒 = 240 铜便士
//   - 弗萨克帝国: 1 金霍恩 = 10 弗银 = 100 戈比
//   - 因蒂斯共和国: 1 费尔金 = 20 里克 = 100 科佩
//   - 费内波特王国: 1 金里索 = 10 塞塔 = 100 德根
// 行为：
//   1. 自动借位：低面额负数时从高面额借（"全转最小单位 + 重新分配"算法）
//   2. 自动进位：低面额超阈值时合并到高面额
//   3. 整体负债时高面额扛负号（数学上 -240 便士 → -1 金镑 0 苏勒 0 便士）
// "其他" 分组无明确换算，原样保留，不参与重排。
// 货币变动记录：自动保留最近 5 条（同 NPC.关键记忆 模式），AI 用时间戳作 key。
// ****************************************************************
const CURRENCY_RULES = {
  鲁恩王国: {
    fields: ["金镑", "银苏勒", "铜便士"],
    rates: [240, 12, 1], // 折算到最小单位（铜便士）的倍率
  },
  弗萨克帝国: {
    fields: ["金霍恩", "弗银", "戈比"],
    rates: [100, 10, 1],
  },
  因蒂斯共和国: {
    fields: ["费尔金", "里克", "科佩"],
    rates: [100, 5, 1], // 1 费尔金 = 20 里克 = 100 科佩，故 1 里克 = 5 科佩
  },
  费内波特王国: {
    fields: ["金里索", "塞塔", "德根"],
    rates: [100, 10, 1],
  },
};

// 重整一个国家的钱袋：先全部转最小单位，再从大到小重新分配
const normalizeCountryWallet = (wallet, rule) => {
  const total = rule.fields.reduce((sum, key, i) => {
    const v = Number(wallet[key]);
    return sum + (Number.isFinite(v) ? v : 0) * rule.rates[i];
  }, 0);
  const result = {};
  let remain = total;
  rule.fields.forEach((key, i) => {
    const rate = rule.rates[i];
    if (i === rule.fields.length - 1) {
      result[key] = remain; // 最小单位拿剩下的
    } else {
      const portion = Math.trunc(remain / rate); // 向 0 截断（负数也按数学方向）
      result[key] = portion;
      remain -= portion * rate;
    }
  });
  return result;
};

const CurrencySchema = z
  .object({
    $meta: z.object({ extensible: z.boolean().prefault(false) }).prefault({ extensible: false }),
    鲁恩王国: z
      .object({
        金镑: z.coerce.number().prefault(0),
        银苏勒: z.coerce.number().prefault(0),
        铜便士: z.coerce.number().prefault(0),
      })
      .prefault({ 金镑: 0, 银苏勒: 0, 铜便士: 0 }),
    弗萨克帝国: z
      .object({
        金霍恩: z.coerce.number().prefault(0),
        弗银: z.coerce.number().prefault(0),
        戈比: z.coerce.number().prefault(0),
      })
      .prefault({ 金霍恩: 0, 弗银: 0, 戈比: 0 }),
    因蒂斯共和国: z
      .object({
        费尔金: z.coerce.number().prefault(0),
        里克: z.coerce.number().prefault(0),
        科佩: z.coerce.number().prefault(0),
      })
      .prefault({ 费尔金: 0, 里克: 0, 科佩: 0 }),
    费内波特王国: z
      .object({
        金里索: z.coerce.number().prefault(0),
        塞塔: z.coerce.number().prefault(0),
        德根: z.coerce.number().prefault(0),
      })
      .prefault({ 金里索: 0, 塞塔: 0, 德根: 0 }),
    其他: z
      .object({
        $meta: z.object({ extensible: z.boolean().prefault(true) }).prefault({ extensible: true }),
        萨森金: z.coerce.number().prefault(0),
        波特金: z.coerce.number().prefault(0),
        兹罗提: z.coerce.number().prefault(0),
        花纹金币: z.coerce.number().prefault(0),
        德力西: z.coerce.number().prefault(0),
      })
      .passthrough()
      .prefault({
        $meta: { extensible: true },
        萨森金: 0,
        波特金: 0,
        兹罗提: 0,
        花纹金币: 0,
        德力西: 0,
      }),
    // 最近 5 条货币变动记录：AI 用时间戳作 key，描述作 value
    货币变动记录: z
      .preprocess(aiRecordFixer("变动"), z.record(z.string(), z.string()))
      .prefault({})
      .nullable()
      .transform((v) => {
        if (v === null || typeof v !== "object") return {};
        const entries = Object.entries(v).filter(([key]) => key !== "$meta");
        return Object.fromEntries(entries.slice(-5));
      })
      .prefault({}),
  })
  .prefault({})
  .transform((value) => {
    // 仅对 4 个主要国家做"借位 + 进位"重整；"其他" 分组原样保留
    for (const country of Object.keys(CURRENCY_RULES)) {
      const rule = CURRENCY_RULES[country];
      if (!value[country] || typeof value[country] !== "object") continue;
      const normalized = normalizeCountryWallet(value[country], rule);
      Object.assign(value[country], normalized);
    }
    return value;
  });

// ****************************************************************
// 💵 稳定长期现金流 Schema（玩家工资 / 房租 / 佣人工钱 / 分红等）
// ----------------------------------------------------------------
// 每条目格式：
//   { 金额: "10 金镑", 周期: "天/周/月/年", 上次结算时间: "..." }
// 由 stable_cashflow_settle 触发器每天检查，按周期自动入账或扣款。
// $meta.extensible: true 允许 AI 增删条目（玩家被解雇/搬家等情况下）。
// ****************************************************************
const StableCashflowEntrySchema = z
  .object({
    金额: z.string().prefault("0"),
    周期: z.enum(["天", "周", "月", "年"]).prefault("月"),
    上次结算时间: z.string().optional(),
  })
  .passthrough();

// ****************************************************************
// 主Schema（玩家Schema）（含.transform(value =>进行数据迁移）
// *****************************************************************
// 🔧 配置：消化进度单次变动幅度上限
//   规则：除归0外，单次变动只能在 [0, DIGESTION_MAX_DELTA] 区间内（即只能小幅上涨或不变）；
//   超出此范围（下降、或上涨过快）则视为非法变动，回退到上一次的值。
//   首次启动时使用此默认值，之后由「系统设置」面板接管，写入 AppStorage 持久化。
window.DIGESTION_MAX_DELTA = 3;
window.statDataSchema = z
  .object({
    // 🌟 第一道锁：明确告诉 AI 根目录禁止扩展！
    $meta: z
      .object({
        extensible: z.boolean().prefault(false),
      })
      .prefault({ extensible: false }),
    名称: z.string().prefault("<User>"),
    性别: z.string().prefault("男"),
    当前序列: z.string().prefault("序列9-占卜家"),
    晋升体系: z.string().prefault("魔药"),
    能力体系: z.string().prefault(""),
    神性: z.coerce.number().prefault(1),
    消化进度: z.coerce
      .number()
      .transform((v) => _.clamp(v, 0, 100))
      .prefault(0),
    失控进度: z.coerce
      .number()
      .transform((v) => _.clamp(v, 0, 100))
      .prefault(0),
    当前状态: z.preprocess(
      aiRecordFixer("当前状态"),
      recordWithMeta(z.string(), { $meta: { extensible: true } }),
    ),

    initialized: z.boolean().prefault(false), // 玩家也需要这个标志位
    _lastSequence: z.string().optional(), // 用于检测序列变动
    _lastDigestion: z.coerce.number().optional(), // 用于限制消化进度单次变动幅度

    非凡特性列表: recordWithMeta(TraitSchema, undefined, "非凡特性"),
    扮演法列表: recordWithMeta(PlayMethodSchema, undefined, "扮演法").transform(
      constrainSingleEquipment,
    ),
    辅助能力列表: recordWithMeta(PlayMethodSchema, undefined, "辅助能力").transform(
      constrainSingleEquipment,
    ),
    武器列表: recordWithMeta(ItemSchema, undefined, "武器").transform(constrainSingleEquipment),
    衣物列表: recordWithMeta(ItemSchema, undefined, "衣物").transform(constrainSingleEquipment),
    饰品列表: recordWithMeta(ItemSchema, undefined, "饰品").transform(constrainSingleEquipment),
    封印物列表: recordWithMeta(ItemSchema, undefined, "封印物").transform(constrainSingleEquipment),

    人物关系列表: recordWithMeta(NpcSubjectiveSchema), // 什么都不传，默认带标准 $meta
    消耗品列表: recordWithMeta(ConsumableItemSchema),
    其他列表: recordWithMeta(StackableItemSchema),

    // 💰 货币模块（自动借位/进位 + 变动记录保留最近5条）
    // 4 个主要国家有明确换算关系，会自动整理面额；其他分组无明确换算，保持原样。
    货币: CurrencySchema,

    // 💵 稳定长期收入：工资、分红、房产收益等定期入账
    稳定长期收入: recordWithMeta(StableCashflowEntrySchema, undefined, "稳定长期收入"),
    // 💸 稳定长期支出：房租、佣人工钱、保险等定期扣款
    稳定长期支出: recordWithMeta(StableCashflowEntrySchema, undefined, "稳定长期支出"),

    // 序列能力列表: z.array(SequenceAbilitySchema).prefault([]),
    序列能力列表: AbilitiesRecordSchema.catch({}),
    序列能力列表: AbilitiesRecordSchema.catch({}),

    当前周目: z.coerce.number().prefault(1),
    当前区域: z.string().prefault("鲁恩王国"),
    当前地标: z.string().prefault("廷根"),
    当前坐标: z
      .object({
        x: z.coerce.number().prefault(55.36),
        y: z.coerce.number().prefault(26.34),
      })
      .prefault({ x: 55.36, y: 26.34 }),

    灵性聚合度: z.coerce.number().prefault(10),
    灵魂年龄: z.union([z.number(), z.string()]).prefault(25),
    灵魂年龄上限: z.union([z.number(), z.string()]).prefault("未知"),
    身体年龄: z.union([z.number(), z.string()]).prefault(25),
    身体年龄上限: z.union([z.number(), z.string()]).prefault("未知"),
    剧场点数: z.coerce.number().prefault(0),

    // 🌍 宏观世界模块 (组装刚才拆分出来的 Schema)
    阵营: recordWithMeta(CampSchema, {}),
    生产力: ProductivitySchema,
    产业: recordWithMeta(
      IndustrySchema,
      { $meta: { extensible: true, 总估值: "", 上次计算时间: "" } },
      "产业",
    ),

    势力: recordWithMeta(FactionSchema, { $meta: { extensible: true } }, "势力").transform(
      (factions) => {
        Object.keys(factions).forEach((factionKey) => {
          if (factionKey === "$meta") return;
          const faction = factions[factionKey];
          let totalArea = 0;
          let totalPop = 0;
          let regionNames = [];
          if (faction.实控区域) {
            Object.keys(faction.实控区域).forEach((rKey) => {
              if (rKey !== "实控区域汇总名单" && rKey !== "总面积" && rKey !== "$meta") {
                const region = faction.实控区域[rKey];
                if (typeof region === "object" && region !== null) {
                  totalArea += Number(region.区域面积) || 0;
                  totalPop += Number(region.区域人口) || 0;
                  const rName = region.区域名 || rKey;
                  if (rName) regionNames.push(rName);
                }
              }
            });
            faction.实控区域.总面积 = totalArea;
            faction.实控区域.实控区域汇总名单 = regionNames.join("；");
          }
          faction.人口数量 = totalPop;
          faction.锚的供给量 = totalPop;
          const fConf =
            typeof GameDBManager !== "undefined"
              ? GameDBManager.DB.factionConfig
              : {
                  anchorDemands: {},
                  armyStats: {},
                  productivityDemands: { 农产品: {}, 工业品: {}, 服务: {} },
                };
          let anchorDemand = 0;
          if (faction.直辖的半神和真神信息) {
            Object.values(faction.直辖的半神和真神信息).forEach((god) => {
              if (god === null || typeof god !== "object") return;
              const seqStr = String(god.序列 || "");
              if (seqStr.includes("支柱")) anchorDemand += fConf.anchorDemands["支柱"] || 5000000;
              else if (seqStr.includes("旧日"))
                anchorDemand += fConf.anchorDemands["旧日"] || 3000000;
              else {
                const match = seqStr.match(/[0-9.]+/);
                if (match) {
                  const numStr = match[0];
                  if (fConf.anchorDemands[numStr] !== undefined)
                    anchorDemand += fConf.anchorDemands[numStr];
                  else {
                    const num = parseFloat(numStr);
                    if (num === 4) anchorDemand += 10000;
                    else if (num === 3) anchorDemand += 50000;
                    else if (num === 2) anchorDemand += 100000;
                    else if (num <= 1 && num >= 0.8) anchorDemand += 200000;
                    else if (num <= 0.5 && num >= 0.3) anchorDemand += 400000;
                    else if (num <= 0.1) anchorDemand += 1000000;
                  }
                }
              }
            });
          }
          faction.锚的需求 = anchorDemand;
          const armyCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          const levelStats = fConf.armyStats || {
            "1级": { v: 50, a: 40, h: 20, s: 20 },
            "2级": { v: 90, a: 60, h: 30, s: 30 },
            "3级": { v: 500, a: 200, h: 100, s: 100 },
            "4级": { v: 1500, a: 800, h: 500, s: 500 },
            "5级": { v: 6000, a: 3000, h: 1000, s: 1000 },
          };
          ["海军", "陆军", "空军"].forEach((branch) => {
            if (faction.世俗军队 && faction.世俗军队[branch]) {
              Object.keys(faction.世俗军队[branch]).forEach((uKey) => {
                if (uKey === "$meta") return;
                const unit = faction.世俗军队[branch][uKey];
                const level = unit.部队精锐等级 || "1级";
                const qty = Number(unit.部队数量) || 0;
                const lvNum = parseInt(level);
                if (lvNum >= 1 && lvNum <= 5) armyCounts[lvNum] += qty;
                const multipliers = levelStats[level] ||
                  levelStats["1级"] || { v: 0, a: 0, h: 0, s: 0 };
                if (!unit.战斗属性) unit.战斗属性 = {};
                unit.战斗属性.活力 = qty * (multipliers.v || 0);
                unit.战斗属性.敏捷 = qty * (multipliers.a || 0);
                unit.战斗属性.人性 = qty * (multipliers.h || 0);
                unit.战斗属性.理智 = qty * (multipliers.s || 0);
                if (!unit.initialized) {
                  unit.战斗属性.当前活力 = unit.战斗属性.活力;
                  unit.战斗属性.当前敏捷 = unit.战斗属性.敏捷;
                  unit.战斗属性.当前人性 = unit.战斗属性.人性;
                  unit.战斗属性.当前理智 = unit.战斗属性.理智;
                  unit.initialized = true;
                } else {
                  unit.战斗属性.当前活力 = Math.min(
                    Number(unit.战斗属性.当前活力) || 0,
                    unit.战斗属性.活力,
                  );
                  unit.战斗属性.当前敏捷 = Math.min(
                    Number(unit.战斗属性.当前敏捷) || 0,
                    unit.战斗属性.敏捷,
                  );
                  unit.战斗属性.当前人性 = Math.min(
                    Number(unit.战斗属性.当前人性) || 0,
                    unit.战斗属性.人性,
                  );
                  unit.战斗属性.当前理智 = Math.min(
                    Number(unit.战斗属性.当前理智) || 0,
                    unit.战斗属性.理智,
                  );
                }
              });
            }
          });
          const pop = totalPop;
          const c1 = armyCounts[1],
            c2 = armyCounts[2],
            c3 = armyCounts[3],
            c4 = armyCounts[4],
            c5 = armyCounts[5];
          if (!faction.势力生产力总需求) faction.势力生产力总需求 = {};
          const req = faction.势力生产力总需求;
          const pDemands = fConf.productivityDemands || {};
          const calcDemand = (type, level) => {
            const rules =
              pDemands[type] && pDemands[type][level]
                ? pDemands[type][level]
                : { pop: 0, c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };
            return Math.round(
              pop * (rules.pop || 0) +
                c1 * (rules.c1 || 0) +
                c2 * (rules.c2 || 0) +
                c3 * (rules.c3 || 0) +
                c4 * (rules.c4 || 0) +
                c5 * (rules.c5 || 0),
            );
          };
          ["农产品", "工业品", "服务"].forEach((type) => {
            for (let i = 1; i <= 5; i++) {
              req[`${i}级${type}需求`] = calcDemand(type, `${i}级`);
            }
          });
        });
        return factions;
      },
    ),
  })
  .merge(PlayerBaseFloorSchema) // 基础活力...
  .merge(BaseAttributesSchema) // 活力... (上限)
  .merge(CurrentAttributesSchema) // 当前活力...
  .passthrough()
  .transform((value) => {
    // ================= 🔥 关键：序列变动检测必须在最前面！ =================
    // 检测序列是否发生变动（必须在属性同步之前执行）
    if (value.initialized && value._lastSequence && value._lastSequence !== value.当前序列) {
      // 序列发生变动，清零消化进度，并重置 initialized 触发能力体系等强制刷新
      value.消化进度 = 0;
      value.initialized = false;
      console.log(
        `[玩家序列变动] 序列从 [${value._lastSequence}] 变为 [${value.当前序列}]，消化进度已清零，initialized 已重置`,
      );
    }

    // ================= 🔒 消化进度单次变动幅度限制 =================
    // 规则：归0特例不受限（晋升）；首次加载不受限；
    //      其余情况下：上涨幅度超过 DIGESTION_MAX_DELTA 时，截断到 旧值+上限；
    //      下降视为非法变动，回退到上一次的值。
    {
      const MAX_DELTA = Number(window.DIGESTION_MAX_DELTA) || 3;
      const newDig = Number(value.消化进度) || 0;
      const oldDig = value._lastDigestion;
      const hasOld = oldDig !== undefined && oldDig !== null && !Number.isNaN(Number(oldDig));

      if (newDig !== 0 && hasOld) {
        const oldNum = Number(oldDig);
        const delta = newDig - oldNum;
        if (delta < 0) {
          console.log(`[消化进度限制] 单次变动 ${delta} 为下降，回退至上一次值 ${oldNum}`);
          value.消化进度 = oldNum;
        } else if (delta > MAX_DELTA) {
          const capped = oldNum + MAX_DELTA;
          console.log(
            `[消化进度限制] 单次变动 ${delta} 超过上限 ${MAX_DELTA}，截断至 ${capped}（旧值 ${oldNum}）`,
          );
          value.消化进度 = capped;
        }
      }
      // 记录本次最终值，供下次比对
      value._lastDigestion = Number(value.消化进度) || 0;
    }

    // ========== 数据迁移逻辑 ==========
    // 将"主要扮演法"字段重命名为"扮演法"
    if (value.主要扮演法 !== undefined) {
      if (!value.扮演法) {
        value.扮演法 = value.主要扮演法;
      }
    }
    // 移除旧版本中的装备类冗余字段：武器、封印物、衣物、饰品
    const fieldsToRemove = [
      "武器",
      "封印物",
      "衣物",
      "饰品",
      "扮演法",
      "辅助能力",
      "主要扮演法",
      "当前时间纪元",
    ];
    fieldsToRemove.forEach((field) => {
      if (value[field] !== undefined) {
        delete value[field];
        console.log(`[Schema迁移] 已删除旧字段: "${field}"`);
      }
    });
    // ========== 迁移逻辑结束 ==========
    //强制分配属性
    // 1. 神性与属性计算
    const sequenceRank = parseSequenceRank(value.当前序列);
    value.神性 = getSequenceDivinity(sequenceRank);

    // --- 序列变动时强制刷新能力体系；未变动则按原有兜底逻辑保持 ---
    const forceUpdate = !value.initialized;
    value.能力体系 = getAbilitySystemFromWorldbook(value.当前序列, value.能力体系, forceUpdate);

    const baseValue = getSequenceBaseValue(sequenceRank);
    // 玩家无模板，直接将基准总值分配给"基础属性"
    const allocatedAttrs = allocateAttributes(baseValue, value.能力体系);

    // 修复点：明确解构，避免键名拼接错误
    const baseKeys = ["活力", "灵性", "理智", "人性", "敏捷", "运气"];
    baseKeys.forEach((attr) => {
      // 假设 allocatedAttrs 的 key 是 '活力'
      value[`基础${attr}`] = allocatedAttrs[attr] || 0;
    });
    value.基准总值 = baseValue;

    // 初始计算一次上限并写入（此时可能没装备，只有基础值和天赋）
    const initialMax = calculateRealMaxAttributes(value);

    // ========== 初始化拉满 & 日常防溢出防线 ==========
    GLOBAL_ATTR_CONFIG.forEach((attr) => {
      const maxKey = attr.key;
      const currKey = attr.currentVar;

      // 强制把计算出的上限写入 Schema 根节点
      value[maxKey] = initialMax[maxKey] || value[`基础${maxKey}`] || 0;

      if (value[currKey] !== undefined) {
        const isInvalid = value[currKey] == null || Number.isNaN(Number(value[currKey]));
        if (!value.initialized || isInvalid) {
          value[currKey] = value[maxKey]; // 初始化/坏死补满
        } else {
          value[currKey] = Math.min(Number(value[currKey]), value[maxKey]); // 削峰
        }
      }
    });

    value.initialized = true;

    // 🌟 强行洗刷一遍动态状态！
    value = applyDynamicStatus(value, false);

    // 更新上次序列记录
    value._lastSequence = value.当前序列;

    // 🌟 第二道锁：物理封闭根对象结构！
    value.$meta = { extensible: false };
    return value;
  });

// 保留本地schema引用
const schema = window.statDataSchema;

function migrateCurrentTimeEraDomain(mvuState, fallbackEra = "") {
  if (!mvuState || typeof mvuState !== "object") return false;

  let hasChanged = false;
  if (
    !mvuState.world_data ||
    typeof mvuState.world_data !== "object" ||
    Array.isArray(mvuState.world_data)
  ) {
    mvuState.world_data = {};
    hasChanged = true;
  }

  const legacyEra = mvuState.stat_data?.当前时间纪元;
  const currentEra = mvuState.world_data?.当前时间纪元;

  if (legacyEra && (!currentEra || currentEra === "" || currentEra === "未知")) {
    console.log(`[数据架构升级] 正在同步世界纪元: ${legacyEra}`);
    mvuState.world_data.当前时间纪元 = legacyEra;
    hasChanged = true;
  } else if (fallbackEra && (!currentEra || currentEra === "" || currentEra === "未知")) {
    mvuState.world_data.当前时间纪元 = fallbackEra;
    hasChanged = true;
  }

  if (
    mvuState.stat_data &&
    Object.prototype.hasOwnProperty.call(mvuState.stat_data, "当前时间纪元")
  ) {
    delete mvuState.stat_data.当前时间纪元;
    hasChanged = true;
  }

  return hasChanged;
}
