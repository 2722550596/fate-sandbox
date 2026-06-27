# LOTM 序列能力系统 — 代码研究结果

> Source file: `/mnt/d/developpement/LOTM/main_script.js` (45,389 lines)
> 战斗系统核心架构，类脑/旅程Gouy古弈作品

---

## 1. Power 计算逻辑（序列等级映射）

### 数据格式

`Move.power` 可以是 **number** 或 **Object（映射表）**：

```json
// 映射表形式：key 是序列等级，value 是技能倍率
"power": { "-2": 185000, "-1": 111000, "0": 44400, "9": 1.0 }
```

### 解析逻辑 —— `Move.getPower(caster)`

**文件**: lines 1042-1056

```js
getPower(caster = null) {
    // 如果power是对象（映射表），根据施法者序列等级返回对应值
    if (typeof this.power === 'object' && this.power !== null && caster) {
        const sequenceRank = caster.sequenceRank;
        // 尝试精确匹配序列等级
        if (this.power[sequenceRank] !== undefined) {
            return this.power[sequenceRank];
        }
        // 如果没有精确匹配，返回默认值或最低序列的power
        const defaultPower = this.power['default'] ?? this.power['9'] ?? 1.0;
        console.warn(`[Move] 技能 ${this.name} 没有为序列${sequenceRank}配置power，使用默认值: ${defaultPower}`);
        return defaultPower;
    }
    // 如果power是数字，直接返回
    return this.power !== undefined ? this.power : 1.0;
}
```

**key 说明**：`-2` = 支柱, `-1` = 旧日, `0` ~ `9` = 序列0~9, `10` = 普通人。power 值是对应序列等级的**技能威力倍率**（用于伤害公式中的 `effectivePower`）。

### 序列等级解析 —— `parseSequenceRank()`

**文件**: lines 13885-13894

```js
const parseSequenceRank = (sequenceStr) => {
  if (!sequenceStr || typeof sequenceStr !== "string") return 10;
  if (sequenceStr.includes("支柱")) return -2;
  if (sequenceStr.includes("旧日")) return -1;
  const numMatch = sequenceStr.match(/^\d+(?:\.\d+)?$/);
  if (numMatch) return Number(numMatch[0]);
  const seqMatch = sequenceStr.match(/序列[：:\s]*(\d+(?:\.\d+)?)/);
  if (seqMatch) return Number(seqMatch[1]);
  return 10; // 默认普通人
};
```

### 神性获取 —— `getSequenceDivinity()`

**文件**: lines 13917-13924

```js
const getSequenceDivinity = (sequenceRank) => {
  const config = GameDBManager.DB.divinityConfig.find(
    (c) => sequenceRank >= c.min && sequenceRank <= c.max,
  );
  return config ? config.val : 1;
};
```

### 基准总值获取 —— `getSequenceBaseValue()`

**文件**: lines 13926-13929

```js
const getSequenceBaseValue = (rank) => {
  return GameDBManager.DB.sequenceBase[String(rank)] || 200;
};
```

---

## 2. DamageCalculator — 伤害计算完整公式

**文件**: lines 466-753

### 主入口：`DamageCalculator.calculate(attacker, defender, skill)`

**文件**: lines 474-535

```js
static calculate(attacker, defender, skill) {
    const damageType = skill.damageType || 'physical';

    // 1. 检查是否使用自定义伤害计算器（fixedDamage/percentDamage/trueDamage）
    if (skill.customDamageCalculator) {
        const customCalculator = CustomDamageCalculators.getCalculator(skill.customDamageCalculator);
        if (customCalculator) {
            const damage = customCalculator(attacker, defender, skill);
            return { damage: Math.max(0, damage), ... };
        }
    }

    // 2. 根据伤害类型更新攻击者和防御者的 attack/defense 属性
    const attackerStats = AttributeCalculator.updateHeroStats(attacker, damageType);
    const defenderStats = AttributeCalculator.updateHeroStats(defender, damageType);

    // 3. 核心伤害计算
    const damage = this.calculateDamageWithDivinity(attacker, defender, skill);

    // 4. 确定目标属性（mental→当前理智，其他→当前活力）
    const targetAttribute = AttributeCalculator.getTargetAttribute(damageType);

    return { damage: Math.max(0, damage), targetAttribute, formula, damageType };
}
```

