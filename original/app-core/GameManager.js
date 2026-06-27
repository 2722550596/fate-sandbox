// 文件: GameManager.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L17978-22141: // ========================================== ---

// ==========================================
// === [核心调度与生命周期] CORE & LIFECYCLE ===
// ==========================================
// 职责：初始化、截留/生成回复、验证生成内容、变量编辑器、底层工具函数

//==============================================
//初始化开始 (重构优化版)
//==============================================
//初始化，已重构，仅需在主Schema使用zod声明变量即可
async readInitVarData() {
  const bookName = WorldbookManager.PRIMARY_BOOK;
  const targetComment = "[InitVar]";

  // 1. 尝试从世界书中读取初始自定义数据
  let rawData = {}; // 默认准备一个空对象
  try {
    const allEntries =
      await TavernHelper.getLorebookEntries(bookName);
    const targetEntry = allEntries.find(
      (entry) => entry.comment === targetComment,
    );

    if (targetEntry && targetEntry.content.trim()) {
      rawData = JSON.parse(targetEntry.content.trim());
    } else {
      console.warn(
        `[动态数据] 未找到“${targetComment}”条目或内容为空，将直接生成全新初始数据。`,
      );
    }
  } catch (e) {
    console.error(
      `[动态数据] 读取或解析“${targetComment}”失败，将直接生成全新初始数据:`,
      e,
    );
    // rawData 保持为 {}
  }

  // 2. 核心优化：让 Zod Schema 掌权接管！
  try {
    // 🌟 拦截点：先翻译，再交给 Zod 接管！
    const translatedData = typeof translateEnKeysToCn === 'function' ? translateEnKeysToCn(rawData) : rawData;
    const validatedData = window.statDataSchema.parse(translatedData);

    console.log(
      `[readInitVarData] Schema 校验通过，新周目返回数据:`,
      validatedData,
    );
    return validatedData;
  } catch (validationError) {
    // 极端异常兜底：如果读取的 JSON 数据严重破坏导致 parse 报错
    console.error(
      "[动态数据] Schema 校验严重失败！尝试强制生成纯净初始数据:",
      validationError,
    );

    try {
      // 强行塞入一个空对象，让 Schema 根据配置从零生成一份绝对安全的默认数据
      return window.statDataSchema.parse({});
    } catch (fatalError) {
      console.error(
        "[动态数据] 致命错误：Schema 自身配置存在问题导致无法生成默认数据！",
        fatalError,
      );
      throw fatalError;
    }
  }
},

// ==========================================
// 数据结构分裂升级器 (Pre-Migration Hook)
// ==========================================
_upgradeStateForNpcSplit(mvuState) {
  if (!mvuState) return false;
  
  let hasChanged = false; // 追踪是否发生过数据迁移

  // 确保新数据池存在
  if (!mvuState.npc_data) {
    mvuState.npc_data = {};
    hasChanged = true;
  }
  if (migrateCurrentTimeEraDomain(mvuState)) {
    hasChanged = true;
  }

  // 💡 新增：世界纪元数据迁移 (World Data Migration)
  // 如果 world_data 里的纪元为空，尝试从 stat_data 恢复
  const oldEra = mvuState.stat_data?.当前时间纪元;
  const newEra = mvuState.world_data.当前时间纪元;

  if (oldEra && (!newEra || newEra === "" || newEra === "未知")) {
    console.log(`[数据架构升级] 正在同步世界纪元: ${oldEra}`);
    mvuState.world_data.当前时间纪元 = oldEra;
    hasChanged = true;
  }

  if (mvuState.stat_data && mvuState.stat_data.人物关系列表) {
    const relations = mvuState.stat_data.人物关系列表;
    
    for (const [npcKey, oldNpcData] of Object.entries(relations)) {
      if (npcKey === '$meta') continue;

      // 💡 修复核心 1：强行用键名补全缺失的“名称”，防止被洗成未知
      if (!oldNpcData.名称 || oldNpcData.名称 === '未知' || oldNpcData.名称 === '') {
        oldNpcData.名称 = npcKey; 
        hasChanged = true;
      }

      // 如果 npc_data 中还没有这个 NPC 的真名记录，执行分裂！
      if (!mvuState.npc_data[npcKey]) {
        console.log(`[数据架构升级] 正在分离 NPC [${npcKey}] 的主客观数据...`);
        mvuState.npc_data[npcKey] = _.cloneDeep(oldNpcData);
        hasChanged = true; // 标记发生了深拷贝
      }
    }
  }
  
  return hasChanged; // 将修改状态返回给外部
},

// ==========================================
// === [事件监听与轮询] 独立模块 ===
// ==========================================
// ST聊天更新拦截器 
async _onSillyTavernChatUpdated(_, retryCount = 0) {
  const MAX_RETRY = 5;
  const RETRY_DELAY = 100;

  const isStatDataReady = !!this.currentMvuState?.stat_data;
  const isInitProcessDone = window.GameInitState === "READY";

  if (isStatDataReady && isInitProcessDone) {
    console.log("[CHAT_UPDATED] ✅ stat_data已就绪，执行变量更新");
    try {
      await this.updateDynamicData(this.isStatInitialized);
    } catch (updateErr) {
      console.error("[CHAT_UPDATED] 更新变量失败:", updateErr);
      this.showTemporaryMessage("变量同步失败，可重试一次");
    }
    return;
  }

  if (retryCount < MAX_RETRY) {
    console.log(`[CHAT_UPDATED] ⏳ stat_data未就绪（重试${retryCount + 1}/${MAX_RETRY}），${RETRY_DELAY}ms后再试`);
    setTimeout(() => this._onSillyTavernChatUpdated(_, retryCount + 1), RETRY_DELAY);
    return;
  }

  console.warn("[CHAT_UPDATED] ⚠️ 重试5次后stat_data仍未就绪，可能初始化异常");
  this.showTemporaryMessage("变量初始化稍慢，可点击界面空白处触发同步，或刷新页面重试");
},
// 绑定所有核心流式/更新事件
_bindGlobalGameEvents() {
  const eventsToBind = [
    { name: 'STREAM_TOKEN', const: iframe_events?.STREAM_TOKEN_RECEIVED_FULLY, handler: (text) => this.handleStreamUpdate(text) },
    { name: 'GEN_ENDED', const: iframe_events?.GENERATION_ENDED, handler: (text) => this.handleStreamEnd(text) },
    { name: 'CHAT_UPDATED', const: tavern_events?.CHAT_UPDATED, handler: (e) => this._onSillyTavernChatUpdated(e) }
  ];

  eventsToBind.forEach(ev => {
    if (ev.const) {
      this.eventRemovers.push(eventOn(ev.const, ev.handler));
    } else {
      console.warn(`[源堡-事件] 关键事件常量 [${ev.name}] 未定义，跳过绑定。请检查 Tavern API 版本。`);
    }
  });
},
// ==========================================
// 界面同步管道：只负责将数据推送到 UI
// ==========================================
async updateDynamicData(isInitialized) {
  console.log(`%c[TRACE-UPDATE] >>>>> 开始执行 UI 同步流`, "color: lime; font-weight: bold;");
  
  // 兜底保护，但不再执行重量级初始化
  if (!this.currentMvuState) this.currentMvuState = { stat_data: {}, world_data: {} };

  try {
    const messages = await getChatMessages(getCurrentMessageId());

    if (messages && messages.length > 0) {
      const currentMsg = messages[0];
      this.latestAiMessage = currentMsg.message || ""; 

      // 同步管道：消息快照中的数据优先 -> 其次才是实例内存数据
      if (currentMsg.data?.stat_data) {
        this.currentMvuState.stat_data = currentMsg.data.stat_data;
      }
    }

    // 将最终确定的状态推送到渲染层
    if (this.currentMvuState.stat_data) {
      this.renderUI(this.currentMvuState.stat_data);

      await this.loadAndDisplayCurrentScene();
    }

  } catch (error) {
    console.error("[动态数据同步] 管道发生阻塞:", error);
    // 即使报错，也尝试用内存里现有的数据硬刷新一下UI
    if (this.currentMvuState?.stat_data) {
      this.renderUI(this.currentMvuState.stat_data);
    }
  }

  console.log(`%c[TRACE-UPDATE] <<<<< UI 同步流执行完毕`, "color: lime; font-weight: bold;");
},
// ==========================================
// === [状态水合与开局] 独立模块 ===
// ==========================================
// 初始化探针：判断是否为致命的“初盘空壳”
isInvalidZeroData(statData, isTrueNewGame) {
  // 基础防雷：如果连对象都不是，或者还没经过Zod水合，直接判死
  if (!statData || typeof statData !== "object") return true;

  const coreFields = ["基础活力", "基础灵性", "基础理智", "基础人性", "基础敏捷", "基础运气"];
  
  // 检查是否这6个核心基底全都是 0
  const isCoreAllZero = coreFields.every((field) => {
    const value = Number(statData[field]);
    return !isNaN(value) && value === 0;
  });

  // 业务逻辑分支
  if (isCoreAllZero) {
    if (isTrueNewGame) {
      console.log("[数据业务判定] 新游戏且基础属性全0 → 存档损坏或未初始化，需要重置");
      return true;
    } else {
      console.log("[数据业务判定] 非新游戏且基础属性全0 → 角色处于死亡/濒死状态（合法）");
      return false;
    }
  }

  return false;
},
// 处理新游戏的初始快照与第一回合
async _setupNewGameFirstSnapshot() {
  console.warn("[源堡 - Init] 新游戏：生成初始快照...");
  const actualAiMessage = this.latestAiMessage || "新周目初始快照";
  
  const initSnapshot = {
    message_id: `frontend-hist-init-${Date.now()}`,
    message: actualAiMessage,
    is_user: false,
    role: "assistant",
    data: _.cloneDeep(this.currentMvuState),
    timestamp: Date.now(),
  };

  this.chatHistoryCache.push(initSnapshot);
  this.historyViewIndex = this.chatHistoryCache.length - 1;
  await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
  
  if (actualAiMessage) {
    console.log("[开局初始化] 手动调用processValidResponse处理初始AI指令");
    // 【复用红利】：由于 processValidResponse 已被我们解耦，这里直接调用非常安全
    await this.processValidResponse(actualAiMessage); 
    this.isStatInitialized = true;
    this.isTrueNewGame = false;
  }
},
// --- 优化后的惰性加载队列 ---
_lazyLoadNonCriticalAssets() {
  // 组 1：视觉与排版强相关（强烈建议：这部分其实应该放在 init 的早期，但如果你必须放这里，用 requestAnimationFrame 减少闪烁感，并全量并发）
  requestAnimationFrame(() => {
    Promise.all([
      this.loadViewMode(),
      this.loadDimensions(),
      this.loadFontSize(),
      this.loadFont(),
      this.loadBackgrounds(),
      this.loadThemeState()
    ]).catch(err => console.error("[源堡-视觉加载] 异常:", err));
  });

  // 组 2：纯后台业务开关/设置（真正的非关键资产），让浏览器在空闲时去并发加载，绝不抢占主线程
  const loadBackgroundSettings = async () => {
    try {
      // 放弃 await 瀑布流，直接 11 个任务同时起跑
      await Promise.all([
        this.loadNovelModeState(),

        this.loadStreamingState(),
        this.loadEnterToSendState(),
        this.loadAutoToggleState(),
        this.loadFullScreenLoadingState(),
        this.loadRecentEventsCount(),
        this.loadCompanionLimitSettings(),
        this.loadDigestionMaxDelta(),
        this.loadPeriodicBackupSettings(),
        this.loadPanelState(),
        this.loadVariableAISettings(),
      ]);
      console.log("%c[源堡-空闲加载] 所有后台配置已并发装载完毕", "color: #00ff00");
    } catch (err) {
      console.error("[源堡-空闲加载] 异常:", err);
    }
  };

  // 核心魔法：使用 requestIdleCallback，只有当浏览器有空闲算力时才执行
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => loadBackgroundSettings(), { timeout: 5000 }); 
  } else {
    // 兼容老旧浏览器的兜底方案
    setTimeout(loadBackgroundSettings, 1500);
  }
},
// --- 真正的init初始化函数 (生产纯净版) ---
async init() {
  const initExecutionId = `init-${Date.now().toString().slice(-6)}`;
  console.log(`%c[源堡-Init] >>>>> START: ${initExecutionId}`, "color: var(--color-success)");

  // 1. 状态锁防抖 (环境准备)
  await (window._preWarmedDbPromise || AppStorage.ensureDbOpen());

  if (window.GameInitState && window.GameInitState !== "IDLE") {
    console.warn(`[源堡-Init] 阻止重复调用，当前状态: [${window.GameInitState}]`);
    return;
  }
  window.GameInitState = "INITIALIZING";
  this.eventRemovers = [];

  try {
    // 2. 基础环境迁移与静态绑定
    try { 
      await AppStorage.migrateFromLocalStorage(); 
    } catch (e) { 
      console.error("[迁移失败]", e); 
    }
    
    this.attributeConfig = GLOBAL_ATTR_CONFIG;
    this.bindStaticListeners();

    // 并发 I/O 任务
    const [promptData] = await Promise.all([
      AppStorage.loadData("last_sent_prompt", null),
      this.loadGachaState(),
    ]);

    this.lastSentPrompt = promptData;
    this.loadAnimationsState();
    this.loadConsoleState();

    // 3. 核心数据水合 (Hydration)
    await this.loadHistoryFromStorage();
    const lastSnapshot = this.chatHistoryCache[this.chatHistoryCache.length - 1];

    if (lastSnapshot?.data?.stat_data) {
      // 🌟 修复点：不再接收返回值覆写 data，只触发原地深拷贝/洗澡逻辑
      this._upgradeStateForNpcSplit(lastSnapshot.data);

      this.currentMvuState = validateAndMigrateStatData(lastSnapshot.data);
      this.isStatInitialized = true;
      
      if (this.isInvalidZeroData(this.currentMvuState.stat_data, false)) {
        this.currentMvuState.stat_data = await this.readInitVarData();
        migrateCurrentTimeEraDomain(this.currentMvuState, "第五纪1349年6月28日 星期一 7:00");
        lastSnapshot.data.stat_data = _.cloneDeep(this.currentMvuState.stat_data);
        lastSnapshot.data.world_data = _.cloneDeep(this.currentMvuState.world_data);
        await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
      }
    } else {
      this.isStatInitialized = false;
    }

    // 4. 动态数据更新与新游戏判定
    await this.updateDynamicData(this.isStatInitialized);
    this.isTrueNewGame = this.chatHistoryCache.length === 0 || !lastSnapshot?.data?.stat_data;
    await this.loadEquipmentState();

    // 5. 分支处理：新游戏生成首帧 vs 旧游戏恢复
    if (this.isTrueNewGame && this.currentMvuState) {
      await this._setupNewGameFirstSnapshot();
    } else {
      console.log("[INIT] 恢复历史状态完成");
    }

    // 6. 核心UI挂载与事件绑定
    // 强制让出主线程，让浏览器完成一次重绘，确保 UI 响应顺滑
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))); 

    await this.loadPendingActions();
    await this.loadUnifiedIndex();

    this.renderHistoryControls();
    this._bindGlobalGameEvents(); 
    this._lazyLoadNonCriticalAssets(); 
    this.initQuickShortcutsUI();
    this.loadQuickShortcuts();
    this.initRandomEventsUI();
    this.loadRandomEntries();
    this.initImmersiveInput();
    this.loadMemorySplitSettings();

    // 🔒 预加载变量可见性配置（数据备份系统）
    try {
      this.aiContextConfig = await GameDBManager.loadAIContextConfig();
      console.log("[初始化] 变量可见性配置已加载");
    } catch (configErr) {
      console.warn("[初始化] 变量可见性配置加载失败，使用默认配置", configErr);
      this.aiContextConfig = null; // 将在 loadAIContextConfigSync 中使用默认配置
    }

    // 7. 初始化悬浮编辑器 & 标记完成
    if (this.currentMvuState?.stat_data) {
      window.GameInitState = "READY";
      
      try {
        await this.loadFloatingEditorState();
        // 在渲染 UI 之前把三个开关数据读出来
        await this.loadAiContextConfigState();
        await this.loadVariablePanelToggleState();
        await this.loadBattleFloatingBtnState();
        floatingEditorInstance = new FloatingVariableEditor(this);
        window.floatingEditorInstance = floatingEditorInstance;
        floatingEditorInstance.init();
        if (!this.isFloatingEditorEnabled) floatingEditorInstance.setEnabled(false);
      } catch (editorErr) {
        console.warn("[源堡-Init] 悬浮编辑器初始化失败:", editorErr);
      }
      
      // 7.5. 初始化AI上下文配置UI
      try {
        aiContextConfigUIInstance = new AIContextConfigUI(this);
        window.aiContextConfigUIInstance = aiContextConfigUIInstance;
        aiContextConfigUIInstance.init();
        console.log('[源堡-Init] AI上下文配置UI初始化完成');
      } catch (configUIErr) {
        console.warn("[源堡-Init] AI上下文配置UI初始化失败:", configUIErr);
      }

      // 7.6. 初始化变量面板悬浮按钮
      try {
        this.initVariablePanelToggle();
        console.log('[源堡-Init] 变量面板悬浮按钮初始化完成');
      } catch (vpErr) {
        console.warn("[源堡-Init] 变量面板悬浮按钮初始化失败:", vpErr);
      }
      
      // 8. 初始化战斗系统
      try {
        if (typeof BattleUI !== 'undefined') {
          this.battleUI = new BattleUI();
          this.battleUI.game = this; // 保存GameManager引用
          this.battleUI.initialize(this.currentMvuState);
          window.battleUI = this.battleUI;
          console.log('[源堡-Init] 战斗系统初始化完成');
        }
        
        // 初始化后根据开关状态隐藏对应按钮
        const lockBtn = document.getElementById('ai-context-config-toggle');
        if (lockBtn) lockBtn.style.display = this.isAiContextConfigEnabled ? 'flex' : 'none';
        
        const varFixBtn = document.getElementById('variable-panel-toggle');
        if (varFixBtn) varFixBtn.style.display = this.isVariablePanelToggleEnabled ? 'flex' : 'none';
        
        const battleBtn = document.getElementById('battle-floating-btn');
        if (battleBtn) battleBtn.style.display = this.isBattleFloatingBtnEnabled ? '' : 'none';
      } catch (battleErr) {
        console.warn("[源堡-Init] 战斗系统初始化失败:", battleErr);
      }
    } else {
      throw new Error("stat_data未能成功加载");
    }

  } catch (error) {
    window.GameInitState = "ERROR";
    console.error("[源堡-Init] 初始化过程异常:", error);
    this.showTemporaryMessage("初始化异常：核心数据未加载，建议刷新页面");
  } finally {
    if (window.GameInitState === "INITIALIZING") window.GameInitState = "ERROR";
    console.log(`%c[源堡-Init] <<<<< END: ${initExecutionId}`, "color: var(--color-success)");
  }
},
// 结束ling
cleanup() {
  console.log("[源堡] 执行清理程序，卸载定时器和监听器,解锁...");
  // 停止所有轮询任务
  localStorage.removeItem(GLOBAL_LOCK_KEY);
  this.stopAutoTogglePolling();

  // 移除所有通过 eventOn 绑定的全局事件监听器
  if (this.eventRemovers && this.eventRemovers.length > 0) {
    this.eventRemovers.forEach((remove) => remove());
    this.eventRemovers = [];
    console.log("[源堡] 已移除全局事件监听器。");
  }

  // 移除绑定到 window 对象的监听器
  if (this._resizeHandler) {
    window.removeEventListener("resize", this._resizeHandler);
    this._resizeHandler = null;
    console.log("[源堡] 已移除窗口大小监听器。");
  }

  // 【核心修复】手动切断对大型对象的引用，辅助垃圾回收
  this.chatHistoryCache = null;
  this.currentMvuState = null;
  this.gachaState = null;
  this.gachaCollection = null;
  this.gachaHistory = null;
  this.pendingActions = null;
  this.theaterState = null; // 新增：释放剧场状态引用

  //快捷指令
  console.log("[源堡] 已切断对主要数据对象的引用。");

  this.listenersBound = false;
},

