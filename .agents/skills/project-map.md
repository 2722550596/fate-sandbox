# project-map — 目录结构与模块依赖速查

## 何时使用
- 不确定某模块在哪
- 改了 A 是否需要同步改 B
- 新加入项目需要了解整体架构
- 寻找数据文件加载方式
- 需要知道哪些目录是死代码/废弃

## 核心目录职责

### engine/ — 确定性运行时引擎

```
engine/
├── core/          纯 domain 层（类型、函数、schema、store）
│   ├── state/     State 类型定义、schema、store、投影、持久化 ← 最核心，被全部依赖
│   ├── actor/     Actor 实体、条件、印象、议程、acting、关系信号
│   ├── scene/     场景生命周期、beat 跟踪
│   ├── economy/   经济系统（交易、货币、面额）
│   ├── knowledge/ 秘密配置、记忆、揭示推理
│   ├── promotion/ 晋升裁决（LOTM 序列晋升）
│   ├── combat/    战斗裁决（LOTM 非凡战斗交换）+ 等级比较
│   ├── backstage/ 幕后事件、派系时钟、义务、并行线调度
│   ├── ledger/    钩子（hooks）、裁决义务（obligations）
│   ├── inventory/ 跟踪物品
│   ├── turn/      turn 结算编排、turn-time、turn-log
│   ├── init/      初始化（initialize-new-game）
│   └── utils/     通用工具（ids, rng, typebox-validation, env-loader）
│
├── tools/         GM 可见的 LLM 工具层
│   ├── actor/ → core/actor/ 的工具包装
│   ├── scene/ → core/scene/ + core/turn/ 的工具包装
│   ├── backstage/ → core/backstage/ 的工具包装
│   ├── knowledge/ → core/knowledge/ 的工具包装
│   ├── economy/ → core/economy/ 的工具包装
│   ├── lotm/ → core/promotion/ + core/combat/ 的工具包装
│   ├── relationship/ → core/actor/ 关系信号的工具包装
│   ├── inventory/ → core/inventory/ 的工具包装
│   ├── lookup/    只读查询（直接读文件或 RAG 搜索）
│   ├── debug/     调试工具（patch-state, reset-state 等）
│   ├── system/    系统工具（init, get-status, update-hook）+ domain-tool-runner
│   ├── runtime/   辅助（tool-definition 类型, tool-render, tool-result）
│   └── registry.ts 全部 40 个工具的汇总注册
│
├── direction/     双 pass 接缝（settlement → render）
│   ├── packet-schema.ts 方向包 schema（binding/free 分层）
│   ├── packet-validation.ts 包验证
│   ├── packet-firewall.ts 安全防火墙（防 secrets 泄露）
│   ├── render-turn.ts 渲染核心
│   ├── settlement-compaction.ts 结算侧 compaction
│   ├── settlement-prose-firewall.ts 防结算散文泄露
│   ├── prose-digest-store.ts 散文摘要持久化
│   └── strip-thinking.ts 去除 LLM 思考残留
│
├── gm-prompt/     提示词组装层
│   ├── injection.ts 运行时 prompt 注入
│   ├── preset.ts    prompt preset 管理
│   └── render.ts    渲染侧 prompt 构建
│
└── audit/         审核层
    ├── session-audit.ts JSONL 会话审核
    └── lint-rules.ts 散文 lint 规则
```

### agents/ — GM prompt 文件（纯文本，被 engine/gm-prompt/ 读取）
- `gm-system.md` — 身份与最高契约
- `gm-context.md` — 世界边界
- `gm-rules.md` — 硬规则
- `gm-tool-policy.md` — 工具路由
- `gm-story-driver.md` — 剧情推进纪律
- `gm-render.md` — 渲染风格
- `gm-input-guide.md` — 输入解释
- `gm-output-contract.md` — 输出格式

### extensions/ — pi-coding-agent extension 层
| 扩展 | 职责 |
|---|---|
| `subagents/` | 子代理运行时（novel-analyst, timeline-showrunner 工具注册） |
| `compaction/` | 接管 pi-agent compaction（确定性截断） |
| `render/` | 渲染通道（Pass B）完整实现 |
| `player-panel/` | TUI 面板（status, inventory, relations, recap, journal, hooks） |
| `player-choices/` | /choice 命令 |
| `rewind/` | 快速回退（/fuck 命令） |
| `debug-prompt-capture/` | 调试模式提示词捕获 |

