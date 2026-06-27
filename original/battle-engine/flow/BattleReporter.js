// BattleReporter.js - 来源: original.js

// === class BattleReporter (行 2110-2984) ===

class BattleReporter {
  /**
   * 构造函数
   */
  constructor() {
    this.simpleBattleLog = [];
    this.detailedLog = [];
    this.participatingCharacters = new Set();
    this.currentRound = 1;
    this.roundActions = []; // 记录每回合的行动

    console.log("[BattleReporter] 战斗报告生成器已初始化");
  }

  /**
   * 记录简化战报
   * @param {string} message - 简化消息
   */
  logSimple(message) {
    this.simpleBattleLog.push(message);
  }

  /**
   * 记录效果触发
   * @param {Object} hero - 角色Hero对象
   * @param {string} effectName - 效果名称
   * @param {string} description - 效果描述
   */
  logEffectTrigger(hero, effectName, description) {
    this.participatingCharacters.add(hero.name);

    const message = `${hero.name}触发${effectName}：${description}`;
    this.logSimple(message);
  }

  /**
   * 生成战后属性一览
   * @param {Array} allHeroes - 所有参战角色数组
   * @returns {string} 战后属性一览文本
   */
  generatePostBattleAttributes(allHeroes) {
    let report = "\n【战后属性一览】\n";

    allHeroes.forEach((hero) => {
      const status = hero.getStatusSummary();

      // 计算百分比
      const vitalityPercent = (status.currentVitality / status.maxVitality) * 100;
      const agilityPercent = (status.currentAgility / status.maxAgility) * 100;
      const spiritPercent = (status.currentSpirit / status.maxSpirit) * 100;
      const sanityPercent = (status.currentSanity / status.maxSanity) * 100;
      const humanityPercent = (status.currentHumanity / status.maxHumanity) * 100;

      // 获取状态标签
      const vitalityLabel = this.getAttributeLabel("vitality", vitalityPercent);
      const agilityLabel = this.getAttributeLabel("agility", agilityPercent);
      const spiritLabel = this.getAttributeLabel("spirit", spiritPercent);
      const sanityLabel = this.getAttributeLabel("sanity", sanityPercent);
      const humanityLabel = this.getAttributeLabel("humanity", humanityPercent);

      report += `\n${hero.name}（${status.sequenceString}）：\n`;
      report += `  活力：${status.currentVitality}/${status.maxVitality}（${vitalityPercent.toFixed(0)}%）${vitalityLabel}\n`;
      report += `  敏捷：${status.currentAgility}/${status.maxAgility}（${agilityPercent.toFixed(0)}%）${agilityLabel}\n`;
      report += `  灵性：${status.currentSpirit}/${status.maxSpirit}（${spiritPercent.toFixed(0)}%）${spiritLabel}\n`;
      report += `  理智：${status.currentSanity}/${status.maxSanity}（${sanityPercent.toFixed(0)}%）${sanityLabel}\n`;
      report += `  人性：${status.currentHumanity}/${status.maxHumanity}（${humanityPercent.toFixed(0)}%）${humanityLabel}\n`;
    });

    return report;
  }

  /**
   * 获取属性状态标签
   * @param {string} attributeType - 属性类型
   * @param {number} percent - 百分比（0-100）
   * @returns {string} 状态标签
   */
  getAttributeLabel(attributeType, percent) {
    if (percent >= 80) {
      return ""; // 80-100% 不返回标签
    }

    const labels = {
      vitality: ["死亡", "重伤", "中等受伤", "轻伤"],
      agility: ["完全瘫痪", "几乎无法移动", "行动迟缓", "行动略微受阻"],
      spirit: ["灵性耗尽", "灵性干涸", "灵性余量紧张", "灵性微耗"],
      sanity: ["彻底失去理智", "理智濒临崩溃", "理智动摇", "理智受冲击"],
      humanity: ["彻底失去人性", "人性泯灭", "人性扭曲", "人性动摇"],
    };

    const attributeLabels = labels[attributeType] || [];

    if (percent === 0) {
      return ` - ${attributeLabels[0] || "极度危险"}`;
    } else if (percent < 30) {
      return ` - ${attributeLabels[1] || "严重"}`;
    } else if (percent < 50) {
      return ` - ${attributeLabels[2] || "中度"}`;
    } else if (percent < 80) {
      return ` - ${attributeLabels[3] || "轻度"}`;
    }

    return "";
  }

