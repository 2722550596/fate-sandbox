// ConditionSystem.js - 来源: original.js

// === class TagChecker (行 5835-5876) ===

class TagChecker {
  /**
   * 检查角色是否拥有指定标签
   * @param {Hero} hero - 角色对象
   * @param {string} tagName - 标签名称
   * @returns {boolean} 是否拥有该标签
   */
  hasTag(hero, tagName) {
    if (!hero || !hero.tags || !Array.isArray(hero.tags)) {
      return false;
    }
    return hero.tags.some((tag) => tag.name === tagName);
  }

  /**
   * 获取指定标签的层数
   * @param {Hero} hero - 角色对象
   * @param {string} tagName - 标签名称
   * @returns {number} 标签层数（不存在返回0）
   */
  getTagStacks(hero, tagName) {
    if (!hero || !hero.tags || !Array.isArray(hero.tags)) {
      return 0;
    }
    const tag = hero.tags.find((tag) => tag.name === tagName);
    return tag ? tag.stacks || 0 : 0;
  }

  /**
   * 获取指定标签的剩余持续时间
   * @param {Hero} hero - 角色对象
   * @param {string} tagName - 标签名称
   * @returns {number} 剩余回合数（不存在返回0）
   */
  getTagDuration(hero, tagName) {
    if (!hero || !hero.tags || !Array.isArray(hero.tags)) {
      return 0;
    }
    const tag = hero.tags.find((tag) => tag.name === tagName);
    return tag ? tag.duration || 0 : 0;
  }
}

// === class RandomGenerator (行 5884-5931) ===

class RandomGenerator {
  constructor() {
    // 使用 WeakMap 存储目标的随机数缓存（自动垃圾回收）
    this.targetRandomCache = new WeakMap();
  }

