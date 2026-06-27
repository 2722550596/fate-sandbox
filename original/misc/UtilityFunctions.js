// 文件: UtilityFunctions.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================

// --- L13727-14645: // ========封装工具函数========== ---

// ========封装工具函数==========
// 定义一个安全的正则生成器助手
const createSafeRegex = (tagName, isGlobal = true) => {
  // 构造类似 <tag>[\s\S]*?</tag> 的正则，但避开源码直接出现标签
  const pattern = "<" + tagName + "[^>]*>[\\s\\S]*?<\/" + tagName + ">";
  return new RegExp(pattern, isGlobal ? "gi" : "i");
};
// 安全取值器 (使用 function 声明，确保被全局提升)
const safeGetValue = (obj, paths, defaultValue = "N/A") => {
  if (!Array.isArray(paths)) {
    paths = [paths];
  }
  for (const path of paths) {
    const value = _.get(obj, path);
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return defaultValue;
};
// 纯函数：递归将对象的英文键翻译为中文键（满血复活版）
function translateEnKeysToCn(obj) {
  if (!obj || typeof obj !== "object") return obj;

  // 如果是数组，递归处理每一项
  if (Array.isArray(obj)) {
    return obj.map((item) => translateEnKeysToCn(item));
  }

  // 如果是对象，遍历替换键名
  const translatedObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const cnKey = EN_TO_CN_MAP[key] || key;
    translatedObj[cnKey] = translateEnKeysToCn(value);
  }
  return translatedObj;
}
//处理null值，返回默认对象（支持联合类型）
const nullableObject = (schema, defaultObj = {}) => {
  return schema
    .nullable() // 允许null
    .or(z.string()) // 新增：允许字符串类型
    .transform((v) => {
      if (typeof v === "undefined") return defaultObj;
      if (v === null) return null; // null保留为null，不转默认对象
      // 如果是字符串，直接返回字符串（不转对象）
      if (typeof v === "string") return v;
      // 是对象则返回自身
      return v;
    });
};
// 创建支持 $meta 的 record（自动兜底 $meta 防丢失）
const recordWithMeta = (
  valueSchema,
  defaultObj = { $meta: { extensible: true } },
  listType = "",
) => {
  return z
    .record(z.string(), z.any())
    .transform((obj) => {
      if (!obj || typeof obj !== "object") return defaultObj;

      const result = {};
      let hasMeta = false;

      for (const [key, value] of Object.entries(obj)) {
        if (key === "$meta") {
          result[key] = value;
          hasMeta = true;
          continue;
        }

        // 💡 改进点：即使失败也尝试解析，或者确保 transform 被触发
        const parsed = valueSchema.safeParse(value);
        if (parsed.success) {
          result[key] = parsed.data;
        } else {
          console.warn(
            `[Schema验证失败] 列表 ${listType} 中的项 ${key} 格式不正确，尝试强制修复`,
            parsed.error,
          );

          // 💡 优化点：不要直接返回 value，而是尝试用 parse 强行跑一遍，
          // 这样虽然会抛出警告，但 Zod 的 prefault 和 transform 仍有很大机会把数据救回来
          try {
            result[key] = valueSchema.parse(value);
          } catch (e) {
            // 如果连强行 parse 都彻底炸了，再回退到原始值
            result[key] = value;
          }
        }
      }

      if (!hasMeta && defaultObj["$meta"]) {
        result["$meta"] = JSON.parse(JSON.stringify(defaultObj["$meta"]));
      }

      return result;
    })
    .default(defaultObj);
};
// 核心分配算法：最大余额法（确保总配额 TotalQuota 一分不差）
const allocateAttributes = (totalQuota, systemStr) => {
  const rates = parseAbilitySystem(systemStr);
  const attrs = ["活力", "敏捷", "灵性", "理智", "人性", "运气"];
  let result = {};
  let remainders = [];
  let sumFloor = 0;

  // 第一步：全部向下取整，并记录丢弃的小数部分
  attrs.forEach((attr) => {
    const exactValue = totalQuota * rates[attr];
    const floorValue = Math.floor(exactValue);
    result[attr] = floorValue;
    sumFloor += floorValue;
    remainders.push({ attr: attr, rem: exactValue - floorValue });
  });

  // 第二步：计算因为向下取整漏掉的点数
  let leftover = Math.round(totalQuota - sumFloor);

  // 第三步：按小数部分从大到小排序，依次补1，直到漏掉的点数补完
  remainders.sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < leftover; i++) {
    result[remainders[i].attr] += 1;
  }

  return result;
};
// 处理当前属性的专用拦截器：遇到 null/undefined/NaN 统一转为 null
const handleCurrentAttr = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  const num = Number(v);
  return Number.isNaN(num) ? null : num;
}, z.number().nullable().optional());
// AI 脏数据拦截洗刷器：专治对象写成字符串
const aiRecordFixer = (fallbackKey = "摘要") => {
  return (val) => {
    // 1. 如果已经是标准对象（且不是 null 或数组），直接放行
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      return val;
    }

    // 2. 如果 AI 偷懒写成了字符串，尝试抢救
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed) return {}; // 空字符串直接给空对象

      // 2.1 尝试解析（有时候 AI 会自作聪明返回转义的 JSON 字符串）
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          return parsed; // 抢救成功！
        }
      } catch (e) {
        // 2.2 解析失败，说明这是纯文本。强行包装成合法 Record！
        // 这样不仅修复了格式，还保留了 AI 生成的信息
        return { [fallbackKey]: trimmed };
      }
    }

    // 3. 其他乱七八糟的类型（比如数组、布尔），直接重置防止系统崩溃
    return {};
  };
};

