# Fate 残留检测报告

## 检测范围

- `engine/direction/`
- `engine/audit/`
- `engine/gm-prompt/`

---

## 🔴 红色：设计/功能完全就是 Fate 特有

### 1. `engine/direction/render-turn.ts` — `PROSE_CUSTOM_TYPE = "fsn-prose"`（生产代码）

- **文件**: `engine/direction/render-turn.ts`
- **行号**: 15
- **问题**: `"fsn"` = Fate/stay night 的缩写。这是生产级常量，贯穿整个双 pass 架构。
- **引用链**:
  - `settlement-prose-firewall.ts:13`（注释提及 `fsn-prose`）
  - `settlement-compaction.ts:11`（import `PROSE_CUSTOM_TYPE`）
  - `render-turn.ts` 多处作为 `isProseMessage()` 的匹配 key
- **影响**: 这个 customType 被 extension 层的 context 过滤和渲染装配逻辑依赖，改名为 LOTM 中性名称（如 `lotm-prose`）需要同步修改以下目录的消费方：
  - `extensions/`（UI 面板过滤逻辑）
  - `engine/audit/session-audit.ts`（双 pass 审计）
  - 持久化 session 历史中的旧 entry 兼容（migration 或双读）

### 2. `engine/audit/session-audit.ts` — `fsn-prose` / `fsn-state` custom type（生产代码）

- **文件**: `engine/audit/session-audit.ts`
- **行号**: 31, 111, 115, 119, 164, 170–171, 535, 541
- **问题**: 8 处引用 `fsn-prose` 或 `fsn-state`，包括：
  - 类型定义注释（31, 111, 115, 119）
  - 运行时入口类型匹配（164: `customType === "fsn-state"`、171: `customType === "fsn-prose"`）
  - 函数注释（535: "最后一个 fsn-state 快照"）
- **影响**: 纯生产代码，改名为 LOTM 命名后需同步改所有引用

### 3. `engine/audit/session-audit.test.ts` — `fsn-prose` / `fsn-state`（测试代码）

- **文件**: `engine/audit/session-audit.test.ts`
- **行号**: 42, 52, 120, 267, 485
- **问题**: 测试用例中使用 `fsn-state` 和 `fsn-prose` 作为 customType 值（测试代码中的 Fate/stay night 命名）

### 4. `engine/direction/settlement-compaction.test.ts` — `fsn-prose`（测试代码）

- **文件**: `engine/direction/settlement-compaction.test.ts`
- **行号**: 106
- **问题**: 测试辅助函数 `proseMessage()` 中使用 `customType: "fsn-prose"`

### 5. `engine/direction/packet-schema.test.ts` — 两仪式 / 直死之魔眼（测试数据）

- **文件**: `engine/direction/packet-schema.test.ts`
- **行号**: 76, 80, 150, 156, 161, 188, 195, 199, 207, 212, 224, 227
- **问题**: "两仪式"（Ryōgi Shiki）和 "唯识·直死之魔眼"（Mystic Eyes of Death Perception）作为秘密泄漏测试数据。这些是 Type-Moon/Kara no Kyōkai 特有概念，移植 LOTM 后作为测试数据不适当。
- 具体行：
  - `suggestedActions: [{ submitText: "我说出两仪式的名字。" }]` (76)
  - `refusesToSay: "自己的真名是两仪式"` (150)
  - `move: "报出真名两仪式，要求结盟"` (188)
  - `resolvedChanges: ["两仪式 出刀"]` (207)
  - `canonFacts: ["隐藏宝具「唯识·直死之魔眼」尚未公开"]` (208)
  - `directReply: "她的真名是两仪式。"` (224)

### 6. `engine/direction/render-turn.test.ts` — 两仪式（测试数据）

- **文件**: `engine/direction/render-turn.test.ts`
- **行号**: 277, 289–290
- **问题**: "两仪式"作为秘密泄漏测试数据
  - `lintRenderedProse("她的真名是两仪式。", ["两仪式"])` (277)
  - `redactSecrets("两仪式出刀，两仪式收刀。", ["两仪式"])` (289)

### 7. `engine/audit/lint-rules.test.ts` — 两仪式（测试数据）

- **文件**: `engine/audit/lint-rules.test.ts`
- **行号**: 177, 181, 185, 189
- **问题**: "两仪式"作为秘密泄漏测试数据
  - `findSecretLeaks("她低声说：我是两仪式。", ["两仪式"])` (177)
  - `findSecretLeaks("两仪式……两仪式！", ["两仪式"])` (185)
  - `findSecretLeaks("Saber 沉默着。", ["两仪式"])` (189)

---

## 🟡 黄色：命名/测试数据中 Fate 概念残留，不严重

### 8. `engine/direction/packet-schema.test.ts` — Saber / Rider / saber_shiki（测试数据）

