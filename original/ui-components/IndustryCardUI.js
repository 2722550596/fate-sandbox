// 文件: IndustryCardUI.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L37572-38441: // ===== 产业卡片 UI 派生辅助方法 ===== ---

// ===== 产业卡片 UI 派生辅助方法 =====

// 构造负责人 view 数据（复用产业派生模块的 4 个辅助函数）
buildIndustryPrincipalView(industry, mvuState) {
  const sd = mvuState?.stat_data || {};
  const npcDataPool = mvuState?.npc_data || {};
  const relationList = sd?.人物关系列表 || {};

  const npcName = String(industry?.['负责人'] || '').trim();

  if (!npcName) {
    return this.makeEmptyPrincipalView('no-principal', '未指派负责人');
  }
  const npcMatched = !!npcDataPool[npcName];
  if (!npcMatched) {
    return this.makeEmptyPrincipalView('unrecognized', `负责人 ${npcName} 未识别`, npcName);
  }
  const subj = relationList[npcName];
  if (!subj) {
    return this.makeEmptyPrincipalView('no-relation', `负责人 ${npcName} 关系未建立`, npcName);
  }

  // 序列与档位判定
  const sequence = String(npcDataPool[npcName].当前序列 || '');
  const parsed = parsePrincipalTier(sequence, true, true);
  const baseTier = parsed.tier;
  const source = parsed.source;
  const pathway = resolvePathwayFromSequence(sequence);
  const industryType = String(industry?.['类型'] || '');
  const specialtyResult = applyPathwaySpecialty(baseTier, pathway, industryType, source);

  // 好感度 & 系数
  let affinity = Number(subj.好感度);
  if (!Number.isFinite(affinity)) affinity = 0;
  affinity = Math.max(-200, Math.min(200, affinity));
  const k = (affinity >= 30) ? Math.max(0, Math.min(1, (affinity - 30) / 100)) : 0;

  // 状态文案
  const statusLabel = this.formatPrincipalStatusLabel(
    npcName, source, affinity, k, baseTier, specialtyResult.finalTier,
    specialtyResult.specialty, pathway, industryType
  );

  // 扣减预估（跨所有产业聚合该 NPC 的 perWeek 之和）
  const helper = window.CurrencyHelper;
  const myCapital = helper ? helper.parseCapitalString(industry.当前投入资本总额).value : 0;
  const myPerWeek = (myCapital >= 50000) ? 4 : (myCapital >= 5000) ? 2 : 1;

  let totalDeduction = 0;
  const deductionSources = [];
  const allIndustries = sd.产业 || {};
  for (const [iid, ind] of Object.entries(allIndustries)) {
    if (iid === '$meta') continue;
    if (!ind || ind.负责人 !== npcName) continue;
    const c = helper ? helper.parseCapitalString(ind.当前投入资本总额).value : 0;
    if (c <= 0) continue;
    const w = (c >= 50000) ? 4 : (c >= 5000) ? 2 : 1;
    const sc = (c >= 50000) ? '大型' : (c >= 5000) ? '中型' : '小型';
    deductionSources.push({ industryName: ind.名称 || '未命名产业', scale: sc, perWeek: w });
    totalDeduction += w;
  }

  return {
    npcName: npcName,
    statusType: source,
    statusLabel: statusLabel,
    tier: baseTier,
    finalTier: specialtyResult.finalTier,
    specialty: specialtyResult.specialty,
    affinity: affinity,
    affinityCoefficient: k,
    pathway: pathway,
    weeklyDeduction: myPerWeek,
    totalDeduction: totalDeduction,
    deductionSources: deductionSources,
    floorReached: affinity <= 10,
  };
},

// 空负责人状态构造器
makeEmptyPrincipalView(statusType, statusLabel, npcName) {
  return {
    npcName: npcName || '',
    statusType: statusType,
    statusLabel: statusLabel,
    tier: 0,
    finalTier: 0,
    specialty: 'none',
    affinity: NaN,
    affinityCoefficient: 0,
    pathway: '',
    weeklyDeduction: 0,
    totalDeduction: 0,
    deductionSources: [],
    floorReached: false,
  };
},

