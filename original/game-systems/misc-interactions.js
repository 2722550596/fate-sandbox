// 文件: misc-interactions.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L31093-32599: // ========================================== ---

// ==========================================
// 人物关系列表渲染 (主客观双轨隔离 + 上帝视角蒙版)
// ==========================================
renderRelationships(relationshipsObj) {
  if (typeof relationshipsObj !== "object" || relationshipsObj === null) {
    return '<p class="modal-placeholder">暂无重要人际关系。</p>';
  }

  // 获取上帝视角的真实数据池 (兜底保护)
  const npcDataPool = this.currentMvuState?.npc_data || {};

  const allGachaChars = [
    ...GameDBManager.DB.gachaCharacterPool.ssr,
    ...GameDBManager.DB.gachaCharacterPool.sr,
    ...GameDBManager.DB.gachaCharacterPool.r,
  ];

  const validRelationships = Object.entries(relationshipsObj).filter(
    ([name, details]) => name !== "$meta" && typeof details === "object" && details !== null
  );

  if (validRelationships.length === 0) {
    return '<p class="modal-placeholder">暂无重要人际关系。</p>';
  }

  validRelationships.sort(([nameA, detailsA], [nameB, detailsB]) => {
    // 🌟 强力兜底：优先取 npc_data(客观)，如果没有，退而求其次取 stat_data(主观)，最后默认 false
    const isImpA = npcDataPool[nameA]?.isImportant || detailsA?.isImportant || false;
    const isImpB = npcDataPool[nameB]?.isImportant || detailsB?.isImportant || false;
    
    return (isImpB ? 1 : 0) - (isImpA ? 1 : 0);
  });

  let html = `<div id="relationship-cards-container">`;

  const parseTimeKeyForSort = (key) => {
    const match = key.match(/第五纪\s*(\d+)年\s*(\d+)月\s*(\d+)日\s*(?:星期. )?\s*(?:凌晨|清晨|上午|中午|下午|傍晚|晚间|晚上|深夜|)\s*(\d+):(\d+)/);
    if (!match) return 0;
    const [, year, month, day, hour, minute] = match.map(Number);
    return year * 1000000 + month * 70000 + day * 2000 + hour * 70 + minute;
  };

  const knownKeys = new Set([
    "名称", "身份", "性格", "外貌", "当前序列", "神性", "模板", "能力体系", 
    "当前状态", "initialized", "能力清单", "好感度", "关系", "持有物品", 
    "所处地点", "正在做的事", "事件历史", "长期目标", "近期打算", "关键记忆", 
    "活力", "当前活力", "灵性", "当前灵性", "理智", "当前理智", "人性", "当前人性", 
    "敏捷", "当前敏捷", "运气", "isImportant", "$meta", "image", "基础活力", "基础灵性", "基础敏捷", "基础理智", "基础运气", "基础人性",
    "对<User>的称呼"
  ]);

  validRelationships.forEach(([realNameKey, subjData]) => {
    try {
      // 🌟 核心拆分：主观认知 (subj) vs 客观真实 (obj)
      const subj = subjData; 
      // 如果 npc_data 里没这个人（异常情况），兜底使用主观数据
      const obj = npcDataPool[realNameKey] || subjData; 

      // 1. 表层展示信息 (主观)
      const displayName = subj.名称 && subj.名称 !== '未知' ? subj.名称 : realNameKey;
      const escapeDisplayName = this.safeEscapeHtml(displayName);
      const escapeKey = this.safeEscapeHtml(realNameKey);

      const relationship = this.SafeGetValue(subj, "关系", "未知");
      const favorability = parseInt(this.SafeGetValue(subj, "好感度", 0), 10);
      const callSign = this.SafeGetValue(subj, "对<User>的称呼", "");
      // 优先从上帝视角的 obj 取，兼容旧档从 subj 取
      const isImportant = obj.isImportant || subj.isImportant || false;

      // 头像渲染 (基于真名匹配)
      const gachaData = allGachaChars.find((c) => c.name === realNameKey);
      const imageUrl = gachaData ? gachaData.image : null;
      let portraitHtml = imageUrl ? `<div class="relationship-portrait" style="background-image: url('${imageUrl}');"></div>` : "";

      // 2. 收集表层主观网格信息 (只显示玩家已知的)
      const subjInfoItems = [];
      const safeSubjPush = (label, key) => {
        const val = this.SafeGetValue(subj, key, "");
        if (val && val !== "未知" && String(val).trim() !== "") {
          subjInfoItems.push({ label, value: val });
        }
      };
      if (callSign && callSign !== "<User>") subjInfoItems.push({ label: "对你的称呼", value: callSign });

      safeSubjPush("认知身份", "身份");
      safeSubjPush("认知性格", "性格");
      safeSubjPush("认知外貌", "外貌");
      safeSubjPush("推测序列", "当前序列");
      safeSubjPush("推测体系", "能力体系");
      safeSubjPush("推测所持物品", "持有物品");
      safeSubjPush("推测所处地点", "所处地点");

      let subjGridHtml = "";
      if (subjInfoItems.length > 0) {
        subjGridHtml = '<div class="relationship-info-grid" style="margin-bottom: 8px;">';
        subjInfoItems.forEach(item => {
          subjGridHtml += `<div class="relationship-info-item"><strong>${item.label}</strong><span>${item.value}</span></div>`;
        });
        subjGridHtml += "</div>";
      }

      // =========================================================
      // ⬇️ 以下全部为里层“上帝视角”数据渲染 (基于 obj)
      // =========================================================

            const tierOrSequence = this.SafeGetValue(obj, "当前序列", "普通人");
      const abilitiesArray = this.SafeGetValue(obj, "能力清单", []);
      
      // 将能力数组转换为显示文本（默认显示详情）
      let abilitiesText = "";
      if (Array.isArray(abilitiesArray) && abilitiesArray.length > 0) {
        abilitiesText = abilitiesArray.map(ab => 
          ab.描述 ? `${ab.名称}（${ab.描述}）` : ab.名称
        ).join("、");
      }
      
      let abilitiesHtml = "";
      if (abilitiesText || (tierOrSequence && !tierOrSequence.includes("普通人"))) {
        abilitiesHtml = `
        <div class="relationship-abilities" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-top: 8px;">
          <div style="flex: 1;">
            <strong>真实能力:</strong>
            <span class="abilities-list">${abilitiesText ? abilitiesText : "<span style='color: var(--text-muted);'>暂无能力</span>"}</span>
          </div>
          <button class="rel-action-btn round-btn color-btn" data-action="refresh-abilities" title="重抽能力" style="flex-shrink: 0;">🎲</button>
        </div>`;
      }

      // --- 事件历史 (客观) ---
      let currentState = "暂无记录";
      const eventHistory = this.SafeGetValue(obj, "事件历史", null);
      if (typeof eventHistory === "object" && eventHistory !== null && !Array.isArray(eventHistory)) {
        const eventKeys = Object.keys(eventHistory).filter((key) => key !== "$meta");
        if (eventKeys.length > 0) {
          const latestKey = eventKeys.sort((a, b) => parseTimeKeyForSort(b) - parseTimeKeyForSort(a))[0];
          currentState = eventHistory[latestKey];
        }
      } else if (typeof eventHistory === "string" && eventHistory.trim() !== "") {
        currentState = eventHistory;
      } else if (Array.isArray(eventHistory) && eventHistory.length > 0) {
        currentState = eventHistory[eventHistory.length - 1]; 
      }
      const formattedCurrentState = this.formatObject ? this.formatObject(currentState) : currentState;

      // --- 属性栏 (客观) ---
      const stats = {
        活力: { max: this.SafeGetValue(obj, "活力", null), current: this.SafeGetValue(obj, "当前活力", null) },
        灵性: { max: this.SafeGetValue(obj, "灵性", null), current: this.SafeGetValue(obj, "当前灵性", null) },
        理智: { max: this.SafeGetValue(obj, "理智", null), current: this.SafeGetValue(obj, "当前理智", null) },
        人性: { max: this.SafeGetValue(obj, "人性", null), current: this.SafeGetValue(obj, "当前人性", null) },
        敏捷: { max: this.SafeGetValue(obj, "敏捷", null), current: this.SafeGetValue(obj, "当前敏捷", null) },
        运气: { max: this.SafeGetValue(obj, "运气", null)},
      };

      let statsHtml = "";
      const validStats = Object.entries(stats).filter(([k, v]) => v.max !== null && v.max !== "N/A");
      if (validStats.length > 0) {
        statsHtml = '<div class="relationship-stats-enhanced" style="margin-top: 8px; opacity: 0.9;">';
        validStats.forEach(([statName, statValue]) => {
          // 判断逻辑：只有当 current 不为 null 且不是 undefined 时，才渲染成 "当前/最大"
          // 像运气这种只有 max 的，直接渲染单值
          const hasCurrent = statValue.current !== null && statValue.current !== undefined;

          let valueDisplay = "";
          if (hasCurrent) {
            // 渲染：当前 / 最大
            valueDisplay = `
              <span class="stat-current">${statValue.current}</span>
              <span style="color: var(--text-muted); margin: 0 2px;">/</span>
              <span class="stat-max">${statValue.max}</span>
            `;
          } else {
            // 渲染：单值（适用于运气）
            valueDisplay = `<span class="stat-max">${statValue.max}</span>`;
          }

          statsHtml += `
            <div class="stat-item-enhanced">
              <span class="stat-label">${statName}</span>
              <span class="stat-value">${valueDisplay}</span>
            </div>`;
        });
        statsHtml += "</div>";
      }

      // --- 关键记忆 (客观) ---
      let memoriesHtml = "";
      const rawMemories = this.SafeGetValue(obj, "关键记忆", null);
      if (rawMemories) {
        let memoryLines = [];
        if (typeof rawMemories === "object" && !Array.isArray(rawMemories)) {
          const memKeys = Object.keys(rawMemories).filter(k => k !== "$meta").sort((a, b) => parseTimeKeyForSort(b) - parseTimeKeyForSort(a));
          memKeys.forEach(k => {
            const v = rawMemories[k];
            const displayVal = typeof v === 'object' ? (this.formatObject ? this.formatObject(v) : JSON.stringify(v)) : v;
            memoryLines.push(`<li style="margin-bottom: 4px;"><span style="color: var(--text-muted); font-size: 0.9em;">[${k}]</span> ${displayVal}</li>`);
          });
        }
        if (memoryLines.length > 0) {
          memoriesHtml = `<div class="relationship-memories" style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.1); border-left: 3px solid var(--color-danger, #d9534f);"><strong>记忆档案:</strong><ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 0.9em;">${memoryLines.join("")}</ul></div>`;
        }
      }

      // --- 客观额外信息 (残余项 + 真实身份等) ---
      const objInfoItems = [];
      const safeObjPush = (label, key) => {
        const val = this.SafeGetValue(obj, key, "");
        if (val && val !== "未知" && String(val).trim() !== "") objInfoItems.push({ label, value: val });
      };
      
      safeObjPush("真实身份", "身份");
      safeObjPush("真实性格", "性格");
      safeObjPush("真实体系", "能力体系");
      safeObjPush("此刻外貌", "外貌");
      safeObjPush("此刻所持物品", "持有物品");
      safeObjPush("此刻所处地点", "所处地点");
      safeObjPush("此刻动作", "正在做的事");
      safeObjPush("近期打算", "近期打算");
      safeObjPush("长期目标", "长期目标");

      // Passthrough 兼容
      Object.keys(obj).forEach(key => {
        if (!knownKeys.has(key)) {
          const val = obj[key];
          if (typeof val === 'string' && val.trim() !== '') objInfoItems.push({ label: key, value: String(val) });
          else if (typeof val === 'number') objInfoItems.push({ label: key, value: String(val) });
          else if (typeof val === 'boolean') objInfoItems.push({ label: key, value: val ? '是' : '否' });
        }
      });

      let objGridHtml = "";
      if (objInfoItems.length > 0) {
        objGridHtml = '<div class="relationship-info-grid" style="margin-top: 8px; border-top: 1px dashed var(--text-muted); padding-top: 8px;">';
        objInfoItems.forEach(item => {
          objGridHtml += `<div class="relationship-info-item"><strong>${item.label}</strong><span style="color: var(--text-muted);">${item.value}</span></div>`;
        });
        objGridHtml += "</div>";
      }

      // --- 客观：当前状态 (解决 JSON 直接渲染问题) ---
      let objStatusHtml = "";
      const rawObjStatus = this.SafeGetValue(obj, "当前状态", null);

      if (rawObjStatus) {
        let statusElements = [];
        if (typeof rawObjStatus === "object" && rawObjStatus !== null && !Array.isArray(rawObjStatus)) {
          Object.entries(rawObjStatus).forEach(([k, v]) => {
            if (k !== "$meta") {
              const displayVal = typeof v === 'object' ? (this.formatObject ? this.formatObject(v) : JSON.stringify(v)) : v;
              statusElements.push(`<span class="status-badge" style="display:inline-block; background:rgba(var(--rgb-secondary), 0.1); padding: 2px 6px; border-radius: 4px; margin: 2px; font-size: 0.85em;"><strong>${k}:</strong> ${displayVal}</span>`);
            }
          });
        } else if (typeof rawObjStatus === "string" && rawObjStatus.trim() !== "") {
          statusElements.push(`<span>${rawObjStatus}</span>`);
        }

        if (statusElements.length > 0) {
          objStatusHtml = `
          <div class="relationship-current-status" style="margin-top: 8px;">
            <strong>此刻状态:</strong>
            <div style="display: flex; flex-wrap: wrap; margin-top: 4px;">
              ${statusElements.join("")}
            </div>
          </div>`;
        }
      }

      // =========================================================
      // HTML 最终组装
      // =========================================================
      const tierClass = this.getTierClass ? this.getTierClass(tierOrSequence) : "";
      const favorabilityPercent = Math.max(0, Math.min(100, (favorability / 200) * 100));
      const importantClass = isImportant ? "relationship-card-important" : "";
      const importantIcon = isImportant ? "⭐" : "☆";

      html += `
        <div class="relationship-card ${importantClass}" data-char-name="${escapeKey}">
          <div class="relationship-header">
            <div class="rel-info-group">
              <p class="relationship-name ${tierClass}">${escapeDisplayName}</p>
              <span class="relationship-toggle-icon">▼</span>
            </div>
            <div class="relationship-actions">
              <button class="rel-action-btn round-btn" data-action="toggle-important" title="标记重要">${importantIcon}</button>
              <button class="rel-action-btn round-btn info-btn" data-action="trade" title="交易(克隆)">🔄</button>
              <button class="rel-action-btn round-btn warn-btn" data-action="delete" title="删除">🗑️</button>
            </div>
          </div>
          
          <div class="relationship-body">
            ${portraitHtml}
            <div class="relationship-content-wrapper">
              
              ${subjGridHtml}
              <div class="relationship-meta-list">
                <div class="meta-item"><strong>好感关系:</strong> ${relationship}</div>
                <div class="favorability-section">
                  <div class="favorability-label">好感度: ${favorability}</div>
                  <div class="favorability-bar-container">
                    <div class="favorability-bar-fill" style="width: ${favorabilityPercent}%;"></div>
                  </div>
                </div>
              </div>

              <details class="objective-data-mask" style="margin-top: 12px; background: rgba(var(--rgb-bg-dark), 0.2); border: 1px solid rgba(var(--rgb-secondary), 0.3); border-radius: 6px; padding: 6px 10px;">
                <summary style="cursor: pointer; color: var(--theme-color); font-weight: bold; user-select: none; outline: none; display: flex; align-items: center; gap: 5px;">
                  👁️ 真实信息 <span style="font-size: 0.8em; color: var(--text-muted); font-weight: normal;">(上帝视角)</span>
                </summary>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(var(--rgb-white), 0.1);">
                  <div class="meta-item" style="margin-bottom: 4px;"><strong>真名:</strong> ${escapeKey}</div>
                  <div class="meta-item"><strong>真实序列:</strong> <span class="${tierClass}">${tierOrSequence}</span></div>
                  ${statsHtml}
                  ${objStatusHtml}
                  ${abilitiesHtml}
                  ${objGridHtml}
                  ${memoriesHtml}
                  ${formattedCurrentState && formattedCurrentState !== "暂无记录" ? `<div class="latest-update" style="margin-top: 8px; color: var(--color-warning);"><strong>最新动态:</strong> ${formattedCurrentState}</div>` : ""}
                </div>
              </details>

            </div>
          </div>
        </div>
      `;
    } catch (e) {
      console.error("渲染人物关系失败:", realNameKey, e);
    }
  });

  return html + "</div>";
},
// 切换人物关系项目的展开/折叠状态
toggleRelationshipItem(headerElement) {
  const cardElement = headerElement.closest(".relationship-card");
  if (cardElement) {
    cardElement.classList.toggle("expanded");
  }
},
//自动保存
async updateAndRefreshRelationshipState(newState) {
  this.currentMvuState = newState;
  // 将更新后的状态静默保存回SillyTavern，以确保数据持久化
  const messages = await getChatMessages("0");
  if (messages && messages.length > 0) {
    const messageZero = messages[0];
    messageZero.data = this.currentMvuState;
    await TavernHelper.setChatMessages([messageZero], {
      refresh: "none",
    });
    console.log("[源堡-人物关系] 已将更新后的人物关系状态保存。");
  }
  // 重新渲染人物关系模态框以立即显示变化
  this.showRelationships();
},

