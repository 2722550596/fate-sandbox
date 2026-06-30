# Actor 状态模型与战斗系统

本文件定义角色（Actor）的完整数据模型和战斗（Combat）系统的工作流。所有装备、技能、效果系统的设计必须以此为准对齐。

---

## 一、角色状态树

```
PublicActorState
├── id / kind / roles
│
├── sequence: SequenceState | null         ← 序列/途径信息
│   ├── currentSequence: string            序列名，如"占卜家""读心者"
│   ├── rank: SequenceRank                 等级：seq-9 ~ seq-0 / old-one / pillar
│   ├── pathway: PathwayId                 途径 ID
│   ├── divinity: number                   神性倍率 Ω，从 神性.json 按等级自动查
│   ├── tags: TagEntry[]                   序列标签，从 标签映射.json 按序列名自动查
│   │   └── { name, duration, stacks }
│   ├── promotionSystem                    晋升体系
│   ├── digestionProgress                  [0, 100]
│   └── lossOfControlProgress              [0, 100]
│
├── stats: CharacterStats | null           ← 六维属性三层模型
│   ├── base: StatsValues                  纯配置运算结果，只随序列晋升改变
│   ├── max: StatsValues                   base + 状态效果修正，由 recalculateMaxStats() 更新
│   └── current: StatsValues               受伤害/治疗/消耗直接影响，被 max 钳制
│
│   StatsValues = {
│     vitality,      活力
│     agility,       敏捷
│     spirituality,  灵性
│     sanity,        理智（统一命名，废弃 reason）
│     humanity,      人性
│     luck           运气（单值，无 current/max 之分）
│   }
│
├── identity / presentation / inventory
│
├── condition: ConditionState
│   └── statusEffects: StatusEffectState[]
│       ├── type: "buff" | "debuff" | "risk" | "flag"
│       ├── affectedAttribute              指向 StatsValues 的 key
│       ├── valueType: "percentage" | "fixed"
│       ├── value                          修正值
│       └── duration                       回合数
│
├── abilities: AbilityState[]
└── relationshipToProtagonist
```

### 三层模型详解

```
base:  序列基准[rankIndex] × 序列权重[sequenceName][dimIdx]
       ↓
       recalculateMaxStats(base, statusEffects)
       ┌──────────────────────────────────────────┐
       │ 对每个维度（luck 除外）：                   │
       │   修正 = 遍历 statusEffects                │
       │     type=buff/debuff                      │
       │     affectedAttribute == 该维度            │
       │       百分比修正: value/100 (buff+/debuff-) │
       │       固定修正:   value (buff+/debuff-)    │
       │   max = floor(base × (1 + 百分比) + 固定)  │
       │   max = max(0, max)                       │
       │   current = min(current, max)              │
       └──────────────────────────────────────────┘
       ↓
max:  current 被实时钳制
       ↓
current: 直接受伤害/治疗/消耗影响，无其他间接副作用
```

**luck（运气）特殊规则**：不受任何状态效果影响，`max.luck = base.luck` 始终不变。

---

## 二、配置体系

### 配置文件一览

| 文件                                   | 格式                                                 | 作用                                                              |
| -------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| `序列基准.json`                        | `Record<string, number>`                             | 序列等级 → 属性总值。如 `{"9": 300, "0": 1200000}`                |
| `序列权重.json`                        | `Record<string, number[6]>`                          | 序列名 → 六维权重数组 `[活力,敏捷,灵性,理智,人性,运气]`。总和为 1 |
| `神性.json`                            | `Record<string, number>`                             | 序列索引 → 神性倍率 Ω。如 `{"9": 1.0, "0": 2}`                    |
| `标签映射.json`                        | `Record<string, {tags: string[], duration: number}>` | 序列名 → 标签列表。如 `{"读心者": {tags:["精神"], duration: 99}}` |
| `标签伤害修正.json`                    | `Record<string, Record<string, number>>`             | 攻击方标签 → 防御方标签 → 伤害修正系数                            |
| `标签治疗修正.json`                    | `Record<string, Record<string, number>>`             | 预留，装备系统使用                                                |
| `data/pathways/<途径>/seq-<等级>.json` | `SequenceAbilityEntry[]`                             | 技能定义数组                                                      |

### base 计算流程

```
序列基准.json["9"] = 300
        ×
序列权重.json["占卜家"] = [0.1, 0.2, 0.35, 0.2, 0.1, 0.05]
        ↓
base.vitality     = floor(300 × 0.10) = 30
base.agility      = floor(300 × 0.20) = 60
base.spirituality = floor(300 × 0.35) = 105
base.sanity       = floor(300 × 0.20) = 60
base.humanity     = floor(300 × 0.10) = 30
base.luck         = floor(300 × 0.05) = 15
```

