// 文件: EventGeneration.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L34580-36666: // ========================================== ---

// ==========================================
// === 【大幅精简版：事件生成系统】 ===
// ==========================================
async triggerEventGeneration() {
  this.showTemporaryMessage("正在连接源堡，生成事件...");
  try {
    // 1. 读取模板 (通过 DB 管家同步获取)
    let templateText = GameDBManager.renderTemplate("event_template");
    if (!templateText || !templateText.trim()) {
      this.showTemporaryMessage("未找到事件生成模板(event_template)，请检查提示词模板池！");
      return;
    }

    // 2. 读取结构化的词库 JSON 字典
    const pools = GameDBManager.DB.eventWordbank;
    if (!pools || Object.keys(pools).length === 0) {
      this.showTemporaryMessage("未找到事件词库数据，请确保【配置】事件词库已在世界书中正确装载！");
      return;
    }

    // 3. 提取模板中的占位符顺序 (例如 ["词库1", "词库2", ...])
    const matches = [...templateText.matchAll(/\[(词库\d+)\]/g)];
    const slotNames = [...new Set(matches.map(m => m[1]))].sort((a, b) => {
      return parseInt(a.replace('词库', '')) - parseInt(b.replace('词库', ''));
    });

    let targetPoolName = slotNames.length > 0 ? slotNames[0] : null;
    const memoryTags = new Set(); // 状态机的记忆标签

    slotNames.forEach((slot, index) => {
      // 决定当前从哪个池子抽卡
      let poolToUse = (pools[targetPoolName] && pools[targetPoolName].length > 0) 
                      ? pools[targetPoolName] 
                      : (pools[slot] || []);

      if (poolToUse.length > 0) {
        // 4.1 对象级别条件过滤 (reqTags 和 forbidTags)
        let validOptions = poolToUse.filter(opt => {
          const req = opt.reqTags || [];
          const forbid = opt.forbidTags || [];
          for (let t of req) if (!memoryTags.has(t)) return false;
          for (let t of forbid) if (memoryTags.has(t)) return false;
          return true;
        });

        // 兜底：如果全部不符合，退回全池防报错
        if (validOptions.length === 0) validOptions = poolToUse;

        // 4.2 随机抽取 JSON 对象
        const chosenObj = validOptions[Math.floor(Math.random() * validOptions.length)];

        // 4.3 写入新标签
        if (chosenObj.addTags) {
          chosenObj.addTags.forEach(t => memoryTags.add(t));
        }

        // 替换模板中的占位符
        templateText = templateText.split(`[${slot}]`).join(chosenObj.text);

        // 4.4 状态机转移：如果有指定的 nextPool 就跳跃，否则顺序下一个
        if (chosenObj.nextPool) {
          targetPoolName = chosenObj.nextPool;
        } else {
          targetPoolName = slotNames[index + 1] || null;
        }
      }
    });

    this.pendingEventGeneration = true;
    this.handleAction(templateText);
    this.closeAllModals();
    
  } catch (error) {
    console.error("事件生成失败:", error);
    this.showTemporaryMessage("事件生成出错: " + error.message);
  }
},

async _handleEventCardGeneration(eventCardContent) {
  try {
    const entryName = "【存入】生成的事件";
    
    // 1. 先读取一下，看看该条目是否已经存在（为了判断是追加还是全新创建）
    const existingEntries = await WorldbookManager.fetchEntries(entryName, { exactMatch: true, scope: 'primary' });
    const targetEntry = existingEntries[0];
    
    // 2. 拼接最终内容
    const finalContent = (targetEntry && targetEntry.content) 
      ? targetEntry.content + "\n\n---\n\n" + eventCardContent 
      : eventCardContent;

    // 3. 统一调用原子化写入接口
    // 管家底层会自动识别现有名字，如果有了就深度 update，没有就自动执行 create
    await WorldbookManager.saveEntries([{
      comment: entryName, 
      keys: [entryName],
      content: finalContent,
      enabled: true
    }]);

    // 4. 根据之前的读取状态提示不同的信息
    const actionText = targetEntry ? "追加" : "创建并";
    this.showTemporaryMessage(`事件已成功${actionText}保存至世界书条目“${entryName}”！`, 3000);

  } catch (error) {
    console.error("保存事件卡片失败:", error);
    this.showTemporaryMessage(`错误：保存事件卡片失败！`, 4000);
  }
},



//=========星界之门系统===========
// --- Gacha系统 全套核心函数 ---

// --- 新增：旧版数据向下兼容与 ID 翻译映射 ---
_migrateGachaId(oldData) {
  if (!oldData) return null;

  const charDB = GameDBManager.DB.gachaCharacterDB || {};

  // 1. 如果传入的是纯字符串 (如 "id01" 或旧版的 "博德之门3_影心")
  if (typeof oldData === 'string') {
    // 如果已经是合法的新 ID，直接放行
    if (charDB[oldData]) return oldData;

    // 宽松反查：遍历新数据库，如果旧字符串包含新角色的名字，即视为匹配
    for (const [newId, char] of Object.entries(charDB)) {
      if (oldData.includes(char.name) || (char.名称 && oldData.includes(char.名称))) {
        return newId;
      }
    }
    return oldData; // 实在找不到，原样返回（渲染时会变成占位符，由玩家自行删除）
  }

  // 2. 如果传入的是旧版完整对象 (如 { id: "博德之门3_影心", name: "影心", ... })
  if (typeof oldData === 'object') {
    // 黄金法则：直接用对象里的名字去新数据库里碰瓷
    const oldName = oldData.name || oldData.名称;
    if (oldName) {
      for (const [newId, char] of Object.entries(charDB)) {
        if (char.name === oldName || char.名称 === oldName) {
          return newId;
        }
      }
    }
    // 备用方案：用对象里的旧 ID 去走字符串宽松反查
    if (oldData.id) {
      return this._migrateGachaId(oldData.id);
    }
  }

  return null;
},
// 主入口和状态管理
showGachaSystem() {
  this.openModal("gacha-modal");

  // --- 核心修复：为所有Gacha标签页绑定点击事件 ---
  const tabs = document.querySelectorAll("#gacha-modal .gacha-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      this.switchGachaTab(tabName);
    });
  });
  // --- 修复结束 ---

  this.switchGachaTab("summon"); // 默认显示召唤页
},

async loadGachaState() {
  // 新增：定义一个包含所有默认值的“模板”
  const defaultGachaState = {
    astralDust: 0,
    starglitter: 0,
    pitySSR: 0,
    pitySR: 0,
    ssrGuarantee: false,
    redeemedCodes: [], // 新增：用于存储已兑换过的一次性兑换码
    activeCompanions: [], // 新增：用于追踪在世界中的伙伴
  };

  const savedState = await AppStorage.loadData(
    "gacha_state",
    defaultGachaState,
  );
  const savedCollection = await AppStorage.loadData(
    "gacha_collection",
    {},
  );
  const savedHistory = await AppStorage.loadData("gacha_history", []);

  // 核心修复：使用Object.assign将加载的数据覆盖到默认模板上
  this.gachaState = Object.assign({}, defaultGachaState, savedState);
  this.gachaCollection = savedCollection;
  
  // ✨ 兼容洗点 1：清洗图鉴 (将旧版 "系列_名称" 键名替换为 "id01")
  const migratedCollection = {};
  for (const [oldKey, value] of Object.entries(this.gachaCollection)) {
    const newId = this._migrateGachaId(oldKey);
    if (newId) migratedCollection[newId] = value;
  }
  this.gachaCollection = migratedCollection;

  // ✨ 兼容洗点 2：清洗历史记录 (支持解构旧对象或旧字符串)
  this.gachaHistory = savedHistory.map(item => ({
    timestamp: item.timestamp,
    results: item.results.map(res => this._migrateGachaId(res)).filter(id => id)
  }));

  // 新增：确保旧数据也能兼容新系统
  if (!this.gachaState.redeemedCodes) this.gachaState.redeemedCodes = [];
  if (!this.gachaState.activeCompanions) this.gachaState.activeCompanions = [];

  // ✨ 洗点逻辑 3：清洗在场伙伴，将对象转为纯 ID 数组
  this.gachaState.activeCompanions = this.gachaState.activeCompanions
    .map(c => typeof c === 'object' ? c.id : c)
    .filter(id => id);

  // 立即保存一次，完成旧存档的无感洗点升级
  this.saveGachaState();
},

