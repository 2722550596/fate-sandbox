// 文件: DynamicPropertyDetection.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================

// --- L14646-15299: // ======🔴 动态属性检测系统========== ---

// ======🔴 动态属性检测系统==========
const evaluateCondition = (statsPool, condition) => {
  if (!statsPool || typeof statsPool !== "object") return false;
  if (!condition || !condition.target || typeof condition.operator === "undefined") return false;

  const resolveRawValue = (path) => {
    if (!path) return undefined;
    let val = _.get(statsPool, path);
    if (val !== undefined) return val;

    if (!path.includes(".")) {
      if (!path.startsWith("基础")) {
        val = statsPool[`基础${path}`];
        if (val !== undefined) return val;
      }
      if (path.startsWith("当前")) {
        val = statsPool[path.replace("当前", "")];
        if (val !== undefined) return val;
      }
    }
    return undefined;
  };

  let targetVal = resolveRawValue(condition.target);
  const op = condition.operator;
  const condVal = condition.value;

  // ==========================================
  // 分流 1：单目运算符 (存在性与布尔判定，无需 condVal)
  // ==========================================
  if (["exists", "not_exists", "is_true", "is_false", "empty", "not_empty"].includes(op)) {
    switch (op) {
      case "exists":
        return targetVal !== undefined && targetVal !== null;
      case "not_exists":
        return targetVal === undefined || targetVal === null;
      case "is_true":
        return !!targetVal === true;
      case "is_false":
        return !!targetVal === false;
      case "empty":
        return _.isEmpty(targetVal);
      case "not_empty":
        return !_.isEmpty(targetVal);
    }
  }

  // ==========================================
  // 分流 2：通用等值判定 (支持字符串、数字、布尔值的宽松或严格对比)
  // ==========================================
  if (op === "==") return targetVal == condVal;
  if (op === "===") return targetVal === condVal;
  if (op === "!=") return targetVal != condVal;
  if (op === "!==") return targetVal !== condVal;

  // ==========================================
  // 分流 3：字符串与对象特异性判定
  // ==========================================
  if (["includes", "not_includes", "startsWith", "endsWith", "match", "has_key"].includes(op)) {
    const strTarget = String(targetVal ?? "");
    const strCond = String(condVal ?? "");

    switch (op) {
      case "includes":
        return strTarget.includes(strCond);
      case "not_includes":
        return !strTarget.includes(strCond);
      case "startsWith":
        return strTarget.startsWith(strCond);
      case "endsWith":
        return strTarget.endsWith(strCond);
      case "has_key":
        return _.has(targetVal, condVal);
      case "match":
        try {
          // 增加安全防线：限制正则长度或包裹 try-catch
          return new RegExp(strCond).test(strTarget);
        } catch (e) {
          console.warn(`[动态规则] ⚠️ 无效的正则: ${strCond}`);
          return false;
        }
    }
  }

  // ==========================================
  // 分流 4：纯数值大小与百分比判定 (>, >=, <, <=)
  // ==========================================

  // 过滤脏数据，确保只对数字进行比较
  if (
    targetVal === null ||
    targetVal === "" ||
    typeof targetVal === "boolean" ||
    Array.isArray(targetVal)
  ) {
    targetVal = NaN;
  } else {
    targetVal = Number(targetVal);
  }

  if (isNaN(targetVal)) return false;

  let checkValue = targetVal;

  if (condition.calcType === "percentage") {
    if (!condition.reference) return false;

    const rawRef = resolveRawValue(condition.reference);
    const refVal = Number(rawRef);

    if (isNaN(refVal) || refVal === 0) return false;
    checkValue = (targetVal / refVal) * 100;
  }

  const threshold = Number(condVal);
  if (isNaN(threshold)) return false;

  switch (op) {
    case ">":
      return checkValue > threshold;
    case ">=":
      return checkValue >= threshold;
    case "<":
      return checkValue < threshold;
    case "<=":
      return checkValue <= threshold;
    default:
      return false; // 等值判定已经在上面处理过了
  }
};

