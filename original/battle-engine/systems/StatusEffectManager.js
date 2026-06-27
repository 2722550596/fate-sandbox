// StatusEffectManager.js - 来源: original.js

// === class StatusEffectManager (行 2991-3180) ===

class StatusEffectManager {
  constructor() {
    this.config = null;
    this.defaultConfig = this.getDefaultConfig();

    console.log("[StatusEffectManager] 状态效果管理器已初始化");
  }

  /**
   * 获取默认配置
   * @returns {Object} 默认配置对象
   */
  getDefaultConfig() {
    return {
      vitality: [
        {
          threshold: 0.0,
          effect: {
            name: "死亡",
            type: "debuff",
            stat: "attack",
            valueType: "percentage",
            power: 80,
            duration: 1,
          },
        },
        {
          threshold: 0.29,
          effect: {
            name: "重伤",
            type: "debuff",
            stat: "attack",
            valueType: "percentage",
            power: 50,
            duration: 1,
          },
        },
        {
          threshold: 0.49,
          effect: {
            name: "中等受伤",
            type: "debuff",
            stat: "attack",
            valueType: "percentage",
            power: 30,
            duration: 1,
          },
        },
        {
          threshold: 0.79,
          effect: {
            name: "轻伤",
            type: "debuff",
            stat: "attack",
            valueType: "percentage",
            power: 15,
            duration: 1,
          },
        },
      ],
      agility: [
        {
          threshold: 0.0,
          effect: {
            name: "完全瘫痪",
            type: "debuff",
            stat: "damageTakenIncrease",
            valueType: "percentage",
            power: 100,
            duration: 1,
          },
        },
        {
          threshold: 0.29,
          effect: {
            name: "几乎无法移动",
            type: "debuff",
            stat: "damageTakenIncrease",
            valueType: "percentage",
            power: 60,
            duration: 1,
          },
        },
        {
          threshold: 0.49,
          effect: {
            name: "行动迟缓",
            type: "debuff",
            stat: "damageTakenIncrease",
            valueType: "percentage",
            power: 35,
            duration: 1,
          },
        },
        {
          threshold: 0.79,
          effect: {
            name: "行动略微受阻",
            type: "debuff",
            stat: "damageTakenIncrease",
            valueType: "percentage",
            power: 18,
            duration: 1,
          },
        },
      ],
      spirit: [
        {
          threshold: 0.0,
          effect: {
            name: "灵性耗尽",
            type: "debuff",
            stat: "damageDealtDecrease",
            valueType: "percentage",
            power: 70,
            duration: 1,
          },
        },
        {
          threshold: 0.29,
          effect: {
            name: "灵性干涸",
            type: "debuff",
            stat: "damageDealtDecrease",
            valueType: "percentage",
            power: 45,
            duration: 1,
          },
        },
        {
          threshold: 0.49,
          effect: {
            name: "灵性余量紧张",
            type: "debuff",
            stat: "damageDealtDecrease",
            valueType: "percentage",
            power: 25,
            duration: 1,
          },
        },
        {
          threshold: 0.79,
          effect: {
            name: "灵性微耗",
            type: "debuff",
            stat: "damageDealtDecrease",
            valueType: "percentage",
            power: 12,
            duration: 1,
          },
        },
      ],
      sanity: [
        {
          threshold: 0.0,
          effect: {
            name: "彻底失去理智，陷入疯狂",
            type: "debuff",
            stat: "defense",
            valueType: "percentage",
            power: 75,
            duration: 1,
          },
        },
        {
          threshold: 0.29,
          effect: {
            name: "理智濒临崩溃",
            type: "debuff",
            stat: "defense",
            valueType: "percentage",
            power: 55,
            duration: 1,
          },
        },
        {
          threshold: 0.49,
          effect: {
            name: "理智动摇",
            type: "debuff",
            stat: "defense",
            valueType: "percentage",
            power: 35,
            duration: 1,
          },
        },
        {
          threshold: 0.79,
          effect: {
            name: "理智受冲击",
            type: "debuff",
            stat: "defense",
            valueType: "percentage",
            power: 18,
            duration: 1,
          },
        },
      ],
      humanity: [
        {
          threshold: 0.0,
          effect: {
            name: "彻底失去人性，非人化",
            type: "debuff",
            stat: "damageDealtDecrease",
            valueType: "percentage",
            power: 55,
            duration: 1,
          },
        },
        {
          threshold: 0.29,
          effect: {
            name: "人性泯灭",
            type: "debuff",
            stat: "damageDealtDecrease",
            valueType: "percentage",
            power: 35,
            duration: 1,
          },
        },
        {
          threshold: 0.49,
          effect: {
            name: "人性扭曲",
            type: "debuff",
            stat: "damageDealtDecrease",
            valueType: "percentage",
            power: 20,
            duration: 1,
          },
        },
        {
          threshold: 0.79,
          effect: {
            name: "人性动摇",
            type: "debuff",
            stat: "damageDealtDecrease",
            valueType: "percentage",
            power: 10,
            duration: 1,
          },
        },
      ],
    };
  }