//========最终回复生成/抛出=========
//地图
_assembleMapContext(stat_data) {
  if (!stat_data) return { mapOverview: "", spatialContextBlock: "" };

  // 🌟 从全局 DB 安全获取数据
  const mapData = GameDBManager.DB.mapData;
  if (!mapData || !mapData.mainRegions || !mapData.landmarks) {
    return { mapOverview: "<地图地理总览>数据加载中...</地图地理总览>", spatialContextBlock: "" };
  }

  // 1. 提取区域中心坐标
  const regionWithCenter = mapData.mainRegions.map((region) => {
    const xs = region.points.outer.map((p) => p.x);
    const ys = region.points.outer.map((p) => p.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    return `${region.name}（中心坐标：(${centerX.toFixed(2)}, ${centerY.toFixed(2)})）`;
  });

  // 2. 提取地标精确坐标
  const landmarkWithCoord = mapData.landmarks.map((landmark) => {
    const landX = parseFloat(landmark.marker.left);
    const landY = parseFloat(landmark.marker.top) * (this.Y_SCALE || 1); // 兼容缩放
    return `${landmark.name}（坐标：(${landX.toFixed(2)}, ${landY.toFixed(2)})，属于${landmark.mainRegionName}）`;
  });

  const mapOverview = `
  <地图地理总览>
  - 大型区域（含中心坐标）：${regionWithCenter.join("、")}（神弃之地与西大陆为与世隔绝状态）
  - 知名地标：${landmarkWithCoord.join("、")}
  - 地理规则：区域间移动需符合地理逻辑（如南北大陆隔狂暴海相望，正常情况下需要坐船等交通工具），移动消耗的时间得正确更新，没有使用超凡手段下从一个城市移动到另一个城市应该经过漫长时间
  </地图地理总览>`;

  // 3. 玩家位置与面积计算
  const playerLocation = {
    区域: stat_data["当前区域"] || "未知",
    地标: stat_data["当前地标"] || "未知",
    坐标: stat_data["当前坐标"] || { x: 50.0, y: 50.0 },
  };

  let areaString = "未知";
  const playerRegion = mapData.mainRegions.find(
    (r) => r.name === playerLocation.区域 || r.name === playerLocation.地标
  );
  if (playerRegion) {
    const regionArea = MapEarthTool.calculatePolygonArea(playerRegion.points);
    areaString = `约 ${regionArea.toLocaleString()} km²`;
  }

  const spatialContextBlock = `
  <当前空间情景>
  【地图参考：本地图总宽度约为${MapEarthTool.EARTH_CONFIG.mapScaleKm}公里（与地球赤道周长一致）。坐标系为百分比制，(0,0)在左上角。如果有移动，请按照合理的数据继续修改，百分比小于百分之一的移动可忽略】
  - **玩家的位置**:
    - 区域: ${playerLocation.区域} / ${playerLocation.地标}
    - 坐标: (${playerLocation.坐标.x.toFixed(2)}, ${playerLocation.坐标.y.toFixed(2)})
    - 区域面积: ${areaString}
  </当前空间情景>`;

  return { mapOverview, spatialContextBlock };
},
// 本周目经历
async _assembleShortTermMemory() {
  let normalContext = "";
  let importantContext = "";

  try {
    const bookName = WorldbookManager.PRIMARY_BOOK;
    const index = this.unifiedIndex;
    const journeyKey = index > 1 ? `本周目经历(${index})` : "本周目经历";
    const allEntries = await TavernHelper.getLorebookEntries(bookName);
    
    const journeyEntry = allEntries.find((entry) => entry.comment === journeyKey);
    if (journeyEntry && journeyEntry.content) {
      const events = this.parseJourneyEntry(journeyEntry.content);
      if (events.length > 0) {
        // 配置你的截取数量（如果没有默认值，这里设为 3）
        const totalRecent = this.recentEventsCount || 10;
        const importantRecent = this.recentImportantEventsCount || 3; 

        const recentEvents = events.slice(-totalRecent);
        
        // 分割逻辑：找到最近的 importantRecent 条
        const splitIndex = Math.max(0, recentEvents.length - importantRecent);
        const normalEvents = recentEvents.slice(0, splitIndex);
        const importantEvents = recentEvents.slice(splitIndex);

        if (normalEvents.length > 0) {
          normalContext = `<近期发生的几件事(较早)>\n${this.reconstructJourneyEntry(normalEvents)}\n</近期发生的几件事(较早)>`;
        }
        
        if (importantEvents.length > 0) {
          importantContext = `<近期发生的几件事(最新)>\n${this.reconstructJourneyEntry(importantEvents)}\n</近期发生的几件事(最新)>`;
        }
      }
    }

    const cluesEntry = allEntries.find((entry) => entry.comment === "当前线索");
    if (cluesEntry && cluesEntry.content) {
      // 线索显然属于高度重要信息，丢入 importantContext
      importantContext += `\n\n<当前待办线索>\n${cluesEntry.content}\n</当前待办线索>`;
    }

  } catch (e) {
    console.error("[记忆系统] 提取短期记忆时出错:", e);
  }

  return { normal: normalContext, important: importantContext };
},
// 本周目核心记忆
async _assembleCoreMemory() {
  let coreMemoryPart = "";
  // 🌟 开关：你可以将它绑定到类的属性，或者配置文件中。这里预设为 true (需要被高强度 scan)
  const isCoreMemoryImportant = this.isCoreMemoryImportant ?? true; 

  try {
    const bookName = WorldbookManager.PRIMARY_BOOK;
    const allEntries = await TavernHelper.getLorebookEntries(bookName);
    const coreMemoryEntry = allEntries.find((entry) => entry.comment === "本周目核心记忆");

    if (coreMemoryEntry && coreMemoryEntry.content) {
      coreMemoryPart = `<核心剧情摘要>\n${coreMemoryEntry.content}\n</核心剧情摘要>`;
    }
  } catch (e) {
    console.error("[记忆系统] 提取核心记忆时出错:", e);
  }
  
  // 返回对象，以便外层的 _assembleContexts 进行分发
  return {
    content: coreMemoryPart,
    isImportant: isCoreMemoryImportant
  };
},
//人物档案
// 函数已禁用
async _assembleCharacterDossiers(stat_data, userMessage) {
  return "";

  let dossierText = "";
  try {
    const relationships = this.SafeGetValue(stat_data, "人物关系列表", {});
    const allCharacters = Object.entries(relationships).filter(
      ([name, details]) => name !== "$meta" && typeof details === "object"
    );

    const relevantCharacters = new Map();

    // 筛选1：重要人物
    allCharacters
      .filter(([_, details]) => details.isImportant === true)
      .forEach(([name, details]) => relevantCharacters.set(name, details));

    // 筛选2：对话中提及
    const lastAiResponse = (await getChatMessages("0"))?.[0]?.message || "";
    const textToScan = `${userMessage} ${this._getDisplayText(lastAiResponse)}`;
    allCharacters.forEach(([name, details]) => {
      if (textToScan.includes(name)) {
        relevantCharacters.set(name, details);
      }
    });

    if (relevantCharacters.size > 0) {
      dossierText = "[当前相关人物档案]\n";
      for (const [name, details] of relevantCharacters.entries()) {
        const relationship = this.SafeGetValue(details, "关系", "未知");
        const favorability = this.SafeGetValue(details, "好感度", "未知");
        // ✅ 修复后的代码
        const lastEventKey = details.事件历史 ? Object.keys(details.事件历史).sort().pop() : null;
        let lastEvent = "暂无记录";

        if (lastEventKey && details.事件历史[lastEventKey]) {
          const rawEvent = details.事件历史[lastEventKey];
          
          // 核心防御：如果是字符串直接用，如果是对象/数组则用你的工具函数强转为字符串
          const eventStr = typeof rawEvent === "string" 
            ? rawEvent 
            : this.formatObject(rawEvent); // 👈 完美利用了你之前写的 formatObject！

          lastEvent = eventStr.length > 150 
            ? eventStr.substring(0, 150) + "..." 
            : eventStr;
        }
        dossierText += `- ${name}: 关系(${relationship}), 好感度(${favorability}). 最新动态: ${lastEvent}\n`;
      }
    }
  } catch (e) {
    console.error("[记忆系统] 生成动态人物档案时出错:", e);
  }
  return dossierText;
},
//数值处理函数
// 函数已禁用
_createCurrentStatusBlock() {
  return "";

    if (!this.currentMvuState || !this.currentMvuState.stat_data) {
        return "";
    }
    const stat_data = this.currentMvuState.stat_data;
    let statusParts = [
        "[判定属性（使用当前值而不是上限值进行判定，并根据<动态属性检测系统>处理，特别是出现0或者负数时要最优先处理!!）]",
        "[额外：需关注当前状态和失控进度，用于判定角色状态稳定性]",
    ];

    GLOBAL_ATTR_CONFIG.forEach((attr) => {
        const maxVal = Number(this.SafeGetValue(stat_data, attr.key, 0));
        const displayName = attr.key.replace("值", "");
        
        if (isNaN(maxVal)) return;

        if (attr.key === "运气") {
            statusParts.push(`- ${displayName}: ${maxVal}`);
        } else {
            const currentVal = Number(this.SafeGetValue(stat_data, attr.currentVar, maxVal));
            statusParts.push(`- ${displayName}: ${Math.min(currentVal, maxVal)}/${maxVal}`);
        }
    });

    return statusParts.join("\n");
},
// 提取并组装红线指令
_assembleSystemDirectives(data) {
    if (!data) return "";
    const directives = [];

    // 新增 isNPC 参数，用于区分同名规则的作用域
    const extractDirectivesFromStates = (statesObj, entityName, isNPC) => {
        if (!statesObj) return;
        
        for (const key of Object.keys(statesObj)) {
            // 正则分离出名称，例如 "[系统状态]崩溃逃窜" -> "崩溃逃窜"
            const match = key.match(/^\[.*?\](.*)$/);
            if (match) {
                const pureName = match[1].trim(); 
                
                // 传入 pureName 和 isNPC 进行精准反查
                const directive = GameDBManager.getDirectiveByNameAndScope(pureName, isNPC);
                
                if (directive) {
                    // 仿照 actionPrompt 格式：[对象标签] 指令内容
                    const scopeLabel = entityName === "Player" ? "<User>" : entityName;
                    directives.push(`- [${scopeLabel}] ${directive}`);
                }
            }
        }
    };

    // 1. 查玩家的状态字典 (isNPC = false)
    extractDirectivesFromStates(data.stat_data.当前状态, "Player", false);

    // 2. 查 NPC 的状态字典 (isNPC = true)
    if (data.npc_data) {
        for (const [npcName, npcData] of Object.entries(data.npc_data)) {
            extractDirectivesFromStates(npcData.当前状态, npcName, true);
        }
    }

    if (directives.length > 0) {
        // 修改为 ActionPrompt 风格的包裹方式
        return `[系统指令]\n${directives.join("\n")}\n\n`;
    }

    return "";
},
//上一轮回复
_getLastRoundContent() {
  if (this.isHistoryViewMode) return ""; // 仅活跃模式需要

  const currentViewSnapshot = this.chatHistoryCache.at(-1);
  if (!currentViewSnapshot?.message) return "";

  // 1. 【安全提取】直接复用我们刚才强化的底层函数，自带防抽风、防WAF和兼容属性/空格特性
  let lastRoundGametxt = this._extractLastTagContent("gametxt", currentViewSnapshot.message, true);

  if (lastRoundGametxt) {
    // 2. 【安全剔除 Style】动态构造正则，抹除 style 及其内部的所有代码
    // 兼容 style type="text/css" 这种带属性的情况
    const styleRegex = new RegExp("<style(?:\\s+[^>]*)?>[\\s\\S]*?<\\/style>", "gi");
    lastRoundGametxt = lastRoundGametxt.replace(styleRegex, "").trim();

    // 再次检查剔除样式后是否还有实质内容
    if (lastRoundGametxt) {
      const systemDirective = GameDBManager?.DB?.templates?.no_repeat || "";
      
      // 3. 【组装】
      const openTag = "<上一轮回复>";
      const closeTag = "</上一轮回复>";
      
      return `${openTag}\n${lastRoundGametxt}\n${closeTag}\n${systemDirective}\n`;
    }
  }
  
  return "";
},
//随机事件、组合指令、补充指令（肘击）
_assembleActionPrompt(userMessage) {
  let actionPrompt = "";

  // 1. 随机事件
  this.checkPassiveRandomEvents();
  if (this.pendingRandomEvents && this.pendingRandomEvents.length > 0) {
    this.pendingRandomEvents.sort((a, b) => a.order - b.order);
    let triggerNames = [];
    
    this.pendingRandomEvents.forEach((ev, idx) => {
      actionPrompt += `[随机事件${idx + 1}-${ev.entryName}] ${ev.text}\n`;
      triggerNames.push(`【${ev.entryName}】的【${ev.eventName}】`);
    });
    actionPrompt += "\n";

    let noticeMsg = `克莱恩提示：${triggerNames.join("、")}${triggerNames.length > 1 ? " 等" : ""} 被触发了！`;
    this.showTemporaryMessage(noticeMsg, 5000);
    this.pendingRandomEvents = []; // 清空缓存
  }

  // 2. 组合指令 (物品操作等)
  if (this.pendingActions && this.pendingActions.length > 0) {
    actionPrompt += "[本轮组合指令]\n";
    this.pendingActions.forEach((cmd) => {
      let actionText = "";
      switch (cmd.action) {
        case "equip": actionText = `装备 [${cmd.itemName}] 到 [${cmd.category}]。`; break;
        case "unequip": actionText = `卸下 [${cmd.itemName}] 从 [${cmd.category}]。`; break;
        case "use": actionText = `使用 ${cmd.quantity} 个 [${cmd.itemName}]。注意！<User>的当前属性已经被代码自动更新，本轮回复禁止再次修改！`; break;
        case "discard": actionText = `丢弃 ${cmd.quantity ? cmd.quantity + " 个 " : ""}[${cmd.itemName}]。`; break;
      }
      actionPrompt += `- ${actionText}\n`;
    });
  }

  // 3. 补充指令
  if (this.pendingSupplementary && this.pendingSupplementary.length > 0) {
    actionPrompt += `[补充指令]\n`;
    this.pendingSupplementary.forEach((suppCmd, index) => {
      actionPrompt += `${index + 1}. ${suppCmd}\n`;
    });
    actionPrompt += `\n`;

    if (!this.isKeepShortcutsEnabled) {
      this.pendingSupplementary = [];
      if (typeof this.renderQuickShortcutsPopup === "function") {
        this.renderQuickShortcutsPopup();
      }
    } else {
      console.log("[快捷指令] 已开启保持选中，本轮未清空补充指令。");
    }
  }

  // 4. 用户核心行动
  if (userMessage) {
    actionPrompt += `[我的行动]${userMessage}\n`;
  }

  return actionPrompt;
},
async _assembleContexts(userMessage) {
  const stat_data = this.currentMvuState?.stat_data;
  if (!stat_data) return { dynamicContext: "", importantContext: "" };

  const dynamicParts = [];
  const importantParts = [];

  // 1. 独立获取地图情景 (默认作为背景)
  // 移除了已禁用的 _createCurrentStatusBlock 调用，让地图数据独立压入
  const { mapOverview, spatialContextBlock } = this._assembleMapContext(stat_data);

  if (spatialContextBlock) {
    dynamicParts.push(spatialContextBlock);
  }
  if (mapOverview) {
    dynamicParts.push(mapOverview);
  }

  // 2. 并行获取各类记忆数据
  const [shortTermMemory, dossierText, coreMemory] = await Promise.all([
    this._assembleShortTermMemory(), // 返回 { normal, important }
    this._assembleCharacterDossiers(stat_data, userMessage), // 返回 string
    this._assembleCoreMemory()       // 返回 { content, isImportant }
  ]);

  // 3. 组装 should_scan: false 的内容 (Dynamic Context)
  const wrappedMemory = [];
  if (shortTermMemory.normal) wrappedMemory.push(shortTermMemory.normal);
  if (dossierText) wrappedMemory.push(dossierText);

  if (wrappedMemory.length > 0) {
    dynamicParts.push("[以下是之前发生的事情总结（供参考，非本轮新发生内容）]");
    dynamicParts.push(...wrappedMemory);
    dynamicParts.push("[以上是之前发生的事情总结（短期内容已结束）]");
  }

  // 根据核心记忆的开关决定放入哪个池子
  if (coreMemory.content) {
    if (coreMemory.isImportant) {
      importantParts.push(coreMemory.content);
    } else {
      dynamicParts.push(coreMemory.content);
    }
  }

  // 4. 组装 should_scan: true 的内容 (Important Context)
  if (shortTermMemory.important) {
    importantParts.push("[以下是最新发生的关键事件与线索]");
    importantParts.push(shortTermMemory.important);
  }

  return {
    dynamicContext: dynamicParts.join("\n\n"),
    importantContext: importantParts.join("\n\n")
  };
},
async _syncStateBeforeSend() {
  // 🛡️ 强制检疫：发车前检查最新快照数据是否已被污染
  if (!this.currentMvuState || !this.currentMvuState.stat_data) {
    console.warn("[发送前同步] 检测到当前状态严重破损，尝试从快照历史紧急抢救...");
    
    const lastValid = this.chatHistoryCache && this.chatHistoryCache[this.chatHistoryCache.length - 1];
    if (lastValid && lastValid.data && lastValid.data.stat_data) {
      // 抢救成功：强行把最近一个健康快照拷贝过来
      this.currentMvuState = _.cloneDeep(lastValid.data);
      console.log("✅ 抢救成功！已强制恢复至上一个安全快照的数据。");
    } else {
      // 抢救失败：直接阻断，禁止发送！
      const errMsg = "状态数据已无可挽回地丢失，为防止进一步破坏，已阻断行动。请手动使用【回退】功能或刷新页面。";
      this.showTemporaryMessage(`❌ ${errMsg}`, 5000);
      throw new Error("STATE_CORRUPTED: " + errMsg); // 用抛出异常的方式打断外部的 try-catch
    }
  }

  try {
    const messages = await TavernHelper.getChatMessages("0");
    if (!messages || messages.length === 0) {
      throw new Error("无法获取第0条消息，同步失败"); 
    }
    
    const messageZero = messages[0];
    messageZero.data = messageZero.data || {}; // 保底防护
    
    const stateWithoutEquipment = _.cloneDeep(this.currentMvuState);
    delete stateWithoutEquipment.equipped_items;

    // ========== 步骤1：同步主数据到消息0 ==========
    Object.assign(messageZero.data, {
      ...stateWithoutEquipment,
      gacha_data: {
        state: _.cloneDeep(this.gachaState || {}),
        collection: _.cloneDeep(this.gachaCollection || []),
        history: _.cloneDeep(this.gachaHistory || []),
      },
    });
    
    console.log("[发送前同步] 主数据已固化到消息0");

    // ========== 步骤2：同步备份数据到消息0（新增） ==========
    try {
      // 🔑 关键修复：每次发送消息前都重新加载配置，确保使用最新的配置
      // 这样即使用户手动修改了世界书中的配置文件，也能立即生效
      this.aiContextConfig = await GameDBManager.loadAIContextConfig();
      console.log("[发送前同步] 已重新加载变量可见性配置");
      
      // 生成备份数据
      GameDBManager.syncBackupData(messageZero.data, this);
      
      console.log("[发送前同步] ✅ 备份数据已生成并应用隐藏配置");
    } catch (backupError) {
      // 备份失败不应中断发送流程，使用降级方案
      console.error("[发送前同步] ⚠️ 备份数据生成失败，使用降级方案（直接复制主数据）", backupError);
      
      // 降级：直接复制主数据，不应用隐藏配置
      messageZero.data.stat_data_for_ai = _.cloneDeep(messageZero.data.stat_data);
      messageZero.data.npc_data_for_ai = _.cloneDeep(messageZero.data.npc_data);
      messageZero.data.world_data_for_ai = _.cloneDeep(messageZero.data.world_data);
    }

    // ========== 步骤3：保存到酒馆助手 ==========
    await TavernHelper.setChatMessages([messageZero], { refresh: "none" });
    console.log("[发送前同步成功] 数据已锁定并同步至世界基底。");
  } catch (e) {
    // 向上抛出错误，让 handleAction 的 Catch 块接管
    throw new Error(`[发送前同步失败] ${e.message}`);
  }
},



//==========最终发送===========
async handleAction(userMessage = "", isBranchingAction = false) {
  // 1. 模式与防御性检查
  if (this.isHistoryViewMode && !isBranchingAction) {
    if (!userMessage && this.pendingActions.length === 0) {
      this.showTemporaryMessage("请在返回现在后执行此操作。");
      return;
    }
    this.handleBranching(userMessage);
    return;
  }

  if (this.isBackgroundProcessing) {
    this.showTemporaryMessage("💠 世界线仍在演算中，请等待片刻...");
    return;
  }

  this.lastUserMessage = userMessage;
  if (this.isBusy) {
    this.showTemporaryMessage("正在处理上一条指令，请稍候...");
    return;
  }

  // 2. 提前拦截空指令 (优化点：避免无意义的存档/备份操作)
  if (!userMessage && this.pendingActions.length === 0) {
    this.showTemporaryMessage("请输入行动或在指令中心添加指令后发送。");
    return;
  }
  
  this.isBusy = true;

  try {

    if (typeof this._clearExtractedCache === "function") {
      this._clearExtractedCache();
      console.log("[历史系统] 新回合启动，已清理上一回合的提取缓存，防止幽灵数据污染。");
    }

    // ⬇️ [修复点 1] 将启动 UI 状态提前到所有 await 操作之前
    // 2. 启动 UI 状态
    this.showWaitingMessage();
    this._streamLoadingHidden = false;

    // 3. 存档与备份 (异步操作在 UI 响应后默默进行)
    await this.createPendingAutoSave();
    await this.checkAndPerformPeriodicBackup();

    // 5. 数据同步
    await this._syncStateBeforeSend();

    // 4. 组装三大核心 Prompt 模块 (🌟 优化点：获取分流后的上下文)
    const { dynamicContext, importantContext } = await this._assembleContexts(userMessage);
    
    const lastRoundContent = this._getLastRoundContent();
    const actionPrompt = this._assembleActionPrompt(userMessage);

    // 🌟 新增：把 actionPrompt 存下来，留给稍后的变量 AI (Secondary API) 使用
    this.lastActionPrompt = actionPrompt;

    const stat_data = this.currentMvuState?.stat_data;
    const directivesBlock = this._assembleSystemDirectives(this.currentMvuState);

    // 6. 最终 Prompt 拼接
    let finalPrompt = `[记忆备忘录]\n${dynamicContext}\n\n[关键情景]\n${importantContext}\n\n${lastRoundContent}\n\n${actionPrompt}\n${directivesBlock}\n`;
    finalPrompt += `\n\{\{setvar::我的行动::${userMessage}\}\}`;
    
    this.lastSentPrompt = finalPrompt;
    await AppStorage.saveData("last_sent_prompt", this.lastSentPrompt);

    const finalUserAction = `${actionPrompt}\n\n\n\{\{setvar::我的行动::${userMessage}\}\}`;

    // 7. 发送请求
    const generateConfig = {
      // 直接在这里传入所有的注入对象
      injects: [
        {
          id: 'dynamic_context',
          role: 'system',
          content: dynamicContext,
          position: 'in_chat',
          depth: 10,
          should_scan: false,
        },
        {
          id: 'important_context',
          role: 'system',
          content: importantContext,
          position: 'in_chat',
          depth: 6,           // 🌟 深度比 dynamic 浅一点，靠近当前对话
          should_scan: true,  // 🌟 核心信息，必须扫描
        },
        {
          id: 'last_round_content',
          role: 'system',
          content: lastRoundContent,
          position: 'in_chat',
          depth: 5,
          should_scan: true,
        },
        {
          id: 'directives_block',
          role: 'system',
          content: directivesBlock,
          position: 'in_chat',
          depth: 4,
          should_scan: true,
        },
        {
          id: 'current_action',
          role: 'user',
          content: finalUserAction,
          position: 'in_chat',
          depth: 4, 
          should_scan: true,
        }
      ].filter(item => item.content), // 过滤掉 content 为空的内容，防止注入空字符串
      should_stream: this.isStreamingEnabled,
      max_chat_history: 0,
    };
    await TavernHelper.generate(generateConfig);
  } catch (error) {
    console.error("[源堡] 处理动作时出错:", error);
    this._clearAllLocks(false); 

    // ⬇️ 新增：拦截底层的 AbortError
    const errorMsg = (error.message || "").toLowerCase();
    const isAborted = error.name === "AbortError" || errorMsg.includes("abort");

    if (isAborted) {
      console.log("[源堡] 成功拦截底层中断报错，移交控制权给防卡死流程。");
      // 注意：这里我们故意什么都不弹。
      // 因为玩家点击按钮后，emergencyReset 里的 _clearAllLocks(false) 
      // 已经会弹出 "🔧 系统状态已强制重置..." 的提示了。
    } else {
      // 只有遇到真正的意外错误（如网络断开、格式解析崩坏）时，才显示原始报错
      this.showTemporaryMessage(`操作失败: ${error.message}`);
    }
  }
},



// =======截流回复，非常重要！=======

// 流式处理函数
handleStreamUpdate(text) {
  // 首次收到流式内容时，只隐藏全屏加载动画，保留加载条
  if (this.isBusy && text && text.trim().length > 0) {
    // 使用标志位确保只隐藏一次
    if (!this._streamLoadingHidden) {
      this._streamLoadingHidden = true;
      console.log(
        "[handleStreamUpdate] 首次收到流式内容，隐藏全屏加载动画，保留加载条",
      );

      // 如果开启了全屏加载动画，只隐藏overlay，不隐藏加载条
      if (this.isFullScreenLoadingEnabled) {
        const overlay =
          document.getElementById("loading-overlay");
        if (overlay) {
          overlay.style.opacity = "0";
          overlay.style.display = "none";
          console.log(
            "[handleStreamUpdate] 全屏加载动画已隐藏",
          );
        }
        // 显示加载条，让用户知道还在生成中
        this.showLoadingBar();
      }
      // 如果没开启全屏加载，加载条本来就在显示，不需要额外操作
    }
  }

  // 更新文本显示
  const gameTextDisplay =
    document.getElementById("game-text-display");
  if (gameTextDisplay) {
    const displayText = this._stripForbiddenWords(
      this._getDisplayText(text),
    );
    gameTextDisplay.innerHTML =
      this.formatMessageContent(displayText);
    this.rebindJudgmentInteractions(gameTextDisplay);
  }
},

// 流式生成结束后处理函数 (双轨异步调度版 - 软着陆容错版)
async handleStreamEnd(finalText, retryCount = 0) {
  if (this.isBackgroundProcessing) return;

  finalText = this._stripForbiddenWords(finalText) || "";
  console.log(`[handleStreamEnd] 剧情生成结束 (重试次数: ${retryCount})`);

  // 1. 系统级拦截 (仅防未初始化等真 Bug)
  if (this._isGhostEvent()) {
    this.showTemporaryMessage('❌ 游戏环境未就绪，生成被拦截。');
    this._clearAllLocks(true);
    return;
  }

  if (this.isSummarizing) return this._handleSummaryHijack(finalText);
  if (this.isRefining) return this._handleRefineHijack(finalText);
  if (this.isFixingVariable) return this._handleVariableFixHijack(finalText);

  await this.loadGachaState();

  // 2. 剧情格式与质量审查 (统一人工检修站)
  const criticalTags = ["thinking", "gametxt", "action"]; 
  const requiredTags = ["gametxt"]; 
  
  // 将极短空回、格式错乱全部交由检修站统一判决
  const inspectResult = await this._inspectAndRepairNarrative(finalText, criticalTags, requiredTags);
  
  if (!inspectResult.passed) {
    // 🌟 核心优化：玩家点击了取消（比如遇到空回不想手写，直接取消）
    // 此时执行标准软重载，把酒馆里的错误文本抹掉，恢复到上一回合！
    this.showTemporaryMessage("❌ 已取消剧情生成，正在清理残余状态...");
    await this.performRollback(true); 
    this._clearAllLocks(false);
    return;
  }

  if (inspectResult.isRepaired) {
    this.showTemporaryMessage("🔄 正在使用手动修正的内容继续运算...", 2000);
    return this.handleStreamEnd(inspectResult.text, retryCount + 1);
  }

  // 3. 验证完美通过，开始推送到 UI
  console.log("[验证] 剧情阶段检查通过，开始渲染正文...");
  const parsedNarrativeData = this._parseAiResponse(finalText);

  this.hideWaitingMessage(true); 
  await this.loadAndDisplayCurrentScene(parsedNarrativeData.cleanedText, parsedNarrativeData, true);
  
  // 4. 开启隐秘的第二轨道：呼叫变量AI
  this.isBackgroundProcessing = true; 
  this.showLoadingBar("💠 世界线变动演算中，请稍候..."); 
  
  this._dispatchVariableAI(parsedNarrativeData, finalText).catch(async (e) => {
    console.error("[后台错误] 变量AI崩溃:", e);
    this.showTemporaryMessage("❌ 世界演算发生致命异常，正在尝试恢复！");
    await this.performRollback(true);
    this._clearAllLocks(false);
  });
},
// 专门负责审查AI生成质量，并呼叫人工检修站
async _inspectAndRepairNarrative(finalText, criticalTags, requiredTags) {
  let validationResult = { isValid: true, errorMessages: [] };
  const textTrimmed = finalText.trim();

  // ==========================================
  // 🌟 核心优化：接管原幽灵事件的质量判定
  // ==========================================
  const isGhostlyShort = textTrimmed.length < 5;
  const isTooShort = textTrimmed.length < 20;
  const hasValidContent = textTrimmed.includes("=") || textTrimmed.includes("：") || textTrimmed.includes(":");
  const isInvalidContent = !this.isTrueNewGame && !hasValidContent;

  if (isGhostlyShort) {
    validationResult.isValid = false;
    validationResult.errorMessages.push(`AI 似乎睡着了，生成内容严重缺失 (仅 ${textTrimmed.length} 字符)`);
  } else if (isTooShort) {
    validationResult.isValid = false;
    validationResult.errorMessages.push(`生成内容过短，涉嫌敷衍空回 (仅 ${textTrimmed.length} 字符)`);
  } else if (isInvalidContent) {
    validationResult.isValid = false;
    validationResult.errorMessages.push(`未检测到有效的标点或文本特征，可能生成了乱码`);
  } else {
    // 长度和基础质量没问题，再去校验 XML 标签的完整性
    validationResult = this.validateAiResponseFormat(finalText, criticalTags, requiredTags);
  }

  // 如果校验完美通过，直接放行
  if (validationResult.isValid) return { passed: true, text: finalText };

  console.warn("[验证] 剧情AI格式/质量异常被阻断:", validationResult.errorMessages);
  
  // 触发自动修复，作为底稿
  const autoFixedText = this._autoFixTags(finalText, criticalTags);
  const errorReasons = validationResult.errorMessages.join(" | ").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const modalMessage = `
    <div style="text-align: left; max-height: 65vh;">
      <p style="color: var(--text-danger); font-weight: bold; margin-bottom: 8px;">
        ⚠️ 警告：AI 剧情生成质量异常！
      </p>
      <p style="font-size: 0.9em; margin-bottom: 8px;">
        <strong>诊断结论：</strong>${errorReasons}
      </p>
      <p style="font-size: 0.85em; margin-bottom: 12px; line-height: 1.4;">
        <strong>已尝试自动修复</strong>，请在下方文本框内<strong>检查是否无误</strong>，确认后将以此文本强行推进时间线。<br>
        <span style="color: #8b5cf6;">若不想手动代写，请直接点击【取消】，系统将安全撤销本次异常生成并回滚状态。</span>
      </p>
      <textarea id="manual-fix-textarea" class="modal-input" style="height: 220px; font-family: monospace;">${autoFixedText}</textarea>
    </div>
  `;

  const userConfirmed = await this.showConfirmModal(modalMessage);

  if (userConfirmed) {
    const textarea = document.getElementById("manual-fix-textarea");
    const newlyEditedText = textarea ? textarea.value : autoFixedText;
    return { passed: true, text: newlyEditedText, isRepaired: true };
  } else {
    return { passed: false };
  }
},

// ==========================================
// 📡 后台静默发报机 (The Silent Caller) - [Debug 增强版]
// ==========================================
async _callSecondaryAPI(injectsArray, userAction, storyText) {
  console.log("[SecondaryAPI] 正在呼叫后台变量 AI...");
  
  const variable_template = GameDBManager?.DB?.templates?.variable_template;
  if (!variable_template) throw new Error("缺少 variable_template");

  this.isBackgroundProcessing = true; 

  try {
    const scannableItems = injectsArray.filter(item => item.should_scan);
    const nonScannableItems = injectsArray.filter(item => !item.should_scan && item.position !== 'none');

    // ✅ 修复 1：严格剔除 id 字段，符合 Omit<InjectionPrompt, 'id'> 规范
    const safeInjects = nonScannableItems.map(({ id, ...rest }) => rest);

    const superScannableText = scannableItems
      .sort((a, b) => b.depth - a.depth)
      .map(item => item.content)
      .join('\n\n');

    const finalUserInput = `${superScannableText}\n\n【玩家行动】：${userAction}\n\n【剧情发展】：\n${storyText}\n[System Note: BACKENDVARONLY]`;

    const generateConfig = {
      should_stream: false, 
      max_chat_history: 0, 
      user_input: finalUserInput,
      injects: safeInjects,
      ordered_prompts: [
        'world_info_before',    
        'persona_description',
        'chat_history',         
        'user_input',           
        { role: "system", content: variable_template }, 
        { 
          role: "assistant", 
          content: "<思考>\n好的，本轮思考完毕，接下来我将认真思考 <think> 里的内容，并且严格输出思考过程，不省略，接下来必须以 <think> 作为开头进行思考（无需输出本段）\n</思考>" 
        }
      ]
    };

    if (this.varAiUseCustom && this.varAiApiUrl) {
      generateConfig.custom_api = {
        apiurl: this.varAiApiUrl,
        key: this.varAiApiKey,
        model: this.varAiModel,
        source: 'openai'
      };
    }

    // ==========================================
    // 🚨 增强调试区 1：请求前体积预估与结构自检
    // ==========================================
    const payloadString = JSON.stringify(generateConfig);
    const charCount = payloadString.length;
    // 粗略的 Token 估算：通常中文 1 Token ≈ 1.5~2 字符，英文 1 Token ≈ 4 字符。取均值 2.5。
    const estimatedTokens = Math.floor(charCount / 2); 
    
    console.groupCollapsed("[SecondaryAPI] 📤 发送前检查: API 数据包诊断");
    console.log(`📏 预估总字符数: ${charCount} 字符`);
    console.log(`📊 预估 Token 消耗: 约 ${estimatedTokens} Tokens`);
    console.log(`🤖 目标模型: ${generateConfig.custom_api?.model || '酒馆默认模型'}`);
    console.log(`🔗 API 节点: ${generateConfig.custom_api?.apiurl || '酒馆默认源'}`);
    
    if (estimatedTokens > 30000) {
      console.warn("⚠️ 警告: 预估 Token 超过 30k！极有可能被部分代理商截断或直接拒绝连接 (Error: <none>)。");
    }
    
    // 打印完整参数供检查结构是否正确
    console.dir(generateConfig, { depth: null });
    console.groupEnd();

    // ==========================================
    // 📡 增强调试区 2：API 调用与深度错误捕获
    // ==========================================
    let response;
    try {
      // 优先尝试使用全局的 generateRaw
      const apiCaller = typeof generateRaw === 'function' ? generateRaw : TavernHelper.generateRaw;
      response = await apiCaller(generateConfig);
    } catch (apiError) {
      console.group("[SecondaryAPI] ❌ 致命错误: 底层 API 调用崩溃");
      console.error("原始错误对象:", apiError);

      // 拆解并翻译错误，找出到底哪里炸了
      let diagnosticMessage = "未知错误";
      if (!apiError) {
        diagnosticMessage = "错误对象完全为空。可能原因：网络断开、跨域(CORS)拦截，或扩展层代码崩溃。";
      } else if (apiError.message) {
        if (apiError.message.includes("<none>") || apiError.message.trim() === "") {
          diagnosticMessage = `被吞噬的空错误 (Error: <none>)。\n可能原因：\n1. Token 严重超限，API 返回 413 但没写原因；\n2. 代理商节点故障返回空内容；\n3. 传给酒馆的数据有非法字段被静默拒绝。\n(预估发信 Token: ${estimatedTokens})`;
        } else {
          diagnosticMessage = apiError.message;
        }
      } else if (typeof apiError === 'string') {
        diagnosticMessage = apiError;
      } else {
        diagnosticMessage = JSON.stringify(apiError);
      }

      console.error(`🔍 诊断结论: ${diagnosticMessage}`);
      console.groupEnd();

      // 将包装后的详细错误扔给上层的 _dispatchVariableAI
      throw new Error(`[后台 AI 崩溃] ${diagnosticMessage}`);
    }

    if (!response || response.trim() === "") {
      throw new Error("[后台 AI 异常] 请求成功完成，但 AI 返回了完全空白的字符串。");
    }


    return response;

  } finally {
    this.isBackgroundProcessing = false;
  }
},

// ==========================================
// 🚀 第二轨道：变量 AI 调度总管 (The Data Clerk) - 软着陆容错版
// ==========================================
async _dispatchVariableAI(parsedNarrativeData, narrativeRawText, retryCount = 0) {
  console.log(`[VariableAI] 开始执行后台结算 (重试次数: ${retryCount})...`);

  try {
    const userAction = this.lastUserMessage || "继续/顺其自然";
    const storyText = parsedNarrativeData.novelText || narrativeRawText;
    
    const { dynamicContext, importantContext } = await this._assembleContexts(userAction);
    const directivesBlock = this._assembleSystemDirectives(this.currentMvuState);
    const actionPrompt = this.lastActionPrompt;
    // 🌟 核心提取：在变量API发包前，获取绝对真实的下一回合序号<System_True_Next_ID>
    let trueNextId = 1;
    if (this.chatHistoryCache && this.chatHistoryCache.length > 0) {
      const lastSnap = this.chatHistoryCache[this.chatHistoryCache.length - 1];
      trueNextId = (lastSnap.meta?.serial || this.chatHistoryCache.length) + 1;
    }
    const trueNextIdTag = `\n<System_True_Next_ID>${trueNextId}</System_True_Next_ID>\n`;

    const variableInjects = [
      { id: 'var_dynamic_context', role: 'system', content: dynamicContext, position: 'in_chat', depth: 5, should_scan: false },
      { id: 'var_important_context', role: 'system', content: importantContext, position: 'in_chat', depth: 4, should_scan: true },
      { id: 'var_action_prompt', role: 'system', content: actionPrompt, position: 'in_chat', depth: 2, should_scan: true },
      { id: 'var_directives', role: 'system', content: directivesBlock + trueNextIdTag, position: 'in_chat', depth: 1, should_scan: true },
    ].filter(item => item.content);

    // ==========================================
    // 🛡️ 防线 1：致命错误（API崩溃/空回）-> 手动重试机制
    // ==========================================
    let variableAiResponse;
    try {
      variableAiResponse = await this._callSecondaryAPI(variableInjects, userAction, storyText);
    } catch (apiError) {
      console.error(`[VariableAI] API调用或空回致命异常:`, apiError);
      
      // 自动重试 1 次防网络波动
      if (retryCount < 2) {
        this.showTemporaryMessage(`网络波动或AI空回，正在自动重试...`, 3000);
        return await this._dispatchVariableAI(parsedNarrativeData, narrativeRawText, retryCount + 1);
      } else {
        // 🌟 核心体验优化：把选择权交给玩家，允许手动重试
        this.hideLoadingBar();
        const userChoice = await this.showConfirmModal(
          `⚠️ <b>后台演算失败：</b><br><span style="color:var(--text-danger);font-size:0.85em;">${apiError.message || "未知网络错误"}</span><br><br>点击【确认】手动重新演算一次，或点击【取消】放弃本次变量更新并回滚。`
        );
        
        if (userChoice) {
          this.showLoadingBar("💠 正在手动重新演算...");
          return await this._dispatchVariableAI(parsedNarrativeData, narrativeRawText, 0); // 重置重试次数
        } else {
          this.showTemporaryMessage("❌ 已取消变量生成，执行软重载...");
          await this.performRollback(true);
          this._clearAllLocks(false);
          return;
        }
      }
    }

    console.log("[VariableAI] 成功接收后台回复，开始容错解析...");

    // ==========================================
    // 🛡️ 防线 2：暴力容错与结构提取 (不再因为掉标签而拦截)
    // ==========================================
    let fixedResponse = this._autoFixTags(variableAiResponse, ["UpdateVariable", "本周目经历"]);
    
    const TAG_OPEN = "\x3CUpdateVariable\x3E";
    const TAG_CLOSE = "\x3C/UpdateVariable\x3E";

    if (!fixedResponse.includes(TAG_OPEN) && fixedResponse.includes("{") && fixedResponse.includes("}")) {
        console.warn("[VariableAI] 警告：缺失核心标签，尝试强行提取 JSON 区块...");
        // 尝试匹配最外层的 JSON 对象
        const jsonMatch = fixedResponse.match(/\{[\s\S]*?\}(?=[^{}]*$)/) || fixedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            // 使用变量拼接，避免源码中出现完整标签字符串
            fixedResponse += `\n${TAG_OPEN}\n${jsonMatch[0]}\n${TAG_CLOSE}`;
        }
    }

    const parsedVarData = this._parseAiResponse(fixedResponse);
    let patchScript = parsedVarData.variables;

    // ==========================================
    // 🛡️ 防线 3：结构彻底损毁 -> 呼叫底层检修站
    // ==========================================
    // 如果强行提取后，依然连一丁点 JSON 代码都找不到（说明 AI 完全在用自然语言聊天）
    if (!patchScript || patchScript.trim() === "") {
      this.hideLoadingBar();
      this.showTemporaryMessage("⚠️ 未检测到有效数据结构，进入人工干预...", 2000);
      
      // 注意：这里传入的错误信息只是提示玩家，因为此时 AI 的输出毫无结构可言
      const inspectResult = await this._inspectAndRepairVariableData(
        variableAiResponse, 
        [], 
        ["无法识别任何有效的 JSON 或变量结构。请直接粘贴正确的变量代码，或在此处尝试手动编写。"]
      );
      
      if (!inspectResult.passed) {
         this.showTemporaryMessage("❌ 已放弃结构修复，正在回滚...");
         await this.performRollback(true);
         this._clearAllLocks(false);
         return; 
      }
      
      // 玩家修补后，重新尝试解析
      fixedResponse = inspectResult.text;
      const reParsed = this._parseAiResponse(fixedResponse);
      patchScript = reParsed.variables || fixedResponse; // 容错：如果玩家直接粘贴了JSON，也认
      this.showLoadingBar("💠 正在应用修复后的数据...");
    }

    // ==========================================
    // 🛡️ 防线 4：交接给变量引擎 (带病作业，报错由面板接管)
    // ==========================================
    this._updateInstanceData(parsedVarData);
    let modifiedNpcSet = new Set();
    
    // 清空历史报错，准备迎接新的解析
    this.errorCommands = []; 

    if (patchScript) {
      console.log("[VariableAI] 开始执行变量运算 (包含烂指令容错机制)...");
      const { patchCommands } = this._processJsonPatchCommandsEnhanced(patchScript);
      if (Array.isArray(patchCommands.npc_data)) {
        patchCommands.npc_data.forEach(cmd => {
          const parts = cmd.path.split('/').filter(Boolean);
          if (parts.length > 0) modifiedNpcSet.add(parts[0]);
        });
      }

      // 🌟 核心信任：如果 patchScript 里有 JSON 语法错误，_applyUpdateFallback 会安全拦截，
      // 并把错误写入 this.errorCommands，返回 null（状态不变）。不会抛出致命崩溃！
      const newState = await this._applyUpdateFallback(patchScript, this.currentMvuState);
      if (newState) {
        this.currentMvuState = _.cloneDeep(newState);
      } else {
        console.warn("[VariableAI] 变量指令执行异常/无变化，将由纠错面板接管展示。");
      }
    }

    // ==========================================
    // ✅ 正常执行结算与固化 (剧情先行，变量殿后)
    // ==========================================
    const combinedTextToSave = `${narrativeRawText}\n\n${fixedResponse}`;
    await this._executeTurnSettlement(combinedTextToSave);

    const messages = await getChatMessages("0");
    if (messages && messages.length > 0) {
      const stateWithoutEquipment = _.cloneDeep(this.currentMvuState);
      delete stateWithoutEquipment.equipped_items;
      messages[0].data = stateWithoutEquipment;
      messages[0].message = combinedTextToSave;
      await TavernHelper.setChatMessages([messages[0]], { refresh: "none" });
    }

    await this._finalizeTurn(combinedTextToSave);

    const latestSnapshot = this.chatHistoryCache[this.chatHistoryCache.length - 1];
    // 确保 meta 存在即可，world_info 没有就创建一个
    if (latestSnapshot && latestSnapshot.meta) {
      if (!latestSnapshot.meta.world_info) {
        latestSnapshot.meta.world_info = {};
      }
      
      const activeSet = new Set(latestSnapshot.meta.world_info.active_npcs || []);
      const offScreenNpcs = Array.from(modifiedNpcSet).filter(name => !activeSet.has(name) && this.currentMvuState.npc_data[name]);

      latestSnapshot.meta.world_info.offscreen_npcs = offScreenNpcs;
      await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache); 
    }

    // ==========================================
    // 🛡️ 独立防御层：自动化系统 UI 渲染
    // ==========================================
    try {
      this.appendDynamicAutomationPanel(modifiedNpcSet);
    } catch (uiError) {
      // 就算 UI 渲染炸了，也只在控制台报警，绝对不中断后续的数据同步和锁清理！
      console.error("[VariableAI] 自动化面板渲染失败，但不影响核心数据同步:", uiError);
    }

    await this._syncAllDataToWorldbook();

    console.log("[VariableAI] 后台结算完毕，解锁UI！");
    this.showTemporaryMessage("✅ 世界线已同步", 2000);
    this.hideLoadingBar(); 
    this.isTrueNewGame = false;
    this._clearAllLocks(true); 


    // ==========================================
    // 🌟 核心体验：唤出纠错面板！
    // ==========================================
    // 只要有提取出指令 (哪怕是乱码)，都唤出面板。
    // 如果 this.errorCommands 有东西，面板会自动变成报错状态，玩家直接点【一键修复】即可！
    if (patchScript) {
      const { patchCommands, formattedPatchText } = this._processJsonPatchCommandsEnhanced(patchScript);
      this.renderVariablePanel(patchCommands, formattedPatchText, patchScript);
    }

  } catch (error) {
    console.error("[VariableAI 兜底异常拦截]:", error);
    this.hideLoadingBar();
    
    // 拦截强制回滚，把最后决定权给玩家
    const forceRollback = await this.showConfirmModal(
      `❌ <b>结算过程发生严重错误：</b><br>
      <span style="color:var(--text-danger);font-size:0.85em;">${error.message}</span><br><br>
      点击【确认】执行安全回滚（推荐），或点击【取消】强行继续游戏（将跳过本次变量更新，仅推进剧情）。`
    );

    if (forceRollback) {
      this.showTemporaryMessage("正在回退状态...");
      await this.performRollback(true);
    } else {
      // ==========================================
      // 🚨 终极兜底：玩家选择强行继续，执行“带病结算”
      // ==========================================
      this.showTemporaryMessage("⚠️ 已跳过变量更新，强行保存当前剧情...", 2000);
      
      try {
        // 1. 仅使用原始剧情文本（抛弃坏掉的 fixedResponse）
        const fallbackTextToSave = narrativeRawText;

        // 2. 执行常规副作用结算（能力、奖励、清理输入框）
        await this._executeTurnSettlement(fallbackTextToSave);

        // 3. 将原汁原味的纯剧情写回前台界面
        const messages = await getChatMessages("0");
        if (messages && messages.length > 0) {
          const stateWithoutEquipment = _.cloneDeep(this.currentMvuState);
          delete stateWithoutEquipment.equipped_items;
          messages[0].data = stateWithoutEquipment;
          messages[0].message = fallbackTextToSave;
          await TavernHelper.setChatMessages([messages[0]], { refresh: "none" });
        }

        // 4. 将本次（无变量更新的）回合推入历史快照
        await this._finalizeTurn(fallbackTextToSave);

        // 5. 尝试同步世界书（即使变量没变，也确保数据对齐）
        await this._syncAllDataToWorldbook();

        this.isTrueNewGame = false;
        this.showTemporaryMessage("✅ 强行推进完毕，游戏继续", 2000);

      } catch (fallbackError) {
        // 防御嵌套崩溃：如果强行推进时历史入库等底层系统也坏了
        console.error("[VariableAI] 强行推进发生二次崩溃:", fallbackError);
        this.showTemporaryMessage("❌ 状态已严重损坏，请手动刷新页面重试！", 4000);
      }
    }
    
    // 无论如何，最后都要释放进程锁
    this._clearAllLocks(forceRollback); 
  }
},