// ----------解析------------
//解析序列（如"序列9-占卜家"→9，"普通人"→10，"序列0-真神"→0）
const parseSequenceRank = (sequenceStr) => {
  if (!sequenceStr || typeof sequenceStr !== "string") return 10;
  if (sequenceStr.includes("支柱")) return -2;
  if (sequenceStr.includes("旧日")) return -1;
  const numMatch = sequenceStr.match(/^\d+(?:\.\d+)?$/);
  if (numMatch) return Number(numMatch[0]);
  const seqMatch = sequenceStr.match(/序列[：:\s]*(\d+(?:\.\d+)?)/);
  if (seqMatch) return Number(seqMatch[1]);
  return 10;
};
// 解析装备序列，提取数字等级（如"序列5(准)/异化流浪汉"→5，"序列4"→4，"普通"→10）
const parseItemSequenceRank = (sequenceStr) => {
  // 1. 基础校验：非字符串或空值返回默认值 10
  if (!sequenceStr || typeof sequenceStr !== "string") return 10;

  // 2. 特殊身份匹配（优先判断，因为这些通常是最高位阶）
  if (sequenceStr.includes("支柱")) return -2;
  if (sequenceStr.includes("旧日")) return -1;

  // 3. 匹配纯数字格式（如 "9", "0.5"）
  // 使用 (?:\.\d+)? 以支持可能存在的小数序列（如准高序列）
  const numMatch = sequenceStr.match(/^\d+(?:\.\d+)?$/);
  if (numMatch) return Number(numMatch[0]);

  // 4. 匹配 "序列X" 格式
  // 兼容 "序列9"、"序列: 5"、"序列 0(准)" 等各种写法
  const seqMatch = sequenceStr.match(/序列[：:\s]*(\d+(?:\.\d+)?)/);
  if (seqMatch) return Number(seqMatch[1]);

  // 5. 默认兜底：如 "无"、"普通人" 等返回 10
  return 10;
};
// 解析神性（玩家与NPC通用）
const getSequenceDivinity = (sequenceRank) => {
  // 遍历配置数组寻找匹配的区间，找不到就返回兜底 1
  const config = GameDBManager.DB.divinityConfig.find(
    (c) => sequenceRank >= c.min && sequenceRank <= c.max,
  );
  return config ? config.val : 1;
};
// 根据序列解析基准总值（普通人/序列9-0）
const getSequenceBaseValue = (rank) => {
  // 优先读取 DB 配置，若不存在则回退至硬编码默认值，最差给 200
  return GameDBManager.DB.sequenceBase[String(rank)] || 200;
};
// 解析、修正并返回 NPC 模板倍率 (Multiplier)
const getAndFixNpcTemplateMultiplier = (npc, seqRank) => {
  const config = GameDBManager.DB.npcTemplateConfig;
  let templateStr = npc.模板 || "普通";

  // 1. 查表获取当前倍率 (没有匹配则为 0)
  let currentMultiplier = 0;
  for (const [name, mult] of Object.entries(config.multipliers)) {
    if (templateStr.includes(name)) {
      currentMultiplier = mult;
      break;
    }
  }

  // 2. 查表匹配序列对应的规则区间
  const rule =
    config.rankRules.find((r) => seqRank >= r.minRank && seqRank <= r.maxRank) ||
    config.defaultRule;

  // 3. 校验并强制修正
  if (currentMultiplier < rule.minM || currentMultiplier > rule.maxM) {
    currentMultiplier = rule.minM;
    npc["模板"] = rule.defaultName;
  }

  return currentMultiplier;
};
// 简化后的 Range 函数：只负责数学计算，方便微调
const getNpcTemplateRange = (npc, seqRank) => {
  const baseValue = getSequenceBaseValue(seqRank);

  // 直接通过 Fix 函数拿到准确的倍率（此时 NPC 的模板字符串已经被修好了）
  const multiplier = getAndFixNpcTemplateMultiplier(npc, seqRank);

  // 如果你希望属性是一个固定值，直接 baseValue * multiplier
  // 如果你希望属性在这个模板下有波动（比如精英是1.0-1.4），则保留 min/max
  return {
    min: baseValue * (multiplier === 1.0 ? 1.0 : multiplier * 0.7), // 举例：下限
    max: baseValue * multiplier,
  };
};
// 根据序列获取百分比加成的最大值（数字，如9→3，0→30）
const getMaxBonusPercent = (seqRank) => {
  // 极致的 O(1) 查表
  return GameDBManager.DB.maxBonusConfig[String(seqRank)] ?? 10;
};
// 解析能力体系百分比
const parseAbilitySystem = (systemStr) => {
  const config = GameDBManager.DB.abilitySystemConfig;
  const input = (systemStr || "").trim();

  // 查别名表，查不到就用原词
  const targetKey = config.aliases[input] || input;

  // 查真实系统，查不到就返回默认系统
  return config.systems[targetKey] || config.systems[config.defaultSystem];
};

