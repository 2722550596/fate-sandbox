// Move.js - 来源: original.js

// === class Move (行 1004-1323) ===

class Move {
  constructor(config) {
    this.name = config.name || "";
    this.power = config.power !== undefined ? config.power : 0;
    this.priority = config.priority ?? 0;
    this.isHeal = config.isHeal || false;
    this.isPassive = config.isPassive || false;
    this.healAmt = config.healAmt !== undefined ? config.healAmt : 0;
    this.healType = config.healType || "活力";
    this.healValueType = config.healValueType || "percentage";
    this.customDamageCalculator = config.customDamageCalculator || null;
    this.effects = config.effects || [];

    // 诡秘之主扩展字段
    this.damageType = config.damageType || "physical";
    this.cost = config.cost || null;
    this.targetType = config.targetType || "single";

    // 🆕 标签系统扩展字段
    this.skillTags = config.skillTags || []; // 技能自带标签
    this.applyTags = config.applyTags || []; // 施加标签到目标
    this.removeTags = config.removeTags || []; // 移除目标的标签

    // 🆕 条件参数集扩展字段
    this.conditionalParams = config.conditionalParams || []; // 条件参数集数组

    // 存储其他额外属性
    this.additionalStats = {};
    const defaultKeys = [
      "name",
      "power",
      "priority",
      "isHeal",
      "isPassive",
      "healAmt",
      "healType",
      "healValueType",
      "customDamageCalculator",
      "effects",
      "damageType",
      "cost",
      "targetType",
      "skillTags",
      "applyTags",
      "removeTags",
      "conditionalParams",
    ];
    Object.keys(config).forEach((key) => {
      if (!defaultKeys.includes(key)) {
        this.additionalStats[key] = config[key];
      }
    });
  }

  getPower(caster = null) {
    // 如果power是对象（映射表），根据施法者序列等级返回对应值
    if (typeof this.power === "object" && this.power !== null && caster) {
      const sequenceRank = caster.sequenceRank;
      // 尝试精确匹配序列等级
      if (this.power[sequenceRank] !== undefined) {
        return this.power[sequenceRank];
      }
      // 如果没有精确匹配，返回默认值或最低序列的power
      const defaultPower = this.power["default"] ?? this.power["9"] ?? 1.0;
      console.warn(
        `[Move] 技能 ${this.name} 没有为序列${sequenceRank}配置power，使用默认值: ${defaultPower}`,
      );
      return defaultPower;
    }
    // 如果power是数字，直接返回
    return this.power !== undefined ? this.power : 1.0;
  }

  setPower(power) {
    this.power = power;
  }

  getPriority() {
    return this.priority;
  }
  setPriority(priority) {
    this.priority = priority;
  }

  getName() {
    return this.name;
  }
  setName(name) {
    this.name = name;
  }

  getIsHeal() {
    return this.isHeal;
  }
  setIsHeal(isHeal) {
    this.isHeal = isHeal;
  }

  getIsPassive() {
    return this.isPassive;
  }
  setIsPassive(isPassive) {
    this.isPassive = isPassive;
  }

  getHealAmt(caster = null) {
    // 如果healAmt是对象（映射表），根据施法者序列等级返回对应值
    if (typeof this.healAmt === "object" && this.healAmt !== null && caster) {
      const sequenceRank = caster.sequenceRank;
      // 尝试精确匹配序列等级
      if (this.healAmt[sequenceRank] !== undefined) {
        return this.healAmt[sequenceRank];
      }
      // 如果没有精确匹配，返回默认值
      const defaultHealAmt = this.healAmt["default"] || this.healAmt["9"] || 0;
      console.warn(
        `[Move] 技能 ${this.name} 没有为序列${sequenceRank}配置healAmt，使用默认值: ${defaultHealAmt}`,
      );
      return defaultHealAmt;
    }
    // 如果healAmt是数字，直接返回
    return this.healAmt !== undefined ? this.healAmt : 0;
  }

  setHealAmt(healAmt) {
    this.healAmt = healAmt;
  }

