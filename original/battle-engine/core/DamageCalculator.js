// DamageCalculator.js - 来源: original.js

// === class DamageCalculator (行 466-753) ===

class DamageCalculator {
  /**
   * 主伤害计算入口 (使用 battle-engine 原始公式 + 神性修正)
   * @param {Object} attacker - 攻击者
   * @param {Object} defender - 防御者
   * @param {Object} skill - 技能对象
   * @returns {Object} 伤害计算结果
   */
  static calculate(attacker, defender, skill) {
    const damageType = skill.damageType || "physical";

    try {
      // 1. 检查是否使用自定义伤害计算器
      if (skill.customDamageCalculator) {
        const customCalculator = CustomDamageCalculators.getCalculator(
          skill.customDamageCalculator,
        );
        if (customCalculator) {
          const damage = customCalculator(attacker, defender, skill);
          const targetAttribute = AttributeCalculator.getTargetAttribute(damageType);

          console.log(`[DamageCalculator] 使用自定义伤害计算: ${skill.customDamageCalculator}`);

          return {
            damage: Math.max(0, damage),
            targetAttribute: targetAttribute,
            formula: `自定义计算(${skill.customDamageCalculator}): ${damage}`,
            damageType: damageType,
            isCustomCalculator: true,
          };
        } else {
          console.warn(
            `[DamageCalculator] 未找到自定义计算器: ${skill.customDamageCalculator}，使用标准计算`,
          );
        }
      }

      // 2. 根据伤害类型更新攻击者和防御者的 attack/defense 属性
      const attackerStats = AttributeCalculator.updateHeroStats(attacker, damageType);
      const defenderStats = AttributeCalculator.updateHeroStats(defender, damageType);

      // 3. 使用 battle-engine 原始伤害公式 + 神性修正
      const damage = this.calculateDamageWithDivinity(attacker, defender, skill);

      // 4. 确定目标属性
      const targetAttribute = AttributeCalculator.getTargetAttribute(damageType);

      // 5. 生成公式说明
      const formula = this.generateFormulaDescription(
        attackerStats.attack,
        defenderStats.defense,
        attacker.additionalStats.神性,
        skill.power ?? 1,
        damage,
        damageType,
      );

      return {
        damage: Math.max(0, damage),
        targetAttribute: targetAttribute,
        formula: formula,
        damageType: damageType,
      };
    } catch (error) {
      console.error("[DamageCalculator] 伤害计算错误:", error);
      return {
        damage: 0,
        targetAttribute: "当前活力",
        formula: "计算错误",
        damageType: damageType,
      };
    }
  }

  /**
   * 使用神性修正的伤害计算 (battle-engine 原始公式)
   * @param {Object} attacker - 攻击者
   * @param {Object} defender - 防御者
   * @param {Object} skill - 技能对象
   * @returns {number} 计算后的伤害值
   */
  static calculateDamageWithDivinity(attacker, defender, skill) {
    const damageType = skill.damageType || "physical";

    // 使用AttributeCalculator计算攻击力和防御力（应用buff/debuff修正）
    const attack = AttributeCalculator.calculateAttack(attacker, damageType);
    const defense = AttributeCalculator.calculateDefense(defender, damageType);

    const attackDefenseRatio = attack / defense;
    const divinityModifier = attacker.additionalStats.神性 ?? 1;

    // 🔥 关键修改：使用getPower()方法，传入施法者以获取序列相关的power
    const effectivePower = skill.getPower ? skill.getPower(attacker) : (skill.power ?? 1);

    // 基础伤害计算（移除了/50和+2）
    let baseDamage = divinityModifier * effectivePower * attackDefenseRatio;

    // 添加随机伤害浮动（0.9~1.1）
    const randomFactor = 0.9 + Math.random() * 0.2;
    let damage = baseDamage * randomFactor;

    // 应用伤害修正系数（在随机修正之后）
    // 计算攻击者的"造成伤害"修正
    const attackerMod = this.calculateDamageModifier(
      attacker,
      "damageDealtIncrease",
      "damageDealtDecrease",
    );
    // 计算防御者的"受到伤害"修正
    const defenderMod = this.calculateDamageModifier(
      defender,
      "damageTakenIncrease",
      "damageTakenDecrease",
    );

    // 🆕 计算标签克制修正
    const tagMod = this.calculateTagModifier(attacker, defender, skill);

    // 将所有修正值相加得到总修正
    const totalModifier = attackerMod + defenderMod + tagMod;

    // 应用总修正到伤害值
    damage = damage * (1 + totalModifier);

    // 向下取整并确保非负
    return Math.max(0, Math.floor(damage));
  }

  /**
   * 生成伤害公式描述
   */
  static generateFormulaDescription(attack, defense, divinity, power, finalDamage, damageType) {
    const damageTypeNames = {
      physical: "物理",
      mystical: "神秘",
      mental: "精神",
      mixed: "混合",
    };

    return `${damageTypeNames[damageType] || "未知"}伤害: 攻击=${attack}, 防御=${defense}, 神性=${divinity}, 技能倍率=${power} → 最终伤害=${finalDamage}`;
  }

