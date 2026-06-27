// 文件: SnapshotCorrection.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L29712-30872: // ============================================ ---

// ============================================
// ===========快照序号修正工具================
// ============================================
// 打开快照序号修正工具
async openSequenceFixer() {
  await this.loadUnifiedIndex();
  await this.loadHistoryFromStorage();

  // 只在第一次打开时创建备份（如果备份不存在）
  if (!this.sequenceFixerBackup) {
    this.sequenceFixerBackup = JSON.parse(
      JSON.stringify(this.chatHistoryCache),
    );
    console.log(
      "[序号修正] 已创建备份，快照数量:",
      this.sequenceFixerBackup.length,
    );
  } else {
    console.log(
      "[序号修正] 使用现有备份，快照数量:",
      this.sequenceFixerBackup.length,
    );
  }

  this.openModal("sequence-fixer-modal", true);

  const titleEl = document.getElementById("sequence-fixer-title");
  const body = document.getElementById("sequence-fixer-body");
  const footer = document.getElementById("sequence-fixer-footer");

  if (titleEl) titleEl.textContent = "快照序号修正工具";

  body.innerHTML =
    '<div style="text-align: center; padding: 40px; color: var(--text-muted);">正在分析快照数据...</div>';

  // 分析问题
  const analysis = this.analyzeSnapshotSequences();

  // 渲染界面
  body.innerHTML = this.renderSequenceFixerUI(analysis);
  footer.innerHTML = /* HTML */ `
    <button id="btn-fixer-restore" class="interaction-btn">
      恢复原始
    </button>
    <button
      id="btn-fixer-close"
      class="interaction-btn primary-btn"
    >
      关闭
    </button>
  `;

  // 绑定事件
  this.bindSequenceFixerEvents(analysis);
},
// 渲染UI
renderSequenceFixerUI(analysis) {
  const { snapshots, allEvents, totalProblems } = analysis;

  const criticalCount = allEvents.filter((e) =>
    e.problems.some((p) => p.severity === "critical"),
  ).length;
  const highCount = allEvents.filter((e) =>
    e.problems.some((p) => p.severity === "high"),
  ).length;

  return /* HTML */ `
    <div class="sequence-fixer-container">
      <div class="fixer-stats">
        <div class="stat-card">
          <div class="stat-value">${snapshots.length}</div>
          <div class="stat-label">快照总数</div>
        </div>
        <div
          class="stat-card ${totalProblems > 0
            ? "warning"
            : "success"}"
        >
          <div class="stat-value">${totalProblems}</div>
          <div class="stat-label">问题事件</div>
        </div>
        <div
          class="stat-card ${criticalCount > 0
            ? "critical"
            : ""}"
        >
          <div class="stat-value">${criticalCount}</div>
          <div class="stat-label">严重问题</div>
        </div>
        <div class="stat-card ${highCount > 0 ? "high" : ""}">
          <div class="stat-value">${highCount}</div>
          <div class="stat-label">高优先级</div>
        </div>
      </div>

      <div class="fixer-batch-actions">
        <button
          id="btn-full-renumber"
          class="fixer-btn primary"
        >
          🔄 全部重排
        </button>
        <button id="btn-smart-fix" class="fixer-btn success">
          ✨ 智能修复
        </button>
        <button id="btn-fix-critical" class="fixer-btn warning">
          ⚠️ 只修复严重问题
        </button>
        <div style="flex: 1"></div>
        <label
          style="display: flex; align-items: center; gap: 8px;"
        >
          起始序号：
          <input
            type="number"
            id="renumber-start"
            value="1"
            min="1"
            style="width: 80px; padding: 4px; background: var(--overlay-light); border: 1px solid rgba(var(--rgb-secondary), 0.5); color: var(--text-muted); border-radius: 4px;"
          />
        </label>
      </div>

      <div class="fixer-snapshots">
        ${snapshots
          .map((snap) => this.renderSnapshotCard(snap))
          .join("")}
      </div>
    </div>
  `;
},

renderSnapshotCard(snapData) {
  if (snapData.isEmpty) {
    return /* HTML */ `
      <div class="snapshot-card empty">
        <div class="snapshot-header">
          <span class="snapshot-title"
            >快照 ${snapData.snapIdx + 1}</span
          >
          <span class="snapshot-badge">空</span>
        </div>
      </div>
    `;
  }

  const seqRange =
    snapData.events.length > 0
      ? `${snapData.events[0].序号}-${snapData.events[snapData.events.length - 1].序号}`
      : "无";

  const problemCount = snapData.events.filter(
    (e) => e.problems.length > 0,
  ).length;

  return /* HTML */ `
    <div
      class="snapshot-card ${snapData.hasProblems
        ? "has-problems"
        : ""}"
    >
      <div class="snapshot-header">
        <span class="snapshot-title"
          >快照 ${snapData.snapIdx + 1}</span
        >
        <span class="snapshot-info"
          >序号 ${seqRange}
          (${snapData.events.length}条)</span
        >
        ${problemCount > 0
          ? `<span class="problem-badge">${problemCount}个问题</span>`
          : ""}
        <button
          class="btn-toggle-events"
          data-snap-idx="${snapData.snapIdx}"
        >
          ${snapData.hasProblems ? "展开" : "查看"}
        </button>
      </div>
      <div
        class="snapshot-events"
        id="snap-events-${snapData.snapIdx}"
        style="display: none;"
      >
        ${snapData.events
          .map((e) => this.renderEventRow(e))
          .join("")}
      </div>
    </div>
  `;
},

