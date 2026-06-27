// TargetSelector.js - 来源: original.js

// === class TargetSelector (行 4624-4726) ===

class TargetSelector {
  /**
   * 获取可选目标列表
   * @param {Object} skill - 技能对象
   * @param {Hero} caster - 施法者
   * @param {Object} battleState - 战斗状态
   * @returns {Array} 可选目标列表
   */
  static getAvailableTargets(skill, caster, battleState) {
    const targetType = skill.targetType || "single";

    switch (targetType) {
      case "single":
        // 返回所有敌方存活角色
        return battleState.getEnemyTeam(caster).filter((h) => h.additionalStats.当前活力 > 0);

      case "multi":
        // 返回所有敌方存活角色（允许多选）
        return battleState.getEnemyTeam(caster).filter((h) => h.additionalStats.当前活力 > 0);

      case "self":
        // 返回施法者自己
        return [caster];

      case "all":
        // 返回所有敌方存活角色（自动全选）
        return battleState.getEnemyTeam(caster).filter((h) => h.additionalStats.当前活力 > 0);

      case "ally":
        // 返回所有友方存活角色
        return battleState.getAllyTeam(caster).filter((h) => h.additionalStats.当前活力 > 0);

      case "allAlly":
        // 返回所有友方存活角色（自动全选）
        return battleState.getAllyTeam(caster).filter((h) => h.additionalStats.当前活力 > 0);

      default:
        console.warn(`[TargetSelector] 未知的目标类型: ${targetType}`);
        return [];
    }
  }

  /**
   * 验证目标选择
   * @param {Object} skill - 技能对象
   * @param {Array} selectedTargets - 已选择的目标列表
   * @returns {Object} 验证结果 { valid: boolean, message: string }
   */
  static validateTargets(skill, selectedTargets) {
    const targetType = skill.targetType || "single";

    if (!selectedTargets || selectedTargets.length === 0) {
      return { valid: false, message: "请选择目标" };
    }

    switch (targetType) {
      case "single":
        if (selectedTargets.length !== 1) {
          return { valid: false, message: "该技能只能选择单个目标" };
        }
        break;

      case "multi":
        if (selectedTargets.length === 0) {
          return { valid: false, message: "请至少选择一个目标" };
        }
        break;

      case "self":
      case "all":
      case "allAlly":
        // 这些类型不需要手动选择
        break;
    }

    return { valid: true, message: "" };
  }

  /**
   * 自动选择目标
   * @param {Object} skill - 技能对象
   * @param {Hero} caster - 施法者
   * @param {Object} battleState - 战斗状态
   * @returns {Array} 自动选择的目标列表
   */
  static autoSelectTargets(skill, caster, battleState) {
    const targetType = skill.targetType || "single";

    switch (targetType) {
      case "self":
        return [caster];

      case "all":
        return battleState.getEnemyTeam(caster).filter((h) => h.additionalStats.当前活力 > 0);

      case "allAlly":
        return battleState.getAllyTeam(caster).filter((h) => h.additionalStats.当前活力 > 0);

      default:
        return [];
    }
  }
}
