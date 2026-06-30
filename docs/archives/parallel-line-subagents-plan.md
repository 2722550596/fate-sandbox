# 平行线 Subagent 化计划书

## 目标

把 Fate 沙盒中的“平行线”从主 GM 的长篇插叙，改造成由独立 subagent 驱动的后台世界进程。主 GM 只负责玩家可见叙事与状态落地；平行线 subagent 负责各阵营在玩家视野外的独立行动、秘密推进与未来钩子生成。

核心目标：

1. 保持圣杯战争多阵营同时行动的真实感。
2. 避免主 GM context 长期塞入玩家不可见秘密。
3. 防止世界围绕玩家转，让 NPC 阵营拥有独立目标与时间线。
4. 把原卡优秀的“平行线 OVA”结构工程化、状态化、可控化。

## 设计原则

### 1. 主 GM 管玩家可见世界

主 GM 负责：

- 玩家侧行动响应。
- public state 更新。
- 玩家可见叙事输出。
- 决定哪些后台事件以痕迹、传闻、梦境、NPC 异常行动等方式投影到玩家侧。

主 GM 不直接长篇生成平行线，也不长期保存完整幕后真相。

### 2. 平行线 subagent 管世界背面

平行线 subagent 负责：

- 某个 NPC / 阵营在指定时间窗口内的 offscreen 行动。
- 基于自身目标、知识边界、资源与命令推进事件。
- 产出结构化 secret/offscreen event 候选。
- 给出 future hooks，而不是直接改 public state。

### 3. Engine / tools 管事实落地

subagent 不能直接写 canonical state。它只提交候选结果，由主 GM 或专用工具写入：

- `secrets.secretEventLog`
- offscreen event log
- future hooks
- 必要时投影为 public memory / scene threat / clue

## 推荐架构

```txt
玩家输入
  ↓
主 GM 结算玩家侧
  ↓
必要时调用一个或多个 parallel-line subagent
  ↓
subagent 返回结构化 offscreen event
  ↓
主 GM 选择落入 secret state / public clue / 暂不展示
  ↓
玩家可见叙事
```

## Subagent 类型

优先实现以下平行线：

### 1. Lancer / Church 线

负责：

- 库丘林侦察、战斗余波、巴泽特记忆锚点。
- 言峰绮礼命令与监督者侧行动。
- 教会对圣杯战争局势的暗中干预。

适合原因：认知边界清晰，行动独立，容易生成未来遭遇钩子。

### 2. Caster / Ryudou Temple 线

负责：

- 美狄亚阵地建设。
- 柳洞寺结界、山门守卫、葛木宗一郎。
- 对御主 / 从者入侵的防御准备。

适合原因：高度秘密，玩家侧只能通过侦察痕迹逐步揭示。

### 3. Matou 线

负责：

- 樱、慎二、脏砚、Rider 权限变化。
- 间桐宅内部压力与异常行动。
- 樱秘密不能泄露到 public actor。

适合原因：强秘密隔离需求，当前 public/secrets 架构能承接。

### 4. Illya / Einzbern 线

负责：

- 伊莉雅与 Berserker 的追猎行动。
- 爱因兹贝伦城准备。
- 对士郎与 Saber 的兴趣变化。

适合原因：可作为高压外部威胁后台推进。

### 5. Tohsaka 线

负责：

- 凛的宝石库存、术式准备、情报整理。
- 契约从者资源调度。
- 与玩家侧同盟后的独立判断。

适合原因：可模拟盟友不是玩家附属物，而是独立御主。

## 输入契约

每次调用平行线 subagent 时，输入应尽量窄，不给完整主状态。

建议输入：

```ts
interface ParallelLineInput {
  lineId: string;
  timelineId: TimelineId;
  genreContract: string;
  activePressurePalette: string[];
  timeWindow: {
    start: string;
    end: string;
  };
  currentArc: string;
  currentBeat: string;
  allowedScope: string[];
  forbiddenEscalations: string[];
  knownFacts: string[];
  privateFacts: string[];
  actorGoals: string[];
  previousLineState: string;
  playerSideSummary: string;
}
```

重点字段：

- `timelineId`: 当前世界线；平行线必须按对应 profile 推进，不能把 FSF/FSN/事件簿/月姬模板互相硬套。
- `genreContract`: 本次调用时主 GM 给出的题材契约短句。
- `activePressurePalette`: 当前世界线/篇章允许优先使用的压力类型。
- `allowedScope`: 本次平行线允许推进的内容。
- `forbiddenEscalations`: 禁止提前触发的剧情，如“不得进入柳洞寺山门战斗”。
- `knownFacts`: 该阵营实际知道的事实。
- `privateFacts`: 该阵营自己的秘密，不得泄露给玩家。
- `playerSideSummary`: 只给与该阵营可能相关的玩家侧摘要，避免全知。

## 输出契约

subagent 不输出完整小说作为默认结果，而输出结构化事件。

```ts
interface ParallelLineOutput {
  lineId: string;
  timelineId: string;
  actorIds: string[];
  timeRange: {
    start: string;
    end: string;
  };
  outcome: "no-change" | "progress" | "escalation" | "blocked";
  privateSummary: string;
  secretStateChanges: string[];
  publicLeakCandidates: string[];
  futureHooks: string[];
  toneDriftRisk: "none" | "watch" | "drifting";
  genreFitNotes: string[];
  riskFlags: string[];
  optionalNarrativeSnippet: string | null;
}
```

