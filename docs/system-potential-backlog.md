# 系统潜力挖掘 backlog

来源：2026-06-11 对上下文管理 / 提示词注入 / 工具设计 / 引擎全面盘点的结论。
原则轴：把还停留在 prompt 里的纪律下沉为结构；把 GM 手工装配的活变成 engine 自动供给。
每项做完勾掉，动手前先重读对应小节，按当时代码现状校正方案。

优先级总览（2026-06-14 更新：#12 已验收；#1/#5/#15/#16/#17 已落地）：

1. 已完成地基：#8 JSONL 审计脚本、#12 双 pass、#1 输出契约机械执法、#15 NPC agenda/knowledge lens、#16 关系信号账本、#17 pressure palette、#18 Windows 启动 parity、#5 parallel-line 调用工具化、#6 上下文经济、#9 Seeded RNG、#10 玩家侧小件（/relations /hooks /journal /recap）
2. 建议下一批：#14 heavy 轮并行渲染选优、#7 canon 研究缓存

---

## 1. 输出契约机械执法（output-lint 扩展）

- [x] 状态：已完成（2026-06-14）。规则集本体已落在 `engine/audit/lint-rules.ts`，JSONL 审计与双 pass 渲染复用同一机械 lint；`submit_direction_packet` 先过 packet secret 防火墙，`two-pass-render` 对最终 `fsn-prose` 正文执行 style/output lint + 未揭示秘密扫描，失败重试一次，秘密泄漏仍存在则遮蔽并告警。单独 output-lint extension 被 #12 吸收，不再另接一条 turn_end 扩展。

原问题：`gm-output-contract.md` + `gm-style-blacklist.md` 大半禁令可正则检测，但早期全靠模型自查（违反「Prompt 不是防线」）。

可机械检测项：

- 开头禁语：「好的」「以下是」「那么」「状态已经」「现在为你写」
- 伪菜单结尾：「你可以 A，也可以 B」「是…还是…」「左边是 A，右边是 B」
- Markdown 分隔线/标题、JSON 花括号、schema 路径
- 黑名单句式：「并非…而是」「与其说」「空气中弥漫着」「显得格外」「难以言喻」、连续双比喻「像 A，像 B」、水系比喻簇
- **未揭示秘密泄漏（最高价值）**：扫描最终正文是否包含 `secrets` 中 `revealState !== "revealed"` 的真名 / 宝具名字符串

落地形态：

- 新 extension（如 `extensions/output-lint/`），turn 结束时对最终 assistant 正文跑规则
- 轻则 `ctx.ui.notify` 警告 + 写审计日志；重则注入修正指令重写
- 真名泄漏做硬阻断
- 规则集本体写成纯函数 + 测试；规则集与 #8 审计脚本复用同一模块

进阶：「同一意象簇 3 轮内不得重复」机械化——对最近 3 轮正文做意象关键词计数，超限时在下一轮 pre-response 动态注入「本轮禁用意象：X、Y」，把 style blacklist 从静态文本变成带违规上下文的动态注入。

## 2. Mystery hook 状态化（明确违宪存量）

- [x] 状态：已完成（2026-06-11，schema v6）。`public.hooks: HookState[]`（id/label/status/lastSurfacedAt/surfaceCount/lastNovelty）；`engine/core/hooks.ts` 提供 open/surface/park/escalate/pay/retire，`update_hook` 单工具六动作已注册。硬 invariant：active+escalated 同时最多 2 条（超额 open/parked 复活被拒）；surface/escalate 必须带非空 novelty，pay 必须带 payoff，retire 必须带理由；paid/retired 终态拒绝再转换但留在账本供审计。GM brief 加「悬念账本」行；gm-story-driver hook budget 段改为指向工具账本。迁移 v5→v6。后续：audit 脚本可对「账本外悬念复现」做对账；timeline-showrunner 输入接 hooks 账本

`gm-story-driver.md` 的 hook budget（active/parked/paid/escalated/retired、同场景最多 1-2 active、parked 1-2 轮内不抢焦点、复现必须带新状态）全部只活在 prompt 里。state 有 `storyWindow` 但 hook 不是领域对象。后果：compaction 后 hook 状态只能靠 5 条 narrative texture 苟活；timeline-showrunner 审计拿不到账本；「复现带新信息」无法验证。

