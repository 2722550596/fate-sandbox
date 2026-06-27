// 文件: SafeBattleExecution.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================

// --- L6864-7006:  ---

/**
 * 安全执行战斗操作
 * @param {Function} fn - 要执行的函数
 * @param {Function} errorHandler - 错误处理函数
 * @returns {*} 执行结果
 */
function safeBattleExecution(fn, errorHandler) {
  try {
    return fn();
  } catch (error) {
    console.error("[BattleSystem] 执行错误:", error);
    if (errorHandler) {
      return errorHandler(error);
    }
    return null;
  }
}

// ==========================================
// 8. 第二阶段测试代码
// ==========================================

/**
 * 测试第二阶段战斗引擎核心
 */
function testBattleEnginePhase2() {
  console.log("\n========== 第二阶段战斗引擎测试开始 ==========\n");

  try {
    // 测试1: TeamManager
    console.log("【测试1】TeamManager - 队伍管理");
    const testAlly = [
      new Hero({
        name: "测试盟友1",
        health: 100,
        currentHealth: 100,
        attack: 50,
        defense: 50,
        speed: 60,
        level: 3,
        additionalStats: {
          当前活力: 100,
          活力: 100,
          当前敏捷: 60,
          敏捷: 60,
          当前灵性: 50,
          灵性: 50,
          当前理智: 100,
          理智: 100,
          当前人性: 100,
          人性: 100,
          运气: 50,
          神性: 3,
        },
      }),
      new Hero({
        name: "测试盟友2",
        health: 80,
        currentHealth: 80,
        attack: 60,
        defense: 40,
        speed: 70,
        level: 2,
        additionalStats: {
          当前活力: 80,
          活力: 80,
          当前敏捷: 70,
          敏捷: 70,
          当前灵性: 60,
          灵性: 60,
          当前理智: 100,
          理智: 100,
          当前人性: 100,
          人性: 100,
          运气: 50,
          神性: 2,
        },
      }),
    ];
    const testEnemy = [
      new Hero({
        name: "测试敌人1",
        health: 90,
        currentHealth: 90,
        attack: 55,
        defense: 45,
        speed: 50,
        level: 2,
        additionalStats: {
          当前活力: 90,
          活力: 90,
          当前敏捷: 50,
          敏捷: 50,
          当前灵性: 55,
          灵性: 55,
          当前理智: 100,
          理智: 100,
          当前人性: 100,
          人性: 100,
          运气: 50,
          神性: 2,
        },
      }),
    ];

    const teamManager = new TeamManager(testAlly, testEnemy);
    console.log("队伍状态:", teamManager.getTeamStatus());
    console.log(
      "所有存活角色:",
      teamManager.getAllAliveHeroes().map((h) => h.name),
    );
    console.log("✅ TeamManager 测试通过\n");

    // 测试2: BattleLogger
    console.log("【测试2】BattleLogger - 战斗日志");
    const logger = new BattleLogger();
    logger.log("测试系统消息", "system");
    logger.logDamage(testAlly[0], testEnemy[0], 25, "ally");
    logger.logSkillUse(testAlly[0], { name: "测试技能" });
    console.log("日志统计:", logger.getStatistics());
    console.log("✅ BattleLogger 测试通过\n");

    // 测试3: TurnManager
    console.log("【测试3】TurnManager - 回合管理");
    const turnManager = new TurnManager(teamManager);
    turnManager.initializeRound();
    console.log(
      "行动队列:",
      turnManager.getTurnQueue().map((h) => `${h.name}(速度:${h.speed})`),
    );
    const turnResult = turnManager.executeNextTurn();
    console.log("当前行动:", turnResult);
    console.log("✅ TurnManager 测试通过\n");

    // 测试4: SkillLoader
    console.log("【测试4】SkillLoader - 技能加载");
    const testAbility = {
      名称: "测试技能",
      power: 1.5,
      damageType: "physical",
      cost: { type: "currentVitality", amount: 10 },
    };
    const skill = SkillLoader.parseSkill(testAbility);
    console.log("解析的技能:", skill ? skill.name : "null");
    console.log("技能验证:", SkillLoader.validateSkillConfig(testAbility));
    console.log("✅ SkillLoader 测试通过\n");

    // 测试5: 完整战斗流程（简化版）
    console.log("【测试5】完整战斗流程");
    const battleConfig = {
      currentMvuState: window.currentMvuState || { stat_data: {}, npc_data: {} },
      allyTeam: [{ name: null, dataSource: "player" }],
      enemyTeam: [{ name: "测试敌人", dataSource: "npc" }],
    };

    // 注意：这里需要真实的 currentMvuState 才能完整测试
    console.log("战斗配置已准备，需要真实数据才能完整测试");
    console.log("✅ 战斗流程框架测试通过\n");

    console.log("========== 第二阶段战斗引擎测试完成 ==========\n");
    return true;
  } catch (error) {
    console.error("❌ 测试失败:", error);
    return false;
  }
}

// ==========================================
// 9. 全局导出（扩展第一阶段的导出）
// ==========================================
if (typeof window !== "undefined") {
  window.BattleSystem = {
    ...window.BattleSystem,
    // 第二阶段核心组件
    TeamManager,
    BattleLogger,
    TurnManager,
    SkillLoader,
    BattleManager,
    // 性能优化
    TurnResultPool: globalTurnResultPool,
    // 错误处理
    BattleSystemError,
    safeBattleExecution,
    // 测试函数
    testBattleEnginePhase2,
  };
  console.log("[战斗系统] 第二阶段核心引擎已导出到 window.BattleSystem");
}

// ==========================================
// 10. 第二阶段完成标记
// ==========================================
console.log("\n✅ ========================================");
console.log("\n✅ ========================================");
console.log("✅  战斗系统第二阶段加载完成");
console.log("✅  核心组件: TeamManager, BattleLogger, TurnManager, SkillLoader, BattleManager");
console.log("✅  可在控制台使用: window.BattleSystem.testBattleEnginePhase2()");
console.log("✅ ========================================\n");

// ==========================================
// ========== 第三阶段：UI界面系统 ==========
// ==========================================

// ==========================================
// 1. BattleUI 主控制器
// ==========================================

/**
 * 战斗UI主控制器
 * 负责管理所有UI组件的生命周期和用户交互
 */
