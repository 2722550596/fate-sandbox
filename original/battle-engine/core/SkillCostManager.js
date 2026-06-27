// SkillCostManager.js - 来源: original.js

// === class SkillCostManager (行 758-876) ===

class SkillCostManager {
  /**
   * 检查是否能够承担技能消耗
   * @param {Object} caster - 施法者
   * @param {Object} skill - 技能对象
   * @returns {Object} 检查结果
   */
  static canAfford(caster, skill) {
    if (!skill.cost) {
      return { canAfford: true, message: "无消耗" };
    }

    const costType = skill.cost.type;
    const costAmount = skill.cost.amount;
    const currentValue = this.getCurrentAttributeValue(caster, costType);

    if (currentValue < costAmount) {
      return {
        canAfford: false,
        message: `${this.getAttributeDisplayName(costType)}不足，需要${costAmount}，当前${currentValue}`,
      };
    }

    return { canAfford: true, message: "资源充足" };
  }

  /**
   * 扣除技能消耗
   * @param {Object} caster - 施法者
   * @param {Object} skill - 技能对象
   * @returns {Object} 扣除结果
   */
  static deductCost(caster, skill) {
    if (!skill.cost) {
      return { success: true, message: "无消耗" };
    }

    const affordCheck = this.canAfford(caster, skill);
    if (!affordCheck.canAfford) {
      return { success: false, message: affordCheck.message };
    }

    const costType = skill.cost.type;
    const costAmount = skill.cost.amount;
    const oldValue = this.getCurrentAttributeValue(caster, costType);
    const newValue = Math.max(0, oldValue - costAmount);

    this.setCurrentAttributeValue(caster, costType, newValue);

    return {
      success: true,
      message: `消耗${costAmount}点${this.getAttributeDisplayName(costType)}`,
      oldValue: oldValue,
      newValue: newValue,
    };
  }

  /**
   * 获取当前属性值
   */
  static getCurrentAttributeValue(hero, costType) {
    const attributeMap = {
      currentVitality: "当前活力",
      currentAgility: "当前敏捷",
      currentSpirit: "当前灵性",
      currentSanity: "当前理智",
      currentHumanity: "当前人性",
    };

    const attributeName = attributeMap[costType];
    if (!attributeName) {
      console.warn(`[SkillCostManager] 未知的消耗类型: ${costType}`);
      return 0;
    }

    return hero.additionalStats[attributeName] || 0;
  }

  /**
   * 设置当前属性值
   */
  static setCurrentAttributeValue(hero, costType, value) {
    const attributeMap = {
      currentVitality: "当前活力",
      currentAgility: "当前敏捷",
      currentSpirit: "当前灵性",
      currentSanity: "当前理智",
      currentHumanity: "当前人性",
    };

    const attributeName = attributeMap[costType];
    if (attributeName) {
      hero.additionalStats[attributeName] = value;

      // 同步到Battle-Engine标准属性
      if (attributeName === "当前活力") {
        hero.health = value;
        hero.currentHealth = value;
      } else if (attributeName === "当前敏捷") {
        hero.speed = value;
      }
    }
  }

  /**
   * 获取属性显示名称
   */
  static getAttributeDisplayName(costType) {
    const displayNames = {
      currentVitality: "活力",
      currentAgility: "敏捷",
      currentSpirit: "灵性",
      currentSanity: "理智",
      currentHumanity: "人性",
    };

    return displayNames[costType] || costType;
  }
}