renderEventRow(eventData) {
  const hasProblem = eventData.problems.length > 0;
  const problem = hasProblem ? eventData.problems[0] : null;

  return /* HTML */ `
    <div
      class="event-row ${hasProblem
        ? "has-problem " + problem.severity
        : ""}"
      data-global-idx="${eventData.globalIdx}"
    >
      <div class="event-seq-col">
        ${hasProblem ? problem.icon : "✓"}
        <span class="event-seq">${eventData.序号}</span>
      </div>
      <div class="event-info-col">
        <div class="event-title">${eventData.标题}</div>
        <div class="event-date">${eventData.日期}</div>
        ${hasProblem
          ? `<div class="event-problem">${problem.message}</div>`
          : ""}
      </div>
      <div class="event-actions-col">
        ${hasProblem
          ? `
<input type="number"
class="seq-manual-input"
value="${eventData.parsedSeq}"
min="1"
data-global-idx="${eventData.globalIdx}"
placeholder="手动">
<button class="btn-adopt-suggested"
data-global-idx="${eventData.globalIdx}"
data-suggested="${problem.suggested}">
采纳 ${problem.suggested}
</button>
<button class="btn-apply-manual"
data-global-idx="${eventData.globalIdx}">
应用
</button>
`
          : `
<input type="number"
class="seq-manual-input"
value="${eventData.parsedSeq}"
min="1"
data-global-idx="${eventData.globalIdx}">
<button class="btn-apply-manual"
data-global-idx="${eventData.globalIdx}">
修改
</button>
`}
      </div>
    </div>
  `;
},
// 绑定事件
bindSequenceFixerEvents(analysis) {
  const container = document.querySelector(
    ".sequence-fixer-container",
  );
  if (!container) {
    console.error("[序号修正] 找不到容器元素");
    return;
  }

  console.log("[序号修正] 开始绑定事件");

  // 使用事件委托处理所有按钮点击
  container.addEventListener("click", async (e) => {
    const target = e.target;

    // 展开/收起快照
    if (target.classList.contains("btn-toggle-events")) {
      console.log("[序号修正] 点击展开按钮");
      const snapIdx = parseInt(target.dataset.snapIdx);
      const eventsDiv = document.getElementById(
        `snap-events-${snapIdx}`,
      );
      if (eventsDiv.style.display === "none") {
        eventsDiv.style.display = "block";
        target.textContent = "收起";
      } else {
        eventsDiv.style.display = "none";
        target.textContent = analysis.snapshots[snapIdx]
          .hasProblems
          ? "展开"
          : "查看";
      }
      return;
    }

    // 采纳建议序号
    if (target.classList.contains("btn-adopt-suggested")) {
      console.log("[序号修正] 点击采纳建议按钮");
      try {
        const globalIdx = parseInt(target.dataset.globalIdx);
        const suggested = parseInt(target.dataset.suggested);
        console.log(
          `[序号修正] globalIdx=${globalIdx}, suggested=${suggested}`,
        );
        await this.updateEventSequence(
          analysis,
          globalIdx,
          suggested,
        );
      } catch (error) {
        console.error("[序号修正] 采纳建议时出错:", error);
        this.showTemporaryMessage(
          `操作失败: ${error.message}`,
          3000,
        );
      }
      return;
    }

    // 应用手动输入的序号
    if (target.classList.contains("btn-apply-manual")) {
      console.log("[序号修正] 点击应用按钮");
      try {
        const globalIdx = parseInt(target.dataset.globalIdx);
        const input = document.querySelector(
          `.seq-manual-input[data-global-idx="${globalIdx}"]`,
        );
        const newSeq = parseInt(input.value);
        console.log(
          `[序号修正] globalIdx=${globalIdx}, newSeq=${newSeq}`,
        );
        if (!isNaN(newSeq) && newSeq > 0) {
          await this.updateEventSequence(
            analysis,
            globalIdx,
            newSeq,
          );
        } else {
          this.showTemporaryMessage("请输入有效的序号", 2000);
        }
      } catch (error) {
        console.error("[序号修正] 应用序号时出错:", error);
        this.showTemporaryMessage(
          `操作失败: ${error.message}`,
          3000,
        );
      }
      return;
    }
  });

  // 全部重排
  document
    .getElementById("btn-full-renumber")
    ?.addEventListener("click", () => {
      console.log("[序号修正] 点击全部重排按钮");
      const startNum =
        parseInt(
          document.getElementById("renumber-start").value,
        ) || 1;
      this.showConfirmModal(
        `确定要从 ${startNum} 开始重新编号所有事件吗？此操作会忽略现有序号。`,
        async () => {
          try {
            await this.fullRenumber(analysis, startNum);
          } catch (error) {
            console.error(
              "[序号修正] 全部重排时出错:",
              error,
            );
            this.showTemporaryMessage(
              `操作失败: ${error.message}`,
              3000,
            );
          }
        },
        true,
      );
    });

  // 智能修复
  document
    .getElementById("btn-smart-fix")
    ?.addEventListener("click", () => {
      console.log("[序号修正] 点击智能修复按钮");
      this.showConfirmModal(
        "智能修复会保留合理的序号，只修复严重问题（倒序、重复、大跳跃）。确定继续吗？",
        async () => {
          try {
            await this.smartFix(analysis);
          } catch (error) {
            console.error(
              "[序号修正] 智能修复时出错:",
              error,
            );
            this.showTemporaryMessage(
              `操作失败: ${error.message}`,
              3000,
            );
          }
        },
        true,
      );
    });

  // 只修复严重问题
  document
    .getElementById("btn-fix-critical")
    ?.addEventListener("click", () => {
      this.showConfirmModal(
        "只修复严重和高优先级问题，保留其他序号。确定继续吗？",
        () => this.fixCriticalOnly(analysis),
        true,
      );
    });

  // 恢复原始
  document
    .getElementById("btn-fixer-restore")
    ?.addEventListener("click", () => {
      this.showConfirmModal(
        "确定要放弃所有修改，恢复到打开工具前的状态吗？",
        async () => {
          try {
            if (!this.sequenceFixerBackup) {
              this.showTemporaryMessage(
                "错误：找不到备份数据",
                3000,
              );
              return;
            }

            console.log("[序号修正] 开始恢复备份");

            // 恢复备份数据
            this.chatHistoryCache = JSON.parse(
              JSON.stringify(this.sequenceFixerBackup),
            );

            // 保存到存储
            await AppStorage.saveData(
              this._getHistoryKey(),
              this.chatHistoryCache,
            );

            console.log("[序号修正] 备份已恢复并保存");
            this.showTemporaryMessage(
              "✅ 已恢复到打开工具前的状态",
              3000,
            );

            // 重新打开工具显示恢复后的数据
            setTimeout(
              () => this.openSequenceFixer(),
              1000,
            );
          } catch (error) {
            console.error(
              "[序号修正] 恢复备份失败:",
              error,
            );
            this.showTemporaryMessage(
              `恢复失败: ${error.message}`,
              3000,
            );
          }
        },
        true,
      );
    });

  // 关闭
  document
    .getElementById("btn-fixer-close")
    ?.addEventListener("click", () => {
      this.closeAllModals();
      // 清理备份数据
      this.sequenceFixerBackup = null;
    });
},

