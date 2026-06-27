// 文件: ChronicleCore.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L17554-17977: // === 📜 时空管理局 (Chronicle Core) 核心工具集 === ---

// === 📜 时空管理局 (Chronicle Core) 核心工具集 ===
const ChronicleCore = {
  // 1. 核心字典：解决未来新增字段或旧版兼容问题的终极方案
  DICT: {
    // 强制输出的标准顺序（如果未来加了 people，只需在这里加一个 "在场人物"）
    STANDARD_ORDER: [
      "序号", "日期", "时间", "大纲", "地点", "在场人物", 
      "详细描述", "核心侧写", "事件标签", "核心锚点"
    ],
    // 别名映射：遇到旧版或AI变异的字段，自动洗白成标准字段！
    ALIAS_MAP: {
      "标题": "大纲",         // 旧版标题 -> 新版大纲
      "人物": "在场人物",     // 旧版人物 -> 新版在场人物
      "描述": "详细描述",     // 旧版描述 -> 新版详细描述
      "人物关系": "核心侧写", // 旧版关系 -> 新版侧写
      "标签": "事件标签",     // 旧版标签 -> 新版事件标签
      "重要信息": "核心锚点", // 旧版信息 -> 新版锚点
      "暗线与伏笔": "核心锚点" 
    }
  },

  // 2. 终极解析器：文本 -> 规范化对象数组 (替代原 parseJourneyEntry)
  parseTextToEvents(contentString) {
    if (!contentString || typeof contentString !== "string") return [];
    try {
      const events = [];
      const eventBlocks = contentString.trim().split(/\n*\s*序号\|/).filter(s => s.trim() !== "");

      eventBlocks.forEach(block => {
        const firstLineEnd = block.indexOf("\n");
        const seq = block.substring(0, firstLineEnd !== -1 ? firstLineEnd : block.length).trim();
        if (!/\d+/.test(seq)) return; 

        const event = { "序号": seq };
        const remainingBlock = firstLineEnd !== -1 ? block.substring(firstLineEnd).trim() : "";
        const lines = remainingBlock.split("\n");
        let currentKey = null;

        for (const line of lines) {
          const separatorIdx = line.indexOf("|");
          if (separatorIdx !== -1) {
             const rawKey = line.substring(0, separatorIdx).trim();
             // 🔴 核心机制：检查是否在标准列表或别名列表中
             const standardKey = this.DICT.ALIAS_MAP[rawKey] || rawKey;
             
             // 如果是我们认识的键，或者是标准顺序里有的键
             if (this.DICT.STANDARD_ORDER.includes(standardKey) || this.DICT.ALIAS_MAP[rawKey]) {
                currentKey = standardKey;
                event[currentKey] = line.substring(separatorIdx + 1).trim();
                continue;
             }
          }
          // 如果没有匹配到新键，则追加到上一行
          if (currentKey && event[currentKey] !== undefined) {
            event[currentKey] += "\n" + line;
          }
        }
        events.push(event);
      });
      return events;
    } catch (e) {
      console.error("[时空管理局] 解析本周目经历出错:", e);
      return [];
    }
  },

  // 3. 终极序列化器：对象 -> 纯文本 (替代 stringifyJourneyEvent)
  stringifyEventToText(event) {
    return this.DICT.STANDARD_ORDER
      .map(key => {
        if (event[key] !== undefined && event[key] !== null && event[key] !== "") {
          return `${key}|${event[key]}`;
        }
        return null;
      })
      .filter(Boolean)
      .join("\n");
  },

  // 🌟 终极 Meta 装配车间：全游戏唯一生成 meta 的地方！(静态方法)
  buildStandardMeta(rawText, fallbackSerial, existingMeta = {}, playerName = "") {
    const events = this.parseTextToEvents(rawText);
    
    // 默认兜底值
    let serial = fallbackSerial;
    let title = "未命名节点";
    let date = "未知时间";
    let people = "";

    // 提取最新事件的数据
    if (events.length > 0) {
      const lastEvent = events[events.length - 1];
      serial = parseInt(lastEvent["序号"], 10) || fallbackSerial;
      title = lastEvent["大纲"] || "未命名节点"; 
      date = lastEvent["日期"] || "未知时间";
      people = lastEvent["在场人物"] || "";
    }

    // 🌟 核心：清洗出在场 NPC 名字，利用传入的 playerName 进行剔除
    const activeNpcNames = people
      .replace(/[（\(][^）\)]*[）\)]/g, "") // 移除括号内的状态或备注
      .split(/[、，,]/)
      .map(n => n.trim())
      .filter(n => n && n !== playerName); // 成功过滤掉玩家自己

    // 幕后 NPC 直接继承旧快照（如果存在），否则给空数组。
    // 因为幕后 NPC 只能在游戏运行时由后台结算逻辑去动态挂载，静态装配不负责推算。
    const offScreenNpcs = existingMeta?.world_info?.offscreen_npcs || [];

    // 统一装配并输出，未来加字段只改这里！👇
    return {
      serial: serial,
      title: title,
      date: date,
      people: people,
      journey_full_text: rawText,
      world_info: {
        active_npcs: activeNpcNames,
        offscreen_npcs: offScreenNpcs
      },
      
      // 继承原有快照的特殊标记
      ...(existingMeta.is_periodic_backup && { 
          is_periodic_backup: existingMeta.is_periodic_backup,
          backup_timestamp: existingMeta.backup_timestamp 
      })
    };
  },

  // 🌟 终极合并手术刀：传入一堆散落的经历文本，还你一个完美去重、排序的纯净文本！
  mergeJourneyTexts(textArray) {
    const allEvents = [];
    textArray.forEach(text => {
      if (!text) return;
      const events = this.parseTextToEvents(text);
      allEvents.push(...events);
    });

    // 使用 Map 按绝对序号去重（如果序号冲突，保留后加载的，即最新的那条）
    const uniqueEventsMap = new Map();
    allEvents.forEach(ev => {
      const seq = parseInt(ev["序号"], 10);
      if (!isNaN(seq)) {
        uniqueEventsMap.set(seq, ev);
      }
    });

    // 重新按绝对序号进行严格升序排序
    const sortedEvents = Array.from(uniqueEventsMap.values()).sort((a, b) => {
      return parseInt(a["序号"], 10) - parseInt(b["序号"], 10);
    });

    // 重新序列化为纯文本
    return sortedEvents.map(ev => this.stringifyEventToText(ev)).join("\n\n");
  },

  // 🌟 文本级篡改车间：专门用于修改指定经历文本中的序号
  fixEventSequenceInText(rawText, targetEventIdx, newSeq) {
    const events = this.parseTextToEvents(rawText);
    if (events[targetEventIdx]) {
      events[targetEventIdx]["序号"] = String(newSeq);
      // 重新合并为纯文本
      return events.map(ev => this.stringifyEventToText(ev)).join("\n\n");
    }
    return rawText; // 如果没找到该事件，原样退回
  },

  // 5. 质检部门：分析快照序列异常 (融合了你的分析函数，解除了对外部的强依赖)
  analyzeSequences(historyCache, getJourneyTextFunc) {
    const snapshots = [];
    const allEvents = [];
    let globalIndex = 0;
    let expectedNext = 1;

    historyCache.forEach((snapshot, snapIdx) => {
      if (!snapshot || !snapshot.message) return;
      
      const journeyContent = getJourneyTextFunc(snapshot);
      if (!journeyContent) {
        snapshots.push({ snapIdx, events: [], isEmpty: true });
        return;
      }

      // 使用新的解析器
      const events = this.parseTextToEvents(journeyContent);
      const snapData = { snapIdx, events: [], isEmpty: events.length === 0, hasProblems: false };

      events.forEach((event, eventIdx) => {
        const seq = parseInt(event["序号"], 10);
        const eventData = {
          snapIdx, eventIdx, globalIdx: globalIndex++, 
          序号: event["序号"], parsedSeq: seq, 
          标题: event["大纲"] || "无标题", 日期: event["日期"] || "未知",
          event: event, problems: []
        };

        // ... 你的原有诊断逻辑保留不变 ...
        const prevSeq = allEvents.length > 0 ? allEvents[allEvents.length - 1].parsedSeq : 0;
        
        if (isNaN(seq)) {
          eventData.problems.push({ type: "invalid", message: "无效序号", suggested: expectedNext });
        } else if (seq === prevSeq) {
          eventData.problems.push({ type: "duplicate", message: "重复序号", suggested: expectedNext });
        } else if (seq < prevSeq) {
          eventData.problems.push({ type: "backward", message: `倒退 (${prevSeq}→${seq})`, suggested: expectedNext });
        } else if (seq > expectedNext + 10) {
          eventData.problems.push({ type: "jump", message: `大跳跃 (+${seq - expectedNext})`, suggested: expectedNext });
        } else if (seq !== expectedNext && seq > expectedNext) {
          eventData.problems.push({ type: "skip", message: `跳号 (${expectedNext}→${seq})`, suggested: expectedNext });
        }

        if (eventData.problems.length > 0) snapData.hasProblems = true;
        expectedNext = Math.max(expectedNext, isNaN(seq) ? 0 : seq) + 1;
        
        snapData.events.push(eventData);
        allEvents.push(eventData);
      });
      snapshots.push(snapData);
    });

    return { snapshots, allEvents, totalProblems: allEvents.filter(e => e.problems.length > 0).length };
  },

  // --- 🌟 基础设施扩建：世界书与 Meta 标签管家 ---

  extractMetaFromRawText(rawText) {
    const events = this.parseTextToEvents(rawText);
    const meta = {
      serial: null,
      title: "未命名节点",
      date: "未知时间",
      journey_full_text: rawText
    };

    if (events.length > 0) {
      const lastEvent = events[events.length - 1]; // 取最后一条事件作为当前快照的核心特征
      meta.serial = parseInt(lastEvent["序号"], 10) || null;
      meta.title = lastEvent["大纲"] || "未命名节点"; 
      meta.date = lastEvent["日期"] || "未知日期";
    }
    return meta;
  },

  // 1. 键名统管中心：彻底消灭硬编码的拼接逻辑
  getLorebookKey(type, unifiedIndex) {
    const baseKeys = {
      journey: "本周目经历",
      core_memory: "本周目核心记忆"
    };
    const base = baseKeys[type] || type;
    return unifiedIndex > 1 ? `${base}(${unifiedIndex})` : base;
  },

  // 2. 标签解析器：精准提取最后总结的事件 ID
  extractSummarizedId(text) {
    if (!text) return 0;
    const match = text.match(/\[Meta-LastSummarizedId:\s*(\d+)\]/);
    return match ? parseInt(match[1], 10) : 0;
  },

  // 3. 标签烙印器：安全覆盖或追加总结 ID，绝不破坏原有格式
  updateSummarizedId(text, newId) {
    // 先剥离所有旧的标记
    const cleanText = text.replace(/\[Meta-LastSummarizedId:\s*\d+\]/g, "").trim();
    const marker = `[Meta-LastSummarizedId: ${newId}]`;
    return cleanText ? `${cleanText}\n\n${marker}` : marker;
  },
};