async saveGachaState() {
  try {
    await AppStorage.saveData("gacha_state", this.gachaState);
    await AppStorage.saveData(
      "gacha_collection",
      this.gachaCollection,
    );
    await AppStorage.saveData("gacha_history", this.gachaHistory);
  } catch (error) {
    console.error(
      "[Gacha Error] Failed to save Gacha state:",
      error,
    );
    this.showTemporaryMessage("错误：无法保存星界之门数据！");
  }
},
// 标签页切换逻辑
switchGachaTab(tabName) {
  document
    .querySelectorAll(".gacha-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelector(`.gacha-tab[data-tab='${tabName}']`)
    ?.classList.add("active");
  document
    .querySelectorAll(".gacha-tab-content")
    .forEach((c) => c.classList.remove("active"));
  const activeContent = document.getElementById(
    `gacha-tab-${tabName}`,
  );
  if (activeContent) {
    activeContent.classList.add("active");
    // 根据标签页渲染不同内容
    if (tabName === "summon") this.renderSummonTab();
    if (tabName === "decomposition") this.renderDecompositionTab();
    if (tabName === "gallery") this.renderGalleryTab();
    if (tabName === "shop") this.renderShopTab(); // 新增：调用兑换码界面的渲染函数
  }
},
// 召唤标签页（新增删除功能）
renderSummonTab() {
  const container = document.getElementById("gacha-tab-summon");
  if (!container) return;
 
  const companionIds = this.gachaState.activeCompanions || [];
  const companions = companionIds.map(id => {
    return GameDBManager.DB.gachaCharacterDB[id] || { 
      id: id, name: "迷失的星界幻影", rarity: "R" 
    };
  });

  let companionsHtml = "";
  if (companions.length > 0) {
    companionsHtml = companions
      .map((c, index) => {
        const rarityClass = `history-result-item rarity-${c.rarity.toUpperCase()}`;
        return /* HTML */ `
          <div
            style="display: inline-block; margin: 4px; vertical-align: middle;"
          >
            <span
              class="${rarityClass}"
              style="cursor:default;"
              >${c.name}</span
            >
            <button
              class="btn-remove-companion"
              data-companion-index="${index}"
              style="margin-left: 4px; padding: 2px 6px; font-size: var(--text-xs); background-color: var(--color-danger); color: white; border: none; border-radius: 3px; cursor: pointer; vertical-align: middle;"
            >
              删除
            </button>
          </div>
        `;
      })
      .join("");
  } else {
    companionsHtml =
      '<p style="font-style:italic; margin:0;">当前没有来自星界的伙伴。</p>';
  }
  const ssrCount = companions.filter(
    (c) => c.rarity === "SSR",
  ).length;

  // --- 核心修改：将 gacha-currency 移到 summon-container 外部，并为 summon-container 添加 flex-grow: 1 ---
  container.innerHTML = /* HTML */ `
    <div
      class="gacha-currency"
      style="text-align: center; margin-bottom: 15px; flex-shrink: 0;"
    >
      星界之尘: <strong>${this.gachaState.astralDust}</strong> |
      星辉: <strong>${this.gachaState.starglitter}</strong>
    </div>
    <div class="summon-container" style="flex-grow: 1;">
      <div class="summon-buttons">
        <button id="btn-gacha-pull-1" class="interaction-btn">
          召唤1次 (160尘)
        </button>
        <button
          id="btn-gacha-pull-10"
          class="interaction-btn primary-btn"
        >
          召唤10次 (1600尘)
        </button>
      </div>
      <div
        style="color:var(--text-main); font-size: var(--text-sm); text-align:center;"
      >
        <p>
          SSR保底: ${this.gachaState.pitySSR}/90 | SR保底:
          ${this.gachaState.pitySR}/10
        </p>
        <p>
          大保底状态:
          ${this.gachaState.ssrGuarantee
            ? '<span style="color:var(--color-danger);">开启</span>'
            : "关闭"}
        </p>
      </div>
      <button
        id="btn-gacha-history"
        class="interaction-btn btn-secondary"
        style="padding: 6px 12px; font-size: var(--text-sm);"
      >
        召唤记录
      </button>
      <div
        class="companion-display-container"
        style="margin-top:20px; padding:10px; background:var(--overlay-light); border-radius:4px; width:80%; text-align:center;"
      >
        <p
          style="font-size: var(--text-sm); color:F5DEB3; margin-bottom:8px;"
        >
          当前伙伴
          (${companions.length}/${this.maxCompanionSlots})
          (SSR: ${ssrCount}/${this.maxSSRCompanions})
        </p>
        <div
          class="history-results"
          style="justify-content:center;"
        >
          ${companionsHtml}
        </div>
      </div>
    </div>
  `;

  document
    .getElementById("btn-gacha-pull-1")
    .addEventListener("click", () => this.handlePull(1));
  document
    .getElementById("btn-gacha-pull-10")
    .addEventListener("click", () => this.handlePull(10));
  document
    .getElementById("btn-gacha-history")
    .addEventListener("click", () => this.showGachaHistory());

  // 为删除按钮绑定事件
  document
    .querySelectorAll(".btn-remove-companion")
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(
          e.target.dataset.companionIndex,
          10,
        );
        this.handleRemoveCompanion(index);
      });
    });
},
// 抽卡核心逻辑
handlePull(count) {
  // --- 新增修复：在抽卡前检查总卡池是否为空 ---
  const totalChars =
    (GameDBManager.DB.gachaCharacterPool.ssr?.length || 0) +
    (GameDBManager.DB.gachaCharacterPool.sr?.length || 0) +
    (GameDBManager.DB.gachaCharacterPool.r?.length || 0);
  if (totalChars === 0) {
    this.showTemporaryMessage(
      "错误：角色卡池为空！请检查世界书“[星界角色卡]”条目是否正确配置并已禁用。",
      5000,
    );
    return;
  }
  // --- 新增修复结束 ---

  const cost = count * 160;
  if (this.gachaState.astralDust < cost) {
    this.showTemporaryMessage("星界之尘不足！");
    return;
  }
  this.gachaState.astralDust -= cost;
  const results = [];
  let gotSR_or_above = false;
  for (let i = 0; i < count; i++) {
    const result = this.getGachaRoll();
    results.push(result);
    if (result.rarity === "SR" || result.rarity === "SSR")
      gotSR_or_above = true;
  }
  // 10连保底SR
  if (count === 10 && !gotSR_or_above) {
    results[Math.floor(Math.random() * 10)] =
      this.getRandomItemFromPool(["sr"]);
  }
  this.processPullResults(results);
  this.saveGachaState();
  this.renderSummonTab(); // 刷新UI
},
// 删除伙伴函数
handleRemoveCompanion(index) {
  if (
    !this.gachaState.activeCompanions ||
    index < 0 ||
    index >= this.gachaState.activeCompanions.length
  ) {
    this.showTemporaryMessage("伙伴不存在！");
    return;
  }
  const companionName = this.gachaState.activeCompanions[index].name;
  this.gachaState.activeCompanions.splice(index, 1);
  this.saveGachaState();
  this.renderSummonTab(); // 刷新UI
  this.showTemporaryMessage(`已移除伙伴：${companionName}`);
},

getGachaRoll() {
  // 【新增】检查首抽SR保底
  if (this.gachaState.firstPullGuaranteedSR === true) {
    this.gachaState.firstPullGuaranteedSR = false; // 使用掉保底机会
    this.saveGachaState(); // 立即保存状态，防止刷新丢失
    return this.getSRItem(); // 直接返回一个SR角色
  }

  this.gachaState.pitySR++;
  this.gachaState.pitySSR++;
  // 硬保底
  if (this.gachaState.pitySSR >= 90) return this.getSSRItem();
  if (this.gachaState.pitySR >= 10) return this.getSRItem();
  // 概率抽卡
  const rand = Math.random();
  let softPityRate = 0;
  if (this.gachaState.pitySSR >= 74) {
    softPityRate = (this.gachaState.pitySSR - 73) * 0.06; // 软保底
  }
  if (rand < 0.006 + softPityRate) return this.getSSRItem();
  if (rand < 0.006 + softPityRate + 0.051) return this.getSRItem();
  return this.getRandomItemFromPool(["r"]);
},

getSSRItem() {
  this.gachaState.pitySSR = 0;
  this.gachaState.pitySR = 0;
  // 此处简化处理大保底，未来可加入UP池逻辑
  this.gachaState.ssrGuarantee = false;
  return this.getRandomItemFromPool(["ssr"]);
},

getSRItem() {
  this.gachaState.pitySR = 0;
  return this.getRandomItemFromPool(["sr"]);
},

