// BattleErrorHandler.js - 来源: original.js

// === class BattleErrorHandler (行 1559-1616) ===

class BattleErrorHandler {
  /**
   * 处理属性映射错误
   */
  static handleAttributeMappingError(error, characterName) {
    console.error(`[BattleErrorHandler] 属性映射错误 [${characterName}]:`, error);

    // 返回默认Hero配置
    return {
      name: characterName || "Unknown",
      health: 100,
      currentHealth: 100,
      attack: 50,
      defense: 50,
      speed: 50,
      level: 1,
      additionalStats: {
        当前活力: 100,
        活力: 100,
        当前敏捷: 50,
        敏捷: 50,
        当前灵性: 50,
        灵性: 50,
        当前理智: 100,
        理智: 100,
        当前人性: 100,
        人性: 100,
        运气: 50,
        神性: 1,
      },
      sequenceRank: 10,
      sequenceString: "普通人",
      dataSource: "npc",
      originalData: {},
    };
  }

  /**
   * 处理伤害计算错误
   */
  static handleDamageCalculationError(error, attacker, defender, skill) {
    console.error("[BattleErrorHandler] 伤害计算错误:", error);

    return {
      damage: 0,
      targetAttribute: "当前活力",
      formula: "计算错误，伤害设为0",
      damageType: skill?.damageType || "physical",
    };
  }

  /**
   * 处理技能消耗错误
   */
  static handleSkillCostError(error, caster, skill) {
    console.error("[BattleErrorHandler] 技能消耗错误:", error);

    return {
      success: false,
      message: "技能消耗计算错误",
    };
  }
}
