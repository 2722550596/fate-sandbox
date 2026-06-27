// BattleManager.js - 来源: original.js

// === class BattleManager (行 6272-6791) ===

class BattleManager {
  /**
   * 构造函数（支持 NvN 战斗模式）
   * @param {Object} battleConfig - 战斗配置对象
   * @param {Object} battleConfig.currentMvuState - 当前MVU状态
   * @param {Array} battleConfig.playerTeam - 玩家队伍配置（可选）
   * @param {Array} battleConfig.allyTeam - 盟友队伍配置
   * @param {Array} battleConfig.enemyTeam - 敌方队伍配置
   */
  constructor(battleConfig) {
    this.battleId = this.generateBattleId();
    this.config = battleConfig;
    this.currentMvuState = battleConfig.currentMvuState;

    // 创建队伍（支持 NvN 模式）
    const playerTeam = battleConfig.playerTeam
      ? this.createTeamFromConfig(battleConfig.playerTeam, "player")
      : [];
    const allyTeam = this.createTeamFromConfig(battleConfig.allyTeam, "ally");
    const enemyTeam = this.createTeamFromConfig(battleConfig.enemyTeam, "enemy");

    // 合并玩家和盟友为友方队伍
    this.playerTeam = playerTeam;
    this.allyTeam = [...playerTeam, ...allyTeam];
    this.enemyTeam = enemyTeam;

    // 创建管理器
    this.teamManager = new TeamManager(this.allyTeam, this.enemyTeam);
    this.battleLogger = new BattleLogger();
    // 移除：this.skillLoader = new SkillLoader(); // SkillLoader 是静态类，不需要实例化
    this.configLoader = new ConfigLoader(); // 创建配置加载器
    this.statusEffectManager = new StatusEffectManager();
    this.effectManager = new EffectManager(); // 创建技能效果管理器
    this.tagManager = new TagManager(this.battleLogger, WorldbookManager); // 🆕 创建标签管理器
    this.battleReporter = new BattleReporter(); // 创建战报生成器
    this.cpuManager = new CPUManager(battleConfig.aiDifficulty || "easy"); // 创建AI管理器
    this.turnManager = new TurnManager(this.teamManager, this); // 传入 battleManager 引用
    this.parameterSelector = new ParameterSelector(); // 🆕 创建参数选择器

    // 暴露热重载 API（仅开发模式）
    this.configLoader.exposeReloadAPI();

    // 🆕 暴露TagManager到全局（便于调试）
    window.tagManager = this.tagManager;

    // 🔥 新增：环境效果存储
    this.environmentEffects = battleConfig.environmentEffects || [];

    // 战斗状态
    this.battleState = "preparing"; // preparing, ongoing, finished
    this.currentRound = 0;
    this.battleResult = null;

    console.log(`[BattleManager] 战斗管理器已创建 - ID: ${this.battleId}`);
    console.log(`[BattleManager] 玩家队伍: ${playerTeam.map((h) => h.name).join(", ") || "无"}`);
    console.log(`[BattleManager] 友方队伍: ${this.allyTeam.map((h) => h.name).join(", ")}`);
    console.log(`[BattleManager] 敌方队伍: ${this.enemyTeam.map((h) => h.name).join(", ")}`);
  }

