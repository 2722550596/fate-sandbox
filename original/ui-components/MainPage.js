// 文件: MainPage.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L23557-24951: // ===========主页面（含组件与实现函数） ========== ---

// ===========主页面（含组件与实现函数） ==========
//==============================================

//===============================
//-----------页面左侧-------------
//===============================

//页面左侧调查员档案（属性数值、进度条） 、阵营信息处理+渲染
async updateDisplayedAttributes(currentViewSnapshot) {
  // 1. 无脑基于 currentMvuState 重新计算一遍属性并存盘。
  // 无论是刚读档、换装备、吃药，这里都会保证数据绝对正确且同步到当前时空。
  await this.recalculateAttributesAndSave();

  // 2. 拿到刚刚经过修正的绝对正确的状态
  const stat_data = this.currentMvuState?.stat_data || {};

  // 性能拦截器：UI没变就不重绘
  const currentHash = JSON.stringify(stat_data);
  if (this._lastProcessedStatHash === currentHash) return; 
  this._lastProcessedStatHash = currentHash;

  // ================== 以下为纯粹的 DOM 渲染逻辑 ==================
  const updateText = (elId, current, max) => {
    const el = document.getElementById(elId);
    if (el) el.innerText = `${current} / ${max}`;
  };
  const updateSingleValueText = (elId, value) => {
    const el = document.getElementById(elId);
    if (el) el.innerText = value;
  };

  // 2. 纯粹的渲染逻辑：直接从 stat_data 里取数画图
  GLOBAL_ATTR_CONFIG.forEach((attr) => {
    const maxVal = Number(this.SafeGetValue(stat_data, attr.key, 0));
    
    // 🌟 修复点 2：取消对 <= 0 的拦截，允许负数进入 UI 渲染流程
    if (isNaN(maxVal)) return;

    if (attr.key === "运气") {
      updateSingleValueText(`attr-${attr.uiId}`, maxVal);
      const progressBar = document.getElementById(`progress-${attr.uiId}`);
      if (progressBar) {
        // 如果运气是负数，进度条空掉；如果大于 0 才拉满
        progressBar.style.width = maxVal > 0 ? "100%" : "0%";
        progressBar.className = maxVal > 0 ? "attribute-progress-fill high" : "attribute-progress-fill low";
      }
    } else {
      const currentVal = Number(this.SafeGetValue(stat_data, attr.currentVar, 0));
      const safeCurrentVal = Math.min(currentVal, maxVal);
      // 文本正常显示负数，比如 -10 / -10
      updateText(`attr-${attr.uiId}`, safeCurrentVal, maxVal);

      const progressBar = document.getElementById(`progress-${attr.uiId}`);
      if (progressBar) {
        // 🌟 核心防御：专门针对负数和 0 的进度条保护
        let percentage = 0;
        // 只有当上限和当前值都大于 0 时，才计算进度条，否则一律死血 (0%)
        if (maxVal > 0 && safeCurrentVal > 0) {
          percentage = (safeCurrentVal / maxVal) * 100;
        }
        
        progressBar.style.width = `${percentage}%`;
        
        if (percentage >= 67) progressBar.className = "attribute-progress-fill high";
        else if (percentage >= 34) progressBar.className = "attribute-progress-fill medium";
        else progressBar.className = "attribute-progress-fill low";
      }
    }
  });

  // 年龄 UI
  updateSingleValueText("attr-shengli", `${this.SafeGetValue(stat_data, "身体年龄")} / ${this.SafeGetValue(stat_data, "身体年龄上限", "未知")}`);
  updateSingleValueText("attr-xinli", `${this.SafeGetValue(stat_data, "灵魂年龄")} / ${this.SafeGetValue(stat_data, "灵魂年龄上限", "未知")}`);

  // 阵营 UI（完整保留原有逻辑）
  const campParent = stat_data.阵营 || {};
  const allCamps = Object.entries(campParent)
    .filter(([key]) => key !== "$meta")
    .map(([originalKey, data]) => ({
      ...data, 阵营名: data.名称 || originalKey, originalKey: originalKey
    }));
  const campSwitcher = document.getElementById("camp-select");
  const noCampTips = "未加入任何阵营";

  if (allCamps.length > 1) {
    campSwitcher.style.display = "inline-block";
    campSwitcher.innerHTML = "";
    allCamps.forEach((camp) => {
      const option = document.createElement("option");
      option.value = camp.originalKey;
      option.textContent = camp.阵营名;
      campSwitcher.appendChild(option);
    });
  } else {
    campSwitcher.style.display = "none";
  }

  const updateCampAttributes = (selectedCamp) => {
    if (!selectedCamp) {
      ["name", "position", "influence", "nature", "reputation", "core", "task", "enemy", "resources"].forEach(field => {
        const def = (field === "influence") ? "0/100" : (field === "reputation") ? "0" : (field === "nature") ? "中立" : (field === "name") ? noCampTips : "无";
        updateSingleValueText(`attr-camp-${field}`, def);
      });
      document.getElementById("attr-camp-name")?.classList.remove("camp-name-highlight");
      document.getElementById("attr-camp-position")?.classList.remove("camp-position-highlight");
      return;
    }

    updateSingleValueText("attr-camp-name", selectedCamp.阵营名 || "未知");
    document.getElementById("attr-camp-name")?.classList.add("camp-name-highlight");
    updateSingleValueText("attr-camp-position", selectedCamp.职位 || "无");
    document.getElementById("attr-camp-position")?.classList.add("camp-position-highlight");

    const influence = typeof selectedCamp.影响力 === "number" ? Math.min(selectedCamp.影响力, 100) : 0;
    updateSingleValueText("attr-camp-influence", `${influence}/100`);
    updateSingleValueText("attr-camp-nature", selectedCamp.阵营性质 || "中立");
    
    const reputation = typeof selectedCamp.声望 === "number" ? Math.min(selectedCamp.声望, 100000) : 0;
    updateSingleValueText("attr-camp-reputation", `${reputation}`);
    updateSingleValueText("attr-camp-core", selectedCamp.核心成员 || "无");
    updateSingleValueText("attr-camp-task", selectedCamp.当前任务 || "无");
    updateSingleValueText("attr-camp-task-desc", selectedCamp.任务描述 || "无");
    updateSingleValueText("attr-camp-task-reward", selectedCamp.任务奖励 || "无");
    updateSingleValueText("attr-camp-enemy", selectedCamp.敌对阵营 || "无");

    const campResources = selectedCamp.阵营资源 || {};
    const resourceEntries = Object.entries(campResources);
    if (resourceEntries.length > 0) {
      updateSingleValueText("attr-camp-resources", resourceEntries.map(([k, v]) => `${k}：${v}`).join("\n"));
    } else {
      updateSingleValueText("attr-camp-resources", "无");
    }
  };

  updateCampAttributes(allCamps[0] || null);

  campSwitcher.onchange = (e) => {
    const selectedCamp = allCamps.find((camp) => camp.originalKey === e.target.value);
    updateCampAttributes(selectedCamp);
  };

  // 实时通知悬浮编辑器更新数据
  if (window.floatingEditorInstance && window.floatingEditorInstance.isVisible) {
    window.floatingEditorInstance.refreshDataState();
  }
},
// 在 GameManager 内新增此函数（带极速性能拦截器）
async recalculateAttributesAndSave() {
  if (!this.currentMvuState || !this.currentMvuState.stat_data) return;
  const stat_data = this.currentMvuState.stat_data;

  // ==========================================
  // 🛡️ 性能拦截器：依赖指纹追踪 (Dependency Hash)
  // ==========================================
  // 只提取“能改变属性上限”的字段来生成指纹。
  // 这样玩家挨打（当前活力改变）时，绝不会触发重新计算和存盘！
  const dependencyKeys = [
    "当前序列", "百分比加成",
    "基础活力", "基础灵性", "基础理智", "基础人性", "基础敏捷", "基础运气",
    "武器列表", "衣物列表", "饰品列表", "封印物列表", "扮演法列表", "辅助能力列表",
    "非凡特性列表"
  ];
  const dependencyObj = {};
  dependencyKeys.forEach(key => {
    dependencyObj[key] = stat_data[key];
  });
  
  // 生成当前依赖指纹
  const currentDependencyHash = JSON.stringify(dependencyObj);

  // 比对指纹：如果装备、天赋、基础值都没变，直接终止计算，绝不触发存盘！
  if (this._lastCalcDependencyHash === currentDependencyHash) {
    return; 
  }
  // 记录新指纹
  this._lastCalcDependencyHash = currentDependencyHash;
  // ==========================================

  // 1. 呼叫全局引擎，计算当前最新上限
  const trueMaxAttrs = calculateRealMaxAttributes(stat_data);
  let needSave = false;

  // 2. 对比并修正内存中的 stat_data；最大值变化时按差额同步当前值（运气除外，允许负数）
  // 用"上一次写入的最大值字段(stat_data[活力]/...)"作为基线，不依赖额外字段，
  // 自然兼容：穿脱、变量修改器改 isEquipped、AI 改装备、读档/时间旅行（快照自带匹配的最大值）。
  GLOBAL_ATTR_CONFIG.forEach(attr => {
    const maxKey = attr.key;
    const currKey = attr.currentVar;

    const oldMax = Number(stat_data[maxKey]);
    const newMax = Number(trueMaxAttrs[maxKey]);
    const hasValidOldMax = !isNaN(oldMax);

    if (hasValidOldMax && oldMax !== newMax) {
      // 先按差额同步当前值（运气没有当前值，跳过）
      if (maxKey !== "运气" && currKey && stat_data[currKey] !== undefined) {
        const delta = newMax - oldMax;
        const cur = Number(stat_data[currKey] || 0);
        stat_data[currKey] = cur + delta;
      }
      // 再写入新最大值
      stat_data[maxKey] = newMax;
      needSave = true;
    } else if (!hasValidOldMax && stat_data[maxKey] !== newMax) {
      // 旧最大值缺失/损坏：只写入新最大值，不动当前值（避免误回血）
      stat_data[maxKey] = newMax;
      needSave = true;
    }

    // 削峰兜底（防 AI/外部把当前值写超上限的极端情况）
    if (currKey && stat_data[currKey] !== undefined) {
      const cur = Number(stat_data[currKey]);
      if (!isNaN(cur) && cur > newMax) {
        stat_data[currKey] = newMax;
        needSave = true;
      }
    }
  });

  // 3. 精准存入玩家当前所在的时空坐标！
  if (needSave) {
    const currentIndex = this.historyViewIndex !== undefined ? this.historyViewIndex : Math.max(0, this.chatHistoryCache.length - 1);
    const targetSnapshot = this.chatHistoryCache[currentIndex];

    if (targetSnapshot && targetSnapshot.data) {
      targetSnapshot.data.stat_data = JSON.parse(JSON.stringify(stat_data));
      try {
        // 此时存盘是非常安全的，因为它只在“装备/天赋”真正发生改变时才会触发
        // await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
        // console.log(`[闭环同步] 装备/状态变动，属性已重新计算并存入快照索引: ${currentIndex}`);
      } catch (e) {
        console.error("[闭环同步] 快照存盘失败:", e);
      }
    }
  }
},