// 构造负责人状态行的展示文案
formatPrincipalStatusLabel(npcName, source, affinity, k, baseTier, finalTier, specialty, pathway, industryType) {
  let tierDesc;
  if (source === 'normal-person') tierDesc = '普通人';
  else if (source === 'old-day') tierDesc = '旧日';
  else if (source === 'pillar') tierDesc = '支柱';
  else if (source.startsWith('sequence-')) {
    tierDesc = '序列 ' + source.split('-')[1];
  } else {
    tierDesc = '未知';
  }

  let specialtySuffix = '';
  if (specialty === 'matched') {
    specialtySuffix = ` + 偏科 (${pathway}×${industryType})`;
  } else if (specialty === 'generalist') {
    specialtySuffix = ` + 万金油 (${pathway})`;
  }

  // 🌟 在档位描述前加上负责人名字
  const safeName = String(npcName || '').trim();
  const namePrefix = safeName ? `${safeName}（${tierDesc}${specialtySuffix}）` : `${tierDesc}${specialtySuffix}`;

  if (affinity >= 130) {
    return `${namePrefix}｜心腹（好感 ${affinity}），BUFF 满效`;
  }
  if (affinity >= 30) {
    const pct = Math.round(k * 100);
    return `${namePrefix}｜好感 ${affinity}，BUFF ${pct}% 生效`;
  }
  if (affinity >= 0) {
    return `${namePrefix}｜关系冷淡（好感 ${affinity}），效率减损`;
  }
  if (affinity >= -69) {
    return `${namePrefix}｜关系恶化（好感 ${affinity}），怠工破坏`;
  }
  return `${namePrefix}｜心生怨恨（好感 ${affinity}），刻意捣乱`;
},

// 渲染负责人状态行
renderPrincipalStatusRow(view) {
  let cls;
  if (view.statusType === 'no-principal') cls = 'principal-empty';
  else if (view.statusType === 'unrecognized' || view.statusType === 'no-relation') cls = 'principal-warning';
  else if (view.affinity >= 30) cls = 'principal-active';
  else cls = 'principal-debuff';

  return `
    <div class="industry-principal-row ${cls}">
      <span class="industry-principal-label">负责人：</span>
      <span class="industry-principal-status">${this.safeEscapeHtml(view.statusLabel)}</span>
    </div>
  `;
},

// 渲染好感度扣减预估行
renderAffinityDeductionRow(view) {
  if (!view.npcName || view.statusType === 'unrecognized' || view.statusType === 'no-relation') {
    return '';
  }
  if (view.floorReached) {
    return `
      <div class="industry-deduction-row floor-reached">
        好感度损耗：已触发地板（≤10），本周不再扣减
      </div>
    `;
  }
  const sourcesList = view.deductionSources.map(s =>
    `· ${this.safeEscapeHtml(s.industryName)}（${s.scale}）-${s.perWeek}`
  ).join('<br>');
  const tooltipText = `${view.npcName} 总损耗：-${view.totalDeduction}/周\n${view.deductionSources.map(s => `· ${s.industryName}（${s.scale}）-${s.perWeek}`).join('\n')}`;

  return `
    <div class="industry-deduction-row" data-tooltip="${this.safeEscapeHtml(tooltipText)}">
      好感度损耗：-${view.weeklyDeduction}/周（本产业）
      <span class="deduction-aggregate">｜${this.safeEscapeHtml(view.npcName)} 共 -${view.totalDeduction}/周</span>
    </div>
  `;
},