//==============================================
//=================GameManager开始=============
//==============================================
const GameManager = {
  isProcessingChat: false, // 新增：防重入标记
  isInitialized: false, // 用于记录是否已初始化
  listenersBound: false,
  battleUI: null, // 战斗系统UI控制器
  messageTimer: null,
  // ---时间旅行功能状态变量 ---
  chatHistoryCache: [],
  historyViewIndex: -1,
  isHistoryViewMode: false,
  isSwitching: false,
  lastRenderedMessageId: "",
  throttleInterval: 300,
  // --- 时间旅行功能结束 ---

  equippedItems: {
    wuqi: null,
    yiwu: null,
    shipin: null,
    fengyinwu: null,
    banyanfa: null,
    fuzhu: null,
  },
  currentMvuState: null,
  pendingActions: [],
  baseAttributes: {},
  calculatedMaxAttributes: {},

  userActivityListenersAdded: false,
  lastUserActivity: Date.now(),

  lastExtractedJourney: null,
  lastExtractedPastLives: null,
  lastExtractedNovelText: null,
  lastExtractedCharacterCard: null,
  lastExtractedVariables: null,
  lastExtractedThinking: null, // 新增：用于存储提取的思维链内容
  lastExtractedThinkingNarrative: null, // 正文模型的思维链
  lastExtractedThinkingVariable: null,  // 变量模型的思维链
  thinkingActiveTab: 'narrative', // 浮层当前选中的 Tab：narrative / variable
  lastExtractedDanmaku: [],
  isDanmakuVisible: false,
  isDanmakuEntriesEnabled: false,
  lastExtractedCoreMemory: null, // 【新增】用于存储提取的核心记忆
  lastExtractedClues: null, // 【新增】用于存储提取的线索
  lastSentPrompt: null,
  lastActionPrompt: null,
  isNovelModeEnabled: false,
  isAutoWriteEnabled: true,
  isCharacterAutoWriteEnabled: true,
  autoWriteIntervalId: null,
  novelModeAutoWriteIntervalId: null,
  characterAutoWriteIntervalId: null,

  isMobileView: false,
  unifiedIndex: 1,
  isAutoToggleLorebookEnabled: false,
  autoToggleIntervalId: null,
  isAutoSaveEnabled: false,
  autoSaveIntervalId: null,
  isBusy: false,
  isSummarizing: false, // 新增：总结器工作状态标记
  summaryReminderShown: false, // 新增：用于标记总结提醒是否已显示
  summaryReminderThreshold: undefined, // 新增：用于自定义大总结提醒阈值（懒加载，0=永久关闭）
  pendingAutoSave: null,
  // --- 自动备份系统状态变量 ---
  isPeriodicBackupEnabled: false, // 是否启用定期自动备份
  periodicBackupInterval: 5, // 备份间隔回合数，默认5回合
  turnsSinceLastBackup: 0, // 自上次备份以来的回合数
  panelCollapseState: { char: false, interaction: false, bottom: false },
  isStreamCancelled: false,
  _streamLoadingHidden: true, // 默认为 true，发送时改为 false

  lastExtractedActions: [], // 新增：用于存储提取的行动选项
  isStreamingEnabled: true, // 新增：流式传输开关状态
  isConsoleDisabled: true,
  fontSize: 14, // 新增：用于存储主界面字体大小
  isFullScreenLoadingEnabled: false, // 新增：控制加载动画模式的状态，默认为false
  isFloatingEditorEnabled: true, // 新增：悬浮变量编辑器开关，默认开启
  isAiContextConfigEnabled: true, // 变量可见性(锁)开关，默认开启
  isVariablePanelToggleEnabled: true, // AI变量修复(字)开关，默认开启
  isBattleFloatingBtnEnabled: true, // 战斗系统(剑)开关，默认开启
  recentEventsCount: 30, // 新增：记忆中枢发送的近期事件数量，默认为30，最大100
  recentImportantEventsCount: 5,
  isCoreMemoryImportant: true,
  // --- 新增：布局与尺寸控制变量 ---
  widthSetting: "900px",
  heightSetting: "600px",
  isFullScreenLayout: false,

  // --- 新增：个性化设置变量 ---
  customBackgrounds: [], // 存储所有导入的背景图 {id, name, data}
  currentBackgroundId: "default",
  // --- 以下为新增 ---
  isAutoRandomBg: false,     // 是否开启自动随机切换
  randomBgInterval: 10,      // 随机切换间隔（默认10分钟）
  bgTimerId: null,           // 内部使用的定时器ID
  mainContentOpacity: 0.5,
  mainContentBlur: 3,

  currentFontClass: "font-noto-serif-sc",

  // --- 新增：Gacha系统状态变量 ---
  // 【新增】角色解锁成本常量（星辉 Starglitter）
  CHARACTER_UNLOCK_COST: {
    R: 5, // R稀有度解锁成本：5星辉
    SR: 20, // SR稀有度解锁成本：20星辉
    SSR: 100, // SSR稀有度解锁成本：100星辉
  },
  // 【新增】伙伴数量限制设置
  maxCompanionSlots: 3, // 最大伙伴数量（默认3）
  maxSSRCompanions: 1, // 最大SSR伙伴数量（默认1）

  gachaState: {
    astralDust: 1600, // 初始赠送10抽
    starglitter: 0, // 核心修复：为星辉添加初始值
    pitySSR: 0,
    pitySR: 0,
    ssrGuarantee: false,
  },
  gachaCollection: {},
  gachaHistory: [],
  pendingCompanionJoin: null,
  pendingCharacterCardGeneration: null, // 新增：用于追踪待生成的角色卡
  gachaCharacterPool: { ssr: [], sr: [], r: [] }, 
  gachaCharacterDB: {}, // ✨ 新增：全局角色字典映射 { id: charData }

  theaterState: {
    theaterPoints: 0, // 初始点数为0
  },
  lastUserMessage: "", // 新增：用于暂存用户输入的指令
  // --- 【新增：快捷指令系统的状态变量】 ---
  // quickShortcuts: [],已放进GameDBManager
  pendingSupplementary: [],
  isKeepShortcutsEnabled: false, // [新增] 是否在回合结束后保持勾选状态
  // --- 【新增：随机事件系统状态变量】 ---
  // randomEntries: [], 已放进GameDBManager
  pendingRandomEvents: [], // 存储本轮成功抽中、待抛出的事件结果
  currentActiveRandomIndex: null, // 当前编辑器选中的条目索引
  Y_SCALE: 51.35 / 100,
  JOURNEY_FIELD_ORDER: [
          "序号", "日期", "时间", "大纲", "标题", "地点", "在场人物", "人物", 
          "详细描述", "描述", "核心侧写", "人物关系", "事件标签", "标签", 
          "核心锚点", "重要信息", "暗线与伏笔", "自动化系统"
  ],
  VAR_AI_KEYS: {
    USE_CUSTOM: "var_ai_use_custom",
    API_URL: "var_ai_api_url",
    API_KEY: "var_ai_api_key",
    MODEL: "var_ai_model",
  },