  /**
   * 计算效果评价等级
   * @param {number} changeAmount - 属性变化量（绝对值）
   * @param {number} maxValue - 属性最大值
   * @returns {string} 效果评价文本
   * @private
   */
  _calculateEffectEvaluation(changeAmount, maxValue) {
    // 边界检查
    if (maxValue === 0 || changeAmount === 0) {
      return "几乎无效果";
    }

    // 计算百分比
    const percentage = (Math.abs(changeAmount) / maxValue) * 100;

    // 分级判断
    if (percentage <= 1) {
      return "几乎无效果";
    } else if (percentage <= 10) {
      return "效果微弱";
    } else if (percentage <= 20) {
      return "效果一般";
    } else if (percentage <= 30) {
      return "效果良好";
    } else {
      return "效果显著";
    }
  }

  /**
   * 获取标签所有者名称
   * @param {Object} tag - 标签对象（包含 name 和 source 字段）
   * @param {string} skillName - 技能名称
   * @param {string} characterName - 角色名称
   * @returns {string} 标签所有者名称
   * @private
   */
  _getTagOwnerName(tag, skillName, characterName) {
    if (tag.source === "skill") {
      return skillName;
    } else {
      // source === 'inherent' 或 'applied'
      return characterName;
    }
  }

  /**
   * 获取状态等级
   * @param {number} percent - 百分比（0-100）
   * @returns {number} 状态等级（0-4）
   * @private
   */
  _getStateLevel(percent) {
    if (percent === 0) return 0; // CRITICAL
    if (percent < 30) return 1; // SEVERE
    if (percent < 50) return 2; // MODERATE
    if (percent < 80) return 3; // MILD
    return 4; // NORMAL
  }

  /**
   * 获取属性类型（用于 getAttributeLabel）
   * @param {string} attributeName - 属性名称（如 '当前活力'）
   * @returns {string} 属性类型（如 'vitality'）
   * @private
   */
  _getAttributeType(attributeName) {
    const typeMap = {
      当前活力: "vitality",
      当前敏捷: "agility",
      当前灵性: "spirit",
      当前理智: "sanity",
      当前人性: "humanity",
    };
    return typeMap[attributeName] || "vitality";
  }

  /**
   * 从 getAttributeLabel 返回值中提取纯状态标签
   * @param {string} labelText - getAttributeLabel 返回的文本（如 ' - 重伤' 或 ''）
   * @returns {string} 纯状态标签（如 '重伤' 或 ''）
   * @private
   */
  _extractStateLabel(labelText) {
    if (!labelText) return "";
    return labelText.replace(/^\s*-\s*/, "").trim();
  }