renderIndustryCard(id, industry) {
  const card = document.createElement("div");
  card.className = "industry-card";
  card.dataset.industryId = id;


  // 【精简】：UI 层只负责拿数据，不负责算账
  const perf =
    this.IndustrySystem.evaluateMonthlyPerformance(industry);

  // 负责人 view 数据
  const principalView = this.buildIndustryPrincipalView(
    industry,
    this.currentMvuState || window.currentMvuState
  );

  const trendIndicator = this.renderTrendIndicator(perf.baseRate);
  const techProgressBar = this.renderTechProgressBar(perf.techIndex);

    const iConf = typeof GameDBManager !== 'undefined' ? GameDBManager.DB.industryConfig : null;
    const typeMap = iConf?.typeMapping || { '第一产业': '农产品', '第二产业': '工业品', '第三产业': '服务', '独立领地': '农产品' };
    const conv = iConf?.productionConversion || { '1级': 1, '2级': 5, '3级': 10, '4级': 50, '5级': 100 };

    const prodType = typeMap[industry.类型] || '农产品';

    const isSmall = industry.规模 === '小型';
    const isMedium = industry.规模 === '中型';

    const a1 = industry.生产分配_1级 !== undefined ? industry.生产分配_1级 : 100;
    const a2 = industry.生产分配_2级 || 0;
    let a3 = industry.生产分配_3级 || 0;
    let a4 = industry.生产分配_4级 || 0;
    let a5 = industry.生产分配_5级 || 0;
    if (isSmall) { a3 = 0; a4 = 0; a5 = 0; }
    if (isMedium) { a5 = 0; }

    const dis3 = isSmall ? 'disabled' : '';
    const dis4 = isSmall || isMedium ? 'disabled' : '';
    const dis5 = industry.规模 !== '大型' ? 'disabled' : '';

    const expectedIncome = Math.max(0, perf.monthlyReturn);
    const y1 = Math.floor((expectedIncome * (a1 / 100)) / (conv['1级'] || 1));
    const y2 = Math.floor((expectedIncome * (a2 / 100)) / (conv['2级'] || 5));
    const y3 = Math.floor((expectedIncome * (a3 / 100)) / (conv['3级'] || 10));
    const y4 = Math.floor((expectedIncome * (a4 / 100)) / (conv['4级'] || 50));
    const y5 = Math.floor((expectedIncome * (a5 / 100)) / (conv['5级'] || 100));

    card.innerHTML = /* HTML */ `
    <div class="industry-card-header">
      <div class="industry-name">
        <span
          >${this.safeEscapeHtml(
            industry.名称 || "未命名产业",
          )}</span
        >
        <span class="industry-type-badge"
          >${industry.类型 || "未知"}</span
        >
        <span class="industry-scale-badge"
          >${industry.规模 || "未知"}</span
        >
        <span class="industry-toggle-icon">▼</span>
      </div>
      <div
        class="industry-trend-indicator ${perf.monthlyReturn > 0
          ? "trend-up"
          : perf.monthlyReturn < 0
            ? "trend-down"
            : "trend-flat"}"
      >
        ${this.renderTrendIndicator(
          perf.monthlyReturn > 0
            ? 1
            : perf.monthlyReturn < 0
              ? -1
              : 0,
        )}
      </div>
    </div>
    <div class="industry-card-body">
      ${this.renderPrincipalStatusRow(principalView)}
      ${this.renderAffinityDeductionRow(principalView)}
      <div
        class="industry-stat"
        data-tooltip="产业当前的总投入资本"
      >
        <div class="industry-stat-label">💰 当前资本</div>
        <div class="industry-stat-value">
          ${this.IndustrySystem.formatCurrency(
            perf.capital,
            perf.currency,
          )}
        </div>
      </div>
      <div
        class="industry-stat"
        data-tooltip="基础月回报率（受市场饱和度影响）。实际回报率 = 基础回报率 × 市场系数"
      >
        <div class="industry-stat-label">📈 月回报率</div>
        <div
          class="industry-stat-value ${perf.baseRate > 0
            ? "positive"
            : perf.baseRate < 0
              ? "negative"
              : ""}"
        >
          ${perf.baseRate > 0 ? "+" : ""}${perf.baseRate}% →
          ${perf.actualRate.toFixed(2)}%
        </div>
      </div>
      <div
        class="industry-stat"
        data-tooltip="${this.safeEscapeHtml(principalView.statusLabel)}"
      >
        <div class="industry-stat-label">⚙ 负责人对该产业效率的提升等级</div>
        <div class="industry-stat-value">
          ${principalView.finalTier} / 12
        </div>
      </div>
      <div
        class="industry-stat"
        data-tooltip="毛利润 = 资本 × 实际回报率 × 技术系数。这是扣除固定成本前的收益"
      >
        <div class="industry-stat-label">💰 月毛利润</div>
        <div
          class="industry-stat-value ${perf.grossProfit > 0
            ? "positive"
            : "negative"}"
        >
          ${perf.grossProfit > 0
            ? "+"
            : ""}${this.IndustrySystem.formatCurrency(
            perf.grossProfit,
            perf.currency,
          )}
        </div>
      </div>
      <div
        class="industry-stat"
        data-tooltip="净收益 = 毛利润 - 实际固定成本。这是最终每月的盈亏"
      >
        <div class="industry-stat-label">💵 月净收益</div>
        <div
          class="industry-stat-value ${perf.monthlyReturn > 0
            ? "positive"
            : perf.monthlyReturn < 0
              ? "negative"
              : ""}"
        >
          ${perf.monthlyReturn > 0
            ? "+"
            : ""}${this.IndustrySystem.formatCurrency(
            perf.monthlyReturn,
            perf.currency,
          )}
        </div>
      </div>
      <div
        class="industry-stat"
        data-tooltip="技术先进程度（-200至1000）。影响收益倍数"
      >
        <div class="industry-stat-label">⚙️ 技术先进度</div>
        <div
          class="industry-stat-value ${perf.techIndex > 0
            ? "positive"
            : perf.techIndex < 0
              ? "negative"
              : ""}"
        >
          ${perf.techIndex > 0 ? "+" : ""}${perf.techIndex}
          (×${perf.techPotential.toFixed(2)})
        </div>
        ${techProgressBar}
      </div>
      <div
        class="industry-stat"
        data-tooltip="运营管理效率（0-100）。低效率会导致成本成倍增加"
      >
        <div class="industry-stat-label">📊 运营效率</div>
        <div
          class="industry-stat-value ${perf.efficiency >= 70
            ? "positive"
            : perf.efficiency >= 40
              ? ""
              : "negative"}"
        >
          ${perf.efficiency}%
          (成本×${perf.costMultiplier.toFixed(2)})
        </div>
      </div>
      <div
        class="industry-stat"
        data-tooltip="市场竞争饱和程度（0-100）。直接降低回报率"
      >
        <div class="industry-stat-label">📉 市场饱和度</div>
        <div
          class="industry-stat-value ${perf.saturation <= 40
            ? "positive"
            : perf.saturation <= 70
              ? ""
              : "negative"}"
        >
          ${perf.saturation}%
          (回报×${perf.marketFactor.toFixed(2)})
        </div>
      </div>
      <div
        class="industry-stat"
        data-tooltip="每月固定成本占资本的百分比。受运营效率影响"
      >
        <div class="industry-stat-label">💸 固定成本率</div>
        <div
          class="industry-stat-value ${perf.fixedCostRate <= 5
            ? "positive"
            : perf.fixedCostRate <= 10
              ? ""
              : "negative"}"
        >
          ${perf.fixedCostRate.toFixed(1)}% (<span
            style="color: var(--color-danger);"
            >-${this.IndustrySystem.formatCurrency(
              perf.actualFixedCost,
              perf.currency,
            )}</span
          >)
        </div>
      </div>
      
      <div 
        class="industry-production-panel" 
        style="grid-column: 1 / -1; width: 100%; box-sizing: border-box; background: rgba(var(--rgb-bg-dark), 0.15); border: 1px solid var(--color-border-dark); padding: 12px; border-radius: 6px; margin-top: 5px;"
      >
        <div class="industry-stat-label" style="margin-bottom: 12px; color: var(--color-primary); font-weight: bold; border-bottom: 1px solid rgba(150,150,150,0.2); padding-bottom: 6px;">
          🏭 生产力分配与预估产出 (${prodType})
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; align-items: center; font-size: var(--text-sm);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
            <span>1级:</span>
            <input type="number" class="prod-alloc-input" data-level="1" data-id="${id}" value="${a1}" min="0" max="100" style="width: 45px; background: var(--overlay-base); border: 1px solid var(--color-border-dark); color: var(--text-main); border-radius: 4px; text-align: center;">
            <span style="color: var(--color-success); font-weight: bold; width: 40px; text-align: right;">${y1}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
            <span>2级:</span>
            <input type="number" class="prod-alloc-input" data-level="2" data-id="${id}" value="${a2}" min="0" max="100" style="width: 45px; background: var(--overlay-base); border: 1px solid var(--color-border-dark); color: var(--text-main); border-radius: 4px; text-align: center;">
            <span style="color: var(--color-success); font-weight: bold; width: 40px; text-align: right;">${y2}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; ${dis3 ? 'opacity:0.5;' : ''}">
            <span>3级:</span>
            <input type="number" class="prod-alloc-input" data-level="3" data-id="${id}" value="${a3}" min="0" max="100" ${dis3} style="width: 45px; background: var(--overlay-base); border: 1px solid var(--color-border-dark); color: var(--text-main); border-radius: 4px; text-align: center; ${dis3 ? 'cursor:not-allowed;' : ''}">
            <span style="color: var(--color-success); font-weight: bold; width: 40px; text-align: right;">${y3}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; ${dis4 ? 'opacity:0.5;' : ''}">
            <span>4级:</span>
            <input type="number" class="prod-alloc-input" data-level="4" data-id="${id}" value="${a4}" min="0" max="100" ${dis4} style="width: 45px; background: var(--overlay-base); border: 1px solid var(--color-border-dark); color: var(--text-main); border-radius: 4px; text-align: center; ${dis4 ? 'cursor:not-allowed;' : ''}">
            <span style="color: var(--color-success); font-weight: bold; width: 40px; text-align: right;">${y4}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; ${dis5 ? 'opacity:0.5;' : ''}">
            <span>5级:</span>
            <input type="number" class="prod-alloc-input" data-level="5" data-id="${id}" value="${a5}" min="0" max="100" ${dis5} style="width: 45px; background: var(--overlay-base); border: 1px solid var(--color-border-dark); color: var(--text-main); border-radius: 4px; text-align: center; ${dis5 ? 'cursor:not-allowed;' : ''}">
            <span style="color: var(--color-success); font-weight: bold; width: 40px; text-align: right;">${y5}</span>
          </div>
        </div>
        
        <div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 10px; line-height: 1.4;">
          * 转换率: 1级=1/${conv['1级']||1}, 2级=1/${conv['2级']||5}, 3级=1/${conv['3级']||10}, 4级=1/${conv['4级']||50}, 5级=1/${conv['5级']||100}。修改后点击外侧保存。<br>
          * 规模限制: 小/中/大型分别最高生产2/4/5级。
          <span style="display: inline-block; margin-top: 4px;">总计分配: <strong style="color:${(a1+a2+a3+a4+a5)>100?'var(--color-danger)':'var(--color-primary)'};">${a1+a2+a3+a4+a5}%</strong> / 100%</span>
        </div>
      </div>
    </div>
    <div class="industry-card-details">
      <div class="industry-overview">
        ${this.safeEscapeHtml(industry.产业情况概述 || "暂无概述")}
      </div>
      ${industry.资产
        ? `
<div class="industry-assets">
<div class="industry-assets-title">📦 主要资产</div>
<div class="industry-assets-content">${this.safeEscapeHtml(industry.资产)}</div>
</div>
`
        : ""}
      ${industry.收入来源
        ? `
<div class="industry-income-source">
<div class="industry-income-title">💼 收入来源</div>
<div class="industry-income-content">${this.safeEscapeHtml(industry.收入来源)}</div>
</div>
`
        : ""}
      <div class="industry-meta-info">
        ${industry.创建时间
          ? `创建于: ${industry.创建时间}`
          : ""}
        ${industry.上次结算时间
          ? ` | 上次结算: ${industry.上次结算时间}`
          : ""}
      </div>
    </div>
  `;

  card.querySelectorAll('.prod-alloc-input').forEach(input => {
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      let val = parseInt(e.target.value, 10) || 0;
      if (val < 0) val = 0;
      if (val > 100) val = 100;
      const level = e.target.dataset.level;
      const indId = e.target.dataset.id;
      const ind = this.IndustrySystem.industries[indId];
      if (ind) {
        const oldVal = ind[`生产分配_${level}级`] !== undefined ? ind[`生产分配_${level}级`] : (level === '1' ? 100 : 0);
        let sum = 0;
        for (let i = 1; i <= 5; i++) {
          if (i.toString() === level) sum += val;
          else sum += (ind[`生产分配_${i}级`] !== undefined ? ind[`生产分配_${i}级`] : (i === 1 ? 100 : 0));
        }
        if (sum > 100) {
          if (this.app && this.app.showTemporaryMessage) {
            this.app.showTemporaryMessage('❌ 分配比例总和不能超过100%！');
          }
          e.target.value = oldVal;
          return;
        }
        e.target.value = val;
        this.IndustrySystem.updateIndustry(indId, { [`生产分配_${level}级`]: val });
        this.renderIndustryList();
      }
    });
    input.addEventListener('click', (e) => e.stopPropagation());
  });

  card.addEventListener("click", (e) => {
    e.stopPropagation();
    card.classList.toggle("expanded");
  });

  return card;
},

