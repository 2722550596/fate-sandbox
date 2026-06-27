// 文件: TimelineJourney.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L27727-28023: // ========================================== ---

// ==========================================
// === [历史记录/时间旅行] TIMELINE & JOURNEY ===
// ==========================================
// 职责：历史回溯、分支处理、世界书修剪、内容写入

//读取存档中所有历史记录
async loadHistoryFromStorage() {
  console.log(
    `%c[TRACE-HISTORY] >>>>> START. chatHistoryCache 长度 BEFORE: ${this.chatHistoryCache.length}`,
    "color: red; font-weight: bold;",
  );
  const historyKey = this._getHistoryKey(); // 获取原始键（如 frontend_chat_history_fallback）
  const isGlobalFallback =
    historyKey === "frontend_chat_history_fallback";

  if (isGlobalFallback) {
    // 步骤1：优先读取独立快照（依赖AppStorage自动加前缀，无需手动拼接）
    let storedSnapshots = [];
    try {
      // 直接传原始key，AppStorage内部会自动添加SEFIROT_CASTLE_REVISION_前缀
      storedSnapshots = await AppStorage.loadData(historyKey, []);
      console.log(
        `[历史系统] 从独立快照键（${historyKey}）读取到数据，原始长度: ${storedSnapshots.length}`,
      );
    } catch (e) {
      console.error(`[历史系统] 读取独立快照失败:`, e);
    }

    // 验证独立快照有效性（必须是数组且有数据）
    if (
      Array.isArray(storedSnapshots) &&
      storedSnapshots.length > 0
    ) {
      this.chatHistoryCache = storedSnapshots;
      this.historyViewIndex = this.chatHistoryCache.length - 1;
      this.isHistoryViewMode = false;
      console.log(
        `[历史系统] 独立快照加载成功，缓存长度: ${this.chatHistoryCache.length}`,
      );
      console.log(
        `%c[TRACE-HISTORY] <<<<< END. chatHistoryCache 长度 AFTER: ${this.chatHistoryCache.length}`,
        "color: red; font-weight: bold;",
      );
      // 🔴 核心修改：等待旧数据洗澡升级，然后全量构建目录
      await this._migrateSnapshotMeta();
      this.buildTimelineDirectory();
      return;
    }

    // 步骤2：独立快照无效时，读取multi_save_data中的归档
    try {
      const allSaves = await this.getSavesFromStorage(); // 注意：getSavesFromStorage需异步（见之前优化点）
      const validSaves = [];

      // 筛选有有效timeline_history的归档
      Object.values(allSaves).forEach((save) => {
        if (
          save?.timeline_history &&
          Array.isArray(save.timeline_history) &&
          save.timeline_history.length > 0
        ) {
          validSaves.push(save);
        }
      });

      if (validSaves.length > 0) {
        // 按时间排序，取最新归档
        validSaves.sort(
          (a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp),
        );
        const latestSave = validSaves[0];
        this.chatHistoryCache = latestSave.timeline_history;
        this.historyViewIndex =
          this.chatHistoryCache.length - 1;
        this.isHistoryViewMode = false;
        console.log(
          `[历史系统] 从归档（${latestSave.save_name}）加载快照，缓存长度: ${this.chatHistoryCache.length}`,
        );
        console.log(
          `%c[TRACE-HISTORY] <<<<< END. chatHistoryCache 长度 AFTER: ${this.chatHistoryCache.length}`,
          "color: red; font-weight: bold;",
        );
        // 🔴 核心修改：等待旧数据洗澡升级，然后全量构建目录
        await this._migrateSnapshotMeta();
        this.buildTimelineDirectory();
        return;
      }
    } catch (e) {
      console.error(`[历史系统] 读取归档失败:`, e);
    }

    // 步骤3：无任何数据（全新会话）
    this.chatHistoryCache = [];
    console.log("[历史系统] 无任何快照或归档（全新会话）");
    console.log(
      `%c[TRACE-HISTORY] <<<<< END. chatHistoryCache 长度 AFTER: 0`,
      "color: red; font-weight: bold;",
    );
    // 🔴 核心修改：等待旧数据洗澡升级，然后全量构建目录
    await this._migrateSnapshotMeta();
    this.buildTimelineDirectory();
    return;
  }

  // 非全局备用键场景（正常会话）：直接读取原始key（AppStorage自动加前缀）
  try {
    const storedHistory = await AppStorage.loadData(historyKey, []);
    if (Array.isArray(storedHistory)) {
      this.chatHistoryCache = storedHistory;
      console.log(
        `[历史系统] 从键（${historyKey}）加载到 ${this.chatHistoryCache.length} 条历史记录`,
      );
    } else {
      this.chatHistoryCache = [];
      console.log(
        `[历史系统] 键（${historyKey}）数据无效，初始化为空`,
      );
    }
  } catch (e) {
    this.chatHistoryCache = [];
    console.error(`[历史系统] 读取键（${historyKey}）失败:`, e);
  }

  this.historyViewIndex =
    this.chatHistoryCache.length > 0
      ? this.chatHistoryCache.length - 1
      : 0;
  this.isHistoryViewMode = false;

  // 🔴 核心修改：等待旧数据洗澡升级，然后全量构建目录
  await this._migrateSnapshotMeta();
  this.buildTimelineDirectory();

  console.log(
    `%c[TRACE-HISTORY] <<<<< END. State AFTER is:`,
    "color: red; font-weight: bold;",
    this.currentMvuState,
  );
},
// 上一回合（极致解耦版）
viewPreviousMessage() {
  this.jumpToHistory(this.historyViewIndex - 1);
},
// 下一回合（极致解耦版）
viewNextMessage() {
  this.jumpToHistory(this.historyViewIndex + 1);
},
// 回到当前（极致解耦版）
async returnToPresent() {
  if (this.chatHistoryCache.length === 0) return;
  // 直接跃迁到相册的最后一张照片，jumpToHistory 会自动处理所有逻辑
  await this.jumpToHistory(this.chatHistoryCache.length - 1);
},
//是否将您原来的“未来”保存为一个新的分支
handleBranching(userMessage) {
  // 弹出新的、更简洁的确认框
  this.showConfirmModal(
    "检测到时间线偏离。\n是否将您原来的“未来”保存为一个新的分支，并继续探索当前这个新的可能性？",
    async () => {
      // 1. 自动将旧时间线存档为一个分支
      await this._archiveCurrentTimelineAsBranch();
      // 2. 在当前会话中，继续新的时间线
      await this.commitHistoryBranch(userMessage);
    },
  );
},
//归档（工具版performSave——已重构)
async _archiveCurrentTimelineAsBranch() {
  this.showTemporaryMessage("正在将旧时间线归档为分支...");
  try {
    const slotId = `slot_${Date.now()}`;
    const branchName = `分支 - (始于回合 ${this.historyViewIndex + 1}) - ${new Date().toLocaleTimeString("zh-CN")}`;

    // 📦 核心：复用工厂函数，直接拿到打包好的数据
    const saveDataPayload =
      await this._buildSavePayload(branchName);

    const allSaves = await this.getSavesFromStorage();
    allSaves[slotId] = saveDataPayload;
    await AppStorage.saveData("multi_save_data", allSaves);

    this.showTemporaryMessage(`旧时间线已归档为 “${branchName}”`);
    return true;
  } catch (error) {
    console.error("[历史系统] 归档旧时间线失败:", error);
    this.showTemporaryMessage(`归档失败: ${error.message}`);
    return false;
  }
},