//====快照序号修正工具的方法函数======
// 分析 (已外包给时空管理局质检部)
analyzeSnapshotSequences() {
  return ChronicleCore.analyzeSequences(
    this.chatHistoryCache, 
    (snap) => this._getSafeJourneyText(snap) // 传入提取文本的方法
  );
},
// 🔧 核心突变扳手：修改指定快照中特定事件的序号，并强制同步底层 Meta 与源码
_applySequenceFixToSnapshot(snapshot, eventIdx, newSeq) {
  const journeyContent = this._getSafeJourneyText(snapshot);
  if (!journeyContent) return false;

  // 1. 调用时空管理局，获取修改过序号的纯文本
  const newContent = ChronicleCore.fixEventSequenceInText(journeyContent, eventIdx, newSeq);
  if (newContent === journeyContent) return false; // 文本没变，说明没找到或出错了

  // 2. 替换 message 原文 
  // (复用你写在 saveInGameEditor 里的安全替换方法，告别脆弱的正则)
  snapshot.message = this._updateEditorTagContent(snapshot.message, "本周目经历", newContent);

  // 3. 重塑 Meta 结构 (极度关键！确保 meta.serial 完美对齐新序号)
  // 如果当前快照已经有完善的meta，继承它的其他标记(比如 periodic_backup)
  const fallbackSerial = snapshot.meta?.serial || newSeq; 
  snapshot.meta = ChronicleCore.buildStandardMeta(newContent, fallbackSerial, snapshot.meta || {});

  return true;
},
// 1. 更新单个事件的序号 (单点突破)
async updateEventSequence(analysis, globalIdx, newSeq) {
  const eventData = analysis.allEvents[globalIdx];
  if (!eventData) return this.showTemporaryMessage("错误：找不到事件数据", 2000);

  const snapshot = this.chatHistoryCache[eventData.snapIdx];
  if (!snapshot) return this.showTemporaryMessage("错误：找不到快照", 2000);

  // 🌟 一键呼叫扳手
  const success = this._applySequenceFixToSnapshot(snapshot, eventData.eventIdx, newSeq);

  if (success) {
    try {
      await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
      this.showTemporaryMessage(`✅ 已更新序号：${eventData.parsedSeq} → ${newSeq}`, 2000);
      setTimeout(() => this.openSequenceFixer(), 500);
    } catch (error) {
      console.error("[序号修正] 保存失败:", error);
    }
  } else {
    this.showTemporaryMessage("更新失败，未找到该事件或数据异常。", 2000);
  }
},