方案：

```ts
interface HookState {
  id: HookId;
  label: string;
  status: "active" | "parked" | "paid" | "escalated" | "retired";
  lastSurfacedAt: string; // ISO
  surfaceCount: number;
  lastNovelty: string; // 上次复现带来的新状态，复现时必填
}
// 落点：public.hooks: HookState[]
```

- lifecycle 进 `commit_turn` / `progress_scene_beat` 事件集（或窄工具 `update_hook`）
- GM Brief 加一行 hook 账本
- 工具层 invariant：同 scene active hook > 2 拒绝新增；复现必须提供 `lastNovelty`
- timeline-showrunner 输入直接从 state 拿账本，审计从读对话变成对账
- 需要 schemaVersion bump + migration + 测试

## 3. 阵营时钟与到期义务（faction clock / scheduled obligation）

- [x] 状态：已完成（2026-06-11，schema v5）。`secrets.factionClocks`（id/factionId/label/filled/size 2-12/visibility hidden|leaked，不变量 filled≤size）+ `secrets.scheduledEvents`（dueAt/summary）；`engine/core/faction-clock.ts` 提供 upsert/advance（封顶+becameFull）/reset（outcomeSummary 强制留痕 secretEventLog）/retire/schedule（拒绝过去时刻）/resolve-due/extend-due；`manage_faction_clock` 单工具七动作已注册。催账：`collectBackstageDueNotices` 在 commit_turn warnings 与 progress_scene_beat 返回值里列出到期事件/填满时钟（提醒不硬拒，区别于 #4：叙事义务不可机械验证落地），出口只有 resolve-due 兑现或 extend-due 显式展期。迁移 v4→v5 补空账本。后续：#5 parallel-line 工具化时输出契约加结构化 clockAdvance；timeline-showrunner 审计可读时钟数字

「世界不为玩家暂停」「每 2-3 次后台推进要有一次格局变化」「倒计时」目前全靠 GM 与 parallel-line 自觉。引入 BITD 进度钟思路：

```ts
interface FactionClock {
  id: string;
  factionId: string;
  label: string;
  filled: number;
  size: number;
  visibility: "hidden" | "leaked";
}
interface ScheduledEvent {
  id: string;
  dueAt: string; // ISO
  summary: string;
  onDue: "surface-to-gm";
}
// 落点：secret state
```

- parallel-line 输出契约升级：`secretStateChanges` 允许结构化 `clockAdvance`
- `commit_turn` / `progress_scene_beat` 推进时间越过 `dueAt` 时，**工具返回值直接列出到期义务**：「以下幕后倒计时已到期，本轮必须处理或显式展期」——engine 催账，GM 不需要记得
- 时钟填满 = 强制格局变化事件
- timeline-showrunner 审计「连续无代价」时有数字可查
- 这是 `docs/parallel-line-subagents-plan.md` 的最后一公里：现在 subagent 产出候选，但没有任何东西保证候选的后续会发生；时钟就是那个保证

## 4. resolve_combat_exchange 裁决-落地缝隙（turn obligations ledger）

- [x] 状态：已完成（2026-06-11，schema v4）。`engine/core/obligations.ts`：`public.obligations` 账本（id/source/kind/summary/createdAt，kind 复用 CombatStateLandingKind 六类）；resolve_combat_exchange 改走 domain runner，required landing 自动登账并在返回文本提醒；各领域 applier（actor-condition/servant-form/memory/scene objective+threat/reveal-secret）成功执行时 FIFO 清账一条；`commit_turn` 与 `progress_scene_beat` 收尾对账，账未清则拒绝提交并逐条列出落地路径（同一次 commit 的 events 可以自清）；GM brief 露出未清义务行。迁移 v3→v4 补空账本，含迁移测试。后续：#3 阵营时钟的到期义务复用同一账本

该工具裁决但不改 state，伤势/魔力落地靠 GM 自觉跟进，存在「裁决了但没落地」的无人看守缝隙。

方案：

- engine 记 `pendingExchangeSettlement`：exchange 裁决产生的 mandatory landings 清单
- 下一次 `commit_turn` 若清单未清空则拒绝或在返回值强提醒
- 泛化为 **turn obligations ledger**：任何工具可登记「本轮欠的账」，`commit_turn` 是统一对账点（#3 的到期义务也走同一账本）

