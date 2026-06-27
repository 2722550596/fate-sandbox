// AttributeCalculator.js - 来源: original.js

// === class AttributeCalculator (行 180-461) ===

class AttributeCalculator {
  /**
   * 根据伤害类型动态计算攻击力（支持buff/debuff修正）
   * @param {Object} hero - 角色对象
   * @param {string} damageType - 伤害类型
   * @returns {number} 计算后的攻击力
   */
  static calculateAttack(hero, damageType = "physical") {
    const stats = hero.additionalStats;

    // 计算最高属性值（所有伤害类型共用）
    const maxStat = Math.max(
      stats.当前活力,
      stats.当前敏捷,
      stats.当前灵性,
      stats.当前人性,
      stats.当前理智,
      stats.运气,
    );

    // 1. 根据伤害类型计算基础攻击力
    let baseAttack;
    switch (damageType) {
      case "physical":
        const physicalSpecific = (stats.当前活力 + stats.当前敏捷) / 2;
        baseAttack = Math.floor(physicalSpecific * 0.4 + maxStat * 0.6);
        break;
      case "mystical":
        const mysticalSpecific = stats.当前灵性;
        baseAttack = Math.floor(mysticalSpecific * 0.4 + maxStat * 0.6);
        break;
      case "mental":
        const mentalSpecific = (stats.当前理智 + stats.当前人性) / 2;
        baseAttack = Math.floor(mentalSpecific * 0.4 + maxStat * 0.6);
        break;
      case "mixed":
        const mixedSpecific = stats.运气;
        baseAttack = Math.floor(mixedSpecific * 0.4 + maxStat * 0.6);
        break;
      default:
        console.warn(`[AttributeCalculator] 未知伤害类型: ${damageType}`);
        const defaultSpecific = (stats.当前活力 + stats.当前敏捷) / 2;
        baseAttack = Math.floor(defaultSpecific * 0.4 + maxStat * 0.6);
    }

    // 2. 应用buff/debuff修正
    return this.applyBuffDebuff(hero, "attack", baseAttack);
  }

  /**
   * 根据伤害类型动态计算防御力（支持buff/debuff修正）
   * @param {Object} hero - 角色对象
   * @param {string} damageType - 伤害类型
   * @returns {number} 计算后的防御力
   */
  static calculateDefense(hero, damageType = "physical") {
    const stats = hero.additionalStats;

    // 计算最高属性值（所有伤害类型共用）
    const maxStat = Math.max(
      stats.当前活力,
      stats.当前敏捷,
      stats.当前灵性,
      stats.当前人性,
      stats.当前理智,
      stats.运气,
    );

    // 1. 根据伤害类型计算基础防御力
    let baseDefense;
    switch (damageType) {
      case "physical":
        const physicalSpecific = (stats.当前活力 + stats.当前敏捷) / 2;
        baseDefense = Math.floor(physicalSpecific * 0.4 + maxStat * 0.6);
        break;
      case "mystical":
        const mysticalSpecific = stats.当前灵性;
        baseDefense = Math.floor(mysticalSpecific * 0.4 + maxStat * 0.6);
        break;
      case "mental":
        const mentalSpecific = (stats.当前理智 + stats.当前人性) / 2;
        baseDefense = Math.floor(mentalSpecific * 0.4 + maxStat * 0.6);
        break;
      case "mixed":
        const mixedSpecific = stats.运气;
        baseDefense = Math.floor(mixedSpecific * 0.4 + maxStat * 0.6);
        break;
      default:
        console.warn(`[AttributeCalculator] 未知伤害类型: ${damageType}`);
        const defaultSpecific = (stats.当前活力 + stats.当前敏捷) / 2;
        baseDefense = Math.floor(defaultSpecific * 0.4 + maxStat * 0.6);
    }

    // 2. 应用buff/debuff修正
    return this.applyBuffDebuff(hero, "defense", baseDefense);
  }

  /**
   * 应用buff/debuff修正到属性值（核心方法）
   * @param {Hero} hero - 角色
   * @param {string} statName - 属性名称（'attack', 'defense', 'speed'）
   * @param {number} baseValue - 基础值
   * @returns {number} 修正后的最终值
   */
  static applyBuffDebuff(hero, statName, baseValue) {
    // 状态一致性检查：验证输入参数
    if (!hero) {
      console.error(`[AttributeCalculator] Hero对象为空或未定义`);
      return baseValue;
    }

    if (typeof baseValue !== "number" || isNaN(baseValue)) {
      console.error(
        `[AttributeCalculator] baseValue必须是有效数字: ${baseValue} (${hero.name || "Unknown"})`,
      );
      return 0;
    }

    // 验证effects数组有效性
    if (!hero.effects) {
      return baseValue;
    }

    if (!Array.isArray(hero.effects)) {
      console.error(
        `[AttributeCalculator] hero.effects必须是数组: ${typeof hero.effects} (${hero.name || "Unknown"})`,
      );
      return baseValue;
    }

    if (hero.effects.length === 0) {
      return baseValue;
    }

    let percentageTotal = 0; // 百分比修正累加
    let fixedTotal = 0; // 固定值修正累加

    hero.effects.forEach((effect) => {
      // 只处理影响该属性的buff/debuff
      if ((effect.type === "buff" || effect.type === "debuff") && effect.stat === statName) {
        if (effect.valueType === "percentage") {
          const mod = effect.power / 100;
          percentageTotal += effect.type === "buff" ? mod : -mod;
        } else if (effect.valueType === "fixed") {
          fixedTotal += effect.type === "buff" ? effect.power : -effect.power;
        }
      }
    });

    // 计算顺序：基础值 → 百分比修正 → 固定值修正 → 向下取整
    let finalValue = baseValue * (1 + percentageTotal) + fixedTotal;

    return Math.max(0, Math.floor(finalValue));
  }