// 核心处理函数 (Schema 阶段调用)
// 改名并修改逻辑：只处理传入的单个实体
const applyDynamicStatus = (entityStats, isNPC) => {
  const rulesDb = GameDBManager.DB.dynamicRules;
  // 🚨 这里的规则库必须在 Zod 解析前就已经有数据了！
  if (!rulesDb || rulesDb.length === 0) return entityStats;

  if (!entityStats.当前状态 || typeof entityStats.当前状态 !== "object") {
    entityStats.当前状态 = {};
  }

  // 1. 清洗旧的系统状态 (通过正则检测带方括号的键)
  Object.keys(entityStats.当前状态).forEach((key) => {
    if (/^\[.*?\]/.test(key)) delete entityStats.当前状态[key];
  });

  // 2. 筛选适用当前实体的规则
  const applicableRules = rulesDb.filter((rule) => {
    if (rule.isEnabled === false) return false;
    if (isNPC && rule.targetScope === "player") return false;
    if (!isNPC && rule.targetScope === "npc") return false;
    return true;
  });

  const triggeredGroups = new Set();

  // 3. 判定并写入
  for (const rule of applicableRules) {
    if (rule.group && triggeredGroups.has(rule.group)) continue;

    const isMatch =
      rule.matchType === "OR"
        ? rule.conditions.some((c) => evaluateCondition(entityStats, c))
        : rule.conditions.every((c) => evaluateCondition(entityStats, c));

    if (isMatch) {
      // 只写状态，不留任何临时变量！绝对干净。
      const stateKey = `[${rule.output.type || "系统规则"}]${rule.name}`;
      entityStats.当前状态[stateKey] = rule.output.description;

      if (rule.isExclusive && rule.group) triggeredGroups.add(rule.group);
    }
  }

  return entityStats;
};

// ****************************************************************
// 🌐 SchemaDerivation —— 跨表派生与写入拦截基础设施（项目级共享）
// ----------------------------------------------------------------
// 职责：让 schema transform 在校验时跨表读取外层 mvuState，并强制覆盖
//       受保护字段。AI / 玩家编辑器 / 命令行写入都被立即覆盖。
// 接入：validateAndMigrateStatData 与 _applyUpdateFallback 入口处
//       用 enter/exit 包裹，schema transform 内调用 applyAll(schemaId, value)。
// 用法：window.SchemaDerivation.register({ id, schemaId, compute })
// ****************************************************************
window.SchemaDerivation = (function () {
  // ---------------- 内部状态 ----------------
  let _context = null; // 当前校验中的 mvuState 引用（仅 enter/exit 之间有效）
  const _registry = []; // 已注册的派生规则数组
  const _idIndex = new Set(); // 派生规则 id 的快速查重索引

  // ---------------- 校验上下文管理 ----------------
  function enter(mvuState) {
    if (_context !== null) {
      console.warn("[SchemaDerivation] 上下文未清理就再次 enter，可能存在嵌套校验");
    }
    _context = mvuState || null;
  }

  function exit() {
    _context = null;
  }

  // ---------------- 跨表读 API ----------------
  function readContext(path, fallback) {
    if (fallback === undefined) fallback = undefined;
    if (_context === null) return fallback;
    if (typeof path !== "string" || !path) return fallback;
    const value = _.get(_context, path, undefined);
    return value === undefined ? fallback : value;
  }

  // ---------------- 派生规则注册 ----------------
  function register(rule) {
    if (!rule || typeof rule !== "object") {
      throw new Error("[SchemaDerivation] register 需要规则对象");
    }
    const { id, schemaId, compute } = rule;
    if (!id || typeof id !== "string") {
      throw new Error("[SchemaDerivation] 规则缺少有效的 id");
    }
    if (!schemaId || typeof schemaId !== "string") {
      throw new Error("[SchemaDerivation] 规则 " + id + " 缺少 schemaId");
    }
    if (typeof compute !== "function") {
      throw new Error("[SchemaDerivation] 规则 " + id + " 的 compute 必须是函数");
    }
    if (_idIndex.has(id)) {
      console.warn("[SchemaDerivation] 规则 " + id + " 已存在，将被覆盖（开发期热更新）");
      const idx = _registry.findIndex(function (r) {
        return r.id === id;
      });
      if (idx >= 0) _registry.splice(idx, 1);
    }
    _registry.push({ id: id, schemaId: schemaId, compute: compute });
    _idIndex.add(id);
  }

  // ---------------- 派生应用入口 ----------------
  function applyAll(schemaId, value) {
    if (_context === null) return value; // 校验上下文外：直接返回原 value
    const rules = _registry.filter(function (r) {
      return r.schemaId === schemaId;
    });
    if (rules.length === 0) return value;

    let current = value;
    for (const rule of rules) {
      try {
        const result = rule.compute(current, _context, { readContext: readContext });
        if (result !== undefined) current = result;
      } catch (err) {
        console.warn("[SchemaDerivation] 规则 " + rule.id + " 执行异常:", err);
      }
    }
    return current;
  }

  // ---------------- 调试辅助 ----------------
  function _listRules() {
    return _registry.map(function (r) {
      return { id: r.id, schemaId: r.schemaId };
    });
  }
  function _getContext() {
    return _context;
  }

  return {
    enter: enter,
    exit: exit,
    readContext: readContext,
    register: register,
    applyAll: applyAll,
    _listRules: _listRules,
    _getContext: _getContext,
  };
})();