//=======序列能力=========
// 辅助函数：提取纯净名称
const getPureName = (nameStr) => {
  if (!nameStr) return "";
  return nameStr
    .replace(/[【】]/g, "")
    .replace(/^(序列\d+(\.\d+)?|旧日|支柱)[-—\s]?/, "")
    .trim();
};
// 辅助函数：标准化组装 Key 以查询 DB
const buildAbilityKey = (pathway, rankMatch, tierPrefix) => {
  const rawKey = rankMatch ? `${pathway}-序列${rankMatch[1]}` : `${pathway}-${tierPrefix}`;
  return rawKey.replace(/序列0([0-9])/g, "序列$1");
};
/**
 * 全局核心工具：根据当前序列获取所有的能力池 (玩家和NPC共享底层解析)
 * @param {string} currentSequenceRaw 当前序列字符串
 * @param {boolean} isAbilityLocked 是否开启能力锁 (针对玩家，NPC一般传 false)
 * @returns {Array} 序列能力对象数组
 */
const fetchAvailableAbilities = (currentSequenceRaw, isAbilityLocked = false) => {
  if (!currentSequenceRaw || currentSequenceRaw.includes("普通人")) return {};

  const godPathways = GameDBManager.DB.godPathways;
  const sequenceAbilities = GameDBManager.DB.sequenceAbilities;
  if (!godPathways || Object.keys(godPathways).length === 0) return {};

  const fragments = currentSequenceRaw
    .split(/[/|，,;；与和及以及\s\+&、]/)
    .map((f) => f.trim())
    .filter(Boolean);
  const pathwayHighestMatch = {};

  fragments.forEach((frag) => {
    const userCoreName = getPureName(frag);
    if (!userCoreName) return;
    for (const [pathwayName, sequences] of Object.entries(godPathways)) {
      const foundIndex = sequences.findIndex((libSeq) => getPureName(libSeq) === userCoreName);
      if (foundIndex !== -1) {
        if (
          pathwayHighestMatch[pathwayName] === undefined ||
          foundIndex > pathwayHighestMatch[pathwayName]
        ) {
          pathwayHighestMatch[pathwayName] = foundIndex;
        }
      }
    }
  });

  if (Object.keys(pathwayHighestMatch).length === 0) return {};

  const requiredAbilitiesRecord = {};

  Object.entries(pathwayHighestMatch).forEach(([pathway, currentIndex]) => {
    const sequencesInPathway = godPathways[pathway];
    const startIndex = isAbilityLocked ? currentIndex : 0;

    for (let i = startIndex; i <= currentIndex; i++) {
      const seqNameInLib = sequencesInPathway[i];
      const rankMatch = seqNameInLib.match(/序列(\d+(\.\d+)?)/);
      const tierPrefix = rankMatch ? null : seqNameInLib.split("-")[0];
      const abilityKey = buildAbilityKey(pathway, rankMatch, tierPrefix);
      const seqAbilities = sequenceAbilities[abilityKey];

      if (!Array.isArray(seqAbilities) || seqAbilities.length === 0) continue;

      if (!requiredAbilitiesRecord[seqNameInLib]) {
        requiredAbilitiesRecord[seqNameInLib] = [];
      }

      // 【核心修改】：在这里把数据库的英文映射成中文输出
      seqAbilities.forEach((ab) => {
        if (!requiredAbilitiesRecord[seqNameInLib].some((existing) => existing.名称 === ab.name)) {
          // 保留完整的技能对象，包括所有战斗字段
          const fullAbility = {
            名称: ab.name,
            描述: ab.description || "",
            类型: ab.type || "非凡能力",
          };

          // 添加战斗扩展字段（如果存在）
          if (ab.damageType) fullAbility.damageType = ab.damageType;
          if (ab.power !== undefined) fullAbility.power = ab.power;
          if (ab.cost) fullAbility.cost = ab.cost;
          if (ab.targetType) fullAbility.targetType = ab.targetType;
          if (ab.priority !== undefined) fullAbility.priority = ab.priority;

          // ⭐ 新增：映射 effects 数组，确保 valueType 和 stat 字段正确传递
          if (ab.effects && Array.isArray(ab.effects)) {
            fullAbility.effects = ab.effects.map((effect) => {
              const mappedEffect = { ...effect };
              // valueType 和 stat 会自动包含在展开的对象中
              // 支持中英文字段名
              if (effect.valueType !== undefined) mappedEffect.valueType = effect.valueType;
              if (effect.数值类型 !== undefined) mappedEffect.数值类型 = effect.数值类型;
              if (effect.stat !== undefined) mappedEffect.stat = effect.stat;
              if (effect.目标属性 !== undefined) mappedEffect.目标属性 = effect.目标属性;
              return mappedEffect;
            });
          }

          if (ab.customDamageCalculator)
            fullAbility.customDamageCalculator = ab.customDamageCalculator;
          if (ab.isHeal !== undefined) fullAbility.isHeal = ab.isHeal;
          if (ab.healAmt !== undefined) fullAbility.healAmt = ab.healAmt;
          if (ab.healType) fullAbility.healType = ab.healType;
          if (ab.healValueType !== undefined) fullAbility.healValueType = ab.healValueType;
          if (ab.治疗数值类型 !== undefined) fullAbility.治疗数值类型 = ab.治疗数值类型;
          if (ab.triggerTiming) fullAbility.triggerTiming = ab.triggerTiming;

          // 🆕 节点1：添加被动技能字段映射
          if (ab.isPassive !== undefined) fullAbility.isPassive = ab.isPassive;

          // 🆕 节点2：添加标签字段映射（支持空数组）
          if (ab.skillTags !== undefined) fullAbility.skillTags = ab.skillTags;
          if (ab.applyTags !== undefined) fullAbility.applyTags = ab.applyTags;
          if (ab.removeTags !== undefined) fullAbility.removeTags = ab.removeTags;

          // 🆕 节点1：添加 conditionalParams 字段映射
          if (ab.conditionalParams !== undefined)
            fullAbility.conditionalParams = ab.conditionalParams;

          requiredAbilitiesRecord[seqNameInLib].push(fullAbility);
        }
      });
    }
  });

  return requiredAbilitiesRecord;
};
/**
 * 全局核心工具：NPC 序列能力加权抽取算法 (指数级高序列优先)
 * @param {Array} abilitiesPool 可用的能力对象数组池
 * @param {number} highestSeqRank NPC当前最高序列等级
 * @returns {Array} 抽取出的能力对象数组，每个元素包含 { 名称, 描述 }
 */