  /**
   * 生成标签克制/抵抗标记
   * @param {Hero} attacker - 攻击者对象
   * @param {Hero} defender - 防御者对象
   * @param {Move} skill - 技能对象
   * @param {Array} matchedRelations - 匹配的克制关系数组
   * @returns {string} 克制/抵抗标记文本（如果没有则返回空字符串）
   * @private
   */
  _generateTagRestraintMarker(attacker, defender, skill, matchedRelations) {
    // 边界检查
    if (!matchedRelations || matchedRelations.length === 0) {
      return "";
    }

    // 分离克制和抵抗关系
    const restraints = []; // 克制关系（modifier > 0）
    const resistances = []; // 抵抗关系（modifier < 0）

    matchedRelations.forEach((relation) => {
      if (relation.modifier > 0) {
        // 克制关系
        const attackerOwner = this._getTagOwnerName(
          relation.attackerTag,
          skill.name,
          attacker.name,
        );
        const defenderOwner = this._getTagOwnerName(
          relation.defenderTag,
          skill.name,
          defender.name,
        );

        restraints.push(
          `${attackerOwner}的【${relation.attackerTag.name}】克制${defenderOwner}的【${relation.defenderTag.name}】`,
        );
      } else if (relation.modifier < 0) {
        // 抵抗关系
        const attackerOwner = this._getTagOwnerName(
          relation.attackerTag,
          skill.name,
          attacker.name,
        );
        const defenderOwner = this._getTagOwnerName(
          relation.defenderTag,
          skill.name,
          defender.name,
        );

        resistances.push(
          `${defenderOwner}的【${relation.defenderTag.name}】抵抗${attackerOwner}的【${relation.attackerTag.name}】`,
        );
      }
    });

    // 构建最终标记
    const parts = [];

    if (restraints.length > 0) {
      parts.push(`克制：${restraints.join("、")}`);
    }

    if (resistances.length > 0) {
      parts.push(`抵抗：${resistances.join("、")}`);
    }

    if (parts.length === 0) {
      return "";
    }

    return `【${parts.join("，")}】`;
  }

  /**
   * 检测属性状态变化
   * @param {Hero} target - 目标对象
   * @param {string} attributeName - 属性名称（如 '当前活力'）
   * @param {number} oldValue - 旧值
   * @param {number} newValue - 新值
   * @param {number} maxValue - 最大值
   * @returns {Object} 状态变化检测结果
   * @private
   */
  _detectAttributeStateChange(target, attributeName, oldValue, newValue, maxValue) {
    // 边界检查
    if (maxValue === 0) {
      return { hasChange: false, changeType: "none" };
    }

    // 计算百分比
    const oldPercent = (oldValue / maxValue) * 100;
    const newPercent = (newValue / maxValue) * 100;

    // 获取状态等级
    const oldLevel = this._getStateLevel(oldPercent);
    const newLevel = this._getStateLevel(newPercent);

    // 如果等级没有变化，返回无变化
    if (oldLevel === newLevel) {
      return { hasChange: false, changeType: "none" };
    }

    // 获取属性类型（用于调用 getAttributeLabel）
    const attributeType = this._getAttributeType(attributeName);

    // 获取状态标签
    const oldStateLabel = this._extractStateLabel(
      this.getAttributeLabel(attributeType, oldPercent),
    );
    const newStateLabel = this._extractStateLabel(
      this.getAttributeLabel(attributeType, newPercent),
    );

    // 判断变化类型
    const NORMAL_LEVEL = 4;
    let changeType;

    if (oldLevel === NORMAL_LEVEL && newLevel < NORMAL_LEVEL) {
      changeType = "enter"; // 进入异常状态
    } else if (oldLevel < NORMAL_LEVEL && newLevel === NORMAL_LEVEL) {
      changeType = "exit"; // 脱离异常状态
    } else if (oldLevel < NORMAL_LEVEL && newLevel < NORMAL_LEVEL) {
      if (newLevel < oldLevel) {
        changeType = "worsen"; // 状态恶化
      } else {
        changeType = "improve"; // 状态好转
      }
    } else {
      changeType = "none";
    }

    return {
      hasChange: true,
      changeType: changeType,
      oldState: oldStateLabel,
      newState: newStateLabel,
      oldLevel: oldLevel,
      newLevel: newLevel,
    };
  }

  /**
   * 生成状态变化标记
   * @param {Hero} target - 目标对象
   * @param {string} changeType - 变化类型（'enter' | 'exit' | 'worsen' | 'improve' | 'none'）
   * @param {string} oldState - 旧状态标签
   * @param {string} newState - 新状态标签
   * @param {string} attributeName - 属性名称（用于显示，如 '当前活力'）
   * @returns {string} 状态变化标记文本（如果没有变化则返回空字符串）
   * @private
   */
  _generateStateChangeMarker(target, changeType, oldState, newState, attributeName) {
    // 如果没有变化，返回空字符串
    if (changeType === "none") {
      return "";
    }

    const targetName = target.name;

    switch (changeType) {
      case "enter":
        // 进入异常状态
        return `，${targetName}进入【${newState}】状态`;

      case "exit":
        // 脱离异常状态
        return `，${targetName}脱离【${oldState}】状态`;

      case "worsen":
        // 状态恶化
        return `，${targetName}从【${oldState}】恶化为【${newState}】`;

      case "improve":
        // 状态好转
        return `，${targetName}从【${oldState}】好转为【${newState}】`;

      default:
        return "";
    }
  }