- **文件**: `engine/direction/packet-schema.test.ts`
- **行号**: 9–10, 13, 18, 21, 23
- **问题**: 测试数据中使用 Fate 从者类名和角色 ID
  - `playerAction: "向 Saber 下达突进指令"` (9)
  - `resolvedChanges: ["Saber 突进受阻，被迫转为阵地防守"]` (10)
  - `actorId: "saber_shiki"` (13)
  - `endWindow: "玩家必须创造让 Saber 近身的破绽"` (21)
  - `canonFacts: ["Rider 的双枪是概念化的舰队火炮"]` (23)

### 9. `engine/direction/render-turn.test.ts` — Saber（测试数据）

- **文件**: `engine/direction/render-turn.test.ts`
- **行号**: 18, 119, 157–159, 169, 209
- **问题**: 测试数据中使用 Saber 和 凛（Tōsaka Rin）
  - `resolvedChanges: ["Saber 突进受阻"]` (18)
  - assertions matching "Saber 突进受阻" (119)
  - `canonicalName: "Saber"`, `renderName: "Saber"` (159)
  - `renderName=Saber` assertion (169)
  - `"凛面对质问退让，同盟出现裂痕"` (209)

### 10. `engine/direction/settlement-compaction.test.ts` — 令咒 / Saber（测试数据）

- **文件**: `engine/direction/settlement-compaction.test.ts`
- **行号**: 25, 28, 36–37, 85
- **问题**: 测试数据中使用 Fate 概念
  - `playerAction: "Saber 突进"` (25)
  - `userMessage("规则问题：令咒怎么用？")` (28)
  - `assert.match(summary, /Saber 突进→ 受阻/)` (36)
  - `assert.match(summary, /令咒/)` (37)
  - `playerAction: "Saber offers to carry"` (85)

### 11. `engine/audit/lint-rules.test.ts` — 令咒 / 从者 / rin（测试数据）

- **文件**: `engine/audit/lint-rules.test.ts`
- **行号**: 88, 142, 170
- **问题**: 测试数据中使用 Fate 概念
  - `"我不再是从者，而是你的剑。"` (88) — 从者 = Servant
  - `"她攥紧了袖中的令咒，掌心全是汗。"` (142) — 令咒 = Command Spell
  - `actorId: "rin"` (170) — Tōsaka Rin

---

## 🟢 绿色：专为 LOTM 设计 / Fate 主题预期行为，无需报告

### engine/gm-prompt/ 目录

- `injection.test.ts:22` — 测试验证 `system-settlement.md` 包含 `"Type-Moon (Fate) directed-narrative"`。这是测试断言预期内容，设计正确。

### 注：以下 agents/ prompt 文件不在目标目录但被引用，保持 Fate 主题是架构意图

- `system-settlement.md` — 结算器身份为 "Type-Moon (Fate) directed-narrative two-pass engine"——这是立项时的 IP 锚点
- `system-render.md` — 渲染器身份同样声明 Type-Moon (Fate)
- `gm-context.md` — 世界边界描述 Fate/Type-Moon 语境
- `gm-rules.md` — Type-Moon 硬规则、Servant、Noble Phantasm 等 Fate 特有机制
- `gm-style-rules.md` — Fate flavor / Type-Moon prose spine
- `gm-social-guide.md` — Type-Moon dialogue 指导

这些 prompt 文件如果要从 Fate 移植到 LOTM，是**架构级重写**，不在本次检测报告的问题范围内。

---

## 汇总

| 严重程度 | 文件                                                                                   | 问题类型                                                 |
| -------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 🔴       | `engine/direction/render-turn.ts:15`                                                   | `PROSE_CUSTOM_TYPE = "fsn-prose"` — Fate/stay night 命名 |
| 🔴       | `engine/audit/session-audit.ts:31,111,115,119,164,170,535,541`                         | `fsn-prose` / `fsn-state` 8处引用                        |
| 🔴       | `engine/audit/session-audit.test.ts:42,52,120,267,485`                                 | `fsn-prose` / `fsn-state` 测试数据                       |
| 🔴       | `engine/direction/settlement-compaction.test.ts:106`                                   | `fsn-prose` customType 测试数据                          |
| 🔴       | `engine/direction/packet-schema.test.ts:76,80,150,156,161,188,195,199,207,212,224,227` | "两仪式"/"直死之魔眼" 秘密测试数据                       |
| 🔴       | `engine/direction/render-turn.test.ts:277,289,290`                                     | "两仪式" 秘密测试数据                                    |
| 🔴       | `engine/audit/lint-rules.test.ts:177,181,185,189`                                      | "两仪式" 秘密测试数据                                    |
| 🟡       | `engine/direction/packet-schema.test.ts:9,10,13,21,23`                                 | Saber/Rider 从者类名测试数据                             |
| 🟡       | `engine/direction/render-turn.test.ts:18,119,157-159,169,209`                          | Saber/凛 测试数据                                        |
| 🟡       | `engine/direction/settlement-compaction.test.ts:25,28,36-37,85`                        | 令咒/Saber 测试数据                                      |
| 🟡       | `engine/audit/lint-rules.test.ts:88,142,170`                                           | 从者/令咒/rin 测试数据                                   |