## 5. parallel-line 调用工具化（engine 装配输入 + schema 验收输出）

- [x] 状态：已完成（2026-06-14）

落地清单：

- `run_parallel_line` 领域工具（`tools/state/run-parallel-line.ts`）：GM 只传 `lineId + timeWindow + 可选偏好`，engine 从 secret state、actor agenda、offscreenEventLog、pressure palette 自动装配完整 `ParallelLineInput`，返回可直接传给 `parallel-line` 子代理的 JSON。
- engine-side assembler（`engine/core/parallel-line-assembler.ts`）：自动提取 knownFacts（public memory eventLog + pinnedFacts）、privateFacts（campaignSecrets 未 reveal）、actorGoals（actorAgendas）、forbiddenEscalations（storyWindow 自动合并）、recentOffscreenEvents（最近 6 条 + pressureType 分类）、pressure palette（带 recentUses + coolingDown）。
- `ParallelLineOutput` TypeBox 验证器（`engine/core/parallel-line-output-schema.ts`）：子代理返回裸 JSON 字符串由 TypeBox 严格验证，解析失败抛 Error 让调用方重试——从 prompt 恳求变成代码验收。
- `ParallelLineInput` / `ParallelLineOutput` 扩展：新增 `recentOffscreenEvents`、`excludedActorIds`、`excludedPressureTypes`、`preferredPressureType`、`majorBeatEnd`、`arcTransition`；输出新增 `timelineId`、`toneDriftRisk`、`genreFitNotes`。
- `gm-tool-policy.md` parallel-line 小节改为 `run_parallel_line` 工具装配流程。
- 前置依赖 #15（actor agenda）、#16（relationship signal）、#17（pressure palette）已在先前完成。
- async 预取暂缓：需要 pi-subagents result-intercom 桥，待后续 #14 一并处理。

## 6. 上下文经济：presence 驱动 NPC 卡片 + 记忆检索

- [x] 状态：已完成（2026-06-14）

落地清单：

a) **NPC 印象卡**（`ActorImpression`）——公开层 per-actor voice/posture/texture 快照：

- 类型 `ActorImpression`（presence / actionStyle / relationshipPosture / voiceMaterial / updatedAt）加入 `PublicGameState.actorImpressions`。
- 领域逻辑 `engine/core/actor-impression.ts`：`upsertActorImpression` upsert；`presentActorImpressions` 按 scene.presentActorIds 过滤；`formatPresenceImpressionCards` 格式化注入文本。
- `update_actor_impression` 领域工具（`tools/state/update-actor-impression.ts`）。
- 新 runtime prompt source `presence-impressions`，注册在 `preset-settlement.json` pre-response slot priority 15。在场 NPC 印象卡自动注入 pre-response。
- schema v8→9 迁移，新增 `actorImpressions: []`。

b) **Campaign memory 检索**：

- `engine/core/memory-recall.ts`：`recallMemory(state, query)` 纯函数，支持 keywords（OR）、actorId、location、scope 过滤，不上向量。
- `recall_memory` 领域工具（`tools/state/recall-memory.ts`）：只读，不改状态。
- tool-policy 更新：需要回忆旧事实时调用 recall_memory，不凭模型记忆编造。

进阶（未做）：brief 按当前 location/在场 actor 自动关联注入 2-3 条相关旧记忆。等待实际 session 审计反馈后再决定是否值得。

## 7. Canon 研究缓存（casting 子代理）

- [ ] 状态：未开始

tool-policy 的 canon query（lookup → web_search → fetch_content）每次都在主上下文消化 wiki 正文，且跨 session 不复用。

- 研究结果落盘为结构化角色卡缓存（如 `data/canon-cache/`）：外貌、口吻、参数、关系、版本边界，带来源 URL
- 进阶：**casting 子代理**——输入「角色名 + timeline + 本局需要字段」，在自己的上下文里做 web 研究，返回窄结构卡片；主 GM 上下文只进卡片不进 wiki 正文
- `lookup` 优先命中缓存，未命中才触发研究
- 注意发布纪律：缓存目录属本地产物还是发布内容需要决定（含网络抓取文本，倾向不进 release zip）

## 8. JSONL 审计脚本（叙事纪律可回归测试）