  /**
   * 记录效果施加
   * @param {Hero} caster - 施法者对象
   * @param {Hero} target - 目标对象
   * @param {string} effectName - 效果名称
   * @private
   */
  _recordEffectApplied(caster, target, effectName) {
    // 边界检查
    if (!caster || !target || !effectName) {
      console.warn("[BattleReporter] 效果施加记录参数不完整");
      return;
    }

    // 生成消息
    const message = `${caster.name}对${target.name}施加了【${effectName}】`;

    // 记录到简化战报
    this.logSimple(message);
  }

  /**
   * 记录效果过期
   * @param {Hero} target - 目标对象
   * @param {string} effectName - 效果名称
   * @private
   */
  _recordEffectExpired(target, effectName) {
    // 边界检查
    if (!target || !effectName) {
      console.warn("[BattleReporter] 效果过期记录参数不完整");
      return;
    }

    // 生成消息
    const message = `${target.name}的【${effectName}】效果已过期`;

    // 记录到简化战报
    this.logSimple(message);
  }

  /**
   * 记录效果移除
   * @param {Hero} target - 目标对象
   * @param {string} effectName - 效果名称
   * @private
   */
  _recordEffectRemoved(target, effectName) {
    // 边界检查
    if (!target || !effectName) {
      console.warn("[BattleReporter] 效果移除记录参数不完整");
      return;
    }

    // 生成消息
    const message = `${target.name}的【${effectName}】效果被移除`;

    // 记录到简化战报
    this.logSimple(message);
  }

  /**
   * 记录攻击行动（增强版）
   * @param {Hero} attacker - 攻击者对象
   * @param {Hero} target - 目标对象
   * @param {Move} skill - 技能对象
   * @param {Object} damageResult - 伤害计算结果
   * @param {Object} attributeChanges - 属性变化对象（可选）
   * @param {Array} matchedRelations - 标签克制关系数组（可选）
   */
  recordAttack(
    attacker,
    target,
    skill,
    damageResult,
    attributeChanges = null,
    matchedRelations = null,
  ) {
    // 如果没有提供 attributeChanges，降级为仅显示活力变化
    if (!attributeChanges) {
      attributeChanges = {
        当前活力: {
          oldValue: damageResult.oldValue ?? 0,
          newValue: damageResult.newValue ?? 0,
          maxValue: target.additionalStats.活力 ?? 100,
        },
      };
    }

    // 遍历每个受影响的属性
    Object.keys(attributeChanges).forEach((attributeName) => {
      const change = attributeChanges[attributeName];
      const changeAmount = Math.abs(change.newValue - change.oldValue);

      // 1. 计算效果评价
      const evaluation = this._calculateEffectEvaluation(changeAmount, change.maxValue);

      // 2. 生成克制标记（仅对第一个属性生成，避免重复）
      let restraintMarker = "";
      if (attributeName === Object.keys(attributeChanges)[0] && matchedRelations) {
        restraintMarker = this._generateTagRestraintMarker(
          attacker,
          target,
          skill,
          matchedRelations,
        );
        if (restraintMarker) {
          restraintMarker = "，" + restraintMarker;
        }
      }

      // 3. 检测状态变化
      const stateChange = this._detectAttributeStateChange(
        target,
        attributeName,
        change.oldValue,
        change.newValue,
        change.maxValue,
      );

      // 4. 生成状态变化标记
      const stateMarker = stateChange.hasChange
        ? this._generateStateChangeMarker(
            target,
            stateChange.changeType,
            stateChange.oldState,
            stateChange.newState,
            attributeName,
          )
        : "";

      // 5. 构建完整消息
      const message = `${attacker.name}使用${skill.name}攻击${target.name}，【${evaluation}】${restraintMarker}${stateMarker}，${target.name}${attributeName}：${change.oldValue}→${change.newValue}`;

      // 6. 记录到简化战报
      this.logSimple(message);
    });
  }

