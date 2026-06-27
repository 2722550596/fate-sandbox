// 文件: GameManager-extras.js
// 来源: original.js
// 包含 3 个非类代码段
// ==========================================


// --- L24952-25617: // ========================================== ---

// ==========================================
// 动态数据驱动：自动化系统挂载器 (原版 CSS 适配版)
// ==========================================
appendDynamicAutomationPanel(modifiedNpcSet) {
  const displayEl = document.getElementById("game-text-display");
  if (!displayEl) return;
  
  // 🔧 修复：清除所有旧的世界线同步报告面板，防止重复显示
  const oldPanels = displayEl.querySelectorAll('.auto-system-panel');
  oldPanels.forEach(panel => panel.remove());

  const state = this.currentMvuState;
  const npcData = state?.npc_data || {};
  const worldData = state?.world_data || {};
  const playerName = state?.stat_data?.名称 || "未知玩家";

  const currentSnapshot = this.chatHistoryCache[this.chatHistoryCache.length - 1];
  const peopleStr = currentSnapshot?.meta?.people || "";

  const activeNpcNames = peopleStr
    .replace(/[（\(][^）\)]*[）\)]/g, "")
    .split(/[、，,]/)
    .map(n => n.trim())
    .filter(n => n && n !== playerName);
  
  const activeSet = new Set(activeNpcNames);
  const offScreenNpcs = Array.from(modifiedNpcSet).filter(name => !activeSet.has(name) && npcData[name]);

  const newsData = worldData["日报与传闻"] || {};
  const hasNews = typeof newsData === 'object' && !Array.isArray(newsData) && Object.keys(newsData).length > 0;

  if (activeNpcNames.length === 0 && offScreenNpcs.length === 0 && !hasNews) return;

  const panelId = "auto-system-v2-" + Date.now();
  
  // 完美复刻原版 HTML 结构与 Class
  let html = `<div class="auto-system-panel collapsed" id="${panelId}" style="margin-top: 15px;">`;
  
  // 使用简单的原生 JS 替代原先的 window.toggleAutoSystemPanel
  html += `<button class="auto-system-collapse-btn" onclick="this.parentElement.classList.toggle('collapsed')" title="点击展开/折叠">▶</button>`;
  html += `<div class="auto-system-title" onclick="this.parentElement.classList.toggle('collapsed')">💠 世界线同步报告 💠</div>`;
  html += `<div class="auto-system-content"><div>`;

  // --- 模块 A: 在场 NPC ---
  const activeHtml = activeNpcNames.filter(n => npcData[n]).map(n => this._generateDynamicNpcCard(n, npcData[n])).join("");
  if (activeHtml) {
    html += `<div style="text-align: center; color: var(--text-muted); font-size: 0.85em; margin: 10px 0;">— 在场推演 —</div>`;
    html += `<div class="npc-cards-container">${activeHtml}</div>`;
  }

  // --- 模块 B: 幕后活跃 NPC ---
  const offScreenHtml = offScreenNpcs.map(n => this._generateDynamicNpcCard(n, npcData[n])).join("");
  if (offScreenHtml) {
    html += `<div style="text-align: center; color: var(--color-danger); font-size: 0.85em; margin: 15px 0 10px 0;">— 幕后行动 —</div>`;
    html += `<div class="npc-cards-container">${offScreenHtml}</div>`;
  }

  // --- 模块 C: 日报与传闻 ---
  if (hasNews) {
    html += this._generateDynamicNewspaper(worldData["日报与传闻"]);
  }

  html += `</div></div></div>`; // 关闭 wrapper, content, panel
  displayEl.insertAdjacentHTML('beforeend', html);
},
// ==========================================
// 声明式渲染：自动化系统 HTML 构建器 (带向下兼容)
// ==========================================
_buildAutomationPanelHtml(snapshot) {
  // 🛡️ 防御层 2：面板总控防崩溃
  try {
    if (!snapshot) return "";

    const npcData = snapshot.data?.npc_data || {};
    const worldData = snapshot.data?.world_data || {};
    const worldInfo = snapshot.meta?.world_info || {};

    let activeNpcNames = worldInfo.active_npcs || [];
    const offScreenNpcs = worldInfo.offscreen_npcs || [];
    const newsData = worldData["日报与传闻"] || {};
    const hasNews = typeof newsData === 'object' && !Array.isArray(newsData) && Object.keys(newsData).length > 0;

    // 核心兼容补丁
    if (activeNpcNames.length === 0 && snapshot.meta?.people) {
      const playerName = snapshot.data?.stat_data?.名称 || "未知玩家";
      activeNpcNames = snapshot.meta.people
        .replace(/[（\(][^）\)]*[）\)]/g, "")
        .split(/[、，,]/)
        .map(n => n.trim())
        .filter(n => n && n !== playerName);
    }

    if (activeNpcNames.length === 0 && offScreenNpcs.length === 0 && !hasNews) return "";

    const panelId = "auto-system-v2-" + Date.now() + Math.floor(Math.random() * 1000);
    
    let html = `<div class="auto-system-panel collapsed" id="${panelId}" style="margin-top: 15px; animation: fadeIn 0.5s ease;">`;
    html += `<button class="auto-system-collapse-btn" onclick="this.parentElement.classList.toggle('collapsed')" title="点击展开/折叠">▶</button>`;
    html += `<div class="auto-system-title" onclick="this.parentElement.classList.toggle('collapsed')">💠 世界线同步报告 💠</div>`;
    html += `<div class="auto-system-content"><div>`;

    // --- 模块 A: 在场 NPC ---
    const activeHtml = activeNpcNames.filter(n => npcData[n]).map(n => this._generateDynamicNpcCard(n, npcData[n])).join("");
    if (activeHtml) {
      html += `<div style="text-align: center; color: var(--text-muted); font-size: 0.85em; margin: 10px 0;">— 在场人物推演 —</div>`;
      html += `<div class="npc-cards-container">${activeHtml}</div>`;
    }

    // --- 模块 B: 幕后活跃 NPC ---
    const offScreenHtml = offScreenNpcs.map(n => this._generateDynamicNpcCard(n, npcData[n])).join("");
    if (offScreenHtml) {
      html += `<div style="text-align: center; color: var(--color-danger, #d9534f); font-size: 0.85em; margin: 15px 0 10px 0;">— 幕后暗流涌动 —</div>`;
      html += `<div class="npc-cards-container">${offScreenHtml}</div>`;
    }

    // --- 模块 C: 日报与传闻 ---
    if (hasNews) {
       // 假设 _generateDynamicNewspaper 内部也可能报错，做个极简防御
       try {
         html += this._generateDynamicNewspaper(newsData);
       } catch (e) {
         console.warn("日报渲染失败:", e);
       }
    }

    html += `</div></div></div>`;
    return html;
    
  } catch (globalError) {
    console.error("[VariableAI] 面板总成渲染致命错误:", globalError);
    // 返回一个备用面板，告诉玩家数据已保存，只是UI罢工了
    return `<div class="auto-system-panel" style="margin-top: 15px; border-color: #ffcc00;">
              <div class="auto-system-title" style="color: #ffaa00;">⚠️ 变量已生效，但面板 UI 渲染异常</div>
              <div class="auto-system-content" style="padding: 10px; font-size: 0.9em; color: var(--text-muted);">
                后台数据已成功注入并保存。当前 NPC 数据格式存在异常，导致 UI 无法显示，但不影响剧情推进。
              </div>
            </div>`;
  }
},

