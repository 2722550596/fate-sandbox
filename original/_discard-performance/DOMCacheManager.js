// DOMCacheManager.js - 来源: original.js

// === class DOMCacheManager (行 9252-9303) ===

class DOMCacheManager {
  constructor() {
    // 不再自己维护 Map，彻底沦为一个“空壳代理”
    console.log(
      "%c[缓存池打通] 旧版壳子已就绪，请求将全部转发给新版引擎。",
      "color: var(--color-warning); font-weight: bold;",
    );
  }

  // 核心：获取新版引擎的实例
  getProEngine() {
    return window.PerformanceOptimizer && window.PerformanceOptimizer.domCache;
  }

  init() {
    // 🔥 终极优化：直接拦截旧版的致命同步扫描！
    console.log(
      "%c[缓存池打通] 成功拦截旧版致命的 init() 全量扫描，已放行！",
      "color: var(--color-success)",
    );
  }

  // 核心修正：接收 selector 参数并传递
  get(key, selector) {
    const pro = this.getProEngine();
    const finalSelector = selector || this._getFallbackSelector(key);

    if (!pro) return document.querySelector(finalSelector);
    // 确保把 selector 传给新引擎，实现“按需缓存”
    return pro.get(key, finalSelector);
  }

  getAll(key, selector) {
    const pro = this.getProEngine();
    const finalSelector = selector || this._getFallbackSelector(key);

    if (!pro) return document.querySelectorAll(finalSelector);
    // 交给新版引擎处理 NodeList 缓存
    return pro.getAll(key, finalSelector);
  }

  clear() {
    console.log("[缓存池打通] 拦截了旧版的 clear()，统一由新版引擎接管生命周期。");
  }

  // 字典映射：告诉新版，旧版的这些 key 对应的选择器是什么
  _getFallbackSelector(key) {
    const dict = {
      "left-drawer": "#left-drawer",
      "right-drawer": "#right-drawer",
      "drawer-overlay": ".drawer-overlay",
      "all-drawers": ".drawer-panel",
      "all-interaction-btns": ".interaction-btn",
      "drawer-trigger": ".drawer-trigger",
    };
    return dict[key] || "";
  }
}
