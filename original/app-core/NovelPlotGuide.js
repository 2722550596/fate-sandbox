// 文件: NovelPlotGuide.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L22703-23556: // ========================================== ---

// ==========================================
// === 【原著剧情指引系统】 智能日期嗅探与展示 ===
// ==========================================
async showOriginalPlotGuide() {
  this.showTemporaryMessage("正在翻阅命运的轨迹，寻找原著时间线...");

  // 1. 解析当前日期
  const currentTimeEra = this.currentMvuState?.world_data?.当前时间纪元 || this.currentMvuState?.stat_data?.当前时间纪元 || "";
  if (!currentTimeEra) {
    this.showTemporaryMessage("当前日期未知，无法检索时间线。");
    return;
  }

  // 提取当前的 年、月、日，转化为绝对数值以供比对 (例: 13490628)
  const match = currentTimeEra.match(/(\d+)年(\d+)月(\d+)日/);
  if (!match) {
    this.showTemporaryMessage("当前日期格式无法识别，无法进行精确检索。");
    return;
  }

  const currentYear = parseInt(match[1], 10);
  const currentMonth = parseInt(match[2], 10);
  const currentDay = parseInt(match[3], 10);
  const currentDateVal = currentYear * 10000 + currentMonth * 100 + currentDay;

  // 2. 遍历所有世界书，寻找匹配的条目
  const matchingEntries = [];
  try {
    const allWbNames = typeof getWorldbookNames === 'function' ? getWorldbookNames() : [];
    if (allWbNames.length === 0) {
       this.showTemporaryMessage("未检测到任何世界书。");
       return;
    }

    // 预检：是否存在名称包含"原著"二字、且非源堡主/副库的世界书
    const originalWbList = allWbNames.filter(n =>
      n.includes("原著") &&
      n !== WorldbookManager.PRIMARY_BOOK &&
      n !== WorldbookManager.LIBRARY_BOOK
    );
    if (originalWbList.length === 0) {
      this.showTemporaryMessage("未检测到任何世界书的名字中包含\"原著\"字样的世界书，无法检索原著时间线，请检查是否正确导入了原著时间线世界书。");
      return;
    }

    // 扫描所有附加的世界书
    for (const wbName of allWbNames) {
      // 跳过系统专用的源堡主库与副库，大幅提高扫描速度
      if (wbName === WorldbookManager.PRIMARY_BOOK || wbName === WorldbookManager.LIBRARY_BOOK) continue;
      // 仅搜索名称包含"原著"二字的世界书
      if (!wbName.includes("原著")) continue;

      const entries = await TavernHelper.getLorebookEntries(wbName).catch(() => []);
      for (const entry of entries) {
        const name = entry.name || entry.comment || "";
        
        // 性能过滤：只有名字里包含"年"和"月"的才去进行复杂的正则解析
        if (!name.includes("年") && !name.includes("月")) continue;

        const range = this._parseEntryDateRange(name);
        
        // 核心判定：如果当前日期落在这个世界书条目的区间内，则打捞它！
        if (range && currentDateVal >= range.start && currentDateVal <= range.end) {
          matchingEntries.push({
            worldbook: wbName,
            name: name,
            content: entry.content
          });
        }
      }
    }
  } catch (e) {
    console.error("检索原著时间线出错:", e);
    this.showTemporaryMessage("检索失败，请检查控制台报错。");
    return;
  }

  // 3. 渲染结果弹窗
  this._renderOriginalPlotModal(currentTimeEra, matchingEntries);
},