// **************************
// --------Schema---------
// **************************

// 基础属性Schema
const BaseAttributesSchema = z.object({
  活力: z.coerce.number().prefault(0),
  灵性: z.coerce.number().prefault(0),
  理智: z.coerce.number().prefault(0),
  人性: z.coerce.number().prefault(0),
  敏捷: z.coerce.number().prefault(0),
  运气: z.coerce.number().prefault(0), //没有当前运气
});

// 基础值 (仅玩家使用，用于记录序列分配的原始值)
const PlayerBaseFloorSchema = z.object({
  基础活力: z.coerce.number().prefault(0),
  基础灵性: z.coerce.number().prefault(0),
  基础理智: z.coerce.number().prefault(0),
  基础人性: z.coerce.number().prefault(0),
  基础敏捷: z.coerce.number().prefault(0),
  基础运气: z.coerce.number().prefault(0),
});

// 六维可选Schema，不默认给0，保证输出结构的干净
const OptionalAttributesSchema = z.object({
  活力: z.coerce.number().optional(),
  灵性: z.coerce.number().optional(),
  理智: z.coerce.number().optional(),
  人性: z.coerce.number().optional(),
  敏捷: z.coerce.number().optional(),
  运气: z.coerce.number().optional(),
});

// 当前属性Schema（不再强行给0，允许 null 存在）
const CurrentAttributesSchema = z.object({
  当前活力: handleCurrentAttr,
  当前灵性: handleCurrentAttr,
  当前理智: handleCurrentAttr,
  当前人性: handleCurrentAttr,
  当前敏捷: handleCurrentAttr,
});

// 属性映射表，供 transform 逻辑循环使用
const ATTR_MAP = {
  当前活力: { max: "活力", prefault: 30 },
  当前灵性: { max: "灵性", prefault: 105 },
  当前理智: { max: "理智", prefault: 60 },
  当前人性: { max: "人性", prefault: 30 },
  当前敏捷: { max: "敏捷", prefault: 60 },
};

// 基础物品Schema（带数量和单位）
const StackableItemSchema = z
  .object({
    名称: z.string().prefault(""),
    序列: z.string().prefault("普通"),
    类型: z.string().optional(),
    描述: z.string().prefault(""),
    数量: z.coerce.number().prefault(1),
    单位: z.string().prefault("件"),
  })
  .passthrough();

