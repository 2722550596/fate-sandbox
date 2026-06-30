# 双 pass 分离 spike：接缝质量验证（backlog #12 步骤 1）

日期：2026-06-11。结论先行：**GO**——direction packet 接缝在 binding/free 分层下不丢质感，三个任务类型的渲染质量持平或优于单 pass 基线。

## 方法

从 2026-06-08 session（FSF 绫香线之前的 Extra 白野/两仪式局）取 3 个历史轮，覆盖三类任务：

| 轮      | 类型                  | 单 pass 实际工具调用                                                                                             |
| ------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| turn 52 | 关系/真名揭示对白     | commit_turn                                                                                                      |
| turn 55 | 战斗裁决（突进受阻）  | resolve_combat_exchange + commit_turn + update_servant_form                                                      |
| turn 57 | 宝具解放高潮（heavy） | reveal_secret×4 + resolve_combat_exchange + update_servant_form×2 + update_actor_condition + progress_scene_beat |

每轮：

1. 从实际工具调用**手工**构造 direction packet（`turn-N/input.md` 内嵌 JSON），binding 字段=已结算机械事实，free 字段=sensoryAnchors/npcStances。
2. 渲染器 prompt（`renderer-system-prompt.md`）：packet 契约 + creative-constitution + style + render + output-contract + style-blacklist。**零工具 schema、零机械规则、零 secret state**。
3. 散文史只给前 2 轮最终正文（无工具调用噪音）。
4. 用临时洁净室 subagent（`render-spike`，user-scope，无工具、不继承项目上下文）渲染，输出 `turn-N/rendered.md`；`turn-N/baseline.md` 是当时单 pass 的实际正文。

## 结果

机械 lint（`engine/audit/lint-rules.ts`）：

| 轮  | baseline                                 | rendered                   |
| --- | ---------------------------------------- | -------------------------- |
| 52  | clean (841 字)                           | double-simile ×1 (1351 字) |
| 55  | clean (1053 字)                          | clean (1093 字)            |
| 57  | empty-atmosphere + fake-climax (2686 字) | double-simile ×1 (1661 字) |

主观检查（逐条对照 packet binding 字段）：

- **resolvedChanges 全部落地**，且落法符合 render protocol：turn 55 的魔力消耗被译成「从契约连接里被抽走一截魔力，像从水壶里倒掉一杯水」；turn 57 的 EX 幸运免死译成瓷器裂纹+金色粒子但人还站着。无一条被写成报告句。
- **refusesToSay 防线成立**：turn 52 渲染器让式明确堵住「名字背后的事就别问了」，张力保留、秘密未泄。
- **endWindow 全部命中**：turn 55 结尾落在「装填间隙的几口呼吸」——比 packet 原文更具体的行动窗口。
- **声音一致性**：式的慵懒/流苏/刀鞘敲击、Rider 的海盗腔在干净散文史下完整延续；turn 52 渲染版的关系质感比基线更细。
- **canon 纪律**：turn 57 给了 FGO 宝具语音作风格参考并禁止照抄——渲染器化用了气质（「送别般的一刀」）没有照抄原文。
- **eventWeight 生效**：heavy 轮给足过程；normal 轮长度与基线相当。

## 风险确认（对照 backlog #12 的「接缝信息损失」担忧）

1. **packet 质量是真正的瓶颈**。本 spike 的 packet 是人工精心构造的（最优情况）。生产中 packet 由结算器（Pass A）生成，质量未验证——这是下一步（packet schema + `submit_direction_packet` 工具）要测的东西。
2. 渲染器会从模型自身知识**补充 packet 之外的 canon**（turn 52 自行补出「两仪为姓、式为名」）。本例无害，但确认了 packet 防火墙 + 渲染输出 lint（#1 规则集两道关卡）不可省略。
3. 渲染器会做**正确的因果推演**（turn 57 自行补出「真名报出去了，往后的对手都会冲着这把刀来」）——这是收益不是风险，但说明 packet 不需要穷举所有后果。

## 下一步（backlog #12 实施路线步骤 2 起）

packet schema + TypeBox 验证 + secret 扫描（复用 `engine/audit/lint-rules.ts`）；`submit_direction_packet` 工具 + `terminate:true`；然后验证**结算器产出的 packet** 能否达到本 spike 手工 packet 的信息密度。

## 复现

临时 agent 已删除；重建：`subagent action=create`，config 见本目录 `renderer-system-prompt.md`（systemPromptMode: replace, inheritProjectContext: false, inheritSkills: false, tools: ""），task 喂 `turn-N/input.md` 全文。
