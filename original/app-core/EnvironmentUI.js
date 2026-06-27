// 文件: EnvironmentUI.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L22142-22702: // ========================================== ---

// ==========================================
// === [环境、视觉与显示] ENVIRONMENT & UI ===
// ==========================================
// 职责：弹幕、地图、皮肤、加载条、消息反馈

//=========主界面UI的监听和事件绑定=========
//-----------------放在这里方便查找-------------
bindStaticListeners() {
  if (this.listenersBound) return;

  // 设置全屏监听器
  this.setupFullscreenListener();

  window.domCacheManager.get("view-toggle-btn", "#view-toggle-btn")
    ?.addEventListener("click", () => this.toggleViewMode());

  // ✨ 中上方纪元快捷入口：点击查阅原著剧情指引
  const jinianItem = window.domCacheManager.get("val-jinian", "#val-jinian")?.closest(".status-item");
  if (jinianItem) {
    jinianItem.style.cursor = "pointer";
    jinianItem.title = "点击查阅今日原著剧情指引";
    jinianItem.addEventListener("click", () => {
      if (typeof this.showOriginalPlotGuide === "function") this.showOriginalPlotGuide();
    });
  }

  window.domCacheManager.get("toggle-char-panel", "#toggle-char-panel")
    ?.addEventListener("click", (e) =>
      this.toggleMobilePanel("char", e.target),
    );
  window.domCacheManager.get("btn-fullscreen-toggle", "#btn-fullscreen-toggle")
    ?.addEventListener("click", () => this.toggleFullScreen());
  window.domCacheManager.get("toggle-interaction-panel", "#toggle-interaction-panel")
    ?.addEventListener("click", (e) =>
      this.toggleMobilePanel("interaction", e.target),
    );
  window.domCacheManager.get("toggle-bottom-panel", "#toggle-bottom-panel")
    ?.addEventListener("click", (e) =>
      this.toggleMobilePanel("bottom", e.target),
    );

  window.domCacheManager.get("unified-index-input", "#unified-index-input")
    ?.addEventListener("change", (e) => {
      const newIndex = parseInt(e.target.value, 10);
      if (!isNaN(newIndex) && newIndex > 0) {
        this.unifiedIndex = newIndex;
        this.saveUnifiedIndex();
        this.showTemporaryMessage(
          `世界书读写序号已更新为 ${newIndex}`,
        );
        if (this.isAutoToggleLorebookEnabled)
          this.startAutoTogglePolling();
      } else {
        e.target.value = this.unifiedIndex;
      }
    });

  window.domCacheManager.get("auto-toggle-lorebook-checkbox", "#auto-toggle-lorebook-checkbox")
    ?.addEventListener("change", (e) => {
      this.isAutoToggleLorebookEnabled = e.target.checked;
      this.saveAutoToggleState();
      this.showTemporaryMessage(
        `自动开关世界书已${this.isAutoToggleLorebookEnabled ? "开启" : "关闭"}`,
      );
      if (this.isAutoToggleLorebookEnabled)
        this.startAutoTogglePolling();
      else this.stopAutoTogglePolling();
    });

  // 为抽屉里的按钮添加事件监听
  const drawerPanel = window.domCacheManager.get("right-drawer", "#right-drawer");
  if (drawerPanel) {
    drawerPanel.addEventListener("click", async (e) => {
      const button = e.target.closest(".interaction-btn");
      if (!button) return;

      if (
        window.MobilePerformanceOptimizer &&
        window.MobilePerformanceOptimizer.eventManager
      ) {
        window.MobilePerformanceOptimizer.eventManager.handleCloseAll();
      }

      switch (button.id) {
        case "btn-inventory": this.showInventory(); break;
        case "btn-relationships": this.showRelationships(); break;
        case "btn-battle-system": 
          if (this.battleUI) {
            this.battleUI.openModal();
          } else {
            console.warn('[GameManager] 战斗系统UI未初始化');
          }
          break;
        case "btn-command-center": this.showCommandCenter(); break;
        case "btn-character-details": this.showCharacterDetails(); break;
        case "btn-industry-management": this.showIndustryManagement(); break;
        case "btn-faction-management": this.showFactionManagement(); break;
        case "btn-enter-theater": this.renderTheaterModal(); break;
        case "btn-abilities": this.showAbilities(); break;
        case "btn-show-extracted": this.showExtractedContent(); break;
        case "btn-save-load-manager": this.showSaveLoadManager(); break;
        case "btn-view-journey-main": await this.showJourney(); break;
        case "btn-sequence-fixer": await this.openSequenceFixer(); break;
        case "btn-view-past-lives-main": this.showPastLives(); break;
        case "btn-gacha-system": this.showGachaSystem(); break;
        case "btn-event-generation": this.triggerEventGeneration(); break;
        case "btn-mail-system": this.showMailSystem(); break;
        case "btn-dlc-manager": this.showDLCManager(); break;
        case "btn-wb-manager": this.showWorldbookManager(); break;
        case "btn-guimi-system": this.showGuimiSystem(); break;
        case "btn-settings": this.showSettingsModal(); break;
      }
    });
  }

  window.domCacheManager.get("btn-clear-all-saves", "#btn-clear-all-saves")
    ?.addEventListener("click", () => this.clearAllSaves());
  window.domCacheManager.get("btn-import-save", "#btn-import-save")
    ?.addEventListener("click", () =>
      window.domCacheManager.get("import-file-input", "#import-file-input")?.click(),
    );
  window.domCacheManager.get("import-file-input", "#import-file-input")
    ?.addEventListener("change", (e) => this.handleFileImport(e));
  window.domCacheManager.get("btn-write-journey", "#btn-write-journey")
    ?.addEventListener("click", () =>
      this.writeJourneyToLorebook(),
    );

  window.domCacheManager.get("btn-cloud-upload", "#btn-cloud-upload")
    ?.addEventListener("click", () => this.showCloudUploadModal());
  window.domCacheManager.get("btn-cloud-download", "#btn-cloud-download")
    ?.addEventListener("click", () =>
      this.showCloudDownloadModal(),
    );
  window.domCacheManager.get("btn-cloud-check", "#btn-cloud-check")
    ?.addEventListener("click", () => this.checkCloudSave());
  window.domCacheManager.get("btn-cloud-download-confirm", "#btn-cloud-download-confirm")
    ?.addEventListener("click", () => this.downloadCloudSave());
  window.domCacheManager.get("btn-copy-cloud-code", "#btn-copy-cloud-code")
    ?.addEventListener("click", () => this.copyCloudCode());
  window.domCacheManager.get("btn-write-past-lives", "#btn-write-past-lives")
    ?.addEventListener("click", () =>
      this.writePastLivesToLorebook(),
    );
  window.domCacheManager.get("btn-write-novel-mode", "#btn-write-novel-mode")
    ?.addEventListener("click", () =>
      this.writeNovelModeToLorebook(),
    );
  window.domCacheManager.get("btn-write-character-card", "#btn-write-character-card")
    ?.addEventListener("click", () =>
      this.writeCharacterCardToLorebook(),
    );
  window.domCacheManager.get("btn-execute-commands", "#btn-execute-commands")
    ?.addEventListener("click", () => this.executePendingActions());
  window.domCacheManager.get("btn-clear-commands", "#btn-clear-commands")
    ?.addEventListener("click", () => this.clearPendingActions());
  window.domCacheManager.get("btn-refresh-storage", "#btn-refresh-storage")
    ?.addEventListener("click", () => this.refreshLocalStorage());
  window.domCacheManager.get("btn-reloadGameDB", "#btn-reloadGameDB")
    ?.addEventListener("click", () =>
      this.reloadGameDB(),
    );

  const autoWriteCheckbox = window.domCacheManager.get("auto-write-checkbox", "#auto-write-checkbox");
  if (autoWriteCheckbox) {
    autoWriteCheckbox.addEventListener("change", (e) => {
      this.isAutoWriteEnabled = e.target.checked;
      this.saveAutoWriteState(this.isAutoWriteEnabled);
      this.showTemporaryMessage(`自动写入经历/投影已${this.isAutoWriteEnabled ? "开启" : "关闭"}`);
    });
  }

  const novelModeCheckbox = window.domCacheManager.get("novel-mode-enabled-checkbox", "#novel-mode-enabled-checkbox");
  if (novelModeCheckbox) {
    novelModeCheckbox.addEventListener("change", (e) => {
      this.isNovelModeEnabled = e.target.checked;
      this.saveNovelModeState(this.isNovelModeEnabled);
      this.showTemporaryMessage(`小说模式自动写入已${this.isNovelModeEnabled ? "开启" : "关闭"}`);
    });
  }

  const charAutoWriteCheckbox = window.domCacheManager.get("character-auto-write-checkbox", "#character-auto-write-checkbox");
  if (charAutoWriteCheckbox) {
    charAutoWriteCheckbox.addEventListener("change", (e) => {
      this.isCharacterAutoWriteEnabled = e.target.checked;
      this.saveCharacterAutoWriteState(this.isCharacterAutoWriteEnabled);
      this.showTemporaryMessage(`角色提取自动写入已${this.isCharacterAutoWriteEnabled ? "开启" : "关闭"}`);
    });
  }

  // --- 模态框通用处理 ---
  window.domCacheManager.getAll("modal-close-btn", ".modal-close-btn")?.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal-overlay");
      if (modal) {
        modal.style.display = "none";
        if (modal.id === "gacha-results-modal") this.renderSummonTab();
        if (modal.id === "settings-modal") {
          const modalBody = window.domCacheManager.get("settings-modal-body", "#settings-modal-body");
          if (modalBody) this.unbindSettingsModalListeners();
        }
      }
    });
  });

  // --- 物品栏交互 ---
  const inventoryModalBody = window.domCacheManager.get("inventory-modal-body", "#inventory-modal .modal-body");
  if (inventoryModalBody) {
    inventoryModalBody.addEventListener("click", (e) => {
      const header = e.target.closest(".inventory-item-header");
      if (header) { this.toggleInventoryItem(header); return; }

      const itemElement = e.target.closest(".inventory-item");
      if (!itemElement) return;
      const itemData = JSON.parse(this.unescapeHtml(itemElement.dataset.itemDetails || "{}"));
      const category = itemElement.dataset.category;
      
      if (e.target.classList.contains("item-equip-btn")) this.equipItem(itemData, category, e.target);
      else if (e.target.classList.contains("item-use-btn")) this.useItem(itemData, e.target);
      else if (e.target.classList.contains("item-unequip-btn")) {
        const slotId = e.target.dataset.slotId;
        const slotElement = window.domCacheManager.get(slotId, "#" + slotId);
        if (slotElement) this.unequipItem(slotId, slotElement, true, true);
      } else if (e.target.classList.contains("item-discard-btn")) this.discardItem(itemData, category, itemElement);
      else if (e.target.classList.contains("item-trade-btn")) this.initiateTradeFromInventory(itemData, category);
    });
  }

  const characterPanel = window.domCacheManager.get("character-panel", ".character-panel");
  if (characterPanel) {
    characterPanel.addEventListener("mouseover", (e) => {
      const slot = e.target.closest(".equipment-slot");
      if (slot && slot.classList.contains("equipped")) this.showEquipmentTooltip(slot, e);
    });
    characterPanel.addEventListener("mouseout", (e) => {
      if (e.target.closest(".equipment-slot")) this.hideEquipmentTooltip();
    });
  }

  window.domCacheManager.get("btn-quick-send", "#btn-quick-send")?.addEventListener("click", () => this.executeQuickSend());
  const quickSendInput = window.domCacheManager.get("quick-send-input", "#quick-send-input");
  const enterToSendCheckbox = window.domCacheManager.get("enter-to-send-checkbox", "#enter-to-send-checkbox");
  if (quickSendInput && enterToSendCheckbox) {
    quickSendInput.addEventListener("keydown", (event) => {
      if (enterToSendCheckbox.checked && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.executeQuickSend();
      }
    });
    enterToSendCheckbox.addEventListener("change", () => this.saveEnterToSendState());
  }

  window.domCacheManager.get("btn-quick-commands", "#btn-quick-commands")?.addEventListener("click", (e) => {
    e.stopPropagation(); this.toggleQuickCommands();
  });
  window.domCacheManager.get("btn-action-options", "#btn-action-options")?.addEventListener("click", (e) => {
    e.stopPropagation(); this.toggleActionOptions();
  });

  const ActionOptionsPopup = window.domCacheManager.get("action-options-popup", "#action-options-popup");
  if (ActionOptionsPopup) {
    ActionOptionsPopup.addEventListener("click", (e) => {
      const sendButton = e.target.closest(".send-option-btn");
      const deleteButton = e.target.closest(".delete-option-btn");
      if (sendButton) {
        const actionText = sendButton.closest(".action-options-item").querySelector(".option-textarea").value.trim();
        if (actionText) { this.handleAction(actionText); this.hideActionOptions(); }
      } else if (deleteButton) {
        const listItem = deleteButton.closest(".action-options-item");
        const index = parseInt(listItem.dataset.optionIndex, 10);
        if (!isNaN(index)) {
          this.lastExtractedActions.splice(index, 1);
          this.showActionOptions();
          this.updateActionOptionsButtonState();
        }
      }
    });
  }

  window.domCacheManager.get("status-summary-button", "#status-summary-button")?.addEventListener("click", () => this.toggleStatusPopup());
  window.domCacheManager.get("status-effects-popup-close", "#status-effects-popup-close")?.addEventListener("click", () => this.toggleStatusPopup());
  window.domCacheManager.get("btn-toggle-thinking", "#btn-toggle-thinking")?.addEventListener("click", () => this.showThinkingOverlay());
  window.domCacheManager.get("btn-close-thinking", "#btn-close-thinking")?.addEventListener("click", () => this.hideThinkingOverlay());
  document.getElementById("thinking-tab-narrative")?.addEventListener("click", () => this._renderThinkingTab('narrative'));
  document.getElementById("thinking-tab-variable")?.addEventListener("click", () => this._renderThinkingTab('variable'));
  window.domCacheManager.get("btn-toggle-dm", "#btn-toggle-dm")?.addEventListener("click", () => this.toggleDanmakuOverlay());

  const navPlaceholder = window.domCacheManager.get("history-nav-placeholder", "#history-nav-placeholder");
  if (navPlaceholder) {
    navPlaceholder.addEventListener("click", (e) => {
      if (e.target.id === "btn-history-prev") this.viewPreviousMessage();
      if (e.target.id === "btn-history-next") this.viewNextMessage();
      if (e.target.id === "btn-history-return") this.returnToPresent();
    });
  }

  this.openInGameEditor = this.openInGameEditor.bind(this);
  this.closeInGameEditor = this.closeInGameEditor.bind(this);
  this.saveInGameEditor = this.saveInGameEditor.bind(this);
  window.domCacheManager.get("btn-open-editor", "#btn-open-editor")?.addEventListener("click", this.openInGameEditor);

  this.listenersBound = true;

  window.domCacheManager.get("btn-main-rollback", "#btn-main-rollback")?.addEventListener("click", () => this.performRollback());
  window.domCacheManager.get("btn-main-reroll", "#btn-main-reroll")?.addEventListener("click", () => this.performReroll());
  window.domCacheManager.get("btn-emergency-reset", "#btn-emergency-reset")?.addEventListener("click", () => this.emergencyReset());
},