// 智能日期范围解析器 (支持单日、年月统括、中划线区间等所有格式)
_parseEntryDateRange(entryName) {
  // 清理掉后面跟着的备注，如 "（第一卷：起始）"
  let cleanName = entryName.replace(/[（\(].*?[）\)]/g, '').trim();
  
  // 以各种可能的分隔符切分区间
  let parts = cleanName.split(/[-~—至]/);

  const parsePart = (str, defaultYear, defaultMonth) => {
    let year = defaultYear;
    let month = defaultMonth;
    let day = null;
    const yMatch = str.match(/(\d+)年/);
    if (yMatch) year = parseInt(yMatch[1], 10);
    const mMatch = str.match(/(\d+)月/);
    if (mMatch) month = parseInt(mMatch[1], 10);
    const dMatch = str.match(/(\d+)日/);
    if (dMatch) day = parseInt(dMatch[1], 10);
    return { year, month, day };
  };

  let start = null;
  let end = null;

  if (parts.length === 1) {
    let d = parsePart(parts[0], null, null);
    if (!d.year || !d.month) return null; // 无法解析出年月，跳过
    // 单个日期，如果没有日，默认覆盖整月 (如 1349年6月 -> 13490601 到 13490631)
    start = d.year * 10000 + d.month * 100 + (d.day || 1);
    end = d.year * 10000 + d.month * 100 + (d.day || 31);
  } else if (parts.length >= 2) {
    let d1 = parsePart(parts[0], null, null);
    if (!d1.year && !d1.month) return null;
    
    // 区间的后半部分可以继承前半部分的年份和月份 (如 1349年1-5月28日)
    let d2 = parsePart(parts[1], d1.year, d1.month);
    
    start = d1.year * 10000 + (d1.month || 1) * 100 + (d1.day || 1);
    end = d2.year * 10000 + (d2.month || d1.month) * 100 + (d2.day || 31);
  }

  return { start, end };
},

