// TagManager.js - 来源: original.js

// === class TagManager (行 4056-4617) ===

class TagManager {
  constructor(battleLogger, worldbookManager) {
    this.battleLogger = battleLogger;
    this.worldbookManager = worldbookManager;

    // 配置缓存
    this.tagMappingConfig = null; // 标签映射配置
    this.tagDamageRelations = null; // 标签伤害修正配置
    this.tagHealingRelations = null; // 标签治疗修正配置

    console.log("[TagManager] 标签管理器已初始化");
  }

  /**
   * 添加标签到角色
   * @param {Hero} hero - 目标角色
   * @param {string} tagName - 标签名称
   * @param {number} duration - 持续回合数（0-99）
   * @param {number} stacks - 叠加层数（默认1）
   * @param {number} maxStacks - 最大层数（默认99）
   * @param {string} source - 来源标识（'inherent' | 'skill' | 'applied'）
   */
  addTag(hero, tagName, duration, stacks = 1, maxStacks = 99, source = "applied") {
    hero.tags = hero.tags || [];

    const existingTag = hero.tags.find((t) => t.name === tagName);

    if (existingTag) {
      // 叠加逻辑
      const newStacks = existingTag.stacks + stacks;
      const effectiveMaxStacks = existingTag.maxStacks || maxStacks;

      if (newStacks > effectiveMaxStacks) {
        // 超过上限：只刷新持续时间
        existingTag.duration = Math.max(existingTag.duration, duration);
        this.battleLogger.log(
          `${hero.name} 的 ${tagName} 已达上限 x${effectiveMaxStacks}，仅刷新持续时间为 ${existingTag.duration} 回合`,
          "info",
        );
      } else {
        // 未超过上限：叠加层数 + 刷新持续时间
        existingTag.stacks = newStacks;
        existingTag.duration = Math.max(existingTag.duration, duration);
        this.battleLogger.log(
          `${hero.name} 的 ${tagName} 叠加至 x${existingTag.stacks}，持续时间刷新为 ${existingTag.duration} 回合`,
          "info",
        );
      }
    } else {
      // 新标签
      hero.tags.push({
        name: tagName,
        duration: Math.max(0, duration), // 边界保护
        stacks: Math.max(1, stacks), // 边界保护
        maxStacks: maxStacks,
        source: source,
        appliedAt: Date.now(),
      });

      this.battleLogger.log(
        `${hero.name} 获得标签 ${tagName} x${stacks}，持续 ${duration} 回合，上限 ${maxStacks} 层`,
        "info",
      );
    }
  }

  /**
   * 完全移除指定标签
   * @param {Hero} hero - 目标角色
   * @param {string} tagName - 标签名称
   */
  removeTag(hero, tagName) {
    if (!hero.tags) return;

    const initialLength = hero.tags.length;
    hero.tags = hero.tags.filter((t) => t.name !== tagName);

    if (hero.tags.length < initialLength) {
      this.battleLogger.log(`${hero.name} 的 ${tagName} 已完全移除`, "info");
    }
  }

  /**
   * 移除标签层数
   * @param {Hero} hero - 目标角色
   * @param {string} tagName - 标签名称
   * @param {number} stacksToRemove - 要移除的层数（默认1）
   */
  removeTagStacks(hero, tagName, stacksToRemove = 1) {
    const tag = hero.tags.find((t) => t.name === tagName);

    if (tag) {
      tag.stacks -= stacksToRemove;

      if (tag.stacks <= 0) {
        // 边界保护：层数归0或负数，移除整个标签
        this.removeTag(hero, tagName);
      } else {
        this.battleLogger.log(`${hero.name} 的 ${tagName} 减少至 x${tag.stacks}`, "info");
      }
    }
  }

  /**
   * 获取角色所有标签（包含技能自带标签）
   * @param {Hero} hero - 目标角色
   * @param {Move} currentSkill - 当前使用的技能（可选）
   * @returns {Array} 标签数组
   */
  getTags(hero, currentSkill = null) {
    const tags = [...(hero.tags || [])]; // 复制持久化标签

    // 如果正在使用技能，添加技能自带标签
    if (currentSkill && currentSkill.skillTags && currentSkill.skillTags.length > 0) {
      currentSkill.skillTags.forEach((tagName) => {
        tags.push({
          name: tagName,
          duration: 1,
          stacks: 1,
          source: "skill",
          appliedAt: Date.now(),
        });
      });
    }

    return tags;
  }