_generateDynamicNpcCard(name, npcObj) {

  try {
    if (!npcObj || typeof npcObj !== 'object') return "";
    let html = '<div class="npc-card">';
    html += `<div class="npc-name">${this.safeEscapeHtml(name)}`;
    const identity = this.SafeGetValue(npcObj, "身份", "");
    if (identity) html += `<span class="npc-type">${this.safeEscapeHtml(identity)}</span>`;
    html += `</div>`;

    const behaviorChain = this.SafeGetValue(npcObj, "行为链片段", "");
    if (behaviorChain) {
      const formattedBehavior = this.safeEscapeHtml(behaviorChain).replace(/→/g, '<span class="npc-arrow"> ➔ </span>');
      html += `<div class="npc-behavior"><span class="npc-inline-label">打算</span> <span class="npc-behavior-text">${formattedBehavior}</span></div>`;
    }

    const currentStatus = this.SafeGetValue(npcObj, "当前状态", null);
    const doing = this.SafeGetValue(npcObj, "正在做的事", "");
    const location = this.SafeGetValue(npcObj, "所处地点", "");
    const appearance = this.SafeGetValue(npcObj, "外貌", "");

    if (currentStatus || doing || location || appearance) {
      html += '<div class="npc-state-container">';
      if (currentStatus && typeof currentStatus === 'object') {
        const statusKeys = Object.keys(currentStatus).filter(k => k !== '$meta');
        if (statusKeys.length > 0) {
          html += '<div class="npc-status-tags">';
          statusKeys.forEach(k => {
            html += `<span class="npc-status-tag">${this.safeEscapeHtml(k)}: ${this.safeEscapeHtml(String(currentStatus[k]))}</span>`;
          });
          html += '</div>';
        }
      }
      if (doing) html += `<div class="npc-state-desc">${this.safeEscapeHtml(doing)}</div>`;
      if (location) html += `<div class="npc-state-detail"><span class="elegant-label">位置</span><span class="elegant-text">${this.safeEscapeHtml(location)}</span></div>`;
      if (appearance) html += `<div class="npc-state-detail"><span class="elegant-label">外貌</span><span class="elegant-text">${this.safeEscapeHtml(appearance)}</span></div>`;
      html += '</div>';
    }

    const goal = this.SafeGetValue(npcObj, "长期目标", "");
    if (goal) html += `<div class="npc-section-block"><div class="npc-block-title">长期目标</div><div class="npc-goal-text">${this.safeEscapeHtml(goal)}</div></div>`;

    const plans = this.SafeGetValue(npcObj, "近期打算", "");
      if (plans) {
        html += `<div class="npc-section-block"><div class="npc-block-title">近期打算</div>`;
        
        // ✅ 修复：增加对 Object 结构和非字符串类型的向下兼容
        let planArray = [];
        if (typeof plans === 'object' && !Array.isArray(plans)) {
          // 如果 AI 返回了字典对象 (例如 {"1": "计划A", "2": "计划B"})
          Object.keys(plans).filter(k => k !== '$meta').forEach(k => planArray.push(String(plans[k])));
        } else if (Array.isArray(plans)) {
          // 如果 AI 返回了数组
          planArray = plans;
        } else if (typeof plans === 'string') {
          // 如果是标准的字符串
          planArray = plans.split('\n');
        } else {
          // 兜底：其他格式直接转为字符串数组
          planArray = [String(plans)];
        }

        planArray.forEach(plan => {
          // ✅ 进一步防御：确保进入循环的单条计划一定是字符串，防止后续 split 再次报错
          if (typeof plan !== 'string') plan = String(plan);
          if (!plan.trim()) return;
          
          const parts = plan.split('|').map(p => p.trim());
          html += `<div class="npc-plan-item"><div class="npc-plan-main">${this.safeEscapeHtml(parts[0])}</div>`;
          if (parts.length > 1) {
            html += `<div class="npc-plan-meta"><span class="npc-plan-status">${this.safeEscapeHtml(parts[1])}</span>`;
            if (parts.length > 2 && parts[2]) html += `<span class="npc-plan-time"><span class="elegant-symbol">◷</span> ${this.safeEscapeHtml(parts[2])}</span>`;
            html += `</div>`;
          }
          html += `</div>`;
        });
        html += `</div>`;
      }

    // ==========================================
    // 事件历史 渲染模块 (带折叠)
    // ==========================================
    const eventHistory = this.SafeGetValue(npcObj, "事件历史", null);
    if (eventHistory) {
      let historyLines = [];
      if (typeof eventHistory === 'object' && !Array.isArray(eventHistory)) {
        Object.keys(eventHistory).filter(k => k !== '$meta').forEach(k => historyLines.push(`[${k}] ${eventHistory[k]}`));
      } else if (Array.isArray(eventHistory)) historyLines = eventHistory;
      else if (typeof eventHistory === 'string') historyLines = eventHistory.split('\n');

      if (historyLines.length > 0) {
        // 注意这里的变化：增加了 .npc-sub-collapse 父级，默认带 .collapsed 类；标题变为可点击
        html += `<div class="npc-section-block npc-sub-collapse collapsed">
                   <div class="npc-block-title" onclick="this.parentElement.classList.toggle('collapsed')" title="点击展开/折叠">
                     <span>事件历史记录</span>
                     <span class="sub-collapse-icon">▼</span>
                   </div>
                   <div class="sub-collapse-wrapper">
                     <div class="npc-memories-list">`;
        historyLines.forEach(hist => {
          if (!hist.trim()) return;
          const formattedHist = this.safeEscapeHtml(hist).replace(/→/g, '<span class="npc-arrow-gold"> ➪ </span>');
          html += `<div class="npc-memory-item"><span class="memory-bullet">❖</span><div class="memory-text">${formattedHist}</div></div>`;
        });
        html += `</div></div></div>`; // 补全标签
      }
    }

    // ==========================================
    // 关键记忆档案 渲染模块 (带折叠)
    // ==========================================
    const memories = this.SafeGetValue(npcObj, "关键记忆", null);
    if (memories) {
      let memoryLines = [];
      if (typeof memories === 'object' && !Array.isArray(memories)) {
        Object.keys(memories).filter(k => k !== '$meta').forEach(k => memoryLines.push(`[${k}] ${memories[k]}`));
      } else if (Array.isArray(memories)) memoryLines = memories;
      else if (typeof memories === 'string') memoryLines = memories.split('\n');

      if (memoryLines.length > 0) {
        // 同样处理，默认带 .collapsed 类
        html += `<div class="npc-section-block npc-sub-collapse collapsed">
                   <div class="npc-block-title" onclick="this.parentElement.classList.toggle('collapsed')" title="点击展开/折叠">
                     <span>关键记忆档案</span>
                     <span class="sub-collapse-icon">▼</span>
                   </div>
                   <div class="sub-collapse-wrapper">
                     <div class="npc-memories-list">`;
        memoryLines.forEach(mem => {
          if (!mem.trim()) return;
          const formattedMem = this.safeEscapeHtml(mem).replace(/→/g, '<span class="npc-arrow-gold"> ➪ </span>');
          html += `<div class="npc-memory-item"><span class="memory-bullet">◈</span><div class="memory-text">${formattedMem}</div></div>`;
        });
        html += `</div></div></div>`;
      }
    }


    return html + `</div>`;

  } catch (cardError) {
    console.warn(`[VariableAI] 渲染 NPC [${name}] 卡片时遭遇异常数据格式:`, cardError);
    // 渲染降级：只显示名字和一个警告图标，保证结构不被破坏
    return `<div class="npc-card" style="border: 1px dashed #ff4444; opacity: 0.8;">
              <div class="npc-name">${this.safeEscapeHtml(name)} <span style="font-size:0.8em; color:#ff4444;">(数据格式异常)</span></div>
            </div>`;
  }
},

_generateDynamicNewspaper(newsData) {
  let html = '<div class="newspaper-panel"><div class="newspaper-header"><div class="newspaper-title">The Backlund Gazette</div><div class="newspaper-subtitle">~ Daily Chronicles of the Extraordinary ~</div></div><div class="newspaper-content"><div>';
  
  // 增加顶级防御：如果 newsData 根本不是对象或为空，直接返回空
  if (!newsData || typeof newsData !== 'object') return "";

  const newsEntries = Object.entries(newsData).filter(([k]) => k !== '$meta');
  const totalEntries = newsEntries.length;
  
  newsEntries.forEach(([dateStr, contentRaw], index) => {
    // --- 1. 日期格式清洗 ---
    const cleanDate = this.safeEscapeHtml(
      String(dateStr)
        .replace(/[\[\]【】()]/g, "") 
        .replace(/\-\d+$/, "")        
        .trim()
    );
    
    // --- 2. 🌟 核心修复：内容类型强制降级转换 ---
    let safeContentStr = "";
    if (typeof contentRaw === 'string') {
      safeContentStr = contentRaw;
    } else if (Array.isArray(contentRaw)) {
      // 如果 AI 返回了数组，用换行拼接
      safeContentStr = contentRaw.join(' | ');
    } else if (typeof contentRaw === 'object' && contentRaw !== null) {
      // 如果 AI 返回了嵌套对象，提取它的所有值拼接
      safeContentStr = Object.values(contentRaw).map(v => String(v)).join(' | ');
    } else {
      // 兜底：其他奇怪的类型直接转字符串
      safeContentStr = String(contentRaw || "");
    }

    const cleanContent = this.safeEscapeHtml(safeContentStr.trim());
    
    // --- 3. 渲染条目 ---
    if (cleanContent) {
      html += `<div class="news-item">
                 <div class="news-date">${cleanDate}</div>
                 <div class="news-content">${cleanContent}</div>
               </div>`;
      
      if (index < totalEntries - 1) {
        html += '<div class="newspaper-divider" style="margin: 10px 0; opacity: 0.5;"></div>';
      }
    }
  });
  
  return html + '<div class="newspaper-footer">— Published in the Foggy Capital —</div></div></div></div>';
},




