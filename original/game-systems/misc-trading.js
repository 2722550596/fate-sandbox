// 文件: misc-trading.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L33753-33987: // ========================================== ---

// ==========================================
// --- 【新增功能区域：快捷指令系统】 ---
// ==========================================
get quickShortcuts() {
  return GameDBManager.DB.quickShortcuts;
},
set quickShortcuts(val) {
  GameDBManager.DB.quickShortcuts = val;
},
// --- 快捷指令：读取 ---
async loadQuickShortcuts() {
  await GameDBManager.loadQuickShortcuts();
},
// --- 快捷指令：写入 ---
async saveQuickShortcutsToLorebook() {
  try {
    this.showTemporaryMessage("正在保存快捷指令...");
    await GameDBManager.saveQuickShortcuts(this.quickShortcuts);
    this.showTemporaryMessage("快捷指令已保存至源堡");
  } catch (error) {
    console.error("[UI: 快捷指令] 保存失败:", error);
    this.showTemporaryMessage(`保存失败: ${error.message}`);
  }
},
// 3. 初始化快捷指令的 UI（按钮与弹窗容器）
initQuickShortcutsUI() {
  // 在“当前指令”和“当前选项”之间插入按钮
  const btnContainer = document.querySelector(
    ".quick-send-container",
  );
  const btnOptions = document.getElementById("btn-action-options");

  if (
    btnContainer &&
    btnOptions &&
    !document.getElementById("btn-quick-shortcuts")
  ) {
    const shortcutBtn = document.createElement("button");
    shortcutBtn.id = "btn-quick-shortcuts";
    shortcutBtn.className = "interaction-btn btn-shortcut-trigger";
    shortcutBtn.textContent = "快捷";
    shortcutBtn.onclick = () => this.toggleQuickShortcuts();

    // 插入到当前选项按钮的左边
    btnContainer.insertBefore(shortcutBtn, btnOptions);
  }

  // 注入弹窗容器（与 action-options-popup 同级）
  const bottomStatus = document.getElementById(
    "bottom-status-container",
  );
  if (
    bottomStatus &&
    !document.getElementById("quick-shortcuts-popup")
  ) {
    const popup = document.createElement("div");
    popup.id = "quick-shortcuts-popup";
    // 复用当前选项的 CSS 样式以保持 UI 统一
    popup.className = "action-options-popup";
    // 【重点修改】直接用 cssText 强行赋予绝对定位的悬浮样式
    popup.style.display = "none";
    // 插入到底部容器中
    bottomStatus.insertBefore(
      popup,
      document.getElementById("toggle-bottom-panel"),
    );
  }
},
// 4. 切换弹窗显示状态
// 4. 切换弹窗显示状态
async toggleQuickShortcuts() {
  const popup = document.getElementById("quick-shortcuts-popup");
  if (!popup) return;

  if (popup.style.display === "block") {
    popup.style.display = "none";
  } else {
    const optionsPopup = document.getElementById("action-options-popup");
    if (optionsPopup) optionsPopup.style.display = "none";

    await this.loadQuickShortcuts();
    
    // 【新增修复代码】：过滤掉那些已经不存在于 quickShortcuts 中的幽灵指令
    if (this.pendingSupplementary && this.pendingSupplementary.length > 0) {
      this.pendingSupplementary = this.pendingSupplementary.filter(cmd => 
        this.quickShortcuts.includes(cmd)
      );
    }

    this.renderQuickShortcutsPopup();
    popup.style.display = "block";
  }
},
// 5. 渲染快捷指令弹窗内容 (增强视觉反馈与保持选中开关)
renderQuickShortcutsPopup() {
  const popup = document.getElementById("quick-shortcuts-popup");
  if (!popup) return;

  // 【修改】头部布局改为 Flex，左侧放开关，右侧放添加按钮
  let html = `
<div class="quick-shortcuts-header">
<label class="shortcut-keep-label">
<input type="checkbox" id="toggle-keep-shortcuts" class="shortcut-keep-checkbox" ${this.isKeepShortcutsEnabled ? "checked" : ""}>
保持选中
</label>
<button id="btn-add-shortcut" class="interaction-btn btn-add-shortcut">➕ 添加新指令</button>
</div>
`;

  if (this.quickShortcuts.length === 0) {
    html +=
      '<div class="action-options-empty">当前没有快捷指令，请添加。</div>';
  } else {
    html += '<ul class="action-options-list">';
    this.quickShortcuts.forEach((cmd, index) => {
      const isSupplementary =
        this.pendingSupplementary.includes(cmd);

      // 极致干净的动态类名逻辑，没有一行行内样式！
      const icon = isSupplementary ? "🟢" : "⚪";
      const supplementaryClass = isSupplementary
        ? "is-supplementary"
        : "";
      const activeBtnClass = isSupplementary ? "is-active" : "";

      html += `
  <li class="action-options-item editable ${supplementaryClass}" data-index="${index}" style="transition: all 0.3s ease;">
    <textarea class="shortcut-textarea option-textarea">${cmd}</textarea>
    <div class="option-actions">
      <button class="shortcut-btn-immediate option-btn" title="立即抛出">✔️</button>
      <button class="shortcut-btn-supplement option-btn ${activeBtnClass}" title="作为补充指令" style="transition: all 0.2s;">${icon}</button>
      <button class="shortcut-btn-delete option-btn" title="删除此指令">✖️</button>
    </div>
  </li>
  `;
    });
    html += "</ul>";
  }

  popup.innerHTML = html;
  this.bindShortcutEvents();
},
// 6. 绑定交互事件
bindShortcutEvents() {
  const popup = document.getElementById("quick-shortcuts-popup");
  if (!popup) return;

  // (新增) 绑定“保持选中”开关
  const keepToggle = document.getElementById("toggle-keep-shortcuts");
  if (keepToggle) {
    keepToggle.onchange = (e) => {
      this.isKeepShortcutsEnabled = e.target.checked;
    };
  }

  // ➕ 添加新指令
  const addBtn = document.getElementById("btn-add-shortcut");
  if (addBtn) {
    addBtn.onclick = async () => {
      this.quickShortcuts.push("新增快捷指令");
      await this.saveQuickShortcutsToLorebook();
      this.renderQuickShortcutsPopup();
    };
  }

  // 绑定列表项的事件
  popup.querySelectorAll(".action-options-item").forEach((item) => {
    const index = parseInt(item.getAttribute("data-index"));
    const textarea = item.querySelector(".shortcut-textarea");
    const cmdText = this.quickShortcuts[index];

    textarea.onchange = async (e) => {
      const newText = e.target.value.trim();
      if (newText && newText !== cmdText) {
        const suppIndex =
          this.pendingSupplementary.indexOf(cmdText);
        if (suppIndex > -1) {
          this.pendingSupplementary[suppIndex] = newText;
        }
        this.quickShortcuts[index] = newText;
        await this.saveQuickShortcutsToLorebook();
        this.renderQuickShortcutsPopup();
      }
    };

    item.querySelector(".shortcut-btn-delete").onclick =
      async () => {
        this.quickShortcuts.splice(index, 1);
        this.pendingSupplementary =
          this.pendingSupplementary.filter(
            (c) => c !== cmdText,
          );
        await this.saveQuickShortcutsToLorebook();
        this.renderQuickShortcutsPopup();
      };

    item.querySelector(".shortcut-btn-immediate").onclick =
      async () => {
        const finalCmd = textarea.value.trim();
        if (!finalCmd) return;
        document.getElementById(
          "quick-shortcuts-popup",
        ).style.display = "none";
        this.handleAction(finalCmd);
      };

    // ⚪/🟢 设为补充指令 (Toggle 切换)
    item.querySelector(".shortcut-btn-supplement").onclick = (
      e,
    ) => {
      const btn = e.target.closest(".shortcut-btn-supplement");
      const finalCmd = textarea.value.trim();
      if (!finalCmd || !btn) return;

      const suppIndex =
        this.pendingSupplementary.indexOf(finalCmd);

      if (suppIndex > -1) {
        // 取消选中：移除数组，恢复样式
        this.pendingSupplementary.splice(suppIndex, 1);
        btn.innerHTML = "⚪";
        btn.style.cssText = "transition: all 0.2s;";
        item.style.cssText = "transition: all 0.3s ease;"; // 移除外层高亮背景
      } else {
        // 激活选中：加入数组，改变图标、变绿发光、外框高亮
        this.pendingSupplementary.push(finalCmd);
        btn.innerHTML = "🟢";
        btn.style.cssText =
          "color: var(--color-success); text-shadow: 0 0 8px rgba(var(--rgb-success), 0.8); transform: scale(1.1); transition: all 0.2s;";
        item.style.cssText =
          "background-color: rgba(var(--rgb-success), 0.15); border: 1px solid rgba(var(--rgb-success), 0.4); transition: all 0.3s ease;";
      }
    };
  });
},