  /**
   * 从配置创建战斗队伍（支持 NvN 模式）
   * @param {Array} teamConfig - 队伍配置数组
   * @param {string} teamType - 队伍类型 ('player', 'ally', 'enemy')
   * @returns {Array} Hero对象数组
   */
  createTeamFromConfig(teamConfig, teamType) {
    if (!teamConfig || teamConfig.length === 0) {
      return [];
    }

    const team = [];

    teamConfig.forEach((memberConfig) => {
      try {
        // 判断是否为玩家角色
        const isPlayer = memberConfig.dataSource === "player" || teamType === "player";

        // 如果是玩家，传 null；否则传角色名
        const characterName = isPlayer ? null : memberConfig.name;
        // 用于 getCharacterData 的数据源标识（内部使用）
        const mvuDataSource = isPlayer ? "stat_data" : "npc_data";
        // 用于 Hero 对象的数据源标识（传递给 SkillLoader）
        const heroDataSource = isPlayer ? "player" : "npc";

        const characterData = VariableSystemIntegration.getCharacterData(
          this.currentMvuState,
          characterName,
        );

        if (characterData) {
          // 验证角色数据完整性
          const validation = this.validateCharacterData(characterData, memberConfig.name);
          if (!validation.valid) {
            console.error(
              `[BattleManager] 角色数据验证失败 [${memberConfig.name}]: ${validation.message}`,
            );
            return;
          }

          const heroConfig = AttributeMapper.mapToHero(
            characterData,
            memberConfig.name || "未命名角色",
            heroDataSource,
          );

          // 添加 teamType 属性
          heroConfig.teamType = teamType === "player" || teamType === "ally" ? "ally" : "enemy";

          const hero = new Hero(heroConfig);

          // 🆕 加载技能到 hero.moveSet（修复被动技能问题）
          const skills = SkillLoader.loadSkillsFromCharacter(characterData, heroDataSource);
          hero.setMoveSet(skills);

          team.push(hero);
        } else {
          console.error(`[BattleManager] 未找到角色数据 [${memberConfig.name}]`);
        }
      } catch (error) {
        console.error(`[BattleManager] 创建队伍成员失败 [${memberConfig.name}]:`, error);
      }
    });

    const teamLabel = teamType === "player" ? "玩家" : teamType === "ally" ? "盟友" : "敌方";
    console.log(`[BattleManager] ${teamLabel}队伍创建完成: ${team.map((h) => h.name).join(", ")}`);
    return team;
  }

  /**
   * 验证角色数据完整性
   * @param {Object} characterData - 角色数据
   * @param {string} characterName - 角色名称
   * @returns {Object} 验证结果 { valid: boolean, message: string }
   */
  validateCharacterData(characterData, characterName) {
    // 修改：检查实际存在的属性名（不带"上限"后缀）
    const requiredAttributes = ["当前活力", "活力", "当前灵性", "灵性", "当前理智", "理智"];

    for (const attr of requiredAttributes) {
      if (characterData[attr] === undefined || characterData[attr] === null) {
        return {
          valid: false,
          message: `缺少必需属性: ${attr}`,
        };
      }

      if (typeof characterData[attr] !== "number") {
        return {
          valid: false,
          message: `属性 ${attr} 类型错误，应为 number，实际为 ${typeof characterData[attr]}`,
        };
      }
    }

    return { valid: true, message: "" };
  }

  /**
   * 🆕 应用所有角色的被动技能
   * @description 在战斗开始前，遍历所有角色，将被动技能的效果施加给持有者自己
   * @returns {void}
   */
  applyPassiveSkills() {
    try {
      const allHeroes = this.teamManager.getAllHeroes();

      console.log(`[BattleManager] 开始应用被动技能，共${allHeroes.length}个角色`);

      let totalPassiveSkills = 0;
      let totalEffectsApplied = 0;

      allHeroes.forEach((hero) => {
        try {
          // 过滤出被动技能
          const passiveSkills = hero.moveSet.filter((skill) => skill.isPassive);

          if (passiveSkills.length > 0) {
            console.log(`[BattleManager] ${hero.name} 拥有 ${passiveSkills.length} 个被动技能`);
            totalPassiveSkills += passiveSkills.length;

            // 施加每个被动技能
            passiveSkills.forEach((passive) => {
              try {
                // 验证被动技能配置
                if (!passive.effects || passive.effects.length === 0) {
                  console.warn(
                    `[BattleManager] ${hero.name}的被动技能【${passive.name}】没有配置效果`,
                  );
                  return;
                }

                // 施加所有效果
                passive.effects.forEach((effect) => {
                  const result = this.effectManager.applyEffect(hero, effect, hero, passive);

                  if (result.applied || result.replaced) {
                    totalEffectsApplied++;
                  }
                });

                // 记录战斗日志
                this.battleLogger.log(`${hero.name}的被动技能【${passive.name}】生效`, "effect");
              } catch (error) {
                console.error(`[BattleManager] 施加被动技能【${passive.name}】时发生错误:`, error);
              }
            });
          }
        } catch (error) {
          console.error(`[BattleManager] 处理角色【${hero.name}】的被动技能时发生错误:`, error);
        }
      });

      console.log(
        `[BattleManager] 被动技能应用完成：${totalPassiveSkills}个被动技能，${totalEffectsApplied}个效果生效`,
      );
    } catch (error) {
      console.error("[BattleManager] 应用被动技能时发生严重错误:", error);
      // 不抛出错误，允许战斗继续
    }
  }

