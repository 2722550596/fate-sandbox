// AIContextConfigUI.js - 来源: original.js

// === class AIContextConfigUI (行 43152-44173) ===

class AIContextConfigUI {
  constructor(gameInstance) {
    this.game = gameInstance;

    // 状态模型
    this.ConfigStateModel = {
      STORAGE_KEY: "ai-context-config-state-v1",
      defaultState: {
        isVisible: false,
        position: { x: 50, y: 50 },
        size: { width: 400, height: 600 },
        buttonPosition: { x: null, y: null },
        zoom: 1.0,
        expandedPaths: ["/"],
      },
      serialize: (state) => JSON.stringify(state),
      deserialize: (json) => {
        try {
          return { ...this.ConfigStateModel.defaultState, ...JSON.parse(json) };
        } catch {
          return this.ConfigStateModel.defaultState;
        }
      },
    };

    // 从localStorage加载状态
    const savedState = this.loadState();
    this.isVisible = savedState.isVisible || false;
    this.position = savedState.position;
    this.size = savedState.size;
    this.buttonPosition = savedState.buttonPosition;
    this.zoom = savedState.zoom || 1.0;
    this.expandedPaths = new Set(savedState.expandedPaths);

    // 数据管理
    this.hiddenFields = []; // 隐藏字段列表
    this.lockedFields = []; // 锁定字段列表（不可修改）
    this.invalidFields = []; // 失效的配置（字段不存在）
    this.latestData = null; // 最新的数据快照

    // UI元素引用
    this.toggleBtn = null;
    this.panel = null;

    // 拖动状态
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.isButtonDragging = false;

    // 位置约束
    this.PositionConstraints = {
      MIN_MARGIN: 10,
      constrain: (position, panelSize, viewportSize) => ({
        x: Math.max(
          this.PositionConstraints.MIN_MARGIN,
          Math.min(
            position.x,
            viewportSize.width - panelSize.width - this.PositionConstraints.MIN_MARGIN,
          ),
        ),
        y: Math.max(
          this.PositionConstraints.MIN_MARGIN,
          Math.min(
            position.y,
            viewportSize.height - panelSize.height - this.PositionConstraints.MIN_MARGIN,
          ),
        ),
      }),
    };
  }

  /**
   * 生成悬浮按钮HTML
   */
  generateToggleButtonHtml() {
    return `
      <button id="ai-context-config-toggle" class="fve-toggle-btn" 
              style="bottom: 140px;" 
              title="变量可见性配置">
        🔒
      </button>
    `;
  }