// 2. 全部重排 (推倒重来)
async fullRenumber(analysis, startNum = 1) {
  let seq = startNum;
  let changed = false;

  for (const eventData of analysis.allEvents) {
    const snapshot = this.chatHistoryCache[eventData.snapIdx];
    // 🌟 循环呼叫扳手
    if (this._applySequenceFixToSnapshot(snapshot, eventData.eventIdx, seq)) {
      changed = true;
    }
    seq++;
  }

  if (changed) {
    try {
      await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
      this.showTemporaryMessage(`✅ 全部重排完成！共处理 ${analysis.allEvents.length} 个事件`, 3000);
      setTimeout(() => this.openSequenceFixer(), 1000);
    } catch (error) {
      console.error("[序号修正] 保存失败:", error);
    }
  } else {
    this.showTemporaryMessage("未发生任何更改。", 2000);
  }
},

// 3. 智能修复 (微调纠偏)
async smartFix(analysis) {
  let expectedNext = 1;
  let fixedCount = 0;

  for (const eventData of analysis.allEvents) {
    const currentSeq = eventData.parsedSeq;
    let newSeq = expectedNext;
    
    // 判断逻辑保持你原有的精髓
    const shouldFix = isNaN(currentSeq) || currentSeq < expectedNext || currentSeq > expectedNext + 10;

    if (!shouldFix) newSeq = currentSeq;

    if (shouldFix) {
      const snapshot = this.chatHistoryCache[eventData.snapIdx];
      // 🌟 命中修复条件，呼叫扳手
      if (this._applySequenceFixToSnapshot(snapshot, eventData.eventIdx, newSeq)) {
        fixedCount++;
      }
    }
    expectedNext = newSeq + 1;
  }

  if (fixedCount > 0) {
    try {
      await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
      this.showTemporaryMessage(`✅ 智能修复完成！修复了 ${fixedCount} 个问题`, 3000);
      setTimeout(() => this.openSequenceFixer(), 1000);
    } catch (error) {
      console.error("[序号修正] 保存失败:", error);
    }
  } else {
    this.showTemporaryMessage("无需修复，当前序号状态完美！", 2000);
  }
},

// 4. 只修复严重问题 (急救模式)
async fixCriticalOnly(analysis) {
  let fixedCount = 0;

  for (const eventData of analysis.allEvents) {
    if (eventData.problems.length === 0) continue;

    const hasCritical = eventData.problems.some(
      (p) => p.severity === "critical" || p.severity === "high"
    );

    if (hasCritical) {
      const suggested = eventData.problems[0].suggested;
      const snapshot = this.chatHistoryCache[eventData.snapIdx];
      
      // 🌟 命中严重错误，呼叫扳手注入建议序号
      if (this._applySequenceFixToSnapshot(snapshot, eventData.eventIdx, suggested)) {
        fixedCount++;
      }
    }
  }

  if (fixedCount > 0) {
    try {
      await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
      this.showTemporaryMessage(`✅ 修复完成！处理了 ${fixedCount} 个严重问题`, 3000);
      setTimeout(() => this.openSequenceFixer(), 1000);
    } catch (error) {
      console.error("[序号修正] 保存失败:", error);
    }
  } else {
    this.showTemporaryMessage("未发现需要处理的严重序列问题。", 2000);
  }
},

