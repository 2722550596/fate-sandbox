// VariableSystemIntegration.js - 来源: original.js

// === class VariableSystemIntegration (行 1477-1554) ===

class VariableSystemIntegration {
  /**
   * 从Variable_System读取角色数据
   * @param {Object} currentMvuState - 当前MVU状态
   * @param {string} characterName - 角色名称 (null表示玩家)
   * @returns {Object} 角色数据
   */
  static getCharacterData(currentMvuState, characterName = null) {
    if (!currentMvuState) {
      console.error("[VariableSystemIntegration] currentMvuState 不存在");
      return null;
    }

    if (!characterName) {
      // 读取玩家数据
      return currentMvuState.stat_data;
    } else {
      // 读取NPC数据
      if (!currentMvuState.npc_data || !currentMvuState.npc_data[characterName]) {
        console.error(`[VariableSystemIntegration] NPC数据不存在: ${characterName}`);
        return null;
      }
      return currentMvuState.npc_data[characterName];
    }
  }

  /**
   * 批量同步战斗结果
   * @param {Array<Object>} heroes - 战斗后的Hero对象数组
   * @param {Object} currentMvuState - 当前MVU状态
   */
  static syncBattleResults(heroes, currentMvuState) {
    if (!heroes || !Array.isArray(heroes)) {
      console.error("[VariableSystemIntegration] heroes 必须是数组");
      return;
    }

    // 使用批量同步方法，性能更好
    AttributeMapper.syncAllToFrontend(heroes, currentMvuState);

    console.log(`[VariableSystemIntegration] 已同步 ${heroes.length} 个角色的战斗结果`);
  }

  /**
   * 创建战斗队伍
   * @param {Object} currentMvuState - 当前MVU状态
   * @param {Array} teamConfig - 队伍配置 [{name: '角色名', isPlayer: true/false}, ...]
   * @returns {Array<Object>} Hero对象数组
   */
  static createBattleTeam(currentMvuState, teamConfig) {
    if (!teamConfig || !Array.isArray(teamConfig)) {
      console.error("[VariableSystemIntegration] teamConfig 必须是数组");
      return [];
    }

    const team = [];

    teamConfig.forEach((config) => {
      const characterData = this.getCharacterData(
        currentMvuState,
        config.isPlayer ? null : config.name,
      );

      if (characterData) {
        const heroConfig = AttributeMapper.mapToHero(
          characterData,
          config.name || "玩家",
          config.isPlayer ? "player" : "npc",
        );

        if (heroConfig) {
          const hero = new Hero(heroConfig);
          team.push(hero);
        }
      }
    });

    console.log(`[VariableSystemIntegration] 创建战斗队伍，共 ${team.length} 个角色`);
    return team;
  }
}