// 原著剧情指引弹窗渲染
_renderOriginalPlotModal(currentDateStr, entries) {
  const modalId = "original-plot-modal";
  let modal = document.getElementById(modalId);
  if (modal) modal.remove();

  modal = document.createElement("div");
  modal.id = modalId;
  modal.className = "modal-overlay";
  modal.style.cssText = "display: flex; z-index: 10005;"; // 极高层级

  let contentHtml = "";
  if (entries.length === 0) {
    // 平静的一天
    contentHtml = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-style: italic; opacity: 0.8; gap: 15px; padding: 40px 20px; text-align: center;">
        <div style="font-size: 45px; filter: grayscale(0.5);">🕊️</div>
        <div style="font-family: 'Georgia', serif; letter-spacing: 1px; line-height: 1.8;">在这命运的长河中，今日似乎是平静的一天。<br>原著时间线中并没有记录下重大的波澜...</div>
      </div>
    `;
  } else {
    // 渲染所有匹配的剧情块
    contentHtml = `<div style="display: flex; flex-direction: column; gap: 18px; padding: 10px 5px;">`;
    entries.forEach(entry => {
      contentHtml += `
        <div style="background: linear-gradient(145deg, rgba(30, 25, 20, 0.9) 0%, rgba(15, 12, 10, 0.8) 100%); border: 1px solid rgba(218, 165, 32, 0.3); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
          <div style="background: rgba(0,0,0,0.4); padding: 12px 15px; border-bottom: 1px solid rgba(218, 165, 32, 0.15); display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #ffd700; font-family: 'Georgia', serif; font-size: 16px; letter-spacing: 1px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">${this.safeEscapeHtml(entry.name)}</strong>
            <span style="font-size: 11px; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">来自: ${this.safeEscapeHtml(entry.worldbook)}</span>
          </div>
          <div style="padding: 18px; font-size: var(--text-sm); color: #dcd5c7; line-height: 1.8; text-align: justify; white-space: pre-wrap; font-family: var(--font-serif);">${this.safeEscapeHtml(entry.content)}</div>
        </div>
      `;
    });
    contentHtml += `</div>`;
  }

  // 套用高级的黑金流光外壳
  modal.innerHTML = `
    <div class="modal-content" style="width: 90%; max-width: 850px; height: 80vh; max-height: 750px; display: flex; flex-direction: column; background-color: rgba(18, 15, 12, 0.98); background-image: url('data:image/svg+xml,%3Csvg viewBox=\\'0 0 200 200\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cfilter id=\\'noiseFilter\\'%3E%3CfeTurbulence type=\\'fractalNoise\\' baseFrequency=\\'0.8\\' numOctaves=\\'3\\' stitchTiles=\\'stitch\\'/%3E%3C/filter%3E%3Crect width=\\'100%25\\' height=\\'100%25\\' filter=\\'url(%23noiseFilter)\\' opacity=\\'0.05\\'/%3E%3C/svg%3E'); border: 1px solid rgba(218, 165, 32, 0.4); box-shadow: 0 10px 40px rgba(0,0,0,0.9), inset 0 0 30px rgba(218, 165, 32, 0.08);">
      <div class="modal-header" style="border-bottom: 1px solid rgba(218, 165, 32, 0.2); padding: 16px 20px;">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <h2 class="modal-title" style="color: #C9B485; margin: 0; font-family: 'Georgia', serif; font-size: 22px; text-shadow: 0 0 10px rgba(218, 165, 32, 0.3); letter-spacing: 2px;">📜 原著剧情指引</h2>
          <div style="font-size: 12px; color: var(--text-muted);">当前时空: <span style="color: var(--color-info); font-weight: bold;">${currentDateStr}</span></div>
        </div>
        <button class="modal-close-btn" style="color: #a48b57; font-size: 28px; transition: color 0.2s;" onmouseover="this.style.color='#ffd700'" onmouseout="this.style.color='#a48b57'" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px;">
        ${contentHtml}
      </div>
    </div>
  `;

  this.mountModalToTopLayer(modal);
},

//窗口控制
openModal(modalId, keepOpen = false) {
  if (!keepOpen) {
    this.closeAllModals();
  }

  let modal;
  if (
    window.PerformanceOptimizer &&
    window.PerformanceOptimizer.domCache
  ) {
    modal = window.PerformanceOptimizer.domCache.get(
      modalId,
      `#${modalId}`,
    );
  } else {
    modal = document.getElementById(modalId);
  }

  if (modal) {
    const fullscreenEl =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    if (fullscreenEl && modal.parentNode !== fullscreenEl) {
      fullscreenEl.appendChild(modal);
    } else if (
      !fullscreenEl &&
      modal.parentNode !== document.body
    ) {
      document.body.appendChild(modal);
    }

    modal.style.display = "flex";

    if (keepOpen) {
      const highestZ = Array.from(
        document.querySelectorAll(".modal-overlay"),
      )
        .filter(
          (el) =>
            el.style.display === "flex" &&
            el.id !== modalId,
        )
        .reduce((maxZ, el) => {
          // 🔥 核心修复：安全解析 Z-index，拦截 "auto" 和 NaN
          const zString = window.getComputedStyle(el).zIndex;
          const zNum = parseInt(zString, 10);
          // 如果 zNum 是 NaN（说明原本是 auto），则以 1000 为底数
          const safeZ = isNaN(zNum) ? 1000 : zNum;
          return Math.max(maxZ, safeZ);
        }, 1000);

      const baseZ = fullscreenEl ? 2147483000 : highestZ;
      modal.style.zIndex = baseZ + 1;
    } else {
      modal.style.zIndex = fullscreenEl ? "2147483000" : "1000"; // 给予默认的非 keepOpen z-index
    }
  }
},
//关闭窗口 (纯净版，移除所有业务逻辑)
closeAllModals() {
  const modals =
    window.PerformanceOptimizer &&
    window.PerformanceOptimizer.domCache
      ? window.PerformanceOptimizer.domCache.getAll(
          "all-modals",
          ".modal-overlay",
        )
      : document.querySelectorAll(".modal-overlay");

  modals.forEach((modal) => {
    modal.style.display = "none";
  });
},
//确认/取消窗口
showConfirmModal(message, onConfirm = null, onCancel = null) {
  // 返回一个 Promise
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const messageEl = document.getElementById(
      "confirm-message",
    );
    const okBtn = document.getElementById("confirm-btn-ok");
    const cancelBtn = document.getElementById(
      "confirm-btn-cancel",
    );
    // 新增：获取关闭按钮
    const closeBtn = document.getElementById("confirm-btn-close");

    if (!modal || !messageEl || !okBtn || !cancelBtn) {
      resolve(false); // 安全处理
      return;
    }

    messageEl.innerHTML = message;

    // 移除旧事件 (使用 cloneNode 是一种朴素有效的方法)
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // 确定按钮
    newOkBtn.addEventListener("click", () => {
      // 【修复核心 3：仅关闭确认框，保护底层弹窗】
      modal.style.display = "none";

      // 1. 执行旧的回调（如果存在）
      if (typeof onConfirm === "function") onConfirm();
      // 2. Resolve Promise 为 true
      resolve(true);
    });

    // 新增：处理关闭按钮的替换和事件绑定
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    // 提取一个统一的取消逻辑
    const handleCancel = () => {
      modal.style.display = "none";
      if (typeof onCancel === "function") onCancel();
      resolve(false);
    };

    // 取消按钮和关闭按钮都绑定这个逻辑
    newCancelBtn.addEventListener("click", handleCancel);
    newCloseBtn.addEventListener("click", handleCancel);

    // 【修复核心 4：必须传入 true！】
    // 确保打开确认框时，作为“子弹窗”叠加，而不是把后面的主面板全关掉
    this.openModal("confirm-modal", true);
  });
},
//输入窗口
showPromptModal(title, messageHtml, defaultValue = "", inputType = "text", extraAttr = "", options = {}) {
  return new Promise((resolve) => {
    // 提取配置项，赋予默认值
    const {
      showSlider = false,        // 是否显示拖动滑块
      sliderMin = 1,             // 滑块最小值
      sliderMax = 100,           // 滑块最大值
      confirmClass = "interaction-btn primary-btn", // 确认按钮样式 (默认primary，丢弃物品时可传入 danger-btn)
      customButtons = []         // 自定义额外按钮数组，例如：[{ text: "全部", className: "...", resolveValue: 99 }]
    } = options;

    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.style.cssText = "display: flex; z-index: 2000;";

    // 生成自定义按钮的 HTML
    const customBtnsHtml = customButtons.map((btn, index) => 
      `<button id="custom-prompt-btn-${index}" class="${btn.className || 'interaction-btn'}">
        ${btn.text}
      </button>`
    ).join('');

    // 融合了精良排版的 HTML 模板
    modal.innerHTML = /* HTML */ `
      <div class="modal-content" style="width: 450px; height: auto; max-height: none;">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <div class="modal-prompt-text" style="margin-bottom: 15px; color: var(--text-subtle); line-height: 1.5;">
            ${messageHtml}
          </div>
          
          <div class="setting-control" style="margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px;">
            ${showSlider ? 
              `<input type="range" id="custom-prompt-slider" class="font-slider" min="${sliderMin}" max="${sliderMax}" value="${defaultValue}" style="width: 100%;" />` 
              : ""}
            <input
              type="${inputType}"
              id="custom-prompt-input"
              class="modal-input ${showSlider ? 'center-input' : ''}"
              value="${defaultValue}"
              style="width: 100%; box-sizing: border-box;"
              ${extraAttr}
            />
          </div>

          <div class="modal-footer-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="custom-prompt-cancel" class="interaction-btn">取消</button>
            ${customBtnsHtml}
            <button id="custom-prompt-confirm" class="${confirmClass}">确认</button>
          </div>
        </div>
      </div>
    `;
    
    this.mountModalToTopLayer(modal);

    const input = modal.querySelector("#custom-prompt-input");
    const slider = modal.querySelector("#custom-prompt-slider");
    const confirmBtn = modal.querySelector("#custom-prompt-confirm");
    const cancelBtn = modal.querySelector("#custom-prompt-cancel");

    const closeModal = () => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };

    // 绑定滑块与输入框的同步联动
    if (showSlider && slider) {
      const syncValues = (source, target) => { target.value = source.value; };
      slider.addEventListener("input", () => syncValues(slider, input));
      input.addEventListener("input", () => syncValues(input, slider));
    }

    // 绑定自定义按钮事件
    customButtons.forEach((btn, index) => {
      const btnEl = modal.querySelector(`#custom-prompt-btn-${index}`);
      if (btnEl) {
        btnEl.addEventListener("click", () => {
          closeModal();
          resolve(String(btn.resolveValue)); // 点击额外按钮时，直接返回预设的值
        });
      }
    });

    // 确认
    confirmBtn.addEventListener("click", () => {
      closeModal();
      resolve(input.value);
    });

    // 取消
    cancelBtn.addEventListener("click", () => {
      closeModal();
      resolve(null);
    });

    // 回车键确认
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        closeModal();
        resolve(input.value);
      }
    });

    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  });
},