### 核心公式：`calculateDamageWithDivinity()`

**文件**: lines 544-585

```js
static calculateDamageWithDivinity(attacker, defender, skill) {
    const damageType = skill.damageType || 'physical';
    const attack = AttributeCalculator.calculateAttack(attacker, damageType);
    const defense = AttributeCalculator.calculateDefense(defender, damageType);

    const attackDefenseRatio = attack / defense;              // 攻防比
    const divinityModifier = attacker.additionalStats.神性 ?? 1;  // 神性修正
    const effectivePower = skill.getPower ? skill.getPower(attacker) : (skill.power ?? 1);  // 序列等级修正

    // 基础伤害 = 神性 × 技能倍率 × 攻防比
    let baseDamage = divinityModifier * effectivePower * attackDefenseRatio;

    // 随机浮动 0.9~1.1
    const randomFactor = 0.9 + Math.random() * 0.2;
    let damage = baseDamage * randomFactor;

    // 伤害修正（buff/debuff）：攻击者的"造成伤害" + 防御者的"受到伤害"
    const attackerMod = this.calculateDamageModifier(attacker, 'damageDealtIncrease', 'damageDealtDecrease');
    const defenderMod = this.calculateDamageModifier(defender, 'damageTakenIncrease', 'damageTakenDecrease');

    // 标签克制修正
    const tagMod = this.calculateTagModifier(attacker, defender, skill);

    const totalModifier = attackerMod + defenderMod + tagMod;
    damage = damage * (1 + totalModifier);

    return Math.max(0, Math.floor(damage));
}
```

**完整公式**：

```
damage = floor(max(0, 神性 × 技能倍率(序列映射) × (攻击力/防御力) × random(0.9,1.1) × (1 + 造成伤害修正 + 受到伤害修正 + 标签修正)))
```

### 自定义伤害计算器

**文件**: lines 3413-3470

| 名称            | 行为                       | 公式                                        |
| --------------- | -------------------------- | ------------------------------------------- | --- | --- |
| `fixedDamage`   | 固定值，无视攻防           | `move.power                                 |     | 50` |
| `percentDamage` | 基于目标当前活力的百分比   | `defender.当前活力 × (move.power \|\| 0.2)` |
| `trueDamage`    | 基于攻击方攻击力的真实伤害 | `attacker.attack × (move.power \|\| 1.0)`   |

### 伤害修正系数计算 —— `calculateDamageModifier()`

**文件**: lines 633-672

只处理 `valueType === 'percentage'` 的效果。检查 hero.effects 中以下四个 stat：

- `damageDealtIncrease`（自己的 buff）→ 加
- `damageDealtDecrease`（敌人的 debuff）→ 减
- `damageTakenIncrease`（敌人的 debuff）→ 加
- `damageTakenDecrease`（自己的 buff）→ 减

计算公式：`modifier += effect.power / 100`（百分比）

### 标签克制修正 —— `calculateTagModifier()`

**文件**: lines 681-752

- 通过 `window.tagManager.tagDamageRelations` 查攻击者标签→防御者标签的克制系数
- 所有匹配的 modifier 累加
- 封顶范围：**-75% ~ +150%**

### 伤害应用 —— `applyDamage()`

**文件**: lines 606-624

```js
static applyDamage(target, damageResult) {
    const targetAttr = damageResult.targetAttribute;  // '当前活力' 或 '当前理智'
    const newValue = Math.max(0, target.additionalStats[targetAttr] - damageResult.damage);
    target.additionalStats[targetAttr] = newValue;
    // 同步到 battle-engine 标准属性
    if (targetAttr === '当前活力') {
        target.health = newValue;
        target.currentHealth = newValue;
    }
    return { oldValue, newValue, actualDamage: currentValue - newValue };
}
```

