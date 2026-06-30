# Battle Engine — 技术分析文档

> 分析基于 `original/battle-engine/` 目录下所有源码文件。
> 目标是：用 TypeScript 在 fate-sandbox 引擎层重新实现时，需要知道的一切。

---

## 目录

1. [核心计算公式](#1-核心计算公式)
2. [数据模型](#2-数据模型)
3. [效果系统](#3-效果系统)
4. [状态效果系统](#4-状态效果系统)
5. [标签系统](#5-标签系统)
6. [条件系统](#6-条件系统)
7. [技能加载](#7-技能加载)
8. [消耗系统](#8-消耗系统)
9. [回合流程](#9-回合流程)
10. [模块依赖图](#10-模块依赖图)
11. [边界情况与风险清单](#11-边界情况与风险清单)

---

## 1. 核心计算公式

### 1.1 AttributeCalculator (`core/AttributeCalculator.js`)

#### `calculateAttack(hero, damageType = 'physical') → number`

```
maxStat = max(当前活力, 当前敏捷, 当前灵性, 当前人性, 当前理智, 运气)

┌──────────────┬──────────────────────────────────────┬──────────────────┐
│ damageType   │ specific =                           │ baseAttack =     │
├──────────────┼──────────────────────────────────────┼──────────────────┤
│ physical     │ (当前活力 + 当前敏捷) / 2            │ floor(specific   │
│ mystical     │ 当前灵性                             │   * 0.4 +        │
│ mental       │ (当前理智 + 当前人性) / 2            │   maxStat * 0.6) │
│ mixed        │ 运气                                 │                  │
│ default      │ (当前活力 + 当前敏捷) / 2            │                  │
└──────────────┴──────────────────────────────────────┴──────────────────┘

final = applyBuffDebuff(hero, 'attack', baseAttack)
```

**重点**：所有伤害类型都用**当前值**而非上限值做基础计算。

#### `calculateDefense(hero, damageType = 'physical') → number`

公式结构与 `calculateAttack` **完全一致**，区别仅在于 `applyBuffDebuff` 传入的 statName 是 `'defense'` 而非 `'attack'`。

```
final = applyBuffDebuff(hero, 'defense', baseDefense)
```

#### `applyBuffDebuff(hero, statName, baseValue) → number`

```
percentageTotal = Σ (effect.type === 'buff' ? power/100 : -power/100)   // 只对 valueType === 'percentage'
fixedTotal      = Σ (effect.type === 'buff' ? power : -power)            // 只对 valueType === 'fixed'

finalValue = floor(max(0, baseValue * (1 + percentageTotal) + fixedTotal))
```

**叠加顺序**：基础值 → 所有百分比修正叠加（加减）→ 所有固定值修正叠加（加减）→ 向下取整 → clamp ≥ 0。

#### `updateHeroStats(hero, damageType = 'physical') → { attack, defense, damageType }`

```
hero.attack  = calculateAttack(hero, damageType)
hero.defense = calculateDefense(hero, damageType)
```

副作用：直接修改 `hero.attack` 和 `hero.defense`。

#### `getTargetAttribute(damageType) → string`

```typescript
damageType === "mental" ? "当前理智" : "当前活力";
```

#### `recalculateAllSixDimStats(hero) → void`

遍历六维属性（`['活力', '敏捷', '灵性', '理智', '人性', '运气']`），对每个属性：

```
baseValue = hero.baseStats[statName]

// 收集 effects 中所有影响该 stat 的 buff/debuff
percentageTotal = Σ (effect.type === 'buff' ? power/100 : -power/100)   // valueType === 'percentage'
fixedTotal      = Σ (effect.type === 'buff' ? power : -power)            // valueType === 'fixed'

finalValue = max(0, floor(baseValue * (1 + percentageTotal) + fixedTotal))

hero.additionalStats[statName] = finalValue    // 更新上限

// 如果当前值 > 新上限，调整当前值
if (statName !== '运气') {
    const currentStatName = `当前${statName}`
    if (hero.additionalStats[currentStatName] > finalValue) {
        hero.additionalStats[currentStatName] = finalValue
    }
}
```

**关键**：

- `baseStats` 是**快照**（初始值），不受 buff/debuff 修改。
- `recalculateAllSixDimStats` 只改上限值（`活力`），不改当前值（`当前活力`），除非当前值超出上限。
- `运气` 没有当前值概念，跳过裁剪。

---

### 1.2 DamageCalculator (`core/DamageCalculator.js`)

#### `calculate(attacker, defender, skill) → DamageResult`

完整流程：

```
1. 检查 skill.customDamageCalculator
   └─ 有 → 调用 CustomDamageCalculators.getCalculator(calculatorName)，返回自定义结果

2. 调用 AttributeCalculator.updateHeroStats(attacker, damageType)
   AttributeCalculator.updateHeroStats(defender, damageType)
   └─ 这会修改 hero.attack / hero.defense（副作用！）

3. damage = calculateDamageWithDivinity(attacker, defender, skill)

4. targetAttribute = getTargetAttribute(damageType)

5. 返回 { damage: max(0, damage), targetAttribute, formula, damageType }
```

**错误兜底**：try-catch 外包围，异常时返回 `{ damage: 0, targetAttribute: '当前活力', formula: '计算错误' }`。

#### `calculateDamageWithDivinity(attacker, defender, skill) → number`

```
atk  = AttributeCalculator.calculateAttack(attacker, damageType)
def  = AttributeCalculator.calculateDefense(defender, damageType)
atkDefRatio = atk / def                                          // 防御为 0 时会得到 Infinity
divinityModifier = attacker.additionalStats.神性 ?? 1            // 默认 1
effectivePower   = skill.getPower ? skill.getPower(attacker) : (skill.power ?? 1)

baseDamage = divinityModifier * effectivePower * atkDefRatio      // 核心公式

randomFactor = 0.9 + Math.random() * 0.2                         // ±10% 浮动
damage = baseDamage * randomFactor

// 伤害修正系数
attackerMod = calculateDamageModifier(attacker, 'damageDealtIncrease', 'damageDealtDecrease')
defenderMod = calculateDamageModifier(defender, 'damageTakenIncrease', 'damageTakenDecrease')
tagMod = calculateTagModifier(attacker, defender, skill)

totalModifier = attackerMod + defenderMod + tagMod
damage = damage * (1 + totalModifier)

return max(0, floor(damage))
```

#### 核心伤害公式（数学表达）

```
D = floor( max(0, (D0 × R × (1 + M))) )

其中：
  D0 = Ω × P × (A / D)
  Ω = attacker.additionalStats.神性（默认为 1）
  P = skill.getPower(attacker) 或 skill.power（默认为 1）
  A = calculateAttack(attacker, damageType)
  D = calculateDefense(defender, damageType)
  R = 0.9 + Math.random() × 0.2  （浮动 ±10%）
  M = attackerMod + defenderMod + tagMod  （修正系数叠加）
```

**重要**：`atk / def` 在 `def = 0` 时得到 `Infinity`，但后续 `floor(max(0, ...))` 仍保留 Infinity，最终伤害会极大。需 TypeScript 重新实现时加防御除零保护。

#### `calculateDamageModifier(hero, increaseStat, decreaseStat) → number`

只处理 `valueType === 'percentage'` 的效果。遍历 `hero.effects`：

```
modifier = 0

for each effect:
  if effect.stat === increaseStat:
    modifier += (effect.type === 'buff' ? +power/100 : +power/100)  // buff和debuff都是正方向
  if effect.stat === decreaseStat:
    modifier -= (effect.type === 'buff' ? power/100 : power/100)    // 都是负方向
```

| stat                  | 攻击侧 buff | 攻击侧 debuff              | 防御侧 buff | 防御侧 debuff |
| --------------------- | ----------- | -------------------------- | ----------- | ------------- |
| `damageDealtIncrease` | +           | +（敌人减益 = 攻击者得利） | -           | -             |
| `damageDealtDecrease` | -           | -                          | +           | +             |
| `damageTakenIncrease` | +           | +                          | -           | -             |
| `damageTakenDecrease` | -           | -                          | +           | +             |

**注意**：这个映射有些反直觉——攻击者的 `damageTakenIncrease` debuff 意味着**敌人更容易被攻击者打**（因为攻击者视角的 "damage taken" 来自敌人视角），所以仍然是正方向修正。

> 重新实现时应仔细验证这个语义，可能原代码有 bug。

非百分比的效果（`valueType !== 'percentage'`）会被忽略并弹出警告。

#### `calculateTagModifier(attacker, defender, skill) → number`

```
if (!window.tagManager) return 0

attackerTags = window.tagManager.getTags(attacker, skill)     // 包含技能标签
defenderTags = window.tagManager.getTags(defender)

// tagDamageRelations: { [attackerTag]: { [defenderTag]: modifier } }
totalModifier = 0
for each attackerTag in attackerTags:
  for each defenderTag in defenderTags:
    modifier = tagDamageRelations[attackerTag.name]?.[defenderTag.name]
    if modifier !== undefined:
      totalModifier += modifier

// 防爆封顶
clampedModifier = clamp(totalModifier, -0.75, 1.5)   // -75% ~ +150%
```

**封顶范围**：`[-0.75, 1.5]`（即 -75% 到 +150%）。

#### `generateFormulaDescription(attack, defense, divinity, power, finalDamage, damageType) → string`

```
`${中文名}伤害: 攻击=${attack}, 防御=${defense}, 神性=${divinity}, 技能倍率=${power} → 最终伤害=${finalDamage}`
```

#### `applyDamage(target, damageResult) → { oldValue, newValue, actualDamage }`

```
targetAttr = damageResult.targetAttribute    // '当前活力' 或 '当前理智'
currentValue = target.additionalStats[targetAttr]
newValue = max(0, currentValue - damageResult.damage)

target.additionalStats[targetAttr] = newValue

// 同步 battle-engine 标准属性
if targetAttr === '当前活力':
    target.health = newValue
    target.currentHealth = newValue

return { oldValue: currentValue, newValue, actualDamage: currentValue - newValue }
```

---

### 1.3 CustomDamageCalculators (`core/CustomDamageCalculators.js`)

| 名称            | 公式                                                   | 无视防御？                |
| --------------- | ------------------------------------------------------ | ------------------------- |
| `fixedDamage`   | `move.power ?? 50`                                     | ✅ 完全不受双方属性影响   |
| `percentDamage` | `max(1, floor(defender.当前活力 × move.power))`        | ✅ 基于目标当前生命       |
| `trueDamage`    | `max(1, floor(attacker.attack × (move.power ?? 1.0)))` | ✅ 无视防御，与攻击力挂钩 |

默认 `move.power`：fixed 默认 50，percent 默认 0.2（20%），true 默认 1.0。

---

### 1.4 SequenceUtils (`core/SequenceUtils.js`)

实际只包含一个函数：

#### `getSequenceCssClass(sequenceRank) → string`

```
-2 → 'tier-pillar'
-1 → 'tier-outer-god'
10 → ''（普通人）
0.1, 0.3, 0.4, 0.5, 0.8, 0.9 → 映射到 'tier-angel-high' 等
0-9 → 'tier-seq-${floor(sequenceRank)}'
```

> ⚠️ **重要**：任务描述中的 `parseSequenceRank`、`getSequenceDivinity`、`getSequenceBaseValue` **在代码库中不存在**。
> 这些功能分散在其他模块中：
>
> - 序列等级→数字映射：通过 `sequenceRank` 属性直接传递（数值），技能配置中的序列映射见 `EffectManager.resolvePowerValue` 和 `Move.getPower`
> - 神性：作为 `additionalStats.神性` 存储，默认值为 1（见 `DamageCalculator.calculateDamageWithDivinity`）
> - 序列基准值：无单独函数，通过技能配置的序列映射表提供

`parseSequenceRank` 未实现。原设计中，支柱=-2、旧日=-1、序列0=0、... 序列9=9、普通人=10，但这仅是代码注释中提到的约定，无实际解析函数。

---

## 2. 数据模型

### 2.1 Hero (`models/Hero.js`)

#### Constructor 完整字段列表

```typescript
interface HeroConfig {
  heroId?: string; // 默认 UUID 生成
  name?: string; // 默认 'Unknown'
  attack?: number; // 默认 0（每次计算前被 updateHeroStats 覆盖）
  defense?: number; // 默认 0
  speed?: number; // 默认 0
  health?: number; // 默认 100
  currentHealth?: number; // 默认 = health
  maxHealth?: number; // 默认 = health
  level?: number; // 默认 1
  effects?: Effect[]; // 默认 []
  moveSet?: MoveConfig[]; // 默认 []
  additionalStats?: AdditionalStats; // 扩展属性
  sequenceRank?: number; // 默认 10（普通人）
  sequenceString?: string; // 默认 '普通人'
  dataSource?: string; // 默认 'npc'
  originalData?: object; // 默认 {}
  teamType?: "ally" | "enemy"; // 默认 'ally'
  baseStats?: BaseStats; // 六维基础值快照
  tags?: Tag[]; // 默认 []
}
```

#### additionalStats 字段

```typescript
interface AdditionalStats {
  当前活力: number; // current vitality
  当前敏捷: number; // current agility
  当前灵性: number; // current spirit
  当前理智: number; // current sanity
  当前人性: number; // current humanity
  活力: number; // max vitality（上限）
  敏捷: number; // max agility
  灵性: number; // max spirit
  理智: number; // max sanity
  人性: number; // max humanity
  运气: number; // luck（无"当前"版本）
  神性: number; // divinity（默认为 1）
  其他?: string; // 任意扩展字段
}
```

#### baseStats 快照

```typescript
interface BaseStats {
  活力: number;
  敏捷: number;
  灵性: number;
  理智: number;
  人性: number;
  运气: number;
}
```

`recalculateAllSixDimStats` 以此为基准 + buff/debuff 修正，重算上限值。

#### tags 结构

```typescript
interface Tag {
  name: string;
  duration: number; // 剩余回合数，边界保护 ≥ 0
  stacks: number; // 层数，边界保护 ≥ 1
  maxStacks: number; // 最大层数（默认 99）
  source: "inherent" | "skill" | "applied";
  appliedAt: number; // Date.now()
}
```

#### 方法签名

| 方法               | 签名                                           | 行为                                  |
| ------------------ | ---------------------------------------------- | ------------------------------------- |
| `generateUUID`     | `() → string`                                  | rfc4122 v4 UUID                       |
| `getName`          | `() → string`                                  |                                       |
| `setName`          | `(name: string) → void`                        |                                       |
| `getAttack`        | `() → number`                                  |                                       |
| `setAttack`        | `(attack: number) → void`                      |                                       |
| `getDefense`       | `() → number`                                  |                                       |
| `setDefense`       | `(defense: number) → void`                     |                                       |
| `getMaxHealth`     | `() → number`                                  |                                       |
| `setMaxHealth`     | `(maxHealth: number) → void`                   |                                       |
| `getHealth`        | `() → number`                                  | 返回 `currentHealth`                  |
| `setHealth`        | `(health: number) → void`                      | 设置 `currentHealth`                  |
| `getSpeed`         | `() → number`                                  |                                       |
| `setSpeed`         | `(speed: number) → void`                       |                                       |
| `getHeroId`        | `() → string`                                  |                                       |
| `setHeroId`        | `(heroId: string) → void`                      |                                       |
| `getLevel`         | `() → number`                                  |                                       |
| `setLevel`         | `(level: number) → void`                       |                                       |
| `getEffects`       | `() → Effect[]`                                |                                       |
| `setEffects`       | `(effects: Effect[]) → void`                   |                                       |
| `getMoveSet`       | `() → Move[]`                                  |                                       |
| `setMoveSet`       | `(moves: MoveConfig[]) → void`                 | 每个元素 `new Move(m)`                |
| `addEffect`        | `(effect: Effect) → void`                      | `this.effects.push(effect)`           |
| `takeDamage`       | `(damage: number, damageType?: string) → void` | 委托给 `DamageCalculator.applyDamage` |
| `getStatusSummary` | `() → object`                                  | 返回当前值/上限/luck/divinity 等      |

---

### 2.2 Move (`models/Move.js`)

#### Constructor 完整字段列表

```typescript
interface MoveConfig {
  name?: string; // 默认 ''
  power?: number | SequenceMap; // 默认 0（可以是数字或 { 0: 2.0, 9: 1.0, default: 1.0 }）
  priority?: number; // 默认 0
  isHeal?: boolean; // 默认 false
  isPassive?: boolean; // 默认 false
  healAmt?: number | SequenceMap; // 默认 0
  healType?: string; // 默认 '活力'
  healValueType?: "fixed" | "percentage"; // 默认 'percentage'
  customDamageCalculator?: string; // 默认 null（'fixedDamage'/'percentDamage'/'trueDamage')
  effects?: EffectConfig[]; // 默认 []
  damageType?: string; // 默认 'physical'
  cost?: CostConfig; // 默认 null
  targetType?: string; // 默认 'single'
  skillTags?: string[]; // 默认 []（技能自带标签）
  applyTags?: TagConfig[]; // 默认 []（施加到目标的标签）
  removeTags?: string[]; // 默认 []（移除目标的标签）
  conditionalParams?: ConditionParam[]; // 默认 []
}
```

#### `getPower(caster = null) → number`

```
if (this.power 是对象 && caster 存在):
    if (this.power[caster.sequenceRank] !== undefined) → return 该值
    else → return this.power['default'] ?? this.power['9'] ?? 1.0  // 兜底
else:
    return this.power ?? 1.0
```

**边界**：无精确匹配时走兜底链 `default → 序列9 → 1.0`。

#### `getHealAmt(caster = null) → number`

结构同 `getPower`，兜底链 `default → 序列9 → 0`。

#### `canUse(caster) → { canAfford, message }`

委托给 `SkillCostManager.canAfford(caster, this)`。

#### `executeCost(caster) → { success, message, oldValue?, newValue? }`

委托给 `SkillCostManager.deductCost(caster, this)`。

#### `calculateHealing(sourceHero, targetHero) → HealingResult`

```
healType = this.healType || '活力'       // 目标属性名（如 '活力'）
attributeMap = {
  '活力': { current: '当前活力', max: '活力' },
  '敏捷': { current: '当前敏捷', max: '敏捷' },
  ...
}

attrs = attributeMap[healType]
if (!attrs) → 回退到 '活力' 配置

maxValue   = targetHero.additionalStats[attrs.max] || 100
currentValue = targetHero.additionalStats[attrs.current] || 0
baseHealAmt = this.getHealAmt(sourceHero)     // 支持序列映射

if healValueType === 'fixed':
    rawHealAmt = baseHealAmt                   // 固定值
else:
    rawHealAmt = floor(maxValue * baseHealAmt) // 百分比模式下基于上限

// 标签治疗修正
tagMod = calculateTagHealingModifier(sourceHero, targetHero)
rawHealAmt = max(0, floor(rawHealAmt * (1 + tagMod)))

actualHealAmt = min(rawHealAmt, maxValue - currentValue)  // 不超出上限
```

**注意**：治疗百分比基于**属性上限**（`活力`），而非当前值。这与伤害计算基于当前值不同。

#### `calculateDamage(sourceHero, targetHero) → number`

```
if (this.customDamageCalculator) → 直接调用

// 否则走标准流程
AttributeCalculator.updateHeroStats(sourceHero, this.damageType)  // 副作用！
AttributeCalculator.updateHeroStats(targetHero, this.damageType)
return DamageCalculator.calculateDamageWithDivinity(sourceHero, targetHero, this)
```

#### `calculateTagHealingModifier(healer, target) → number`

同 `TagManager.calculateTagHealingModifier`，防爆封顶 `[-0.75, 1.5]`。

---

## 3. 效果系统

### 3.1 EffectManager (`systems/EffectManager.js`)

#### 效果类型

| type     | 含义 | 行为                                                 |
| -------- | ---- | ---------------------------------------------------- |
| `buff`   | 增益 | `processBuffEffect`，被动生效，无运行时副作用        |
| `debuff` | 减益 | `processDebuffEffect`，被动生效                      |
| `poison` | 中毒 | `processPoisonEffect`，每回合扣减当前值              |
| `regen`  | 再生 | `processRegenEffect`，每回合恢复当前值（不超过上限） |

#### 效果生效字段结构

```typescript
interface EffectInstance {
  name: string; // 效果名称（用于同名替换判定）
  type: "buff" | "debuff" | "poison" | "regen";
  duration: number; // 剩余回合数（默认 3）
  power: number; // 已解析的数值（固定值）
  stat: string | null; // 影响的目标属性（如 'attack', 'defense', '活力', 'damageDealtIncrease' 等）
  valueType: "fixed" | "percentage"; // 默认 'fixed'
  priority: number; // 默认 0（越小越优先）
  triggerTiming: "turn_start" | "round_end"; // 默认 'turn_start'
  appliedAt: number; // Date.now()
}
```

#### `resolvePowerValue(powerConfig, caster, effectName) → number`

与 `Move.getPower` 同结构：

```
if (typeof powerConfig !== 'object') → return powerConfig ?? 0

if (!caster) → return powerConfig['default'] ?? powerConfig['9'] ?? 0
if (!caster.sequenceRank) → return 同上

if (powerConfig[sequenceRank] !== undefined) → return 该值
return powerConfig['default'] ?? powerConfig['9'] ?? 0
```

#### `applyEffect(hero, effect, caster = null, skill = null) → EffectResult`

完整流程：

```
1. validateEffect(effect) → 检查 name, type, power ≥ 0, duration 1-99, valueType
2. normalizeEffect(effect) → 兼容旧格式（modifier → power + percentage）
3. 验证伤害修正系数必为 percentage
4. resolvedPower = resolvePowerValue(power, caster, name)
5. 对 poison/regen：调用 window.tagManager 标签修正
6. 创建 effectInstance
7. 同名替换逻辑（见下方）
8. 如果是六维属性，触发 recalculateAllSixDimStats(hero)
```

#### 同名效果替换规则

```
existingEffectIndex = hero.effects.findIndex(e => e.name === name && e.duration > 0)

if (existing):
    if (newPower > oldPower):          完全替换 old → new，返回 { replaced: true }
    if (newPower === oldPower && newDuration > oldDuration): 刷新持续时间，返回 { refreshed: true }
    else:                              拒绝新效果，返回 { rejected: true }

else: 正常添加，返回 { applied: true }
```

#### `processEffects(heroes, battleLogger) → EffectResult[]`

遍历所有英雄的所有效果：

```
for each hero:
    for each effect:
        result = processEffect(hero, effect)
        effect.duration--                    // 每回合递减
    // 清理过期效果
    hero.effects = hero.effects.filter(e => e.duration > 0)
    // 如果有六维效果的过期，触发 recalculateAllSixDimStats
```

**注意**：processEffects 本身会递减 duration 并清理过期效果。但 TurnManager 的 `processCharacterEffects` 也有独立的递减和清理逻辑。存在双重递减风险。

#### `processPoisonEffect(hero, effect) → { hero, effect, type: 'damage', amount, message }`

```
statName = effect.stat || '当前活力'
maxStatName = statName.replace('当前', '')
maxStatValue = hero.additionalStats[maxStatName] || 100

if (effect.valueType === 'percentage'):
    damage = floor(maxStatValue * effect.power / 100)    // 基于上限的百分比
else:
    damage = effect.power                                 // 固定值

newValue = max(0, oldValue - damage)
// 同步 health / currentHealth（仅当前活力）
```

**注意**：百分比中毒基于**上限**而非当前值。与治疗逻辑一致。

#### `processRegenEffect(hero, effect) → { hero, effect, type: 'heal', amount, message }`

```
// 同 poison 相反方向
if (effect.valueType === 'percentage'):
    healing = floor(maxStatValue * effect.power / 100)
else:
    healing = effect.power

newValue = min(maxStatValue, oldValue + healing)
```

#### `isSixDimStat(stat) → boolean`

```typescript
["活力", "敏捷", "灵性", "理智", "人性", "运气"].includes(stat);
```

#### `isDamageModifierStat(stat) → boolean`

```typescript
[
  "damageDealtIncrease",
  "damageDealtDecrease",
  "damageTakenIncrease",
  "damageTakenDecrease",
].includes(stat);
```

---

## 4. 状态效果系统

### 4.1 StatusEffectManager (`systems/StatusEffectManager.js`)

基于当前值比例自动施加固定 debuff 的被动系统。

#### 默认配置

| 属性       | 阈值                                                                                                                                                  | 效果 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `vitality` | ≤0.0 → 死亡 debuff（attack -80%）<br>≤0.29 → 重伤（attack -50%）<br>≤0.49 → 中等受伤（attack -30%）<br>≤0.79 → 轻伤（attack -15%）                    |
| `agility`  | ≤0.0 → 完全瘫痪（damageTakenIncrease +100%）<br>≤0.29 → 几乎无法移动（+60%）<br>≤0.49 → 行动迟缓（+35%）<br>≤0.79 → 行动略微受阻（+18%）              |
| `spirit`   | ≤0.0 → 灵性耗尽（damageDealtDecrease +70%）<br>≤0.29 → 灵性干涸（+45%）<br>≤0.49 → 灵性余量紧张（+25%）<br>≤0.79 → 灵性微耗（+12%）                   |
| `sanity`   | ≤0.0 → 彻底失去理智（defense -75%）<br>≤0.29 → 理智濒临崩溃（defense -55%）<br>≤0.49 → 理智动摇（defense -35%）<br>≤0.79 → 理智受冲击（defense -18%） |
| `humanity` | ≤0.0 → 彻底失去人性（damageDealtDecrease +55%）<br>≤0.29 → 人性泯灭（+35%）<br>≤0.49 → 人性扭曲（+20%）<br>≤0.79 → 人性动摇（+10%）                   |

#### `checkAndApplyEffects(hero) → EffectInstance[]`

```
percentages = {
    vitality: 当前活力 / 活力,
    agility:  当前敏捷 / 敏捷,
    spirit:   当前灵性 / 灵性,
    sanity:   当前理智 / 理智,
    humanity: 当前人性 / 人性
}

for each (attrName, percentage):
    matchingThresholds = config[attrName].filter(item => percentage <= item.threshold)
    if (matchingThresholds.length > 0):
        // 取阈值最低的（最严重的）
        selectedEffect = matchingThresholds.sort((a,b) => a.threshold - b.threshold)[0].effect
        if (!hero.effects.some(e => e.name === selectedEffect.name)):
            hero.effects.push({ ...selectedEffect })
```

**关键**：只取阈值最低的一个效果。如果已有同名效果，不再重复施加。每次 `turn_start` 时由 TurnManager 调用。

---

## 5. 标签系统

### 5.1 TagManager (`systems/TagManager.js`)

#### 标签数据结构

```typescript
interface TagEntry {
  name: string;
  duration: number; // 边界保护 ≥ 0
  stacks: number; // 边界保护 ≥ 1
  maxStacks: number;
  source: "inherent" | "skill" | "applied";
  appliedAt: number;
}
```

#### `addTag(hero, tagName, duration, stacks = 1, maxStacks = 99, source = 'applied')`

```
if (已有同名标签):
    newStacks = existing.stacks + stacks
    if (newStacks > (existing.maxStacks || maxStacks)):
        仅刷新 duration（取最大值）  // 已达上限
    else:
        existing.stacks = newStacks
        existing.duration = max(existing.duration, duration)  // 刷新持续
else:
    hero.tags.push({ name, duration, stacks: max(1, stacks), maxStacks, source, appliedAt })
```

#### `removeTag(hero, tagName)` / `removeTagStacks(hero, tagName, stacksToRemove = 1)`

`removeTagStacks` 递减到 ≤ 0 时自动 `removeTag`。

#### `getTags(hero, currentSkill = null) → TagEntry[]`

合并 `hero.tags`（持久标签）和 `currentSkill.skillTags`（技能临时标签）。

#### `hasTag(hero, tagName, currentSkill = null) → boolean`

#### `decrementTagDurations(heroes)`

所有英雄的标签 duration--，清理 ≤ 0 的。

#### `initializeInherentTags(heroes)` — 异步

1. 异步加载 `tagMappingConfig`、`tagDamageRelations`、`tagHealingRelations`
2. 根据英雄的 `sequenceString` 匹配映射配置中的关键词，添加固有标签

#### `loadTagDamageRelations()` / `loadTagHealingRelations()` — 异步

从 `worldbookManager.fetchEntries` 加载 JSON 配置，格式：

```typescript
// tagDamageRelations: { [attackerTagName]: { [defenderTagName]: number } }
{
  "神秘生物": { "人类": 0.3, "神性生物": -0.2 },
  ...
}
```

#### `calculateTagDamageModifier(attacker, defender, skill) → number`

跨所有标签笛卡尔积求和，防爆封顶 `[-0.75, 1.5]`。

#### `calculateTagHealingModifier(healer, target, skill) → number`

同结构，使用 `tagHealingRelations`。

---

## 6. 条件系统

### 6.1 ConditionSystem (`logic/ConditionSystem.js`)

#### TagChecker

```typescript
class TagChecker {
  hasTag(hero, tagName): boolean;
  getTagStacks(hero, tagName): number;
  getTagDuration(hero, tagName): number;
}
```

**注意**：只检查 `hero.tags`，不检查技能标签（与 TagManager 的 `hasTag` 不同）。

#### RandomGenerator

```typescript
class RandomGenerator {
  random(min, max): number; // 闭区间 [min, max]
  generateForTarget(target): number; // WeakMap 缓存，一个目标一局一个值
  clearCache(): void; // 每次技能执行前清空
}
```

一次战斗中，**每个目标只生成一次随机数**（WeakMap 缓存）。后续所有条件评估使用该缓存值。

#### ExpressionContext.create(caster, target, tagChecker, randomValue) → object

暴露的上下文变量：

```typescript
{
  caster: {
    当前活力, 当前敏捷, 当前灵性, 当前理智, 当前人性,      // number
    运气,                                                   // number
    活力, 敏捷, 灵性, 理智, 人性,                           // number（上限）
    attack, defense, speed, currentHealth, maxHealth,       // number
    sequenceRank,                                           // number
    神性, level,                                            // number
    hasTag(tagName): boolean,
    getTagStacks(tagName): number,
    getTagDuration(tagName): number
  },
  target: { /* 同上 */ },
  random(min, max): number,     // 使用缓存值或新生成
  随机数(min, max): number       // 中文别名
}
```

#### ConditionEvaluator.evaluate(expression, caster, target, randomValue) → boolean

使用 `new Function('context', body)` + `with (context)` 动态执行表达式字符串。

```
body = `
  with (context) {
    return (${expression});
  }
`
```

表达式示例：`"caster.当前活力 > 50"`、`"target.hasTag('燃烧')"`、`"random(1,100) <= 30"`。

**安全风险**：`new Function` + `with` 允许任意 JS 执行。失败时返回 `false`。

#### ParameterSelector.selectParameters(skill, caster, target) → mergedParams

```
1. extractDefaultParams(skill) → {...skill}（排除 conditionalParams）
2. 如果没有 conditionalParams → 返回默认
3. randomValue = randomGenerator.generateForTarget(target)
4. 遍历 conditionalParams，第一个匹配的条件参数集的 params 与 default 合并
5. 合并规则：跳过 cost 和 targetType（不可替换），类型不匹配则跳过
6. 无匹配 → 返回默认
```

#### mergeParameters(defaultParams, conditionalParams) → merged

```
// 只覆盖标量，跳过 'cost' 和 'targetType'
// 类型不匹配时跳过
merged[key] = conditionalParams[key]
```

---

## 7. 技能加载

### 7.1 SkillLoader (`flow/SkillLoader.js`)

#### `loadSkillsFromCharacter(characterData, dataSource) → Move[]`

```
if (dataSource === 'player'):
    // 从 stat_data.序列能力列表 读取
    for each 序列名 in 序列能力列表:
        for each ability in 序列能力列表[序列名]:
            skill = parseSkill(ability)
else:
    // 从 npc_data[name].能力清单 读取
    for each ability in 能力清单:
        skill = parseSkill(ability)
```

#### `parseSkill(abilityConfig) → Move | null`

中英文字段名兼容映射：

| 中文         | 英文                | 最终 key            |
| ------------ | ------------------- | ------------------- |
| `名称`       | `name`              | `name`              |
| `威力`       | `power`             | `power`             |
| `伤害类型`   | `damageType`        | `damageType`        |
| `优先级`     | `priority`          | `priority`          |
| `目标类型`   | `targetType`        | `targetType`        |
| `描述`       | `description`       | `description`       |
| `被动`       | `isPassive`         | `isPassive`         |
| `技能标签`   | `skillTags`         | `skillTags`         |
| `施加标签`   | `applyTags`         | `applyTags`         |
| `移除标签`   | `removeTags`        | `removeTags`        |
| `条件参数集` | `conditionalParams` | `conditionalParams` |

消耗、效果、条件参数集内部字段也有同样的中英文兼容转换。

#### `isBattleAbility(abilityConfig) → boolean`

如果配置只包含 `['名称','name','描述','description','类型','type']` 中的 key，则判定为**非战斗能力**，返回 `null`。

#### `createDefaultSkill(name, damageType, power) → Move`

用于测试或备用。

---

## 8. 消耗系统

### 8.1 SkillCostManager (`core/SkillCostManager.js`)

#### `canAfford(caster, skill) → { canAfford: boolean, message: string }`

```
if (!skill.cost) → { canAfford: true, message: '无消耗' }

currentValue = getCurrentAttributeValue(caster, costType)
if (currentValue < costAmount) → { canAfford: false, message: '...不足' }
return { canAfford: true, message: '资源充足' }
```

#### `deductCost(caster, skill) → { success, message, oldValue, newValue }`

```
canAfford 检查 → 失败则返回 { success: false, message }
oldValue = getCurrentAttributeValue(caster, costType)
newValue = max(0, oldValue - costAmount)
setCurrentAttributeValue(caster, costType, newValue)
```

#### 消耗类型到属性映射

| costType          | 属性名     | 同步字段                  |
| ----------------- | ---------- | ------------------------- |
| `currentVitality` | `当前活力` | `health`, `currentHealth` |
| `currentAgility`  | `当前敏捷` | `speed`                   |
| `currentSpirit`   | `当前灵性` | —                         |
| `currentSanity`   | `当前理智` | —                         |
| `currentHumanity` | `当前人性` | —                         |

**注意**：`setCurrentAttributeValue` 对 `当前活力` 有同步副作用（更新 `hero.health` 和 `hero.currentHealth`），对 `当前敏捷` 同步 `hero.speed`。其他属性不同步。

未知的 `costType` 返回 0（读取时）/静默跳过（设置时）。

---

## 9. 回合流程

### 9.1 TurnManager (`flow/TurnManager.js`)

#### 回合初始化

```
buildTurnQueue():
    1. 获取所有存活英雄
    2. 每个英雄：speed = applyBuffDebuff(hero, 'speed', 当前敏捷) × 随机系数(0.9~1.1)
    3. 按 speed 降序排序（相同则随机）
```

#### 执行行动

```
executeAttack(attacker, targets, skill):
    1. 检查消耗（skill.canUse）
    2. 扣除消耗（skill.executeCost）
    3. 清空随机数缓存
    4. 对每个目标：
        a. 选择条件参数集（ParameterSelector.selectParameters）
        b. 施加标签（applyTags）
        c. 移除标签（removeTags）
        d. 判断是否治疗技能 → calculateHealing 或 DamageCalculator.calculate
        e. 应用技能效果（effectManager.applyEffect）
```

#### 回合开始效果

```
processCharacterEffects(hero, timing = 'turn_start'):
    1. 过滤匹配 triggerTiming 的效果
    2. 按 priority 排序（优先级数越小越先）
    3. 对每个效果调用 effectManager.processEffect
    4. effect.duration--（注意：这里递减了！）
    5. 清理 duration ≤ 0 的效果
    6. 如果有六维 buff/debuff 过期，recalculateAllSixDimStats
    7. 调用 statusEffectManager.checkAndApplyEffects（自动施加阈值 debuff）
```

#### 回合结束效果

```
processRoundEndEffects():
    1. 处理 triggerTiming === 'round_end' 的效果
    2. 清理过期效果 + 重算六维
    3. tagManager.decrementTagDurations（递减标签 duration）
```

---

## 10. 模块依赖图

```
SkillLoader → Move → SkillCostManager
                    → EffectManager
                    → DamageCalculator
                    → TagManager (标签治疗修正)

TurnManager → AttributeCalculator (速度 buff/debuff)
            → SkillCostManager (消耗检查)
            → ParameterSelector → ConditionEvaluator (条件系统)
                                → RandomGenerator
                                → TagChecker
            → EffectManager (效果应用)
            → StatusEffectManager (阈值 debuff)
            → TagManager (标签增删)
            → DamageCalculator (伤害计算)
            → BattleReporter (战报记录)

DamageCalculator → AttributeCalculator (attack/defense)
                 → CustomDamageCalculators (自定义伤害)
                 → window.tagManager.tagDamageRelations (标签克制)

AttributeCalculator → Hero.effects (buff/debuff 修正)

EffectManager → AttributeCalculator.recalculateAllSixDimStats
              → TagManager (poison/regen 标签修正)

StatusEffectManager → Hero.effects (施加阈值效果)

TagManager → worldbookManager (异步加载配置)

ConditionSystem → 无外部依赖（纯逻辑）
```

**关键观察**：

- `window.tagManager` 是全局单例，多处直接引用
- `AttributeCalculator` 是纯静态类，无状态
- `EffectManager` 被 TurnManager 和自身 processEffects 分别调用，均有 duration 递减逻辑
- `battle-engine` 标准属性（`hero.health`, `hero.attack`, `hero.defense`, `hero.speed`）是 `additionalStats` 的影子同步

---

## 11. 边界情况与风险清单

### 11.1 防御为 0

```javascript
const attackDefenseRatio = attack / defense;
// defense === 0 时 → Infinity
```

**推荐**：加 `def === 0 ? attack : attack / def` 或至少 `Math.max(def, 1)`。

### 11.2 神性缺失

```javascript
const divinityModifier = attacker.additionalStats.神性 ?? 1;
```

有默认值 1，安全。

### 11.3 序列映射无匹配

```
Move.getPower:      this.power['default'] ?? this.power['9'] ?? 1.0
Move.getHealAmt:    this.healAmt['default'] ?? this.healAmt['9'] ?? 0
EffectManager.resolvePowerValue: powerConfig['default'] ?? powerConfig['9'] ?? 0
```

三层兜底链，不会 undefined。

### 11.4 效果 duration 双重递减

`EffectManager.processEffects` 和 `TurnManager.processCharacterEffects` **都**对 effect 做了 `duration--` 和过滤。如果两者串行调用同一个效果，duration 会一次减两次。

**风险**：需要确保调用路径不重叠，或消除一处的递减逻辑。

### 11.5 `new Function` + `with` 安全风险

`ConditionEvaluator` 使用 `new Function('context', body)` + `with(context)` 执行任意表达式字符串。这意味着**任何能提供表达式字符串的来源都能执行任意 JS**。如果 conditionalParams 来自外部输入，存在注入风险。

### 11.6 副作用：updateHeroStats 修改 hero.attack/defense

```javascript
AttributeCalculator.updateHeroStats(hero, damageType);
// 副作用：hero.attack 和 hero.defense 被覆盖
```

`calculateDamageWithDivinity` 内部又调用了 `calculateAttack`/`calculateDefense`（不依赖 `hero.attack`/`hero.defense`，而是从 `additionalStats` 重算），所以 `updateHeroStats` 的副作用其实没被后续使用到——`hero.attack`/`hero.defense` 仅在 `trueDamage` 和 `generateFormulaDescription` 中使用。

**可优化**：TypeScript 重构时可以让 `updateHeroStats` 不修改 hero，而是返回计算值。

### 11.7 `window.tagManager` 全局依赖

`DamageCalculator.calculateTagModifier`、`Move.calculateTagHealingModifier`、`EffectManager.applyEffect` 中都直接引用 `window.tagManager`。TypeScript 重构时应改为依赖注入或参数传入。

### 11.8 百分比中毒/再生基于上限

```javascript
// poison（百分比模式）
damage = floor((maxStatValue * effect.power) / 100); // 基于上限
// 治疗（百分比模式）
rawHealAmt = floor(maxValue * baseHealAmt); // 基于上限
```

这与伤害计算基于当前值的逻辑不一致。需要注意。

### 11.9 状态阈值效果没有清理逻辑

`StatusEffectManager.checkAndApplyEffects` 只负责**施加**，不负责清理。当英雄当前值恢复后，之前施加的阈值 effect 仍然在 `hero.effects` 中。TurnManager 没有移除"不再满足条件"的旧阈值效果。

**结论**：状态效果是累加的、不回退的。一个角色在生命 20% 时获得了"重伤" debuff，即使后来被治疗到 90%，"重伤" debuff 仍然生效。

### 11.10 标签封顶范围

```
clamp(result, -0.75, 1.5)   // -75% ~ +150%
```

三个地方有相同封顶逻辑：`DamageCalculator.calculateTagModifier`、`Move.calculateTagHealingModifier`、`TagManager.calculateTagDamageModifier`。

### 11.11 四种伤害类型在 attack/defense 上的公式**完全一致**

四种伤害类型在 `calculateAttack` 和 `calculateDefense` 上的区别**仅在于 specific 部分的属性选择**，`0.4 / 0.6` 权重比完全一致。mental 的目标属性被特殊指定为 `当前理智`，其他伤害类型目标属性为 `当前活力`。

### 11.12 `getStatusSummary` 方法

`Hero.getStatusSummary()` 返回的是**构造后的摘要对象**，但原始源码中存在缩进问题（`return` 后有一个缩进的 `{`）。TypeScript 重构时需修正格式。

---

## 重新实现建议

### 优先事项

1. **防御为 0 保护**：除零防护
2. **依赖注入**：消除 `window.tagManager` 全局引用
3. **消除副作用**：`updateHeroStats` 不应修改 hero 对象
4. **修复双重递减**：统一效果 duration 管理
5. **静态类型**：所有字符串（伤害类型、属性名、效果类型）使用 discriminated union

### 可复用的纯函数

- `calculateAttack(hero, damageType)` — 可纯化（不依赖 hero 副作用）
- `calculateDefense(hero, damageType)` — 同上
- `applyBuffDebuff(hero, statName, baseValue)` — 纯函数
- `calculateTagDamageModifier` — 可纯化
- `resolvePowerValue` — 纯函数
- `calculatePoisonDamage` / `calculateRegenHealing` — 纯函数

### 推荐架构变更

```typescript
// 当前：AttributeCalculator.updateHeroStats(attacker, 'physical')
//       然后 attacker.attack 被修改
//       然后 DamageCalculator.calculateDamageWithDivinity(attacker, defender, skill)
//
// 推荐：
//        const attack = computeAttack(attacker.stats, attacker.effects, 'physical')
//        const defense = computeDefense(defender.stats, defender.effects, 'physical')
//        const damage = computeDamage(attack, defense, skillPower, divinity, effects)

// 把 "攻击力和防御力计算" 与 "伤害公式" 彻底解耦
```