// 消耗品Schema
const ConsumableItemSchema = z
  .object({
    名称: z.string().prefault("未命名消耗品"),
    序列: z.string().prefault("普通"),
    类型: z.string().optional(), //已经是消耗品，填写符咒、药品、子弹、卷轴、神性、其他等
    效果: z.string().optional(), //填写杀伤、恢复、增益、其他等。
    作用属性: z.string().optional(), //填写'活力', '灵性', '理智', '人性', '敏捷', '运气', '全属性'，其他等
    描述: z.string().optional(),
    数量: z.coerce.number().nonnegative().prefault(1),
    单位: z.string().prefault("个"),
    伤害加成: z.coerce.number().optional(), //专属独立字段，仅当“杀伤”时适用，此时使用该消耗品后，对抗判定应有加成。写在这里作为描述即可。
  })
  .merge(OptionalAttributesSchema)
  .passthrough()
  .transform((value) => {
    const sixAttrs = ["活力", "灵性", "理智", "人性", "敏捷", "运气"];

    // 检查是否所有六维属性都不存在（这意味着 AI 刚生成，还没分配具体数值）
    // 且没有伤害加成字段【都不存在，或者全都是 0】
    const hasNoStats =
      !sixAttrs.some((attr) => value[attr] !== undefined && value[attr] !== 0) &&
      (!value.伤害加成 || value.伤害加成 === 0);

    if (hasNoStats) {
      const seqRank = parseSequenceRank(value.序列);
      const baseValue = getSequenceBaseValue(seqRank);

      // 修复点 1：为 optional 字段提供默认空字符串回退，防止下游函数崩溃
      const { attributes, damageBonus } = generateConsumableStats(
        baseValue,
        value.类型 || "",
        value.效果 || "",
        value.作用属性 || "",
      );

      // 注入生成的属性（仅注入存在的键，避免生成 0）
      for (const [key, val] of Object.entries(attributes)) {
        value[key] = val;
      }
      // 如果有伤害加成，则注入
      if (damageBonus !== undefined) {
        value.伤害加成 = damageBonus;
        // 修复点 2：避免出现 "undefined (机制：...)"
        const currentDesc = value.描述 || "";
        // 为了让 AI 写剧情时更直白，可以在描述后自动追加一句机制说明
        value.描述 =
          `${currentDesc} (机制：消耗自身属性发动，在对抗判定中获得 +${damageBonus} 点伤害加成)`.trim();
      }

      console.log(`[消耗品系统] 已为 [${value.名称}] 生成动态数据。`);
    }
    return value;
  });

// 封印物级别和编号同步机制
const syncSealedItemLevelAndNumber = (item) => {
  const { 级别, 序列 } = item;

  // 功能一：如果级别为空，则级别和编号全为空
  if (!级别 || 级别.trim() === "") {
    item.级别 = "";
    item.编号 = "";
    return item;
  }

  // 功能二：检测级别是否包含关键词，激活同步机制
  const levelKeywords = ["1", "2", "3", "0", "真神", "旧日", "支柱"];
  const shouldSync = levelKeywords.some((keyword) => 级别.includes(keyword));

  if (!shouldSync) {
    return item; // 不需要同步，直接返回
  }

  // 解析序列等级
  const parseSequenceLevel = (sequenceStr) => {
    if (!sequenceStr) return null;

    // 检查特殊级别
    if (sequenceStr.includes("支柱")) return "支柱";
    if (sequenceStr.includes("旧日")) return "旧日";

    // 提取数字序列
    const match = sequenceStr.match(/序列(\d)/);
    if (match) {
      return parseInt(match[1]);
    }

    // 直接数字匹配
    const directMatch = sequenceStr.match(/\b([0-9])\b/);
    if (directMatch) {
      return parseInt(directMatch[1]);
    }

    return null;
  };

  const sequenceLevel = parseSequenceLevel(序列);

  // 功能三：序列验证失败处理
  if (sequenceLevel === null) {
    item.级别 = "未评级封印物";
    item.序列 = "无";
    item.编号 = "无";
    return item;
  }

  // 根据序列等级同步级别（编号不做处理，保持原值）
  if (sequenceLevel === "支柱") {
    item.级别 = "支柱级封印物";
    item.编号 = "无";
  } else if (sequenceLevel === "旧日") {
    item.级别 = "旧日级封印物";
    item.编号 = "无";
  } else if (sequenceLevel === 0) {
    item.级别 = "真神级封印物";
    item.编号 = "无";
  } else if (sequenceLevel === 1 || sequenceLevel === 2) {
    item.级别 = "0级封印物";
    // 编号不做处理，保持用户填写的值
  } else if (sequenceLevel === 3 || sequenceLevel === 4) {
    item.级别 = "1级封印物";
    // 编号不做处理，保持用户填写的值
  } else if (sequenceLevel === 5 || sequenceLevel === 6) {
    item.级别 = "2级封印物";
    // 编号不做处理，保持用户填写的值
  } else if (sequenceLevel === 7 || sequenceLevel === 8 || sequenceLevel === 9) {
    item.级别 = "3级封印物";
    // 编号不做处理，保持用户填写的值
  } else {
    item.级别 = "未评级封印物";
    item.编号 = "无";
  }

  return item;
};

