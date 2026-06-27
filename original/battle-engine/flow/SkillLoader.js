// SkillLoader.js - 来源: original.js

// === class SkillLoader (行 5570-5823) ===

class SkillLoader {
  /**
   * 从角色数据加载技能
   * @param {Object} characterData - stat_data 或 npc_data[npcName]
   * @param {string} dataSource - 'player' 或 'npc'
   * @returns {Array} Move对象数组
   */
  static loadSkillsFromCharacter(characterData, dataSource) {
    const skills = [];

    try {
      if (dataSource === "player") {
        // 从 stat_data.序列能力列表 加载
        const abilityList = characterData.序列能力列表 || {};

        Object.keys(abilityList).forEach((sequenceName) => {
          const abilities = abilityList[sequenceName];
          if (Array.isArray(abilities)) {
            abilities.forEach((ability) => {
              const skill = this.parseSkill(ability);
              if (skill) {
                skills.push(skill);
              }
            });
          }
        });

        console.log(`[SkillLoader] 从玩家数据加载了 ${skills.length} 个技能`);
      } else {
        // 从 npc_data[name].能力清单 加载
        const abilityList = characterData.能力清单 || [];

        abilityList.forEach((ability) => {
          const skill = this.parseSkill(ability);
          if (skill) {
            skills.push(skill);
          }
        });

        console.log(`[SkillLoader] 从NPC数据加载了 ${skills.length} 个技能`);
      }
    } catch (error) {
      console.error("[SkillLoader] 加载技能时发生错误:", error);
    }

    return skills;
  }

  /**
   * 解析技能配置
   * @param {Object} abilityConfig - 技能配置对象
   * @returns {Move|null} Move对象或null
   */
  static parseSkill(abilityConfig) {
    // 检查是否为战斗能力
    if (!this.isBattleAbility(abilityConfig)) {
      return null;
    }

    try {
      const skillConfig = {
        name: abilityConfig.名称 || abilityConfig.name || "未命名技能",
        power: abilityConfig.power || abilityConfig.威力 || 1.0, // 保持原始格式（可以是数字或对象）
        damageType: abilityConfig.damageType || abilityConfig.伤害类型 || "physical",
        priority: abilityConfig.priority || abilityConfig.优先级 || 0,
        targetType: abilityConfig.targetType || abilityConfig.目标类型 || "single",
        description: abilityConfig.描述 || abilityConfig.description || "",
        // 🔥 新增：治疗技能字段
        isHeal: abilityConfig.isHeal || false,
        healAmt: abilityConfig.healAmt !== undefined ? abilityConfig.healAmt : 0,
        healType: abilityConfig.healType || "活力",
        healValueType: abilityConfig.healValueType || abilityConfig.治疗数值类型 || "percentage",
        // 🆕 节点2：被动技能字段解析（支持中英文）
        isPassive: abilityConfig.isPassive || abilityConfig.被动 || false,
        // 🆕 节点3：标签字段解析（支持中英文）
        skillTags: abilityConfig.skillTags || abilityConfig.技能标签 || [],
        applyTags: abilityConfig.applyTags || abilityConfig.施加标签 || [],
        removeTags: abilityConfig.removeTags || abilityConfig.移除标签 || [],
      };

      // 解析消耗
      if (abilityConfig.cost || abilityConfig.消耗) {
        const cost = abilityConfig.cost || abilityConfig.消耗;
        const costType = cost.type || cost.类型 || "currentVitality";

        // 将中文消耗类型转换为英文属性名
        const costTypeMap = {
          活力: "currentVitality",
          敏捷: "currentAgility",
          灵性: "currentSpirit",
          理智: "currentSanity",
          人性: "currentHumanity",
        };

        skillConfig.cost = {
          type: costTypeMap[costType] || costType,
          amount: cost.amount || cost.数量 || 0,
        };
      }

      // 解析效果
      if (abilityConfig.effects || abilityConfig.效果) {
        const rawEffects = abilityConfig.effects || abilityConfig.效果;
        // 🔥 修复：转换中文字段名为英文
        skillConfig.effects = rawEffects.map((effect) => ({
          name: effect.name || effect.名称,
          type: effect.type || effect.类型,
          duration: effect.duration || effect.持续时间 || 3,
          power: effect.power || effect.威力 || effect.强度 || 0,
          priority: effect.priority || effect.优先级 || 0,
          stat: effect.stat || effect.属性 || effect.目标属性 || null,
          modifier: effect.modifier || effect.修正值 || 0,
          triggerTiming: effect.triggerTiming || effect.触发时机 || "turn_start",
          // ⭐ 新增：解析 valueType 字段（支持中英文）
          valueType: effect.valueType || effect.数值类型 || "fixed",
          // ⭐ 新增：解析 effectTarget 字段（支持中英文）
          effectTarget: effect.effectTarget || effect.效果目标 || "target",
        }));
      }

      // 🆕 节点2：解析 conditionalParams（条件参数集）
      if (abilityConfig.conditionalParams || abilityConfig.条件参数集) {
        const rawParams = abilityConfig.conditionalParams || abilityConfig.条件参数集;

        skillConfig.conditionalParams = rawParams
          .map((cp) => {
            try {
              // 解析条件表达式
              const condition = cp.condition || cp.条件;

              // 解析 params 对象（第3层参数）
              const params = cp.params || cp.参数 || {};

              // 🔥 关键：递归解析 params 中的复合对象
              const parsedParams = { ...params };

              // 递归解析 params 中的 effects（如果存在）
              if (params.effects || params.效果) {
                const rawEffects = params.effects || params.效果;
                parsedParams.effects = rawEffects.map((effect) => ({
                  name: effect.name || effect.名称,
                  type: effect.type || effect.类型,
                  duration: effect.duration || effect.持续时间 || 3,
                  power: effect.power || effect.威力 || effect.强度 || 0,
                  priority: effect.priority || effect.优先级 || 0,
                  stat: effect.stat || effect.属性 || effect.目标属性 || null,
                  modifier: effect.modifier || effect.修正值 || 0,
                  triggerTiming: effect.triggerTiming || effect.触发时机 || "turn_start",
                  valueType: effect.valueType || effect.数值类型 || "fixed",
                  effectTarget: effect.effectTarget || effect.效果目标 || "target",
                }));
              }

              // 递归解析 params 中的 cost（如果存在）
              if (params.cost || params.消耗) {
                const cost = params.cost || params.消耗;
                const costType = cost.type || cost.类型 || "currentVitality";

                const costTypeMap = {
                  活力: "currentVitality",
                  敏捷: "currentAgility",
                  灵性: "currentSpirit",
                  理智: "currentSanity",
                  人性: "currentHumanity",
                };

                parsedParams.cost = {
                  type: costTypeMap[costType] || costType,
                  amount: cost.amount || cost.数量 || 0,
                };
              }

              return {
                condition: condition,
                params: parsedParams,
              };
            } catch (error) {
              console.error("[SkillLoader] 解析 conditionalParams 失败:", error, cp);
              return null; // 解析失败时返回 null
            }
          })
          .filter((cp) => cp !== null); // 过滤掉解析失败的条件参数集
      }

      return new Move(skillConfig);
    } catch (error) {
      console.error("[SkillLoader] 解析技能失败:", error, abilityConfig);
      return null;
    }
  }