renderTrendIndicator(rate) {
  if (rate > 0)
    return '📈 <span style="font-size: var(--text-base);">增长</span>';
  else if (rate < 0)
    return '📉 <span style="font-size: var(--text-base);">衰退</span>';
  else
    return '➡️ <span style="font-size: var(--text-base);">平稳</span>';
},

renderTechProgressBar(techIndex) {
  const constrainedIndex = Math.max(-200, Math.min(1000, techIndex));
  const percentage = ((constrainedIndex + 200) / 1200) * 100;
  let barColor = "var(--color-info)";
  if (constrainedIndex < 0) barColor = "var(--color-danger)";
  else if (constrainedIndex > 500) barColor = "var(--color-success)";
  else if (constrainedIndex > 200) barColor = "var(--color-info)";
  else barColor = "var(--text-muted)";

  return /* HTML */ `
    <div class="tech-progress-bar">
      <div
        class="tech-progress-fill"
        style="width: ${percentage}%; background-color: ${barColor};"
      ></div>
    </div>
  `;
},

checkPendingSettlements() {
  const pendingList = [];
  const currentTime = this.currentMvuState?.world_data?.当前时间纪元 || this.currentMvuState?.stat_data?.当前时间纪元;
  if (!currentTime) return pendingList;

  const industries = this.IndustrySystem.getAllIndustries();

  for (const [id, industry] of Object.entries(industries)) {
    const capitalStr = industry.当前投入资本总额 || "0";
    const { value: capital, currency } =
      this.IndustrySystem.parseCurrency(capitalStr);
    if (capital <= 0) continue;

    const lastSettlementTime =
      industry.上次结算时间 || industry.创建时间 || currentTime;
    const weeks = this.IndustrySystem.calculateWeeksDifference(
      lastSettlementTime,
      currentTime,
    );

    if (weeks >= 1) {
      const monthlyRate = industry.月均资本回报率 || 0;
      const weeklyRate = monthlyRate / 4;

      const newCapitalStr =
        this.IndustrySystem.calculateIndustryReturn(
          capitalStr,
          weeklyRate,
          weeks,
          industry,
        );
      const { value: newCapital } =
        this.IndustrySystem.parseCurrency(newCapitalStr);

      // 【核心修复】：移除 Math.max(0)，真实反映亏损！
      const estimatedIncomeValue = newCapital - capital;

      // 格式化带正负号的货币文本
      const sign = estimatedIncomeValue > 0 ? "+" : "";
      const formattedIncome =
        sign +
        this.IndustrySystem.formatCurrency(
          estimatedIncomeValue,
          currency,
        );

      pendingList.push({
        id,
        name: industry.名称,
        capital: capitalStr,
        weeks,
        lastSettlementTime,
        monthlyRate,
        techIndex: industry.技术先进指数 || 0,
        estimatedIncome: formattedIncome, // 传入带正负号的真实预估值
        _calculatedNewCapitalStr: newCapitalStr,
      });
    }
  }
  return pendingList;
},