---

## 3. Attack/Defense 计算 — AttributeCalculator

**文件**: lines 178-460

### `calculateAttack(hero, damageType)` / `calculateDefense(hero, damageType)`

```js
// 对所有伤害类型，先计算六维属性中的最大值
const maxStat = Math.max(当前活力, 当前敏捷, 当前灵性, 当前人性, 当前理智, 运气);

// 根据伤害类型选择 "专精属性(specific)" 和 "通用属性(max)"
switch (damageType) {
  case "physical":
    specific = (当前活力 + 当前敏捷) / 2;
    break;
  case "mystical":
    specific = 当前灵性;
    break;
  case "mental":
    specific = (当前理智 + 当前人性) / 2;
    break;
  case "mixed":
    specific = 运气;
    break;
}

// 公式：floor(specific × 0.4 + maxStat × 0.6)  → 然后 applyBuffDebuff
baseAttack = Math.floor(specific * 0.4 + maxStat * 0.6);
return this.applyBuffDebuff(hero, "attack", baseAttack);
```

**攻击/防御公式（相同结构）**：

```
finalValue = floor(max(0, baseValue × (1 + percentageModSum) + fixedModSum))
```

**伤害类型→目标属性映射** (`getTargetAttribute`):

- `physical` / `mystical` / `mixed` → `当前活力`
- `mental` → `当前理智`

### `applyBuffDebuff(hero, statName, baseValue)`

**文件**: lines 284-331

遍历 `hero.effects`，对每个 `type === 'buff'/'debuff'` 且 `stat === statName` 的效果：

- `valueType === 'percentage'`: `mod = effect.power / 100`，buff 正、debuff 负
- `valueType === 'fixed'`: 加减固定值

顺序：**基础值 → 百分比修正 → 固定值修正 → 向下取整**。

### `recalculateAllSixDimStats(hero)`

**文件**: lines 361-433

重算六维属性（活力、敏捷、灵性、理智、人性、运气）的上限值：

```
finalValue = floor(max(0, baseStats[stat] × (1 + buff/debuff百分比总和) + fixedTotal))
```

当前值超过新上限时自动下调。

---

## 4. Effects 处理逻辑 — EffectManager

**文件**: lines 3478-4049

### 效果验证（validateEffect）

支持的类型: `buff`, `debuff`, `poison`, `regen`。`valueType`:

- `'fixed'`: 固定值
- `'percentage'`: 百分比

### 效果施加 — `applyEffect(hero, effect, caster, skill)`

**文件**: lines 3617-3735

流程：

1. 验证、标准化（兼容旧 `modifier` 字段 → `power`×100）
2. 检查伤害修正系数（`damageDealtIncrease` 等）必须为 `percentage` 类型
3. `resolvePowerValue()` — 如果 power 是映射表，按 `caster.sequenceRank` 提取
4. 对 `poison`/`regen` 应用标签修正
5. 创建 `effectInstance`:
   ```js
   {
     (name, type, duration, power, stat, valueType, priority, triggerTiming, appliedAt);
   }
   ```
6. **同名效果替换规则**（lines 3688-3723）:
   - 新 power > 旧 power → 完全替换（更强覆盖）
   - power 相等且新持续时间更长 → 刷新持续时间
   - 新 power 更弱 → 拒绝
7. 如果影响六维属性（`isSixDimStat`），触发 `recalculateAllSixDimStats`

### 效果类型处理 — `processEffect(hero, effect)`

**文件**: lines 3792-3809

```js
switch (effect.type) {
  case "poison":
    return this.processPoisonEffect(hero, effect);
  case "regen":
    return this.processRegenEffect(hero, effect);
  case "buff":
    return this.processBuffEffect(hero, effect); // 仅日志，被动生效
  case "debuff":
    return this.processDebuffEffect(hero, effect); // 仅日志，被动生效
}
```

