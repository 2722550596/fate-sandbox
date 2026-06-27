# Secret-Driven Memory：LOTM 叙事引擎中的知识审计设计

> 本文档解释 LOTM 叙事引擎中 secrets（隐藏层）与 memory（公开层）之间存在双向绑定的设计原因、数据流、以及为什么它不是一个"过度工程"的问题。

---

## 常规文字游戏的"大统一记忆"

在大多数文字游戏 / 聊天式叙事引擎中，"记忆"就是一个巨大的事件日志：

```
记忆 = 发生过的一切
```

- GM 写什么，memory 就存什么
- 秘密是另一个独立列表：「玩家还不知道的事」
- 两者几乎没有交集

这个模型对**大多数场景**是够用的。但 LOTM 不同。

---

## LOTM 的核心矛盾

LOTM 是一个**以秘密为核心驱动力**的世界：

- 途径、序列、动机、阵营、古代历史……全是秘密
- "知道一个秘密"本身就是剧情推进的手段
- 玩家知道什么、不知道什么，是 GM 需要精确控制的

这就产生了一个**传统模型无法处理的矛盾**：

1. memory 必须包含**重要的剧情信息**（否则 GM 没法回查）
2. 重要剧情信息绝大多数**一开始是秘密**
3. 如果 memory 可以绕过秘密系统直接写入，秘密防线就形同虚设

---

## 解决方案：Secret-Driven Memory

引擎的设计是：

```
secrets（隐藏真相 —— 秘密的真实状态）
  │
  │  [证据收集 + reveal_secret 验证]
  │
  ▼
revealState = "revealed"（秘密系统确认：可以公开了）
  │
  │  [自动生产公开记录 —— recordMemory + claims]
  │
  ▼
memory（公开知识库 —— 已过审的事实 + 审计日志）
```

### 关键区分

| 概念        | 是什么                   | 不是什么                         |
| ----------- | ------------------------ | -------------------------------- |
| **memory**  | 公开知识库的**存储层**   | 发生过的全部（不是）             |
| **secrets** | 全部隐藏真相的**权威源** | 单纯的"不告诉玩家的列表"（不是） |
| **claims**  | 公开事实的**审计日志**   | memory 的"额外元数据"（不是）    |

### claims 不是 memory 的功能，是 secret 的副产品

`MemoryClaim` 这个名字容易产生误解。它包含的属性：

```ts
interface MemoryClaim {
  kind: "mundane" | "identity" | "location" | ...;  // 事实类型
  certainty: "observed" | "confirmed" | "inferred" | "rumor" | "hypothesis";  // 确定性
  subjectId?: string;             // 关联 actor
  relatedSecretSlotIds?: string[]; // 关联的秘密 slot
  evidence?: string;              // 证据描述
}
```

每一个属性都是**为"这个秘密是怎么变公开的"这个问题服务的**：

- `certainty` — 玩家是通过亲眼看到（observed）、逻辑推理（inferred）、还是听说（rumor）知道这个事实的？
- `evidence` — 有什么具体证据支撑这个认知？
- `relatedSecretSlotIds` — 这个公开事实背后对应哪个秘密 slot？

**claim 本质上是"解密证明章"**——它证明一段公开知识是从哪个隐藏秘密、通过什么方式、经谁验证后流入 public memory 的。

---

## 数据流的完整形态

```
┌─────────────────────────────────────────────────────┐
│                  秘密系统（secrets/）                  │
│                                                      │
│  configure_actor_secrets     隐藏动机/阵营/途径/序列    │
│  configure_sequence_secrets  配置秘密 slot             │
│  add_hidden_world_fact       配置世界隐藏事实            │
│         │                                              │
│         ▼                                              │
│  reveal_secret                                        │
│    ├─ claim-reveal:    玩家提出具体"断言"来验证         │
│    └─ observed-reveal: 玩家"看到"了什么触发揭示          │
│         │                                              │
│         ▼  匹配 secret slot                            │
│  slot.revealState = "revealed"                         │
│         │                                              │
│         ▼  自动                                      │
│  recordMemory(draft, {                                │
│    kind: "record-major-event",                        │
│    claims: [{ kind: "world-fact",                     │
│               certainty: "confirmed",                 │
│               evidence: "reveal_secret验证通过" }],    │
│  })                                                   │
│         │                                              │
└─────────┼────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│             公开知识库（memory/）                      │
│                                                      │
│  public.memory:                                      │
│    pinnedFacts[]      ← 离散事实钉                     │
│    eventLog[]         ← 重大事件                       │
│    dailySummaries[]   ← 日终摘要                       │
│                                                      │
│  读取:                                               │
│    recall_memory     ← 关键词/actor/地点/scope 检索    │
│    GM Brief          ← 投影到公开简报                  │
│    Player Panel      ← 投影到玩家界面                  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 另一条路径：GM 手动写入 memory

GM 当然也可以直接调 `record_memory`。此时 `validateClaims` 执行同样的防火墙逻辑：

- 「我想把一个未揭示的秘密写成 confirmed 级别的事实」→ 拒绝
- 「我只想写一条日常记录（mundane claim）」→ 放行
- 「我写一个 hypothesis 级别的推测，措辞带'可能'」→ 放行

这不是"memory 管太宽"，这是**公开知识库的入口审计**——进来的每一笔记录都必须有来源证明。

---

## 如果拆掉这个设计会怎样？

| 场景                                 | 有 claim + 防火墙                       | 无                                  |
| ------------------------------------ | --------------------------------------- | ----------------------------------- |
| GM 写 `"克莱恩是愚者先生"` 到 memory | 防火墙拦截（除非已揭示）                | 直接入库，玩家可见                  |
| 秘密被揭示                           | 自动生成带 evidence 的公开记录          | GM 需手动补 `record_memory`，容易忘 |
| 玩家查阅事实来源                     | 可从 claim 追溯 certainty 和 evidence   | 所有 memory 平级，无法分辨可信度    |
| 秘密 vs 公开状态一致性               | secrets 控制 → reveal → memory 自动写入 | secrets 和 memory 可能不同步        |

---

## "反直觉"的根源：文件归属

这个设计**逻辑上是自洽的**，但它的文件组织把读者引向了错误的理解：

### 现状

```
engine/core/
  memory/
    memory.ts           ← 包含 validateClaims（本应是 secret 领域的审计逻辑）
    memory-schema.ts    ← 定义了 MemoryClaim（实际上是公开事实的审计记录）
    memory-recall.ts    ← 纯检索，不受影响
  secrets/
    secrets.ts          ← 真正的秘密逻辑
    secrets-schema.ts
```

### 应该被理解成

```
knowledge/
  secrets/              ← 隐藏真相的权威源
    secrets.ts
    secrets-schema.ts
  public-facts/         ← 公开知识的审计与存储
    audit.ts            ← 原来 memory.ts 里的 validateClaims（解密证明检查）
    fact.ts             ← recordMemory（公开知识的写入与检索）
```

`MemoryClaim` 叫"memory 的 claim"是误导。它更接近 `DeclassificationProof`（解密证明）——证明一段公开知识是从哪个秘密、怎么变公开的。

---

## 小结

1. **秘密是 LOTM 的核心叙事资源**，不是附带的"隐藏信息"
2. **Memory 是公开知识库**，不是"所有发生的事情"
3. **Claims 是秘密到公开的审计桥接**，不是 memory 的多余元数据
4. **这个设计在保护一个关键约束**：没有经过秘密系统验证的事实，不能以高确定性写入公开知识库
5. **"反直觉"来自文件命名和归属**，不是来自逻辑本身
