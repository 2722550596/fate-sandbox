// FloatingVariableEditor.js - 来源: original.js

// === class FloatingVariableEditor (行 42255-43146) ===

class FloatingVariableEditor {
  constructor(gameInstance) {
    this.game = gameInstance;

    // 状态模型
    this.EditorStateModel = {
      STORAGE_KEY: "floating-editor-state-v2",
      defaultState: {
        isVisible: false,
        isMinimized: false,
        position: { x: 20, y: 100 },
        size: { width: 320, height: 550 },
        buttonPosition: { x: null, y: null },
        zoom: 1.0, // 新增：默认缩放比例
        activeTab: "deep",
      },
      serialize: (state) => JSON.stringify(state),
      deserialize: (json) => {
        try {
          return { ...this.EditorStateModel.defaultState, ...JSON.parse(json) };
        } catch {
          return this.EditorStateModel.defaultState;
        }
      },
    };

    const savedState = this.loadState();
    // 修复：正确继承面板的显示/隐藏状态
    this.isVisible = savedState.isVisible || false;
    this.isMinimized = savedState.isMinimized || false;
    this.position = savedState.position;
    this.size = savedState.size;
    this.buttonPosition = savedState.buttonPosition;
    this.activeTab = savedState.activeTab;
    this.zoom = savedState.zoom || 1.0; // 新增

    this.isButtonDragging = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.panel = null;
    this.toggleBtn = null;
    this.dragListeners = [];

    // --- 核心数据管理 ---
    this.baseState = null; // 当前回合的原始快照数据
    this.localClone = null; // 深度编辑模式下的内存工作副本
    this.pendingPatches = []; // 待应用的 JSON Patch 指令队列
    this.expandedPaths = new Set(["/"]); // 记录树形视图中展开的节点路径
    this.lastEditIndex = -1; // 用于判断是否跨回合，防止误删草稿

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

  generateToggleButtonHtml() {
    return `
    <button id="floating-editor-toggle" class="fve-toggle-btn" title="悬浮变量编辑器">
    ⚙
    </button>
  `;
  }

  generatePanelHtml() {
    return `
    <div id="floating-editor-panel" class="fve-panel" style="
    left: ${this.position.x}px; top: ${this.position.y}px;
    width: ${this.size.width}px; height: ${this.size.height}px;
    display: none;
    ">
    <div id="floating-editor-header" class="fve-header">
      <span class="fve-header-title">⚙ 悬浮变量编辑器</span>
      <div style="display: flex; gap: 8px;">
      <button id="floating-editor-close" class="fve-btn-mini">✕</button>
      </div>
    </div>

    <div class="fve-tabs" id="fve-tabs-container">
      <div class="fve-tab ${this.activeTab === "deep" ? "active" : ""}" data-target="deep">🌳 深度编辑</div>
      <div class="fve-tab ${this.activeTab === "raw" ? "active" : ""}" data-target="raw">⚙️ 原始模式</div>
    </div>

    <div class="fve-search" id="fve-search-bar" style="display: ${this.activeTab === "deep" ? "flex" : "none"};">
      <input type="text" id="fve-search-input" placeholder="搜索变量路径或键名...">
      <div class="fve-zoom-controls">
      <button id="fve-zoom-out" class="fve-btn-mini" title="缩小">-</button>
      <span id="fve-zoom-level" class="fve-zoom-val">${Math.round(this.zoom * 100)}%</span>
      <button id="fve-zoom-in" class="fve-btn-mini" title="放大">+</button>
      </div>
    </div>

    <div class="fve-content">
      <div id="fve-deep-view" style="display: ${this.activeTab === "deep" ? "block" : "none"};">
      <div id="fve-tree-container"></div>
      </div>

      <div id="fve-raw-view" style="display: ${this.activeTab === "raw" ? "flex" : "none"}; flex-direction: column; height: 100%;">
      <label style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 6px;">JSON Patch 指令：</label>
      <textarea id="floating-editor-textarea" class="fve-textarea" style="resize: none; white-space: pre; overflow: auto;"
        placeholder="[{&quot;op&quot;:&quot;replace&quot;,&quot;path&quot;:&quot;/当前活力&quot;,&quot;value&quot;:100}]"></textarea>
      <div id="floating-editor-errors" style="display: none; margin-top: 8px; color: var(--color-danger); font-size: var(--text-xs);"></div>
      </div>
    </div>

    <div class="fve-footer">
      <span id="fve-status-text" style="font-size: var(--text-xs); color: var(--text-muted);"></span>
      <div style="display: flex; gap: 8px;">
      <button id="floating-editor-recover" class="fve-btn" title="将AI最新生成的变量指令提取到编辑器中">恢复提取</button>
      <button id="floating-editor-clear" class="fve-btn">重置</button>
      <button id="floating-editor-apply" class="fve-btn primary">应用</button>
      </div>
    </div>
    </div>
  `;
  }

  init() {
    document.body.insertAdjacentHTML("beforeend", this.generateToggleButtonHtml());
    document.body.insertAdjacentHTML("beforeend", this.generatePanelHtml());

    this.toggleBtn = document.getElementById("floating-editor-toggle");
    this.panel = document.getElementById("floating-editor-panel");

    // 修复2：强制进行越界保护检查，防止齿轮跑到屏幕外变隐形
    if (this.toggleBtn && this.buttonPosition.x !== null) {
      const maxX = window.innerWidth - 48;
      const maxY = window.innerHeight - 48;

      let safeX = Math.max(0, Math.min(this.buttonPosition.x, maxX));
      let safeY = Math.max(0, Math.min(this.buttonPosition.y, maxY));

      // 如果数据异常超出物理屏幕边界，直接重置到右下角
      if (
        this.buttonPosition.x > window.innerWidth ||
        this.buttonPosition.y > window.innerHeight ||
        this.buttonPosition.x < 0 ||
        this.buttonPosition.y < 0
      ) {
        this.toggleBtn.style.right = "20px";
        this.toggleBtn.style.bottom = "80px";
        this.toggleBtn.style.left = "auto";
        this.toggleBtn.style.top = "auto";
        this.buttonPosition = { x: null, y: null };
        this.saveState();
      } else {
        this.toggleBtn.style.left = `${safeX}px`;
        this.toggleBtn.style.top = `${safeY}px`;
        this.toggleBtn.style.right = "auto";
        this.toggleBtn.style.bottom = "auto";
      }
    }

    this.bindEvents();
    if (this.isVisible) {
      this.show();
    }
  }

  refreshDataState() {
    const isHistoryMode = this.game.isHistoryViewMode;
    const targetIndex = isHistoryMode
      ? this.game.historyViewIndex
      : this.game.chatHistoryCache
        ? this.game.chatHistoryCache.length - 1
        : 0;

    // 🚀 核心修改：废弃局部读取，直接把整个 currentMvuState 作为树形图的根节点！
    const sourceData = this.game.currentMvuState || {};

    this.baseState = _.cloneDeep(sourceData);
    this.localClone = _.cloneDeep(this.baseState);
    this.pendingPatches = [];
    this.lastEditIndex = targetIndex;

    const statusText = document.getElementById("fve-status-text");
    if (statusText)
      statusText.innerText = isHistoryMode ? `编辑回合: #${targetIndex + 1}` : "编辑当前状态";

    this.updateRawTextarea();
    if (this.activeTab === "deep") this.renderTree();
  }

  _syncRawToDeep() {
    const rawText = this.panel.querySelector("#floating-editor-textarea").value;
    if (!rawText.trim() || rawText.trim() === "[]" || rawText.trim() === "{}") {
      this.pendingPatches = [];
      this.localClone = _.cloneDeep(this.baseState);
      this.renderTree();
      return;
    }

    try {
      const parsed = JSON.parse(rawText);
      this.pendingPatches = [];
      this.localClone = _.cloneDeep(this.baseState);

      const resolvePatchFullPath = (patchPath, fallbackDomain = "stat_data") => {
        if (!patchPath) return null;
        if (
          patchPath.startsWith("/stat_data") ||
          patchPath.startsWith("/npc_data") ||
          patchPath.startsWith("/world_data")
        ) {
          return patchPath;
        }
        if (patchPath === "/当前时间纪元" || patchPath.startsWith("/当前时间纪元/")) {
          return `/world_data${patchPath}`;
        }
        return `/${fallbackDomain}${patchPath}`;
      };

      // 🌟 新架构：处理多根节点对象格式
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        const domains = ["stat_data", "npc_data", "world_data"];
        domains.forEach((domain) => {
          if (Array.isArray(parsed[domain])) {
            parsed[domain].forEach((patch) => {
              if (!patch.path) return;

              const fullPath = resolvePatchFullPath(patch.path, domain);
              if (!fullPath) return;
              this.pendingPatches.push({ ...patch, path: fullPath });

              const dotPath = fullPath.replace(/^\//, "").replace(/\//g, ".");
              if (patch.op === "replace" || patch.op === "add")
                _.set(this.localClone, dotPath, patch.value);
              else if (patch.op === "remove") _.unset(this.localClone, dotPath);
            });
          }
        });
      }
      // 🌟 兼容旧版：如果传来的是纯数组，默认认为是操作 stat_data
      else if (Array.isArray(parsed)) {
        parsed.forEach((patch) => {
          if (!patch.path) return;
          const fullPath = resolvePatchFullPath(patch.path, "stat_data");
          if (!fullPath) return;

          this.pendingPatches.push({ ...patch, path: fullPath });

          const dotPath = fullPath.replace(/^\//, "").replace(/\//g, ".");
          if (patch.op === "replace" || patch.op === "add")
            _.set(this.localClone, dotPath, patch.value);
          else if (patch.op === "remove") _.unset(this.localClone, dotPath);
        });
      }

      this.hideErrors();
      this.renderTree();
    } catch (e) {
      this.showErrors([`JSON解析失败，草稿已保留在内存中: ${e.message}`]);
    }
  }

  updateRawTextarea() {
    const textarea = this.panel.querySelector("#floating-editor-textarea");
    if (!textarea) return;

    if (this.pendingPatches.length === 0) {
      textarea.value = "";
      return;
    }

    // 🌟 核心分发：将扁平带有前缀的 patch，分类打包进对应的域
    const formatted = { stat_data: [], npc_data: [], world_data: [] };
    const otherPatches = [];

    this.pendingPatches.forEach((p) => {
      const parts = p.path.split("/").filter(Boolean);
      const domain = parts[0];

      if (formatted.hasOwnProperty(domain)) {
        // 剥离第一层，例如 /stat_data/活力 恢复成 /活力
        const newPath = "/" + parts.slice(1).join("/");
        formatted[domain].push({ ...p, path: newPath === "/" ? "" : newPath });
      } else {
        // gacha_data 等其它暂未严格纳管的域
        otherPatches.push(p);
      }
    });

    const finalOutput = Object.keys(formatted).some((k) => formatted[k].length > 0)
      ? formatted
      : otherPatches;
    textarea.value = JSON.stringify(finalOutput, null, 2);
  }

  addPatch(op, path, value = undefined) {
    if (op === "replace") {
      const existingIdx = this.pendingPatches.findIndex(
        (p) => p.path === path && p.op === "replace",
      );
      if (existingIdx >= 0) {
        this.pendingPatches[existingIdx].value = value;
      } else {
        this.pendingPatches.push({ op, path, value });
      }
    } else if (op === "remove") {
      this.pendingPatches = this.pendingPatches.filter((p) => !p.path.startsWith(path));
      this.pendingPatches.push({ op, path });
    } else {
      this.pendingPatches.push({ op, path, value });
    }
    this.updateRawTextarea();
  }

  setCommands(commands) {
    if (!commands) return;

    // 🌟 不再强制要求扁平数组，直接支持对象或纯文本
    const textarea = this.panel.querySelector("#floating-editor-textarea");
    if (textarea) {
      textarea.value = typeof commands === "string" ? commands : JSON.stringify(commands, null, 2);

      // 直接复用 _syncRawToDeep 中写好的多根节点解析和映射逻辑！
      this._syncRawToDeep();
    }
  }

  renderTree(filterText = "") {
    const container = document.getElementById("fve-tree-container");
    if (!container || !this.localClone) return;

    container.innerHTML = "";
    const rootNode = this.createTreeNode("ROOT", this.localClone, "", filterText, true);
    if (rootNode) container.appendChild(rootNode);
  }

  createTreeNode(key, value, currentPath, filterText, isRoot = false) {
    const path = isRoot ? "" : currentPath === "" ? `/${key}` : `${currentPath}/${key}`;
    const isObject = value !== null && typeof value === "object";
    const isArray = Array.isArray(value);

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

    const keyEl = document.createElement("span");
    keyEl.className = "fve-node-key";
    keyEl.innerText = isRoot ? "ROOT:" : isArray ? `[${key}]` : `${key}:`;
    item.appendChild(keyEl);

    let hasMatchingChild = false;

    if (isObject) {
      const summary = document.createElement("span");
      summary.className = "fve-summary";

      const realKeys = Object.keys(value).filter((k) => k !== "$meta");
      const realLength = realKeys.length;

      summary.innerText = isArray ? `列表 (${realLength} 项)` : `字典/对象 (${realLength} 项)`;
      item.appendChild(summary);

      item.appendChild(this.createActionGroup(path, isArray, true, isRoot));

      const childrenContainer = document.createElement("div");
      childrenContainer.className = "fve-tree-node";

      Object.keys(value).forEach((childKey) => {
        if (childKey === "$meta") return;
        const childNode = this.createTreeNode(childKey, value[childKey], path, filterText, false);
        if (childNode) {
          childrenContainer.appendChild(childNode);
          hasMatchingChild = true;
        }
      });

      container.appendChild(item);
      container.appendChild(childrenContainer);
    } else {
      const input = document.createElement("input");
      input.className = "fve-node-input";

      let isDirty = false;
      if (!isRoot && this.baseState) {
        const dotPath = path.replace(/^\//, "").replace(/\//g, ".");
        const originalValue = _.get(this.baseState, dotPath);
        isDirty = !_.isEqual(value, originalValue);
      }
      if (isDirty) input.classList.add("is-dirty");

      if (typeof value === "boolean") {
        input.type = "checkbox";
        input.checked = value;
        input.className += " type-boolean";
        input.onchange = (e) => this.handleValueChange(path, e.target.checked, e.target);
      } else {
        input.value = value;
        input.type = typeof value === "number" ? "number" : "text";
        input.className += typeof value === "number" ? " type-number" : " type-string";
        input.onchange = (e) => {
          const finalVal = typeof value === "number" ? Number(e.target.value) : e.target.value;
          this.handleValueChange(path, finalVal, e.target);
        };
      }
      item.appendChild(input);
      item.appendChild(this.createActionGroup(path, false, false, isRoot));
      container.appendChild(item);
    }

    if (filterText && !matchesFilter && !hasMatchingChild) return null;

    if (filterText && hasMatchingChild && isObject) {
      container.classList.remove("fve-collapsed");
      item.querySelector(".fve-node-toggle").innerText = "−";
    }

    return container;
  }

  createActionGroup(path, isArray, canAdd, isRoot) {
    const actions = document.createElement("div");
    actions.className = "fve-node-actions";

    if (canAdd) {
      const addBtn = document.createElement("button");
      addBtn.className = "fve-btn-mini fve-btn-add";
      addBtn.innerText = "+ 新增";
      addBtn.onclick = () => this.handleAddNode(path, isArray);
      actions.appendChild(addBtn);
    }
    if (!isRoot && path !== "") {
      const delBtn = document.createElement("button");
      delBtn.className = "fve-btn-mini fve-btn-del";
      delBtn.innerText = "删除";
      delBtn.onclick = () => this.handleDeleteNode(path);
      actions.appendChild(delBtn);
    }
    return actions;
  }

  handleValueChange(path, newValue, inputElement) {
    const dotPath = path.replace(/^\//, "").replace(/\//g, ".");
    _.set(this.localClone, dotPath, newValue);
    this.addPatch("replace", path, newValue);

    const originalValue = _.get(this.baseState, dotPath);
    if (!_.isEqual(newValue, originalValue)) {
      inputElement.classList.add("is-dirty");
    } else {
      inputElement.classList.remove("is-dirty");
    }
  }

  handleDeleteNode(path) {
    const dotPath = path.replace(/^\//, "").replace(/\//g, ".");

    const pathParts = dotPath.split(".");
    const lastKey = pathParts.pop();
    const parentPath = pathParts.join(".");
    const parentObj = parentPath ? _.get(this.localClone, parentPath) : this.localClone;

    if (Array.isArray(parentObj)) {
      parentObj.splice(parseInt(lastKey), 1);
    } else {
      delete parentObj[lastKey];
    }

    this.addPatch("remove", path);
    this.renderTree();
  }

  async handleAddNode(path, isArray) {
    const pathName = path ? (path === "/" ? "根目录" : path) : "根目录";

    // 【修复】：删掉 const PromptModal = ... 这行，直接往下看

    let key = "";
    if (!isArray) {
      // 第一次弹窗：获取属性名称
      const namePromptHtml = `您正在 <strong>[${pathName}]</strong> 下新增内容。<br><br>请输入新属性的名称 (例如：好感度、物品名称):`;

      // 【修复】：直接调用，保证大小写正确，且不丢失 this
      key = await GameManager.showPromptModal("新增节点", namePromptHtml);

      // 如果用户点击取消(返回null)或输入为空，则退出
      if (key === null || key.trim() === "") return;
      key = key.trim();
    }

    // 第二次弹窗：获取数据类型（将 \n 替换为 <br> 以适应 HTML 渲染）
    const typePromptHtml = `请为<strong>【${key || "新列表项"}】</strong>选择数据类型 (输入对应数字):<br><br>
  [1] 📝 文本 (普通的文字内容，如角色名称)<br>
  [2] 🔢 数字 (属性数值、数量等)<br>
  [3] 🔘 开关 (是/否，True/False)<br>
  [4] 📦 字典/对象 (包含子属性的复杂结构，用于装备、人物等)<br>
  [5] 🗂️ 列表 (不断添加同类条目的集合，一般情况下不要用)`;

    // 【修复】：同样直接调用
    const typeStr = await GameManager.showPromptModal("选择数据类型", typePromptHtml, "1");

    // 如果用户点击取消，直接退出
    if (typeStr === null) return;

    let defaultVal;
    switch (typeStr.trim()) {
      case "1":
        defaultVal = "新内容";
        break;
      case "2":
        defaultVal = 0;
        break;
      case "3":
        defaultVal = false;
        break;
      case "4":
        defaultVal = {};
        break;
      case "5":
        defaultVal = [];
        break;
      default:
        return; // 输入了 1-5 以外的内容直接退出
    }

    const dotPath = path ? path.replace(/^\//, "").replace(/\//g, ".") : "";
    const parentObj = dotPath ? _.get(this.localClone, dotPath) : this.localClone;

    let newPath = path;
    if (isArray) {
      key = parentObj.length.toString();
      parentObj.push(defaultVal);
      newPath = `${path === "/" ? "" : path}/${key}`;
    } else {
      parentObj[key] = defaultVal;
      newPath = `${path === "/" ? "" : path}/${key}`;
    }

    this.addPatch("add", newPath, defaultVal);
    this.expandedPaths.add(path || "/");
    this.renderTree();
  }

  bindEvents() {
    const tabs = this.panel.querySelectorAll(".fve-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        if (e.target.classList.contains("active")) return;

        tabs.forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");

        const targetView = e.target.getAttribute("data-target");
        this.activeTab = targetView;

        this.panel.querySelector("#fve-deep-view").style.display =
          targetView === "deep" ? "block" : "none";
        this.panel.querySelector("#fve-raw-view").style.display =
          targetView === "raw" ? "flex" : "none";
        this.panel.querySelector("#fve-search-bar").style.display =
          targetView === "deep" ? "flex" : "none";

        if (targetView === "deep") {
          this._syncRawToDeep();
        }
        this.saveState();
      });
    });

    // 缩放逻辑
    const updateZoom = (newZoom) => {
      this.zoom = Math.min(Math.max(0.5, newZoom), 2.0); // 限制缩放范围 50% - 200%
      const container = document.getElementById("fve-tree-container");
      const zoomText = document.getElementById("fve-zoom-level");
      if (container) container.style.transform = `scale(${this.zoom})`;
      if (zoomText) zoomText.innerText = `${Math.round(this.zoom * 100)}%`;
      this.saveState();
    };

    this.panel.querySelector("#fve-zoom-in").onclick = () => updateZoom(this.zoom + 0.1);
    this.panel.querySelector("#fve-zoom-out").onclick = () => updateZoom(this.zoom - 0.1);
    // 双击百分比重置缩放
    this.panel.querySelector("#fve-zoom-level").ondblclick = () => updateZoom(1.0);

    const searchInput = this.panel.querySelector("#fve-search-input");
    if (searchInput) {
      searchInput.addEventListener(
        "input",
        _.debounce((e) => {
          this.renderTree(e.target.value.trim());
        }, 300),
      );
    }

    this.panel.querySelector("#floating-editor-close").addEventListener("click", () => this.hide());
    this.panel.querySelector("#floating-editor-clear").addEventListener("click", () => {
      this.refreshDataState();
    });
    this.panel
      .querySelector("#floating-editor-apply")
      .addEventListener("click", () => this.applyCommands());
    const recoverBtn = this.panel.querySelector("#floating-editor-recover");
    if (recoverBtn) {
      recoverBtn.addEventListener("click", () => this.recoverExtractedVariables());
    }

    this.toggleBtn.addEventListener("click", (e) => {
      if (this.isButtonDragging) {
        this.isButtonDragging = false;
        return;
      }
      this.toggle();
    });

    let buttonDragStart = { x: 0, y: 0 };
    let buttonStartPos = { x: 0, y: 0 };
    let buttonIsDragging = false;
    let touchMoved = false;

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
        this.saveState();
        setTimeout(() => (this.isButtonDragging = false), 100);
      }
    });

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
        this.saveState();
        setTimeout(() => (this.isButtonDragging = false), 100);
      }
    });

    const header = this.panel.querySelector("#floating-editor-header");
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      this.isDragging = true;
      const rect = this.panel.getBoundingClientRect();
      this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    });

    const resizeObserver = new ResizeObserver(
      _.debounce((entries) => {
        for (let entry of entries) {
          if (this.isVisible) {
            this.size = { width: entry.contentRect.width, height: entry.contentRect.height };
            this.saveState();
          }
        }
      }, 200),
    );
    resizeObserver.observe(this.panel);

    document.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        this.position = { x: e.clientX - this.dragOffset.x, y: e.clientY - this.dragOffset.y };
        this.constrainToViewport();
      }
    });
    document.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.saveState();
      }
    });
  }

  async applyCommands() {
    if (this.activeTab === "deep") this.updateRawTextarea();
    const commandsStr = this.panel.querySelector("#floating-editor-textarea").value.trim();

    if (!commandsStr || commandsStr === "[]") {
      this.game.showTemporaryMessage("没有需要应用的变更", 2000);
      return;
    }

    try {
      const isHistoryMode = this.game.isHistoryViewMode;
      const targetIndex = isHistoryMode
        ? this.game.historyViewIndex
        : this.game.chatHistoryCache
          ? this.game.chatHistoryCache.length - 1
          : 0;
      const targetSnapshot = this.game.chatHistoryCache[targetIndex];
      // 基于最干净的内存作为底本进行修改
      const baseStateForEngine = _.cloneDeep(this.game.currentMvuState);

      const newState = await this.game._applyUpdateFallback(commandsStr, baseStateForEngine);
      const errorCommands = Array.isArray(this.game.errorCommands) ? this.game.errorCommands : [];

      if (newState && errorCommands.length === 0) {
        // ✅ 修复：必须无条件赋值！因为我们的新架构要求内存和显示的快照永远绑定！
        this.game.currentMvuState = newState;

        // 🌟 步骤 B：同步给对应的快照并落盘 (固化历史)
        if (targetSnapshot) {
          targetSnapshot.data = _.cloneDeep(newState);
          if (typeof AppStorage !== "undefined") {
            await AppStorage.saveData(this.game._getHistoryKey(), this.game.chatHistoryCache);
          }
        }

        this.game.renderUI(newState.stat_data);

        this.game.showTemporaryMessage("✨ 变量更新成功并已保存！", 3000);
        this.hideErrors();
        this.refreshDataState();
      } else if (errorCommands.length > 0) {
        this.showErrors(errorCommands);
      }
    } catch (e) {
      this.showErrors([`应用失败: ${e.message}`]);
    }
  }

  recoverExtractedVariables() {
    const rawVar = this.game.lastExtractedVariables;

    // 1. 判空拦截
    if (!rawVar || typeof rawVar !== "string") {
      this.game.showTemporaryMessage("当前没有可恢复的提取变量记录", 2000);
      return;
    }

    // 2. 清洗数据（剥离 __UPDATE_VAR__ 前缀）
    const cleanedVar = rawVar.replace("__UPDATE_VAR__", "").trim();
    if (!cleanedVar || cleanedVar === "本次无变量改变") {
      this.game.showTemporaryMessage("当前记录中无有效的变量改变", 2000);
      return;
    }

    // 3. 历史模式判断与提示
    const isHistoryMode = this.game.isHistoryViewMode;
    if (isHistoryMode) {
      this.game.showTemporaryMessage("已恢复（注意：这是最新回合的提取变量）", 3000);
    } else {
      this.game.showTemporaryMessage("✨ 已成功恢复最新提取的变量指令", 2000);
    }

    // 4. 注入编辑器 (复用已有的强大解析方法)
    this.setCommands(cleanedVar);

    // 可选：如果当前在深度编辑模式，可以强制触发一下状态保存
    this.saveState();
  }

  toggle() {
    this.isVisible = !this.isVisible;
    if (this.isVisible) this.show();
    else this.hide();
    this.saveState();
  }

  show() {
    if (this.panel) {
      const isHistoryMode = this.game.isHistoryViewMode;
      const targetIndex = isHistoryMode
        ? this.game.historyViewIndex
        : this.game.chatHistoryCache
          ? this.game.chatHistoryCache.length - 1
          : 0;

      // 🚀 核心修复：只要玩家打开面板，强制重读最新的内存数据。
      this.refreshDataState();

      this.panel.style.display = "flex";
      const treeContainer = document.getElementById("fve-tree-container");
      if (treeContainer) treeContainer.style.transform = `scale(${this.zoom})`;
      this.isVisible = true;
      this.constrainToViewport();
    }
  }

  hide() {
    if (this.panel) {
      this.panel.style.display = "none";
      this.isVisible = false;
    }
  }

  constrainToViewport() {
    if (!this.panel) return;
    const rect = this.panel.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const panelSize = { width: rect.width, height: rect.height };
    this.position = this.PositionConstraints.constrain(this.position, panelSize, viewport);
    this.panel.style.left = `${this.position.x}px`;
    this.panel.style.top = `${this.position.y}px`;
  }

  // --- 补充由于全屏切换导致的坐标重置方法 ---
  ensureCorrectParent() {
    // 延迟 100 毫秒，等待浏览器彻底完成退出全屏的窗口重排
    setTimeout(() => {
      // 1. 如果面板处于打开状态，强制将其约束回当前可视区域内
      if (this.isVisible) {
        this.constrainToViewport();
      }

      // 2. 检查并拉回悬浮齿轮按钮
      if (this.buttonPosition.x !== null && this.toggleBtn) {
        const maxX = window.innerWidth - 48; // 48 是按钮的宽高
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

  showErrors(errors) {
    const errDiv = this.panel.querySelector("#floating-editor-errors");
    if (errDiv) {
      errDiv.innerHTML = errors.map((e) => `• ${e}`).join("<br>");
      errDiv.style.display = "block";
    }
  }

  hideErrors() {
    const errDiv = this.panel.querySelector("#floating-editor-errors");
    if (errDiv) errDiv.style.display = "none";
  }

  saveState() {
    try {
      localStorage.setItem(
        this.EditorStateModel.STORAGE_KEY,
        this.EditorStateModel.serialize({
          isVisible: this.isVisible,
          isMinimized: this.isMinimized,
          position: this.position,
          size: this.size,
          buttonPosition: this.buttonPosition,
          activeTab: this.activeTab,
        }),
      );
    } catch (e) {}
  }

  loadState() {
    const saved = localStorage.getItem(this.EditorStateModel.STORAGE_KEY);
    return saved ? this.EditorStateModel.deserialize(saved) : this.EditorStateModel.defaultState;
  }

  setEnabled(enabled) {
    if (enabled) {
      if (this.toggleBtn) this.toggleBtn.style.display = "flex";
    } else {
      if (this.toggleBtn) this.toggleBtn.style.display = "none";
      this.hide();
    }
  }
}