// 装备Schema
const ItemSchema = z
  .object({
    名称: z.string().prefault("未命名装备"),
    编号: z.string().optional(),
    级别: z.string().optional(),
    序列: z.string().prefault("普通"),
    途径: z.string().optional(),
    类型: z.string().optional(),
    描述: z.string().optional(),
    特质: z.string().optional(), // 新增特质字段
    副作用: z.string().optional(), //由AI自行在剧情中生成装备时填写
    isEquipped: z.boolean().prefault(false),
  })
  .merge(BaseAttributesSchema)
  .passthrough()
  .transform((value) => {
    // 首先执行同步机制
    value = syncSealedItemLevelAndNumber(value);

    const sixAttrs = ["活力", "灵性", "理智", "人性", "敏捷", "运气"];
    // 👇 --- 核心判定锁 --- 👇
    // 检查六项属性中是否含有 0（或者未定义）。只要有一个是 0，说明它是 AI 刚编出来的/没填完整的，立刻触发分配。
    const needsAllocation = sixAttrs.some((attr) => !value[attr] || value[attr] === 0);

    if (needsAllocation) {
      // 1. 获取序列基准值
      const seqRank = parseItemSequenceRank(value.序列);

      const baseValue = getSequenceBaseValue(seqRank);
      // 2. 如果没有填特质，随机赋予一个特质 (可选逻辑)
      if (!value.特质 || value.特质 === "") {
        const traitNames = Object.keys(GameDBManager.DB.traitDB).filter((k) => k !== "空");
        // 有 20% 的概率产生带有明显倾向的特质装备
        if (Math.random() < 0.2) {
          value.特质 = traitNames[Math.floor(Math.random() * traitNames.length)];
        } else {
          value.特质 = "";
        }
      }

      // 3. 跑分配模型（传入途径与特质）
      const generatedStats = generateItemStats(
        baseValue,
        value.类型 || "",
        value.名称 || "",
        value.途径 || "",
        value.特质 || "",
      );

      // 4. 强行写入分配结果，你需要同时分配特质
      sixAttrs.forEach((attr) => {
        value[attr] = generatedStats[attr];
      });
      console.log(
        `[装备系统] 已为 ${value.名称} (途径:${value.途径 || "无"}, 特质:${value.特质}) 执行双轨权重坍缩。`,
      );
    }
    return value;
  });

// 扮演法Schema（限制百分比加成最大值，兼容数字/字符串输入）
const PlayMethodSchema = z
  .object({
    名称: z.string().prefault(""),
    序列: z.string().prefault(""), // 如"序列9-占卜家"
    描述: z.string().optional(),
    // 保留：键为属性名（如"全部属性"），值为百分比字符串（如"3%"）
    百分比加成: z
      .record(
        z.string(),
        z.union([z.string(), z.number()]), // 联合类型：string | number
      )
      .optional()
      .nullable(),
    isEquipped: z.boolean().prefault(false),
  })
  .passthrough() // 保留额外字段
  .transform((playMethod) => {
    // 仅当百分比加成存在且非空时，才约束最大值（避免空值被替换）
    if (
      playMethod.百分比加成 &&
      typeof playMethod.百分比加成 === "object" &&
      !Array.isArray(playMethod.百分比加成)
    ) {
      playMethod.百分比加成 = constrainBonusPercent(
        playMethod.百分比加成,
        playMethod.序列,
        "扮演法",
      );
    }
    // 保留原始值（如果是null/undefined，不强制设为空对象）
    return playMethod;
  });

// 非凡特性Schema（兼容 AI 偷懒输出的纯字符串/数字，自动转为对象）
const TraitSchema = z
  .object({
    名称: z.string().optional(""),
    等阶: z.string().prefault("普通"),
    描述: z.string().optional(),
    序列: z.string().optional(""), // 如"序列9-占卜家"

    // 🌟 核心修复：使用 z.preprocess 拦截并清洗数据
    百分比加成: z.preprocess(
      (val) => {
        // 1. 如果 AI 偷懒直接传了字符串（如 "3%"）或数字（如 3）
        if (typeof val === "string" || typeof val === "number") {
          // 自动将它包装成标准 Record 格式
          return { 全部属性: String(val) };
        }
        // 2. 如果本来就是对象、null 或 undefined，直接放行，交给后面的 record 校验
        return val;
      },
      // 预处理完成后，再按照严格的 record 格式进行校验
      z
        .record(
          z.string(),
          z.union([z.string(), z.number()]), // 联合类型：string | number
        )
        .optional()
        .nullable(),
    ),
  })
  .passthrough(); // 保留额外字段
