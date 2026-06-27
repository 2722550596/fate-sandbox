// OptimizedEventManager.js - 来源: original.js

// === class OptimizedEventManager (行 9306-9429) ===

class OptimizedEventManager {
  constructor(domCache) {
    this.domCache = domCache;
    this.listeners = [];
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    const clickHandler = (e) => {
      const target = e.target;

      if (target.classList.contains("drawer-trigger")) {
        e.preventDefault();
        const side = target.classList.contains("left") ? "left" : "right";
        this.handleDrawerToggle(side);
        return;
      }

      if (target.classList.contains("drawer-close")) {
        e.preventDefault();
        const drawer = target.closest(".drawer-panel");
        if (drawer) {
          const side = drawer.classList.contains("left") ? "left" : "right";
          this.handleDrawerClose(side);
        }
        return;
      }

      if (target.classList.contains("drawer-overlay")) {
        e.preventDefault();
        this.handleCloseAll();
        return;
      }
    };

    document.addEventListener("click", clickHandler, { passive: false });
    this.listeners.push({ element: document, event: "click", handler: clickHandler });

    const keyHandler = (e) => {
      if (e.key === "Escape") {
        this.handleCloseAll();
      }
    };
    document.addEventListener("keydown", keyHandler);
    this.listeners.push({ element: document, event: "keydown", handler: keyHandler });

    this.isInitialized = true;
  }

  handleDrawerToggle(side) {
    // 增加原生 DOM 查询兜底，防止 domCache 失效
    const drawer = this.domCache.get(`${side}-drawer`) || document.getElementById(`${side}-drawer`);
    const overlay =
      this.domCache.get("drawer-overlay") || document.querySelector(".drawer-overlay");

    // 找不到元素直接安全返回，不引发崩溃
    if (!drawer || !overlay) return;

    const isOpen = drawer.classList.contains("open");

    if (!isOpen) {
      // 🔥 增加 || [] 兜底，防止 forEach 崩溃
      const allDrawers =
        this.domCache.getAll("all-drawers") ||
        Array.from(document.querySelectorAll(".drawer-panel")) ||
        [];

      requestAnimationFrame(() => {
        allDrawers.forEach((d) => {
          if (d !== drawer && d.classList.contains("open")) {
            d.classList.remove("open");
          }
        });

        drawer.classList.add("open");
        overlay.classList.add("active");
      });
    } else {
      drawer.classList.remove("open");

      const allDrawers =
        this.domCache.getAll("all-drawers") ||
        Array.from(document.querySelectorAll(".drawer-panel")) ||
        [];
      const hasOpenDrawer = Array.from(allDrawers).some((d) => d.classList.contains("open"));

      if (!hasOpenDrawer) {
        overlay.classList.remove("active");
      }
    }
  }

  handleDrawerClose(side) {
    const drawer = this.domCache.get(`${side}-drawer`) || document.getElementById(`${side}-drawer`);
    const overlay =
      this.domCache.get("drawer-overlay") || document.querySelector(".drawer-overlay");

    if (!drawer || !overlay) return;

    drawer.classList.remove("open");

    const allDrawers =
      this.domCache.getAll("all-drawers") ||
      Array.from(document.querySelectorAll(".drawer-panel")) ||
      [];
    const hasOpenDrawer = Array.from(allDrawers).some((d) => d.classList.contains("open"));

    if (!hasOpenDrawer) {
      overlay.classList.remove("active");
    }
  }

  handleCloseAll() {
    const allDrawers =
      this.domCache.getAll("all-drawers") ||
      Array.from(document.querySelectorAll(".drawer-panel")) ||
      [];
    const overlay =
      this.domCache.get("drawer-overlay") || document.querySelector(".drawer-overlay");

    Array.from(allDrawers).forEach((drawer) => {
      drawer.classList.remove("open");
    });

    if (overlay) {
      overlay.classList.remove("active");
    }
  }

  cleanup() {
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];
    this.isInitialized = false;
  }
}