- [x] 状态：已完成（2026-06-11）。`scripts/audit-session.ts` CLI（`pnpm audit:session [file...]`，缺省取最新 session）；指标实现在 `engine/audit/session-audit.ts`（纯函数 + 测试），lint 规则集在 `engine/audit/lint-rules.ts`（#1 复用同一模块）。覆盖：时间推进覆盖率（call 级 + turn 级 + 缺时轮号）、工具调用分布与错误率、get_status 冗余率、无代价连续段分布（代价信号启发式：combat/condition/retire/spend/add-threat）、输出契约+style blacklist 机械子集、未揭示秘密泄漏（block 级，按轮内最新 fsn-state 快照）、parallel-line 触发命中率（≥30min/beat complete/连续 2 轮无代价）。active path 沿 parentId 自 leaf 回溯，废弃分支不计。首跑即发现真实泄密：2026-06-08 session turn 52/53 真名剧情内说出但未走 reveal_secret。

AGENTS.md 说「先写 JSONL 统计复现」，但没有现成统计工具。建 `scripts/audit-session.ts`，对 session JSONL 输出：

- 时间推进覆盖率（accepted canonical turn 中带 time 的比例——已点名的逃生门指标）
- 工具调用分布、`get_status` 滥用率
- 连续无代价轮数分布（压力纪律量化）
- 输出契约违规命中（复用 #1 的 lint 规则模块）
- parallel-line 调用频率 vs 触发条件命中率

价值：把「感觉最近 GM 变软了」变成数字；每次 prompt/工具改动有 before/after 基线。所有项里对长期迭代复利最大。

## 9. 确定性随机源（seeded RNG）

- [x] 状态：已完成（2026-06-14）

落地清单：

- `engine/core/seeded-rng.ts`：xoshiro128\*\* 算法，`seededRandomInt(state, bound)` 和 `seededRandomFloat(state)`。seed 存在 `state.meta.rngSeed`，每次消耗推进 `state.meta.rngCounter`。counter fast-forward 保证 rewind 后重放行为一致。
- `resolve_combat_exchange` 内部战场变数 roll 已改用 seeded RNG（原 `randomInt(100)` from `node:crypto` → `seededRandomInt(draft, 100)`）。
- schema v9→10 迁移（rngSeed + rngCounter）。
- 9 新测试（确定性、序列范围、边界、fast-forward、差异性）。

## 10. 玩家侧小件

- [x] `/relations`：展示玩家可见关系概览（同行者、在场 NPC、印象卡、最近关系信号）。已完成（2026-06-14）。
- [x] `/hooks`：展示 player-safe 悬念账本；active/parked/paid/escalated/retired 分组显示，带表情标签。已完成（2026-06-14）。
- [x] `/journal`：turnLog + eventLog + dailySummaries 渲染时间线。已完成（2026-06-14）。
- [x] `/recap`：从 Campaign Memory（player-safe）生成前情提要（战役、主角、关键事实、最近事件、悬念、当前场景）。已完成（2026-06-14）。
- [x] 分支书签：pi 原生 `ctx.fork` + `ctx.navigateTree` + `pi.setLabel` 已覆盖，不需要额外实现。
- [x] 成书导出：`pnpm export:book` / `pnpm export:book:html`。已完成（2026-06-14）。

落地清单（2026-06-14）：

- 投影函数在 `engine/core/player-widgets.ts`（纯 PublicGameState → Markdown，不泄露 secrets）。
- 四个 `/` 命令注册在 `extensions/player-panel/index.ts`（复用已有 `showPanel` TUI 框架）。
- 7 新测试覆盖四个投影函数。

## 11. preset 注入顺序微优化（KV cache）

- [x] 状态：已完成（2026-06-12），且超出原范围：tool-policy/hard-rules/story-driver 整体移到 pre-history（可缓存前缀），pre-response 只剩动态 mechanical_state + 短提醒 gm-turn-reminder.md，direction-contract 保留在 final-contract（recency 关键）。待实测静态规则前置后的指令遵从是否退化。

## 12. 结算/渲染双 pass 分离（工具调用与叙事完全隔离）