const generateNpcAbilities = (abilitiesRecord, highestSeqRank) => {
  // 兜底能力：当配置文件没有匹配到任何序列能力时使用（如"普通人"、"野兽"、"未知"等不规范序列）
  const FALLBACK_ABILITY = {
    名称: "常规攻击",
    描述: "常规的物理攻击",
    类型: "非凡能力",
    damageType: "physical",
    targetType: "single",
    power: {
      "-2": 95000,
      "-1": 51000,
      0: 24400,
      0.1: 16300,
      0.3: 12200,
      0.4: 10350,
      0.5: 9500,
      0.8: 7800,
      0.9: 6950,
      1: 5100,
      2: 2440,
      3: 780,
      4: 255,
      5: 122,
      6: 42,
      7: 17,
      8: 9,
      9: 5,
      default: 5,
    },
    cost: { type: "currentVitality", amount: 6 },
  };
  if (!abilitiesRecord || Object.keys(abilitiesRecord).length === 0) return [FALLBACK_ABILITY];

  // 【修改】：将字典临时拍扁为带权重的数组以供抽取
  let abilitiesPool = [];
  Object.entries(abilitiesRecord).forEach(([seqName, abs]) => {
    const seqRank = parseSequenceRank(seqName);
    abs.forEach((ab) => {
      abilitiesPool.push({ ...ab, seqRank });
    });
  });

  if (abilitiesPool.length === 0) return [FALLBACK_ABILITY];

  const poolSize = abilitiesPool.length;

  // 规则 1：根据序列等级动态计算能力数量
  // 支柱(-2)和旧日(-1)：15个
  // 序列0：15个
  // 序列1：14个
  // 序列2：13个
  // ...
  // 序列9：5个
  // 普通人(10)：0个
  let maxAbilities;
  if (highestSeqRank <= 0) {
    // 支柱、旧日、序列0 都是15个
    maxAbilities = 15;
  } else if (highestSeqRank >= 9) {
    // 序列9及以下（普通人）最多5个
    maxAbilities = 5;
  } else {
    // 序列1-8：线性递减，从14到6
    // 公式：15 - highestSeqRank
    maxAbilities = 15 - highestSeqRank;
  }

  // 取池子总数的 75%，但不超过序列对应的上限
  let targetCount = Math.ceil(poolSize * 0.75);
  targetCount = Math.min(targetCount, maxAbilities);
  targetCount = Math.min(targetCount, poolSize);
  targetCount = Math.max(1, targetCount); // 至少1个能力

  // 规则 2：指数级加权随机抽取（最高序列极高概率碾压）
  const selectedAbilities = [];

  // 深拷贝并注入指数权重
  let currentPool = abilitiesPool.map((ab) => {
    // 采用以 3 为底的指数算法，遇到旧日(-1)、支柱(-2)也完美兼容
    const exponent = Math.max(0, 10 - ab.seqRank);
    return {
      ...ab,
      weight: Math.pow(3, exponent),
    };
  });

  // 无放回的加权轮盘赌算法
  for (let i = 0; i < targetCount; i++) {
    if (currentPool.length === 0) break;

    const totalWeight = currentPool.reduce((sum, item) => sum + item.weight, 0);
    let randomWeight = Math.random() * totalWeight;

    let selectedIndex = 0;
    for (let j = 0; j < currentPool.length; j++) {
      randomWeight -= currentPool[j].weight;
      if (randomWeight <= 0) {
        selectedIndex = j;
        break;
      }
    }

    selectedAbilities.push(currentPool[selectedIndex]);
    currentPool.splice(selectedIndex, 1);
  }

  // 整理输出：按位格从高到低（序列数从小到大）排序，返回完整的能力对象（包括战斗字段）
  selectedAbilities.sort((a, b) => a.seqRank - b.seqRank);
  return selectedAbilities.map((ab) => {
    // 移除临时的 seqRank 和 weight 字段
    const { seqRank, weight, ...abilityData } = ab;
    return abilityData;
  });
};

