// Hero.js - 来源: original.js

// === class Hero (行 881-999) ===

class Hero {
  constructor(config) {
    this.heroId = config.heroId ?? this.generateUUID();
    this.name = config.name ?? "Unknown";
    this.attack = config.attack ?? 0;
    this.defense = config.defense ?? 0;
    this.speed = config.speed ?? 0;
    this.health = config.health ?? 100;
    this.maxHealth = config.health ?? 100;
    this.currentHealth = config.currentHealth ?? config.health ?? 100;
    this.level = config.level || 1;
    this.effects = config.effects || [];
    this.moveSet = config.moveSet || [];

    // 诡秘之主扩展属性
    this.additionalStats = config.additionalStats || {};
    this.sequenceRank = config.sequenceRank !== undefined ? config.sequenceRank : 10;
    this.sequenceString = config.sequenceString || "普通人";
    this.dataSource = config.dataSource || "npc";
    this.originalData = config.originalData || {};

    // NvN 战斗模式扩展
    this.teamType = config.teamType || "ally"; // 'ally' 或 'enemy'

    // Buff/Debuff系统：六维属性基础值快照（用于重算）
    this.baseStats = config.baseStats || {};

    // 🆕 标签系统：标签数组
    this.tags = config.tags || [];
  }

  generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  getName() {
    return this.name;
  }
  setName(name) {
    this.name = name;
  }

  getAttack() {
    return this.attack;
  }
  setAttack(attack) {
    this.attack = attack;
  }

  getDefense() {
    return this.defense;
  }
  setDefense(defense) {
    this.defense = defense;
  }

  getMaxHealth() {
    return this.maxHealth;
  }
  setMaxHealth(maxHealth) {
    this.maxHealth = maxHealth;
  }

  getHealth() {
    return this.currentHealth;
  }
  setHealth(health) {
    this.currentHealth = health;
  }

  getSpeed() {
    return this.speed;
  }
  setSpeed(speed) {
    this.speed = speed;
  }

  getHeroId() {
    return this.heroId;
  }
  setHeroId(heroId) {
    this.heroId = heroId;
  }

  getLevel() {
    return this.level;
  }
  setLevel(level) {
    this.level = level;
  }

  getEffects() {
    return this.effects;
  }
  setEffects(effects) {
    this.effects = effects;
  }

  getMoveSet() {
    return this.moveSet;
  }
  setMoveSet(moves) {
    this.moveSet = moves.map((m) => new Move(m));
  }

  addEffect(effect) {
    this.effects.push(effect);
  }

  /**
   * 重写伤害应用方法
   */
  takeDamage(damage, damageType = "physical") {
    const targetAttribute = AttributeCalculator.getTargetAttribute(damageType);

    return DamageCalculator.applyDamage(this, {
      damage: damage,
      targetAttribute: targetAttribute,
      damageType: damageType,
    });
  }

  /**
   * 获取当前状态摘要
   */
  getStatusSummary() {
    return {
      name: this.name,
      sequenceRank: this.sequenceRank,
      sequenceString: this.sequenceString,
      // 当前值
      currentVitality: this.additionalStats.当前活力,
      currentAgility: this.additionalStats.当前敏捷,
      currentSpirit: this.additionalStats.当前灵性,
      currentSanity: this.additionalStats.当前理智,
      currentHumanity: this.additionalStats.当前人性,
      // 上限值（修改：去掉"上限"后缀）
      maxVitality: this.additionalStats.活力,
      maxAgility: this.additionalStats.敏捷,
      maxSpirit: this.additionalStats.灵性,
      maxSanity: this.additionalStats.理智,
      maxHumanity: this.additionalStats.人性,
      // 其他属性
      luck: this.additionalStats.运气,
      divinity: this.additionalStats.神性,
      // 战斗显示需要的字段
      originalData: this.originalData,
      dataSource: this.dataSource,
      effects: this.effects || [],
      teamType: this.teamType,
    };
  }
}