//=========历史的投影=========
//解析历史的投影
parsePastLifeEntry(contentString) {
  if (!contentString || typeof contentString !== "string") return {};
  try {
    const data = {};
    const lines = contentString.trim().split("\n");
    lines.forEach((line) => {
      const parts = line.split("|");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("|").trim();
        data[key] = value;
      }
    });
    return data;
  } catch (e) {
    console.error("解析历史投影失败:", e);
    return {};
  }
},
//历史的投影显示
async showPastLives() {
  this.openModal("history-modal");
  await this.loadUnifiedIndex();
  const titleEl = document.getElementById("history-modal-title");
  if (titleEl) titleEl.textContent = "历史的投影";

  // 清除"本周目经历"可能添加的按钮
  const existingBtn = document.getElementById("btn-show-summarizer");
  if (existingBtn) existingBtn.remove();
  const existingRefineBtn =
    document.getElementById("btn-show-refine");
  if (existingRefineBtn) existingRefineBtn.remove();

  // 清空修剪控制台
  const consolePlaceholder = document.getElementById(
    "trim-console-placeholder",
  );
  if (consolePlaceholder) consolePlaceholder.innerHTML = "";

  const contentPlaceholder = document.getElementById(
    "timeline-content-container",
  );
  if (!contentPlaceholder) return;
  contentPlaceholder.innerHTML =
    '<p class="modal-placeholder" style="text-align:center; color:var(--text-muted); font-size: var(--text-sm);">正在窥视历史迷雾...</p>';
  try {
    const bookName = WorldbookManager.PRIMARY_BOOK;
    const index = this.unifiedIndex;
    const pastLivesKey =
      index > 1 ? `历史的投影(${index})` : "历史的投影";
    const allEntries =
      await TavernHelper.getLorebookEntries(bookName);
    const pastLivesEntry = allEntries.find(
      (entry) => entry.comment === pastLivesKey,
    );
    if (!pastLivesEntry)
      console.warn(
        `在世界书 \"${bookName}\" 中未找到 \"${pastLivesKey}\"。`,
      );
    contentPlaceholder.innerHTML =
      this.renderPastLives(pastLivesEntry);
  } catch (error) {
    console.error("读取“历史的投影”时出错:", error);
    contentPlaceholder.innerHTML = /* HTML */ `<p
      class="modal-placeholder"
      style="text-align:center; color:var(--text-muted); font-size: var(--text-sm);"
    >
      窥视历史时出现错误：${error.message}
    </p>`;
  }
},
renderPastLives(entry) {
  if (!entry || !entry.content)
    return '<p style="text-align:center; color:var(--text-muted); font-size: var(--text-sm);">历史的迷雾中空无一物。</p>';
  const parts = entry.content
    .trim()
    .split(/(第\d+周目\|)/g)
    .slice(1);
  if (parts.length === 0) {
    parts.push("未知周目|", entry.content.trim());
  }

  let html =
    '<div class="timeline-container"><div class="timeline-line"></div>';
  for (let i = 0; i < parts.length; i += 2) {
    if (i + 1 >= parts.length) continue;
    const fullContent = parts[i] + parts[i + 1];
    const data = this.parsePastLifeEntry(fullContent);

    const titleText =
      parts[i].replace("|", "").trim() || "未知周目";

    html += `
<div class="timeline-event">
<div class="timeline-content">
<div class="timeline-title">${titleText}</div>
<div class="past-life-details">
<div class="detail-item"><strong>事件脉络:</strong> ${data["事件脉络"] || "不详"}</div>
<div class="detail-item"><strong>周目概述:</strong> ${data["本周目概述"] || data["周目概述"] || "不详"}</div>
<div class="detail-item"><strong>周目成就:</strong> ${data["本周目成就"] || data["周目成就"] || "无"}</div>
<div class="detail-item"><strong>获得物品:</strong> ${data["本周目获得物品"] || data["获得物品"] || "无"}</div>
<div class="detail-item"><strong>人物关系:</strong> ${data["本周目人物关系网"] || data["人物关系网"] || "无"}</div>
<div class="detail-item"><strong>失控原因:</strong> ${data["失控原因"] || "不详"}</div>
<div class="detail-item"><strong>周目总结:</strong> ${data["本周目总结"] || data["周目总结"] || "无"}</div>
<div class="detail-item"><strong>周目评价:</strong> ${data["本周目评价"] || data["周目评价"] || "无"}</div>
</div>
</div>
</div>`;
  }
  html += "</div>";
  return html;
},