- [x] 状态：已交互式实测验收（2026-06-14 用户确认）。已接线：`submit_direction_packet` 工具（验证 + 防火墙 + terminate，拦截时报错回喷让结算器重写）；`extensions/two-pass-render/`（agent_end 检出未渲染 packet → 洁净室 complete() 渲染 → lint 不过重试一次 → 泄密仍存则遮蔽 → fsn-prose custom message 落 session + Markdown renderer；渲染不可用时兑底输出结算摘要）；preset 模块加 `pass: settlement|render|both` 字段按 pass 分组（吸收 #11：mechanical-state 调到静态块之后）；结算投影在 extension.ts context 事件过滤 fsn-prose；`gm-system.md` 改写为结算器身份，新增 `gm-direction.md`（packet 填写契约）与 `gm-render-system.md`（渲染器核心）；start.sh 加载新扩展。已知跟进项：#8 审计脚本对新 session 需要改从 fsn-prose custom message 取正文（现只读 assistant text）；渲染侧长期可继续演进 arc-summary 层与 heavy 轮选优。
- [x] pi 架构可行性已验证（2026-06-11，对照 pi 0.79.1 extensions.md 全文 + 官方 examples）
- [x] Spike 已完成（2026-06-11，`docs/spike-two-pass/`）：取 2026-06-08 session 的 turn 52/55/57（对白揭示/战斗裁决/宝具高潮三类），手工构造 packet 喂洁净室渲染器。结论 GO：resolvedChanges 全部落地、refusesToSay 防线成立、endWindow 全命中、声音一致性不丢，渲染质量持平或优于单 pass 基线（heavy 轮基线有 2 处 blacklist 违规，渲染版更干净）。已确认的真风险：生产中 packet 由结算器生成，其信息密度未验证；渲染器会自行补充 packet 外的 canon，两道 lint 关卡不可省。

动机：现在单个 GM 上下文同时承载 23 个工具 schema、机械规则、style 黑名单和散文史，两种任务抢同一份注意力预算；散文史里混着工具调用噪音；secret 隔离依赖 prompt 自觉。

架构：

```txt
玩家输入
  ↓
Pass A 结算器（pi agent 主循环，保留全部领域工具）
  prompt：rules + tool-policy + story-driver + brief，零 style/render 模块
  history：玩家输入 + 历届 direction packet（无散文）—— state 本身是它的记忆
  输出：direction packet（结构化转译单），不写正文
  ↓ packet 过 secret 防火墙 / lint（代码层，进渲染器前拦截）
Pass B 渲染器（complete() 单发洁净室，同 compaction 摘要器模式）
  prompt：creative-constitution + style + render + output-contract，零工具 schema
  history：玩家输入 + 历届散文正文（无工具调用）→ 接近纯小说流
  输出：玩家可见正文，作为 assistant 消息落 session
```

Direction packet 草图：

```ts
interface DirectionPacket {
  playerAction: string; // 结算后的玩家行动认定
  resolvedChanges: string[]; // binding：已结算机械事实（时间/伤/钱/位置/揭示）
  npcStances: Array<{ actorId: string; stance: string; wants: string; refusesToSay: string }>; // player-safe
  sensoryAnchors: string[]; // free：建议落点（身体/距离/物件/称呼/停顿）
  endWindow: string; // 结尾行动窗口/风险锚
  eventWeight: "light" | "normal" | "heavy"; // 决定篇幅
  canonFacts: string[]; // 渲染所需 canon 预填，避免渲染器想查 lookup
  needsRender: boolean; // meta/OOC 轮跳过渲染
}
```

收益：

- secret 防火墙物理化：渲染器看不到 secret state / private_resolve / 工具内幕，packet 是唯一通道且可代码验证（真名扫描、claim 检查），泄漏在进渲染器前拦截——强于 #1 的事后 lint
- 渲染器 history 为干净散文流：声音一致性、style 遵从、KV cache 全部受益
- lint-重写变便宜：正文违规只重跑 Pass B，机械结算不动
- compaction 简化：渲染侧纯散文天然适配现有 policy；结算侧几乎无需 compaction
- 两 pass 可分开选型：结算器用便宜快模型，散文预算全留渲染器

风险与对策：