// 专门负责审查变量AI格式，并呼叫人工检修站 (返回 true 表示通过/结构补全成功，返回 false 表示取消并回滚)
async _inspectAndRepairVariableData(rawText, requiredTags, errorMessages) {
  const errorReasons = errorMessages.join(" | ").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  const modalMessage = `
    <div style="text-align: left; max-height: 65vh;">
      <p style="color: #8b5cf6; font-weight: bold; margin-bottom: 8px;">
        ⚠️ 警告：后台世界线演算结构异常！
      </p>
      <p style="font-size: 0.9em; margin-bottom: 8px;">
        <strong>缺失的结构标签：</strong>${errorReasons}
      </p>
      <p style="font-size: 0.85em; margin-bottom: 12px; line-height: 1.4;">
        AI 输出的内容丢失了必要的结构标签。<br>
        请在下方文本框内<strong>补齐缺失的 XML 标签</strong>（例如将内容包裹在 <code>&lt;UpdateVariable&gt;...&lt;/UpdateVariable&gt;</code> 中）。<br>
        <em>提示：这一步只需让格式初步正确即可，提交后系统会弹出变量面板，可以进一步详细调节具体数值与逻辑。</em><br>
        确认后将以此文本继续结算，或点击取消放弃本次注入进行强制回滚。
      </p>
      <textarea id="manual-var-fix-textarea" class="modal-input" style="height: 250px; font-family: monospace;">${rawText}</textarea>
    </div>
  `;

  // 这里的 showConfirmModal 是你原本就有的弹窗系统
  const userConfirmed = await this.showConfirmModal(modalMessage);

  if (userConfirmed) {
    const textarea = document.getElementById("manual-var-fix-textarea");
    const newlyEditedText = textarea ? textarea.value : rawText;
    return { passed: true, text: newlyEditedText, isRepaired: true };
  } else {
    return { passed: false };
  }
},