  /**
   * 应用伤害到目标
   * @param {Object} target - 目标角色
   * @param {Object} damageResult - 伤害计算结果
   */
  static applyDamage(target, damageResult) {
    const targetAttr = damageResult.targetAttribute;
    const currentValue = target.additionalStats[targetAttr];
    const newValue = Math.max(0, currentValue - damageResult.damage);

    target.additionalStats[targetAttr] = newValue;

    // 同步到Battle-Engine标准属性
    if (targetAttr === "当前活力") {
      target.health = newValue;
      target.currentHealth = newValue;
    }

    return {
      oldValue: currentValue,
      newValue: newValue,
      actualDamage: currentValue - newValue,
    };
  }

  /**
   * 计算伤害修正系数（只处理百分比类型）
   * @param {Hero} hero - 角色
   * @param {string} increaseStat - 增加伤害的stat名称
   * @param {string} decreaseStat - 降低伤害的stat名称
   * @returns {number} 修正系数（例如：0.3表示+30%）
   */
  static calculateDamageModifier(hero, increaseStat, decreaseStat) {
    if (!hero.effects || hero.effects.length === 0) {
      return 0;
    }

    let modifier = 0;

    hero.effects.forEach((effect) => {
      // 防御性检查：只处理百分比类型，忽略fixed类型并警告
      if (effect.valueType !== "percentage") {
        if (effect.stat === increaseStat || effect.stat === decreaseStat) {
          console.warn(
            `[DamageCalculator] 忽略非百分比的伤害修正: ${effect.name} (${effect.stat}, ${effect.valueType})`,
          );
        }
        return;
      }

      // 处理增加伤害的效果（increaseStat）
      if (effect.stat === increaseStat) {
        if (effect.type === "buff") {
          // 自己的buff：增加造成伤害
          modifier += effect.power / 100;
        } else if (effect.type === "debuff") {
          // 敌人的debuff：增加受到伤害
          modifier += effect.power / 100;
        }
      }
      // 处理降低伤害的效果（decreaseStat）
      else if (effect.stat === decreaseStat) {
        if (effect.type === "buff") {
          // 自己的buff：降低受到伤害
          modifier -= effect.power / 100;
        } else if (effect.type === "debuff") {
          // 敌人的debuff：降低造成伤害
          modifier -= effect.power / 100;
        }
      }
    });

    return modifier;
  }

  /**
   * 🆕 计算标签克制修正
   * @param {Hero} attacker - 攻击者
   * @param {Hero} defender - 防御者
   * @param {Move} skill - 技能对象
   * @returns {number} 修正系数（例如：0.2表示+20%）
   */
  static calculateTagModifier(attacker, defender, skill) {
    // 检查TagManager是否存在
    if (!window.tagManager) {
      return 0;
    }

    try {
      // 调用TagManager的异步方法（注意：这里需要同步调用，所以我们需要修改设计）
      // 由于calculateDamageWithDivinity不是async的，我们需要确保配置已经预加载
      // 或者使用同步版本的计算方法

      // 获取攻击者标签（包含技能自带标签）
      const attackerTags = window.tagManager.getTags(attacker, skill);
      const defenderTags = window.tagManager.getTags(defender);

      // 如果没有配置或没有标签，直接返回0
      if (
        !window.tagManager.tagDamageRelations ||
        attackerTags.length === 0 ||
        defenderTags.length === 0
      ) {
        return 0;
      }

      // 计算修正
      let totalModifier = 0;
      const matchedRelations = [];

      attackerTags.forEach((attackerTag) => {
        defenderTags.forEach((defenderTag) => {
          const modifier =
            window.tagManager.tagDamageRelations[attackerTag.name]?.[defenderTag.name];

          if (modifier !== undefined) {
            totalModifier += modifier;
            matchedRelations.push({
              attacker: attackerTag.name,
              defender: defenderTag.name,
              modifier: modifier,
            });
          }
        });
      });

      // 记录匹配结果（如果有）
      if (matchedRelations.length > 0 && window.tagManager.battleLogger) {
        window.tagManager.battleLogger.log("匹配克制关系:", "info");
        matchedRelations.forEach((rel) => {
          const sign = rel.modifier > 0 ? "+" : "";
          window.tagManager.battleLogger.log(
            `  ${rel.attacker} → ${rel.defender}: ${sign}${(rel.modifier * 100).toFixed(0)}%`,
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
          `[封顶] 总标签修正从 ${(totalModifier * 100).toFixed(0)}% 限制为 ${(clampedModifier * 100).toFixed(0)}%`,
          "info",
        );
      }
      return clampedModifier;
    } catch (error) {
      console.error("[DamageCalculator] 标签修正计算失败:", error);
      return 0;
    }
  }
}
