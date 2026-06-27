// 文件: SequenceAbilities.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L38442-38848: // ========序列能力列表开始========= ---

// ========序列能力列表开始=========
//序列能力主入口
showAbilities() {
  this.openModal("abilities-modal");
  const body = document.querySelector("#abilities-modal .modal-body");
  if (!body) return;

  const currentSequenceName = this.SafeGetValue(
    this.currentMvuState?.stat_data,
    "当前序列",
    null,
  );

  // 优先从浏览器底层读取锁定状态，无视ST刷新机制
  const localLock = localStorage.getItem("ST_LoM_AbilityLock");
  const isAbilityLocked =
    localLock !== null
      ? localLock === "true"
      : this.SafeGetValue(
          this.currentMvuState?.stat_data,
          "序列能力锁定",
          false,
        );

  let addAbilityFormHtml = "";
  // 如果玩家有序列（不是普通人），则显示设置、刷新与添加表单
  if (
    currentSequenceName &&
    !currentSequenceName.includes("普通人")
  ) {
    // 修改后，删除了所有内联 style，全面使用刚定义的类
    addAbilityFormHtml = `
<div class="panel-section" style="margin-bottom: 20px;">
  <div class="section-title">列表设置与调试</div>
  <div class="ability-debug-panel">
    <label class="ability-lock-label">
      <input type="checkbox" id="ability-lock-toggle" class="ability-lock-checkbox" ${isAbilityLocked ? "checked" : ""}>
      <span>开启能力锁定（开启后，仅自动获取当前序列能力，不再获取低序列能力）</span>
    </label>
    <div class="ability-flex-gap">
      <button id="btn-force-refresh-abilities" class="interaction-btn btn-force-refresh">
        🔄 从世界书同步能力
      </button>
    </div>
  </div>

  <div class="section-title">手动添加能力 (${currentSequenceName})</div>
  <div class="ability-manual-panel">
    <input id="manual-ability-name" type="text" class="modal-input" placeholder="输入能力名称...">
    <textarea id="manual-ability-desc" class="modal-input ability-manual-textarea" placeholder="输入能力描述..."></textarea>
    <div class="ability-flex-gap">
      <select id="manual-ability-type" class="modal-input ability-manual-select">
        <option value="非凡能力">非凡能力</option>
        <option value="被动特性">被动特性</option>
        <option value="神之权柄">神之权柄</option>
        <option value="旧日象征">旧日象征</option>
      </select>
      <button id="btn-manual-add-ability" class="interaction-btn primary-btn">确认添加</button>
    </div>
  </div>
</div>
`;
  }

  // 【修改】：直接读取字典，无需再用 reduce 强行分组
  const allAbilitiesRecord = this.currentMvuState?.stat_data?.["序列能力列表"] || {};
  
  if (Object.keys(allAbilitiesRecord).length === 0 && !addAbilityFormHtml) {
    body.innerHTML = '<p class="modal-placeholder">尚未获得任何序列能力。</p>';
    return;
  }

  // 排序：按字典的 Key（如 "序列9-猎人"）解析出等级进行排序
  const sortedGroups = Object.keys(allAbilitiesRecord).sort((a, b) => {
    const rankA = parseSequenceRank(a);
    const rankB = parseSequenceRank(b);
    return rankB - rankA; 
  });

  let html = addAbilityFormHtml;
  for (const groupName of sortedGroups) {
    const abilitiesInGroup = allAbilitiesRecord[groupName];
    if (!abilitiesInGroup || abilitiesInGroup.length === 0) continue; // 跳过空组

    const groupRegex = new RegExp("序列([0-9]+)");
    const tierMatch = groupName.match(groupRegex);
    const pureTier = tierMatch ? `序列${tierMatch[1]}` : groupName;
    const tierClass = this.getTierClass(pureTier);

    html += `
<details class="inventory-category" open>
<summary class="inventory-category-title"><span class="${tierClass}">${groupName}</span></summary>
<div class="inventory-item-list">
`;

    // 内部能力的渲染几乎不变，只需要把 ability.fromSequence 去掉即可
    abilitiesInGroup.forEach((ability) => {
      // 因为能力对象本身不再带有 fromSequence，直接使用外部的纯净层级即可
      const abilityNameStyle = this.getTierClass(pureTier);
      const escapedAbilityName = this.safeEscapeHtml(ability.名称);

      html += `
  <div class="inventory-item ability-item-wrapper">
    <div class="item-name-desc ability-item-main">
      <p class="item-name ${abilityNameStyle}">${escapedAbilityName}</p>
      <p class="item-description">${ability.描述}</p>
    </div>
    <div class="item-meta ability-item-meta">
      <span class="item-tier-display">${ability.类型}</span>
      <button class="interaction-btn btn-delete-ability delete-ability-btn" data-ability-name="${escapedAbilityName}">删除</button>
    </div>
  </div>
  `;
    });

    html += `</div></details>`;
  }
  body.innerHTML = html;

  // 事件绑定
  document
    .getElementById("btn-manual-add-ability")
    ?.addEventListener("click", () =>
      this.handleManualAddAbility(),
    );
  document
    .getElementById("btn-force-refresh-abilities")
    ?.addEventListener("click", () =>
      this.handleForceRefreshAbilities(),
    );

  const lockToggle = document.getElementById("ability-lock-toggle");
  if (lockToggle) {
    lockToggle.addEventListener("change", (e) =>
      this.handleToggleAbilityLock(e),
    );
  }

  const deleteBtns = document.querySelectorAll(".delete-ability-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const abilityName =
        e.target.getAttribute("data-ability-name");
      if (abilityName) this.handleDeleteAbility(abilityName);
    });
    btn.addEventListener(
      "mouseenter",
      (e) => (e.target.style.opacity = "1"),
    );
    btn.addEventListener(
      "mouseleave",
      (e) => (e.target.style.opacity = "0.8"),
    );
  });
},
//新增：强制刷新和同步序列能力
async handleForceRefreshAbilities() {
  this.showTemporaryMessage("正在强制从世界书同步能力列表...");
  try {
    // 调用重写后的 updateAcquiredAbilities 获取最新状态
    const updatedState = await this.updateAcquiredAbilities(
      this.currentMvuState,
    );
    this.currentMvuState = updatedState;
    this.showTemporaryMessage("同步完成！已刷新能力列表。");
    this.showAbilities(); // 刷新UI

  } catch (error) {
    console.error("强制刷新能力失败:", error);
    this.showTemporaryMessage(`刷新失败: ${error.message}`);
  }
},