// 底层状态清理与解锁 (内部解耦复用)
_clearAllLocks(silent = true) {
  console.log("[源堡] 执行全局锁与 UI 状态清理...");

  // 1. 解除所有核心锁
  this.isBusy = false;
  this.isSummarizing = false; 
  this.isRefining = false;
  this.pendingCharacterCardGeneration = null;
  this._streamLoadingHidden = true; // 重置流式遮罩标记
  this.isBackgroundProcessing = false; // 🌟 新增：重置后台结算锁

  // 2. 强制清理 UI 状态
  this.hideWaitingMessage(true);
  
  // 强制隐藏全屏 Loading 遮罩
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.style.opacity = "0";
    overlay.style.display = "none";
  }

  // 隐藏独立加载条
  if (typeof this.hideLoadingBar === "function") {
    this.hideLoadingBar();
  }

  // 3. 非静默模式下提示玩家
  if (!silent) {
    this.showTemporaryMessage("🔧 已中断和源堡的沟通，你可以重新尝试了。");
  }
},
// 紧急状态重置 (防卡死专用)
async emergencyReset() {
  console.warn("[源堡] 玩家点击了紧急重置按钮，等待确认...");

  // 1. 弹出确认提示框
  const confirmMessageHtml = `<div style="padding: 10px;">` +
    `<p style="color: var(--color-danger); font-weight: bold;">确定要强制中断当前操作吗？</p>` +
    `<p style="font-size: var(--text-sm); margin-top: 10px;">此操作将立即停止正在进行的 AI 生成，并强制重置所有界面锁定状态。这不会导致你的进度丢失。</p>` +
    `<p style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 5px;">(如果游戏卡死或无限加载，请使用此功能)</p>` +
    `</div>`;

  // 等待玩家的选择
  const isConfirmed = await this.showConfirmModal(
    confirmMessageHtml,
    () => { console.log("[源堡] 玩家在模态框中点击了【确认】"); },
    () => { console.log("[源堡] 玩家在模态框中点击了【取消】"); }
  );

  // 2. 如果玩家点击了取消或关闭了窗口，直接返回
  if (!isConfirmed) {
    return;
  }

  console.warn("[源堡] 执行紧急状态重置与生成中断！");

  // 3. 调用酒馆全局函数，从底层掐断 AI 生成流
  if (typeof stopAllGeneration === "function") {
    const isStopped = stopAllGeneration();
    console.log(`[源堡] 底层生成中断指令已发送，执行结果: ${isStopped}`);
  } else {
    console.warn("[源堡] 未找到 stopAllGeneration 方法，跳过底层中断，仅执行 UI 重置。");
  }

  // 4. 调用我们之前解耦的底层清理函数 (传入 false，让其弹出成功提示)
  this._clearAllLocks(false);
},
// 新版：状态回退（支持异常中断与常规回退）
async performRollback(isErrorAbort = false) {
  // 🔴 核心防御：历史模式拦截
  if (this.isHistoryViewMode) {
    this.showTemporaryMessage("正在浏览历史，无法使用回退功能。请先返回现在。");
    return;
  }

  if (this.chatHistoryCache.length <= 1 && !isErrorAbort) {
    this.showTemporaryMessage("已经是初始状态，无法再回退了。");
    return;
  }

  // 🌟 新增拦截：如果是“未固化状态”下的异常中断，执行软重载！
  if (isErrorAbort) {
    this.showTemporaryMessage("正在清除未固化的异常状态...", 2000);
    await this._reloadCurrentSnapshot(); // 新增函数：只读取，不删除快照
    return;
  }

  // 🌟 新增防御：玩家在后台演算时手动点击回退
  // 假设你有 this.isBackgroundProcessing 等锁，拦截玩家在未固化时的手动回退操作
  if (this.isBackgroundProcessing) {
    const confirmAbort = await this.showConfirmModal("当前剧情正在后台演算中尚未固化，是否强行中断并恢复到安全状态？");
    if (!confirmAbort) return;
    
    this.showTemporaryMessage("正在强行终止并恢复...", 2000);
    await this._reloadCurrentSnapshot();
    this._clearAllLocks(true);
    return;
  }

  // ================= 正常固化状态下的常规回退 =================
  // 第一次询问：是否回退
  const confirmRollback = await this.showConfirmModal("确定要回退到上一回合吗？");
  if (!confirmRollback) return;

  // 第二次询问：是否保存分支
  const wantToSave = await this.showConfirmModal("是否将当前的记录保存为一个【分支存档】？");

  try {
    if (wantToSave) {
      await this._archiveCurrentTimelineAsBranch();
    }
    this.showTemporaryMessage("正在挥剑斩断未来...", 2000);
    await this._executeSilentRollback(); // 原版逻辑：包含 pop() 删快照
    this.showTemporaryMessage("✅ 操作成功");
  } catch (error) {
    this._handleRollbackError(error);
  }
},
// 新增：软重载当前快照（不执行 pop 删除操作）
async _reloadCurrentSnapshot() {
  try {
    const latestValidSnapshot = this.chatHistoryCache[this.chatHistoryCache.length - 1];
    
    // 🛡️ 新增拦截：不光要看快照存不存在，还得看里面的数据全不全
    if (!latestValidSnapshot || !latestValidSnapshot.data || !latestValidSnapshot.data.stat_data) {
      console.error("[Rollback] 警告：发现当前快照本身已被污染或丢失核心数据！", latestValidSnapshot);
      this.showTemporaryMessage("❌ 历史快照数据异常，无法安全软重载，建议手动回退到更早回合！", 4000);
      return; // 拒绝载入毒数据，维持现状让玩家手动干预
    }

    this.currentMvuState = _.cloneDeep(latestValidSnapshot.data); 
    const parsedOldData = this._parseAiResponse(latestValidSnapshot.message);

    await this.loadAndDisplayCurrentScene(
      latestValidSnapshot.message, 
      parsedOldData
    );
    
    this.showTemporaryMessage("⚠ 生成过程中出现了异常，已自动回退到最新快照中！", 10000);
    console.log("[Rollback] 已成功重载最新安全快照，丢弃了未固化的异常数据。");
  } catch (error) {
    console.error("[Rollback] 重载当前快照失败:", error);
  }
},
// 终极版：重新生成（原汁原味触发 + 安全状态回退）
async performReroll() {
  console.log("[重新生成] 函数被调用");

  // 🔴 核心防御：历史模式拦截
  if (this.isHistoryViewMode) {
    this.showTemporaryMessage(
      "正在浏览历史，无法重新生成。请先返回现在。",
    );
    return;
  }

  // 添加并发保护
  if (this.isRerolling) {
    this.showTemporaryMessage("正在重新生成中，请稍候...", 2000);
    console.warn("[重新生成] 检测到并发调用，已阻止");
    return;
  }

  if (this.chatHistoryCache.length <= 1) {
    this.showTemporaryMessage("历史记录不足，无法重新生成。");
    return;
  }
  if (!this.lastSentPrompt || this.lastSentPrompt.trim() === "") {
    this.showTemporaryMessage("没有可用于重新生成的指令。");
    return;
  }

  this.showConfirmModal(
    "确定要重新生成上一次的回答吗？\n\n注意：当前回合极其糟糕的AI回复将被直接抹除。",
    async () => {
      this.isRerolling = true;
      this.showTemporaryMessage(
        "正在时光倒流并重新请求...",
        2000,
      );
      this.closeAllModals();

      // 备份当前快照，防止重新生成报错时彻底损坏存档
      const backupSnapshot = _.cloneDeep(
        this.chatHistoryCache[this.chatHistoryCache.length - 1],
      );

      try {
        // 1. 牢牢抓住上一回合发送的原汁原味的完整指令（包含随机事件等一切状态）
        const promptToResend = this.lastSentPrompt;

        // 提取纯文字塞回输入框（视觉恢复，防止玩家心血白费）
        let pureUserText = "";
        const match = promptToResend.match(
          /\{\{setvar::我的行动::([\s\S]*?)\}\}/,
        );
        if (match) {
          pureUserText = match[1].trim();
        } else {
          const actionMatch =
            promptToResend.match(/\[我的行动\]([\s\S]*?)$/);
          if (actionMatch)
            pureUserText = actionMatch[1]
              .replace(/\{\{setvar.*/g, "")
              .trim();
        }
        const inputArea =
          document.getElementById("quick-send-input");
        if (inputArea) {
          inputArea.value = pureUserText;
          if (typeof this.resetInputState === "function")
            this.resetInputState();
        }

        // 2. 一键静默执行完美回退手术 (将系统状态完美还原到发送前的瞬间！)
        // 这里包含了截断世界书、同步酒馆数据、恢复MVU状态、渲染目录等所有复杂操作
        await this._executeSilentRollback();

        // 3. 准备加载UI
        this.isBusy = true;
        this.showWaitingMessage();
        this._streamLoadingHidden = false;

        // 4. 终极还原：绕过 handleAction 的一切判定，直接呼叫底层接口！
        // 这样就绝对不会再次触发未命中的随机事件，也不会丢失补充指令
        console.log("[重新生成] 阶段最后: 重新发送AI请求");
        const generateConfig = {
          injects: [
            {
              role: "user",
              content: promptToResend,
              position: "in_chat",
              depth: 0,
              should_scan: true,
            },
          ],
          should_stream: this.isStreamingEnabled,
        };
        await TavernHelper.generate(generateConfig);
        console.log("[重新生成] ✅ 重新生成流程完成");
      } catch (error) {
        console.error("[重新生成] ❌ 重新生成失败:", error);
        this.showTemporaryMessage(
          `[重新生成] ❌ 生成请求中断或失败，尝试恢复备份快照...`,
          2000,
        );
        this.isBusy = false;
        this.hideWaitingMessage(true);
        this._streamLoadingHidden();

        // 触发终极兜底：恢复备份快照
        try {
          this.chatHistoryCache.push(backupSnapshot);
          await AppStorage.saveData(
            this._getHistoryKey(),
            this.chatHistoryCache,
          );

          // 再次利用顶级防线恢复UI和状态
          await this.jumpToHistory(
            this.chatHistoryCache.length - 1,
          );

          this.showTemporaryMessage(
            `重新生成失败: ${error.message}\n\n✅ 已成功恢复到之前的状态。`,
            5000,
          );
        } catch (restoreError) {
          console.error(
            "[重新生成] ❌ 恢复备份失败:",
            restoreError,
          );
          this.showTemporaryMessage(
            `重新生成失败: ${error.message}\n\n❌ 恢复备份也失败了！强烈建议刷新页面。`,
            10000,
          );
        }
      } finally {
        this.isRerolling = false; // 释放执行锁
      }
    },
  );
},
async _executeSilentRollback() {
  // 1. 挥剑斩断：弹出最新的快照，游标回退
  this.chatHistoryCache.pop();
  this.historyViewIndex = this.chatHistoryCache.length - 1;

  // 2. 固化新时间线
  await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
  const targetSnapshot = this.chatHistoryCache[this.historyViewIndex];

  // 3. 🌟【修复点1：顺序提前】完美恢复所有内存状态
  this.currentMvuState = validateAndMigrateStatData(_.cloneDeep(targetSnapshot.data));

  if (targetSnapshot.data.gacha_data) {
    this.gachaState = _.cloneDeep(targetSnapshot.data.gacha_data.state);
    this.gachaCollection = _.cloneDeep(targetSnapshot.data.gacha_data.collection);
    this.gachaHistory = _.cloneDeep(targetSnapshot.data.gacha_data.history);
  }
  this.pendingCompanionJoin = null;
  this.pendingAutoSave = null;
  this.isHistoryViewMode = false;

  // 4. 🌟【修复点2：顺序提前】同步酒馆底层记录 (必须在截断世界书前覆盖幽灵文本)
  const messages = await getChatMessages("0");
  if (messages && messages.length > 0) {
    const messageZero = messages[0];
    messageZero.message = targetSnapshot.message;
    messageZero.data = _.cloneDeep(targetSnapshot.data);
    await TavernHelper.setChatMessages([messageZero], { refresh: "none" });
  }

  // 5. 💥 【修复点3：延后执行】换用全新的纯粹手术刀：截断世界书
  // 现在它只能读到干净的内存和干净的底层文本，不会再被“未来数据”污染
  await this._syncLorebookToHistoryIndex(this.historyViewIndex);

  // 6. 重新渲染所有 UI（包括时间线目录）
  this.saveEquipmentState();
  this.savePendingActions();
  this.renderStateAt(targetSnapshot);
  this.renderHistoryControls();

  if (typeof this.buildTimelineDirectory === "function") {
    this.buildTimelineDirectory();
  }
},
async commitHistoryBranch(userMessage) {
  this.showTemporaryMessage("正在回溯时间线...", 2000);
  try {
    // 步骤 1: 截断前端聊天历史记录
    this.chatHistoryCache = this.chatHistoryCache.slice(0, this.historyViewIndex + 1);
    await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
    console.log(`[历史系统] 时间线已在前端回滚至 ${this.chatHistoryCache.length} 条记录。`);

    // 步骤 2: 🌟 【修复点：改为强覆写底层消息，防止出现幽灵记录】 🌟
    const lastValidSnapshot = this.chatHistoryCache[this.chatHistoryCache.length - 1];
    if (lastValidSnapshot) {
      const messages = await getChatMessages("0");
      if (messages && messages.length > 0) {
        const messageZero = messages[0];
        // 核心修复：直接覆写 messageZero 的 message 和 data，绝不创建新 ID
        messageZero.message = lastValidSnapshot.message;
        messageZero.data = _.cloneDeep(this.currentMvuState); 
        await TavernHelper.setChatMessages([messageZero], { refresh: "none" });
        console.log(`[分支同步] 底层消息已被干净覆写，消灭未来幽灵数据`);
      }
    }

    // 步骤 3: 💥 【修复点：延后执行】截断世界书中的“本周目经历”
    await this._syncLorebookToHistoryIndex(this.historyViewIndex);

    // 步骤 4: 退出历史模式并发送新指令
    this.isHistoryViewMode = false;
    this.renderHistoryControls();
    await this.handleAction(userMessage, true);
  } catch (error) {
    console.error("[历史系统] 创建时间分支失败:", error);
    this.showTemporaryMessage(`创建新时间线失败: ${error.message}`);
    await this.returnToPresent();
  }
},




// ==========================================
// === [文本解析与流程拦截器] 独立模块 ===
// ==========================================

// 1. 纯数据解析器：只负责将文本转化为结构化数据，不包含任何UI副作用
_parseAiResponse(rawText) {
  if (!rawText) return {};

  // 1. 【先下手为强】趁文本还完整，先把思维链提取出来保存（如果你的 UI 需要展示它）
  // 收集所有候选标签按出现顺序排序：拼接后的回合文本里，正文模型的思维链在前，变量模型的在后
  const _collectThinkingBlocks = (tag) => {
    const r = new RegExp("<" + tag + "(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/" + tag + ">", "gi");
    return [...rawText.matchAll(r)].map(m => ({ index: m.index, content: (m[1] || "").trim() }));
  };
  const _allThinkingBlocks = [
    ..._collectThinkingBlocks("reasoning"),
    ..._collectThinkingBlocks("thinking"),
    ..._collectThinkingBlocks("think")
  ].sort((a, b) => a.index - b.index).map(x => x.content).filter(Boolean);

  let thinkingNarrative = null;
  let thinkingVariable = null;
  if (_allThinkingBlocks.length >= 2) {
    // 多段：第一段归正文模型，最后一段归变量模型
    thinkingNarrative = _allThinkingBlocks[0];
    thinkingVariable = _allThinkingBlocks[_allThinkingBlocks.length - 1];
  } else if (_allThinkingBlocks.length === 1) {
    // 单段：用 <UpdateVariable> 标签判断归属（变量模型必定输出该标签）
    if (/<UpdateVariable[\s>]/i.test(rawText)) {
      thinkingVariable = _allThinkingBlocks[0];
    } else {
      thinkingNarrative = _allThinkingBlocks[0];
    }
  }
  const thinkingContent = thinkingVariable || thinkingNarrative;

  // 2. 【物理超度】彻底抹除所有的“内心戏”和 safe 标签
  // 这一步之后，AI 在思考过程里意淫的任何 UpdateVariable 或 gametxt 都会灰飞烟灭
  let sanitizedText = rawText.replace(createSafeRegex("safe"), "");
  
  // 使用循环确切地清除所有可能出现的思维链标签
  ["thinking", "reasoning", "think"].forEach(tag => {
      // 使用非贪婪全局匹配，清空所有思维链区块
      sanitizedText = sanitizedText.replace(createSafeRegex(tag), "");
  });

  // textForValidation 现在的职责和 sanitizedText 重合了，直接复用
  const textForValidation = sanitizedText;
    
  // 3. 【绝对安全的数据提取】现在提取变量、动作、正文，全部基于已经没有思维链的 sanitizedText
  const extractedVarRaw = this._extractLastTagContent("UpdateVariable", sanitizedText, true) || "";
  
  const jsonPatchRegex = new RegExp("<\\/?JSONPatch[^>]*>", "gi"); 
  const cleanedVar = extractedVarRaw
    .replace(createSafeRegex("Analysis"), "") 
    .replace(jsonPatchRegex, "")              
    .trim();

  const actionText = this._extractLastTagContent("action", sanitizedText);

  // 4. 组装返回数据（全部使用 sanitizedText 来防止思维链干扰）
  return {
    rawContent: rawText,
    cleanedText: sanitizedText, // 现在的 cleanedText 是干干净净的
    textForValidation,
    variables: cleanedVar,
    thinking: thinkingContent,  // 使用第一步提前安全提取的内容
    thinkingNarrative: thinkingNarrative,
    thinkingVariable: thinkingVariable,
    danmaku: this._extractAllTags("dm", sanitizedText) || [],
    novelText: this._extractLastTagContent("gametxt", sanitizedText),
    journey: this._extractLastTagContent("本周目经历", sanitizedText),
    pastLives: this._extractLastTagContent("历史的投影", sanitizedText),
    characterCard: this._extractLastTagContent("角色提取", sanitizedText) || this._extractLastTagContent("CharacterCard", sanitizedText),
    itemCard: this._extractLastTagContent("物品提取", sanitizedText),
    coreMemory: this._extractLastTagContent("本周目核心记忆", sanitizedText),
    clues: this._extractLastTagContent("当前线索", sanitizedText),
    actions: actionText ? this._parseActions(actionText) : [],
    displayText: this._stripForbiddenWords(this._getDisplayText(sanitizedText)) // 传入净化后的文本
  };
},

// 2. 幽灵事件判定器：剥离文本质量检查，仅保留环境检查
_isGhostEvent() {
  const isInitNotDone = window.GameInitState !== "READY";
  
  if (isInitNotDone) {
    console.log("[handleStreamEnd] 过滤系统级幽灵事件：游戏未完成初始化。");
    return true;
  }
  return false;
},

// 3. 智能总结拦截器：专职处理DOM
_handleSummaryHijack(finalText) {
  console.log("[智能总结器] 已劫持生成结果。");
  this.isSummarizing = false;
  try {
    const summaryText = finalText.trim();
    if (!summaryText) throw new Error("AI未能生成有效的摘要内容。");

    const outputContainer = document.getElementById("summarizer-output-container");
    const footer = document.getElementById("summarizer-footer");
    if (outputContainer && footer) {
      outputContainer.innerHTML = `<textarea id="summarizer-output">${summaryText}</textarea>`;
      footer.innerHTML = `<button id="btn-write-summary" class="interaction-btn primary-btn">写入核心记忆</button>`;

      const generateBtn = document.getElementById("btn-generate-summary");
      const mode = generateBtn.dataset.mode;
      const lastEventId = generateBtn.dataset.lastEventId;

      document.getElementById("btn-write-summary").addEventListener("click", () =>
        this.writeSummaryToLorebook(mode, lastEventId)
      );
    }
  } catch (e) {
    const outputContainer = document.getElementById("summarizer-output-container");
    if (outputContainer) outputContainer.innerHTML = `<p class="modal-placeholder">生成摘要失败: ${e.message}</p>`;
    document.getElementById("btn-generate-summary").disabled = false;
  }
},

// 4. 二次精炼拦截器：专职处理DOM
_handleRefineHijack(finalText) {
  console.log("[二次精炼器] 已劫持生成结果。");
  this.isRefining = false;
  try {
    const refinedText = finalText.trim();
    if (!refinedText) throw new Error("AI未能生成有效的精炼内容。");

    const outputContainer = document.getElementById("refine-output-container");
    const footer = document.getElementById("refine-footer");
    if (outputContainer && footer) {
      outputContainer.innerHTML = `<textarea id="refine-output">${refinedText}</textarea>`;
      footer.innerHTML = `<button id="btn-write-refine" class="interaction-btn primary-btn">应用精炼内容</button>`;

      document.getElementById("btn-write-refine").addEventListener("click", () =>
        this.writeRefineToLorebook(refinedText)
      );
    }
  } catch (e) {
    const outputContainer = document.getElementById("refine-output-container");
    if (outputContainer) outputContainer.innerHTML = `<p class="modal-placeholder">生成精炼失败: ${e.message}</p>`;
    document.getElementById("btn-generate-refine").disabled = false;
  }
},

// 5. 变量修改拦截器：专职处理DOM与状态恢复
_handleVariableFixHijack(finalText) {
  console.log("[变量修改拦截器] 已接管生成结果，准备更新面板。");
  
  // 1. 关掉拦截锁与防抖锁
  this.isFixingVariable = false;
  this.isFixBusy = false;

  const rawCommandsEl = document.getElementById("raw-commands");
  const aiFixBtn = document.getElementById("ai-fix-variables");

  try {
    const fixText = finalText.trim();
    if (!fixText) throw new Error("AI未能生成有效的修改指令。");

    // 2. 成功获取文本，更新到输入框
    if (rawCommandsEl) {
      rawCommandsEl.value = fixText;
    }
    
    this.showTemporaryMessage("🎉 AI 辅助修改完成，请检查代码后点击「再次应用」！", 4000);

  } catch (e) {
    console.error("[变量修改拦截器] 劫持更新失败:", e);
    this.showTemporaryMessage(`应用结果失败: ${e.message}`, 4000);
  } finally {
    // 3. 无论成功与否，必定恢复 UI 交互状态
    if (rawCommandsEl) {
      rawCommandsEl.disabled = false;
    }
    if (aiFixBtn) {
      aiFixBtn.innerHTML = "✨ AI 辅助修改";
      aiFixBtn.style.opacity = "1";
      aiFixBtn.style.cursor = "pointer";
    }
  }
},

// 5. 角色卡生成处理器
async _handleCharacterCardGeneration(charName, cardContent) {
  if (!cardContent) {
    this.showTemporaryMessage(`警告：AI回复中未找到“${charName}”的角色卡标签，请手动检查。`, 5000);
    return;
  }
  try {
    const bookName = WorldbookManager.PRIMARY_BOOK;
    const allEntries = await TavernHelper.getLorebookEntries(bookName);
    const targetEntry = allEntries.find((entry) => entry.comment === charName);
    if (targetEntry) {
      await TavernHelper.setLorebookEntries(bookName, [{ uid: targetEntry.uid, content: cardContent }]);
      this.showTemporaryMessage(`已成功为“${charName}”生成并写入角色卡！`, 3000);
    } else {
      throw new Error(`未找到名为“${charName}”的世界书条目。`);
    }
  } catch (error) {
    this.showTemporaryMessage(`错误：写入“${charName}”的角色卡失败！`, 4000);
  }
},




// --- 增强版 AI 回复格式验证工具 ---
// 传入需要校验的文本，以及该模型【必须闭合】的标签和【必须存在】的标签
validateAiResponseFormat(responseText, criticalTags = [], requiredTags = []) {
  const errors = [];
  
  // 1. 检查闭合性
  for (const tag of criticalTags) {
    // 使用与 autoFix 一致的宽容正则：忽略大小写，允许末尾空格或多余属性
    const openTagRegex = new RegExp(`<${tag}(?:\\s+[^>]*)?>`, "gi");
    const closeTagRegex = new RegExp(`</${tag}\\s*>`, "gi");

    const openTagCount = (responseText.match(openTagRegex) || []).length;
    const closeTagCount = (responseText.match(closeTagRegex) || []).length;

    if (openTagCount > 0 || closeTagCount > 0) {
      if (openTagCount !== closeTagCount) {
        // 🌟 修改点 1：将 <${tag}> 替换为 [${tag}] 
        errors.push(`标签 [${tag}] 未正确闭合 (开始: ${openTagCount}个, 结束: ${closeTagCount}个)。`);
      }
    }
  }

  // 2. 检查必须存在的标签
  for (const tag of requiredTags) {
    const tagRegex = new RegExp(`<${tag}(?:\\s+[^>]*)?>[\\s\\S]*?</${tag}\\s*>`, "i");
    if (!tagRegex.test(responseText)) {
      // 🌟 修改点 2：将 <${tag}> 替换为 [${tag}] 
      errors.push(`回复中缺少必需的 [${tag}] 标签片段。`);
    }
  }

  return {
    isValid: errors.length === 0,
    errorMessages: errors,
  };
},

// 核心状态同步与调度函数 (兼容兜底/单轨版)
async processValidResponse(responseText, parsedData = null) {
  console.log(`%c[处理响应] 开始执行单轨结算`, "color: green;");
  
  let retry = 0;
  while (!this.isStatInitialized && retry < 10) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    retry++;
  }
  if (!this.isStatInitialized) {
    this.currentMvuState = this.currentMvuState || { stat_data: {}, world_data: {} };
    this.currentMvuState.stat_data = await this.readInitVarData();
    migrateCurrentTimeEraDomain(this.currentMvuState, "第五纪1349年6月28日 星期一 7:00");
    this.isStatInitialized = true;
  }

  try {
    const data = parsedData || this._parseAiResponse(responseText);
    const cleanedVar = data.variables;
    this.lastExtractedVariables = cleanedVar ? `__UPDATE_VAR__${cleanedVar}` : null;
    
    await this.loadAndDisplayCurrentScene(responseText);

    // 状态演算层：计算基础变更
    if (cleanedVar) {
      const modifiedState = await this._applyUpdateFallback(cleanedVar, this.currentMvuState);
      if (modifiedState) this.currentMvuState = _.cloneDeep(modifiedState);
    }
    
    // 🌟 核心接入：把以前一长串的代码，全浓缩成这一句！
    await this._executeTurnSettlement(responseText);

    // 🚀 后执行写入与存档
    await this._syncAllDataToWorldbook();
    
    // 渲染悬浮面板指令
    if (cleanedVar) {
      const { patchCommands, formattedPatchText } = this._processJsonPatchCommandsEnhanced(cleanedVar);
      this.renderVariablePanel(patchCommands, formattedPatchText, cleanedVar);
    }

    // 存储同步层
    if (!this.isTrueNewGame) {
      const messages = await getChatMessages("0");
      if (messages?.[0]) {
        const stateWithoutEquipment = _.cloneDeep(this.currentMvuState);
        if (stateWithoutEquipment.data) delete stateWithoutEquipment.data.equipped_items;
        messages[0].message = responseText;
        messages[0].data = stateWithoutEquipment.data || {};
        await TavernHelper.setChatMessages([messages[0]], { refresh: "affected" });
      }
      await this._finalizeTurn(responseText);
    } else {
      // 第一回合专属逻辑
      this.chatHistoryCache[0].data = _.cloneDeep(this.currentMvuState);
      await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
      const messages = await getChatMessages("0");
      if (messages?.[0]) {
        messages[0].data = messages[0].data || {};
        messages[0].data.stat_data = _.cloneDeep(this.currentMvuState.stat_data);
        messages[0].data.world_data = _.cloneDeep(this.currentMvuState.world_data || {});
        await TavernHelper.setChatMessages([messages[0]], { refresh: "affected" });
      }
    }

    this.isTrueNewGame = false;

  } catch (error) {
    console.error(`处理响应失败:`, error);
    this.showTemporaryMessage(`处理响应失败: ${error.message}`);
  } finally {
    this._clearAllLocks(true); 
  }
},
// ==========================================
// 独立解耦：回合末副作用结算总管
// ==========================================
async _executeTurnSettlement(responseText) {
  console.log("[回合结算] 开始执行能力计算与世界书入库...");
  
  // 🚨 抓内鬼：如果在进来前就碎了，说明上游（比如 VariableAI 或 回滚机制）有问题
  if (!this.currentMvuState) {
    console.error("【致命异常】进入结算前 currentMvuState 已丢失！", this.currentMvuState);
  }

  // 1. 补充/更新序列能力 (传入当前状态，并覆盖回去)
  const updatedState = await this.updateAcquiredAbilities(this.currentMvuState);
  if (updatedState) {
    this.currentMvuState = updatedState;
  }
  
  // 2. 渲染最新 UI (必须放在能力更新之后，确保面板能刷出新技能)
  this.renderUI(_.cloneDeep(this.currentMvuState.stat_data));

  if (!this.isTrueNewGame) {
    // 3. 结算资源奖励
    const rewardMsg = this._calculateAndApplyTurnRewards(this.lastUserMessage, responseText, this.currentMvuState);
    if (rewardMsg) this.showTemporaryMessage(rewardMsg, 1500);
    
    // 5. 重置玩家上一回合的输入缓存
    this.lastUserMessage = "";
  }

  // 6. 滚动至底部并清理输入框
  this._cleanupUIAndScroll();
},

// 历史快照固化器 (重构解耦版：接入时空管理局)
async _finalizeTurn(textToSave) {
  let hasPushed = false; // 🌟 新增：入库追踪标记
  try {
    // 1. 构建快照数据对象 (纯数据组装)
    const stateWithoutEquipment = _.cloneDeep(this.currentMvuState);
    delete stateWithoutEquipment.equipped_items;

    // 🔴 核心极简：直接提取文本，剩下的脏活全交给 ChronicleCore！
    const journeyRaw = this._extractLastTagContent("本周目经历", textToSave) || "";
    // 传入 textToSave 和 预期序号 (当前长度 + 1)
    const playerName = this.currentMvuState?.stat_data?.名称 || "";
    const standardMeta = ChronicleCore.buildStandardMeta(journeyRaw, this.chatHistoryCache.length + 1, {}, playerName);

    const newSnapshot = {
      message_id: `frontend-hist-${Date.now()}`,
      message: textToSave,
      is_user: false,
      role: "assistant",
      data: {
        ...stateWithoutEquipment,
        gacha_data: {
          state: _.cloneDeep(this.gachaState),
          collection: _.cloneDeep(this.gachaCollection),
          history: _.cloneDeep(this.gachaHistory),
        },
      },
      meta: standardMeta, // 🚀 完美嵌入标准 Meta！
      timestamp: Date.now(),
    };

    // 2. 更新内存缓存 (控制容量)
    this.chatHistoryCache.push(newSnapshot);
    hasPushed = true; // 🌟 核心：在此刻打上标记，证明它真的进缓存了！

    // 3. 持久化与 UI 重绘
    await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
    this.historyViewIndex = this.chatHistoryCache.length - 1;
    this.renderHistoryControls();
    this.buildTimelineDirectory(); 

    // 4. 触发异步机制：自动坍缩
    if (!this.collapseSettings) await this.loadCollapseSettings();
    if (this.collapseSettings?.autoEnable) {
      const threshold = parseInt(this.collapseSettings.autoThreshold, 10) || 100;
      if (this.chatHistoryCache.length >= threshold) {
        setTimeout(() => {
          this.executeTimelineCollapse(true).catch(e => console.error("[自动坍缩] 报错:", e));
        }, 1000);
      }
    }
} catch (e) {
    console.error("[历史系统] 保存新回合快照失败:", e);
    // 🌟 核心修复：只有在确实 push 进去了之后报错，才允许 pop 吐出来！
    // 绝对不背刺上一回合的正常数据！
    if (hasPushed && this.chatHistoryCache.length > 0) {
      this.chatHistoryCache.pop(); 
    }
    // 💥 必须向上抛出！打断外层的“假成功”结算！
    throw e; 
  }
},




// --- 本地状态更新辅助函数 ---
async _applyLocalUpdate(commandString) {
  if (!this.currentMvuState) return;
  try {
    const newState = await this._applyUpdateFallback(
      `_.${commandString}`,
      this.currentMvuState,
    );
    if (newState) {
      this.currentMvuState = newState;
      // 将更新后的状态静默保存回SillyTavern
      const messages = await getChatMessages("0");
      if (messages && messages.length > 0) {
        const messageZero = messages[0];
        messageZero.data = this.currentMvuState;
        await TavernHelper.setChatMessages([messageZero], {
          refresh: "none",
        });
        console.log("[源堡-本地更新] 已成功应用本地状态变更。");
      }
    }
  } catch (e) {
    console.error("应用本地更新时出错:", e);
  }
},


// 纯数学解析器与 Zod 交付管道 (支持多域分发)
async _applyUpdateFallback(script, currentMvuState) {
  console.log("[_applyUpdateFallback] 开始执行纯数学运算...");
  if (!script || !currentMvuState) return null;

  const newState = _.cloneDeep(currentMvuState);
  
  // 🛡️ 核心修复 1：绝对防御，强制补全三大核心域，铲除 Object.keys(undefined) 的土壤
  if (!newState.stat_data) newState.stat_data = {};
  if (!newState.npc_data) newState.npc_data = {};
  if (!newState.world_data) newState.world_data = {};

  // 🌟 进入 SchemaDerivation 校验上下文（让产业 transform 能跨表读 npc_data 与人物关系列表）
  if (window.SchemaDerivation) {
    window.SchemaDerivation.enter(newState);
  }

  try {

  let globalModified = false; 
  this.errorCommands = [];

  // 1. 获取分类好的指令对象
  const { patchCommands } = this._processJsonPatchCommandsEnhanced(script);
  const domains = ["stat_data", "npc_data", "world_data"];

  // 2. 遍历三个域，分别处理
  for (const domain of domains) {
    const commands = patchCommands[domain];
    if (!commands || commands.length === 0) continue;

    const targetData = newState[domain];
    let domainModified = false; // 🛡️ 核心修复 2：状态必须在域内隔离
    
    // 获取合法顶层路径保护
    const legalTopPaths = domain === "stat_data" 
        ? Object.keys(targetData).filter(key => key !== "$meta") 
        : null;

    for (const patch of commands) {
      try {
        const { op, path: jsonPath, value } = patch;
        const pathArray = jsonPath.split("/").filter((seg) => seg !== "");
        const topPath = pathArray[0];

        if (pathArray.length === 0) {
          this.errorCommands.push(`[${domain}] 指令 ${op}：路径不能为空`);
          continue;
        }

        // stat_data 的根节点保护
        if (legalTopPaths && !legalTopPaths.includes(topPath)) {
          this.errorCommands.push(`[${domain}] 指令 ${op}("${jsonPath}")：非法顶层路径`);
          continue;
        }

        switch (op) {
          case "replace":
          case "add": 
            let finalVal = value;
            if (typeof value === "string" && (value.startsWith("+") || value.startsWith("-"))) {
              const delta = Number(value);
              if (!isNaN(delta)) {
                const currentVal = Number(_.get(targetData, pathArray, 0)) || 0;
                finalVal = currentVal + delta;
              }
            }

            const setResult = this.setNestedValue(targetData, pathArray, finalVal);
            if (!setResult.success) {
              this.errorCommands.push(`[${domain}] 指令 ${op}("${jsonPath}")：${setResult.error}`);
            } else {
              globalModified = true;
              domainModified = true;
            }
            break;

          case "remove":
            if (_.has(targetData, pathArray)) {
              _.unset(targetData, pathArray);
              globalModified = true;
              domainModified = true;
            }
            break;

          default:
            this.errorCommands.push(`[${domain}] 未识别指令：${op}`);
            break;
        }
      } catch (e) {
        this.errorCommands.push(`[${domain}] 指令执行失败：${e.message.slice(0, 30)}`);
      }
    } // End of patch loop

    // 3. 后处理阶段：仅当该域真的被修改时，才执行针对该域的校验
    if (domainModified) {
      if (domain === "stat_data") {
        GameMapManager.LocationEngine.validateAndCorrectLocation(newState.stat_data);
        GameMapManager.updateStatData(newState.stat_data);
      }

      const validation = this._validateWithZodSchema(domain, newState[domain]);
      if (validation.valid) {
        newState[domain] = validation.validatedData;
      } else {
        this.errorCommands.push(validation.error);
      }
    }
    } // End of domain loop

  // 🌟 跨域级联派生：当 npc_data 被改了但 stat_data 没被改时，
  //    强制重新 parse 一次 stat_data，让产业 transform 跨表读到最新的 npc_data
  //    （场景：AI 只改了 NPC 当前序列，产业 BUFF 应该立即反映新档位）
  const npcDataModifiedThisRound = !!(patchCommands.npc_data && patchCommands.npc_data.length > 0);
  const statDataModifiedThisRound = !!(patchCommands.stat_data && patchCommands.stat_data.length > 0);
  if (npcDataModifiedThisRound && !statDataModifiedThisRound && newState.stat_data) {
    try {
      const cascadeValidation = this._validateWithZodSchema('stat_data', newState.stat_data);
      if (cascadeValidation.valid) {
        newState.stat_data = cascadeValidation.validatedData;
        globalModified = true;
        console.log('[跨域级联] npc_data 变动触发产业派生重算');
      }
    } catch (e) {
      console.warn('[跨域级联] stat_data 重新校验失败:', e);
    }
  }

  // 错误提示UI不变
  if (this.errorCommands.length > 0) {
    const errorText = `克莱恩提示：AI流口水了，${this.errorCommands.length}条指令失效！\n` +
      this.errorCommands.slice(0, 5).join("\n") +
      (this.errorCommands.length > 5 ? `\n...等` : "") +
      "\n建议：在变量面板中修正错误后重新应用～";
    this.showTemporaryMessage(errorText, 8000);
  }

  // 🕒 时间流逝引擎接入：变量更新落盘前处理时间触发器
  // 覆盖 AI 推数据 / 悬浮变量编辑器 / 命令行 _.set(...) 等所有走 _applyUpdateFallback 的写入路径
  if (globalModified && window.TimePassageEngine) {
    try {
      window.TimePassageEngine.applyTimePassage(newState);
    } catch (err) {
      console.warn('[TimePassage] applyTimePassage 抛出异常:', err);
    }
  }

  return globalModified ? newState : null;

  } finally {
    // 🌟 无论成功/异常，必须清空 SchemaDerivation 上下文
    if (window.SchemaDerivation) {
      window.SchemaDerivation.exit();
    }
  }
},
// 全局兜底校验 (支持多域路由)
_validateWithZodSchema(domain, obj) {
  try {
    const translatedObj = translateEnKeysToCn(_.cloneDeep(obj));
    let schema;

    // 根据所属的根节点，选择对应的 Zod Schema
    if (domain === "stat_data") {
      schema = window.statDataSchema;
    } else if (domain === "npc_data") {
      // TODO: 未来你可以在 window.npcDataSchema 里定义格式。目前先放行所有数据
      schema = window.npcDataSchema || z.record(z.any()); 
    } else if (domain === "world_data") {
      schema = window.worldDataSchema || z.record(z.any());
    } else {
      throw new Error(`未知的验证域: ${domain}`);
    }

    const result = schema.safeParse(translatedObj);

    if (result.success) {
      return { valid: true, error: "", validatedData: result.data };
    } else {
      const errorMessages = result.error.issues
        .map(issue => `【${issue.path.length > 0 ? issue.path.join(".") : "根节点"}】：${issue.message}`)
        .join("\n");
      return { valid: false, error: `[${domain}] 校验失败：\n${errorMessages}`, validatedData: _.cloneDeep(obj) };
    }
  } catch (e) {
    return { valid: false, error: `[${domain}] 校验异常：${e.message}`, validatedData: null };
  }
},




// ==========================================
// === [回合结算与副作用] 独立模块 ===
// ==========================================

// 1. 资源结算器：专职计算和发放代币（星界之尘/剧场点数），并返回提示文本
_calculateAndApplyTurnRewards(userMessageText, aiResponseText, finalState) {
  const textTotalLength = (userMessageText || "").length + (aiResponseText || "").length;
  const dustEarned = Math.floor(textTotalLength / 250);
  const theaterPointsEarned = Math.floor(textTotalLength / 2000);
  
  let messageParts = [];
  
  if (dustEarned > 0) {
    this.gachaState.astralDust += dustEarned;
    this.saveGachaState();
    this.renderSummonTab();
    messageParts.push(`获得 ${dustEarned} 星界之尘`);
  }
  
  if (theaterPointsEarned > 0) {
    finalState.stat_data["剧场点数"] = (finalState.stat_data["剧场点数"] || 0) + theaterPointsEarned;
    this.currentMvuState.stat_data["剧场点数"] = finalState.stat_data["剧场点数"];
    this.syncTheaterPoints(); // 如果这个方法依赖外部，确保它已被定义
    messageParts.push(`获得 ${theaterPointsEarned} 剧场点数`);
  }

  return messageParts.length > 0 ? `灵性与高维剧场正在回响... ${messageParts.join("，")}` : null;
},
// ==========================================
// 💾 统一写入总管：回合结束时，一次性结算所有开关与写入
// ==========================================
async _syncAllDataToWorldbook() {
  console.log("[源堡] 开始执行回合末世界书统一入库...");

  try {
    // 1. 核心与线索写入 (通用自动写入逻辑)
    if (this.isAutoWriteEnabled) {
      if (this.lastExtractedJourney) await this.writeJourneyToLorebook(true);
      if (this.lastExtractedPastLives) await this.writePastLivesToLorebook(true);
      if (this.lastExtractedClues) await this.writeCluesToLorebook(true);
      // 如果你有 writeCoreMemoryToLorebook，也加在这里
    }

    // 2. 小说模式写入
    if (this.isNovelModeEnabled && this.lastExtractedNovelText) {
      await this.writeNovelModeToLorebook(true);
    }

    // 3. 角色卡静默写入
    if (this.isCharacterAutoWriteEnabled && this.lastExtractedCharacterCard) {
      await this.writeCharacterCardToLorebookSilent();
    }

    // 4. 处理其他后台副作用（如入队、自动存档等）
    if (this.pendingCompanionJoin) {
      this.gachaState.activeCompanions.push(this.pendingCompanionJoin);
      this.saveGachaState();
      this.pendingCompanionJoin = null;
    }

    await this.performAutoSave();
    await this.checkForSummaryReminder();
    
    console.log("[源堡] 回合末数据入库全部完成！");
  } catch (error) {
    console.error("[源堡] 世界书统一入库时发生异常:", error);
  }
},
// 新增一个清理助手函数
//已禁用
_clearExtractedCache() {
  return; // 后面所有的赋值代码都会被跳过
  this.lastExtractedJourney = null;
  this.lastExtractedPastLives = null;
  this.lastExtractedNovelText = null;
  this.lastExtractedCharacterCard = null;
  this.lastExtractedCoreMemory = null;
  this.lastExtractedClues = null;
  this.lastExtractedVariables = null;
  this.lastExtractedThinking = null;
  this.lastExtractedDanmaku = [];
  this.lastExtractedActions = [];
},
// ==========================================
// 📥 统一数据总管：增加 isReadOnly 开关，实现数据精准分流
// ==========================================
_updateInstanceData(parsedData, isReadOnly = false) {
  if (!parsedData) return;

  // 🟢 渲染类缓存 (UI 强依赖)：无论是否只读，都必须更新，否则回看历史时无法显示思考和选项
  if (parsedData.thinking) this.lastExtractedThinking = parsedData.thinking;
  if (parsedData.thinkingNarrative) this.lastExtractedThinkingNarrative = parsedData.thinkingNarrative;
  if (parsedData.thinkingVariable) this.lastExtractedThinkingVariable = parsedData.thinkingVariable;
  if (parsedData.danmaku && parsedData.danmaku.length > 0) this.lastExtractedDanmaku = parsedData.danmaku;
  if (parsedData.actions && parsedData.actions.length > 0) this.lastExtractedActions = parsedData.actions;

  // 🔴 入库类缓存 (世界书/变量)：只有在非只读模式（真实回合推进）时才允许更新，杜绝幽灵倒灌
  if (!isReadOnly) {
    if (parsedData.journey) this.lastExtractedJourney = parsedData.journey;
    if (parsedData.pastLives) this.lastExtractedPastLives = parsedData.pastLives;
    if (parsedData.novelText) this.lastExtractedNovelText = parsedData.novelText;
    if (parsedData.characterCard) this.lastExtractedCharacterCard = parsedData.characterCard;
    if (parsedData.coreMemory) this.lastExtractedCoreMemory = parsedData.coreMemory;
    if (parsedData.clues) this.lastExtractedClues = parsedData.clues;
    if (parsedData.variables) {
      this.lastExtractedVariables = `__UPDATE_VAR__${parsedData.variables}`;
    }
  }

  // 读档/强制清空的后门逻辑
  if (parsedData.journey === null && parsedData.variables === null && parsedData.pastLives === null) {
      if (!isReadOnly) {
         this.lastExtractedJourney = null;
         this.lastExtractedPastLives = null;
         this.lastExtractedNovelText = null;
         this.lastExtractedCharacterCard = null;
         this.lastExtractedCoreMemory = null;
         this.lastExtractedClues = null;
         this.lastExtractedVariables = null;
      }
      // UI 缓存无脑清空
      this.lastExtractedThinking = null;
      this.lastExtractedThinkingNarrative = null;
      this.lastExtractedThinkingVariable = null;
      this.lastExtractedDanmaku = [];
      this.lastExtractedActions = [];
  }

  console.log(`[数据总管] 实例数据已静默更新完毕。(只读模式: ${isReadOnly})`);
},

// 3. 视窗清理员：专职处理输入框、模态框和滚动条
_cleanupUIAndScroll() {
  const input = document.getElementById("quick-send-input");
  if (input) input.value = "";
  this.pendingActions = [];
  this.savePendingActions();
  this.closeAllModals();

  setTimeout(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    let scrollableContainer = document.querySelector(".mobile-view .game-container") || document.querySelector(".main-content");
    
    if (scrollableContainer) {
      scrollableContainer.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, 800);
},


//=========从AI回复中提取内容=========


// ==========================================
// UI 场景渲染器
// ==========================================
async loadAndDisplayCurrentScene(messageOrText = null, preParsedData = null, isReadOnly = false) {
  const gameTextDisplay = window.domCacheManager.get("game-text-display", "#game-text-display");
  if (!gameTextDisplay) {
    console.warn("[源堡-UI] ⚠️ game-text-display 节点未找到，跳过场景渲染。");
    return;
  }

  // 定义转义标签，避开正则
  const GAMETXT_OPEN = "\x3Cgametxt\x3E";
  const GAMETXT_CLOSE = "\x3C/gametxt\x3E";

  try {
    let contentToParse = "";
    if (typeof messageOrText === "string") {
      contentToParse = messageOrText;
    } else if (messageOrText && typeof messageOrText === "object") {
      contentToParse = messageOrText.message;
    } else {
      const messages = await getChatMessages(getCurrentMessageId());
      const lastAiMessage = messages ? [...messages].reverse().find((m) => m.role === "assistant") : null;
      if (lastAiMessage) contentToParse = lastAiMessage.message;
    }

    if (!contentToParse) {
      console.warn("[源堡-UI] ⚠️ 未找到可解析的 AI 回复内容，跳过场景渲染。");
      return;
    }

    const parsed = preParsedData || this._parseAiResponse(contentToParse);
    
    // 🛡️ 增加数据校验，防止后面解构时 undefined 报错
    if (!parsed) throw new Error("解析器返回了无效数据");

    const shouldBeReadOnly = this.isHistoryViewMode || isReadOnly;
    this._updateInstanceData(parsed, shouldBeReadOnly);

    // 🌟 将 try-catch 下沉到 requestAnimationFrame 内部，或者在外部组装好安全的 HTML
    requestAnimationFrame(() => {
      try {
        let targetSnapshot = null;
        if (this.isHistoryViewMode && this.chatHistoryCache) {
          targetSnapshot = this.chatHistoryCache[this.historyViewIndex];
        } else if (this.chatHistoryCache && this.chatHistoryCache.length > 0) {
          targetSnapshot = this.chatHistoryCache[this.chatHistoryCache.length - 1];
        }

        // 🔧 修复：在设置新内容前，先清除所有旧的世界线同步报告面板
const oldPanels = gameTextDisplay.querySelectorAll('.auto-system-panel');
oldPanels.forEach(panel => panel.remove());

const automationHtml = targetSnapshot ? this._buildAutomationPanelHtml(targetSnapshot) : "";

// 🛡️ 安全读取 displayText，给个默认值防止 formatMessageContent 崩溃
const safeText = parsed.displayText || "（数据读取异常，正文为空）";
gameTextDisplay.innerHTML = this.formatMessageContent(safeText) + automationHtml;

        
        this.rebindJudgmentInteractions(gameTextDisplay);

        const toggleDisplay = (id, condition) => {
          const el = window.domCacheManager.get(id, `#${id}`);
          if (el) el.style.display = condition ? "flex" : "none";
        };
        
        toggleDisplay("btn-toggle-thinking", !!parsed.thinking);
        toggleDisplay("btn-toggle-dm", !!(parsed.danmaku && parsed.danmaku.length > 0));
        
        this.hideThinkingOverlay();
        this.updateActionOptionsButtonState();
      } catch (rafError) {
        console.error("[源堡-UI] 🚨 渲染帧内发生崩溃:", rafError);
        gameTextDisplay.innerHTML = `${GAMETXT_OPEN}渲染场景时出错：${rafError.message}${GAMETXT_CLOSE}`;
      }
    });

    this.checkBattleStatusAndToggle(parsed.displayText).catch(err => 
      console.error("[战斗状态检测] 自动切换失败:", err)
    );

  } catch (error) {
    console.error("[源堡-UI] 数据准备与加载当前场景时出错:", error);
    gameTextDisplay.innerHTML = `${GAMETXT_OPEN}加载场景数据时出错。${GAMETXT_CLOSE}`;
  }
},
_getCurrentViewSnapshot() {
  if (!Array.isArray(this.chatHistoryCache) || this.chatHistoryCache.length === 0) {
    return null;
  }

  if (this.isHistoryViewMode) {
    return this.chatHistoryCache[this.historyViewIndex] || this.chatHistoryCache.at(-1) || null;
  }

  return this.chatHistoryCache.at(-1) || null;
},
_resolveExtractedContent(preferCurrentView = false) {
  if (preferCurrentView) {
    const snapshot = this._getCurrentViewSnapshot();
    const snapshotMessage = snapshot?.message;
    if (typeof snapshotMessage === "string" && snapshotMessage.trim()) {
      const parsed = this._parseAiResponse(snapshotMessage);
      return {
        journey: parsed.journey || "",
        pastLives: parsed.pastLives || "",
        variables: parsed.variables ? `__UPDATE_VAR__${parsed.variables}` : "",
        novelText: parsed.novelText || "",
        characterCard: parsed.characterCard || "",
        coreMemory: parsed.coreMemory || "",
        clues: parsed.clues || "",
      };
    }
  }

  return {
    journey: this.lastExtractedJourney || "",
    pastLives: this.lastExtractedPastLives || "",
    variables: this.lastExtractedVariables || "",
    novelText: this.lastExtractedNovelText || "",
    characterCard: this.lastExtractedCharacterCard || "",
    coreMemory: this.lastExtractedCoreMemory || "",
    clues: this.lastExtractedClues || "",
  };
},
_refreshExtractedContentModal(shouldOpen = false) {
  if (shouldOpen) this.openModal("extracted-content-modal");

  const extracted = this._resolveExtractedContent(true);
  const journeyEl = document.getElementById("extracted-journey");
  const pastLivesEl = document.getElementById("extracted-past-lives");
  const variablesEl = document.getElementById(
    "extracted-variable-changes",
  );
  const sentPromptEl = document.getElementById("sent-prompt-display");
  const journeyBtn = document.getElementById("btn-write-journey");
  const pastLivesBtn = document.getElementById("btn-write-past-lives");
  if (sentPromptEl)
    sentPromptEl.textContent =
      this.lastSentPrompt || "尚未发送任何内容";
  if (journeyEl)
    journeyEl.textContent =
      extracted.journey || "未提取到内容";
  if (pastLivesEl)
    pastLivesEl.textContent =
      extracted.pastLives || "未提取到内容";
  if (variablesEl)
    variablesEl.textContent =
      extracted.variables || "本次无变量改变";
  if (journeyBtn) journeyBtn.disabled = !extracted.journey;
  if (pastLivesBtn) pastLivesBtn.disabled = !extracted.pastLives;
  const novelModeEl = document.getElementById("extracted-novel-mode");
  const novelModeBtn = document.getElementById(
    "btn-write-novel-mode",
  );
  if (novelModeEl && novelModeBtn) {
    novelModeEl.textContent =
      extracted.novelText ||
      "当前AI回复中未提取到正文内容。";
    novelModeBtn.disabled = !extracted.novelText;
  }
  const characterCardEl = document.getElementById(
    "extracted-character-card",
  );
  const characterCardBtn = document.getElementById(
    "btn-write-character-card",
  );
  if (characterCardEl && characterCardBtn) {
    characterCardEl.textContent =
      extracted.characterCard || "未提取到角色卡内容。";
    characterCardBtn.disabled = !extracted.characterCard;
  }
},
showExtractedContent() {
  this._refreshExtractedContentModal(true);
},
// ==========================================
// 世界书内容合并策略器 (全面接入 ChronicleCore 版)
// ==========================================
_mergeLorebookContent(baseEntryKey, existingContent, newContent) {
  existingContent = existingContent || "";
  
  if (baseEntryKey === "本周目经历") {
    const existingEvents = this.parseJourneyEntry(existingContent);
    const newEvents = this.parseJourneyEntry(newContent);
    if (newEvents.length === 0) return { content: existingContent, changed: false, msg: "无新事件" };
    

    const newEvent = newEvents[0];
    const eventIndex = existingEvents.findIndex(ev => ev["序号"] === newEvent["序号"]);
    


    let msg = "";
    if (eventIndex !== -1) {
      existingEvents[eventIndex] = newEvent;
      msg = `已更新事件 #${newEvent["序号"]}。`;
    } else {
      existingEvents.push(newEvent);
      msg = `已追加新事件 #${newEvent["序号"]}。`;
    }
    
    existingEvents.sort((a, b) => (parseInt(a.序号, 10) || 0) - (parseInt(b.序号, 10) || 0));
    return { content: existingEvents.map(ev => this.stringifyJourneyEvent(ev)).join("\n\n"), changed: true, msg };
    
  } else if (baseEntryKey === "本周目核心记忆" || baseEntryKey === "当前线索") {
    // 覆写策略
    return { content: newContent, changed: true, msg: `已更新。` };
  } else {
    // 追加策略 (去重)
    if (existingContent.includes(newContent)) {
      return { content: existingContent, changed: false, msg: "内容已存在，无需重复写入。" };
    }
    return { content: existingContent + (existingContent ? "\n\n" : "") + newContent, changed: true, msg: `已追加内容。` };
  }
},

// ==========================================
// 世界书 I/O 服务 (搭配 scope: primary 使用)
// ==========================================
async writeToLorebook(baseEntryKey, contentToWrite, silent = false) {
  if (!contentToWrite || contentToWrite.trim() === "") {
    if (!silent) this.showTemporaryMessage("没有可写入的内容。");
    return;
  }

  const finalEntryKey = this.unifiedIndex > 1 ? `${baseEntryKey}(${this.unifiedIndex})` : baseEntryKey;
  const reformattedContent = contentToWrite.trim();

  try {
    // 🚀 [绝对核心]：强行指定 scope: 'primary'！只认主库！
    // 副库里的东西再多，也别来碰瓷干扰我的读取逻辑。
    const existingEntries = await WorldbookManager.fetchEntries(finalEntryKey, { 
      exactMatch: true, 
      scope: 'primary' 
    });
    
    const targetEntry = existingEntries[0];
    const isNewCreation = !targetEntry;

    // 2. 调用纯策略器合并内容
    let finalContent = reformattedContent;
    if (!isNewCreation) {
      const mergeResult = this._mergeLorebookContent(baseEntryKey, targetEntry.content, reformattedContent);
      if (!mergeResult.changed) {
        if (!silent) this.showTemporaryMessage(mergeResult.msg);
        return; // 如果主库确实没变动，才在这里安全退出
      }
      finalContent = mergeResult.content;
      if (!silent) this.showTemporaryMessage(`针对“${finalEntryKey}”：${mergeResult.msg}`);
    } else if (!silent) {
      this.showTemporaryMessage(`主库中 "${finalEntryKey}" 不存在，准备全新创建...`);
    }

    // 3. 构建最纯净的任务包 (不用瞎编字段了，交给你的 processBook 去自动识别)
    const saveTask = {
      comment: finalEntryKey,
      content: finalContent,
      keys: [finalEntryKey],
      enabled: false, 
      strategy: { type: 'selective' }, 
      position: { 
        type: 'at_depth',
        role: 'system',
        depth: 0,
        order: 5000
      }
    };

    // 🚀 交给你的全局工具：它会自动在主库 toCreate，在副库 toUpdate (如果有同名的话)
    await WorldbookManager.saveEntries([saveTask], { backupToLibrary: true });

    if (isNewCreation && !silent) {
      this.showTemporaryMessage(`已创建并写入到主库“${finalEntryKey}”。`);
      if (this.isAutoToggleLorebookEnabled) this.updateAutoToggledEntries();
    }

  } catch (error) {
    console.error(`写入世界书 "${finalEntryKey}" 时出错:`, error);
    if (!silent) this.showTemporaryMessage(`写入失败: ${error.message}`);
  }
},


//=========================================================
//==============变量编辑器和更新系统相关====================
//=========================================================

// JSON Patch指令处理工具函数（整合解析+格式化）
// 功能1：解析输入文本为JSON Patch指令数组（供_applyUpdateFallback使用）
// 功能2：生成格式化的JSON Patch文本（供变量编辑器/悬浮窗编辑使用）
// JSON Patch指令处理工具函数（支持多根节点）
_processJsonPatchCommandsEnhanced(inputText) {
  const normalizedCommands = { stat_data: [], npc_data: [], world_data: [] };
  this.errorCommands = [];
  let formattedPatchText = "";

  try {
    // 步骤1：同时兼容提取 {} 或 [] 包裹的内容
    const jsonMatch = inputText.match(/[\{\[][\s\S]*[\}\]]/);
    if (!jsonMatch) {
      this.errorCommands.push('指令格式错误：需用 {} 或 [] 包裹 JSON 内容');
      return { patchCommands: normalizedCommands, formattedPatchText };
    }

    let jsonStr = jsonMatch[0]
      .replace(/,\s*([\}\]])/g, "$1") // 清理末尾多余逗号
      .replace(/，/g, ",")
      .replace(/：/g, ":");

    const commands = JSON.parse(jsonStr);
    const domainKeys = ["stat_data", "npc_data", "world_data"];

    const normalizePath = (rawPath) => {
      if (typeof rawPath !== "string") return rawPath;
      const trimmedPath = rawPath.trim();
      if (!trimmedPath) return "/";
      const ensuredSlash = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
      return ensuredSlash.replace(/\/+/g, "/");
    };

    const splitDomainPrefix = (rawPath) => {
      const normalizedPath = normalizePath(rawPath);
      if (typeof normalizedPath !== "string") {
        return { domain: null, path: rawPath };
      }

      const pathArray = normalizedPath.split("/").filter(Boolean);
      const topPath = pathArray[0];
      if (domainKeys.includes(topPath)) {
        const strippedSegments = pathArray.slice(1);
        return {
          domain: topPath,
          path: strippedSegments.length > 0 ? `/${strippedSegments.join("/")}` : "/",
        };
      }

      return { domain: null, path: normalizedPath };
    };

    const pushCommand = (cmd, fallbackDomain = "stat_data", sourceDomain = fallbackDomain) => {
      if (!cmd || typeof cmd !== "object") {
        this.errorCommands.push(`[${sourceDomain}] 无效指令：${JSON.stringify(cmd)}`);
        return;
      }

      const { domain: routedDomain, path: routedPath } = splitDomainPrefix(cmd.path);
      const isLegacyEraPath = typeof routedPath === "string" && (routedPath === "/当前时间纪元" || routedPath.startsWith("/当前时间纪元/"));
      const targetDomain = isLegacyEraPath ? "world_data" : (routedDomain || fallbackDomain);
      
      let finalPath = routedPath;
      let finalValue = cmd.value;

      // ==========================================
      // 🚨 AI 脏数据终极拦截与洗脱 (防呆设计核心)
      // ==========================================
      
      // 表现 A: 路径试图向数组追加 (以 /数字 或 /- 结尾) 
      if (typeof finalPath === "string" && (/\/\d+$|\/-$/.test(finalPath)) && typeof finalValue === "string") {
        
        // 改进版正则：匹配第一个 竖线(|) 或 冒号(:/：) 前面的内容作为 Key
        // 捕获组1: Key (例如 "受邀的午宴(7.14)")
        // 捕获组2: Value 的剩余部分 (例如 "香树叶餐厅|接受了...")
        const match = finalValue.match(/^([^|:：]+)[|:：]\s*([\s\S]*)$/);
        
        if (match) {
          let extractedKey = match[1].trim(); 
          
          // ⚠️ 关键修复：消除 Key 中的小数点，防止底层 deep-set 函数引发嵌套断裂
          // 例如把 "受邀的午宴(7.14)" 变成 "受邀的午宴(7_14)"
          extractedKey = extractedKey.replace(/\./g, "_");

          // 把路径末尾的 /0 或 /- 强行替换为正确的键名
          finalPath = finalPath.replace(/\/\d+$|\/-$/, `/${extractedKey}`);
          
          // 如果你希望保留原来的带竖线/冒号的完整字符串，可以不覆盖 finalValue
          // 但如果你只想要后面的内容，可以解开下面这行的注释：
          // finalValue = match[2].trim() || finalValue;
        } else {
          // 如果没匹配到分隔符，只能硬造一个安全的 Key 了
          const safeTimestamp = new Date().getTime();
          finalPath = finalPath.replace(/\/\d+$|\/-$/, `/未命名键_${safeTimestamp}`);
        }
      } 
      
      // 表现 B: 整体替换对象，但 AI 输出了 {"-": "..."} 或 {"0": "..."}
      else if (finalValue && typeof finalValue === "object" && !Array.isArray(finalValue)) {
        const keys = Object.keys(finalValue);
        // 如果对象的 key 都是数字，或者是那个倒霉的 "-"
        if (keys.length > 0 && keys.every(k => !isNaN(k) || k === "-")) {
          const recoveredObj = {};
          const regex = /^([^|:：]+)[|:：]\s*([\s\S]*)$/;
          
          for (const [k, v] of Object.entries(finalValue)) {
            if (typeof v === 'string') {
              const match = v.match(regex);
              if (match) {
                // 同样处理小数点
                let cleanKey = match[1].trim().replace(/\./g, "_");
                recoveredObj[cleanKey] = v; // 这里保留了完整的值 v，如果你想切割，可以用 match[2].trim()
              } else {
                recoveredObj[`未定内容_${k.replace(/\./g, "_")}`] = v; 
              }
            } else {
              recoveredObj[k] = v;
            }
          }
          finalValue = recoveredObj; 
        } else {
          // 表现 C: AI 输出了正常的 Map，但是 Key 里面偷偷塞了小数点！
          // 例如 {"神乎其技(7.14)": "..."}
          // 我们需要遍历清理一遍所有的 Key
          let hasDotInKey = false;
          const cleanObj = {};
          for (const [k, v] of Object.entries(finalValue)) {
            if (k.includes('.')) {
              hasDotInKey = true;
              cleanObj[k.replace(/\./g, "_")] = v;
            } else {
              cleanObj[k] = v;
            }
          }
          if (hasDotInKey) finalValue = cleanObj;
        }
      }
      // ==========================================

      normalizedCommands[targetDomain].push({ 
        ...cmd, 
        path: finalPath, 
        ...(cmd.hasOwnProperty('value') ? { value: finalValue } : {}) 
      });
    };

    // 步骤2：数据结构规范化路由
    if (Array.isArray(commands)) {

      // 兼容旧版：单数组指令按路径前缀自动分发；无前缀的仍默认归入 stat_data
      commands.forEach((cmd) => pushCommand(cmd, "stat_data", "legacy"));
    } else if (typeof commands === "object" && commands !== null) {



      // 新版：分别提取三个域的数组；若域内路径仍带旧前缀，也在这里自动剥离并纠偏，防呆
      domainKeys.forEach((domain) => {
        if (Array.isArray(commands[domain])) {
          commands[domain].forEach((cmd) => pushCommand(cmd, domain, domain));
        }
      });
    } else {
      this.errorCommands.push("指令不是有效的对象或数组格式");
    }

    // 步骤3：校验指令合法性
    const validateDomainCommands = (domainCommands, domainName) => {
      return domainCommands.filter((cmd) => {
        if (cmd && typeof cmd === "object" && ["replace", "add", "remove"].includes(cmd.op) && typeof cmd.path === "string" && cmd.path.startsWith("/")) {
          return true;
        } else {
          this.errorCommands.push(`[${domainName}] 无效指令：${JSON.stringify(cmd)}`);
          return false;
        }
      });
    };

    normalizedCommands.stat_data = validateDomainCommands(normalizedCommands.stat_data, "stat_data");
    normalizedCommands.npc_data = validateDomainCommands(normalizedCommands.npc_data, "npc_data");
    normalizedCommands.world_data = validateDomainCommands(normalizedCommands.world_data, "world_data");

    formattedPatchText = JSON.stringify(normalizedCommands, null, 2);

  } catch (e) {
    this.errorCommands.push(`JSON解析失败：${e.message}`);
    console.error("[解析JSON Patch指令失败]：", e);
  }

  // 返回：分类好的指令对象 + 格式化文本
  return { patchCommands: normalizedCommands, formattedPatchText };
},