//----个性化设置----
// 【新增】应用主题模式
applyTheme(isLight) {
  const root = document.documentElement;
  if (isLight) {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }

  // 💡 新增：向全局广播主题变更事件
  // 这样雷达图、Echarts 或其他强依赖 JS 颜色的组件就可以监听此事件并主动重绘
  window.dispatchEvent(
    new CustomEvent("theme-changed", {
      detail: { isLight: isLight },
    }),
  );
},
async saveThemeState() {
  await AppStorage.saveData("is_light_theme", this.isLightTheme);
},
// 加载主题设置 (包含 OS 级偏好检测)
async loadThemeState() {
  // 核心逻辑：优先读取用户手动保存的设置。
  // 如果是第一次访问（无存档），则侦听操作系统的亮暗模式偏好。
  const systemPrefersLight =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches;

  // loadData 的第二个参数是默认值
  this.isLightTheme = await AppStorage.loadData(
    "is_light_theme",
    systemPrefersLight,
  );

  // 应用主题
  this.applyTheme(this.isLightTheme);

  // （可选）监听系统主题的实时变化：如果用户没有手动覆盖过，可以跟随系统切换
  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: light)")
      .addEventListener("change", async (e) => {
        // 只有当你想强制应用系统更改时才写这行，通常最好尊重用户的最后一次手动选择
        // this.isLightTheme = e.matches;
        // this.applyTheme(this.isLightTheme);
        // await this.saveThemeState();
      });
  }
},
// 【升级】字体控制：直接劫持底层 CSS 变量，实现真正的全局一致
applyFont(fontClass) {
  // 1. 获取配置数据
  const fontRegistry = GameDBManager.DB.fontConfig || {};
  const fontData = fontRegistry[fontClass] || fontRegistry["font-serif"] || { css: "serif", isArt: false };
  
  const targetFontFamily = fontData.css;
  const isArtFont = fontData.isArt;

  // ==========================================
  // ✨ 核心修复：按需动态挂载字体文件（热加载，立即生效）
  // ==========================================
  const loadFontAsset = () => {
    // 方案 A：如果是外部链接 (如 Google Fonts)
    if (fontData.url) {
      const linkId = `game-font-link-${fontClass}`;
      // 检查是否已经加载过，防止重复插入
      if (!document.getElementById(linkId)) {
        const linkEl = document.createElement("link");
        linkEl.id = linkId;
        linkEl.rel = "stylesheet";
        linkEl.href = fontData.url;
        document.head.appendChild(linkEl);
        console.log(`[外观美化] 正在热加载字体样式表: ${fontData.name}`);
      }
    }
    
    // 方案 B：如果是玩家手写的自定义 @font-face 规则
    if (fontData.customCSS) {
      const styleId = `game-font-style-${fontClass}`;
      if (!document.getElementById(styleId)) {
        const styleEl = document.createElement("style");
        styleEl.id = styleId;
        styleEl.textContent = fontData.customCSS;
        document.head.appendChild(styleEl);
        console.log(`[外观美化] 正在注入自定义字体规则: ${fontData.name}`);
      }
    }
  };

  // 执行加载动作
  loadFontAsset();

  // ==========================================
  // 2. 暴力接管系统 CSS 变量
  // ==========================================
  const root = document.documentElement.style;

  root.setProperty("--main-font-family", targetFontFamily);
  root.setProperty("--font-serif", targetFontFamily);
  root.setProperty("--font-sans", targetFontFamily);

  if (isArtFont) {
    root.setProperty("--font-display", targetFontFamily);
  } else {
    // 标题字体兜底
    const fallbackArtFont = Object.values(fontRegistry).find(f => f.isArt)?.css 
                         || '"Ma Shan Zheng", "Zhi Mang Xing", cursive, serif';
    root.setProperty("--font-display", fallbackArtFont);
  }

  this.currentFontClass = fontClass;
},
async saveFont(fontClass) {
  // 只存储有效字符串，防止意外存储非字符串类型
  if (typeof fontClass === "string" && /^[\w-]+$/.test(fontClass)) {
    await AppStorage.saveData("custom_font_class", fontClass);
  } else {
    console.warn(`拒绝存储无效字体类名: ${fontClass}`);
    // 存储默认值，避免下次加载到非法数据
    await AppStorage.saveData(
      "custom_font_class",
      "font-noto-serif-sc",
    );
  }
},
async loadFont() {
  // 从存储加载，强制转为字符串（防止存储了非字符串类型）
  const savedFont = await AppStorage.loadData(
    "custom_font_class",
    "font-noto-serif-sc",
  );
  const fontClass =
    typeof savedFont === "string"
      ? savedFont
      : "font-noto-serif-sc";
  this.applyFont(fontClass); // 传入确保是字符串
},
// 应用字体大小到UI (彻底重构)
applyFontSize(size) {
  // 确保传入的是数字
  const numSize = parseInt(size, 10);
  if (isNaN(numSize)) return;

  // 直接修改 CSS 变量中的数字锚点，引擎会自动重算 xs 到 xl 的所有像素值
  document.documentElement.style.setProperty(
    "--text-base-size",
    numSize,
  );

  this.fontSize = numSize;
},
// 保存字体大小设置
async saveFontSize() {
  await AppStorage.saveData("font_size", this.fontSize);
},
// 加载并应用字体大小设置
async loadFontSize() {
  const savedSize = await AppStorage.loadData("font_size", 14); // 默认14px
  this.applyFontSize(savedSize);
},

