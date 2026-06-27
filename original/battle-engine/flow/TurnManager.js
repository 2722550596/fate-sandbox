// TurnManager.js - 来源: original.js

// === class TurnManager (行 4733-5563) ===

class TurnManager {
  /**
   * 构造函数
   * @param {TeamManager} teamManager - 队伍管理器实例
   * @param {BattleManager} battleManager - 战斗管理器实例
   */
  constructor(teamManager, battleManager) {
    this.teamManager = teamManager;
    this.battleManager = battleManager;
    this.turnQueue = [];
    this.currentTurnIndex = 0;
    this.roundEffects = [];

    console.log("[TurnManager] 回合管理器已初始化");
  }

  /**
   * 初始化回合
   */
  initializeRound() {
    this.turnQueue = this.buildTurnQueue();
    this.currentTurnIndex = 0;

    console.log(
      `[TurnManager] 回合初始化完成，行动队列: ${this.turnQueue.map((h) => h.name).join(", ")}`,
    );
  }

  /**
   * 构建行动队列（按速度排序，应用buff/debuff修正）
   * @returns {Array} 排序后的Hero数组
   */
  buildTurnQueue() {
    const allHeroes = this.teamManager.getAllAliveHeroes();

    // 为每个角色计算最终速度（应用buff/debuff + 随机系数）
    const heroesWithSpeed = allHeroes.map((hero) => {
      // 使用AttributeCalculator计算应用buff/debuff后的速度
      const baseSpeed = hero.additionalStats.当前敏捷 ?? hero.speed ?? 0;
      const speedAfterBuffs = AttributeCalculator.applyBuffDebuff(hero, "speed", baseSpeed);

      // 应用随机系数（0.9 ~ 1.1）
      const randomFactor = 0.9 + Math.random() * 0.2;
      const finalSpeed = speedAfterBuffs * randomFactor;

      return {
        hero: hero,
        finalSpeed: finalSpeed,
      };
    });

    // 按最终速度排序
    const sortedHeroes = heroesWithSpeed.sort((a, b) => {
      // 先按速度排序
      if (b.finalSpeed !== a.finalSpeed) {
        return b.finalSpeed - a.finalSpeed;
      }
      // 速度相同则随机
      return Math.random() - 0.5;
    });

    // 返回排序后的Hero对象数组
    return sortedHeroes.map((item) => item.hero);
  }

  /**
   * 执行下一个行动
   * @returns {Object|null} 回合结果对象
   */
  executeNextTurn() {
    if (this.isRoundComplete()) {
      return null;
    }

    const currentHero = this.turnQueue[this.currentTurnIndex];
    this.currentTurnIndex++;

    // 检查角色是否存活
    if (currentHero.additionalStats.当前活力 <= 0) {
      return {
        type: "skip",
        hero: currentHero,
        message: `${currentHero.name} 已无法战斗，跳过行动`,
      };
    }

    // 返回当前行动的角色，由UI层负责处理效果
    return {
      type: "turn_start",
      hero: currentHero,
      message: `轮到 ${currentHero.name} 行动`,
    };
  }

  /**
   * 跳过当前回合（用于AI无法行动时）
   */
  skipCurrentTurn() {
    console.log(`[TurnManager] 跳过当前回合`);
    this.currentTurnIndex++;
  }

