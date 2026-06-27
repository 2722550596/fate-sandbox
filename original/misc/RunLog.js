// 文件: RunLog.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================

// --- L13577-13726: // ====== 🛠️ 全局工具：游戏运行日志管理器 (Console 劫持与导出) ====== ---

// ====== 🛠️ 全局工具：游戏运行日志管理器 (Console 劫持与导出) ======
const GameLogsManager = {
  // 最大保留日志数，防止无限增长导致手机端浏览器内存溢出
  maxLogs: 300,
  logs: [],

  // 备份原生的 console 方法
  originalConsole: {
    log: console.log,
    warn: console.warn,
    error: console.error,
  },

  isInitialized: false,

  // 🌟 初始化入口
  init() {
    if (this.isInitialized) return;

    // 1. 劫持原生 Console
    console.log = (...args) => {
      this.addLog("INFO", ...args);
      this.originalConsole.log.apply(console, args);
    };

    console.warn = (...args) => {
      this.addLog("WARN", ...args);
      this.originalConsole.warn.apply(console, args);
    };

    console.error = (...args) => {
      this.addLog("ERROR", ...args);
      this.originalConsole.error.apply(console, args);
    };

    // ✨ 2. 捕获全局未处理的同步异常 (Uncaught Exceptions)
    window.addEventListener("error", (event) => {
      const errorMsg = event.error
        ? event.error.stack
        : `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      this.addLog("FATAL", "[Uncaught Exception]", errorMsg);
      // 注意：这里不阻止默认事件，让 F12 控制台依然能标红显示
    });

    // ✨ 3. 捕获全局未处理的异步/Promise异常 (Unhandled Promise Rejections)
    window.addEventListener("unhandledrejection", (event) => {
      let reasonStr = "Unknown Promise Rejection";
      if (event.reason instanceof Error) {
        reasonStr = event.reason.stack || event.reason.message;
      } else if (typeof event.reason === "object") {
        try {
          reasonStr = JSON.stringify(event.reason);
        } catch (e) {
          reasonStr = String(event.reason);
        }
      } else {
        reasonStr = String(event.reason);
      }
      this.addLog("FATAL", "[Unhandled Promise Rejection]", reasonStr);
    });

    this.isInitialized = true;
    this.originalConsole.log(
      "【GameLogsManager】历史迷雾观测器已启动，天网已展开，开始记录底层法则运行轨迹...",
    );
  },

  // 核心逻辑：解析参数并推入日志池
  // 核心逻辑：解析参数并推入日志池
  addLog(type, ...args) {
    const message = args
      .map((arg) => {
        // 1. 处理基础类型和 null
        if (typeof arg !== "object" || arg === null) {
          return String(arg);
        }

        // ✨ 2. 终极防御：鸭子类型检测 Error。
        // 涵盖原生 Error、DOMException (如 AbortError)、第三方自定义错误等。
        if (
          arg instanceof Error ||
          arg instanceof DOMException ||
          (arg.message !== undefined && arg.stack !== undefined)
        ) {
          return `${arg.name || "Error"}: ${arg.message}\n${arg.stack}`;
        }

        // 3. 处理普通对象
        try {
          const jsonStr = JSON.stringify(arg, null, 2);

          // ✨ 4. 解决“伪装的空对象”问题。
          // 如果 stringify 返回了 "{}"，但对象本身其实有不可枚举属性，我们暴力提取它。
          if (jsonStr === "{}" && Object.getOwnPropertyNames(arg).length > 0) {
            const explicitObj = {};
            Object.getOwnPropertyNames(arg).forEach((key) => {
              explicitObj[key] = arg[key];
            });
            return JSON.stringify(explicitObj, null, 2);
          }

          return jsonStr;
        } catch (e) {
          return String(arg); // 兜底：处理循环引用导致的 stringify 崩溃
        }
      })
      .join(" ");

    // 获取当前时间 (HH:MM:SS)
    const timestamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });

    this.logs.push({ timestamp, type, message });

    // 超过上限则剔除最旧的记录
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  },

  // 供源堡系统调用，获取所有格式化好的日志
  getLogs() {
    return this.logs;
  },

  // 供源堡系统调用，清理屏幕日志
  clearLogs() {
    this.logs = [];
    this.originalConsole.log("【GameLogsManager】历史迷雾已肃清。");
  },

  // 📦 核心功能：导出日志为 TXT 文件
  exportLogs() {
    if (this.logs.length === 0) {
      console.warn("当前没有可导出的运行日志。");
      return;
    }

    let content = "=== 诡秘之主：源堡观测记录 (Game Debug Logs) ===\n";
    content += `导出时间: ${new Date().toLocaleString("zh-CN")}\n`;
    content += `记录条数: ${this.logs.length}\n`;
    content += "=================================================\n\n";

    this.logs.forEach((log) => {
      content += `[${log.timestamp}] [${log.type}] ${log.message}\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Guimi_Debug_Logs_${new Date().getTime()}.txt`;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
