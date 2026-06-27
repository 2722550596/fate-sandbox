// TeamBuilderUI.js - 来源: original.js

// === class TeamBuilderUI (行 7428-7874) ===

class TeamBuilderUI {
  constructor(battleUI) {
    this.battleUI = battleUI;
    this.allyTeam = [];
    this.enemyTeam = [];
    this.availableCharacters = [];

    console.log("[TeamBuilderUI] 队伍组建UI已初始化");
  }

  /**
   * 渲染队伍组建界面
   */
  render(container) {
    container.innerHTML = `
            <div class="team-builder-container" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                <!-- 可用角色列表 -->
                <div class="available-characters-panel">
                    <h3 style="color: var(--color-primary); margin-bottom: 15px;">📋 可用角色</h3>
                    <div id="available-characters-list" style="max-height: 500px; overflow-y: auto;"></div>
                </div>
                
                <!-- 盟友队伍 -->
                <div class="ally-team-panel">
                    <h3 style="color: var(--color-success); margin-bottom: 15px;">🛡️ 盟友队伍</h3>
                    <div id="ally-team-list" style="min-height: 200px; max-height: 500px; overflow-y: auto; border: 2px dashed var(--color-success); border-radius: 8px; padding: 10px;"></div>
                </div>
                
                <!-- 敌方队伍 -->
                <div class="enemy-team-panel">
                    <h3 style="color: var(--color-danger); margin-bottom: 15px;">⚔️ 敌方队伍</h3>
                    <div id="enemy-team-list" style="min-height: 200px; max-height: 500px; overflow-y: auto; border: 2px dashed var(--color-danger); border-radius: 8px; padding: 10px;"></div>
                </div>
            </div>
            
            <!-- 操作按钮 -->
            <div style="display: flex; justify-content: center; gap: 15px; margin-top: 20px;">
                <button id="clear-teams-btn" class="interaction-btn warn-btn">🗑️ 清空所有队伍</button>
                <button id="start-battle-btn" class="interaction-btn primary-btn">⚔️ 开始战斗</button>
            </div>
        `;

    // 加载可用角色
    this.loadAvailableCharacters();

    // 加载保存的队伍配置
    this.loadTeamComposition();

    // 渲染角色列表
    this.renderAvailableCharacters();
    this.renderTeamLists();

    // 绑定事件
    document.getElementById("clear-teams-btn").onclick = () => this.clearAllTeams();
    document.getElementById("start-battle-btn").onclick = async () => {
      try {
        await this.startBattle();
      } catch (error) {
        console.error("[BattleSetupUI] 开始战斗失败:", error);
        if (this.battleUI.game && this.battleUI.game.showTemporaryMessage) {
          this.battleUI.game.showTemporaryMessage("战斗初始化失败：" + error.message, 3000);
        }
      }
    };
  }

  /**
   * 加载可用角色
   */
  loadAvailableCharacters() {
    this.availableCharacters = [];
    const currentMvuState = this.battleUI.currentMvuState;

    if (!currentMvuState) {
      console.warn("[TeamBuilderUI] currentMvuState 不存在");
      return;
    }

    // 添加玩家角色
    if (currentMvuState.stat_data) {
      this.availableCharacters.push({
        name: "<User>",
        dataSource: "player",
        data: currentMvuState.stat_data,
      });
    }

    // 添加NPC角色
    if (currentMvuState.npc_data) {
      Object.keys(currentMvuState.npc_data).forEach((npcName) => {
        this.availableCharacters.push({
          name: npcName,
          dataSource: "npc",
          data: currentMvuState.npc_data[npcName],
        });
      });
    }

    console.log(`[TeamBuilderUI] 加载了 ${this.availableCharacters.length} 个可用角色`);
  }

  /**
   * 渲染可用角色列表
   */
  renderAvailableCharacters() {
    const container = document.getElementById("available-characters-list");
    if (!container) return;

    container.innerHTML = "";

    if (this.availableCharacters.length === 0) {
      container.innerHTML =
        '<div style="text-align: center; color: var(--text-muted); padding: 20px;">暂无可用角色</div>';
      return;
    }

    this.availableCharacters.forEach((char) => {
      const card = this.createCharacterCard(char);
      container.appendChild(card);
    });
  }