  /**
   * 🔥 新增：处理角色的持续效果（在行动前）
   * @param {Object} hero - 角色对象
   * @returns {Array} 效果处理结果数组
   */
  processCharacterEffects(hero, timing = "turn_start") {
    const results = [];

    // 过滤出活跃的效果（duration > 0）并且匹配触发时机
    const activeEffects = hero.effects.filter((e) => {
      if (e.duration <= 0) return false;

      // 如果效果没有指定triggerTiming，默认为turn_start
      const effectTiming = e.triggerTiming || "turn_start";
      return effectTiming === timing;
    });

    // 🔥 修复：移除提前返回，确保后续的状态效果检查能够执行
    // if (activeEffects.length === 0) {
    //     return results;
    // }

    // 只有当有活跃效果时才处理
    if (activeEffects.length > 0) {
      // 按优先级排序（数值越小优先级越高）
      activeEffects.sort((a, b) => {
        const priorityA = a.priority ?? 0;
        const priorityB = b.priority ?? 0;
        return priorityA - priorityB;
      });

      // 处理每个效果
      for (const effect of activeEffects) {
        try {
          // 🔥 修复：调用 EffectManager 的 processEffect 方法
          const result = this.battleManager.effectManager.processEffect(hero, effect);

          if (result) {
            results.push({
              hero: hero.name,
              effect: effect.name,
              result: result,
            });

            // 记录到战斗日志
            if (this.battleManager && this.battleManager.battleLogger) {
              this.battleManager.battleLogger.log(
                `${hero.name} 受到 ${effect.name} 效果: ${result.message || ""}`,
                "effect",
              );
            }

            // 🔥 新增：记录到战报
            if (this.battleManager && this.battleManager.battleReporter) {
              this.battleManager.battleReporter.logEffectTrigger(
                hero,
                effect.name || "未知效果",
                result.message || "",
              );
            }
          }

          // 减少持续时间
          effect.duration--;
        } catch (e) {
          console.error(`[TurnManager] 处理效果 ${effect.name} 时出错:`, e);
        }
      }

      // 移除过期的效果（duration <= 0）之前，先检查是否需要重算六维属性
      const sixDimStats = ["活力", "敏捷", "灵性", "理智", "人性", "运气"];
      const hadSixDimEffects = hero.effects.some(
        (e) =>
          e.duration <= 0 &&
          (e.type === "buff" || e.type === "debuff") &&
          sixDimStats.includes(e.stat),
      );

      hero.effects = hero.effects.filter((e) => e.duration > 0);

      // 如果有六维属性的效果过期，触发重算
      if (hadSixDimEffects && typeof AttributeCalculator !== "undefined") {
        console.log(`[TurnManager] 检测到六维属性效果过期，触发重算: ${hero.name}`);
        AttributeCalculator.recalculateAllSixDimStats(hero);
      }
    }

    // 🆕 在回合开始时检查并应用状态效果（基于属性百分比）
    if (timing === "turn_start" && this.battleManager && this.battleManager.statusEffectManager) {
      const appliedEffects = this.battleManager.statusEffectManager.checkAndApplyEffects(hero);

      // 在战斗日志中记录应用的状态效果
      if (appliedEffects.length > 0 && this.battleManager.battleLogger) {
        appliedEffects.forEach((effect) => {
          this.battleManager.battleLogger.log(
            `${hero.name} 受到状态效果: ${effect.name}`,
            "effect",
          );
        });
      }

      // 🔥 新增：将状态效果添加到返回值，以便触发UI刷新
      if (appliedEffects.length > 0) {
        appliedEffects.forEach((effect) => {
          results.push({
            hero: hero.name,
            effect: effect.name,
            result: { message: `受到状态效果: ${effect.name}` },
          });
        });
      }
    }

    return results;
  }