//读取+渲染非凡特性列表
updateTalentAndLinggen(data) {
  const container = document.getElementById("talent-linggen-list");
  if (!container) return;

  const tianfuObj = this.SafeGetValue(
    data,
    ["非凡特性列表", "abilities"],
    {},
  );
  // 拦截器
  this._lastTalentHash = this._lastTalentHash || "";
  const talentHash = JSON.stringify(tianfuObj);
  if (this._lastTalentHash === talentHash) {
    return; // 天赋没变，绝不重新拼接 HTML！
  }
  this._lastTalentHash = talentHash;

  container.innerHTML = "";

  let html = "";
  // 【核心修正】使用 Object.entries() 同时获取键（名称）和值（详情）
  const tianfuEntries = Object.entries(tianfuObj).filter(
    ([name, details]) =>
      typeof details === "object" &&
      details !== null &&
      name !== "$meta",
  );

  if (tianfuEntries.length > 0) {
    // 修正排序函数，使其能处理 [键, 值] 数组
    const sortedTianfuEntries = this.sortByTier(
      tianfuEntries,
      ([name, details]) =>
        this.SafeGetValue(details, ["等阶", "tier"], "普通"),
    );

    sortedTianfuEntries.forEach(([name, tianfu]) => {
      // 直接解构出 name 和 tianfu 对象
      const tier = this.SafeGetValue(
        tianfu,
        ["等阶", "tier"],
        "普通",
      );
      const description = this.SafeGetValue(
        tianfu,
        ["描述", "description"],
        "无描述",
      );
      const tierClass = this.getTierColorClass(tier);

      let bonusHtml = "";
      // 修正排除列表，因为 name, tier, description 不再是 tianfu 对象的属性
      const excludeKeys = ["等阶", "tier", "描述", "description"];
      for (const [key, value] of Object.entries(tianfu)) {
        if (!excludeKeys.includes(key)) {
          let effectText = value;
          if (typeof value === "object" && value !== null) {
            effectText = Object.entries(value)
              .map(
                ([effKey, effVal]) =>
                  `${effKey}: ${effVal > 0 ? "+" : ""}${effVal}`,
              )
              .join(", ");
          }
          bonusHtml += `<p style="margin-top: 5px; border-top: 1px solid rgba(var(--rgb-info), 0.1); padding-top: 5px;"><strong>${key}:</strong> ${effectText}</p>`;
        }
      }

      html += `
  <details class="details-container">
  <summary>
  <span class="attribute-name">特性</span>
  <span class="attribute-value ${tierClass}">【${tier}】 ${name}</span>
  </summary>
  <div class="details-content">
  <p>${description}</p>
  ${bonusHtml}
  </div>
  </details>
  `;
    });
  } else {
    html += `
  <div class="attribute-item">
  <span class="attribute-name">途径</span>
  <span class="attribute-value">尚未选择</span>
  </div>
  `;
  }
  container.innerHTML = html;
},

