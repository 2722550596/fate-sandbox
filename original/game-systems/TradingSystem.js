// 文件: TradingSystem.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L41817-42232: // ==================== 交易系统 ==================== ---

// ==================== 交易系统 ====================
async loadPendingTrades() {
  const tradeList = document.getElementById("trade-list");
  const tradeEmpty = document.getElementById("trade-empty");
  const tradeBadge = document.getElementById("trade-badge");
  if (!tradeList) return;

  try {
    const playerId = await this.getPlayerId();
    const response = await fetch(`${this.CLOUD_SAVE_SERVER}/api/trade/pending/${playerId}`);
    
    if (!response.ok) {
       if (tradeBadge) tradeBadge.style.display = "none";
       return;
    }

    const result = await response.json();
    if (result.success) {
      if (result.data.length === 0) {
        tradeList.style.display = "none";
        tradeEmpty.style.display = "block";
        if (tradeBadge) tradeBadge.style.display = "none";
      } else {
        tradeList.style.display = "block";
        tradeEmpty.style.display = "none";
        tradeList.innerHTML = result.data.map((trade) => this.renderTradeItem(trade)).join("");

        if (tradeBadge) {
          tradeBadge.style.display = "inline";
          tradeBadge.textContent = result.data.length;
        }

        tradeList.querySelectorAll(".trade-confirm-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await this.confirmTrade(btn.dataset.tradeCode, btn);
          });
        });
        // ... (取消按钮绑定保持不变)
      }
    }
  } catch (error) {
    console.warn("[交易] 加载列表失败:", error.message);
  }
},

renderTradeItem(trade) {
  const createdAt = trade.created_at.endsWith("Z")
    ? trade.created_at
    : trade.created_at + "Z";
  const time = new Date(createdAt).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
  });
  const item = trade.item_data;
  const isConsumable = item.itemType === "consumable";
  const isNpc = item.itemType === "npc";

  return /* HTML */ `
    <div
      class="trade-item"
      data-trade-code="${trade.trade_code}"
      style="padding: 15px; background: var(--overlay-light); border: 1px solid rgba(var(--rgb-primary), 0.4); border-radius: 8px; margin-bottom: 12px;"
    >
      <div
        style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;"
      >
        <div>
          <div
            style="font-size: var(--text-md); font-weight: bold; color: var(--color-primary);"
          >
            🔄 交易确认
          </div>
          <div
            style="font-size: var(--text-xs); color: var(--text-muted);"
          >
            交易码: ${trade.trade_code}
          </div>
        </div>
        <div
          style="font-size: var(--text-xs); color: var(--text-muted);"
        >
          ${time}
        </div>
      </div>
      <div
        style="background: rgba(var(--rgb-secondary), 0.2); padding: 10px; border-radius: 4px; margin-bottom: 12px;"
      >
        <div
          style="font-size: var(--text-base); color: var(--text-main); margin-bottom: 5px;"
        >
          <strong>${isNpc ? "人物" : "物品"}:</strong>
          ${item.name}
          ${isConsumable ? `x${item.数量 || 1}` : ""}
        </div>
        <div
          style="font-size: var(--text-sm); color: var(--text-muted);"
        >
          <strong>来源:</strong> ${item.list}
        </div>
      </div>
      <div
        style="font-size: var(--text-sm); color: var(--color-danger); margin-bottom: 12px; padding: 8px; background: rgba(var(--rgb-danger), 0.2); border-radius: 4px;"
      >
        ⚠️
        确认后，${isNpc
          ? "将克隆该人物并发送给对方（你仍保留原人物）"
          : "该物品将从你的背包中移除并发送给对方"}
      </div>
      <div
        style="display: flex; gap: 10px; justify-content: flex-end;"
      >
        <button
          class="interaction-btn trade-cancel-btn"
          data-trade-code="${trade.trade_code}"
          style="padding: 8px 16px; font-size: var(--text-base); background: var(--color-border-dark);"
        >
          取消
        </button>
        <button
          class="interaction-btn trade-confirm-btn"
          data-trade-code="${trade.trade_code}"
          style="padding: 8px 16px; font-size: var(--text-base); background: var(--color-info);"
        >
          确认交易
        </button>
      </div>
    </div>
  `;
},