//---------属性上限计算---------
// 属性配置MAP
const GLOBAL_ATTR_CONFIG = [
  { key: "活力", baseVar: "基础活力", currentVar: "当前活力", uiId: "huoli" },
  { key: "灵性", baseVar: "基础灵性", currentVar: "当前灵性", uiId: "lingxing" },
  { key: "理智", baseVar: "基础理智", currentVar: "当前理智", uiId: "lizhi" },
  { key: "人性", baseVar: "基础人性", currentVar: "当前人性", uiId: "renxing" },
  { key: "敏捷", baseVar: "基础敏捷", currentVar: "当前敏捷", uiId: "minjie" },
  { key: "运气", baseVar: "基础运气", currentVar: "运气", uiId: "yunqi" },
];

// 属性计算引擎
const calculateRealMaxAttributes = (stat_data) => {
  if (!stat_data) return {};

  // 🔮 新增：读取消化进度并计算基础属性加成系数
  const digestionProgress = Number(safeGetValue(stat_data, "消化进度", 0));
  let digestionMultiplier = 1.0; // 默认无加成

  if (digestionProgress >= 81 && digestionProgress <= 100) {
    digestionMultiplier = 1.1; // 81-100%: 10%加成
  } else if (digestionProgress >= 41 && digestionProgress <= 80) {
    digestionMultiplier = 1.05; // 41-80%: 5%加成
  }
  // 0-40%: 保持1.0，无加成

  // 🔮 修改：应用消化进度加成到基础属性
  const characterBaseAttributes = {};
  GLOBAL_ATTR_CONFIG.forEach((attr) => {
    const rawBase = Number(safeGetValue(stat_data, attr.baseVar, 0));
    characterBaseAttributes[attr.key] = Math.floor(rawBase * digestionMultiplier);
  });

  const totalFlatBonuses = { 活力: 0, 灵性: 0, 理智: 0, 人性: 0, 敏捷: 0, 运气: 0 };
  const totalPercentBonuses = { 活力: 0, 灵性: 0, 理智: 0, 人性: 0, 敏捷: 0, 运气: 0 };

  const processBonuses = (sourceObject) => {
    if (!sourceObject || typeof sourceObject !== "object") return;

    for (const key in totalFlatBonuses) {
      let bonus = 0;
      const simpleKey = key.replace("值", "");
      bonus += Number(
        safeGetValue(
          sourceObject,
          [`基础${key}加成`, `${key}加成`, `基础${simpleKey}加成`, key],
          0,
        ),
      );

      const attributesBonusObj = safeGetValue(sourceObject, "attributes_bonus", null);
      if (attributesBonusObj && typeof attributesBonusObj === "object") {
        bonus += Number(safeGetValue(attributesBonusObj, key, 0));
      }
      if (!isNaN(bonus)) totalFlatBonuses[key] += bonus;
    }

    const percentBonusObject = safeGetValue(sourceObject, "百分比加成", {});
    if (typeof percentBonusObject === "object") {
      const allBonusValue = parseFloat(safeGetValue(percentBonusObject, "全部属性", "0%")) || 0;
      for (const key in totalPercentBonuses) {
        const specificBonusValue = parseFloat(safeGetValue(percentBonusObject, key, "0%")) || 0;
        totalPercentBonuses[key] += allBonusValue + specificBonusValue;
      }
    }
  };

  const listKeys = ["武器列表", "衣物列表", "饰品列表", "封印物列表", "扮演法列表", "辅助能力列表"];
  listKeys.forEach((listKey) => {
    const itemsObj = safeGetValue(stat_data, listKey, {});
    Object.values(itemsObj).forEach((item) => {
      if (item && item.isEquipped === true) processBonuses(item);
    });
  });

  const talents = Object.values(safeGetValue(stat_data, "非凡特性列表", {}));
  talents.forEach((talent) => processBonuses(talent));

  const finalMaxAttributes = {};
  for (const key in totalFlatBonuses) {
    const base = Number(characterBaseAttributes[key] || 0);
    const flat = totalFlatBonuses[key] || 0;
    const percent = totalPercentBonuses[key] / 100 || 0;
    const maxVal = Math.round((base + flat) * (1 + percent));
    finalMaxAttributes[key] = isNaN(maxVal) ? base : maxVal;
  }

  return finalMaxAttributes;
};

//---------兼容与兜底原版---------