//--------面板和显示----------

// ==========================================
// 变量面板悬浮按钮：初始化（拖动+点击）
// ==========================================
initVariablePanelToggle() {
  const floatingToggleBtn = document.getElementById("variable-panel-toggle");
  if (!floatingToggleBtn) {
    console.warn("[变量面板] 未找到悬浮按钮");
    return;
  }

  // 防止重复绑定
  if (floatingToggleBtn.dataset.initialized) return;
  floatingToggleBtn.dataset.initialized = "true";

  // 点击事件：显示/隐藏面板
  floatingToggleBtn.addEventListener("click", (e) => {
    // 如果正在拖动，不触发点击
    if (floatingToggleBtn.dataset.dragging === "true") {
      floatingToggleBtn.dataset.dragging = "false";
      return;
    }

    const panel = document.getElementById("variable-panel");
    if (!panel) {
      this.showTemporaryMessage("变量面板尚未创建，请等待AI生成变量更新", 2000);
      return;
    }

    if (panel.style.display === "none" || !panel.style.display) {
      panel.style.display = "block";
      const bodyEl = panel.querySelector("#ai-var-body");
      const toggleBtn = panel.querySelector("#toggle-minimize-var");
      if (bodyEl) bodyEl.style.display = "block";
      if (toggleBtn) toggleBtn.textContent = "⚪";
    } else {
      panel.style.display = "none";
    }
  });

  // 拖动功能实现
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  floatingToggleBtn.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = floatingToggleBtn.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // 移动超过5px才算拖动
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      floatingToggleBtn.dataset.dragging = "true";
    }

    let newX = Math.max(0, Math.min(window.innerWidth - 48, startLeft + dx));
    let newY = Math.max(0, Math.min(window.innerHeight - 48, startTop + dy));

    floatingToggleBtn.style.left = `${newX}px`;
    floatingToggleBtn.style.top = `${newY}px`;
    floatingToggleBtn.style.right = "auto";
    floatingToggleBtn.style.bottom = "auto";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      // 延迟重置拖动标志，避免立即触发点击
      setTimeout(() => {
        floatingToggleBtn.dataset.dragging = "false";
      }, 100);
    }
  });

  // 触摸设备支持
  let touchMoved = false;
  floatingToggleBtn.addEventListener("touchstart", (e) => {
    touchMoved = false;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    const rect = floatingToggleBtn.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
  }, { passive: true });

  floatingToggleBtn.addEventListener("touchmove", (e) => {
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      touchMoved = true;
      floatingToggleBtn.dataset.dragging = "true";
      e.preventDefault();

      let newX = Math.max(0, Math.min(window.innerWidth - 48, startLeft + dx));
      let newY = Math.max(0, Math.min(window.innerHeight - 48, startTop + dy));

      floatingToggleBtn.style.left = `${newX}px`;
      floatingToggleBtn.style.top = `${newY}px`;
      floatingToggleBtn.style.right = "auto";
      floatingToggleBtn.style.bottom = "auto";
    }
  }, { passive: false });

  floatingToggleBtn.addEventListener("touchend", () => {
    if (touchMoved) {
      setTimeout(() => {
        floatingToggleBtn.dataset.dragging = "false";
      }, 100);
    }
  });
},

