// CustomDamageCalculators.js - 来源: original.js

// === class CustomDamageCalculators (行 3413-3471) ===

class CustomDamageCalculators {
  /**
   * 固定伤害计算
   * @param {Hero} attacker - 攻击者
   * @param {Hero} defender - 防御者
   * @param {Move} move - 技能
   * @returns {number} 固定伤害值
   */
  static fixedDamage(attacker, defender, move) {
    // 固定伤害，不受攻击力和防御力影响
    const baseDamage = move.power || 50;
    console.log(`[CustomDamageCalculators] 固定伤害: ${baseDamage}`);
    return baseDamage;
  }

  /**
   * 百分比伤害计算
   * @param {Hero} attacker - 攻击者
   * @param {Hero} defender - 防御者
   * @param {Move} move - 技能
   * @returns {number} 百分比伤害值
   */
  static percentDamage(attacker, defender, move) {
    // 基于目标当前生命值的百分比伤害
    const percentage = move.power || 0.2; // 默认 20%
    const damage = defender.additionalStats.当前活力 * percentage;
    console.log(
      `[CustomDamageCalculators] 百分比伤害: ${damage} (${percentage * 100}% of ${defender.additionalStats.当前活力})`,
    );
    return Math.max(1, Math.floor(damage));
  }

  /**
   * 真实伤害计算（无视防御）
   * @param {Hero} attacker - 攻击者
   * @param {Hero} defender - 防御者
   * @param {Move} move - 技能
   * @returns {number} 真实伤害值
   */
  static trueDamage(attacker, defender, move) {
    // 真实伤害，无视防御力
    const baseDamage = attacker.attack * (move.power || 1.0);
    console.log(`[CustomDamageCalculators] 真实伤害: ${baseDamage} (无视防御)`);
    return Math.max(1, Math.floor(baseDamage));
  }

  /**
   * 获取自定义计算函数
   * @param {string} calculatorName - 计算器名称
   * @returns {Function|null} 计算函数或null
   */
  static getCalculator(calculatorName) {
    const calculators = {
      fixedDamage: this.fixedDamage,
      percentDamage: this.percentDamage,
      trueDamage: this.trueDamage,
    };

    return calculators[calculatorName] || null;
  }
}