  /**
   * 快速检查是否拥有指定标签
   * @param {Hero} hero - 目标角色
   * @param {string} tagName - 标签名称
   * @param {Move} currentSkill - 当前使用的技能（可选）
   * @returns {boolean}
   */
  hasTag(hero, tagName, currentSkill = null) {
    // 检查持久化标签
    if (hero.tags && hero.tags.some((t) => t.name === tagName)) {
      return true;
    }

    // 检查技能自带标签
    if (currentSkill && currentSkill.skillTags) {
      if (currentSkill.skillTags.includes(tagName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取指定标签对象
   * @param {Hero} hero - 目标角色
   * @param {string} tagName - 标签名称
   * @param {Move} currentSkill - 当前使用的技能（可选）
   * @returns {Object|null} 标签对象或null
   */
  getTag(hero, tagName, currentSkill = null) {
    // 先检查持久化标签
    if (hero.tags) {
      const tag = hero.tags.find((t) => t.name === tagName);
      if (tag) return tag;
    }

    // 再检查技能自带标签
    if (currentSkill && currentSkill.skillTags && currentSkill.skillTags.includes(tagName)) {
      return {
        name: tagName,
        duration: 1,
        stacks: 1,
        source: "skill",
        appliedAt: Date.now(),
      };
    }

    return null;
  }

  /**
   * 获取标签层数
   * @param {Hero} hero - 目标角色
   * @param {string} tagName - 标签名称
   * @param {Move} currentSkill - 当前使用的技能（可选）
   * @returns {number} 层数（如果没有标签返回0）
   */
  getTagStacks(hero, tagName, currentSkill = null) {
    const tag = this.getTag(hero, tagName, currentSkill);
    return tag ? tag.stacks : 0;
  }

  /**
   * 递减所有角色的标签持续时间，清理过期标签
   * @param {Array} heroes - 角色数组
   */
  decrementTagDurations(heroes) {
    heroes.forEach((hero) => {
      if (!hero.tags || hero.tags.length === 0) return;

      // 递减持续时间
      hero.tags.forEach((tag) => {
        if (tag.duration > 0) {
          tag.duration--;
        }
      });

      // 清理过期标签
      const beforeCount = hero.tags.length;
      hero.tags = hero.tags.filter((tag) => tag.duration > 0);
      const afterCount = hero.tags.length;

      // 记录日志
      if (beforeCount > afterCount) {
        this.battleLogger.log(`${hero.name} 移除了 ${beforeCount - afterCount} 个过期标签`, "info");
      }

      if (hero.tags.length > 0) {
        this.battleLogger.log(
          `${hero.name} 当前标签: ${hero.tags.map((t) => `${t.name}x${t.stacks}(${t.duration}回合)`).join(", ")}`,
          "info",
        );
      }
    });
  }

  /**
   * 修改标签持续时间
   * @param {Hero} hero - 目标角色
   * @param {string} tagName - 标签名称
   * @param {number} durationChange - 持续时间变化量（可以为负数）
   */
  modifyTagDuration(hero, tagName, durationChange) {
    const tag = hero.tags.find((t) => t.name === tagName);

    if (tag) {
      tag.duration = Math.max(0, tag.duration + durationChange); // 边界保护：最小为0
      this.battleLogger.log(
        `${hero.name} 的 ${tagName} 持续时间变更为 ${tag.duration} 回合`,
        "info",
      );
    }
  }

  /**
   * 加载标签映射配置
   * @returns {Promise<Object>} 标签映射配置对象
   */
  async loadTagMappingConfig() {
    if (this.tagMappingConfig) {
      return this.tagMappingConfig; // 返回缓存
    }

    try {
      const entries = await this.worldbookManager.fetchEntries("【配置】标签映射", {
        strategy: "merge",
        exactMatch: true,
      });

      if (!entries || entries.length === 0) {
        console.warn("[TagManager] 标签映射配置不存在，使用空配置");
        this.tagMappingConfig = {};
        return this.tagMappingConfig;
      }

      this.tagMappingConfig = JSON.parse(entries[0].content);
      console.log(
        "[TagManager] 标签映射配置已加载:",
        Object.keys(this.tagMappingConfig).length,
        "个关键词",
      );
      return this.tagMappingConfig;
    } catch (error) {
      console.error("[TagManager] 加载标签映射配置失败:", error);
      this.tagMappingConfig = {};
      return this.tagMappingConfig;
    }
  }

  /**
   * 加载标签伤害修正配置
   * @returns {Promise<Object>} 标签伤害修正配置对象
   */
  async loadTagDamageRelations() {
    if (this.tagDamageRelations) {
      return this.tagDamageRelations; // 返回缓存
    }

    try {
      const entries = await this.worldbookManager.fetchEntries("【配置】标签伤害修正", {
        strategy: "merge",
        exactMatch: true,
      });

      if (!entries || entries.length === 0) {
        console.warn("[TagManager] 标签伤害修正配置不存在，使用空配置");
        this.tagDamageRelations = {};
        return this.tagDamageRelations;
      }

      this.tagDamageRelations = JSON.parse(entries[0].content);
      console.log("[TagManager] 标签伤害修正配置已加载");
      return this.tagDamageRelations;
    } catch (error) {
      console.error("[TagManager] 加载标签伤害修正配置失败:", error);
      this.tagDamageRelations = {};
      return this.tagDamageRelations;
    }
  }

  /**
   * 加载标签治疗修正配置
   * @returns {Promise<Object>} 标签治疗修正配置对象
   */
  async loadTagHealingRelations() {
    if (this.tagHealingRelations) {
      return this.tagHealingRelations; // 返回缓存
    }

    try {
      const entries = await this.worldbookManager.fetchEntries("【配置】标签治疗修正", {
        strategy: "merge",
        exactMatch: true,
      });

      if (!entries || entries.length === 0) {
        console.warn("[TagManager] 标签治疗修正配置不存在，使用空配置");
        this.tagHealingRelations = {};
        return this.tagHealingRelations;
      }

      this.tagHealingRelations = JSON.parse(entries[0].content);
      console.log("[TagManager] 标签治疗修正配置已加载");
      return this.tagHealingRelations;
    } catch (error) {
      console.error("[TagManager] 加载标签治疗修正配置失败:", error);
      this.tagHealingRelations = {};
      return this.tagHealingRelations;
    }
  }

  /**
   * 初始化固有标签
   * @param {Array} heroes - 角色数组
   */
  async initializeInherentTags(heroes) {
    // 1. 预加载所有配置（确保后续同步调用可用）
    await this.loadTagMappingConfig();
    await this.loadTagDamageRelations();
    await this.loadTagHealingRelations();

    if (!this.tagMappingConfig || Object.keys(this.tagMappingConfig).length === 0) {
      console.warn("[TagManager] 标签映射配置为空，跳过固有标签初始化");
      return;
    }

    // 2. 为每个角色添加固有标签
    heroes.forEach((hero) => {
      hero.tags = hero.tags || [];
      const sequenceString = hero.sequenceString || "普通人";
      const matchedTags = [];

      // 遍历配置中的关键词
      for (const [keyword, config] of Object.entries(this.tagMappingConfig)) {
        if (sequenceString.includes(keyword)) {
          // 匹配成功，添加标签
          if (config.tags && Array.isArray(config.tags)) {
            config.tags.forEach((tagName) => {
              this.addTag(
                hero,
                tagName,
                config.duration || 99,
                1,
                config.maxStacks || 99,
                "inherent",
              );
              matchedTags.push(tagName);
            });
          }
        }
      }

      // 记录日志
      if (matchedTags.length > 0) {
        this.battleLogger.log(
          `${hero.name} (${sequenceString}) 固有标签: ${matchedTags.join(", ")}`,
          "info",
        );
      } else {
        this.battleLogger.log(`${hero.name} (${sequenceString}) 无匹配的固有标签`, "info");
      }
    });
  }

  /**
   * 计算标签伤害修正
   * @param {Hero} attacker - 攻击者
   * @param {Hero} defender - 防御者
   * @param {Move} skill - 使用的技能
   * @returns {number} 伤害修正值（0.5表示+50%，-0.3表示-30%）
   */
  calculateTagDamageModifier(attacker, defender, skill) {
    // 1. 检查配置（已在initializeInherentTags中预加载）
    if (!this.tagDamageRelations || Object.keys(this.tagDamageRelations).length === 0) {
      return 0; // 无配置，返回0修正
    }

    // 2. 获取标签
    const attackerTags = this.getTags(attacker, skill);
    const defenderTags = this.getTags(defender);

    // 3. 记录标签信息
    this.battleLogger.log(`${attacker.name} 使用技能: ${skill.name}`, "info");
    this.battleLogger.log(`攻击者标签: [${attackerTags.map((t) => t.name).join(", ")}]`, "info");
    this.battleLogger.log(`防御者标签: [${defenderTags.map((t) => t.name).join(", ")}]`, "info");

    // 4. 计算修正
    let totalModifier = 0;
    const matchedRelations = [];

    attackerTags.forEach((attackerTag) => {
      defenderTags.forEach((defenderTag) => {
        const modifier = this.tagDamageRelations[attackerTag.name]?.[defenderTag.name];

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

    // 5. 记录匹配结果
    if (matchedRelations.length > 0) {
      this.battleLogger.log("匹配克制关系:", "info");
      matchedRelations.forEach((rel) => {
        const sign = rel.modifier > 0 ? "+" : "";
        this.battleLogger.log(
          `  ${rel.attacker} → ${rel.defender}: ${sign}${(rel.modifier * 100).toFixed(0)}%`,
          "info",
        );
      });
      this.battleLogger.log(
        `总标签修正: ${totalModifier > 0 ? "+" : ""}${(totalModifier * 100).toFixed(0)}%`,
        "info",
      );
    } else {
      this.battleLogger.log("无匹配的克制关系", "info");
    }

    // 🌟 防爆封顶：最多 +150% / 最低 -75%（持续伤害每跳都用此公式）
    const clampedModifier = Math.max(-0.75, Math.min(1.5, totalModifier));
    if (clampedModifier !== totalModifier) {
      this.battleLogger.log(
        `[封顶] 总标签修正从 ${(totalModifier * 100).toFixed(0)}% 限制为 ${(clampedModifier * 100).toFixed(0)}%`,
        "info",
      );
    }
    return clampedModifier;
  }

  /**
   * 计算标签治疗修正
   * @param {Hero} healer - 治疗者
   * @param {Hero} target - 目标
   * @param {Move} skill - 使用的技能
   * @returns {number} 治疗修正值（0.5表示+50%，-0.3表示-30%）
   */
  calculateTagHealingModifier(healer, target, skill) {
    // 1. 检查配置（已在initializeInherentTags中预加载）
    if (!this.tagHealingRelations || Object.keys(this.tagHealingRelations).length === 0) {
      return 0; // 无配置，返回0修正
    }

    // 2. 获取标签
    const healerTags = this.getTags(healer, skill);
    const targetTags = this.getTags(target);

    // 3. 记录标签信息
    this.battleLogger.log(`${healer.name} 使用技能: ${skill.name}`, "info");
    this.battleLogger.log(`治疗者标签: [${healerTags.map((t) => t.name).join(", ")}]`, "info");
    this.battleLogger.log(`目标标签: [${targetTags.map((t) => t.name).join(", ")}]`, "info");

    // 4. 计算修正
    let totalModifier = 0;
    const matchedRelations = [];

    healerTags.forEach((healerTag) => {
      targetTags.forEach((targetTag) => {
        const modifier = this.tagHealingRelations[healerTag.name]?.[targetTag.name];

        if (modifier !== undefined) {
          totalModifier += modifier;
          matchedRelations.push({
            healer: healerTag.name,
            target: targetTag.name,
            modifier: modifier,
          });
        }
      });
    });

    // 5. 记录匹配结果
    if (matchedRelations.length > 0) {
      this.battleLogger.log("匹配治疗关系:", "info");
      matchedRelations.forEach((rel) => {
        const sign = rel.modifier > 0 ? "+" : "";
        this.battleLogger.log(
          `  ${rel.healer} → ${rel.target}: ${sign}${(rel.modifier * 100).toFixed(0)}%`,
          "info",
        );
      });
      this.battleLogger.log(
        `总标签修正: ${totalModifier > 0 ? "+" : ""}${(totalModifier * 100).toFixed(0)}%`,
        "info",
      );
    } else {
      this.battleLogger.log("无匹配的治疗关系", "info");
    }

    // 🌟 防爆封顶：最多 +150% / 最低 -75%（持续治疗每跳都用此公式）
    const clampedModifier = Math.max(-0.75, Math.min(1.5, totalModifier));
    if (clampedModifier !== totalModifier) {
      this.battleLogger.log(
        `[封顶] 总治疗修正从 ${(totalModifier * 100).toFixed(0)}% 限制为 ${(clampedModifier * 100).toFixed(0)}%`,
        "info",
      );
    }
    return clampedModifier;
  }
}
