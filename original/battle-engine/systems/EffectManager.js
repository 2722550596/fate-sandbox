// EffectManager.js - 来源: original.js

// === class EffectManager (行 3478-4049) ===

class EffectManager {
  constructor() {
    console.log("[EffectManager] 技能效果管理器已初始化");
  }

  /**
   * 解析power值（支持序列映射）
   * @param {number|Object} powerConfig - power配置（固定值或映射表）
   * @param {Hero} caster - 施法者对象
   * @param {string} effectName - 效果名称（用于日志）
   * @returns {number} 解析后的固定数值
   */
  resolvePowerValue(powerConfig, caster, effectName) {
    // 如果是固定数值，直接返回
    if (typeof powerConfig !== "object" || powerConfig === null) {
      return powerConfig ?? 0;
    }

    // 如果是序列映射，但没有施法者信息，使用默认值
    if (!caster) {
      const defaultValue = powerConfig["default"] ?? powerConfig["9"] ?? 0;
      console.warn(
        `[EffectManager] 效果 ${effectName} 使用序列映射但缺少施法者信息，使用默认值: ${defaultValue}`,
      );
      return defaultValue;
    }

    // 根据施法者序列等级查询映射表
    const sequenceRank = caster.sequenceRank;

    if (sequenceRank === undefined) {
      const defaultValue = powerConfig["default"] ?? powerConfig["9"] ?? 0;
      console.warn(
        `[EffectManager] 施法者 ${caster.name} 缺少sequenceRank属性，使用默认值: ${defaultValue}`,
      );
      return defaultValue;
    }

    // 尝试精确匹配
    if (powerConfig[sequenceRank] !== undefined) {
      return powerConfig[sequenceRank];
    }

    // 使用默认值
    const defaultValue = powerConfig["default"] ?? powerConfig["9"] ?? 0;
    console.warn(
      `[EffectManager] 效果 ${effectName} 没有为序列${sequenceRank}配置power，使用默认值: ${defaultValue}`,
    );
    return defaultValue;
  }

  /**
   * 标准化效果配置（向后兼容旧格式）
   * @param {Object} effect - 原始效果配置
   * @returns {Object} 标准化后的效果配置
   */
  normalizeEffect(effect) {
    // 创建副本，避免修改原对象
    const normalized = { ...effect };

    // 兼容旧的modifier字段：转换为power + valueType
    if (normalized.modifier !== undefined && normalized.power === undefined) {
      console.warn(`[EffectManager] 检测到旧格式modifier，已转换为power: ${effect.name}`);
      normalized.power = normalized.modifier * 100; // 0.3 → 30
      normalized.valueType = "percentage";
      delete normalized.modifier;
    }

    // 忽略buff/debuff的triggerTiming字段
    if ((normalized.type === "buff" || normalized.type === "debuff") && normalized.triggerTiming) {
      console.warn(`[EffectManager] Buff/Debuff不使用triggerTiming，已忽略: ${effect.name}`);
      delete normalized.triggerTiming;
    }

    return normalized;
  }

  /**
   * 判断是否为伤害修正系数
   * @param {string} stat - 属性名称
   * @returns {boolean}
   */
  isDamageModifierStat(stat) {
    return [
      "damageDealtIncrease",
      "damageDealtDecrease",
      "damageTakenIncrease",
      "damageTakenDecrease",
    ].includes(stat);
  }

  /**
   * 判断是否为六维属性
   * @param {string} stat - 属性名称
   * @returns {boolean}
   */
  isSixDimStat(stat) {
    return ["活力", "敏捷", "灵性", "理智", "人性", "运气"].includes(stat);
  }

