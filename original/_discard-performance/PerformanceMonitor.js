// PerformanceMonitor.js - 来源: original.js

// === class PerformanceMonitor (行 11738-12109) ===

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: [], // FPS记录
      memory: [], // 内存记录
      longTasks: [], // 长任务记录
      operations: [], // 操作耗时记录
    };

    this.isMonitoring = false;
    this.fpsInterval = null;
    this.memoryInterval = null;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;

    // 从配置获取阈值
    const config = window.PerformanceOptimizer ? window.PerformanceOptimizer.config.monitor : {};
    this.fpsThreshold = config.fpsThreshold || 30;
    this.memoryThreshold = config.memoryThreshold || 100; // MB
    this.longTaskThreshold = config.longTaskThreshold || 50; // ms

    console.log("[PerformanceMonitor] 已创建");
    console.log(
      `[PerformanceMonitor] 阈值: FPS=${this.fpsThreshold}, 内存=${this.memoryThreshold}MB, 长任务=${this.longTaskThreshold}ms`,
    );
  }

  /**
   * 启动性能监控
   */
  start() {
    if (this.isMonitoring) {
      console.log("[PerformanceMonitor] 已在监控中");
      return;
    }

    this.isMonitoring = true;
    console.log("[PerformanceMonitor] 启动性能监控");

    // 监控FPS
    this.monitorFPS();

    // 监控内存（如果支持）
    if (performance.memory) {
      this.monitorMemory();
    } else {
      console.log("[PerformanceMonitor] 浏览器不支持内存监控");
    }

    // 监控长任务（如果支持）
    if ("PerformanceObserver" in window) {
      this.monitorLongTasks();
    } else {
      console.log("[PerformanceMonitor] 浏览器不支持长任务监控");
    }
  }

  /**
   * 停止性能监控
   */
  stop() {
    if (!this.isMonitoring) {
      console.log("[PerformanceMonitor] 未在监控中");
      return;
    }

    this.isMonitoring = false;
    console.log("[PerformanceMonitor] 停止性能监控");

    // 停止FPS监控
    if (this.fpsInterval) {
      cancelAnimationFrame(this.fpsInterval);
      this.fpsInterval = null;
    }

    // 停止内存监控
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }

    // PerformanceObserver会自动停止
  }

  /**
   * 监控FPS
   * @private
   */
  monitorFPS() {
    const measureFPS = (currentTime) => {
      if (!this.isMonitoring) return;

      this.frameCount++;
      const delta = currentTime - this.lastFrameTime;

      // 每秒计算一次FPS
      if (delta >= 1000) {
        const fps = Math.round((this.frameCount * 1000) / delta);

        this.metrics.fps.push({
          value: fps,
          timestamp: Date.now(),
        });

        // 只保留最近100条记录
        if (this.metrics.fps.length > 100) {
          this.metrics.fps.shift();
        }

        // FPS过低时警告
        if (fps < this.fpsThreshold) {
          console.warn(`[PerformanceMonitor] ⚠️ FPS过低: ${fps} (阈值: ${this.fpsThreshold})`);
          this.triggerOptimization("low-fps", { fps });
        }

        this.frameCount = 0;
        this.lastFrameTime = currentTime;
      }

      this.fpsInterval = requestAnimationFrame(measureFPS);
    };

    this.fpsInterval = requestAnimationFrame(measureFPS);
  }

  /**
   * 监控内存
   * @private
   */
  monitorMemory() {
    this.memoryInterval = setInterval(() => {
      if (!this.isMonitoring) return;

      const memory = performance.memory;
      const usedMB = memory.usedJSHeapSize / 1048576;
      const totalMB = memory.totalJSHeapSize / 1048576;
      const limitMB = memory.jsHeapSizeLimit / 1048576;

      this.metrics.memory.push({
        used: usedMB,
        total: totalMB,
        limit: limitMB,
        timestamp: Date.now(),
      });

      // 只保留最近50条记录
      if (this.metrics.memory.length > 50) {
        this.metrics.memory.shift();
      }

      // 内存使用过高时警告
      if (usedMB > this.memoryThreshold) {
        console.warn(
          `[PerformanceMonitor] ⚠️ 内存使用过高: ${usedMB.toFixed(1)}MB (阈值: ${this.memoryThreshold}MB)`,
        );
        this.triggerOptimization("high-memory", { usedMB, totalMB });
      }
    }, 5000); // 每5秒检查一次
  }

  /**
   * 监控长任务
   * @private
   */
  monitorLongTasks() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > this.longTaskThreshold) {
            const task = {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
              timestamp: Date.now(),
            };

            this.metrics.longTasks.push(task);

            // 只保留最近30条记录
            if (this.metrics.longTasks.length > 30) {
              this.metrics.longTasks.shift();
            }

            console.warn(
              `[PerformanceMonitor] ⚠️ 检测到长任务: ${entry.duration.toFixed(1)}ms (阈值: ${this.longTaskThreshold}ms)`,
            );
            this.triggerOptimization("long-task", task);
          }
        }
      });

      observer.observe({ entryTypes: ["longtask", "measure"] });
    } catch (e) {
      console.log("[PerformanceMonitor] 长任务监控不支持:", e.message);
    }
  }

  /**
   * 记录操作耗时
   * @param {string} operationName - 操作名称
   * @param {number} duration - 耗时（毫秒）
   */
  recordOperation(operationName, duration) {
    this.metrics.operations.push({
      name: operationName,
      duration: duration,
      timestamp: Date.now(),
    });

    // 只保留最近100条记录
    if (this.metrics.operations.length > 100) {
      this.metrics.operations.shift();
    }

    if (duration > 100) {
      console.warn(
        `[PerformanceMonitor] ⚠️ 操作耗时过长: ${operationName} (${duration.toFixed(1)}ms)`,
      );
    }
  }

  /**
   * 测量函数执行时间
   * @param {string} name - 操作名称
   * @param {Function} fn - 要测量的函数
   * @returns {*} 函数返回值
   */
  measure(name, fn) {
    const startTime = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.recordOperation(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordOperation(name + " (error)", duration);
      throw error;
    }
  }

  /**
   * 测量异步函数执行时间
   * @param {string} name - 操作名称
   * @param {Function} fn - 要测量的异步函数
   * @returns {Promise<*>} 函数返回值
   */
  async measureAsync(name, fn) {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordOperation(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordOperation(name + " (error)", duration);
      throw error;
    }
  }

  /**
   * 触发性能优化
   * @private
   */
  triggerOptimization(type, data) {
    // 可以在这里触发自动优化措施
    // 例如：降低弹幕数量、禁用动画等
    console.log(`[PerformanceMonitor] 触发优化: ${type}`, data);

    // 触发自定义事件，让其他模块响应
    if (typeof window.CustomEvent === "function") {
      const event = new CustomEvent("performance-issue", {
        detail: { type, data },
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * 获取性能报告
   * @returns {Object} 性能报告
   */
  getReport() {
    const avgFPS =
      this.metrics.fps.length > 0
        ? this.metrics.fps.reduce((sum, item) => sum + item.value, 0) / this.metrics.fps.length
        : 0;

    const latestMemory = this.metrics.memory[this.metrics.memory.length - 1];

    const avgOperationTime =
      this.metrics.operations.length > 0
        ? this.metrics.operations.reduce((sum, item) => sum + item.duration, 0) /
          this.metrics.operations.length
        : 0;

    return {
      summary: {
        averageFPS: avgFPS.toFixed(1),
        currentMemory: latestMemory
          ? `${latestMemory.used.toFixed(1)}MB / ${latestMemory.total.toFixed(1)}MB`
          : "N/A",
        longTasksCount: this.metrics.longTasks.length,
        operationsCount: this.metrics.operations.length,
        avgOperationTime: avgOperationTime.toFixed(2) + "ms",
        timestamp: new Date().toISOString(),
      },
      thresholds: {
        fps: this.fpsThreshold,
        memory: this.memoryThreshold + "MB",
        longTask: this.longTaskThreshold + "ms",
      },
      status: {
        fpsOK: avgFPS >= this.fpsThreshold,
        memoryOK: latestMemory ? latestMemory.used < this.memoryThreshold : true,
        longTasksOK: this.metrics.longTasks.length === 0,
      },
    };
  }

  /**
   * 导出详细报告
   * @returns {Object} 详细报告
   */
  exportReport() {
    const report = {
      summary: this.getReport(),
      detailedMetrics: {
        fps: this.metrics.fps.slice(-20), // 最近20条
        memory: this.metrics.memory.slice(-20),
        longTasks: this.metrics.longTasks,
        operations: this.metrics.operations.slice(-50), // 最近50条
      },
      systemInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        cores: navigator.hardwareConcurrency || "unknown",
        memory: navigator.deviceMemory ? navigator.deviceMemory + "GB" : "unknown",
        connection: navigator.connection ? navigator.connection.effectiveType : "unknown",
      },
    };

    // 下载为JSON文件
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    console.log("[PerformanceMonitor] 报告已导出");
    return report;
  }

  /**
   * 清除所有指标
   */
  clearMetrics() {
    this.metrics.fps = [];
    this.metrics.memory = [];
    this.metrics.longTasks = [];
    this.metrics.operations = [];
    console.log("[PerformanceMonitor] 指标已清除");
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      isMonitoring: this.isMonitoring,
      fpsRecords: this.metrics.fps.length,
      memoryRecords: this.metrics.memory.length,
      longTasks: this.metrics.longTasks.length,
      operations: this.metrics.operations.length,
    };
  }
}
