// AttributeMapper.js - 来源: original.js

// === class AttributeMapper (行 13-140) ===

class AttributeMapper {
  /**
   * 将前端角色数据转换为Hero对象
   * @param {Object} characterData - stat_data 或 npc_data[npcName]
   * @param {string} characterName - 角色名称
   * @param {string} dataSource - 'player' 或 'npc'
   * @returns {Object} 战斗引擎Hero配置对象
   */
  static mapToHero(characterData, characterName, dataSource) {
    if (!characterData) {
      console.error(`[AttributeMapper] 角色数据不存在: ${characterName}`);
      return null;
    }

    return {
      name: characterName,
      // Battle-Engine标准属性
      health: characterData.活力 ?? 100,
      currentHealth: characterData.当前活力 ?? characterData.活力 ?? 100,
      attack: Math.floor(((characterData.当前活力 ?? 0) + (characterData.当前敏捷 ?? 0)) / 2),
      defense: Math.floor(((characterData.当前活力 ?? 0) + (characterData.当前敏捷 ?? 0)) / 2),
      speed: characterData.当前敏捷 ?? 50,
      level: characterData.神性 ?? 1,

      // 诡秘之主扩展属性
      additionalStats: {
        当前活力: characterData.当前活力 ?? characterData.活力 ?? 100,
        活力: characterData.活力 ?? 100,
        当前灵性: characterData.当前灵性 ?? characterData.灵性 ?? 50,
        灵性: characterData.灵性 ?? 50,
        当前理智: characterData.当前理智 ?? characterData.理智 ?? 100,
        理智: characterData.理智 ?? 100,
        当前人性: characterData.当前人性 ?? characterData.人性 ?? 100,
        人性: characterData.人性 ?? 100,
        当前敏捷: characterData.当前敏捷 ?? characterData.敏捷 ?? 50,
        敏捷: characterData.敏捷 ?? 50,
        运气: characterData.运气 ?? 50,
        神性: characterData.神性 ?? 1,
      },

      // Buff/Debuff系统：六维属性基础值快照
      baseStats: {
        活力: characterData.活力 ?? 100,
        敏捷: characterData.敏捷 ?? 50,
        灵性: characterData.灵性 ?? 50,
        理智: characterData.理智 ?? 100,
        人性: characterData.人性 ?? 100,
        运气: characterData.运气 ?? 50,
      },

      // 序列信息
      sequenceRank: parseSequenceRank(characterData.当前序列),
      sequenceString: characterData.当前序列 || "普通人",

      // 数据源标识
      dataSource: dataSource,
      originalData: characterData,

      // 🆕 标签系统：初始化为空数组
      tags: [],
    };
  }

  /**
   * 将Hero对象的变化同步回前端数据
   * @param {Object} hero - 战斗引擎Hero对象
   * @param {Object} currentMvuState - 当前MVU状态
   */
  static syncToFrontend(hero, currentMvuState) {
    if (!hero || !currentMvuState) {
      console.error("[AttributeMapper] syncToFrontend: 参数缺失");
      return;
    }

    const targetData =
      hero.dataSource === "player"
        ? currentMvuState.stat_data
        : currentMvuState.npc_data[hero.name];

    if (!targetData) {
      console.error(`[AttributeMapper] 无法找到角色数据: ${hero.name}`);
      return;
    }

    // 同步当前属性（确保不超过上限）
    targetData.当前活力 = Math.max(0, Math.min(hero.additionalStats.当前活力, targetData.活力));
    targetData.当前敏捷 = Math.max(0, Math.min(hero.additionalStats.当前敏捷, targetData.敏捷));
    targetData.当前灵性 = Math.max(0, Math.min(hero.additionalStats.当前灵性, targetData.灵性));
    targetData.当前理智 = Math.max(0, Math.min(hero.additionalStats.当前理智, targetData.理智));
    targetData.当前人性 = Math.max(0, Math.min(hero.additionalStats.当前人性, targetData.人性));

    console.log(`[AttributeMapper] 已同步 ${hero.name} 的属性到前端`);
  }

  /**
   * 批量同步所有角色属性到前端
   * @param {Array} heroes - Hero对象数组
   * @param {Object} currentMvuState - 当前MVU状态
   */
  static syncAllToFrontend(heroes, currentMvuState) {
    if (!heroes || !Array.isArray(heroes) || !currentMvuState) {
      console.error("[AttributeMapper] syncAllToFrontend: 参数无效");
      return;
    }

    const startTime = performance.now();
    let syncCount = 0;

    heroes.forEach((hero) => {
      try {
        this.syncToFrontend(hero, currentMvuState);
        syncCount++;
      } catch (error) {
        console.error(`[AttributeMapper] 同步角色 ${hero.name} 失败:`, error);
      }
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(
      `[AttributeMapper] 批量同步完成: ${syncCount}/${heroes.length} 个角色，耗时 ${duration.toFixed(2)}ms`,
    );

    // 性能警告
    if (duration > 100) {
      console.warn(`[AttributeMapper] 批量同步耗时过长: ${duration.toFixed(2)}ms，建议优化`);
    }
  }
}