//--------页面左下方物品UI显示----------
//左下方的装备/封印物悬浮窗
showEquipmentTooltip(element, event) {
  const tooltip = document.getElementById("equipment-tooltip");
  const itemDataString = element.dataset.itemDetails;
  if (!tooltip || !itemDataString) return;
  try {
    const item = JSON.parse(itemDataString);
    tooltip.innerHTML = this.renderTooltipContent(item);
    tooltip.style.display = "block";
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left = event.pageX + 15;
    let top = event.pageY + 15;
    if (left + tooltipRect.width > viewportWidth) {
      left = event.pageX - tooltipRect.width - 15;
    }
    if (top + tooltipRect.height > viewportHeight) {
      top = event.pageY - tooltipRect.height - 15;
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  } catch (e) {
    console.error("解析装备Tooltip数据失败:", e);
  }
},
hideEquipmentTooltip() {
  const tooltip = document.getElementById("equipment-tooltip");
  if (tooltip) tooltip.style.display = "none";
},
//渲染左下角悬浮窗
renderTooltipContent(item) {
  const tier = this.SafeGetValue(item, ["品阶", "序列"], "普通");
  const formattedTier =
    !isNaN(tier) && tier !== "普通" ? `序列${tier}` : tier;
  const tierClass = this.getTierClass(formattedTier);
  const level = this.SafeGetValue(item, "等级", "");
  const tierDisplay = level
    ? `${formattedTier} ${level}`
    : formattedTier;

  let rawName = this.SafeGetValue(item, "名称", "未知物品");
  const traitRaw = this.SafeGetValue(
    item,
    ["特质", "trait", "特性"],
    "",
  );

  // --- 优化：过滤“空”、“无”等特质 ---
  const invalidTraits = ["", "空", "无", "none", "null", "undefined"];
  const hasValidTrait =
    traitRaw && !invalidTraits.includes(String(traitRaw).trim());

  let displayName = rawName;
  if (hasValidTrait) {
    if (!displayName.includes(traitRaw)) {
      displayName = `<span class="item-trait-prefix ${tierClass}">${traitRaw}</span> · ${rawName}`;
    } else {
      displayName = displayName.replace(
        traitRaw,
        `<span class="item-trait-prefix ${tierClass}">${traitRaw}</span>`,
      );
    }
  }

  let tooltipHtml = `
      <div class="tooltip-title ${tierClass}">${displayName}</div>
      <p style="margin-bottom:8px; color:var(--color-info); font-size: var(--text-base);"><strong>等级:</strong> <span class="${tierClass}">${tierDisplay}</span></p>
      <p class="tooltip-desc" style="font-size: var(--text-sm); line-height:1.5; color:var(--text-muted);">${this.SafeGetValue(item, "描述", "无描述")}</p>
      `;

  tooltipHtml += this.renderItemDetailsForInventory(item);
  return tooltipHtml;
},

//----------下方------------

//=---更新：沉浸式输入框---=

initImmersiveInput() {
  this.quickInput = document.getElementById("quick-send-input");
  if (!this.quickInput) return;

  // 监听输入实时调整高度
  this.quickInput.addEventListener("input", (e) => {
    this.adjustInputHeight(e.target);
  });

  // 聚焦时：展开输入框
  this.quickInput.addEventListener("focus", (e) => {
    e.target.classList.add("immersive-mode");

    // 如果框里是空的，聚焦时先给个稍微舒适的高度（比如80px，大约4行字）
    if (e.target.value.trim() === "") {
      e.target.style.height = "80px";
    } else {
      this.adjustInputHeight(e.target);
    }
  });

  // 失去焦点时：收起
  this.quickInput.addEventListener("blur", (e) => {
    this.resetInputState();
  });
},
// 动态调整高度的函数
adjustInputHeight(element) {
  // 如果没有聚焦，不执行长高逻辑
  if (
    document.activeElement !== element &&
    !element.classList.contains("immersive-mode")
  )
    return;

  // 核心技巧：先将高度设回单行，才能获取到删减文字后的真实 scrollHeight
  element.style.height = "36px";
  let newHeight = element.scrollHeight;

  // 如果在沉浸模式下，保持一个最低高度体验更好
  if (element.classList.contains("immersive-mode")) {
    newHeight = Math.max(newHeight, 80); // 保持最小展开高度
  }

  // 赋值新高度（受 CSS 的 max-height 50vh 限制，不会无限长）
  element.style.height = newHeight + "px";
},
// 恢复默认状态
resetInputState() {
  if (!this.quickInput) return;
  this.quickInput.classList.remove("immersive-mode");
  this.quickInput.style.height = "36px"; // 缩回原样
  this.quickInput.scrollTop = 0; // 滚动条置顶
},
// 发送消息处理
handleQuickSend() {
  if (!this.quickInput) return;
  const text = this.quickInput.value.trim();

  if (text === "") return;

  // 执行发送...
  // console.log("发送:", text);

  // 发送后清空并收起
  this.quickInput.value = "";
  this.resetInputState();
},
//快速发送
async executeQuickSend() {
  const input = document.getElementById("quick-send-input");
  if (!input) return;
  const userMessage = input.value.trim();
  await this.handleAction(userMessage);
},
// 回车发送
async saveEnterToSendState() {
  const checkbox = document.getElementById("enter-to-send-checkbox");
  if (checkbox) {
    await AppStorage.saveData(
      "enter_to_send_enabled",
      checkbox.checked,
    );
  }
},
async loadEnterToSendState() {
  const savedState = await AppStorage.loadData(
    "enter_to_send_enabled",
    false,
  ); // 默认关闭
  const checkbox = document.getElementById("enter-to-send-checkbox");
  if (checkbox) {
    checkbox.checked = savedState;
  }
},

// --- 当前指令面板 ---
toggleQuickCommands() {
  const popup = document.getElementById("quick-command-popup");
  if (!popup) return;
  if (popup.style.display === "block") this.hideQuickCommands();
  else this.showQuickCommands();
},
showQuickCommands() {
  const popup = document.getElementById("quick-command-popup");
  if (!popup) return;
  if (this.pendingActions.length === 0) {
    popup.innerHTML =
      '<div class="quick-command-empty">暂无待执行的指令</div>';
  } else {
    let listHtml = '<ul class="quick-command-list">';
    this.pendingActions.forEach((cmd) => {
      let actionText = "";
      switch (cmd.action) {
        case "equip":
          actionText = `装备 [${cmd.itemName}] 到 [${cmd.category}] 槽位。`;
          break;
        case "unequip":
          actionText = `卸下 [${cmd.itemName}] 从 [${cmd.category}] 槽位。`;
          break;
        case "use":
          actionText = `使用 ${cmd.quantity} 个 [${cmd.itemName}]。`;
          break;
        case "discard":
          actionText = `丢弃 ${cmd.quantity ? cmd.quantity + " 个 " : ""}[${cmd.itemName}]。`;
          break;
      }
      listHtml += `<li class="quick-command-item">${actionText}</li>`;
    });
    listHtml += "</ul>";
    popup.innerHTML = listHtml;
  }
  popup.style.display = "block";
},
hideQuickCommands() {
  const popup = document.getElementById("quick-command-popup");
  if (popup) popup.style.display = "none";
},

// --- 当前选项Action面板 ---
_parseActions(actionText) {
  if (!actionText) return [];
  // 根据换行符分割，并清理每个选项的序号和前后空格
  return actionText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line)
    .map((line) => line.replace(/^\d+\.\s*/, "").trim()); // 移除 "1. ", "2. " 等前缀
},
updateActionOptionsButtonState() {
  const btn = document.getElementById("btn-action-options");
  if (btn) {
    // 如果有可用选项，则启用按钮，否则禁用
    btn.disabled = this.lastExtractedActions.length === 0;
  }
},
toggleActionOptions() {
  const popup = document.getElementById("action-options-popup");
  if (!popup) return;
  if (popup.style.display === "block") {
    this.hideActionOptions();
  } else {
    this.showActionOptions();
  }
},
showActionOptions() {
  const popup = document.getElementById("action-options-popup");
  if (!popup) return;

  if (this.lastExtractedActions.length === 0) {
    popup.innerHTML =
      '<div class="action-options-empty">当前没有可用的行动选项</div>';
  } else {
    let listHtml = '<ul class="action-options-list">';
    this.lastExtractedActions.forEach((actionText, index) => {
      // 为每个选项创建一个包含文本框和按钮的列表项
      listHtml += `
        <li class="action-options-item editable" data-option-index="${index}">
        <textarea class="option-textarea">${actionText}</textarea>
        <div class="option-actions">
        <button class="option-btn send-option-btn" title="发送此选项">✔️</button>
        <button class="option-btn delete-option-btn" title="删除此选项">✖️</button>
        </div>
        </li>
        `;
    });
    listHtml += "</ul>";
    popup.innerHTML = listHtml;
  }
  popup.style.display = "block";
},
hideActionOptions() {
  const popup = document.getElementById("action-options-popup");
  if (popup) popup.style.display = "none";
},

