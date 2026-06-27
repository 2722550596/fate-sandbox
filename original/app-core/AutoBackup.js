// 文件: AutoBackup.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L27018-27726: // =========定期自动备份设置保存与加载 ============== ---

// =========定期自动备份设置保存与加载 ==============
// 保存定期备份设置到存储
async savePeriodicBackupSettings() {
  try {
    await AppStorage.saveData(
      PERIODIC_BACKUP_KEYS.ENABLED,
      this.isPeriodicBackupEnabled,
    );
    await AppStorage.saveData(
      PERIODIC_BACKUP_KEYS.INTERVAL,
      this.periodicBackupInterval,
    );
    await AppStorage.saveData(
      PERIODIC_BACKUP_KEYS.TURN_COUNT,
      this.turnsSinceLastBackup,
    );
    console.log("[定期备份] 设置已保存");
  } catch (error) {
    console.error("[定期备份] 保存设置失败:", error);
  }
},
// 从存储加载定期备份设置
async loadPeriodicBackupSettings() {
  try {
    this.isPeriodicBackupEnabled = await AppStorage.loadData(
      PERIODIC_BACKUP_KEYS.ENABLED,
      false,
    );
    this.periodicBackupInterval = await AppStorage.loadData(
      PERIODIC_BACKUP_KEYS.INTERVAL,
      5,
    );
    this.turnsSinceLastBackup = await AppStorage.loadData(
      PERIODIC_BACKUP_KEYS.TURN_COUNT,
      0,
    );
    console.log(
      `[定期备份] 设置已加载 - 启用:${this.isPeriodicBackupEnabled}, 间隔:${this.periodicBackupInterval}回合, 当前计数:${this.turnsSinceLastBackup}`,
    );
  } catch (error) {
    console.error("[定期备份] 加载设置失败，使用默认值:", error);
    this.isPeriodicBackupEnabled = false;
    this.periodicBackupInterval = 5;
    this.turnsSinceLastBackup = 0;
  }
},
// 新版：创建定期自动备份（直接在快照打标签，抛弃独立存储）
async createPeriodicBackup() {
  if (this.chatHistoryCache.length === 0) return false;

  try {
    const latestIndex = this.chatHistoryCache.length - 1;
    const snapshot = this.chatHistoryCache[latestIndex];

    // 确保 meta 对象存在
    if (!snapshot.meta) snapshot.meta = {};

    // 🔴 核心：打上备份标签，并记录备份时间
    snapshot.meta.is_periodic_backup = true;
    snapshot.meta.backup_timestamp = new Date().toISOString();

    // 保存回本地
    await AppStorage.saveData(
      this._getHistoryKey(),
      this.chatHistoryCache,
    );

    console.log(
      "[定期备份] 备份标记创建成功，回合:",
      latestIndex + 1,
    );
    return true;
  } catch (error) {
    console.error("[定期备份] 创建备份失败:", error);
    return false;
  }
},
// 检查并执行定期备份（在每回合结束时调用）
async checkAndPerformPeriodicBackup() {
  // 未启用则跳过
  if (!this.isPeriodicBackupEnabled) {
    return;
  }

  // 增加回合计数
  this.turnsSinceLastBackup++;

  // 检查是否达到备份间隔
  if (this.turnsSinceLastBackup >= this.periodicBackupInterval) {
    console.log(
      `[定期备份] 已达${this.periodicBackupInterval}回合，执行备份...`,
    );

    const success = await this.createPeriodicBackup();
    if (success) {
      this.turnsSinceLastBackup = 0;
      this.showTemporaryMessage(
        `已自动备份（每${this.periodicBackupInterval}回合）`,
      );
    }
  }

  // 保存当前回合计数
  await AppStorage.saveData(
    PERIODIC_BACKUP_KEYS.TURN_COUNT,
    this.turnsSinceLastBackup,
  );
},
// 新版：加载定期备份（复用 jumpToHistory 顶级防线）
async loadPeriodicBackup() {
  try {
    // 倒序寻找最近的一个带备份标签的快照
    let targetIndex = -1;
    for (let i = this.chatHistoryCache.length - 1; i >= 0; i--) {
      if (this.chatHistoryCache[i].meta?.is_periodic_backup) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      this.showTemporaryMessage(
        "未在当前时间线中找到定期备份点。",
      );
      return false;
    }

    // 如果就在当前帧，不需要回滚
    if (targetIndex === this.chatHistoryCache.length - 1) {
      this.showTemporaryMessage("当前已经处于最新的定期备份点。");
      return true;
    }

    this.showTemporaryMessage("正在恢复自动备份...");
    console.log(
      `[定期备份] 找到备份点回合:${targetIndex + 1}，开始跃迁...`,
    );

    // 🔴 核心：直接复用我们的完美防线，所有脏活累活它全包了！
    await this.jumpToHistory(targetIndex);

    this.showTemporaryMessage(
      `已成功回退至第 ${targetIndex + 1} 回合的备份点。`,
    );
    return true;
  } catch (error) {
    console.error("[定期备份] 加载备份失败:", error);
    this.showTemporaryMessage("加载自动备份失败: " + error.message);
    return false;
  }
},
// 新版：渲染定期备份章节（用于时光手记界面）
async renderPeriodicBackupChapter() {
  // 找最近的备份点
  let backupSnap = null;
  let backupIndex = -1;
  for (let i = this.chatHistoryCache.length - 1; i >= 0; i--) {
    if (this.chatHistoryCache[i].meta?.is_periodic_backup) {
      backupSnap = this.chatHistoryCache[i];
      backupIndex = i;
      break;
    }
  }

  if (!backupSnap) {
    return /* HTML */ `
      <div
        class="chronicle-chapter periodic-backup-chapter"
        style="opacity: 0.6;"
      >
        <div class="chapter-header">
          <span class="chapter-icon">📦</span>
          <span class="chapter-title">定期自动备份</span>
        </div>
        <div
          class="chapter-meta"
          style="padding: 10px; color: var(--text-muted); font-size: var(--text-sm);"
        >
          当前时间线暂无定期备份
        </div>
      </div>
    `;
  }

  const timestamp = new Date(
    backupSnap.meta.backup_timestamp || backupSnap.timestamp,
  ).toLocaleString("zh-CN");
  const turnInfo = `第 ${backupIndex + 1} 回合`;
  const title = backupSnap.meta.title || "未命名节点";

  return /* HTML */ `
    <div class="chronicle-chapter periodic-backup-chapter">
      <div class="chapter-header">
        <span class="chapter-icon">📦</span>
        <span class="chapter-title">定期自动备份</span>
      </div>
      <div class="chapter-meta" style="padding: 10px;">
        <div
          style="color: var(--text-subtle); margin-bottom: 5px;"
        >
          ${title}
        </div>
        <div
          style="color: var(--text-muted); font-size: var(--text-xs);"
        >
          ${timestamp} | ${turnInfo}
        </div>
        <button
          id="btn-load-periodic-backup"
          class="interaction-btn"
          style="margin-top: 10px; padding: 6px 15px; font-size: var(--text-sm);"
        >
          加载此备份
        </button>
      </div>
    </div>
  `;
},
// 绑定定期备份加载按钮事件
bindPeriodicBackupListeners() {
  const loadBtn = document.getElementById("btn-load-periodic-backup");
  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      this.showConfirmModal(
        "确定要加载定期自动备份吗？当前未保存的进度将丢失。",
        async () => {
          await this.loadPeriodicBackup();
          this.closeModal("save-load-modal");
        },
      );
    });
  }
},
// 清理旧DOM的事件绑定（防止内存泄漏）
unbindSettingsModalListeners() {
  const body = document.getElementById("settings-modal-body");
  if (!body) return;

  // 1. 移除单个元素的事件（通过克隆元素实现快速解绑）
  const unbindElement = (selector) => {
    const el = body.querySelector(selector);
    if (el) {
      // 克隆元素会丢失所有事件绑定，替换原元素实现解绑
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
    }
  };

  // 2. 批量解绑所有设置项的元素（覆盖所有绑定过事件的控件）
  [
    "#background-select",
    "#font-select",
    "#btn-import-bg",
    "#btn-delete-bg",
    "#font-size-slider",
    "#font-size-input",
    "#width-slider",
    "#width-input",
    "#height-slider",
    "#height-input",
    "#fullscreen-layout-toggle",
    "#streaming-toggle-checkbox",
    "#fullscreen-loading-toggle-checkbox",
    "#danmaku-style-toggle-checkbox", // 弹幕风格开关
    "#floating-editor-toggle-checkbox", // 悬浮窗开关
    "#recent-events-input",
    "#btn-toggle-fullscreen",
    "#periodic-backup-toggle", // 定期备份开关
    "#periodic-backup-interval", // 定期备份间隔
    "#max-companion-slots-input", // 最大伙伴数量
    "#max-ssr-companions-input", // 最大SSR伙伴数量
    "#digestion-max-delta-input", // 消化进度单次变动上限
  ].forEach((selector) => unbindElement(selector));

  // 3. 重置绑定标记
  delete body.dataset.listenersBound;
},

