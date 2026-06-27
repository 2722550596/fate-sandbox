// 文件: MobilePerformanceOptimizer.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L9430-11737:  ---


// 主性能优化器
window.MobilePerformanceOptimizer = {
  domCache: null,
  eventManager: null,
  isMobile: /Android|iPhone|iPad/i.test(navigator.userAgent),
  isInitialized: false,

  init() {
    if (this.isInitialized) return;

    // 检查PerformanceOptimizer是否已初始化，避免重复
    if (window.PerformanceOptimizer && window.PerformanceOptimizer.initialized) {
      console.log('[MobilePerformanceOptimizer] 检测到PerformanceOptimizer已运行，跳过初始化');
      this.isInitialized = true;
      return;
    }

    this.domCache = new DOMCacheManager();
    this.domCache.init();

    this.eventManager = new OptimizedEventManager(this.domCache);
    this.eventManager.init();

    this.isInitialized = true;
    console.log('[MobilePerformanceOptimizer] 初始化完成');

  },

  cleanup() {
    if (this.eventManager) this.eventManager.cleanup();
    if (this.domCache) this.domCache.clear();
    this.isInitialized = false;
  }
};

// 自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.time('[性能监控] MobilePerformanceOptimizer初始化');
    window.MobilePerformanceOptimizer.init();
    console.timeEnd('[性能监控] MobilePerformanceOptimizer初始化');
  });
} else {
  console.time('[性能监控] MobilePerformanceOptimizer初始化');
  window.MobilePerformanceOptimizer.init();
  console.timeEnd('[性能监控] MobilePerformanceOptimizer初始化');
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  window.MobilePerformanceOptimizer.cleanup();
});

 // ========================================
 //   性能优化器注入完成
 //   ========================================


// * =================================================================
// * 独立存档系统 (Independent Storage System)
// * =================================================================
// * 通过定义一个此应用专属的、独一无二的“命名空间”（前缀），
// * 确保所有 localStorage 数据都与其它应用完全隔离。



// ========== 抽屉控制函数（已优化 - 使用性能优化器） ==========
function toggleDrawer(side) {
    // 使用性能优化器处理
    if (window.MobilePerformanceOptimizer && window.MobilePerformanceOptimizer.eventManager) {
      window.MobilePerformanceOptimizer.eventManager.handleDrawerToggle(side);
    } else {
      // 降级处理（如果优化器未初始化）
      console.warn('[toggleDrawer] 性能优化器未初始化，使用降级方案');
      const drawer = document.getElementById(`${side}-drawer`);
      const overlay = document.querySelector('.drawer-overlay');
      if (!drawer || !overlay) return;

      const isOpen = drawer.classList.contains('open');

      // 关闭所有抽屉
      const panels = document.querySelectorAll('.drawer-panel');
      if (panels) {
        (panels.forEach ? panels : Array.from(panels)).forEach(d => {
          d.classList.remove('open');
        });
      }

      // 如果不是打开状态，则打开当前抽屉
      if (!isOpen) {
        drawer.classList.add('open');
        overlay.classList.add('active');
      } else {
        overlay.classList.remove('active');
      }
    }
}

function closeDrawer(side) {
  // 使用性能优化器处理
  if (window.MobilePerformanceOptimizer && window.MobilePerformanceOptimizer.eventManager) {
    window.MobilePerformanceOptimizer.eventManager.handleDrawerClose(side);
  } else {
    // 降级处理
    const drawer = document.getElementById(`${side}-drawer`);
    const overlay = document.querySelector('.drawer-overlay');
    if (!drawer || !overlay) return;

    drawer.classList.remove('open');

    // 检查是否还有其他抽屉打开
    const hasOpenDrawer = document.querySelector('.drawer-panel.open');
    if (!hasOpenDrawer) {
      overlay.classList.remove('active');
    }
  }
}

function closeAllDrawers() {
  // 使用性能优化器处理
  if (window.MobilePerformanceOptimizer && window.MobilePerformanceOptimizer.eventManager) {
    window.MobilePerformanceOptimizer.eventManager.handleCloseAll();
  } else {
    // 降级处理
    const panels = document.querySelectorAll('.drawer-panel');
    if (panels) {
      (panels.forEach ? panels : Array.from(panels)).forEach(d => {
        d.classList.remove('open');
      });
    }
    const overlay = document.querySelector('.drawer-overlay');
    if (overlay) overlay.classList.remove('active');
  }
}




// ========== 抽屉控制函数 ==========


window.gameApp = window.gameApp || {};



// ==================== 性能优化模块 ====================
// 移动端性能优化基础架构
// Feature: mobile-performance-optimization
// ========================================================

(function() {
  'use strict';

  // 全局日志开关（生产环境禁用）
  const ENABLE_PERF_LOGS = false; // 设为false禁用所有性能优化相关日志

  // 日志包装函数
  const perfLog = ENABLE_PERF_LOGS ? console.log.bind(console) : () => {};
  const perfWarn = ENABLE_PERF_LOGS ? console.warn.bind(console) : () => {};

  // 性能优化配置
  const PerformanceConfig = {
  // DOM缓存配置
  domCache: {
    enabled: true,
    autoRefresh: false
  },

  // 弹幕配置
  danmaku: {
    maxCount: 8,
    maxCountMobile: 10,
    animationDuration: 75000,
    animationDurationMobile: 50000
  },

  // 节流防抖配置
  throttle: {
    scroll: 16,   // 🔥 优化：16ms ≈ 60fps，使用RAF更佳
    resize: 100,  // 100ms
    input: 200    // 200ms（从300ms优化）
  },

  // 性能监控配置
  monitor: {
    enabled: false,  // 默认禁用，避免监控本身消耗性能
    fpsThreshold: 30,
    memoryThreshold: 100, // MB
    longTaskThreshold: 50 // ms
  },

  // 移动端优化
  mobile: {
    autoDetect: true,
    reducedAnimations: true,
    passiveListeners: true,
    lazyLoadDelay: 1000
  }
  };

  // 工具函数：检测移动设备
  function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // 工具函数：检测低性能设备
  function isLowPerformanceDevice() {
  // 基于硬件并发数和内存判断
  const cores = navigator.hardwareConcurrency || 2;
  const memory = navigator.deviceMemory || 4;
  return cores <= 2 || memory <= 2;
  }

  // 创建性能优化命名空间
  window.PerformanceOptimizer = {
  config: PerformanceConfig,
  isMobile: isMobileDevice(),
  isLowPerf: isLowPerformanceDevice(),

  // 模块占位符（将在后续任务中实现）
  domCache: null,
  eventManager: null,
  timerManager: null,
  renderBatcher: null,
  danmakuOptimizer: null,
  performanceMonitor: null,

  // 初始化标志
  initialized: false,

  // 初始化方法
  init: function() {
    if (this.initialized) {
    perfLog('[PerformanceOptimizer] 已初始化，跳过重复初始化');
    return;
    }

    // 检查MobilePerformanceOptimizer是否已初始化，避免重复
    if (window.MobilePerformanceOptimizer && window.MobilePerformanceOptimizer.isInitialized) {
    console.log('[PerformanceOptimizer] 检测到MobilePerformanceOptimizer已运行，跳过初始化');
    this.initialized = true;
    return;
    }

    perfLog('[PerformanceOptimizer] 开始初始化...');
    perfLog('[PerformanceOptimizer] 移动设备:', this.isMobile);
    perfLog('[PerformanceOptimizer] 低性能设备:', this.isLowPerf);

    // 根据设备类型调整配置
    if (this.isMobile) {
    this.config.danmaku.maxCount = this.config.danmaku.maxCountMobile;
    this.config.danmaku.animationDuration = this.config.danmaku.animationDurationMobile;
    perfLog('[PerformanceOptimizer] 已启用移动端优化配置');
    }

    if (this.isLowPerf) {
    this.config.monitor.enabled = false; // 低性能设备禁用监控
    perfLog('[PerformanceOptimizer] 低性能设备：已禁用性能监控');
    }

    this.initialized = true;
    perfLog('[PerformanceOptimizer] 初始化完成');
  },

  // 清理方法
  cleanup: function() {
    perfLog('[PerformanceOptimizer] 开始清理...');

    // 清理各个模块（将在后续任务中实现）
    if (this.eventManager && this.eventManager.cleanup) {
    this.eventManager.cleanup();
    }
    if (this.timerManager && this.timerManager.cleanup) {
    this.timerManager.cleanup();
    }
    if (this.danmakuOptimizer && this.danmakuOptimizer.cleanup) {
    this.danmakuOptimizer.cleanup();
    }
    if (this.performanceMonitor && this.performanceMonitor.stop) {
    this.performanceMonitor.stop();
    }

    this.initialized = false;
    console.log('[PerformanceOptimizer] 清理完成');
  }
  };

  // 页面加载时自动初始化
  if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.time('[性能监控] PerformanceOptimizer初始化');
    window.PerformanceOptimizer.init();
    console.timeEnd('[性能监控] PerformanceOptimizer初始化');
  });
  } else {
  console.time('[性能监控] PerformanceOptimizer初始化');
  window.PerformanceOptimizer.init();
  console.timeEnd('[性能监控] PerformanceOptimizer初始化');
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', function() {
  window.PerformanceOptimizer.cleanup();
  });

  console.log('[PerformanceOptimizer] 基础架构已加载');
})();