- 接缝信息损失（最大风险）：packet 太瘦 → 散文 generic。对策：binding（resolvedChanges 必须落）与 free（sensoryAnchors/npcStances 自由发挥质感）分层；质感连续性由渲染器的散文史承担，不压在 packet 上
- 渲染器中途缺 canon：packet 预填 canonFacts，或给渲染器唯一只读 lookup
- 双 pass 延迟/成本：结算器上下文大幅缩水对冲；等待期流式显示结算状态行
- 持久化与回退：packet 进 tool details / 隐藏 entry，正文为 assistant 消息；/fuck 剪枝两者一起删；两个 history 投影在 context 事件里按 phase 过滤同一棵 session tree
- OOC/meta 轮：needsRender=false 直接回复

pi 架构可行性验证结论（pi 0.79.1）：

| 设计需求                            | pi 原语                                                               | 先例                          |
| ----------------------------------- | --------------------------------------------------------------------- | ----------------------------- |
| 结算器 per-call history 投影        | `context` 事件返回过滤 messages                                       | 本项目 injection.ts 已在用    |
| 每轮替换 system prompt              | `before_agent_start` 返回 `systemPrompt`                              | examples/pirate.ts            |
| 扩展内第二 LLM pass                 | `complete()`/`stream()` + `modelRegistry.getApiKeyAndHeaders`         | 本项目 compaction 扩展同模式  |
| 结算器不出正文收尾                  | 工具返回 `terminate: true` 直接停在工具调用                           | examples/structured-output.ts |
| prose 落 session + markdown 显示    | `sendMessage({customType, display:true})` + `registerMessageRenderer` | examples/message-renderer.ts  |
| packet 持久化但不进 LLM 上下文      | `appendEntry()`（文档明示 not in LLM context）                        | extensions.md                 |
| 渲染 pass 去工具 schema             | `setActiveTools([])` / 手工装配 history                               | examples/plan-mode            |
| 替换最终 assistant 消息（备选接线） | `message_end` 返回替换消息（同 role）                                 | extensions.md                 |
| pass 期间等待 UX                    | `setWorkingMessage`/`setStatus`/`setWidget`                           | 多个 examples                 |
| /fuck 兼容                          | custom message 是普通 entry，prune 一起删                             | 现有 rewind                   |

接线方案：

- 方案 A（推荐）：结算器当主 agent loop（保留原生工具 UI/steering/Esc/tool_call 钩子）；最后必须调 `submit_direction_packet` 工具（TypeBox 验收 + `terminate:true`，避免 JSON assistant 正文且省一次收尾 LLM 调用）；`agent_end` 里 packet 过防火墙 → `complete()` 渲染（history 在扩展内用 `serializeConversation`/`convertToLlm` 手工装配：玩家输入 + 历届 prose custom message）→ `sendMessage` 落 prose；`context` 事件把 prose 从结算器视野过滤。
- 方案 B：渲染器当主 loop（prose 保留原生 token 流式），`before_agent_start` 里用 `complete()` 手工 roll 结算循环（领域工具是自家纯函数，可直接执行）；代价是结算器失去原生工具行渲染与中断语义。

唯一真实 gap：方案 A 的 prose 是 `complete()` 一次性返回，pi 没有增量更新 custom message 的 API。缓解：pi-ai 的 `stream()` 流进 `setWidget` 伪流式、结束后落正式消息；或接受一次性出正文（渲染器上下文小，延迟低）。UX 取舍，非能力缺口。

实施路线：

1. Spike：手动取 2-3 个历史轮，离线构造 packet 喂渲染器 prompt，对比单 pass 散文质量——先验证接缝不丢质感再动架构
2. packet schema + TypeBox 验证 + secret 扫描（复用 #1 规则模块）；`submit_direction_packet` 工具 + `terminate:true`
3. 渲染扩展：`agent_end` 拦截 → `complete()` 渲染 → `sendMessage` 落 prose + `registerMessageRenderer` markdown 显示
4. `context` 事件双投影：结算器去 prose custom message；渲染器 history 在扩展内手工装配
5. preset.json 模块按 pass 重新分组（吸收 #11）
6. 跑通后把 #1 的 lint 移到 packet + 渲染输出两道关卡
7. 可选：`stream()` + `setWidget` 伪流式显示渲染中的 prose

## 13. 散文史 writer 化（渲染侧 compaction）