#### Poison 处理 — `processPoisonEffect()`

**文件**: lines 3874-3914

```js
// 1. 标准化配置
// 2. 获取目标属性（默认 '当前活力'）
// 3. 获取上限值（用于百分比计算）
// 4. damage = percentage ? floor(上限 × power/100) : power
// 5. 扣除：newValue = max(0, oldValue - damage)
// 6. 同步活力→health/currentHealth
```

#### Regen 处理 — `processRegenEffect()`

**文件**: lines 3970-4012

```js
// 治疗：newValue = min(上限, oldValue + healing)
// healing = percentage ? floor(上限 × power/100) : power
```

#### Buff/Debuff 处理

**文件**: lines 4020-4048 — 仅返回日志消息，被动生效于 `AttributeCalculator.applyBuffDebuff()` 和 `DamageCalculator.calculateDamageModifier()`。

### 批量处理 — `processEffects(heroes, battleLogger)`

**文件**: lines 3743-3784

- 遍历所有角色的所有效果
- 调用 `processEffect`，记录日志
- 减少 `duration`
- 移除 `duration <= 0` 的效果
- 触发六维属性重算

---

## 5. ConditionalParams — 条件参数系统

**文件**: lines 5827-6167 (条件逻辑系统核心组件)

### 组件架构

```
SkillLoader.parseAbilityConfig()
  → 解析 raw conditionalParams → [{ condition, params }]

BattleManager → parameterSelector: ParameterSelector
  →
TurnManager.executeAttack()
  → parameterSelector.selectParameters(skill, attacker, defender)
    → ConditionEvaluator.evaluate(condition, caster, target, randomValue)
      → ExpressionContext.create(caster, target, tagChecker, randomValue)
        → new Function('context', `with(context) { return (${expression}); }`)
    → 条件 true: mergeParameters(defaultParams, conditionalParams)
```

### 数据加载 — SkillLoader

**文件**: lines 5692-5752

```js
// 解析 conditionalParams（支持中英文字段名）
skillConfig.conditionalParams = rawParams.map((cp) => {
  const condition = cp.condition || cp.条件;
  const params = cp.params || cp.参数 || {};

  // 递归解析 params 中的 effects 和 cost
  // 支持中英混合字段名

  return { condition, params };
});
```

### 表达式评估 — `ConditionEvaluator.evaluate()`

**文件**: lines 6030-6063

通过 `new Function('context', body)` 在 `with(context)` 中动态执行表达式，返回布尔值。**表达式可使用的变量**由 `ExpressionContext.create()` 定义：

```js
// 上下文暴露的变量：
caster.当前活力 / 当前敏捷 / 当前灵性 / 当前理智 / 当前人性 / 运气;
caster.活力 / 敏捷 / 灵性 / 理智 / 人性; // 上限
caster.attack / defense / speed / currentHealth / maxHealth;
caster.sequenceRank / 神性 / level;
caster.hasTag(tagName) / getTagStacks(tagName) / getTagDuration(tagName);
// 以及 target 的相同结构
random(min, max); // 使用目标缓存的随机数
```

**条件表达式示例**（来自注释）:

- `"target.当前理智 == 0"`
- `"target.当前活力 < 100"`
- `"target.hasTag('中毒') && target.getTagStacks('中毒') >= 3"`
- `"random(1, 100) <= 50"`

### 参数选择 — `ParameterSelector.selectParameters()`

**文件**: lines 6085-6118

```js
selectParameters(skill, caster, target) {
    const defaultParams = this.extractDefaultParams(skill);

    // 为目标生成缓存的随机数
    const randomValue = this.randomGenerator.generateForTarget(target);

    for (const conditionalParam of skill.conditionalParams) {
        const isMatch = this.conditionEvaluator.evaluate(
            conditionalParam.condition, caster, target, randomValue
        );
        if (isMatch) {
            return this.mergeParameters(defaultParams, conditionalParam.params);
        }
    }
    return defaultParams;  // 无匹配则默认
}
```