getRandomItemFromPool(rarities) {
  const pool = rarities.flatMap(
    (r) => GameDBManager.DB.gachaCharacterPool[r.toLowerCase()] || [],
  );
  if (pool.length === 0) {
    // 关键修复：如果指定稀有度的卡池为空，返回一个默认的“虚空”卡片，防止程序崩溃。
    // 您可以自定义这张“保底”卡片的名称和图片。
    console.error(
      `[Gacha System] 警告: 尝试从空的卡池 (${rarities.join(", ")}) 中抽卡。`,
    );
    return {
      id: "fallback_card",
      name: "虚空的低语",
      series: "未知",
      rarity: "R",
      image: "",
    };
  }
  return pool[Math.floor(Math.random() * pool.length)];
},
// 抽卡后处理
processPullResults(results) {
  let newCommands = "";

  // 关键修复：始终在渲染前打开模态框，防止内容渲染失败
  // 新增：第二个参数 true，保留下方的抽卡主界面不被关闭
  this.openModal("gacha-results-modal", true);

  const gridContainer = document.getElementById("gacha-results-grid");
  if (!gridContainer) {
    console.error(
      "[Gacha Error] 召唤结果容器 gacha-results-grid 未找到！",
    );
    this.closeAllModals();
    return;
  }
  gridContainer.innerHTML = "";

  // 新增：根据抽卡数量为容器添加不同的样式类，以触发不同布局
  if (results.length === 1) {
    gridContainer.className = "gacha-results-grid single-pull";
  } else {
    gridContainer.className = "gacha-results-grid";
  }

  results.forEach((res, index) => {
    const isDuplicate = !!this.gachaCollection[res.id];
    if (!isDuplicate) {
      this.gachaCollection[res.id] = {
        acquired: new Date().toISOString(),
      };
      if (res.rarity === "SSR" && res.resource) {
        this.showTemporaryMessage(
          `获得了特殊物品: ${res.resource.name}!`,
          4000,
        );
        const categoryMap = {
          武器: "武器列表",
          饰品: "饰品列表",
          衣物: "衣物列表",
          封印物: "封印物列表",
        };
        const targetCategory =
          categoryMap[res.resource.type] || "杂物列表";
        const resourceName = res.resource.name || "未知物品";
        const resourceJson = JSON.stringify(
          res.resource,
        ).replace(/'/g, "\\'");
        newCommands += `assign('${targetCategory}', '${resourceName}', '${resourceJson}'); `;
      }
    } else {
      const dustReward =
        res.rarity === "SSR"
          ? 80
          : res.rarity === "SR"
            ? 20
            : 5;
      const glitterReward =
        res.rarity === "SSR" ? 10 : res.rarity === "SR" ? 2 : 0;
      this.gachaState.astralDust += dustReward;
      if (glitterReward > 0)
        this.gachaState.starglitter += glitterReward;
      let rewardText = `${res.name} 已转化为 ${dustReward} 星界之尘`;
      if (glitterReward > 0)
        rewardText += ` 和 ${glitterReward} 星辉`;
      this.showTemporaryMessage(rewardText);
    }

    const card = document.createElement("div");
    // 修正：确保稀有度总是大写，以匹配CSS类名
    card.className = `gacha-results-card rarity-${res.rarity.toUpperCase()}`;
    if (res.image) {
      card.style.backgroundImage = `url('${res.image}')`;
    }

    // 新增：为新获得的角色添加 "NEW" 标签
    if (!isDuplicate) {
      const newTag = document.createElement("div");
      newTag.className = "gacha-results-new-tag";
      newTag.textContent = "NEW";
      card.appendChild(newTag);
    }

    const infoContainer = document.createElement("div");
    infoContainer.className = "gacha-results-card-info";
    const nameElement = document.createElement("div");
    nameElement.className = "item-name";
    nameElement.textContent = res.name || "未知角色";
    infoContainer.appendChild(nameElement);
    const rarityElement = document.createElement("div");
    rarityElement.className = "item-rarity";
    rarityElement.textContent = res.rarity || "N/A";
    infoContainer.appendChild(rarityElement);
    if (isDuplicate) {
      const duplicateTag = document.createElement("div");
      duplicateTag.className = "gacha-results-duplicate-tag";
      duplicateTag.textContent = "重复";
      infoContainer.appendChild(duplicateTag);
    }
    card.appendChild(infoContainer);
    gridContainer.appendChild(card);
  });

  if (newCommands) {
    this._applyLocalUpdate(newCommands);
  }

  // ✨ 核心修改：只把 ID 存进历史记录，极大缩减存档体积
  const idResults = results.map(res => res.id);
  this.gachaHistory.unshift({
    timestamp: new Date().toISOString(),
    results: idResults, 
  });

  if (this.gachaHistory.length > 200) this.gachaHistory.pop();
  this.saveGachaState();
},
// 渲染兑换码界面
renderShopTab() {
  const container = document.getElementById("gacha-tab-shop");
  if (!container) return;

  container.innerHTML = /* HTML */ `
    <div
      class="shop-container"
      style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 25px; padding: 20px; text-align: center;"
    >
      <div class="section-title" style="margin-bottom: 0;">
        神秘赠礼
      </div>
      <p
        style="color: var(--text-muted); font-size: var(--text-base); max-width: 400px;"
      >
        在此输入神秘的咒文以换取星界的馈赠。某些咒文或许低语着神的名字，蕴含着无限的力量。
      </p>
      <div style="display: flex; gap: 10px; align-items: center;">
        <input
          type="text"
          id="redeem-code-input"
          placeholder="输入兑换码"
          class="modal-input"
          style="width: 300px; height: 40px; text-align: center; font-size: var(--text-base);"
        />
        <button
          id="btn-redeem-code"
          class="interaction-btn primary-btn"
          style="padding: 10px 20px;"
        >
          兑换
        </button>
      </div>
      <div
        style="color:var(--text-muted); font-size: var(--text-sm);"
      >
        当前星界之尘:
        <strong>${this.gachaState.astralDust}</strong> |
        当前星辉:
        <strong>${this.gachaState.starglitter}</strong>
      </div>
    </div>
  `;

  document
    .getElementById("btn-redeem-code")
    .addEventListener("click", () => this.handleRedeemCode());
  document
    .getElementById("redeem-code-input")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        document.getElementById("btn-redeem-code").click();
      }
    });
},
// 处理兑换码
handleRedeemCode() {
  const input = document.getElementById("redeem-code-input");
  if (!input) return;
  const code = input.value.trim();

  if (!code) {
    this.showTemporaryMessage("请输入兑换码。");
    return;
  }

  const codeDB = {
    qiwu1314: { reward: 300, type: "dust", repeatable: false },
    yemuccb: { reward: 300, type: "dust", repeatable: false },
    mengxing666: { reward: 300, type: "dust", repeatable: false },
    起物大人是执掌纯爱的神: {
      reward: 9999,
      type: "dust",
      repeatable: true,
    },
    阿蒙修复补偿: {
      reward: 300,
      type: "dust",
      repeatable: false,
      expires: "2025-08-30",
    },
    Yoshi: { reward: 233, type: "dust", repeatable: true },
    诡秘剧场: { reward: 1600, type: "dust", repeatable: false },
    人为财死: { reward: 1600, type: "dust", repeatable: false },
    大航海时代: { reward: 1600, type: "dust", repeatable: false },
    契灵庆典: { reward: 1600, type: "dust", repeatable: false },
    鎏金鸾尾沙龙: { reward: 1600, type: "dust", repeatable: false },
    宿命之环: { reward: 1600, type: "dust", repeatable: false },
    逐光者: { reward: 1600, type: "dust", repeatable: false },
    命运之轮: { reward: 1600, type: "dust", repeatable: false },
    恋人: { reward: 1600, type: "dust", repeatable: false },
    编剧: { reward: 1600, type: "dust", repeatable: false },
    伦堡研学: { reward: 1600, type: "dust", repeatable: false },
  };

  const entry = codeDB[code];

  if (!entry) {
    this.showTemporaryMessage("无效的兑换码。");
    input.value = "";
    return;
  }

  // --- 新增：检查兑换码是否已过期 ---
  if (entry.expires) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 将今天的时间设置为当天的零点，以便精确比较
    const expiryDate = new Date(entry.expires);

    if (today >= expiryDate) {
      this.showTemporaryMessage("抱歉，该兑换码已过期。");
      input.value = "";
      return;
    }
  }
  // --- 检查逻辑结束 ---  // 检查是否为一次性且已兑换
  if (
    !entry.repeatable &&
    this.gachaState.redeemedCodes.includes(code)
  ) {
    this.showTemporaryMessage("您已经兑换过这个礼包了。");
    input.value = "";
    return;
  }

  // 执行兑换
  if (entry.type === "dust") {
    this.gachaState.astralDust += entry.reward;
  }
  // 未来可以扩展其他奖励类型，如星辉
  // else if (entry.type === 'glitter') { ... }

  if (!entry.repeatable) {
    this.gachaState.redeemedCodes.push(code);
  }

  this.saveGachaState();
  this.showTemporaryMessage(
    `兑换成功！获得 ${entry.reward} 星界之尘！`,
    3000,
  );
  input.value = "";

  // 刷新UI以显示新的货币数量
  this.renderShopTab();
},
// 抽卡记录
showGachaHistory(page = 1) {
  this.openModal("gacha-history-modal", true);
  const listEl = document.getElementById("history-list");
  const indicatorEl = document.getElementById(
    "history-page-indicator",
  );
  let prevBtn = document.getElementById("history-prev-btn");
  let nextBtn = document.getElementById("history-next-btn");
  const itemsPerPage = 5;
  const totalPages = Math.ceil(
    this.gachaHistory.length / itemsPerPage,
  );
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = this.gachaHistory.slice(start, end);

  let html =
    pageItems.length > 0
      ? ""
      : '<p style="color:var(--text-muted);text-align:center;">暂无记录</p>';
  pageItems.forEach((item) => {
    let resultsHtml = "";
    // ✨ 核心修改：item.results 现在全是 ID，需要查字典
    item.results.forEach((id) => {
      const res = GameDBManager.DB.gachaCharacterDB[id] || { name: "未知数据", rarity: "R" };
      resultsHtml += `<span class="history-result-item rarity-${res.rarity.toUpperCase()}">${res.name}</span>`;
    });
    html += `
        <div class="history-item">
        <div class="history-timestamp">${new Date(item.timestamp).toLocaleString()}</div>
        <div class="history-results">${resultsHtml}</div>
        </div>
        `;
  });
  listEl.innerHTML = html;
  indicatorEl.textContent = `第 ${page} / ${totalPages || 1} 页`;

  // --- 核心修复：通过克隆节点的方式，彻底清除旧的事件监听器 ---
  const newPrevBtn = prevBtn.cloneNode(true);
  prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
  prevBtn = newPrevBtn; // 更新按钮引用

  const newNextBtn = nextBtn.cloneNode(true);
  nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
  nextBtn = newNextBtn; // 更新按钮引用

  // 在新的、干净的按钮上设置状态和事件
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;

  if (!prevBtn.disabled) {
    prevBtn.onclick = () => this.showGachaHistory(page - 1);
  }
  if (!nextBtn.disabled) {
    nextBtn.onclick = () => this.showGachaHistory(page + 1);
  }
},



// ---=== 分解与图鉴功能 ===---