// 处理 <details> 标签（自动化系统和日报传闻）
processDetailsTag(text) {
  if (!text.includes("<details>") && !text.includes("<Details>"))
    return text;

  // 宽松匹配 <details> 标签（兼容大小写、属性等）
  const detailsRegex = /<details[^>]*>([\s\S]*?)<\/details>/gi;

  return text.replace(detailsRegex, (match, content) => {
    // 宽松检查是否包含自动化系统标记
    if (/自动化系统|<Auto>|💠.*系统/i.test(content)) {
      return this.renderAutoSystemPanel(content);
    }
    return match;
  });
},
// 渲染自动化系统面板（带折叠功能，彻底重构优雅排版版）
renderAutoSystemPanel(content) {
  const panelId =
    "auto-system-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substr(2, 9);

  let html =
    '<div class="auto-system-panel collapsed" id="' +
    panelId +
    '">';
  html +=
    '<button class="auto-system-collapse-btn" onclick="window.toggleAutoSystemPanel(\'' +
    panelId +
    '\')" title="点击展开">▶</button>';
  html +=
    '<div class="auto-system-title" onclick="window.toggleAutoSystemPanel(\'' +
    panelId +
    "')\">💠 战斗状态表 💠</div>";
  html += '<div class="auto-system-content">';
  html += "<div>";

  let npcContent = content;
  let newsContent = "";
  const newsIndex = content.search(/[💠#]*\s*日报[与和]?传闻/i);
  if (newsIndex !== -1) {
    npcContent = content.substring(0, newsIndex);
    newsContent = content.substring(newsIndex);
  }

  const npcBlocks = npcContent
    .split("💠")
    .filter((b) => b.trim().length > 10);

  html += '<div class="npc-cards-container">';

  npcBlocks.forEach((block) => {
    if (/识别.*NPC|核心.*活跃/i.test(block.substring(0, 30)))
      return;

    const lines = block.split("\n");

    let npcName = "未知角色",
      npcType = "";
    let behavior = "",
      status = "",
      goal = "";
    let plans = [],
      memories = [];
    let currentSection = "";

    const nameLine = lines[0].trim();
    const nameMatch = nameLine.match(
      /^\[?([^\]:：(（]+)\]?(?:[[(（]([^)）\]]+)[)）\]])?\s*[:：]?/,
    );
    if (nameMatch) {
      npcName = nameMatch[1].trim();
      npcType = nameMatch[2] ? nameMatch[2].trim() : "";
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (/行为链片段\s*[:：]/.test(line)) {
        behavior = line.replace(/.*行为链片段\s*[:：]\s*/, "");
        currentSection = "";
      } else if (/当前状态\s*[:：]/.test(line)) {
        status = line.replace(/.*当前状态\s*[:：]\s*/, "");
        currentSection = "";
      } else if (/长期目标\s*[:：]/.test(line)) {
        goal = line.replace(/.*长期目标\s*[:：]\s*/, "");
        currentSection = "";
      } else if (/近期打算\s*[:：]/.test(line)) {
        currentSection = "plans";
        const inlinePlan = line
          .replace(/.*近期打算\s*[:：]\s*/, "")
          .trim();
        if (inlinePlan) plans.push(inlinePlan);
      } else if (/关键记忆(?:更新)?\s*[:：]/.test(line)) {
        currentSection = "memories";
        const inlineMem = line
          .replace(/.*关键记忆(?:更新)?\s*[:：]\s*/, "")
          .trim();
        if (inlineMem) memories.push(inlineMem);
      } else if (currentSection === "plans") {
        if (!/.*[:：]$/.test(line)) {
          plans.push(line.replace(/^[-*•]\s*/, "").trim());
        } else {
          currentSection = "";
        }
      } else if (currentSection === "memories") {
        if (!/.*[:：]$/.test(line)) {
          memories.push(line.replace(/^[-*•]\s*/, "").trim());
        } else {
          currentSection = "";
        }
      }
    }

    if (
      !behavior &&
      !status &&
      !goal &&
      plans.length === 0 &&
      memories.length === 0
    )
      return;

    html += '<div class="npc-card">';

    // 1. 标题区
    html += `<div class="npc-name">${this.safeEscapeHtml(npcName)}`;
    if (npcType)
      html += `<span class="npc-type">${this.safeEscapeHtml(npcType)}</span>`;
    html += `</div>`;

    // 2. 行为链
    if (behavior) {
      const formattedBehavior = this.safeEscapeHtml(behavior).replace(
        /→/g,
        '<span class="npc-arrow"> ➔ </span>',
      );
      html += `<div class="npc-behavior"><span class="npc-inline-label">打算</span> <span class="npc-behavior-text">${formattedBehavior}</span></div>`;
    }

    // 3. 当前状态 (弃用 Emoji，改用优雅的排版对齐)
    if (status) {
      const statusParts = status.split("|").map((s) => s.trim());
      html += '<div class="npc-state-container">';

      if (statusParts[0]) {
        const tags = statusParts[0].split(/[/\\]/);
        html += '<div class="npc-status-tags">';
        tags.forEach((t) => {
          html += `<span class="npc-status-tag">${this.safeEscapeHtml(t.trim())}</span>`;
        });
        html += "</div>";
      }
      if (statusParts[1]) {
        html += `<div class="npc-state-desc">${this.safeEscapeHtml(statusParts[1])}</div>`;
      }
      if (statusParts[2]) {
        html += `<div class="npc-state-detail"><span class="elegant-label">位置</span><span class="elegant-text">${this.safeEscapeHtml(statusParts[2])}</span></div>`;
      }
      if (statusParts[3]) {
        html += `<div class="npc-state-detail"><span class="elegant-label">行动</span><span class="elegant-text">${this.safeEscapeHtml(statusParts[3])}</span></div>`;
      }
      html += "</div>";
    }

    // 4. 长期目标 (作为独立区块)
    if (goal) {
      html += `<div class="npc-section-block">`;
      html += `<div class="npc-block-title">长期目标</div>`;
      html += `<div class="npc-goal-text">${this.safeEscapeHtml(goal)}</div>`;
      html += `</div>`;
    }

    // 5. 近期打算
    if (plans.length > 0) {
      html += `<div class="npc-section-block">`;
      html += `<div class="npc-block-title">近期打算</div>`;
      plans.forEach((plan) => {
        const planParts = plan.split("|").map((p) => p.trim());
        const pContent = planParts[0] || "";
        const pAction =
          planParts.length > 1 ? planParts[1] : "";
        const pTime = planParts.length > 2 ? planParts[2] : "";

        html += `<div class="npc-plan-item">`;
        html += `<div class="npc-plan-main">${this.safeEscapeHtml(pContent)}</div>`;

        if (pAction || pTime) {
          html += `<div class="npc-plan-meta">`;
          if (pAction)
            html += `<span class="npc-plan-status">${this.safeEscapeHtml(pAction)}</span>`;
          // 替换沙漏 Emoji，改用文字或纯净符号
          if (pTime)
            html += `<span class="npc-plan-time"><span class="elegant-symbol">◷</span> ${this.safeEscapeHtml(pTime)}</span>`;
          html += `</div>`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    }

    // 6. 关键记忆
    if (memories.length > 0) {
      html += `<div class="npc-section-block">`;
      html += `<div class="npc-block-title">关键记忆档案</div>`;
      html += `<div class="npc-memories-list">`;
      memories.forEach((mem) => {
        const formattedMem = this.safeEscapeHtml(mem).replace(
          /→/g,
          '<span class="npc-arrow-gold"> ➪ </span>',
        );
        html += `<div class="npc-memory-item"><span class="memory-bullet">◈</span><div class="memory-text">${formattedMem}</div></div>`;
      });
      html += `</div></div>`;
    }

    html += "</div>";
  });

  html += "</div>";

  if (newsContent) {
    html += this.renderNewspaperPanel(newsContent);
  }
  // 🔴 核心修复结束：关闭刚才加的那个纯净打包 div
  html += "</div>";

  html += "</div></div>";
  return html;
},
// 渲染报纸面板 (优化正则提取逻辑，提升性能)
renderNewspaperPanel(newsContent) {
  let html = '<div class="newspaper-panel">';

  // 💡 1. 头部保持在折叠容器的外部，这样折叠后标题仍可见
  html += '<div class="newspaper-header">';
  html += '<div class="newspaper-title">The Backlund Gazette</div>';
  html +=
    '<div class="newspaper-subtitle">~ Daily Chronicles of the Extraordinary ~</div>';
  html += "</div>";

  // 💡 2. 增加外壳容器：将所有新闻条目和底部标语包裹在 newspaper-content 中
  html += '<div class="newspaper-content">';
  // 必须套一层无样式的直接子元素，供 CSS Grid 限制 min-height: 0 和溢出隐藏
  html += "<div>";

  // 【优化】简化正则，防止大段文本导致卡顿
  const newsItems =
    newsContent.match(/[\[【(][^\]】)]+[\]】)]\s*[^\n\[【(]+/g) ||
    [];

  if (newsItems.length === 0) {
    // 备用方案：按行分割
    const lines = newsContent
      .split("\n")
      .filter((line) => line.trim() && line.length > 5);

    // 这里的 forEach 逻辑基本不用动
    lines.forEach((line, index) => {
      if (index > 0 && index % 3 === 0) {
        html += '<div class="newspaper-divider"></div>';
      }
      html += '<div class="news-item">';
      html += `<div class="news-content">${this.safeEscapeHtml(line.trim())}</div>`;
      html += "</div>";
    });
  } else {
    newsItems.forEach((item, index) => {
      const match = item.match(
        /([\[【(][^\]】)]+[\]】)])\s*(.+)/,
      );
      if (match) {
        // 清理日期上的括号
        const date = match[1]
          .replace(/[\[\]【】()]/g, "")
          .trim();
        const content = match[2].trim();

        if (index > 0 && index % 3 === 0) {
          html += '<div class="newspaper-divider"></div>';
        }

        html += '<div class="news-item">';
        html += `<div class="news-date">${this.safeEscapeHtml(date)}</div>`;
        html += `<div class="news-content">${this.safeEscapeHtml(content)}</div>`;
        html += "</div>";
      }
    });
  }

  // 将页脚也放进折叠区域里
  html +=
    '<div class="newspaper-footer">— Published in the Foggy Capital —</div>';

  // 💡 3. 关闭内部 div 和 newspaper-content 外壳
  html += "</div>"; // 关闭无样式内部包装
  html += "</div>"; // 关闭 newspaper-content

  html += "</div>"; // 关闭 newspaper-panel

  return html;
},
// 重新绑定判定块的交互事件（在innerHTML插入后调用）
rebindJudgmentInteractions(container) {
  if (!container || !window.judgmentBeautifierInstance) return;

  const judgmentBlocks =
    container.querySelectorAll(".judgment-block");

  if (judgmentBlocks.length > 0) {
    //console.log(`[rebindJudgmentInteractions] 找到 ${judgmentBlocks.length} 个判定块，重新绑定事件`);

    judgmentBlocks.forEach((block) => {
      window.judgmentBeautifierInstance.interactor.initialize(
        block,
      );
    });
  }
},



// --- L28024-28607: // ========================================== ---

// ==========================================
// 抽屉时间线目录渲染与跳转（全局导航）
// ==========================================
// 1. 全量重绘目录（仅在数据总量发生变化时调用）
buildTimelineDirectory() {
  let container = document.getElementById(
    "timeline-directory-container",
  );
  if (!container) {
    const drawerContent = document.querySelector(
      "#right-drawer .drawer-content",
    );
    if (!drawerContent) return;
    // 修改 buildTimelineDirectory 里的 insertAdjacentHTML
    drawerContent.insertAdjacentHTML(
      "beforeend",
      `
  <div class="timeline-dir-divider"></div>
  <div class="timeline-dir-title">📜 时间线目录</div>
  <div id="timeline-directory-container" class="timeline-dir-container"></div>
  `,
    );
    container = document.getElementById(
      "timeline-directory-container",
    );

    container.addEventListener("click", (e) => {
      const item = e.target.closest(".timeline-item");
      if (!item) return;
      const targetIndex = parseInt(
        item.getAttribute("data-index"),
        10,
      );
      if (!isNaN(targetIndex)) this.jumpToHistory(targetIndex);
    });
  }

  let html = "";
  // 🔴 性能飞跃：直接读干净的 Meta，彻底告别正则！
  for (let i = this.chatHistoryCache.length - 1; i >= 0; i--) {
    const snapshot = this.chatHistoryCache[i];
    
    // 直接读取全新的标准化字段
    const title = snapshot.meta?.title || "未命名节点";
    const date = snapshot.meta?.date || "未知时间";
    // 读取真正的绝对序号
    const serial = snapshot.meta?.serial || (i + 1); 
    const isActive = i === this.historyViewIndex ? "active" : "";

    html += `
        <div class="timeline-item ${isActive}" data-index="${i}">
        <span class="timeline-idx">№${serial}</span>
        <span class="timeline-title" title="${title}">${title}</span>
        <span class="timeline-date">${date}</span>
        </div>
        `;
  }
  container.innerHTML = html;
},

// 2. 极速局部高亮（在上一回合/下一回合/跳转时调用，绝对不破坏滚动条）
updateTimelineHighlight() {
  const container = document.getElementById(
    "timeline-directory-container",
  );
  if (!container) return;

  // 移除旧的高亮
  const oldActive = container.querySelector(".timeline-item.active");
  if (oldActive) oldActive.classList.remove("active");

  // 赋予新的高亮
  const newActive = container.querySelector(
    `.timeline-item[data-index="${this.historyViewIndex}"]`,
  );
  if (newActive) newActive.classList.add("active");
},

// 时间跃迁函数（终极时间引擎：负责UI刷新与内存状态的强制对齐）
async jumpToHistory(index) {
  if (this.isSwitching || this.chatHistoryCache.length === 0) return;
  
  this.isSwitching = true; // 开启手动锁

  try {
    // 🌟 步骤 1：先执行全量/增量清洗
    // 必须在获取 snapshot 变量之前完成！
    await this._migrateSnapshotMeta();

    // 🌟 步骤 2：清洗完成后，重新从缓存中获取“已经进化过”的对象
    const snapshot = this.chatHistoryCache[index];
    if (!snapshot) throw new Error("目标快照不存在");

    this.isHistoryViewMode = index !== this.chatHistoryCache.length - 1;

    // 🌟 步骤 3：执行 Schema 校验与内存对齐
    // 此时的 snapshot.data 已经经过了 _upgradeStateForNpcSplit 的洗礼
    this.currentMvuState = validateAndMigrateStatData(_.cloneDeep(snapshot.data));

    // 🌟 同步附属系统状态（如抽卡记录）
    if (snapshot.data.gacha_data) {
      this.gachaState = _.cloneDeep(snapshot.data.gacha_data.state);
      this.gachaCollection = _.cloneDeep(snapshot.data.gacha_data.collection);
      this.gachaHistory = _.cloneDeep(snapshot.data.gacha_data.history);
    }

    // 🌟 同步装备UI槽位缓存
    this.refreshEquipmentSlots();

    // 3. 拨动时间指针
    this.historyViewIndex = index;

    // 4. 统一执行渲染
    this.renderStateAt(snapshot);
    this.renderHistoryControls();

    // 5. 移动端体验优化（跃迁后自动收起抽屉看剧情）
    if (window.innerWidth <= 768) {
      document.getElementById("right-drawer")?.classList.remove("open");
      const overlay = document.querySelector(".drawer-overlay");
      if (overlay) overlay.classList.remove("active");
    }
    
    console.log(`[时间跃迁] 成功跳跃至节点 ${index}，内存已完全同步。`);
  } catch (e) {
    console.error("[时间跃迁] 失败:", e);
  } finally {
    this.isSwitching = false;
  }
},

//==============编辑模式==================

// 1. 沉浸式编辑器 DOM 注入
_initEditorDOM() {
  if (document.getElementById("immersive-editor-container")) return;

  // 完整保留所有结构，并应用净化后的 CSS 类
  const containerHTML = /* HTML */ `
    <div
      id="immersive-editor-container"
      class="immersive-editor-wrapper"
      style="display:none;"
    >
      <div class="editor-sticky-header">
        <span class="editor-header-title">✏️ 剧场文本覆写</span>
        <div class="editor-header-actions">
          <button
            id="btn-editor-close"
            class="interaction-btn"
          >
            放弃修改
          </button>
          <button
            id="btn-editor-save"
            class="interaction-btn primary-btn editor-btn-save"
          >
            保存修改
          </button>
        </div>
      </div>

      <textarea
        id="ingame-edit-gametxt"
        class="immersive-textarea"
      ></textarea>

      <div
        class="editor-panel-container collapsed"
        id="editor-panel-auto"
      >
        <button class="editor-collapse-btn">▶</button>
        <div class="editor-panel-title">💠 自动化系统</div>
        <div class="editor-panel-content">
          <textarea
            id="ingame-edit-details"
            class="immersive-textarea text-muted-input"
          ></textarea>
        </div>
      </div>

      <div
        class="editor-panel-container"
        id="editor-panel-journey"
      >
        <button class="editor-collapse-btn">▶</button>
        <div class="editor-panel-title">📜 本周目经历</div>
        <div
          class="editor-panel-content flex-col-gap4"
          id="ingame-edit-journey-container"
        ></div>
      </div>
    </div>
  `;

  const gameTextDisplay =
    document.getElementById("game-text-display");
  if (gameTextDisplay) {
    gameTextDisplay.insertAdjacentHTML("afterend", containerHTML);

    // 绑定按钮事件
    document
      .getElementById("btn-editor-close")
      .addEventListener("click", () => this.closeInGameEditor());
    document
      .getElementById("btn-editor-save")
      .addEventListener("click", () => this.saveInGameEditor());

    // 绑定折叠事件
    const bindToggle = (panelId) => {
      const panel = document.getElementById(panelId);
      panel
        .querySelector(".editor-panel-title")
        .addEventListener("click", () =>
          this._toggleEditorPanel(panelId),
        );
      panel
        .querySelector(".editor-collapse-btn")
        .addEventListener("click", () =>
          this._toggleEditorPanel(panelId),
        );
    };
    bindToggle("editor-panel-auto");
    bindToggle("editor-panel-journey");

    // 绑定高度实时同步
    const autoResizeHandler = (e) =>
      this._autoResizeTextarea(e.target);
    document
      .getElementById("ingame-edit-gametxt")
      .addEventListener("input", autoResizeHandler);
    document
      .getElementById("ingame-edit-details")
      .addEventListener("input", autoResizeHandler);
    document
      .getElementById("ingame-edit-journey-container")
      .addEventListener("input", (e) => {
        if (e.target.tagName.toLowerCase() === "textarea")
          this._autoResizeTextarea(e.target);
      });
  }
},

// 2. 唤起编辑器与数据静默净化
openInGameEditor() {
  if (
    this.isSwitching ||
    this.chatHistoryCache.length === 0 ||
    this.historyViewIndex < 0
  )
    return;
  const currentSnapshot =
    this.chatHistoryCache[this.historyViewIndex];
  if (!currentSnapshot || !currentSnapshot.message) return;

  this._initEditorDOM();
  const msg = currentSnapshot.message;

  // --- 1. 解析正文 ---
  let rawGametxt = this._getEditorTagContent(msg, "gametxt");
  this._currentEditStyle = "";
  const styleMatch = rawGametxt.match(/<style>([\s\S]*?)<\/style>/i);
  if (styleMatch) {
    this._currentEditStyle = styleMatch[1].trim();
    rawGametxt = rawGametxt.replace(
      /<style>[\s\S]*?<\/style>\n?/i,
      "",
    );
  }

  // --- 2. 解析自动化系统 (增加存在性判定) ---
  let rawDetails = "";
  let hasDetails = false;

  const detailsInTextMatch = rawGametxt.match(/<details[^>]*>([\s\S]*?)<\/details>/i);
  const globalDetailsMatch = msg.match(/<details[^>]*>([\s\S]*?)<\/details>/i);

  if (detailsInTextMatch) {
    rawDetails = detailsInTextMatch[1];
    rawGametxt = rawGametxt.replace(/<details[^>]*>[\s\S]*?<\/details>\n?/i, "");
    hasDetails = true;
  } else if (globalDetailsMatch) {
    rawDetails = globalDetailsMatch[1];
    hasDetails = true;
  } else {
    // 尝试通过标签函数获取
    rawDetails = this._getEditorTagContent(msg, "details");
    if (rawDetails) hasDetails = true;
  }

  // 控制自动化面板显隐
  const autoPanel = document.getElementById("editor-panel-auto");
  if (hasDetails) {
    autoPanel.style.display = "block"; // 或 flex，取决于你的 CSS
    // 静默剥离逻辑保持不变
    this._hiddenAutoTags = "";
    rawDetails = rawDetails.replace(/(<Auto>[\s\S]*?<\/Auto>\s*)/gi, (match) => {
      this._hiddenAutoTags += match;
      return "";
    });
    rawDetails = rawDetails.replace(/(💠识别的核心活跃NPC[^\n]*\n?\s*)/gi, (match) => {
      this._hiddenAutoTags += match;
      return "";
    });
    document.getElementById("ingame-edit-details").value = ""; // 🔴 补充：清空残留值防止保存时串盘
  } else {
    autoPanel.style.display = "none";
    this._hiddenAutoTags = "";
  }

  document.getElementById("ingame-edit-gametxt").value = rawGametxt.trim();

  // --- 4. 解析周目经历 ---
  const rawJourney = this._getEditorTagContent(msg, "本周目经历");
  const journeyContainer = document.getElementById(
    "ingame-edit-journey-container",
  );
  journeyContainer.innerHTML = "";

  const lines = rawJourney.split("\n");
  lines.forEach((line) => {
    if (!line.trim()) return;
    const splitIndex = line.indexOf("|");
    if (splitIndex !== -1) {
      const key = line.substring(0, splitIndex);
      const val = line.substring(splitIndex + 1);
      journeyContainer.insertAdjacentHTML(
        "beforeend",
        `
<div class="journey-edit-row">
<span class="journey-edit-key">${key} |</span>
<textarea class="journey-edit-val" data-key="${key}">${val}</textarea>
</div>
`,
      );
    } else {
      journeyContainer.insertAdjacentHTML(
        "beforeend",
        `
<div class="journey-edit-row">
<textarea class="journey-edit-val" data-key="" style="margin-left:90px;">${line}</textarea>
</div>
`,
      );
    }
  });

  this.isEditingMode = true;

  // 🎭 无痕接管
  document.getElementById("game-text-display").style.display = "none";
  const editorContainer = document.getElementById(
    "immersive-editor-container",
  );
  editorContainer.style.display = "flex";

  // 🔴 强制刷新高度：等 display 生效后立刻撑开所有 textarea
  setTimeout(() => {
    this._autoResizeTextarea(
      document.getElementById("ingame-edit-gametxt"),
    );
    this._autoResizeTextarea(
      document.getElementById("ingame-edit-details"),
    );
    // 经历面板默认是展开的，所以里面的也可以直接撑开
    document
      .querySelectorAll("#editor-panel-journey .journey-edit-val")
      .forEach((el) => this._autoResizeTextarea(el));
  }, 15);
},

closeInGameEditor() {
  this.isEditingMode = false;

  // 🎭 切回真美猴王
  const editorContainer = document.getElementById(
    "immersive-editor-container",
  );
  const gameTextDisplay =
    document.getElementById("game-text-display");
  if (editorContainer) editorContainer.style.display = "none";
  if (gameTextDisplay) gameTextDisplay.style.display = "block";
},

// 辅助功能：终极高度自适应 (彻底修复全屏输入法抽搐 Bug)
_autoResizeTextarea(el) {
  if (!el) return;

  // 🔴 第一步：搜集所有可能产生滚动的祖先节点，并快照它们的滚动位置
  const scrollContainers = [];
  let parent = el.parentNode;
  while (parent && parent !== document) {
    // 如果该节点有垂直滚动条
    if (parent.scrollHeight > parent.clientHeight) {
      scrollContainers.push({
        element: parent,
        top: parent.scrollTop,
      });
    }
    parent = parent.parentNode;
  }
  // 顺便记录 window 的滚动位置作为兜底
  const winScrollX = window.scrollX;
  const winScrollY = window.scrollY;

  // 🔴 第二步：执行高度重算 (这个动作会导致父容器瞬间坍塌)
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";

  // 🔴 第三步：在浏览器完成重绘前，瞬间强制恢复所有祖先节点的滚动位置
  // 这样输入法的焦点定位就不会被坍塌干扰，彻底打断抽搐循环
  scrollContainers.forEach((item) => {
    item.element.scrollTop = item.top;
  });
  window.scrollTo(winScrollX, winScrollY);
},

// 辅助功能：独立干净的折叠接管
_toggleEditorPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  // 切换折叠状态
  panel.classList.toggle("collapsed");

  // 更新按钮箭头图标
  const btn = panel.querySelector(".editor-collapse-btn");
  if (btn) {
    btn.textContent = panel.classList.contains("collapsed")
      ? "▶"
      : "▶";
  }

  // 🔴 关键逻辑：如果面板是从“折叠”变为“展开”，必须强行重算内部输入框高度！
  if (!panel.classList.contains("collapsed")) {
    setTimeout(() => {
      const textareas = panel.querySelectorAll("textarea");
      textareas.forEach((ta) => this._autoResizeTextarea(ta));
    }, 15);
  }
},

