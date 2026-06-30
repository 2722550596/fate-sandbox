# 原卡优点吸收计划书

## 目标

在不照搬 SillyTavern 标签、状态栏、思考链与小数好感度的前提下，吸收原卡聊天楼层中真正有工程价值的设计：剧情窗口、认知隔离、战术细节、关系微动作、记忆日志、状态覆盖与多阵营节奏。

本计划与 `docs/parallel-line-subagents-plan.md` 互补：平行线 subagent 是其中一个方向；本文覆盖其他可吸收优点。

## 总原则

### 吸收什么

- 可结构化的剧情约束。
- 可落入 state / tools / memory 的事实。
- 可稳定指导 GM 的叙事纪律。
- 能提高长跑一致性的记录格式。
- 能强化 Fate 多阵营博弈感的后台机制。

### 不吸收什么

- `<story_driver>` / `<npc_driver>` / `<status>` 这类 ST 标签原格式。
- 输出式思考过程。
- HTML 状态栏或宏式状态栏。
- GM 自由口算小数好感度。
- 每回合固定长篇平行线 OVA。
- 玩家不可见秘密直接塞进 public memory。

---

## 1. 剧情窗口与 Beat 边界

### 原卡优点

原卡强制锚定：

- 当前主线事件。
- 当前事件窗口。
- 本回合允许推进内容。
- 禁止提前触发的未来事件。

例如：侦察收尾阶段只能完成结界确认、撤退、汇合、回宅整理情报，不能提前进入柳洞寺山门战斗。

### 吸收方案

新增 story beat / arc window 概念。

建议状态结构：

```ts
interface StoryWindowState {
  currentArcId: string;
  currentBeatId: string;
  title: string;
  allowedActions: string[];
  forbiddenEscalations: string[];
  completionCriteria: string[];
  nextBeatHints: string[];
}
```

示例：

```txt
currentArcId: B2
currentBeatId: ryudou-scouting-wrapup
title: 柳洞寺侦察收尾
allowedActions:
- 完成北侧断崖结界确认
- 发送撤退信号
- 与西侧山林小队汇合
- 安全撤回卫宫宅
- 茶间整理情报
forbiddenEscalations:
- 不得触发佐佐木小次郎正面战
- 不得进入柳洞寺山门战斗
- 不得公开美狄亚全部底牌
completionCriteria:
- 四人安全撤回
- 结界四重结构被记录
- 下一步战术问题被提出
```

### 实施步骤

1. 在 docs 中定义 story window 规则。
2. 先不急着写复杂工具，可用 `record_memory` 记录当前 beat。
3. 后续增加 `update_story_window` 工具。
4. `get_status` 显示玩家可见的当前目标和禁区，但不泄露 secret。
5. 长跑测试：确认 GM 不提前消费未来战斗。

---

## 2. 场景完成条件

### 原卡优点

每个回合不是模糊“继续”，而是有明确完成条件：

- 最终确认。
- 撤退信号。
- 汇合。
- 安全返回。
- 情报整理。

### 吸收方案

把场景目标从单句 objective 扩展为 checklist 或多 objective。

可先用现有 `update_scene add-objective / resolve-objective` 实现：

```txt
objective-1: 完成结界最终确认
objective-2: 向另一队发送撤退信号
objective-3: 与 Saber / 士郎汇合
objective-4: 撤回卫宫宅
objective-5: 完成茶间情报整理
```

### 实施步骤

1. 在 GM 规则中要求复杂行动拆成 2-5 个当前场景目标。
2. 每完成一个目标调用 `resolve-objective`。
3. 如果一次回复压缩多个目标，必须逐项更新状态。
4. 测试侦察、逃跑、潜入、战斗准备等复杂场景。

---

## 3. 角色认知边界

### 原卡优点

原卡明确每个角色知道什么、不知道什么。例如：

- 梅莉不知道柳洞寺完整布置。
- Saber 只能感知魔力密度异常。
- NPC 不知道梅莉来自旧剑世界。
- 玩家侧不能凭 GM 全知获得山门守卫细节。

### 吸收方案

建立 Actor Knowledge Lens。

建议结构：

```ts
interface ActorKnowledgeState {
  actorId: string;
  knows: string[];
  suspects: string[];
  falseBeliefs: string[];
  forbiddenKnowledge: string[];
}
```

不一定马上落入 public state；可以先作为 secret/offscreen 结构。

### 工具方向

未来可增加：

```txt
record_actor_knowledge
- actorId
- kind: knows | suspects | false-belief | forbidden
- text
- sourceEventId
- visibility
```

### GM 规则