//=========全局渲染函数==============
//渲染新数据
renderUI(data, snapshot = null) {
  console.log(
    "%c[TRACE-RENDERUI] 触发renderUI，传入的data:",
    "color: green;",
    data,
  );
  // 拦截器
  this._lastRenderUIHash = this._lastRenderUIHash || "";
  const uiHash = JSON.stringify(data);
  if (this._lastRenderUIHash === uiHash) {
    return;
  }
  this._lastRenderUIHash = uiHash;

  console.trace("[TRACE-RENDERUI] 调用栈（查看谁触发了renderUI）");
  if (!data) {
    console.warn("RenderUI 调用失败：没有提供数据。");
    return;
  }
  const updateText = (id, value, tierClass = null) => {
    // 抛弃 document.getElementById，利用按需机制：传入 key 和 selector
    const el = window.domCacheManager.get(id, `#${id}`);
    if (el) {
      el.innerText = value;
      if (tierClass) {
        el.className = el.className.replace(/text-gradient-glow|tier-[\w.-]+/g, "").trim();
        if (tierClass) {
          el.className = `${el.className} ${tierClass}`.trim();
        }
      }
    }
  };

  const xulieValue = this.SafeGetValue(data, "当前序列", "...");
  const tierClass = this.getTierClass(xulieValue);
  updateText("val-xulie", xulieValue, tierClass);
  // 更新抽屉面板（新增的）
  const playerName = this.SafeGetValue(data, "名称", "<User>");
  updateText("player-name", playerName, tierClass);
    const currentTimeEra =
    this.currentMvuState?.world_data?.当前时间纪元 ||
    this.SafeGetValue(data, "当前时间纪元", "...");
  updateText("val-jinian", currentTimeEra);

  // 💰 渲染货币条带：钱包 + 稳定长期收入/支出（按月聚合）
  const currencyEl = window.domCacheManager.get("val-currency", "#val-currency");
  if (currencyEl) {
    const wallet = data?.货币;
    const helper = window.CurrencyHelper;

    // ---- 1) 收集钱包面额 ----
    const walletSegs = [];
    if (wallet && typeof wallet === 'object') {
      const countryOrder = ['鲁恩王国', '弗萨克帝国', '因蒂斯共和国', '费内波特王国', '其他'];
      for (const country of countryOrder) {
        const group = wallet[country];
        if (!group || typeof group !== 'object') continue;
        for (const [name, value] of Object.entries(group)) {
          if (name === '$meta') continue;
          if (typeof value !== 'number' && typeof value !== 'string') continue;
          const num = Number(value);
          if (!Number.isFinite(num) || num === 0) continue;
          walletSegs.push(`${num} ${name}`);
        }
      }
    }

    // ---- 2) 聚合月入/月出（按币种分桶，按月统一周期）----
    const aggregateMonthly = (group) => {
      const buckets = {};
      if (!group || typeof group !== 'object' || !helper) return buckets;
      const PERIOD_TO_MONTH = { 天: 30, 周: 4, 月: 1, 年: 1 / 12 };
      for (const [n, entry] of Object.entries(group)) {
        if (n === '$meta') continue;
        if (!entry || typeof entry !== 'object') continue;
        const { value, currency } = helper.parseCapitalString(entry.金额);
        if (value <= 0) continue;
        const factor = PERIOD_TO_MONTH[entry.周期 || '月'];
        if (!factor) continue;
        const monthly = Math.round(value * factor);
        if (monthly === 0) continue;
        const trimmed = (currency || '').trim();
        const normalized = trimmed ? (helper.normalizeCurrencyName(trimmed) || trimmed) : '金镑';
        buckets[normalized] = (buckets[normalized] || 0) + monthly;
      }
      return buckets;
    };

    // 排序：已声明的 17 种按 schema 顺序，未识别（自定义）按字母序追加
    const orderedKeys = (buckets) => {
      const map = helper?.CURRENCY_PATH_MAP || {};
      const known = Object.keys(map).filter(c => c in buckets);
      const unknown = Object.keys(buckets).filter(c => !(c in map)).sort();
      return [...known, ...unknown];
    };

    const incomeBuckets = aggregateMonthly(data?.稳定长期收入);
    const expenseBuckets = aggregateMonthly(data?.稳定长期支出);
    const incomeKeys = orderedKeys(incomeBuckets);
    const expenseKeys = orderedKeys(expenseBuckets);

    // ---- 3) 拼装 HTML ----
    const html = [];

    // 钱包
    if (walletSegs.length === 0) {
      html.push('<span class="currency-empty">身无分文</span>');
    } else {
      walletSegs.forEach((seg, i) => {
        const last = i === walletSegs.length - 1;
        html.push(`<span class="currency-item${last ? ' last-in-group' : ''}">${seg}</span>`);
      });
    }

    // 月入
    if (incomeKeys.length > 0) {
      html.push('<span class="currency-section">月入</span>');
      incomeKeys.forEach((k, i) => {
        const last = i === incomeKeys.length - 1;
        html.push(`<span class="currency-item gain${last ? ' last-in-group' : ''}">+${incomeBuckets[k]} ${k}</span>`);
      });
    } else {
      html.push('<span class="currency-section currency-section-empty">月入：无</span>');
    }

    // 月出
    if (expenseKeys.length > 0) {
      html.push('<span class="currency-section">月出</span>');
      expenseKeys.forEach((k, i) => {
        const last = i === expenseKeys.length - 1;
        html.push(`<span class="currency-item loss${last ? ' last-in-group' : ''}">-${expenseBuckets[k]} ${k}</span>`);
      });
    } else {
      html.push('<span class="currency-section currency-section-empty">月出：无</span>');
    }

    currencyEl.innerHTML = html.join('');
  }

  const charge = Number(this.SafeGetValue(data, "消化进度", 0)).toFixed(2);
  const chargeText = window.domCacheManager.get("val-guimi-charge-text", "#val-guimi-charge-text");
  if (chargeText) chargeText.innerText = `${charge}%`;
  
  const chargeBar = window.domCacheManager.get("bar-guimi-charge", "#bar-guimi-charge");
  if (chargeBar) chargeBar.style.setProperty("--guimi-charge", `${charge}%`);

  this.updateTalentAndLinggen(data);

  // 🌟 狸猫换太子：劫持管线，将当前渲染的 stat_data 传给画师
  this.updateDisplayedAttributes(snapshot); 
  this.refreshEquipmentSlots(snapshot);
  // 【核心修正】移植“归墟”版的渲染逻辑
  const summaryTextEl = window.domCacheManager.get("status-summary-text", "#status-summary-text");
  const popupListEl = window.domCacheManager.get("status-effects-popup-list", "#status-effects-popup-list");

  // --- 新增：用以下整段逻辑替换掉原有的 statusKeys.map(...) 逻辑 ---
  if (summaryTextEl && popupListEl) {
    const statusesObj = this.SafeGetValue(data, "当前状态", {});
    const statusKeys = Object.keys(statusesObj).filter(
      (key) => key !== "$meta",
    );

    if (statusKeys.length > 0) {
      summaryTextEl.textContent = `当前有 ${statusKeys.length} 个状态效果`;
      // 同样使用新的渲染引擎，但可能需要适配popup的CSS样式
      popupListEl.innerHTML = statusKeys
        .map((key) => {
          const value = statusesObj[key];
          // 注意：新引擎生成的是 <li>，而旧popup可能需要的是 <div>，如果样式错乱，需要调整CSS或这里的HTML结构
          return this._getHtmlForStatus(key, value)
            .replace("<li", "<div")
            .replace("</li>", "</div>");
        })
        .join("");
    } else {
      summaryTextEl.textContent = "理智正常";
      popupListEl.innerHTML =
        '<div class="status-effect-item">当前无特殊状态效果。</div>';
    }
  }
},
//渲染历史快照数据
async renderStateAt(messageObject) {
  console.log(
    "%c[TRACE-RENDERSTATE] 调用 renderStateAt，传入的 messageObject.data:",
    "color: purple;",
    messageObject.data,
  );

  // 1. 校验（确保快照有效）
  if (!messageObject || !messageObject.data || !messageObject.data.stat_data) {
    console.warn("[TRACE-RENDERSTATE] 无效的快照，跳过渲染");
    return;
  }

  // 2. 避免重复渲染（性能优化）
  if (this.lastRenderedMessageId === messageObject.message_id) {
    console.log(`[性能优化] 已渲染过快照 ${messageObject.message_id}，跳过重复操作`);
    return;
  }

  // 3. 定义当前查看的快照 + 判断是否为活跃回合
  const currentViewSnapshot = messageObject;
  const lastSnapshot = this.chatHistoryCache.at(-1);
  const isActiveRound = currentViewSnapshot.message_id === (lastSnapshot?.message_id || "");
  console.log(
    `[回合类型] 当前ID: ${currentViewSnapshot.message_id}，活跃回合ID: ${lastSnapshot?.message_id}，是否活跃: ${isActiveRound}`,
  );

  this.currentMvuState = validateAndMigrateStatData(_.cloneDeep(messageObject.data));
  this.renderUI(this.currentMvuState.stat_data, currentViewSnapshot);

  // 💥【终极修复点】：强制声明这是“只读渲染” (传递第三个参数 true)！
  // 绝对禁止 UI 刷新时去重新提取剧情、线索等数据倒灌进 lastExtracted 缓存
  this.loadAndDisplayCurrentScene(currentViewSnapshot, null, true);

  const extractedModal = document.getElementById("extracted-content-modal");
  if (extractedModal?.style.display === "flex") {
    this._refreshExtractedContentModal(false);
  }

  // 8. 记录已渲染ID
  this.lastRenderedMessageId = messageObject.message_id;
  console.log(
    `[时间旅行] UI已刷新至消息: ${messageObject.message_id}（仅更新内存和UI，已彻底阻断数据倒灌）`,
  );
},

//============全局UI控制============

// 🚀 全局 UI 工具：终极弹窗挂载器
mountModalToTopLayer(modalElement, zIndex = "2147483640") {
  if (!modalElement) return;

  // 1. 赋予绝对制空权（预设极高的 Z-index）
  modalElement.style.zIndex = zIndex;

  // 2. 动态探测最顶层的“真·全屏容器”或 body
  const fullscreenEl =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement;
  const targetContainer = fullscreenEl ? fullscreenEl : document.body;

  // 3. 执行越狱挂载（如果已经在目标节点下，浏览器会自动忽略，不会重复渲染）
  if (modalElement.parentNode !== targetContainer) {
    targetContainer.appendChild(modalElement);
  }
},