  /**
   * 创建角色卡片
   */
  createCharacterCard(character) {
    const card = document.createElement("div");
    card.className = "character-card";
    card.style.cssText = `
            background: var(--bg-panel);
            border: 1px solid var(--color-border-dark);
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
        `;

    const data = character.data;
    const isAssigned = this.isCharacterAssigned(character.name);

    // 获取序列等级和对应的 CSS 类
    const sequenceRank = parseSequenceRank(data.当前序列);
    const sequenceText = sequenceRank === 10 ? "普通人" : `序列${sequenceRank}`;
    const sequenceClass = getSequenceCssClass(sequenceRank);

    // 计算百分比
    const vitalityPercent = ((data.当前活力 / data.活力) * 100).toFixed(0);
    const agilityPercent = ((data.当前敏捷 / data.敏捷) * 100).toFixed(0);
    const spiritPercent = ((data.当前灵性 / data.灵性) * 100).toFixed(0);
    const sanityPercent = ((data.当前理智 / data.理智) * 100).toFixed(0);
    const humanityPercent = ((data.当前人性 / data.人性) * 100).toFixed(0);

    card.innerHTML = `
    <div class="character-name" style="font-weight: bold; color: var(--color-primary); margin-bottom: 5px;">
        ${character.name} ${isAssigned ? "✓" : ""}
    </div>
    <div class="character-sequence ${sequenceClass}" style="font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">
        ${sequenceText}
    </div>
    <div class="character-stats" style="font-size: 11px; color: var(--text-muted); line-height: 1.5;">
        活力: ${data.当前活力}/${data.活力} (${vitalityPercent}%)<br>
        敏捷: ${data.当前敏捷}/${data.敏捷} (${agilityPercent}%)<br>
        灵性: ${data.当前灵性}/${data.灵性} (${spiritPercent}%)<br>
        理智: ${data.当前理智}/${data.理智} (${sanityPercent}%)<br>
        人性: ${data.当前人性}/${data.人性} (${humanityPercent}%)<br>
        运气: ${data.运气}
    </div>
    <div style="display: flex; gap: 5px; margin-top: 8px;">
        <button class="add-to-ally-btn" style="flex: 1; font-size: 11px; padding: 4px 8px; background: var(--color-success); color: white; border: none; border-radius: 4px; cursor: pointer;">➕ 盟友</button>
        <button class="add-to-enemy-btn" style="flex: 1; font-size: 11px; padding: 4px 8px; background: var(--color-danger); color: white; border: none; border-radius: 4px; cursor: pointer;">➕ 敌方</button>
    </div>
`;

    // 绑定添加按钮事件
    card.querySelector(".add-to-ally-btn").onclick = (e) => {
      e.stopPropagation();
      this.addToTeam(character, "ally");
    };

    card.querySelector(".add-to-enemy-btn").onclick = (e) => {
      e.stopPropagation();
      this.addToTeam(character, "enemy");
    };

    // 悬停效果
    card.onmouseenter = () => {
      card.style.borderColor = "var(--color-primary)";
      card.style.transform = "translateY(-2px)";
    };
    card.onmouseleave = () => {
      card.style.borderColor = "var(--color-border-dark)";
      card.style.transform = "translateY(0)";
    };

    return card;
  }

  /**
   * 检查角色是否已分配
   */
  isCharacterAssigned(name) {
    return (
      this.allyTeam.some((c) => c.name === name) || this.enemyTeam.some((c) => c.name === name)
    );
  }

  /**
   * 添加到队伍
   */
  addToTeam(character, team) {
    // 检查是否已在其他队伍
    if (this.isCharacterAssigned(character.name)) {
      if (this.battleUI.game && this.battleUI.game.showTemporaryMessage) {
        this.battleUI.game.showTemporaryMessage(`${character.name} 已在队伍中！`, 2000);
      } else {
        alert(`${character.name} 已在队伍中！`);
      }
      return;
    }

    if (team === "ally") {
      this.allyTeam.push(character);
    } else {
      this.enemyTeam.push(character);
    }

    // 保存并刷新
    this.saveTeamComposition();
    this.renderAvailableCharacters();
    this.renderTeamLists();
  }

  /**
   * 从队伍移除
   */
  removeFromTeam(character, team) {
    if (team === "ally") {
      this.allyTeam = this.allyTeam.filter((c) => c.name !== character.name);
    } else {
      this.enemyTeam = this.enemyTeam.filter((c) => c.name !== character.name);
    }

    // 保存并刷新
    this.saveTeamComposition();
    this.renderAvailableCharacters();
    this.renderTeamLists();
  }

  /**
   * 渲染队伍列表
   */
  renderTeamLists() {
    // 渲染盟友队伍
    const allyContainer = document.getElementById("ally-team-list");
    if (allyContainer) {
      allyContainer.innerHTML =
        this.allyTeam.length === 0
          ? '<div style="text-align: center; color: var(--text-muted); padding: 20px;">暂无成员</div>'
          : "";

      this.allyTeam.forEach((char) => {
        const item = this.createTeamMemberItem(char, "ally");
        allyContainer.appendChild(item);
      });
    }

    // 渲染敌方队伍
    const enemyContainer = document.getElementById("enemy-team-list");
    if (enemyContainer) {
      enemyContainer.innerHTML =
        this.enemyTeam.length === 0
          ? '<div style="text-align: center; color: var(--text-muted); padding: 20px;">暂无成员</div>'
          : "";

      this.enemyTeam.forEach((char) => {
        const item = this.createTeamMemberItem(char, "enemy");
        enemyContainer.appendChild(item);
      });
    }
  }

