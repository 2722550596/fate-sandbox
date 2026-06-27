// 文件: GuimiConsole.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L38849-39286: // ====== 源堡系统 (Debug 控制台) ====== ---

// ====== 源堡系统 (Debug 控制台) ======
async showGuimiSystem() {
  this.openModal("guimi-system-modal");
  const body = document.querySelector("#guimi-system-modal .modal-body");
  if (!body) return;

  // 1. 注入基础 Tab 框架与样式 (应用全新的 modal-tab 类)
  // 注意：移除了原先杂乱的 inline style，依靠 .active 类来控制显示
  body.innerHTML = `
    <div class="guimi-debug-container" style="display: flex; flex-direction: column; height: 100%;">
      
      <div class="modal-tabs" style="padding: 0 0 12px 0;"> <div class="modal-tab active" data-target="guimi-db">源堡数据</div>
        <div class="modal-tab" data-target="guimi-logs">历史日志</div>
        <div class="modal-tab" data-target="guimi-actions">操作面板</div>
      </div>

      <div class="modal-tab-content active" id="guimi-db">${this._renderGuimiDBStatus()}</div>
      <div class="modal-tab-content" id="guimi-logs">${this._renderGuimiLogs()}</div>
      <div class="modal-tab-content" id="guimi-actions">${this._renderGuimiActions()}</div>
      
    </div>
  `;

  // 2. 绑定所有交互事件
  this._bindGuimiEvents();
},

// 渲染：数据库状态检测面板
_renderGuimiDBStatus() {
  let html = `<div class="db-status-list">`;
  const db = GameDBManager.DB;
  const tracker = GameDBManager.sourceTracker || {}; 
  
  for (const key in db) {
    const val = db[key];
    let statusText = '❌ 异常 (空/未定义)';
    let color = 'var(--text-danger, #ff4d4f)';
    let count = 0;

    if (val instanceof Map) {
      count = val.size;
    } else if (Array.isArray(val)) {
      count = val.length;
    } else if (val && typeof val === 'object') {
      count = Object.keys(val).length;
    }

    if (count > 0) {
      if (tracker[key] === "worldbook") {
        statusText = `✅ 正常 (${count} 项)`;
        color = 'var(--text-success, #52c41a)'; 
      } else {
        statusText = `⚠️ 兜底数据 (${count} 项)`;
        color = 'var(--color-warning, #faad14)'; 
      }
    } else {
      statusText = '❌ 彻底损坏 (无数据)';
      color = 'var(--text-danger, #ff4d4f)';
    }

    // 使用提取出来的类名 .guimi-db-item 和 .attribute-name
    html += `
      <div class="guimi-db-item">
        <span class="attribute-name" style="font-weight: bold;">${key}</span>
        <span class="attribute-value" style="color: ${color};">${statusText}</span>
      </div>
    `;
  }
  html += `</div>`;
  return html;
},

// 渲染：控制台日志面板
_renderGuimiLogs() {
  const logs = typeof GameLogsManager !== 'undefined' ? GameLogsManager.getLogs() : [];
  
  // ✨ 导出按钮提到了最上方，方便第一时间点击
  let html = `
    <div class="guimi-log-header">
      <button id="btn-export-logs" class="interaction-btn">📥 导出观测记录 (TXT)</button>
    </div>
    <div class="guimi-log-container">
  `;

  if(logs.length === 0) {
    html += '<p style="color: var(--text-subtle); text-align: center; margin: 0;">暂无观测记录...</p>';
  } else {
    const displayLogs = [...logs].reverse();
    const FOLD_THRESHOLD = 80; 

    displayLogs.forEach(log => {
      // 这里的颜色控制依然用内联比较好，因为它是动态的逻辑颜色
      const typeColor = log.type === 'ERROR' ? '#ff4d4f' : log.type === 'WARN' ? '#faad14' : '#52c41a';
      let messageHtml = '';

      if (log.message.length > FOLD_THRESHOLD) {
        const summaryText = log.message.substring(0, FOLD_THRESHOLD).replace(/</g, "&lt;").replace(/>/g, "&gt;") + "...";
        const fullText = log.message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        messageHtml = `
          <details class="guimi-log-details">
            <summary class="guimi-log-summary">
              ${summaryText} <span style="color: var(--color-info, #409eff); font-size: 0.9em;">[展开]</span>
            </summary>
            <div class="guimi-log-full" style="border-left: 2px solid ${typeColor};">
              ${fullText}
            </div>
          </details>
        `;
      } else {
        const safeText = log.message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        messageHtml = `<span style="color: var(--text-main);">${safeText}</span>`;
      }

      html += `
        <div class="guimi-log-line">
          <span style="color: var(--text-muted); margin-right: 5px;">[${log.timestamp}]</span>
          <span style="color: ${typeColor}; font-weight: bold; margin-right: 5px;">[${log.type}]</span>
          ${messageHtml}
        </div>
      `;
    });
  }
  
  html += `</div>`;
  return html;
},