// ==================== DOM缓存管理器 ====================
// Feature: mobile-performance-optimization

// ========================================================

(function() {
  'use strict';

  /**
   * DOM缓存管理器
   * 缓存频繁访问的DOM元素引用，减少重复查询
   */
  class DOMCacheManager {
  constructor() {
    this.cache = new Map();
    this.weakCache = new WeakMap(); // 用于临时元素，允许自动GC
    console.log('[DOMCacheManager] 已创建');
  }

  /**
   * 初始化缓存 - 缓存所有关键元素
   */
  initCache() {
    console.log('[DOMCacheManager] 开始初始化缓存...');

    // 定义需要缓存的关键元素选择器
    const selectors = {
    // 加载提示相关
    'loading-indicator-bar': '#loading-indicator-bar',
    'loading-overlay': '#loading-overlay',
    'loading-text-overlay': '#loading-text-overlay',

    // 弹幕相关
    'danmaku-layer': '#danmaku-layer',

    // 主要内容区域
    'main-content': '.main-content',
    'game-text-container': '.game-text-container',
    'game-root-container': '.game-root-container',

    // 面板相关
    'character-panel': '.character-panel',
    'interaction-panel': '.interaction-panel',
    'bottom-status-container': '#bottom-status-container',

    // 抽屉相关
    'left-drawer': '#left-drawer',
    'right-drawer': '#right-drawer',
    'drawer-overlay': '.drawer-overlay',

    // 按钮相关
    'interaction-btn': '#interaction-btn',
    'round-btn': '#round-btn',
    'view-toggle-btn': '#view-toggle-btn',
    'toggle-char-panel': '#toggle-char-panel',
    'toggle-interaction-panel': '#toggle-interaction-panel',
    'toggle-bottom-panel': '#toggle-bottom-panel',
    'btn-fullscreen-toggle': '#btn-fullscreen-toggle',

    // 思维链相关
    'thinking-overlay': '.thinking-overlay',

    // 状态显示相关
    'val-name': '#val-name',
    'val-age': '#val-age',
    'val-gender': '#val-gender',
    'val-sequence': '#val-sequence',
    'val-pathway': '#val-pathway',
    'val-jinian': '#val-jinian',
    'val-xulie': '#val-xulie',
    'val-currency': '#val-currency',
    'val-guimi-charge-text': '#val-guimi-charge-text',
    'bar-guimi-charge': '#bar-guimi-charge',

    // 总结器相关
    'summarizer-body': '#summarizer-body',
    'summarizer-footer': '#summarizer-footer',
    'summarizer-output-container': '#summarizer-output-container',
    'summarizer-output': '#summarizer-output',
    'btn-generate-summary': '#btn-generate-summary',

    //新增
    'modal-close': '.modal-close-btn',
    'history-prev': '#btn-history-prev',
    'action-options': '#btn-action-options',
    'quick-send': '#btn-quick-send',
    'history-next': '#btn-history-next',
    'history-edit': '#btn-history-edit',
    'quick-shortcuts': '#btn-quick-shortcuts',
    'toggle-dm': '#btn-toggle-dm',
    'editor-save': '#btn-editor-save',
    'system-collapse': '.auto-system-collapse-btn',
    'inventory-btn': '#btn-inventory',
    'history-return': '#btn-history-return',
    'relationships': '#btn-relationships',
    'view-journey': '#btn-view-journey-main',
    'floating-editor': '#floating-editor-toggle',
    'save-load-mgr': '#btn-save-load-manager',
    'confirm-ok': '#confirm-btn-ok',

    // 核心输入与配置
    'unified-index-input': '#unified-index-input',
    'auto-toggle-lorebook-checkbox': '#auto-toggle-lorebook-checkbox',
    'auto-write-checkbox': '#auto-write-checkbox',
    'novel-mode-enabled-checkbox': '#novel-mode-enabled-checkbox',
    'character-auto-write-checkbox': '#character-auto-write-checkbox',
    'enter-to-send-checkbox': '#enter-to-send-checkbox',
    'quick-send-input': '#quick-send-input',

    // 存档与云端
    'btn-clear-all-saves': '#btn-clear-all-saves',
    'btn-import-save': '#btn-import-save',
    'import-file-input': '#import-file-input',
    'btn-cloud-upload': '#btn-cloud-upload',
    'btn-cloud-download': '#btn-cloud-download',
    'btn-cloud-check': '#btn-cloud-check',
    'btn-cloud-download-confirm': '#btn-cloud-download-confirm',
    'btn-copy-cloud-code': '#btn-copy-cloud-code',

    // 世界书动作按钮
    'btn-write-journey': '#btn-write-journey',
    'btn-write-past-lives': '#btn-write-past-lives',
    'btn-write-novel-mode': '#btn-write-novel-mode',
    'btn-write-character-card': '#btn-write-character-card',
    'btn-execute-commands': '#btn-execute-commands',
    'btn-clear-commands': '#btn-clear-commands',
    'btn-refresh-storage': '#btn-refresh-storage',
    'btn-reloadGameDB': '#btn-reloadGameDB',

    // 浮窗与面板控制
    'btn-quick-commands': '#btn-quick-commands',
    'action-options-popup': '#action-options-popup',
    'status-summary-button': '#status-summary-button',
    'status-effects-popup-close': '#status-effects-popup-close',
    'btn-toggle-thinking': '#btn-toggle-thinking',
    'btn-close-thinking': '#btn-close-thinking',
    'history-nav-placeholder': '#history-nav-placeholder',

    // 核心功能按键
    'btn-open-editor': '#btn-open-editor',
    'btn-main-rollback': '#btn-main-rollback',
    'btn-main-reroll': '#btn-main-reroll',
    'btn-emergency-reset': '#btn-emergency-reset',
    'settings-modal-body': '#settings-modal-body',
    'inventory-modal-body': '#inventory-modal .modal-body'
    };

    let cachedCount = 0;
    for (const [key, selector] of Object.entries(selectors)) {
    const element = document.querySelector(selector);
    if (element) {
      this.cache.set(key, element);
      cachedCount++;
    } else {
      console.warn(`[DOMCacheManager] 元素未找到: ${key} (${selector})`);
    }
    }

    // 批量缓存多个元素（返回NodeList）
    const multiSelectors = {
    'drawer-panels': '.drawer-panel',
    'all-modals': '.modal',
    'all-interaction-btns': '.interaction-btn',
    'journey-select-checkboxes': '.journey-select-checkbox',
    'modal-close-btn': '.modal-close-btn'
    };

    for (const [key, selector] of Object.entries(multiSelectors)) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      this.cache.set(key, elements);
      cachedCount += elements.length;
    }
    }

    console.log(`[DOMCacheManager] 缓存初始化完成，已缓存 ${cachedCount} 个元素`);
  }

  /**
   * 初始化关键缓存（优化版 - 只缓存最常用的元素）
   * 其他元素采用按需缓存策略，减少初始化开销
   */
  initCriticalCache() {
    console.log('[DOMCacheManager] 初始化关键元素缓存（按需策略）...');

    // 只缓存最频繁访问的核心元素
    const criticalSelectors = {
    // 加载提示（高频访问）
    'loading-indicator-bar': '#loading-indicator-bar',
    'loading-overlay': '#loading-overlay',

    // 弹幕层（高频访问）
    'danmaku-layer': '#danmaku-layer',

    // 主要内容区域（高频访问）
    'main-content': '.main-content',
    'game-text-container': '.game-text-container'
    };

    let cachedCount = 0;
    for (const [key, selector] of Object.entries(criticalSelectors)) {
    const element = document.querySelector(selector);
    if (element) {
      this.cache.set(key, element);
      cachedCount++;
    }
    }

    // 批量缓存模态框（高频访问）
    const modals = document.querySelectorAll('.modal-overlay');
    if (modals.length > 0) {
    this.cache.set('all-modals', modals);
    cachedCount += modals.length;
    }

    console.log(`[DOMCacheManager] 关键缓存初始化完成，已缓存 ${cachedCount} 个元素（其他元素将按需缓存）`);
  }

  /**
   * 获取单个缓存元素（带按需缓存）
   * @param {string} key - 缓存键名
   * @param {string} selector - 可选的选择器，用于按需缓存
   * @returns {Element|null} DOM元素或null
   */
  get(key, selector = null) {
    // 先尝试从缓存获取
    let element = this.cache.get(key);

    if (!element && selector) {
    // 缓存未命中且提供了选择器，尝试按需缓存
    element = document.querySelector(selector);
    if (element) {
      this.cache.set(key, element);
      if (window.DEBUG_MODE) {
      console.log(`[DOMCacheManager] 按需缓存: ${key}`);
      }
    }
    }

    if (!element) {
    // 仍然未找到，只在开发模式下警告
    if (window.DEBUG_MODE && window.PerformanceOptimizer && window.PerformanceOptimizer.config.monitor.enabled) {
      console.warn(`[DOMCacheManager] 缓存未命中: ${key}`);
    }
    return null;
    }

    return element;
  }

  /**
   * 获取多个缓存元素（NodeList）带按需缓存
   * @param {string} key - 缓存键名
   * @param {string} selector - 可选的选择器，用于按需缓存
   * @returns {NodeList|Array} 元素列表或空数组
   */
  getAll(key, selector = null) {
    // 先尝试从缓存获取
    let elements = this.cache.get(key);

    if (!elements && selector) {
    // 缓存未命中且提供了选择器，尝试按需缓存
    elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      this.cache.set(key, elements);
      if (window.DEBUG_MODE) {
      console.log(`[DOMCacheManager] 按需批量缓存: ${key} (${elements.length}个元素)`);
      }
    }
    }

    if (!elements || elements.length === 0) {
    // 仍然未找到，只在开发模式下警告
    if (window.DEBUG_MODE && window.PerformanceOptimizer && window.PerformanceOptimizer.config.monitor.enabled) {
      console.warn(`[DOMCacheManager] 缓存未命中: ${key}`);
    }
    return [];
    }

    return elements;
  }

  /**
   * 更新缓存（当DOM结构变化时）
   * @param {string} key - 缓存键名
   * @param {string} selector - CSS选择器
   */
  update(key, selector) {
    if (!selector) {
    console.warn(`[DOMCacheManager] 更新失败：选择器为空 (${key})`);
    return;
    }

    const element = document.querySelector(selector);
    if (element) {
    this.cache.set(key, element);
    console.log(`[DOMCacheManager] 缓存已更新: ${key}`);
    } else {
    this.cache.delete(key);
    console.log(`[DOMCacheManager] 元素不存在，已从缓存移除: ${key}`);
    }
  }

  /**
   * 批量更新缓存
   * @param {string} key - 缓存键名
   * @param {string} selector - CSS选择器
   */
  updateAll(key, selector) {
    if (!selector) {
    console.warn(`[DOMCacheManager] 更新失败：选择器为空 (${key})`);
    return;
    }

    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
    this.cache.set(key, elements);
    console.log(`[DOMCacheManager] 批量缓存已更新: ${key} (${elements.length}个元素)`);
    } else {
    this.cache.delete(key);
    console.log(`[DOMCacheManager] 元素不存在，已从缓存移除: ${key}`);
    }
  }

  /**
   * 使用WeakMap存储临时元素数据
   * @param {Element} element - DOM元素
   * @param {*} data - 要存储的数据
   */
  setWeak(element, data) {
    if (!element || !(element instanceof Element)) {
    console.warn('[DOMCacheManager] setWeak失败：无效的元素');
    return;
    }
    this.weakCache.set(element, data);
  }

  /**
   * 从WeakMap获取临时元素数据
   * @param {Element} element - DOM元素
   * @returns {*} 存储的数据或undefined
   */
  getWeak(element) {
    if (!element || !(element instanceof Element)) {
    console.warn('[DOMCacheManager] getWeak失败：无效的元素');
    return undefined;
    }
    return this.weakCache.get(element);
  }

  /**
   * 检查缓存是否存在
   * @param {string} key - 缓存键名
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * 清空所有缓存
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    // WeakMap会自动清理，无需手动操作
    console.log(`[DOMCacheManager] 已清空 ${size} 个缓存项`);
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
    cacheSize: this.cache.size,
    keys: Array.from(this.cache.keys())
    };
  }

  /**
   * 智能异步预热 - 专门处理追踪到的 22 个高频热点
   */
  asyncSmartPreWarm() {
    const hotspots = {
      'modal-close': '.modal-close-btn',
      'history-prev': '#btn-history-prev',
      'action-options': '#btn-action-options',
      'quick-send': '#btn-quick-send',
      'history-next': '#btn-history-next',
      'history-edit': '#btn-history-edit',
      'quick-shortcuts': '#btn-quick-shortcuts',
      'toggle-dm': '#btn-toggle-dm',
      'editor-save': '#btn-editor-save',
      'system-collapse': '.auto-system-collapse-btn',
      'inventory-btn': '#btn-inventory',
      'history-return': '#btn-history-return',
      'relationships': '#btn-relationships',
      'view-journey': '#btn-view-journey-main',
      'floating-editor': '#floating-editor-toggle',
      'save-load-mgr': '#btn-save-load-manager',
      'confirm-ok': '#confirm-btn-ok'
    };

    const entries = Object.entries(hotspots);
    let i = 0;

    console.log(`%c[高级预热] 开始在空闲时间静默加载 ${entries.length} 个核心交互节点...`, 'color: var(--color-info)');

    const next = () => {
      if (i >= entries.length) {
        console.log('%c[高级预热] 22 个热点节点已全部进入极速内存池！', 'color: var(--color-success); font-weight: bold;');
        return;
      }

      // 利用浏览器空闲时间，彻底不抢占主线程
      (window.requestIdleCallback || (cb => setTimeout(cb, 200)))(() => {
        const [key, selector] = entries[i];
        this.get(key, selector); // 触发新版的按需缓存
        i++;
        setTimeout(next, 100); // 每100ms悄悄处理一个
      });
    };
    next();
  }

  }

  // 创建全局实例并立即挂载到PerformanceOptimizer
  const domCacheManager = new DOMCacheManager();
  window.domCacheManager = domCacheManager;

  // 立即挂载，确保在任何使用前都已可用
  if (window.PerformanceOptimizer) {
  window.PerformanceOptimizer.domCache = domCacheManager;
  console.log('[DOMCacheManager] 已挂载到PerformanceOptimizer');
  } else {
  console.warn('[DOMCacheManager] PerformanceOptimizer未找到，稍后重试');
  // 延迟挂载，防止加载顺序问题
  setTimeout(() => {
    if (window.PerformanceOptimizer) {
    window.PerformanceOptimizer.domCache = domCacheManager;
    console.log('[DOMCacheManager] 延迟挂载成功');
    }
  }, 0);
  }

  // 扩展初始化方法，采用按需缓存策略
  if (window.PerformanceOptimizer) {
  const originalInit = window.PerformanceOptimizer.init;
  window.PerformanceOptimizer.init = function() {
    originalInit.call(this);

    if (this.config.domCache.enabled) {
    console.log('[DOMCacheManager] 采用按需缓存策略，不预加载所有元素');
    // 不再在初始化时缓存所有元素，改为按需缓存
    // 只缓存最关键的几个元素
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
      console.time('[性能监控] domCacheManager初始化');
      domCacheManager.initCriticalCache();
      setTimeout(() => {
      domCacheManager.asyncSmartPreWarm();
           }, 2000);
      console.timeEnd('[性能监控] domCacheManager初始化');
      });
    } else {
      console.time('[性能监控] domCacheManager初始化');
      domCacheManager.initCriticalCache();
      console.timeEnd('[性能监控] domCacheManager初始化');
    }
    }
  };

  // 扩展清理方法
  const originalCleanup = window.PerformanceOptimizer.cleanup;
  window.PerformanceOptimizer.cleanup = function() {
    domCacheManager.clear();
    originalCleanup.call(this);
  };

  console.log('[DOMCacheManager] 已集成到PerformanceOptimizer');
  }

  // 导出到全局（用于调试）
  window.DOMCacheManager = DOMCacheManager;
})();