  /**
   * 判断是否为战斗能力
   * @param {Object} abilityConfig - 技能配置对象
   * @returns {boolean} 是否为战斗能力
   */
  static isBattleAbility(abilityConfig) {
    // 如果只有 name, description, type 三个字段，则为非战斗能力
    const keys = Object.keys(abilityConfig);
    const basicKeys = ["名称", "name", "描述", "description", "类型", "type"];

    const hasOnlyBasicKeys = keys.every((key) => basicKeys.includes(key));

    return !hasOnlyBasicKeys;
  }

  /**
   * 创建默认技能（用于测试或备用）
   * @param {string} name - 技能名称
   * @param {string} damageType - 伤害类型
   * @param {number} power - 威力
   * @returns {Move} Move对象
   */
  static createDefaultSkill(name = "普通攻击", damageType = "physical", power = 1.0) {
    return new Move({
      name: name,
      power: power,
      damageType: damageType,
      priority: 0,
      targetType: "single",
      description: "基础攻击技能",
    });
  }

  /**
   * 验证技能配置
   * @param {Object} skillConfig - 技能配置对象
   * @returns {Object} 验证结果 {valid: boolean, errors: Array}
   */
  static validateSkillConfig(skillConfig) {
    const errors = [];

    if (!skillConfig.name && !skillConfig.名称) {
      errors.push("技能缺少名称");
    }

    const damageType = skillConfig.damageType || skillConfig.伤害类型;
    const validDamageTypes = ["physical", "mystical", "mental", "mixed"];
    if (damageType && !validDamageTypes.includes(damageType)) {
      errors.push(`无效的伤害类型: ${damageType}`);
    }

    const power = skillConfig.power || skillConfig.威力;
    if (power !== undefined && (typeof power !== "number" || power < 0)) {
      errors.push(`无效的威力值: ${power}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors,
    };
  }
}
