// 文件: misc-gameplay.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L33988-34431: // ========================================== ---

// ==========================================
// --- 【快捷指令系统 结束】 ---
// ==========================================

// ==========================================
// --- 【新增功能区域：随机事件系统】 ---
// ==========================================

// 1. 初始化 UI 并插入入口按钮
initRandomEventsUI() {
  const drawerContent = document.querySelector(
    "#right-drawer .drawer-content",
  );
  const btnInventory = document.getElementById("btn-inventory");
  if (
    drawerContent &&
    btnInventory &&
    !document.getElementById("btn-random-events")
  ) {
    const btn = document.createElement("button");
    btn.id = "btn-random-events";
    btn.className = "interaction-btn";
    btn.innerHTML = "🎲 随机事件";
    btn.onclick = () => {
      this.loadRandomEntries().then(() =>
        this.openRandomEventsModal(),
      );
    };
    drawerContent.insertBefore(btn, btnInventory);
  }

  // 【优化】注入带遮罩的弹窗框架
  if (!document.getElementById("random-events-overlay")) {
    const overlay = document.createElement("div");
    overlay.id = "random-events-overlay";
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.id = "random-events-modal";

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 将事件委托绑定到 overlay 上
    this.bindRandomEventsDelegation(overlay);
  }
},

// 2. 加载随机事件（手术级修复 JSON 解析）

// 🌟 使用 Getter 代理，保证 this.randomEntries 永远指向最新的全局数据
get randomEntries() {
  return GameDBManager.DB.randomEntries;
},
set randomEntries(val) {
  GameDBManager.DB.randomEntries = val;
},

// --- 随机事件：加载 (被外部调用时，转包给 DB) ---
async loadRandomEntries() {
  await GameDBManager.loadRandomEntries();
},

// --- 随机事件：批量保存 (只管传数据和弹提示) ---
async saveAllRandomEntries() {
  if (!this.randomEntries || this.randomEntries.length === 0) return;

  try {
    this.showTemporaryMessage("正在保存随机事件...");
    await GameDBManager.saveRandomEntries(this.randomEntries);
    this.showTemporaryMessage(`✅ 成功保存全部 ${this.randomEntries.length} 个条目到主库`, 3000);
  } catch (error) {
    console.error("[UI: 随机事件] 保存失败:", error);
    this.showTemporaryMessage(`保存失败: ${error.message}`);
  }
},

// 核心抽取算法优化版
executeRandomDraw(entry, count = 1) {
  if (!entry || !entry.事件列表 || entry.事件列表.length === 0)
    return [];

  let validItems = entry.事件列表.filter(
    (item) => item.name && item.name.trim() !== "",
  );
  if (validItems.length === 0) return [];

  let results = [];
  let itemsPool = [...validItems];
  let limit = Math.min(count, itemsPool.length);

  // 【优化】初始权重只计算一次
  let totalWeight = itemsPool.reduce(
    (sum, item) => sum + Math.max(0, Number(item.weight) || 0),
    0,
  );

  for (let i = 0; i < limit; i++) {
    if (totalWeight <= 0) break;

    let randomVal = Math.random() * totalWeight;
    let currentSum = 0;
    let foundIdx = -1;

    for (let j = 0; j < itemsPool.length; j++) {
      const weight = Math.max(
        0,
        Number(itemsPool[j].weight) || 0,
      );
      currentSum += weight;
      if (randomVal <= currentSum) {
        foundIdx = j;
        break;
      }
    }

    if (foundIdx !== -1) {
      const match = itemsPool[foundIdx];
      const weight = Math.max(0, Number(match.weight) || 0);

      // 【优化】动态替换模板，支持任意字段
      let text = entry.输出指令 || "";
      Object.keys(match).forEach((key) => {
        const reg = new RegExp(`\\$\\{${key}\\}`, "g");
        text = text.replace(reg, match[key] || "");
      });

      results.push({
        entryName: entry.name,
        eventName: match.name,
        order: entry.order || 99,
        text: text,
      });

      // 【优化】更新权重和池子，避免重新 reduce
      totalWeight -= weight;
      itemsPool.splice(foundIdx, 1);
    }
  }
  return results;
},

// 5. 被动检定拦截器 (在发包前调用)
checkPassiveRandomEvents() {
  if (!this.randomEntries || this.randomEntries.length === 0) return;

  let passiveTriggeredNames = [];

  this.randomEntries.forEach((entry) => {
    if (entry.isEnabled && Number(entry.触发率) > 0) {
      if (Math.random() <= Number(entry.触发率)) {
        let results = this.executeRandomDraw(
          entry,
          entry.抽取数量 || 1,
        );
        if (results.length > 0) {
          this.pendingRandomEvents.push(...results);
          // 收集被动触发的具体事件名
          passiveTriggeredNames.push(
            ...results.map((r) => `【${r.eventName}】`),
          );
        }
      }
    }
  });
},

