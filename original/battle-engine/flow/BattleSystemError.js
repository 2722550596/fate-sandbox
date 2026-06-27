// BattleSystemError.js - 来源: original.js

// === class BattleSystemError (行 6850-6863) ===

class BattleSystemError extends Error {
  /**
   * 构造函数
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @param {Object} details - 错误详情
   */
  constructor(message, code, details) {
    super(message);
    this.name = "BattleSystemError";
    this.code = code;
    this.details = details;
  }
}