// 当前状态相关

_getHtmlForStatus(statusKey, statusValue) {
  let html = "";

  // 情况1：状态值本身就是一个详细的对象
  if (statusValue && typeof statusValue === "object") {
    const name = statusValue.名称 || statusValue.name || statusKey;
    html += `<div class="status-modal-name">${name}</div>`;
    html += '<div class="status-modal-description">';
    for (const [detailKey, detailValue] of Object.entries(
      statusValue,
    )) {
      // 不再重复显示名称
      if (["名称", "name", "$meta"].includes(detailKey)) continue;
      // 确保显示的值是可读的字符串
      const displayValue =
        typeof detailValue === "string" ||
        typeof detailValue === "number"
          ? detailValue
          : "详情未提供";
      html += `<div><strong>${detailKey}:</strong> ${displayValue}</div>`;
    }
    html += "</div>";
  }
  // 情况2：状态值是简单的字符串描述
  else if (typeof statusValue === "string") {
    html += `<div class="status-modal-name">${statusKey}</div>`;
    html += `<div class="status-modal-description">${statusValue}</div>`;
  }
  // 情况3：无效数据，提供备用显示
  else {
    html += `<div class="status-modal-name">${statusKey}</div>`;
    html += `<div class="status-modal-description">效果详情未提供。</div>`;
  }

  return `<li class="status-modal-item">${html}</li>`;
},
toggleStatusPopup() {
  const popup = document.getElementById("status-effects-popup");
  if (popup) {
    const isVisible = popup.style.display === "flex";
    popup.style.display = isVisible ? "none" : "flex";
  }
},
showStatusEffectsModal() {
  if (!this.currentMvuState || !this.currentMvuState.stat_data) {
    this.showTemporaryMessage("无法获取状态数据。");
    return;
  }
  this.openModal("status-effects-modal");
  const body = document.getElementById("status-effects-modal-body");
  const statusesObj = this.SafeGetValue(
    this.currentMvuState.stat_data,
    "当前状态",
    {},
  );
  const statusKeys = Object.keys(statusesObj).filter(
    (key) => key !== "$meta",
  );

  if (statusKeys.length === 0) {
    body.innerHTML =
      '<p class="modal-placeholder" style="text-align:center; color:var(--text-muted); font-size: var(--text-sm);">当前无特殊状态效果。</p>';
    return;
  }

  // 使用新的渲染引擎来生成HTML
  const listHtml = statusKeys
    .map((key) => {
      const value = statusesObj[key];
      return this._getHtmlForStatus(key, value);
    })
    .join("");

  body.innerHTML = /* HTML */ `<ul class="status-modal-list">
    ${listHtml}
  </ul>`;
},