_getDecomposableItems() {
  const allItems = [];
  if (!this.currentMvuState || !this.currentMvuState.stat_data)
    return [];
  const stat_data = this.currentMvuState.stat_data;

  const itemCategories = [
    "武器列表",
    "衣物列表",
    "饰品列表",
    "封印物列表",
    "消耗品列表",
    "杂物列表",
    "其他列表",
    "非凡材料列表",
  ];

  itemCategories.forEach((categoryKey) => {
    const itemsObj = this.SafeGetValue(stat_data, categoryKey, {});
    Object.values(itemsObj).forEach((item) => {
      if (
        item &&
        typeof item === "object" &&
        (item.名称 || item.name)
      ) {
        // 简单拷贝并添加来源，避免修改原始数据
        const itemCopy = { ...item };
        itemCopy.sourceCategory = categoryKey;
        allItems.push(itemCopy);
      }
    });
  });

  return allItems;
},

calculateItemValue(item) {
  const tier = this.SafeGetValue(
    item,
    ["品阶", "tier", "序列"],
    "普通",
  );
  const valueMap = {
    序列9: 5,
    普通: 5,
    序列8: 10,
    序列7: 20,
    非凡: 20,
    序列6: 40,
    序列5: 80,
    罕见: 80,
    序列4: 150,
    史诗: 150,
    序列3: 300,
    传说: 300,
    序列2: 600,
    神话: 600,
    序列1: 1200,
    唯一: 1200,
    序列0: 2500,
    旧日: 5000,
    支柱: 10000,
  };
  const baseValue = valueMap[tier] || 5;
  const quantity = parseInt(
    this.SafeGetValue(item, ["数量", "quantity"], 1),
    10,
  );
  return baseValue * quantity;
},
// 分解标签页的完整渲染与事件绑定
renderDecompositionTab() {
  const container = document.getElementById(
    "gacha-tab-decomposition",
  );
  const inventoryItems = this._getDecomposableItems();
  let inventoryHtml =
    inventoryItems.length > 0
      ? ""
      : '<p style="color:var(--text-muted); text-align:center;">没有可分解的物品。</p>';

  const equippedItemNames = Object.values(this.equippedItems)
    .filter((i) => i)
    .map((i) => this.SafeGetValue(i, ["名称", "name"]));
  const filteredInventory = inventoryItems.filter(
    (item) =>
      !equippedItemNames.includes(
        this.SafeGetValue(item, ["名称", "name"]),
      ),
  );

  filteredInventory.forEach((item) => {
    const itemName = this.SafeGetValue(item, ["名称", "name"]);
    const itemTier = this.SafeGetValue(
      item,
      ["品阶", "tier", "序列"],
      "普通",
    );
    const itemValue = Math.floor(
      this.calculateItemValue(item) / (item.数量 || 1),
    );
    inventoryHtml += `
      <div class="decom-inventory-item" data-item='${JSON.stringify(item)}'>
      <span class="decom-item-name ${this.getTierClass(itemTier)}">${itemName} (x${item.数量 || 1})</span>
      <span class="decom-item-value">价值: ${itemValue} 尘/个</span>
      </div>
      `;
  });

  container.innerHTML = /* HTML */ `
    <div class="decomposition-container">
      <div class="decom-inventory">
        <div class="section-title">选择物品进行分解</div>
        <div id="decom-inventory-list">${inventoryHtml}</div>
      </div>
      <div class="decom-altar">
        <div class="section-title">献祭槽</div>
        <div id="decom-altar-list"></div>
        <div id="decom-results">
          总价值: <strong>0</strong> 星界之尘
        </div>
        <button
          id="btn-decompose"
          class="interaction-btn"
          disabled
        >
          分解
        </button>
      </div>
    </div>
  `;

  const altarItems = new Map();
  const inventoryListEl = document.getElementById(
    "decom-inventory-list",
  );
  const altarListEl = document.getElementById("decom-altar-list");
  const resultsEl = document.getElementById("decom-results");
  const decomposeBtn = document.getElementById("btn-decompose");

  const renderAltar = () => {
    altarListEl.innerHTML = "";
    altarItems.forEach((item, name) => {
      const el = document.createElement("div");
      el.className = "decom-altar-item";
      el.textContent = `${name} x${item.数量}`;
      el.dataset.itemName = name;
      altarListEl.appendChild(el);
    });
  };

  const updateTotalValue = () => {
    let totalValue = 0;
    altarItems.forEach(
      (item) => (totalValue += this.calculateItemValue(item)),
    );
    resultsEl.innerHTML = /* HTML */ `总价值:
      <strong>${totalValue}</strong> 星界之尘`;
    decomposeBtn.disabled = totalValue === 0;
  };

  // 核心修改1：点击物品列表时的逻辑
  inventoryListEl.addEventListener("click", (e) => {
    const itemEl = e.target.closest(".decom-inventory-item");
    if (!itemEl) return;

    const itemData = JSON.parse(itemEl.dataset.item);
    const itemName = this.SafeGetValue(itemData, ["名称", "name"]);
    const originalQuantity = parseInt(
      this.SafeGetValue(itemData, ["数量", "quantity"], 1),
      10,
    );
    const itemInAltar = altarItems.get(itemName);
    const currentAltarQuantity = itemInAltar ? itemInAltar.数量 : 0;
    const availableQuantity =
      originalQuantity - currentAltarQuantity;

    if (availableQuantity <= 0) {
      this.showTemporaryMessage(
        `已将所有“${itemName}”放入献祭槽。`,
      );
      return;
    }

    const handleAddition = (quantityToAdd) => {
      if (itemInAltar) {
        itemInAltar.数量 += quantityToAdd;
      } else {
        const newItem = { ...itemData, 数量: quantityToAdd };
        altarItems.set(itemName, newItem);
      }
      renderAltar();
      updateTotalValue();
    };

    if (originalQuantity > 1) {
      this.promptDecompositionQuantity(
        itemData,
        availableQuantity,
        handleAddition,
      );
    } else {
      handleAddition(1);
    }
  });

  // 核心修改2：点击献祭槽物品时的逻辑
  altarListEl.addEventListener("click", (e) => {
    const itemEl = e.target.closest(".decom-altar-item");
    if (!itemEl) return;
    const itemName = itemEl.dataset.itemName;
    const itemInAltar = altarItems.get(itemName);
    if (itemInAltar) {
      itemInAltar.数量--;
      if (itemInAltar.数量 <= 0) {
        altarItems.delete(itemName);
      }
      renderAltar();
      updateTotalValue();
    }
  });

  decomposeBtn.addEventListener("click", () => {
    if (altarItems.size === 0) return;
    let totalValue = 0;
    altarItems.forEach(
      (item) => (totalValue += this.calculateItemValue(item)),
    );

    this.showConfirmModal(
      `确定要分解这些物品以换取 ${totalValue} 星界之尘吗？此操作不可撤销。`,
      () =>
        this.performDecomposition(
          Array.from(altarItems.values()),
          totalValue,
        ),
    );
  });
},
// 执行分解的核心函数
async performDecomposition(itemsToDecompose, totalValue) {
  if (itemsToDecompose.length === 0) return;
  this.showTemporaryMessage("正在分解物品...");

  let removeCommands = "";
  itemsToDecompose.forEach((item) => {
    const itemName = this.SafeGetValue(item, ["名称", "name"]);
    const category = item.sourceCategory;
    // 注意：这里的实现简化为直接移除整个物品堆叠，未来可优化为减少数量
    removeCommands += `_.remove('${category}.${itemName}'); `;
  });

  // 更新星界之尘数量
  this.gachaState.astralDust += totalValue;
  this.saveGachaState();

  // 通过指令系统移除物品
  try {
    await this.handleAction(`[指令] ${removeCommands}`);
    this.showTemporaryMessage(
      `分解成功！获得 ${totalValue} 星界之尘。`,
      3000,
    );
    // 刷新分解界面
    this.renderDecompositionTab();
  } catch (e) {
    console.error("分解物品时执行指令失败:", e);
    this.showTemporaryMessage("分解失败，请重试。");
    // 如果失败，回滚星界之尘
    this.gachaState.astralDust -= totalValue;
    this.saveGachaState();
  }
},
// 分解时选择数量的弹窗
async promptDecompositionQuantity(itemData, availableQuantity, callback) {
  const itemName = this.SafeGetValue(itemData, ["名称", "name"]);

  // 1. 组装提示文本
  const messageHtml = `
    请选择要加入献祭槽的 <strong>${itemName}</strong> 数量：<br>
    <span style="font-size: var(--text-sm); color: var(--text-muted); display: inline-block; margin-top: 8px;">
      当前可添加数量：${availableQuantity}
    </span>
  `;

  // 2. 输入框原生属性
  const extraAttr = `min="1" max="${availableQuantity}"`;

  // 3. 配置高级选项：开启滑块，并添加“全部添加”按钮
  const options = {
    showSlider: true,
    sliderMin: 1,
    sliderMax: availableQuantity,
    confirmClass: "interaction-btn primary-btn", // 蓝色/主色按钮
    customButtons: [
      { 
        text: "全部添加", 
        className: "interaction-btn danger-btn", 
        resolveValue: availableQuantity // 点击这个按钮，Promise 直接 resolve 这个值
      }
    ]
  };

  // 4. 一行代码呼出弹窗并等待结果
  const result = await this.showPromptModal(
    "选择分解数量", 
    messageHtml, 
    "1", 
    "number", 
    extraAttr, 
    options
  );

  // 5. 判断结果并回调
  if (result === null || result.trim() === "") return;

  const quantity = parseInt(result, 10);
  if (!isNaN(quantity) && quantity > 0 && quantity <= availableQuantity) {
    callback(quantity);
  } else {
    this.showTemporaryMessage("请输入有效的数量");
  }
},
// 图鉴标签页的完整渲染与事件绑定
renderGalleryTab() {
  const container = document.getElementById("gacha-tab-gallery");
  let gridHtml = "";
  const allChars = [
    ...GameDBManager.DB.gachaCharacterPool.ssr,
    ...GameDBManager.DB.gachaCharacterPool.sr,
    ...GameDBManager.DB.gachaCharacterPool.r,
  ];
  // 按稀有度排序
  allChars.sort(
    (a, b) =>
      (b.rarity === "SSR" ? 3 : b.rarity === "SR" ? 2 : 1) -
      (a.rarity === "SSR" ? 3 : a.rarity === "SR" ? 2 : 1),
  );

  allChars.forEach((char) => {
    const isUnlocked = this.gachaCollection[char.id];
    const cardClass = `gallery-card rarity-${char.rarity} ${isUnlocked ? "unlocked" : "gallery-card-locked"}`;
    const bgImageStyle =
      isUnlocked && char.image
        ? `background-image: url('${char.image}');`
        : "";

    // 获取解锁成本
    const unlockCost = this.CHARACTER_UNLOCK_COST[char.rarity];

    // 【新增】未解锁卡片显示名字和成本
    let cardContentHtml = "";
    if (isUnlocked) {
      cardContentHtml = `<div class="gallery-card-name">${char.name}</div>`;
    } else {
      cardContentHtml = `
      <div class="gallery-card-name" style="opacity: 0.7;">${char.name}</div>
      <div class="gallery-card-unlock-cost" style="font-size: var(--text-sm); color: var(--color-primary); text-align: center; margin-top: 5px;">花费星辉解锁: ${unlockCost}</div>
      `;
          }

          gridHtml += `
      <div class="${cardClass}" title="${char.name} - ${char.series}" data-char-id="${char.id}" data-char-rarity="${char.rarity}" style="${bgImageStyle}">
      ${cardContentHtml}
      </div>
      `;
  });
  container.innerHTML = /* HTML */ `<div class="gallery-grid">
    ${gridHtml}
  </div>`;

  // 【修改】绑定点击事件 - 已解锁卡片打开详情，未解锁卡片执行解锁
  container
    .querySelector(".gallery-grid")
    .addEventListener("click", (e) => {
      const card = e.target.closest(".gallery-card");
      if (!card) return;

      const charId = card.dataset.charId;
      const charData = allChars.find((c) => c.id === charId);
      if (!charData) return;

      const isUnlocked = this.gachaCollection[charId];

      if (isUnlocked) {
        // 已解锁卡片：显示详情
        this.showGachaCharacterDetails(charData);
      } else {
        // 未解锁卡片：执行解锁操作
        this.handleUnlockCharacter(charData, card);
      }
    });
},
// 【新增】通过星辉解锁角色
handleUnlockCharacter(charData, cardElement) {
  const charId = charData.id;
  const unlockCost = this.CHARACTER_UNLOCK_COST[charData.rarity];
  const currentStarglitter = this.gachaState.starglitter || 0;

  // 检查星辉是否足够
  if (currentStarglitter < unlockCost) {
    const shortage = unlockCost - currentStarglitter;
    const message = `<div style="text-align: center; color: var(--text-subtle);">
      <p style="font-size: var(--text-md); margin-bottom: 10px;">❌ 星辉不足</p>
      <p style="margin: 8px 0;">需要: ${unlockCost} 💫</p>
      <p style="margin: 8px 0;">已有: ${currentStarglitter} 💫</p>
      <p style="margin: 8px 0; color: var(--color-danger);">缺少: ${shortage} 💫</p>
      <p style="margin-top: 15px; font-style: italic; color: var(--text-muted);">无法解锁 ${charData.name}。</p>
      </div>`;
          this.showConfirmModal(message, null);
          return;
        }

        // 星辉足够，显示确认对话框
        const confirmMessage = `<div style="text-align: center; color: var(--text-subtle);">
      <p style="font-size: var(--text-md); margin-bottom: 10px;">确定要解锁吗？</p>
      <p style="margin: 8px 0;">角色: <strong>${charData.name}</strong></p>
      <p style="margin: 8px 0;">消耗: <strong style="color: var(--color-primary);">${unlockCost} 💫</strong></p>
      <p style="margin-top: 15px; font-style: italic; color: var(--text-muted);">解锁后，${charData.name} 将出现在您的角色列表中。</p>
      </div>`;

  this.showConfirmModal(confirmMessage, async () => {
    // 用户确认解锁
    try {
      // 扣除星辉
      this.gachaState.starglitter -= unlockCost;

      // 解锁角色
      this.gachaCollection[charId] = {
        acquired: new Date().toISOString(),
        unlockedAt: new Date().toISOString(),
      };

      // 保存状态
      await this.saveGachaState();

      // 显示成功提示
      this.showTemporaryMessage(
        `✅ 成功解锁 ${charData.name}！\n消耗星辉: ${unlockCost} 💫`,
        3000,
      );

      // 刷新图鉴界面
      this.renderGalleryTab();
    } catch (error) {
      console.error("[解锁失败]", error);
      this.showTemporaryMessage(`❌ 解锁失败: ${error.message}`);
    }
  });
},
//======最终发送给AI的指令=====
showGachaCharacterDetails(charData) {
  const modal = document.getElementById("gacha-details-modal");
  const titleEl = document.getElementById("gacha-details-title");
  const bodyEl = document.getElementById("gacha-details-body");
  const footerEl = document.getElementById("gacha-details-footer");

  if (!modal || !titleEl || !bodyEl || !footerEl) {
    console.error("Gacha详情模态框的元素未找到!");
    return;
  }

  titleEl.textContent = charData.name;
  const imageHtml = `<div class="gacha-details-image-large" style="background-image: url('${charData.image || ""}');"></div>`;
  let infoHtml = `<div class="gacha-details-info">
      <p><strong>系列:</strong> ${charData.series || "未知"}</p>
      <p><strong>稀有度:</strong> ${charData.rarity || "未知"}</p>
      ${charData.initialSequence ? `<p><strong>初始序列:</strong> ${charData.initialSequence}</p>` : ""}
      <p><strong>适配途径:</strong> ${charData.sequence || "未知"}</p>
      `;
        if (charData.rarity === "SSR" && charData.resource) {
          infoHtml += `
      <div class="gacha-details-resource">
      <p><strong>初始资源:</strong> ${charData.resource.name} (${charData.resource.tier}级${charData.resource.type})</p>
      <p><em>${charData.resource.description}</em></p>
      </div>
      `;
  }
  infoHtml += `</div>`;
  bodyEl.innerHTML = imageHtml + infoHtml;

  const companions = this.gachaState.activeCompanions || [];
  const isAlreadyActive = companions.some(
    (c) => c.id === charData.id,
  );
  const totalLimitReached =
    companions.length >= this.maxCompanionSlots;
  const ssrCount = companions.filter(
    (c) => c.rarity === "SSR",
  ).length;
  const ssrLimitReached = ssrCount >= this.maxSSRCompanions;
  const isCharSSR = charData.rarity === "SSR";

  let joinButtonHtml = "";
  if (isAlreadyActive) {
    joinButtonHtml = `<button id="btn-gacha-join-world" class="interaction-btn primary-btn" disabled>已在世界中</button>`;
  } else if (totalLimitReached) {
    joinButtonHtml = `<button id="btn-gacha-join-world" class="interaction-btn primary-btn" disabled>伙伴已满 (${companions.length}/${this.maxCompanionSlots})</button>`;
  } else if (isCharSSR && ssrLimitReached) {
    joinButtonHtml = `<button id="btn-gacha-join-world" class="interaction-btn primary-btn" disabled>SSR伙伴已满 (${ssrCount}/${this.maxSSRCompanions})</button>`;
  } else {
    joinButtonHtml = `<button id="btn-gacha-join-world" class="interaction-btn primary-btn">加入当前世界</button>`;
  }

  footerEl.innerHTML = /* HTML */ `
    <button id="btn-gacha-close-details" class="interaction-btn">
      关闭
    </button>
    ${joinButtonHtml}
  `;

  document
    .getElementById("btn-gacha-close-details")
    .addEventListener("click", () => {
      modal.style.display = "none";
    });

  const joinButton = document.getElementById("btn-gacha-join-world");
  if (joinButton && !joinButton.disabled) {
    joinButton.addEventListener("click", async () => {
      this.showTemporaryMessage(
        `正在检查“${charData.name}”的存在性...`,
      );
      const bookName = WorldbookManager.PRIMARY_BOOK;
      const characterName = charData.name;
      const characterRarity = charData.rarity;
      const characterTags = charData.tags;
      const characterInitialSequence = charData.initialSequence;
      const characterSeries = charData.series;
      const characterResource = charData.resource;
      const characterSequence = charData.sequence;


      // 定义一个包含后续所有步骤的函数，以便复用
      const proceedWithGeneration = () => {
        // 步骤2：设置追踪变量
        this.pendingCompanionJoin = {
          id: charData.id,
          name: charData.name,
          rarity: charData.rarity,
        };
        this.pendingCharacterCardGeneration = characterName;

        // --- 修复部分：处理对象转换为 JSON 字符串 ---
        // 如果是对象则转换，否则保留原样（防止为 null 或 undefined）
        const resourceToPass = (typeof characterResource === 'object' && characterResource !== null) 
          ? JSON.stringify(characterResource, null, 2) // 使用 JSON 字符串，null, 2 可以让格式带换行更整齐
          : (characterResource || "无");

        // 步骤3：构建包含【原始详细角色卡模板】的指令
        const command = GameDBManager.renderTemplate("gacha_template", {
          characterName: characterName,
          characterRarity: characterRarity,
          characterTags: characterTags,
          characterInitialSequence: characterInitialSequence,
          characterSequence: characterSequence,
          characterSeries: characterSeries,
          characterResource: resourceToPass
        });

        // 步骤4：发送指令并关闭窗口
        this.handleAction(command);
        this.closeAllModals();
      };

      try {
        const allEntries =
          await TavernHelper.getLorebookEntries(bookName);
        const existingEntry = allEntries.find(
          (entry) => entry.comment === characterName || entry.name === characterName
        ); // 建议加上 entry.name 判重，更严谨

        if (existingEntry) {
          // 条目已存在，弹出确认框
          this.showConfirmModal(
            `世界书中已存在名为“${characterName}”的条目。您确定要覆盖它的内容吗？`,
            () => {
              // 用户点击“确认”
              this.showTemporaryMessage(
                `准备覆盖“${characterName}”的档案...`,
              );
              proceedWithGeneration();
            },
            () => {
              // 用户点击“取消”
              this.showTemporaryMessage("操作已取消。");
            },
          );
        } else {
          // 条目不存在，先创建，再继续
          await TavernHelper.createLorebookEntries(bookName, [
            {
              name: characterName, // 官方标准字段
              comment: characterName, // 兼容旧依赖
              content: `正在等待AI生成角色设定...`,
              enabled: true, // 启用
              strategy: {
                type: 'selective', // constant: false (即绿灯/可选项)
                keys: [characterName] // 官方要求 keys 放在 strategy 内
              },
              position: {
                type: 'before_character_definition', // 定义到角色之前
                order: 260 // 排序 260
              }
            },
          ]);
          this.showTemporaryMessage(
            `已为“${characterName}”在世界书创建档案。`,
          );
          proceedWithGeneration();
        }
      }catch (error) {
        console.error("检查或创建世界书条目时失败:", error);
        this.showTemporaryMessage(
          `操作失败！ ${error.message}`,
          4000,
        );
        return;
      }
    });
  }

  this.openModal("gacha-details-modal", true);
},

