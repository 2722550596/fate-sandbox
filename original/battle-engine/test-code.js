// 文件: test-code.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================

// --- L1324-1476:  ---

console.log(
  "[战斗系统] 核心架构已加载：AttributeMapper, AttributeCalculator, DamageCalculator, SkillCostManager, Hero, Move",
);

// ==========================================
// 7. 战斗系统测试和使用示例
// ==========================================

/**
 * 测试战斗系统核心功能
 */
function testBattleSystem() {
  console.log("\n========== 战斗系统测试开始 ==========\n");

  // 1. 创建测试角色数据
  const playerData = {
    活力: 100,
    当前活力: 100,
    灵性: 80,
    当前灵性: 80,
    理智: 100,
    当前理智: 100,
    人性: 100,
    当前人性: 100,
    敏捷: 60,
    当前敏捷: 60,
    运气: 50,
    神性: 3,
    当前序列: "序列7",
  };

  const enemyData = {
    活力: 80,
    当前活力: 80,
    灵性: 60,
    当前灵性: 60,
    理智: 80,
    当前理智: 80,
    人性: 80,
    当前人性: 80,
    敏捷: 50,
    当前敏捷: 50,
    运气: 40,
    神性: 2,
    当前序列: "序列8",
  };

  // 2. 测试属性映射
  console.log("【测试1】属性映射");
  const playerHeroConfig = AttributeMapper.mapToHero(playerData, "玩家", "player");
  const enemyHeroConfig = AttributeMapper.mapToHero(enemyData, "敌人", "npc");

  const playerHero = new Hero(playerHeroConfig);
  const enemyHero = new Hero(enemyHeroConfig);

  console.log("玩家Hero:", playerHero.getStatusSummary());
  console.log("敌人Hero:", enemyHero.getStatusSummary());

  // 3. 测试4种伤害类型
  console.log("\n【测试2】4种伤害类型计算");

  const damageTypes = ["physical", "mystical", "mental", "mixed"];
  damageTypes.forEach((type) => {
    const skill = new Move({
      name: `测试${type}技能`,
      power: 1.5,
      damageType: type,
    });

    const result = DamageCalculator.calculate(playerHero, enemyHero, skill);
    console.log(`${type}伤害:`, result.formula);
  });

  // 4. 测试技能消耗
  console.log("\n【测试3】技能消耗系统");

  const costSkill = new Move({
    name: "消耗灵性技能",
    power: 2.0,
    damageType: "mystical",
    cost: {
      type: "currentSpirit",
      amount: 20,
    },
  });

  console.log("技能描述:", costSkill.getDescription());

  const canAfford = costSkill.canUse(playerHero);
  console.log("能否使用:", canAfford);

  if (canAfford.canAfford) {
    const costResult = costSkill.executeCost(playerHero);
    console.log("消耗结果:", costResult);
    console.log("消耗后灵性:", playerHero.additionalStats.当前灵性);
  }

  // 5. 测试完整战斗流程
  console.log("\n【测试4】完整战斗流程");

  const attackSkill = new Move({
    name: "物理攻击",
    power: 1.8,
    damageType: "physical",
  });

  console.log("战斗前敌人活力:", enemyHero.additionalStats.当前活力);

  const damageResult = DamageCalculator.calculate(playerHero, enemyHero, attackSkill);
  console.log("伤害计算:", damageResult.formula);

  const applyResult = DamageCalculator.applyDamage(enemyHero, damageResult);
  console.log("伤害应用:", applyResult);
  console.log("战斗后敌人活力:", enemyHero.additionalStats.当前活力);

  // 6. 测试精神伤害（伤害理智）
  console.log("\n【测试5】精神伤害（伤害理智）");

  const mentalSkill = new Move({
    name: "精神冲击",
    power: 2.0,
    damageType: "mental",
  });

  console.log("战斗前敌人理智:", enemyHero.additionalStats.当前理智);

  const mentalDamageResult = DamageCalculator.calculate(playerHero, enemyHero, mentalSkill);
  console.log("精神伤害计算:", mentalDamageResult.formula);
  console.log("目标属性:", mentalDamageResult.targetAttribute);

  const mentalApplyResult = DamageCalculator.applyDamage(enemyHero, mentalDamageResult);
  console.log("精神伤害应用:", mentalApplyResult);
  console.log("战斗后敌人理智:", enemyHero.additionalStats.当前理智);

  console.log("\n========== 战斗系统测试完成 ==========\n");
}

// 导出到全局作用域，方便控制台调用
if (typeof window !== "undefined") {
  window.BattleSystem = {
    AttributeMapper,
    AttributeCalculator,
    DamageCalculator,
    SkillCostManager,
    Hero,
    Move,
    testBattleSystem,
  };
  console.log("[战斗系统] 已导出到 window.BattleSystem，可在控制台使用");
}

// ==========================================
// 8. VariableSystemIntegration (系统集成接口)
// ==========================================