async showSettlementConfirmation(pendingList) {
  return new Promise((resolve) => {
    const modalHtml = `
<div id="settlement-confirmation-modal" class="modal-overlay" style="display: flex; z-index: 10000;">
  <div class="modal-content modal-content-md">
    <div class="modal-header"><h2>💰 产业收益结算</h2></div>
    
    <div class="modal-body modal-body-padded">
      <p class="modal-prompt-text">检测到以下产业有待结算的收益，是否现在结算？</p>
      <div class="settlement-list-box">
      ${pendingList
        .map(
          (item) => `
        <div class="settlement-item">
          <div class="settlement-item-name">${this.safeEscapeHtml(item.name)}</div>
          <div class="settlement-item-desc">
            当前资本: ${this.safeEscapeHtml(item.capital)} | 待结算: ${item.weeks}周 | 预计收益: ~${this.safeEscapeHtml(item.estimatedIncome)}
          </div>
        </div>
      `,
        )
        .join("")}
      </div>
      <div class="settlement-tip">💡 提示：结算后收益将自动加入产业资本，并更新到游戏存档中。</div>
    </div>

    <div class="modal-footer-actions" style="padding: 16px 24px; border-top: 1px solid rgba(var(--rgb-primary), 0.3); display: flex; justify-content: flex-end; gap: 15px;">
      <button id="btn-settlement-cancel" class="interaction-btn btn-bg-secondary">稍后结算</button>
      <button id="btn-settlement-confirm" class="interaction-btn btn-bg-success">立即结算</button>
    </div>
  </div>
</div>
`;

    const modalContainer = document.createElement("div");
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);

    document
      .getElementById("btn-settlement-cancel")
      .addEventListener("click", () => {
        modalContainer.remove();
        resolve(false);
      });

    document
      .getElementById("btn-settlement-confirm")
      .addEventListener("click", async () => {
        modalContainer.remove();
        await this.executeSettlement(pendingList);
        resolve(true);
      });
  });
},

