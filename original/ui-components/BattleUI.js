// BattleUI.js - 来源: original.js

// === class BattleUI (行 7007-7418) ===

class BattleUI {
  constructor() {
    this.battleManager = null;
    this.currentMvuState = null;
    this.game = null; // GameManager 实例引用
    this.isModalOpen = false;
    this.currentView = "team-builder"; // 'team-builder' 或 'battle'

    // UI组件引用
    this.modalOverlay = null;
    this.modalContent = null;
    this.teamBuilderUI = null;
    this.battleDisplayUI = null;

    // 悬浮按钮状态
    this.isButtonDragging = false;
    this.floatingButton = null;

    console.log("[BattleUI] 战斗UI控制器已初始化");
  }

  /**
   * 初始化UI
   * @param {Object} currentMvuState - 当前MVU状态
   */
  initialize(currentMvuState) {
    this.currentMvuState = currentMvuState;

    // 创建入口按钮
    this.createEntryButton();

    // 创建悬浮窗按钮
    this.createFloatingButton();

    // 创建模态框结构
    this.createModalStructure();

    console.log("[BattleUI] UI初始化完成");
  }

  /**
   * 创建入口按钮（在右侧交互面板）
   */
  createEntryButton() {
    // HTML 中已经有按钮了，只需要绑定事件
    const button = document.getElementById("btn-battle-system");
    if (!button) {
      console.warn("[BattleUI] 未找到战斗系统按钮");
      return;
    }

    // 绑定点击事件
    button.onclick = () => this.openModal();

    console.log("[BattleUI] 入口按钮事件已绑定");
  }

  /**
   * 创建悬浮窗按钮
   */
  createFloatingButton() {
    // 检查设置中是否启用悬浮窗
    const floatingEnabled = localStorage.getItem("battle-floating-enabled") !== "false";

    if (!floatingEnabled) {
      return;
    }

    const button = document.createElement("button");
    button.id = "battle-floating-btn";
    button.innerHTML = "⚔️";
    button.title = "战斗系统";

    // 设置样式
    button.style.cssText = `
            position: fixed;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(var(--rgb-secondary), 0.9), rgba(var(--rgb-primary), 0.9));
            border: 2px solid var(--color-primary);
            color: var(--text-main);
            font-size: 24px;
            cursor: move;
            z-index: 9998;
            box-shadow: 0 4px 12px var(--overlay-base);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        `;

    // 加载保存的位置
    const savedPosition = this.loadFloatingPosition();
    button.style.left = savedPosition.x + "px";
    button.style.top = savedPosition.y + "px";

    // 添加拖动功能
    this.makeFloatingButtonDraggable(button);

    // 点击打开模态框
    button.onclick = (e) => {
      if (!this.isButtonDragging) {
        this.openModal();
      }
    };

    // 悬停效果
    button.onmouseenter = () => {
      button.style.transform = "scale(1.1)";
      button.style.boxShadow = "0 6px 16px var(--overlay-dark)";
    };
    button.onmouseleave = () => {
      button.style.transform = "scale(1)";
      button.style.boxShadow = "0 4px 12px var(--overlay-base)";
    };

    document.body.appendChild(button);
    this.floatingButton = button;
    console.log("[BattleUI] 悬浮窗按钮已创建");
  }

  /**
   * 使悬浮按钮可拖动
   */
  makeFloatingButtonDraggable(button) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    let touchMoved = false;