// ==========================================
// 变量纠错面板：UI 渲染与事件绑定
// ==========================================
renderVariablePanel(patchCommands, formattedPatchText, originalScript) {
  const gameTextDisplay = document.getElementById("game-text-display");
  if (!gameTextDisplay) {
    console.warn("[变量面板] 未找到游戏文本展示区，渲染终止");
    return;
  }

  let panel = document.getElementById("variable-panel");
  const errorCommands = Array.isArray(this.errorCommands) ? this.errorCommands : [];

  // 1. 如果面板不存在，直接同步插入并立即绑定事件
  if (!panel) {
    const panelHtml = `
      <div id="variable-panel" class="ai-var-panel" style="display: none;">
        <div class="ai-var-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h4 class="ai-var-title">本轮变量更新</h4>
            <span id="error-count" class="ai-var-error-count"></span>
          </div>
          <button id="toggle-minimize-var" class="bare-icon-btn">⚪</button>
        </div>
        
        <div id="ai-var-body">
          <div style="margin-bottom: 10px;">
            <label class="ai-var-label">原始指令：</label>
            <textarea id="raw-commands" class="modal-input" style="min-height: 200px; font-size: var(--text-xs)">在此输入需要修复的JSONPatch格式指令，或者通过宏来输入当前变量，如：\{\{format_message_variable::stat_data\}\}</textarea>
          </div>
          <div id="command-errors" class="ai-var-error-box" style="display: none;">
            <div class="ai-var-error-title">检测到AI更新错误（AI流口水了）：</div>
            <ul id="error-list" class="ai-var-error-list"></ul>
          </div>
          <div class="ai-var-actions">
            <button id="ignore-variables" class="interaction-btn btn-sm-auto">隐藏</button>
            <button id="ai-fix-variables" class="interaction-btn btn-sm-auto" style="background-color: #8b5cf6; color: white; border: none;">✨ 一键修复</button>
            <button id="reprocess-variables" class="interaction-btn primary-btn btn-sm-auto">应用</button>
          </div>
        </div>
      </div>
    `;
    gameTextDisplay.insertAdjacentHTML("afterend", panelHtml);
    panel = document.getElementById("variable-panel");

    const bodyEl = panel.querySelector("#ai-var-body");
    const toggleBtn = panel.querySelector("#toggle-minimize-var");

    // 事件绑定：最小化/展开切换
    toggleBtn.addEventListener("click", () => {
      if (bodyEl.style.display === "none") {
        bodyEl.style.display = "block";
        toggleBtn.textContent = "⚪"; // 展开状态图标
      } else {
        bodyEl.style.display = "none";
        toggleBtn.textContent = "🔘"; // 折叠状态图标（你可以换成更合适的 Icon）
      }
    });

    // 事件绑定：忽略
    panel.querySelector("#ignore-variables").addEventListener("click", () => {
      panel.style.display = "none";
    });

    // 事件绑定：AI 纠错
    panel.querySelector("#ai-fix-variables").addEventListener("click", () => {
      this._handleAIFixRequest(panel);
    });

    // 事件绑定：再次应用
    panel.querySelector("#reprocess-variables").addEventListener("click", () => {
      this._handleReprocessVariables(panel.querySelector("#raw-commands").value, panel);
    });
  }

  // 2. 状态更新 (展开面板并填充数据)
  panel.querySelector("#ai-var-body").style.display = "block";
  panel.querySelector("#toggle-minimize-var").textContent = "⚪";

  panel.querySelector("#raw-commands").value = originalScript || "";
  const errorCountEl = panel.querySelector("#error-count");
  const errorContainerEl = panel.querySelector("#command-errors");
  const errorListEl = panel.querySelector("#error-list");

  if (errorCommands.length > 0) {
    errorCountEl.textContent = `发现 ${errorCommands.length} 处错误`;
    errorListEl.innerHTML = errorCommands.map((err) => `<li>${this.safeEscapeHtml(err)}</li>`).join("");
    errorContainerEl.style.display = "block";
  } else {
    errorCountEl.textContent = "";
    errorContainerEl.style.display = "none"; // 修正：没有错误时隐藏错误区
  }

  // 3. 显现面板
  panel.style.display = "block";

  // 4. 同步悬浮编辑器
  if (window.floatingEditorInstance && originalScript) {
    if (!window.floatingEditorInstance.hasUnsavedChanges) {
      window.floatingEditorInstance.setCommands(originalScript);
      window.floatingEditorInstance.hasUnsavedChanges = false;
    }
  }
},
// ==========================================
// 变量纠错面板：业务控制器 (处理表单提交)
// ==========================================
async _handleReprocessVariables(editedScript, panelElement) {
  const scriptToApply = editedScript.trim();
  if (!scriptToApply) {
    return this.showTemporaryMessage("请输入有效的变量指令");
  }

  try {
    // 1. 调用极简数学计算器 + Zod 兜底洗牌 (直接复用解耦后的方法)
    const newState = await this._applyUpdateFallback(scriptToApply, this.currentMvuState);
    const errors = this.errorCommands || [];

    // 情况 A：更新成功，没有被 Zod 拦截的错误
    if (newState && errors.length === 0) {
      // 锁定新状态并刷新 UI
      this.currentMvuState = _.cloneDeep(newState);
      this.renderUI(this.currentMvuState.stat_data); 

      // 固化数据到当前回合的历史快照中
      const lastSnapshot = this.chatHistoryCache.at(-1);
      if (lastSnapshot) {
        lastSnapshot.data = _.cloneDeep(this.currentMvuState);
        await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
      }

      // 静默同步给 SillyTavern 的当前消息元数据
      const messages = await getChatMessages("0");
      if (messages?.[0]) {
        const stateWithoutEquipment = _.cloneDeep(this.currentMvuState);
        delete stateWithoutEquipment.equipped_items;
        messages[0].data = stateWithoutEquipment.data || stateWithoutEquipment;
        await TavernHelper.setChatMessages([messages[0]], { refresh: "none" });
      }

      this.showTemporaryMessage("变量修正成功并已固化至当前状态！", 3000);
      
      // ✅ 修改点：成功后不销毁面板，而是自动最小化，方便用户复查
      const bodyEl = panelElement.querySelector("#ai-var-body");
      const toggleBtn = panelElement.querySelector("#toggle-minimize-var");
      if (bodyEl && toggleBtn) {
        bodyEl.style.display = "none";
        toggleBtn.textContent = "⚪"; 
      }
    }
    // 情况 B：Zod 或解析器依然报错
    else if (errors.length > 0) {
      this.showTemporaryMessage(`依然存在 ${errors.length} 条错误指令，请修正！`, 3000);
      // 直接局部更新错误列表，不用刷新整个面板
      const errorCountEl = panelElement.querySelector("#error-count");
      const errorContainerEl = panelElement.querySelector("#command-errors");
      const errorListEl = panelElement.querySelector("#error-list");
      
      errorCountEl.textContent = `发现 ${errors.length} 处错误`;
      errorListEl.innerHTML = errors.map((err) => `<li>${this.safeEscapeHtml(err)}</li>`).join("");
      errorContainerEl.style.display = "block";
    } 
    // 情况 C：指令合法，但完全没有改变任何属性
    else {
      this.showTemporaryMessage("未检测到有效状态变更（属性值无变化或已被上限限制）。", 3000);
    }
  } catch (error) {
    this.showTemporaryMessage(`修正应用失败: ${error.message}`, 3000);
    console.error("[变量纠错面板]", error);
  }
},
// ==========================================
// 变量纠错面板：后台 AI 纠错业务流转
// ==========================================
async _handleAIFixRequest(panelElement) {
  // 1. 防抖锁检查
  if (this.isFixBusy) {
    return this.showTemporaryMessage("AI 正在拼命修复，请稍候...", 2000);
  }

  const rawCommandsEl = panelElement.querySelector("#raw-commands");
  const aiFixBtn = panelElement.querySelector("#ai-fix-variables");
  const currentScript = rawCommandsEl.value.trim();
  const errors = Array.isArray(this.errorCommands) ? this.errorCommands : [];

  if (!currentScript) {
    return this.showTemporaryMessage("当前没有可修复的原始指令！");
  }

  // 2. 收集用户意图 (包含无报错时的文案适配)
  const userPrompt = await this.showPromptModal(
    "AI 变量辅助修改",
    "请输入你想对当前变量进行的修改。<br><small>(若存在报错，留空则让 AI 自动修复)</small>",
    "",
    "text",
    'placeholder="例如：把字符串改为对象；规范当前状态的格式"'
  );

  // 如果用户点击了取消
  if (userPrompt === null) return; 

  // 【防呆】如果代码没报错，且玩家也没输入任何要求，直接拦截
  if (errors.length === 0 && !userPrompt.trim()) {
    return this.showTemporaryMessage("当前变量无报错，请输入你想要修改的内容！", 3000);
  }

  // 3. 开启防抖锁，改变 UI 状态
  this.isFixBusy = true;
  const originalBtnText = aiFixBtn.innerHTML;
  aiFixBtn.innerHTML = "⏳ 修复中...";
  aiFixBtn.style.opacity = "0.7";
  aiFixBtn.style.cursor = "not-allowed";
  rawCommandsEl.disabled = true;

  try {
    // 4. 获取模板并组装 Payload
    const fix_variable_template = GameDBManager?.DB?.templates?.fix_variable_template;
    if (!fix_variable_template) throw new Error("缺少 fix_variable_template，请检查数据库配置。");

    let finalUserInput = `【当前原始指令】：\n${currentScript}`;
    
    if (errors.length > 0) {
      finalUserInput += `\n\n【系统检测到的报错信息】：\n${errors.join('\n')}`;
    } else {
      finalUserInput += `\n\n【系统状态】：\n当前指令无语法报错，但可能存在格式不规范的问题，你需要按照玩家的修改指示重写指令。`;
    }

    if (userPrompt.trim()) {
      finalUserInput += `\n\n【玩家的修改指示】：\n${userPrompt.trim()}`;
    }

    const generateConfig = {
      should_silence: true,
      should_stream: false, 
      max_chat_history: 0, 
      user_input: finalUserInput,
      ordered_prompts: [
        { role: "system", content: fix_variable_template },
        { role: "system", content: finalUserInput },
        { 
          role: "assistant", 
          content: "<思考>\n好的，本轮思考完毕，接下来我将按照系统指令直接输出<JSONPatch>中的内容，无废话，并且严格按照<变量更新规则>中的格式。\n</思考>" 
        }
      ]
    };

    if (this.varAiUseCustom && this.varAiApiUrl) {
      generateConfig.custom_api = {
        apiurl: this.varAiApiUrl,
        key: this.varAiApiKey,
        model: this.varAiModel,
        source: 'openai'
      };
    }

    console.log("[AIFix] 正在呼叫后台 AI 进行变量辅助修改...", generateConfig);

    // 5. 开启劫持锁并发送请求
    this.isFixingVariable = true; 
    
    const apiCaller = typeof generateRaw === 'function' ? generateRaw : TavernHelper.generateRaw;
    const response = await apiCaller(generateConfig);

    if (!response || response.trim() === "") {
      throw new Error("请求成功，但 AI 返回了空白结果。");
    }

    // 6. 成功返回后，将结果直接移交给专属拦截器处理，当前函数功成身退
    this._handleVariableFixHijack(response);

  } catch (error) {
    console.error("[AIFix] 辅助修改失败:", error);
    this.showTemporaryMessage(`辅助修改失败: ${error.message || "未知网络错误"}`, 4000);
    
    // 如果在请求阶段抛出异常，这里负责回退 UI 和锁状态
    this.isFixBusy = false;
    this.isFixingVariable = false;
    aiFixBtn.innerHTML = originalBtnText;
    aiFixBtn.style.opacity = "1";
    aiFixBtn.style.cursor = "pointer";
    rawCommandsEl.disabled = false;
  }
},