//----------------上方------------------

// 改进版：支持多条消息堆叠显示的临时消息 (Toast 系统)
showTemporaryMessage(message, duration = 2500) {
  // 1. 查找或创建统一的【消息容器】
  let container = document.querySelector(".temp-message-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "temp-message-container";
    
    // 容器负责定位和排列，无视页面滚动，永远在屏幕中上部
    container.style.cssText = /* HTML */ `
      position: fixed !important; 
      top: 20px !important; 
      left: 50% !important; 
      transform: translateX(-50%) !important; 
      display: flex !important;
      flex-direction: column !important; /* 纵向排列 */
      align-items: center !important;
      gap: 12px !important; /* 多条消息之间的间距 */
      z-index: 2147483647 !important; 
      pointer-events: none !important;
    `;
    
    const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement;
    const targetContainer = fullscreenEl ? fullscreenEl : document.body;
    targetContainer.appendChild(container);
  }

  // 2. 创建当前的【单条消息】
  const msgElement = document.createElement("div");
  msgElement.className = "temp-message-item";
  msgElement.textContent = message;

  // 单条消息只需要管好自己的长相和动画
  msgElement.style.cssText = /* HTML */ `
    background: rgba(var(--rgb-border-dark), 0.95) !important; 
    padding: 10px 20px !important; 
    border-radius: 5px !important; 
    font-size: var(--text-base) !important;
    box-shadow: 0 4px 15px var(--overlay-dark) !important;
    text-align: center !important; 
    transition: all 0.3s ease-out !important; 
    opacity: 0; /* 初始透明 */
    transform: translateY(-15px); /* 初始稍微偏上一点，做个小动画 */
  `;

  // 把消息塞进容器
  container.appendChild(msgElement);

  // 触发丝滑的进场动画（需等待浏览器渲染下一帧）
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      msgElement.style.opacity = "1";
      msgElement.style.transform = "translateY(0)";
    });
  });

  // 3. 定时移除（先渐隐，再销毁）
  setTimeout(() => {
    msgElement.style.opacity = "0";
    msgElement.style.transform = "translateY(-15px)";
    
    // 等待 CSS 动画 (0.3s) 结束后，真正移除 DOM 节点
    setTimeout(() => {
      msgElement.remove();
      // 环保收尾：如果容器空了，把容器也干掉
      if (container.childNodes.length === 0) {
        container.remove();
      }
    }, 300);
  }, duration);
},

