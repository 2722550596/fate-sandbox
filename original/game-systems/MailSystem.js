// 文件: MailSystem.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L41355-41816: // ==================== 邮件系统 ==================== ---

// ==================== 邮件系统 ====================
async showMailSystem() {
  this.openModal("mail-modal");

  // 显示玩家ID
  const playerId = await this.getPlayerId();
  const playerIdDisplay =
    document.getElementById("player-id-display");
  if (playerIdDisplay) {
    playerIdDisplay.textContent = playerId.substring(0, 8) + "...";
    playerIdDisplay.title = playerId; // 完整ID显示在tooltip
    playerIdDisplay.style.cursor = "pointer";
    playerIdDisplay.onclick = () => {
      navigator.clipboard.writeText(playerId);
      this.showTemporaryMessage("玩家ID已复制到剪贴板");
    };
  }

  // 绑定标签页切换
  this.initMailTabs();

  // 加载邮件和交易
  await Promise.all([this.loadMails(), this.loadPendingTrades()]);
},

initMailTabs() {
  const tabs = document.querySelectorAll(".mail-tab");
  tabs.forEach((tab) => {
    tab.onclick = () => {
      const tabName = tab.dataset.tab;
      if (!tabName) return;

      // 切换标签样式
      tabs.forEach((t) => {
        if (t.dataset.tab) {
          t.style.color = "var(--text-muted)";
          t.style.borderBottomColor = "transparent";
          t.classList.remove("active");
        }
      });
      tab.style.color = "var(--text-main)";
      tab.style.borderBottomColor = "var(--color-primary)";
      tab.classList.add("active");

      // 切换内容
      document.getElementById("mail-tab-content").style.display =
        tabName === "mails" ? "block" : "none";
      document.getElementById("trade-tab-content").style.display =
        tabName === "trades" ? "block" : "none";
    };
  });
},

async getPlayerId() {
  let playerId = await AppStorage.loadData("player_id");
  if (!playerId) {
    playerId = crypto.randomUUID
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
          /[xy]/g,
          (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(
              16,
            );
          },
        );
    await AppStorage.saveData("player_id", playerId);
    console.log("[邮件] 生成新的玩家ID:", playerId);
  }
  return playerId;
},

async loadMails() {
  const mailList = document.getElementById("mail-list");
  const mailEmpty = document.getElementById("mail-empty");
  if (!mailList) return;

  try {
    const playerId = await this.getPlayerId();
    const response = await fetch(`${this.CLOUD_SAVE_SERVER}/api/mail/list/${playerId}`);
    
    if (!response.ok) {
       mailList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">服务暂时不可用 (502)</div>`;
       return;
    }

    const result = await response.json();
    if (result.success) {
      if (result.data.length === 0) {
        mailList.style.display = "none";
        mailEmpty.style.display = "block";
      } else {
        mailList.style.display = "block";
        mailEmpty.style.display = "none";
        mailList.innerHTML = result.data.map((mail) => this.renderMailItem(mail)).join("");

        mailList.querySelectorAll(".mail-claim-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await this.claimMail(btn.dataset.mailId, btn);
          });
        });
      }
      this.updateMailBadge(result.unreadCount);
    }
  } catch (error) {
    console.warn("[邮件] 加载列表失败:", error.message);
    mailList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">连接邮件服务器失败</div>`;
  }
},