//------------悬浮变量编辑器相关---------------
// 监听全屏状态变化，调整悬浮变量编辑器位置在屏幕内
setupFullscreenListener() {
  const handleFullscreenChange = () => {
    const modalsOutsideRoot = document.querySelectorAll(
      "body > .modal-overlay",
    );
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    const rootContainer = document.querySelector(
      ".game-root-container",
    );

    if (isFullscreen && rootContainer) {
      // 进入全屏：将body下的模态框移动到全屏容器内
      modalsOutsideRoot.forEach((modal) => {
        // 保存原始父元素
        if (!modal.dataset.originalParent) {
          modal.dataset.originalParent = "body";
        }
        rootContainer.appendChild(modal);
        modal.style.zIndex = "100000";
      });

      // 修复：同时处理悬浮编辑器
      const floatingToggle = document.getElementById(
        "floating-editor-toggle",
      );
      const floatingPanel = document.getElementById(
        "floating-editor-panel",
      );

      if (
        floatingToggle &&
        floatingToggle.parentElement === document.body
      ) {
        floatingToggle.dataset.originalParent = "body";
        rootContainer.appendChild(floatingToggle);
        console.log(
          "[全屏监听器] 将悬浮编辑器按钮移动到全屏容器",
        );
      }
      if (
        floatingPanel &&
        floatingPanel.parentElement === document.body
      ) {
        floatingPanel.dataset.originalParent = "body";
        rootContainer.appendChild(floatingPanel);
        console.log(
          "[全屏监听器] 将悬浮编辑器面板移动到全屏容器",
        );
      }
    } else {
      // 退出全屏：将模态框移回body
      const modalsInRoot = document.querySelectorAll(
        ".game-root-container > .modal-overlay",
      );
      modalsInRoot.forEach((modal) => {
        if (modal.dataset.originalParent === "body") {
          document.body.insertBefore(
            modal,
            document.body.firstChild,
          );
          modal.style.zIndex = "";
          delete modal.dataset.originalParent;
        }
      });

      // 修复：处理悬浮编辑器
      const floatingToggle = document.getElementById(
        "floating-editor-toggle",
      );
      const floatingPanel = document.getElementById(
        "floating-editor-panel",
      );

      if (
        floatingToggle &&
        floatingToggle.dataset.originalParent === "body"
      ) {
        document.body.appendChild(floatingToggle);
        delete floatingToggle.dataset.originalParent;
        console.log("[全屏监听器] 将悬浮编辑器按钮移回body");
      }
      if (
        floatingPanel &&
        floatingPanel.dataset.originalParent === "body"
      ) {
        document.body.appendChild(floatingPanel);
        delete floatingPanel.dataset.originalParent;
        console.log("[全屏监听器] 将悬浮编辑器面板移回body");
      }
    }

    // 修复：通知FloatingEditor实例更新
    if (
      window.floatingEditorInstance &&
      window.floatingEditorInstance.ensureCorrectParent
    ) {
      window.floatingEditorInstance.ensureCorrectParent();
    }
  };

  // 监听多种全屏事件以兼容不同浏览器
  document.addEventListener(
    "fullscreenchange",
    handleFullscreenChange,
  );
  document.addEventListener(
    "webkitfullscreenchange",
    handleFullscreenChange,
  );
  document.addEventListener(
    "mozfullscreenchange",
    handleFullscreenChange,
  );
  document.addEventListener(
    "MSFullscreenChange",
    handleFullscreenChange,
  );
},