//   .transform(trait => {
//   // 无论序列是否存在，只要百分比加成是有效对象，就执行约束：
//   // 1. 有序列 → 按序列等级约束（如序列9=3%）；
//   // 2. 无序列 → parseSequenceRank返回 10 → 按10%约束（适配天赋）；
//   if (trait.百分比加成
//     && typeof trait.百分比加成 === 'object'
//     && !Array.isArray(trait.百分比加成)) {
//     // 即使序列为空，也传入（parseSequenceRank会返回 10，对应10%）
//     trait.百分比加成 = constrainBonusPercent(
//     trait.百分比加成,
//     trait.序列 || '', // 序列为空则传空字符串，parseSequenceRank返回 10
//     '非凡特性'
//     );
//   }
//   return trait;
// });

// 1. 定义极其精简且宽容的基础能力结构
const AbilityItemSchema = z
  .object({
    名称: z.string().default("未知能力"),
    描述: z.string().optional().default(""),
    类型: z.string().optional().default("非凡能力"),
  })
  .passthrough(); // 允许混入其他多余字段，绝不报错拦截

// 2. 核心：彻底中文化的能力字典 Schema
const AbilitiesRecordSchema = z.preprocess(
  (val) => {
    if (!val) return {};

    // 统一的清洗函数：保留基础字段和战斗扩展字段
    const cleanAbilityItem = (ab) => {
      const cleaned = {
        名称: String(ab.名称 || ab.name || "").trim(),
        描述: String(ab.描述 || ab.description || "").trim(),
        类型: String(ab.类型 || ab.type || "非凡能力").trim(),
      };

      // 保留战斗扩展字段（如果存在）
      const battleFields = [
        "damageType",
        "power",
        "cost",
        "targetType",
        "priority",
        "effects",
        "customDamageCalculator",
        "isHeal",
        "healAmt",
        "healType",
        "healValueType",
        "triggerTiming",
        "isPassive",
        "skillTags",
        "applyTags",
        "removeTags", // 🆕 标签系统字段
        "conditionalParams", // 🆕 条件参数集字段
      ];

      battleFields.forEach((field) => {
        if (ab[field] !== undefined) {
          cleaned[field] = ab[field];
        }
      });

      return cleaned;
    };

    // 【老档升级】：扁平数组转字典
    if (Array.isArray(val)) {
      const migrated = {};
      val.forEach((ab) => {
        if (!ab || typeof ab !== "object") return;

        const nameVal = ab.名称 || ab.name;
        if (!nameVal || String(nameVal).trim() === "") return;

        // 1. 识别来源字段作为 Key，但不存入最终对象
        const key = ab.来源序列 || ab.fromSequence || ab.序列 || "未知来源";

        if (!migrated[key]) migrated[key] = [];

        // 2. 仅保留三个指定字段
        migrated[key].push(cleanAbilityItem(ab));
      });
      return migrated;
    }

    // 【新档清洗】：字典深度去空与中文化
    if (typeof val === "object" && val !== null) {
      const cleaned = {};
      Object.entries(val).forEach(([key, arr]) => {
        if (Array.isArray(arr)) {
          const validAbs = arr
            .filter((ab) => {
              if (!ab || typeof ab !== "object") return false;
              const nameVal = ab.名称 || ab.name;
              return nameVal && String(nameVal).trim() !== "";
            })
            .map((ab) => cleanAbilityItem(ab)); // 3. 映射时强制剔除所有非标字段（包括 fromSequence）

          if (validAbs.length > 0) {
            cleaned[key] = validAbs;
          }
        }
      });
      return cleaned;
    }

    return {}; // 兜底
  },
  z.record(z.string(), z.array(AbilityItemSchema)).catch({}),
);
