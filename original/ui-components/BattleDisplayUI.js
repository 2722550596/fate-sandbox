// BattleDisplayUI.js - 来源: original.js

// === class BattleDisplayUI (行 7884-9116) ===

class BattleDisplayUI {
  constructor(battleUI) {
    this.battleUI = battleUI;
    this.battleManager = null;
    this.selectedSkill = null;
    this.selectedTargets = []; // 改为数组以支持多目标

    console.log("[BattleDisplayUI] 战斗显示UI已初始化");
  }

  /**
   * 渲染战斗界面
   */
  render(container, battleManager) {
    this.battleManager = battleManager;

    container.innerHTML = `
            <div class="battle-display-container" style="display: flex; flex-direction: column; gap: 15px; height: 100%;">
                <!-- 顶部：战斗日志（横躺条带） -->
                <div class="battle-log-area" style="background: var(--bg-panel); border: 1px solid var(--color-border-dark); border-radius: 8px; padding: 15px; display: flex; flex-direction: column; flex-shrink: 0;">
                    <h3 style="color: var(--color-primary); margin-bottom: 10px;">📜 战斗日志</h3>
                    <div id="battle-log-display" style="height: 140px; overflow-y: auto; font-size: var(--text-sm); line-height: 1.6;"></div>
                </div>
                
                <!-- 主区域：角色 + 操作 -->
                <div class="battle-main-area" style="display: flex; flex-direction: column; gap: 15px;">
                    <!-- 角色状态区 -->
                    <div class="battle-characters-area">
                        <h3 style="color: var(--color-success); margin-bottom: 10px;">🛡️ 盟友队伍</h3>
                        <div id="ally-characters-display" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;"></div>
                        
                        <h3 style="color: var(--color-danger); margin-bottom: 10px;">⚔️ 敌方队伍</h3>
                        <div id="enemy-characters-display" style="display: flex; gap: 10px; flex-wrap: wrap;"></div>
                    </div>
                    
                    <!-- 操作区 -->
                    <div class="battle-actions-area" style="background: var(--bg-panel); border: 1px solid var(--color-border-dark); border-radius: 8px; padding: 15px;">
                        <h3 style="color: var(--color-primary); margin-bottom: 10px;">🎯 当前行动</h3>
                        <div id="current-turn-info" style="margin-bottom: 15px; color: var(--text-main);"></div>
                        
                        <div id="skill-selection-area"></div>
                        <div id="target-selection-area"></div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button id="execute-action-btn" class="interaction-btn" style="background: var(--color-primary);" disabled>⚡ 执行行动</button>
                            <button id="end-round-btn" class="interaction-btn" style="background: var(--color-info);">⏭️ 结束回合</button>
                            <button id="end-battle-btn" class="interaction-btn" style="background: var(--color-danger);">🚪 结束战斗</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

    // 渲染初始状态
    this.renderCharacters();
    this.renderBattleLog();

    // 开始第一个行动（不调用executeNextTurn，直接渲染）
    this.renderCurrentTurn();

    // 绑定事件
    document.getElementById("execute-action-btn").onclick = () => this.executeAction();
    document.getElementById("end-round-btn").onclick = () => this.endRound();
    document.getElementById("end-battle-btn").onclick = () => this.endBattle();
  }

  /**
   * 渲染角色状态
   */
  renderCharacters() {
    const battleState = this.battleManager.getBattleState();

    // 渲染盟友
    const allyContainer = document.getElementById("ally-characters-display");
    if (allyContainer) {
      allyContainer.innerHTML = "";
      battleState.allyTeam.forEach((hero) => {
        const card = this.createCharacterCard(hero, "ally");
        allyContainer.appendChild(card);
      });
    }

    // 渲染敌方
    const enemyContainer = document.getElementById("enemy-characters-display");
    if (enemyContainer) {
      enemyContainer.innerHTML = "";
      battleState.enemyTeam.forEach((hero) => {
        const card = this.createCharacterCard(hero, "enemy");
        enemyContainer.appendChild(card);
      });
    }
  }

  /**
   * 创建角色卡片
   */
  createCharacterCard(heroStatus, team) {
    const card = document.createElement("div");
    card.className = "battle-character-card";
    card.dataset.heroName = heroStatus.name;
    card.dataset.team = team;

    const isAlive = heroStatus.currentVitality > 0;

    // 计算百分比
    const vitalityPercent = Math.max(
      0,
      Math.min(100, (heroStatus.currentVitality / heroStatus.maxVitality) * 100),
    );
    const agilityPercent = Math.max(
      0,
      Math.min(100, (heroStatus.currentAgility / heroStatus.maxAgility) * 100),
    );
    const spiritPercent = Math.max(
      0,
      Math.min(100, (heroStatus.currentSpirit / heroStatus.maxSpirit) * 100),
    );
    const sanityPercent = Math.max(
      0,
      Math.min(100, (heroStatus.currentSanity / heroStatus.maxSanity) * 100),
    );
    const humanityPercent = Math.max(
      0,
      Math.min(100, (heroStatus.currentHumanity / heroStatus.maxHumanity) * 100),
    );

    // 获取序列显示文本和CSS类
    const sequenceText =
      heroStatus.sequenceString ||
      (heroStatus.sequenceRank === 10 ? "普通人" : `序列${heroStatus.sequenceRank}`);
    const sequenceClass = getSequenceCssClass(heroStatus.sequenceRank);

    card.style.cssText = `
        background: var(--bg-panel);
        border: 2px solid ${team === "ally" ? "var(--color-success)" : "var(--color-danger)"};
        border-radius: 8px;
        padding: 10px;
        min-width: 180px;
        opacity: ${isAlive ? "1" : "0.5"};
        cursor: pointer;
        transition: all 0.2s ease;
    `;

    // 队伍标识
    const teamIcon = team === "ally" ? "🛡️" : "⚔️";
    const teamLabel = team === "ally" ? "友方" : "敌方";
    const teamColor = team === "ally" ? "var(--color-success)" : "var(--color-danger)";

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <div style="font-weight: bold; color: var(--color-primary);">
                ${heroStatus.name} ${isAlive ? "" : "💀"}
            </div>
            <div style="font-size: var(--text-xs); color: ${teamColor};" title="${teamLabel}">
                ${teamIcon}
            </div>
        </div>
        <div class="${sequenceClass}" style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 8px;">
            序列: ${sequenceText}
        </div>
        
        <!-- 活力 -->
        <div class="attribute-bar" style="margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
                <span style="color: var(--text-muted);">活力</span>
                <span style="color: var(--text-main);">${heroStatus.currentVitality}/${heroStatus.maxVitality} (${vitalityPercent.toFixed(0)}%)</span>
            </div>
            <div style="background: rgba(var(--rgb-danger), 0.2); height: 6px; border-radius: 3px; overflow: hidden; margin-top: 2px;">
                <div style="width: ${vitalityPercent}%; height: 100%; background: var(--color-success); transition: width 0.3s ease;"></div>
            </div>
        </div>
        
        <!-- 敏捷 -->
        <div class="attribute-bar" style="margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
                <span style="color: var(--text-muted);">敏捷</span>
                <span style="color: var(--text-main);">${heroStatus.currentAgility}/${heroStatus.maxAgility} (${agilityPercent.toFixed(0)}%)</span>
            </div>
            <div style="background: rgba(var(--rgb-primary), 0.2); height: 6px; border-radius: 3px; overflow: hidden; margin-top: 2px;">
                <div style="width: ${agilityPercent}%; height: 100%; background: var(--color-primary); transition: width 0.3s ease;"></div>
            </div>
        </div>
        
        <!-- 灵性 -->
        <div class="attribute-bar" style="margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
                <span style="color: var(--text-muted);">灵性</span>
                <span style="color: var(--text-main);">${heroStatus.currentSpirit}/${heroStatus.maxSpirit} (${spiritPercent.toFixed(0)}%)</span>
            </div>
            <div style="background: rgba(var(--rgb-primary), 0.2); height: 6px; border-radius: 3px; overflow: hidden; margin-top: 2px;">
                <div style="width: ${spiritPercent}%; height: 100%; background: #9b59b6; transition: width 0.3s ease;"></div>
            </div>
        </div>
        
        <!-- 理智 -->
        <div class="attribute-bar" style="margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
                <span style="color: var(--text-muted);">理智</span>
                <span style="color: var(--text-main);">${heroStatus.currentSanity}/${heroStatus.maxSanity} (${sanityPercent.toFixed(0)}%)</span>
            </div>
            <div style="background: rgba(var(--rgb-primary), 0.2); height: 6px; border-radius: 3px; overflow: hidden; margin-top: 2px;">
                <div style="width: ${sanityPercent}%; height: 100%; background: #3498db; transition: width 0.3s ease;"></div>
            </div>
        </div>
        
        <!-- 人性 -->
        <div class="attribute-bar" style="margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: var(--text-xs);">
                <span style="color: var(--text-muted);">人性</span>
                <span style="color: var(--text-main);">${heroStatus.currentHumanity}/${heroStatus.maxHumanity} (${humanityPercent.toFixed(0)}%)</span>
            </div>
            <div style="background: rgba(var(--rgb-primary), 0.2); height: 6px; border-radius: 3px; overflow: hidden; margin-top: 2px;">
                <div style="width: ${humanityPercent}%; height: 100%; background: #e74c3c; transition: width 0.3s ease;"></div>
            </div>
        </div>
        
        <!-- 运气 -->
        <div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 6px;">
            运气: <span style="color: var(--text-main);">${heroStatus.luck}</span>
        </div>
    `;

    // 添加效果显示区域
    if (heroStatus.effects && heroStatus.effects.length > 0) {
      const effectsHtml = this.renderEffects(heroStatus.effects);
      const effectsDiv = document.createElement("div");
      effectsDiv.style.cssText = `
            margin-top: 8px;
            padding: 6px;
            background: rgba(var(--rgb-magic), 0.1);
            border-radius: 4px;
            border: 1px solid rgba(var(--rgb-magic), 0.3);
        `;
      effectsDiv.innerHTML = effectsHtml;
      card.appendChild(effectsDiv);
    }

    // 点击选择目标
    if (isAlive) {
      card.onclick = () => this.selectTarget(heroStatus.name, team);
    }

    return card;
  }