- [x] 状态：已落地（2026-06-12）。动手时发现 8 轮硬截断早已被双层滑窗（全文层滑回 + packet 机械摘要层）取代，所以实际增量是摘要质量：`prose-digest-store.ts`（state/prose-digests.json，按 toolCallId 索引→rewind/分叉安全，single-writer，500 条 LRU）+ 渲染扩展内的异步 digest writer（正文落地后 fire-and-forget，产出事件+关系变化单行摘要）。查不到时自动回退机械 packet 摘要，永不阻塞渲染。待跟进：>32 轮摘要层滑出后仍会丢失，长期可加 arc-summary 层

渲染器的散文史现为「最近 8 轮硬截断」，早期轮次的声音/关系连续性直接丢失。拆解 MiMo 的方案：

- 独立 writer（subagent 或纯函数 + 廉价模型调用）**增量**维护早期轮次的 digest（每轮一行：事件 + 关系变化），不在渲染时一次性总结。关键论据：提取要趁早（低利用率时模型压缩能力完好），不要拖到快满才压。
- 渲染器输入变为：digest（事件连续性，非文风样本）+ 最近 N 轮全文（文风连续性）+ 本轮 packet。gm-render-system.md 的输入契约已预留了 digest 位置（「Optionally, a digest of early turns」），只差生产它的机制。
- single-writer 不变量：digest 文件只许 writer 写，渲染器/结算器只读。

## 14. heavy 轮并行渲染选优（Max Mode 歪用）

- [ ] 状态：未开始（灵感：同上，Max Mode 并行采样 + judge 选优，SWE-Bench +10-20%）

仅在 `eventWeight: heavy` 轮（战斗高潮/重大揭示/关系转折）：渲染器并行采样 2-3 版正文（temperature 拉高），低温 judge 按 packet 落地完整度 + blacklist 违规数 + endWindow 命中选一版。token 代价只发生在最值得的回合；lint 本身就是现成的机械 judge 第一道筛（违规版直接淘汰，可能不需要模型 judge）。顺便覆盖现有「lint 不过重试一次」路径：重试变成从备选里挑。

## 15. NPC 自主性：actor agenda + knowledge lens

- [x] 状态：已完成（2026-06-14，schema v7）。`secrets.actorAgendas` 记录 actorId/goal/fear/currentOrder/lastIndependentActionAt，`secrets.actorKnowledgeLenses` 记录 knows/suspects/falseBeliefs/forbiddenKnowledge；新增 `engine/core/actor-agenda.ts` 纯函数与 `update_actor_agenda`、`record_actor_knowledge` 两个窄领域工具；state schema/migration/invariant/test 已补齐；`buildTimelineStateContextFromRaw` 给 timeline 子代理投影 agenda 与 knowledge lens；`gm-tool-policy.md` 与 `gm-direction.md` 已要求 NPC 动机/认知边界先落账，`timeline-showrunner` prompt 已把无 agenda/无自主行动列为 autonomy check。

当前 NPC 有 `relationshipToProtagonist`、roles、presence 与 offscreen events，但缺一个稳定的「此刻主动性」与「认知边界」载体。结果是长跑后 NPC 容易退化成 clue container、受害者、等待物，或者把 GM 视角事实说出口。

建议把两类结构放进 state，先服务 `parallel-line`、`timeline-showrunner` 和社交场景：

```ts
interface ActorAgendaState {
  actorId: string;
  goal: string;
  fear: string;
  currentOrder: string | null;
  lastIndependentActionAt: string | null;
}

interface ActorKnowledgeLens {
  actorId: string;
  knows: string[];
  suspects: string[];
  falseBeliefs: string[];
  forbiddenKnowledge: string[];
}
```

落地路线：

1. 先在 `engine/core/state.ts` 加 state 结构与 schema migration。
2. 增加窄工具：`update_actor_agenda` / `record_actor_knowledge`。
3. `buildTimelineStateContextFromRaw` 给子代理投影 agenda 和 player-safe knowledge 摘要。
4. `submit_direction_packet.npcStances` 可引用 agenda，但不得把 secret knowledge 写入 packet。
5. `timeline-showrunner` 增加 NPC autonomy 对账：连续多轮没有 independent action 的重要 NPC 必须被唤醒、降权或退出场景。

价值：让「NPC 想要什么、误解什么、拒说什么」从 prompt 自查变成可审计账本。

## 16. 关系信号账本（relationship signal ledger）