// 渲染：操作中心面板
_renderGuimiActions() {
  // 复用现有的 interaction-btn 和 danger-btn
  return `
    <div class="guimi-actions-container">
      <button id="btn-reload-db" class="interaction-btn" style="padding: 12px;">🔄 重载世界法则 (刷新数据库)</button>
      <button id="btn-clear-cache" class="interaction-btn" style="padding: 12px;">🧹 净化历史残影 (清理缓存)</button>
      <hr style="border-color: rgba(var(--rgb-secondary, 255,255,255), 0.2); margin: 5px 0;" />
      <button id="btn-trigger-guimi" class="interaction-btn danger-btn" style="padding: 12px;">⚠️ 源堡重启 (失控重置)</button>
    </div>
  `;
},

// 绑定事件处理器
_bindGuimiEvents() {
  const modal = document.querySelector("#guimi-system-modal");
  if (!modal) return;

  // 1. Tab 切换逻辑 (使用通用类)
  const tabBtns = modal.querySelectorAll(".modal-tab");
  const tabContents = modal.querySelectorAll(".modal-tab-content");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      // 移除所有激活状态
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      // 激活当前点击的 Tab 和对应的内容区
      const targetId = e.target.getAttribute("data-target");
      e.target.classList.add("active");
      
      const targetContent = modal.querySelector(`#${targetId}`);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });

  // 2. 导出日志按钮
  const btnExport = modal.querySelector("#btn-export-logs");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      if(typeof GameLogsManager !== 'undefined') GameLogsManager.exportLogs();
    });
  }

  // 3. 刷新数据库按钮
  const btnReloadDB = modal.querySelector("#btn-reload-db");
  if (btnReloadDB) {
  btnReloadDB.addEventListener("click", async () => {
    // 1. 执行重载逻辑（如果是异步的请加上 await）
    if (typeof this.reloadGameDB === 'function') {
      await this.reloadGameDB();
    }

    // 2. 重新渲染数据库状态面板
    const dbContainer = modal.querySelector("#guimi-db");
    if (dbContainer) {
      // 注入新的渲染结果
      dbContainer.innerHTML = this._renderGuimiDBStatus();
    }
  });
}

  // 4. 清理缓存按钮
  const btnClearCache = modal.querySelector("#btn-clear-cache");
  if (btnClearCache) {
    btnClearCache.addEventListener("click", () => this.refreshLocalStorage());
  }

  // 5. 失控重置按钮 (保留你原有的逻辑)
  const btnReset = modal.querySelector("#btn-trigger-guimi");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      this.showConfirmModal(
        "你确定要重置时间线吗？所有未固化的记忆都将消散在历史迷雾中。",
        async () => {
          try {
            const command = "{{user}}选择了重置，世界将回到最初的锚点";
            await this.handleAction(command);
            this.showTemporaryMessage("时间线已重置...");
            this.closeAllModals();
          } catch (error) {
            console.error("执行重置指令时出错:", error);
            this.showTemporaryMessage("重置指令失败！");
          }
        }
      );
    });
  }
},

