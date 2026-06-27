// TurnResultPool.js - 来源: original.js

// === class TurnResultPool (行 6798-6842) ===

class TurnResultPool {
  /**
   * 构造函数
   * @param {number} size - 对象池大小
   */
  constructor(size = 100) {
    this.pool = [];
    this.size = size;
    console.log(`[TurnResultPool] 对象池已创建，大小: ${size}`);
  }

  /**
   * 获取对象
   * @returns {Object} 对象
   */
  acquire() {
    return this.pool.pop() || {};
  }

  /**
   * 释放对象
   * @param {Object} obj - 要释放的对象
   */
  release(obj) {
    if (this.pool.length < this.size) {
      // 清空对象
      for (let key in obj) {
        delete obj[key];
      }
      this.pool.push(obj);
    }
  }

  /**
   * 获取池状态
   * @returns {Object} 池状态
   */
  getPoolStatus() {
    return {
      size: this.size,
      available: this.pool.length,
      inUse: this.size - this.pool.length,
    };
  }
}