//===========一系列工具函数==============
// 🌟 新增辅助函数：收口所有的经历文本提取逻辑（Single Source of Truth）
_getSafeJourneyText(snapshot) {
  if (!snapshot) return "";
  // 优先读取洗澡升级后的 meta 数据，极速且稳定
  if (snapshot.meta && snapshot.meta.journey_full_text !== undefined) {
    return snapshot.meta.journey_full_text;
  }
  // 兜底：如果有些极度古老的漏网之鱼没洗澡，再用正则去原文本里捞
  return this._extractLastTagContent("本周目经历", snapshot.message || "") || "";
},
// 🚀 终极洗澡机：静默迁移旧快照，全面确立绝对序号 (Serial)
async _migrateSnapshotMeta() {
  let needsSave = false;
  // 定义 Meta 的“标准必须字段”名录，保证颗粒度检测
  const REQUIRED_META_KEYS = ['serial', 'title', 'date', 'people', 'journey_full_text', 'world_info'];

  // 提前准备好玩家名称，送进装配车间
  const playerName = this.currentMvuState?.stat_data?.名称 || "";

  for (let i = 0; i < this.chatHistoryCache.length; i++) {
    let snap = this.chatHistoryCache[i];

    // 判断是否需要洗澡：没有 meta，或者还在用旧的，或者缺失必需字段
    const isMissingMeta = !snap.meta;
    const hasLegacyKeys = snap.meta && snap.meta.journey_title !== undefined;
    const isMissingRequiredKeys = snap.meta && REQUIRED_META_KEYS.some(key => snap.meta[key] === undefined);

    if (isMissingMeta || hasLegacyKeys || isMissingRequiredKeys) {
      
      const rawText = snap.meta?.journey_full_text || this._extractLastTagContent("本周目经历", snap.message || "") || "";

      // 传入 playerName 作为第四个参数
      snap.meta = ChronicleCore.buildStandardMeta(
        rawText, 
        snap.meta?.serial || (i + 1), 
        snap.meta || {},
        playerName 
      );

      needsSave = true;
    }

    // 🌟 强制物理清洗与 NPC 数据分离
    if (snap.data) {
      const didUpgradeNpc = this._upgradeStateForNpcSplit(snap.data);
      if (didUpgradeNpc) {
        needsSave = true;
      }

      if (snap.data.equipped_items !== undefined) {
        delete snap.data.equipped_items;
        needsSave = true;
      }
    }
  }

  if (needsSave) {
    await AppStorage.saveData(this._getHistoryKey(), this.chatHistoryCache);
    console.log("[历史系统] 🚀 数据架构升级并同步至磁盘。");
  }
},
// 公共函数：序列化本周目经历 (对象 -> 文本)
stringifyJourneyEvent(event) {
  // 按照预设的字典顺序遍历。
  // 💡 妙处：无论传入的 event 是新版(含"大纲")还是旧版(含"标题")，都会按标准顺序输出，且不存在的字段会自动被过滤掉！
  return this.JOURNEY_FIELD_ORDER
    .map((key) => {
      if (event[key] !== undefined && event[key] !== null && event[key] !== "") {
        return `${key}|${event[key]}`;
      }
      return null;
    })
    .filter(Boolean)
    .join("\n");
},
// 将世界书严格截断至指定历史节点的绝对序号 (无情的手术刀)
async _syncLorebookToHistoryIndex(targetIndex) {
  if (targetIndex < 0 || targetIndex >= this.chatHistoryCache.length) return;
  
  // 🚀 核心：直接读取目标快照的绝对序号！如果它没有，往前找一个有的
  let targetSerial = -1;
  for (let i = targetIndex; i >= 0; i--) {
    if (this.chatHistoryCache[i]?.meta?.serial) {
      targetSerial = this.chatHistoryCache[i].meta.serial;
      break;
    }
  }

  if (targetSerial === -1) return;

  const journeyKey = this.unifiedIndex > 1 ? `本周目经历(${this.unifiedIndex})` : "本周目经历";
  const entries = await WorldbookManager.fetchEntries(journeyKey, { exactMatch: true });
  const journeyEntry = entries[0];

  if (journeyEntry && journeyEntry.content) {
    const allEvents = ChronicleCore.parseTextToEvents(journeyEntry.content);
    
    // 只保留序号 <= targetSerial 的事件
    const truncatedEvents = allEvents.filter((event) => parseInt(event["序号"], 10) <= targetSerial);

    if (truncatedEvents.length < allEvents.length) {
      const newContent = truncatedEvents.map(ev => ChronicleCore.stringifyEventToText(ev)).join("\n\n");
      await WorldbookManager.saveEntries([{ 
        ...journeyEntry, 
        comment: journeyKey, 
        content: newContent 
      }], { backupToLibrary: true });
      
      console.log(`[世界书手术刀] ✂️ 经历已回滚并锁定至绝对序号 №${targetSerial}。`);
    }
  }
},

