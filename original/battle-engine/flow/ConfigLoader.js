// ConfigLoader.js - 来源: original.js

// === class ConfigLoader (行 3187-3406) ===

class ConfigLoader {
  constructor() {
    this.isDevelopmentMode = this.checkDevelopmentMode();
    this.configCache = new Map();

    console.log("[ConfigLoader] 配置加载器已初始化，开发模式:", this.isDevelopmentMode);
  }

  /**
   * 检查是否为开发模式
   * @returns {boolean} 是否为开发模式
   */
  checkDevelopmentMode() {
    // 检查 hostname 是否为 localhost 或 127.0.0.1
    const isLocalhost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    // 检查 localStorage 中的 dev-mode 标志
    const devModeFlag = localStorage.getItem("battle-dev-mode") === "true";

    return isLocalhost || devModeFlag;
  }

  /**
   * 加载配置文件
   * @param {string} configKey - 配置键名
   * @param {string} configPath - 配置文件路径
   * @returns {Promise<Object>} 配置对象
   */
  async loadConfig(configKey, configPath) {
    try {
      const response = await fetch(configPath);
      if (!response.ok) {
        throw new Error(`配置文件加载失败: ${response.status}`);
      }

      const config = await response.json();

      // 验证配置
      if (this.validateConfig(configKey, config)) {
        this.configCache.set(configKey, config);
        console.log(`[ConfigLoader] 配置加载成功: ${configKey}`);
        return config;
      } else {
        throw new Error("配置验证失败");
      }
    } catch (error) {
      console.error(`[ConfigLoader] 配置加载失败: ${configKey}`, error);

      // 返回缓存的配置或默认配置
      if (this.configCache.has(configKey)) {
        console.log(`[ConfigLoader] 使用缓存配置: ${configKey}`);
        return this.configCache.get(configKey);
      } else {
        console.log(`[ConfigLoader] 使用默认配置: ${configKey}`);
        return this.getDefaultConfig(configKey);
      }
    }
  }

  /**
   * 热重载配置
   * @param {string} configKey - 配置键名
   * @param {string} configPath - 配置文件路径
   * @returns {Promise<boolean>} 是否重载成功
   */
  async reloadConfig(configKey, configPath) {
    if (!this.isDevelopmentMode) {
      console.warn("[ConfigLoader] 热重载仅在开发模式下可用");
      return false;
    }

    console.log(`[ConfigLoader] 开始热重载配置: ${configKey}`);

    // 保存当前配置作为备份
    const backup = this.configCache.get(configKey);

    try {
      const newConfig = await this.loadConfig(configKey, configPath);

      // 验证新配置有效性
      if (this.validateConfig(configKey, newConfig)) {
        console.log(`[ConfigLoader] 配置热重载成功: ${configKey}`);
        return true;
      } else {
        // 无效时恢复备份
        if (backup) {
          this.configCache.set(configKey, backup);
        }
        console.error(`[ConfigLoader] 新配置无效，已恢复备份: ${configKey}`);
        return false;
      }
    } catch (error) {
      // 恢复备份
      if (backup) {
        this.configCache.set(configKey, backup);
      }
      console.error(`[ConfigLoader] 配置热重载失败: ${configKey}`, error);
      return false;
    }
  }

  /**
   * 验证配置
   * @param {string} configKey - 配置键名
   * @param {Object} config - 配置对象
   * @returns {boolean} 是否有效
   */
  validateConfig(configKey, config) {
    switch (configKey) {
      case "statusEffects":
        return this.validateStatusEffectsConfig(config);

      case "skills":
        return this.validateSkillsConfig(config);

      default:
        console.warn(`[ConfigLoader] 未知的配置类型: ${configKey}`);
        return true;
    }
  }

  /**
   * 验证状态效果配置
   * @param {Object} config - 配置对象
   * @returns {boolean} 是否有效
   */
  validateStatusEffectsConfig(config) {
    const attributes = ["vitality", "agility", "spirit", "sanity", "humanity"];

    for (const attr of attributes) {
      if (!config[attr] || !Array.isArray(config[attr])) {
        console.error(`[ConfigLoader] 缺少属性配置: ${attr}`);
        return false;
      }

      for (const item of config[attr]) {
        if (typeof item.threshold !== "number" || item.threshold < 0 || item.threshold > 1) {
          console.error(`[ConfigLoader] 无效的阈值: ${item.threshold}`);
          return false;
        }

        if (!item.effect || !item.effect.name || !item.effect.type) {
          console.error(`[ConfigLoader] 无效的效果配置`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 验证技能配置
   * @param {Object} config - 配置对象
   * @returns {boolean} 是否有效
   */
  validateSkillsConfig(config) {
    if (!Array.isArray(config.skills)) {
      console.error("[ConfigLoader] 技能配置必须是数组");
      return false;
    }

    for (const skill of config.skills) {
      if (!skill.name && !skill.名称) {
        console.error("[ConfigLoader] 技能缺少名称");
        return false;
      }

      const damageType = skill.damageType || skill.伤害类型;
      const validDamageTypes = ["physical", "mystical", "mental", "mixed"];
      if (damageType && !validDamageTypes.includes(damageType)) {
        console.error(`[ConfigLoader] 无效的伤害类型: ${damageType}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 获取默认配置
   * @param {string} configKey - 配置键名
   * @returns {Object} 默认配置对象
   */
  getDefaultConfig(configKey) {
    switch (configKey) {
      case "statusEffects":
        // 返回 StatusEffectManager 的默认配置
        return new StatusEffectManager().getDefaultConfig();

      case "skills":
        return { skills: [] };

      default:
        return {};
    }
  }

  /**
   * 暴露热重载 API（开发模式）
   */
  exposeReloadAPI() {
    if (!this.isDevelopmentMode) {
      return;
    }

    if (!window.BattleSystem) {
      window.BattleSystem = {};
    }

    window.BattleSystem.reloadConfig = async (configKey, configPath) => {
      return await this.reloadConfig(configKey, configPath);
    };

    console.log(
      "[ConfigLoader] 热重载 API 已暴露: window.BattleSystem.reloadConfig(configKey, configPath)",
    );
  }
}