// --- 从存档记录中加载Gacha数据的通用函数 ---
_loadGachaDataFromSave(saveData) {
  if (saveData && saveData.gacha_data) {
    this.gachaState = saveData.gacha_data.state;
    
    // ✨ 存档直读兼容：清洗图鉴
    const rawCollection = saveData.gacha_data.collection || {};
    this.gachaCollection = {};
    for (const [oldKey, value] of Object.entries(rawCollection)) {
      const newId = this._migrateGachaId(oldKey);
      if (newId) this.gachaCollection[newId] = value;
    }
    
    // ✨ 存档直读兼容：清洗历史记录
    this.gachaHistory = (saveData.gacha_data.history || []).map(item => ({
      timestamp: item.timestamp,
      results: item.results.map(res => this._migrateGachaId(res)).filter(id => id)
    }));
  } else {
    // 如果是旧存档或新游戏，则重置为初始状态
    this.gachaState = {
      astralDust: 160,
      starglitter: 0,
      pitySSR: 0,
      pitySR: 0,
      ssrGuarantee: false,
      redeemedCodes: [],
      activeCompanions: [],
      firstPullGuaranteedSR: true,
    };
    this.gachaCollection = {};
    this.gachaHistory = [];
    console.log(
      "[Gacha] 未在存档中找到Gacha数据，已重置为初始状态。",
    );
  }
  // 确保任何情况下starglitter和新字段都有默认值，防止undefined
  if (this.gachaState.starglitter === undefined) {
    this.gachaState.starglitter = 0;
  }
  if (!this.gachaState.redeemedCodes) {
    this.gachaState.redeemedCodes = [];
  }

  // ✨ 存档直读兼容：清洗在场伙伴
  this.gachaState.activeCompanions = this.gachaState.activeCompanions
    .map(c => this._migrateGachaId(c))
    .filter(id => id);
  // 核心修复：将从存档加载的状态，立刻保存为当前的实时状态，以便刷新后能正确保留
  this.saveGachaState();
},