  /**
   * 渲染效果列表（增强版：显示图标、颜色、剩余回合数和详情）
   * @param {Array} effects - 效果数组
   * @returns {string} HTML字符串
   */
  renderEffects(effects) {
    if (!effects || effects.length === 0) {
      return "";
    }

    const effectIcons = {
      poison: "🧪",
      regen: "💚",
      buff: "⬆️",
      debuff: "⬇️",
    };

    const effectColors = {
      poison: "#9b59b6",
      regen: "#2ecc71",
      buff: "#3498db",
      debuff: "#e74c3c",
    };

    let html =
      '<div style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 4px;">当前效果:</div>';

    effects.forEach((effect) => {
      const icon = effectIcons[effect.type] || "✨";
      const color = effectColors[effect.type] || "var(--color-magic)";

      // 构建效果详情文本（用于悬停显示）
      let detailText = `${effect.name}\\n`;
      detailText += `类型: ${effect.type === "buff" ? "Buff增益" : effect.type === "debuff" ? "Debuff减益" : effect.type}\\n`;

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
          damageDealtIncrease: "造成伤害提升",
          damageDealtDecrease: "造成伤害降低",
          damageTakenIncrease: "受到伤害提升",
          damageTakenDecrease: "受到伤害降低",
        };
        detailText += `影响属性: ${statNames[effect.stat] || effect.stat}\\n`;
      }

      if (effect.power !== undefined) {
        const valueTypeText = effect.valueType === "percentage" ? "%" : "点";
        const powerDisplay =
          effect.type === "buff"
            ? `+${effect.power}`
            : effect.type === "debuff"
              ? `-${effect.power}`
              : effect.power;
        detailText += `效果强度: ${powerDisplay}${valueTypeText}\\n`;
      }

      detailText += `剩余回合: ${effect.duration}`;

      html += `
                <div 
                    style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: var(--text-xs);
                        margin-bottom: 2px;
                        padding: 2px 4px;
                        background: rgba(var(--rgb-bg-dark), 0.3);
                        border-radius: 3px;
                        cursor: help;
                        transition: all 0.2s ease;
                    "
                    title="${detailText}"
                    onmouseover="this.style.background='rgba(var(--rgb-bg-dark), 0.5)'; this.style.transform='scale(1.02)';"
                    onmouseout="this.style.background='rgba(var(--rgb-bg-dark), 0.3)'; this.style.transform='scale(1)';"
                >
                    <span style="color: ${color};">
                        ${icon} ${effect.name}
                    </span>
                    <span style="
                        color: var(--text-muted);
                        background: rgba(var(--rgb-bg-dark), 0.5);
                        padding: 1px 4px;
                        border-radius: 2px;
                        font-weight: bold;
                    ">
                        ${effect.duration}回合
                    </span>
                </div>
            `;
    });

    return html;
  }

  /**
   * 渲染当前回合信息
   */
  renderCurrentTurn() {
    const turnInfo = this.battleManager.turnManager.getCurrentTurn();
    const infoContainer = document.getElementById("current-turn-info");

    if (!infoContainer) return;

    if (!turnInfo) {
      infoContainer.innerHTML = '<p style="color: var(--text-muted);">回合已结束</p>';
      return;
    }

    const hero = turnInfo.hero;

    // 🔥 新增：在渲染前先处理回合开始时触发的效果
    // 🔥 修复：无条件调用，确保状态效果能被检测和添加
    const effectResults = this.battleManager.turnManager.processCharacterEffects(
      hero,
      "turn_start",
    );
    const envEffectResults = this.battleManager.turnManager.processEnvironmentEffects(
      hero,
      "turn_start",
    );

    // 刷新角色显示（效果可能改变了活力）
    if (effectResults.length > 0 || envEffectResults.length > 0) {
      this.renderCharacters();
      this.renderBattleLog();
    }

    // 🔥 核心修复：在判断玩家/NPC之前，先检查角色是否死亡
    if (hero.additionalStats.当前活力 <= 0) {
      console.log(`[BattleDisplayUI] ${hero.name} 已死亡，自动跳过回合`);

      infoContainer.innerHTML = `
            <div style="background: rgba(var(--rgb-danger), 0.1); padding: 10px; border-radius: 6px;">
                <div style="font-size: var(--text-md); color: var(--color-danger);">
                    ${hero.name} 已无法战斗，跳过行动
                </div>
            </div>
        `;

      // 清空技能和目标选择区域
      const skillArea = document.getElementById("skill-selection-area");
      const targetArea = document.getElementById("target-selection-area");
      if (skillArea) skillArea.innerHTML = "";
      if (targetArea) targetArea.innerHTML = "";

      // 延迟后继续下一个回合（注意：executeNextTurn内部会自动增加索引）
      setTimeout(() => {
        const nextResult = this.battleManager.executeNextTurn();
        if (nextResult && nextResult.type === "battle_end") {
          this.showBattleResult();
        } else {
          this.renderCurrentTurn();
          this.renderCharacters();
          this.renderBattleLog();
        }
      }, 800);

      return;
    }

    const isNPC = hero.dataSource !== "player";

    if (isNPC) {
      infoContainer.innerHTML = `
            <div style="background: rgba(var(--rgb-info), 0.1); padding: 10px; border-radius: 6px;">
                <div style="font-size: var(--text-md); font-weight: bold; color: var(--color-info);">
                    ${hero.name} 的回合（AI控制）
                </div>
                <div style="font-size: var(--text-sm); color: var(--text-muted); margin-top: 5px;">
                    行动顺序: ${turnInfo.index + 1} / ${turnInfo.total}
                </div>
                <div style="font-size: var(--text-sm); color: var(--color-warning); margin-top: 5px;">
                    AI正在思考...
                </div>
            </div>
        `;

      const skillArea = document.getElementById("skill-selection-area");
      const targetArea = document.getElementById("target-selection-area");
      if (skillArea) skillArea.innerHTML = "";
      if (targetArea) targetArea.innerHTML = "";

      setTimeout(() => {
        this.executeAITurn(hero);
      }, 800);
    } else {
      infoContainer.innerHTML = `
            <div style="background: rgba(var(--rgb-primary), 0.1); padding: 10px; border-radius: 6px;">
                <div style="font-size: var(--text-md); font-weight: bold; color: var(--color-primary);">
                    ${hero.name} 的回合
                </div>
                <div style="font-size: var(--text-sm); color: var(--text-muted); margin-top: 5px;">
                    行动顺序: ${turnInfo.index + 1} / ${turnInfo.total}
                </div>
            </div>
        `;

      this.renderSkillSelection(hero);
    }
  }

  /**
   * 渲染技能选择
   */
  renderSkillSelection(hero) {
    const container = document.getElementById("skill-selection-area");
    if (!container) return;

    // 加载角色技能
    const skills = SkillLoader.loadSkillsFromCharacter(hero.originalData, hero.dataSource);

    // 🆕 过滤掉被动技能，只显示主动技能
    const activeSkills = skills.filter((skill) => !skill.isPassive);

    if (activeSkills.length === 0) {
      container.innerHTML =
        '<p style="color: var(--text-muted); margin-top: 10px;">该角色没有可用的主动技能</p>';
      return;
    }

    container.innerHTML =
      '<h4 style="color: var(--color-primary); margin: 15px 0 10px 0;">选择技能</h4>';

    const skillGrid = document.createElement("div");
    skillGrid.style.cssText =
      "display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;";

    activeSkills.forEach((skill) => {
      const skillCard = this.createSkillCard(skill, hero);
      skillGrid.appendChild(skillCard);
    });

    container.appendChild(skillGrid);
  }

  /**
   * 执行AI回合
   */
  executeAITurn(hero) {
    try {
      // 检查角色是否已死亡
      if (hero.additionalStats.当前活力 <= 0) {
        console.log(`[BattleDisplayUI] ${hero.name} 已死亡，跳过行动`);
        // 注意：不调用 skipCurrentTurn()，因为 executeNextTurn() 会自动处理

        setTimeout(() => {
          const nextResult = this.battleManager.executeNextTurn();
          if (nextResult && nextResult.type === "battle_end") {
            this.showBattleResult();
          } else {
            this.renderCurrentTurn();
            this.renderCharacters();
            this.renderBattleLog();
          }
        }, 500);
        return;
      }

      const skills = SkillLoader.loadSkillsFromCharacter(hero.originalData, hero.dataSource);

      if (skills.length === 0) {
        console.warn(`[BattleDisplayUI] AI角色 ${hero.name} 没有可用技能，跳过回合`);
        // 注意：不调用 skipCurrentTurn()，因为 executeNextTurn() 会自动处理

        setTimeout(() => {
          const nextResult = this.battleManager.executeNextTurn();
          if (nextResult && nextResult.type === "battle_end") {
            this.showBattleResult();
          } else {
            this.renderCurrentTurn();
            this.renderCharacters();
            this.renderBattleLog();
          }
        }, 500);
        return;
      }

      const action = this.battleManager.cpuManager.selectAction(
        hero,
        skills,
        this.battleManager.allyTeam,
        this.battleManager.enemyTeam,
      );

      if (!action) {
        console.warn(`[BattleDisplayUI] AI无法为 ${hero.name} 选择行动，跳过回合`);
        // 注意：不调用 skipCurrentTurn()，因为 executeNextTurn() 会自动处理

        setTimeout(() => {
          const nextResult = this.battleManager.executeNextTurn();
          if (nextResult && nextResult.type === "battle_end") {
            this.showBattleResult();
          } else {
            this.renderCurrentTurn();
            this.renderCharacters();
            this.renderBattleLog();
          }
        }, 500);
        return;
      }

      const result = this.battleManager.turnManager.executeAttack(
        hero,
        action.targets,
        action.skill,
      );

      // 🔥 新增：处理回合结束时触发的效果
      if (hero.effects && hero.effects.length > 0) {
        const turnEndEffects = hero.effects.filter((e) => e.triggerTiming === "turn_end");

        if (turnEndEffects.length > 0) {
          this.battleManager.turnManager.processCharacterEffects(hero, "turn_end");
          this.battleManager.turnManager.processEnvironmentEffects(hero, "turn_end");
        }
      }

      this.renderCharacters();
      this.renderBattleLog();

      setTimeout(() => {
        // 检查回合是否结束
        if (this.battleManager.turnManager.isRoundComplete()) {
          const roundResult = this.battleManager.endRound();
          if (roundResult.type === "battle_end") {
            this.showBattleResult();
            return;
          }
        }

        // 检查战斗是否结束
        if (this.battleManager.checkBattleEnd()) {
          this.battleManager.endBattle();
          this.showBattleResult();
          return;
        }

        const nextResult = this.battleManager.executeNextTurn();
        if (nextResult && nextResult.type === "battle_end") {
          this.showBattleResult();
        } else {
          this.renderCurrentTurn();
        }
      }, 1000);
    } catch (error) {
      console.error("[BattleDisplayUI] AI执行回合失败:", error);

      setTimeout(() => {
        // 检查回合是否结束
        if (this.battleManager.turnManager.isRoundComplete()) {
          const roundResult = this.battleManager.endRound();
          if (roundResult.type === "battle_end") {
            this.showBattleResult();
            return;
          }
        }

        // 检查战斗是否结束
        if (this.battleManager.checkBattleEnd()) {
          this.battleManager.endBattle();
          this.showBattleResult();
          return;
        }

        const nextResult = this.battleManager.executeNextTurn();
        if (nextResult && nextResult.type === "battle_end") {
          this.showBattleResult();
        } else {
          this.renderCurrentTurn();
          this.renderCharacters();
          this.renderBattleLog();
        }
      }, 500);
    }
  }

  /**
   * 创建技能卡片
   */
  createSkillCard(skill, hero) {
    const card = document.createElement("div");
    card.className = "skill-card";
    card.dataset.skillName = skill.name;

    const canUse = skill.canUse(hero);

    card.style.cssText = `
            background: var(--bg-panel);
            border: 2px solid var(--color-border-dark);
            border-radius: 6px;
            padding: 8px;
            cursor: ${canUse.canAfford ? "pointer" : "not-allowed"};
            opacity: ${canUse.canAfford ? "1" : "0.5"};
            transition: all 0.2s ease;
        `;

    const damageTypeColors = {
      physical: "var(--color-danger)",
      mystical: "var(--color-magic)",
      mental: "var(--color-info)",
      mixed: "var(--color-warning)",
    };

    card.innerHTML = `
            <div style="font-weight: bold; color: ${damageTypeColors[skill.damageType] || "var(--color-primary)"}; margin-bottom: 5px; font-size: var(--text-sm);">
                ${skill.name}
            </div>
            <div style="font-size: var(--text-xs); color: var(--text-muted);">
                威力: ${skill.getPower(hero)} | ${skill.damageType}
            </div>
            ${skill.cost ? `<div style="font-size: var(--text-xs); color: var(--text-subtle); margin-top: 3px;">消耗: ${skill.cost.amount} ${skill.cost.type}</div>` : ""}
            ${!canUse.canAfford ? `<div style="font-size: var(--text-xs); color: var(--color-danger); margin-top: 3px;">${canUse.message}</div>` : ""}
        `;

    if (canUse.canAfford) {
      card.onclick = () => this.selectSkill(skill);

      card.onmouseenter = () => {
        if (card.dataset.selected !== "true") {
          card.style.borderColor = "var(--color-primary)";
          card.style.transform = "translateY(-2px)";
        }
      };
      card.onmouseleave = () => {
        if (card.dataset.selected !== "true") {
          card.style.borderColor = "var(--color-border-dark)";
          card.style.transform = "translateY(0)";
        }
      };
    }

    return card;
  }

  /**
   * 选择技能（支持多目标）
   */
  selectSkill(skill) {
    this.selectedSkill = skill;
    this.selectedTargets = []; // 重置目标选择

    // 清除之前的目标高亮
    document.querySelectorAll(".battle-character-card").forEach((card) => {
      card.style.boxShadow = "none";
      card.dataset.selected = "false";
    });

    // 高亮选中的技能
    document.querySelectorAll(".skill-card").forEach((card) => {
      card.style.borderColor = "var(--color-border-dark)";
      card.dataset.selected = "false";
    });

    const selectedCard = document.querySelector(`[data-skill-name="${skill.name}"]`);
    if (selectedCard) {
      selectedCard.style.borderColor = "var(--color-primary)";
      selectedCard.style.boxShadow = "0 0 8px var(--color-primary)";
      selectedCard.dataset.selected = "true";
    }

    // 根据技能类型显示不同的提示
    const targetType = skill.targetType || "single";
    let promptText = "";

    switch (targetType) {
      case "single":
        promptText = "请点击一个敌方角色作为目标";
        break;
      case "multi":
        promptText = "请点击一个或多个敌方角色作为目标（可多选）";
        break;
      case "all":
      case "allEnemies":
        promptText = "该技能将攻击所有敌方角色（自动选择）";
        this.autoSelectAllEnemies();
        break;
      case "self":
        promptText = "该技能作用于自身（自动选择）";
        this.autoSelectSelf();
        break;
      case "ally":
        promptText = "请点击一个友方角色作为目标";
        break;
      case "allAlly":
      case "allAllies":
        promptText = "该技能将作用于所有友方角色（自动选择）";
        this.autoSelectAllAllies();
        break;
      default:
        promptText = "请选择目标";
    }

    // 显示目标选择提示
    const targetArea = document.getElementById("target-selection-area");
    if (targetArea) {
      targetArea.innerHTML = `
                <div style="margin-top: 15px; padding: 10px; background: rgba(var(--rgb-info), 0.1); border-radius: 6px; border: 1px solid var(--color-info);">
                    <p style="color: var(--color-info); margin: 0;">✓ 已选择技能: ${skill.name}</p>
                    <p style="color: var(--text-muted); font-size: var(--text-sm); margin: 5px 0 0 0;">${promptText}</p>
                    <div id="selected-targets-display" style="margin-top: 8px; font-size: var(--text-sm); color: var(--color-primary);"></div>
                </div>
            `;
    }

    console.log("[BattleDisplayUI] 已选择技能:", skill.name, "目标类型:", targetType);
  }

  /**
   * 选择目标（支持多目标）
   */
  selectTarget(heroName, team) {
    if (!this.selectedSkill) {
      console.warn("[BattleDisplayUI] 请先选择技能");
      return;
    }

    const currentTurn = this.battleManager.turnManager.getCurrentTurn();
    if (!currentTurn) return;

    const targetType = this.selectedSkill.targetType || "single";
    const attackerTeam = this.battleManager.teamManager.getHeroTeam(currentTurn.hero);

    // 验证目标队伍是否正确
    const isAllyTarget =
      targetType === "ally" ||
      targetType === "allAlly" ||
      targetType === "allAllies" ||
      targetType === "self";
    const isEnemyTarget =
      targetType === "single" ||
      targetType === "multi" ||
      targetType === "all" ||
      targetType === "allEnemies";
    const shouldBeAlly = isAllyTarget;
    const isAlly = team === attackerTeam;

    if (shouldBeAlly !== isAlly) {
      const message = shouldBeAlly ? "该技能只能作用于友方角色！" : "该技能只能作用于敌方角色！";
      if (this.battleUI.game && this.battleUI.game.showTemporaryMessage) {
        this.battleUI.game.showTemporaryMessage(message, 2000);
      } else {
        alert(message);
      }
      return;
    }

    // 根据目标类型处理选择
    if (targetType === "single" || targetType === "ally" || targetType === "self") {
      // 单目标：替换选择（包括ally和self类型）
      this.selectedTargets = [heroName];

      // 清除所有高亮
      document.querySelectorAll(".battle-character-card").forEach((card) => {
        card.style.boxShadow = "none";
        card.dataset.selected = "false";
      });

      // 高亮新选择的目标
      const targetCard = document.querySelector(`[data-hero-name="${heroName}"]`);
      if (targetCard) {
        targetCard.style.boxShadow = "0 0 12px var(--color-primary)";
        targetCard.dataset.selected = "true";
      }
    } else if (targetType === "multi" || targetType === "multiAlly") {
      // 多目标：切换选择（包括敌方多选和友方多选）
      const index = this.selectedTargets.indexOf(heroName);
      const targetCard = document.querySelector(`[data-hero-name="${heroName}"]`);

      if (index > -1) {
        // 取消选择
        this.selectedTargets.splice(index, 1);
        if (targetCard) {
          targetCard.style.boxShadow = "none";
          targetCard.dataset.selected = "false";
        }
      } else {
        // 添加选择
        this.selectedTargets.push(heroName);
        if (targetCard) {
          targetCard.style.boxShadow = "0 0 12px var(--color-primary)";
          targetCard.dataset.selected = "true";
        }
      }
    }

    // 更新选择显示
    this.updateTargetSelectionDisplay();

    // 启用/禁用执行按钮
    const executeBtn = document.getElementById("execute-action-btn");
    if (executeBtn) {
      executeBtn.disabled = this.selectedTargets.length === 0;
    }

    console.log("[BattleDisplayUI] 当前已选择目标:", this.selectedTargets);
  }

  /**
   * 更新目标选择显示
   */
  updateTargetSelectionDisplay() {
    const displayArea = document.getElementById("selected-targets-display");
    if (!displayArea) return;

    if (this.selectedTargets.length === 0) {
      displayArea.innerHTML = "";
      return;
    }

    const targetType = this.selectedSkill.targetType || "single";
    let displayText = "";

    if (targetType === "single") {
      displayText = `已选择目标: ${this.selectedTargets[0]}`;
    } else if (targetType === "multi") {
      displayText = `已选择 ${this.selectedTargets.length} 个目标: ${this.selectedTargets.join(", ")}`;
    } else {
      displayText = `已选择目标: ${this.selectedTargets.join(", ")}`;
    }

    displayArea.innerHTML = `<strong>${displayText}</strong>`;
  }

  /**
   * 自动选择所有敌方角色
   */
  autoSelectAllEnemies() {
    const currentTurn = this.battleManager.turnManager.getCurrentTurn();
    if (!currentTurn) return;

    const enemies = this.battleManager.getEnemyTeam(currentTurn.hero);
    this.selectedTargets = enemies.map((h) => h.name);

    // 高亮所有敌方角色
    document.querySelectorAll(".battle-character-card").forEach((card) => {
      const heroName = card.dataset.heroName;
      if (this.selectedTargets.includes(heroName)) {
        card.style.boxShadow = "0 0 12px var(--color-primary)";
        card.dataset.selected = "true";
      }
    });

    this.updateTargetSelectionDisplay();

    // 启用执行按钮
    const executeBtn = document.getElementById("execute-action-btn");
    if (executeBtn) {
      executeBtn.disabled = false;
    }
  }

  /**
   * 自动选择自身
   */
  autoSelectSelf() {
    const currentTurn = this.battleManager.turnManager.getCurrentTurn();
    if (!currentTurn) return;

    this.selectedTargets = [currentTurn.hero.name];

    // 高亮自身
    const targetCard = document.querySelector(`[data-hero-name="${currentTurn.hero.name}"]`);
    if (targetCard) {
      targetCard.style.boxShadow = "0 0 12px var(--color-primary)";
      targetCard.dataset.selected = "true";
    }

    this.updateTargetSelectionDisplay();

    // 启用执行按钮
    const executeBtn = document.getElementById("execute-action-btn");
    if (executeBtn) {
      executeBtn.disabled = false;
    }
  }

  /**
   * 自动选择所有友方角色
   */
  autoSelectAllAllies() {
    const currentTurn = this.battleManager.turnManager.getCurrentTurn();
    if (!currentTurn) return;

    const allies = this.battleManager.getAllyTeam(currentTurn.hero);
    this.selectedTargets = allies.map((h) => h.name);

    // 高亮所有友方角色
    document.querySelectorAll(".battle-character-card").forEach((card) => {
      const heroName = card.dataset.heroName;
      if (this.selectedTargets.includes(heroName)) {
        card.style.boxShadow = "0 0 12px var(--color-success)";
        card.dataset.selected = "true";
      }
    });

    this.updateTargetSelectionDisplay();

    // 启用执行按钮
    const executeBtn = document.getElementById("execute-action-btn");
    if (executeBtn) {
      executeBtn.disabled = false;
    }
  }

  /**
   * 执行行动（支持多目标）
   */
  executeAction() {
    if (!this.selectedSkill || this.selectedTargets.length === 0) {
      if (this.battleUI.game && this.battleUI.game.showTemporaryMessage) {
        this.battleUI.game.showTemporaryMessage("请先选择技能和目标！", 2000);
      } else {
        alert("请先选择技能和目标！");
      }
      return;
    }

    try {
      const currentTurn = this.battleManager.turnManager.getCurrentTurn();
      if (!currentTurn) {
        console.error("[BattleDisplayUI] 当前没有行动回合");
        return;
      }

      const attacker = currentTurn.hero;

      // 查找所有目标
      const targets = [];
      for (const targetName of this.selectedTargets) {
        const target = this.battleManager.teamManager.findHeroByName(targetName);
        if (target) {
          targets.push(target);
        } else {
          console.warn("[BattleDisplayUI] 未找到目标角色:", targetName);
        }
      }

      if (targets.length === 0) {
        console.error("[BattleDisplayUI] 没有有效的目标");
        return;
      }

      // 执行攻击（支持多目标）
      const result = this.battleManager.turnManager.executeAttack(
        attacker,
        targets,
        this.selectedSkill,
      );

      // 🔥 新增：处理回合结束时触发的效果
      if (attacker.effects && attacker.effects.length > 0) {
        const turnEndEffects = attacker.effects.filter((e) => e.triggerTiming === "turn_end");

        if (turnEndEffects.length > 0) {
          this.battleManager.turnManager.processCharacterEffects(attacker, "turn_end");
          this.battleManager.turnManager.processEnvironmentEffects(attacker, "turn_end");
        }
      }

      // 刷新界面
      this.renderCharacters();
      this.renderBattleLog();

      // 重置选择
      this.selectedSkill = null;
      this.selectedTargets = [];

      // 清除所有高亮
      document.querySelectorAll(".battle-character-card").forEach((card) => {
        card.style.boxShadow = "none";
        card.dataset.selected = "false";
      });

      const executeBtn = document.getElementById("execute-action-btn");
      if (executeBtn) {
        executeBtn.disabled = true;
      }

      // 清空选择区域
      const targetArea = document.getElementById("target-selection-area");
      if (targetArea) {
        targetArea.innerHTML = "";
      }

      // 执行下一个行动
      setTimeout(() => {
        // 检查回合是否结束
        if (this.battleManager.turnManager.isRoundComplete()) {
          const roundResult = this.battleManager.endRound();
          if (roundResult.type === "battle_end") {
            this.showBattleResult();
            return;
          }
        }

        // 检查战斗是否结束
        if (this.battleManager.checkBattleEnd()) {
          this.battleManager.endBattle();
          this.showBattleResult();
          return;
        }

        const nextResult = this.battleManager.executeNextTurn();
        if (nextResult && nextResult.type === "battle_end") {
          this.showBattleResult();
        } else {
          this.renderCurrentTurn();
        }
      }, 500);
    } catch (error) {
      console.error("[BattleDisplayUI] 执行行动失败:", error);
      if (this.battleUI.game && this.battleUI.game.showTemporaryMessage) {
        this.battleUI.game.showTemporaryMessage("执行行动失败：" + error.message, 3000);
      } else {
        alert("执行行动失败：" + error.message);
      }
    }
  }

  /**
   * 结束回合
   */
  endRound() {
    try {
      const result = this.battleManager.endRound();

      if (result.type === "battle_end") {
        this.showBattleResult();
      } else {
        // 回合结束但战斗未结束，显示询问界面
        this.showRoundEndPrompt();
      }
    } catch (error) {
      console.error("[BattleDisplayUI] 结束回合失败:", error);
    }
  }

  /**
   * 结束战斗
   */
  endBattle() {
    if (confirm("确定要结束战斗吗？")) {
      try {
        this.battleManager.endBattle();
        this.showBattleResult();
      } catch (error) {
        console.error("[BattleDisplayUI] 结束战斗失败:", error);
      }
    }
  }

  /**
   * 显示回合结束询问界面
   */
  showRoundEndPrompt() {
    const body = document.getElementById("battle-modal-body");
    if (!body) {
      console.error("[BattleDisplayUI] 未找到 battle-modal-body 元素");
      return;
    }

    body.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2 style="color: var(--color-primary); font-size: var(--text-xl); margin-bottom: 20px;">
                    ⏸️ 回合结束
                </h2>
                
                <div style="background: var(--bg-panel); border: 1px solid var(--color-border-dark); border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                    <p style="color: var(--text-main); font-size: var(--text-md); line-height: 1.8;">
                        当前回合已结束，您可以选择：
                    </p>
                    <ul style="color: var(--text-muted); font-size: var(--text-sm); text-align: left; margin: 15px 0; padding-left: 30px;">
                        <li style="margin: 8px 0;">输出战报：生成战斗简报到输入框，结束战斗</li>
                        <li style="margin: 8px 0;">继续战斗：开始下一回合</li>
                    </ul>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="output-report-btn" class="interaction-btn" style="background: var(--color-success); min-width: 150px;">
                        📝 输出战报
                    </button>
                    <button id="continue-battle-btn" class="interaction-btn" style="background: var(--color-primary); min-width: 150px;">
                        ⚔️ 继续战斗
                    </button>
                </div>
            </div>
        `;

    // 绑定按钮事件
    document.getElementById("output-report-btn").onclick = () => this.handleOutputReport();
    document.getElementById("continue-battle-btn").onclick = () => this.handleContinueBattle();
  }

  /**
   * 处理输出战报
   */
  handleOutputReport() {
    try {
      // 获取所有参战角色
      const allHeroes = [...this.battleManager.allyTeam, ...this.battleManager.enemyTeam];

      // 输出战报到输入框
      this.battleManager.battleReporter.outputToInputBox(allHeroes);

      console.log("[BattleDisplayUI] 战报已输出");
    } catch (error) {
      console.error("[BattleDisplayUI] 输出战报失败:", error);
      if (this.battleUI.game && this.battleUI.game.showTemporaryMessage) {
        this.battleUI.game.showTemporaryMessage("输出战报失败：" + error.message, 3000);
      } else {
        alert("输出战报失败：" + error.message);
      }
    }
  }

  /**
   * 处理继续战斗
   */
  handleContinueBattle() {
    try {
      // 重新渲染界面
      const body = document.getElementById("battle-modal-body");
      if (body) {
        this.render(body, this.battleManager);
      }

      console.log(
        "[BattleDisplayUI] 继续战斗，开始第 " + this.battleManager.currentRound + " 回合",
      );
    } catch (error) {
      console.error("[BattleDisplayUI] 继续战斗失败:", error);
      if (this.battleUI.game && this.battleUI.game.showTemporaryMessage) {
        this.battleUI.game.showTemporaryMessage("继续战斗失败：" + error.message, 3000);
      } else {
        alert("继续战斗失败：" + error.message);
      }
    }
  }

  /**
   * 显示战斗结果
   */
  showBattleResult() {
    const result = this.battleManager.battleResult;

    const body = document.getElementById("battle-modal-body");
    if (!body) {
      console.error("[BattleDisplayUI] 未找到 battle-modal-body 元素");
      return;
    }

    const resultEmoji =
      result.result === "victory" ? "🎉" : result.result === "defeat" ? "💀" : "⚔️";
    const resultText =
      result.result === "victory"
        ? "战斗胜利！"
        : result.result === "defeat"
          ? "战斗失败"
          : "战斗平局";
    const resultColor =
      result.result === "victory"
        ? "var(--color-success)"
        : result.result === "defeat"
          ? "var(--color-danger)"
          : "var(--color-warning)";

    body.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2 style="color: ${resultColor}; font-size: var(--text-xl); margin-bottom: 20px;">
                    ${resultEmoji} ${resultText}
                </h2>
                
                <div style="background: var(--bg-panel); border: 1px solid var(--color-border-dark); border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: left;">
                    <h3 style="color: var(--color-primary); margin-bottom: 15px; text-align: center;">战斗统计</h3>
                    <p style="color: var(--text-main); margin: 8px 0;">回合数: ${result.rounds}</p>
                    <p style="color: var(--text-main); margin: 8px 0;">造成伤害: ${result.statistics.totalDamageDealt}</p>
                    <p style="color: var(--text-main); margin: 8px 0;">承受伤害: ${result.statistics.totalDamageTaken}</p>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="generate-report-btn" class="interaction-btn" style="background: var(--color-success);">📝 生成战报</button>
                    <button class="interaction-btn" style="background: var(--color-primary);" onclick="if(window.battleUI) window.battleUI.closeModal();">关闭</button>
                </div>
            </div>
        `;

    // 绑定战报生成按钮事件
    const generateReportBtn = document.getElementById("generate-report-btn");
    if (generateReportBtn) {
      generateReportBtn.onclick = () => {
        try {
          const allHeroes = [...this.battleManager.allyTeam, ...this.battleManager.enemyTeam];
          this.battleManager.battleReporter.outputToInputBox(allHeroes);
        } catch (error) {
          console.error("[BattleDisplayUI] 生成战报失败:", error);
          if (this.battleUI.game && this.battleUI.game.showTemporaryMessage) {
            this.battleUI.game.showTemporaryMessage("生成战报失败：" + error.message, 3000);
          } else {
            alert("生成战报失败：" + error.message);
          }
        }
      };
    }
  }

  /**
   * 渲染战斗日志
   */
  renderBattleLog() {
    const container = document.getElementById("battle-log-display");
    if (!container) return;

    const logs = this.battleManager.battleLogger.getLogs();

    const typeColors = {
      system: "var(--text-muted)",
      attack: "var(--color-primary)",
      damage: "var(--color-danger)",
      victory: "var(--color-success)",
      defeat: "var(--color-danger)",
    };

    container.innerHTML = logs
      .map((log) => {
        return `<div style="color: ${typeColors[log.type] || "var(--text-main)"}; margin-bottom: 5px;">${log.message}</div>`;
      })
      .join("");

    // 自动滚动到底部
    container.scrollTop = container.scrollHeight;
  }
}