//========档案详情=======
//档案详情入口
async showCharacterDetails() {
  this.openModal("character-details-modal");
  const body = document.querySelector(
    "#character-details-modal .modal-body",
  );
  if (!body) return;
  body.innerHTML = '<p class="modal-placeholder">正在调取档案...</p>';

  try {
    const messages = await getChatMessages(getCurrentMessageId());
    const stat_data = messages?.[0]?.data?.stat_data;
    if (!stat_data) {
      body.innerHTML =
        '<p class="modal-placeholder">无法加载档案数据。</p>';
      return;
    }

    this.updateDisplayedAttributes();

    // 获取属性数据
    const huoli =
      document.getElementById("attr-huoli")?.innerText || "N/A";
    const lingxing =
      document.getElementById("attr-lingxing")?.innerText ||
      "N/A";
    const lizhi =
      document.getElementById("attr-lizhi")?.innerText || "N/A";
    const renxing =
      document.getElementById("attr-renxing")?.innerText || "N/A";
    const minjie =
      document.getElementById("attr-minjie")?.innerText || "N/A";
    const yunqi =
      document.getElementById("attr-yunqi")?.innerText || "N/A";
    const shengli = this.SafeGetValue(stat_data, "身体年龄", "N/A");
    const xinli = this.SafeGetValue(stat_data, "灵魂年龄", "N/A");
    const xiuxingjindu = this.SafeGetValue(
      stat_data,
      "消化进度",
      "0",
    );
    const xiuxingpingjing = this.SafeGetValue(
      stat_data,
      "失控进度",
      "0",
    );

    // 解析属性值用于进度条
    const parseAttr = (str) => {
      if (!str || str === "N/A") return { current: 0, max: 100 };
      const match = str.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        return {
          current: parseInt(match[1], 10),
          max: parseInt(match[2], 10),
        };
      }
      // 如果只有一个数字（如运气），则当前值=最大值
      const singleMatch = str.match(/(\d+)/);
      if (singleMatch) {
        const val = parseInt(singleMatch[1], 10);
        return { current: val, max: val };
      }
      return { current: 0, max: 100 };
    };

    const huoliData = parseAttr(huoli);
    const lingxingData = parseAttr(lingxing);
    const lizhiData = parseAttr(lizhi);
    const renxingData = parseAttr(renxing);
    const minjieData = parseAttr(minjie);
    const yunqiData = parseAttr(yunqi);

    // 获取阵营数据
    const campParent = stat_data.阵营 || {};
    const allCamps = Object.entries(campParent)
      .filter(([key]) => key !== "$meta")
      .map(([originalKey, data]) => ({
        ...data,
        阵营名: data.名称 || originalKey,
      }));
    const currentCamp = allCamps[0] || null;

    // 获取非凡特性数据
    const traitsObj = this.SafeGetValue(
      stat_data,
      "非凡特性列表",
      {},
    );
    const traits = Object.entries(traitsObj)
      .filter(([key]) => key !== "$meta")
      .map(([name, data]) => ({ name, ...data }));

    // 获取装备数据（包括封印物）
    const weapons = Object.entries(
      this.SafeGetValue(stat_data, "武器列表", {}),
    )
      .filter(([key]) => key !== "$meta")
      .map(([name, data]) => ({ name, type: "武器", ...data }));
    const clothes = Object.entries(
      this.SafeGetValue(stat_data, "衣物列表", {}),
    )
      .filter(([key]) => key !== "$meta")
      .map(([name, data]) => ({ name, type: "衣物", ...data }));
    const accessories = Object.entries(
      this.SafeGetValue(stat_data, "饰品列表", {}),
    )
      .filter(([key]) => key !== "$meta")
      .map(([name, data]) => ({ name, type: "饰品", ...data }));
    const sealedItems = Object.entries(
      this.SafeGetValue(stat_data, "封印物列表", {}),
    )
      .filter(([key]) => key !== "$meta")
      .map(([name, data]) => ({ name, type: "封印物", ...data }));
    const equipment = [
      ...weapons,
      ...clothes,
      ...accessories,
      ...sealedItems,
    ];

    // 生成雷达图数据（基于属性上限值的相对大小）
    const safePercent = (current, max) => {
      const c = parseInt(current, 10);
      const m = parseInt(max, 10);
      if (isNaN(c) || isNaN(m) || m === 0) {
        console.warn("[雷达图] 无效数据:", { current, max });
        return 0;
      }
      const percent = (c / m) * 100;
      return Math.min(100, Math.max(0, percent));
    };

    console.log("[雷达图调试] 原始属性文本:", {
      huoli,
      lingxing,
      lizhi,
      renxing,
      minjie,
      yunqi,
    });
    console.log("[雷达图调试] 解析后的属性数据:", {
      huoliData,
      lingxingData,
      lizhiData,
      renxingData,
      minjieData,
      yunqiData,
    });

    // 收集所有属性的上限值
    const maxValues = [
      huoliData.max,
      lingxingData.max,
      lizhiData.max,
      renxingData.max,
      minjieData.max,
      yunqiData.max,
    ];

    // 找出最大的上限值作为基准（100%）
    const highestMax = Math.max(...maxValues);
    console.log("[雷达图调试] 最高上限值:", highestMax);

    // 计算每个属性相对于最高值的百分比
    const radarData = [
      {
        label: "活力",
        value:
          highestMax > 0
            ? (huoliData.max / highestMax) * 100
            : 0,
      },
      {
        label: "灵性",
        value:
          highestMax > 0
            ? (lingxingData.max / highestMax) * 100
            : 0,
      },
      {
        label: "理智",
        value:
          highestMax > 0
            ? (lizhiData.max / highestMax) * 100
            : 0,
      },
      {
        label: "人性",
        value:
          highestMax > 0
            ? (renxingData.max / highestMax) * 100
            : 0,
      },
      {
        label: "敏捷",
        value:
          highestMax > 0
            ? (minjieData.max / highestMax) * 100
            : 0,
      },
      {
        label: "运气",
        value:
          highestMax > 0
            ? (yunqiData.max / highestMax) * 100
            : 0,
      },
    ];

    console.log(
      "[雷达图调试] 计算后的雷达数据（基于上限值相对大小）:",
      radarData,
    );

    body.innerHTML = `
      <div class="details-grid">
        <!-- 调查员档案卡片 -->
        <div class="details-card">
          <div class="details-card-title">调查员档案</div>
          <div class="attribute-row">
            <div class="attribute-label">
              <span class="attribute-icon">❤️</span>活力
            </div>
            <div class="attribute-value-wrapper">
              <span class="attribute-value"
                >${huoli}</span
              >
              <div class="attribute-progress">
                <div
                  class="attribute-progress-bar"
                  style="width: ${(huoliData.current /
                    huoliData.max) *
                  100}%"
                ></div>
              </div>
            </div>
          </div>
          <div class="attribute-row">
            <div class="attribute-label">
              <span class="attribute-icon">✨</span>灵性
            </div>
            <div class="attribute-value-wrapper">
              <span class="attribute-value"
                >${lingxing}</span
              >
              <div class="attribute-progress">
                <div
                  class="attribute-progress-bar"
                  style="width: ${(lingxingData.current /
                    lingxingData.max) *
                  100}%"
                ></div>
              </div>
            </div>
          </div>
          <div class="attribute-row">
            <div class="attribute-label">
              <span class="attribute-icon">🧠</span>理智
            </div>
            <div class="attribute-value-wrapper">
              <span class="attribute-value"
                >${lizhi}</span
              >
              <div class="attribute-progress">
                <div
                  class="attribute-progress-bar"
                  style="width: ${(lizhiData.current /
                    lizhiData.max) *
                  100}%"
                ></div>
              </div>
            </div>
          </div>
          <div class="attribute-row">
            <div class="attribute-label">
              <span class="attribute-icon">💫</span>人性
            </div>
            <div class="attribute-value-wrapper">
              <span class="attribute-value"
                >${renxing}</span
              >
              <div class="attribute-progress">
                <div
                  class="attribute-progress-bar"
                  style="width: ${(renxingData.current /
                    renxingData.max) *
                  100}%"
                ></div>
              </div>
            </div>
          </div>
          <div class="attribute-row">
            <div class="attribute-label">
              <span class="attribute-icon">⚡</span>敏捷
            </div>
            <div class="attribute-value-wrapper">
              <span class="attribute-value"
                >${minjie}</span
              >
              <div class="attribute-progress">
                <div
                  class="attribute-progress-bar"
                  style="width: ${(minjieData.current /
                    minjieData.max) *
                  100}%"
                ></div>
              </div>
            </div>
          </div>
          <div class="attribute-row">
            <div class="attribute-label">
              <span class="attribute-icon">🍀</span>运气
            </div>
            <div class="attribute-value-wrapper">
              <span class="attribute-value"
                >${yunqi}</span
              >
              <div class="attribute-progress">
                <div
                  class="attribute-progress-bar"
                  style="width: ${(yunqiData.current /
                    yunqiData.max) *
                  100}%"
                ></div>
              </div>
            </div>
          </div>
          <div class="attribute-row">
            <div class="attribute-label">
              <span class="attribute-icon">👤</span
              >身体年龄
            </div>
            <span class="attribute-value">${shengli}</span>
          </div>
          <div class="attribute-row">
            <div class="attribute-label">
              <span class="attribute-icon">🌟</span
              >灵魂年龄
            </div>
            <span class="attribute-value">${xinli}</span>
          </div>
          <div class="radar-chart-container">
            <canvas
              id="radar-chart"
              width="200"
              height="200"
            ></canvas>
          </div>
        </div>

        <!-- 阵营信息卡片 -->
        <div class="details-card">
          <div class="details-card-title">阵营信息</div>
          ${currentCamp
            ? `
            <div class="attribute-row attribute-row-col">
            <div class="attribute-label"><span class="attribute-icon">🏛️</span>阵营名称</div>
            <span class="attribute-value">${currentCamp.阵营名 || "未知"}</span>
            </div>
            <div class="attribute-row">
            <div class="attribute-label"><span class="attribute-icon">👔</span>职位</div>
            <span class="attribute-value">${currentCamp.职位 || "无"}</span>
            </div>
            <div class="attribute-row">
            <div class="attribute-label"><span class="attribute-icon">📊</span>影响力</div>
            <div class="attribute-value-wrapper">
            <span class="attribute-value">${currentCamp.影响力 || 0}/100</span>
            <div class="attribute-progress">
            <div class="attribute-progress-bar" style="width: ${currentCamp.影响力 || 0}%"></div>
            </div>
            </div>
            </div>
            <div class="attribute-row">
            <div class="attribute-label"><span class="attribute-icon">⚖️</span>阵营性质</div>
            <span class="attribute-value">${currentCamp.阵营性质 || "中立"}</span>
            </div>
            <div class="attribute-row">
            <div class="attribute-label"><span class="attribute-icon">⭐</span>声望</div>
            <span class="attribute-value">${currentCamp.声望 || 0}</span>
            </div>
            <div class="attribute-row">
            <div class="attribute-label"><span class="attribute-icon">👥</span>核心成员</div>
            <span class="attribute-value attribute-value-desc">${currentCamp.核心成员 || "无"}</span>
            </div>
            <div class="attribute-row">
            <div class="attribute-label"><span class="attribute-icon">📋</span>当前任务</div>
            <span class="attribute-value">${currentCamp.当前任务 || "无"}</span>
            </div>
            <div class="attribute-row attribute-row-col">
            <div class="attribute-label"><span class="attribute-icon">📝</span>任务描述</div>
            <span class="attribute-value">${currentCamp.任务描述 || "无"}</span>
            </div>
            <div class="attribute-row attribute-row-col">
            <div class="attribute-label"><span class="attribute-icon">🎁</span>任务奖励</div>
            <span class="attribute-value">${currentCamp.任务奖励 || "无"}</span>
            </div>
            <div class="attribute-row">
            <div class="attribute-label"><span class="attribute-icon">⚔️</span>敌对阵营</div>
            <span class="attribute-value">${currentCamp.敌对阵营 || "无"}</span>
            </div>
            ${(() => {
            const resources = currentCamp.阵营资源 || {};
            const resourceEntries = Object.entries(resources);
            if (resourceEntries.length > 0) {
            return `
            <div class="attribute-row attribute-row-col">
            <div class="attribute-label"><span class="attribute-icon">💰</span>阵营资源</div>
            <div class="w-full">
            ${resourceEntries
            .map(
            ([key, value]) => `
            <div class="camp-resource-item">
            <strong>${key}:</strong> ${value}
            </div>
            `,
            )
            .join("")}
            </div>
            </div>
            `;
            }
            return "";
            })()}
            `
            : '<p class="modal-placeholder">未加入任何阵营</p>'}
        </div>

        <!-- 非凡特性卡片 -->
        <div class="details-card">
          <div class="details-card-title">非凡特性</div>
          ${traits.length > 0
            ? traits
                .map(
                  (trait) => `
            <div class="attribute-row attribute-row-col">
            <div class="attribute-label"><span class="attribute-icon">💎</span>${trait.name}</div>
            <span class="attribute-value attribute-value-desc">${trait.描述 || trait.百分比加成 || ""}</span>
            </div>
            `,
                )
                .join("")
            : '<p class="modal-placeholder">暂无非凡特性</p>'}
        </div>

        <!-- 装备卡片 -->
        <div class="details-card">
          <div class="details-card-title">装备</div>
          ${equipment.length > 0
            ? equipment
                .map((item) => {
                  let icon = "💍";
                  if (item.type === "武器") icon = "⚔️";
                  else if (item.type === "衣物")
                    icon = "👔";
                  else if (item.type === "饰品")
                    icon = "💍";
                  else if (item.type === "封印物")
                    icon = "🔒";
                  return /* HTML */ `
                    <div class="attribute-row">
                      <div class="attribute-label">
                        <span
                          class="attribute-icon"
                          >${icon}</span
                        >${item.name}
                      </div>
                      <span
                        class="attribute-value attribute-value-sm"
                        >${item.type}</span
                      >
                    </div>
                  `;
                })
                .join("")
            : '<p class="modal-placeholder">暂无装备</p>'}
        </div>

        <!-- 扮演法详情卡片（全宽） -->
        <div class="details-card details-card-full">
          <div class="details-card-title">扮演法详情</div>
          <div class="attribute-row">
            <div class="attribute-label">
              <span class="attribute-icon">📈</span
              >消化进度
            </div>
            <div class="attribute-value-wrapper">
              <span class="attribute-value"
                >${xiuxingjindu}%</span
              >
              <div class="attribute-progress">
                <div
                  class="attribute-progress-bar"
                  style="width: ${xiuxingjindu}%"
                ></div>
              </div>
            </div>
          </div>
          <div class="attribute-row">
            <div class="attribute-label">
              <span class="attribute-icon">⚠️</span
              >失控进度
            </div>
            <span class="attribute-value"
              >${xiuxingpingjing}</span
            >
          </div>
        </div>
      </div>
    `;

    // 绘制雷达图
    setTimeout(
      () => this.drawRadarChart("radar-chart", radarData),
      100,
    );
  } catch (error) {
    console.error("加载档案详情时出错:", error);
    body.innerHTML =
      '<p class="modal-placeholder">加载数据时出错。</p>';
  }
},
//绘制雷达图的辅助函数
drawRadarChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn("Canvas element not found:", canvasId);
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.warn("Cannot get 2D context");
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 70;
  const levels = 5;

  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制背景网格
  ctx.strokeStyle = "rgba(139, 69, 19, 0.4)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= levels; i++) {
    ctx.beginPath();
    const r = (radius / levels) * i;
    for (let j = 0; j < data.length; j++) {
      const angle =
        ((Math.PI * 2) / data.length) * j - Math.PI / 2;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 绘制轴线和标签
  ctx.strokeStyle = "rgba(139, 69, 19, 0.6)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#d2b48c";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  data.forEach((item, i) => {
    const angle = ((Math.PI * 2) / data.length) * i - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    // 绘制轴线
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();

    // 绘制标签
    const labelX = centerX + (radius + 22) * Math.cos(angle); // 适度增加偏移
    const labelY = centerY + (radius + 22) * Math.sin(angle); // 适度增加偏移
    ctx.fillText(item.label, labelX, labelY);
  });

  // 绘制数据区域
  ctx.beginPath();
  ctx.fillStyle = "rgba(218, 165, 32, 0.25)";
  ctx.strokeStyle = "rgba(218, 165, 32, 0.9)";
  ctx.lineWidth = 2.5;

  let hasValidData = false;
  data.forEach((item, i) => {
    const angle = ((Math.PI * 2) / data.length) * i - Math.PI / 2;
    // 确保至少有5%的显示，避免完全看不见
    const value = Math.max(5, Math.min(100, item.value || 0));
    const r = (radius * value) / 100;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    if (value > 5) hasValidData = true;
  });

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 绘制数据点和等级
  ctx.fillStyle = "#daa520";
  data.forEach((item, i) => {
    const angle = ((Math.PI * 2) / data.length) * i - Math.PI / 2;
    const value = Math.max(5, Math.min(100, item.value || 0));
    const r = (radius * value) / 100;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // 将百分比转换为等级显示
    let grade = "E";
    const percent = Math.round(item.value);
    if (percent >= 100) grade = "S";
    else if (percent >= 90) grade = "A";
    else if (percent >= 70) grade = "B";
    else if (percent >= 40) grade = "C";
    else if (percent >= 20) grade = "D";
    else if (percent >= 1) grade = "E";

    // 在数据点旁边显示等级
    ctx.fillStyle = "#f5deb3";
    ctx.font = "bold 11px Arial";
    const textX = centerX + (r + 12) * Math.cos(angle);
    const textY = centerY + (r + 12) * Math.sin(angle);
    ctx.fillText(grade, textX, textY);
    ctx.fillStyle = "#daa520";
  });
},