//=============DLC===============
//DLC系统
async showDLCManager() {
  this.openModal("dlc-manager-modal");
  const container = document.querySelector("#dlc-entries-container");
  if (!container) return;

  container.innerHTML =
    '<p style="text-align: center; color: var(--text-muted); font-size: var(--text-sm);">正在加载DLC条目...</p>';

  try {
    const bookName = WorldbookManager.PRIMARY_BOOK;
    const allEntries =
      await TavernHelper.getLorebookEntries(bookName);

    // 筛选出包含【DLC】标记的条目
    const dlcEntries = allEntries.filter(
      (entry) =>
        entry.comment && entry.comment.includes("【DLC】"),
    );

    if (dlcEntries.length === 0) {
      container.innerHTML =
        '<div class="dlc-no-entries">未找到任何DLC条目<br>（世界书条目comment需包含"【DLC】"标记）</div>';
      return;
    }

    console.log(`[DLC管理器] 找到 ${dlcEntries.length} 个DLC条目`);

    // 渲染DLC条目列表
    const renderEntries = () => {
      container.innerHTML = dlcEntries
        .map((entry) => {
          const isEnabled = entry.enabled || false;
          const displayName =
            entry.comment || entry.name || "(未命名)";
          const previewText = entry.content
            ? entry.content
                .substring(0, 100)
                .replace(/\n/g, " ")
            : "(无内容)";

          return /* HTML */ `
            <div
              class="dlc-entry-item"
              data-name="${this.safeEscapeHtml(
                entry.comment || "",
              )}"
            >
              <div class="dlc-entry-info">
                <div
                  class="dlc-entry-name"
                  title="${this.safeEscapeHtml(
                    displayName,
                  )}"
                >
                  ${this.safeEscapeHtml(displayName)}
                </div>
                <div class="dlc-entry-preview">
                  ${this.safeEscapeHtml(
                    previewText,
                  )}${entry.content &&
                  entry.content.length > 100
                    ? "..."
                    : ""}
                </div>
              </div>
              <div
                class="dlc-entry-toggle ${isEnabled
                  ? "active"
                  : ""}"
                data-name="${this.safeEscapeHtml(
                  entry.comment || "",
                )}"
                data-enabled="${isEnabled}"
              ></div>
            </div>
          `;
        })
        .join("");

      // 为所有开关按钮添加点击事件
      container
        .querySelectorAll(".dlc-entry-toggle")
        .forEach((toggle) => {
          toggle.addEventListener("click", async (e) => {
            e.stopPropagation();
            const targetName = toggle.dataset.name; // 改为读取 name
            const currentEnabled =
              toggle.dataset.enabled === "true";
            const newEnabled = !currentEnabled;

            console.log(
              `[DLC管理器] 点击开关 - name: ${targetName}, 当前状态: ${currentEnabled}`,
            );

            // 从dlcEntries中找到对应的条目（用comment匹配，因为我们存的是comment）
            const targetEntry = dlcEntries.find(
              (e) => e.comment === targetName,
            );
            if (!targetEntry) {
              console.error(
                "[DLC管理器] 未找到对应条目, name:",
                targetName,
              );
              console.log(
                "[DLC管理器] 当前dlcEntries:",
                dlcEntries.map((e) => ({
                  comment: e.comment,
                  enabled: e.enabled,
                })),
              );
              this.showTemporaryMessage(
                "错误：未找到条目",
              );
              return;
            }

            try {
              console.log(
                `[DLC管理器] 正在${newEnabled ? "启用" : "禁用"}条目: ${targetEntry.comment}`,
              );

              // 获取当前角色卡绑定的主要世界书
              const charWorldbooks =
                window.TavernHelper.getCharWorldbookNames(
                  "current",
                );
              const primaryWorldbook =
                charWorldbooks.primary;

              if (!primaryWorldbook) {
                console.warn(
                  "[DLC管理器] 未找到绑定的世界书",
                );
                this.showTemporaryMessage(
                  "错误：未找到绑定的世界书",
                );
                return;
              }

              // 使用updateWorldbookWith（战斗状态切换的方式）
              let changedCount = 0;
              await window.TavernHelper.updateWorldbookWith(
                primaryWorldbook,
                (worldbook) => {
                  worldbook.forEach((entry) => {
                    // 关键：用 entry.name 匹配（就像战斗状态切换一样）
                    if (entry.name === targetName) {
                      const oldState =
                        entry.enabled;
                      entry.enabled = newEnabled;
                      if (
                        oldState !==
                        entry.enabled
                      ) {
                        console.log(
                          `[DLC管理器] ${entry.name}: ${oldState ? "开启" : "关闭"} -> ${entry.enabled ? "开启" : "关闭"}`,
                        );
                        changedCount++;
                      }
                    }
                  });
                  return worldbook;
                },
                { render: "immediate" },
              ); // 关键：立即渲染

              if (changedCount > 0) {
                console.log(
                  `[DLC管理器] 世界书条目已更新，共修改 ${changedCount} 个条目`,
                );

                // 更新本地数据
                targetEntry.enabled = newEnabled;

                // 重新渲染UI
                renderEntries();

                this.showTemporaryMessage(
                  newEnabled
                    ? "DLC条目已启用"
                    : "DLC条目已禁用",
                  1000,
                );
              } else {
                console.warn(
                  "[DLC管理器] 所有条目状态已是目标状态，无需修改",
                );
                this.showTemporaryMessage(
                  "状态未改变",
                  1000,
                );
              }
            } catch (error) {
              console.error(
                "[DLC管理器] 切换失败:",
                error,
              );
              this.showTemporaryMessage(
                "操作失败，请重试",
              );
            }
          });
        });
    };

    // 初始渲染
    renderEntries();
  } catch (error) {
    console.error("[DLC管理器] 加载失败:", error);
    container.innerHTML =
      '<div class="dlc-no-entries">加载失败，请重试</div>';
  }
},



