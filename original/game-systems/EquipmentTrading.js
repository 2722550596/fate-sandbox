// 文件: EquipmentTrading.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L33276-33752: // ========== 装备交易功能 ======== ---

// ========== 装备交易功能 ========
async initiateTradeFromInventory(item, category) {
  const itemName = this.SafeGetValue(
    item,
    ["名称", "name"],
    "未知物品",
  );

  // 确定物品所属列表
  const listMapping = {
    扮演法: "扮演法列表",
    辅助能力: "辅助能力列表",
    武器: "武器列表",
    衣物: "衣物列表",
    饰品: "饰品列表",
    封印物: "封印物列表",
    消耗品: "消耗品列表",
    杂物: "杂物列表",
  };

  const listName = listMapping[category] || "杂物列表";
  const isConsumable = category === "消耗品" || category === "杂物";

  // 获取玩家ID
  let playerId;
  try {
    playerId = await this.getPlayerId();
  } catch (e) {
    this.showTemporaryMessage("无法获取玩家ID，请确保已登录");
    return;
  }

  // 生成Discord Bot命令 - 普通物品交易
  // 格式：/trade request target: player_id: item_list: item_name: [quantity:]
  let command = `/trade request target: player_id:${playerId} item_list:${listName} item_name:${itemName}`;

  // 如果是消耗品，添加数量参数
  if (isConsumable) {
    const quantity = this.SafeGetValue(
      item,
      ["数量", "quantity"],
      1,
    );
    command += ` quantity:${quantity}`;
  }

  // 显示交易指引模态框
  this.showTradeCommandModal(
    command,
    itemName,
    item,
    false,
    isConsumable,
  );
},

async initiateTradeFromRelationship(charName, character) {
  // 获取玩家ID
  let playerId;
  try {
    playerId = await this.getPlayerId();
  } catch (e) {
    this.showTemporaryMessage("无法获取玩家ID，请确保已登录");
    return;
  }

  // 生成Discord Bot命令 - NPC交易
  // 格式：/trade npc target: buyer_name: player_id: npc_name:
  const command = `/trade npc target: buyer_name: player_id:${playerId} npc_name:${charName}`;

  // 显示交易指引模态框
  this.showTradeCommandModal(
    command,
    charName,
    character,
    true,
    false,
  );
},