// 3. 保存时还原被隐藏的数据
async saveInGameEditor() {
  if (!this.isEditingMode) return;

  const currentSnapshot =
    this.chatHistoryCache[this.historyViewIndex];
  let msg = currentSnapshot.message;

  const newGametxtBase = document
    .getElementById("ingame-edit-gametxt")
    .value.trim();
  let newDetailsBase = document
    .getElementById("ingame-edit-details")
    .value.trim();

  // 🔴 核心还原：把隐藏的 <Auto> 和活跃 NPC 原封不动地接回去
  if (newDetailsBase) {
    newDetailsBase = (this._hiddenAutoTags || "") + newDetailsBase;
  }

  // 组装 gametxt
  let finalGametxt = "";
  if (this._currentEditStyle)
    finalGametxt += `<style>\n${this._currentEditStyle}\n</style>\n`;
  finalGametxt += newGametxtBase + "\n";
  if (newDetailsBase)
    finalGametxt += `<details>\n${newDetailsBase}\n</details>`;

  // 组装 本周目经历
  let finalJourneyLines = [];
  document.querySelectorAll(".journey-edit-row").forEach((row) => {
    const textarea = row.querySelector(".journey-edit-val");
    const key = textarea.getAttribute("data-key");
    const val = textarea.value.replace(/\n/g, "  ").trim();
    if (key) finalJourneyLines.push(`${key}|${val}`);
    else if (val) finalJourneyLines.push(val);
  });
  const finalJourney = finalJourneyLines.join("\n");

  // 双向截断覆盖
  msg = msg.replace(/<details>[\s\S]*?<\/details>\n?/gi, "");
  msg = this._updateEditorTagContent(msg, "gametxt", finalGametxt);
  msg = this._updateEditorTagContent(msg, "本周目经历", finalJourney);

  this.chatHistoryCache[this.historyViewIndex].message = msg;

  // 🔴 核心同步：手动编辑后，直接调用统一工厂更新元数据！
  const currentSnap = this.chatHistoryCache[this.historyViewIndex];
  // 传入编辑后的文本，兜底序号使用原快照的序号，并继承原有 meta（防止丢失备份标签）
  const fallbackSerial = currentSnap.meta?.serial || (this.historyViewIndex + 1);
  
  this.chatHistoryCache[this.historyViewIndex].meta = ChronicleCore.buildStandardMeta(
    finalJourney, 
    fallbackSerial, 
    currentSnap.meta || {}
  );

  try {
    await AppStorage.saveData(
      this._getHistoryKey(),
      this.chatHistoryCache,
    );

    let saveMessage = "快照文本已重写并固化！";
    if (finalJourney.trim()) {
      try {
        await this.writeToLorebook("本周目经历", finalJourney, true);
        saveMessage = "快照文本已重写、固化，并已自动同步世界书！";
      } catch (syncError) {
        console.error("[历史系统] 自动同步本周目经历失败:", syncError);
        saveMessage = "快照文本已重写并固化，但自动同步世界书失败。";
      }
    }

    this.showTemporaryMessage(saveMessage, 2400);
  } catch (e) {
    console.error("[历史系统] 保存失败:", e);
    this.showTemporaryMessage("快照保存失败，未能写入历史快照。", 3000);
    return;
  }

  this.closeInGameEditor();

  // 热重载与侧边栏刷新
  this.lastRenderedMessageId = null;
  this.renderStateAt(this.chatHistoryCache[this.historyViewIndex]);
  if (typeof this.buildTimelineDirectory === "function") {
    this.buildTimelineDirectory();
  }
},