//=========星界之门系统结束===========

//======诡秘剧场开始=========
//======-==================
// 1. 同步点数（currentMvuState ↔ theaterState，兼容现有渲染）
syncTheaterPoints() {
  // 确保 currentMvuState 和 stat_data 存在
  this.currentMvuState = this.currentMvuState || { stat_data: {} };
  this.currentMvuState.stat_data =
    this.currentMvuState.stat_data || {};
  // 🔴 核心：用中文键名“剧场点数”，若不存在则自动初始化（兼容旧数据）
  if (this.currentMvuState.stat_data["剧场点数"] === undefined) {
    this.currentMvuState.stat_data["剧场点数"] = 0; // 初始化
  }

  // 同步到theaterState（供渲染用，保持原有字段名兼容渲染函数）
  this.theaterState = this.theaterState || {};
  this.theaterState.theaterPoints =
    this.currentMvuState.stat_data["剧场点数"];
},

// 3. 渲染剧场模态框（默认显示原剧场界面）
renderTheaterModal() {
  const existingModal = document.getElementById("theater-modal");
  if (existingModal) existingModal.remove();

  this.syncTheaterPoints();

  const modal = document.createElement("div");
  modal.id = "theater-modal";
  modal.className = "modal-overlay";
  modal.style.cssText = "display: flex; z-index: 1002;";

  // ✨ 彻底拥抱通用类：modal-tabs, modal-tab, modal-tab-content
  modal.innerHTML = `
    <div class="modal-content theater-modal-content">
      <div class="modal-header">
        <h2 class="modal-title">剧场点数: <strong>${this.theaterState.theaterPoints}</strong></h2>
        <button class="modal-close-btn">&times;</button>
      </div>

      <div class="modal-tabs">
        <div class="modal-tab active" data-tab="theater">剧场</div>
        <div class="modal-tab" data-tab="arena">角斗场</div>
        <div class="modal-tab" data-tab="points">重铸装备</div>
      </div>

      <div class="modal-body" style="padding: 0; display: flex; flex-direction: column;">
        <div id="theater-tab-theater" class="modal-tab-content active"></div>
        <div id="theater-tab-arena" class="modal-tab-content"></div>
        <div id="theater-tab-points" class="modal-tab-content"></div>
      </div>
    </div>
  `;

  this.mountModalToTopLayer(modal);
  this.bindTheaterModalEvents(modal);
  
  // 初始化时渲染所有 Tab，而不是等切过去再渲染（避免每次切换都暴力重绘）
  this.renderTheaterTab();
  if (typeof this.renderArenaTab === "function") this.renderArenaTab();
  if (typeof this.renderPointsTab === "function") this.renderPointsTab();
  
  this.switchTheaterTab("theater");
},

// 6. 绑定模态框基础事件（标签页切换+关闭）
bindTheaterModalEvents(modal) {
  const closeBtn = modal.querySelector(".modal-close-btn");
  // ✨ 统一修改为监听 modal-tab
  const tabs = modal.querySelectorAll(".modal-tab");

  closeBtn.addEventListener("click", () => modal.remove());

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      this.switchTheaterTab(tabName);
    });
  });
},

// 4. 渲染原剧场界面（DOM结构与事件绑定剥离）
renderTheaterTab() {
  const container = document.getElementById("theater-tab-theater");
  if (!container) return;

  // 避免重复渲染导致事件叠加
  if (container.innerHTML.trim() !== "") return;

  container.innerHTML = `
    <div class="theater-tab-body" style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
      <p class="modal-prompt-text" style="text-align: center; max-width: 80%;">
        为何走下台？幕后人员可以抽取其他世界的物品，售票人员可以出售穿越世界的票据，活动人员可以介绍在诡秘世界中当前的DLC活动。
      </p>
      <div class="theater-btn-group" style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
        <button id="btn-find-staff" class="interaction-btn">寻找幕后人员 (80点)</button>
        <button id="btn-find-ticket-seller" class="interaction-btn">寻找售票人员 (50点)</button>
        <button id="btn-find-event-staff" class="interaction-btn">当前剧场活动详情</button>
      </div>
    </div>
  `;

  // 提取点数消耗的通用逻辑，让代码更干练
  const handleTheaterAction = async (actionName, cost, loadingMsg) => {
    if (this.isBusy) {
      this.showTemporaryMessage("正在处理上一条指令，请稍候...");
      return;
    }
    if (cost > 0 && this.theaterState.theaterPoints < cost) {
      this.showTemporaryMessage(`剧场点数不足${cost}点，无法${actionName}！`);
      return;
    }

    const prePoints = this.theaterState.theaterPoints;
    try {
      if (cost > 0) {
        this.currentMvuState.stat_data["剧场点数"] = prePoints - cost;
        this.syncTheaterPoints(); // 更新顶部点数显示
      }
      this.showTemporaryMessage(loadingMsg);
      await this.handleAction(actionName, false);
      
      // 如果有 PointsTab，切后台顺便更新一下它的数据
      if (typeof this.renderPointsTab === "function") this.renderPointsTab(true); 
    } catch (error) {
      if (cost > 0) {
        this.currentMvuState.stat_data["剧场点数"] = prePoints;
        this.syncTheaterPoints();
      }
      this.showTemporaryMessage("操作失败，点数已回滚！");
    }
  };

  container.querySelector("#btn-find-staff").addEventListener("click", () => 
    handleTheaterAction("寻找幕后工作人员", 80, "消耗80点，正在寻找幕后人员...")
  );

  container.querySelector("#btn-find-ticket-seller").addEventListener("click", () => 
    handleTheaterAction("寻找售票工作人员", 50, "消耗50点，正在寻找售票人员...")
  );

  container.querySelector("#btn-find-event-staff").addEventListener("click", () => 
    handleTheaterAction("寻找剧场活动工作人员", 0, "正在查询剧场活动详情...")
  );
},