### 参数合并 — `mergeParameters()`

**文件**: lines 6138-6159

`cost` 和 `targetType` 不可替换（跳过），其他字段（`power`, `damageType`, `effects` 等）覆盖替换。

### 在 TurnManager 中的调用

**文件**: lines 5082-5088

```js
// 为每个目标独立选择参数
if (this.battleManager.parameterSelector && skill.conditionalParams?.length > 0) {
  const selectedParams = this.battleManager.parameterSelector.selectParameters(
    skill,
    attacker,
    defender,
  );
  effectiveSkill = new Move(selectedParams); // 创建临时技能对象
}
```

---

## 6. Cost 处理 — SkillCostManager

**文件**: lines 756-876

### `canAfford(caster, skill)`

```js
static canAfford(caster, skill) {
    if (!skill.cost) return { canAfford: true, message: '无消耗' };
    const costType = skill.cost.type;           // 如 'currentVitality'
    const costAmount = skill.cost.amount;
    const currentValue = this.getCurrentAttributeValue(caster, costType);
    if (currentValue < costAmount) {
        return { canAfford: false, message: '...' };
    }
    return { canAfford: true, message: '资源充足' };
}
```

### `deductCost(caster, skill)`

**文件**: lines 790-813

```js
static deductCost(caster, skill) {
    // 先检查 canAfford
    const newValue = Math.max(0, oldValue - costAmount);
    this.setCurrentAttributeValue(caster, costType, newValue);
    // 同步到 health/speed
    return { success: true, oldValue, newValue };
}
```

### 消耗类型映射

```js
const attributeMap = {
  currentVitality: "当前活力",
  currentAgility: "当前敏捷",
  currentSpirit: "当前灵性",
  currentSanity: "当前理智",
  currentHumanity: "当前人性",
};
```

---

## 7. 战斗流程 — 完整调用链

### 战斗生命周期

```
BattleManager.startBattle()
  ├── tagManager.initializeInherentTags()      // 初始化固有标签
  ├── tagManager.loadTagDamageRelations()      // 预加载标签克制
  ├── tagManager.loadTagHealingRelations()     // 预加载标签治疗
  ├── applyPassiveSkills()                     // 应用被动技能
  └── turnManager.initializeRound()            // 初始化回合

BattleManager.executeNextTurn()
  ├── turnManager.executeNextTurn()
  │   └── processCharacterEffects(hero, 'turn_start')  // 效果→processEffect
  │       └── statusEffectManager.checkAndApplyEffects(hero)  // 状态阈值效果
  ├── [UI层选择技能和目标]
  └── TurnManager.executeAttack(attacker, targets, skill)
```

### `TurnManager.executeAttack(attacker, targets, skill)` — 详细流程

**文件**: lines 5054-5386