// 获取指定标签内的文本（严格复用最后一次出现的标签位置）
_getEditorTagContent(message, tagName) {
  const startTag = `<${tagName}>`;
  const endTag = `</${tagName}>`;
  const lastStartIdx = message.lastIndexOf(startTag);
  if (lastStartIdx === -1) return "";

  let content = message.substring(lastStartIdx + startTag.length);
  const lastEndIdx = content.lastIndexOf(endTag);
  if (lastEndIdx !== -1) {
    content = content.substring(0, lastEndIdx);
  }
  // ✅ 修复：使用 \x60 代表反引号，彻底避开解析器的“模板字符串”判定Bug
  return content.replace(/\x60{3}(markdown|html)?/g, "").trim();
},

// 替换指定标签内的文本
_updateEditorTagContent(message, tagName, newContent) {
  const startTag = `<${tagName}>`;
  const endTag = `</${tagName}>`;
  const lastStartIdx = message.lastIndexOf(startTag);
  const lastEndIdx = message.lastIndexOf(endTag);

  // 场景 A：首尾标签均存在
  if (
    lastStartIdx !== -1 &&
    lastEndIdx !== -1 &&
    lastEndIdx > lastStartIdx
  ) {
    return (
      message.substring(0, lastStartIdx + startTag.length) +
      "\n" +
      newContent +
      "\n" +
      message.substring(lastEndIdx)
    );
  }
  // 场景 B：仅有开始标签，缺失闭合标签（执行自动修复）
  if (lastStartIdx !== -1) {
    return (
      message.substring(0, lastStartIdx + startTag.length) +
      "\n" +
      newContent +
      "\n" +
      endTag
    );
  }
  // 场景 C：完全不存在该标签，原样返回
  return message;
},