// 6. UI: 打开弹窗并渲染
openRandomEventsModal() {
  this.closeAllModals();
  const overlay = document.getElementById("random-events-overlay");
  if (overlay) {
    // 【全屏修复】将整个遮罩层挂载到全屏元素下
    const fullscreenEl =
      document.fullscreenElement ||
      document.webkitFullscreenElement;
    if (fullscreenEl && overlay.parentNode !== fullscreenEl) {
      fullscreenEl.appendChild(overlay);
    } else if (
      !fullscreenEl &&
      overlay.parentNode !== document.body
    ) {
      document.body.appendChild(overlay);
    }

    // Flex 布局会让里面的 modal 自动完美居中
    overlay.style.display = "flex";
    if (
      this.randomEntries.length > 0 &&
      this.currentActiveRandomIndex === null
    ) {
      this.currentActiveRandomIndex = 0;
    }
    this.renderRandomEventsView();
  }
},

// 7. UI: 渲染原生视图（列表 + 编辑器）
renderRandomEventsView() {
  const modal = document.getElementById("random-events-modal");
  if (!modal) return;

  // --- 1. 准备子组件的 HTML ---

  // 生成左侧列表 HTML
  const listHtml = this.randomEntries
    .map(
      (entry, idx) => `
      <div class="re-list-item ${idx === this.currentActiveRandomIndex ? "active" : ""}" data-action="select-entry" data-idx="${idx}">
      <div class="re-list-title">${entry.name || "未命名"}</div>
      <div class="re-list-desc">
        状态: ${entry.isEnabled ? '<span class="re-status-on">开启</span>' : "关闭"} | 排序: ${entry.order || 1}
      </div>
      </div>
      `,
    )
    .join("");

  // 生成右侧编辑器 HTML
  let editorHtml = "";
  const activeEntry =
    this.currentActiveRandomIndex !== null
      ? this.randomEntries[this.currentActiveRandomIndex]
      : null;

  if (activeEntry) {
    // 修改后：将宽度百分比替换为 flex 比例，更丝滑
    let eventsHtml = (activeEntry.事件列表 || [])
      .map(
        (ev, vIdx) => `
        <div class="re-event-card">
        <div class="re-event-card-actions">
          <div class="modal-close-btn" data-action="delete-event" data-vidx="${vIdx}" title="删除此事件">&times;</div>
        </div>
          <div class="re-flex-row">
            <div class="re-form-group"><label>权重</label><input type="number" class="re-input modal-input" data-field="weight" data-vidx="${vIdx}" value="${ev.weight || 10}"></div>
            <div class="re-form-group"><label>类别 (Type)</label><input type="text" class="re-input modal-input" data-field="type" data-vidx="${vIdx}" value="${ev.type || ""}"></div>
            <div class="re-form-group"><label>名称 (Name)</label><input type="text" class="re-input modal-input" data-field="name" data-vidx="${vIdx}" value="${ev.name || ""}"></div>
          </div>
          <div class="re-form-group"><label>内容描述 (Description)</label><textarea class="re-input modal-input" data-field="description" data-vidx="${vIdx}" rows="2">${ev.description || ""}</textarea></div>
        </div>
        `,
      )
      .join("");

    // 修改后：清除了所有巨无霸内联样式
    editorHtml = `
        <div class="modal-header">
          <h2 class="modal-title">基础设置</h2>
          <div style="display: flex; gap: 10px; margin-left: auto">
            <button class="interaction-btn" data-action="manual-trigger">▶ 手动触发</button>
            <button class="interaction-btn" data-action="save-entry">💾 保存全部</button>
          </div>
          <button class="modal-close-btn" data-action="close-modal" title="关闭窗口">&times;</button>
        </div>

        <div class="re-editor-scroll-area">
        <div class="re-settings-row">
          <div class="re-form-group"><label>条目名称</label><input type="text" class="re-input modal-input" data-field="entry-name" value="${activeEntry.name || ""}"></div>
          <div class="re-form-group"><label>排序(越小越前)</label><input type="number" class="re-input modal-input" data-field="entry-order" value="${activeEntry.order || 1}"></div>
          <div class="re-form-group"><label>被动触发率(0-1)</label><input type="number" step="0.00001" class="re-input modal-input" data-field="entry-prob" value="${activeEntry.触发率 || 0}"></div>
          <div class="re-form-group"><label>单次抽取量</label><input type="number" class="re-input modal-input" data-field="entry-count" value="${activeEntry.抽取数量 || 1}"></div>
        </div>
        <div class="re-form-group"><label>是否启用： <input type="checkbox" data-field="entry-enabled" ${activeEntry.isEnabled ? "checked" : ""}></label></div>
        <div class="re-form-group"><label>输出指令模板 (可用变量: \${type}, \${name}, \${description})</label><textarea class="re-input modal-input" data-field="entry-template" rows="2">${activeEntry.输出指令 || ""}</textarea></div>

        <div class="re-section-divider">
          <h2 class="re-section-title">事件列表 (权重抽卡)</h2>
          <button class="interaction-btn" data-action="add-event">➕ 添加新事件</button>
        </div>
        <div>${eventsHtml || '<div class="re-empty-state">暂无事件子项</div>'}</div>
        </div>
        `;
  } else {
    editorHtml = `<div class="re-empty-state">请选择或新建一个条目</div>`;
  }

  // --- 2. 核心优化：判断是否需要全量渲染 ---

  let listContainer = modal.querySelector(".re-list");
  let mainContainer = modal.querySelector(".re-main");

  // 如果容器还不存在（初次打开），渲染整体框架
  if (!listContainer || !mainContainer) {
    modal.innerHTML = /* HTML */ `
      <div class="re-sidebar">
        <div class="re-sidebar-header">
          <span class="re-sidebar-title">🎲 随机事件库</span>
          <button
            class="interaction-btn"
            data-action="add-entry"
          >
            新建
          </button>
        </div>
        <div class="re-list"></div>
      </div>
      <div class="re-main"></div>
    `;
    listContainer = modal.querySelector(".re-list");
    mainContainer = modal.querySelector(".re-main");
  }

  // --- 3. 局部更新并保留滚动位置 ---

  // 记录列表当前的滚动位置
  const oldListScrollTop = listContainer.scrollTop;

  // 只更新列表内容
  listContainer.innerHTML = listHtml;

  // 只更新主编辑器内容
  mainContainer.innerHTML = editorHtml;

  // 恢复列表滚动位置
  listContainer.scrollTop = oldListScrollTop;
},