  getEffects() {
    return this.effects;
  }
  setEffects(effects) {
    this.effects = effects;
  }

  getAdditionalStats() {
    return this.additionalStats;
  }

  /**
   * 🔥 修改：计算治疗量（支持多属性）
   * @param {Object} sourceHero - 施法者
   * @param {Object} targetHero - 目标
   * @returns {Object} 治疗信息 { amount, attribute, oldValue, newValue }
   */
  calculateHealing(sourceHero, targetHero) {
    // 确定治疗目标属性（默认为活力）
    const healType = this.healType || "活力";

    // 属性映射
    const attributeMap = {
      活力: { current: "当前活力", max: "活力" },
      敏捷: { current: "当前敏捷", max: "敏捷" },
      人性: { current: "当前人性", max: "人性" },
      理智: { current: "当前理智", max: "理智" },
      灵性: { current: "当前灵性", max: "灵性" },
    };

    const attrs = attributeMap[healType];

    if (!attrs) {
      console.warn(`[Move] 未知的治疗类型: ${healType}，默认使用活力`);
      const defaultAttrs = attributeMap["活力"];
      const maxValue = targetHero.additionalStats[defaultAttrs.max] || 100;
      const currentValue = targetHero.additionalStats[defaultAttrs.current] || 0;

      // 根据 healValueType 选择计算逻辑
      let rawHealAmt;
      const baseHealAmt = this.getHealAmt(sourceHero);
      if (this.healValueType === "fixed") {
        rawHealAmt = baseHealAmt;
      } else {
        rawHealAmt = Math.floor(maxValue * baseHealAmt);
      }

      // 🆕 应用标签治疗修正
      const tagModifier = this.calculateTagHealingModifier(sourceHero, targetHero);
      rawHealAmt = Math.max(0, Math.floor(rawHealAmt * (1 + tagModifier)));

      return {
        amount: rawHealAmt,
        attribute: defaultAttrs.current,
        oldValue: currentValue,
        newValue: Math.min(currentValue + rawHealAmt, maxValue),
        maxValue: maxValue,
      };
    }

    // 获取当前值和最大值
    const maxValue = targetHero.additionalStats[attrs.max] || 100;
    const currentValue = targetHero.additionalStats[attrs.current] || 0;

    // 根据 healValueType 选择计算逻辑
    let rawHealAmt;
    const baseHealAmt = this.getHealAmt(sourceHero);
    if (this.healValueType === "fixed") {
      // 固定值模式：直接使用 healAmt
      rawHealAmt = baseHealAmt;
    } else {
      // 百分比模式：基于最大值的百分比（向下取整）
      rawHealAmt = Math.floor(maxValue * baseHealAmt);
    }

    // 🆕 应用标签治疗修正
    const tagModifier = this.calculateTagHealingModifier(sourceHero, targetHero);
    rawHealAmt = Math.max(0, Math.floor(rawHealAmt * (1 + tagModifier)));

    // 计算实际治疗量（不超过最大值）
    const actualHealAmt = Math.min(rawHealAmt, maxValue - currentValue);

    return {
      amount: actualHealAmt,
      attribute: attrs.current,
      oldValue: currentValue,
      newValue: currentValue + actualHealAmt,
      maxValue: maxValue,
    };
  }