// 修改 showLoadingBar 的参数和文本获取逻辑
showLoadingBar(customMessage = null) {
  const bar = document.getElementById("loading-indicator-bar");
  const messages = GameDBManager.DB.waitingMessages;
  if (bar) {
    // 🌟 新增：如果传入了自定义文本，优先使用自定义文本
    let message = customMessage;
    if (!message) {
      message = messages && messages.length > 0 
        ? messages[Math.floor(Math.random() * messages.length)] 
        : "加载中...";
    }
    bar.textContent = message;

    // 新增：强制清除可能存在的内联 display:none 样式，确保动画可以播放
    bar.style.display = "";

    bar.classList.remove("fade-out");
    bar.classList.add("fade-in");
  }
},
hideLoadingBar(immediate = false) {
  const bar = document.getElementById("loading-indicator-bar");
  if (bar) {
    if (immediate) {
      bar.style.display = "none";
      bar.classList.remove("fade-in", "fade-out");
      return;
    }
    bar.classList.remove("fade-in");
    bar.classList.add("fade-out");
    // 动画结束后，CSS会自动处理隐藏，但为了保险起见，可以加一个定时器
    setTimeout(() => {
      if (bar.classList.contains("fade-out")) {
        // 再次检查，防止用户快速启停
        bar.style.display = "none";
      }
    }, 400);
  }
},
// --- 新增：确保遮罩节点永远存在于最外层 ---
_ensureOverlayExists() {
  let overlay = document.getElementById("loading-overlay");
  
  // 如果找不到，或者它被别的逻辑意外删除了，我们就当场复活它
  if (!overlay) {
    console.log("🛠️ [修复] 发现 loading-overlay 不存在，正在将其挂载到 body 层...");
    
    overlay = document.createElement("div");
    overlay.id = "loading-overlay";
    // 注入你设计的星盘 HTML
    overlay.innerHTML = `
      <div class="astrolabe-container">
       <div class="astrolabe-ring ring-1"></div>
       <div class="astrolabe-ring ring-2"></div>
       <div class="astrolabe-ring ring-3"></div>
       <div class="astrolabe-ring ring-4"></div>
      </div>
      <div id="loading-text-overlay" class="loading-text"></div>
    `;
    
    // 强制挂载到 body，避开聊天界面的刷新销毁区
    document.body.appendChild(overlay); 
  }
  
  return overlay;
},
//等待语录显示
showWaitingMessage() {
  const isFull = this.isFullScreenLoadingEnabled;
  
  if (this.overlayHideTimer) {
    clearTimeout(this.overlayHideTimer);
    this.overlayHideTimer = null;
  }

  if (isFull) {
    // ⬇️ [核心修复] 使用新方法，确保它绝对存在，即使刚才被意外删了也能马上建出来
    const overlay = this._ensureOverlayExists(); 
    
    overlay.style.display = "flex";
    void overlay.offsetWidth; // 触发重绘
    
    setTimeout(() => {
      overlay.style.opacity = "1";
    }, 10);
  } else {
    this.showLoadingBar();
  }

  const el = document.getElementById(
    isFull ? "loading-text-overlay" : "loading-indicator-bar",
  );
  if (!el) return;

  const messages = GameDBManager.DB.waitingMessages?.length > 0 
    ? GameDBManager.DB.waitingMessages 
    : ["加载中..."];
  
  const update = () => {
    el.textContent = messages[Math.floor(Math.random() * messages.length)];
  };
  update();

  if (el._timer) clearInterval(el._timer);
  el._timer = setInterval(() => {
    // 同样，这里也用 _ensureOverlayExists 保证查询安全
    const overlay = document.getElementById("loading-overlay"); 
    const isHidden = isFull
      ? overlay && overlay.style.display === "none"
      : el.style.display === "none";

    if (!document.body.contains(el) || isHidden) {
      clearInterval(el._timer);
      el._timer = null;
      return;
    }
    update();
  }, 15000);
},
hideWaitingMessage(immediate = false) {
  if (this.messageTimer) {
    clearInterval(this.messageTimer);
    this.messageTimer = null;
  }
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    if (immediate) {
      overlay.style.opacity = "0";
      overlay.style.display = "none";
    } else {
      overlay.style.opacity = "0";
      // 💡 保存定时器引用
      this.overlayHideTimer = setTimeout(() => {
        overlay.style.display = "none";
        this.overlayHideTimer = null; // 执行完清理引用
        console.log("[hideWaitingMessage] 淡出隐藏全屏遮罩完成");
      }, 500);
    }
  } else {
    console.log("[hideWaitingMessage] 未找到loading-overlay元素");
  }
  this.hideLoadingBar(immediate);
},

