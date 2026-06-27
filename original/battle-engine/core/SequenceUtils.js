// 文件: SequenceUtils.js
// 来源: original.js
// 包含 1 个非类代码段
// ==========================================

// --- L141-179:  ---

/**
 * 将序列等级转换为对应的CSS类名
 * @param {number} sequenceRank - 序列等级数值
 * @returns {string} CSS类名
 */
function getSequenceCssClass(sequenceRank) {
  if (sequenceRank === null || sequenceRank === undefined) return "";

  // 特殊序列映射
  if (sequenceRank === -2) return "tier-pillar";
  if (sequenceRank === -1) return "tier-outer-god";
  if (sequenceRank === 10) return ""; // 普通人不需要特殊样式

  // 小数序列映射（0.1-0.9之间的特殊层级）
  const decimalMap = {
    0.1: "tier-seq-0",
    0.3: "tier-angel-high",
    0.4: "tier-angel-high",
    0.5: "tier-angel-high",
    0.8: "tier-angel-high",
    0.9: "tier-seq-1",
  };

  if (decimalMap[sequenceRank] !== undefined) {
    return decimalMap[sequenceRank];
  }

  // 整数序列映射（0-9）
  if (sequenceRank >= 0 && sequenceRank <= 9) {
    return `tier-seq-${Math.floor(sequenceRank)}`;
  }

  return "";
}

// ==========================================
// 2. AttributeCalculator (属性计算器)
// ==========================================