// 背景控制
applyBackground(backgroundId) {
  const root = document.querySelector(".game-root-container");
  if (!root) return;

  if (backgroundId === "default" || !backgroundId) {
    this.applyRandomBackground();
    return;
  }

  let bgUrl = "";
  // 1. 寻找背景图URL的逻辑不变
  const customBg = this.customBackgrounds.find((bg) => bg.id === backgroundId);
  if (customBg) {
    bgUrl = customBg.data;
  } else if (GameDBManager.DB.backgrounds && GameDBManager.DB.backgrounds.includes(backgroundId)) {
    bgUrl = backgroundId;
  }

  if (bgUrl) {
    // --- 【核心修改区：双层交替淡入淡出逻辑】 ---
    
    // 检查并动态创建两个背景层（如果还没有的话）
    let bgLayer1 = document.getElementById("game-bg-layer-1");
    let bgLayer2 = document.getElementById("game-bg-layer-2");

    if (!bgLayer1) {
      bgLayer1 = document.createElement("div");
      bgLayer1.id = "game-bg-layer-1";
      bgLayer1.className = "game-bg-layer active"; // 默认1为激活态
      root.prepend(bgLayer1); // 塞到 root 容器的最前面

      bgLayer2 = document.createElement("div");
      bgLayer2.id = "game-bg-layer-2";
      bgLayer2.className = "game-bg-layer";
      root.prepend(bgLayer2);
    }

    // 判断当前哪层是亮的，哪层是暗的
    const activeLayer = bgLayer1.classList.contains("active") ? bgLayer1 : bgLayer2;
    const nextLayer = bgLayer1.classList.contains("active") ? bgLayer2 : bgLayer1;

    // 如果新图和当前正亮着的图是一模一样的，就没必要过度了
    if (activeLayer.style.backgroundImage === `url("${encodeURI(bgUrl)}")` || 
        activeLayer.style.backgroundImage === `url('${encodeURI(bgUrl)}')`) {
      this.currentBackgroundId = backgroundId;
      return;
    }

    // 把新图片赋给当前暗着的图层
    nextLayer.style.backgroundImage = `url('${encodeURI(bgUrl)}')`;
    
    // 触发交替动画：暗的变亮，亮的变暗
    nextLayer.classList.add("active");
    activeLayer.classList.remove("active");

    // 更新当前记录的 ID
    this.currentBackgroundId = backgroundId;
    
    // --- 【修改区结束】 ---

  } else {
    console.warn(`未找到ID为 ${backgroundId} 的背景图，将应用随机背景。`);
    this.applyRandomBackground();
  }
},
// 随机背景
applyRandomBackground() {
  try {
    const systemBgs = GameDBManager.DB.backgrounds || [];
    // 把玩家的自定义背景也加入随机池
    const customBgIds = this.customBackgrounds.map(bg => bg.id);
    const allBgs = [...systemBgs, ...customBgIds];

    if (allBgs.length === 0) return;
    
    // 防重复机制：尽量不随机到当前正在用的图
    let randomId;
    let attempts = 0;
    do {
      randomId = allBgs[Math.floor(Math.random() * allBgs.length)];
      attempts++;
    } while (randomId === this.currentBackgroundId && allBgs.length > 1 && attempts < 5);

    this.applyBackground(randomId);
    this.saveBackgrounds(); // 随机切换后存盘
  } catch (e) {
    console.log("背景图加载失败，已跳过:", e.message);
  }
},
//导入自定义背景
handleBgImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    // 限制5MB
    this.showTemporaryMessage("图片大小不能超过 5MB。");
    return;
  }

  this.showTemporaryMessage("正在导入图片...", 2000);
  const reader = new FileReader();
  reader.onload = (e) => {
    const bgId = `bg_${Date.now()}`;
    const bgName = file.name;
    const bgData = e.target.result;

    this.customBackgrounds.push({
      id: bgId,
      name: bgName,
      data: bgData,
    });
    this.applyBackground(bgId);
    this.saveBackgrounds();
    this.showSettingsModal(); // 刷新设置面板以显示新图片
    this.showTemporaryMessage(`背景 “${bgName}” 导入成功！`);
  };
  reader.onerror = () => {
    this.showTemporaryMessage("图片读取失败！");
  };
  reader.readAsDataURL(file);
  event.target.value = ""; // 清空input，以便可以再次选择同一个文件
},
deleteCurrentBackground() {
  if (this.currentBackgroundId === "default") {
    this.showTemporaryMessage("不能删除默认背景。");
    return;
  }

  const bgName =
    this.customBackgrounds.find(
      (bg) => bg.id === this.currentBackgroundId,
    )?.name || "当前背景";

  this.showConfirmModal(`确定要删除背景 “${bgName}” 吗？`, () => {
    this.customBackgrounds = this.customBackgrounds.filter(
      (bg) => bg.id !== this.currentBackgroundId,
    );
    this.applyBackground("default"); // 恢复到默认
    this.saveBackgrounds();
    this.showSettingsModal(); // 刷新设置面板
    this.showTemporaryMessage("背景已删除。");
  });
},
// 背景预览
updateBgPreview(bgId) {
  const previewImg = document.getElementById("bg-preview-image");
  if (!previewImg) return;

  if (bgId === "default" || !bgId) {
    previewImg.src = ""; // 默认背景不预览
    return;
  }
  const bgData = this.customBackgrounds.find((bg) => bg.id === bgId);
  if (bgData) {
    previewImg.src = bgData.data;
  }
},
startAutoBgTimer() {
  this.stopAutoBgTimer(); // 启动前先清除旧的，防止多开
  if (!this.isAutoRandomBg || this.randomBgInterval <= 0) return;

  const intervalMs = this.randomBgInterval * 60 * 1000;
  this.bgTimerId = setInterval(() => {
    this.applyRandomBackground();
  }, intervalMs);
},
stopAutoBgTimer() {
  if (this.bgTimerId) {
    clearInterval(this.bgTimerId);
    this.bgTimerId = null;
  }
},
async saveBackgrounds() {
  await AppStorage.saveData("main_content_opacity", this.mainContentOpacity);
  await AppStorage.saveData("main_content_blur", this.mainContentBlur);
  await AppStorage.saveData("custom_backgrounds", this.customBackgrounds);
  await AppStorage.saveData("current_background_id", this.currentBackgroundId);
  // 新增保存定时器状态
  await AppStorage.saveData("is_auto_random_bg", this.isAutoRandomBg);
  await AppStorage.saveData("random_bg_interval", this.randomBgInterval);
},
async loadBackgrounds() {
  this.customBackgrounds = await AppStorage.loadData("custom_backgrounds", []);
  const savedId = await AppStorage.loadData("current_background_id", "default");
  this.mainContentOpacity = await AppStorage.loadData("main_content_opacity", 0.5);
  this.mainContentBlur = await AppStorage.loadData("main_content_blur", 3);
  this.applyMainContentStyle(); // 读取后立即应用

  // 新增读取定时器状态
  this.isAutoRandomBg = await AppStorage.loadData("is_auto_random_bg", false);
  this.randomBgInterval = await AppStorage.loadData("random_bg_interval", 10);

  // 验证ID合法性（兼容自定义ID和系统URL）
  const isCustom = this.customBackgrounds.some((bg) => bg.id === savedId);
  const isSystem = GameDBManager.DB.backgrounds && GameDBManager.DB.backgrounds.includes(savedId);

  if (savedId !== "default" && !isCustom && !isSystem) {
    this.currentBackgroundId = "default"; 
    this.applyRandomBackground(); // 无效ID直接随机
  } else {
    this.applyBackground(savedId);
  }

  // 加载完毕后，判断是否要启动定时器
  if (this.isAutoRandomBg) {
    this.startAutoBgTimer();
  }
},
applyMainContentStyle() {
  document.documentElement.style.setProperty('--main-content-opacity', this.mainContentOpacity);
  document.documentElement.style.setProperty('--main-content-blur', `${this.mainContentBlur}px`);
},
// --- 布局与尺寸控制 ---
applyDimensions() {
  const rootContainer = document.querySelector(
    ".game-root-container",
  );
  if (!rootContainer) return;

  if (this.isFullScreenLayout) {
    rootContainer.style.maxWidth = "100vw";
    rootContainer.style.height = "100vh";
    // 禁用滑块
    document
      .getElementById("width-slider")
      ?.setAttribute("disabled", "true");
    document
      .getElementById("height-slider")
      ?.setAttribute("disabled", "true");
  } else {
    rootContainer.style.maxWidth = this.widthSetting;
    rootContainer.style.height = this.heightSetting;
    // 启用滑块
    document
      .getElementById("width-slider")
      ?.removeAttribute("disabled");
    document
      .getElementById("height-slider")
      ?.removeAttribute("disabled");
  }
},
async saveDimensions() {
  await AppStorage.saveData("layout_dimensions", {
    width: this.widthSetting,
    height: this.heightSetting,
    isFullScreen: this.isFullScreenLayout,
  });
},
async loadDimensions() {
  const saved = await AppStorage.loadData("layout_dimensions", {
    width: "900px",
    height: "600px",
    isFullScreen: false,
  });
  this.widthSetting = saved.width;
  this.heightSetting = saved.height;
  this.isFullScreenLayout = saved.isFullScreen;
  this.applyDimensions();
},

//==============================================

