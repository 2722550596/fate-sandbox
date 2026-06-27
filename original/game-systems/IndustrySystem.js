// 文件: IndustrySystem.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L36667-37313: // ========================================================== ---

// ==========================================================
// ================ 产业系统 (完美内聚增强版) =================
// ==========================================================

/**
  * 【产业核心引擎】
  * 100% 继承了原先的健壮性，包括所有防御性校验和货币处理逻辑
  */
IndustrySystem: {
  app: null, // 指向 GameManager (父级实例)
  industries: {},
  metadata: { 总估值: 0, 上次计算时间: "" },
  valuationCache: {},
  statsCache: null,
  statsCacheValid: false,
  _idCounter: 0,

  // --- 1. 引擎初始化 ---
  init(appInstance) {
    this.app = appInstance;
  },

  // --- 2. 货币辅助函数 (原独立函数) ---
  parseCurrency(currencyStr) {
    if (typeof currencyStr === "number")
      return { value: Math.round(currencyStr), currency: "" };
    if (typeof currencyStr !== "string" || !currencyStr.trim())
      return { value: 0, currency: "" };
    const cleaned = currencyStr.trim().replace(/[\s,_]/g, "");
    const numberMatch = cleaned.match(/([\d.]+)/);
    let value = 0;
    if (numberMatch) {
      value = parseFloat(numberMatch[1]);
      value = isNaN(value) ? 0 : Math.round(value);
    }
    const currencyMatch = cleaned.match(/[^\d.]+/);
    let currency = "";
    if (currencyMatch) currency = currencyMatch[0].trim();
    return { value, currency };
  },

  formatCurrency(value, currency = "") {
    const formattedValue = Math.round(value).toString();
    if (currency && currency.trim())
      return `${formattedValue} ${currency.trim()}`;
    return formattedValue;
  },

  // --- 替换 2. 货币辅助函数中的 addCurrency ---
  addCurrency(currency1, currency2) {
    const c1 = this.parseCurrency(currency1);
    const c2 = this.parseCurrency(currency2);

    // [修复] 阻断不同币种的强制合并，防止出现 1金镑+1铜便士=2金镑 的恶性Bug
    if (c1.currency && c2.currency && c1.currency !== c2.currency) {
      throw new Error(
        `[货币计算] 错误：试图合并不同币种 (${c1.currency} vs ${c2.currency})，你需要让哈基米将币种统一！`,
      );
    }

    const targetCurrency = c1.currency || c2.currency;
    return this.formatCurrency(c1.value + c2.value, targetCurrency);
  },

  multiplyCurrency(currencyStr, percentage) {
    const c = this.parseCurrency(currencyStr);
    const result = c.value * (percentage / 100);
    return this.formatCurrency(result, c.currency);
  },

  // --- 3. 时间解析模块 (原 GameTimeParser) ---
  // --- 修改 3. 时间解析模块：补全返回值和缺失的方法 ---
  parseGameTime(timeString) {
    try {
      const cleaned = timeString.replace(/\s+/g, "");
      const chineseToNumber = {
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
        十: 10,
      };
      const regex =
        /第([一二三四五六七八九十\d]+)纪(\d+)年(\d+)月(\d+)日星期(.)(\d+):(\d+)/;
      const match = cleaned.match(regex);
      if (!match) {
        console.warn(`[时间解析] 无法解析时间: ${timeString}`);
        return null;
      }
      let era = match[1];
      if (chineseToNumber[era]) era = chineseToNumber[era];
      else era = parseInt(era);
      return {
        era,
        year: parseInt(match[2]),
        month: parseInt(match[3]),
        day: parseInt(match[4]),
        weekday: match[5],
        hour: parseInt(match[6]),
        minute: parseInt(match[7]),
        original: timeString, // 补充缺失的 original 字段
      };
    } catch (error) {
      console.error("[时间解析] 发生错误:", error);
      return null;
    }
  },

  // [新增] 补全遗漏的 timeToNumber 方法，用于时间比较
  timeToNumber(timeString) {
    const time = this.parseGameTime(timeString);
    if (!time) return 0;
    return (
      time.era * 10000 * 365 * 24 * 60 +
      time.year * 365 * 24 * 60 +
      time.month * 30 * 24 * 60 +
      time.day * 24 * 60 +
      time.hour * 60 +
      time.minute
    );
  },

  calculateMonthsDifference(oldTimeString, newTimeString) {
    try {
      const oldTime = this.parseGameTime(oldTimeString);
      const newTime = this.parseGameTime(newTimeString);
      if (!oldTime || !newTime) return 0;
      const eraDiff = (newTime.era - oldTime.era) * 10000 * 12;
      const yearDiff = (newTime.year - oldTime.year) * 12;
      const monthDiff = newTime.month - oldTime.month;
      return eraDiff + yearDiff + monthDiff;
    } catch (error) {
      return 0;
    }
  },

  calculateDaysDifference(oldTimeString, newTimeString) {
    try {
      const oldTime = this.parseGameTime(oldTimeString);
      const newTime = this.parseGameTime(newTimeString);
      if (!oldTime || !newTime) return 0;

      // [标准化历法依赖]
      // 注意：这里硬编码假设每年365天，每月固定30天。
      // 若未来游戏引入闰年或大小月（如31/28天），需重构此处的乘数逻辑，否则会导致结算时间漂移。
      const eraDiff = (newTime.era - oldTime.era) * 10000 * 365;
      const yearDiff = (newTime.year - oldTime.year) * 365;
      const monthDiff = (newTime.month - oldTime.month) * 30;
      const dayDiff = newTime.day - oldTime.day;
      return eraDiff + yearDiff + monthDiff + dayDiff;
    } catch (error) {
      return 0;
    }
  },

  calculateWeeksDifference(oldTimeString, newTimeString) {
    const days = this.calculateDaysDifference(
      oldTimeString,
      newTimeString,
    );
    return Math.floor(days / 7);
  },

  isTimeProgressing(oldTimeString, newTimeString) {
    return (
      this.calculateMonthsDifference(
        oldTimeString,
        newTimeString,
      ) > 0
    );
  },

  // --- 4. 收益计算引擎 (原 CapitalReturnCalculator) ---
  // --- 替换 收益计算引擎中的 calculateIndustryReturn ---
  calculateIndustryReturn(
    capitalStr,
    periodRate,
    periods,
    industry = {},
  ) {
    try {
      const { value: capital, currency } =
        this.parseCurrency(capitalStr);
      if (capital <= 0 || periods <= 0)
        return this.formatCurrency(0, currency);
      if (periods > 2400) periods = 2400;

      const saturation = Math.max(
        0,
        Math.min(100, industry.市场饱和度 || 30),
      );
      const marketFactor = 0.5 + (saturation - 10) / 90;

      // [新增修复] 规模边际递减效应
      let scalePenalty = 1;
      if (capital > 10000) {
        scalePenalty = Math.max(
          0.5,
          1 - Math.log10(capital / 10000) * 0.1,
        );
      }

      const techIndex = Math.max(
        -200,
        Math.min(1000, industry.技术先进指数 || 0),
      );
      let techPotential =
        techIndex <= 0
          ? 1 - 0.0000125 * techIndex * techIndex
          : 1 + 0.000002 * techIndex * techIndex;
      techPotential = Math.max(0.1, Math.min(techPotential, 100));

      const efficiency = Math.max(
        0,
        Math.min(100, industry.运营效率 || 50),
      );
      const costMultiplier = 2 - efficiency / 100;
      const monthlyFixedCostRate = Math.max(
        0,
        industry.固定成本率 || 5,
      );
      const weeklyFixedCostRate = monthlyFixedCostRate / 4;

      let rate = periodRate / 100;
      if (Math.abs(rate) > 0.5) rate = rate > 0 ? 0.5 : -0.5;

      // 结算回报率同时受市场和规模限制
      const adjustedRate = rate * marketFactor * scalePenalty;

      const baseMultiplier = Math.pow(1 + adjustedRate, periods);

      if (baseMultiplier > 1000)
        return this.formatCurrency(capital * 1000, currency);

      const baseGrossCapital = capital * baseMultiplier;
      const baseProfit = baseGrossCapital - capital;

      let adjustedProfit;
      if (baseProfit >= 0) {
        adjustedProfit = baseProfit * techPotential;
      } else {
        adjustedProfit = baseProfit / techPotential;
      }

      const totalFixedCost =
        capital *
        (weeklyFixedCostRate / 100) *
        costMultiplier *
        periods;
      const newCapital = Math.max(
        0,
        capital + adjustedProfit - totalFixedCost,
      );

      return this.formatCurrency(newCapital, currency);
    } catch (error) {
      const { currency } = this.parseCurrency(capitalStr);
      return this.formatCurrency(0, currency);
    }
  },

  // --- [新增] 核心性能评估器 (收束所有经济公式，杜绝两套账本) ---
  // --- 替换 核心性能评估器 evaluateMonthlyPerformance ---
  evaluateMonthlyPerformance(industry) {
    const { value: capital, currency } = this.parseCurrency(
      industry.当前投入资本总额 || "0",
    );
    const iConf = typeof GameDBManager !== 'undefined' ? GameDBManager.DB.industryConfig : null;
    const formulas = iConf?.formulas || {};
    const thresholds = iConf?.scaleThresholds || { medium: 5000, large: 50000 };
    
    let newScale = '小型';
    if (capital >= thresholds.large) newScale = '大型';
    else if (capital >= thresholds.medium) newScale = '中型';
    if (industry.规模 !== newScale) {
      industry.规模 = newScale;
    }
    const baseRate = industry.月均资本回报率 || 0;

    // 1. 市场饱和度
    const saturation = Math.max(
      0,
      Math.min(100, industry.市场饱和度 || 30),
    );
    const marketFactor = (formulas.marketFactorBase || 0.5) + (saturation - (formulas.marketFactorOffset || 10)) / (formulas.marketFactorDivisor || 90);

    //[新增修复] 2. 规模边际递减效应 (防数值爆炸)
    let scalePenalty = 1;
    const penaltyBase = formulas.scalePenaltyBase || 10000;
    if (capital > penaltyBase) {
      scalePenalty = Math.max(
        0.5,
        1 - Math.log10(capital / penaltyBase) * (formulas.scalePenaltyCoeff || 0.1),
      );
    }

    // 最终实际回报率 (叠加市场饱和与规模惩罚)
    const actualRate = baseRate * marketFactor * scalePenalty;

    // 3. 技术先进度
    const techIndex = Math.max(
      -200,
      Math.min(1000, industry.技术先进指数 || 0),
    );
    let techPotential =
      techIndex <= 0
        ? 1 - (formulas.techNegativeCoeff || 0.0000125) * techIndex * techIndex
        : 1 + (formulas.techPositiveCoeff || 0.000002) * techIndex * techIndex;
    techPotential = Math.max(0.1, Math.min(techPotential, 100)); // 防除零

    // 4. 毛利润 (包含之前的高科技抗风险逻辑)
    const baseGrossProfit = capital * (actualRate / 100);
    let grossProfit;
    if (baseGrossProfit >= 0) {
      grossProfit = baseGrossProfit * techPotential;
    } else {
      grossProfit = baseGrossProfit / techPotential;
    }

    // 5. 运营效率与固定成本
    const efficiency = Math.max(
      0,
      Math.min(100, industry.运营效率 || 50),
    );
    const costMultiplier = (formulas.costMultiplierBase || 2) - efficiency / (formulas.costMultiplierDivisor || 100);
    const fixedCostRate = Math.max(0, industry.固定成本率 || 5);
    const actualFixedCost =
      capital * (fixedCostRate / 100) * costMultiplier;

    // 6. 净收益
    const monthlyReturn = grossProfit - actualFixedCost;

    return {
      capital,
      currency,
      baseRate,
      actualRate,
      saturation,
      marketFactor,
      scalePenalty,
      techIndex,
      techPotential,
      efficiency,
      costMultiplier,
      fixedCostRate,
      actualFixedCost,
      grossProfit,
      monthlyReturn,
    };
  },

  // --- 5. 产业数据管理 (原 IndustryManager 的 CRUD) ---
  // --- 替换 5. 产业数据管理中的 loadFromGameData ---
  loadFromGameData() {
    try {
      const statData = this.app.currentMvuState?.stat_data;
      if (!statData) return;
      if (!statData.产业)
        statData.产业 = {
          $meta: { 总估值: "0", 上次计算时间: "" },
        };

      this.industries = {};
      const currentGameTime = this.app.currentMvuState?.world_data?.当前时间纪元 || statData.当前时间纪元 || "";

      let migratedCount = 0;
      for (const [key, value] of Object.entries(statData.产业)) {
        if (key === "$meta") {
          this.metadata = value || this.metadata;
          continue;
        }
        this.industries[key] = value;

        // [修复] 已移除危险的资本强制翻倍修复逻辑，避免误伤低价值产业。
        // 仅保留必要的时间字段数据迁移：
        if (!value.创建时间) {
          value.创建时间 = currentGameTime;
          migratedCount++;
        }
        if (!value.上次结算时间) {
          value.上次结算时间 =
            value.创建时间 || currentGameTime;
          migratedCount++;
        }
      }

      if (migratedCount > 0) {
        console.log(
          `[产业引擎] 数据迁移完成：更新了 ${migratedCount} 个产业的时间戳`,
        );
        this._saveToGameData();
      }
      this._rebuildValuationCache();
      this._invalidateStatsCache();
    } catch (error) {
      console.error("[产业引擎] 加载数据失败:", error);
    }
  },

  getAllIndustries() {
    return { ...this.industries };
  },

  addIndustry(id, industry) {
    try {
      if (!id) {
        const ts = Date.now();
        const rnd = Math.floor(Math.random() * 1000000);
        this._idCounter++;
        id = `industry_${ts}_${rnd}_${this._idCounter}`;
      }
      const currentGameTime =
        this.app.currentMvuState?.world_data?.当前时间纪元 ||
        this.app.currentMvuState?.stat_data?.当前时间纪元 || "";
      industry.创建时间 = industry.创建时间 || currentGameTime;
      industry.上次结算时间 =
        industry.上次结算时间 || currentGameTime;

      this.industries[id] = industry;
      this._incrementalUpdateValuation(industry, "add");
      this._invalidateStatsCache();
      this._saveToGameData();

      if (this.app.showTemporaryMessage)
        this.app.showTemporaryMessage(
          `✅ 成功添加产业：${industry.名称}`,
        );
      return id;
    } catch (error) {
      if (this.app.showTemporaryMessage)
        this.app.showTemporaryMessage(
          `❌ 添加产业失败：${error.message}`,
        );
      throw error;
    }
  },

  removeIndustry(id) {
    try {
      if (!this.industries[id]) return false;
      const industry = this.industries[id];
      this._incrementalUpdateValuation(industry, "remove");
      delete this.industries[id];
      this._invalidateStatsCache();
      this._saveToGameData();

      if (this.app.showTemporaryMessage)
        this.app.showTemporaryMessage(
          `✅ 已删除产业：${industry.名称}`,
        );
      return true;
    } catch (error) {
      return false;
    }
  },

  // --- 替换 5. 产业数据管理中的 updateIndustry ---
  updateIndustry(id, updates) {
    try {
      if (!this.industries[id]) return false;

      // 合并更新
      this.industries[id] = {
        ...this.industries[id],
        ...updates,
      };

      // [修复] 放弃局部的增量估值判断，统一强制全局重建，确保数据 100% 绝对一致
      this._rebuildValuationCache();
      this._invalidateStatsCache();
      this._saveToGameData();

      return true;
    } catch (error) {
      return false;
    }
  },

  calculateTotalValuation() {
    try {
      const industries = Object.values(this.industries);
      if (industries.length === 0) {
        this.metadata.总估值 = "0";
        return "0";
      }
      const currencyGroups = {};
      for (const ind of industries) {
        const parsed = this.parseCurrency(
          ind.当前投入资本总额 || "0 金镑",
        );
        if (!currencyGroups[parsed.currency])
          currencyGroups[parsed.currency] = 0;
        currencyGroups[parsed.currency] += parsed.value;
      }
      const totalStr = Object.entries(currencyGroups)
        .map(([c, v]) => this.formatCurrency(v, c))
        .join(", ");
      this.metadata.总估值 = totalStr;
      return totalStr;
    } catch (error) {
      return "0";
    }
  },

  updateTotalValuationMetadata() {
    this.calculateTotalValuation();
    this._saveToGameData();
  },

   _saveToGameData() {
    if (!this.app.currentMvuState?.stat_data) return;
    this.app.currentMvuState.stat_data.产业 = {
      ...this.industries,
      $meta: this.metadata,
    };

    const prod = {
      "1级农产品": 0, "2级农产品": 0, "3级农产品": 0, "4级农产品": 0, "5级农产品": 0,
      "1级工业品": 0, "2级工业品": 0, "3级工业品": 0, "4级工业品": 0, "5级工业品": 0,
      "1级服务": 0, "2级服务": 0, "3级服务": 0, "4级服务": 0, "5级服务": 0
    };
    const iConf = typeof GameDBManager !== 'undefined' ? GameDBManager.DB.industryConfig : null;
    const typeMap = iConf?.typeMapping || { '第一产业': '农产品', '第二产业': '工业品', '第三产业': '服务', '独立领地': '农产品' };
    const conv = iConf?.productionConversion || { '1级': 1, '2级': 5, '3级': 10, '4级': 50, '5级': 100 };

    Object.values(this.industries).forEach(ind => {
      const pType = typeMap[ind.类型] || '农产品';

      const perf = this.evaluateMonthlyPerformance(ind);
      const income = Math.max(0, perf.monthlyReturn);
      if (income > 0) {
        const a1 = ind.生产分配_1级 !== undefined ? ind.生产分配_1级 : 100;
        const a2 = ind.生产分配_2级 || 0;
        const a3 = ind.生产分配_3级 || 0;
        const a4 = ind.生产分配_4级 || 0;
        const a5 = ind.生产分配_5级 || 0;

        prod[`1级${pType}`] += Math.floor((income * (a1/100)) / (conv['1级'] || 1));
        prod[`2级${pType}`] += Math.floor((income * (a2/100)) / (conv['2级'] || 5));
        prod[`3级${pType}`] += Math.floor((income * (a3/100)) / (conv['3级'] || 10));
        prod[`4级${pType}`] += Math.floor((income * (a4/100)) / (conv['4级'] || 50));
        prod[`5级${pType}`] += Math.floor((income * (a5/100)) / (conv['5级'] || 100));
      }
    });
    this.app.currentMvuState.stat_data.生产力 = prod;

    // 静默落盘：确保玩家在界面修改比例后，即便不聊天直接刷新页面也能保留产能数据
    if (this.app.chatHistoryCache && this.app.chatHistoryCache.length > 0) {
      const lastSnap = this.app.chatHistoryCache[this.app.chatHistoryCache.length - 1];
      if (lastSnap && lastSnap.data) {
        lastSnap.data = JSON.parse(JSON.stringify(this.app.currentMvuState));
        if (typeof AppStorage !== 'undefined') {
          AppStorage.saveData(this.app._getHistoryKey(), this.app.chatHistoryCache).catch(()=>{});
        }
      }
    }
  },

  _incrementalUpdateValuation(industry, operation) {
    try {
      const { value, currency } = this.parseCurrency(
        industry.当前投入资本总额 || "0",
      );
      if (operation === "add")
        this.valuationCache[currency] =
          (this.valuationCache[currency] || 0) + value;
      else if (operation === "remove") {
        this.valuationCache[currency] =
          (this.valuationCache[currency] || 0) - value;
        if (this.valuationCache[currency] <= 0)
          delete this.valuationCache[currency];
      }
      const totalStr = Object.entries(this.valuationCache)
        .filter(([_, v]) => v > 0)
        .map(([c, v]) => this.formatCurrency(v, c))
        .join(", ");
      this.metadata.总估值 = totalStr || "0";
    } catch (error) {
      this._rebuildValuationCache();
    }
  },

  _rebuildValuationCache() {
    try {
      this.valuationCache = {};
      const industries = Object.values(this.industries);
      for (const ind of industries) {
        const { value, currency } = this.parseCurrency(
          ind.当前投入资本总额 || "0",
        );
        this.valuationCache[currency] =
          (this.valuationCache[currency] || 0) + value;
      }
      const totalStr = Object.entries(this.valuationCache)
        .filter(([_, v]) => v > 0)
        .map(([c, v]) => this.formatCurrency(v, c))
        .join(", ");
      this.metadata.总估值 = totalStr || "0";
    } catch (error) {
      this.metadata.总估值 = "0";
    }
  },

  getStatistics() {
    if (this.statsCacheValid && this.statsCache)
      return this.statsCache;
    const industries = Object.values(this.industries);
    const stats = {
      count: industries.length,
      totalValuation: this.metadata.总估值,
      monthlyReturnByCurrency: {},
      avgRate: 0,
    };

    if (industries.length === 0) {
      this.statsCache = stats;
      this.statsCacheValid = true;
      return stats;
    }

    let totalRate = 0;
    for (const ind of industries) {
      // 【精简】：直接调用底层评估器，无需重写公式
      const perf = this.evaluateMonthlyPerformance(ind);

      if (!stats.monthlyReturnByCurrency[perf.currency])
        stats.monthlyReturnByCurrency[perf.currency] = 0;
      stats.monthlyReturnByCurrency[perf.currency] +=
        perf.monthlyReturn;
      totalRate += perf.baseRate;
    }
    stats.avgRate = (totalRate / stats.count).toFixed(2);
    this.statsCache = stats;
    this.statsCacheValid = true;
    return stats;
  },

  _invalidateStatsCache() {
    this.statsCacheValid = false;
  },
},