// 兼容与兜底：仅在未检测到能力体系时，根据当前序列字符串从DB中检索并赋予能力体系
const getAndFixAbilitySystem = (sequenceStr, currentSystem) => {
  // 核心判定：如果原数据中已经有了有效的能力体系，直接放行，不做任何修改！
  if (currentSystem && typeof currentSystem === "string" && currentSystem.trim() !== "") {
    return currentSystem;
  }
  // 如果没有能力体系（或者是空字符串），则使用 include 遍历超大数据库匹配
  if (sequenceStr && typeof sequenceStr === "string") {
    for (const [seqKey, system] of Object.entries(GameDBManager.DB.abilitySystemDB)) {
      if (sequenceStr.includes(seqKey)) {
        return system;
      }
    }
  }
  // 若不在数据库中，或连序列都没填，统一给个最终兜底
  return "神秘法术系";
};

// 🌟 新增：从世界书动态读取能力体系映射的增强版函数
const getAbilitySystemFromWorldbook = (sequenceStr, currentSystem, forceUpdate = false) => {
  // 1. 如果不是强制更新，且当前已有有效的能力体系，则保持不变
  if (
    !forceUpdate &&
    currentSystem &&
    typeof currentSystem === "string" &&
    currentSystem.trim() !== ""
  ) {
    // 检查当前体系是否在配置中存在，如果不存在则需要重新分配
    const systemConfig = GameDBManager.DB.abilitySystemConfig;
    if (systemConfig && systemConfig.systems && systemConfig.systems[currentSystem]) {
      return currentSystem;
    }
  }

  // 2. 从世界书的能力体系映射中查找匹配的序列
  if (sequenceStr && typeof sequenceStr === "string") {
    const abilitySystemDB = GameDBManager.DB.abilitySystemDB;
    if (abilitySystemDB && typeof abilitySystemDB === "object") {
      // 遍历能力体系映射，查找匹配的序列
      for (const [seqKey, system] of Object.entries(abilitySystemDB)) {
        if (sequenceStr.includes(seqKey)) {
          console.log(`[能力体系更新] 序列 [${sequenceStr}] 匹配到体系: ${system}`);
          return system;
        }
      }
    }
  }

  // 3. 如果世界书中没有找到，回退到原有逻辑
  return getAndFixAbilitySystem(sequenceStr, currentSystem);
};

//---------装备---------

//生成装备属性算法
const generateItemStats = (baseValue, itemType, itemName = "", pathway = "", trait = "") => {
  const {
    traitDB: TRAIT_DB,
    pathwayMatrix: PATHWAY_MATRIX,
    itemConfig: ITEM_CONFIG,
  } = GameDBManager.DB || {};

  // 1. 类型识别兜底 (强制转字符串防止 undefined 报错)
  let typeKey = "封印物";
  const safeType = String(itemType || "");
  const safeName = String(itemName || "");
  const typeStr = (safeType + safeName).toLowerCase();
  if (
    typeStr.includes("武器") ||
    typeStr.includes("剑") ||
    typeStr.includes("枪") ||
    typeStr.includes("刀")
  )
    typeKey = "武器";
  else if (typeStr.includes("衣") || typeStr.includes("甲") || typeStr.includes("袍"))
    typeKey = "衣物";
  else if (typeStr.includes("饰品") || typeStr.includes("环") || typeStr.includes("链"))
    typeKey = "饰品";

  const isSealed = typeKey === "封印物";
  const config = ITEM_CONFIG[typeKey] || ITEM_CONFIG["封印物"];
  const randomRange = (min, max) => min + Math.random() * (max - min);

  // 2. 提取特质与途径配置
  const activeTrait = TRAIT_DB[trait] || TRAIT_DB["空"];
  // 如果输入了途径并在矩阵中存在，优先使用途径基础权重；否则使用装备类型的兜底权重
  const baseWeights = PATHWAY_MATRIX[pathway] ? [...PATHWAY_MATRIX[pathway]] : [...config.pW];

  // 3. 严格确定正负总额度（受特质 boost 影响）
  // 新逻辑：先算出没有特质时的“基底池”
  const p_base = baseValue * randomRange(config.p[0], config.p[1]);
  const n_base = p_base * randomRange(config.n[0], config.n[1]);

  // 特质倍率只对对应的基底池生效
  const p_sum = p_base * activeTrait.p_boost;
  const n_sum = n_base * activeTrait.n_boost;

  // 4. 构建双轨权重矩阵
  // 正面权重 = (途径基础 * (1 + 特质乘数) + 特质加数) * 随机扰动
  const p_weights = baseWeights.map((w, i) => {
    let finalW = w * (1 + activeTrait.M[i]) + activeTrait.A[i];
    finalW = Math.max(0.1, finalW); // 防止负数或全0导致无法分配
    return finalW * randomRange(0.8, 1.2); // 引入轻微随机扰动
  });

  // 负面权重：根据特质进行精准打击，如果没有特质偏向，则回归随机惩罚
  const n_weights = [0, 0, 0, 0, 0, 0];
  if (activeTrait.n_bias.length > 0) {
    activeTrait.n_bias.forEach((idx) => (n_weights[idx] = randomRange(5, 10))); // 特质指定的倒霉属性承受巨大权重
    // 稍微分一点给其他属性，显得不那么生硬
    n_weights.forEach((_, i) => {
      if (n_weights[i] === 0) n_weights[i] = randomRange(0.1, 1);
    });
  } else {
    // 老版本的随机打击法
    const penaltyCount = Math.floor(Math.random() * 3) + 1;
    const indices = [0, 1, 2, 3, 4, 5].sort(() => 0.5 - Math.random()).slice(0, penaltyCount);
    indices.forEach((idx) => (n_weights[idx] = randomRange(2, 5)));
  }

  // 5. 精确分配引擎（带防超模与溢出重分配逻辑 - 保持你优秀的旧逻辑不变，仅做了微调优化性能）
  const allocate = (totalPool, weights, applyCap) => {
    let result = [0, 0, 0, 0, 0, 0];
    let remainingPool = totalPool;
    let activeIndices = new Set([0, 1, 2, 3, 4, 5]);
    const maxCap = totalPool * 0.5;

    if (weights.reduce((a, b) => a + b, 0) === 0) return result;

    let loopGuard = 0;
    while (remainingPool > 0.5 && activeIndices.size > 0 && loopGuard < 20) {
      loopGuard++;
      let currentSumW = 0;
      for (let i of activeIndices) currentSumW += weights[i];
      if (currentSumW <= 0) break;

      let tempAlloc = {};
      let overCapIndices = [];

      for (let i of activeIndices) {
        let alloc = (weights[i] / currentSumW) * remainingPool;
        if (applyCap && result[i] + alloc > maxCap) {
          tempAlloc[i] = maxCap - result[i];
          overCapIndices.push(i);
        } else {
          tempAlloc[i] = alloc;
        }
      }

      let distributedThisRound = 0;
      for (let i of activeIndices) {
        result[i] += tempAlloc[i];
        distributedThisRound += tempAlloc[i];
      }

      remainingPool -= distributedThisRound;
      for (let i of overCapIndices) activeIndices.delete(i);
    }
    return result.map((v) => Math.round(v));
  };

  // 6. 执行分配（封印物关闭 applyCap 限制）
  const p_stats = allocate(p_sum, p_weights, !isSealed);
  const n_stats = allocate(n_sum, n_weights, !isSealed);

  return {
    活力: p_stats[0] - n_stats[0],
    灵性: p_stats[1] - n_stats[1],
    理智: p_stats[2] - n_stats[2],
    人性: p_stats[3] - n_stats[3],
    敏捷: p_stats[4] - n_stats[4],
    运气: p_stats[5] - n_stats[5],
  };
};