  /**
   * 生成配置面板HTML
   */
  generatePanelHtml() {
    return `
      <div id="ai-context-config-panel" class="fve-panel" style="
        left: ${this.position.x}px; top: ${this.position.y}px;
        width: ${this.size.width}px; height: ${this.size.height}px;
        display: none;
      ">
        <!-- 标题栏 -->
        <div id="ai-config-header" class="fve-header">
          <span class="fve-header-title">🔒 变量对AI的可见性配置</span>
          <button id="ai-config-close" class="fve-btn-mini">✕</button>
        </div>

        <!-- 搜索栏 + 缩放控制 -->
        <div class="fve-search">
          <input type="text" id="ai-config-search" placeholder="搜索字段路径或键名...">
          <div class="fve-zoom-controls">
            <button id="ai-config-zoom-out" class="fve-btn-mini">-</button>
            <span id="ai-config-zoom-level" class="fve-zoom-val">100%</span>
            <button id="ai-config-zoom-in" class="fve-btn-mini">+</button>
          </div>
        </div>

        <!-- 树形结构容器 -->
        <div class="fve-content">
          <div id="ai-config-tree-container"></div>
        </div>

        <!-- 失效配置警告区域 -->
        <div id="ai-config-invalid-fields" style="display: none;">
          <div class="ai-config-warning-header">
            ⚠️ 无效的隐藏配置（字段不存在）：
          </div>
          <div id="ai-config-invalid-list"></div>
          <button id="ai-config-clear-invalid" class="fve-btn">清除所有无效配置</button>
        </div>

        <!-- 底部操作栏 -->
        <div class="fve-footer">
          <span id="ai-config-status">
            已隐藏 <strong id="ai-config-hidden-count">0</strong> 个字段
            （包括 <strong id="ai-config-locked-count">0</strong> 个锁定字段）
          </span>
          <div style="display: flex; gap: 8px;">
            <button id="ai-config-select-all" class="fve-btn">全选</button>
            <button id="ai-config-deselect-all" class="fve-btn">取消全选</button>
            <button id="ai-config-reset" class="fve-btn">重置</button>
            <button id="ai-config-save" class="fve-btn primary">保存</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 初始化UI
   */
  init() {
    // 注入悬浮按钮和面板到body
    document.body.insertAdjacentHTML("beforeend", this.generateToggleButtonHtml());
    document.body.insertAdjacentHTML("beforeend", this.generatePanelHtml());

    this.toggleBtn = document.getElementById("ai-context-config-toggle");
    this.panel = document.getElementById("ai-context-config-panel");

    // 绑定悬浮按钮点击和拖动事件
    this.isButtonDragging = false;

    this.toggleBtn.addEventListener("click", (e) => {
      if (this.isButtonDragging) {
        this.isButtonDragging = false;
        return;
      }
      this.open();
    });

    // 实现按钮拖动功能
    let buttonDragStart = { x: 0, y: 0 };
    let buttonStartPos = { x: 0, y: 0 };
    let buttonIsDragging = false;
    let touchMoved = false;

    // 鼠标拖动
    this.toggleBtn.addEventListener("mousedown", (e) => {
      buttonIsDragging = true;
      buttonDragStart = { x: e.clientX, y: e.clientY };
      const rect = this.toggleBtn.getBoundingClientRect();
      buttonStartPos = { x: rect.left, y: rect.top };
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!buttonIsDragging) return;
      const dx = e.clientX - buttonDragStart.x;
      const dy = e.clientY - buttonDragStart.y;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this.isButtonDragging = true;

      let newX = Math.max(0, Math.min(window.innerWidth - 48, buttonStartPos.x + dx));
      let newY = Math.max(0, Math.min(window.innerHeight - 48, buttonStartPos.y + dy));

      this.toggleBtn.style.left = `${newX}px`;
      this.toggleBtn.style.top = `${newY}px`;
      this.toggleBtn.style.right = "auto";
      this.toggleBtn.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (buttonIsDragging) {
        buttonIsDragging = false;
        const rect = this.toggleBtn.getBoundingClientRect();
        this.buttonPosition = { x: rect.left, y: rect.top };
        this.saveButtonPosition();
        setTimeout(() => (this.isButtonDragging = false), 100);
      }
    });

    // 触摸拖动（移动端）
    this.toggleBtn.addEventListener(
      "touchstart",
      (e) => {
        touchMoved = false;
        const touch = e.touches[0];
        buttonDragStart = { x: touch.clientX, y: touch.clientY };
        const rect = this.toggleBtn.getBoundingClientRect();
        buttonStartPos = { x: rect.left, y: rect.top };
      },
      { passive: true },
    );

    this.toggleBtn.addEventListener(
      "touchmove",
      (e) => {
        const touch = e.touches[0];
        const dx = touch.clientX - buttonDragStart.x;
        const dy = touch.clientY - buttonDragStart.y;

        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          touchMoved = true;
          this.isButtonDragging = true;
          e.preventDefault();

          let newX = Math.max(0, Math.min(window.innerWidth - 48, buttonStartPos.x + dx));
          let newY = Math.max(0, Math.min(window.innerHeight - 48, buttonStartPos.y + dy));

          this.toggleBtn.style.left = `${newX}px`;
          this.toggleBtn.style.top = `${newY}px`;
          this.toggleBtn.style.right = "auto";
          this.toggleBtn.style.bottom = "auto";
        }
      },
      { passive: false },
    );

    this.toggleBtn.addEventListener("touchend", () => {
      if (touchMoved) {
        touchMoved = false;
        const rect = this.toggleBtn.getBoundingClientRect();
        this.buttonPosition = { x: rect.left, y: rect.top };
        this.saveButtonPosition();
        setTimeout(() => (this.isButtonDragging = false), 100);
      }
    });

    // 加载保存的按钮位置
    this.loadButtonPosition();

    // 绑定关闭按钮
    const closeBtn = document.getElementById("ai-config-close");
    if (closeBtn) {
      closeBtn.onclick = () => this.close();
    }

    // 绑定保存按钮
    const saveBtn = document.getElementById("ai-config-save");
    if (saveBtn) {
      saveBtn.onclick = () => this.save();
    }

    // 绑定重置按钮
    const resetBtn = document.getElementById("ai-config-reset");
    if (resetBtn) {
      resetBtn.onclick = () => this.reset();
    }

    // 绑定全选/取消全选按钮
    const selectAllBtn = document.getElementById("ai-config-select-all");
    if (selectAllBtn) {
      selectAllBtn.onclick = () => this.selectAll();
    }

    const deselectAllBtn = document.getElementById("ai-config-deselect-all");
    if (deselectAllBtn) {
      deselectAllBtn.onclick = () => this.deselectAll();
    }

    // 绑定搜索
    const searchInput = document.getElementById("ai-config-search");
    if (searchInput) {
      searchInput.oninput = _.debounce(() => this.renderTree(searchInput.value), 300);
    }

    // 绑定缩放控制
    const zoomInBtn = document.getElementById("ai-config-zoom-in");
    const zoomOutBtn = document.getElementById("ai-config-zoom-out");
    const zoomLevel = document.getElementById("ai-config-zoom-level");
    if (zoomInBtn) {
      zoomInBtn.onclick = () => this.adjustZoom(0.1);
    }
    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => this.adjustZoom(-0.1);
    }
    if (zoomLevel) {
      zoomLevel.ondblclick = () => {
        this.zoom = 1.0;
        const container = document.getElementById("ai-config-tree-container");
        if (container) {
          container.style.transform = "scale(1.0)";
        }
        zoomLevel.innerText = "100%";
      };
    }

    // 绑定清除失效配置按钮
    const clearInvalidBtn = document.getElementById("ai-config-clear-invalid");
    if (clearInvalidBtn) {
      clearInvalidBtn.onclick = () => this.clearAllInvalidFields();
    }

    // 绑定面板拖动
    const header = document.getElementById("ai-config-header");
    if (header) {
      header.addEventListener("mousedown", (e) => {
        if (e.target.closest("button")) return; // 忽略按钮点击
        this.isDragging = true;
        const rect = this.panel.getBoundingClientRect();
        this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        e.preventDefault();
      });
    }

    document.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        this.position = {
          x: e.clientX - this.dragOffset.x,
          y: e.clientY - this.dragOffset.y,
        };
        this.constrainToViewport();
      }
    });

    document.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.saveState();
      }
    });

    // 监听面板大小变化
    const resizeObserver = new ResizeObserver(
      _.debounce((entries) => {
        for (let entry of entries) {
          if (this.isVisible) {
            this.size = {
              width: entry.contentRect.width,
              height: entry.contentRect.height,
            };
            this.saveState();
          }
        }
      }, 200),
    );
    resizeObserver.observe(this.panel);

    console.log("[AI配置UI] 初始化完成");
  }

  /**
   * 打开配置面板
   */
  async open() {
    try {
      // 加载配置
      const config = await GameDBManager.loadAIContextConfig();
      this.hiddenFields = config.hiddenFields || [];
      this.lockedFields = config.lockedFields || [];

      // 从currentMvuState读取最新数据
      this.latestData = {
        stat_data: _.cloneDeep(this.game.currentMvuState.stat_data),
        npc_data: _.cloneDeep(this.game.currentMvuState.npc_data),
        world_data: _.cloneDeep(this.game.currentMvuState.world_data),
      };

      // 检测失效配置
      this.detectInvalidConfig();

      // 渲染树形结构
      this.renderTree();

      // 渲染失效配置警告
      this.renderInvalidFieldsWarning();

      // 更新状态栏
      this.updateStatusBar();

      // 显示面板
      this.panel.style.display = "flex";
      this.isVisible = true;

      // 应用缩放
      const container = document.getElementById("ai-config-tree-container");
      if (container) {
        container.style.transform = `scale(${this.zoom})`;
        container.style.transformOrigin = "top left";
      }

      // 边界约束
      this.constrainToViewport();

      // 保存状态
      this.saveState();

      console.log("[AI配置UI] 面板已打开");
    } catch (error) {
      console.error("[AI配置UI] 打开失败:", error);
      this.game.showTemporaryMessage("配置加载失败：" + error.message, 3000);
    }
  }

  /**
   * 关闭配置面板
   */
  close() {
    this.panel.style.display = "none";
    this.isVisible = false;
    this.saveState();
    console.log("[AI配置UI] 面板已关闭");
  }

  /**
   * 保存配置
   */
  async save() {
    try {
      const config = {
        mode: "blacklist",
        hiddenFields: this.hiddenFields,
        lockedFields: this.lockedFields,
        version: "1.0",
      };

      await GameDBManager.saveAIContextConfig(config);

      // 🔑 关键修复：同步更新游戏实例中的配置缓存
      // 这样下次发送消息时，就能使用最新的配置，而不需要刷新页面
      this.game.aiContextConfig = config;

      this.game.showTemporaryMessage("✅ 配置已保存！", 2000);
      console.log("[AI配置UI] 配置已保存并同步到内存", config);
    } catch (error) {
      console.error("[AI配置UI] 保存失败:", error);
      this.game.showTemporaryMessage("❌ 保存失败：" + error.message, 3000);
    }
  }

  /**
   * 重置配置（全部显示）
   */
  reset() {
    if (confirm('确定要重置配置吗？所有字段将恢复为"显示给AI"状态。')) {
      this.hiddenFields = [];
      this.renderTree();
      this.updateStatusBar();
      console.log("[AI配置UI] 配置已重置");
    }
  }

  /**
   * 全选（隐藏所有字段）
   */
  selectAll() {
    const allPaths = this.collectAllFieldPaths(this.latestData);
    this.hiddenFields = allPaths.filter((path) => !this.isFieldLocked(path));
    this.renderTree();
    this.updateStatusBar();
    console.log("[AI配置UI] 已全选（隐藏所有字段）");
  }

  /**
   * 取消全选（显示所有字段）
   */
  deselectAll() {
    this.hiddenFields = [];
    this.renderTree();
    this.updateStatusBar();
    console.log("[AI配置UI] 已取消全选（显示所有字段）");
  }

  /**
   * 收集所有字段路径
   */
  collectAllFieldPaths(data, prefix = "") {
    let paths = [];

    for (const [dataType, dataObj] of Object.entries(data)) {
      const traverse = (obj, currentPath) => {
        if (!obj || typeof obj !== "object") return;

        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            traverse(item, `${currentPath}[${index}]`);
          });
        } else {
          for (const key of Object.keys(obj)) {
            const fullPath = currentPath ? `${currentPath}.${key}` : `${dataType}.${key}`;
            paths.push(fullPath);
            traverse(obj[key], fullPath);
          }
        }
      };

      traverse(dataObj, dataType);
    }

    return paths;
  }

  /**
   * 检测失效配置
   * 注意：仅检测 hiddenFields（隐藏清单）。
   * lockedFields（锁定清单）按设计是饱和覆盖型配置（含大量通配符 + 跨场景路径），
   * 故意会包含当前场景下不存在的字段，不参与无效检测。
   */
  detectInvalidConfig() {
    this.invalidFields = [];
    const allPaths = this.collectAllFieldPaths(this.latestData);

    for (const hiddenPath of this.hiddenFields) {
      if (!this.fieldExistsInData(hiddenPath, allPaths)) {
        this.invalidFields.push(hiddenPath);
      }
    }

    console.log(`[AI配置UI] 检测到 ${this.invalidFields.length} 个失效配置`);
  }

  /**
   * 检查字段是否存在
   */
  fieldExistsInData(fieldPath, allPaths) {
    // 精确匹配
    if (allPaths.includes(fieldPath)) return true;

    // 通配符匹配
    if (fieldPath.includes("*") || fieldPath.includes("**")) {
      // 🔑 关键修复：先处理 ** 再处理 *，避免 ** 被错误替换
      const pattern = fieldPath
        .replace(/\./g, "\\.") // 转义点号
        .replace(/\*\*/g, "__DOUBLE_STAR__") // 临时占位符
        .replace(/\*/g, "[^.]+") // 单层通配符
        .replace(/__DOUBLE_STAR__/g, ".*"); // 多层通配符
      const regex = new RegExp(`^${pattern}$`);
      return allPaths.some((path) => regex.test(path));
    }

    return false;
  }

  /**
   * 渲染失效配置警告
   */
  renderInvalidFieldsWarning() {
    const warningContainer = document.getElementById("ai-config-invalid-fields");
    const invalidList = document.getElementById("ai-config-invalid-list");

    if (this.invalidFields.length === 0) {
      warningContainer.style.display = "none";
      return;
    }

    warningContainer.style.display = "block";
    invalidList.innerHTML = "";

    for (const fieldPath of this.invalidFields) {
      const item = document.createElement("div");
      item.className = "ai-config-invalid-item";
      item.innerHTML = `
        <span class="field-path">${fieldPath}</span>
        <div class="actions">
          <button class="fve-btn-mini" onclick="aiContextConfigUIInstance.clearInvalidField('${fieldPath}')">清除</button>
          <button class="fve-btn-mini" onclick="aiContextConfigUIInstance.keepInvalidField('${fieldPath}')">保留</button>
        </div>
      `;
      invalidList.appendChild(item);
    }
  }

  /**
   * 清除单个失效配置
   */
  clearInvalidField(fieldPath) {
    this.hiddenFields = this.hiddenFields.filter((p) => p !== fieldPath);
    this.lockedFields = this.lockedFields.filter((p) => p !== fieldPath);
    this.detectInvalidConfig();
    this.renderInvalidFieldsWarning();
    this.updateStatusBar();
    console.log(`[AI配置UI] 已清除失效配置: ${fieldPath}`);
  }

  /**
   * 保留单个失效配置
   */
  keepInvalidField(fieldPath) {
    this.invalidFields = this.invalidFields.filter((p) => p !== fieldPath);
    this.renderInvalidFieldsWarning();
    console.log(`[AI配置UI] 已保留失效配置: ${fieldPath}`);
  }

  /**
   * 清除所有失效配置
   */
  clearAllInvalidFields() {
    for (const fieldPath of this.invalidFields) {
      this.hiddenFields = this.hiddenFields.filter((p) => p !== fieldPath);
      this.lockedFields = this.lockedFields.filter((p) => p !== fieldPath);
    }
    this.invalidFields = [];
    this.renderInvalidFieldsWarning();
    this.updateStatusBar();
    console.log("[AI配置UI] 已清除所有失效配置");
  }

  /**
   * 渲染树形结构
   */
  renderTree(filterText = "") {
    const container = document.getElementById("ai-config-tree-container");
    if (!container || !this.latestData) return;

    container.innerHTML = "";
    const rootNode = this.createTreeNode("ROOT", this.latestData, "", filterText, true);
    if (rootNode) container.appendChild(rootNode);
  }

  /**
   * 创建树形节点
   */
  createTreeNode(key, value, currentPath, filterText, isRoot = false) {
    const path = isRoot ? "" : currentPath === "" ? `/${key}` : `${currentPath}/${key}`;
    const fullPath = this.getFullPath(key, path);
    const isObject = value !== null && typeof value === "object";
    const isArray = Array.isArray(value);

    // 搜索过滤
    let matchesFilter = false;
    if (filterText) {
      const lowerFilter = filterText.toLowerCase();
      matchesFilter =
        key.toLowerCase().includes(lowerFilter) ||
        (!isObject && String(value).toLowerCase().includes(lowerFilter));
    }

    const container = document.createElement("div");
    const item = document.createElement("div");
    item.className = "fve-tree-item";

    // 检查是否被锁定
    const isLocked = this.isFieldLocked(fullPath);
    if (isLocked) {
      item.classList.add("locked");
    }

    // 对象/数组：展开/折叠
    if (isObject) {
      const toggle = document.createElement("span");
      toggle.className = "fve-node-toggle";
      const forceExpand = filterText && matchesFilter;
      const isExpanded = forceExpand || this.expandedPaths.has(path || "/");

      toggle.innerText = isExpanded ? "−" : "+";
      if (!isExpanded) container.classList.add("fve-collapsed");

      toggle.onclick = (e) => {
        e.stopPropagation();
        const p = path || "/";
        if (this.expandedPaths.has(p)) {
          this.expandedPaths.delete(p);
          container.classList.add("fve-collapsed");
          toggle.innerText = "+";
        } else {
          this.expandedPaths.add(p);
          container.classList.remove("fve-collapsed");
          toggle.innerText = "−";
        }
      };
      item.appendChild(toggle);
    }

    // 键名
    const keyEl = document.createElement("span");
    keyEl.className = "fve-node-key";
    keyEl.innerText = isRoot ? "ROOT:" : isArray ? `[${key}]` : `${key}:`;
    item.appendChild(keyEl);

    let hasMatchingChild = false;

    if (isObject) {
      // 对象/数组：显示摘要
      const summary = document.createElement("span");
      summary.className = "fve-node-summary";
      const keys = Object.keys(value);
      summary.innerText = isArray ? `Array(${keys.length})` : `Object(${keys.length})`;
      item.appendChild(summary);

      // 添加复选框（对于对象/数组，控制整个分支）
      // 放在summary之后，避免和toggle重叠
      if (!isRoot) {
        const checkbox = this.createVisibilityCheckbox(fullPath, isLocked);
        item.appendChild(checkbox);
      }

      container.appendChild(item);

      // 递归渲染子节点
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "fve-tree-node";

      for (const childKey of keys) {
        const childNode = this.createTreeNode(childKey, value[childKey], path, filterText, false);
        if (childNode) {
          childrenContainer.appendChild(childNode);
          if (filterText && childNode.dataset.matches === "true") {
            hasMatchingChild = true;
          }
        }
      }

      container.appendChild(childrenContainer);
    } else {
      // 叶子节点：显示值
      const valueEl = document.createElement("span");
      valueEl.className = "fve-node-value";
      valueEl.innerText = String(value);
      item.appendChild(valueEl);

      // 添加复选框
      const checkbox = this.createVisibilityCheckbox(fullPath, isLocked);
      item.insertBefore(checkbox, item.firstChild);

      container.appendChild(item);
    }

    // 搜索过滤：隐藏不匹配的节点
    if (filterText && !matchesFilter && !hasMatchingChild) {
      container.style.display = "none";
    } else {
      container.dataset.matches = "true";
    }

    return container;
  }

  /**
   * 创建可见性复选框
   */
  createVisibilityCheckbox(fullPath, isLocked) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "fve-node-checkbox";
    // 🔑 关键修复：使用 isFieldHidden 方法检查字段是否被隐藏（支持通配符匹配）
    checkbox.checked = !this.isFieldHidden(fullPath);
    checkbox.disabled = isLocked;

    if (isLocked) {
      const lockIcon = document.createElement("span");
      lockIcon.className = "lock-icon";
      lockIcon.innerText = "🔒";
      lockIcon.title = "此字段已被锁定，无法修改可见性";

      const wrapper = document.createElement("span");
      wrapper.appendChild(checkbox);
      wrapper.appendChild(lockIcon);
      return wrapper;
    }

    checkbox.onchange = () => this.handleVisibilityChange(fullPath, checkbox.checked);

    return checkbox;
  }

  /**
   * 处理可见性变更
   */
  handleVisibilityChange(fullPath, isVisible) {
    if (isVisible) {
      // 勾选：从隐藏列表中移除
      this.hiddenFields = this.hiddenFields.filter((p) => p !== fullPath);
      console.log(`[AI配置UI] 字段 "${fullPath}" 设置为可见`);
    } else {
      // 取消勾选：添加到隐藏列表
      if (!this.hiddenFields.includes(fullPath)) {
        this.hiddenFields.push(fullPath);
      }
      console.log(`[AI配置UI] 字段 "${fullPath}" 设置为隐藏`);
    }

    this.updateStatusBar();
  }

  /**
   * 获取完整路径
   */
  getFullPath(key, path) {
    // 从路径中提取数据类型和相对路径
    // 例如：path = "/stat_data/势力" -> "stat_data.势力"
    if (!path) return key;

    const parts = path.split("/").filter((p) => p);
    if (parts.length === 0) return key;

    return parts.join(".").replace(/\[(\d+)\]/g, "[$1]");
  }

  /**
   * 检查字段是否被锁定
   */
  isFieldLocked(fullPath) {
    return this.lockedFields.some((pattern) => {
      if (pattern === fullPath) return true;
      if (pattern.includes("*") || pattern.includes("**")) {
        // 🔑 关键修复：先处理 ** 再处理 *，避免 ** 被错误替换
        // 步骤1：转义点号 . → \.
        // 步骤2：替换 ** → PLACEHOLDER（临时占位符）
        // 步骤3：替换 * → [^.]+（单层通配符）
        // 步骤4：替换 PLACEHOLDER → .*（多层通配符）
        const regexPattern = pattern
          .replace(/\./g, "\\.") // 转义点号
          .replace(/\*\*/g, "__DOUBLE_STAR__") // 临时占位符
          .replace(/\*/g, "[^.]+") // 单层通配符
          .replace(/__DOUBLE_STAR__/g, ".*"); // 多层通配符
        const regex = new RegExp("^" + regexPattern + "$");
        return regex.test(fullPath);
      }
      return false;
    });
  }

  /**
   * 检查字段是否被隐藏（支持通配符匹配）
   * @param {string} fullPath - 字段的完整路径
   * @returns {boolean} 是否被隐藏
   */
  isFieldHidden(fullPath) {
    // 合并 hiddenFields 和 lockedFields
    const allHiddenPatterns = [...this.hiddenFields, ...this.lockedFields];

    return allHiddenPatterns.some((pattern) => {
      // 精确匹配
      if (pattern === fullPath) return true;

      // 通配符匹配
      if (pattern.includes("*") || pattern.includes("**")) {
        // 处理多层通配符 **
        if (pattern.includes("**")) {
          const parts = pattern.split("**");
          const prefix = parts[0] ? parts[0].replace(/\.$/, "") : "";
          const suffix = parts[1] ? parts[1].replace(/^\./, "") : "";
          const matchesPrefix = prefix ? fullPath.startsWith(prefix) : true;
          const matchesSuffix = suffix ? fullPath.endsWith(suffix) : true;
          return matchesPrefix && matchesSuffix;
        }

        // 处理单层通配符 *
        // 使用正则表达式匹配
        const regexPattern = pattern
          .replace(/\./g, "\\.") // 转义点号
          .replace(/\*\*/g, "__DOUBLE_STAR__") // 临时占位符
          .replace(/\*/g, "[^.]+") // 单层通配符
          .replace(/__DOUBLE_STAR__/g, ".*"); // 多层通配符
        const regex = new RegExp("^" + regexPattern + "$");
        return regex.test(fullPath);
      }

      return false;
    });
  }

  /**
   * 更新状态栏
   */
  updateStatusBar() {
    const hiddenCount = document.getElementById("ai-config-hidden-count");
    const lockedCount = document.getElementById("ai-config-locked-count");

    if (hiddenCount) {
      hiddenCount.innerText = this.hiddenFields.length;
    }
    if (lockedCount) {
      lockedCount.innerText = this.lockedFields.length;
    }
  }

  /**
   * 调整缩放
   */
  adjustZoom(delta) {
    this.zoom = Math.max(0.5, Math.min(2.0, this.zoom + delta));
    const container = document.getElementById("ai-config-tree-container");
    const zoomLevel = document.getElementById("ai-config-zoom-level");
    if (container) {
      container.style.transform = `scale(${this.zoom})`;
      container.style.transformOrigin = "top left";
    }
    if (zoomLevel) {
      zoomLevel.innerText = `${Math.round(this.zoom * 100)}%`;
    }
  }

  /**
   * 保存按钮位置到localStorage
   */
  saveButtonPosition() {
    try {
      localStorage.setItem(
        "ai-context-config-button-position",
        JSON.stringify(this.buttonPosition),
      );
      console.log("[AI配置UI] 按钮位置已保存", this.buttonPosition);
    } catch (error) {
      console.warn("[AI配置UI] 保存按钮位置失败:", error);
    }
  }

  /**
   * 从localStorage加载按钮位置
   */
  loadButtonPosition() {
    try {
      const saved = localStorage.getItem("ai-context-config-button-position");
      if (saved) {
        this.buttonPosition = JSON.parse(saved);

        // 应用保存的位置
        if (this.buttonPosition.x !== null && this.buttonPosition.y !== null) {
          // 越界保护
          const maxX = window.innerWidth - 48;
          const maxY = window.innerHeight - 48;

          // 检查数据是否异常
          if (
            this.buttonPosition.x > window.innerWidth ||
            this.buttonPosition.y > window.innerHeight ||
            this.buttonPosition.x < 0 ||
            this.buttonPosition.y < 0
          ) {
            // 数据异常，重置到默认位置
            this.toggleBtn.style.right = "20px";
            this.toggleBtn.style.bottom = "140px";
            this.toggleBtn.style.left = "auto";
            this.toggleBtn.style.top = "auto";
            this.buttonPosition = { x: null, y: null };
            this.saveButtonPosition();
            console.log("[AI配置UI] 按钮位置异常，已重置");
          } else {
            let safeX = Math.max(0, Math.min(this.buttonPosition.x, maxX));
            let safeY = Math.max(0, Math.min(this.buttonPosition.y, maxY));

            this.toggleBtn.style.left = `${safeX}px`;
            this.toggleBtn.style.top = `${safeY}px`;
            this.toggleBtn.style.right = "auto";
            this.toggleBtn.style.bottom = "auto";

            console.log("[AI配置UI] 按钮位置已恢复", { x: safeX, y: safeY });
          }
        }
      }
    } catch (error) {
      console.warn("[AI配置UI] 加载按钮位置失败:", error);
    }
  }

  /**
   * 保存状态到localStorage
   */
  saveState() {
    try {
      const state = {
        isVisible: this.isVisible,
        position: this.position,
        size: this.size,
        buttonPosition: this.buttonPosition,
        zoom: this.zoom,
        expandedPaths: Array.from(this.expandedPaths),
      };
      localStorage.setItem(
        this.ConfigStateModel.STORAGE_KEY,
        this.ConfigStateModel.serialize(state),
      );
      console.log("[AI配置UI] 状态已保存");
    } catch (error) {
      console.warn("[AI配置UI] 保存状态失败:", error);
    }
  }

  /**
   * 从localStorage加载状态
   */
  loadState() {
    try {
      const saved = localStorage.getItem(this.ConfigStateModel.STORAGE_KEY);
      return saved ? this.ConfigStateModel.deserialize(saved) : this.ConfigStateModel.defaultState;
    } catch (error) {
      console.warn("[AI配置UI] 加载状态失败:", error);
      return this.ConfigStateModel.defaultState;
    }
  }

  /**
   * 约束面板位置到可视区域内
   */
  constrainToViewport() {
    if (!this.panel) return;
    const rect = this.panel.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const panelSize = { width: rect.width, height: rect.height };
    this.position = this.PositionConstraints.constrain(this.position, panelSize, viewport);
    this.panel.style.left = `${this.position.x}px`;
    this.panel.style.top = `${this.position.y}px`;
  }

  /**
   * 全屏切换后确保UI元素在可视区域内
   */
  ensureCorrectParent() {
    setTimeout(() => {
      // 1. 约束面板位置
      if (this.isVisible) {
        this.constrainToViewport();
      }

      // 2. 约束按钮位置
      if (this.buttonPosition.x !== null && this.toggleBtn) {
        const maxX = window.innerWidth - 48;
        const maxY = window.innerHeight - 48;

        let safeX = Math.max(0, Math.min(this.buttonPosition.x, maxX));
        let safeY = Math.max(0, Math.min(this.buttonPosition.y, maxY));

        this.toggleBtn.style.left = `${safeX}px`;
        this.toggleBtn.style.top = `${safeY}px`;
        this.toggleBtn.style.right = "auto";
        this.toggleBtn.style.bottom = "auto";

        this.buttonPosition = { x: safeX, y: safeY };
      }

      this.saveState();
    }, 100);
  }
}