  /**
   * 记录治疗行动（增强版）
   * @param {Hero} healer - 治疗者对象
   * @param {Hero} target - 目标对象
   * @param {Move} skill - 技能对象（可选，如果是普通治疗可能没有技能对象）
   * @param {number} healAmount - 治疗量
   * @param {Object} attributeChanges - 属性变化对象（可选）
   */
  recordHeal(healer, target, skill, healAmount, attributeChanges = null) {
    // 如果没有提供 attributeChanges，降级为仅显示活力变化
    if (!attributeChanges) {
      const oldValue = target.additionalStats.当前活力 - healAmount;
      const newValue = target.additionalStats.当前活力;
      attributeChanges = {
        当前活力: {
          oldValue: oldValue,
          newValue: newValue,
          maxValue: target.additionalStats.活力 || 100,
        },
      };
    }

    // 获取技能名称（如果没有技能对象，使用默认名称）
    const skillName = skill ? skill.name : "治疗";

    // 遍历每个受影响的属性
    Object.keys(attributeChanges).forEach((attributeName) => {
      const change = attributeChanges[attributeName];
      const changeAmount = Math.abs(change.newValue - change.oldValue);

      // 1. 计算效果评价
      const evaluation = this._calculateEffectEvaluation(changeAmount, change.maxValue);

      // 2. 检测状态变化
      const stateChange = this._detectAttributeStateChange(
        target,
        attributeName,
        change.oldValue,
        change.newValue,
        change.maxValue,
      );

      // 3. 生成状态变化标记
      const stateMarker = stateChange.hasChange
        ? this._generateStateChangeMarker(
            target,
            stateChange.changeType,
            stateChange.oldState,
            stateChange.newState,
            attributeName,
          )
        : "";

      // 4. 构建完整消息
      const message = `${healer.name}使用${skillName}治疗${target.name}，【${evaluation}】${stateMarker}，${target.name}${attributeName}：${change.oldValue}→${change.newValue}`;

      // 5. 记录到简化战报
      this.logSimple(message);
    });
  }

  /**
   * 生成完整战斗简报
   * @param {Array} allHeroes - 所有参战角色数组
   * @returns {string} 完整战报文本
   */
  generateBattleReport(allHeroes) {
    let report =
      '[系统指令]:前端系统已演算过一场战斗,本轮你的任务是根据这份"战报简述",演绎这场战斗。并在正文最后抄录"参战人员战后属性一览"。"战报简述"如下:\n\n';
    report += "【战斗简报】\n\n";

    // 拼接简化战报
    report += this.simpleBattleLog.join("\n");

    // 拼接战后属性一览
    report += this.generatePostBattleAttributes(allHeroes);

    return report;
  }