  /**
   * 🆕 计算标签治疗修正
   * @param {Hero} healer - 治疗者
   * @param {Hero} target - 被治疗者
   * @returns {number} 修正系数（例如：0.2表示+20%）
   */
  calculateTagHealingModifier(healer, target) {
    // 检查TagManager是否存在
    if (!window.tagManager) {
      return 0;
    }

    try {
      // 获取治疗者和目标的标签
      const healerTags = window.tagManager.getTags(healer, this);
      const targetTags = window.tagManager.getTags(target);

      // 如果没有配置或没有标签，直接返回0
      if (
        !window.tagManager.tagHealingRelations ||
        healerTags.length === 0 ||
        targetTags.length === 0
      ) {
        return 0;
      }

      // 计算修正
      let totalModifier = 0;
      const matchedRelations = [];

      healerTags.forEach((healerTag) => {
        targetTags.forEach((targetTag) => {
          const modifier = window.tagManager.tagHealingRelations[healerTag.name]?.[targetTag.name];

          if (modifier !== undefined) {
            totalModifier += modifier;
            matchedRelations.push({
              healer: healerTag.name,
              target: targetTag.name,
              modifier: modifier,
            });
          }
        });
      });

      // 记录匹配结果（如果有）
      if (matchedRelations.length > 0 && window.tagManager.battleLogger) {
        window.tagManager.battleLogger.log("匹配治疗关系:", "info");
        matchedRelations.forEach((rel) => {
          const sign = rel.modifier > 0 ? "+" : "";
          window.tagManager.battleLogger.log(
            `  ${rel.healer} → ${rel.target}: ${sign}${(rel.modifier * 100).toFixed(0)}%`,
            "info",
          );
        });
        window.tagManager.battleLogger.log(
          `总标签修正: ${totalModifier > 0 ? "+" : ""}${(totalModifier * 100).toFixed(0)}%`,
          "info",
        );
      }

      // 🌟 防爆封顶：最多 +150% / 最低 -75%
      const clampedModifier = Math.max(-0.75, Math.min(1.5, totalModifier));
      if (clampedModifier !== totalModifier && window.tagManager.battleLogger) {
        window.tagManager.battleLogger.log(
          `[封顶] 总治疗修正从 ${(totalModifier * 100).toFixed(0)}% 限制为 ${(clampedModifier * 100).toFixed(0)}%`,
          "info",
        );
      }
      return clampedModifier;
    } catch (error) {
      console.error("[Move] 标签治疗修正计算失败:", error);
      return 0;
    }
  }

  /**
   * 计算伤害 (使用神性修正)
   */
  calculateDamage(sourceHero, targetHero) {
    if (this.customDamageCalculator) {
      return this.customDamageCalculator(sourceHero, targetHero);
    }

    // 使用 battle-engine 原始公式，但先更新 attack/defense，并使用神性修正
    AttributeCalculator.updateHeroStats(sourceHero, this.damageType);
    AttributeCalculator.updateHeroStats(targetHero, this.damageType);

    // 调用自定义的神性修正伤害计算（传递this以便访问getPower方法）
    return DamageCalculator.calculateDamageWithDivinity(sourceHero, targetHero, this);
  }

  /**
   * 检查技能是否可用
   */
  canUse(caster) {
    return SkillCostManager.canAfford(caster, this);
  }

  /**
   * 执行技能消耗
   */
  executeCost(caster) {
    return SkillCostManager.deductCost(caster, this);
  }

  /**
   * 获取技能描述
   */
  getDescription(caster = null) {
    // 🔥 关键修改：如果power是映射表，显示当前序列的power
    let powerDisplay;
    if (typeof this.power === "object" && this.power !== null) {
      if (caster) {
        powerDisplay = this.getPower(caster);
      } else {
        // 如果没有施法者信息，显示范围
        const powers = Object.values(this.power).filter((v) => typeof v === "number");
        if (powers.length > 0) {
          const minPower = Math.min(...powers);
          const maxPower = Math.max(...powers);
          powerDisplay = minPower === maxPower ? minPower : `${minPower}-${maxPower}`;
        } else {
          powerDisplay = "?";
        }
      }
    } else {
      powerDisplay = this.power ?? 1.0;
    }

    let desc = `${this.name} (威力:${powerDisplay})`;

    if (this.cost) {
      const costName = SkillCostManager.getAttributeDisplayName(this.cost.type);
      desc += ` [消耗:${this.cost.amount}${costName}]`;
    }

    const damageTypeNames = {
      physical: "物理",
      mystical: "神秘",
      mental: "精神",
      mixed: "混合",
    };
    desc += ` [类型:${damageTypeNames[this.damageType] || this.damageType}]`;

    return desc;
  }
}
