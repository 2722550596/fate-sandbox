// BattleLogger.js - 来源: original.js

// === class BattleLogger (行 1857-2103) ===

class BattleLogger {
  /**
   * 构造函数
   */
  constructor() {
    this.logs = [];
    this.damageStats = {
      ally: 0,
      enemy: 0,
    };
    this.skillsUsed = {};

    console.log("[BattleLogger] 战斗日志器已初始化");
  }

  /**
   * 记录日志
   * @param {string} message - 日志消息
   * @param {string} type - 日志类型 (info, attack, damage, heal, effect, system, victory, defeat, draw)
   * @returns {Object} 日志条目
   */
  log(message, type = "info") {
    const logEntry = {
      timestamp: Date.now(),
      type: type,
      message: message,
    };

    this.logs.push(logEntry);
    console.log(`[BattleLog] ${message}`);

    return logEntry;
  }

  /**
   * 记录伤害
   * @param {Object} attacker - 攻击者Hero对象
   * @param {Object} defender - 防御者Hero对象
   * @param {number} damage - 伤害值
   * @param {string} team - 队伍标识 ('ally' 或 'enemy')
   * @returns {Object} 日志条目
   */
  logDamage(attacker, defender, damage, team) {
    this.damageStats[team] += damage;

    return this.log(`${attacker.name} 对 ${defender.name} 造成 ${damage} 点伤害`, "damage");
  }

  /**
   * 记录技能使用
   * @param {Object} hero - 使用技能的Hero对象
   * @param {Object} skill - Move对象
   * @returns {Object} 日志条目
   */
  logSkillUse(hero, skill) {
    const key = `${hero.name}_${skill.name}`;
    this.skillsUsed[key] = (this.skillsUsed[key] || 0) + 1;

    return this.log(`${hero.name} 使用了 ${skill.name}`, "attack");
  }

  /**
   * 获取所有日志
   * @returns {Array} 日志数组
   */
  getLogs() {
    return this.logs;
  }

  /**
   * 获取格式化的日志文本
   * @returns {string} 格式化后的日志字符串
   */
  getFormattedLogs() {
    return this.logs
      .map((log) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        return `[${time}] ${log.message}`;
      })
      .join("\n");
  }

  /**
   * 获取总伤害
   * @param {string} team - 队伍标识 ('ally' 或 'enemy')
   * @returns {number} 总伤害值
   */
  getTotalDamage(team) {
    return this.damageStats[team] || 0;
  }

  /**
   * 获取技能使用统计
   * @returns {Object} 技能使用次数统计
   */
  getSkillsUsed() {
    return this.skillsUsed;
  }

  /**
   * 清空日志
   */
  clear() {
    this.logs = [];
    this.damageStats = { ally: 0, enemy: 0 };
    this.skillsUsed = {};
    console.log("[BattleLogger] 日志已清空");
  }

  /**
   * 获取日志统计信息
   * @returns {Object} 统计信息
   */
  getStatistics() {
    return {
      totalLogs: this.logs.length,
      allyDamage: this.damageStats.ally,
      enemyDamage: this.damageStats.enemy,
      skillsUsedCount: Object.keys(this.skillsUsed).length,
      logTypes: this.logs.reduce((acc, log) => {
        acc[log.type] = (acc[log.type] || 0) + 1;
        return acc;
      }, {}),
    };
  }

  /**
   * 记录buff/debuff的施加
   * @param {Object} target - 目标角色
   * @param {Object} effect - 效果对象
   * @param {Object} caster - 施法者（可选）
   * @returns {Object} 日志条目
   */
  logEffectApplied(target, effect, caster = null) {
    const effectTypeNames = {
      buff: "Buff增益",
      debuff: "Debuff减益",
      poison: "中毒",
      regen: "恢复",
    };

    const typeName = effectTypeNames[effect.type] || effect.type;
    const casterText = caster ? `${caster.name}对` : "";

    let message = `${casterText}${target.name}施加了${typeName}【${effect.name}】`;

    // 添加效果详情
    if (effect.stat) {
      const statNames = {
        attack: "攻击力",
        defense: "防御力",
        speed: "速度",
        活力: "活力上限",
        敏捷: "敏捷上限",
        灵性: "灵性上限",
        理智: "理智上限",
        人性: "人性上限",
        运气: "运气",
        damageDealtIncrease: "造成伤害",
        damageDealtDecrease: "造成伤害",
        damageTakenIncrease: "受到伤害",
        damageTakenDecrease: "受到伤害",
      };

      if (effect.power !== undefined) {
        const valueTypeText = effect.valueType === "percentage" ? "%" : "点";
        const powerDisplay =
          effect.type === "buff"
            ? `+${effect.power}`
            : effect.type === "debuff"
              ? `-${effect.power}`
              : effect.power;
        message += `，影响${statNames[effect.stat] || effect.stat}${powerDisplay}${valueTypeText}`;
      }
    }

    message += `，持续${effect.duration}回合`;

    return this.log(message, "effect");
  }

  /**
   * 记录效果生效时的属性变化
   * @param {Object} hero - 角色
   * @param {string} effectName - 效果名称
   * @param {string} attribute - 属性名称
   * @param {number} oldValue - 旧值
   * @param {number} newValue - 新值
   * @returns {Object} 日志条目
   */
  logEffectAttributeChange(hero, effectName, attribute, oldValue, newValue) {
    const change = newValue - oldValue;
    const changeText = change > 0 ? `+${change}` : `${change}`;

    const message = `${hero.name}的【${effectName}】生效，${attribute}变化${changeText}点（${oldValue} → ${newValue}）`;

    return this.log(message, "effect");
  }

  /**
   * 显示伤害计算的详细过程（包含buff/debuff修正）
   * @param {Object} attacker - 攻击者
   * @param {Object} defender - 防御者
   * @param {Object} skill - 技能
   * @param {number} baseAttack - 基础攻击力
   * @param {number} finalAttack - 最终攻击力
   * @param {number} baseDefense - 基础防御力
   * @param {number} finalDefense - 最终防御力
   * @param {number} finalDamage - 最终伤害
   * @returns {Object} 日志条目
   */
  logDetailedDamageCalculation(
    attacker,
    defender,
    skill,
    baseAttack,
    finalAttack,
    baseDefense,
    finalDefense,
    finalDamage,
  ) {
    let message = `【伤害计算】${attacker.name}使用${skill.name}攻击${defender.name}：`;

    // 攻击力修正
    if (baseAttack !== finalAttack) {
      const attackMod = finalAttack - baseAttack;
      const attackModText = attackMod > 0 ? `+${attackMod}` : `${attackMod}`;
      message += `\n  攻击力: ${baseAttack} → ${finalAttack} (${attackModText})`;
    } else {
      message += `\n  攻击力: ${finalAttack}`;
    }

    // 防御力修正
    if (baseDefense !== finalDefense) {
      const defenseMod = finalDefense - baseDefense;
      const defenseModText = defenseMod > 0 ? `+${defenseMod}` : `${defenseMod}`;
      message += `\n  防御力: ${baseDefense} → ${finalDefense} (${defenseModText})`;
    } else {
      message += `\n  防御力: ${finalDefense}`;
    }

    message += `\n  最终伤害: ${finalDamage}`;

    return this.log(message, "damage");
  }

  /**
   * 记录效果过期
   * @param {Object} hero - 角色
   * @param {string} effectName - 效果名称
   * @returns {Object} 日志条目
   */
  logEffectExpired(hero, effectName) {
    const message = `${hero.name}的【${effectName}】效果已过期`;
    return this.log(message, "effect");
  }
}