// --- 显示/隐藏思维链浮层的函数 ---
showThinkingOverlay() {
  const overlay = document.getElementById("thinking-overlay");
  const contentEl = document.getElementById("thinking-content");
  if (!overlay || !contentEl) return;

  const hasNarrative = !!this.lastExtractedThinkingNarrative;
  const hasVariable = !!this.lastExtractedThinkingVariable;
  const hasLegacy = !!this.lastExtractedThinking;
  if (!hasNarrative && !hasVariable && !hasLegacy) return;

  // 决定默认 Tab：沿用上次选择，再按可用性兜底
  let activeTab = this.thinkingActiveTab || 'narrative';
  if (activeTab === 'narrative' && !hasNarrative && hasVariable) activeTab = 'variable';
  if (activeTab === 'variable' && !hasVariable && hasNarrative) activeTab = 'narrative';

  this._renderThinkingTab(activeTab);
  overlay.style.display = "flex";
},
hideThinkingOverlay() {
  const overlay = document.getElementById("thinking-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
},
_renderThinkingTab(source) {
  this.thinkingActiveTab = source;
  const contentEl = document.getElementById("thinking-content");
  const narrativeBtn = document.getElementById("thinking-tab-narrative");
  const variableBtn = document.getElementById("thinking-tab-variable");
  if (!contentEl) return;

  let text = "";
  if (source === 'narrative') {
    text = this.lastExtractedThinkingNarrative || "（本回合正文模型未输出思维链）";
  } else {
    text = this.lastExtractedThinkingVariable || this.lastExtractedThinking || "（本回合变量模型未输出思维链）";
  }
  contentEl.textContent = text;

  if (narrativeBtn) narrativeBtn.classList.toggle("active", source === 'narrative');
  if (variableBtn) variableBtn.classList.toggle("active", source === 'variable');
},

// -- 弹幕相关 ----
renderDanmaku() {
  const optimizer = window.PerformanceOptimizer?.danmakuOptimizer;

  // 🎨 全新主题池：大幅提高彩色弹幕的出现率
  const stylePool = [
    "",
    "",
    "", // 保留普通白色弹幕，用来做色彩的缓冲衬托
    "dm-theme-gold",
    "dm-theme-cyan",
    "dm-theme-pink",
    "dm-theme-emerald",
    "dm-theme-purple",
    "dm-theme-red",
    "dm-theme-silver",
    "dm-theme-copper",
    "dm-theme-coffee",
    "dm-theme-slate",
    "dm-theme-blue",
    "dm-theme-olive",
    "dm-theme-amber",
  ];

  if (!optimizer) {
    console.warn(
      "[renderDanmaku] DanmakuOptimizer未加载，使用降级方案",
    );
    const layer = document.getElementById("danmaku-layer");
    if (!layer) return;

    // 降级方案也同步支持随机颜色
    layer.innerHTML = this.lastExtractedDanmaku
      .map((dm) => {
        const randomStyle =
          stylePool[
            Math.floor(Math.random() * stylePool.length)
          ];
        return /* HTML */ `<div
          class="danmaku-pill ${randomStyle}"
        >
          <span class="dm-text"
            >${dm
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")}</span
          >
        </div>`;
      })
      .join("");
    return;
  }

  // 1. 清空现有弹幕
  optimizer.clearAll();

  // 2. 将弹幕批量送入优化器的“候车室”
  this.lastExtractedDanmaku.forEach((text) => {
    // 随机抽取一个色彩样式
    const randomStyle =
      stylePool[Math.floor(Math.random() * stylePool.length)];

    // 🔥 将 className 作为 options 传给优化器
    optimizer.addDanmaku(text, { className: randomStyle });
  });

  console.log(
    `[renderDanmaku] 已使用优化器渲染 ${this.lastExtractedDanmaku.length} 条弹幕`,
  );
},
showDmOverlay() {
  const optimizer = window.PerformanceOptimizer?.danmakuOptimizer;
  if (optimizer) {
    optimizer.enable();
    this.renderDanmaku();
  } else {
    // 降级方案
    const layer = document.getElementById("danmaku-layer");
    if (!layer) return;
    this.renderDanmaku();
    layer.style.display = "block";
  }
  this.isDanmakuVisible = true;
},
hideDmOverlay() {
  const optimizer = window.PerformanceOptimizer?.danmakuOptimizer;
  if (optimizer) {
    optimizer.disable();
  } else {
    // 降级方案
    const layer = document.getElementById("danmaku-layer");
    if (layer) layer.style.display = "none";
  }
  this.isDanmakuVisible = false;
},
toggleDanmakuOverlay() {
  if (this.isDanmakuVisible) {
    this.hideDmOverlay();
  } else {
    this.showDmOverlay();
  }
},

//=======切换视图=========
//全屏
toggleFullScreen() {
  const rootContainer = document.querySelector(
    ".game-root-container",
  );
  if (!rootContainer) return;

  if (!document.fullscreenElement) {
    if (rootContainer.requestFullscreen) {
      rootContainer.requestFullscreen();
    } else if (rootContainer.webkitRequestFullscreen) {
      /* Safari */
      rootContainer.webkitRequestFullscreen();
    } else if (rootContainer.msRequestFullscreen) {
      /* IE11 */
      rootContainer.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
},
//切换手机、电脑模式
toggleViewMode() {
  this.isMobileView = !this.isMobileView;
  const container = document.querySelector(".game-root-container");
  const btn = document.getElementById("view-toggle-btn");
  if (container && btn) {
    if (this.isMobileView) {
      container.classList.add("mobile-view");
      btn.textContent = "💻";
      btn.title = "切换到桌面视图";
    } else {
      container.classList.remove("mobile-view");
      btn.textContent = "📱";
      btn.title = "切换到移动视图";
    }
  }
  this.saveViewMode();
},
async saveViewMode() {
  await AppStorage.saveData(
    "view_mode",
    this.isMobileView ? "mobile" : "desktop",
  );
},
async loadViewMode() {
  const savedMode = await AppStorage.loadData("view_mode");
  if (savedMode === "mobile") {
    this.isMobileView = true;
    const container = document.querySelector(
      ".game-root-container",
    );
    const btn = document.getElementById("view-toggle-btn");
    if (container && btn) {
      container.classList.add("mobile-view");
      btn.textContent = "💻";
      btn.title = "切换到桌面视图";
    }
  } else {
    this.isMobileView = false;
  }
}, //耦合
//手机模式“展开”功能
toggleMobilePanel(panelName, button) {
  const state = !this.panelCollapseState[panelName];
  this.panelCollapseState[panelName] = state;

  const panelMap = {
    char: document.querySelector(".character-panel"),
    interaction: document.querySelector(".interaction-panel"),
    bottom: document.getElementById("bottom-status-container"),
  };

  const panelElement = panelMap[panelName];
  if (!panelElement) return;

  if (state) {
    panelElement.classList.add("panel-collapsed");
    button.textContent = "展开";
  } else {
    panelElement.classList.remove("panel-collapsed");
    button.textContent = "收起";
  }
  this.savePanelState();
},
async savePanelState() {
  await AppStorage.saveData(
    "panel_collapse_state",
    this.panelCollapseState,
  );
},
async loadPanelState() {
  const savedState = await AppStorage.loadData(
    "panel_collapse_state",
    {
      char: false,
      interaction: false,
      bottom: false,
    },
  );
  this.panelCollapseState = savedState;

  Object.entries(savedState).forEach(([panelName, isCollapsed]) => {
    const buttonMap = {
      char: document.getElementById("toggle-char-panel"),
      interaction: document.getElementById(
        "toggle-interaction-panel",
      ),
      bottom: document.getElementById("toggle-bottom-panel"),
    };
    const panelMap = {
      char: document.querySelector(".character-panel"),
      interaction: document.querySelector(".interaction-panel"),
      bottom: document.getElementById("bottom-status-container"),
    };

    const button = buttonMap[panelName];
    const panel = panelMap[panelName];

    if (button && panel) {
      if (isCollapsed) {
        panel.classList.add("panel-collapsed");
        button.textContent = "展开";
      } else {
        panel.classList.remove("panel-collapsed");
        button.textContent = "收起";
      }
    }
  });
}, //耦合

//============================
//===========美化==============
//============================

//----序列/位阶的分类和颜色---

//序列/位阶的顺序解析
getTierOrder(tier) {
  const tierOrder = {
    普通: 1,
    非凡: 2,
    罕见: 3,
    史诗: 4,
    传说: 5,
    神话: 7,
    唯一: 10,
    旧日: 15,
    支柱: 20,

    序列9: 1,
    序列8: 2,
    序列7: 3,
    序列6: 4,
    序列5: 5,
    序列4: 6,
    序列3: 7,
    序列2: 8,
    序列1: 9,
    序列0: 10,
  };
  return tierOrder[tier] || 0;
},
//按序列分类
sortByTier(items, getTierFn) {
  if (!Array.isArray(items)) return items;
  return [...items].sort((a, b) => {
    const tierA = getTierFn(a);
    const tierB = getTierFn(b);
    const orderA = this.getTierOrder(tierA);
    const orderB = this.getTierOrder(tierB);
    if (orderA === orderB) return 0;
    return orderB - orderA;
  });
},
// 序列等级对应 CSS Class
getTierClass(tier) {
  if (!tier) return "tier-default";

  // 优先匹配“支柱”和“旧日”关键词
  if (tier.includes("支柱")) return "text-gradient-glow tier-pillar";
  if (tier.includes("旧日"))
    return "text-gradient-glow tier-outer-god";

  // 匹配“序列+数字”的部分
  const tierMatch = tier.match(/序列\s*\d+(?:\.\d+)?/);
  const pureTier = tierMatch
    ? tierMatch[0].replace(/\s+/g, "")
    : tier;

  // 直接映射到对应的 CSS Class
  const classMap = {
    序列0: "tier-seq-0",
    "序列0.1": "tier-seq-0",
    "序列0.3": "tier-angel-high",
    "序列0.4": "tier-angel-high",
    "序列0.5": "tier-angel-high",
    "序列0.8": "tier-angel-high",
    "序列0.9": "tier-seq-1",
    序列1: "tier-seq-1",
    序列2: "tier-seq-2",
    序列3: "tier-seq-3",
    序列4: "tier-seq-4",
    序列5: "tier-seq-5",
    序列6: "tier-seq-6",
    序列7: "tier-seq-7",
    序列8: "tier-seq-8",
    序列9: "tier-seq-9",
  };

  const targetClass = classMap[pureTier];
  return targetClass
    ? `text-gradient-glow ${targetClass}`
    : "tier-default";
},
// 位阶等级对应 CSS Class (稀有度)
getTierColorClass(tier) {
  const classMap = {
    普通: "rarity-normal",
    非凡: "text-gradient-glow rarity-uncommon",
    罕见: "text-gradient-glow rarity-rare",
    史诗: "text-gradient-glow rarity-epic",
    传说: "text-gradient-glow rarity-legendary anim-pulse" /* 传说带呼吸特效 */,
    神话: "text-gradient-glow rarity-mythic anim-pulse" /* 神话带呼吸特效 */,
    唯一: "text-gradient-glow rarity-unique anim-pulse" /* 唯一带呼吸特效 */,
  };
  return classMap[tier] || "rarity-normal";
},

//============回复正文美化============

//【Judgement】判定美化
formatMessageContent(text) {
  if (!text) return "";

  // 这里开始是检测判定部分，因为ai举例法对格式的规范很低，所以就算正则写的很宽松了，还是不能保证稳定
  // 支持两种格式：【判定请求】和 判定请求（无括号）
  const hasJudgment =
    /【判定请求\s*\|[^】]+】/.test(text) ||
    /判定请求\s*\|[^>\n]+>/.test(text);

  if (hasJudgment && window.judgmentBeautifierInstance) {
    //console.log('[formatMessageContent] 呜啊，找到判定内容力！，准备美化ing');

    // 分离判定内容和普通内容
    // 判定块 = 【判定请求】标记 + 紧随其后的以 > 开头的行
    // 修改：支持判定请求后直接跟 > 内容（无换行）的情况
    // 支持两种格式：【判定请求 | ...】 和 判定请求 | ...
    const judgmentPattern =
      /(?:【判定请求\s*\|[^】]+】|判定请求\s*\|[^>\n]+)(?:\s*>.*(?:\r?\n|$))*/g;
    const judgmentMatches = text.match(judgmentPattern) || [];

    //console.log('[formatMessageContent] 我看看，一共找到判定块数量:', judgmentMatches.length);
    judgmentMatches.forEach((match, idx) => {
      //console.log(`[formatMessageContent] 判定块${idx + 1}:`, match.substring(0, 100) + '...');
    });

    let result = "";
    let lastIndex = 0;

    // 处理每个判定块
    judgmentMatches.forEach((judgmentText) => {
      const judgmentIndex = text.indexOf(judgmentText, lastIndex);

      // 处理判定前的普通文本
      if (judgmentIndex > lastIndex) {
        const normalText = text.substring(
          lastIndex,
          judgmentIndex,
        );
        result += this.formatNormalText(normalText);
      }

      // 美化判定内容
      const tempContainer = document.createElement("div");
      const judgmentBlock =
        window.judgmentBeautifierInstance.beautify(
          judgmentText,
          tempContainer,
        );

      if (judgmentBlock) {
        result += tempContainer.innerHTML;
        //console.log('[formatMessageContent] 判定美化成功力，好耶！');
      } else {
        // 美化失败，使用普通格式化
        result += this.formatNormalText(judgmentText);
        //console.log('[formatMessageContent] 判定美化失败力，sad~');
      }

      lastIndex = judgmentIndex + judgmentText.length;
    });

    // 处理最后剩余的普通文本
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      result += this.formatNormalText(remainingText);
    }

    return result;
  }

  // 没有判定内容，使用普通格式化
  return this.formatNormalText(text);
},

// 辅助方法：格式化普通文本 (纯净高亮版)
formatNormalText(text) {
  if (!text) return "";
  
  const styleBlocks = [];
  let processedText = text.replace(
    /<style[^>]*>([\s\S]*?)<\/style>/gi,
    (match) => {
      const placeholder = `___STYLE_PLACEHOLDER_${styleBlocks.length}___`;
      styleBlocks.push(match);
      return placeholder;
    },
  );

  // 基础文本高亮替换
  processedText = processedText.replace(/(“[^”]+”|「[^」]+」)/g, 
    (match) => `<span class="text-language">${match}</span>`
  );
  processedText = processedText.replace(/\*([^*]+)\*/g, 
    (match, p1) => `<span class="text-psychology">${p1}</span>`
  );
  processedText = processedText.replace(/【([^】]+)】/g, 
    (match, p1) => `<span class="text-scenery">${p1}</span>`
  );

  processedText = processedText.replace(/\\n/g, "<br />");

  styleBlocks.forEach((style, index) => {
    processedText = processedText.replace(`___STYLE_PLACEHOLDER_${index}___`, style);
  });

  return processedText;
},