showTradeCommandModal(
  command,
  itemName,
  item,
  isNpc = false,
  isConsumable = false,
) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.style.display = "flex";
  modal.style.zIndex = "10001"; // 确保在物品栏模态框之上

  const tier = this.SafeGetValue(
    item,
    isNpc ? "当前序列" : ["品阶", "tier", "序列", "sequence"],
    "普通",
  );
  const formattedTier =
    !isNaN(tier) && tier !== "普通" ? `序列${tier}` : tier;
  const description = this.SafeGetValue(
    item,
    isNpc ? "描述" : ["描述", "description"],
    "无描述",
  );
  const itemTypeText = isNpc ? "人物" : "物品";

  // 根据是否为NPC交易，显示不同的步骤说明
  const stepsHtml = isNpc
    ? `
      <div style="margin-bottom: 8px;">
      <strong style="color: var(--color-primary);">1.</strong> 点击下方按钮复制交易命令
      </div>
      <div style="margin-bottom: 8px;">
      <strong style="color: var(--color-primary);">2.</strong> 在命令中填写 <code style="color: var(--color-primary);">target:</code> 和 <code style="color: var(--color-primary);">buyer_name:</code>（买家的Discord用户名和游戏内名字,前者交易用，后者用于写入NPC事件历史）
      </div>
      <div style="margin-bottom: 8px;">
      <strong style="color: var(--color-primary);">3.</strong> 前往Discord的Bot频道粘贴并发送命令
      </div>
      <div>
      <strong style="color: var(--color-primary);">4.</strong> Bot会生成交易码，分享给买家确认
      </div>
      `
          : `
      <div style="margin-bottom: 8px;">
      <strong style="color: var(--color-primary);">1.</strong> 点击下方按钮复制交易命令
      </div>
      <div style="margin-bottom: 8px;">
      <strong style="color: var(--color-primary);">2.</strong> 在命令中填写 <code style="color: var(--color-primary);">target:</code>（买家的Discord用户名）
      </div>
      <div style="margin-bottom: 8px;">
      <strong style="color: var(--color-primary);">3.</strong> 前往Discord的Bot频道粘贴并发送命令
      </div>
      <div>
      <strong style="color: var(--color-primary);">4.</strong> Bot会生成交易码，买家确认后进行交易
      </div>
      `;

  modal.innerHTML = /* HTML */ `
    <div
      class="modal-content"
      style="max-width: 650px; width: 90%;"
    >
      <div class="modal-header">
        <h2 class="modal-title">📤 发起交易</h2>
        <button
          class="modal-close-btn"
          onclick="this.closest('.modal-overlay').remove()"
        >
          &times;
        </button>
      </div>
      <div class="modal-body" style="padding: 25px;">
        <!-- ${itemTypeText}信息 -->
        <div
          style="background: rgba(var(--rgb-secondary), 0.15); padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(var(--rgb-primary), 0.3);"
        >
          <div
            style="font-size: var(--text-md); color: var(--text-subtle); margin-bottom: 8px; font-weight: bold;"
          >
            ${itemName}
          </div>
          <div
            style="font-size: var(--text-base); color: var(--text-muted); margin-bottom: 5px;"
          >
            <strong style="color: var(--text-subtle);"
              >${isNpc ? "序列" : "等阶"}:</strong
            >
            ${formattedTier}
          </div>
          <div
            style="font-size: var(--text-sm); color: var(--text-muted); font-style: italic;"
          >
            ${description}
          </div>
        </div>

        <!-- 步骤说明 -->
        <div style="margin-bottom: 20px;">
          <div
            style="font-size: var(--text-base); color: var(--text-subtle); margin-bottom: 12px; font-weight: bold;"
          >
            📋 交易步骤：
          </div>
          <div
            style="font-size: var(--text-base); color: var(--text-muted); line-height: 1.8; padding-left: 10px;"
          >
            ${stepsHtml}
          </div>
        </div>

        <!-- 命令框 -->
        <div style="margin-bottom: 20px;">
          <div
            style="font-size: var(--text-base); color: var(--text-subtle); margin-bottom: 8px;"
          >
            Discord Bot 命令：
          </div>
          <div
            style="background: var(--overlay-base); padding: 15px; border-radius: 6px; border: 1px solid var(--color-border-dark); position: relative;"
          >
            <code
              id="trade-command-text"
              style="color: var(--color-primary); font-size: var(--text-base); word-break: break-all; display: block; line-height: 1.6;"
            >
              ${command}
            </code>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div
          style="display: flex; gap: 12px; justify-content: center; margin-bottom: 15px;"
        >
          <button
            id="copy-trade-command-btn"
            class="interaction-btn"
            style="padding: 12px 24px; font-size: var(--text-base); background: var(--color-info); flex: 1; max-width: 200px;"
          >
            📋 复制命令
          </button>
          <a
            href="https://discord.com/channels/1456496749022806193/1456496750490554462"
            target="_blank"
            class="interaction-btn"
            style="padding: 12px 24px; font-size: var(--text-base); background: var(--color-info); text-decoration: none; display: flex; align-items: center; justify-content: center; flex: 1; max-width: 200px;"
          >
            🤖 前往Bot频道
          </a>
        </div>

        <!-- 提示信息 -->
        <div
          style="background: rgba(var(--rgb-primary), 0.1); padding: 12px; border-radius: 6px; border-left: 3px solid var(--color-primary);"
        >
          <div
            style="font-size: var(--text-sm); color: var(--text-muted); line-height: 1.6;"
          >
            <strong style="color: var(--color-primary);"
              >💡 提示：</strong
            ><br />
            • 交易前请与买家确认好价格和交易内容<br />
            • 可以在
            <a
              href="https://discord.com/channels/1456496749022806193/1465255444422328437"
              target="_blank"
              style="color: var(--color-info);"
              >Discord交易区</a
            >
            寻找交易对象<br />
            •
            ${isNpc
              ? "交易完成后会克隆该人物发送给买家（你仍保留原人物）"
              : "交易完成后物品将从你的背包中移除"}
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 绑定复制按钮事件
  const copyBtn = modal.querySelector("#copy-trade-command-btn");
  copyBtn.addEventListener("click", () => {
    const commandText = modal
      .querySelector("#trade-command-text")
      .textContent.trim();
    navigator.clipboard
      .writeText(commandText)
      .then(() => {
        copyBtn.textContent = "✅ 已复制！";
        copyBtn.style.background = "var(--color-success)";
        setTimeout(() => {
          copyBtn.textContent = "📋 复制命令";
          copyBtn.style.background = "var(--color-info)";
        }, 2000);
      })
      .catch((err) => {
        console.error("复制失败:", err);
        this.showTemporaryMessage("复制失败，请手动复制命令");
      });
  });

  // 点击背景关闭
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
},

// 显示交易教程/帮助信息
showTradeHelper() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.style.display = "flex";
  modal.style.zIndex = "10001";

  modal.innerHTML = /* HTML */ `
    <div
      class="modal-content"
      style="max-width: 700px; width: 90%;"
    >
      <div class="modal-header">
        <h2 class="modal-title">❓ 交易功能教程</h2>
        <button
          class="modal-close-btn"
          onclick="this.closest('.modal-overlay').remove()"
        >
          &times;
        </button>
      </div>
      <div class="modal-body" style="padding: 25px;">
        <!-- 功能介绍 -->
        <div
          style="background: rgba(var(--rgb-secondary), 0.15); padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(var(--rgb-primary), 0.3);"
        >
          <div
            style="font-size: var(--text-md); color: var(--text-subtle); margin-bottom: 10px; font-weight: bold;"
          >
            🔄 什么是交易功能？
          </div>
          <div
            style="font-size: var(--text-base); color: var(--text-muted); line-height: 1.8;"
          >
            交易功能允许玩家之间通过Discord
            Bot进行物品和NPC的交易。系统会通过游戏内邮件自动处理物品的增删，确保交易安全可靠。
          </div>
        </div>

        <!-- 如何使用 -->
        <div style="margin-bottom: 20px;">
          <div
            style="font-size: var(--text-base); color: var(--text-subtle); margin-bottom: 12px; font-weight: bold;"
          >
            📋 如何发起交易？
          </div>
          <div
            style="font-size: var(--text-base); color: var(--text-muted); line-height: 1.8; padding-left: 10px;"
          >
            <div style="margin-bottom: 8px;">
              <strong style="color: var(--color-primary);"
                >1.</strong
              >
              在物品栏或人物关系中找到要交易的物品/NPC
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="color: var(--color-primary);"
                >2.</strong
              >
              点击"🔄 交易"按钮
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="color: var(--color-primary);"
                >3.</strong
              >
              系统会自动生成交易命令
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="color: var(--color-primary);"
                >4.</strong
              >
              复制命令并填写买家信息（Discord用户名等）
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="color: var(--color-primary);"
                >5.</strong
              >
              在Discord Bot频道发送命令
            </div>
            <div>
              <strong style="color: var(--color-primary);"
                >6.</strong
              >
              Bot生成交易码后，分享给买家确认交易
            </div>
          </div>
        </div>

        <!-- 命令格式说明 -->
        <div style="margin-bottom: 20px;">
          <div
            style="font-size: var(--text-base); color: var(--text-subtle); margin-bottom: 12px; font-weight: bold;"
          >
            💻 命令格式说明
          </div>
          <div
            style="font-size: var(--text-base); color: var(--text-muted); line-height: 1.8;"
          >
            <div style="margin-bottom: 12px;">
              <strong style="color: var(--color-primary);"
                >普通物品交易：</strong
              ><br />
              <code
                style="background: var(--overlay-light); padding: 8px; display: block; margin-top: 5px; border-radius: 4px; color: var(--color-primary);"
              >
                /trade request target: player_id:
                item_list: item_name: [quantity:]
              </code>
            </div>
            <div>
              <strong style="color: var(--color-primary);"
                >NPC交易：</strong
              ><br />
              <code
                style="background: var(--overlay-light); padding: 8px; display: block; margin-top: 5px; border-radius: 4px; color: var(--color-primary);"
              >
                /trade npc target: buyer_name:
                player_id: npc_name:
              </code>
            </div>
          </div>
        </div>

        <!-- 寻找交易对象 -->
        <div style="margin-bottom: 20px;">
          <div
            style="font-size: var(--text-base); color: var(--text-subtle); margin-bottom: 12px; font-weight: bold;"
          >
            🔍 在哪里寻找交易对象？
          </div>
          <div
            style="font-size: var(--text-base); color: var(--text-muted); line-height: 1.8;"
          >
            <div style="margin-bottom: 10px;">
              •
              <a
                href="https://discord.com/channels/1456496749022806193/1465255444422328437"
                target="_blank"
                style="color: var(--color-info); text-decoration: underline;"
                >Discord交易区</a
              >
              - 专门的交易频道，可以发布交易信息
            </div>
            <div>
              •
              <a
                href="https://discord.com/channels/1134557553011998840/1435321279870931075/1435321279870931075"
                target="_blank"
                style="color: var(--color-info); text-decoration: underline;"
                >类脑主贴</a
              >
              - 查看其他玩家的交易需求
            </div>
          </div>
        </div>

        <!-- 注意事项 -->
        <div
          style="background: rgba(var(--rgb-primary), 0.1); padding: 12px; border-radius: 6px; border-left: 3px solid var(--color-primary);"
        >
          <div
            style="font-size: var(--text-sm); color: var(--text-muted); line-height: 1.6;"
          >
            <strong style="color: var(--color-primary);"
              >⚠️ 注意事项：</strong
            ><br />
            • 交易前务必与对方确认好价格和交易内容<br />
            • 确保填写正确的买家Discord用户名<br />
            • NPC交易会克隆人物，你仍保留原人物<br />
            • 普通物品交易完成后，物品会从你的背包移除
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 点击背景关闭
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
},


