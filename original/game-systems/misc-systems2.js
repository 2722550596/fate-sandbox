// 文件: misc-systems2.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L32756-33275: // ==================================================================== ---

// ====================================================================
// 装备流转/核心物品操作函数 (Equip/Unequip/Use/Discard Core Functions)
// ====================================================================

// 判断装备是否相同（减少不必要的深拷贝）
isEquippedItemsEqual(oldItems, newItems) {
  if (!oldItems || !newItems) return false;
  const keys = [
    "wuqi",
    "yiwu",
    "shipin",
    "fengyinwu",
    "banyanfa",
    "fuzhu",
  ];
  return keys.every((key) => {
    // 兼容没有 id 的情况，退化为比较名称
    const oldId = oldItems[key]?.id || oldItems[key]?.名称;
    const newId = newItems[key]?.id || newItems[key]?.名称;
    return oldId === newId;
  });
},
// 新增：统一处理装备槽点击
handleSlotClick(event) {
  // 核心修复：通过 event.currentTarget 稳健地获取当前点击格子的 ID
  const slotElement = event.currentTarget;
  const slotId = slotElement.id;

  if (slotElement.classList.contains("equipped")) {
    // 场景 A：已有装备 -> 执行卸载（原有逻辑会自动触发 showInventory）
    console.log(`[交互] 卸下并更换装备: ${slotId}`);
    this.unequipItem(slotId, slotElement);
  } else {
    // 场景 B：空槽位 -> 直接打开物品栏
    console.log(`[交互] 点击空槽位，跳转物品栏`);

    // 进阶优化：如果你的 showInventory 支持分类筛选，可以根据 ID 传入参数
    const slotKey = slotId.replace("equip-", "");
    const categoryMap = {
      wuqi: "武器",
      yiwu: "衣物",
      shipin: "饰品",
      fengyinwu: "封印物",
      banyanfa: "扮演法",
      fuzhu: "辅助能力",
    };

    this.showInventory(categoryMap[slotKey] || null);
  }
},
// 装备物品（深度修复版：直接修改 stat_data 引用）
equipItem(item, category, buttonElement) {
  const itemName = this.SafeGetValue(item, "名称");

  if (!itemName || itemName === "N/A") {
    this.showTemporaryMessage("物品数据损坏，无法装备。");
    return;
  }

  const categoryMap = {
    武器: "wuqi",
    衣物: "yiwu",
    饰品: "shipin",
    封印物: "fengyinwu",
    扮演法: "banyanfa",
    辅助能力: "fuzhu",
  };
  const slotKey = categoryMap[category];
  const listToSlotMap = {
    wuqi: "武器列表",
    yiwu: "衣物列表",
    shipin: "饰品列表",
    fengyinwu: "封印物列表",
    banyanfa: "扮演法列表",
    fuzhu: "辅助能力列表",
  };
  const listKey = listToSlotMap[slotKey];

  if (!slotKey || !listKey) {
    this.showTemporaryMessage("错误的装备分类。");
    return;
  }

  // 🔴 核心：直接深入内存本体操作
  if (this.currentMvuState && this.currentMvuState.stat_data) {
    const rawItemsDict = this.SafeGetValue(
      this.currentMvuState.stat_data,
      listKey,
      {},
    );

    // 1. 扒下旧装备：在真实内存中将该分类所有物品置为 false
    for (const key in rawItemsDict) {
      if (rawItemsDict[key]) {
        rawItemsDict[key].isEquipped = false;
      }
    }

    // 2. 穿上新装备：严格按照【名称】在内存中寻找本体
    const realItemKey = Object.keys(rawItemsDict).find(
      (k) => rawItemsDict[k].名称 === itemName,
    );

    if (realItemKey) {
      rawItemsDict[realItemKey].isEquipped = true;
      item = rawItemsDict[realItemKey]; // 让局部变量指向本体
    } else {
      console.warn(
        `[警告] 内存 ${listKey} 中找不到物品 ${itemName}，使用传入对象兜底`,
      );
      item.isEquipped = true;
    }
  }

  // 触发全局同步，强制 DOM 和缓存对齐内存
  this.syncEquippedItemsFromBooleans(this.currentMvuState?.stat_data);
  this.refreshEquipmentSlots();

  if (buttonElement && buttonElement.closest("#inventory-modal")) {
    this.showInventory();
  }

  const defaultTextMap = {
    wuqi: "武器",
    yiwu: "衣物",
    shipin: "饰品",
    fengyinwu: "封印物",
    banyanfa: "扮演法",
    fuzhu: "辅助能力",
  };
  this.pendingActions = this.pendingActions.filter(
    (action) => action.itemName !== itemName,
  );
  this.pendingActions.push({
    action: "equip",
    itemName: itemName,
    category: defaultTextMap[slotKey],
  });

  this.showTemporaryMessage(`已装备 ${itemName}`);
  this.updateDisplayedAttributes();
  this.saveEquipmentState();
  this.savePendingActions();
},
// 卸下物品（深度修复版：直接清洗 stat_data 状态）
unequipItem(
  slotId,
  slotElement,
  showMessage = true,
  refreshInventoryUI = true,
) {
  const slotKey = slotId.replace("equip-", "");
  const listToSlotMap = {
    wuqi: "武器列表",
    yiwu: "衣物列表",
    shipin: "饰品列表",
    fengyinwu: "封印物列表",
    banyanfa: "扮演法列表",
    fuzhu: "辅助能力列表",
  };
  const listKey = listToSlotMap[slotKey];
  let unequippedName = "一件装备";

  // 🔴 核心修复：直接暴力清洗内存中该分类的全部装备状态
  if (
    this.currentMvuState &&
    this.currentMvuState.stat_data &&
    listKey
  ) {
    const rawItemsDict = this.SafeGetValue(
      this.currentMvuState.stat_data,
      listKey,
      {},
    );
    for (const key in rawItemsDict) {
      if (
        rawItemsDict[key] &&
        rawItemsDict[key].isEquipped === true
      ) {
        rawItemsDict[key].isEquipped = false; // 直接修改内存本体
        unequippedName = this.SafeGetValue(
          rawItemsDict[key],
          "名称",
          unequippedName,
        );
      }
    }
  }

  // 触发全局同步，让前端 UI 根据刚才清洗的内存重新刷新
  this.syncEquippedItemsFromBooleans(this.currentMvuState.stat_data);
  this.refreshEquipmentSlots();

  if (refreshInventoryUI) {
    this.showInventory();
  }

  const defaultTextMap = {
    wuqi: "武器",
    yiwu: "衣物",
    shipin: "饰品",
    fengyinwu: "封印物",
    banyanfa: "扮演法",
    fuzhu: "辅助能力",
  };
  this.pendingActions = this.pendingActions.filter(
    (action) => action.itemName !== unequippedName,
  );
  this.pendingActions.push({
    action: "unequip",
    itemName: unequippedName,
    category: defaultTextMap[slotKey],
  });

  if (showMessage) {
    this.showTemporaryMessage(`已卸下 ${unequippedName}`);
  }

  this.updateDisplayedAttributes();
  this.saveEquipmentState();
  this.savePendingActions();
},
//使用
useItem(item, buttonElement) {
  const itemName = this.SafeGetValue(item, ["名称", "name"]);
  if (!itemName || itemName === "N/A") {
    this.showTemporaryMessage("物品信息错误，无法使用。");
    return;
  }

  // 1. 严格的数量与防刷校验
  const originalQuantity = parseFloat(
    this.SafeGetValue(item, ["数量", "quantity"], 0),
  );
  const pendingUses = this.pendingActions
    .filter(
      (action) =>
        action.action === "use" && action.itemName === itemName,
    )
    .reduce((total, action) => total + action.quantity, 0);

  if (originalQuantity - pendingUses <= 0) {
    this.showTemporaryMessage(
      `[${itemName}] 已用完或正在等待行动结算。`,
    );
    return;
  }

  // 2. 状态提取与结算
  const statData = this.currentMvuState?.stat_data;
  if (statData) {
    // 解析序列 (兼容容错机制)
    const playerSeqRank =
      typeof parseSequenceRank === "function"
        ? parseSequenceRank(
            this.SafeGetValue(statData, "当前序列", "普通人"),
          )
        : 9;
    const itemSeqRank =
      typeof parseItemSequenceRank === "function"
        ? parseItemSequenceRank(
            this.SafeGetValue(
              item,
              ["序列", "sequence"],
              "普通",
            ),
          )
        : 9;
    const itemType = this.SafeGetValue(item, "类型", "其他");

    // 反噬检定引擎
    let backlashMsg = "";
    if (typeof calculateCorruptionBacklash === "function") {
      const backlash = calculateCorruptionBacklash(
        playerSeqRank,
        itemSeqRank,
        itemType,
      );
      if (backlash > 0) {
        // 【已修复】正确增加失控进度，兼容中英文键名，最高100
        const corruptionKey = statData.hasOwnProperty(
          "失控进度",
        )
          ? "失控进度"
          : statData.hasOwnProperty("Corruption_Level")
            ? "Corruption_Level"
            : "失控进度";
        const oldCorruption = statData[corruptionKey] || 0;
        statData[corruptionKey] = Math.min(
          100,
          oldCorruption + backlash,
        );

        // // 顺便可以微扣一点理智作为附属代价（可选，这里我设定为反噬值的五分之一）
        // statData['当前理智'] = Math.max(0, (statData['当前理智'] || 0) - Math.ceil(backlash / 5));

        backlashMsg = ` ⚠️越阶反噬(失控进度+${backlash})`;
      }
    }

    // 六维属性结算
    const sixAttrs = [
      "活力",
      "灵性",
      "理智",
      "人性",
      "敏捷",
      "运气",
    ];
    let statChanges = [];

    sixAttrs.forEach((attr) => {
      const changeVal = parseFloat(item[attr]);
      // 只有当属性有变动（且不是 NaN）时才处理
      if (!isNaN(changeVal) && changeVal !== 0) {
        const currentKey = "当前" + attr;
        const maxKey = attr;

        const currentVal = statData[currentKey] || 0;
        const maxVal =
          statData[maxKey] !== undefined
            ? statData[maxKey]
            : Infinity;

        // 实施加减法并取整，限制在 0 ~ 上限 之间
        let newVal = currentVal + changeVal;
        newVal = Math.round(
          Math.max(0, Math.min(newVal, maxVal)),
        );

        // 计算出“真实改变的数值”（解决满血吃药还显示+血的假象）
        const actualChange = newVal - currentVal;

        // 写入新值
        statData[currentKey] = newVal;

        // 格式化提示文本（只有实际发生改变，或者作为消耗代价时才显示）
        if (actualChange !== 0 || changeVal < 0) {
          const sign = actualChange > 0 ? "+" : "";
          statChanges.push(`${attr}${sign}${actualChange}`);
        }
      }
    });

    // 立即刷新界面上面板的进度条/数值
    this.updateDisplayedAttributes();
    const changeStr =
      statChanges.length > 0
        ? ` (${statChanges.join(", ")})`
        : "";
    this.showTemporaryMessage(
      `使用了 [${itemName}]${changeStr}${backlashMsg}`,
    );
  } else {
    // 极端兜底
    this.showTemporaryMessage(
      `已将 [使用 ${itemName}] 加入指令队列`,
    );
  }

  // 3. 动作压入队列 (告知AI执行事件)
  const existingAction = this.pendingActions.find(
    (action) =>
      action.action === "use" && action.itemName === itemName,
  );
  if (existingAction) {
    existingAction.quantity++;
  } else {
    this.pendingActions.push({
      action: "use",
      itemName: itemName,
      quantity: 1,
    });
  }

  // 【重要剔除】已删除 item.数量 = originalQuantity - 1;
  // 扣除效果已在 renderInventory 中通过 quantity - pendingUses 完美实现！

  // 4. 保存队列与刷新 UI
  this.savePendingActions();
  this.showInventory();

  // 5. 本地数据持久化 (静默保存，彻底绕过指令解析器)
  if (this.currentMvuState) {
    // 使用异步自执行函数，不阻塞主线程UI
    (async () => {
      try {
        // 直接抓取当前对话消息数组
        const messages =
          typeof getChatMessages === "function"
            ? await getChatMessages("0")
            : null;
        if (messages && messages.length > 0) {
          const messageZero = messages[0];
          // 将我们在内存中已经加减好血量/灵性的数据覆盖进去
          messageZero.data = this.currentMvuState;
          // 静默保存回 SillyTavern，不触发页面刷新
          if (typeof TavernHelper !== "undefined") {
            await TavernHelper.setChatMessages(
              [messageZero],
              {
                refresh: "none",
              },
            );
            console.log(
              "✅ [消耗品结算] 已成功将最新属性静默保存至底层存档。",
            );
          }
        }
      } catch (e) {
        console.error("❌ [消耗品结算] 静默保存状态失败:", e);
      }
    })();
  }
},
//丢弃物品窗口
async promptDiscardQuantity(item, category, itemElement) {
  const itemName = this.SafeGetValue(item, "名称");
  // 1. 改为 parseFloat，兼容小数
  const currentQuantity = parseFloat(this.SafeGetValue(item, "数量", 0));

  const pendingUses = this.pendingActions
    .filter((a) => a.action === "use" && a.itemName === itemName)
    .reduce((t, a) => t + a.quantity, 0);
  const pendingDiscards = this.pendingActions
    .filter((a) => a.action === "discard" && a.itemName === itemName)
    .reduce((t, a) => t + a.quantity, 0);

  // 2. 计算可用数量，处理 JS 浮点数精度问题
  const availableQuantity = Number(
    (currentQuantity - pendingUses - pendingDiscards).toFixed(6),
  );

  if (availableQuantity <= 0) {
    this.showTemporaryMessage(`${itemName} 没有可丢弃的数量。`);
    return;
  }

  // 【修复】：补回缺失的 messageHtml 定义
  const messageHtml = `
    请输入要丢弃的 <strong>${itemName}</strong> 数量：<br>
    <span style="font-size: 0.9em; color: var(--text-muted); margin-top: 8px; display: inline-block;">
      当前可丢弃数量：${availableQuantity}
    </span>
  `;

  // 3. 组装弹窗内部的 HTML 提示文本
  const extraAttr = `min="0.000001" step="any" max="${availableQuantity}"`;

  const options = {
      showSlider: true,
      sliderMin: 1,
      sliderMax: availableQuantity,
      confirmClass: "interaction-btn danger-btn", // 红色/危险按钮
      customButtons: [
        { 
          text: "全部丢弃", 
          className: "interaction-btn danger-btn", 
          resolveValue: availableQuantity // 点击这个按钮，Promise 直接 resolve 这个值
        }
      ]
    };

  const result = await this.showPromptModal("丢弃物品", messageHtml, "1", "number", extraAttr, options);

  // 如果用户点击取消、关闭（返回 null），或者什么都没输入直接确认
  if (result === null || result.trim() === "") return;

  // 5. 获取值并进行合法性校验
  const quantity = parseFloat(result);
  
  if (isNaN(quantity) || quantity <= 0 || quantity > availableQuantity) {
    this.showTemporaryMessage("请输入有效的丢弃数量");
    return;
  }

  // 6. 校验通过，执行后续丢弃逻辑
  this.confirmDiscardItem(item, category, itemElement, quantity);
},
//再次确认
confirmDiscardItem(item, category, itemElement, quantity = 1) {
  const itemName = this.SafeGetValue(item, "名称");
  const hasQuantity = item.hasOwnProperty("数量");

  // 5. 格式化显示的数字，如果是整数就显示整数，小数就显示小数
  const displayQuantity = Number(quantity.toFixed(6));

  let confirmMessage = hasQuantity
    ? `确定要丢弃 ${displayQuantity} 个 ${itemName} 吗？此操作不可恢复。`
    : `确定要丢弃 ${itemName} 吗？此操作不可恢复。`;

  this.showConfirmModal(confirmMessage, () => {
    this.pendingActions.push({
      action: "discard",
      itemName: itemName,
      category: category,
      quantity: quantity, // 这里存入的是浮点数
    });
    this.savePendingActions();
    this.showInventory();
    this.showTemporaryMessage(
      `已将 [丢弃 ${itemName} x${displayQuantity}] 加入指令队列`,
    );
  });
},
//丢弃物品
discardItem(item, category, itemElement) {
  const itemName = this.SafeGetValue(item, "名称");
  if (itemName === "N/A") {
    this.showTemporaryMessage("物品信息错误，无法丢弃。");
    return;
  }
  const hasQuantity = item.hasOwnProperty("数量");
  if (hasQuantity && (category === "消耗品" || category === "杂物")) {
    this.promptDiscardQuantity(item, category, itemElement);
  } else {
    this.confirmDiscardItem(item, category, itemElement, 1);
  }
},