//===========其他持久化配置============
//全屏加载、悬浮变量编辑器、保存事件等
//一般来说，其他组件下方都已经有持久化配置
async saveFullScreenLoadingState() {
  await AppStorage.saveData(
    "full_screen_loading_enabled",
    this.isFullScreenLoadingEnabled,
  );
},
async loadFullScreenLoadingState() {
  const savedState = await AppStorage.loadData(
    "full_screen_loading_enabled",
    false,
  );
  this.isFullScreenLoadingEnabled = savedState;
},
async saveFloatingEditorState() {
  await AppStorage.saveData(
    "floating_editor_enabled",
    this.isFloatingEditorEnabled,
  );
},
async loadFloatingEditorState() {
  const savedState = await AppStorage.loadData(
    "floating_editor_enabled",
    true,
  );
  this.isFloatingEditorEnabled = savedState;
},

// 三个按钮的存读档函数
async saveAiContextConfigState() {
  await AppStorage.saveData("ai_context_config_enabled", this.isAiContextConfigEnabled);
},
async loadAiContextConfigState() {
  this.isAiContextConfigEnabled = await AppStorage.loadData("ai_context_config_enabled", true);
},

async saveVariablePanelToggleState() {
  await AppStorage.saveData("variable_panel_toggle_enabled", this.isVariablePanelToggleEnabled);
},
async loadVariablePanelToggleState() {
  this.isVariablePanelToggleEnabled = await AppStorage.loadData("variable_panel_toggle_enabled", true);
},