async executeSettlement(pendingList) {
  const currentTime = this.currentMvuState.world_data?.当前时间纪元 || this.currentMvuState.stat_data?.当前时间纪元;
  let totalReturnByCurrency = {};
  let incomeDetails = [];

  for (const item of pendingList) {
    const industry = this.IndustrySystem.industries[item.id];
    if (!industry) continue;

    const capitalStr = industry.当前投入资本总额 || "0";
    const { value: capital, currency } =
      this.IndustrySystem.parseCurrency(capitalStr);

    // 【修复核心】：直接使用在 checkPendingSettlements 中引擎算好的结果
    const newCapitalStr = item._calculatedNewCapitalStr;
    const { value: newCapitalValue } =
      this.IndustrySystem.parseCurrency(newCapitalStr);

    const finalReturnAmount = newCapitalValue - capital;

    if (!totalReturnByCurrency[currency])
      totalReturnByCurrency[currency] = 0;
    totalReturnByCurrency[currency] += finalReturnAmount;

    incomeDetails.push({
      name: industry.名称,
      type: industry.类型,
      scale: industry.规模,
      overview: industry.产业情况概述,
      assets: industry.资产,
      incomeSource: industry.收入来源,
      oldCapital: capitalStr,
      income: this.IndustrySystem.formatCurrency(
        finalReturnAmount,
        currency,
      ),
      newCapital: newCapitalStr,
      weeks: item.weeks,
      monthlyRate: item.monthlyRate,
      techIndex: item.techIndex,
      efficiency: industry.运营效率 || 50,
      saturation: industry.市场饱和度 || 30,
      fixedCostRate: industry.固定成本率 || 5,
    });

    // 更新产业
    this.IndustrySystem.updateIndustry(item.id, {
      当前投入资本总额: newCapitalStr,
      上次结算时间: currentTime,
    });
  }

  const returnSummary =
    Object.entries(totalReturnByCurrency)
      .map(([currency, amount]) =>
        this.IndustrySystem.formatCurrency(amount, currency),
      )
      .join(", ") || "0";

  try {
    const lastSnapshot = this.chatHistoryCache.at(-1);
    if (lastSnapshot) {
      lastSnapshot.data = _.cloneDeep(this.currentMvuState);
      await AppStorage.saveData(
        this._getHistoryKey(),
        this.chatHistoryCache,
      );
    }
  } catch (error) {
    this.showTemporaryMessage("⚠️ 数据保存失败，请重试", 3000);
    return;
  }

  await this.saveSettlementSnapshot(
    incomeDetails,
    returnSummary,
    currentTime,
  );
  this.showSettlementResult(incomeDetails, returnSummary);

  this.IndustrySystem.loadFromGameData();
  this.renderIndustryDashboard();
  this.renderIndustryList();
},