// ==================== DOM缓存管理器结束 ====================

// ==================== 事件管理器 ====================
// Feature: mobile-performance-optimization

// ========================================================

(function() {
  'use strict';

  /**
   * 事件管理器
   * 统一管理事件监听器，防止重复绑定和内存泄漏
   */
  class EventManager {
  constructor() {
    this.listeners = new Map(); // 普通监听器: key -> {element, event, handler, options}
    this.delegatedEvents = new Map(); // 委托监听器: key -> {element, event, handler}
    this.listenerCounter = 0; // 监听器计数器
    console.log('[EventManager] 已创建');
  }

  /**
   * 添加事件监听器（自动防重复）
   * @param {Element} element - DOM元素
   * @param {string} event - 事件类型
   * @param {Function} handler - 事件处理函数
   * @param {Object} options - 事件选项（passive, capture等）
   * @returns {string|null} 监听器ID，失败返回null
   */
  on(element, event, handler, options = {}) {
    if (!element || !(element instanceof Element)) {
    console.warn('[EventManager] on失败：无效的元素');
    return null;
    }

    if (!event || typeof event !== 'string') {
    console.warn('[EventManager] on失败：无效的事件类型');
    return null;
    }

    if (!handler || typeof handler !== 'function') {
    console.warn('[EventManager] on失败：无效的处理函数');
    return null;
    }

    const key = this._getKey(element, event);

    // 检查是否已绑定
    if (this.listeners.has(key)) {
    // 只在开发模式下输出警告
    if (window.DEBUG_MODE) {
      console.warn(`[EventManager] 事件已绑定，跳过重复绑定: ${event} on`, element);
    }
    return this.listeners.get(key).id;
    }

    // 🔥 性能优化：移动端和桌面端都自动添加passive选项优化滚动性能
    if (['scroll', 'touchstart', 'touchmove', 'wheel', 'touchend'].includes(event)) {
    // 默认true，除非明确设为false
    if (options.passive === undefined) {
      options.passive = true;
    }
    }

    try {
    element.addEventListener(event, handler, options);

    const listenerId = `listener_${++this.listenerCounter}`;
    this.listeners.set(key, {
      id: listenerId,
      element,
      event,
      handler,
      options
    });

    // 只在开发模式下输出日志
    if (window.DEBUG_MODE) {
      console.log(`[EventManager] 已绑定事件: ${event} (${listenerId})`);
    }
    return listenerId;
    } catch (error) {
    console.error('[EventManager] 绑定事件失败:', error);
    return null;
    }
  }

  /**
   * 事件委托（在父元素上监听）
   * @param {Element} parentElement - 父元素
   * @param {string} event - 事件类型
   * @param {string} selector - 子元素选择器
   * @param {Function} handler - 事件处理函数
   * @returns {string|null} 监听器ID，失败返回null
   */
  delegate(parentElement, event, selector, handler) {
    if (!parentElement || !(parentElement instanceof Element)) {
    console.warn('[EventManager] delegate失败：无效的父元素');
    return null;
    }

    if (!event || typeof event !== 'string') {
    console.warn('[EventManager] delegate失败：无效的事件类型');
    return null;
    }

    if (!selector || typeof selector !== 'string') {
    console.warn('[EventManager] delegate失败：无效的选择器');
    return null;
    }

    if (!handler || typeof handler !== 'function') {
    console.warn('[EventManager] delegate失败：无效的处理函数');
    return null;
    }

    const key = this._getKey(parentElement, event + ':' + selector);

    // 检查是否已绑定
    if (this.delegatedEvents.has(key)) {
    console.warn(`[EventManager] 委托事件已绑定，跳过重复绑定: ${event} on ${selector}`);
    return this.delegatedEvents.get(key).id;
    }

    // 创建委托处理函数
    const delegateHandler = (e) => {
    const target = e.target.closest(selector);
    if (target && parentElement.contains(target)) {
      handler.call(target, e);
    }
    };

    try {
    parentElement.addEventListener(event, delegateHandler);

    const listenerId = `delegate_${++this.listenerCounter}`;
    this.delegatedEvents.set(key, {
      id: listenerId,
      element: parentElement,
      event,
      selector,
      handler: delegateHandler,
      originalHandler: handler
    });

    console.log(`[EventManager] 已绑定委托事件: ${event} on ${selector} (${listenerId})`);
    return listenerId;
    } catch (error) {
    console.error('[EventManager] 绑定委托事件失败:', error);
    return null;
    }
  }

  /**
   * 移除特定监听器
   * @param {Element} element - DOM元素
   * @param {string} event - 事件类型
   * @returns {boolean} 是否成功移除
   */
  off(element, event) {
    if (!element || !(element instanceof Element)) {
    console.warn('[EventManager] off失败：无效的元素');
    return false;
    }

    const key = this._getKey(element, event);
    const listener = this.listeners.get(key);

    if (listener) {
    try {
      element.removeEventListener(listener.event, listener.handler, listener.options);
      this.listeners.delete(key);
      console.log(`[EventManager] 已移除事件: ${event} (${listener.id})`);
      return true;
    } catch (error) {
      console.error('[EventManager] 移除事件失败:', error);
      return false;
    }
    } else {
    console.warn(`[EventManager] 未找到监听器: ${event} on`, element);
    return false;
    }
  }

  /**
   * 移除委托监听器
   * @param {Element} parentElement - 父元素
   * @param {string} event - 事件类型
   * @param {string} selector - 子元素选择器
   * @returns {boolean} 是否成功移除
   */
  offDelegate(parentElement, event, selector) {
    if (!parentElement || !(parentElement instanceof Element)) {
    console.warn('[EventManager] offDelegate失败：无效的父元素');
    return false;
    }

    const key = this._getKey(parentElement, event + ':' + selector);
    const delegate = this.delegatedEvents.get(key);

    if (delegate) {
    try {
      parentElement.removeEventListener(delegate.event, delegate.handler);
      this.delegatedEvents.delete(key);
      console.log(`[EventManager] 已移除委托事件: ${event} on ${selector} (${delegate.id})`);
      return true;
    } catch (error) {
      console.error('[EventManager] 移除委托事件失败:', error);
      return false;
    }
    } else {
    console.warn(`[EventManager] 未找到委托监听器: ${event} on ${selector}`);
    return false;
    }
  }

  /**
   * 清理所有监听器
   */
  cleanup() {
    // 只在开发模式下输出详细日志
    if (window.DEBUG_MODE) {
    console.log('[EventManager] 开始清理所有监听器...');
    }

    let removedCount = 0;

    // 清理普通监听器
    for (const [key, listener] of this.listeners) {
    try {
      listener.element.removeEventListener(
      listener.event,
      listener.handler,
      listener.options
      );
      removedCount++;
    } catch (error) {
      console.error(`[EventManager] 清理监听器失败 (${listener.id}):`, error);
    }
    }
    this.listeners.clear();

    // 清理委托监听器
    for (const [key, delegate] of this.delegatedEvents) {
    try {
      delegate.element.removeEventListener(delegate.event, delegate.handler);
      removedCount++;
    } catch (error) {
      console.error(`[EventManager] 清理委托监听器失败 (${delegate.id}):`, error);
    }
    }
    this.delegatedEvents.clear();

    // 只在开发模式下输出完成日志
    if (window.DEBUG_MODE) {
    console.log(`[EventManager] 清理完成，已移除 ${removedCount} 个监听器`);
    }
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
    listenersCount: this.listeners.size,
    delegatedCount: this.delegatedEvents.size,
    totalCount: this.listeners.size + this.delegatedEvents.size,
    listeners: Array.from(this.listeners.values()).map(l => ({
      id: l.id,
      event: l.event,
      element: l.element.tagName
    })),
    delegated: Array.from(this.delegatedEvents.values()).map(d => ({
      id: d.id,
      event: d.event,
      selector: d.selector
    }))
    };
  }

  /**
   * 生成监听器唯一键
   * @private
   */
  _getKey(element, event) {
    // 使用元素的唯一标识 + 事件类型作为key
    if (!element._eventManagerId) {
    element._eventManagerId = `elem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return `${element._eventManagerId}_${event}`;
  }
  }

  // 创建全局实例并集成到PerformanceOptimizer
  const eventManager = new EventManager();

  if (window.PerformanceOptimizer) {
  window.PerformanceOptimizer.eventManager = eventManager;

  // 扩展清理方法
  const originalCleanup = window.PerformanceOptimizer.cleanup;
  window.PerformanceOptimizer.cleanup = function() {
    eventManager.cleanup();
    originalCleanup.call(this);
  };

  console.log('[EventManager] 已集成到PerformanceOptimizer');
  }

  // 导出到全局（用于调试）
  window.EventManager = EventManager;
})();

// ==================== 事件管理器结束 ====================

// ==================== 定时器管理器 ====================
// Feature: mobile-performance-optimization

// ========================================================

(function() {
  'use strict';

  /**
   * 定时器管理器
   * 统一管理定时器，确保正确清理，防止内存泄漏
   */
  class TimerManager {
  constructor() {
    this.timeouts = new Set();    // setTimeout ID集合
    this.intervals = new Set();   // setInterval ID集合
    this.rafs = new Set();      // requestAnimationFrame ID集合
    this.timerCounter = 0;      // 定时器计数器
    console.log('[TimerManager] 已创建');
  }

  /**
   * 包装setTimeout
   * @param {Function} callback - 回调函数
   * @param {number} delay - 延迟时间（毫秒）
   * @param {...*} args - 传递给回调的参数
   * @returns {number} 定时器ID
   */
  setTimeout(callback, delay, ...args) {
    if (typeof callback !== 'function') {
    console.warn('[TimerManager] setTimeout失败：无效的回调函数');
    return null;
    }

    const timerId = ++this.timerCounter;

    const wrappedCallback = () => {
    this.timeouts.delete(id);
    try {
      callback(...args);
    } catch (error) {
      console.error(`[TimerManager] setTimeout回调执行失败 (${timerId}):`, error);
    }
    };

    const id = window.setTimeout(wrappedCallback, delay);
    this.timeouts.add(id);

    // console.log(`[TimerManager] 已创建setTimeout (ID: ${id}, 延迟: ${delay}ms)`);
    return id;
  }

  /**
   * 包装setInterval
   * @param {Function} callback - 回调函数
   * @param {number} delay - 间隔时间（毫秒）
   * @param {...*} args - 传递给回调的参数
   * @returns {number} 定时器ID
   */
  setInterval(callback, delay, ...args) {
    if (typeof callback !== 'function') {
    console.warn('[TimerManager] setInterval失败：无效的回调函数');
    return null;
    }

    const timerId = ++this.timerCounter;

    const wrappedCallback = () => {
    try {
      callback(...args);
    } catch (error) {
      console.error(`[TimerManager] setInterval回调执行失败 (${timerId}):`, error);
    }
    };

    const id = window.setInterval(wrappedCallback, delay);
    this.intervals.add(id);

    // console.log(`[TimerManager] 已创建setInterval (ID: ${id}, 间隔: ${delay}ms)`);
    return id;
  }

  /**
   * 包装requestAnimationFrame
   * @param {Function} callback - 回调函数
   * @returns {number} RAF ID
   */
  requestAnimationFrame(callback) {
    if (typeof callback !== 'function') {
    console.warn('[TimerManager] requestAnimationFrame失败：无效的回调函数');
    return null;
    }

    const rafId = ++this.timerCounter;

    const wrappedCallback = (...args) => {
    this.rafs.delete(id);
    try {
      callback(...args);
    } catch (error) {
      console.error(`[TimerManager] RAF回调执行失败 (${rafId}):`, error);
    }
    };

    const id = window.requestAnimationFrame(wrappedCallback);
    this.rafs.add(id);

    console.log(`[TimerManager] 已创建RAF (ID: ${id})`);
    return id;
  }

  /**
   * 清除setTimeout
   * @param {number} id - 定时器ID
   * @returns {boolean} 是否成功清除
   */
  clearTimeout(id) {
    if (id == null) {
    console.warn('[TimerManager] clearTimeout失败：无效的ID');
    return false;
    }

    window.clearTimeout(id);
    const deleted = this.timeouts.delete(id);

    if (deleted) {
    // console.log(`[TimerManager] 已清除setTimeout (ID: ${id})`);
    }

    return deleted;
  }

  /**
   * 清除setInterval
   * @param {number} id - 定时器ID
   * @returns {boolean} 是否成功清除
   */
  clearInterval(id) {
    if (id == null) {
    console.warn('[TimerManager] clearInterval失败：无效的ID');
    return false;
    }

    window.clearInterval(id);
    const deleted = this.intervals.delete(id);

    if (deleted) {
    // console.log(`[TimerManager] 已清除setInterval (ID: ${id})`);
    }

    return deleted;
  }

  /**
   * 取消requestAnimationFrame
   * @param {number} id - RAF ID
   * @returns {boolean} 是否成功取消
   */
  cancelAnimationFrame(id) {
    if (id == null) {
    console.warn('[TimerManager] cancelAnimationFrame失败：无效的ID');
    return false;
    }

    window.cancelAnimationFrame(id);
    const deleted = this.rafs.delete(id);

    if (deleted) {
    console.log(`[TimerManager] 已取消RAF (ID: ${id})`);
    }

    return deleted;
  }

  /**
   * 清理所有定时器
   */
  cleanup() {
    console.log('[TimerManager] 开始清理所有定时器...');

    let clearedCount = 0;

    // 清理所有setTimeout
    this.timeouts.forEach(id => {
    window.clearTimeout(id);
    clearedCount++;
    });
    this.timeouts.clear();

    // 清理所有setInterval
    this.intervals.forEach(id => {
    window.clearInterval(id);
    clearedCount++;
    });
    this.intervals.clear();

    // 清理所有RAF
    this.rafs.forEach(id => {
    window.cancelAnimationFrame(id);
    clearedCount++;
    });
    this.rafs.clear();

    console.log(`[TimerManager] 清理完成，已清除 ${clearedCount} 个定时器`);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
    timeoutsCount: this.timeouts.size,
    intervalsCount: this.intervals.size,
    rafsCount: this.rafs.size,
    totalCount: this.timeouts.size + this.intervals.size + this.rafs.size,
    timeouts: Array.from(this.timeouts),
    intervals: Array.from(this.intervals),
    rafs: Array.from(this.rafs)
    };
  }

  /**
   * 检查定时器是否存在
   * @param {number} id - 定时器ID
   * @param {string} type - 类型：'timeout', 'interval', 'raf'
   * @returns {boolean}
   */
  has(id, type = 'timeout') {
    switch (type) {
    case 'timeout':
      return this.timeouts.has(id);
    case 'interval':
      return this.intervals.has(id);
    case 'raf':
      return this.rafs.has(id);
    default:
      return false;
    }
  }
  }

  // 创建全局实例并集成到PerformanceOptimizer
  const timerManager = new TimerManager();

  if (window.PerformanceOptimizer) {
  window.PerformanceOptimizer.timerManager = timerManager;

  // 扩展清理方法
  const originalCleanup = window.PerformanceOptimizer.cleanup;
  window.PerformanceOptimizer.cleanup = function() {
    timerManager.cleanup();
    originalCleanup.call(this);
  };

  console.log('[TimerManager] 已集成到PerformanceOptimizer');
  }

  // 导出到全局（用于调试）
  window.TimerManager = TimerManager;
})();

// ==================== 定时器管理器结束 ====================

// ==================== 节流防抖工具 ====================
// Feature: mobile-performance-optimization

// ========================================================

(function() {
  'use strict';

  /**
   * 节流防抖工具类
   * 提供throttle和debounce函数，优化高频事件处理
   */
  class ThrottleDebounce {
  /**
   * 节流函数 - 限制函数执行频率
   * 在指定时间间隔内最多执行一次
   *
   * @param {Function} func - 要节流的函数
   * @param {number} wait - 时间间隔（毫秒）
   * @returns {Function} 节流后的函数
   *
   * @example
   * const throttledScroll = ThrottleDebounce.throttle(handleScroll, 100);
   * window.addEventListener('scroll', throttledScroll);
   */
  static throttle(func, wait) {
    if (typeof func !== 'function') {
    console.warn('[ThrottleDebounce] throttle失败：无效的函数');
    return function() {};
    }

    if (typeof wait !== 'number' || wait < 0) {
    console.warn('[ThrottleDebounce] throttle失败：无效的等待时间');
    return func;
    }

    let timeout = null;
    let previous = 0;

    return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      // 时间间隔已过，立即执行
      if (timeout) {
      clearTimeout(timeout);
      timeout = null;
      }
      previous = now;
      func.apply(this, args);
    } else if (!timeout) {
      // 设置定时器，在剩余时间后执行
      timeout = setTimeout(() => {
      previous = Date.now();
      timeout = null;
      func.apply(this, args);
      }, remaining);
    }
    };
  }

  /**
   * 防抖函数 - 延迟执行直到停止触发
   * 连续触发时只在最后一次触发后延迟执行
   *
   * @param {Function} func - 要防抖的函数
   * @param {number} wait - 延迟时间（毫秒）
   * @param {boolean} immediate - 是否立即执行（首次触发时）
   * @returns {Function} 防抖后的函数
   *
   * @example
   * const debouncedResize = ThrottleDebounce.debounce(handleResize, 200);
   * window.addEventListener('resize', debouncedResize);
   */
  static debounce(func, wait, immediate = false) {
    if (typeof func !== 'function') {
    console.warn('[ThrottleDebounce] debounce失败：无效的函数');
    return function() {};
    }

    if (typeof wait !== 'number' || wait < 0) {
    console.warn('[ThrottleDebounce] debounce失败：无效的等待时间');
    return func;
    }

    let timeout = null;

    return function debounced(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) {
      func.apply(this, args);
      }
    };

    const callNow = immediate && !timeout;

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) {
      func.apply(this, args);
    }
    };
  }

  /**
   * RAF节流 - 使用requestAnimationFrame优化动画相关函数
   * 确保函数在每个动画帧最多执行一次
   *
   * @param {Function} func - 要节流的函数
   * @returns {Function} RAF节流后的函数
   *
   * @example
   * const rafThrottledUpdate = ThrottleDebounce.rafThrottle(updateAnimation);
   * element.addEventListener('mousemove', rafThrottledUpdate);
   */
  static rafThrottle(func) {
    if (typeof func !== 'function') {
    console.warn('[ThrottleDebounce] rafThrottle失败：无效的函数');
    return function() {};
    }

    let rafId = null;
    let latestArgs = null;
    let latestContext = null;

    return function rafThrottled(...args) {
    latestArgs = args;
    latestContext = this;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
      func.apply(latestContext, latestArgs);
      rafId = null;
      });
    }
    };
  }

  /**
   * 创建可取消的防抖函数
   * 返回的函数包含cancel方法用于取消待执行的调用
   *
   * @param {Function} func - 要防抖的函数
   * @param {number} wait - 延迟时间（毫秒）
   * @returns {Function} 可取消的防抖函数
   *
   * @example
   * const debouncedSearch = ThrottleDebounce.debounceCancelable(search, 300);
   * input.addEventListener('input', debouncedSearch);
   * // 取消待执行的调用
   * debouncedSearch.cancel();
   */
  static debounceCancelable(func, wait) {
    if (typeof func !== 'function') {
    console.warn('[ThrottleDebounce] debounceCancelable失败：无效的函数');
    return function() {};
    }

    let timeout = null;

    const debounced = function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
    };

    debounced.cancel = function() {
    clearTimeout(timeout);
    timeout = null;
    };

    return debounced;
  }

  /**
   * 创建可取消的节流函数
   * 返回的函数包含cancel方法用于取消待执行的调用
   *
   * @param {Function} func - 要节流的函数
   * @param {number} wait - 时间间隔（毫秒）
   * @returns {Function} 可取消的节流函数
   */
  static throttleCancelable(func, wait) {
    if (typeof func !== 'function') {
    console.warn('[ThrottleDebounce] throttleCancelable失败：无效的函数');
    return function() {};
    }

    let timeout = null;
    let previous = 0;

    const throttled = function(...args) {
    const now = Date.now();
    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
      clearTimeout(timeout);
      timeout = null;
      }
      previous = now;
      func.apply(this, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
      previous = Date.now();
      timeout = null;
      func.apply(this, args);
      }, remaining);
    }
    };

    throttled.cancel = function() {
    clearTimeout(timeout);
    timeout = null;
    previous = 0;
    };

    return throttled;
  }
  }

  // 集成到PerformanceOptimizer
  if (window.PerformanceOptimizer) {
  window.PerformanceOptimizer.throttle = ThrottleDebounce.throttle;
  window.PerformanceOptimizer.debounce = ThrottleDebounce.debounce;
  window.PerformanceOptimizer.rafThrottle = ThrottleDebounce.rafThrottle;

  console.log('[ThrottleDebounce] 已集成到PerformanceOptimizer');
  }

  // 导出到全局
  window.ThrottleDebounce = ThrottleDebounce;

  console.log('[ThrottleDebounce] 工具类已加载');
})();

// ==================== 节流防抖工具结束 ====================

// ==================== 渲染批处理器 ====================
// Feature: mobile-performance-optimization

// ========================================================

(function() {
  'use strict';

  /**
   * 渲染批处理器
   * 批量处理DOM更新，减少重排重绘，提升渲染性能
   */
  class RenderBatcher {
  constructor() {
    this.pendingUpdates = [];  // 待处理的更新队列
    this.rafId = null;      // requestAnimationFrame ID
    this.isProcessing = false;  // 是否正在处理
    console.log('[RenderBatcher] 已创建');
  }

  /**
   * 调度更新 - 添加到批处理队列
   * @param {Function} updateFn - 更新函数
   * @returns {Promise} 更新完成的Promise
   */
  schedule(updateFn) {
    if (typeof updateFn !== 'function') {
    console.warn('[RenderBatcher] schedule失败：无效的更新函数');
    return Promise.reject(new Error('Invalid update function'));
    }

    return new Promise((resolve, reject) => {
    this.pendingUpdates.push({
      fn: updateFn,
      resolve,
      reject
    });

    if (!this.rafId && !this.isProcessing) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
    });
  }

  /**
   * 批量执行所有更新
   * @private
   */
  flush() {
    if (this.isProcessing) {
    console.warn('[RenderBatcher] 正在处理中，跳过重复调用');
    return;
    }

    this.isProcessing = true;
    this.rafId = null;

    const updates = this.pendingUpdates.splice(0);

    if (updates.length === 0) {
    this.isProcessing = false;
    return;
    }

    if (window.DEBUG_MODE) {
    console.log(`[RenderBatcher] 开始批量处理 ${updates.length} 个更新`);
    }

    // 分离读写操作以避免布局抖动
    const reads = [];
    const writes = [];

    // 第一阶段：收集所有读操作
    updates.forEach(update => {
    try {
      if (update.fn.read && typeof update.fn.read === 'function') {
      reads.push({
        read: update.fn.read,
        update
      });
      } else {
      writes.push({
        write: update.fn,
        update
      });
      }
    } catch (error) {
      console.error('[RenderBatcher] 收集更新失败:', error);
      update.reject(error);
    }
    });

    // 第二阶段：执行所有读操作
    const readResults = [];
    reads.forEach(({ read, update }) => {
    try {
      const result = read();
      readResults.push(result);
      writes.push({
      write: update.fn.write || update.fn,
      update,
      readResult: result
      });
    } catch (error) {
      console.error('[RenderBatcher] 读操作失败:', error);
      update.reject(error);
    }
    });

    // 第三阶段：执行所有写操作
    writes.forEach(({ write, update, readResult }) => {
    try {
      if (typeof write === 'function') {
      write(readResult);
      }
      update.resolve();
    } catch (error) {
      console.error('[RenderBatcher] 写操作失败:', error);
      update.reject(error);
    }
    });

    if (window.DEBUG_MODE) {
    console.log(`[RenderBatcher] 批量处理完成`);
    }
    this.isProcessing = false;
  }

  /**
   * 优化innerHTML更新 - 先隐藏再更新
   * @param {Element} element - 目标元素
   * @param {string} html - HTML内容
   * @returns {Promise}
   */
  updateHTML(element, html) {
    if (!element || !(element instanceof Element)) {
    console.warn('[RenderBatcher] updateHTML失败：无效的元素');
    return Promise.reject(new Error('Invalid element'));
    }

    return this.schedule(() => {
    // 先隐藏元素
    const display = element.style.display;
    element.style.display = 'none';

    // 强制重排（确保隐藏生效）
    element.offsetHeight;

    // 更新内容
    element.innerHTML = html;

    // 恢复显示
    element.style.display = display;
    });
  }

  /**
   * 批量添加子元素 - 使用DocumentFragment
   * @param {Element} parent - 父元素
   * @param {Array} children - 子元素数组（可以是Element或HTML字符串）
   * @returns {Promise}
   */
  appendChildren(parent, children) {
    if (!parent || !(parent instanceof Element)) {
    console.warn('[RenderBatcher] appendChildren失败：无效的父元素');
    return Promise.reject(new Error('Invalid parent element'));
    }

    if (!Array.isArray(children)) {
    console.warn('[RenderBatcher] appendChildren失败：children必须是数组');
    return Promise.reject(new Error('Children must be an array'));
    }

    return this.schedule(() => {
    const fragment = document.createDocumentFragment();

    children.forEach(child => {
      if (typeof child === 'string') {
      // HTML字符串
      const temp = document.createElement('div');
      temp.innerHTML = child;
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      } else if (child instanceof Element) {
      // DOM元素
      fragment.appendChild(child);
      } else {
      console.warn('[RenderBatcher] 跳过无效的子元素:', child);
      }
    });

    parent.appendChild(fragment);
    });
  }

  /**
   * 批量更新样式
   * @param {Element} element - 目标元素
   * @param {Object} styles - 样式对象
   * @returns {Promise}
   */
  updateStyles(element, styles) {
    if (!element || !(element instanceof Element)) {
    console.warn('[RenderBatcher] updateStyles失败：无效的元素');
    return Promise.reject(new Error('Invalid element'));
    }

    if (!styles || typeof styles !== 'object') {
    console.warn('[RenderBatcher] updateStyles失败：无效的样式对象');
    return Promise.reject(new Error('Invalid styles object'));
    }

    return this.schedule(() => {
    Object.assign(element.style, styles);
    });
  }

  /**
   * 批量更新属性
   * @param {Element} element - 目标元素
   * @param {Object} attributes - 属性对象
   * @returns {Promise}
   */
  updateAttributes(element, attributes) {
    if (!element || !(element instanceof Element)) {
    console.warn('[RenderBatcher] updateAttributes失败：无效的元素');
    return Promise.reject(new Error('Invalid element'));
    }

    if (!attributes || typeof attributes !== 'object') {
    console.warn('[RenderBatcher] updateAttributes失败：无效的属性对象');
    return Promise.reject(new Error('Invalid attributes object'));
    }

    return this.schedule(() => {
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    });
  }

  /**
   * 批量更新文本内容
   * @param {Element} element - 目标元素
   * @param {string} text - 文本内容
   * @returns {Promise}
   */
  updateText(element, text) {
    if (!element || !(element instanceof Element)) {
    console.warn('[RenderBatcher] updateText失败：无效的元素');
    return Promise.reject(new Error('Invalid element'));
    }

    return this.schedule(() => {
    element.textContent = text;
    });
  }

  /**
   * 批量移除元素
   * @param {Array<Element>} elements - 要移除的元素数组
   * @returns {Promise}
   */
  removeElements(elements) {
    if (!Array.isArray(elements)) {
    console.warn('[RenderBatcher] removeElements失败：elements必须是数组');
    return Promise.reject(new Error('Elements must be an array'));
    }

    return this.schedule(() => {
    elements.forEach(element => {
      if (element && element.parentNode) {
      element.parentNode.removeChild(element);
      }
    });
    });
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    return {
    pendingCount: this.pendingUpdates.length,
    isProcessing: this.isProcessing,
    hasScheduled: this.rafId !== null
    };
  }

  /**
   * 清理待处理的更新
   */
  clear() {
    if (this.rafId) {
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
    }

    const count = this.pendingUpdates.length;
    this.pendingUpdates.forEach(update => {
    update.reject(new Error('Batch cleared'));
    });
    this.pendingUpdates = [];

    console.log(`[RenderBatcher] 已清除 ${count} 个待处理更新`);
  }
  }

  // 创建全局实例并集成到PerformanceOptimizer
  const renderBatcher = new RenderBatcher();

  if (window.PerformanceOptimizer) {
  window.PerformanceOptimizer.renderBatcher = renderBatcher;

  // 扩展清理方法
  const originalCleanup = window.PerformanceOptimizer.cleanup;
  window.PerformanceOptimizer.cleanup = function() {
    renderBatcher.clear();
    originalCleanup.call(this);
  };

  console.log('[RenderBatcher] 已集成到PerformanceOptimizer');
  }

  // 导出到全局（用于调试）
  window.RenderBatcher = RenderBatcher;
})();

// ==================== 渲染批处理器结束 ====================


// ==================== 弹幕优化器 (Pro DOM Pool 版) ====================
// Feature: mobile-performance-optimization
// Validates: Queue System, Collision Track, Responsive Render, Advanced DOM Pooling
// ========================================================

(function() {
  'use strict';

  class DanmakuOptimizer {
  constructor(domCache) {
    this.domCache = domCache || (window.PerformanceOptimizer && window.PerformanceOptimizer.domCache);
    this.isEnabled = false;

    // 核心数据结构
    this.activeDanmaku = [];
    this.pendingQueue = [];
    this.animationFrame = null;

    this.isMobile = window.PerformanceOptimizer ? window.PerformanceOptimizer.isMobile : false;

    // 并发控制
    const config = window.PerformanceOptimizer ? window.PerformanceOptimizer.config.danmaku : {};
    this.maxDanmaku = this.isMobile ? (config.maxCountMobile || 15) : (config.maxCount || 30);

    // 🌟 视觉调优：大幅延长存活时间，速度变得极缓且优雅
    this.baseDuration = this.isMobile ? 20000 : 25000;

    // 替换为这行新代码（轨道数翻倍，适应全屏）：
    this.laneCount = this.isMobile ? 12 : 20;
    this.lanes = new Array(this.laneCount).fill(null);

    // 响应式视口宽度
    this.containerWidth = window.innerWidth;
    this._initResizeListener();

    // 🌟 进阶 DOM 对象池配置
    this.domPool = [];
    this.maxPoolSize = this.maxDanmaku + 10; // 容量上限：比最大并发多备10个，防溢出
    this._preWarmPool(); // 启动时预热内存

    this.nextLaunchTime = 0;
    // 比如每 300ms 到 800ms 发射一条，而不是每帧都发
    this.minLaunchInterval = 600;
    this.maxLaunchInterval = 2200;

    console.log(`[DanmakuOptimizer] Pro版已创建 (限流: ${this.maxDanmaku}, 基础时长: ${this.baseDuration}ms)`);
  }

  _initResizeListener() {
    window.addEventListener('resize', () => {
    const layer = this._getLayer();
    if (layer) {
      this.containerWidth = layer.offsetWidth || window.innerWidth;
    }
    });
  }

  _getLayer() {
    return this.domCache ? this.domCache.get('danmaku-layer') : document.getElementById('danmaku-layer');
  }

  // ========== 🌟 高级 DOM 对象池管理 ==========

  /**
   * 预热：在内存中预先创建节点，避免爆发时卡顿
   * @private
   */
  _preWarmPool() {
    for (let i = 0; i < this.maxDanmaku; i++) {
    const pill = document.createElement('div');
    pill.className = 'danmaku-pill';
    pill.style.cssText = 'opacity: 0; transform: none; top: 0;';
    this.domPool.push(pill);
    }
    console.log(`[DanmakuOptimizer] DOM对象池已预热 ${this.domPool.length} 个节点`);
  }

  /**
   * 获取节点：优先从池中取，无库存则新建
   * @private
   */
  _getPillElement() {
    if (this.domPool.length > 0) {
    return this.domPool.pop();
    }
    const pill = document.createElement('div');
    pill.className = 'danmaku-pill';
    return pill;
  }

  /**
   * 回收节点：深度清洗并控制容量
   * @private
   */
  _recyclePillElement(pill) {
    if (!pill) return;

    // 1. 从视图中拔除 (优化渲染树)
    if (pill.parentNode) {
    pill.parentNode.removeChild(pill);
    }

    // 2. 容量上限控制：如果池子满了，直接抛弃让GC回收
    if (this.domPool.length >= this.maxPoolSize) {
    return;
    }

    // 3. 深度洗澡 (非常重要：抹除上一条弹幕的痕迹)
    pill.textContent = '';
    pill.className = 'danmaku-pill'; // 抹除可能附带的 .color-gold 等特殊类名
    pill.style.cssText = 'opacity: 0; transform: none; top: 0; color: ;'; // 抹除行内样式

    // 4. 入库休眠
    this.domPool.push(pill);
  }

  // ========== 核心防碰撞防追尾算法 (无缝衔接版) ==========

  _getBestLane(newDuration, newWidth, now) {
    const availableLanes = [];
    for (let i = 0; i < this.laneCount; i++) {
    const lastDm = this.lanes[i];
    if (!lastDm) {
      availableLanes.push(i);
      continue;
    }

    const elapsed = now - lastDm.startTime;
    const progress = elapsed / lastDm.duration;
    const movedDistance = progress * (this.containerWidth + lastDm.width);

    const isTailOut = movedDistance > (lastDm.width + 30); // 30px安全车距

    if (isTailOut) {
      if (newDuration < lastDm.duration) {
      // 快车入轨，要求前车驶出 35% 以上
      if (movedDistance > (this.containerWidth * 0.35)) {
        availableLanes.push(i);
      }
      } else {
      availableLanes.push(i);
      }
    }
    }

    if (availableLanes.length === 0) return -1;
    return availableLanes[Math.floor(Math.random() * availableLanes.length)];
  }

  // ========== 调度与发射 ==========

  enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    const layer = this._getLayer();
    if (layer) layer.style.display = 'block';
    // 开启时，如果有积压的弹幕可以重新激活
    if (this.pendingQueue.length > 0 && !this.animationFrame) {
    this.startAnimation();
    }
  }

  disable() {
    this.isEnabled = false;
    this.stopAnimation();
    const layer = this._getLayer();
    if (layer) layer.style.display = 'none';
    this.clearAll();
  }

  toggle() {
    this.isEnabled ? this.disable() : this.enable();
  }

  addDanmaku(text, options = {}) {
    if (!this.isEnabled || !text) return null;
    this.pendingQueue.push({ text, options });

    if (!this.animationFrame) {
    this.startAnimation();
    }
    return true;
  }

  _dispatchPending(now) {
    if (this.pendingQueue.length === 0) return;
    if (this.activeDanmaku.length >= this.maxDanmaku) return;

    // 🌟 核心改动：检查是否到达下一次允许发射的时间
    if (now < this.nextLaunchTime) return;

    const layer = this._getLayer();
    if (!layer) return;

    const nextReq = this.pendingQueue[0];

    // 速度波动 (±40%)
    const variance = this.baseDuration * 0.40;
    const duration = this.baseDuration + (Math.random() * variance * 2 - variance);

    // 从对象池取件并测量
    const pill = this._getPillElement();
    pill.textContent = nextReq.text;
    if (nextReq.options.color) pill.style.color = nextReq.options.color;
    // 兼容CSS类名传参
    if (nextReq.options.className) pill.classList.add(nextReq.options.className);

    // 挂载用于计算宽度
    layer.appendChild(pill);
    const width = pill.offsetWidth;

    const laneIndex = this._getBestLane(duration, width, now);

    if (laneIndex === -1) {
    // 拥堵退回池子
    this._recyclePillElement(pill);
    this.nextLaunchTime = now + 100;
    return;
    }

    this.pendingQueue.shift();

    // 🌟 核心改动：成功发射一条后，随机生成下一次发射的时间点
    // 这样弹幕之间就会有长短不一的间隙，显得更像真人发送
    const randomDelay = Math.random() * (this.maxLaunchInterval - this.minLaunchInterval) + this.minLaunchInterval;
    this.nextLaunchTime = now + randomDelay;

    // 将 48 改为 88 (使用88%的屏幕高度，底部留白12%避免遮挡最底部的UI操作区)
    const laneHeightPct = 88 / this.laneCount;
    // 基础偏移改为 5，让最顶部的弹幕稍微往下一点，别贴死屏幕边缘
    const baseTop = laneIndex * laneHeightPct + 5;

    const jitter = (Math.random() - 0.5) * 4;
    const finalTop = Math.max(0, baseTop + jitter);

    pill.style.top = `${finalTop}%`;
    pill.style.opacity = '1';
    pill.style.willChange = 'transform';

    const danmaku = {
    element: pill,
    text: nextReq.text,
    startTime: now,
    duration: duration,
    width: width,
    lane: laneIndex
    };

    this.activeDanmaku.push(danmaku);
    this.lanes[laneIndex] = danmaku;
  }

  // ========== 动画引擎 ==========

  startAnimation() {
    if (this.animationFrame) return;

    const layer = this._getLayer();
    if (layer) this.containerWidth = layer.offsetWidth || window.innerWidth;

    const animate = () => {
    if (!this.isEnabled) {
      this.animationFrame = null;
      return;
    }

    const now = Date.now();
    this._dispatchPending(now);

    const toRemove = [];

    this.activeDanmaku.forEach((danmaku, index) => {
      const elapsed = now - danmaku.startTime;
      const progress = elapsed / danmaku.duration;

      if (progress >= 1) {
      toRemove.push(index);
      if (this.lanes[danmaku.lane] === danmaku) {
        this.lanes[danmaku.lane] = null;
      }
      // 🌟 动画结束，启动严格回收流程
      this._recyclePillElement(danmaku.element);
      } else {
      const totalDistance = this.containerWidth + danmaku.width;
      const translateX = -(progress * totalDistance);
      // 移动端可考虑加上 translateZ(0) 强制开启硬件加速
      danmaku.element.style.transform = `translate3d(${translateX}px, 0, 0)`;
      }
    });

    toRemove.reverse().forEach(index => {
      this.activeDanmaku.splice(index, 1);
    });

    if (this.activeDanmaku.length === 0 && this.pendingQueue.length === 0) {
      this.animationFrame = null;
      return;
    }

    this.animationFrame = requestAnimationFrame(animate);
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  stopAnimation() {
    if (this.animationFrame) {
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    }
  }

  clearAll() {
    this.activeDanmaku.forEach(danmaku => {
    this._recyclePillElement(danmaku.element);
    });
    this.activeDanmaku = [];
    this.pendingQueue = [];
    this.lanes.fill(null);
  }

  cleanup() {
    this.disable();
    this.clearAll();
    this.domPool = []; // 彻底清空内存
  }
  }

  // 挂载实例
  const danmakuOptimizer = new DanmakuOptimizer();
  if (window.PerformanceOptimizer) {
  window.PerformanceOptimizer.danmakuOptimizer = danmakuOptimizer;
  const originalCleanup = window.PerformanceOptimizer.cleanup;
  window.PerformanceOptimizer.cleanup = function() {
    danmakuOptimizer.cleanup();
    originalCleanup.call(this);
  };
  }
  window.DanmakuOptimizer = DanmakuOptimizer;
})();

// ==================== 弹幕优化器结束 ====================

// ==================== 性能监控器 ====================
// Feature: mobile-performance-optimization

// ========================================================

(function() {
  'use strict';

  /**
   * 性能监控器
   * 监控FPS、内存、长任务等性能指标，提供诊断信息
   */