// --- L28976-29711: // ========================================== ---

// ==========================================
// 🪐 时间线坍缩系统 (Timeline Collapse Engine)
// ==========================================

// 加载坍缩设置
async loadCollapseSettings() {
  const defaultSettings = {
    keepCount: 50,
    mode: "gentle",
    autoEnable: false,
    autoThreshold: 100,
    skipBackup: false,
  };
  this.collapseSettings = await AppStorage.loadData(
    "timeline_collapse_settings",
    defaultSettings,
  );
},
// 保存坍缩设置
async saveCollapseSettings() {
  const keepCount = parseInt(
    document.getElementById("collapse-keep-count")?.value || 50,
    10,
  );
  const mode =
    document.querySelector('input[name="collapse-mode"]:checked')
      ?.value || "gentle";
  const autoEnable =
    document.getElementById("collapse-auto-enable")?.checked ||
    false;
  const autoThreshold = parseInt(
    document.getElementById("collapse-auto-threshold")?.value ||
      100,
    10,
  );
  const skipBackup =
    document.getElementById("collapse-skip-backup")?.checked ||
    false;

  this.collapseSettings = {
    keepCount,
    mode,
    autoEnable,
    autoThreshold,
    skipBackup,
  };
  await AppStorage.saveData(
    "timeline_collapse_settings",
    this.collapseSettings,
  );
},
// 执行时间线坍缩 (重构后)
async executeTimelineCollapse(isAuto = false) {
  if (!this.collapseSettings) await this.loadCollapseSettings();
  const settings = this.collapseSettings;

  const totalSnaps = this.chatHistoryCache.length;
  const keepCount = settings.keepCount;

  if (totalSnaps <= keepCount) {
    if (!isAuto)
      this.showTemporaryMessage(
        "当前快照数量未超过保留阈值，无需坍缩。",
      );
    return;
  }

  const deleteCount = totalSnaps - keepCount;

  // 🔴 1. 提取真实的事件序号范围 (秒读 Meta 绝对序号！杜绝正则解析！)
  const firstSnap = this.chatHistoryCache[0];
  const lastSnap = this.chatHistoryCache[totalSnaps - 1];
  
  const startSeq = firstSnap?.meta?.serial || 1;
  const endSeq = lastSnap?.meta?.serial || totalSnaps;

  if (!isAuto) {
    const confirmed = await new Promise((resolve) => {
      this.showConfirmModal(
        `【时间线坍缩警告】<br><br>将永久剥离最旧的 ${deleteCount} 个快照，仅保留最近 ${keepCount} 回合的完整锚点。<br><br>模式：[${settings.mode === "gentle" ? "温和坍缩-保留记忆" : "彻底抹除-清除记忆"}]<br><br>${settings.skipBackup ? "<span style='color:var(--color-danger);font-weight:bold;'>⚠️ 危险警告：您已勾选【跳过全量备份】！系统将直接切割数据，不会生成任何本地文件，操作不可逆转！</span>" : `系统会先生成包含完整世界书的备份文件（事件：${startSeq}至${endSeq}），确定执行吗？`}`,
        () => resolve(true),
        () => resolve(false),
      );
    });
    if (!confirmed) return;
  }

  this.showTemporaryMessage(
    isAuto
      ? (settings.skipBackup ? "正在后台执行物理坍缩(已跳过备份)..." : "正在后台执行自动坍缩与备份...")
      : (settings.skipBackup ? "正在直接执行坍缩切割..." : "正在生成全量历史备份..."),
  );

  // 🔴 2 & 3. 核心重构：使用工厂函数构建终极时空胶囊并导出
  if (!settings.skipBackup) {
    try {
      const safeSaveName = `坍缩前备份_事件${startSeq}至${endSeq}`;

      // 📦 直接召唤工厂函数，一行代码拿到包含世界书、抽卡、快照的完整 Payload
      const saveDataPayload =
        await this._buildSavePayload(safeSaveName);

      const exportData = {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        saveData: saveDataPayload, // 完美嵌入！
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], {
        type: "application/json",
      });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;

      const dateStr = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      a.download = `Sefirot_${safeSaveName}_${dateStr}.json`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      // 稍作延迟以确保下载触发
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      }, 2500);
    } catch (e) {
      console.error("[坍缩系统] 备份导出失败:", e);
      if (!isAuto) {
        this.showTemporaryMessage(
          "备份导出异常，为保护数据，已终止坍缩操作！",
          4000,
        );
        return;
      }
    }
  } else {
    console.log("[坍缩系统] 玩家已指定跳过全量备份，直接进入手术阶段。");
  }

  // --- 4. 执行外科手术 (无损切断与继承) ---
  try {
    const deletedSnapshots = this.chatHistoryCache.slice(0, deleteCount);
    let remainingSnapshots = this.chatHistoryCache.slice(deleteCount);

    if (remainingSnapshots.length > 0) {
      const newBaseSnap = remainingSnapshots[0];

      if (settings.mode === "gentle") {
        // 🌟 温和模式：调用时空管理局手术刀，瞬间合并所有被删快照与新起点的经历！
        const textsToMerge = deletedSnapshots.map(snap => snap.meta?.journey_full_text || "");
        textsToMerge.push(newBaseSnap.meta?.journey_full_text || ""); // 加入新起点的本体
        
        const finalJourneyStr = ChronicleCore.mergeJourneyTexts(textsToMerge);

        if (finalJourneyStr) {
          // 重新把合并后的超大经历文本送进装配车间，给新起点生成完美的 Meta
          const fallbackSerial = newBaseSnap.meta?.serial || startSeq;
          newBaseSnap.meta = ChronicleCore.buildStandardMeta(finalJourneyStr, fallbackSerial, newBaseSnap.meta);
          
          console.log(`[坍缩系统] 🌍 已将过往历史(事件${startSeq}至${newBaseSnap.meta.serial})静默压制进新起点的 Meta 中。`);
        }
      } else {
        // 🌟 彻底抹除模式：清理世界书旧数据
        const minSeqId = newBaseSnap.meta?.serial || 1;
        const bookName = WorldbookManager.PRIMARY_BOOK;
        const index = this.unifiedIndex;
        const journeyKey = index > 1 ? `本周目经历(${index})` : "本周目经历";
        
        const allEntries = await TavernHelper.getLorebookEntries(bookName);
        const journeyEntry = allEntries.find((entry) => entry.comment === journeyKey);

        if (journeyEntry && journeyEntry.content) {
          // 直接使用 ChronicleCore 解析并截断
          const loreEvents = ChronicleCore.parseTextToEvents(journeyEntry.content);
          const keptEvents = loreEvents.filter((ev) => parseInt(ev["序号"], 10) >= minSeqId);
          const newContent = keptEvents.map((ev) => ChronicleCore.stringifyEventToText(ev)).join("\n\n");
          
          await TavernHelper.setLorebookEntries(bookName, [
            { uid: journeyEntry.uid, content: newContent },
          ]);
          console.log(`[坍缩系统] 🔪 彻底抹除模式生效：已从世界书中删除了绝对序号小于 ${minSeqId} 的事件。`);
        }
      }
    }

    // --- 5. 状态收束与落盘 ---
    this.chatHistoryCache = remainingSnapshots;

    if (this.historyViewIndex >= totalSnaps) {
      this.historyViewIndex = this.chatHistoryCache.length - 1;
    } else if (this.historyViewIndex >= deleteCount) {
      this.historyViewIndex -= deleteCount;
    } else {
      this.historyViewIndex = 0;
    }

    await AppStorage.saveData(
      this._getHistoryKey(),
      this.chatHistoryCache,
    );

    if (typeof this.buildTimelineDirectory === "function")
      this.buildTimelineDirectory();
    this.renderHistoryControls();

    if (!isAuto) {
      this.showTemporaryMessage("✅ 时间线坍缩完美收束！", 3000);
      await this.showJourney();
    } else {
      console.log(
        `[自动坍缩] 成功在后台将快照修剪至 ${keepCount} 回合。`,
      );
    }
  } catch (e) {
    console.error("[坍缩系统] 执行切割失败:", e);
    if (!isAuto)
      this.showTemporaryMessage("执行坍缩手术失败: " + e.message);
  }
},

