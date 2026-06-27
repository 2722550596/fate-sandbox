// 文件: FactionUI.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L37314-37392: // ========================================================== ---

// ==========================================================
// ==================== 势力 UI 函数 ========================
// ==========================================================
async showFactionManagement() {
  this.openModal("faction-modal");
  const body = document.getElementById("faction-modal-body");
  if (!body) return;
  body.innerHTML = '<p class="modal-placeholder">正在加载势力数据...</p>';
  try {
    let stat_data = this.currentMvuState?.stat_data;
    if (!stat_data || Object.keys(stat_data).length === 0) {
      const latestSnapshot = this.chatHistoryCache.at(-1);
      if (latestSnapshot?.data?.stat_data) {
        stat_data = latestSnapshot.data.stat_data;
        this.currentMvuState = latestSnapshot.data;
      } else {
        body.innerHTML = '<p class="modal-placeholder">无法获取数据。</p>';
        return;
      }
    }
    const factionData = this.SafeGetValue(stat_data, "势力", {});
    body.innerHTML = this.renderFactionDashboard(factionData);
  } catch (e) {
    body.innerHTML = `<p class="modal-placeholder">加载失败: ${e.message}</p>`;
  }
},
renderFactionDashboard(factionObj) {
  const factions = Object.entries(factionObj).filter(([k]) => k !== "$meta");
  if (factions.length === 0) {
    return '<div class="empty-category-text">暂无势力数据，请在游戏中建立或加入势力。</div>';
  }
  let html = "";
  factions.forEach(([factionKey, faction]) => {
    const name = this.safeEscapeHtml(faction.势力名 || factionKey);
    const type = this.safeEscapeHtml(faction.势力类型 || "未知");
    const position = this.safeEscapeHtml(faction["<User>的职位"] || "无");
    const population = faction.人口数量 || 0;
    const anchorSupply = faction.锚的供给量 || 0;
    const anchorDemand = faction.锚的需求 || 0;
    const overview = this.safeEscapeHtml(faction.势力概述 || "暂无概述");
    const godsObj = faction.直辖的半神和真神信息 || {};
    let godsHtml = "";
    Object.entries(godsObj).filter(([k]) => k !== "$meta").forEach(([godKey, god]) => {
      godsHtml += `<div class="attribute-row"><div class="attribute-label">代称：${this.safeEscapeHtml(godKey)}</div><div class="attribute-value-wrapper"><span class="attribute-value">名称：${this.safeEscapeHtml(god["半神/真神名称"] || "未知")} | 序列：${this.safeEscapeHtml(god["序列"] || "未知")} | 职位：${this.safeEscapeHtml(god["职位"] || "未知")}</span></div></div>`;
    });
    const regionsObj = faction.实控区域 || {};
    let regionsHtml = `<div class="attribute-row"><div class="attribute-label">汇总名单：</div><span class="attribute-value">${this.safeEscapeHtml(regionsObj.实控区域汇总名单 || "无")}</span></div><div class="attribute-row"><div class="attribute-label">总面积：</div><span class="attribute-value">${regionsObj.总面积 || 0}</span></div>`;
    Object.entries(regionsObj).filter(([k, v]) => !['实控区域汇总名单', '总面积', '$meta'].includes(k) && typeof v === 'object' && v !== null).forEach(([rKey, rVal]) => {
      const displayKey = rVal.区域名 || rKey;
      regionsHtml += `<div class="details-content" style="margin-top: 10px; border-left: 2px solid var(--color-primary); padding-left: 10px;"><strong>${this.safeEscapeHtml(displayKey)}</strong><br>类型: ${this.safeEscapeHtml(rVal.区域类型 || "")} | 面积: ${rVal.区域面积 || 0} | 核心: ${this.safeEscapeHtml(rVal.区域核心 || "")} | 人口: ${rVal.区域人口 || 0}<br>概述: ${this.safeEscapeHtml(rVal.区域概述 || "")}</div>`;
    });
    const armyObj = faction.世俗军队 || {};
    let armyHtml = "";
["海军", "陆军", "空军"].forEach(branch => {
      const branchObj = armyObj[branch] || {};
      const branchItems = Object.entries(branchObj).filter(([k]) => k !== "$meta");
      if (branchItems.length > 0) {
        armyHtml += `<h4 style="color:var(--text-subtle); margin-top:10px;">${branch}</h4>`;
        branchItems.forEach(([uKey, uVal]) => {
          const stats = uVal.战斗属性 || {};
          armyHtml += `<div class="details-content" style="margin-top: 5px; border-left: 2px solid var(--color-secondary); padding-left: 10px;"><strong>${this.safeEscapeHtml(uVal.部队名 || uKey)}</strong> (${this.safeEscapeHtml(uVal.部队类型 || "")} - ${this.safeEscapeHtml(uVal.部队精锐等级 || "")})<br>数量: ${uVal.部队数量 || 0}<br>战斗属性: 活力 ${stats.当前活力||0}/${stats.活力||0}, 敏捷 ${stats.当前敏捷||0}/${stats.敏捷||0}, 人性 ${stats.当前人性||0}/${stats.人性||0}, 理智 ${stats.当前理智||0}/${stats.理智||0}</div>`;
        });
      }
    });
    const demandObj = faction.势力生产力总需求 || {};
    let demandHtml = '<div style="display:flex; flex-wrap:wrap; gap:10px; font-size:var(--text-xs);">';
["农产品", "工业品", "服务"].forEach(type => {
      let reqStr =[];
      for(let i=1; i<=5; i++) {
        const val = demandObj[`${i}级${type}需求`] || 0;
        if(val > 0) reqStr.push(`${i}级:${val}`);
      }
      if(reqStr.length > 0) demandHtml += `<div><strong>${type}:</strong> ${reqStr.join(", ")}</div>`;
    });
    demandHtml += "</div>";
    html += `<div class="details-card" style="margin-bottom: 20px;"><div class="details-card-title">${name} <span class="industry-type-badge">${type}</span></div><div class="attribute-row"><div class="attribute-label">我的职位</div><span class="attribute-value">${position}</span></div><div class="attribute-row"><div class="attribute-label">人口数量</div><span class="attribute-value">${population}</span></div><div class="attribute-row"><div class="attribute-label">锚 (供给/需求)</div><span class="attribute-value"><span style="color:var(--color-success)">${anchorSupply}</span> / <span style="color:var(--color-danger)">${anchorDemand}</span></span></div><div class="industry-overview" style="margin-top: 10px;"><strong>势力概述：</strong><br>${overview}</div>${godsHtml ? `<div style="margin-top:15px; border-top:1px dashed var(--color-border-dark); padding-top:10px;"><strong style="color:var(--text-highlight)">直辖半神与真神</strong>${godsHtml}</div>` : ""}<div style="margin-top:15px; border-top:1px dashed var(--color-border-dark); padding-top:10px;"><strong style="color:var(--text-highlight)">实控区域</strong>${regionsHtml}</div>${armyHtml ? `<div style="margin-top:15px; border-top:1px dashed var(--color-border-dark); padding-top:10px;"><strong style="color:var(--text-highlight)">世俗军队</strong>${armyHtml}</div>` : ""}<div style="margin-top:15px; border-top:1px dashed var(--color-border-dark); padding-top:10px;"><strong style="color:var(--text-highlight)">生产力需求</strong>${demandHtml}</div></div>`;
  });
  return html;
},