renderMailItem(mail) {
  // SQLite存储的是UTC时间，需要正确解析
  const createdAt = mail.created_at.endsWith("Z")
    ? mail.created_at
    : mail.created_at + "Z";
  const time = new Date(createdAt).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
  });
  const hasAttachments =
    mail.attachments && mail.attachments.length > 0;

  // 渲染附件列表
  let attachmentsHtml = "";
  if (hasAttachments) {
    const itemsHtml = mail.attachments
      .map((item) => {
        if (item.itemType === "npc") {
          return /* HTML */ `<div
            style="font-size: var(--text-base); color: var(--text-main); padding: 3px 0;"
          >
            •
            <span style="color: var(--color-primary);"
              >${item.name}</span
            >
            <span
              style="color: var(--text-muted); font-size: var(--text-xs);"
              >(人物 -
              ${item.list || "人物关系列表"})</span
            >
          </div>`;
        } else if (item.itemType === "equipment") {
          // 装备类显示属性
          const stats = [];
          if (item.活力) stats.push(`活力+${item.活力}`);
          if (item.灵性) stats.push(`灵性+${item.灵性}`);
          if (item.理智) stats.push(`理智+${item.理智}`);
          if (item.人性) stats.push(`人性+${item.人性}`);
          if (item.敏捷) stats.push(`敏捷+${item.敏捷}`);
          if (item.运气) stats.push(`运气+${item.运气}`);
          const statsText =
            stats.length > 0
              ? ` [${stats.join(", ")}]`
              : "";
          return /* HTML */ `<div
            style="font-size: var(--text-base); color: var(--text-main); padding: 3px 0;"
          >
            •
            <span style="color: var(--color-primary);"
              >${item.name}</span
            >
            <span
              style="color: var(--text-muted); font-size: var(--text-xs);"
              >(${item.list} -
              ${item.序列 || "普通"})</span
            >${statsText}
          </div>`;
        } else {
          // 消耗品类显示数量
          return /* HTML */ `<div
            style="font-size: var(--text-base); color: var(--text-main); padding: 3px 0;"
          >
            • ${item.name}
            x${item.数量 ||
            item.quantity ||
            1}${item.单位 || item.unit || "件"}
            <span
              style="color: var(--text-muted); font-size: var(--text-xs);"
              >(${item.list})</span
            >
          </div>`;
        }
      })
      .join("");

    attachmentsHtml = `
<div class="mail-attachments" style="margin-top: 10px; padding: 10px; background: rgba(var(--rgb-primary), 0.1); border-radius: 4px; border: 1px dashed rgba(var(--rgb-primary), 0.3);">
<div style="font-size: var(--text-sm); color: var(--color-primary); margin-bottom: 8px;">📦 附件物品:</div>
${itemsHtml}
</div>
`;
  }

  return /* HTML */ `
    <div class="mail-item unread" data-mail-id="${mail.id}">
      <div class="mail-header">
        <div>
          <div class="mail-title">${mail.title}</div>
          <div class="mail-sender">
            发件人: ${mail.sender}
          </div>
        </div>
        <div class="mail-time">${time}</div>
      </div>
      <div class="mail-content">${mail.content}</div>
      ${attachmentsHtml}
      <div style="margin-top: 12px; text-align: right;">
        <button
          class="interaction-btn mail-claim-btn"
          data-mail-id="${mail.id}"
          style="padding: 6px 16px; font-size: var(--text-base);"
        >
          ${hasAttachments ? "领取附件" : "标记已读"}
        </button>
      </div>
    </div>
  `;
},

updateMailBadge(count) {
  const badge = document.getElementById("mail-badge");
  if (badge) {
    if (count > 0) {
      badge.style.display = "block";
      badge.textContent = count > 99 ? "99+" : count;
    } else {
      badge.style.display = "none";
    }
  }
},

/**
 * 核心修改：带退避算法的未读邮件检查（已修复静默穿透漏洞）
 */
async checkUnreadMails() {
  const now = Date.now();
  
  // 1. 如果还在退避冷却期，直接跳过
  if (now < this._mailCheckState.nextCheckTime) {
    // 调试用：如果你想确切知道算法在拦截请求，可以临时打开这个 console
    // console.debug(`[邮件] 退避冷却中，离下次重试还有 ${Math.ceil((this._mailCheckState.nextCheckTime - now)/1000)} 秒`);
    return;
  }

  try {
    const playerId = await this.getPlayerId();
    if (!playerId) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${this.CLOUD_SAVE_SERVER}/api/mail/unread-count/${playerId}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    // 处理 HTTP 层面的错误 (502, 404 等)
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const result = await response.json();
    
    // 2. 核心修复：处理业务层面的错误
    if (result && result.success) {
      this.updateMailBadge(result.unreadCount);
      // 成功后彻底重置状态
      this._mailCheckState.failCount = 0;
      this._mailCheckState.nextCheckTime = 0;
      // console.log("[邮件] 检查成功，退避状态已重置"); 
    } else {
      // 如果后端返回了 200，但 success 为 false，主动抛出错误来触发退避！
      throw new Error(`API Logic Error: ${result?.error || "Unknown Error"}`);
    }

  } catch (error) {
    // 累加失败次数
    this._mailCheckState.failCount++;
    
    // 计算退避时间：基础 30秒，每失败一次翻倍，最高 10 分钟
    const backoffMinutes = Math.min(Math.pow(2, this._mailCheckState.failCount - 1) * 0.5, 10);
    this._mailCheckState.nextCheckTime = now + (backoffMinutes * 60 * 1000);

    // 输出详细的错误原因，方便你区分到底是超时、502 还是 success:false
    console.warn(`[邮件] 检查失败 (${error.message})。下一次重试在 ${backoffMinutes} 分钟后。`);
  }
},

