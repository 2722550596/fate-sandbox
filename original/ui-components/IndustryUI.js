// 文件: IndustryUI.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L37393-37571: // ========================================================== ---

// ==========================================================
// ==================== 产业 UI 函数 (完美衔接版) ================
// ==========================================================

async showIndustryManagement() {

  this.openModal("industry-modal");

  const loading = document.getElementById("industry-loading");
  const container = document.getElementById(
    "industry-list-container",
  );
  const emptyState = document.getElementById("industry-empty-state");

  if (loading && container) {
    loading.style.display = "flex";
    container.style.display = "none";
    if (emptyState) emptyState.style.display = "none";
  }

  // 【调用内聚引擎】
  if (!this.IndustrySystem.app) {
    console.log("[产业管理] 首次打开，开始初始化内部引擎...");
    this.IndustrySystem.init(this);
  }

  await new Promise((resolve) => setTimeout(resolve, 100));

  // 加载产业数据
  this.IndustrySystem.loadFromGameData();

  // 🚫 旧的手动结算弹窗已禁用：
  //   产业现在由时间引擎触发器 industry_weekly_settle 每 7 天自动结算，
  //   利润直接打入玩家钱包（stat_data.货币），不再滚入资本。
  //   原 checkPendingSettlements / showSettlementConfirmation / executeSettlement
  //   代码保留，但不会被任何路径调用，避免重复结算。
  // const pendingSettlements = this.checkPendingSettlements();
  // if (pendingSettlements.length > 0) {
  //   await this.showSettlementConfirmation(pendingSettlements);
  // }

  this.renderIndustryDashboard();
  this.renderIndustryList();

  const dashboardHeader = document.getElementById(
    "dashboard-header-toggle",
  );
  if (dashboardHeader && !dashboardHeader.dataset.listenerAdded) {
    dashboardHeader.addEventListener("click", () => {
      this.toggleDashboard();
    });
    dashboardHeader.dataset.listenerAdded = "true";
  }

  if (loading && container) {
    loading.style.display = "none";
    container.style.display = "block";
  }
},

renderIndustryDashboard() {
  const stats = this.IndustrySystem.getStatistics();
  const totalMonthlyReturnParts = Object.entries(
    stats.monthlyReturnByCurrency,
  ).map(([currency, value]) =>
    this.IndustrySystem.formatCurrency(value, currency),
  );
  const totalMonthlyReturnStr =
    totalMonthlyReturnParts.length > 0
      ? totalMonthlyReturnParts.join(", ")
      : "0";

  document.getElementById("dashboard-total-valuation").textContent =
    stats.totalValuation;
  document.getElementById("dashboard-industry-count").textContent =
    stats.count;
  document.getElementById("dashboard-total-return").textContent =
    totalMonthlyReturnStr;
  document.getElementById("dashboard-avg-rate").textContent =
      `${stats.avgRate}%`;

    // === [新增] 预计总月产出统计 ===
    let prodStats = { 农产品:[0,0,0,0,0], 工业品:[0,0,0,0,0], 服务:[0,0,0,0,0] };
    const iConf = typeof GameDBManager !== 'undefined' ? GameDBManager.DB.industryConfig : null;
    const typeMap = iConf?.typeMapping || { '第一产业': '农产品', '第二产业': '工业品', '第三产业': '服务', '独立领地': '农产品' };
    const conv = iConf?.productionConversion || { '1级': 1, '2级': 5, '3级': 10, '4级': 50, '5级': 100 };

    Object.values(this.IndustrySystem.industries).forEach(ind => {
      const pType = typeMap[ind.类型] || '农产品';
      if (!prodStats[pType]) return; // 防报错
      const perf = this.IndustrySystem.evaluateMonthlyPerformance(ind);
      const income = Math.max(0, perf.monthlyReturn);
      if (income > 0) {
        const a1 = ind.生产分配_1级 !== undefined ? ind.生产分配_1级 : 100;
        const a2 = ind.生产分配_2级 || 0; const a3 = ind.生产分配_3级 || 0; const a4 = ind.生产分配_4级 || 0; const a5 = ind.生产分配_5级 || 0;
        prodStats[pType][0] += Math.floor((income * (a1/100)) / (conv['1级'] || 1));
        prodStats[pType][1] += Math.floor((income * (a2/100)) / (conv['2级'] || 5));
        prodStats[pType][2] += Math.floor((income * (a3/100)) / (conv['3级'] || 10));
        prodStats[pType][3] += Math.floor((income * (a4/100)) / (conv['4级'] || 50));
        prodStats[pType][4] += Math.floor((income * (a5/100)) / (conv['5级'] || 100));
      }
    });
    let prodHtml = '';
['农产品', '工业品', '服务'].forEach(type => {
      const arr = prodStats[type];
      if (arr.some(v => v > 0)) {
        let details =[];
        arr.forEach((v, i) => { if (v > 0) details.push(`${i+1}级:${v}`); });
        prodHtml += `<div style="font-size:var(--text-xs); color:var(--text-muted); padding: 2px 0;"><strong>${type}</strong>: ${details.join(', ')}</div>`;
      }
    });
    let dashboardObj = document.getElementById('industry-dashboard');
    let existingProdNode = document.getElementById('dashboard-prod-stats');
    if (!existingProdNode) {
      existingProdNode = document.createElement('div');
      existingProdNode.id = 'dashboard-prod-stats';
      existingProdNode.className = 'dashboard-card';
      existingProdNode.style.gridColumn = '1 / -1';
      dashboardObj.appendChild(existingProdNode);
    }
    existingProdNode.innerHTML = `<div class="dashboard-label">预计总月产出</div><div style="display:flex; justify-content:space-around; gap:15px; flex-wrap:wrap;">${prodHtml || '<span style="font-size:var(--text-xs); color:var(--text-muted);">暂无产出</span>'}</div>`;

    // ============ [新增] 根据盈亏状态改变总收益颜色 ============
  const returnElement = document.getElementById(
    "dashboard-total-return",
  );
  returnElement.textContent = totalMonthlyReturnStr;

  // 清理旧的颜色类
  returnElement.classList.remove(
    "dashboard-profit-up",
    "dashboard-profit-down",
    "dashboard-profit-flat",
  );

  // 判断字符串中是否包含负号 '-'
  if (totalMonthlyReturnStr.includes("-")) {
    returnElement.classList.add("dashboard-profit-down"); // 亏损
  } else if (totalMonthlyReturnStr !== "0") {
    returnElement.classList.add("dashboard-profit-up"); // 盈利
  } else {
    returnElement.classList.add("dashboard-profit-flat"); // 0收益
  }
},

toggleDashboard() {
  const modalBody = document.querySelector(
    "#industry-modal .modal-body",
  );
  if (modalBody) {
    const wasCollapsed = modalBody.classList.contains(
      "dashboard-collapsed",
    );
    modalBody.classList.toggle("dashboard-collapsed");
  }
},

renderIndustryList() {
  const container = document.getElementById(
    "industry-list-container",
  );
  const emptyState = document.getElementById("industry-empty-state");
  const industries = this.IndustrySystem.getAllIndustries();

  if (Object.keys(industries).length === 0) {
    container.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  const fragment = document.createDocumentFragment();
  for (const [id, industry] of Object.entries(industries)) {
    fragment.appendChild(this.renderIndustryCard(id, industry));
  }
  container.innerHTML = "";
  container.appendChild(fragment);
},