//新增：能力锁定（避免被同步）
async handleToggleAbilityLock(event) {
  const isLocked = event.target.checked;
  try {
    localStorage.setItem("ST_LoM_AbilityLock", isLocked);

    this.showTemporaryMessage(
      `能力自动向下兼容已${isLocked ? "关闭 (已锁定)" : "开启 (默认)"}`,
    );
  } catch (error) {
    this.showTemporaryMessage(
      `已切换为: ${isLocked ? "锁定" : "默认"} (依赖本地存储)`,
    );
  }
},

async handleDeleteAbility(abilityName) {
  const targetName = abilityName && typeof abilityName === "string" ? abilityName.trim() : String(abilityName || "").trim();
  const isDeletingEmpty = targetName === "";

  if (!isDeletingEmpty) {
    const isConfirmed = await this.showConfirmModal(`确定要从列表中删除能力 “${targetName}” 吗？`);
    if (!isConfirmed) return;
    this.showTemporaryMessage(`正在删除能力 “${targetName}”...`);
  } else {
    this.showTemporaryMessage(`正在清理空白异常项目...`);
  }

  try {
    const newState = _.cloneDeep(this.currentMvuState);
    const currentAbilitiesRecord = _.get(newState, "stat_data.序列能力列表", {});

    if (typeof currentAbilitiesRecord !== 'object' || Array.isArray(currentAbilitiesRecord)) {
      this.showTemporaryMessage("能力列表数据结构异常。");
      return;
    }

    let targetFound = false;
    let emptyRemovedCount = 0;

    // 【修改】：遍历字典的每一个 Key，过滤里面的数组
    Object.keys(currentAbilitiesRecord).forEach(seqKey => {
      const arr = currentAbilitiesRecord[seqKey];
      if (!Array.isArray(arr)) return;

      const initialLength = arr.length;
      const updatedArr = arr.filter((ab) => {
        if (!ab || typeof ab !== "object") { emptyRemovedCount++; return false; }
        
        const itemName = ab.名称 ? String(ab.名称).trim() : "";
        if (itemName === "") { emptyRemovedCount++; return false; }
        if (!isDeletingEmpty && itemName === targetName) { targetFound = true; return false; }
        return true;
      });

      // 如果发生了变动，更新或直接清理空 Key
      if (updatedArr.length !== initialLength) {
        if (updatedArr.length === 0) {
          delete currentAbilitiesRecord[seqKey]; // 极致干净：如果序列空了，直接把整个 Key 删掉
        } else {
          currentAbilitiesRecord[seqKey] = updatedArr;
        }
      }
    });

    if (!targetFound && emptyRemovedCount === 0) {
      if (!isDeletingEmpty) this.showTemporaryMessage("未找到该能力，或已被删除。");
      return;
    }

    _.set(newState, "stat_data.序列能力列表", currentAbilitiesRecord);
    const messages = await getChatMessages("0");

    if (messages && messages.length > 0) {
      const messageZero = messages[0];
      messageZero.data = newState;
      await TavernHelper.setChatMessages([messageZero], {
        refresh: "none",
      });

      this.currentMvuState = newState;

      // 5. 动态精确提示
      if (isDeletingEmpty) {
        this.showTemporaryMessage(
          `清理完成！已移除 ${emptyRemovedCount} 个空白异常数据。`,
        );
      } else if (targetFound) {
        this.showTemporaryMessage(
          `能力 “${targetName}” 已删除！`,
        );
      } else {
        this.showTemporaryMessage(
          `未找到 “${targetName}”，但为您顺手清理了 ${emptyRemovedCount} 个空白数据。`,
        );
      }

      this.showAbilities(); // 刷新 UI
    }
  } catch (error) {
    console.error("删除能力失败:", error);
    this.showTemporaryMessage(`删除失败: ${error.message}`);
  }
},
//手动添加能力
async handleManualAddAbility() {
  const nameInput = document.getElementById("manual-ability-name");
  const descInput = document.getElementById("manual-ability-desc");
  const typeSelect = document.getElementById("manual-ability-type");
  if (!nameInput || !descInput || !typeSelect) return;

  const name = nameInput.value.trim();
  const desc = descInput.value.trim();
  const type = typeSelect.value;

  if (!name) {
    this.showTemporaryMessage("能力名称不能为空。");
    return;
  }

  try {
    const newState = _.cloneDeep(this.currentMvuState);
    const currentAbilitiesRecord = _.get(newState, "stat_data.序列能力列表", {});

    // 【修改】：全局查重，遍历所有的分组看有没有重名的
    let isDuplicate = false;
    Object.values(currentAbilitiesRecord).forEach(arr => {
      if (Array.isArray(arr) && arr.some((ab) => ab.名称 === name)) {
        isDuplicate = true;
      }
    });

    if (isDuplicate) {
      this.showTemporaryMessage("已存在同名能力。");
      return;
    }

    const fromSequence = this.SafeGetValue(newState.stat_data, "当前序列", "手动添加");
    
    // 【修改】：创建全中文数据对象
    const newAbility = {
      名称: name,
      描述: desc || "无详细描述。",
      类型: type,
    };

    // 【修改】：按 Key 放入字典
    if (!currentAbilitiesRecord[fromSequence]) {
      currentAbilitiesRecord[fromSequence] = [];
    }
    currentAbilitiesRecord[fromSequence].push(newAbility);

    _.set(newState, "stat_data.序列能力列表", currentAbilitiesRecord);

    const messages = await getChatMessages("0");
    if (messages && messages.length > 0) {
      const messageZero = messages[0];
      messageZero.data = newState;
      await TavernHelper.setChatMessages([messageZero], {
        refresh: "none",
      });
      this.currentMvuState = newState;
      this.showTemporaryMessage(`能力 “${name}” 添加成功！`);
      this.showAbilities();
    }
  } catch (error) {
    this.showTemporaryMessage(`添加失败: ${error.message}`);
  }
},
// 修改：自动同步序列能力（含序列之上）
async updateAcquiredAbilities(inputState) {
  if (!inputState?.stat_data) return inputState;
  const targetState = _.cloneDeep(inputState);
  let currentSequenceRaw = this.SafeGetValue(targetState.stat_data, "当前序列", "");
  const isAbilityLocked = localStorage.getItem("ST_LoM_AbilityLock") === "true";

  if (!currentSequenceRaw || currentSequenceRaw.includes("普通人")) return targetState;

  try {
    const requiredRecord = fetchAvailableAbilities(currentSequenceRaw, isAbilityLocked);
    if (Object.keys(requiredRecord).length === 0) return targetState;

    // 获取当前状态，严格保证是 Object
    let currentRecord = targetState.stat_data["序列能力列表"];
    if (typeof currentRecord !== 'object' || currentRecord === null || Array.isArray(currentRecord)) {
      currentRecord = this.currentMvuState?.stat_data?.["序列能力列表"] || {};
    }
    if (Array.isArray(currentRecord)) currentRecord = {}; // 极致兜底

    let hasNew = false;
    const unlockedNames = [];

    // 字典对比合并逻辑
    Object.entries(requiredRecord).forEach(([seqName, requiredAbs]) => {
      if (!currentRecord[seqName]) {
        currentRecord[seqName] = [];
      }
      
      // 【修改】：使用 中文 "名称" 判断去重
      const existingNames = new Set(currentRecord[seqName].map(a => (a.名称 || "").trim()));

      requiredAbs.forEach(ab => {
        if (!existingNames.has(ab.名称.trim())) {
          currentRecord[seqName].push(ab);
          unlockedNames.push(ab.名称); // 记录中文名用于弹窗
          hasNew = true;
        }
      });
    });

    targetState.stat_data["序列能力列表"] = currentRecord;

    if (hasNew) {
      setTimeout(() => {
        this.showTemporaryMessage(`检测到途径更新：已获得新能力 [ ${unlockedNames.join("、")} ]`, 10000);
        const abilitiesModal = document.querySelector("#abilities-modal");
        if (abilitiesModal && abilitiesModal.style.display !== "none" && !abilitiesModal.classList.contains("hidden")) {
          this.showAbilities();
        }
      }, 800);
    }

    return targetState;
  } catch (error) {
    console.error("[源堡-能力] 同步失败:", error);
    return targetState;
  }
},



// =========序列能力列表结束============