async saveBattleFloatingBtnState() {
  await AppStorage.saveData("battle_floating_btn_enabled", this.isBattleFloatingBtnEnabled);
},
async loadBattleFloatingBtnState() {
  this.isBattleFloatingBtnEnabled = await AppStorage.loadData("battle_floating_btn_enabled", true);
},

async saveRecentEventsCount() {
  await AppStorage.saveData(
    "recent_events_count",
    this.recentEventsCount,
  );
},
async loadRecentEventsCount() {
  const savedCount = await AppStorage.loadData(
    "recent_events_count",
    30,
  );
  this.recentEventsCount = parseInt(savedCount, 10) || 30;
},
//弹幕
async saveDanmakuState() {
  await AppStorage.saveData(
    "danmaku_entries_enabled",
    this.isDanmakuEntriesEnabled,
  );
},
async loadDanmakuState() {
  // 弹幕风格加载（可根据需求调整）
  const savedState = await AppStorage.loadData(
    "danmaku_entries_enabled",
    false,
  );
  this.isDanmakuEntriesEnabled = savedState;
},
// 【新增】伙伴数量限制设置的保存和加载
async saveCompanionLimitSettings() {
  await AppStorage.saveData(
    "max_companion_slots",
    this.maxCompanionSlots,
  );
  await AppStorage.saveData(
    "max_ssr_companions",
    this.maxSSRCompanions,
  );
},
async loadCompanionLimitSettings() {
  const savedMaxSlots = await AppStorage.loadData(
    "max_companion_slots",
    3,
  );
  this.maxCompanionSlots = parseInt(savedMaxSlots, 10) || 3;

  const savedMaxSSR = await AppStorage.loadData(
    "max_ssr_companions",
    1,
  );
  this.maxSSRCompanions = parseInt(savedMaxSSR, 10) || 1;
},
// 【新增】消化进度单次变动上限的保存与加载
async saveDigestionMaxDelta() {
  await AppStorage.saveData(
    "digestion_max_delta",
    window.DIGESTION_MAX_DELTA ?? 3,
  );
},
async loadDigestionMaxDelta() {
  const saved = await AppStorage.loadData(
    "digestion_max_delta",
    3,
  );
  const num = parseInt(saved, 10);
  window.DIGESTION_MAX_DELTA = (!isNaN(num) && num >= 1) ? num : 3;
},
// 保存动画状态到本地存储
saveAnimationsState() {
  // 将布尔值转换为字符串保存
  localStorage.setItem(
    "guimi-animations-disabled",
    this.isAnimationsDisabled ? "true" : "false",
  );
},
// 从本地存储读取动画状态并应用
loadAnimationsState() {
  const savedState = localStorage.getItem(
    "guimi-animations-disabled",
  );
  if (savedState !== null) {
    // 将字符串转换回布尔值
    this.isAnimationsDisabled = savedState === "true";
  } else {
    // 如果没有找到记录，默认不禁用（保持特效开启）
    this.isAnimationsDisabled = false;
  }
  // 【关键】：不管结果是 true 还是 false，一加载就强制执行一次，让 DOM 状态和变量强行对齐！
  this.toggleSystemAnimations(this.isAnimationsDisabled);
},
// 保存控制台日志设置
saveConsoleState() {
  // 将布尔值转成字符串存起来
  localStorage.setItem(
    "sys_isConsoleDisabled",
    this.isConsoleDisabled,
  );
},
// 读取控制台日志设置并应用
loadConsoleState() {
  const savedState = localStorage.getItem("sys_isConsoleDisabled");
  // 如果之前存过，就严格判断是否等于 'true'；如果没存过，默认给 false（开启日志）
  this.isConsoleDisabled = savedState === "true";

  // 关键：刚进页面就执行！
  this.toggleConsoleLogs(this.isConsoleDisabled);
},
// 保存和加载流式传输设置
async saveStreamingState() {
  await AppStorage.saveData(
    "streaming_enabled",
    this.isStreamingEnabled,
  );
},
async loadStreamingState() {
  const savedState = await AppStorage.loadData(
    "streaming_enabled",
    true,
  );
  this.isStreamingEnabled = savedState;
},
// 从存储加载变量 AI 设置
async loadVariableAISettings() {
  try {
    this.varAiUseCustom = await AppStorage.loadData(this.VAR_AI_KEYS.USE_CUSTOM, false);
    this.varAiApiUrl = await AppStorage.loadData(this.VAR_AI_KEYS.API_URL, "https://api.openai.com/v1");
    this.varAiApiKey = await AppStorage.loadData(this.VAR_AI_KEYS.API_KEY, "");
    this.varAiModel = await AppStorage.loadData(this.VAR_AI_KEYS.MODEL, "gpt-4o-mini");
    console.log(`[变量AI设置] 加载成功 - 自定义:${this.varAiUseCustom}, 模型:${this.varAiModel}`);
  } catch (error) {
    console.error("[变量AI设置] 加载失败:", error);
  }
},
// 保存变量 AI 设置
async saveVariableAISettings() {
  try {
    await AppStorage.saveData(this.VAR_AI_KEYS.USE_CUSTOM, this.varAiUseCustom);
    await AppStorage.saveData(this.VAR_AI_KEYS.API_URL, this.varAiApiUrl);
    await AppStorage.saveData(this.VAR_AI_KEYS.API_KEY, this.varAiApiKey);
    await AppStorage.saveData(this.VAR_AI_KEYS.MODEL, this.varAiModel);
    this.showTemporaryMessage("已保存API设置");
  } catch (error) {
    this.showTemporaryMessage("API保存失败:", error);
  }
},
// 保存记忆分流设置到存储
async saveMemorySplitSettings() {
  try {
    await AppStorage.saveData(
      "memory_split_important_events",
      this.recentImportantEventsCount
    );
    await AppStorage.saveData(
      "memory_split_core_memory",
      this.isCoreMemoryImportant
    );
    console.log("[记忆系统] 分流设置已保存");
  } catch (error) {
    console.error("[记忆系统] 保存分流设置失败:", error);
  }
},
// 从存储加载记忆分流设置
async loadMemorySplitSettings() {
  try {
    // 默认保留最近 3 条作为高优事件
    this.recentImportantEventsCount = await AppStorage.loadData(
      "memory_split_important_events",
      3
    );
    // 默认开启核心记忆强扫描
    this.isCoreMemoryImportant = await AppStorage.loadData(
      "memory_split_core_memory",
      true
    );
    console.log(
      `[记忆系统] 分流设置已加载 - 高优近期事件:${this.recentImportantEventsCount}条, 核心记忆强扫描:${this.isCoreMemoryImportant}`
    );
  } catch (error) {
    console.error("[记忆系统] 加载分流设置失败，使用默认值:", error);
    this.recentImportantEventsCount = 3;
    this.isCoreMemoryImportant = true;
  }
},