  /**
   * 加载配置文件
   * @param {Object} config - 配置对象
   * @returns {boolean} 是否加载成功
   */
  loadConfig(config) {
    try {
      if (this.validateConfig(config)) {
        this.config = config;
        console.log("[StatusEffectManager] 配置加载成功");
        return true;
      } else {
        console.error("[StatusEffectManager] 配置验证失败，使用默认配置");
        this.config = this.defaultConfig;
        return false;
      }
    } catch (error) {
      console.error("[StatusEffectManager] 配置加载失败:", error);
      this.config = this.defaultConfig;
      return false;
    }
  }

  /**
   * 验证配置格式
   * @param {Object} config - 配置对象
   * @returns {boolean} 是否有效
   */
  validateConfig(config) {
    const attributes = ["vitality", "agility", "spirit", "sanity", "humanity"];

    for (const attr of attributes) {
      if (!config[attr] || !Array.isArray(config[attr])) {
        console.error(`[StatusEffectManager] 缺少属性配置: ${attr}`);
        return false;
      }

      for (const item of config[attr]) {
        if (typeof item.threshold !== "number" || item.threshold < 0 || item.threshold > 1) {
          console.error(`[StatusEffectManager] 无效的阈值: ${item.threshold}`);
          return false;
        }

        if (!item.effect || !item.effect.name || !item.effect.type) {
          console.error(`[StatusEffectManager] 无效的效果配置`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 检查并应用状态效果
   * @param {Hero} hero - 角色对象
   * @returns {Array} 应用的状态效果列表
   */
  checkAndApplyEffects(hero) {
    const appliedEffects = [];
    const config = this.config || this.defaultConfig;

    // 计算五种属性的百分比
    const percentages = {
      vitality: hero.additionalStats.当前活力 / hero.additionalStats.活力,
      agility: hero.additionalStats.当前敏捷 / hero.additionalStats.敏捷,
      spirit: hero.additionalStats.当前灵性 / hero.additionalStats.灵性,
      sanity: hero.additionalStats.当前理智 / hero.additionalStats.理智,
      humanity: hero.additionalStats.当前人性 / hero.additionalStats.人性,
    };

    // 对每种属性检查状态效果
    for (const [attrName, percentage] of Object.entries(percentages)) {
      const attrConfig = config[attrName];
      if (!attrConfig) continue;

      // 找到所有满足条件的阈值
      const matchingThresholds = attrConfig.filter((item) => percentage <= item.threshold);

      // 如果有多个满足条件，选择百分比最低的（即阈值最小的）
      if (matchingThresholds.length > 0) {
        // 按阈值升序排序，取第一个
        matchingThresholds.sort((a, b) => a.threshold - b.threshold);
        const selectedEffect = matchingThresholds[0].effect;

        // 检查是否已经有相同效果
        const hasEffect = hero.effects.some((e) => e.name === selectedEffect.name);

        if (!hasEffect) {
          // 应用效果
          const effectInstance = {
            name: selectedEffect.name,
            type: selectedEffect.type,
            stat: selectedEffect.stat,
            valueType: selectedEffect.valueType,
            power: selectedEffect.power,
            duration: selectedEffect.duration,
            appliedAt: Date.now(),
          };

          hero.effects.push(effectInstance);
          appliedEffects.push(effectInstance);

          console.log(
            `[StatusEffectManager] 应用状态效果: ${selectedEffect.name} 到 ${hero.name} (${attrName}: ${(percentage * 100).toFixed(1)}%)`,
          );
        }
      }
    }

    return appliedEffects;
  }

  /**
   * 热重载配置
   * @param {Object} newConfig - 新配置对象
   * @returns {boolean} 是否重载成功
   */
  reloadConfig(newConfig) {
    console.log("[StatusEffectManager] 开始热重载配置");

    // 保存当前配置作为备份
    const backup = this.config;

    try {
      if (this.validateConfig(newConfig)) {
        this.config = newConfig;
        console.log("[StatusEffectManager] 配置热重载成功");
        return true;
      } else {
        // 恢复备份
        this.config = backup;
        console.error("[StatusEffectManager] 新配置无效，已恢复备份");
        return false;
      }
    } catch (error) {
      // 恢复备份
      this.config = backup;
      console.error("[StatusEffectManager] 配置热重载失败:", error);
      return false;
    }
  }
}
