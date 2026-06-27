// TeamManager.js - 来源: original.js

// === class TeamManager (行 1754-1850) ===

class TeamManager {
  /**
   * 构造函数
   * @param {Array} allyTeam - 盟友队伍（Hero对象数组）
   * @param {Array} enemyTeam - 敌方队伍（Hero对象数组）
   */
  constructor(allyTeam, enemyTeam) {
    this.allyTeam = allyTeam || [];
    this.enemyTeam = enemyTeam || [];

    console.log(
      `[TeamManager] 队伍初始化完成 - 盟友:${this.allyTeam.length}人, 敌方:${this.enemyTeam.length}人`,
    );
  }

  /**
   * 获取所有角色
   * @returns {Array} 所有角色的数组
   */
  getAllHeroes() {
    return [...this.allyTeam, ...this.enemyTeam];
  }

  /**
   * 获取所有存活的角色
   * @returns {Array} 所有存活角色的数组
   */
  getAllAliveHeroes() {
    return this.getAllHeroes().filter((hero) => hero.additionalStats.当前活力 > 0);
  }

  /**
   * 获取盟友队伍存活角色
   * @returns {Array} 存活的盟友数组
   */
  getAliveAllies() {
    return this.allyTeam.filter((hero) => hero.additionalStats.当前活力 > 0);
  }

  /**
   * 获取敌方队伍存活角色
   * @returns {Array} 存活的敌人数组
   */
  getAliveEnemies() {
    return this.enemyTeam.filter((hero) => hero.additionalStats.当前活力 > 0);
  }

  /**
   * 根据名称查找角色
   * @param {string} name - 角色名称
   * @returns {Object|null} 找到的Hero对象，未找到返回null
   */
  findHeroByName(name) {
    return this.getAllHeroes().find((hero) => hero.name === name) || null;
  }

  /**
   * 判断角色所属队伍
   * @param {Object} hero - Hero对象
   * @returns {string|null} 'ally', 'enemy', 或 null
   */
  getHeroTeam(hero) {
    if (this.allyTeam.includes(hero)) {
      return "ally";
    } else if (this.enemyTeam.includes(hero)) {
      return "enemy";
    }
    return null;
  }

  /**
   * 获取敌对队伍
   * @param {Object} hero - Hero对象
   * @returns {Array} 敌对队伍的存活角色数组
   */
  getOpponentTeam(hero) {
    const team = this.getHeroTeam(hero);
    if (team === "ally") {
      return this.getAliveEnemies();
    } else if (team === "enemy") {
      return this.getAliveAllies();
    }
    return [];
  }

  /**
   * 获取队伍状态摘要
   * @returns {Object} 队伍状态信息
   */
  getTeamStatus() {
    return {
      allyCount: this.allyTeam.length,
      allyAlive: this.getAliveAllies().length,
      enemyCount: this.enemyTeam.length,
      enemyAlive: this.getAliveEnemies().length,
      totalAlive: this.getAllAliveHeroes().length,
    };
  }
}