// 5. 切换标签页 (告别暴力清空，纯净的显隐控制)
switchTheaterTab(tabName) {
  try {
    const modal = document.querySelector("#theater-modal");
    if (!modal) return;

    // 1. 切换 Tab 按钮的高亮状态
    modal.querySelectorAll(".modal-tab").forEach((t) => t.classList.remove("active"));
    const targetTab = modal.querySelector(`.modal-tab[data-tab='${tabName}']`);
    if (targetTab) targetTab.classList.add("active");

    // 2. 切换 内容区 的显隐状态 (完全依赖 CSS 的 .active)
    modal.querySelectorAll(".modal-tab-content").forEach((content) => {
      content.classList.remove("active");
    });
    const activeContent = modal.querySelector(`#theater-tab-${tabName}`);
    if (activeContent) activeContent.classList.add("active");

    // 3. 切换背景图 (保留原本的设定，清理了冗余的 !important)
    const modalContent = modal.querySelector(".theater-modal-content");
    if (modalContent) {
      const bgUrl = tabName === "arena"
        ? "https://i.postimg.cc/7L5j8pzG/6.png"
        : "https://i.postimg.cc/76BNrNdx/ju-chang2.png";

      modalContent.style.background = `linear-gradient(rgba(var(--rgb-bg-dark, 20,20,20), 0.8), rgba(var(--rgb-bg-dark, 20,20,20), 0.8)), url(${bgUrl}) center / cover no-repeat`;
    }
  } catch (error) {
    console.error("switchTheaterTab报错：", error);
  }
},

// 重构：点数详情页（装备重铸台）
renderPointsTab(selectedItemName = null) {
  const container = document.getElementById("theater-tab-points");
  if (!container) return;


  // 1. 核心修复：捕获重渲染前的滚动位置
  const savedContainerScroll = container.scrollTop || 0;

  // 获取 Inventory 的滚动位置
  const inventoryListEl = container.querySelector('.decom-inventory');
  const savedListScroll = inventoryListEl ? inventoryListEl.scrollTop : 0;

  // --- 新增：获取 Altar 的滚动位置 ---
  const altarEl = container.querySelector('.decom-altar');
  const savedAltarScroll = altarEl ? altarEl.scrollTop : 0;

  // 1. 状态保持逻辑：如果没有传入新的选中项，则使用历史选中的项
  if (selectedItemName) {
    this.currentSelectedReforgeItem = selectedItemName;
  }
  const currentSelected = this.currentSelectedReforgeItem;

  this.syncTheaterPoints();
  const inventoryItems = this._getInventoryEquipments();

  // 获取选中的装备数据（若被销毁或不存在，则自动清空状态）
  let selectedItem = inventoryItems.find(item => item.名称 === currentSelected) || null;
  if (!selectedItem) this.currentSelectedReforgeItem = null;

  // 2. 内部工具函数：完全复用物品栏的名称、序列、特质格式化逻辑
  const formatItemDisplay = (item) => {
    const rawName = this.SafeGetValue(item, ["名称", "name"], "未知物品");
    const tier = this.SafeGetValue(item, ["等阶", "品阶", "tier", "序列", "sequence"], "无");
    const formattedTier = tier !== "无" && !isNaN(tier) ? `序列${tier}` : tier;
    const tierClass = this.getTierClass(formattedTier);

    const traitRaw = this.SafeGetValue(item, ["特质", "trait", "特性"], "");
    const invalidTraits = ["", "空", "无", "none", "null", "undefined"];
    const hasValidTrait = traitRaw && !invalidTraits.includes(String(traitRaw).trim());

    let displayName = rawName;
    if (hasValidTrait) {
      if (!displayName.includes(traitRaw)) {
        displayName = `<span class="${tierClass}">${traitRaw}</span> · ${rawName}`;
      } else {
        displayName = displayName.replace(traitRaw, `<span class="${tierClass}">${traitRaw}</span>`);
      }
    }

    return { rawName, displayName, formattedTier, tierClass, traitRaw, hasValidTrait };
  };

  // 3. 左侧：装备列表渲染
  let inventoryHtml = inventoryItems.length > 0 ? "" : '<p class="modal-placeholder">背包中没有可重铸的装备。</p>';

  inventoryItems.forEach((item) => {
    const { rawName, displayName, tierClass } = formatItemDisplay(item);
    const isEquipped = item.isEquipped;
    const isSelected = currentSelected === rawName;

    const equippedStyle = isEquipped ? "filter: grayscale(1) opacity(0.6);" : "";
    const activeStyle = isSelected ? "border: 1px solid var(--color-primary); background: rgba(var(--rgb-primary), 0.1);" : "border: 1px solid transparent;";

    inventoryHtml += `
      <div class="decom-inventory-item ${isEquipped ? 'equipped-item' : ''}"
          data-name="${rawName}"
          data-category="${item.sourceCategory}"
          style="${equippedStyle} ${activeStyle} padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; transition: all 0.2s; cursor: pointer;">
          <div class="decom-item-name-wrapper" style="display: flex; align-items: center; gap: 4px;">
            <span class="decom-item-name ${tierClass}" style="${isEquipped ? 'text-decoration: line-through; opacity: 0.8;' : ''}">
              ${displayName}
            </span>
            ${isEquipped ? ' <span style="font-size: 0.8em; color: var(--text-muted); white-space: nowrap;">(已装备)</span>' : ''}
          </div>
      </div>
    `;
  });

  // 4. 右侧：操作面板渲染
  let rightPanelHtml = `<div class="modal-placeholder" style="height:100%; display:flex; align-items:center; justify-content:center;">请在左侧选择要重铸的装备</div>`;

  if (selectedItem) {
    // 调用格式化拿颜色类
    const { rawName, displayName, formattedTier, tierClass, traitRaw, hasValidTrait } = formatItemDisplay(selectedItem);

    const statsStr = ['活力', '灵性', '理智', '人性', '敏捷', '运气']
      .map(attr => `${attr}: ${selectedItem[attr] || 0}`)
      .join(' | ');

    // 复用物品栏的序列小方块标签
    const tierTagHtml = formattedTier !== "无"
      ? `<span class="item-tag tier-tag-box" style="margin-left: 8px;"><strong class="${tierClass}">${formattedTier}</strong></span>`
      : "";

    rightPanelHtml = `
      <div style="display:flex; flex-direction:column; gap:15px; width: 100%;">
        <h3 class="${tierClass}" style="margin:0; font-size:var(--text-lg); display: inline-block; vertical-align: middle;">
          ${displayName}
        </h3>
        <div class="modal-sub-text" style="background: rgba(var(--rgb-bg-dark), 0.5); padding: 12px; border-radius: 6px; border: 1px solid rgba(var(--rgb-primary), 0.2);">
          <p style="margin-bottom: 8px; display: flex; align-items: center;">序列: ${tierTagHtml}</p>
          <p style="margin-bottom: 8px;">特质: <strong class="${hasValidTrait ? tierClass : ''}" style="${!hasValidTrait ? 'color: var(--text-muted)' : ''}">${hasValidTrait ? traitRaw : '无'}</strong></p>
          <p style="margin-bottom: 0;">属性: ${statsStr}</p>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px; margin-top: 5px;">
          <button class="interaction-btn btn-reforge" data-action="reroll_stats" data-name="${rawName}" data-category="${selectedItem.sourceCategory}">
            刷新属性 (消耗: ${this.calculateReforgeCost(selectedItem, 'reroll_stats')})
          </button>
          ${!hasValidTrait ? `
            <button class="interaction-btn btn-reforge" data-action="add_trait" data-name="${rawName}" data-category="${selectedItem.sourceCategory}">
              赋予特质 (消耗: ${this.calculateReforgeCost(selectedItem, 'add_trait')})
            </button>
          ` : `
            <button class="interaction-btn btn-reforge" data-action="reroll_trait" data-name="${rawName}" data-category="${selectedItem.sourceCategory}">
              重塑特质 (消耗: ${this.calculateReforgeCost(selectedItem, 'reroll_trait')})
            </button>
            <button class="interaction-btn btn-reforge warn-btn" data-action="remove_trait" data-name="${rawName}" data-category="${selectedItem.sourceCategory}">
              洗去特质 (消耗: ${this.calculateReforgeCost(selectedItem, 'remove_trait')})
            </button>
          `}
        </div>
      </div>
    `;
  }

  container.innerHTML = /* HTML */ `
    <div class="decomposition-container" style="display:flex; flex-direction:row; gap:24px; width:100%; height: 100%;">
      <div class="decom-inventory" style="flex:1; overflow-y:auto; padding-right: 10px;">
        <div class="modal-prompt-text" style="margin-bottom: 12px; font-weight: bold;">可重铸装备</div>
        <div id="reforge-inventory-list">${inventoryHtml}</div>
      </div>
      <div class="decom-altar" style="flex:1; padding: 20px; background: rgba(var(--rgb-bg-dark), 0.6); border-radius: 8px; border: 1px solid var(--color-ui-border);">
        ${rightPanelHtml}
      </div>
    </div>
  `;

  this._bindReforgeEvents(inventoryItems);

  // 3. 核心修复：DOM 更新后，立即恢复滚动位置
  requestAnimationFrame(() => {
    // 恢复主容器
    container.scrollTop = savedContainerScroll;

    // 恢复 Inventory
    const newInventoryListEl = container.querySelector('.decom-inventory');
    if (newInventoryListEl) {
      newInventoryListEl.scrollTop = savedListScroll;
    }

    // --- 新增：恢复 Altar ---
    const newAltarEl = container.querySelector('.decom-altar');
    if (newAltarEl) {
      newAltarEl.scrollTop = savedAltarScroll;
    }
  });
},