// 8. 原生事件委托中心 (绑定一次即可处理所有内部交互)
bindRandomEventsDelegation(overlay) {
  overlay.addEventListener("click", (e) => {
    // 【新增】点击外层半透明遮罩直接关闭弹窗
    if (e.target === overlay) {
      overlay.style.display = "none";
      return;
    }

    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const activeEntry =
      this.randomEntries[this.currentActiveRandomIndex];

    switch (action) {
      case "close-modal":
        overlay.style.display = "none";
        break;
      case "select-entry":
        this.currentActiveRandomIndex = parseInt(
          btn.getAttribute("data-idx"),
        );
        this.renderRandomEventsView();
        break;
      case "add-entry":
        this.randomEntries.push({
          name: "新随机事件",
          isEnabled: false,
          order: 10,
          触发率: 0,
          抽取数量: 1,
          输出指令:
            "需要触发的剧情：${type}-${name}，描述：${description}",
          事件列表: [],
        });
        this.currentActiveRandomIndex =
          this.randomEntries.length - 1;
        this.renderRandomEventsView();
        break;
      case "save-entry":
      case "save-all": // 新代码名
        this.saveAllRandomEntries();
        break;
      case "manual-trigger":
        if (activeEntry) {
          const res = this.executeRandomDraw(
            activeEntry,
            activeEntry.抽取数量 || 1,
          );
          if (res.length > 0) {
            this.pendingRandomEvents.push(...res);
            const names = res
              .map((r) => `【${r.eventName}】`)
              .join("、");
            this.showTemporaryMessage(
              `手动触发成功！抽中了 ${names}，将在本轮随对话抛出。`,
              3000,
            );
          } else {
            this.showTemporaryMessage(
              "未抽中任何有效事件（请检查是否有有效名称）",
              2000,
            );
          }
        }
        break;
      case "add-event":
        if (activeEntry) {
          if (!activeEntry.事件列表)
            activeEntry.事件列表 = [];
          activeEntry.事件列表.push({
            weight: 10,
            type: "",
            name: "",
            description: "",
          });
          this.renderRandomEventsView();
        }
        break;
      case "delete-event":
        if (activeEntry && confirm("确定删除这个子项吗？")) {
          const vIdx = parseInt(
            btn.getAttribute("data-vidx"),
          );
          activeEntry.事件列表.splice(vIdx, 1);
          this.renderRandomEventsView();
        }
        break;
    }
  });

  // 处理输入框的实时同步 (利用 change 事件)
  overlay.addEventListener("change", (e) => {
    // ... (这部分代码保持不变，依旧是根据 data-field 处理同步) ...
    const input = e.target;
    const field = input.getAttribute("data-field");
    if (!field) return;

    const activeEntry =
      this.randomEntries[this.currentActiveRandomIndex];
    if (!activeEntry) return;

    if (field === "entry-name") activeEntry.name = input.value;
    if (field === "entry-order")
      activeEntry.order = parseInt(input.value) || 1;
    if (field === "entry-prob")
      activeEntry.触发率 = parseFloat(input.value) || 0;
    if (field === "entry-count")
      activeEntry.抽取数量 = parseInt(input.value) || 1;
    if (field === "entry-enabled")
      activeEntry.isEnabled = input.checked;
    if (field === "entry-template")
      activeEntry.输出指令 = input.value;

    if (["weight", "type", "name", "description"].includes(field)) {
      const vIdx = parseInt(input.getAttribute("data-vidx"));
      if (activeEntry.事件列表[vIdx]) {
        if (field === "weight")
          activeEntry.事件列表[vIdx][field] =
            parseInt(input.value) || 0;
        else activeEntry.事件列表[vIdx][field] = input.value;
      }
    }
  });
},