// 独立的经历修复工具（带双库智能比对与灾备恢复）
async forceSyncJourneyLorebook() {
  this.showTemporaryMessage("正在分析数据源，准备深度修复本周目经历...", 2000);
  try {
    const journeyKey = this.unifiedIndex > 1 ? `本周目经历(${this.unifiedIndex})` : "本周目经历";

    // --- 🕵️‍♂️ 侦探环节 1：提取外部备份库数据 ---
    let backupContent = "";
    let backupEventCount = 0;
    try {
      // 绕过管家融合策略，直接潜入备用库查档
      const libraryAll = await TavernHelper.getLorebookEntries(WorldbookManager.LIBRARY_BOOK).catch(() => []);
      const backupEntry = libraryAll.find(e => e.comment === journeyKey);
      if (backupEntry && backupEntry.content) {
        backupContent = backupEntry.content;
        backupEventCount = this.parseJourneyEntry(backupContent).length;
      }
    } catch (e) {
      console.warn("[修复经历] 读取历史孔隙备份失败", e);
    }

    // --- 🕵️‍♂️ 侦探环节 2：从当前快照强行重建 ---
    const rebuiltText = await this._mergeAllSnapshotsJourney();
    const rebuiltEventCount = rebuiltText.trim() ? this.parseJourneyEntry(rebuiltText).length : 0;

    // --- ⚖️ 法官环节：如果双端都空，直接宣告破产 ---
    if (backupEventCount === 0 && rebuiltEventCount === 0) {
      this.showTemporaryMessage("❌ 历史快照和备用库中均未找到有效经历。", 3000);
      return;
    }

    // --- 🧠 核心智能：裁决采用哪个数据源 ---
    // 原则：优先相信条数更多、更完整的那个。如果一样多，优先用备份库（减少正则重新拼接的风险）。
    let finalContent = "";
    let restoreSource = "";

    if (backupEventCount >= rebuiltEventCount && backupEventCount > 0) {
      finalContent = backupContent;
      restoreSource = "历史孔隙 (外部备份恢复)";
    } else {
      finalContent = rebuiltText;
      restoreSource = "快照深度重建";
    }

    // --- 🛠️ 处刑环节：执行覆盖写入并强制双库同步 ---
    // 先获取主库原节点（只为拿到 UID 用于覆盖写入）
    const entries = await WorldbookManager.fetchEntries(journeyKey, { exactMatch: true });
    const primaryEntry = entries[0]; 

    const saveTask = { comment: journeyKey, content: finalContent };
    if (primaryEntry && primaryEntry.uid) {
      saveTask.uid = primaryEntry.uid;
    }

    // 通过管家写入，并再次触发备份（确立新的绝对真理）
    await WorldbookManager.saveEntries([saveTask], { backupToLibrary: true });

    this.showTemporaryMessage(`✅ 经历修复成功！(数据源: ${restoreSource})`, 3000);
    console.log(`[修复经历] 采用源: ${restoreSource} | 备份库条数: ${backupEventCount} | 重建条数: ${rebuiltEventCount}`);
    
  } catch (e) {
    console.error("[修复经历] 失败:", e);
    this.showTemporaryMessage("❌ 经历修复失败，请查看控制台。", 3000);
  }
},
// 增加编辑按钮入口 (重构版：直接读取 meta.serial)
renderHistoryControls() {
  const placeholder = document.getElementById("history-nav-placeholder");
  if (!placeholder) return;

  const totalMessages = this.chatHistoryCache.length;
  const currentIndex = this.historyViewIndex;
  const isAtPresent = currentIndex === totalMessages - 1;

  // 🔴 核心极简：直接从洗澡后的 meta 里读取真正的绝对序号！
  let sequenceNumber = "";
  const currentSnap = this.chatHistoryCache[currentIndex];
  if (currentSnap && currentSnap.meta?.serial) {
    sequenceNumber = ` [№${currentSnap.meta.serial}]`;
  }

  let statusText = this.isHistoryViewMode
    ? `浏览历史: ${currentIndex + 1} / ${totalMessages}${sequenceNumber}`
    : `当前回合: ${totalMessages}${sequenceNumber}`;

  // 🔴 注入 HTML（去掉了 onclick 属性）
  placeholder.innerHTML = /* HTML */ `
    <div class="history-mode-warning ${this.isHistoryViewMode ? "visible" : ""}">
      您正在浏览过去。任何新输入都将从当前节点创建新的时间线！
    </div>
    <div class="history-nav-container">
      <button id="btn-history-prev" class="interaction-btn" title="上一回合" data-action="history_prev" ${currentIndex <= 0 ? "disabled" : ""}>◀</button>
      <span id="history-status" class="history-status">${statusText}</span>
      <button id="btn-history-next" class="interaction-btn" title="下一回合" data-action="history_next" ${isAtPresent ? "disabled" : ""}>▶</button>
      <button id="btn-history-edit" class="interaction-btn" title="✏编辑模式">编辑</button>
      <button id="btn-history-return" class="interaction-btn primary-btn" title="立刻回到现在" data-action="history_return" style="${this.isHistoryViewMode ? "" : "display:none;"}">返回</button>
    </div>
  `;

  const btnHistoryEdit = document.getElementById("btn-history-edit");
  if (btnHistoryEdit) {
    btnHistoryEdit.addEventListener("click", this.openInGameEditor);
  }
  this.updateTimelineHighlight();
},