字段说明：

- `privateSummary`: 给主 GM / secret log 的后台事实。
- `secretStateChanges`: 可落入 secret state 的变更。
- `publicLeakCandidates`: 可通过痕迹、传闻、梦境、NPC 表情等方式投影到玩家侧的信息。
- `futureHooks`: 后续遭遇或冲突钩子。
- `toneDriftRisk`: 这条后台推进是否有偏离当前世界线题材契约的风险。
- `genreFitNotes`: 为什么这条推进符合/不符合当前 timeline 的说明，供主 GM 审核。
- `optionalNarrativeSnippet`: 只有 major beat 结束时才考虑展示给玩家。

## 状态模型建议

新增或扩展 offscreen event 结构：

```ts
interface OffscreenEvent {
  id: string;
  lineId: string;
  actorIds: string[];
  timeRange: {
    start: string;
    end: string;
  };
  visibility: "secret" | "foreshadowed" | "player-known";
  summary: string;
  consequences: string[];
  futureHooks: string[];
  createdFrom: "parallel-line-subagent" | "gm" | "debug";
}
```

示例：

```txt
lineId: lancer-church
visibility: secret
summary: 库丘林完成森林外缘侦察，向言峰汇报柳洞寺方向存在高密度结界与山门残影。
consequences:
- 言峰命令库丘林明晚监视柳洞寺外围。
- Lancer 明晚可能出现在柳洞寺周边。
futureHooks:
- 若玩家明晚靠近柳洞寺外围，有概率被 Lancer 发现或反跟踪。
```

## 展示节奏

平行线不应每回合都长篇展示。

建议分级：

1. **Minor turn**  
   只写 secret event，不展示给玩家。

2. **Medium turn**  
   给玩家 2-4 句痕迹或镜头，例如教会灯火晚熄、远处枪兵气息一闪。

3. **Major beat end**  
   可以展示一段完整平行线 OVA，例如库丘林回教会汇报。

4. **Arc transition**  
   多条平行线并行结算，形成下一事件窗口。

## 安全与纪律

### 1. 禁止 subagent 直接写 public state

所有状态落地必须由主 GM 或工具执行。

### 2. 禁止玩家不可见秘密直接展示

平行线 private summary 不能原样进入玩家叙事。玩家只能看到：

- 痕迹
- 传闻
- 梦境
- 异常行动
- 事后结果
- reveal_secret 成功后的公开事实

### 3. 禁止越过剧情窗口

每条平行线必须遵守当前 arc / beat 的 forbidden escalation。

例如：

```txt
当前 beat: 柳洞寺侦察收尾
禁止: 触发山门战斗、佐佐木小次郎正式现界、美狄亚正面战
允许: 结界准备、监视命令、外围巡逻、未来钩子
```

### 4. NPC 认知隔离

subagent 只能使用该阵营知道的信息。不能因为主 GM 知道玩家侧细节，就让言峰、库丘林、美狄亚自动知道。

## 实施步骤

### Phase 1: 文档与契约

1. 在 docs 中记录平行线 subagent 架构。
2. 定义 `ParallelLineInput` / `ParallelLineOutput`。
3. 明确主 GM 与 subagent 的职责边界。
4. 写出 Lancer / Church 线作为第一个样例。

### Phase 2: Secret event 状态支持

1. 扩展 secret/offscreen event 数据结构。
2. 增加工具：`record_offscreen_event`。
3. 工具要求：只能写 secret 或 foreshadowed，不默认写 public memory。
4. 增加测试：offscreen event 不进入 get_status 玩家简报。

### Phase 3: 第一个 subagent

实现 `parallel-line-lancer`：

- 输入：时间窗口、言峰命令、Lancer 当前任务、已知战场态势。
- 输出：侦察结果、教会汇报、未来监视钩子。
- 不输出玩家不可见秘密给玩家。

### Phase 4: 主 GM 调用流程

在 major beat end 或长时间跳过时：

1. 主 GM 总结玩家侧事件。
2. 调用相关平行线 subagent。
3. 读取结构化输出。
4. 写入 secret/offscreen event。
5. 仅在合适时展示短镜头或痕迹。

### Phase 5: 扩展到其他阵营

按优先级追加：

1. Caster / Ryudou Temple
2. Matou
3. Illya / Einzbern
4. Tohsaka

## 验收标准

1. 平行线事件能落入 secret/offscreen state。
2. `get_status` 不泄露 secret offscreen event。
3. 玩家侧能通过痕迹或未来遭遇感受到后台事件影响。
4. subagent 输出不会直接改 public state。
5. 长跑 20-30 turn 后，各阵营行为仍与自身目标一致。
6. 剧情窗口不会被 subagent 提前打穿。
7. 平行线不会每回合抢主线篇幅。

## 总结

平行线 subagent 的价值不是“多写一段插叙”，而是让 Fate 圣杯战争变成真正的多阵营后台模拟。

最终目标：

```txt
主 GM 管玩家可见世界；
平行线 subagent 管世界背面的独立行动；
engine/tools 管哪些结果成为事实。
```