//------------消耗品------------

// 失控反噬检定引擎
const calculateCorruptionBacklash = (playerSeqRank, itemSeqRank, itemType) => {
  const { consumableConfig: CONSUMABLE_CONFIG } = GameDBManager.DB || {};

  // 注意：序列数字越小，位格越高。差值 = 玩家序列 - 物品序列
  const rankDiff = playerSeqRank - itemSeqRank;

  // 未越级或仅越1级，无失控惩罚（但消耗品本身的代价仍要承受）
  if (rankDiff < 2) return 0;

  // 获取物品类型的反噬倍率
  let typeKey = "其他";
  for (const key in CONSUMABLE_CONFIG) {
    if (itemType.includes(key)) typeKey = key;
  }
  const backlashMult = CONSUMABLE_CONFIG[typeKey].backlashMult;

  // 核心公式：(差值 - 1) * 基础惩罚值(5) * 类型危险度
  // 例如：玩家序列9，用序列7符咒 (差值2) -> (2-1) * 5 * 1.5 = 7.5 (向上取整为 8)
  // 玩家序列9，用序列5符咒 (差值4) -> (4-1) * 5 * 1.5 = 22.5 (取整为 23)
  let corruptionIncrease = Math.ceil((rankDiff - 1) * 5 * backlashMult);

  // 限制单次反噬上限，最多一次增加 50 点失控度（给玩家留抢救的机会）
  return Math.min(corruptionIncrease, 50);
};
// 消耗品属性智能分配
const generateConsumableStats = (baseValue, type, effect, targetStat) => {
  const { consumableConfig: CONSUMABLE_CONFIG } = GameDBManager.DB || {};

  // 核心防护：强制转换为字符串，彻底杜绝 .includes() 报错
  const safeType = String(type || "");
  const safeEffect = String(effect || "");
  const safeTargetStat = String(targetStat || "");

  let typeKey = "其他";
  // 防止 CONSUMABLE_CONFIG 为空导致的异常
  if (typeof CONSUMABLE_CONFIG !== "undefined") {
    for (const key in CONSUMABLE_CONFIG) {
      if (safeType.includes(key)) typeKey = key;
    }
  }

  // 兜底 config 配置，防止取不到数据
  const config = CONSUMABLE_CONFIG[typeKey] || {
    powerRatio: 1,
    costRatio: 0.5,
    defaultCost: "灵性",
  };

  // 引入轻微随机性 (±20%)
  const randomFactor = () => 0.8 + Math.random() * 0.4;

  const rawPower = Math.round(baseValue * config.powerRatio * randomFactor());
  const rawCost = Math.round(baseValue * config.costRatio * randomFactor());

  let result = {};
  let damageBonus = undefined;

  const validAttrs = ["活力", "灵性", "理智", "人性", "敏捷", "运气"];

  // 辅助函数：安全累加属性（解决覆盖Bug）
  const addStat = (statName, value) => {
    if (statName === "全属性" || statName === "所有属性") {
      validAttrs.forEach((attr) => (result[attr] = (result[attr] || 0) + Math.round(value / 3))); // 全属性增益稍微打个折
      return;
    }
    // 防呆：如果 AI 编了奇怪的属性，强行纠正为敏捷或活力
    const safeStat = validAttrs.includes(statName) ? statName : "活力";
    result[safeStat] = (result[safeStat] || 0) + value;
  };

  // 效果解析引擎
  if (safeEffect.includes("杀伤") || safeEffect.includes("攻击")) {
    addStat(config.defaultCost, -rawCost); // 扣除驱动代价
    damageBonus = rawPower; // 威力转化为纯伤害加成
  } else if (safeEffect.includes("恢复") || safeEffect.includes("治疗")) {
    const healTarget = safeTargetStat !== "" ? safeTargetStat : "活力";
    addStat(healTarget, rawPower);

    // 药三分毒
    const sideEffectStat = safeType.includes("药品") ? "理智" : "人性";
    addStat(sideEffectStat, -Math.ceil(rawCost * 0.5));
  } else if (safeEffect.includes("增益") || safeEffect.includes("强化")) {
    const buffTarget = safeTargetStat !== "" ? safeTargetStat : "敏捷";
    addStat(buffTarget, Math.round(rawPower * 0.6));
    addStat(config.defaultCost, -rawCost);
  } else {
    addStat("灵性", -rawCost);
  }

  return { attributes: result, damageBonus };
};