- NPC 台词只能来自 knows / suspects / 合理推断。
- private_resolve 可以使用 secret，但只能返回玩家安全约束。
- reveal_secret 成功后，才把 secret 投影到 public actor / memory。

---

## 4. 战术身体感叙事

### 原卡优点

原卡把战术行动写成可感知动作，而不是抽象结论：

- 鞋底在湿苔上偏半寸。
- Saber 倒持无形之剑避免树枝发声。
- 士郎按平符纸翘角。
- 凛摸岩壁确认魔力残留。
- 玄关鞋底剔出溪道小石子。

### 吸收方案

写入 GM 叙事纪律：战术行动必须通过身体、地形、装备、残留体现。

建议规则：

```txt
侦察/潜入/撤退/战斗准备不能只输出“成功”。必须至少描写两类具体阻力：
- 地形阻力
- 装备处理
- 身体代价
- 魔力残留
- 声音/气味/温度变化
- 同伴动作配合
```

### 实施步骤

1. 加入 `agents/gm-rules.md` 或 `agents/gm-context.md`。
2. 在 playtest 中特别测试：潜入、撤退、追踪、结界侦察。
3. 检查 GM 是否仍只给结论；若是，继续加强工具描述或 few-shot。

---

## 5. 关系通过微动作推进

### 原卡优点

关系变化不靠直白解释，而靠边界动作：

- Saber 说“像卡美洛城墙术式”，但不等回答。
- 梅莉说“不愧是”却不接称呼。
- 凛听出异常但只说“回去之后说明，现在就算了”。
- Saber 接受关心，但仍不承认疼痛。

这比“好感 +1”更有角色质感。

### 吸收方案

关系记录从数值转向 qualitative tags。

建议结构：

```ts
interface RelationshipSignal {
  actorId: string;
  targetActorId: string;
  signal: string;
  interpretation: string;
  boundary: string;
  sourceEventId: string;
}
```

示例：

```txt
signal: Saber 主动提及卡美洛城墙术式相似
interpretation: 她确认梅莉与旧识存在联系，但不要求立即解释
boundary: 不追问旧剑世界，不公开质问
```

### 实施步骤

1. 暂时用 `record_memory record-major-event` 保存重大关系信号。
2. 后续实现 `record_relationship_signal` 工具。
3. `get_status` 只展示简短关系 stance，不展示完整心理剖析。
4. GM 规则禁止用“她好感上升了”这种裸数值叙事。

---

## 6. 记忆日志分层

### 原卡优点

`memory_log` 很强，分为：

- 玩家侧事件。
- 平行线事件。
- NPC 内心变化。
- NPC 关系变化。

这非常适合长跑一致性。

### 吸收方案

将 memory 分为 public / secret / relationship / offscreen 四类。

建议分类：

```txt
public event memory:
玩家已知重大事件。

secret offscreen memory:
玩家未知后台事件。

relationship signal memory:
关系变化的行为证据。

npc internal shift:
只给对应 subagent 或 private_resolve 使用，不进玩家简报。
```

### 实施步骤

1. 先规范 `record_memory` 的使用：重大事件必须带 consequences。
2. 增加 offscreen event 工具后，平行线进 secret memory。
3. 增加关系信号工具后，替代小数好感。
4. `get_status` 只展示玩家可知的最近重大记忆。

---

## 7. 状态覆盖面吸收

### 原卡优点

状态栏覆盖面完整：

- 职阶 / 真名公开状态。
- HP / SP。
- 契约。
- 灵体状况。
- 永久缺损。
- 武装耐久。
- 当前任务。
- 位置。
- 服装。
- 行囊。
- 能力 / 宝具。

### 吸收方案

不照搬状态栏表现，但吸收字段覆盖面。

映射到当前 state：

```txt
职阶 / 真名 → servantForm.identity
HP / SP → servantForm.condition spiritualCore / mana，或离散 wound / affliction
契约 → servantForm.contract / master role
灵体状况 → actor.condition.afflictions / servantForm.condition.spiritualCondition
永久缺损 → permanentEffects / permanentDefects
武装耐久 → trackedItems
当前任务 → scene.objectives
位置 → scene.location
服装 → actor.presentation.outfit
行囊 → actor.inventory + trackedItems
能力 / 宝具 → actor.abilities + servantForm.skills / noblePhantasms
```

### 实施步骤

1. 补足 tracked item 创建 / 更新工具。
2. 给武器、法杖、符纸、宝石库存等关键物品建模。
3. 避免 HP/SP 百分比裸露给玩家；get_status 转成自然语言摘要。
4. 测试装备损坏、物品转移、消耗品消耗。

---

## 8. 剧情钩子与潜在事件

### 原卡优点

原卡有潜在事件概率与递增：