  /**
   * 更新Hero对象的attack和defense属性
   * @param {Object} hero - 角色对象
   * @param {string} damageType - 伤害类型
   */
  static updateHeroStats(hero, damageType = "physical") {
    const attack = this.calculateAttack(hero, damageType);
    const defense = this.calculateDefense(hero, damageType);

    hero.attack = attack;
    hero.defense = defense;

    return { attack, defense, damageType };
  }

  /**
   * 获取伤害目标属性
   * @param {string} damageType - 伤害类型
   * @returns {string} 目标属性名称
   */
  static getTargetAttribute(damageType = "physical") {
    return damageType === "mental" ? "当前理智" : "当前活力";
  }

  /**
   * 重新计算所有六维属性的上限值（缓存计算）
   * @param {Hero} hero - 角色
   */
  static recalculateAllSixDimStats(hero) {
    // 状态一致性检查：验证hero对象完整性
    if (!hero) {
      console.error(`[AttributeCalculator] Hero对象为空或未定义`);
      return;
    }

    if (!hero.baseStats) {
      console.error(`[AttributeCalculator] Hero缺少baseStats快照: ${hero.name || "Unknown"}`);
      return;
    }

    if (!hero.additionalStats) {
      console.error(`[AttributeCalculator] Hero缺少additionalStats: ${hero.name || "Unknown"}`);
      return;
    }

    // 验证baseStats包含必要的六维属性
    const sixDimStats = ["活力", "敏捷", "灵性", "理智", "人性", "运气"];
    const missingStats = sixDimStats.filter((stat) => hero.baseStats[stat] === undefined);
    if (missingStats.length > 0) {
      console.error(
        `[AttributeCalculator] baseStats缺少属性: ${missingStats.join(", ")} (${hero.name || "Unknown"})`,
      );
      return;
    }

    sixDimStats.forEach((statName) => {
      // 1. 从baseStats获取基础值
      const baseValue = hero.baseStats[statName];

      if (baseValue === undefined) {
        console.warn(`[AttributeCalculator] baseStats中缺少${statName}属性: ${hero.name}`);
        return;
      }

      // 2. 收集所有影响该属性的buff/debuff
      let percentageTotal = 0;
      let fixedTotal = 0;

      if (hero.effects && hero.effects.length > 0) {
        hero.effects.forEach((effect) => {
          if ((effect.type === "buff" || effect.type === "debuff") && effect.stat === statName) {
            if (effect.valueType === "percentage") {
              const mod = effect.power / 100;
              percentageTotal += effect.type === "buff" ? mod : -mod;
            } else if (effect.valueType === "fixed") {
              fixedTotal += effect.type === "buff" ? effect.power : -effect.power;
            }
          }
        });
      }

      // 3. 计算最终上限值
      let finalValue = baseValue * (1 + percentageTotal) + fixedTotal;
      finalValue = Math.max(0, Math.floor(finalValue));

      // 4. 更新上限值
      hero.additionalStats[statName] = finalValue;

      // 5. 调整当前值（不能超过新上限）
      // 运气没有当前值，跳过检查
      if (statName !== "运气") {
        const currentStatName = `当前${statName}`;
        if (hero.additionalStats[currentStatName] > finalValue) {
          hero.additionalStats[currentStatName] = finalValue;
          console.log(
            `[AttributeCalculator] ${hero.name} 的${currentStatName}超过新上限，已调整: ${hero.additionalStats[currentStatName]} → ${finalValue}`,
          );
        }
      }
    });

    console.log(`[AttributeCalculator] ${hero.name} 的六维属性已重新计算`);
  }

  /**
   * 防御性编程：验证Hero对象的基本完整性
   * @param {Hero} hero - 角色对象
   * @returns {boolean} 是否通过验证
   */
  static validateHeroIntegrity(hero) {
    if (!hero) {
      console.error(`[AttributeCalculator] Hero对象为空或未定义`);
      return false;
    }

    if (!hero.name) {
      console.warn(`[AttributeCalculator] Hero缺少name属性`);
    }

    if (!hero.additionalStats) {
      console.error(`[AttributeCalculator] Hero缺少additionalStats: ${hero.name || "Unknown"}`);
      return false;
    }

    if (!hero.baseStats) {
      console.warn(
        `[AttributeCalculator] Hero缺少baseStats，可能影响六维属性计算: ${hero.name || "Unknown"}`,
      );
    }

    return true;
  }
}
