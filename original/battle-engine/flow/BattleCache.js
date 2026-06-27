// BattleCache.js - 来源: original.js

// === class BattleCache (行 1621-1649) ===

class BattleCache {
  constructor() {
    this.attributeCache = new Map();
    this.damageCache = new Map();
  }

  getCachedAttribute(characterName, attributeName) {
    const key = `${characterName}_${attributeName}`;
    return this.attributeCache.get(key);
  }

  setCachedAttribute(characterName, attributeName, value) {
    const key = `${characterName}_${attributeName}`;
    this.attributeCache.set(key, value);
  }

  clearCache() {
    this.attributeCache.clear();
    this.damageCache.clear();
    console.log("[BattleCache] 缓存已清空");
  }

  getCacheSize() {
    return {
      attributes: this.attributeCache.size,
      damage: this.damageCache.size,
    };
  }
}
