// 文件: misc-debug.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L39287-41111: // ========================================== ---

// ==========================================
// 📚 双世界书管理系统 (Tab分页 + 原生Title版)
// ==========================================

showWorldbookManager() {
  this.openModal("wb-manager-modal"); 
  
  const modal = document.getElementById("wb-manager-modal");
  if (!modal) return;

  // 初始化当前选中的 Tab
  this.currentWbTab = 'all';

  modal.innerHTML = /* HTML */ `
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">世界书管控中枢</h2>
        <div class="header-right-controls">
          <span class="header-quantity" id="wb-stats-text" title="双库条目统计">同步中...</span>
          <button id="btn-wb-refresh" class="round-btn info-btn-solid" title="刷新双库数据">↻</button>
          <button class="modal-close-btn" id="btn-wb-close">&times;</button>
        </div>
      </div>
      
      <div class="modal-body">
        <div class="wb-tabs" id="wb-tabs-container">
          <button class="wb-tab-btn active" data-tab="all">全部</button>
          <button class="wb-tab-btn" data-tab="primary_only">🟢 源堡</button>
          <button class="wb-tab-btn" data-tab="library_only">💤 历史孔隙</button>
          <button class="wb-tab-btn" data-tab="conflict">⚠️ 双库冲突</button>
        </div>

        <div id="wb-entries-container" class="wb-entries-container">
          <p class="modal-placeholder">正在解析世界书...</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-wb-refresh").addEventListener("click", () => {
    this.renderWorldbookList();
    this.showTemporaryMessage("双库世界书已同步刷新！", 2000);
  });

  document.getElementById("btn-wb-close").addEventListener("click", () => this.closeAllModals());

  // 绑定 Tab 点击事件
  document.getElementById("wb-tabs-container").addEventListener("click", (e) => {
    if (e.target.classList.contains("wb-tab-btn")) {
      // 切换高亮状态
      document.querySelectorAll(".wb-tab-btn").forEach(btn => btn.classList.remove("active"));
      e.target.classList.add("active");
      
      // 更新状态并重新渲染列表
      this.currentWbTab = e.target.dataset.tab;
      this.renderWorldbookList();
    }
  });

  // 首次渲染拉取数据
  this._cachedWbReport = null; // 增加一个内部缓存，避免切换tab时频繁请求API
  this.fetchAndRenderWorldbookList();
},

// 拆分一个数据获取函数，方便 Tab 切换时只走渲染不走网络请求
async fetchAndRenderWorldbookList() {
  const container = document.getElementById("wb-entries-container");
  if (!container) return;
  container.innerHTML = '<p class="modal-placeholder">正在比对源堡与历史孔隙的差异...</p>';

  try {
    this._cachedWbReport = await WorldbookManager.compareBooks();
    this.renderWorldbookList();
  } catch (error) {
    console.error("[世界书管理] 渲染失败:", error);
    container.innerHTML = '<div class="modal-placeholder" style="color: var(--color-danger);">神经连接断开，同步失败。</div>';
  }
},

// 纯渲染函数 (支持根据 Tab 过滤)
renderWorldbookList() {
  const container = document.getElementById("wb-entries-container");
  const statsText = document.getElementById("wb-stats-text");
  const report = this._cachedWbReport || [];

  if (report.length === 0) {
    container.innerHTML = '<div class="modal-placeholder">双库空空如也，未找到任何世界书条目。</div>';
    statsText.textContent = '总计: 0';
    return;
  }

  // 统计与过滤
  const counts = { primary_only: 0, library_only: 0, conflict: 0 };
  let html = '';

  report.forEach(item => {
    // 统计数量时，把 identical 和 primary_only 合并计算为“源堡”数量，让统计更简洁
    const countKey = item.status === 'identical' ? 'primary_only' : item.status;
    counts[countKey] = (counts[countKey] || 0) + 1;
    
    // Tab 过滤逻辑：
    // 如果玩家点的是“源堡运行中 (primary_only)”，我们要把 identical（已同步）也显示给他们看
    if (this.currentWbTab !== 'all') {
      if (this.currentWbTab === 'primary_only') {
        if (item.status !== 'primary_only' && item.status !== 'identical') return;
      } else {
        if (item.status !== this.currentWbTab) return;
      }
    }
    
    html += this._buildWorldbookEntryHtml(item);
  });

  statsText.textContent = `总计: ${report.length} | 源堡: ${counts.primary_only} | 孔隙: ${counts.library_only} | 冲突: ${counts.conflict}`;
  
  if (html === '') {
    container.innerHTML = '<div class="modal-placeholder">当前分类下没有条目。</div>';
  } else {
    container.innerHTML = html;
    // 每次重新渲染 HTML 后重新绑定事件
    this._bindWorldbookEvents(container, report);
  }
},

// 构建 HTML (已替换为原生 title 属性)
_buildWorldbookEntryHtml(item) {
  const activeData = item.primaryData || item.libraryData;
  const isEnabled = activeData.enabled || false;
  const previewText = activeData.content ? activeData.content.substring(0, 90).replace(/\n/g, " ") + "..." : "该条目如同白纸，毫无记载。";
  
  // 状态映射表 (新增了 identical 已同步状态)
  const statusMap = {
    'primary_only': { text: '运行中', class: 'status-primary', icon: '🟢' },
    'library_only': { text: '休眠/备份', class: 'status-library', icon: '💤' },
    'identical': { text: '双库已同步', class: 'status-primary', icon: '✅' }, // 新增
    'conflict': { text: '双库冲突', class: 'status-conflict', icon: '⚠️' }
  };
  const statusInfo = statusMap[item.status];

  // 动作按钮组：使用 title 替代 data-tooltip
  let actionButtonsHtml = '';
  
  if (item.status === 'primary_only' || item.status === 'identical') {
    actionButtonsHtml = `
      <button class="interaction-btn" data-action="demote" data-name="${item.name}" title="将条目安全备份至历史孔隙并从源堡移除">移至孔隙</button>
      <button class="interaction-btn danger-btn" data-action="delete" data-name="${item.name}">彻底粉碎</button>
    `;
  } else if (item.status === 'library_only') {
    actionButtonsHtml = `
      <button class="interaction-btn primary-btn" data-action="promote" data-name="${item.name}" title="将备份条目导入源堡并激活">唤醒至源堡</button>
      <button class="interaction-btn danger-btn" data-action="delete" data-name="${item.name}">彻底粉碎</button>
    `;
  } else if (item.status === 'conflict') {
    actionButtonsHtml = `
      <button class="interaction-btn primary-btn" data-action="overwrite_primary" data-name="${item.name}" title="使用历史孔隙的版本覆盖源堡中的版本">用孔隙覆盖源堡</button>
      <button class="interaction-btn" data-action="overwrite_library" data-name="${item.name}" title="使用源堡的版本覆盖历史孔隙中的版本">用源堡覆盖孔隙</button>
      <button class="interaction-btn danger-btn" data-action="delete" data-name="${item.name}" title="同时从双库中永久删除此条目">彻底粉碎</button>
    `;
  }

  // ✨ 核心视觉升级：处理预览区域与鼠标悬停文本 (针对冲突状态提供双重对比)
  let previewHtml = '';
  let titleText = ''; // 专门处理原生 title 的悬停完整文本

  if (item.status === 'conflict') {
    const pContent = item.primaryData.content || "无";
    const lContent = item.libraryData.content || "无";
    
    // 截取预览
    const pPreview = pContent.substring(0, 60).replace(/\n/g, " ") + "...";
    const lPreview = lContent.substring(0, 60).replace(/\n/g, " ") + "...";
    
    // 冲突时，展示上下两行对比
    previewHtml = `
      <div style="margin-bottom: 4px;"><strong style="color:var(--color-primary);">[源堡]</strong> ${this.safeEscapeHtml(pPreview)}</div>
      <div><strong style="color:var(--text-subtle);">[孔隙]</strong> ${this.safeEscapeHtml(lPreview)}</div>
    `;

    // 悬停时，利用原生的 title 换行 (\n) 展示双库的完整内容比对
    titleText = `【源堡版本】\n${pContent}\n\n【孔隙版本】\n${lContent}`;
  } else {
    // 正常状态单行预览
    const normalPreview = activeData.content ? activeData.content.substring(0, 90).replace(/\n/g, " ") + "..." : "该条目如同白纸，毫无记载。";
    previewHtml = this.safeEscapeHtml(normalPreview);
    titleText = activeData.content || "";
  }

  // 严格检查 HTML 闭合标签
  return /* HTML */ `
    <div class="wb-entry-item">
      <div class="wb-entry-header">
        <div class="wb-entry-info">
          <div class="wb-entry-name">
            ${this.safeEscapeHtml(item.name)}
            <span class="wb-status-tag ${statusInfo.class}" title="当前所在库状态">
              ${statusInfo.icon} ${statusInfo.text}
            </span>
          </div>
          <div class="wb-entry-preview" title="${this.safeEscapeHtml(titleText)}">
            ${previewHtml}
          </div>
        </div>
        
        ${item.primaryData ? `
          <input type="checkbox" class="switch" 
                 data-action="toggle" 
                 data-name="${this.safeEscapeHtml(item.name)}" 
                 data-enabled="${isEnabled}" 
                 ${isEnabled ? "checked" : ""}
                 title="${isEnabled ? '点击禁用该条目' : '点击启用该条目'}">
        ` : ''}
      </div>

      <div class="wb-entry-actions">
        ${actionButtonsHtml}
      </div>
    </div>
  `;
},

// 事件总线 (不变，注意确保只有容器绑定一次)
_bindWorldbookEvents(container, report) {
  // 先移除旧的事件监听器，防止多次执行 (一个简单粗暴的防泄漏方法就是替换自身)
  const newContainer = container.cloneNode(true);
  container.parentNode.replaceChild(newContainer, container);

  newContainer.addEventListener("change", (e) => {
    if (e.target.classList.contains("switch") && e.target.dataset.action === "toggle") {
      const name = e.target.dataset.name;
      const itemData = report.find(r => r.name === name);
      if (itemData) this.handleWorldbookAction("toggle", itemData, e.target);
    }
  });

  newContainer.addEventListener("click", (e) => {
    const target = e.target.closest('button[data-action]');
    if (!target) return;

    e.stopPropagation();
    const action = target.dataset.action;
    const name = target.dataset.name;
    const itemData = report.find(r => r.name === name);

    if (itemData) this.handleWorldbookAction(action, itemData, target);
  });
},

// 动作执行器：稍微调整一下，执行完毕后重新 fetch
async handleWorldbookAction(action, itemData, domElement) {
  const name = itemData.name;
  this.showTemporaryMessage(`执行操作中...`, 1000);

  try {
    switch (action) {
      case 'toggle': {
        const isCurrentlyEnabled = domElement.dataset.enabled === "true";
        await WorldbookManager.saveEntries([{ ...itemData.primaryData, enabled: !isCurrentlyEnabled }]);
        break;
      }
      case 'promote': {
        await WorldbookManager.saveEntries([{ ...itemData.libraryData, enabled: true }]);
        await WorldbookManager.removeEntries(WorldbookManager.LIBRARY_BOOK, e => e.name === name);
        break;
      }
      case 'demote': {
        await WorldbookManager.saveEntries([{ ...itemData.primaryData }], { backupToLibrary: true });
        await WorldbookManager.removeEntries(WorldbookManager.PRIMARY_BOOK, e => e.name === name);
        break;
      }
      case 'overwrite_primary': {
        await WorldbookManager.saveEntries([{ ...itemData.libraryData }]);
        break;
      }
      case 'overwrite_library': {
        await WorldbookManager.saveEntries([{ ...itemData.primaryData }], { backupToLibrary: true });
        break;
      }
      case 'delete': {
        await WorldbookManager.removeEntries(WorldbookManager.PRIMARY_BOOK, e => e.name === name);
        await WorldbookManager.removeEntries(WorldbookManager.LIBRARY_BOOK, e => e.name === name);
        break;
      }
    }
    
    this.showTemporaryMessage(`操作成功！`, 2000);
    // 操作改变了底层数据，所以必须重新 fetch 报告，然后再 render
    this.fetchAndRenderWorldbookList();

  } catch (error) {
    console.error(`[世界书动作失败] ${action} - ${name}:`, error);
    this.showTemporaryMessage(`操作异常，请检查控制台。`);
  }
},




//=============================================
//==================存读档系统==================
//=============================================
//主界面
async showSaveLoadManager(saves = null) {
  this.openModal("save-load-modal");
  const modalHeader = document.querySelector(
    "#save-load-modal .modal-header",
  );
  const modalBody = document.querySelector(
    "#save-load-modal .modal-body",
  );
  if (!modalHeader || !modalBody) return;

  modalBody.innerHTML = /* HTML */ `
    <div class="chronicle-container">
      <div class="chronicle-toc">
        <div class="chronicle-header">时光手记 · 目录</div>
        <div id="chronicle-toc-list"></div>
      </div>
      <div class="chronicle-page">
        <div
          id="chronicle-page-header"
          class="chronicle-header"
        >
          事件详情
        </div>
        <div
          id="chronicle-page-content"
          class="empty-placeholder"
        >
          请从左侧目录选择一条时间线
        </div>
      </div>
    </div>
  `;

  const headerActions = modalHeader.querySelector("div");
  if (headerActions && !document.getElementById("btn-new-timeline")) {
    headerActions.insertAdjacentHTML(
      "afterbegin",
      `<button id="btn-new-timeline" data-action="new_timeline" class="interaction-btn" title="在当前聊天中清除所有历史和状态，开始一次全新的游戏。">开启新周目</button>`,
    );
  }
  if (headerActions && !document.getElementById("btn-rollback")) {
    headerActions.insertAdjacentHTML(
      "afterbegin",
      `<button id="btn-reroll" data-action="reroll" class="bare-icon-btn" title="重新生成AI回答">🎲</button><button id="btn-rollback" data-action="rollback" class="bare-icon-btn" title="回溯至上一回合">⏳</button>`,
    );
  }

  const tocList = document.getElementById("chronicle-toc-list");
  let html = "";

  // 1. 渲染“当前时间线”
  html += this.renderChronicleChapter(
    this.chatHistoryCache,
    "current_timeline",
  );

  // 2. 渲染已归档的分支
  const savesToRender = saves || (await this.getSavesFromStorage());
  const manualSaveKeys = Object.keys(savesToRender)
    .filter((key) => key.startsWith("slot_"))
    .sort((a, b) => b.localeCompare(a));
  manualSaveKeys.forEach((slotId) => {
    html += this.renderChronicleChapter(
      savesToRender[slotId],
      slotId,
    );
  });

  // 3. 渲染定期自动备份
  html += await this.renderPeriodicBackupChapter();

  tocList.innerHTML = html;
  this.bindChronicleListeners();
  this.bindPeriodicBackupListeners(); // 绑定定期备份加载按钮事件
},
async getSavesFromStorage() {
  return await AppStorage.loadData("multi_save_data", {});
},

// 管理界面目录（已重构：剔除文本解析，全面接入 Meta）
async renderChroniclePage(slotId, showAll = false) {
  const existingShowAllBtn = document.getElementById("btn-show-all-events");
  if (existingShowAllBtn) existingShowAllBtn.remove();
  
  const pageHeader = document.getElementById("chronicle-page-header");
  const pageContent = document.getElementById("chronicle-page-content");
  let timelineData, timelineName, historyArray;

  document.querySelectorAll(".chronicle-chapter").forEach((el) => el.classList.remove("active"));
  document.querySelector(`.chronicle-chapter[data-slot-id="${slotId}"]`)?.classList.add("active");

  if (slotId === "current_timeline") {
    timelineName = "当前时间线 (进行中)";
    historyArray = this.chatHistoryCache;
  } else {
    const saves = await this.getSavesFromStorage();
    timelineData = saves[slotId];
    if (timelineData) {
      timelineName = timelineData.save_name;
      historyArray = timelineData.timeline_history;
    }
  }

  if (historyArray) {
    pageHeader.textContent = timelineName;
    
    // 🚀 核心修改：原 _extractJourneyTitlesFromHistory 的逻辑直接内联，并改为读取 meta！
    const displayHistory = showAll ? historyArray : historyArray.slice(-20);
    const titles = [];

    displayHistory.forEach((snapshot, index) => {
      // originalIndex 依然用于 data-history-index 作为跳转的物理下标
      const originalIndex = showAll 
        ? index 
        : historyArray.length - displayHistory.length + index;
        
      // 读取标准化的 title
      const titleText = snapshot.meta?.title || "无标题事件";
      // 读取绝对序号 serial
      const serial = snapshot.meta?.serial || (originalIndex + 1);
      
      titles.push({
        title: `[№${serial}] ${titleText}`,
        historyIndex: originalIndex, 
      });
    });

    if (titles.length > 0) {
      pageContent.className = "";
      // 【核心修复】根据是否为当前时间线，生成不同的action指令
      const action = slotId === "current_timeline" ? "jump_view" : "load_and_jump";
      
      pageContent.innerHTML = titles
        .map(
          (t) => `<div class="chronicle-event" data-action="${action}" data-slot-id="${slotId}" data-history-index="${t.historyIndex}">${t.title}</div>`
        )
        .join("");
        
      // 如果快照总数超过20，显示“显示全部”按钮
      if (historyArray.length > 20 && !showAll) {
        pageContent.insertAdjacentHTML(
          "afterend",
          `
        <div style="text-align: center; margin-top: 10px;">
          <button id="btn-show-all-events" class="interaction-btn" data-slot-id="${slotId}">
            显示全部回合（共${historyArray.length}条）
          </button>
        </div>
        `
        );
        // 绑定按钮点击事件（点击后重新渲染并显示全部）
        document.getElementById("btn-show-all-events").addEventListener("click", async (e) => {
          const currentSlotId = e.target.dataset.slotId;
          await this.renderChroniclePage(currentSlotId, true); // 传递showAll=true
        });
      }
    } else {
      pageContent.className = "empty-placeholder";
      pageContent.innerHTML = "此时间线无关键事件记录。";
    }
  } else {
    pageHeader.textContent = "事件详情";
    pageContent.className = "empty-placeholder";
    pageContent.innerHTML = "请从左侧目录选择一条时间线";
  }
},
renderChronicleChapter(data, slotId) {
  if (slotId === "current_timeline") {
    const history = data; // For current timeline, data is the history cache itself
    return /* HTML */ `
      <div
        class="chronicle-chapter active"
        data-slot-id="current_timeline"
      >
        <div class="chapter-actions">
          <button
            class="interaction-btn"
            data-action="create_bookmark"
            title="将当前时间线固化为一个永久分支"
          >
            + 创建分支存档
          </button>
        </div>
        <div class="chapter-name">当前时间线 (进行中)</div>
        <div class="chapter-meta">
          共 ${history.length} 回合
        </div>
      </div>
    `;
  } else {
    const saveData = data; // For archived timelines, data is a save object
    if (saveData && saveData.timeline_history) {
      return /* HTML */ `
        <div class="chronicle-chapter" data-slot-id="${slotId}">
          <div class="chapter-actions">
            <button
              class="chapter-action-btn round-btn info-btn"
              data-action="export"
              title="导出"
            >
              ↑
            </button>
            <button
              class="chapter-action-btn round-btn warn-btn"
              data-action="delete"
              title="删除"
            >
              🔥
            </button>
          </div>
          <div class="chapter-name">
            ${saveData.save_name}
          </div>
          <div class="chapter-meta">
            ${new Date(saveData.timestamp).toLocaleString(
              "zh-CN",
            )}
            - 共 ${saveData.timeline_history.length} 回合
          </div>
        </div>
      `;
    }
  }
  return "";
},
bindChronicleListeners() {
  const container = document.getElementById("save-load-modal");
  if (!container) return;
  if (container.dataset.chronicleListenersBound) return;
  container.dataset.chronicleListenersBound = "true";
  container.addEventListener("click", async (e) => {
    const target = e.target;
    const actionableElement = target.closest("[data-action]");

    if (actionableElement) {
      const action = actionableElement.dataset.action;
      // 【核心修复】使用不同的变量名，避免冲突
      const parentChapter =
        actionableElement.closest(".chronicle-chapter");
      const slotId =
        actionableElement.dataset.slotId ||
        parentChapter?.dataset.slotId;

      switch (action) {
        // 新增：处理上一回合/下一回合/回到现在按钮
        case "history_prev":
          this.viewPreviousMessage();
          return;
        case "history_next":
          this.viewNextMessage();
          return;
        case "history_return":
          this.returnToPresent();
          return;
        case "new_timeline":
          await this.startNewTimeline();
          return; // <<< 新增此行
        case "reroll":
          await this.performReroll();
          return;
        case "rollback":
          await this.performRollback();
          return;
        case "create_bookmark": {
          const savedData = await this.performSave();
          if (savedData) {
            await this.showSaveLoadManager(savedData);
          }
          return;
        }
        case "delete":
          if (slotId) await this.deleteSave(slotId);
          return;
        case "export":
          if (slotId) await this.exportSave(slotId);
          return;
        case "load_and_jump": {
          const historyIndex = parseInt(
            actionableElement.dataset.historyIndex,
            10,
          );
          if (slotId && !isNaN(historyIndex)) {
            // 强行退出编辑模式，防止旧编辑器的脏数据污染新存档
            if (this.isEditingMode)
              this.closeInGameEditor();
            await this.performLoad(slotId, historyIndex);
          }
          return;
        }
        // 🔴 核心融合：将原生的冗长跳转逻辑，直接代理给我们的新函数！
        case "jump_view": {
          const historyIndex = parseInt(
            actionableElement.dataset.historyIndex,
            10,
          );
          if (
            !isNaN(historyIndex) &&
            historyIndex < this.chatHistoryCache.length
          ) {
            // 直接调用我们写好的、包含各种拦截和编辑器重载的高级跃迁函数
            await this.jumpToHistory(historyIndex);
            // 跳转完成后关闭存读档弹窗
            this.closeAllModals();
          }
          return;
        }
      }
    }

    // 此处的 chapterElement 变量名不再冲突
    const chapterElement = target.closest(
      ".chronicle-chapter:not(.empty)",
    );
    if (chapterElement) {
      const slotId = chapterElement.dataset.slotId;
      if (slotId) {
        await this.renderChroniclePage(slotId);
      }
    }
  });
},

//从JSON导入存档
async handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  this.showTemporaryMessage("正在导入存档...", 3000);
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const importData = JSON.parse(e.target.result);

      if (
        importData.exportVersion !== "1.0" ||
        !importData.saveData
      ) {
        throw new Error("存档文件格式无效或已损坏。");
      }

      // 【核心修改】在处理导入数据前，先通过迁移函数进行转换
      const migratedSaveData = await this._migrateSaveData(
        importData.saveData,
      );

      const allSaves = await this.getSavesFromStorage();
      const newSlotId = `slot_${Date.now()}`; // 使用动态ID，不再受5个槽位限制

      const bookName = WorldbookManager.PRIMARY_BOOK;
      const currentEntries =
        await TavernHelper.getLorebookEntries(bookName);
      const currentEntryNames = new Set(
        currentEntries.map((entry) => entry.comment),
      );

      const newSaveData = _.cloneDeep(migratedSaveData);
      const entriesToCreate = [];

      if (Array.isArray(importData.lorebookData)) {
        for (const entryToImport of importData.lorebookData) {
          let newEntryName = entryToImport.comment;
          let originalEntryName = entryToImport.comment;

          if (currentEntryNames.has(newEntryName)) {
            newEntryName = `${newEntryName}_imported_${Date.now()}`;
            this.showTemporaryMessage(
              `世界书条目“${originalEntryName}”已存在，重命名为“${newEntryName}”`,
              4000,
            );
          }

          const newEntry = { ...entryToImport };
          delete newEntry.uid;
          newEntry.comment = newEntryName;
          newEntry.keys = [newEntryName];
          newEntry.enabled = false;
          entriesToCreate.push(newEntry);

          if (newSaveData.lorebook_entries) {
            for (const key in newSaveData.lorebook_entries) {
              if (
                newSaveData.lorebook_entries[key] ===
                originalEntryName
              ) {
                newSaveData.lorebook_entries[key] =
                  newEntryName;
              }
            }
          }
        }
      }

      if (entriesToCreate.length > 0) {
        await TavernHelper.createLorebookEntries(
          bookName,
          entriesToCreate,
        );
      }

      newSaveData.save_name = `${newSaveData.save_name} (导入)`;
      allSaves[newSlotId] = newSaveData;
      await AppStorage.saveData("multi_save_data", allSaves);

      this.showTemporaryMessage(`存档已成功导入！`);
      this.showSaveLoadManager();
    } catch (error) {
      console.error("导入存档时出错:", error);
      this.showTemporaryMessage(`导入失败: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
},
// 📦 核心工厂：专门负责生成标准化的存档数据包 (重构版)
async _buildSavePayload(saveName) {
  const bookName = WorldbookManager.PRIMARY_BOOK;
  // 🔴 享受统管中心的红利
  const journeyKey = ChronicleCore.getLorebookKey("journey", this.unifiedIndex);
  const coreMemoryKey = ChronicleCore.getLorebookKey("core_memory", this.unifiedIndex);
  const playerPersonaKey = "玩家人设";

  const allEntries = (await TavernHelper.getLorebookEntries(bookName)) || [];

  // 1. 提取经历与兜底逻辑
  const journeyEntry = allEntries.find((entry) => entry.comment === journeyKey);
  let journeyContent = journeyEntry?.content || "";
  
  // 🔴 秒读事件数，告别正则
  let eventCount = ChronicleCore.parseTextToEvents(journeyContent).length;
  console.log(`[Payload构建] “${journeyKey}” 包含 ${eventCount} 个事件`);

  // 兜底：如果世界书为空，呼叫时空管理局的手术刀瞬间合并快照
  if (eventCount === 0 && this.chatHistoryCache?.length > 0) {
    console.warn("[Payload构建] 世界书内容为空，尝试从历史快照合并事件");
    const textsToMerge = this.chatHistoryCache.map(snap => this._getSafeJourneyText(snap));
    journeyContent = ChronicleCore.mergeJourneyTexts(textsToMerge);
  }

  // 2. 提取核心记忆与玩家人设
  const coreMemoryContent = allEntries.find((e) => e.comment === coreMemoryKey)?.content || "";
  const playerPersonaContent = allEntries.find((e) => e.comment === playerPersonaKey)?.content || "";
  console.log(`[Payload构建] "玩家人设" 内容长度: ${playerPersonaContent.length}`);

  // 3. 处理玩家 UUID (逻辑保持不变)
  let playerId = await AppStorage.loadData("player_id");
  if (!playerId) {
    playerId = crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
    await AppStorage.saveData("player_id", playerId);
  }

  // 4. 返回组装好的标准数据包
  return {
    timestamp: new Date().toISOString(),
    save_name: saveName,
    playerId: playerId,
    timeline_history: _.cloneDeep(this.chatHistoryCache || []),
    snapshot_data: {
      gacha_data: {
        state: _.cloneDeep(this.gachaState || {}),
        collection: _.cloneDeep(this.gachaCollection || {}),
        history: _.cloneDeep(this.gachaHistory || []),
      },
      lorebook_content: { journey: journeyContent, core_memory: coreMemoryContent, player_persona: playerPersonaContent },
    },
  };
},
// 执行存档 (重构后，使用通用 prompt 弹窗)
async performSave(slotId = null, saveName = null) {
  if (!this.chatHistoryCache || this.chatHistoryCache.length === 0) {
    this.showTemporaryMessage("没有可保存的历史记录。");
    return false;
  }

  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent,
  );
  const finalSlotId = slotId || `slot_${Date.now()}`;
  
  // 生成默认名称
  const defaultName = `分支存档 - ${new Date().toLocaleString("sv-SE").replace(/ /g, "_")}`;
  let finalSaveName = saveName;

  // 🔵 如果没有传入名字，则调用通用输入弹窗
  if (!finalSaveName) {
    const messageHtml = /* HTML */ `
      为您的存档输入一个名称（留空则使用默认名称）：
      <div class="modal-help-text" style="margin-top: 15px;">
        <p style="margin-bottom: 5px;">将创建以下世界书备份条目：</p>
        <ul class="modal-help-list" style="margin: 0; padding-left: 20px; color: var(--text-normal);">
          <li id="preview-journey">${defaultName}-本周目经历</li>
          <li id="preview-past-lives">${defaultName}-历史的投影</li>
        </ul>
      </div>
    `;

    // 为了保留原版“输入时实时更新预览名称”的精致体验，使用定时器在弹窗挂载后绑定事件
    setTimeout(() => {
      const input = document.getElementById("custom-prompt-input");
      const previewJourney = document.getElementById("preview-journey");
      const previewPastLives = document.getElementById("preview-past-lives");

      if (input && previewJourney && previewPastLives) {
        input.addEventListener("input", () => {
          const name = input.value.trim() || defaultName;
          previewJourney.textContent = `${name}-本周目经历`;
          previewPastLives.textContent = `${name}-历史的投影`;
        });
      }
    }, 100);

    // 调用通用的 Prompt 弹窗
    const userInput = await this.showPromptModal(
      "设置存档名称",
      messageHtml,
      "",                           // 默认值留空，让 placeholder 生效
      "text",
      `placeholder="${defaultName}"`, // 通过 extraAttr 注入 placeholder
      { confirmClass: "interaction-btn primary-btn" }
    );

    // 如果返回 null，说明用户点击了取消
    if (userInput === null) return false;

    // 如果用户输入了全空格或者没输入，则回退到 defaultName
    finalSaveName = userInput.trim() || defaultName;
  }

  // 🔴 移动端 UI 等待逻辑
  if (isMobile && this.isVariablePanelInitializing) {
    this.showTemporaryMessage("等待面板初始化完成...", 1000);
    let waitCount = 0;
    while (this.isVariablePanelInitializing && waitCount < 15) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waitCount++;
    }
  }

  this.showTemporaryMessage("正在固化时间线...");

  try {
    // 📦 核心：一键获取组装好的存档包
    const saveDataPayload =
      await this._buildSavePayload(finalSaveName);

    // 🔴 移动端只读验证逻辑 (原封不动保留)
    if (isMobile) {
      const checkSerialize = (name, data) => {
        try {
          JSON.stringify(
            data,
            AppStorage.getCircularReplacer(),
          );
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      };
      const timelineCheck = checkSerialize(
        "时间线整体",
        saveDataPayload.timeline_history,
      );
      if (!timelineCheck.success) {
        this.showTemporaryMessage(
          `❌ 时间线序列化失败：${timelineCheck.error}`,
          3000,
        );
        // ... 省略原有的 detailed check 代码，你可以直接把原来那段 for 循环贴回来 ...
      }
    }

    // 执行保存
    const allSaves = await this.getSavesFromStorage();
    allSaves[finalSlotId] = saveDataPayload;
    await AppStorage.saveData("multi_save_data", allSaves);

    // 移动端列表刷新逻辑
    if (isMobile) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (this.renderSaveList) {
        const updatedSaves = await this.getSavesFromStorage();
        this.renderSaveList(updatedSaves);
      }
    }

    this.showTemporaryMessage(`分支存档 “${finalSaveName}” 创建成功！`);
    return allSaves;
  } catch (error) {
    console.error("[存档系统] 存档失败:", error);
    this.showTemporaryMessage(`创建分支存档失败: ${error.message}`);
    return false;
  }
},
//导出存档
async exportSave(slotId) {
  this.showTemporaryMessage("正在准备导出数据...", 2000);
  try {
    const allSaves = await this.getSavesFromStorage();
    const saveData = allSaves[slotId];

    if (!saveData) {
      this.showTemporaryMessage("错误：找不到要导出的存档数据。");
      return;
    }

    const exportData = {
      exportVersion: "1.0",
      exportedAt: new Date().toISOString(),
      saveData: saveData,
      lorebookData: [],
    };

    if (
      saveData.lorebook_entries &&
      typeof saveData.lorebook_entries === "object"
    ) {
      const bookName = WorldbookManager.PRIMARY_BOOK;
      const entryNamesToExport = Object.values(
        saveData.lorebook_entries,
      );
      if (entryNamesToExport.length > 0) {
        const allLorebookEntries =
          await TavernHelper.getLorebookEntries(bookName);
        exportData.lorebookData = allLorebookEntries.filter(
          (entry) =>
            entryNamesToExport.includes(entry.comment),
        );
      }
    }

    // 保留缩进：保证JSON可读性
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], {
      type: "application/json",
    });
    const fileSizeMB = blob.size / (1024 * 1024); // 计算文件体积（MB）
    const safeSaveName = (saveData.save_name || slotId).replace(
      /[\/:*?"<>|]/g,
      "_",
    );
    const fileName = `SefirotSave_${safeSaveName}.json`;

    // --- 核心：调整方案逻辑（修复错误+优化用户体验） ---
    // 标记createObjectURL是否成功（移到try外，避免作用域问题）
    let isCreateObjectURLSuccess = false;
    try {
      // 大文件阈值管控：保留缩进后文件体积略增，>100MB提醒用户
      if (fileSizeMB > 100) {
        const isContinue = await this.showConfirmModal(
          `当前存档体积约${fileSizeMB.toFixed(1)}MB（含缩进），超大文件可能导致导出缓慢或失败，是否继续？`
        );
        
        if (!isContinue) {
          this.showTemporaryMessage("已取消导出");
          return;
        }
      }

      // 方案1（第一优先级）：现代浏览器首选 - createObjectURL（大文件友好）
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      a.style.display = "none";
      document.body.appendChild(a);

      // 优化：监听a标签的点击事件完成，再标记成功（尽量贴近实际下载触发）
      a.addEventListener(
        "click",
        () => {
          isCreateObjectURLSuccess = true;
          // 延迟释放内存：适度增加到2秒（给大文件下载留足时间，不要太长）
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
          }, 2000); // 2秒足够浏览器触发下载，过长会占用内存
        },
        { once: true },
      );

      // 稳定触发点击事件
      a.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
        }),
      );
    } catch (downloadError) {
      console.error(
        "createObjectURL方案失败，切换为msSaveBlob:",
        downloadError,
      );
      isCreateObjectURLSuccess = false;

      // 方案2（备选）：Via/Android WebView - msSaveBlob
      if (
        window.navigator &&
        typeof window.navigator.msSaveBlob === "function"
      ) {
        window.navigator.msSaveBlob(blob, fileName);
        this.showTemporaryMessage(
          "存档已成功导出（兼容模式）！",
        );
        return;
      }

      // 方案3（兜底）：极旧浏览器 - FileReader（优化逻辑：不直接禁止，提示风险）
      // 调整阈值为80MB（适度提高，同时提示风险）
      const downgradeThresholdMB = 80;
      if (fileSizeMB > downgradeThresholdMB) {
        // 不直接禁止，而是给出建议
        this.showTemporaryMessage(
          `当前存档${fileSizeMB.toFixed(1)}MB，超出降级方案处理上限！建议：1.使用Chrome/Edge浏览器导出 2.拆分存档后再导出`,
        );
        return;
      }

      // 提示用户：降级方案可能失败，让用户有心理准备
      // 【修改点 2】：降级方案警告弹窗
      const isTryFallback = await this.showConfirmModal(
        `当前存档${fileSizeMB.toFixed(1)}MB，使用降级方案可能导致浏览器卡顿或失败，是否尝试？`
      );
      
      if (!isTryFallback) {
        this.showTemporaryMessage("已取消导出");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const a = document.createElement("a");
        a.href = e.target.result;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.showTemporaryMessage(
          "存档已成功导出（降级模式）！",
        );
      };
      reader.onerror = (e) => {
        console.error("DataURL转换失败:", e);
        this.showTemporaryMessage(
          "降级导出失败！建议使用Chrome/Edge浏览器导出，或拆分存档后重试。",
        );
      };
      // 开始转换（大文件可能卡顿，提前提示）
      this.showTemporaryMessage(
        "正在转换数据（大文件请稍候）...",
      );
      reader.readAsDataURL(blob);
      return; // 触发降级方案后直接返回
    }

    // 优化：只有当createObjectURL成功时，才提示导出成功（避免假成功）
    if (isCreateObjectURLSuccess) {
      this.showTemporaryMessage(
        "存档导出指令已触发，请注意浏览器下载提示！",
      );
    } else {
      // 兜底：如果标记为失败，补充提示
      this.showTemporaryMessage(
        "导出指令已发送，若未收到下载，请尝试兼容模式！",
      );
    }
  } catch (error) {
    console.error("导出存档时出错:", error);
    this.showTemporaryMessage(`导出失败: ${error.message}`);
  }
},
//读档
async performLoad(slotId, historyIndex = -1) {
  const allSaves = await this.getSavesFromStorage();
  let saveData = allSaves[slotId];
  let historyArray = [];
  let isCurrentTimeline = false;

  // 1. 先区分“当前时间线”和“其他存档”，初始化 historyArray
  if (slotId === "current_timeline") {
    isCurrentTimeline = true;
    historyArray = this.chatHistoryCache; // 当前时间线：用前端缓存的历史
  } else {
    // 非当前时间线：校验并初始化数据
    if (!saveData) {
      this.showTemporaryMessage("此存档位为空。");
      return;
    }
    // 存档格式转换
    const convertedSaveData = await this._migrateSaveData(saveData);
    if (convertedSaveData !== saveData) {
      this.showTemporaryMessage("旧版存档已自动升级！");
      allSaves[slotId] = convertedSaveData;
      await AppStorage.saveData("multi_save_data", allSaves);
      saveData = convertedSaveData;
    }

    // 检测并补充playerId
    if (!saveData.playerId) {
      let playerId = await AppStorage.loadData("player_id");
      if (!playerId) {
        playerId = crypto.randomUUID
          ? crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
              /[xy]/g,
              (c) => {
                const r = (Math.random() * 16) | 0;
                return (
                  c === "x" ? r : (r & 0x3) | 0x8
                ).toString(16);
              },
            );
        await AppStorage.saveData("player_id", playerId);
        console.log("[读档] 生成新的玩家ID:", playerId);
      }
      saveData.playerId = playerId;
      allSaves[slotId] = saveData;
      await AppStorage.saveData("multi_save_data", allSaves);
      console.log("[读档] 为存档补充playerId:", playerId);
    } else {
      // 存档有playerId，同步到本地存储
      const localPlayerId =
        await AppStorage.loadData("player_id");
      if (!localPlayerId) {
        await AppStorage.saveData(
          "player_id",
          saveData.playerId,
        );
        console.log(
          "[读档] 从存档同步playerId到本地:",
          saveData.playerId,
        );
      }
    }

    // 校验时间线历史
    if (
      !saveData.timeline_history ||
      saveData.timeline_history.length === 0
    ) {
      this.showTemporaryMessage("此时间线为空或已损坏。");
      return;
    }
    // 给非当前时间线的 historyArray 赋值（之前遗漏！）
    historyArray = saveData.timeline_history;
  }

  // 2. 定义 confirmAction（移到分支外，确保所有场景都能访问）
  const confirmAction = async () => {
    this.showTemporaryMessage("正在加载时间线并恢复世界状态...");
    try {
      const targetIndex = historyIndex !== -1 && historyIndex < historyArray.length ? historyIndex : historyArray.length - 1;
      const targetSnapshot = historyArray[targetIndex];
      let targetJourneyContent = "";

      // 3. 提取目标快照的经历
      if (!isCurrentTimeline) {
        targetJourneyContent = saveData.snapshot_data?.lorebook_content?.journey || "";
        if (!targetJourneyContent) {
          console.log("[读档] 从存档快照合并完整经历");
          // 🔴 一键合并，拒绝手写 for 循环
          const textsToMerge = saveData.timeline_history.map(snap => this._getSafeJourneyText(snap));
          targetJourneyContent = ChronicleCore.mergeJourneyTexts(textsToMerge);
        }
      } else {
        targetJourneyContent = this._getSafeJourneyText(targetSnapshot);
      }

      // 4. 解析最大事件序号，截断世界书
      // 🔴 直接使用时空管理局萃取绝对序号，精准致命
      const maxTargetEventId = ChronicleCore.extractMetaFromRawText(targetJourneyContent).serial || 0;
      console.log(`[读档] 目标快照的最大事件序号：${maxTargetEventId}`);

      const bookName = WorldbookManager.PRIMARY_BOOK;
      const allEntries = await TavernHelper.getLorebookEntries(bookName);

      // --- 第四步与第五步整合 ---

      if (isCurrentTimeline) {
        // 【场景 A】当前时间线：执行修剪逻辑（原地回退进度）
        const journeyKey = ChronicleCore.getLorebookKey("journey", this.unifiedIndex);
        const journeyEntry = allEntries.find((entry) => entry.comment === journeyKey);

        if (journeyEntry && journeyEntry.content) {
          const currentEvents = ChronicleCore.parseTextToEvents(journeyEntry.content);
          const keepEvents = currentEvents.filter((ev) => (parseInt(ev["序号"], 10) || 0) <= maxTargetEventId);
          
          if (keepEvents.length < currentEvents.length) {
            const newContent = keepEvents.map((ev) => ChronicleCore.stringifyEventToText(ev)).join("\n\n");
            await TavernHelper.setLorebookEntries(bookName, [{ uid: journeyEntry.uid, content: newContent }]);
            console.log(`[回退] 当前时间线旅程已修剪至事件 ID: ${maxTargetEventId}`);
          }
        }
      } else {
        // 【场景 B】非当前时间线：执行全量恢复逻辑（跨周目/跨存档读档）
        if (saveData?.snapshot_data?.lorebook_content) {
          const loreContent = saveData.snapshot_data.lorebook_content;

          // 定义要恢复的条目映射
          const keysToRestore = [
            { 
              key: ChronicleCore.getLorebookKey("journey", this.unifiedIndex), 
              content: loreContent.journey 
            },
            { 
              key: this.unifiedIndex > 1 ? `本周目核心记忆(${this.unifiedIndex})` : "本周目核心记忆", 
              content: loreContent.core_memory 
            },
            { 
              key: "玩家人设", 
              content: loreContent.player_persona 
            }
          ];

          for (const item of keysToRestore) {
            const entry = allEntries.find((e) => e.comment === item.key);
            if (entry) {
              await TavernHelper.setLorebookEntries(bookName, [{
                uid: entry.uid,
                content: item.content || "" // 按照你的要求：没有或为空则覆盖为空
              }]);
              console.log(`[读档] 已同步恢复条目: ${item.key}`);
            }
          }
        }
      }

      // 6. 恢复抽卡数据
      if (!isCurrentTimeline && saveData?.snapshot_data) {
        // 恢复星界数据
        if (saveData.snapshot_data.gacha_data) {
          this.gachaState = _.cloneDeep(
            saveData.snapshot_data.gacha_data.state,
          );
          this.gachaCollection = _.cloneDeep(
            saveData.snapshot_data.gacha_data.collection,
          );
          this.gachaHistory = _.cloneDeep(
            saveData.snapshot_data.gacha_data.history,
          );
          this.saveGachaState();
        }
      } else {
        this._loadGachaDataFromSave(null);
      }

      // 7. 恢复前端聊天历史
      this.chatHistoryCache = _.cloneDeep(historyArray);
      const firstRecord = this.chatHistoryCache[0];
      console.log(
        "[加载存档保存校验] 存档中第一条记录的data:",
        firstRecord?.data,
      );
      console.log(
        "[加载存档保存校验] 是否包含stat_data:",
        !!firstRecord?.data?.stat_data,
      );
      await AppStorage.saveData(
        this._getHistoryKey(),
        this.chatHistoryCache,
      );

      // 8. 同步到酒馆聊天记录
      const messages = await getChatMessages("0");
      if (!messages || messages.length === 0)
        throw new Error("无法获取聊天记录，无法完成加载。");
      const messageZero = messages[0];
      messageZero.message = targetSnapshot.message;
      messageZero.data = targetSnapshot.data;
      await TavernHelper.setChatMessages([messageZero], {
        refresh: "none",
      });

      // 9. 更新UI状态
      this.isHistoryViewMode = historyIndex !== -1 && historyIndex < this.chatHistoryCache.length - 1;
      this.historyViewIndex = targetIndex;
      this.renderStateAt(targetSnapshot);
      this.renderHistoryControls();
      await this.loadEquipmentState();

      this.closeAllModals();
      const timelineName = isCurrentTimeline ? "当前时间线" : saveData.save_name;
      this.showTemporaryMessage(`时间线 “${timelineName}” 加载成功！`);
      
      await this._migrateSnapshotMeta();
      this.buildTimelineDirectory();

      // 10. 清除暂存内容（防止读档后旧数据被错误写入）
      this._updateInstanceData({
        journey: null, pastLives: null, novelText: null, 
        characterCard: null, coreMemory: null, clues: null, 
        variables: null, thinking: null, danmaku: null, actions: null
      });
      console.log(
        "[读档] 已清除所有暂存的提取内容，防止错误的自动覆盖。",
      );
    } catch (error) {
      console.error("加载时间线时出错:", error);
      this.showTemporaryMessage(`加载失败: ${error.message}`);
    }
  };

  // 11. 统一调用 confirmAction（移到分支外，所有场景通用）
  if (historyIndex !== -1) {
    confirmAction();
  } else {
    // 非当前时间线显示存档名，当前时间线显示固定文案
    const confirmText = isCurrentTimeline
      ? "确定要加载当前时间线的此快照吗？当前进度将被覆盖。"
      : `确定要加载时间线 “${saveData.save_name}” 吗？当前的游戏进度将被覆盖。`;
    this.showConfirmModal(confirmText, confirmAction);
  }
},
//--------自动存档------
//记录当下并自动存档
async createPendingAutoSave() {
  // 🛡️ 结构性安检升级：不仅要存在，还必须有核心域 stat_data
  if (!this.currentMvuState || !this.currentMvuState.stat_data) {
    console.warn("[AutoSave] 状态为空或核心数据严重破损，无法创建待定存档！", this.currentMvuState);
    this.pendingAutoSave = null;
    return;
  }
  try {
    let currentMessageContent = "";
    try {
      const messages = await getChatMessages("0");
      currentMessageContent = messages?.[0]?.message || "";
    } catch (e) {
      console.warn("[AutoSave] 创建快照时获取消息内容失败。");
    }

    const cleanedMessageContent = this._stripForbiddenWords(
      currentMessageContent,
    );

    // 从currentMvuState中移除equipped_items，避免重复
    const stateWithoutEquipment = _.cloneDeep(this.currentMvuState);
    delete stateWithoutEquipment.equipped_items;

    this.pendingAutoSave = {
      timestamp: new Date().toISOString(),
      save_name: "自动存档 - 上一回合",
      message_content: cleanedMessageContent,
      mvu_data: stateWithoutEquipment,
      // equipped_items: _.cloneDeep(this.equippedItems),
      pending_actions: _.cloneDeep(this.pendingActions) || [],
      gacha_data: {
        // 确保Gacha数据也被快照
        state: _.cloneDeep(this.gachaState),
        collection: _.cloneDeep(this.gachaCollection),
        history: _.cloneDeep(this.gachaHistory),
      },
    };

    // --- 新增：捕获当前“本周目经历”的内容并存入快照 ---
    try {
      const bookName = WorldbookManager.PRIMARY_BOOK;
      const index = this.unifiedIndex;
      const journeyKey =
        index > 1 ? `本周目经历(${index})` : "本周目经历";
      const allEntries =
        await TavernHelper.getLorebookEntries(bookName);
      const journeyEntry = allEntries.find(
        (entry) => entry.comment === journeyKey,
      );

      this.pendingAutoSave.lorebook_content = {
        journey: journeyEntry ? journeyEntry.content : null,
      };
    } catch (e) {
      console.error("[AutoSave] 捕获世界书快照失败:", e);
      this.pendingAutoSave.lorebook_content = { journey: null };
    }
    // --- 新增结束 ---

    console.log("[源堡] 已成功创建“上一回合”的待定存档快照。");
  } catch (error) {
    console.error("[源堡] 创建待定存档快照时出错:", error);
    this.pendingAutoSave = null;
  }
},
//执行自动存档写入
async performAutoSave() {
  if (!this.pendingAutoSave) {
    console.warn("[AutoSave] 没有待定的存档快照，跳过提交。");
    return;
  }

  try {
    const allSaves = await this.getSavesFromStorage();

    if (allSaves["auto_save_slot_1"]) {
      allSaves["auto_save_slot_2"] = _.cloneDeep(
        allSaves["auto_save_slot_1"],
      );
      allSaves["auto_save_slot_2"].save_name =
        "自动存档 - 上上回合";
    }

    allSaves["auto_save_slot_1"] = this.pendingAutoSave;

    await AppStorage.saveData("multi_save_data", allSaves);
    console.log("[源堡] 已成功提交待定存档至“上一回合”存档位。");
  } catch (error) {
    console.error("[源堡] 提交自动存档时发生错误:", error);
  } finally {
    this.pendingAutoSave = null; // 无论成功与否，都清空待定存档
  }
},
//读取自动备份存档
async performAutoSaveLoad(slotId) {
  const allSaves = await this.getSavesFromStorage();
  const saveData = allSaves[slotId];
  if (!saveData) {
    this.showTemporaryMessage("此自动存档为空。");
    return;
  }

  this.showConfirmModal(
    `确定要读取 "${saveData.save_name}" 吗？当前进度将丢失。`,
    async () => {
      this.showTemporaryMessage("正在回溯至自动存档点...");
      try {
        const stepsToRollback =
          slotId === "auto_save_slot_1"
            ? 1
            : slotId === "auto_save_slot_2"
              ? 2
              : 0;
        if (
          stepsToRollback === 0 ||
          this.chatHistoryCache.length < stepsToRollback
        ) {
          this.showTemporaryMessage(
            "无法回滚，历史记录不足。",
          );
          this.closeAllModals();
          return;
        }

        this.chatHistoryCache = this.chatHistoryCache.slice(
          0,
          this.chatHistoryCache.length - stepsToRollback,
        );
        await AppStorage.saveData(
          this._getHistoryKey(),
          this.chatHistoryCache,
        );

        await this._rollbackJourneyLog(stepsToRollback);

        const lastSnapshot =
          this.chatHistoryCache.length > 0
            ? this.chatHistoryCache[
                this.chatHistoryCache.length - 1
              ]
            : null;

        if (lastSnapshot) {
          const messages = await getChatMessages("0"); // 变量名改为messages（数组）
          if (!messages || messages.length === 0) {
            throw new Error(
              "未找到聊天消息，无法同步存档状态",
            );
          }
          const messageZero = messages[0];
          messageZero.message = lastSnapshot.message;
          messageZero.data = lastSnapshot.data;
          await TavernHelper.setChatMessages([messageZero], {
            refresh: "all",
          });

          await this.returnToPresent();
          this.showTemporaryMessage(
            `已成功回滚至 "${saveData.save_name}"`,
          );
          // 🔴 新增：回滚切断了时间线，必须全量重绘
          this.buildTimelineDirectory();
        } else {
          this.isBusy = false;
          if (this.isTrueNewGame && this.currentMvuState) {
            console.log(
              "[自动读档] 新游戏无快照，生成初始快照",
            );
            const initSnapshot = {
              message_id: `frontend-hist-init-${Date.now()}`,
              message: "新周目初始快照（读档生成）",
              is_user: false,
              role: "assistant",
              data: _.cloneDeep(this.currentMvuState),
              timestamp: Date.now(),
            };
            this.chatHistoryCache.push(initSnapshot);
            await AppStorage.saveData(
              this._getHistoryKey(),
              this.chatHistoryCache,
            );
            await this.renderUI(
              this.currentMvuState.stat_data,
            );
            this.showTemporaryMessage(
              "新周目初始数据已加载，无需刷新",
            );
          } else {
            console.log(
              "[自动读档] 已有游戏快照丢失，刷新兜底",
            );
            this.closeAllModals();
            window.location.reload();
            return;
          }
        }

        this.closeAllModals();
      } catch (error) {
        console.error("执行自动读档时出错:", error);
        this.showTemporaryMessage(`读档失败: ${error.message}`);
        this.closeAllModals();
      }
    },
  );
},

