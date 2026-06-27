// 文件: SystemSettings.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L25618-27017: // =================================================================== ---

// ===================================================================
// ======系统设置功能（仅定期备份和流式，其他功能都耦合在上面了）=======
// =================================================================
// 持久化配置、系统设置面板的自动备份功能

// 系统设置入口
showSettingsModal() {
  this.openModal("settings-modal");
  const body = document.getElementById("settings-modal-body");
  if (!body) return;

  this.unbindSettingsModalListeners();

  const currentWidth = parseInt(this.widthSetting, 10);
  const currentHeight = parseInt(this.heightSetting, 10);

  // --- 替换原有的 bgOptionsHtml 生成逻辑 ---
  let bgListHtml = "";
  // 渲染系统图库
  if (GameDBManager.DB.backgrounds) {
    GameDBManager.DB.backgrounds.forEach((bgUrl) => {
      const isSelected = this.currentBackgroundId === bgUrl ? "selected-bg" : "";
      bgListHtml += `<div class="bg-item ${isSelected}" data-id="${bgUrl}"><img src="${encodeURI(bgUrl)}" alt="系统背景" /></div>`;
    });
  }
  // 渲染玩家自定义图库
  this.customBackgrounds.forEach((bg) => {
    const isSelected = this.currentBackgroundId === bg.id ? "selected-bg" : "";
    bgListHtml += `<div class="bg-item ${isSelected}" data-id="${bg.id}"><img src="${bg.data}" alt="${bg.name}" /><span class="bg-tag">自定义</span></div>`;
  });

  let fontOptionsHtml = "";
  for (const [key, data] of Object.entries(GameDBManager.DB.fontConfig)) {
    fontOptionsHtml += `<option value="${key}" ${this.currentFontClass === key ? "selected" : ""}>${data.name}</option>`;
  }

  // --- 核心修复：全量且纯净的 HTML 字符串 ---
  body.innerHTML = /* HTML */ `
    <div class="settings-container">

      <div class="panel-section panel-padded">
        <div class="section-title">变量结算副模型 (后台 API)</div>
        <div class="setting-item">
          <label class="setting-label" for="var-ai-custom-toggle">启用自定义 API (关闭则使用主模型)</label>
          <div class="setting-control">
            <label class="switch">
              <input type="checkbox" id="var-ai-custom-toggle" ${this.varAiUseCustom ? "checked" : ""} />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div id="var-ai-custom-container" style="display: ${this.varAiUseCustom ? 'block' : 'none'}; margin-top: 10px; padding: 10px; background: rgba(var(--rgb-bg-dark), 0.3); border-radius: 4px;">
          
          <div class="setting-item">
            <label class="setting-label">反代 URL</label>
            <div class="setting-control">
              <input type="text" id="var-ai-api-url" class="modal-input" placeholder="https://api.openai.com/v1" value="${this.varAiApiUrl || ''}" style="width: 100%;" />
            </div>
          </div>

          <div class="setting-item">
            <label class="setting-label">API Key</label>
            <div class="setting-control">
              <input type="password" id="var-ai-api-key" class="modal-input" placeholder="sk-..." value="${this.varAiApiKey || ''}" style="width: 100%;" />
            </div>
          </div>

          <div class="setting-item">
            <label class="setting-label">选择模型</label>
            <div class="setting-control" style="display: flex; gap: 5px;">
              <select id="var-ai-model-select" class="modal-input" style="flex: 1;">
                <option value="${this.varAiModel || ''}" selected>${this.varAiModel || '手动输入或获取列表'}</option>
              </select>
              <button id="btn-fetch-models" class="interaction-btn" style="padding: 0 10px; white-space: nowrap;">获取列表</button>
            </div>
          </div>
          <div class="setting-item" style="margin-top: -5px;">
             <div class="setting-control">
                 <input type="text" id="var-ai-model-input" class="modal-input" placeholder="或在此手动输入模型名" value="${this.varAiModel || ''}" style="width: 100%;" />
             </div>
          </div>

        </div>
      </div>

      <div class="panel-section appearance-section panel-padded">
        <div class="section-title">个性化设置</div>

        <div class="setting-item">
          <label
            class="setting-label"
            for="theme-toggle-checkbox"
            >浅色模式 (Light Mode)</label
          >
          <div class="setting-control">
            <label class="switch">
              <input
                type="checkbox"
                id="theme-toggle-checkbox"
                ${this.isLightTheme ? "checked" : ""}
              />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        

        <div class="setting-item">
          <label class="setting-label">正文字体</label>
          <div class="setting-control">
            <select id="font-select">
              ${fontOptionsHtml}
            </select>
          </div>
        </div>

        <div class="setting-item">
          <label
            class="setting-label"
            for="disable-animations-toggle"
            >禁用所有特效 (提升性能)</label
          >
          <div class="setting-control">
            <label class="switch"
              ><input
                type="checkbox"
                id="disable-animations-toggle"
                ${this.isAnimationsDisabled
                  ? "checked"
                  : ""} /><span class="slider"></span
            ></label>
          </div>
        </div>
      </div>

      <div class="panel-section panel-padded">
        <div class="section-title">界面背景</div>
        <div class="setting-item">
          <label class="setting-label">切换背景</label>
            <div id="bg-scroll-container" class="bg-scroll-container">
              ${bgListHtml}
            </div>
        </div>

        <div class="setting-item">
          <button id="btn-import-bg" class="interaction-btn btn-sm-auto">
            导入自定义图片
          </button>
          <button id="btn-delete-bg" class="interaction-btn btn-sm-auto warn-btn">
            删除自定义图片
          </button>
        </div>

        <div class="setting-item">
          <label class="setting-label" for="opacity-slider">阅读区背景不透明度</label>
          <div class="setting-control">
            <input
              type="range"
              id="opacity-slider"
              class="font-slider"
              min="0"
              max="1"
              step="0.05"
              value="${this.mainContentOpacity}"
            />
            <input
              type="number"
              id="opacity-input"
              class="modal-input center-input"
              min="0"
              max="1"
              step="0.05"
              value="${this.mainContentOpacity}"
            />
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label" for="blur-slider">阅读区背景模糊度</label>
          <div class="setting-control">
            <input
              type="range"
              id="blur-slider"
              class="font-slider"
              min="0"
              max="20"
              step="1"
              value="${this.mainContentBlur}"
            />
            <input
              type="number"
              id="blur-input"
              class="modal-input center-input"
              min="0"
              max="20"
              step="1"
              value="${this.mainContentBlur}"
            />
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label" for="auto-bg-checkbox">背景自动随机切换</label>
          <div class="setting-control">
            <label class="switch">
              <input
                type="checkbox"
                id="auto-bg-checkbox"
                ${this.isAutoRandomBg ? "checked" : ""}
              />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label" for="auto-bg-interval">自动切换间隔 (分钟)</label>
          <div class="setting-control">
            <input
              type="number"
              id="auto-bg-interval"
              class="modal-input center-input"
              min="1"
              max="1440"
              value="${this.randomBgInterval}"
            />
          </div>
        </div>
      </div>

      <div class="panel-section panel-padded">
        <div class="section-title">布局与尺寸</div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="fullscreen-layout-toggle"
            >全屏布局 (占满窗口)</label>
          <div class="setting-control">
            <label class="switch"
              ><input
                type="checkbox"
                id="fullscreen-layout-toggle"
                ${this.isFullScreenLayout
                  ? "checked"
                  : ""} /><span class="slider"></span
            ></label>
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label" for="width-slider"
            >界面宽度</label
          >
          <div class="setting-control">
            <input
              type="range"
              id="width-slider"
              class="font-slider"
              min="800"
              max="2500"
              step="10"
              value="${currentWidth}"
              ${this.isFullScreenLayout ? "disabled" : ""}
            />
            <input
              type="number"
              id="width-input"
              class="modal-input center-input"
              min="800"
              max="2500"
              value="${currentWidth}"
            />
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label" for="height-slider"
            >界面高度</label
          >
          <div class="setting-control">
            <input
              type="range"
              id="height-slider"
              class="font-slider"
              min="600"
              max="1200"
              step="10"
              value="${currentHeight}"
              ${this.isFullScreenLayout ? "disabled" : ""}
            />
            <input
              type="number"
              id="height-input"
              class="modal-input center-input"
              min="600"
              max="1200"
              value="${currentHeight}"
            />
          </div>
        </div>
      </div>

      <div class="panel-section panel-padded">
        <div class="section-title">功能设置</div>
        <div class="setting-item">
          <label class="setting-label" for="font-size-slider"
            >正文字体大小</label
          >
          <div class="setting-control">
            <input
              type="range"
              id="font-size-slider"
              class="font-slider"
              min="12"
              max="20"
              step="1"
              value="${this.fontSize}"
            />
            <input
              type="number"
              id="font-size-input"
              class="modal-input center-input"
              min="12"
              max="20"
              value="${this.fontSize}"
            />
          </div>
        </div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="streaming-toggle-checkbox"
            >开启流式传输</label
          >
          <div class="setting-control">
            <label class="switch"
              ><input
                type="checkbox"
                id="streaming-toggle-checkbox"
                ${this.isStreamingEnabled
                  ? "checked"
                  : ""} /><span class="slider"></span
            ></label>
          </div>
        </div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="fullscreen-loading-toggle-checkbox"
            >启用全屏加载动画</label
          >
          <div class="setting-control">
            <label class="switch"
              ><input
                type="checkbox"
                id="fullscreen-loading-toggle-checkbox"
                ${this.isFullScreenLoadingEnabled
                  ? "checked"
                  : ""} /><span class="slider"></span
            ></label>
          </div>
        </div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="floating-editor-toggle-checkbox"
            >悬浮变量更新器[实时]</label
          >
          <div class="setting-control">
            <label class="switch"
              ><input
                type="checkbox"
                id="floating-editor-toggle-checkbox"
                ${this.isFloatingEditorEnabled
                  ? "checked"
                  : ""} /><span class="slider"></span
            ></label>
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label" for="ai-context-config-toggle-checkbox">变量可见性配置[锁]</label>
          <div class="setting-control">
            <label class="switch"><input type="checkbox" id="ai-context-config-toggle-checkbox" ${this.isAiContextConfigEnabled ? "checked" : ""} /><span class="slider"></span></label>
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label" for="variable-panel-toggle-checkbox">AI变量修复[字]</label>
          <div class="setting-control">
            <label class="switch"><input type="checkbox" id="variable-panel-toggle-checkbox" ${this.isVariablePanelToggleEnabled ? "checked" : ""} /><span class="slider"></span></label>
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label" for="battle-floating-btn-checkbox">战斗系统开关[剑]</label>
          <div class="setting-control">
            <label class="switch"><input type="checkbox" id="battle-floating-btn-checkbox" ${this.isBattleFloatingBtnEnabled ? "checked" : ""} /><span class="slider"></span></label>
          </div>
        </div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="danmaku-style-toggle-checkbox"
            >弹幕风格开关</label
          >
          <div class="setting-control">
            <label class="switch">
              <input
                type="checkbox"
                id="danmaku-style-toggle-checkbox"
                ${this.isDanmakuEntriesEnabled
                  ? "checked"
                  : ""} /><span class="slider"></span
            ></label>
          </div>
        </div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="recent-events-input"
            >记忆中枢-近期事件数量<span style="font-size:0.8em;color:var(--text-muted);font-weight:normal;margin-left:6px;">(不推荐超过30)</span></label
          >
          <div class="setting-control">
            <input
              type="number"
              id="recent-events-input"
              class="modal-input center-input"
              min="1"
              max="100"
              value="${this.recentEventsCount}"
            />
          </div>
        </div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="recent-important-events-input"
            >记忆中枢-高优近期事件数量<span style="font-size:0.8em;color:var(--text-muted);font-weight:normal;margin-left:6px;">(不推荐超过20)</span></label
          >
          <div class="setting-control">
            <input
              type="number"
              id="recent-important-events-input"
              class="modal-input center-input"
              min="1"
              max="100"
              value="${this.recentImportantEventsCount ?? 3}"
            />
          </div>
        </div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="core-memory-important-toggle"
            >核心记忆高强度扫描</label
          >
          <div class="setting-control">
            <label class="switch"
              ><input
                type="checkbox"
                id="core-memory-important-toggle"
                ${(this.isCoreMemoryImportant ?? true) ? "checked" : ""} /><span class="slider"></span
            ></label>
          </div>
        </div>

        <div class="setting-item">
          <label
            class="setting-label"
            for="max-companion-slots-input"
            >星界之门-最大伙伴数量</label
          >
          <div class="setting-control">
            <input
              type="number"
              id="max-companion-slots-input"
              class="modal-input center-input"
              min="1"
              max="10"
              value="${this.maxCompanionSlots}"
            />
          </div>
        </div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="max-ssr-companions-input"
            >星界之门-最大SSR伙伴数量</label
          >
          <div class="setting-control">
            <input
              type="number"
              id="max-ssr-companions-input"
              class="modal-input center-input"
              min="0"
              max="5"
              value="${this.maxSSRCompanions}"
            />
          </div>
        </div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="digestion-max-delta-input"
            >消化进度单次变动上限</label
          >
          <div class="setting-control">
            <input
              type="number"
              id="digestion-max-delta-input"
              class="modal-input center-input"
              min="1"
              max="100"
              value="${window.DIGESTION_MAX_DELTA ?? 3}"
            />
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label">浏览器全屏模式</label>
          <div class="setting-control">
            <button
              id="btn-toggle-fullscreen"
              class="interaction-btn btn-sm-auto"
            >
              切换全屏
            </button>
          </div>
        </div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="disable-console-toggle"
            >禁用控制台日志 (提升性能)</label
          >
          <div class="setting-control">
            <label class="switch"
              ><input
                type="checkbox"
                id="disable-console-toggle"
                ${this.isConsoleDisabled
                  ? "checked"
                  : ""} /><span class="slider"></span
            ></label>
          </div>
        </div>
      </div>

      <div class="panel-section panel-padded">
        <div class="section-title">定期自动备份</div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="periodic-backup-toggle"
            >启用定期备份</label
          >
          <div class="setting-control">
            <label class="switch"
              ><input
                type="checkbox"
                id="periodic-backup-toggle"
                ${this.isPeriodicBackupEnabled
                  ? "checked"
                  : ""} /><span class="slider"></span
            ></label>
          </div>
        </div>
        <div class="setting-item">
          <label
            class="setting-label"
            for="periodic-backup-interval"
            >备份间隔（回合数）</label
          >
          <div class="setting-control">
            <input
              type="number"
              id="periodic-backup-interval"
              class="modal-input center-input"
              min="1"
              max="100"
              value="${this.periodicBackupInterval}"
            />
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label">当前计数</label>
          <div class="setting-control">
            <span id="periodic-backup-count"
              >${this.turnsSinceLastBackup} /
              ${this.periodicBackupInterval}</span
            >
          </div>
        </div>
      </div>
    </div>
  `;

  this.bindSettingsModalListeners();
  this.updateBgPreview(this.currentBackgroundId);
},
// 为设置面板内的控件绑定事件
bindSettingsModalListeners() {
  const body = document.getElementById("settings-modal-body");
  // 【核心修复】重新添加“哨兵”检查，防止重复绑定
  if (!body || body.dataset.listenersBound) return;
  body.dataset.listenersBound = "true";

  // ====== 新增：记忆分流设置绑定 ======
  const recentImportantEventsInput = document.getElementById(
    "recent-important-events-input",
  );
  if (recentImportantEventsInput) {
    recentImportantEventsInput.addEventListener("change", (e) => {
      const count = parseInt(e.target.value, 10);
      // 验证输入有效性，最大值可以跟你的 recentEventsCount 保持一致
      if (!isNaN(count) && count >= 1 && count <= 100) {
        this.recentImportantEventsCount = count;
        this.saveMemorySplitSettings();
        this.showTemporaryMessage(
          `高优近期事件数量已设为 ${count} 条`,
        );
      } else {
        e.target.value = this.recentImportantEventsCount ?? 3; // 恢复原值
      }
    });
  }

  const coreMemoryImportantToggle = document.getElementById(
    "core-memory-important-toggle",
  );
  if (coreMemoryImportantToggle) {
    coreMemoryImportantToggle.addEventListener("change", (e) => {
      this.isCoreMemoryImportant = e.target.checked;
      this.saveMemorySplitSettings();
      this.showTemporaryMessage(
        `核心记忆高强度扫描已${this.isCoreMemoryImportant ? "开启" : "关闭"}`,
      );
    });
  }

  document
    .getElementById("btn-import-bg")
    ?.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e) => this.handleBgImport(e);
      input.click();
    });

  // --- 替换原有的 select 监听，改为容器事件委托 ---
  const bgScrollContainer = document.getElementById("bg-scroll-container");
  if (bgScrollContainer) {
    bgScrollContainer.addEventListener("click", (e) => {
      const bgItem = e.target.closest(".bg-item");
      if (!bgItem) return;

      const selectedId = bgItem.dataset.id;
      this.applyBackground(selectedId);
      this.saveBackgrounds();

      // 更新 UI 选中状态
      bgScrollContainer.querySelectorAll(".bg-item").forEach(el => el.classList.remove("selected-bg"));
      bgItem.classList.add("selected-bg");

      // 如果玩家手动点击了背景，且开着定时器，我们重置一下计时器
      if (this.isAutoRandomBg) this.startAutoBgTimer();
    });
  }

  // --- 新增：自动切换开关事件 ---
  document.getElementById("auto-bg-checkbox")?.addEventListener("change", (e) => {
    this.isAutoRandomBg = e.target.checked;
    this.saveBackgrounds();
    this.isAutoRandomBg ? this.startAutoBgTimer() : this.stopAutoBgTimer();
  });

  // --- 新增：自动切换时间输入事件 ---
  document.getElementById("auto-bg-interval")?.addEventListener("change", (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) val = 1; // 最小1分钟
    e.target.value = val;
    
    this.randomBgInterval = val;
    this.saveBackgrounds();
    if (this.isAutoRandomBg) this.startAutoBgTimer(); // 重置定时器
  });

  // --- 修改：删除按钮判断 ---
  document.getElementById("btn-delete-bg")?.addEventListener("click", () => {
    // 仅允许删除自定义库里存在的图
    const isCustom = this.customBackgrounds.some(bg => bg.id === this.currentBackgroundId);
    if (!isCustom) {
      this.showTemporaryMessage("只能删除玩家导入的自定义背景。");
      return;
    }
    this.deleteCurrentBackground();
  });

  // 透明度联动与实时应用
  const opacitySlider = document.getElementById("opacity-slider");
  const opacityInput = document.getElementById("opacity-input");

  if (opacitySlider && opacityInput) {
    const updateOpacity = (val) => {
      let num = parseFloat(val);
      if (isNaN(num)) num = 0.5;
      if (num < 0) num = 0;
      if (num > 1) num = 1;
      
      this.mainContentOpacity = num;
      opacitySlider.value = num;
      opacityInput.value = num;
      this.applyMainContentStyle(); // 实时渲染
      this.saveBackgrounds();       // 存盘（或者你用的其它 save 方法）
    };
    opacitySlider.addEventListener("input", (e) => updateOpacity(e.target.value));
    opacityInput.addEventListener("change", (e) => updateOpacity(e.target.value));
  }

  // 模糊度联动与实时应用
  const blurSlider = document.getElementById("blur-slider");
  const blurInput = document.getElementById("blur-input");

  if (blurSlider && blurInput) {
    const updateBlur = (val) => {
      let num = parseInt(val, 10);
      if (isNaN(num)) num = 3;
      if (num < 0) num = 0;
      if (num > 20) num = 20;
      
      this.mainContentBlur = num;
      blurSlider.value = num;
      blurInput.value = num;
      this.applyMainContentStyle(); 
      this.saveBackgrounds();       
    };
    blurSlider.addEventListener("input", (e) => updateBlur(e.target.value));
    blurInput.addEventListener("change", (e) => updateBlur(e.target.value));
  }

  // --- 个性化设置事件绑定 (已更新) ---

  document
    .getElementById("font-select")
    ?.addEventListener("change", (e) => {
      // 过滤选项值中的空格和非法字符（下拉框选项可能意外包含空格）
      const safeValue = e.target.value.replace(/\s+/g, ""); // 移除所有空格
      if (/^[\w-]+$/.test(safeValue)) {
        // 验证是否为有效类名
        this.applyFont(safeValue);
        this.saveFont(safeValue); // 传入净化后的值去存储
      } else {
        console.warn(
          `无效的字体选项值: ${e.target.value}，已忽略`,
        );
      }
    });

  // --- 禁用动画开关事件绑定 (新增) ---
  const disableAnimationsToggle = document.getElementById(
    "disable-animations-toggle",
  );
  if (disableAnimationsToggle) {
    disableAnimationsToggle.addEventListener("change", (e) => {
      this.isAnimationsDisabled = e.target.checked;
      this.toggleSystemAnimations(this.isAnimationsDisabled);
      this.saveAnimationsState();
      this.showTemporaryMessage(
        `全局视觉特效已${this.isAnimationsDisabled ? "禁用" : "恢复"}`,
      );
    });
  }

  // --- 原有事件绑定 ---
  const fontSlider = document.getElementById("font-size-slider");
  const fontInput = document.getElementById("font-size-input");
  const updateFontSize = (size) => {
    const newSize = Math.max(12, Math.min(20, parseInt(size, 10)));
    if (isNaN(newSize)) return;
    this.applyFontSize(newSize);
    if (fontSlider) fontSlider.value = newSize;
    if (fontInput) fontInput.value = newSize;
  };
  if (fontSlider) {
    fontSlider.addEventListener("input", (e) =>
      updateFontSize(e.target.value),
    );
    fontSlider.addEventListener("change", () =>
      this.saveFontSize(),
    );
  }
  if (fontInput) {
    fontInput.addEventListener("change", (e) => {
      updateFontSize(e.target.value);
      this.saveFontSize();
    });
  }

  const widthSlider = document.getElementById("width-slider");
  const widthInput = document.getElementById("width-input");
  const heightSlider = document.getElementById("height-slider");
  const heightInput = document.getElementById("height-input");
  const fullscreenLayoutToggle = document.getElementById(
    "fullscreen-layout-toggle",
  );

  const updateWidth = (width) => {
    const newWidth = Math.max(
      800,
      Math.min(2500, parseInt(width, 10)),
    );
    if (isNaN(newWidth)) return;
    this.widthSetting = `${newWidth}px`;
    if (widthSlider) widthSlider.value = newWidth;
    if (widthInput) widthInput.value = newWidth;
    this.applyDimensions();
  };
  const updateHeight = (height) => {
    const newHeight = Math.max(
      600,
      Math.min(1200, parseInt(height, 10)),
    );
    if (isNaN(newHeight)) return;
    this.heightSetting = `${newHeight}px`;
    if (heightSlider) heightSlider.value = newHeight;
    if (heightInput) heightInput.value = newHeight;
    this.applyDimensions();
  };

  if (widthSlider) {
    widthSlider.addEventListener("input", (e) =>
      updateWidth(e.target.value),
    );
    widthSlider.addEventListener("change", () =>
      this.saveDimensions(),
    );
  }
  if (widthInput) {
    widthInput.addEventListener("change", (e) => {
      updateWidth(e.target.value);
      this.saveDimensions();
    });
  }
  if (heightSlider) {
    heightSlider.addEventListener("input", (e) =>
      updateHeight(e.target.value),
    );
    heightSlider.addEventListener("change", () =>
      this.saveDimensions(),
    );
  }
  if (heightInput) {
    heightInput.addEventListener("change", (e) => {
      updateHeight(e.target.value);
      this.saveDimensions();
    });
  }
  if (fullscreenLayoutToggle) {
    fullscreenLayoutToggle.addEventListener("change", (e) => {
      this.isFullScreenLayout = e.target.checked;
      this.applyDimensions();
      this.saveDimensions();
    });
  }

  // --- 【新增】主题开关事件绑定 ---
  const themeToggleCheckbox = document.getElementById(
    "theme-toggle-checkbox",
  );
  if (themeToggleCheckbox) {
    // 确保初始化时状态正确
    this.applyTheme(this.isLightTheme);

    themeToggleCheckbox.addEventListener("change", (e) => {
      this.isLightTheme = e.target.checked;
      this.applyTheme(this.isLightTheme);

      // 假设你有保存设置的方法
      if (typeof this.saveThemeState === "function")
        this.saveThemeState();
      this.showTemporaryMessage(
        `已切换至${this.isLightTheme ? "浅色" : "暗色"}模式`,
      );
    });
  }

  // 【新增】禁用控制台日志开关事件绑定
  const disableConsoleToggle = document.getElementById(
    "disable-console-toggle",
  );
  if (disableConsoleToggle) {
    disableConsoleToggle.addEventListener("change", (e) => {
      this.isConsoleDisabled = e.target.checked;
      this.toggleConsoleLogs(this.isConsoleDisabled);
      // 假设你有一个 saveConsoleState 的方法来保存设置，没有的话参考其他项写一个
      if (typeof this.saveConsoleState === "function")
        this.saveConsoleState();
      this.showTemporaryMessage(
        `控制台日志已${this.isConsoleDisabled ? "禁用" : "恢复"}`,
      );
    });
  }

  const streamingCheckbox = document.getElementById(
    "streaming-toggle-checkbox",
  );
  const fullscreenLoadingCheckbox = document.getElementById(
    "fullscreen-loading-toggle-checkbox",
  );
  const fullscreenBtn = document.getElementById(
    "btn-toggle-fullscreen",
  );

  if (streamingCheckbox) {
    streamingCheckbox.addEventListener("change", (e) => {
      this.isStreamingEnabled = e.target.checked;
      this.saveStreamingState();
      this.showTemporaryMessage(
        `流式传输已${this.isStreamingEnabled ? "开启" : "关闭"}`,
      );
    });
  }
  if (fullscreenLoadingCheckbox) {
    fullscreenLoadingCheckbox.addEventListener("change", (e) => {
      this.isFullScreenLoadingEnabled = e.target.checked;
      this.saveFullScreenLoadingState();
      this.showTemporaryMessage(
        `全屏加载动画已${this.isFullScreenLoadingEnabled ? "开启" : "关闭"}`,
      );
    });
  }

  const floatingEditorCheckbox = document.getElementById(
    "floating-editor-toggle-checkbox",
  );
  if (floatingEditorCheckbox) {
    floatingEditorCheckbox.addEventListener("change", (e) => {
      this.isFloatingEditorEnabled = e.target.checked;
      this.saveFloatingEditorState();
      // 控制悬浮编辑器按钮的显示/隐藏
      if (
        typeof floatingEditorInstance !== "undefined" &&
        floatingEditorInstance
      ) {
        floatingEditorInstance.setEnabled(
          this.isFloatingEditorEnabled,
        );
      }
      this.showTemporaryMessage(
        `悬浮变量更新器已${this.isFloatingEditorEnabled ? "开启" : "关闭"}`,
      );
    });
  }

  // 三个按钮的开关实时点击事件
  const aiContextCheckbox = document.getElementById("ai-context-config-toggle-checkbox");
  if (aiContextCheckbox) {
    aiContextCheckbox.addEventListener("change", (e) => {
      this.isAiContextConfigEnabled = e.target.checked;
      this.saveAiContextConfigState();
      const btn = document.getElementById('ai-context-config-toggle');
      if (btn) btn.style.display = this.isAiContextConfigEnabled ? 'flex' : 'none';
      this.showTemporaryMessage(`变量可见性按钮已${this.isAiContextConfigEnabled ? "开启" : "隐藏"}`);
    });
  }

  const variablePanelCheckbox = document.getElementById("variable-panel-toggle-checkbox");
  if (variablePanelCheckbox) {
    variablePanelCheckbox.addEventListener("change", (e) => {
      this.isVariablePanelToggleEnabled = e.target.checked;
      this.saveVariablePanelToggleState();
      const btn = document.getElementById('variable-panel-toggle');
      if (btn) btn.style.display = this.isVariablePanelToggleEnabled ? 'flex' : 'none';
      this.showTemporaryMessage(`AI变量修复按钮已${this.isVariablePanelToggleEnabled ? "开启" : "隐藏"}`);
    });
  }

  const battleFloatingCheckbox = document.getElementById("battle-floating-btn-checkbox");
  if (battleFloatingCheckbox) {
    battleFloatingCheckbox.addEventListener("change", (e) => {
      this.isBattleFloatingBtnEnabled = e.target.checked;
      this.saveBattleFloatingBtnState();
      const btn = document.getElementById('battle-floating-btn');
      if (btn) btn.style.display = this.isBattleFloatingBtnEnabled ? '' : 'none';
      this.showTemporaryMessage(`战斗系统悬浮按钮已${this.isBattleFloatingBtnEnabled ? "开启" : "隐藏"}`);
    });
  }

  // --- 定义目标世界书和条目，方便管理 ---
  const WORLD_BOOK_NAME = WorldbookManager.PRIMARY_BOOK; // 你的世界书名
  const DANMAKU_CORE_ENTRIES = ["【系统】弹幕风格", "【系统】弹幕框架", "【系统】弹幕触发"]; // 弹幕核心三件套
  const FORMAT_ENTRY_NORMAL = "【系统】格式要求"; // 普通格式条目
  const FORMAT_ENTRY_DANMAKU = "【系统】格式要求-弹幕"; // 弹幕专用格式条目

  // 获取 checkbox 元素
  const danmakuStyleCheckbox = document.getElementById(
    "danmaku-style-toggle-checkbox",
  );

  if (danmakuStyleCheckbox) {
    (async () => {
      await this.loadDanmakuState();
      danmakuStyleCheckbox.checked = this.isDanmakuEntriesEnabled;
    })();

    danmakuStyleCheckbox.addEventListener("change", async (e) => {
      const isDanmakuEnabled = e.target.checked;
      this.isDanmakuEntriesEnabled = isDanmakuEnabled;
      await this.saveDanmakuState();

      try {
        // 注意：这里假设 updateWorldbookWith 已经在全局或当前上下文中定义
        await updateWorldbookWith(
          WORLD_BOOK_NAME,
          (currentEntries) => {
            return currentEntries.map((entry) => {
              if (
                DANMAKU_CORE_ENTRIES.includes(
                  entry.name,
                )
              ) {
                return {
                  ...entry,
                  enabled: isDanmakuEnabled,
                };
              }
              if (entry.name === FORMAT_ENTRY_DANMAKU) {
                return {
                  ...entry,
                  enabled: isDanmakuEnabled,
                };
              }
              if (entry.name === FORMAT_ENTRY_NORMAL) {
                return {
                  ...entry,
                  enabled: !isDanmakuEnabled,
                };
              }
              return entry;
            });
          },
        );

        const statusText = isDanmakuEnabled ? "开启" : "关闭";
        this.showTemporaryMessage(
          `弹幕模式已${statusText}，相关格式已自动切换。`,
        );
      } catch (error) {
        console.error("更新世界书条目失败:", error);
        this.showTemporaryMessage(
          "操作失败，请检查控制台错误信息。",
          "error",
        );
        this.isDanmakuEntriesEnabled = !isDanmakuEnabled;
        e.target.checked = !isDanmakuEnabled;
      }
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", () =>
      this.toggleFullScreen(),
    );
  }

  const recentEventsInput = document.getElementById(
    "recent-events-input",
  );
  if (recentEventsInput) {
    recentEventsInput.addEventListener("change", (e) => {
      const count = parseInt(e.target.value, 10);
      if (!isNaN(count) && count >= 1 && count <= 100) {
        this.recentEventsCount = count;
        this.saveRecentEventsCount();
        this.showTemporaryMessage(
          `近期事件发送数量已设为 ${count} 条`,
        );
      } else {
        e.target.value = this.recentEventsCount; // 如果输入无效则恢复原值
      }
    });
  }

  // 【新增】伙伴数量限制设置
  const maxCompanionSlotsInput = document.getElementById(
    "max-companion-slots-input",
  );
  if (maxCompanionSlotsInput) {
    maxCompanionSlotsInput.addEventListener("change", (e) => {
      const slots = parseInt(e.target.value, 10);
      if (!isNaN(slots) && slots >= 1 && slots <= 10) {
        this.maxCompanionSlots = slots;
        this.saveCompanionLimitSettings();
        this.showTemporaryMessage(
          `最大伙伴数量已设为 ${slots}`,
        );
      } else {
        e.target.value = this.maxCompanionSlots; // 如果输入无效则恢复原值
      }
    });
  }

  const maxSSRCompanionsInput = document.getElementById(
    "max-ssr-companions-input",
  );
  if (maxSSRCompanionsInput) {
    maxSSRCompanionsInput.addEventListener("change", (e) => {
      const ssrLimit = parseInt(e.target.value, 10);
      if (!isNaN(ssrLimit) && ssrLimit >= 0 && ssrLimit <= 5) {
        this.maxSSRCompanions = ssrLimit;
        this.saveCompanionLimitSettings();
        this.showTemporaryMessage(
          `最大SSR伙伴数量已设为 ${ssrLimit}`,
        );
      } else {
        e.target.value = this.maxSSRCompanions; // 如果输入无效则恢复原值
      }
    });
  }

  // 【新增】消化进度单次变动上限设置
  const digestionMaxDeltaInput = document.getElementById(
    "digestion-max-delta-input",
  );
  if (digestionMaxDeltaInput) {
    digestionMaxDeltaInput.addEventListener("change", (e) => {
      const delta = parseInt(e.target.value, 10);
      if (!isNaN(delta) && delta >= 1 && delta <= 100) {
        window.DIGESTION_MAX_DELTA = delta;
        this.saveDigestionMaxDelta();
        this.showTemporaryMessage(
          `消化进度单次变动上限已设为 ${delta}`,
        );
      } else {
        e.target.value = window.DIGESTION_MAX_DELTA ?? 3; // 输入无效则恢复
      }
    });
  }

  // --- 定期自动备份设置事件绑定 ---
  const periodicBackupToggle = document.getElementById(
    "periodic-backup-toggle",
  );
  const periodicBackupInterval = document.getElementById(
    "periodic-backup-interval",
  );

  if (periodicBackupToggle) {
    periodicBackupToggle.addEventListener("change", async (e) => {
      this.isPeriodicBackupEnabled = e.target.checked;
      await this.savePeriodicBackupSettings();
      this.showTemporaryMessage(
        `定期自动备份已${this.isPeriodicBackupEnabled ? "开启" : "关闭"}`,
      );
      // 更新计数显示
      const countSpan = document.getElementById(
        "periodic-backup-count",
      );
      if (countSpan) {
        countSpan.textContent = `${this.turnsSinceLastBackup} / ${this.periodicBackupInterval}`;
      }
    });
  }

  if (periodicBackupInterval) {
    periodicBackupInterval.addEventListener("change", async (e) => {
      const interval = parseInt(e.target.value, 10);
      if (!isNaN(interval) && interval >= 1 && interval <= 100) {
        this.periodicBackupInterval = interval;
        await this.savePeriodicBackupSettings();
        this.showTemporaryMessage(
          `备份间隔已设为 ${interval} 回合`,
        );
        // 更新计数显示
        const countSpan = document.getElementById(
          "periodic-backup-count",
        );
        if (countSpan) {
          countSpan.textContent = `${this.turnsSinceLastBackup} / ${this.periodicBackupInterval}`;
        }
      } else {
        e.target.value = this.periodicBackupInterval; // 无效输入恢复原值
      }
    });
  }

  // ==========================================
  // --- 新增：变量 AI 设置面板交互 ---
  // ==========================================
  
  // 1. 开关切换事件
  document.getElementById("var-ai-custom-toggle")?.addEventListener("change", async (e) => {
    this.varAiUseCustom = e.target.checked;
    const container = document.getElementById("var-ai-custom-container");
    if (container) {
      container.style.display = this.varAiUseCustom ? "block" : "none";
    }
    await this.saveVariableAISettings();
  });

  // 2. 文本框实时保存逻辑
  const saveVariableInputs = async () => {
    this.varAiApiUrl = document.getElementById("var-ai-api-url")?.value.trim() || "";
    this.varAiApiKey = document.getElementById("var-ai-api-key")?.value.trim() || "";
    this.varAiModel = document.getElementById("var-ai-model-input")?.value.trim() || "";
    await this.saveVariableAISettings();
  };

  document.getElementById("var-ai-api-url")?.addEventListener("change", saveVariableInputs);
  document.getElementById("var-ai-api-key")?.addEventListener("change", saveVariableInputs);
  document.getElementById("var-ai-model-input")?.addEventListener("change", saveVariableInputs);

  // 3. 模型下拉框选择同步
  document.getElementById("var-ai-model-select")?.addEventListener("change", (e) => {
    const modelInput = document.getElementById("var-ai-model-input");
    if (modelInput) {
      modelInput.value = e.target.value;
      saveVariableInputs();
    }
  });

  // 4. 获取模型列表按钮事件 (带强力直连兜底)
  document.getElementById("btn-fetch-models")?.addEventListener("click", async (e) => {
    const fetchBtn = e.target;
    const apiUrl = document.getElementById("var-ai-api-url")?.value.trim();
    const apiKey = document.getElementById("var-ai-api-key")?.value.trim();
    const modelSelect = document.getElementById("var-ai-model-select");
    const modelInput = document.getElementById("var-ai-model-input");

    if (!apiUrl) {
      this.showTemporaryMessage("请先填写反代 URL");
      return;
    }

    fetchBtn.textContent = "获取中...";
    fetchBtn.disabled = true;

    try {
      let models = [];

      // 尝试途径 A：检查你的 TavernHelper 里是否真的挂载了它
      if (typeof window.TavernHelper?.getModelList === "function") {
        models = await window.TavernHelper.getModelList({ apiurl: apiUrl, key: apiKey });
      } 
      // 尝试途径 B：检查是否挂载在全局 window 上
      else if (typeof window.getModelList === "function") {
        models = await window.getModelList({ apiurl: apiUrl, key: apiKey });
      } 
      // 🚀 终极防弹途径 C：无视酒馆 API，直接发标准 OpenAI 格式 HTTP 请求
      else {
        console.log("[变量AI] 未检测到酒馆原生模型获取方法，触发直连 Fetch...");
        
        // 自动清洗 URL，确保指向基础目录 (兼容玩家不小心填了 /chat/completions)
        const cleanUrl = apiUrl.endsWith('/chat/completions') ? apiUrl.replace('/chat/completions', '') : apiUrl;
        const baseUrl = cleanUrl.endsWith('/') ? cleanUrl.slice(0, -1) : cleanUrl;
        
        const response = await fetch(`${baseUrl}/models`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        });
        
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const resData = await response.json();
        
        // 解析 OpenAI 标准格式: { data: [ { id: "model-name" }, ... ] }
        if (resData && Array.isArray(resData.data)) {
          models = resData.data.map(m => m.id);
        } else {
          throw new Error("API 返回格式不符合 OpenAI 标准规范");
        }
      }

      // --- 下方的 UI 更新逻辑保持不变 ---
      if (models && models.length > 0) {
        if (modelSelect) {
          modelSelect.innerHTML = ""; // 清空旧列表
          models.forEach(m => {
            const option = document.createElement("option");
            option.value = m;
            option.textContent = m;
            if (m === this.varAiModel) option.selected = true;
            modelSelect.appendChild(option);
          });
        }
        
        this.showTemporaryMessage(`成功获取 ${models.length} 个模型`);
        
        if (modelInput && !modelInput.value) {
          modelInput.value = models[0];
          saveVariableInputs();
        }
      } else {
        this.showTemporaryMessage("获取成功，但模型列表为空");
      }
    } catch (err) {
      console.error("[变量AI] 获取模型失败:", err);
      this.showTemporaryMessage("获取模型失败，请检查 URL 和 Key 是否正确");
    } finally {
      fetchBtn.textContent = "获取列表";
      fetchBtn.disabled = false;
    }
  });
},
// 【新增】处理禁用/恢复动画的核心逻辑函数
toggleSystemAnimations(disable) {
  const styleId = "perf-test-mitigator";
  let styleTag = document.getElementById(styleId);

  if (disable) {
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = styleId;
      styleTag.innerHTML = /* HTML */ `
        /* 1. 强行停止所有动画和过渡效果 */ *, *::before,
        *::after { animation: none !important; transition: none
        !important; animation-duration: 0s !important;
        transition-duration: 0s !important; } /* 2.
        禁用极其耗性能的混合模式 */ *, *::before, *::after {
        mix-blend-mode: normal !important; } /* 3.
        禁用滤镜（模糊、发光等） */ *, *::before, *::after {
        filter: none !important; backdrop-filter: none
        !important; } /* 4. 禁用复杂的阴影 */ *, *::before,
        *::after { box-shadow: none !important; text-shadow:
        none !important; } /* 5. 降低背景图片的渲染压力 */ * {
        background-attachment: scroll !important; /* 禁用 fixed
        背景 */ }
      `;
      document.head.appendChild(styleTag);
      console.log(
        "%c测试模式开启：已禁用所有动画、混合模式、滤镜和阴影",
        "color: var(--color-danger); font-size: var(--text-md); font-weight: bold;",
      );
    }
  } else {
    if (styleTag) {
      styleTag.remove();
      console.log(
        "%c已恢复原样：视觉特效已重新开启",
        "color: var(--color-success); font-weight: bold;",
      );
    }
  }
},
// 【新增】处理禁用/恢复控制台日志的核心逻辑函数
toggleConsoleLogs(disable) {
  // 定义我们需要管控的所有 console 方法
  const methods = [
    "log",
    "warn",
    "info",
    "debug",
    "error",
    "time",
    "timeEnd",
    "count",
    "trace",
    "table",
    "group",
    "groupCollapsed",
    "groupEnd",
    "dir",
  ];

  // 初次调用，备份所有方法
  if (!window._originalConsole) {
    window._originalConsole = {};
    methods.forEach((m) => {
      window._originalConsole[m] = console[m];
    });
  }

  if (disable) {
    const noop = () => {};
    methods.forEach((m) => {
      // 除了 console.error，其他全部变为空函数
      // 如果你想连 error 都干掉，就把下面的 if 去掉
      if (m !== "error") {
        console[m] = noop;
      }
    });

    // 用原生方法偷偷打印一条，告诉开发者怎么恢复
    window._originalConsole.log(
      "%c[系统] 日志输出已禁用。如需调试，请在设置中恢复。",
      "color: var(--color-primary); font-weight: bold;",
    );
  } else {
    // 恢复所有备份的方法
    methods.forEach((m) => {
      console[m] = window._originalConsole[m];
    });
    console.log(
      "%c[系统] 所有日志输出已恢复",
      "color: var(--color-success); font-weight: bold;",
    );
  }
},