    // 鼠标拖动
    button.onmousedown = (e) => {
      if (e.button !== 0) return; // 只响应左键

      isDragging = true;
      this.isButtonDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      initialX = button.offsetLeft;
      initialY = button.offsetTop;

      e.preventDefault();
    };

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // 如果移动超过5px，标记为拖动
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        this.isButtonDragging = true;
      }

      let newX = initialX + deltaX;
      let newY = initialY + deltaY;

      // 边界检查
      const maxX = window.innerWidth - button.offsetWidth;
      const maxY = window.innerHeight - button.offsetHeight;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      button.style.left = newX + "px";
      button.style.top = newY + "px";
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;

        // 保存位置
        this.saveFloatingPosition({
          x: button.offsetLeft,
          y: button.offsetTop,
        });

        // 延迟重置拖动标记，避免触发点击事件
        setTimeout(() => {
          this.isButtonDragging = false;
        }, 100);
      }
    });

    // 触摸拖动
    button.addEventListener(
      "touchstart",
      (e) => {
        touchMoved = false;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        initialX = button.offsetLeft;
        initialY = button.offsetTop;
      },
      { passive: true },
    );

    button.addEventListener(
      "touchmove",
      (e) => {
        const touch = e.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          touchMoved = true;
          this.isButtonDragging = true;
          e.preventDefault();

          let newX = initialX + deltaX;
          let newY = initialY + deltaY;

          // 边界检查
          const maxX = window.innerWidth - button.offsetWidth;
          const maxY = window.innerHeight - button.offsetHeight;

          newX = Math.max(0, Math.min(newX, maxX));
          newY = Math.max(0, Math.min(newY, maxY));

          button.style.left = newX + "px";
          button.style.top = newY + "px";
        }
      },
      { passive: false },
    );

    button.addEventListener("touchend", () => {
      if (touchMoved) {
        touchMoved = false;

        // 保存位置
        this.saveFloatingPosition({
          x: button.offsetLeft,
          y: button.offsetTop,
        });

        setTimeout(() => {
          this.isButtonDragging = false;
        }, 100);
      }
    });
  }

  /**
   * 加载悬浮窗位置
   */
  loadFloatingPosition() {
    const saved = localStorage.getItem("battle-float-button-position");
    if (saved) {
      try {
        const position = JSON.parse(saved);

        // 边界检查：如果保存的位置超出屏幕，重置到默认位置
        if (
          position.x > window.innerWidth ||
          position.y > window.innerHeight ||
          position.x < 0 ||
          position.y < 0
        ) {
          console.warn("[BattleUI] 保存的位置超出屏幕，使用默认位置");
          return {
            x: window.innerWidth - 70,
            y: window.innerHeight - 70,
          };
        }

        return position;
      } catch (e) {
        console.warn("[BattleUI] 加载悬浮窗位置失败:", e);
      }
    }

    // 默认位置：右下角
    return {
      x: window.innerWidth - 70,
      y: window.innerHeight - 70,
    };
  }

  /**
   * 保存悬浮窗位置
   */
  saveFloatingPosition(position) {
    localStorage.setItem("battle-float-button-position", JSON.stringify(position));
  }

  /**
   * 创建模态框结构
   */
  createModalStructure() {
    // 创建遮罩层
    const overlay = document.createElement("div");
    overlay.id = "battle-modal-overlay";
    overlay.className = "modal-overlay";
    overlay.style.display = "none";

    // 创建模态框内容
    const content = document.createElement("div");
    content.id = "battle-modal-content";
    content.className = "modal-content";
    content.style.cssText = `
            width: 90%;
            max-width: 1200px;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

    // 创建标题栏
    const header = document.createElement("div");
    header.className = "modal-header";
    header.innerHTML = `
            <h2 style="margin: 0; color: var(--color-primary);">⚔️ 战斗系统</h2>
            <button class="modal-close-btn" id="battle-modal-close">✕</button>
        `;

    // 创建主体区域
    const body = document.createElement("div");
    body.id = "battle-modal-body";
    body.className = "modal-body";
    body.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        `;

    // 组装模态框
    content.appendChild(header);
    content.appendChild(body);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // 保存引用
    this.modalOverlay = overlay;
    this.modalContent = content;

    // 绑定关闭事件
    document.getElementById("battle-modal-close").onclick = () => this.closeModal();
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        this.closeModal();
      }
    };

    console.log("[BattleUI] 模态框结构已创建");
  }

  /**
   * 打开模态框
   */
  openModal() {
    if (this.isModalOpen) return;

    // 🔥 关键修复：每次打开时重新获取最新的变量数据
    if (this.game && this.game.currentMvuState) {
      this.currentMvuState = this.game.currentMvuState;
      console.log("[BattleUI] 已刷新最新变量数据");
    }

    // 关闭其他可能打开的模态框，避免冲突
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      if (modal.id !== "battle-modal-overlay") {
        modal.style.display = "none";
      }
    });

    this.isModalOpen = true;
    this.modalOverlay.style.display = "flex";
    document.body.style.overflow = "hidden"; // 阻止背景滚动

    // 显示队伍组建界面
    this.showTeamBuilder();

    console.log("[BattleUI] 模态框已打开");
  }

  /**
   * 关闭模态框
   */
  closeModal() {
    if (!this.isModalOpen) return;

    this.isModalOpen = false;
    this.modalOverlay.style.display = "none";
    document.body.style.overflow = ""; // 恢复背景滚动

    console.log("[BattleUI] 模态框已关闭");
  }

  /**
   * 显示队伍组建界面
   */
  showTeamBuilder() {
    this.currentView = "team-builder";
    const body = document.getElementById("battle-modal-body");
    body.innerHTML = "";

    // 创建队伍组建UI
    if (!this.teamBuilderUI) {
      this.teamBuilderUI = new TeamBuilderUI(this);
    }

    this.teamBuilderUI.render(body);
  }

  /**
   * 显示战斗界面
   */
  showBattleDisplay(battleManager) {
    this.currentView = "battle";
    this.battleManager = battleManager;

    const body = document.getElementById("battle-modal-body");
    body.innerHTML = "";

    // 创建战斗显示UI
    if (!this.battleDisplayUI) {
      this.battleDisplayUI = new BattleDisplayUI(this);
    }

    this.battleDisplayUI.render(body, battleManager);
  }
}