  /**
   * 输出战报到输入框
   * @param {Array} allHeroes - 所有参战角色数组
   */
  outputToInputBox(allHeroes) {
    const report = this.generateBattleReport(allHeroes);

    // 获取输入框元素
    const inputBox = document.getElementById("quick-send-input");
    if (inputBox) {
      inputBox.value = report;

      // 显示临时提示
      const tempMessage = document.createElement("div");
      tempMessage.textContent = "战报已生成到输入框";
      tempMessage.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--color-success);
                color: white;
                padding: 15px 30px;
                border-radius: 8px;
                font-size: var(--text-md);
                z-index: 10000;
                box-shadow: 0 4px 12px var(--overlay-dark);
            `;
      document.body.appendChild(tempMessage);

      // 3秒后移除提示并关闭战斗模态框
      setTimeout(() => {
        tempMessage.remove();

        // 关闭战斗模态框
        const battleModal = document.getElementById("battle-modal");
        if (battleModal) {
          battleModal.style.display = "none";
        }
      }, 3000);
    } else {
      console.error("[BattleReporter] 未找到输入框元素 #quick-send-input");
    }
  }

  /**
   * 记录详细伤害计算
   * @param {Object} attacker - 攻击者
   * @param {Object} defender - 防御者
   * @param {Object} skill - 技能
   * @param {Object} damageResult - 伤害计算结果
   */
  logDetailedDamageCalculation(attacker, defender, skill, damageResult) {
    const entry = {
      type: "damage_calculation",
      round: this.currentRound,
      timestamp: Date.now(),
      attacker: attacker.name,
      defender: defender.name,
      skill: skill.name,
      formula: {
        baseDamage: damageResult.baseDamage ?? 0,
        attackPower: damageResult.attackPower ?? 0,
        defensePower: damageResult.defensePower ?? 0,
        finalDamage: damageResult.finalDamage ?? 0,
        criticalHit: damageResult.isCritical ?? false,
        criticalMultiplier: damageResult.criticalMultiplier ?? 1.0,
      },
    };

    this.detailedLog.push(entry);
    console.log("[BattleReporter] 记录详细伤害计算:", entry);
  }

  /**
   * 记录属性变化
   * @param {Object} hero - 角色
   * @param {string} attributeName - 属性名称
   * @param {number} oldValue - 旧值
   * @param {number} newValue - 新值
   * @param {string} reason - 变化原因
   */
  logAttributeChange(hero, attributeName, oldValue, newValue, reason) {
    const entry = {
      type: "attribute_change",
      round: this.currentRound,
      timestamp: Date.now(),
      hero: hero.name,
      attribute: attributeName,
      oldValue: oldValue,
      newValue: newValue,
      change: newValue - oldValue,
      reason: reason,
    };

    this.detailedLog.push(entry);
    console.log("[BattleReporter] 记录属性变化:", entry);
  }

  /**
   * 记录技能消耗扣除
   * @param {Object} hero - 角色
   * @param {Object} skill - 技能
   * @param {Object} costResult - 消耗结果
   */
  logCostDeduction(hero, skill, costResult) {
    const entry = {
      type: "cost_deduction",
      round: this.currentRound,
      timestamp: Date.now(),
      hero: hero.name,
      skill: skill.name,
      costType: skill.cost?.type || "unknown",
      costAmount: costResult.oldValue - costResult.newValue,
      oldValue: costResult.oldValue,
      newValue: costResult.newValue,
    };

    this.detailedLog.push(entry);
    console.log("[BattleReporter] 记录技能消耗:", entry);
  }

  /**
   * 记录状态效果应用
   * @param {Object} hero - 角色
   * @param {Object} effect - 效果
   * @param {string} action - 动作（'applied' 或 'removed'）
   */
  logEffectApplication(hero, effect, action) {
    const entry = {
      type: "effect_application",
      round: this.currentRound,
      timestamp: Date.now(),
      hero: hero.name,
      effect: effect.name || effect.type,
      action: action,
      duration: effect.duration ?? 0,
      details: effect,
    };

    this.detailedLog.push(entry);
    console.log("[BattleReporter] 记录状态效果:", entry);
  }

  /**
   * 开始新回合
   * @param {number} roundNumber - 回合数
   */
  startNewRound(roundNumber) {
    this.currentRound = roundNumber;
    this.roundActions = [];
    console.log(`[BattleReporter] 开始第 ${roundNumber} 回合`);
  }

  /**
   * 记录回合行动
   * @param {Object} actionData - 行动数据
   */
  logRoundAction(actionData) {
    this.roundActions.push({
      round: this.currentRound,
      timestamp: Date.now(),
      ...actionData,
    });
  }

  /**
   * 生成详细战斗报告
   * @param {Array} allHeroes - 所有参战角色
   * @returns {string} 详细战报文本
   */
  generateDetailedReport(allHeroes) {
    let report = "【详细战斗报告】\n\n";

    // 按回合分组详细日志
    const logsByRound = {};
    this.detailedLog.forEach((entry) => {
      const round = entry.round || 1;
      if (!logsByRound[round]) {
        logsByRound[round] = [];
      }
      logsByRound[round].push(entry);
    });

    // 生成每回合的详细报告
    Object.keys(logsByRound)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach((round) => {
        report += this.formatRoundBreakdown(parseInt(round), logsByRound[round], allHeroes);
        report += "\n";
      });

    // 添加战后属性一览
    report += this.generatePostBattleAttributes(allHeroes);

    return report;
  }

  /**
   * 格式化回合分解
   * @param {number} roundNumber - 回合数
   * @param {Array} roundLogs - 该回合的日志
   * @param {Array} allHeroes - 所有角色
   * @returns {string} 格式化的回合报告
   */
  formatRoundBreakdown(roundNumber, roundLogs, allHeroes) {
    let breakdown = `=== 第 ${roundNumber} 回合 ===\n\n`;

    // 显示回合开始时的角色状态
    breakdown += "【回合开始时角色状态】\n";
    allHeroes.forEach((hero) => {
      if (hero.isAlive()) {
        const vitalityPercent = (
          (hero.additionalStats.当前活力 / hero.additionalStats.活力) *
          100
        ).toFixed(0);
        breakdown += `  ${hero.name}: 活力 ${vitalityPercent}%`;

        // 显示当前效果
        if (hero.effects && hero.effects.length > 0) {
          const effectNames = hero.effects.map((e) => e.name || e.type).join(", ");
          breakdown += ` [效果: ${effectNames}]`;
        }
        breakdown += "\n";
      }
    });
    breakdown += "\n";

    // 显示该回合的详细行动
    breakdown += "【回合行动详情】\n";
    roundLogs.forEach((log) => {
      breakdown += this.formatActionDetails(log);
    });

    return breakdown;
  }

  /**
   * 格式化行动详情
   * @param {Object} log - 日志条目
   * @returns {string} 格式化的行动详情
   */
  formatActionDetails(log) {
    let details = "";

    switch (log.type) {
      case "damage_calculation":
        details += `  ${log.attacker} 使用 ${log.skill} 攻击 ${log.defender}\n`;
        details += `    伤害计算: 基础伤害=${log.formula.baseDamage}, `;
        details += `攻击力=${log.formula.attackPower}, `;
        details += `防御力=${log.formula.defensePower}, `;
        details += `最终伤害=${log.formula.finalDamage}`;
        if (log.formula.criticalHit) {
          details += ` [暴击! x${log.formula.criticalMultiplier}]`;
        }
        details += "\n";
        break;

      case "attribute_change":
        details += `  ${log.hero} 的 ${log.attribute} 变化: ${log.oldValue} → ${log.newValue} (${log.change > 0 ? "+" : ""}${log.change})`;
        details += ` [原因: ${log.reason}]\n`;
        break;

      case "cost_deduction":
        details += `  ${log.hero} 使用 ${log.skill} 消耗 ${log.costAmount} 点 ${log.costType}`;
        details += ` (${log.oldValue} → ${log.newValue})\n`;
        break;

      case "effect_application":
        if (log.action === "applied") {
          details += `  ${log.hero} 获得效果: ${log.effect}`;
          if (log.duration > 0) {
            details += ` (持续 ${log.duration} 回合)`;
          }
        } else if (log.action === "removed") {
          details += `  ${log.hero} 的效果 ${log.effect} 已结束`;
        }
        details += "\n";
        break;

      default:
        details += `  [未知日志类型: ${log.type}]\n`;
    }

    return details;
  }

  /**
   * 清空战报
   */
  clear() {
    this.simpleBattleLog = [];
    this.detailedLog = [];
    this.participatingCharacters.clear();
    this.currentRound = 1;
    this.roundActions = [];
    console.log("[BattleReporter] 战报已清空");
  }
}