//=============物品栏================
//物品栏主入口
async showInventory() {
  this.openModal("inventory-modal");
  const body = document.querySelector("#inventory-modal .modal-body");
  if (!body) return;

  body.innerHTML = '<p class="modal-placeholder">正在清点物品...</p>';

  try {
    let stat_data = this.currentMvuState?.stat_data;
    if (!stat_data || Object.keys(stat_data).length === 0) {
      console.log("[物品栏] 内存数据无效，尝试从快照读取");
      const latestSnapshot = this.chatHistoryCache.at(-1);
      if (latestSnapshot?.data?.stat_data) {
        stat_data = latestSnapshot.data.stat_data;
        this.currentMvuState = latestSnapshot.data;
      } else {
        body.innerHTML =
          '<p class="modal-placeholder">无法获取物品数据。</p>';
        return;
      }
    }
    body.innerHTML = this.renderInventory(stat_data || {});

    // 事件委托已在全局设置，无需重复添加
    // 移除了重复的事件监听器绑定
  } catch (error) {
    console.error("加载物品栏时出错:", error);
    body.innerHTML = /* HTML */ `<p class="modal-placeholder">
      加载物品栏时出错: ${error.message}
    </p>`;
  }
},
//物品栏渲染
renderInventory(stat_data) {
  if (!stat_data || Object.keys(stat_data).length === 0) {
    return '<p class="modal-placeholder">物品栏为空。</p>';
  }

  const categories = [
    { title: "扮演法", key: "扮演法列表", equipable: true },
    { title: "辅助能力", key: "辅助能力列表", equipable: true },
    { title: "武器", key: "武器列表", equipable: true },
    { title: "衣物", key: "衣物列表", equipable: true },
    { title: "饰品", key: "饰品列表", equipable: true },
    { title: "封印物", key: "封印物列表", equipable: true },
    { title: "消耗品", key: "消耗品列表", equipable: false },
    { title: "杂物", key: "杂物列表", equipable: false },
  ];

  let html = "";
  const safePendingActions = Array.isArray(this.pendingActions)
    ? this.pendingActions
    : [];

  categories.forEach((cat) => {
    let itemsObj = this.SafeGetValue(
      stat_data,
      [cat.key, cat.title],
      {},
    );
    if (cat.key === "杂物列表") {
      const otherItems = this.SafeGetValue(
        stat_data,
        ["其他列表", "其他", "杂物"],
        {},
      );
      Object.assign(itemsObj, otherItems);
    }

    const itemsList = Object.values(itemsObj).filter(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        (item.名称 || item.name),
    );

    html += `<details class="inventory-category" open>`;
    html += `<summary class="inventory-category-title">${cat.title}</summary>`;

    if (itemsList.length > 0) {
      html += '<div class="inventory-item-list">';
      const sortedItems = this.sortByTier(itemsList, (item) =>
        this.SafeGetValue(
          item,
          ["品阶", "tier", "序列", "sequence"],
          "普通",
        ),
      );

      sortedItems.forEach((item) => {
        try {
          let rawName = this.SafeGetValue(
            item,
            ["名称", "name"],
            "未知物品",
          );
          if (!item.id && cat.equipable) item.id = rawName;

          const itemJson = this.safeEscapeHtml(
            JSON.stringify(item),
          );
          const id = this.SafeGetValue(item, "id", null);

          const hasQuantity =
            item.hasOwnProperty("数量") ||
            item.hasOwnProperty("quantity");
          const quantity =
            parseFloat(
              this.SafeGetValue(
                item,
                ["数量", "quantity"],
                1,
              ),
            ) || 1;
          const rawDescription = this.SafeGetValue(
            item,
            ["描述", "description"],
            "无描述",
          );
          const description =
            this.formatObject(rawDescription);

          const pendingUses = safePendingActions
            .filter(
              (a) =>
                a.action === "use" &&
                a.itemName === rawName,
            )
            .reduce((t, a) => t + a.quantity, 0);
          const pendingDiscards = safePendingActions
            .filter(
              (a) =>
                a.action === "discard" &&
                a.itemName === rawName,
            )
            .reduce((t, a) => t + a.quantity, 0);
          const displayQuantity =
            quantity - pendingUses - pendingDiscards;

          if (
            (hasQuantity && displayQuantity <= 0.05) ||
            (!hasQuantity && pendingDiscards > 0)
          )
            return;

          // 品阶与样式
          const tier = this.SafeGetValue(
            item,
            ["等阶", "品阶", "tier", "序列", "sequence"],
            "无",
          );
          const formattedTier =
            tier !== "无" && !isNaN(tier)
              ? `序列${tier}`
              : tier;
          const tierClass = this.getTierClass(formattedTier);

          // --- 优化：过滤“空”、“无”等特质 ---
          const traitRaw = this.SafeGetValue(
            item,
            ["特质", "trait", "特性"],
            "",
          );
          const invalidTraits = [
            "",
            "空",
            "无",
            "none",
            "null",
            "undefined",
          ];
          const hasValidTrait =
            traitRaw &&
            !invalidTraits.includes(
              String(traitRaw).trim(),
            );

          let displayName = rawName;
          if (hasValidTrait) {
            if (!displayName.includes(traitRaw)) {
              displayName = `<span class="item-trait-prefix ${tierClass}">${traitRaw}</span> ·${rawName}`;
            } else {
              displayName = displayName.replace(
                traitRaw,
                `<span class="item-trait-prefix ${tierClass}">${traitRaw}</span>`,
              );
            }
          }

          // 标签显示
          const tagColorClass =
            this.getTierColorClass(formattedTier);

          // 2. 核心魔法：外层 span 负责画框框 (.tier-tag-box)，内层 strong 负责发光渐变 (.tierClass)
          const tierDisplay =
            tier !== "无"
              ? `<span class="item-tag tier-tag-box"><strong class="${tierClass}">${formattedTier}</strong></span>`
              : "";
          const pathwayRaw = this.SafeGetValue(
            item,
            ["途径", "pathway"],
            "",
          );
          const pathwayDisplay = pathwayRaw
            ? `<span class="item-tag pathway-tag">途径: ${pathwayRaw}</span>`
            : "";
          const typeRaw = this.SafeGetValue(
            item,
            ["类型", "type", "种类"],
            "",
          );
          const typeDisplay = typeRaw
            ? `<span class="item-tag type-tag">${typeRaw}</span>`
            : "";
          const tagsHtml = `<div class="item-tags-container">${tierDisplay}${pathwayDisplay}${typeDisplay}</div>`;

          const formattedQuantity = Number(
            Math.round(displayQuantity * 10) / 10,
          ).toFixed(1);
          const finalQuantity = formattedQuantity.endsWith(
            ".0",
          )
            ? parseInt(formattedQuantity, 10)
            : formattedQuantity;
          const unit = this.SafeGetValue(
            item,
            ["单位", "unit"],
            "",
          );
          const quantityDisplay = hasQuantity
            ? `<span class="header-quantity">x${finalQuantity} ${unit}</span>`
            : "";

          const isEquipped = item.isEquipped === true;
          let actionButtonsHtml = "";

          // 按钮逻辑 (保持不变)
          if (cat.equipable) {
            actionButtonsHtml += `<div class="item-actions">`;
            if (isEquipped) {
              const slotKey = Object.keys(
                this.equippedItems || {},
              ).find(
                (key) =>
                  this.equippedItems[key] &&
                  this.equippedItems[key].id === id,
              );
              actionButtonsHtml += `<button class="item-unequip-btn interaction-btn primary-btn" data-slot-id="equip-${slotKey}">卸下</button>`;
            } else {
              actionButtonsHtml += `<button class="item-equip-btn interaction-btn primary-btn">装备</button>`;
            }
            actionButtonsHtml += `<button class="item-discard-btn interaction-btn warn-btn">丢弃</button><button class="item-trade-btn interaction-btn color-btn">交易</button></div>`;
          } else {
            const useBtn =
              cat.title === "消耗品"
                ? `<button class="item-use-btn interaction-btn primary-btn">使用</button>`
                : "";
            actionButtonsHtml = `<div class="item-actions">${useBtn}<button class="item-discard-btn interaction-btn warn-btn">丢弃</button><button class="item-trade-btn interaction-btn color-btn">交易</button></div>`;
          }

          const itemDetailsHtml =
            this.renderItemDetailsForInventory(item) || "";

          html += `
              <div class="inventory-item" data-item-details='${itemJson}' data-category='${cat.title}'>
              <div class="inventory-item-header">
              <span class="item-name ${tierClass}">${displayName}</span>
              <div class="header-right-controls">
              ${quantityDisplay}
              <span class="inventory-toggle-icon">▼</span>
              </div>
              </div>
              <div class="inventory-item-details">
              <div class="item-name-desc">
              <div class="item-description">${description}</div>
              ${itemDetailsHtml ? `<div class="item-details-content">${itemDetailsHtml}</div>` : ""}
              </div>
              <div class="item-bottom-bar">
              ${tagsHtml}
              <div class="item-meta">${actionButtonsHtml}</div>
              </div>
              </div>
              </div>
              `;
        } catch (e) {
          console.error(
            "[物品渲染异常]",
            item.名称 || item.name,
            e,
          );
        }
      });
      html += "</div>";
    } else {
      html +=
        '<div class="inventory-item-list"><p class="empty-category-text">空无一物</p></div>';
    }
    html += `</details>`;
  });

  return html;
},

