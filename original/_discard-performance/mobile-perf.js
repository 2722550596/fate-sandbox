// 文件: mobile-perf.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================

// --- L9117-9251:  ---

/* ========================================
   激进方案：立即禁用移动端所有日志
   ======================================== */
(function () {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

  if (isMobile) {
    const noop = function () {};

    // 保存原始error方法
    const originalError = console.error;
    const originalLog = console.log;

    // 禁用所有日志方法
    console.log = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    console.trace = noop;
    console.dir = noop;
    console.dirxml = noop;
    console.group = noop;
    console.groupCollapsed = noop;
    console.groupEnd = noop;
    console.time = noop;
    console.timeEnd = noop;
    console.timeLog = noop;
    console.count = noop;
    console.countReset = noop;
    console.assert = noop;
    console.profile = noop;
    console.profileEnd = noop;
    console.table = noop;
    console.clear = noop;

    // 只保留error
    console.error = originalError;

    // 立即输出一条确认信息
    originalError(
      "%c[移动端优化] 所有日志已禁用（仅保留error）",
      "color: green; font-weight: bold;",
    );

    // 保存到window以便后续检查
    window._mobileLogDisabled = true;
  }
})();

/* ========================================
   全局配置 - 调试模式开关
   ======================================== */
// 设置为false可以大幅减少日志输出，提升性能
window.DEBUG_MODE = false;

// 调试日志包装函数
window.debugLog = function (...args) {
  if (window.DEBUG_MODE) {
    console.log(...args);
  }
};

window.debugWarn = function (...args) {
  if (window.DEBUG_MODE) {
    console.warn(...args);
  }
};

// ========================================
//   全局日志过滤器 - 移动设备完全禁用日志
//   ========================================
(function () {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  // 检测是否为移动设备
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

  if (isMobile) {
    // 移动设备：完全禁用console.log和console.warn（保留error）
    console.log = function () {};
    console.warn = function () {};
    // console.error保留，用于调试严重问题

    // 在页面加载完成后输出一条提示
    window.addEventListener("load", () => {
      originalLog(
        "%c[性能优化] 移动设备已禁用console.log和console.warn以提升性能",
        "color: green; font-weight: bold;",
      );
    });
  } else {
    // PC设备：只过滤特定前缀的日志
    const filterPrefixes = [
      "[PerformanceOptimizer]",
      "[PerformanceMonitor]",
      "[DOMCache]",
      "[EventManager]",
      "[TimerManager]",
      "[RenderBatcher]",
      "[ThrottleDebounce]",
      "[DanmakuOptimizer]",
      "[性能优化]",
      "[事件委托]",
      "[RAF]",
      "[源堡]",
      "[CHAT_UPDATED]",
      "[MutationObserver]",
      "[历史系统]",
      "[TRACE-HISTORY]",
    ];

    console.log = function (...args) {
      const firstArg = String(args[0] || "");
      if (filterPrefixes.some((prefix) => firstArg.includes(prefix))) {
        return;
      }
      originalLog.apply(console, args);
    };

    console.warn = function (...args) {
      const firstArg = String(args[0] || "");
      if (filterPrefixes.some((prefix) => firstArg.includes(prefix))) {
        return;
      }
      originalWarn.apply(console, args);
    };
  }
})();

// ========================================
//   性能优化器 - 移动端性能优化
//   优化时间: 2026-01-12
//   ========================================

// ========================================
//   旧版 DOM缓存管理器 (代理融合版)
//   核心逻辑：全面架空旧版，将所有请求暗中转交给新版 Pro 引擎
// ========================================