//======= 处理AI生成内容工具 (防WAF & 高容错版) =========

_autoFixTags(text, tagsToFix = []) {
  let fixedText = text;
  // 遍历传入的需要修复的标签数组
  for (const tag of tagsToFix) {
    // 允许标签名后带有空格或属性
    const openTagRegex = new RegExp("<" + tag + "(?:\\s+[^>]*)?>", "gi");
    const closeTagRegex = new RegExp("<\\/" + tag + ">", "gi");

    const openMatches = [...fixedText.matchAll(openTagRegex)];
    const closeMatches = [...fixedText.matchAll(closeTagRegex)];

    if (openMatches.length > closeMatches.length) {
      console.log(`[VariableAI] 检测到标签 <${tag}> 未闭合。正在尝试修复...`);

      const lastOpenTag = openMatches[openMatches.length - 1];
      const startIndex = lastOpenTag.index + lastOpenTag[0].length;

      // 【安全改造】移除字面量正则，使用动态生成的 RegExp 来匹配下一个任意标签
      const nextTagRegex = new RegExp("<\\\\/?\\\\w+[^>]*>"); 
      const nextTagMatch = fixedText.substring(startIndex).match(nextTagRegex);
      
      let insertPosition = fixedText.length;

      if (nextTagMatch && nextTagMatch.index !== undefined) {
        insertPosition = startIndex + nextTagMatch.index;
      }

      fixedText =
        fixedText.slice(0, insertPosition).trim() +
        `\n</${tag}>\n` +
        fixedText.slice(insertPosition);
    }
  }
  return fixedText;
},

_extractLastTagContent(tagName, text, ignoreCase = false) {
  if (!text || typeof text !== "string") return null;
  
  // 【超强容错改造】
  // 正则解析：允许 <tag> 内部带有属性 (如 <tag lang="zh">) 或空格
  // (?:\\s+[^>]*)? 代表非捕获组，匹配空格+任意非'>'字符
  const flags = ignoreCase ? "gi" : "g";
  const regex = new RegExp("<" + tagName + "(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/" + tagName + ">", flags);
  
  const matches = [...text.matchAll(regex)];
  
  if (matches.length > 0) {
    // 取最后一个匹配项的第1个捕获组（即标签内部的文本）
    return matches[matches.length - 1][1].trim();
  }
  
  return null;
},

_extractAllTags(tagName, text) {
  if (!text || typeof text !== "string") return [];
  
  // 【超强容错改造】同样增加对属性和空格的兼容
  const regex = new RegExp("<" + tagName + "(?:\\s+[^>]*)?>\\s*([\\s\\S]*?)\\s*<\\/" + tagName + ">", "gi");
  const matches = [...text.matchAll(regex)];
  
  // 提取捕获组内容，过滤掉空值
  return matches.map((m) => (m[1] ?? "").trim()).filter(Boolean);
},
_parseCommandValue(valStr) {
  if (typeof valStr !== "string") return valStr;

  // 1. 预处理：移除前缀并清理空格
  const trimmed = valStr.replace(/^__UPDATE_VAR__/, "").trim();

  // 2. 快速处理基础类型
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null" || trimmed === "undefined") return undefined;

  // 3. 尝试解析对象或数组
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || 
      (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    
    let fixedVal = trimmed;
    try {
      // 关键修复：使用函数回调 (match, p1, p2...) 而不是字符串 "$1"
      // 这样可以绕过 SillyTavern 对 $ 符号的正则劫持
      fixedVal = trimmed.replace(
        /([{,]\s*)([\u4e00-\u9fa5a-zA-Z0-9_]+)(\s*:)/g,
        (match, p1, p2, p3) => {
          return p1 + '"' + p2 + '"' + p3;
        }
      );

      return JSON.parse(fixedVal);
    } catch (e) {
      // 如果 JSON 解析失败，不做任何处理，进入下方的保底逻辑
    }
  }

  // 4. 保底策略：返回去引号后的纯字符串
  // 注意：此处传入 trimmed 确保前缀已去除
  return this._trimQuotes(trimmed);
},
// 2. 极简版：获取显示正文
_getDisplayText(aiResponse) {
  try {
    if (!aiResponse || typeof aiResponse !== "string") return "";

    // 1. 优先策略：提取 gametxt
    const gameText = this._extractLastTagContent("gametxt", aiResponse);
    
    if (gameText !== null) {
      // 如果提取到了 gametxt，只清理其内部可能嵌套的特定标签
      return gameText
        .replace(createSafeRegex("safe"), "") 
        .replace(createSafeRegex("EventCard"), "") 
        .replace(createSafeRegex("事件卡片"), "") 
        .trim();
      // 注意：提取到 gametxt 后直接返回，保留了内部原本的排版。
    }

    // 2. 备用策略：全局清理 (当没有 gametxt 时的兜底逻辑)
    // 预定义需要彻底清除内容（包括标签及其内部文本）的标签列表
    const blacklistedTags = [
      "本周目经历", "历史的投影", "UpdateVariable", 
      "角色提取", "thinking", "reasoning", "dm", "gametxt", "think", "EventCard", "事件卡片", "safe"
    ];

    let cleaned = aiResponse;

    // 循环遍历黑名单，安全地移除这些标签及其内容
    blacklistedTags.forEach(tag => {
      cleaned = cleaned.replace(createSafeRegex(tag), "");
    });

    // 3. 终极净化：移除所有残余的 HTML/XML 标签
    // 使用 new RegExp 动态构造，避免代码中直接出现 /<[^>]*>/g 被酒馆或浏览器拦截
    const stripAllTagsRegex = new RegExp("<[^>]*>", "g");
    cleaned = cleaned.replace(stripAllTagsRegex, "").trim();

    return cleaned || "";

  } catch (e) {
    console.error("[VariableAI] 解析显示文本失败:", e, "输入:", aiResponse);
    return "[内容解析异常]";
  }
},
//========其他工具函数==========
// 性能节流，防止系统过载
throttle(fn, delay = 300) {
  let lastExecTime = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastExecTime > this.throttleInterval) {
      fn.apply(this, args);
      lastExecTime = now;
    }
  };
},
//给当前对话唯一识别码
_getHistoryKey() {
  const chatId = TavernHelper.chatId;
  // 如果无法获取chatId，提供一个备用键以避免完全失效
  if (!chatId) {
    console.warn(
      "[历史系统] 新会话尚未生成chatId，使用备用键存储历史记录",
    );
    return "frontend_chat_history_fallback";
  }
  return `frontend_chat_history_${chatId}`;
},
//对象的日志打印与调试
formatObject(obj, depth = 0) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return String(obj); // 非对象/数组直接转字符串
  }
  if (depth > 2) return "[深层结构]"; // 限制嵌套深度
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${this.formatObject(v, depth + 1)}`) // 递归调用时用 this
    .join("，");
},
// 终极转义函数：一个顶过去三个
safeEscapeHtml(str) {
  if (typeof str !== 'string') return "";
  const escapeRules = {
    '&': '\u0026amp;', '<': '\u0026lt;', '>': '\u0026gt;',
    '"': '\u0026quot;', "'": '\u0026apos;'
  };
  return str.replace(/[&<>"']/g, char => escapeRules[char]);
},
// HTML解码工具函数（还原转义后的名称）
unescapeHtml(str) {
  if (!str) return "";
  const tempDiv = document.createElement("div");
  // 利用浏览器原生解析HTML的能力还原转义字符
  tempDiv.innerHTML = str.replace(
    /<script[^>]*>([\S\s]*?)<\/script>/gi,
    "",
  ); // 过滤脚本（安全防护）
  return tempDiv.textContent || tempDiv.innerText;
},
_trimQuotes(str) {
  return typeof str === "string" ? str.replace(/^['"`\s]+|['"`\s]+$/g, "") : str;
},
_stripForbiddenWords(text) {
  return typeof text === "string" ? text.replace(/极其/g, "") : (text || "");
},

// ==========================================
// 核心工具库：对象与状态管理
// ==========================================
// 1. 安全取值器 (完全代理给外部纯函数或lodash)
SafeGetValue(obj, paths, defaultValue = "N/A") {
  return safeGetValue(obj, paths, defaultValue);
},

setNestedValue(obj, path, value) {
  try {
    if (!path || path.length === 0) return { success: false, error: "路径不能为空" };

    let pathArray;
    if (Array.isArray(path)) {
      pathArray = path;
    } else {
      const cleanPath = path.startsWith("/") ? path.slice(1) : path;
      pathArray = cleanPath.split(/\//).filter(Boolean);
    }

    let current = obj;
    for (let i = 0; i < pathArray.length - 1; i++) {
      const key = pathArray[i];
      
      // 允许对象和数组作为容器，只拦截 null 和基本数据类型
      if (current[key] === undefined || current[key] === null) {
        current[key] = {}; 
      } else if (typeof current[key] !== 'object') { 
        // 👈 去掉了 || Array.isArray(current[key])，允许数组通行
        return { success: false, error: `节点 [${key}] 不是可扩展的对象容器` };
      }
      
      current = current[key];
    }

    current[pathArray[pathArray.length - 1]] = value;
    return { success: true, error: null };

  } catch (e) {
    return { success: false, error: `赋值失败：${e.message}` };
  }
},

// ==========================================
// 核心工具库：AI 解析辅助
// ==========================================