async confirmTrade(tradeCode, btn) {
  btn.disabled = true;
  btn.textContent = "处理中...";

  try {
    const playerId = await this.getPlayerId();

    // 先获取交易详情
    const detailRes = await fetch(
      `${this.CLOUD_SAVE_SERVER}/api/trade/${tradeCode}`,
    );
    const detailResult = await detailRes.json();

    if (!detailResult.success) {
      this.showTemporaryMessage(
        `交易失败: ${detailResult.error}`,
      );
      btn.disabled = false;
      btn.textContent = "确认交易";
      return;
    }

    const trade = detailResult.data;
    const item = trade.item_data;

    // 检查物品是否存在
    if (!this.currentMvuState || !this.currentMvuState.stat_data) {
      this.showTemporaryMessage("游戏状态不存在，无法完成交易");
      btn.disabled = false;
      btn.textContent = "确认交易";
      return;
    }

    const stat_data = this.currentMvuState.stat_data;
    const listName = item.list;

    if (!stat_data[listName] || !stat_data[listName][item.name]) {
      this.showTemporaryMessage(
        `物品 "${item.name}" 不存在于 ${listName}`,
      );
      btn.disabled = false;
      btn.textContent = "确认交易";
      return;
    }

    const existingItem = stat_data[listName][item.name];

    // 交易自动化：确认时深拷贝卖家背包/人物列表里的真实数据，并通过override发送给服务器
    let overrideItemData = null;
    if (item.itemType === "npc") {
      const npcName = item.name;
      const npcData = _.cloneDeep(existingItem);
      if (!npcData.名称) npcData.名称 = npcName;

      let buyerName = item.buyerName;
      if (typeof buyerName !== "string" || !buyerName.trim()) {
        buyerName =
          window.prompt(
            "请输入买家名字（将写入该人物的事件历史）",
            "",
          ) || "";
      }
      buyerName = (buyerName || "").trim();

      const timeKeyBase =
        this.currentMvuState?.world_data?.当前时间纪元 || stat_data["当前时间纪元"] || new Date().toISOString();
      const timeKey = `${timeKeyBase} [交易${tradeCode}]`;
      const historyObj =
        npcData.事件历史 &&
        typeof npcData.事件历史 === "object" &&
        !Array.isArray(npcData.事件历史)
          ? npcData.事件历史
          : {};
      npcData.事件历史 = {
        ...historyObj,
        [timeKey]: `被卖到了另外一条时间线的诡秘世界，买家是${buyerName || "未知"}，交易码${tradeCode}`,
      };

      overrideItemData = {
        itemType: "npc",
        list: listName,
        name: npcName,
        npc: npcData,
      };
    } else if (item.itemType === "equipment") {
      const equipmentName = item.name;
      const equipmentData = _.cloneDeep(existingItem);
      if (!equipmentData.名称) equipmentData.名称 = equipmentName;

      // 将完整装备数据发送给对方（避免依赖Discord填写的详细参数）
      overrideItemData = {
        itemType: "equipment",
        list: listName,
        name: equipmentName,
        ...equipmentData,
      };
    } else if (item.itemType === "consumable") {
      const consumableName = item.name;
      const requiredQty = item.数量 || 1;
      const consumableData = _.cloneDeep(existingItem);
      if (!consumableData.名称)
        consumableData.名称 = consumableName;
      consumableData.数量 = requiredQty;

      // 将完整消耗品数据发送给对方，但数量使用本次交易的数量
      overrideItemData = {
        itemType: "consumable",
        list: listName,
        name: consumableName,
        ...consumableData,
      };
    }

    // 对于消耗品，检查数量是否足够
    if (item.itemType === "consumable") {
      const requiredQty = item.数量 || 1;
      if ((existingItem.数量 || 0) < requiredQty) {
        this.showTemporaryMessage(
          `物品数量不足，需要 ${requiredQty}，当前 ${existingItem.数量 || 0}`,
        );
        btn.disabled = false;
        btn.textContent = "确认交易";
        return;
      }
    }

    let didMutateInventory = false;
    // 从背包中移除物品（NPC交易改为“克隆发送”，不删除原人物）
    if (item.itemType === "npc") {
      console.log(`[交易] 克隆人物发送: ${item.name}`);
    } else if (item.itemType === "consumable") {
      const requiredQty = item.数量 || 1;
      existingItem.数量 -= requiredQty;
      if (existingItem.数量 <= 0) {
        delete stat_data[listName][item.name];
      }
      didMutateInventory = true;
      console.log(
        `[交易] 移除消耗品: ${item.name} x${requiredQty}`,
      );
    } else {
      // 装备类直接删除
      delete stat_data[listName][item.name];
      didMutateInventory = true;
      console.log(`[交易] 移除装备: ${item.name}`);
    }

    // 保存游戏状态（仅当确实改动了背包/数量）
    if (didMutateInventory) {
      this.renderUI(stat_data);
      if (
        this.chatHistoryCache &&
        this.chatHistoryCache.length > 0
      ) {
        const lastSnapshot =
          this.chatHistoryCache[
            this.chatHistoryCache.length - 1
          ];
        if (lastSnapshot && lastSnapshot.data) {
          lastSnapshot.data.stat_data =
            _.cloneDeep(stat_data);
          await AppStorage.saveData(
            this._getHistoryKey(),
            this.chatHistoryCache,
          );
        }
      }
    }

    // 通知服务器确认交易
    const confirmRes = await fetch(
      `${this.CLOUD_SAVE_SERVER}/api/trade/confirm/${tradeCode}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          itemData: overrideItemData || undefined,
        }),
      },
    );

    const confirmResult = await confirmRes.json();

    if (confirmResult.success) {
      this.showTemporaryMessage(
        item.itemType === "npc"
          ? "交易确认成功！人物克隆体已发送给对方"
          : "交易确认成功！物品已发送给对方",
      );

      // 移除交易项
      const tradeItem = btn.closest(".trade-item");
      if (tradeItem) {
        tradeItem.style.transition = "opacity 0.3s";
        tradeItem.style.opacity = "0";
        setTimeout(() => {
          tradeItem.remove();
          // 检查是否还有交易
          const tradeList =
            document.getElementById("trade-list");
          if (tradeList && tradeList.children.length === 0) {
            tradeList.style.display = "none";
            document.getElementById(
              "trade-empty",
            ).style.display = "block";
            const tradeBadge =
              document.getElementById("trade-badge");
            if (tradeBadge)
              tradeBadge.style.display = "none";
          }
        }, 300);
      }
    } else {
      // 交易确认失败，需要回滚物品
      this.showTemporaryMessage(
        `交易确认失败: ${confirmResult.error}`,
      );
      // TODO: 回滚物品（复杂情况暂不处理）
      btn.disabled = false;
      btn.textContent = "确认交易";
    }
  } catch (error) {
    console.error("[交易] 确认失败:", error);
    this.showTemporaryMessage("网络错误，请稍后重试");
    btn.disabled = false;
    btn.textContent = "确认交易";
  }
},

async cancelTrade(tradeCode, btn) {
  btn.disabled = true;
  btn.textContent = "取消中...";

  try {
    const response = await fetch(
      `${this.CLOUD_SAVE_SERVER}/api/trade/cancel/${tradeCode}`,
      {
        method: "POST",
      },
    );

    const result = await response.json();

    if (result.success) {
      this.showTemporaryMessage("交易已取消");

      // 移除交易项
      const tradeItem = btn.closest(".trade-item");
      if (tradeItem) {
        tradeItem.style.transition = "opacity 0.3s";
        tradeItem.style.opacity = "0";
        setTimeout(() => {
          tradeItem.remove();
          const tradeList =
            document.getElementById("trade-list");
          if (tradeList && tradeList.children.length === 0) {
            tradeList.style.display = "none";
            document.getElementById(
              "trade-empty",
            ).style.display = "block";
            const tradeBadge =
              document.getElementById("trade-badge");
            if (tradeBadge)
              tradeBadge.style.display = "none";
          }
        }, 300);
      }
    } else {
      this.showTemporaryMessage(`取消失败: ${result.error}`);
      btn.disabled = false;
      btn.textContent = "取消";
    }
  } catch (error) {
    console.error("[交易] 取消失败:", error);
    this.showTemporaryMessage("网络错误，请稍后重试");
    btn.disabled = false;
    btn.textContent = "取消";
  }
},
}; //GameManager结束

//==============================================
//=================GameManager结束=============
//==============================================