//---------约束------------
// 约束 NPC 属性（仅保留超出总配额时等比例缩小的兜底功能）
const constrainNpcAttributes = (npc) => {
  const savedMeta = npc.$meta;

  const seqRank = parseSequenceRank(npc.当前序列);
  const baseValue = getSequenceBaseValue(seqRank);
  const multiplier = getAndFixNpcTemplateMultiplier(npc, seqRank);
  const maxTotalQuota = baseValue * multiplier; // 总配额

  const sixAttrs = ["活力", "灵性", "理智", "人性", "敏捷", "运气"];
  let currentTotal = sixAttrs.reduce((sum, attr) => sum + (npc[attr] || 0), 0);

  // 若总和超过配额，执行等比例缩放兜底
  if (currentTotal > maxTotalQuota) {
    const scale = maxTotalQuota / currentTotal;
    sixAttrs.forEach((attr) => {
      npc[attr] = Math.round((npc[attr] || 0) * scale);
    });
  }

  if (savedMeta !== undefined) npc.$meta = savedMeta;
  return npc;
};
// 约束百分比加成的最大值（保留"数字%"格式，仅修正超出的数值）
const constrainBonusPercent = (bonusObj, seqStr, listType = "") => {
  if (!bonusObj || typeof bonusObj !== "object") return {};

  const savedMeta = bonusObj.$meta;
  const seqRank = parseSequenceRank(seqStr);
  const maxPercent = getMaxBonusPercent(seqRank);

  if (maxPercent === 0) {
    return savedMeta !== undefined ? { $meta: savedMeta } : {};
  }

  const constrainedBonus = {};
  Object.entries(bonusObj).forEach(([key, value]) => {
    if (key === "$meta") {
      constrainedBonus[key] = value;
      return;
    }
    let num;
    if (typeof value === "number") {
      num = value;
    } else if (typeof value === "string") {
      num = Number((value || "").replace(/%/g, ""));
    } else {
      num = 0;
    }
    if (isNaN(num)) {
      constrainedBonus[key] = `${maxPercent}%`;
    } else {
      const finalNum = num > maxPercent ? maxPercent : num;
      constrainedBonus[key] = `${finalNum}%`;
    }
  });

  return constrainedBonus;
};
// [更新] 强制约束装备列表冲突
const constrainSingleEquipment = (itemList) => {
  if (!itemList || typeof itemList !== "object") return itemList;

  // 过滤出除了 $meta 之外的所有真实物品键名
  const itemKeys = Object.keys(itemList).filter((key) => key !== "$meta");

  // 找出所有被标记为已装备的物品
  const equippedKeys = itemKeys.filter((key) => itemList[key] && itemList[key].isEquipped === true);

  // 核心拦截：如果装备数大于 1
  if (equippedKeys.length > 1) {
    console.warn(`[数据层拦截] 发现 ${equippedKeys.length} 件装备同时穿戴，正在执行强制清洗...`);

    // 策略：保留数组中最后一个（通常是玩家最新点击的）
    const keyToKeep = equippedKeys.pop();

    // 剩下的全部强行篡改为 false
    equippedKeys.forEach((key) => {
      itemList[key].isEquipped = false;
    });
  }

  return itemList; // 返回清洗后绝对干净的列表
};
// 开关：是否约束（暂时无用，后续更新）
const CONSTRAIN_FOR_SEQ = false;