// 5. 新增角斗场界面（点数管理功能）
renderArenaTab() {
  const container = document.getElementById("theater-tab-arena");
  if (!container) return;

  // 复用了通用的 flex 和文本样式
  container.innerHTML = /* HTML */ `
    <div class="theater-tab-body">
      <p class="modal-prompt-text" style="text-align: center; font-size: var(--text-lg); max-width: 80%;">
        角斗场招募各世界的斗士参与决斗，胜者可获得丰厚奖励
      </p>
      <button id="btn-enter-arena" class="interaction-btn">
        咨询角斗场工作人员
      </button>
    </div>
  `;

  const enterBtn = container.querySelector("#btn-enter-arena");
  enterBtn.addEventListener("click", async () => {
    if (this.isBusy) {
      this.showTemporaryMessage("正在处理上一条指令，请稍候...");
      return;
    }
    await this.handleAction("寻找角斗场工作人员", false);
    this.showTemporaryMessage("正在寻找角斗场工作人员……");
  });
},

// 1. 获取纯净的装备列表（排除杂物、消耗品等）
_getInventoryEquipments() {
  const allItems = [];
  if (!this.currentMvuState || !this.currentMvuState.stat_data) return [];
  const stat_data = this.currentMvuState.stat_data;

  // 只取这四个有六维属性和特质的分类
  const equipCategories = ["武器列表", "衣物列表", "饰品列表", "封印物列表"];

  equipCategories.forEach((categoryKey) => {
    const itemsObj = this.SafeGetValue(stat_data, categoryKey, {});
    Object.values(itemsObj).forEach((item) => {
      if (item && typeof item === "object" && (item.名称 || item.name)) {
        // 拷贝并打上来源标签，方便覆写时找准位置
        allItems.push({ ...item, sourceCategory: categoryKey });
      }
    });
  });
  return allItems;
},

// 2. 计算重铸消耗
calculateReforgeCost(item, actionType) {
  const seqRank = parseItemSequenceRank(item.序列);
  const baseValue = getSequenceBaseValue(seqRank);

  // 基础点数：利用开方并乘以系数，将几十万的基数值压缩到合理的剧场点数区间 (例如：序列9约10点，序列0约500多点)
  const baseCost = Math.max(10, Math.floor(Math.sqrt(baseValue) * 0.5));

  const multipliers = {
    "reroll_stats": 1.0,  // 刷属性
    "add_trait": 3.0,     // 无中生有上特质
    "reroll_trait": 2.0,  // 洗掉旧的换新的
    "remove_trait": 0.5   // 强行洗掉特质
  };

  return Math.floor(baseCost * (multipliers[actionType] || 1.0));
},

// 3. 暴力覆写快照核心逻辑（完全遵循 equipItem 寻址逻辑）
async _forceUpdateEquipmentInSnapshot(categoryListKey, itemName, newStats) {
  // categoryListKey 应该是 "武器列表"、"衣物列表" 等具体的键名
  let itemFound = false;

  // 1. 🔪 暴力覆写当前内存（跟 equipItem 一模一样）
  if (this.currentMvuState?.stat_data) {
    const rawItemsDict = this.currentMvuState.stat_data[categoryListKey] || {};
    // 严格按照【名称】在内存中寻找真实的键名（Key）
    const realItemKey = Object.keys(rawItemsDict).find(k => rawItemsDict[k].名称 === itemName);

    if (realItemKey) {
      Object.assign(rawItemsDict[realItemKey], newStats); // 直接修改内存本体
      itemFound = true;
    } else {
      console.warn(`[装备重铸] 内存 ${categoryListKey} 中找不到物品 ${itemName}`);
    }
  }

  // 2. 🔪 暴力覆写最新快照
  const index = this.chatHistoryCache.length - 1;
  const targetSnapshot = this.chatHistoryCache[index];

  if (targetSnapshot?.data?.stat_data) {
    const snapItemsDict = targetSnapshot.data.stat_data[categoryListKey] || {};
    const snapItemKey = Object.keys(snapItemsDict).find(k => snapItemsDict[k].名称 === itemName);

    if (snapItemKey) {
      Object.assign(snapItemsDict[snapItemKey], newStats); // 直接修改快照本体
      itemFound = true;
    } else {
       console.warn(`[装备重铸] 快照 ${categoryListKey} 中找不到物品 ${itemName}`);
    }
  }

  if (!itemFound) {
    console.error(`❌ [装备重铸] 内存和快照中均未找到 ${itemName}，写入中止！`);
    return;
  }

  // 3. 💣 摧毁渲染拦截器的 Hash，强制UI依据新数据重绘！
  this._lastProcessedStatHash = "";

  // 4. 💾 暴力落盘保存，并刷新 UI
  try {
    await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
    console.log(`✅ [装备重铸] ${itemName} 的新属性已成功写入内存与快照，并完成落盘！`);

    // 既然数据彻底改好了，顺手调一次更新让页面立刻显现新数值
    this.updateDisplayedAttributes();
  } catch (e) {
    console.error("❌ [装备重铸] 存档写入失败:", e);
  }
},

// 绑定重铸界面的交互事件
_bindReforgeEvents(inventoryItems) {
  const listEl = document.getElementById("reforge-inventory-list");
  const container = document.getElementById("theater-tab-points");

  // 1. 左侧列表点击事件
  if (listEl) {
    listEl.addEventListener("click", (e) => {
      const itemEl = e.target.closest(".decom-inventory-item");
      if (!itemEl) return;

      const itemName = itemEl.dataset.name;
      const isEquipped = itemEl.classList.contains("equipped-item");

      if (isEquipped) {
        // 如果已装备，提示卸下。使用你提供的修复版 unequipItem 逻辑，推导 slotId
        const itemData = inventoryItems.find(i => i.名称 === itemName);
        if(itemData) {
          this.showConfirmModal(`【${itemName}】当前正在使用中，是否将其卸下以进行重铸？`, () => {
            const categoryToSlot = {
              "武器列表": "equip-wuqi",
              "衣物列表": "equip-yiwu",
              "饰品列表": "equip-shipin",
              "封印物列表": "equip-fengyinwu"
            };
            const slotId = categoryToSlot[itemData.sourceCategory];
            if(slotId) {
              // 调用你修好的 unequipItem，传参让其不要自动刷新大背包，而是我们手动刷新重铸页
              this.unequipItem(slotId, null, true, false);
              this.renderPointsTab(itemName); // 卸下后保持选中状态重新渲染
            }
          });
        }
        return;
      }

      // 未装备，直接渲染右侧
      this.renderPointsTab(itemName);
    });
  }

  // 2. 右侧按钮点击事件
  container.querySelectorAll(".btn-reforge").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if (this.isBusy) {
        this.showTemporaryMessage("正在处理，请稍候...");
        return;
      }

      const action = btn.dataset.action;
      const itemName = btn.dataset.name;
      const category = btn.dataset.category;
      const itemData = inventoryItems.find(i => i.名称 === itemName);

      if (!itemData) return;

      const cost = this.calculateReforgeCost(itemData, action);
      if (this.theaterState.theaterPoints < cost) {
        this.showTemporaryMessage(`点数不足！需要 ${cost} 点剧场点数。`);
        return;
      }

      // 扣除点数并同步
      this.currentMvuState.stat_data["剧场点数"] -= cost;
      this.syncTheaterPoints();

      // 核心计算逻辑：绕过 Zod，手动调用 generateItemStats
      this.showTemporaryMessage("正在重塑现实结构的权重...");

      const seqRank = parseItemSequenceRank(itemData.序列);
      const baseValue = getSequenceBaseValue(seqRank);
      let targetTrait = itemData.特质 || "";

      if (action === "remove_trait") {
        targetTrait = "";
      } else if (action === "add_trait" || action === "reroll_trait") {
        const traitNames = Object.keys(GameDBManager.DB.traitDB).filter(k => k !== "空");
        targetTrait = traitNames[Math.floor(Math.random() * traitNames.length)];
      }

      // 调用分配模型重新计算六维
      const newStatsObj = generateItemStats(
        baseValue,
        itemData.类型 || '',
        itemData.名称 || '',
        itemData.途径 || '',
        targetTrait
      );

      // 组装要覆写的属性片段
      const updatePayload = {
        特质: targetTrait,
        活力: newStatsObj.活力,
        灵性: newStatsObj.灵性,
        理智: newStatsObj.理智,
        人性: newStatsObj.人性,
        敏捷: newStatsObj.敏捷,
        运气: newStatsObj.运气
      };

      // 直接暴破写入快照
      await this._forceUpdateEquipmentInSnapshot(category, itemName, updatePayload);

      this.showTemporaryMessage(`重铸成功！消耗了 ${cost} 点数。`);

      // 重新渲染UI，保留当前选中状态
      this.renderPointsTab(itemName);
    });
  });
},


//=========================
//======诡秘剧场结束=========