---

## 三、战斗系统

### 工具调用

```jsonc
{
  "attackerId": "protagonist", // 从 state 自动读数据
  "defenderId": "shadow-1", // 从 state 自动读数据
  "skillName": "出色格斗技巧", // 从 pathway 配置自动查 power/damageType/cost/effects
}
```

无需手动提供六维属性、神性、效果列表、标签——全从 actor 状态自动读取。

### 执行管线

```
① parseCombatInput
   ├── 读 attackerId / defenderId 对应的 actor
   └── 查 pathway 配置解析 skillName → 完整 SkillDef

② recalculateMaxStats（双方）
   └── statusEffects → 最新 max，钳制 current

③ buildSnapshot
   ├── stats    ← actor.stats.current
   ├── effects  ← actor.statusEffects（buff/debuff 转 EffectInstance）
   ├── divinity ← actor.sequence.divinity
   ├── tags     ← actor.sequence.tags
   └── sequenceRank ← actor.sequence.rank

④ executeCombatAction
   ├── canAffordCost → 失败返回 costDeductions:[]
   ├── evaluateConditionalParams → 条件参数可覆盖技能属性
   ├── deductCost → 扣减并记录 costDeductions
   ├── [isHeal?] → executeHeal（治疗分支，不走伤害公式）
   ├── calcDamage → 核心伤害公式
   └── applySkillEffects → 效果的创建/替换/刷新

⑤ 写回 state
   ├── costDeductions → attacker.stats.current[attr] -= amount
   ├── damage → defender.stats.current[targetAttr] -= damage
   └── appliedEffects → defender.condition.statusEffects.push(...)
```

### 伤害公式

```
D = floor(Ω × P × (A/D) × R × (1 + M))
```

| 符号 | 来源                                         | 说明          |
| ---- | -------------------------------------------- | ------------- |
| Ω    | `actor.sequence.divinity` 或 `神性.json`     | 神性倍率      |
| P    | pathway 配置 `skill.power`（固定值或序列表） | 技能倍率      |
| A    | `computeAttack(stats, effects, damageType)`  | 攻击力        |
| D    | `computeDefense(stats, effects, damageType)` | 防御力        |
| R    | `0.9 + Math.random() × 0.2`                  | ±10% 随机浮动 |
| M    | `damageModifier + tagModifier`               | 总修正系数    |

#### 攻防计算

```
专精属性 specific =
  physical:  (vitality + agility) / 2
  mystical:   spirituality
  mental:    (sanity + humanity) / 2
  mixed:     luck

base = floor(specific × 0.4 + max(六维) × 0.6)
最终 = applyBuffDebuff(effects, "attack"|"defense", base)
```

#### 标签克制

```
M_tag = ∑ tagDamageRelations[attackerTag][defenderTag]
结果钳制在 [-0.75, 1.5] 之间

示例：
  attacker.tags = ["精神", "混乱"]
  defender.tags = ["格斗"]
  标签伤害修正.json["精神"]["格斗"] = 0.4  → 伤害 +40%
```

### CombatActionResult 返回值

```ts
interface CombatActionResult {
  canAfford: boolean;
  costMessage: string;
  damage: number; // 正值=伤害，负值=治疗
  targetAttribute: "vitality" | "sanity"; // mental 伤害打 sanity，其余打 vitality
  appliedEffects: EffectInstance[]; // 技能效果（已按同名替换规则处理）
  costDeductions: CostDeduction[]; // 消耗扣减明细
  formula: string; // 公式展示文本
  details: string; // 完整日志
}
```

---

## 四、关键设计原则

1. **纯函数核心**：`recalculateMaxStats`、`executeCombatAction` 不修改输入对象，所有变更通过返回值传播
2. **状态分层**：base / max / current 三层分离，max 是计算产物不持久化，current 是受伤害/治疗影响的运行时值
3. **自动解析**：神性、标签、技能定义均从配置按序列名/等级自动推导，GM 无需手写
4. **完整回写**：一次 resolve_combat 调用自动完成消耗扣减、伤害写入、效果追加，无需额外工具调用
5. **luck 豁免**：运气属性不受任何效果修正，始终为 base 值

---

## 五、扩展指南（面向装备系统）

后续新增装备系统时，需对齐以下接口：

- 装备提供的属性加成应写入 `actor.stats.max`（通过 `recalculateMaxStats` 或直接更新 base）
- 装备提供的标签应合并到 `actor.sequence.tags`（注意 duration 和 stacks 管理）
- 装备触发的被动效果应写入 `actor.condition.statusEffects`
- 装备系统的专用配置（如 `标签治疗修正.json`）保持独立，不污染上述文件