//----------大总结页面-----------
// 大总结提醒 (重构版)
async checkForSummaryReminder() {
  if (this.summaryReminderShown) return;

  // ✨ 新增：读取大总结提醒阈值 (默认 30)
  if (this.summaryReminderThreshold === undefined) {
    this.summaryReminderThreshold = await AppStorage.loadData("summary_reminder_threshold", 30);
  }
  // 如果阈值设为 0，则视为永久关闭提醒
  if (this.summaryReminderThreshold === 0) return;

  try {
    const bookName = WorldbookManager.PRIMARY_BOOK;
    const journeyKey = ChronicleCore.getLorebookKey("journey", this.unifiedIndex);
    const coreMemoryKey = ChronicleCore.getLorebookKey("core_memory", this.unifiedIndex);
    const allEntries = await TavernHelper.getLorebookEntries(bookName);
    
    const journeyEntry = allEntries.find((entry) => entry.comment === journeyKey);
    if (!journeyEntry || !journeyEntry.content) return;

    const allEvents = ChronicleCore.parseTextToEvents(journeyEntry.content);
    if (allEvents.length === 0) return;

    const coreMemoryEntry = allEntries.find((entry) => entry.comment === coreMemoryKey);
    
    // 🔴 核心极简：直接调用提取器！
    const lastSummarizedId = ChronicleCore.extractSummarizedId(coreMemoryEntry?.content);
    console.log(`[总结提醒] 从核心记忆中读取到最后总结ID：${lastSummarizedId}`);

    const newEvents = allEvents.filter((event) => {
      const eventId = parseInt(event["序号"] || "0", 10);
      return !isNaN(eventId) && eventId > lastSummarizedId;
    });

    const newEventCount = newEvents.length;
    console.log("[总结提醒] 未总结的新事件数：", newEventCount);

    if (newEventCount >= this.summaryReminderThreshold) {
      const message = `您已有 ${newEventCount} 条新事件未进行总结。\n为了保持“核心记忆”的清晰，建议您进行一次总结。`;
      setTimeout(() => {
        this.showConfirmModal(
          message.replace(/\n/g, "<br>"),
          async () => {
            this.summaryReminderShown = false;
            await this.showJourney().then(() => this.showSummarizerModal());
          },
          () => { this.summaryReminderShown = false; }
        );
      }, 300);
    }
  } catch (e) {
    console.error("检查总结提醒时出错:", e);
  }
},
// 大总结窗口 (重构版 + 自选截止序号)
async showSummarizerModal() {
  this.openModal("summarizer-modal", true);
  const body = document.getElementById("summarizer-body");
  const footer = document.getElementById("summarizer-footer");
  body.innerHTML = '<div class="summarizer-loading">正在准备总结材料...</div>';
  footer.innerHTML = "";

  // 读取大总结提醒阈值（默认 30）
  if (this.summaryReminderThreshold === undefined) {
    this.summaryReminderThreshold = await AppStorage.loadData("summary_reminder_threshold", 30);
  }

  try {
    const selectedCheckboxes = document.querySelectorAll(".journey-select-checkbox:checked");
    const isCustomMode = selectedCheckboxes.length > 0;
    const mode = isCustomMode ? "custom" : "incremental";

    const bookName = WorldbookManager.PRIMARY_BOOK;
    const journeyKey = ChronicleCore.getLorebookKey("journey", this.unifiedIndex);
    const coreMemoryKey = ChronicleCore.getLorebookKey("core_memory", this.unifiedIndex);

    const allEntries = await TavernHelper.getLorebookEntries(bookName);
    const journeyEntry = allEntries.find((entry) => entry.comment === journeyKey);

    if (!journeyEntry || !journeyEntry.content) {
      body.innerHTML = '<p class="modal-placeholder">“本周目经历”为空，无法进行总结。</p>';
      return;
    }
    const allEvents = ChronicleCore.parseTextToEvents(journeyEntry.content);
    const coreMemoryEntry = allEntries.find((entry) => entry.comment === coreMemoryKey);
    const lastSummarizedId = ChronicleCore.extractSummarizedId(coreMemoryEntry?.content);

    // 计算可选范围
    const customIds = isCustomMode
      ? Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.sequenceId, 10)).filter(n => !isNaN(n))
      : [];
    const newestId = allEvents.length > 0
      ? parseInt(allEvents[allEvents.length - 1]["序号"], 10)
      : 0;
    const minSelectableId = isCustomMode
      ? Math.min(...customIds)
      : (lastSummarizedId + 1);
    const maxSelectableId = isCustomMode
      ? Math.max(...customIds)
      : newestId;

    if (maxSelectableId < minSelectableId) {
      body.innerHTML = '<p class="modal-placeholder">没有需要总结的新事件。</p>';
      return;
    }

    // 工具：根据当前模式 + 截止序号，得出待总结事件列表
    const computeEvents = (endId) => {
      if (isCustomMode) {
        const selectedSet = new Set(Array.from(selectedCheckboxes).map(cb => cb.dataset.sequenceId));
        return allEvents.filter(ev => selectedSet.has(ev["序号"]) && parseInt(ev["序号"], 10) <= endId);
      }
      return allEvents.filter(ev => {
        const id = parseInt(ev["序号"], 10);
        return id > lastSummarizedId && id <= endId;
      });
    };

    let currentEndId = maxSelectableId;
    let eventsToSummarize = computeEvents(currentEndId);

    if (eventsToSummarize.length === 0) {
      body.innerHTML = '<p class="modal-placeholder">没有需要总结的新事件。</p>';
      return;
    }

    const buildInfoText = (events) => {
      if (events.length === 0) return "当前范围内没有可总结的事件。";
      const startId = events[0]["序号"];
      const endId = events[events.length - 1]["序号"];
      return isCustomMode
        ? `您已选择 ${events.length} 个事件进行自定义总结（序号 #${startId} 至 #${endId}）。`
        : `发现 ${events.length} 个新事件（序号 #${startId} 至 #${endId}）`;
    };

    const buildInputListHtml = (events) => events
      .map(event => {
        const title = event["大纲"] || event["标题"] || "无标题";
        return `<div class="summarizer-input-item">[${event["序号"]}] ${title}</div>`;
      })
      .join("");

    // 渲染“记忆蒸馏器”新界面（增加“总结到序号”输入框）
    body.innerHTML = /* HTML */ `
      <div class="summarizer-controls">
        <p id="summarizer-info-text">${buildInfoText(eventsToSummarize)}</p>
        <div style="display:flex; align-items:center; gap:8px; margin:8px 0; flex-wrap:wrap;">
          <label for="summarizer-end-id" style="font-size: var(--text-sm);">总结到序号 #</label>
          <input
            type="number"
            id="summarizer-end-id"
            min="${minSelectableId}"
            max="${maxSelectableId}"
            value="${currentEndId}"
            style="width: 90px; padding: 2px 6px;"
          />
          <span style="font-size: var(--text-xs); color: var(--text-muted);">
            （可选范围 #${minSelectableId} ~ #${maxSelectableId}，默认最新）
          </span>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); margin-left: auto;">
            <span>弹窗提醒阈值:</span>
            <input type="number" id="summary-threshold-input" class="modal-input center-input" value="${this.summaryReminderThreshold}" min="0" max="999" style="width: 50px; height: 22px; min-height: 22px; padding: 2px 4px; font-size: 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(164,139,87,0.4);">
            <span title="设为 0 可永久关闭提醒弹窗" style="cursor: help; text-decoration: underline dotted rgba(255,255,255,0.3);">条</span>
          </div>
        </div>
        <button
          id="btn-generate-summary"
          class="interaction-btn primary-btn"
        >
          开始提炼记忆精华
        </button>
      </div>
      <div class="summarizer-container">
        <div class="summarizer-input">
          <div class="summarizer-header">待提炼的记忆</div>
          <div id="summarizer-input-list">
            ${buildInputListHtml(eventsToSummarize)}
          </div>
        </div>
        <div class="summarizer-output-wrapper">
          <div class="summarizer-header">凝结的记忆精华</div>
          <div id="summarizer-output-container">
            <div class="summarizer-loading">
              等待开始...
            </div>
          </div>
        </div>
      </div>
    `;

    const endIdInput = document.getElementById("summarizer-end-id");
    const infoTextEl = document.getElementById("summarizer-info-text");
    const inputListEl = document.getElementById("summarizer-input-list");

    // 输入过程中：只刷新预览，不强行改写输入框，避免你打字到一半被钳值
    const previewOnly = () => {
      const raw = endIdInput.value.trim();
      if (raw === "") return; // 空着允许继续输入
      const v = parseInt(raw, 10);
      if (isNaN(v) || v < minSelectableId || v > maxSelectableId) return; // 非法/越界先不刷新
      currentEndId = v;
      eventsToSummarize = computeEvents(currentEndId);
      infoTextEl.textContent = buildInfoText(eventsToSummarize);
      inputListEl.innerHTML = buildInputListHtml(eventsToSummarize);
    };

    // 失焦 / 回车 / 数字微调按钮：才做最终钳值并回写
    const commitValue = () => {
      let v = parseInt(endIdInput.value, 10);
      if (isNaN(v)) v = maxSelectableId;
      if (v < minSelectableId) v = minSelectableId;
      if (v > maxSelectableId) v = maxSelectableId;
      endIdInput.value = v;
      currentEndId = v;
      eventsToSummarize = computeEvents(currentEndId);
      infoTextEl.textContent = buildInfoText(eventsToSummarize);
      inputListEl.innerHTML = buildInputListHtml(eventsToSummarize);
    };

    endIdInput.addEventListener("input", previewOnly);
    endIdInput.addEventListener("change", commitValue); // change 在失焦/回车时触发
    endIdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        endIdInput.blur(); // 触发 change
      }
    });

    // ✨ 新增：绑定提醒阈值输入框的记忆存储
    const thresholdInput = document.getElementById("summary-threshold-input");
    if (thresholdInput) {
      thresholdInput.addEventListener("change", async (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 0) val = 30; // 容错兜底
        e.target.value = val;
        this.summaryReminderThreshold = val;
        await AppStorage.saveData("summary_reminder_threshold", val);

        // 给个小提示让玩家安心
        if (val === 0) {
          this.showTemporaryMessage("已永久关闭大总结提醒弹窗");
        } else {
          this.showTemporaryMessage(`大总结提醒阈值已设为 ${val} 条`);
        }
      });
    }

    const generateBtn = document.getElementById("btn-generate-summary");
    generateBtn.addEventListener("click", () => {
      if (!eventsToSummarize || eventsToSummarize.length === 0) {
        this.showTemporaryMessage("当前范围内没有可总结的事件。");
        return;
      }
      const lastEventId = eventsToSummarize[eventsToSummarize.length - 1]["序号"];
      const promptMaterial = eventsToSummarize.map(ev => ChronicleCore.stringifyEventToText(ev)).join("\n\n");
      generateBtn.dataset.mode = mode;
      generateBtn.dataset.lastEventId = lastEventId;
      this.performSummarization(promptMaterial, mode, lastEventId);
    });
  } catch (e) {
    console.error("准备总结器时出错:", e);
    body.innerHTML = /* HTML */ `<p class="modal-placeholder">
      准备总结时出错: ${e.message}
    </p>`;
  }
},
//执行大总结
async performSummarization(promptMaterial, mode, lastEventId) {
  const outputContainer = document.getElementById(
    "summarizer-output-container",
  );
  const generateBtn = document.getElementById("btn-generate-summary");
  if (!outputContainer || !generateBtn) return;

  generateBtn.disabled = true;
  outputContainer.innerHTML =
    '<div class="summarizer-loading">正在构建防御性指令并请求摘要...</div>';

  // 升起“信号旗”，告知 handleStreamEnd 准备劫持
  this.isSummarizing = true;

  try {
    const firstEventMatch = promptMaterial.match(/序号\|(\d+)/);
    const firstEventId = firstEventMatch ? firstEventMatch[1] : "?";
    const defensive_template = GameDBManager.renderTemplate("defensive_template", {
      promptMaterial: promptMaterial, 
      firstEventId: firstEventId,
      lastEventId: lastEventId
    });

    await TavernHelper.generateRaw({
      ordered_prompts: [
        'world_info_before', 
        'persona_description',
        {
          role: "system", // 使用 'system' 角色，语义上权重更高
          content: defensive_template,
        },
      ],
      should_stream: false,
    });
    // 结果将由完美的 handleStreamEnd 劫持
  } catch (e) {
    console.error("生成摘要时调用 TavernHelper.generate 失败:", e);
    outputContainer.innerHTML = /* HTML */ `<p
      class="modal-placeholder"
    >
      生成摘要失败: ${e.message}
    </p>`;
    generateBtn.disabled = false;
    this.isSummarizing = false;
  }
},
// 写入世界书 (重构版：绝对的安全烙印)
async writeSummaryToLorebook(mode, lastEventId) {
  const outputTextarea = document.getElementById("summarizer-output");
  if (!outputTextarea) return;
  const summaryContent = outputTextarea.value.trim();
  if (!summaryContent) return this.showTemporaryMessage("摘要内容不能为空。");

  this.showTemporaryMessage("正在将记忆固化到世界书中...");
  try {
    const bookName = WorldbookManager.PRIMARY_BOOK;
    const coreMemoryKey = ChronicleCore.getLorebookKey("core_memory", this.unifiedIndex);
    const allEntries = await TavernHelper.getLorebookEntries(bookName);
    let targetEntry = allEntries.find((entry) => entry.comment === coreMemoryKey);

    if (!targetEntry) {
      await TavernHelper.createLorebookEntries(bookName, [{ comment: coreMemoryKey, keys: [coreMemoryKey], content: "", enabled: true }]);
      targetEntry = (await TavernHelper.getLorebookEntries(bookName)).find((entry) => entry.comment === coreMemoryKey);
    }

    let newContent = "";
    if (mode === "incremental") {
      const existingContent = targetEntry.content || "";
      // 🔴 直接剥离旧标签
      const cleanExisting = existingContent.replace(/\[Meta-LastSummarizedId:\s*\d+\]/g, "").trim();
      newContent = cleanExisting ? `${cleanExisting}\n\n---\n\n${summaryContent}` : summaryContent;
    } else {
      newContent = summaryContent;
    }

    // 🔴 核心修复：用统一的烙印器打上标记，再也不怕多一个换行导致崩溃了！
    newContent = ChronicleCore.updateSummarizedId(newContent, lastEventId);

    await TavernHelper.setLorebookEntries(bookName, [{ uid: targetEntry.uid, content: newContent }]);
    this.showTemporaryMessage("核心记忆已成功更新！", 3000);
    this.summaryReminderShown = false; 
    this.closeAllModals();
  } catch (e) {
    console.error("写入核心记忆失败:", e);
    this.showTemporaryMessage(`写入失败: ${e.message}`, 4000);
  }
},