  /**
   * 🔥 新增：处理环境效果（战场级别的持续效果）
   * @param {Object} hero - 当前行动的角色
   * @returns {Array} 环境效果处理结果数组
   */
  processEnvironmentEffects(hero, timing = "turn_start") {
    const results = [];

    // 检查是否有环境效果系统
    if (!this.battleManager || !this.battleManager.environmentEffects) {
      return results;
    }

    const envEffects = this.battleManager.environmentEffects;

    // 过滤出活跃的环境效果并且匹配触发时机
    const activeEnvEffects = envEffects.filter((e) => {
      if (e.duration <= 0) return false;

      const effectTiming = e.triggerTiming || "turn_start";
      return effectTiming === timing;
    });

    if (activeEnvEffects.length === 0) {
      return results;
    }

    // 按优先级排序
    activeEnvEffects.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityA - priorityB;
    });

    // 处理每个环境效果
    for (const effect of activeEnvEffects) {
      try {
        // 检查效果是否影响当前角色
        const affectsHero = this.checkEnvironmentEffectApplies(effect, hero);

        if (affectsHero) {
          // 🔥 修复：调用 EffectManager 的 processEffect 方法
          const result = this.battleManager.effectManager.processEffect(hero, effect);

          if (result) {
            results.push({
              hero: hero.name,
              environmentEffect: effect.name,
              result: result,
            });

            // 记录到战斗日志
            if (this.battleManager && this.battleManager.battleLogger) {
              this.battleManager.battleLogger.log(
                `${hero.name} 受到环境效果 ${effect.name}: ${result.message || ""}`,
                "effect",
              );
            }

            // 🔥 新增：记录到战报
            if (this.battleManager && this.battleManager.battleReporter) {
              this.battleManager.battleReporter.logEffectTrigger(
                hero,
                effect.name || "未知效果",
                result.message || "",
              );
            }
          }
        }
      } catch (e) {
        console.error(`[TurnManager] 处理环境效果 ${effect.name} 时出错:`, e);
      }
    }

    return results;
  }

  /**
   * 🔥 新增：检查环境效果是否影响指定角色
   * @param {Object} effect - 环境效果对象
   * @param {Object} hero - 角色对象
   * @returns {boolean} 是否影响该角色
   */
  checkEnvironmentEffectApplies(effect, hero) {
    // 默认影响所有存活角色
    if (!effect.targetFilter) {
      return hero.additionalStats.当前活力 > 0;
    }

    // 如果有目标过滤器，使用过滤器判断
    if (typeof effect.targetFilter === "function") {
      return effect.targetFilter(hero);
    }

    return true;
  }

  /**
   * 执行攻击行动（支持多目标）
   * @param {Object} attacker - 攻击者Hero对象
   * @param {Object|Array} targets - 目标Hero对象或目标数组
   * @param {Object} skill - Move对象
   * @returns {Object} 攻击结果
   */
  executeAttack(attacker, targets, skill) {
    try {
      // 统一处理为数组
      const targetArray = Array.isArray(targets) ? targets : [targets];

      // 检查技能消耗
      const canUse = skill.canUse(attacker);
      if (!canUse.canAfford) {
        return {
          type: "error",
          message: canUse.message,
        };
      }

      // 扣除消耗（只扣除一次）
      const costResult = skill.executeCost(attacker);

      // 🆕 清空随机数缓存（每次技能执行前）
      if (this.battleManager && this.battleManager.parameterSelector) {
        this.battleManager.parameterSelector.clearCache();
      }

      // 对每个目标独立计算伤害或治疗
      const targetResults = [];
      let totalDamage = 0;
      let totalHealing = 0;

      for (const defender of targetArray) {
        // 🆕 为每个目标选择参数集（条件逻辑核心）
        let effectiveSkill = skill;
        if (
          this.battleManager &&
          this.battleManager.parameterSelector &&
          skill.conditionalParams &&
          skill.conditionalParams.length > 0
        ) {
          const selectedParams = this.battleManager.parameterSelector.selectParameters(
            skill,
            attacker,
            defender,
          );
          // 创建临时技能对象，使用选定的参数
          effectiveSkill = new Move(selectedParams);
        }

        // 🔥 修正：在参数选择后判断是否为治疗技能
        const isHealSkill = effectiveSkill.isHeal || effectiveSkill.getIsHeal?.();
        // 🆕 施加标签（在伤害/治疗计算之前）
        if (
          effectiveSkill.applyTags &&
          effectiveSkill.applyTags.length > 0 &&
          this.battleManager &&
          this.battleManager.tagManager
        ) {
          console.log(
            `[TurnManager] ${attacker.name} 使用 ${effectiveSkill.name}，准备施加标签:`,
            effectiveSkill.applyTags,
          );
          effectiveSkill.applyTags.forEach((tagConfig) => {
            // 🔥 兼容中英文字段名
            const tagName = tagConfig.name || tagConfig.名称;
            if (tagName) {
              // 检查是添加新标签还是修改现有标签
              if (tagConfig.duration !== undefined || tagConfig.stacks !== undefined) {
                // 添加新标签
                console.log(`[TurnManager] 对 ${defender.name} 添加标签: ${tagName}`);
                this.battleManager.tagManager.addTag(
                  defender,
                  tagName,
                  tagConfig.duration || 1,
                  tagConfig.stacks || 1,
                  tagConfig.maxStacks || 99,
                  "applied",
                );
              } else if (tagConfig.durationChange !== undefined) {
                // 修改持续时间
                this.battleManager.tagManager.modifyTagDuration(
                  defender,
                  tagName,
                  tagConfig.durationChange,
                );
              } else if (tagConfig.stacksChange !== undefined) {
                // 修改层数
                if (tagConfig.stacksChange < 0) {
                  this.battleManager.tagManager.removeTagStacks(
                    defender,
                    tagName,
                    Math.abs(tagConfig.stacksChange),
                  );
                } else {
                  // 增加层数（通过addTag实现）
                  this.battleManager.tagManager.addTag(
                    defender,
                    tagName,
                    0, // 不修改持续时间
                    tagConfig.stacksChange,
                    99,
                    "applied",
                  );
                }
              }
            }
          });
        }

        // 🆕 移除标签（在施加标签之后）
        if (
          effectiveSkill.removeTags &&
          effectiveSkill.removeTags.length > 0 &&
          this.battleManager &&
          this.battleManager.tagManager
        ) {
          effectiveSkill.removeTags.forEach((tagName) => {
            if (tagName === "*") {
              // 特殊值：移除所有标签
              if (defender.tags) {
                const tagNames = defender.tags.map((t) => t.name);
                tagNames.forEach((name) => {
                  this.battleManager.tagManager.removeTag(defender, name);
                });
              }
            } else {
              // 移除指定标签
              this.battleManager.tagManager.removeTag(defender, tagName);
            }
          });
        }

        if (isHealSkill) {
          // 🔥 治疗分支
          const healingResult = effectiveSkill.calculateHealing(attacker, defender);
          const applyResult = this.applyHealing(
            defender,
            healingResult.amount,
            healingResult.attribute,
          );

          totalHealing += applyResult.actualHealing;

          targetResults.push({
            defender: defender,
            healingResult: healingResult,
            applyResult: applyResult,
            isHealing: true,
          });
        } else {
          // 原有伤害分支
          const damageResult = DamageCalculator.calculate(attacker, defender, effectiveSkill);
          const applyResult = DamageCalculator.applyDamage(defender, damageResult);

          totalDamage += applyResult.actualDamage;

          targetResults.push({
            defender: defender,
            damageResult: damageResult,
            applyResult: applyResult,
            isDead: defender.additionalStats.当前活力 <= 0,
          });
        }

        // 🔥 修改：应用技能效果到目标（支持effectTarget独立目标选择）
        if (
          effectiveSkill.effects &&
          effectiveSkill.effects.length > 0 &&
          this.battleManager &&
          this.battleManager.effectManager
        ) {
          effectiveSkill.effects.forEach((effect) => {
            // ⭐ 新增：根据effect.effectTarget选择目标
            const effectTargets = this.selectEffectTargets(effect, attacker, defender);

            // ⭐ 对每个选定的目标应用effect
            effectTargets.forEach((effectTarget) => {
              const effectResult = this.battleManager.effectManager.applyEffect(
                effectTarget,
                effect,
                attacker,
                skill,
              );

              // 记录效果应用结果
              if (effectResult.replaced) {
                console.log(`[TurnManager] ${effectTarget.name} 的 ${effect.name} 被更强效果替换`);
                // 🆕 记录到战报：效果被替换
                if (this.battleManager.battleReporter) {
                  this.battleManager.battleReporter._recordEffectApplied(
                    attacker,
                    effectTarget,
                    effect.name,
                  );
                }
              } else if (effectResult.refreshed) {
                console.log(`[TurnManager] ${effectTarget.name} 的 ${effect.name} 持续时间刷新`);
                // 🆕 记录到战报：效果刷新（也算施加）
                if (this.battleManager.battleReporter) {
                  this.battleManager.battleReporter._recordEffectApplied(
                    attacker,
                    effectTarget,
                    effect.name,
                  );
                }
              } else if (effectResult.rejected) {
                console.log(
                  `[TurnManager] ${effectTarget.name} 已有更强的 ${effect.name}，拒绝新效果`,
                );
                // 拒绝的效果不记录到战报
              } else if (effectResult.applied) {
                console.log(`[TurnManager] ${effectTarget.name} 获得效果: ${effect.name}`);
                // 🆕 记录到战报：效果成功施加
                if (this.battleManager.battleReporter) {
                  this.battleManager.battleReporter._recordEffectApplied(
                    attacker,
                    effectTarget,
                    effect.name,
                  );
                }
              }
            });
          });
        }
      }

      // 生成消息
      let message = `${attacker.name} 使用 ${skill.name}`;

      if (costResult.success && costResult.oldValue !== costResult.newValue) {
        const costAmount = costResult.oldValue - costResult.newValue;
        const costName = SkillCostManager.getAttributeDisplayName(skill.cost.type);
        message += `（消耗${costAmount}点${costName}）`;
      }

      // 多目标消息
      if (targetArray.length > 1) {
        // 🔥 基于实际结果判断是否为治疗（检查所有结果）
        const healingCount = targetResults.filter((r) => r.isHealing).length;
        const damageCount = targetResults.filter((r) => !r.isHealing).length;

        if (healingCount > 0 && damageCount > 0) {
          // 混合：既有治疗又有伤害
          message += ` 对 ${targetArray.length} 个目标生效（${healingCount}个治疗，${damageCount}个伤害）`;
        } else if (healingCount > 0) {
          // 纯治疗
          message += ` 治疗了 ${targetArray.length} 个目标`;
        } else {
          // 纯伤害
          message += ` 攻击了 ${targetArray.length} 个目标`;
        }
        targetResults.forEach((result) => {
          if (result.isHealing) {
            message += `\n  → ${result.defender.name}: 恢复 ${result.applyResult.actualHealing} 点${result.healingResult.attribute}`;
            message += `（${result.healingResult.attribute}: ${result.applyResult.oldValue} → ${result.applyResult.newValue}）`;
          } else {
            message += `\n  → ${result.defender.name}: ${result.applyResult.actualDamage} 点伤害`;
            message += `（${result.damageResult.targetAttribute}: ${result.applyResult.oldValue} → ${result.applyResult.newValue}）`;
            if (result.isDead) {
              message += ` - 被击败！`;
            }
          }
        });
      } else {
        // 单目标消息
        const result = targetResults[0];
        if (result.isHealing) {
          message += ` 治疗 ${result.defender.name}，恢复 ${result.applyResult.actualHealing} 点${result.healingResult.attribute}`;
          message += `（${result.defender.name} ${result.healingResult.attribute}: ${result.applyResult.oldValue} → ${result.applyResult.newValue}）`;
        } else {
          message += ` 攻击 ${result.defender.name}，造成 ${result.applyResult.actualDamage} 点伤害`;
          message += `（${result.defender.name} ${result.damageResult.targetAttribute}: ${result.applyResult.oldValue} → ${result.applyResult.newValue}）`;
          if (result.isDead) {
            message += ` - ${result.defender.name} 被击败！`;
          }
        }
      }

      // 记录战报
      if (this.battleManager && this.battleManager.battleReporter) {
        // 使用新的增强版战报方法
        targetResults.forEach((result) => {
          if (result.isHealing) {
            // 🔥 治疗分支：使用 recordHeal 方法
            const healingAttribute = result.healingResult.attribute || "当前活力";
            const maxAttributeName = healingAttribute.replace("当前", "");
            const attributeChanges = {
              [healingAttribute]: {
                oldValue: result.applyResult.oldValue,
                newValue: result.applyResult.newValue,
                maxValue:
                  result.defender.additionalStats[maxAttributeName] ||
                  result.healingResult.maxValue ||
                  100,
              },
            };

            this.battleManager.battleReporter.recordHeal(
              attacker,
              result.defender,
              skill,
              result.applyResult.actualHealing,
              attributeChanges,
            );

            // 记录属性变化（治疗）
            this.battleManager.battleReporter.logAttributeChange(
              result.defender,
              healingAttribute,
              result.applyResult.oldValue,
              result.applyResult.newValue,
              `受到 ${attacker.name} 的 ${skill.name} 治疗`,
            );
          } else {
            // 🔥 伤害分支：使用 recordAttack 方法
            const damageAttribute = result.damageResult.targetAttribute || "当前活力";
            const maxAttributeName = damageAttribute.replace("当前", "");
            const attributeChanges = {
              [damageAttribute]: {
                oldValue: result.applyResult.oldValue,
                newValue: result.applyResult.newValue,
                maxValue:
                  result.defender.additionalStats[maxAttributeName] ||
                  result.damageResult.maxValue ||
                  100,
              },
            };

            this.battleManager.battleReporter.recordAttack(
              attacker,
              result.defender,
              skill,
              result.damageResult,
              attributeChanges,
              null, // matchedRelations 暂时为 null，克制功能稍后实现
            );

            // 记录详细日志
            this.battleManager.battleReporter.logDetailedDamageCalculation(
              attacker,
              result.defender,
              skill,
              result.damageResult,
            );

            // 记录属性变化（伤害）
            this.battleManager.battleReporter.logAttributeChange(
              result.defender,
              damageAttribute,
              result.applyResult.oldValue,
              result.applyResult.newValue,
              `受到 ${attacker.name} 的 ${skill.name} 攻击`,
            );
          }
        });

        // 记录技能消耗
        if (costResult.success && costResult.oldValue !== costResult.newValue) {
          this.battleManager.battleReporter.logCostDeduction(attacker, skill, costResult);
        }
      }

      // 记录到战斗日志
      if (this.battleManager && this.battleManager.battleLogger) {
        this.battleManager.battleLogger.log(message, "attack");
      }

      // 战斗过程中不同步属性到前端，所有数据保持在战斗系统内部
      // 战后属性将通过战报的"战后属性一览"输出，由外部系统负责更新变量

      return {
        type: "attack",
        attacker: attacker,
        targets: targetArray,
        skill: skill,
        targetResults: targetResults,
        totalDamage: totalDamage,
        costResult: costResult,
        message: message,
      };
    } catch (error) {
      console.error("[TurnManager] 执行攻击时发生错误:", error);
      return {
        type: "error",
        message: `攻击执行失败: ${error.message}`,
      };
    }
  }

  /**
   * 🔥 新增：应用治疗
   * @param {Object} target - 目标角色
   * @param {number} healingAmount - 治疗量
   * @param {string} healAttribute - 治疗的属性名称
   * @returns {Object} 治疗结果
   */
  applyHealing(target, healingAmount, healAttribute) {
    if (!target || !target.additionalStats) {
      return { success: false, message: "无效的目标" };
    }

    const oldValue = target.additionalStats[healAttribute] || 0;
    const newValue = oldValue + healingAmount;

    // 应用治疗
    target.additionalStats[healAttribute] = newValue;

    // 同步到标准属性（如果是活力）
    if (healAttribute === "当前活力") {
      target.health = newValue;
      target.currentHealth = newValue;
    }

    return {
      success: true,
      attribute: healAttribute,
      oldValue: oldValue,
      newValue: newValue,
      actualHealing: healingAmount,
    };
  }

  /**
   * 检查回合是否完成
   * @returns {boolean} 是否完成
   */
  isRoundComplete() {
    return this.currentTurnIndex >= this.turnQueue.length;
  }

  /**
   * 处理回合结束效果
   * 🔥 修改：效果已在回合开始前处理，这里只做清理和回合总结
   */
  processRoundEndEffects() {
    const allHeroes = this.teamManager.getAllHeroes();

    // 🔥 新增：处理回合结束时触发的效果
    allHeroes.forEach((hero) => {
      if (hero.effects && hero.effects.length > 0) {
        const roundEndEffects = hero.effects.filter((e) => e.triggerTiming === "round_end");

        if (roundEndEffects.length > 0) {
          this.processCharacterEffects(hero, "round_end");
          this.processEnvironmentEffects(hero, "round_end");
        }
      }
    });

    // 手动递减持续时间并清理过期效果
    allHeroes.forEach((hero) => {
      if (hero.effects && hero.effects.length > 0) {
        const beforeCount = hero.effects.length;

        // 检查是否有六维属性的效果即将过期
        const sixDimStats = ["活力", "敏捷", "灵性", "理智", "人性", "运气"];
        const hadSixDimEffects = hero.effects.some(
          (e) =>
            e.duration <= 0 &&
            (e.type === "buff" || e.type === "debuff") &&
            sixDimStats.includes(e.stat),
        );

        // 移除过期效果
        hero.effects = hero.effects.filter((e) => e.duration > 0);

        const afterCount = hero.effects.length;

        if (beforeCount !== afterCount) {
          console.log(`[TurnManager] ${hero.name} 清理了 ${beforeCount - afterCount} 个过期效果`);
        }

        // 如果有六维属性的效果过期，触发重算
        if (hadSixDimEffects && typeof AttributeCalculator !== "undefined") {
          console.log(`[TurnManager] 检测到六维属性效果过期，触发重算: ${hero.name}`);
          AttributeCalculator.recalculateAllSixDimStats(hero);
        }
      }
    });

    // 🆕 递减标签持续时间并清理过期标签
    if (this.battleManager && this.battleManager.tagManager) {
      this.battleManager.tagManager.decrementTagDurations(allHeroes);
    }

    console.log("[TurnManager] 回合结束效果处理完成");
  }

  /**
   * 获取当前行动信息
   * @returns {Object|null} 当前行动信息
   */
  getCurrentTurn() {
    if (this.currentTurnIndex >= this.turnQueue.length) {
      return null;
    }

    return {
      index: this.currentTurnIndex,
      total: this.turnQueue.length,
      hero: this.turnQueue[this.currentTurnIndex],
    };
  }

  /**
   * 获取行动队列
   * @returns {Array} 行动队列
   */
  getTurnQueue() {
    return this.turnQueue;
  }

  /**
   * 根据effect的effectTarget选择目标
   * @param {Object} effect - 效果对象
   * @param {Hero} attacker - 施法者
   * @param {Hero} skillTarget - 技能目标（当前循环的defender）
   * @returns {Array<Hero>} 目标数组
   */
  selectEffectTargets(effect, attacker, skillTarget) {
    // 获取effectTarget，默认为'target'
    const effectTarget = effect.effectTarget || "target";

    // 验证effectTarget值
    const validTargets = ["target", "self", "all", "allAlly"];
    if (!validTargets.includes(effectTarget)) {
      console.warn(`[TurnManager] 无效的effectTarget值: ${effectTarget}，使用默认值'target'`);
      return [skillTarget];
    }

    // 根据effectTarget选择目标
    switch (effectTarget) {
      case "target":
        // 技能目标（当前循环的defender）
        return [skillTarget];

      case "self":
        // 施法者自己
        return [attacker];

      case "all":
        // 所有敌人（使用getOpponentTeam）
        if (this.battleManager && this.battleManager.teamManager) {
          return this.battleManager.teamManager.getOpponentTeam(attacker);
        }
        return [];

      case "allAlly":
        // 所有友方（根据attacker的队伍返回友方）
        if (this.battleManager && this.battleManager.teamManager) {
          const attackerTeam = this.battleManager.teamManager.getHeroTeam(attacker);
          if (attackerTeam === "ally") {
            return this.battleManager.teamManager.getAliveAllies();
          } else if (attackerTeam === "enemy") {
            return this.battleManager.teamManager.getAliveEnemies();
          }
        }
        return [];

      default:
        // 默认返回技能目标
        console.warn(`[TurnManager] 未处理的effectTarget: ${effectTarget}，使用技能目标`);
        return [skillTarget];
    }
  }
}