```
executeAttack(attacker, targets, skill)
  ├── 1. 检查消耗: skill.canUse(attacker) → SkillCostManager.canAfford()
  ├── 2. 扣除消耗: skill.executeCost(attacker) → SkillCostManager.deductCost()
  ├── 3. 清空随机数缓存: parameterSelector.clearCache()
  │
  └── 对每个目标 defender:
      ├── 4. 条件参数选择: parameterSelector.selectParameters(skill, attacker, defender)
      │                   → effectiveSkill = new Move(selectedParams)
      ├── 5. 判断是否为治疗: effectiveSkill.isHeal
      ├── 6. 施加标签: skill.applyTags → tagManager.addTag()
      ├── 7. 移除标签: skill.removeTags → tagManager.removeTag()
      │
      ├── [治疗分支] effectiveSkill.calculateHealing(attacker, defender)
      │               → 基于 healType/healValueType 计算治疗量
      │               → healValueType='percentage': floor(上限 × healAmt)
      │               → healValueType='fixed': healAmt
      │               → 应用标签治疗修正（±150%/-75%封顶）
      │
      └── [伤害分支] DamageCalculator.calculate(attacker, defender, effectiveSkill)
                    ├── customDamageCalculator? (fixedDamage/percentDamage/trueDamage)
                    └── 标准计算:
                        ├── AttributeCalculator.updateHeroStats(attacker, damageType)
                        ├── AttributeCalculator.updateHeroStats(defender, damageType)
                        ├── calculateDamageWithDivinity()
                        │   ├── attack/defense 计算（属性×0.4 + maxStat×0.6 + buff/debuff）
                        │   ├── attackDefenseRatio = attack / defense
                        │   ├── divinityModifier = attacker.神性
                        │   ├── effectivePower = skill.getPower(attacker) [序列映射]
                        │   ├── baseDamage = divinityModifier × effectivePower × attackDefenseRatio
                        │   ├── randomFactor = 0.9~1.1
                        │   ├── 伤害修正: attackerMod + defenderMod + tagMod
                        │   └── final = floor(max(0, baseDamage × randomFactor × (1+totalMod)))
                        └── DamageCalculator.applyDamage(defender, damageResult)
                            └── targetAttr = damageType===mental? '当前理智' : '当前活力'
                                └── newValue = max(0, old - damage)

      ├── 8. 应用效果: skill.effects.forEach → effectManager.applyEffect(target, effect, attacker, skill)
      │               → 按 effectTarget 选择目标（target/self/all/allAlly）
      │               → 同名效果替换逻辑（更强覆盖/持续时间刷新/更弱拒绝）
      │               → 如果影响六维属性则触发 recalculateAllSixDimStats
      │
      └── 9. 记录战报: battleReporter.recordAttack/recordHeal 等

回合结束: TurnManager.processRoundEndEffects()
  ├── processCharacterEffects(hero, 'round_end')  // 处理回合末触发效果
  ├── 递减 duration，移除过期效果
  ├── tagManager.decrementTagDurations(allHeroes)
  └── 检查战斗结束: checkBattleEnd() (一方全灭)
```

### StatusEffectManager — 状态阈值效果

**文件**: lines 2991-3180

根据六维属性的**百分比**（当前值/上限值）自动施加 debuff：

- `<30%`: 重伤/完全瘫痪/灵性耗尽的严重版本
- `<50%`: 中等受伤/行动迟缓/灵性干涸
- `<80%`: 轻伤/行动略微受阻/灵性微耗

作用于 `attack`, `defense`, `damageTakenIncrease`, `damageDealtDecrease` 等 stat。

### 回合构建 — `buildTurnQueue()`

**文件**: lines 4763-4793

按速度（`当前敏捷` + buff/debuff + 随机系数 0.9~1.1）排序所有存活角色。

---

## 总结：你的 JSON 能力结构到代码的映射

| JSON 字段                       | 映射到                                                        | 处理位置                                           |
| ------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| `power` 的 key（-2~9）          | sequenceRank 索引 → `Move.getPower(caster)`                   | DamageCalculator, line 555                         |
| `damageType`                    | `calculateAttack`/`calculateDefense` 的分支选择               | AttributeCalculator, lines 202-223/250-271         |
| `targetType`                    | 多目标支持（`executeAttack` 的 targetArray）                  | TurnManager, line 5057                             |
| `cost.type`                     | 映射到 `当前活力/敏捷/灵性/理智/人性`                         | SkillCostManager, lines 818-833                    |
| `effects[]`                     | `EffectManager.applyEffect()` + 同名替换逻辑                  | EffectManager, lines 3617-3735                     |
| `effects[].condition`           | 通过 `applyBuffDebuff`/`calculateDamageModifier` 在计算时生效 | AttributeCalculator, DamageCalculator              |
| `conditionalParams[].condition` | `ConditionEvaluator.evaluate()` 动态执行 JS 表达式            | ConditionEvaluator, lines 6030-6063                |
| `conditionalParams[].params`    | 合并后创建临时 Move → 覆盖 power/damageType/effects           | ParameterSelector.mergeParameters, lines 6138-6159 |