//----------二次精炼页面-----------
//二次精炼界面显示
async showRefineModal() {
  this.openModal("refine-modal", true);
  const body = document.getElementById("refine-body");
  const footer = document.getElementById("refine-footer");
  body.innerHTML =
    '<div class="summarizer-loading">正在准备精炼材料...</div>';
  footer.innerHTML = "";

  try {
    const bookName = WorldbookManager.PRIMARY_BOOK;
    const coreMemoryKey = ChronicleCore.getLorebookKey("core_memory", this.unifiedIndex);
    const allEntries =
      await TavernHelper.getLorebookEntries(bookName);
    const coreMemoryEntry = allEntries.find(
      (entry) => entry.comment === coreMemoryKey,
    );

    if (!coreMemoryEntry || !coreMemoryEntry.content) {
      body.innerHTML =
        '<p class="modal-placeholder">"本周目核心记忆"为空，无法进行二次精炼。</p>';
      return;
    }

    // 提取核心记忆内容用于精炼
    const coreMemoryContent = coreMemoryEntry.content;

    // 渲染二次精炼界面
    body.innerHTML = /* HTML */ `
      <div class="summarizer-controls">
        <p>根据已有的核心记忆进行二次精炼和合并</p>
        <button
          id="btn-generate-refine"
          class="interaction-btn primary-btn"
        >
          开始二次精炼
        </button>
      </div>
      <div class="summarizer-container">
        <div class="summarizer-input">
          <div class="summarizer-header">
            本周目核心记忆全部内容
          </div>
          <div
            id="refine-input-container"
            class="refine-input-box"
          >
            ${coreMemoryContent}
          </div>
        </div>
        <div class="summarizer-output-wrapper">
          <div class="summarizer-header">
            再次精炼后的记忆
          </div>
          <div id="refine-output-container">
            <div class="summarizer-loading">
              等待开始...
            </div>
          </div>
        </div>
      </div>
    `;

    const generateBtn = document.getElementById(
      "btn-generate-refine",
    );
    generateBtn.addEventListener("click", () =>
      this.performRefinement(coreMemoryContent),
    );
  } catch (e) {
    console.error("准备二次精炼器时出错:", e);
    body.innerHTML = /* HTML */ `<p class="modal-placeholder">
      准备精炼时出错: ${e.message}
    </p>`;
  }
},
//执行二次精炼总结
async performRefinement(coreMemoryContent) {
  const outputContainer = document.getElementById(
    "refine-output-container",
  );
  const generateBtn = document.getElementById("btn-generate-refine");
  if (!outputContainer || !generateBtn) return;

  generateBtn.disabled = true;
  outputContainer.innerHTML =
    '<div class="summarizer-loading">正在进行二次精炼...</div>';

  this.isRefining = true;

  try {
    const refine_template = GameDBManager.renderTemplate("refine_memory", {
      coreMemoryContent: coreMemoryContent});

    // 使用 generateRaw 只发送指定内容，不加入酒馆预设
    await TavernHelper.generateRaw({
      ordered_prompts: [
        {
          role: "user",
          content: refine_template,
        },
      ],
      should_stream: false,
    });
    // 结果将由 handleStreamEnd 劫持
  } catch (e) {
    console.error(
      "生成精炼内容时调用 TavernHelper.generate 失败:",
      e,
    );
    outputContainer.innerHTML = /* HTML */ `<p
      class="modal-placeholder"
    >
      生成精炼失败: ${e.message}
    </p>`;
    generateBtn.disabled = false;
    this.isRefining = false;
  }
},
//二次精炼总结写入世界书
async writeRefineToLorebook(refinedContent) {
  const content = refinedContent.trim();
  if (!content) {
    this.showTemporaryMessage("精炼内容不能为空。");
    return;
  }

  this.showTemporaryMessage("正在将精炼内容更新到世界书中...");
  try {
    const bookName = WorldbookManager.PRIMARY_BOOK;
    const coreMemoryKey = ChronicleCore.getLorebookKey("core_memory", this.unifiedIndex);
    const allEntries =
      await TavernHelper.getLorebookEntries(bookName);
    let targetEntry = allEntries.find(
      (entry) => entry.comment === coreMemoryKey,
    );

    if (!targetEntry) {
      this.showTemporaryMessage("未找到核心记忆条目。");
      return;
    }

    // 直接用新内容覆盖原有内容
    await TavernHelper.setLorebookEntries(bookName, [
      { uid: targetEntry.uid, content: content },
    ]);
    this.showTemporaryMessage("核心记忆已成功精炼更新！", 3000);
    this.closeAllModals();
  } catch (e) {
    console.error("写入精炼内容失败:", e);
    this.showTemporaryMessage(`写入失败: ${e.message}`, 4000);
  }
},