- [x] 状态：已完成（2026-06-14，schema v8）。新增 `public.relationshipSignals` 与 `secrets.relationshipSignals` 分层账本（id/actorId/targetActorId/signal/interpretation/boundary/sourceEventId/visibility），`engine/core/relationship-signal.ts` 负责记录、分层和未揭示秘密字符串防漏；`record_relationship_signal` 工具已注册。GM brief 露出最近 player-known 信号，timeline 子代理上下文注入 recent relationshipSignals，tool-policy/social/direction prompt 已要求关系转折先落行为证据。迁移 v7→v8 与 schema/invariant/tool 测试已补齐。

已有 `relationshipToProtagonist.stance/summary`，但它是当前摘要，不保留「关系为何变成这样」的行为证据。情感线需要记录微动作，而不是好感数值。

建议结构：

```ts
interface RelationshipSignal {
  id: string;
  actorId: string;
  targetActorId: string;
  signal: string;
  interpretation: string;
  boundary: string;
  sourceEventId: string | null;
  visibility: "player-known" | "secret";
}
```

落地路线：

1. 初期可用 `record_memory` 记录重大关系信号，要求 claims 类型为 `relationship`。
2. 后续新增 `record_relationship_signal` 工具；player-known 信号可进 public memory，secret 信号只给 private_resolve / subagent。
3. `/relations` 面板只展示信号与边界，不展示 NPC 内心判断。
4. 渲染器在 `eventWeight=heavy` 的关系转折轮优先落地称呼、距离、停顿、回避、主动照料等行为证据。

价值：关系连续性可回放；compaction 后不会只剩「关系变好了」这种空结论。

## 17. Timeline pressure palette 数据化

- [x] 状态：已完成基础落地（2026-06-14）。新增 `data/timeline-pressure-palettes.ts`，按 timeline 提供结构化 pressure slot（id/timelineId/label/pressureType/actorOrFactionHints/playerSafeProjectionKinds/cooldownTurns/forbiddenWhen）；`buildTimelineStateContextFromRaw` 注入当前 timeline 的 slot 与 recentUses/coolingDown；`parallel-line` 输入契约从字符串 palette 升级为结构化 slot hints，timeline 子代理注入文本与 prompt 改为读取 `pressurePalette.coolingDown`。后续可让 audit 脚本统计 pressureType 连续重复率。

`parallel-line` 与 `timeline-showrunner` 已在 prompt 里列 timeline hook palette，但 palette 不是数据，无法做 cooldown、权重、审计或 per-campaign 覆盖。结果是某些生态位容易重复：新闻、巡逻、监控、官方封锁、同一个强势阵营。

建议在 `data/` 建 timeline pressure palette：

```ts
interface TimelinePressureSlot {
  id: string;
  timelineId: TimelineId;
  label: string;
  pressureType: string;
  actorOrFactionHints: string[];
  playerSafeProjectionKinds: string[];
  cooldownTurns: number;
  forbiddenWhen: string[];
}
```

落地路线：

1. `data/timeline-pressure-palettes.ts` 定义 FSN / FSF / EXTRA / CCC 等基础生态位。
2. `buildTimelineStateContextFromRaw` 注入当前 timeline 的候选 slot 与最近使用记录。
3. `parallel-line` 输入从 `activePressurePalette: string[]` 升级成结构化 slot hints。
4. 审计脚本统计 pressureType 连续重复率与 no-novelty 复现。

价值：不同世界线的叙事生态更鲜明；后台压力不会总被同一类机构视角垄断。

## 18. Windows 启动脚本双 pass parity

- [x] 状态：已完成（2026-06-14）。`start.ps1` 现在与 `start.sh` 一样加载 `extensions/two-pass-render/index.ts`，并提示 `FATE_RENDER_MODEL` 覆盖状态。后续维护启动脚本时必须保持两边 extension 列表一致。

---

## 实施纪律提醒

- 改 state 结构的项（#2 #3 #4 #5 #6a #9 #16）都要：bump `schemaVersion` + 线性 migration + migration 测试 + protected paths 同步
- 新工具在 `tools/registry.ts` 注册，description 含「必须调用场景 + 严禁行为」
- 子代理改动保持 project-scope、explicit `tools`/`extensions`、bare JSON 约束
- 每项完成 = `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` 全过
