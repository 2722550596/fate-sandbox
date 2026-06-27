// 文件: perf-end.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================


// --- L12110-12228:  ---


  // 创建全局实例并集成到PerformanceOptimizer
const performanceMonitor = new PerformanceMonitor();

if (window.PerformanceOptimizer) {
  window.PerformanceOptimizer.performanceMonitor = performanceMonitor;

  /* ========================================
     性能监控器已禁用（生产环境优化）
     如需启用，取消下面的注释
     ======================================== */
  /*
  // 如果配置启用，自动开始监控
  if (window.PerformanceOptimizer.config.monitor.enabled) {
    // 延迟启动，避免影响初始化
    setTimeout(() => {
    performanceMonitor.start();
    }, 2000);
  }
  */

  // 扩展清理方法
  const originalCleanup = window.PerformanceOptimizer.cleanup;
  window.PerformanceOptimizer.cleanup = function() {
    performanceMonitor.stop();
    originalCleanup.call(this);
  };

  console.log('[PerformanceMonitor] 已集成到PerformanceOptimizer');
  }

  // 导出到全局（用于调试）
  window.PerformanceMonitor = PerformanceMonitor;
})();

// ==================== 性能监控器结束 ====================



// ==================== 性能优化模块结束 ====================

/* ========================================
   已禁用：旧的 window.gameApp drawer 函数
   现在统一使用全局的 toggleDrawer/closeDrawer 函数
   ======================================== */
/*
window.gameApp.toggleDrawer = function(side) {
  const drawer = document.getElementById(`${side}-drawer`);
  const overlay = document.querySelector('.drawer-overlay');
  if (!drawer || !overlay) return;

  const isOpen = drawer.style.right === '0px' || drawer.style.left === '0px';

  // 关闭所有抽屉
  const panels = document.querySelectorAll('.drawer-panel');
  if (panels) {
    (panels.forEach ? panels : Array.from(panels)).forEach(d => {
    if (d.classList.contains('left')) d.style.left = '-320px';
    if (d.classList.contains('right')) d.style.right = '-320px';
  });
  }

  // 如果不是打开状态，则打开当前抽屉
  if (!isOpen) {
    if (side === 'left') drawer.style.left = '0px';
    if (side === 'right') drawer.style.right = '0px';
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
};

window.gameApp.closeDrawer = function(side) {
  const drawer = document.getElementById(`${side}-drawer`);
  const overlay = document.querySelector('.drawer-overlay');
  if (!drawer || !overlay) return;

  if (side === 'left') drawer.style.left = '-320px';
  if (side === 'right') drawer.style.right = '-320px';

  // 检查是否还有其他抽屉打开
  const panels = document.querySelectorAll('.drawer-panel');
  const hasOpenDrawer = Array.from(panels || []).some(d => {
    return d.style.left === '0px' || d.style.right === '0px';
  });
  if (!hasOpenDrawer) {
    overlay.classList.remove('active');
  }
};

window.gameApp.closeAllDrawers = function() {
  const panels = document.querySelectorAll('.drawer-panel');
  if (panels) {
    (panels.forEach ? panels : Array.from(panels)).forEach(d => {
    if (d.classList.contains('left')) d.style.left = '-320px';
    if (d.classList.contains('right')) d.style.right = '-320px';
  });
  }
  const overlay = document.querySelector('.drawer-overlay');
  if (overlay) overlay.classList.remove('active');
};

// 键盘快捷键
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.gameApp.closeAllDrawers();
  }
});
*/
// ========== 抽屉控制函数结束 ==========





//***************************************
//~~~~~~~~~~编辑区域开始~~~~~~~~~~~~
//***************************************