async saveSettlementSnapshot(
  incomeDetails,
  returnSummary,
  settlementTime,
) {
  try {
    // 在 saveSettlementSnapshot 里替换结算消息模板
    const settlementMessage = `
<div class="receipt-wrapper">
  <div class="receipt-corner tl"></div>
  <div class="receipt-corner tr"></div>
  <div class="receipt-corner bl"></div>
  <div class="receipt-corner br"></div>

  <div class="receipt-header">
    <div class="receipt-header-en">Industrial Revenue Settlement</div>
    <div class="receipt-header-zh">💰 产业收益结算</div>
    <div class="receipt-time">${settlementTime}</div>
  </div>

  <div class="receipt-total-box">
    <div class="receipt-total-label">Total Return</div>
    <div class="receipt-total-value">${returnSummary}</div>
  </div>

  ${incomeDetails
    .map(
      (detail) => `
  <div class="receipt-item-card">
    <div class="receipt-item-header">
      <div class="receipt-item-title">${detail.name}</div>
      <div class="receipt-item-badge">${detail.type || "未知"} · ${detail.scale || "未知"}</div>
    </div>

    <div class="receipt-grid">
      <div class="receipt-grid-label">期初资本:</div>
      <div class="receipt-grid-val">${detail.oldCapital}</div>

      <div class="receipt-grid-label">本期收益:</div>
      <div class="receipt-grid-val success">+${detail.income}</div>

      <div class="receipt-grid-label">期末资本:</div>
      <div class="receipt-grid-val bold">${detail.newCapital}</div>

      <div class="receipt-grid-label">结算周期:</div>
      <div class="receipt-grid-val">${detail.weeks}周 (月均${detail.monthlyRate}%${detail.techIndex > 0 ? `, 技术+${detail.techIndex}` : ""})</div>
    </div>

    ${
      detail.overview
        ? `
    <div class="receipt-overview">
      <div class="receipt-overview-title">概述:</div>
      ${detail.overview}
    </div>`
        : ""
    }

    ${
      detail.assets || detail.incomeSource
        ? `
    <div class="receipt-sub-grid ${detail.assets && detail.incomeSource ? "cols-2" : ""}">
      ${
        detail.assets
          ? `
      <div class="receipt-sub-card">
        <div class="receipt-sub-title">资产:</div>
        <div class="receipt-sub-content">${detail.assets}</div>
      </div>`
          : ""
      }

      ${
        detail.incomeSource
          ? `
      <div class="receipt-sub-card">
        <div class="receipt-sub-title">收入来源:</div>
        <div class="receipt-sub-content">${detail.incomeSource}</div>
      </div>`
          : ""
      }
    </div>`
        : ""
    }
  </div>
  `,
    )
    .join("")}

  <div class="receipt-footer">
    Industrial Management Bureau
  </div>
</div>
`;

    const gameTextDisplay =
      document.getElementById("game-text-display");
    if (gameTextDisplay) {
      const currentContent = gameTextDisplay.innerHTML;
      gameTextDisplay.innerHTML =
        currentContent + settlementMessage;
      gameTextDisplay.scrollTop = gameTextDisplay.scrollHeight;
    }
  } catch (error) {
    this.showTemporaryMessage("⚠️ 结算消息显示失败", 3000);
  }
},

showSettlementResult(incomeDetails, returnSummary) {
    const detailsHtml = incomeDetails
      .map(
        (detail) =>
          `    • ${detail.name}: +${detail.income} (${detail.weeks}周)`,
      )
      .join("\n");
    this.showTemporaryMessage(
      `💰 产业收益结算完成！\n\n总收益: ${returnSummary}\n\n详细收益:\n${detailsHtml}`,
      8000,
    );
},


