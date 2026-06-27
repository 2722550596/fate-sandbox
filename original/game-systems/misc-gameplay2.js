// 文件: misc-gameplay2.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L34432-34579: // ========================================== ---

// ==========================================
// --- 【随机事件系统 结束】 ---
// ==========================================

//=========指令中心===========
//指令中心主入口
showCommandCenter() {
  this.openModal("command-center-modal");
  const body = document.querySelector(
    "#command-center-modal .modal-body",
  );
  if (!body) return;
  if (this.pendingActions.length === 0) {
    body.innerHTML =
      '<p class="modal-placeholder" style="text-align:center; color:var(--text-muted); font-size: var(--text-sm);">暂无待执行的指令。</p>';
    return;
  }
  let html = '<ul class="command-center-actions">';
  this.pendingActions.forEach((cmd) => {
    let actionText = "";
    switch (cmd.action) {
      case "equip":
        actionText = `[装备] ${cmd.itemName} 到 ${cmd.category}`;
        break;
      case "unequip":
        actionText = `[卸下] ${cmd.itemName} 从 ${cmd.category}`;
        break;
      case "use":
        actionText = `[使用] ${cmd.itemName} x ${cmd.quantity}`;
        break;
      case "discard":
        if (cmd.quantity && cmd.quantity > 1) {
          actionText = `[丢弃] ${cmd.itemName} x ${cmd.quantity}`;
        } else {
          actionText = `[丢弃] ${cmd.itemName}`;
        }
        break;
    }
    html += `<li class="command-center-action-item">${actionText}</li>`;
  });
  html += "</ul>";
  body.innerHTML = html;
},
//清理备份条目【已过时，被改造为刷新数据库】
async reloadGameDB() {
  try {
    await GameDBManager.init();
    toastr.success("游戏数据库已更新");
    this.showTemporaryMessage("克莱恩提示：游戏数据库已更新！");
  } catch (error) {
    console.error("重载数据库时出错:", error);
    toastr.error("数据库加载出错，请检查 JSON 格式");
    this.showTemporaryMessage(`重载数据库出错，快检查JSON格式是否出错: ${error.message}`);
  }
},
// 清理缓存 (带自动备份与双重确认)
async refreshLocalStorage() {
  // 第一次确认：询问是否需要保存并导出
  this.showConfirmModal(
    "即将清理此UI的所有本地缓存（存档、设置等）用于解决疑难问题。\n\n⚠️ 强烈建议在清理前【备份并导出】当前进度！是否执行备份？",
    async () => {
      // ✅ 用户选择【是】：执行保存与导出
      try {
        // 生成一个专门用于清理前备份的 slotId
        const backupSlotId = `slot_emergency_${Date.now()}`;
        // ✨ 修复：直接把格式化的时间塞进存档名里
        const timeStr = new Date().toLocaleString("zh-CN", { hour12: false }).replace(/[\/:*\s]/g, "_");
        const saveName = `紧急备份_${timeStr}`;
        
        this.showTemporaryMessage("正在执行清理前自动备份...");
        const saveResult = await this.performSave(backupSlotId, saveName);
        
        if (saveResult) {
          // 保存成功，立刻触发导出
          await this.exportSave(backupSlotId);
          this.showTemporaryMessage("备份与导出指令已发送，即将清理缓存...", 2000);
          
          // 给浏览器留出 2.5 秒触发文件下载的时间，然后再杀进程
          setTimeout(async () => {
            await AppStorage.clearAllData();
            window.location.reload();
          }, 2500);
        } else {
          // 如果保存因为某些原因 return false 了，中断危险操作
          this.showTemporaryMessage("❌ 备份失败，为保护数据，已中止清理操作。");
        }
      } catch (e) {
        console.error("备份流程出错:", e);
        this.showTemporaryMessage("❌ 备份流程发生异常，已中止操作！");
      }
    },
    () => {
      // ❌ 用户选择【否】(取消)：触发二次确认，防止误触导致没保存就清了
      this.showConfirmModal(
        "危险操作：您选择了【不备份】直接清理！\n\n这会导致您的本地数据永久丢失（除非您之前手动导出过），确定继续吗？",
        async () => {
          try {
            await AppStorage.clearAllData();
            this.showTemporaryMessage("历史残影已被强制净化，页面即将刷新...");
            setTimeout(() => window.location.reload(), 1500);
          } catch (e) {
            console.error("清除本地存储失败:", e);
            this.showTemporaryMessage("清除缓存失败！");
          }
        }
      );
    }
  );
},
//保存指令到PendingActions队列
async savePendingActions() {
  try {
    await AppStorage.saveData(
      "pending_actions",
      this.pendingActions,
    );
  } catch (e) {
    console.error("保存指令队列状态失败:", e);
  }
},
//加载队列到指令列表
async loadPendingActions() {
  try {
    const savedActions =
      await AppStorage.loadData("pending_actions");
    // 确保赋值后一定是数组（即使savedActions格式异常）
    this.pendingActions = Array.isArray(savedActions)
      ? savedActions
      : [];
  } catch (e) {
    console.error("加载指令队列状态失败，使用内存缓存:", e);
    // 失败时不删除存储（保留可能的有效数据），只确保内存中是数组
    if (!Array.isArray(this.pendingActions)) {
      this.pendingActions = []; // 仅内存兜底，不删存储
    }
  }
},
async executePendingActions() {
  await this.handleAction();
},
clearPendingActions() {
  this.pendingActions = [];
  this.showCommandCenter();
  this.showTemporaryMessage("指令已清空");
  this.savePendingActions();
},