### data/ — 静态世界数据
| 目录 | 加载方式 | 内容 |
|---|---|---|
| `campaign-presets.ts` | `import`（TS 常量） | 战役预设、开局配置 |
| `timeline-pressure-palettes.ts` | `import`（TS 常量） | 时间线压力调色板 |
| `config/*.json` | 运行时 `readFileSync`（部分） / 未被引用（其余） | `神之途径.json`（sequence-lookup）、`economy-prices.json`（economy-lookup）被 lookup 加载；其余 17 个文件未被 engine 代码引用 |
| `abilities/pathway_abilities.json` | 运行时 `readFileSync` | 354 个能力条目 |
| `world/` `characters/` `locations/` 等 MD 目录 | 运行时自动扫描（`world-data.ts`） | 角色、地点、组织描述 |
| `mechanics/` | 同上 | LOTM 设定知识 |
| `novel/` | 按需读取（`novel-lookup.ts`） | 原著章节（按卷分目录） |
| `pathways/` | 按需读取（`sequence-lookup.ts`） | 各途径序列描述 |
| `wikis/lotm/` `wikis/loom/` | **空，待填充** | 日后可把 `data/` 下的内容（mechanics/、characters/、locations/ 等）挑重点放进去的 wiki 目录 |

## 数据流概览

```
玩家输入 → Pass A (settler) → 调用 domain tools → 写入 state → 提交 direction packet
                                        ↓
                              Pass B (renderer) → 读 packet → 检查散文史 → LLM 生成散文
                                        ↓
                                   lint / 脱敏 → 保存散文史 → 输出给玩家
```

## 改模块波及范围

| 改这里 | 需要同步改 |
|---|---|
| **state-schema.ts** | state.ts, state-enum-schemas.ts, initial-state.ts, 投影文件, 所有引用的 core/*, 引用的 tools/*, direction/packet-schema.ts（如果涉及渲染） |
| **state-store.ts** | extensions/player-panel, extensions/render, tools/lookup 直接调用 |
| **public-projection.ts** | gm-prompt/injection.ts, extensions/player-panel |
| **core/actor/** | tools/actor/*, gm-prompt/injection.ts, direction/packet-schema.ts, core/knowledge/, core/backstage/ |
| **direction/packet-schema.ts** | direction/render-turn.ts, extensions/render/index.ts, gm-prompt/packet-contract.ts, tools/scene/submit-direction-packet.ts, agents/gm-*.md |
| **tools/ 中某工具** | engine/tools/registry.ts（新增/删除）, 对应的 core/ 模块（契约变更）, agents/gm-*.md（参数描述变更） |
| **agents/*.md** | engine/gm-prompt/injection.ts（读取顺序） |
| **extensions/ 中某个** | 一般不影响其他文件 |

## 废弃/不参与运行的目录

- `original/` — 老旧备份代码（已标注「不要再看了」）
##### *`data/config/*.json` — 部分已不参与运行*
- **active** (被 engine/tools/lookup/ 运行时加载): `神之途径.json` (sequence-lookup), `economy-prices.json` (economy-lookup)
- **dead** (未被 engine 代码引用): 其余 17 个文件

- `agents/gm-rules - 副本.md` — 编辑副本，不应存在

### Backstage 后台系统状态

从 fate 搬迁后未做 LOTM 化，部分功能暂不启用。

**已启用（代码被 registered tool 调用）：**
- `backstage-obligation.ts` — 后台推进义务记账/清账，commit_turn 硬阻断依赖它
- `backstage-pending.ts` — pending-harvest 标记 + GM 催办提示
- `backstage-brief.ts` — GM prompt 注入后台简报
- `faction-clock.ts` — 进度钟通知（`collectBackstageDueNotices` 在 turn-commit 中用作 warnings）
- `record-offscreen-event.ts` — **已注册工具** `record_offscreen_event`
- `clear-backstage-lock.ts` — **已注册 debug 工具** `clear_backstage_lock`

**未启用（代码存在但工具未注册 / 无 registered tool 调用）：**

后台导演流水线（parallel-line）：`run-parallel-line`, `harvest-backstage-candidate`, `resolve-backstage-line`, `backstage-director-prompt`, `backstage-director-persona`, `backstage-spawn`, `backstage-session-read`, `parallel-line-assembler`, `parallel-line-output-schema`, `backstage-substrate-config`

对应工具 `run_parallel_line`, `harvest_backstage_candidate`, `resolve_backstage_line`, `manage_faction_clock` 均未在 registry.ts 注册。

**timeline-showrunner** 子代理（`.pi/agents/timeline-showrunner.md`）仍活跃，timeline pressure palettes 也未 LOTM 化。

## 验证命令

```bash
# 快速定位模块
find engine/tools -name "*.ts" | grep -v ".test.ts"
# 检查模块间依赖
grep -r "from.*core/state" engine/tools/
# 检查引用链
search "buildGmBrief" engine/
```

## 禁止事项

- ❌ 不要在 `original/` 目录中找参考代码 — 那是废弃备份，与当前架构不一致
- ❌ 不要假设 `config/*.json` 被 engine 使用 — 当前未被引用
- ❌ 不要在 `agents/gm-rules - 副本.md` 中读规则 — 那是编辑副本
- ❌ 不要直接修改 `data/` 下的 MD 文件结构而不更新 `world-data.ts` 的 `DIR_KIND_MAP`
- ❌ 不要把 `.pi/agents/` 的 agent 定义与 `agents/` 的 prompt 文件混为一谈