async claimMail(mailId, btn) {
  btn.disabled = true;
  btn.textContent = "领取中...";

  try {
    const playerId = await this.getPlayerId();
    const response = await fetch(
      `${this.CLOUD_SAVE_SERVER}/api/mail/claim/${mailId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      },
    );
    const result = await response.json();

    if (result.success) {
      // 处理附件物品
      if (result.attachments && result.attachments.length > 0) {
        await this.processMailAttachments(result.attachments);
        this.showTemporaryMessage(
          `领取成功！获得 ${result.attachments.length} 件物品`,
        );
      } else {
        this.showTemporaryMessage("邮件已标记为已读");
      }

      // 移除已领取的邮件项
      const mailItem = btn.closest(".mail-item");
      if (mailItem) {
        mailItem.style.transition =
          "opacity 0.3s, transform 0.3s";
        mailItem.style.opacity = "0";
        mailItem.style.transform = "translateX(20px)";
        setTimeout(() => {
          mailItem.remove();
          // 检查是否还有邮件
          const mailList =
            document.getElementById("mail-list");
          if (mailList && mailList.children.length === 0) {
            mailList.style.display = "none";
            document.getElementById(
              "mail-empty",
            ).style.display = "block";
          }
        }, 300);
      }

      // 更新未读数量
      await this.checkUnreadMails();
    } else {
      this.showTemporaryMessage(`领取失败: ${result.error}`);
      btn.disabled = false;
      btn.textContent = "领取";
    }
  } catch (error) {
    console.error("[邮件] 领取失败:", error);
    this.showTemporaryMessage("网络错误，请稍后重试");
    btn.disabled = false;
    btn.textContent = "领取";
  }
},

async processMailAttachments(attachments) {
  // 将附件物品添加到玩家背包
  if (!this.currentMvuState || !this.currentMvuState.stat_data) {
    console.error("[邮件] 无法添加物品：游戏状态不存在");
    return;
  }

  const stat_data = this.currentMvuState.stat_data;

  for (const item of attachments) {
    const listName = item.list; // 如：消耗品列表、武器列表等

    if (item.itemType === "npc") {
      const npcListName = listName || "人物关系列表";
      const npcName =
        item.name || (item.npc ? item.npc.名称 : null);

      if (!npcName) {
        console.error("[邮件] 无法添加人物：缺少名称");
        continue;
      }

      // 确保人物列表存在
      if (!stat_data[npcListName]) {
        stat_data[npcListName] = {
          $meta: { extensible: true },
        };
      }

      const npcData = _.cloneDeep(item.npc || {});
      if (!npcData.名称) npcData.名称 = npcName;
      stat_data[npcListName][npcName] = npcData;
      console.log(
        `[邮件] 添加人物: ${npcName} 到 ${npcListName}`,
      );
      continue;
    }

    // 确保列表存在
    if (!stat_data[listName]) {
      stat_data[listName] = { $meta: { extensible: true } };
    }

    // 根据物品类型构建数据
    let itemData;
    if (item.itemType === "equipment") {
      // 装备类物品
      itemData = {
        名称: item.name,
        序列: item.序列 || "普通",
        类型: item.类型 || "",
        描述: item.描述 || "",
        副作用: item.副作用 || "",
        活力: item.活力 || 0,
        灵性: item.灵性 || 0,
        理智: item.理智 || 0,
        人性: item.人性 || 0,
        敏捷: item.敏捷 || 0,
        运气: item.运气 || 0,
      };
      // 添加装备（装备不叠加，直接添加）
      stat_data[listName][item.name] = itemData;
      console.log(`[邮件] 添加装备: ${item.name} 到 ${listName}`);
    } else {
      // 消耗品/其他类物品
      const quantity = item.数量 || item.quantity || 1;
      itemData = {
        名称: item.name,
        序列: item.序列 || "普通",
        类型: item.类型 || "",
        描述: item.描述 || "",
        数量: quantity,
        单位: item.单位 || item.unit || "件",
      };

      // 检查是否已有同名物品（消耗品可叠加）
      const existingItem = stat_data[listName][item.name];
      if (existingItem && typeof existingItem.数量 === "number") {
        existingItem.数量 += quantity;
        console.log(
          `[邮件] 物品 ${item.name} 数量增加到 ${existingItem.数量}`,
        );
      } else {
        stat_data[listName][item.name] = itemData;
        console.log(
          `[邮件] 添加消耗品: ${item.name} x${quantity} 到 ${listName}`,
        );
      }
    }
  }

  // 刷新UI显示
  this.renderUI(stat_data);

  // 保存到快照
  if (this.chatHistoryCache && this.chatHistoryCache.length > 0) {
    const lastSnapshot =
      this.chatHistoryCache[this.chatHistoryCache.length - 1];
    if (lastSnapshot && lastSnapshot.data) {
      lastSnapshot.data.stat_data = _.cloneDeep(stat_data);
      await AppStorage.saveData(
        this._getHistoryKey(),
        this.chatHistoryCache,
      );
      console.log("[邮件] 物品已保存到存档");
    }
  }
},