- 凛追问梅莉与 Saber 关系。
- Saber 深夜茶间对话。

这能防止伏笔遗忘。

### 吸收方案

不要让 GM 口算概率；改成 pending hooks。

建议结构：

```ts
interface PendingHook {
  id: string;
  title: string;
  triggerWindow: string;
  conditions: string[];
  urgency: "low" | "medium" | "high";
  expiresAt?: string;
  visibility: "secret" | "player-known";
}
```

示例：

```txt
hook: Saber 可能深夜找梅莉谈卡美洛术式
conditions:
- Saber 与梅莉同处卫宫宅
- 夜间休息前
- 没有高优先级战斗威胁
urgency: low
```

### 实施步骤

1. 用 memory 先记录 pending hooks。
2. 后续实现 `add_pending_hook / resolve_pending_hook`。
3. GM 在长时间跳过前检查 pending hooks。
4. hook 不强制触发，只防止遗忘。

---

## 9. 资源与代价纪律

### 原卡优点

原文能细分 SP、法杖耐久、宝石、符纸、结界维护、自然回复。

### 吸收方案

保留“资源有代价”的原则，但不要裸百分比泛滥。

建议：

- 从者魔力：用 `mana` 内部数值，玩家摘要自然语言化。
- 宝石库存：tracked items 或 economy special resources。
- 符纸：ordinary item 或 consumable tracked item。
- 结界维护：scene / tracked item / memory event。
- 自然回复：长休或低消耗场景通过工具推进。

### 实施步骤

1. 为宝石、符纸、法杖、结界节点设计 tracked item schema。
2. 增加消耗 / 修复 / 耐久更新工具，或扩展 actor condition item flow。
3. 测试：宝石消耗、符纸破损、武器耐久下降、休息恢复。

---

## 10. 日英双语台词风格

### 原卡优点

关键台词使用日文原句 + 中文翻译，能强化 Fate 氛围。

### 吸收方案

作为风格选项，不作为硬规则。

建议：

```txt
关键台词、咒文、称呼、宝具相关语句可使用日文原句 + 中文括注。
普通叙事不滥用双语。
不要让双语挤占行动结算与状态更新。
```

### 实施步骤

1. 在 GM context 增加“关键台词可双语”的风格说明。
2. 限制频率：每回合 1-3 句即可。
3. 技术状态、工具输出不用双语。

---

## 11. 叙事密度控制

### 原卡优点

细节密度高，氛围强。

### 风险

如果每回合都按原卡密度输出，会导致：

- 玩家输入被淹没。
- 工具状态更新跟不上叙事。
- 平行线抢主线。
- context 快速膨胀。

### 吸收方案

建立密度档位。

```txt
normal turn: 600-1200 字，聚焦玩家决策。
complex scene: 1200-2500 字，允许战术细节。
major beat end: 2500-5000 字，允许平行线和总结。
arc transition: 可更长，但必须先落 memory/offscreen state。
```

### 实施步骤

1. GM rules 加入节奏约束。
2. 平行线默认只存 secret summary，major beat end 才展示。
3. playtest 检查叙事是否过长导致状态没写。

---

## 优先级建议

### P0：立即吸收

1. 剧情窗口与 forbidden escalation。
2. 场景完成条件 checklist。
3. 角色认知边界规则。
4. 工具成功前不得声称状态已更新。

### P1：下一阶段实现

1. offscreen event state / tool。
2. pending hook state / tool。
3. relationship signal memory。
4. tracked item 创建与耐久 / 消耗更新。

### P2：风格增强

1. 战术身体感叙事规则。
2. 日文关键台词 + 中文括注。
3. 叙事密度档位。
4. major beat end 平行线展示策略。

## 验收标准

1. GM 能明确当前剧情窗口，不提前触发未来战斗。
2. 复杂场景会拆目标并逐项 resolve。
3. NPC 不会说出自己不该知道的信息。
4. 玩家不可见秘密不会进入 public actor / get_status。
5. 侦察、潜入、撤退有身体、地形、装备细节。
6. 关系变化通过行为证据记录，而非裸数值。
7. offscreen / pending hooks 能影响未来，但不会抢当前主线。
8. 长跑 20-30 turn 后，记忆日志能解释关键关系和剧情变化。

## 总结

原卡最值得吸收的不是标签和状态栏，而是以下能力：

```txt
剧情边界清楚；
角色认知隔离；
战术行动具体；
关系变化有微动作证据；
后台世界独立运行；
记忆日志能支撑长跑一致性。
```

迁移时应把这些能力变成 state、tools、GM rules 和 subagent 契约，而不是继续依赖大段 prompt 标签维持。
