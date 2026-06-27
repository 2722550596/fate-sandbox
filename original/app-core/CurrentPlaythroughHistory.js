// 文件: CurrentPlaythroughHistory.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L28608-28975: // =================================================== ---

// ===================================================
// =============【本周目经历与历史的投影相关】==========
// ===================================================

//========本周目经历==========
// 修改你原来的解析函数，作为代理转发给 ChronicleCore
parseJourneyEntry(contentString) {
  return ChronicleCore.parseTextToEvents(contentString);
},

// 修改你原来的序列化函数，作为代理转发给 ChronicleCore
stringifyJourneyEvent(event) {
  return ChronicleCore.stringifyEventToText(event);
},

//主界面：本周目经历、坍缩控制台与总结入口
async showJourney() {
  this.openModal("history-modal");
  await this.loadUnifiedIndex();
  const header = document.querySelector(
    "#history-modal .modal-header",
  );
  const titleEl = document.getElementById("history-modal-title");
  if (titleEl) titleEl.textContent = "本周目经历";

  // 清除之前可能存在的按钮
  const existingRepairBtn = document.getElementById("btn-repair-journey");
  if (existingRepairBtn) existingRepairBtn.remove();

  const existingBtn = document.getElementById("btn-show-summarizer");
  if (existingBtn) existingBtn.remove();

  const existingRefineBtn =
    document.getElementById("btn-show-refine");
  if (existingRefineBtn) existingRefineBtn.remove();

  const contentPlaceholder = document.getElementById(
    "timeline-content-container",
  );
  const consolePlaceholder = document.getElementById(
    "trim-console-placeholder",
  );

  if (contentPlaceholder)
    contentPlaceholder.innerHTML =
      '<p class="modal-placeholder">正在安全加载记忆...请勿操作</p>';
  if (consolePlaceholder) consolePlaceholder.innerHTML = "";

  // 【核心修改】在标题旁边添加入口按钮
  // 完全摆脱写死的 inline style，直接加我们写好的 helper class
  if (header) {
    const summarizerBtn = document.createElement("button");
    summarizerBtn.id = "btn-show-summarizer";
    summarizerBtn.className = "interaction-btn";
    summarizerBtn.style.marginLeft = "10px"; // 个性化微调可以保留
    summarizerBtn.style.gap = "5px"; // 个性化微调可以保留
    summarizerBtn.textContent = "生成核心记忆摘要";
    header.insertBefore(summarizerBtn, titleEl.nextSibling);
    summarizerBtn.addEventListener("click", () =>
      this.showSummarizerModal(),
    );

    const refineBtn = document.createElement("button");
    refineBtn.id = "btn-show-refine";
    refineBtn.className = "interaction-btn";
    refineBtn.textContent = "二次精炼";
    header.insertBefore(refineBtn, summarizerBtn.nextSibling);
    refineBtn.addEventListener("click", () =>
      this.showRefineModal(),
    );

    // 🌟 新增：深度修复按钮
    const repairBtn = document.createElement("button");
    repairBtn.id = "btn-repair-journey";
    repairBtn.className = "interaction-btn";
    repairBtn.style.marginLeft = "auto"; // 把它推到最右边，和其他功能键稍微隔开
    repairBtn.innerHTML = "深度修复经历"; // 默认样式
    repairBtn.title = "当发现经历漏记或错乱时，点击此按钮从快照中重新提取并覆盖重写世界书。";
    header.insertBefore(repairBtn, refineBtn.nextSibling);
    repairBtn.addEventListener("click", async () => {
      // 加个二次确认，防止误触导致玩家自己手改的经历被覆盖
      this.showConfirmModal(
        "确定要深度修复本周目经历吗？\n警告：这将从历史快照中重新提取经历并覆盖当前世界书，您手动修改过的经历将被重置。",
        async () => {
          await this.forceSyncJourneyLorebook();
          await this.showJourney(); // 修复完成后自动刷新当前面板
        }
      );
    });
  }

  if (!consolePlaceholder || !contentPlaceholder) return;

  // 渲染坍缩控制台 UI
  if (!this.collapseSettings) await this.loadCollapseSettings();
  const s = this.collapseSettings;

  consolePlaceholder.innerHTML = /* HTML */ ` <div
    class="collapse-console-container"
  >
    <div class="collapse-console-title">🪐 坍缩控制台</div>

    <div class="collapse-console-body">
      <div class="collapse-stat-row">
        <span
          >📊 当前时间线总长度：<strong
            id="collapse-current-len"
            style="color: var(--color-danger); font-size: var(--text-md);"
            >${this.chatHistoryCache.length}</strong
          >
          回合</span
        >
        <div
          style="display: flex; align-items: center; gap: 6px;"
        >
          <span>✂️ 坍缩后保留最新：</span>
          <input
            type="number"
            id="collapse-keep-count"
            value="${s.keepCount}"
            min="10"
            class="modal-input center-input"
          />
          <span>回合</span>
        </div>
      </div>

      <div class="collapse-radio-group">
        <label class="collapse-radio-label">
          <input
            type="radio"
            name="collapse-mode"
            value="gentle"
            style="margin-top: 3px;"
            ${s.mode === "gentle" ? "checked" : ""}
          />
          <div>
            <strong style="color:var(--text-main);"
              >温和坍缩（默认/推荐）</strong
            ><br />
            <span class="collapse-radio-desc"
              >仅销毁旧快照的底层冗余数据，其历史文本将无缝挂载至新起点,世界书记忆保持绝对完整。</span
            >
          </div>
        </label>
        <label
          class="collapse-radio-label"
          style="margin-top: 4px;"
        >
          <input
            type="radio"
            name="collapse-mode"
            value="hard"
            style="margin-top: 3px;"
            ${s.mode === "hard" ? "checked" : ""}
          />
          <div>
            <strong style="color:var(--color-danger);"
              >彻底抹除（危险/大存档专属）</strong
            ><br />
            <span class="collapse-radio-desc"
              >连同历史记忆一并粉碎，并同步截断世界书。<span
                style="color:var(--color-danger);"
                >⚠️
                警告：将产生序号断层，切勿再次重排！</span
              ></span
            >
          </div>
        </label>
      </div>

      <div style="margin-top: 12px; padding: 10px; background: rgba(var(--rgb-danger), 0.15); border-left: 3px solid var(--color-danger); border-radius: 4px;">
        <label style="cursor: pointer; display: flex; align-items: flex-start; gap: 8px;">
          <input type="checkbox" id="collapse-skip-backup" style="margin-top: 2px;" ${s.skipBackup ? "checked" : ""} />
          <div style="flex: 1; min-width: 0;">
            <strong style="color: var(--color-danger); font-size: var(--text-sm);">⚠️ 危险：跳过全量备份 (大存档救星)</strong><br>
            <span style="font-size: var(--text-xs); color: var(--text-muted); line-height: 1.4; display: block; margin-top: 4px;">
              当存档大到一导出就<strong>网页卡死/崩溃</strong>时勾选。<br>此状态下手动/自动托管将<strong>直接执行物理坍缩切割</strong>，不再生成任何 JSON 备份。操作不可逆！
            </span>
          </div>
        </label>
      </div>

      <div class="collapse-action-row" style="flex-wrap: wrap; gap: 10px;">
        <label
          style="cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: var(--text-sm);"
        >
          <input
            type="checkbox"
            id="collapse-auto-enable"
            ${s.autoEnable ? "checked" : ""}
          />
          <span
            >开启自动托管 (达到
            <input
              type="number"
              id="collapse-auto-threshold"
              value="${s.autoThreshold}"
              min="20"
              class="modal-input center-input"
              style="width: 45px;"
            />
            回合时静默执行)</span
          >
        </label>
        <button
          id="btn-execute-collapse"
          class="interaction-btn ${s.skipBackup ? 'danger-btn' : 'primary-btn'}"
        >
          ${s.skipBackup ? "⬇️ 直接执行物理坍缩 (无备份)" : "⬇️ 导出全量备份并执行"}
        </button>
      </div>
    </div>
  </div>`;

  // 绑定设置变更（实时保存）
  const bindSave = (id) =>
    document
      .getElementById(id)
      ?.addEventListener("change", () =>
        this.saveCollapseSettings(),
      );
  bindSave("collapse-keep-count");
  bindSave("collapse-auto-threshold");
  bindSave("collapse-auto-enable");

  // ✨ 绑定跳过备份开关：实时修改底部按钮的文案与颜色
  document.getElementById("collapse-skip-backup")?.addEventListener("change", (e) => {
    this.saveCollapseSettings();
    const btn = document.getElementById("btn-execute-collapse");
    if (btn) {
      if (e.target.checked) {
        btn.innerHTML = "⬇️ 直接执行物理坍缩 (无备份)";
        btn.classList.remove("primary-btn");
        btn.classList.add("danger-btn");
      } else {
        btn.innerHTML = "⬇️ 导出全量备份并执行";
        btn.classList.remove("danger-btn");
        btn.classList.add("primary-btn");
      }
    }
  });

  document
    .querySelectorAll('input[name="collapse-mode"]')
    .forEach((radio) =>
      radio.addEventListener("change", () =>
        this.saveCollapseSettings(),
      ),
    );
  document
    .getElementById("btn-execute-collapse")
    ?.addEventListener("click", () =>
      this.executeTimelineCollapse(false),
    );

  // 渲染时间线内容
  try {
    const index = this.unifiedIndex;
    const journeyKey = index > 1 ? `本周目经历(${index})` : "本周目经历";
    
    // 🚀 核心修改：拥抱 WorldbookManager，享受内存缓存红利！不用再裸调全库了。
    const entries = await WorldbookManager.fetchEntries(journeyKey, { exactMatch: true });
    const journeyEntry = entries[0]; // fetchEntries 返回的是数组

    contentPlaceholder.innerHTML = this.renderJourneyFromContent(journeyEntry);
    this.bindJourneyListeners();

    // 🌟 新增：智能检测漏缺逻辑
    const repairBtn = document.getElementById("btn-repair-journey");
    if (repairBtn && journeyEntry && journeyEntry.content) {
      const events = this.parseJourneyEntry(journeyEntry.content);
      const historyLen = this.chatHistoryCache.length;
      
      // 这里的逻辑可以自定义：比如经历条数比快照数少了超过 3 条，并且快照总数大于 5
      if (historyLen > 5 && events.length < historyLen - 3) {
        repairBtn.innerHTML = "⚠️ 建议修复经历";
        repairBtn.style.backgroundColor = "var(--color-danger, #d9534f)";
        repairBtn.style.color = "white";
        repairBtn.style.animation = "pulse 2s infinite"; // 可选：加个呼吸灯效果吸引注意
      }
    }
  } catch (error) {
    console.error('读取"本周目经历"时出错:', error);
    contentPlaceholder.innerHTML = /* HTML */ `<p class="modal-placeholder">读取记忆时出现错误：${error.message}</p>`;
  }
},
// 本周目经历浏览 (重构版：享受洗白字典红利，彻底告别兼容代码)
renderJourneyFromContent(entry) {
  if (!entry || !entry.content) return '<p style="text-align:center; color:var(--text-muted); font-size: var(--text-sm);">本次调查尚未留下任何记录。</p>';
  
  // 这里的 parseJourneyEntry 已经被我们替换为 ChronicleCore 的解析器，键名已经被完美洗白！
  const events = this.parseJourneyEntry(entry.content);
  if (events.length === 0) return '<p style="text-align:center; color:var(--text-muted); font-size: var(--text-sm);">记录格式有误，无法解析事件。</p>';
  
  // 倒序排列
  events.sort((a, b) => (parseInt(b.序号, 10) || 0) - (parseInt(a.序号, 10) || 0));
  
  let html = '<div class="timeline-container"><div class="timeline-line"></div>';
  
  events.forEach((eventData, index) => {
    const eventId = `event-${entry.uid}-${index}`;

    // 🔴 核心极简：直接取标准键！无需再写 || 兼容！
    const fullTime = `${eventData["日期"] || "未知日期"} ${eventData["时间"] || ""}`.trim();
    const title = eventData["大纲"] || "无标题";
    const location = eventData["地点"] || "未知地点";
    const description = eventData["详细描述"] || "";
    const characters = eventData["在场人物"] || "";
    const profile = eventData["核心侧写"] || "";
    const anchors = eventData["核心锚点"] || "";
    const autoSystem = eventData["自动化系统"] || "";

    const tagsHtml = (eventData["事件标签"] || "")
      .split("|")
      .map(tag => tag.trim())
      .filter(tag => tag)
      .map(tag => `<span class="tag-item">${tag}</span>`)
      .join("");

    const basicInfo = `
    <div class="timeline-header">
      <div style="display:flex; align-items:center;">
        <div class="timeline-date">${fullTime}</div>
        <input type="checkbox" class="journey-select-checkbox" data-sequence-id="${eventData["序号"]}" title="勾选此条目用于修剪或总结">
      </div>
      <div class="timeline-tags">${tagsHtml}</div>
    </div>
    <div class="timeline-title">${title}</div>
    <div class="timeline-location">地点：${location}</div>
    `;

    const detailedInfo = `
    <div class="timeline-detailed-info" id="detailed-${eventId}" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(var(--rgb-secondary), 0.3);">
      ${description ? `<div class="detail-section"><strong>详细描述：</strong>${description}</div>` : ""}
      ${characters ? `<div class="detail-section"><strong>在场人物：</strong>${characters}</div>` : ""}
      ${profile ? `<div class="detail-section"><strong>核心侧写：</strong><i style="color: var(--text-muted);">${profile}</i></div>` : ""}
      ${anchors ? `<div class="detail-section"><strong>核心锚点：</strong><span style="color: var(--color-primary);">${anchors}</span></div>` : ""}
      ${autoSystem ? `<div class="detail-section"><strong>自动化系统：</strong><pre style="white-space: pre-wrap; font-size: var(--text-xs); color: var(--text-muted);">${autoSystem}</pre></div>` : ""}
    </div>
    `;
    html += `<div class="timeline-event" data-event-id="${eventId}" style="cursor: pointer;"><div class="timeline-content">${basicInfo}${detailedInfo}</div></div>`;
  });
  html += "</div>";
  return html;
},
//绑定事件
bindJourneyListeners() {
  // 1. 尝试寻找容器并绑定点击事件
  document
    .querySelector(".timeline-container")
    ?.addEventListener("click", (e) => {
      // 2. 找到最近的事件节点，并直接在其内部搜寻详情面板
      const detailedInfo = e.target
        .closest(".timeline-event")
        ?.querySelector(".timeline-detailed-info");

      // 3. 如果找到了面板，直接切换显示状态
      if (detailedInfo) {
        detailedInfo.style.display =
          detailedInfo.style.display === "block"
            ? "none"
            : "block";
      }
    });
},

// -------- 【重构版修剪台】时间线坍缩系统 ---------