// 辅助函数：复用performLoad的逻辑，合并所有快照的经历（字符串级拼接，更稳妥）
async _mergeAllSnapshotsJourney() {
  let mergedJourney = "";
  for (const snap of this.chatHistoryCache) {
    if (!snap) continue;
    // 🔴 性能飞跃：优先读取现成的文本，读不到才去跑正则
    const snapJourney = this._getSafeJourneyText(snap);
    if (snapJourney.trim()) {
      mergedJourney += snapJourney + "\n\n";
    }
  }
  const trimmedJourney = mergedJourney.trim();
  const events = this.parseJourneyEntry(trimmedJourney);
  const uniqueEvents = Array.from(
    new Map(events.map((ev) => [ev.序号, ev])).values(),
  );
  uniqueEvents.sort(
    (a, b) => parseInt(a.序号, 10) - parseInt(b.序号, 10),
  );
  return uniqueEvents
    .map((ev) => this.stringifyJourneyEvent(ev))
    .join("\n\n");
},
// --- 新增：回滚世界书经历的辅助函数 ---
async _rollbackJourneyLog(entryCountToRemove = 1) {
  if (entryCountToRemove <= 0) return;
  console.log(`[源堡-回滚] 准备从“本周目经历”中移除最后 ${entryCountToRemove} 条记录...`);
  const journeyKey = this.unifiedIndex > 1 ? `本周目经历(${this.unifiedIndex})` : "本周目经历";

  try {
    // 🚀 核心修改：改用管家读取
    const entries = await WorldbookManager.fetchEntries(journeyKey, { exactMatch: true });
    const journeyEntry = entries[0];

    if (!journeyEntry || !journeyEntry.content) {
      console.warn("[源堡-回滚] 未找到或“本周目经历”为空，无需回滚。");
      return;
    }

    // 全面接入 ChronicleCore
    const events = ChronicleCore.parseTextToEvents(journeyEntry.content);
    let newContent = "";
    
    if (events.length > entryCountToRemove) {
      const eventsToKeep = events.slice(0, events.length - entryCountToRemove);
      newContent = eventsToKeep.map((ev) => ChronicleCore.stringifyEventToText(ev)).join("\n\n");
    }

    // 🚀 核心修改：通过管家统一写入，顺便丢进备用库
    await WorldbookManager.saveEntries([{ 
      ...journeyEntry, 
      comment: journeyKey, 
      content: newContent 
    }], { backupToLibrary: true });
    
    console.log(newContent ? `[源堡-回滚] 已成功移除 ${entryCountToRemove} 条记录。` : "[源堡-回滚] “本周目经历”条目已清空。");
  } catch (error) {
    console.error("[源堡-回滚] 回滚“本周目经历”时出错:", error);
    this.showTemporaryMessage("回滚世界书记录失败！");
  }
},
reconstructJourneyEntry(events) {
  if (!Array.isArray(events)) return "";
  return events
    .map((event) => this.stringifyJourneyEvent(event))
    .join("\n\n");
},
//==========一系列写入函数==============
//历史的投影写入世界书（辅助函数）
async writePastLivesToLorebook(silent = false) {
  const content = this._resolveExtractedContent(!silent).pastLives;
  await this.writeToLorebook("历史的投影", content, silent);
},
//本周目经历写入世界书（辅助函数）
async writeJourneyToLorebook(silent = false) {
  const content = this._resolveExtractedContent(!silent).journey;
  await this.writeToLorebook("本周目经历", content, silent);
},
// 当前线索写入世界书（辅助函数）
async writeCluesToLorebook(silent = false) {
  const content = this._resolveExtractedContent(!silent).clues;
  await this.writeToLorebook("当前线索", content, silent);
},
//小说模式写入世界书（辅助函数）
async writeNovelModeToLorebook(silent = false) {
  const content = this._resolveExtractedContent(!silent).novelText;
  await this.writeToLorebook("小说模式", content, silent);
},
//写入提取角色卡（辅助函数）
async writeCharacterCardToLorebook() {
  const content = this._resolveExtractedContent(true).characterCard;
  if (!content) {
    this.showTemporaryMessage("没有可写入的角色内容。");
    return;
  }
  const button = document.getElementById("btn-write-character-card");
  if (button) button.textContent = "写入中...";
  try {
    const lines = content.trim().split("\n");
    const characterData = {};
    lines.forEach((line) => {
      const parts = line.split("|");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("|").trim();
        characterData[key] = value;
      }
    });
    
    const characterName = characterData["姓名"];
    if (!characterName) throw new Error("无法从提取内容中找到角色“姓名”。");

    // 🌟 升级点 1：使用管家查询角色是否存在（精确匹配）
    const existingEntries = await WorldbookManager.fetchEntries(characterName, { exactMatch: true });
    
    if (existingEntries.length > 0) {
      this.showTemporaryMessage(`角色“${characterName}”已存在，请手动修改。`);
      if (button) button.textContent = "写入世界书";
      return;
    }

    // 🌟 升级点 2：使用管家统一写入（省去判断创建还是更新的烦恼）
    await WorldbookManager.saveEntries([
      {
        comment: characterName,
        keys: [characterName],
        content: content.trim(),
        enabled: true,
      }
    ]);

    this.showTemporaryMessage(`已成功创建角色“${characterName}”。`);
    if (button) button.textContent = "写入成功";
    setTimeout(() => {
      if (button) button.textContent = "写入世界书";
    }, 2000);
  } catch (error) {
    console.error("写入角色卡到世界书时出错:", error);
    this.showTemporaryMessage(`写入失败: ${error.message}`);
    if (button) button.textContent = "写入失败";
  }
},

//==========一堆自动轮询函数============
/**
 * 初始化用户活动监听器
 * 提取自小说模式，实现逻辑共享，避免重复添加监听器
 */