//=========【已过时】函数===========
// 检测战斗状态并切换世界书和预设-可更新ling
async checkBattleStatusAndToggle(text) {
  if (!text) return;
  // 检测是否有【战斗状态表】
  const isBattle = text.includes("【战斗状态表】");

  //console.log(`我看看，[战斗状态检测] 检测到${isBattle ? '战斗' : '非战斗'}状态`);

  try {
    // 2. 切换世界书条目
    await this.toggleWorldbookEntries(isBattle);

    //console.log('[战斗状态检测] ok啊，世界书应该切换完成');
  } catch (error) {
    console.error(
      "[战斗状态检测] wc，又是什么bug啊，切换失败:",
      error,
    );
  }
},
// 切换【战斗】相关世界书条目
async toggleWorldbookEntries(isBattle) {
  try {
    // 获取当前角色卡绑定的主要世界书
    const charWorldbooks =
      window.TavernHelper.getCharWorldbookNames("current");
    const primaryWorldbook = charWorldbooks.primary;

    if (!primaryWorldbook) {
      console.warn(
        "[世界书切换] 当前角色卡未绑定主要世界书，你世界书哪呢？",
      );
      return;
    }

    //console.log(`[世界书切换] 正在处理世界书: ${primaryWorldbook}`);

    // 定义要切换的条目名称可更新-ling
    const battleEntry = "【判定】战斗";
    const nonBattleEntries = [
      "【世界】海洋环境",
      "【世界】神秘学基础",
      "【世界】灵性聚合",
      "【世界】简易年表（3.0版）",
    ];

    // 使用updateWorldbookWith来确保正确保存
    let changedCount = 0;
    await window.TavernHelper.updateWorldbookWith(
      primaryWorldbook,
      (worldbook) => {
        worldbook.forEach((entry) => {
          if (entry.name === battleEntry) {
            const oldState = entry.enabled;
            entry.enabled = isBattle; // 战斗时开启,非战斗时关闭
            if (oldState !== entry.enabled) {
              console.log(
                `[世界书切换] ${entry.name}: ${oldState ? "开启" : "关闭"} -> ${entry.enabled ? "开启" : "关闭"}`,
              );
              changedCount++;
            }
          } else if (nonBattleEntries.includes(entry.name)) {
            const oldState = entry.enabled;
            entry.enabled = !isBattle; // 战斗时关闭,非战斗时开启
            if (oldState !== entry.enabled) {
              console.log(
                `[世界书切换] ${entry.name}: ${oldState ? "开启" : "关闭"} -> ${entry.enabled ? "开启" : "关闭"}`,
              );
              changedCount++;
            }
          }
        });
        return worldbook;
      },
      { render: "immediate" },
    );

    if (changedCount > 0) {
      console.log(
        `[世界书切换] 世界书条目已更新,共修改 ${changedCount} 个条目`,
      );
    } else {
      //console.log('[世界书切换] 所有条目状态已是目标状态,无需修改');
    }
  } catch (error) {
    console.error("[世界书切换] 切换失败:", error);
    throw error;
  }
},
//自动切换不同周目的世界书
async updateAutoToggledEntries(andDisableAll = false) {
  const bookName = WorldbookManager.PRIMARY_BOOK;
  const index = this.unifiedIndex;
  const journeyKey =
    index > 1 ? `本周目经历(${index})` : "本周目经历";
  const pastLivesKey =
    index > 1 ? `历史的投影(${index})` : "历史的投影";
  try {
    let allEntries =
      await TavernHelper.getLorebookEntries(bookName);
    const entriesToCreate = [];
    const targetJourneyEntry = allEntries.find(
      (e) => e.comment === journeyKey,
    );
    if (!targetJourneyEntry) {
      const baseTemplate = allEntries.find(
        (e) => e.comment === "本周目经历",
      );
      if (baseTemplate) {
        const newJourneyEntry = { ...baseTemplate };
        delete newJourneyEntry.uid;
        newJourneyEntry.comment = journeyKey;
        newJourneyEntry.content = "";
        newJourneyEntry.keys = [
          ...(baseTemplate.keys || []),
          journeyKey,
        ];
        newJourneyEntry.enabled = true;
        newJourneyEntry.position =
          "before_character_definition";
        newJourneyEntry.order = 20;
        entriesToCreate.push(newJourneyEntry);
      }
    }
    const targetPastLivesEntry = allEntries.find(
      (e) => e.comment === pastLivesKey,
    );
    if (!targetPastLivesEntry) {
      const baseTemplate = allEntries.find(
        (e) => e.comment === "历史的投影",
      );
      if (baseTemplate) {
        const newPastLivesEntry = { ...baseTemplate };
        delete newPastLivesEntry.uid;
        newPastLivesEntry.comment = pastLivesKey;
        newPastLivesEntry.content = "";
        newPastLivesEntry.keys = [
          ...(baseTemplate.keys || []),
          pastLivesKey,
        ];
        newPastLivesEntry.enabled = true;
        newPastLivesEntry.position =
          "before_character_definition";
        newPastLivesEntry.order = 19;
        entriesToCreate.push(newPastLivesEntry);
      }
    }
    if (entriesToCreate.length > 0) {
      await TavernHelper.createLorebookEntries(
        bookName,
        entriesToCreate,
      );
      console.log(
        `[源堡自动开关] 已自动创建 ${entriesToCreate.length} 个新世界书条目。`,
      );
      allEntries =
        await TavernHelper.getLorebookEntries(bookName);
    }
    const entriesToUpdate = [];
    for (const entry of allEntries) {
      const isJourneyEntry =
        entry.comment.startsWith("本周目经历");
      const isPastLivesEntry =
        entry.comment.startsWith("历史的投影");
      if (!isJourneyEntry && !isPastLivesEntry) continue;
      const isTarget =
        entry.comment === journeyKey ||
        entry.comment === pastLivesKey;
      const shouldBeEnabled = isTarget && !andDisableAll;
      if (entry.enabled !== shouldBeEnabled) {
        entriesToUpdate.push({
          uid: entry.uid,
          enabled: shouldBeEnabled,
        });
      }
    }
    if (entriesToUpdate.length > 0) {
      await TavernHelper.setLorebookEntries(
        bookName,
        entriesToUpdate,
      );
      console.log(
        `[源堡自动开关] 更新了 ${entriesToUpdate.length} 个世界书条目状态。`,
      );
    }
  } catch (error) {
    console.error(
      "[源堡自动开关] 更新世界书条目状态时出错:",
      error,
    );
  }
},