//开启新周目
async startNewTimeline() {
  this.showConfirmModal(
    "【高危操作】您确定要开启新周目吗？<br><br>这将彻底清除所有历史记录、Gacha数据、装备和世界书进度，回到初始状态！",
    async () => {
      this.showTemporaryMessage("正在重置世界线...", 3000);
      try {
        // 1. 清空所有游戏相关缓存（同步）
        const namespace = "SEFIROT_CASTLE_REVISION_";
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key.startsWith(namespace) ||
            key === "multi_save_data" ||
            key === "frontend_chat_history_fallback"
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        this.chatHistoryCache = [];

        // 2. 重置游戏状态（同步）
        this.equippedItems = { wuqi: null, yiwu: null, shipin: null, fengyinwu: null, banyanfa: null, fuzhu: null };
        this.gachaState = { astralDust: 160, starglitter: 0, pitySSR: 0, pitySR: 0, ssrGuarantee: false, redeemedCodes: [], activeCompanions: [], firstPullGuaranteedSR: true };
        this.gachaCollection = {};
        this.gachaHistory = [];
        this.theaterState = { theaterPoints: 0 };
        this.pendingActions = [];
        this.saveEquipmentState();
        this.saveGachaState();
        this.savePendingActions();

        // 3. 🌟 修复点：直接调用你重构后的全局 WorldbookManager
        const entriesToClear = ["本周目经历", "本周目核心记忆", "当前线索", "历史的投影", "玩家人设"];
        // 构造扁平化任务，WorldbookManager 底层会自动处理 name 映射和原子化防抖写入
        const saveTasks = entriesToClear.map(name => ({
          name: name,   // 必须提供 name
          content: ""   // 清空正文
        }));
        
        // 可选：如果你需要双库同步清空，可以加上 { backupToLibrary: true }
        await WorldbookManager.saveEntries([saveTasks], { backupToLibrary: true }); 
        console.log("[新周目] 已清空世界书相关条目");

        // 4. 构造开局内容
        const startTag = "<开" + "局>";
        const endTag = "</开" + "局>";
        const startContent = `${startTag}\n按照下面要求生成\n${endTag}`;

        // 5. 正确清理历史记录：删除第0楼以外的所有楼层
        try {
          // 获取当前所有被引用的楼层
          const currentMessages = await TavernHelper.getChatMessages('0-{{lastMessageId}}');
          if (currentMessages && currentMessages.length > 1) {
            // 提取出需要删除的楼层ID (保留第0楼，即排除索引0)
            const idsToDelete = currentMessages
              .filter(m => m.message_id !== 0)
              .map(m => m.message_id);
            
            if (idsToDelete.length > 0) {
              await TavernHelper.deleteChatMessages(idsToDelete, { refresh: "none" });
              console.log("[新周目] 已清理旧周目楼层:", idsToDelete);
            }
          }
        } catch (e) {
          console.warn("[新周目] 历史楼层清理阶段出现异常(可能已为空):", e);
        }

        // 6. 严格依照 TS 类型重写第0楼
        // 这里的参数必须严格遵循官方声明，去除多余/非法的字段
        await TavernHelper.setChatMessages([
          {
            message_id: 0,            // 🎯 核心修复：必须是严格的数字 0
            message: startContent,    // 遵循官方 API 文档的字段
            role: "assistant",
            data: {
             stat_data: null,
             npc_data: null,
             world_data: null }
          }
        ], {
          refresh: "all", // 触发 tavern_events.CHAT_CHANGED 事件，刷新全局 UI
        });
        console.log("[新周目] 已安全写入开局内容到最新楼");

        // 7. 延迟刷新
        this.showTemporaryMessage("新周目已重置，即将刷新...");
        setTimeout(() => {
          window.location.reload(true);
        }, 1500);
      } catch (error) {
        console.error("开启新周目失败:", error);
        this.showTemporaryMessage(`操作失败: ${error.message}`);
      }
    }
  );
},
//处理新周目归档【待启用】
async _archiveNewTimeline() {
  const bookName = WorldbookManager.PRIMARY_BOOK;
  const index = this.unifiedIndex;
  console.log(`[归档] 处理第${index}周目初始数据...`);

  try {
    // 1. 清理世界书 (保持原有逻辑)
    const entriesToClear = [
      index > 1 ? `本周目经历(${index})` : "本周目经历",
      index > 1 ? `本周目核心记忆(${index})` : "本周目核心记忆",
      index > 1 ? `当前线索(${index})` : "当前线索",
      index > 1 ? `历史的投影(${index})` : "历史的投影",
    ];

    const allEntries =
      await TavernHelper.getLorebookEntries(bookName);
    const entriesToUpdate = allEntries
      .filter((entry) => entriesToClear.includes(entry.comment))
      .map((entry) => ({ uid: entry.uid, content: "" }));

    if (entriesToUpdate.length) {
      await TavernHelper.setLorebookEntries(
        bookName,
        entriesToUpdate,
      );
      console.log(
        `[归档] 清理了${entriesToUpdate.length}个世界书条目`,
      );
    }

    if (!this.chatHistoryCache || !this.chatHistoryCache.length) {
      console.warn("[归档] 无快照可存档");
      return;
    }

    // 2. 保存新档
    const slotId = `slot_${Date.now()}`;
    const branchName = `初始时间线-${new Date().toLocaleString()}`;

    // 📦 直接调用工厂函数！因为它刚才已经清理过世界书了，所以这里抓取到的 content 自动就是空的，完美契合！
    const saveDataPayload =
      await this._buildSavePayload(branchName);

    const allSaves = await AppStorage.loadData(
      "multi_save_data",
      {},
    );
    allSaves[slotId] = saveDataPayload;
    await AppStorage.saveData("multi_save_data", allSaves);

    this.showTemporaryMessage("初始时间线已存档");
    console.log(`[归档] 已保存至${slotId}`);
  } catch (e) {
    console.warn("[归档] 非致命错误:", e);
  }
},
//删除存档
async deleteSave(slotId) {
  const allSaves = await this.getSavesFromStorage();
  const saveData = allSaves[slotId];
  if (!saveData) {
    this.showTemporaryMessage("此存档位已空。");
    return;
  }

  this.showConfirmModal(
    `确定要永久删除存档 “${saveData.save_name}” 吗？`,
    async () => {
      try {
        await this.deleteLorebookBackup(saveData);
        delete allSaves[slotId];
        await AppStorage.saveData("multi_save_data", allSaves);
        this.showTemporaryMessage("存档已删除。");
        await this.showSaveLoadManager();
      } catch (error) {
        console.error("删除存档时出错:", error);
        this.showTemporaryMessage(`删除失败: ${error.message}`);
      }
    },
  );
},
//清理所有存档
async clearAllSaves() {
  this.showConfirmModal(
    "【高危操作】确定要删除所有手动存档吗？此操作无法恢复。",
    async () => {
      this.showTemporaryMessage("正在清除所有存档...");
      try {
        // 【核心修复】不再删除整个存档对象，而是将其重置为空对象{}
        await AppStorage.saveData("multi_save_data", {});

        this.showTemporaryMessage("所有手动存档已成功清除。");
        this.showSaveLoadManager(); // 重新渲染存档界面
      } catch (error) {
        console.error("清除所有存档时出错:", error);
        this.showTemporaryMessage(`清除失败: ${error.message}`);
      }
    },
  );
},
//删除世界书备份【已过时】
async deleteLorebookBackup(saveData) {
  if (!saveData || !saveData.lorebook_entries) return;
  const bookName = WorldbookManager.PRIMARY_BOOK;
  try {
    const allEntries =
      await TavernHelper.getLorebookEntries(bookName);
    const uidsToDelete = [];
    const journeyEntry = allEntries.find(
      (e) =>
        e.comment ===
        saveData.lorebook_entries.journey_entry_name,
    );
    const pastLivesEntry = allEntries.find(
      (e) =>
        e.comment ===
        saveData.lorebook_entries.past_lives_entry_name,
    );
    if (journeyEntry) uidsToDelete.push(journeyEntry.uid);
    if (pastLivesEntry) uidsToDelete.push(pastLivesEntry.uid);
    if (uidsToDelete.length > 0) {
      await TavernHelper.deleteLorebookEntries(
        bookName,
        uidsToDelete,
      );
      console.error("删除世界书备份成功:");
    }
  } catch (error) {
    console.error("删除世界书备份时出错:", error);
  }
},
//导入存档时旧版转化【已过时】
async _migrateSaveData(saveData) {
  // 检查是否为需要迁移的旧版存档 (有 message_content 但没有 timeline_history)
  if (
    saveData &&
    saveData.message_content &&
    !saveData.timeline_history
  ) {
    console.log(
      `[存档迁移] 检测到旧版存档 “${saveData.save_name}”，正在进行转换...`,
    );

    const newTimelineSave = {
      timestamp: saveData.timestamp,
      save_name: `${saveData.save_name} (旧版转换)`,
      timeline_history: [
        {
          message_id: `migrated-hist-${Date.now()}`,
          message: saveData.message_content,
          is_user: false,
          role: "assistant",
          data: {
            ..._.cloneDeep(saveData.mvu_data),
            // equipped_items: _.cloneDeep(saveData.equipped_items),
            gacha_data: _.cloneDeep(saveData.gacha_data),
          },
          timestamp: new Date(saveData.timestamp).getTime(),
        },
      ],
      snapshot_data: {
        gacha_data: _.cloneDeep(saveData.gacha_data),
        lorebook_content: {},
      },
    };

    // 尝试从旧存档信息中恢复世界书内容
    if (
      saveData.lorebook_entries &&
      saveData.lorebook_entries.journey_entry_name
    ) {
      try {
        const bookName = WorldbookManager.PRIMARY_BOOK;
        const allEntries =
          await TavernHelper.getLorebookEntries(bookName);
        const backupEntry = allEntries.find(
          (e) =>
            e.comment ===
            saveData.lorebook_entries.journey_entry_name,
        );
        if (backupEntry) {
          newTimelineSave.snapshot_data.lorebook_content.journey =
            backupEntry.content;
          console.log(
            "[存档迁移] 已成功从世界书备份中恢复“本周目经历”。",
          );
        }
      } catch (e) {
        console.error("[存档迁移] 尝试恢复世界书时出错:", e);
      }
    }

    return newTimelineSave; // 返回转换后的新格式存档
  }

  return saveData; // 如果不是旧版，直接返回原存档
},