  /**
   * 开始战斗
   * @returns {Promise<boolean>} 是否成功开始
   */
  async startBattle() {
    if (this.battleState !== "preparing") {
      console.error("[BattleManager] 战斗已经开始或已结束");
      return false;
    }

    this.battleState = "ongoing";
    this.currentRound = 1;

    this.battleLogger.log("========== 战斗开始 ==========", "system");
    this.battleLogger.log(
      `<User>的友方队伍: ${this.allyTeam.map((h) => h.name).join(", ")}`,
      "info",
    );
    this.battleLogger.log(
      `<User>的敌方队伍: ${this.enemyTeam.map((h) => h.name).join(", ")}`,
      "info",
    );

    // 🆕 初始化固有标签（在被动技能之前）
    await this.tagManager.initializeInherentTags(this.teamManager.getAllHeroes());

    // 🆕 预加载标签克制配置（确保战斗中可以使用）
    await this.tagManager.loadTagDamageRelations();
    await this.tagManager.loadTagHealingRelations();

    // 🆕 应用被动技能（在计算先攻顺序之前）
    this.applyPassiveSkills();

    this.battleLogger.log(`========== 第 ${this.currentRound} 回合 ==========`, "system");

    // 初始化回合
    this.turnManager.initializeRound();

    return true;
  }

  /**
   * 执行下一个行动
   * @returns {Object|null} 回合结果
   */
  executeNextTurn() {
    if (this.battleState !== "ongoing") {
      console.error("[BattleManager] 战斗未进行中");
      return null;
    }

    // 检查回合是否结束
    if (this.turnManager.isRoundComplete()) {
      return this.endRound();
    }

    // 执行下一个行动
    const turnResult = this.turnManager.executeNextTurn();

    // 检查战斗是否结束
    if (this.checkBattleEnd()) {
      this.endBattle();
    }

    return turnResult;
  }

  /**
   * 结束当前回合
   * @returns {Object} 回合结束结果
   */
  endRound() {
    this.battleLogger.log(`========== 第 ${this.currentRound} 回合结束 ==========`, "system");

    // 处理回合结束效果
    this.turnManager.processRoundEndEffects();

    // 检查战斗是否结束
    if (this.checkBattleEnd()) {
      this.endBattle();
      return { type: "battle_end", message: "战斗结束" };
    }

    // 开始新回合
    this.currentRound++;
    this.battleLogger.log(`========== 第 ${this.currentRound} 回合 ==========`, "system");
    this.turnManager.initializeRound();

    return {
      type: "round_end",
      message: `第 ${this.currentRound - 1} 回合结束，开始第 ${this.currentRound} 回合`,
    };
  }

  /**
   * 检查战斗是否结束（支持 NvN 模式）
   * @returns {boolean} 是否结束
   */
  checkBattleEnd() {
    const allyAlive = this.allyTeam.some((hero) => hero.additionalStats.当前活力 > 0);
    const enemyAlive = this.enemyTeam.some((hero) => hero.additionalStats.当前活力 > 0);

    // 友方队伍全灭或敌方队伍全灭
    if (!allyAlive || !enemyAlive) {
      return true;
    }

    // 平局情况：双方同时全灭（理论上不太可能，但需要处理）
    if (!allyAlive && !enemyAlive) {
      return true;
    }

    return false;
  }

  /**
   * 结束战斗
   * @returns {Object} 战斗结果
   */
  endBattle() {
    this.battleState = "finished";

    const allyAlive = this.allyTeam.some((hero) => hero.additionalStats.当前活力 > 0);
    const enemyAlive = this.enemyTeam.some((hero) => hero.additionalStats.当前活力 > 0);

    let result = "draw";
    if (allyAlive && !enemyAlive) {
      result = "victory";
      this.battleLogger.log("🎉 战斗胜利！", "victory");
    } else if (!allyAlive && enemyAlive) {
      result = "defeat";
      this.battleLogger.log("💀 战斗失败！", "defeat");
    } else {
      this.battleLogger.log("⚔️ 战斗平局", "draw");
    }

    this.battleLogger.log("========== 战斗结束 ==========", "system");

    // 生成战斗结果
    this.battleResult = this.generateBattleResult(result);

    // 不同步属性到前端，战后属性通过战报输出
    // 外部系统会根据战报中的"战后属性一览"更新变量

    return this.battleResult;
  }

  /**
   * 🔥 新增：添加环境效果
   * @param {Object} effect - 环境效果对象
   */
  addEnvironmentEffect(effect) {
    if (!effect || !effect.name) {
      console.warn("[BattleManager] 无效的环境效果");
      return;
    }

    this.environmentEffects.push({ ...effect });
    console.log(`[BattleManager] 添加环境效果: ${effect.name}`);

    if (this.battleLogger) {
      this.battleLogger.log(`战场出现环境效果: ${effect.name}`, "effect");
    }
  }