  /**
   * 创建队伍成员项
   */
  createTeamMemberItem(character, team) {
    const item = document.createElement("div");
    item.style.cssText = `
            background: rgba(var(--rgb-panel-dark), 0.5);
            border: 1px solid var(--color-border-dark);
            border-radius: 6px;
            padding: 8px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

    // 🔥 关键修复：从currentMvuState获取最新数据，而不是使用缓存的character.data
    let data = character.data;
    const currentMvuState = this.battleUI.currentMvuState;
    if (currentMvuState) {
      if (character.dataSource === "player" && currentMvuState.stat_data) {
        data = currentMvuState.stat_data;
      } else if (
        character.dataSource === "npc" &&
        currentMvuState.npc_data &&
        currentMvuState.npc_data[character.name]
      ) {
        data = currentMvuState.npc_data[character.name];
      }
    }

    const sequenceRank = parseSequenceRank(data.当前序列);
    const sequenceText = sequenceRank === 10 ? "普通人" : `序列${sequenceRank}`;
    const sequenceClass = getSequenceCssClass(sequenceRank);

    item.innerHTML = `
    <div style="flex: 1;">
        <div style="font-weight: bold; color: var(--color-primary);">${character.name}</div>
        <div class="${sequenceClass}" style="font-size: 10px; color: var(--text-muted); margin: 2px 0;">
            ${sequenceText}
        </div>
        <div style="font-size: 10px; color: var(--text-muted); line-height: 1.4;">
            活力: ${data.当前活力}/${data.活力} | 
            灵性: ${data.当前灵性}/${data.灵性}<br>
            理智: ${data.当前理智}/${data.理智} | 
            运气: ${data.运气}
        </div>
    </div>
    <button class="remove-btn" style="padding: 4px 8px; font-size: 11px; background: var(--color-danger); color: white; border: none; border-radius: 4px; cursor: pointer;">✕ 移除</button>
`;

    item.querySelector(".remove-btn").onclick = () => this.removeFromTeam(character, team);

    return item;
  }

  /**
   * 清空所有队伍
   */
  clearAllTeams() {
    if (this.allyTeam.length === 0 && this.enemyTeam.length === 0) {
      return;
    }

    if (confirm("确定要清空所有队伍吗？")) {
      this.allyTeam = [];
      this.enemyTeam = [];
      this.saveTeamComposition();
      this.renderAvailableCharacters();
      this.renderTeamLists();
    }
  }

  /**
   * 开始战斗
   */
  async startBattle() {
    // 验证队伍
    if (this.allyTeam.length === 0) {
      if (this.battleUI.game && this.battleUI.game.showTemporaryMessage) {
        this.battleUI.game.showTemporaryMessage("盟友队伍不能为空！", 2000);
      } else {
        alert("盟友队伍不能为空！");
      }
      return;
    }

    if (this.enemyTeam.length === 0) {
      if (this.battleUI.game && this.battleUI.game.showTemporaryMessage) {
        this.battleUI.game.showTemporaryMessage("敌方队伍不能为空！", 2000);
      } else {
        alert("敌方队伍不能为空！");
      }
      return;
    }

    try {
      // 创建战斗配置
      const battleConfig = {
        currentMvuState: this.battleUI.currentMvuState,
        allyTeam: this.allyTeam,
        enemyTeam: this.enemyTeam,
      };

      // 创建战斗管理器
      const battleManager = new BattleManager(battleConfig);
      await battleManager.startBattle(); // 🆕 改为await调用

      // 切换到战斗界面
      this.battleUI.showBattleDisplay(battleManager);
    } catch (error) {
      console.error("[TeamBuilderUI] 开始战斗失败:", error);
      if (this.battleUI.game && this.battleUI.game.showTemporaryMessage) {
        this.battleUI.game.showTemporaryMessage("战斗初始化失败：" + error.message, 3000);
      } else {
        alert("战斗初始化失败：" + error.message);
      }
    }
  }

  /**
   * 保存队伍配置
   */
  saveTeamComposition() {
    const composition = {
      allyTeam: this.allyTeam.map((c) => ({ name: c.name, dataSource: c.dataSource })),
      enemyTeam: this.enemyTeam.map((c) => ({ name: c.name, dataSource: c.dataSource })),
    };

    localStorage.setItem("battle-team-composition", JSON.stringify(composition));
  }

  /**
   * 加载队伍配置
   */
  loadTeamComposition() {
    const saved = localStorage.getItem("battle-team-composition");
    if (!saved) return;

    try {
      const composition = JSON.parse(saved);

      // 根据保存的配置恢复队伍
      if (composition.allyTeam) {
        composition.allyTeam.forEach((savedChar) => {
          const char = this.availableCharacters.find(
            (c) => c.name === savedChar.name && c.dataSource === savedChar.dataSource,
          );
          if (char && !this.isCharacterAssigned(char.name)) {
            this.allyTeam.push(char);
          }
        });
      }

      if (composition.enemyTeam) {
        composition.enemyTeam.forEach((savedChar) => {
          const char = this.availableCharacters.find(
            (c) => c.name === savedChar.name && c.dataSource === savedChar.dataSource,
          );
          if (char && !this.isCharacterAssigned(char.name)) {
            this.enemyTeam.push(char);
          }
        });
      }

      console.log("[TeamBuilderUI] 队伍配置已加载");
    } catch (e) {
      console.warn("[TeamBuilderUI] 加载队伍配置失败:", e);
    }
  }
}