//在物品栏中渲染物品详细描述
renderItemDetailsForInventory(item) {
  let finalHtml = "";

  const isValidValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === "string" && val.trim() === "") return false;
    if (typeof val === "number" && isNaN(val)) return false;
    return true;
  };

  // ====== 核心修改：拦截并渲染所有未知的 passthrough 额外属性 ======
  // 排除名单：包含所有已经在UI中专属渲染过的字段，以及系统内部字段
  const excludeKeys = [
    "名称",
    "name",
    "描述",
    "description",
    "数量",
    "quantity",
    "单位",
    "unit",
    "id",
    "isEquipped",
    "品阶",
    "tier",
    "序列",
    "sequence",
    "等级",
    "特质",
    "trait",
    "特性",
    "途径",
    "pathway",
    "类型",
    "type",
    "种类",
    "attributes_bonus",
    "百分比加成",
    "percentage_bonus",
    "special_effects",
    "特殊效果",
    "效果",
    "副作用",
    "负面状态",
    "负面属性",
    "side_effects",
    "negative_effects",
    "伤害加成",
    "damage_bonus",
    "杀伤加成",
    "作用属性",
    "target_attribute",
    "目标属性",
    "活力",
    "灵性",
    "理智",
    "人性",
    "敏捷",
    "运气",
    "当前活力",
    "当前灵性",
    "当前理智",
    "当前人性",
    "当前敏捷",
  ];

  let extraAttrsHtml = "";
  Object.keys(item).forEach((key) => {
    if (!excludeKeys.includes(key)) {
      const val = item[key];
      // 只渲染基础数据类型(字符串/数字/布尔)，防止把深层对象渲染成 [object Object]
      if (isValidValue(val) && typeof val !== "object") {
        extraAttrsHtml += `<div class="extra-attr-line"><span class="extra-attr-key">${key}:</span> <span class="extra-attr-val">${val}</span></div>`;
      }
    }
  });

  // 拼接到面板最上方（紧贴在物品描述下方）
  if (extraAttrsHtml) {
    finalHtml += `<div class="extra-attrs-container">${extraAttrsHtml}</div>`;
  }

  // --- 第一区块：属性合集 (排在最前面的一排) ---
  const statsParts = [];

  // 1. 消耗品专属：作用属性与伤害加成
  const targetAttr = this.SafeGetValue(
    item,
    ["作用属性", "target_attribute", "目标属性"],
    "",
  );
  if (isValidValue(targetAttr)) {
    statsParts.push(
      `<span class="stat-highlight target-attr">🎯 ${targetAttr}</span>`,
    );
  }

  const dmgBonus = this.SafeGetValue(
    item,
    ["伤害加成", "damage_bonus", "杀伤加成"],
    "",
  );
  if (isValidValue(dmgBonus)) {
    statsParts.push(
      `<span class="stat-highlight dmg-bonus">⚔️ +${dmgBonus}</span>`,
    );
  }

  // 2. 六维核心属性
  const attributeKeys = [
    "活力",
    "灵性",
    "理智",
    "人性",
    "敏捷",
    "运气",
  ];
  attributeKeys.forEach((key) => {
    const bonusVal = parseFloat(item.attributes_bonus?.[key] || 0);
    const topVal = parseFloat(item[key] || 0);
    const totalVal = bonusVal + topVal;

    if (totalVal !== 0 && !isNaN(totalVal)) {
      const sign = totalVal > 0 ? "+" : "";
      statsParts.push(
        `<span class="stat-core"><strong>${key}</strong> ${sign}${totalVal}</span>`,
      );
    }
  });

  // 3. 百分比加成
  const percentBonuses = this.SafeGetValue(
    item,
    ["百分比加成", "percentage_bonus"],
    null,
  );
  if (typeof percentBonuses === "object" && percentBonuses !== null) {
    for (const [key, value] of Object.entries(percentBonuses)) {
      if (isValidValue(value)) {
        const sign = String(value).startsWith("-") ? "" : "+";
        statsParts.push(
          `<span class="stat-percent"><strong>${key}</strong> ${sign}${value}</span>`,
        );
      }
    }
  }

  if (statsParts.length > 0) {
    finalHtml += `<div class="stats-row">${statsParts.join("")}</div>`;
  }

  // --- 第二区块：特殊效力 (无标题) ---
  const effects = [];
  let rawEffects = this.SafeGetValue(
    item,
    ["special_effects", "特殊效果", "效果"],
    [],
  );
  if (typeof rawEffects === "string")
    rawEffects = rawEffects.split("\n");
  if (Array.isArray(rawEffects)) {
    rawEffects.forEach((e) => {
      if (isValidValue(e) && e !== "$__META_EXTENSIBLE__$") {
        effects.push(`<p class="effect-item"><i>${e}</i></p>`);
      }
    });
  }

  if (effects.length > 0) {
    finalHtml += `<div class="effects-container">${effects.join("")}</div>`;
  }

  // --- 第三区块：副作用 (暗红半透明面板，严格白色字体) ---
  const sideEffect = this.SafeGetValue(
    item,
    [
      "副作用",
      "负面状态",
      "负面属性",
      "side_effects",
      "negative_effects",
    ],
    "",
  );
  if (isValidValue(sideEffect)) {
    finalHtml += `
    <div class="side-effect-panel">
    <div class="side-effect-header">副作用</div>
    <div class="side-effect-content">${sideEffect}</div>
    </div>
    `;
  }

  return finalHtml;
},
// 切换物品栏项目的展开/折叠状态
toggleInventoryItem(headerElement) {
  const itemElement = headerElement.closest(".inventory-item");
  if (itemElement) {
    itemElement.classList.toggle("expanded");
  }
},