  /**
   * 🔥 新增：移除环境效果
   * @param {string} effectName - 效果名称
   */
  removeEnvironmentEffect(effectName) {
    const index = this.environmentEffects.findIndex((e) => e.name === effectName);

    if (index !== -1) {
      this.environmentEffects.splice(index, 1);
      console.log(`[BattleManager] 移除环境效果: ${effectName}`);

      if (this.battleLogger) {
        this.battleLogger.log(`环境效果消失: ${effectName}`, "effect");
      }
    }
  }

  /**
   * 🔥 新增：获取活跃的环境效果
   * @returns {Array} 活跃的环境效果数组
   */
  getActiveEnvironmentEffects() {
    return this.environmentEffects.filter((e) => e.duration > 0);
  }

  /**
   * 生成战斗结果
   * @param {string} result - 战斗结果 ('victory', 'defeat', 'draw')
   * @returns {Object} 战斗结果对象
   */
  generateBattleResult(result) {
    return {
      battleId: this.battleId,
      result: result,
      rounds: this.currentRound,
      allyTeam: this.allyTeam.map((h) => h.getStatusSummary()),
      enemyTeam: this.enemyTeam.map((h) => h.getStatusSummary()),
      battleLog: this.battleLogger.getLogs(),
      statistics: this.generateStatistics(),
    };
  }

  /**
   * 生成战斗统计
   * @returns {Object} 统计信息
   */
  generateStatistics() {
    return {
      totalDamageDealt: this.battleLogger.getTotalDamage("ally"),
      totalDamageTaken: this.battleLogger.getTotalDamage("enemy"),
      skillsUsed: this.battleLogger.getSkillsUsed(),
      roundsCompleted: this.currentRound,
      logStatistics: this.battleLogger.getStatistics(),
    };
  }

  /**
   * 同步战斗结果到前端（已废弃）
   * 注意：战斗系统不再直接修改变量系统
   * 战后属性通过战报的"战后属性一览"输出，由外部系统负责更新
   */
  syncBattleResults() {
    // 此方法已废弃，保留仅为兼容性
    console.log("[BattleManager] 战斗系统不再同步属性到前端，请使用战报系统");
  }

  /**
   * 生成战斗ID
   * @returns {string} 唯一的战斗ID
   */
  generateBattleId() {
    return `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取战斗状态
   * @returns {Object} 当前战斗状态
   */
  getBattleState() {
    return {
      battleId: this.battleId,
      state: this.battleState,
      currentRound: this.currentRound,
      allyTeam: this.allyTeam.map((h) => h.getStatusSummary()),
      enemyTeam: this.enemyTeam.map((h) => h.getStatusSummary()),
      currentTurn: this.turnManager.getCurrentTurn(),
      teamStatus: this.teamManager.getTeamStatus(),
    };
  }

  /**
   * 获取战斗日志
   * @returns {Array} 日志数组
   */
  getBattleLogs() {
    return this.battleLogger.getLogs();
  }

  /**
   * 获取格式化的战斗日志
   * @returns {string} 格式化的日志文本
   */
  getFormattedBattleLogs() {
    return this.battleLogger.getFormattedLogs();
  }

  /**
   * 获取指定角色的敌方队伍
   * @param {Hero} hero - 角色对象
   * @returns {Array} 敌方队伍数组
   */
  getEnemyTeam(hero) {
    if (hero.teamType === "ally") {
      return this.enemyTeam.filter((h) => h.additionalStats.当前活力 > 0);
    } else {
      return this.allyTeam.filter((h) => h.additionalStats.当前活力 > 0);
    }
  }

  /**
   * 获取指定角色的友方队伍
   * @param {Hero} hero - 角色对象
   * @returns {Array} 友方队伍数组
   */
  getAllyTeam(hero) {
    if (hero.teamType === "ally") {
      return this.allyTeam.filter((h) => h.additionalStats.当前活力 > 0);
    } else {
      return this.enemyTeam.filter((h) => h.additionalStats.当前活力 > 0);
    }
  }

  /**
   * 获取所有参战角色（用于战报生成）
   * @returns {Array} 所有参战角色数组
   */
  getAllHeroes() {
    return [...this.allyTeam, ...this.enemyTeam];
  }
}