  /**
   * 生成随机整数（闭区间）
   * @param {number} min - 最小值（包含）
   * @param {number} max - 最大值（包含）
   * @returns {number} 随机整数
   */
  random(min, max) {
    // 处理无效范围
    if (min > max) {
      console.warn(`[RandomGenerator] 无效范围: min(${min}) > max(${max})，交换数值`);
      [min, max] = [max, min];
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 为目标生成随机数（带缓存）
   * @param {Hero} target - 目标对象
   * @returns {number} 随机数（1-100）
   */
  generateForTarget(target) {
    // 检查缓存
    if (this.targetRandomCache.has(target)) {
      return this.targetRandomCache.get(target);
    }

    // 生成新的随机数
    const randomValue = this.random(1, 100);

    // 缓存
    this.targetRandomCache.set(target, randomValue);

    return randomValue;
  }

  /**
   * 清空随机数缓存（每次技能执行前调用）
   */
  clearCache() {
    this.targetRandomCache = new WeakMap();
  }
}

// === class ExpressionContext (行 5939-6007) ===

class ExpressionContext {
  /**
   * 创建表达式上下文
   * @param {Hero} caster - 施法者
   * @param {Hero} target - 目标
   * @param {TagChecker} tagChecker - 标签检查器
   * @param {number} randomValue - 随机数
   * @returns {Object} 上下文对象
   */
  static create(caster, target, tagChecker, randomValue) {
    // 创建角色上下文的辅助函数
    const createHeroContext = (hero) => ({
      // 六维属性
      当前活力: hero.additionalStats?.当前活力 ?? 0,
      当前敏捷: hero.additionalStats?.当前敏捷 ?? 0,
      当前灵性: hero.additionalStats?.当前灵性 ?? 0,
      当前理智: hero.additionalStats?.当前理智 ?? 0,
      当前人性: hero.additionalStats?.当前人性 ?? 0,
      运气: hero.additionalStats?.运气 ?? 0,

      // 六维上限
      活力: hero.additionalStats?.活力 ?? 0,
      敏捷: hero.additionalStats?.敏捷 ?? 0,
      灵性: hero.additionalStats?.灵性 ?? 0,
      理智: hero.additionalStats?.理智 ?? 0,
      人性: hero.additionalStats?.人性 ?? 0,

      // 战斗属性
      attack: hero.attack ?? 0,
      defense: hero.defense ?? 0,
      speed: hero.speed ?? 0,
      currentHealth: hero.currentHealth ?? 0,
      maxHealth: hero.maxHealth ?? 0,

      // 序列属性
      sequenceRank: hero.sequenceRank ?? 10,

      // 其他属性
      神性: hero.additionalStats?.神性 ?? 0,
      level: hero.level ?? 1,

      // 标签检查函数
      hasTag: (tagName) => tagChecker.hasTag(hero, tagName),
      getTagStacks: (tagName) => tagChecker.getTagStacks(hero, tagName),
      getTagDuration: (tagName) => tagChecker.getTagDuration(hero, tagName),
    });

    return {
      caster: createHeroContext(caster),
      target: createHeroContext(target),

      // 随机数函数（使用缓存值）
      random: (min, max) => {
        if (randomValue !== undefined) {
          return randomValue;
        }
        return Math.floor(Math.random() * (max - min + 1)) + min;
      },

      // 中文别名
      随机数: (min, max) => {
        if (randomValue !== undefined) {
          return randomValue;
        }
        return Math.floor(Math.random() * (max - min + 1)) + min;
      },
    };
  }
}

// === class ConditionEvaluator (行 6015-6064) ===

class ConditionEvaluator {
  constructor() {
    this.tagChecker = new TagChecker();
    // 表达式缓存（提高性能）
    this.expressionCache = new Map();
  }

  /**
   * 评估条件表达式
   * @param {string} expression - 条件表达式
   * @param {Hero} caster - 施法者
   * @param {Hero} target - 目标
   * @param {number} randomValue - 缓存的随机数
   * @returns {boolean} 条件是否满足
   */
  evaluate(expression, caster, target, randomValue) {
    try {
      // 创建表达式上下文
      const context = ExpressionContext.create(caster, target, this.tagChecker, randomValue);

      // 获取或创建编译后的函数
      let evaluator = this.expressionCache.get(expression);
      if (!evaluator) {
        // 使用 Function 构造函数创建表达式评估器
        const functionBody = `
                    with (context) {
                        return (${expression});
                    }
                `;
        evaluator = new Function("context", functionBody);
        this.expressionCache.set(expression, evaluator);
      }

      // 执行表达式
      const result = evaluator(context);

      // 确保返回布尔值
      return Boolean(result);
    } catch (error) {
      console.error(`[ConditionEvaluator] 表达式评估失败: "${expression}"`, error);
      return false; // 安全默认值
    }
  }
}

// === class ParameterSelector (行 6072-6167) ===

class ParameterSelector {
  constructor() {
    this.conditionEvaluator = new ConditionEvaluator();
    this.randomGenerator = new RandomGenerator();
  }

  /**
   * 选择参数集
   * @param {Move} skill - 技能对象
   * @param {Hero} caster - 施法者
   * @param {Hero} target - 目标
   * @returns {Object} 最终参数集
   */
  selectParameters(skill, caster, target) {
    // 提取默认参数集
    const defaultParams = this.extractDefaultParams(skill);

    // 如果没有条件参数集，直接返回默认参数
    if (!skill.conditionalParams || skill.conditionalParams.length === 0) {
      return defaultParams;
    }

    // 为目标生成随机数（如果条件中使用 random 函数）
    const randomValue = this.randomGenerator.generateForTarget(target);

    // 按顺序评估条件
    for (const conditionalParam of skill.conditionalParams) {
      const condition = conditionalParam.condition;
      const params = conditionalParam.params;

      // 评估条件
      const isMatch = this.conditionEvaluator.evaluate(condition, caster, target, randomValue);

      // 如果匹配，合并参数并返回
      if (isMatch) {
        return this.mergeParameters(defaultParams, params);
      }
    }

    // 没有匹配的条件，返回默认参数
    return defaultParams;
  }

  /**
   * 提取默认参数集
   * @param {Move} skill - 技能对象
   * @returns {Object} 默认参数集
   */
  extractDefaultParams(skill) {
    const params = { ...skill };
    // 排除 conditionalParams 本身
    delete params.conditionalParams;
    return params;
  }

  /**
   * 合并参数集
   * @param {Object} defaultParams - 默认参数集
   * @param {Object} conditionalParams - 条件参数集
   * @returns {Object} 合并后的参数集
   */
  mergeParameters(defaultParams, conditionalParams) {
    const merged = { ...defaultParams };

    for (const [key, value] of Object.entries(conditionalParams)) {
      // 跳过 cost 和 targetType（不可替换）
      if (key === "cost" || key === "targetType") {
        console.warn(`[ParameterSelector] 忽略 conditionalParams 中的 ${key} 参数`);
        continue;
      }

      // 类型验证（可选）
      if (typeof value !== typeof defaultParams[key] && defaultParams[key] !== undefined) {
        console.warn(`[ParameterSelector] 参数 ${key} 类型不匹配，跳过`);
        continue;
      }

      // 标量参数：覆盖；数组参数：完全替换
      merged[key] = value;
    }

    return merged;
  }

  /**
   * 清空随机数缓存（每次技能执行前调用）
   */
  clearCache() {
    this.randomGenerator.clearCache();
  }
}
