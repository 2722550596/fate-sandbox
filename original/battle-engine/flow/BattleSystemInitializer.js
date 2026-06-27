// BattleSystemInitializer.js - 来源: original.js

// === class BattleSystemInitializer (行 1657-1732) ===

class BattleSystemInitializer {
  /**
   * 初始化战斗系统
   * @param {Object} currentMvuState - 当前MVU状态
   * @returns {boolean} 初始化是否成功
   */
  static initialize(currentMvuState) {
    try {
      console.log("[BattleSystemInitializer] 开始初始化战斗系统...");

      // 1. 验证前端数据结构
      if (!this.validateFrontendData(currentMvuState)) {
        throw new Error("前端数据结构验证失败");
      }

      // 2. 验证核心组件
      if (!this.validateCoreComponents()) {
        throw new Error("核心组件验证失败");
      }

      // 3. 清空缓存
      globalBattleCache.clearCache();

      console.log("[BattleSystemInitializer] ✅ 战斗系统初始化完成");
      return true;
    } catch (error) {
      console.error("[BattleSystemInitializer] ❌ 战斗系统初始化失败:", error);
      return false;
    }
  }

  /**
   * 验证前端数据结构
   */
  static validateFrontendData(currentMvuState) {
    if (!currentMvuState) {
      console.error("[BattleSystemInitializer] currentMvuState 不存在");
      return false;
    }

    if (!currentMvuState.stat_data) {
      console.error("[BattleSystemInitializer] stat_data 不存在");
      return false;
    }

    console.log("[BattleSystemInitializer] ✅ 前端数据结构验证通过");
    return true;
  }

  /**
   * 验证核心组件
   */
  static validateCoreComponents() {
    const requiredClasses = [
      "AttributeMapper",
      "AttributeCalculator",
      "DamageCalculator",
      "SkillCostManager",
      "Hero",
      "Move",
    ];

    const missingClasses = requiredClasses.filter((className) => {
      return typeof window[className] === "undefined" && typeof eval(className) === "undefined";
    });

    if (missingClasses.length > 0) {
      console.error("[BattleSystemInitializer] 缺少核心组件:", missingClasses);
      return false;
    }

    console.log("[BattleSystemInitializer] ✅ 核心组件验证通过");
    return true;
  }
}