  /**
   * 验证效果配置
   * @param {Object} effect - 效果配置
   * @returns {Object} {valid: boolean, errors: Array}
   */
  validateEffect(effect) {
    const errors = [];

    // 验证必需字段
    if (!effect.name) {
      errors.push("效果缺少name字段");
    }

    if (!effect.type) {
      errors.push("效果缺少type字段");
    } else if (!["buff", "debuff", "poison", "regen"].includes(effect.type)) {
      errors.push(`无效的效果类型: ${effect.type}`);
    }

    // 验证power值非负
    if (effect.power !== undefined) {
      if (typeof effect.power === "number" && effect.power < 0) {
        errors.push(`power值不能为负数: ${effect.power}`);
      }
    }

    // 验证duration在合理范围内（1-99）
    if (effect.duration !== undefined) {
      if (typeof effect.duration !== "number" || effect.duration < 1 || effect.duration > 99) {
        errors.push(`duration必须在1-99之间: ${effect.duration}`);
      }
    }

    // 验证valueType
    if (effect.valueType && !["fixed", "percentage"].includes(effect.valueType)) {
      errors.push(`无效的valueType: ${effect.valueType}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * 应用效果到角色
   * @param {Hero} hero - 目标角色
   * @param {Object} effect - 效果对象
   */
  applyEffect(hero, effect, caster = null, skill = null) {
    // 验证效果配置
    const validation = this.validateEffect(effect);
    if (!validation.valid) {
      console.error(`[EffectManager] 效果配置无效: ${effect.name}`, validation.errors);
      return {
        applied: false,
        reason: `配置无效: ${validation.errors.join(", ")}`,
      };
    }
    if (!hero.effects) {
      hero.effects = [];
    }

    // 标准化效果配置（向后兼容）
    const normalizedEffect = this.normalizeEffect(effect);

    // 验证伤害修正系数必须是百分比类型
    if (
      this.isDamageModifierStat(normalizedEffect.stat) &&
      normalizedEffect.valueType !== "percentage"
    ) {
      console.error(`[EffectManager] 伤害修正系数只支持百分比: ${normalizedEffect.name}`);
      return {
        applied: false,
        reason: "伤害修正系数只支持百分比类型",
      };
    }

    // 解析power值（支持序列映射）
    let resolvedPower = this.resolvePowerValue(
      normalizedEffect.power,
      caster,
      normalizedEffect.name,
    );

    // 🆕 应用标签修正到Poison和Regen效果
    if (normalizedEffect.type === "poison" && caster && window.tagManager) {
      try {
        const tagModifier = window.tagManager.calculateTagDamageModifier(
          caster,
          hero,
          skill || { skillTags: [] },
        );
        const modifiedPower = Math.max(0, Math.floor(resolvedPower * (1 + tagModifier)));

        if (tagModifier !== 0) {
          console.log(
            `[EffectManager] Poison效果 ${normalizedEffect.name} 应用标签修正: ${resolvedPower} → ${modifiedPower} (${tagModifier > 0 ? "+" : ""}${(tagModifier * 100).toFixed(0)}%)`,
          );
        }

        resolvedPower = modifiedPower;
      } catch (error) {
        console.error("[EffectManager] Poison标签修正计算失败:", error);
      }
    } else if (normalizedEffect.type === "regen" && caster && window.tagManager) {
      try {
        const tagModifier = window.tagManager.calculateTagHealingModifier(
          caster,
          hero,
          skill || { skillTags: [] },
        );
        const modifiedPower = Math.max(0, Math.floor(resolvedPower * (1 + tagModifier)));

        if (tagModifier !== 0) {
          console.log(
            `[EffectManager] Regen效果 ${normalizedEffect.name} 应用标签修正: ${resolvedPower} → ${modifiedPower} (${tagModifier > 0 ? "+" : ""}${(tagModifier * 100).toFixed(0)}%)`,
          );
        }

        resolvedPower = modifiedPower;
      } catch (error) {
        console.error("[EffectManager] Regen标签修正计算失败:", error);
      }
    }

    // 创建效果实例（存储解析后的固定值）
    const effectInstance = {
      name: normalizedEffect.name,
      type: normalizedEffect.type,
      duration: normalizedEffect.duration ?? 3,
      power: resolvedPower,
      stat: normalizedEffect.stat ?? null,
      valueType: normalizedEffect.valueType ?? "fixed",
      priority: normalizedEffect.priority ?? 0,
      triggerTiming: normalizedEffect.triggerTiming ?? "turn_start",
      appliedAt: Date.now(),
    };

    // 智能效果替换逻辑：检查是否已有同名效果
    const existingEffectIndex = hero.effects.findIndex(
      (e) => e.name === effectInstance.name && e.duration > 0,
    );

    if (existingEffectIndex !== -1) {
      const existingEffect = hero.effects[existingEffectIndex];
      const newPower = effectInstance.power ?? 0;
      const oldPower = existingEffect.power ?? 0;
      const newDuration = effectInstance.duration;
      const oldDuration = existingEffect.duration;

      // 情况1：新效果更强 → 完全替换
      if (newPower > oldPower) {
        hero.effects[existingEffectIndex] = effectInstance;
        console.log(
          `[EffectManager] ${hero.name} 的 ${effect.name} 被更强的效果替换 (power: ${oldPower} → ${newPower})`,
        );

        // 如果影响六维属性，触发重算
        if (this.isSixDimStat(effectInstance.stat)) {
          AttributeCalculator.recalculateAllSixDimStats(hero);
        }

        return { replaced: true, reason: "stronger" };
      }
      // 情况2：强度相同但持续时间更长 → 刷新持续时间
      else if (newPower === oldPower && newDuration > oldDuration) {
        existingEffect.duration = newDuration;
        console.log(
          `[EffectManager] ${hero.name} 的 ${effect.name} 持续时间刷新 (duration: ${oldDuration} → ${newDuration})`,
        );
        return { refreshed: true, reason: "duration_refresh" };
      }
      // 情况3：新效果更弱 → 拒绝
      else {
        console.log(`[EffectManager] ${hero.name} 已有更强的 ${effect.name} 效果，拒绝施加新效果`);
        return { rejected: true, reason: "weaker" };
      }
    }

    // 没有同名效果，正常添加
    hero.effects.push(effectInstance);
    console.log(
      `[EffectManager] 应用效果 ${effect.name} 到 ${hero.name}，持续 ${effectInstance.duration} 回合`,
    );

    // 如果影响六维属性，触发重算
    if (this.isSixDimStat(effectInstance.stat)) {
      AttributeCalculator.recalculateAllSixDimStats(hero);
    }

    return { applied: true };
  }

  /**
   * 处理所有角色的持续效果
   * @param {Array} heroes - 角色数组
   * @param {BattleLogger} battleLogger - 战斗日志记录器
   * @returns {Array} 效果触发结果数组
   */
  processEffects(heroes, battleLogger) {
    const results = [];

    heroes.forEach((hero) => {
      if (!hero.effects || hero.effects.length === 0) {
        return;
      }

      // 处理每个效果
      hero.effects.forEach((effect) => {
        const result = this.processEffect(hero, effect);
        if (result) {
          results.push(result);

          // 记录到战斗日志
          if (battleLogger) {
            battleLogger.log(result.message, "effect");
          }
        }

        // 减少持续时间
        if (effect.duration > 0) {
          effect.duration--;
        }
      });

      // 移除过期效果（增强：支持六维属性重算）
      const sixDimStats = ["活力", "敏捷", "灵性", "理智", "人性", "运气"];
      const hadSixDimEffects = hero.effects.some(
        (e) => e.duration <= 0 && sixDimStats.includes(e.stat),
      );

      hero.effects = hero.effects.filter((e) => e.duration > 0);

      // 如果有六维属性的效果过期，重新计算
      if (hadSixDimEffects) {
        AttributeCalculator.recalculateAllSixDimStats(hero);
      }
    });

    return results;
  }

  /**
   * 处理单个效果
   * @param {Hero} hero - 角色
   * @param {Object} effect - 效果对象
   * @returns {Object|null} 效果结果
   */
  processEffect(hero, effect) {
    switch (effect.type) {
      case "poison":
        return this.processPoisonEffect(hero, effect);

      case "regen":
        return this.processRegenEffect(hero, effect);

      case "buff":
        return this.processBuffEffect(hero, effect);

      case "debuff":
        return this.processDebuffEffect(hero, effect);

      default:
        return null;
    }
  }

  /**
   * 标准化效果配置，应用默认值
   * @param {Object} effect - 原始效果配置
   * @returns {Object} 标准化后的配置
   */
  normalizePoisonEffectConfig(effect) {
    return {
      type: effect.type,
      name: effect.name,
      power: effect.power !== undefined ? effect.power : 0,
      duration: effect.duration || 3,
      valueType: effect.valueType || "fixed", // 默认固定伤害
      stat: effect.stat || "当前活力", // 默认目标活力
    };
  }

  /**
   * 获取上限属性名称（去掉"当前"前缀）
   * @param {string} currentStatName - 当前属性名称（例如 '当前活力'）
   * @returns {string} 上限属性名称（例如 '活力'）
   */
  getMaxStatName(currentStatName) {
    return currentStatName.replace("当前", "");
  }

  /**
   * 计算伤害值
   * @param {Object} effect - 标准化后的效果配置
   * @param {number} maxStatValue - 目标属性的上限值
   * @returns {number} 伤害值（整数）
   */
  calculatePoisonDamage(effect, maxStatValue) {
    if (effect.valueType === "percentage") {
      // 百分比伤害：向下取整
      return Math.floor((maxStatValue * effect.power) / 100);
    } else {
      // 固定伤害
      return effect.power;
    }
  }

  /**
   * 生成效果消息
   * @param {string} heroName - 角色名称
   * @param {string} effectName - 效果名称
   * @param {string} statName - 属性名称
   * @param {number} damage - 伤害值
   * @param {number} oldValue - 旧值
   * @param {number} newValue - 新值
   * @returns {string} 格式化的消息
   */
  formatPoisonMessage(heroName, effectName, statName, damage, oldValue, newValue) {
    // 去掉"当前"前缀用于显示
    const displayStatName = statName.replace("当前", "");
    return `${heroName}的${effectName}生效，${displayStatName}变化${damage}点。${displayStatName}：${oldValue}→${newValue}`;
  }

  /**
   * 处理中毒效果
   * @param {Hero} hero - 角色
   * @param {Object} effect - 效果对象
   * @returns {Object} 效果结果
   */
  processPoisonEffect(hero, effect) {
    // 1. 标准化配置（应用默认值）
    const effectConfig = this.normalizePoisonEffectConfig(effect);

    // 2. 获取目标属性名称
    const statName = effectConfig.stat; // 例如 '当前活力'
    const maxStatName = this.getMaxStatName(statName); // 例如 '活力'

    // 3. 获取上限属性值（用于百分比计算）
    const maxStatValue = hero.additionalStats[maxStatName] || 100;

    // 4. 计算伤害值
    const damage = this.calculatePoisonDamage(effectConfig, maxStatValue);

    // 5. 获取旧值
    const oldValue = hero.additionalStats[statName] || 0;

    // 6. 计算新值（边界保护）
    const newValue = Math.max(0, oldValue - damage);

    // 7. 更新属性
    hero.additionalStats[statName] = newValue;

    // 8. 同步相关属性（仅当修改活力时）
    if (statName === "当前活力") {
      hero.health = newValue; // 同步更新（battle-engine标准属性）
      hero.currentHealth = newValue; // 同步更新（battle-engine标准属性）
    }

    // 9. 生成消息
    const message = this.formatPoisonMessage(
      hero.name,
      effect.name,
      statName,
      damage,
      oldValue,
      newValue,
    );

    // 10. 返回结果
    return {
      hero: hero,
      effect: effect,
      type: "damage",
      amount: damage,
      message: message,
    };
  }

  /**
   * 标准化再生效果配置，应用默认值
   * @param {Object} effect - 原始效果配置
   * @returns {Object} 标准化后的配置
   */
  normalizeRegenEffectConfig(effect) {
    return {
      type: effect.type,
      name: effect.name,
      power: effect.power !== undefined ? effect.power : 0,
      duration: effect.duration || 3,
      valueType: effect.valueType || "fixed", // 默认固定伤害
      stat: effect.stat || "当前活力", // 默认目标活力
    };
  }

  /**
   * 计算再生治疗量
   * @param {Object} effect - 标准化后的效果配置
   * @param {number} maxStatValue - 目标属性的上限值
   * @returns {number} 治疗值（整数）
   */
  calculateRegenHealing(effect, maxStatValue) {
    if (effect.valueType === "percentage") {
      // 百分比治疗：向下取整
      return Math.floor((maxStatValue * effect.power) / 100);
    } else {
      // 固定治疗
      return effect.power;
    }
  }

  /**
   * 生成再生效果消息
   * @param {string} heroName - 角色名称
   * @param {string} effectName - 效果名称
   * @param {string} statName - 属性名称
   * @param {number} healing - 治疗值
   * @param {number} oldValue - 旧值
   * @param {number} newValue - 新值
   * @returns {string} 格式化的消息
   */
  formatRegenMessage(heroName, effectName, statName, healing, oldValue, newValue) {
    // 去掉"当前"前缀用于显示
    const displayStatName = statName.replace("当前", "");
    return `${heroName}的${effectName}生效，${displayStatName}恢复${healing}点。${displayStatName}：${oldValue}→${newValue}`;
  }

  /**
   * 处理再生效果
   * @param {Hero} hero - 角色
   * @param {Object} effect - 效果对象
   * @returns {Object} 效果结果
   */
  processRegenEffect(hero, effect) {
    // 1. 标准化配置（应用默认值）
    const effectConfig = this.normalizeRegenEffectConfig(effect);

    // 2. 获取目标属性名称
    const statName = effectConfig.stat; // 例如 '当前活力'

    // 3. 派生上限属性名称
    const maxStatName = this.getMaxStatName(statName); // 例如 '活力'

    // 4. 获取上限属性值（用于百分比计算）
    const maxStatValue = hero.additionalStats[maxStatName] || 100;

    // 5. 计算治疗值
    const healing = this.calculateRegenHealing(effectConfig, maxStatValue);

    // 6. 获取旧值
    const oldValue = hero.additionalStats[statName] || 0;

    // 7. 计算新值（边界保护：不超过上限）
    const newValue = Math.min(maxStatValue, oldValue + healing);

    // 8. 更新属性
    hero.additionalStats[statName] = newValue;

    // 9. 同步相关属性（仅当修改活力时）
    if (statName === "当前活力") {
      hero.health = newValue; // 同步更新（battle-engine标准属性）
      hero.currentHealth = newValue; // 同步更新（battle-engine标准属性）
    }

    // 10. 生成消息
    const message = this.formatRegenMessage(
      hero.name,
      effect.name,
      statName,
      healing,
      oldValue,
      newValue,
    );

    // 11. 返回结果
    return {
      hero: hero,
      effect: effect,
      type: "heal",
      amount: healing,
      message: message,
    };
  }

  /**
   * 处理 Buff 效果
   * @param {Hero} hero - 角色
   * @param {Object} effect - 效果对象
   * @returns {Object} 效果结果
   */
  processBuffEffect(hero, effect) {
    // Buff 效果通常是被动的，在计算时生效
    // 注意：显示的是即将递减后的回合数（当前值-1）
    const remainingDuration = Math.max(0, effect.duration - 1);
    return {
      hero: hero,
      effect: effect,
      type: "buff",
      message: `${hero.name} 的 ${effect.name} 效果持续中（剩余 ${remainingDuration} 回合）`,
    };
  }

  /**
   * 处理 Debuff 效果
   * @param {Hero} hero - 角色
   * @param {Object} effect - 效果对象
   * @returns {Object} 效果结果
   */
  processDebuffEffect(hero, effect) {
    // Debuff 效果通常是被动的，在计算时生效
    // 注意：显示的是即将递减后的回合数（当前值-1）
    const remainingDuration = Math.max(0, effect.duration - 1);
    return {
      hero: hero,
      effect: effect,
      type: "debuff",
      message: `${hero.name} 受到 ${effect.name} 影响（剩余 ${remainingDuration} 回合）`,
    };
  }
}