initUserActivityListeners() {
  if (this.userActivityListenersAdded) return;

  this.lastUserActivity = Date.now();

  // 使用节流优化：1秒内最多更新一次活跃时间，性能友好
  let lastUpdate = 0;
  const throttledUpdate = () => {
    const now = Date.now();
    if (now - lastUpdate > 1000) {
      this.lastUserActivity = now;
      lastUpdate = now;
    }
  };

  // 监听常见的交互行为
  ["click", "keydown", "scroll", "touchstart"].forEach((event) => {
    document.addEventListener(event, throttledUpdate, {
      passive: true, // 优化滚动性能
    });
  });

  this.userActivityListenersAdded = true;
  console.log("[源堡] 全局用户活动监听器已就绪。");
},
//轮询查询是否需要读取或写入世界书
startAutoTogglePolling() {
  this.stopAutoTogglePolling(false);
  console.log("[源堡] 启动世界书自动开关轮询...");
  this.updateAutoToggledEntries();
  // 【核心修复】将轮询间隔从5秒延长到30秒，大幅降低内存压力
  this.autoToggleIntervalId = setInterval(
    () => this.updateAutoToggledEntries(),
    30000,
  );
},
stopAutoTogglePolling(disableEntries = true) {
  if (this.autoToggleIntervalId) {
    console.log("[源堡] 停止世界书自动开关轮询。");
    clearInterval(this.autoToggleIntervalId);
    this.autoToggleIntervalId = null;
  }
  if (disableEntries) this.updateAutoToggledEntries(true);
},

/**
 * 核心逻辑：静默写入角色卡
 * 区别于手动点击版本：不修改按钮文字，角色已存在时不报错
 */
async writeCharacterCardToLorebookSilent() {
  try {
    const content = this.lastExtractedCharacterCard;
    if (!content) return;

    // 解析姓名
    const lines = content.trim().split("\n");
    const characterData = {};
    lines.forEach(line => {
      const parts = line.split("|");
      if (parts.length >= 2) characterData[parts[0].trim()] = parts.slice(1).join("|").trim();
    });

    const characterName = characterData["姓名"];
    if (!characterName) return;

    // 检查是否存在（自动轮询通常不覆盖已有条目，除非你希望自动更新）
    const existing = await WorldbookManager.fetchEntries(characterName, { exactMatch: true });
    
    if (existing.length === 0) {
      // 仅在不存在时创建，并带上你要求的配置
      await WorldbookManager.saveEntries([{
        comment: characterName,
        keys: [characterName],
        content: content.trim(),
        enabled: true, // enable: true
        strategy: { type: 'selective' }, // constant: false (即绿灯/可选项)
        positionType: 'before_character_definition', // position：定义到角色之前
        order: 260 // order: 260
      }]);
      console.log(`[源堡] 自动轮询：已自动创建新角色“${characterName}”`);
    }
  } catch (e) {
    console.warn("[源堡] 角色自动写入失败:", e);
  }
},





//=======持久化保存===========
//自动将本周目经历和历史的投影写入世界书
async saveAutoToggleState() {
  await AppStorage.saveData(
    "auto_toggle_enabled",
    this.isAutoToggleLorebookEnabled,
  );
},
async loadAutoToggleState() {
  const savedState = await AppStorage.loadData(
    "auto_toggle_enabled",
    false,
  );
  this.isAutoToggleLorebookEnabled = savedState;
  const checkbox = document.getElementById(
    "auto-toggle-lorebook-checkbox",
  );
  if (checkbox) checkbox.checked = this.isAutoToggleLorebookEnabled;
  if (this.isAutoToggleLorebookEnabled) this.startAutoTogglePolling();
},
async saveAutoWriteState(state) {
  await AppStorage.saveData("auto_write_enabled", state);
},
async loadAutoWriteState() {
  const savedState = await AppStorage.loadData(
    "auto_write_enabled",
    true,
  );
  this.isAutoWriteEnabled = savedState;
  const checkbox = document.getElementById("auto-write-checkbox");
  if (checkbox) checkbox.checked = this.isAutoWriteEnabled;
},
// 保存状态
async saveCharacterAutoWriteState(state) {
  await AppStorage.saveData("character_auto_write_enabled", state);
  this.isCharacterAutoWriteEnabled = state;
},
// 加载状态
async loadCharacterAutoWriteState() {
  const savedState = await AppStorage.loadData("character_auto_write_enabled", true);
  this.isCharacterAutoWriteEnabled = savedState;

  // 同步 UI 勾选框
  const checkbox = document.getElementById("character-auto-write-checkbox");
  if (checkbox) checkbox.checked = this.isCharacterAutoWriteEnabled;

},
async saveNovelModeState(state) {
  await AppStorage.saveData("novel_mode_enabled", state);
},
async loadNovelModeState() {
  const savedState = await AppStorage.loadData(
    "novel_mode_enabled",
    false,
  );
  this.isNovelModeEnabled = savedState;
  const checkbox = document.getElementById(
    "novel-mode-enabled-checkbox",
  );
  if (checkbox) checkbox.checked = this.isNovelModeEnabled;
},
//加载与同步索引的工具函数
async saveUnifiedIndex() {
  await AppStorage.saveData("unified_index", this.unifiedIndex);
},
async loadUnifiedIndex() {
  const savedIndex = await AppStorage.loadData("unified_index", 1);
  this.unifiedIndex = savedIndex;
  const input = document.getElementById("unified-index-input");
  if (input) input.value = this.unifiedIndex;
},



