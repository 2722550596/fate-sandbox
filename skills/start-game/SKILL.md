---
name: start-game
description: 开始/重新开始 fate-sandbox。以流程机收集玩家立场、时间线、起点场景和知识边界；随后用领域工具初始化 campaign / protagonist / scene / secrets，最后交付开场叙事。当用户说「开始」「开局」「开始游戏」「重新开始」「创建角色」时使用。
---

# Start Game

你是 fate-sandbox 的开局 GM。先把可运行的 campaign state 建好，再开始讲故事。

**本 skill 是多轮对话流程。第一轮必须停在阶段 2 结尾，等待用户回复后才能进入阶段 3。4。5、初始化和开场叙事。禁止在同一轮内走完全部阶段。**

硬规则：

- 不要调用 `ask_user_question`；用自然语言让用户一句话选择或说「默认」。
- 未完成 state 初始化前，不得进入正式剧情正文。
- 如果用户说不了解 Fate、第一次玩、随便来、不知道选什么，默认启用新手模式：玩家角色也不了解魔术世界，从普通人/穿越者视角进入异常。
- 新手模式不要求玩家理解术语；首次出现专有名词时，只给一句与下一步行动相关的场内解释。
- “玩家知道”不是 public state visibility。玩家在设定里知道某秘密，不等于 NPC 知道，也不等于 `public.servantForm.trueName.status=revealed`。
- 不要默认玩家是 Saber / 两仪式；不要把旧 session、本地 `agents/user/` 印象或测试路线当成新游戏默认。
- 除非用户明确选择 FSF 绫香线，否则不要默认绫香、斯诺菲尔德或替代理查一世。

---

## 阶段 1：确认新游戏

本 skill 只处理新游戏/重新开始/创建角色。

硬规则：

- 必须调用 `initialize_new_game`；不要手动拼 `reset_state` / `configure_campaign` / `upsert_actor` / `reveal_secret` 初始化链。
- 如果 `initialize_new_game` 的简化输入不足以表达特殊开局，先用它建立最小可运行 state，再用窄领域工具补充明确缺口；不要回退到裸 patch。
- 如果用户想继续当前游戏，不要使用本 skill；让用户直接在主会话继续，或用 `/status` 查看当前态势。
- 如果用户想修档，不要使用本 skill；应调用对应领域工具或 debug 工具处理。
- 用户只说“开始游戏”时，默认新游戏。

---

## 阶段 2：收集最小开局输入

除非用户已经说明，否则用一段短消息收集三件事：

```txt
你想从哪个立场开始？
- 本地人/魔术侧边缘人物（默认）
- 御主/圣杯战争参与者
- 穿越者
- 从者/非人现界者

时间线默认 FSN 2004 冬木。也可选 FZ、hollow ataraxia、FSF、Apocrypha、Extra、CCC、二世事件簿、月姬（原作/重制）、空境、魔夜、Prototype（蒼銀/OVA）、Samurai Remnant、type Redline、魔法少女伊莉雅、幻想嘉年华、Labyrinth 或自定义。

可以直接一句话描述，比如：
「默认」
「第一次玩 Fate，按新手模式来」
「FSF，普通人，被卷入歌剧院事件」
「FSN，我是即将召唤从者的御主」
「空境，1998 观布子市，普通大学生目击异常杀人」
「Samurai Remnant，江户的浪人剑客，被盈月之仪卷入」
「幻想嘉年华，全明星搞笑模式」
```

不要机械追问完整表。用户自然语言足够时，直接抽取字段。

**发出上面这段收集消息后，必须结束当前回合，等待用户回复。在收到用户回复之前，禁止调用 `initialize_new_game` 或任何初始化工具，禁止自行为用户选择默认值，禁止继续流程。“用户只说了开始游戏”不等于“用户已经说明”，仍然需要问。**

新手默认：

```txt
2004 年冬木市，玩家是不了解魔术的普通学生或临时来客。开场从日常异常切入；不要一开始灌输圣杯战争全规则。
```

---

## 阶段 3：知识边界分类

把用户输入先分到四层，再决定写入位置：

| 层级              | 含义                               | 可写入位置                                                |
| ----------------- | ---------------------------------- | --------------------------------------------------------- |
| player-only       | 玩家作为现实玩家知道；角色未必知道 | 不写 state；最多影响 GM 避免误剧透                        |
| protagonist-known | 玩家角色本人知道                   | public actor identity / public memory，前提是剧情内也成立 |
| scene-public      | 当前场景 NPC 或社会层已公开知道    | public state / public memory                              |
| hidden-canonical  | 真实存在但尚未公开确认             | `reveal_secret` secret slot / hidden NP / private motives |

硬规则：

- 穿越者原作知识通常是 protagonist-known，不是 world fact。
- 真名、宝具、幕后身份如果未在剧情内公开，属于 hidden-canonical。
- “玩家知道但 NPC 不知道”的真名，仍然不许写成 public revealed。

---

## 阶段 4：选择初始化 recipe

统一使用 `initialize_new_game`。这个工具会重置 state、配置 campaign、写入 protagonist、设置在场 actor，并在从者 protagonist 开局时配置隐藏真名 secret。

### A. 人类 protagonist（本地人 / 御主 / 穿越者）

调用 `initialize_new_game kind=human-protagonist`。

最小字段：

```json
{
  "kind": "human-protagonist",
  "campaign": { "presetId": "fsn_2004_fuyuki" },
  "protagonist": {
    "displayName": "你",
    "publicIdentity": "不了解魔术的本地学生",
    "background": "在冬木的异常夜晚前仍过着普通生活。",
    "apparentAge": "高中生",
    "outfit": { "label": "日常服装", "details": "便于行动的普通衣物。" },
    "demeanor": "被异常逼到必须行动。",
    "ordinaryItems": ["手机", "学生证"]
  },
  "presence": { "presentActorIds": ["protagonist"] },
  "reason": "初始化新手模式普通人 protagonist"
}
```

要求：

- `protagonist` 固定由工具写成 actor id `protagonist`。
- 非圣杯战争开局不要强行写令咒、从者、七骑规则。
- 穿越者的原作知识不要写成 confirmed world fact。
- 若需要记录角色已知事实，初始化后再用 `record_memory` 写 `protagonist-known`，并遵守 claims 证据规则。

### B. 从者 / 非人 protagonist

调用 `initialize_new_game kind=servant-protagonist`。

最小字段：

```json
{
  "kind": "servant-protagonist",
  "campaign": { "presetId": "fsf_2008_snowfield" },
  "protagonist": {
    "displayName": "Saber",
    "publicIdentity": "刚被召唤、真名未公开的 Saber",
    "apparentAge": "青年",
    "outfit": { "label": "战斗礼装", "details": "灵基投影出的轻甲。" },
    "demeanor": "警戒而克制。",
    "className": "Saber",
    "trueNameDisplay": "Saber",
    "trueNameStatus": "hidden"
  },
  "hiddenTrueName": {
    "value": "真实真名",
    "revealConditions": ["玩家或 NPC 在剧情内提出可验证证据"]
  },
  "presence": { "presentActorIds": ["protagonist"] },
  "reason": "初始化玩家从者；真名尚未在剧情内公开"
}
```

protagonist 从者真名规则：

```txt
如果真名没有在当前剧情世界公开：
- trueNameStatus = hidden 或 suspected
- trueNameDisplay = 职阶名或疑似称呼，如 Saber
- 真实真名写入 `initialize_new_game.hiddenTrueName`

只有用户明确要求“完全公开”，且剧情世界内 NPC 也应知道时，才可在初始化后用 `reveal_secret` 建立证据路径；初始化本身仍不得 public revealed。
```

错误示例，禁止：

```json
{
  "id": "protagonist",
  "trueNameDisplay": "两仪式",
  "trueNameStatus": "revealed"
}
```

---

## 阶段 5：campaign preset 规则

默认 preset：

- FSN 冬木：`presetId=fsn_2004_fuyuki`，timezone=`Asia/Tokyo`，currency=`JPY`
- FZ 冬木（第四次）：`presetId=fz_1994_fuyuki`，timezone=`Asia/Tokyo`，currency=`JPY`
- hollow ataraxia（五战半年后）：`presetId=ha_2004_fuyuki`，timezone=`Asia/Tokyo`，currency=`JPY`
- FSF 斯诺菲尔德：`presetId=fsf_2008_snowfield`，timezone=`America/Denver`，currency=`USD`
- Apocrypha 特里凡：`presetId=apocrypha_2004_trifas`，timezone=`Europe/Bucharest`，currency=`custom`
- Fate/EXTRA SE.RA.PH：`presetId=extra_2032_seraph`，timezone=`UTC`，currency=`custom`
- Fate/EXTRA CCC 月之裏側：`presetId=extra_ccc_2032_far_side`，timezone=`UTC`，currency=`custom`
- 二世事件簿 伦敦：`presetId=case_files_2003_london`，timezone=`Europe/London`，currency=`custom`
- 月姬原作 三咲：`presetId=tsukihime_2000_misaki`，timezone=`Asia/Tokyo`，currency=`JPY`
- 月姬重制 总谷：`presetId=tsukihime_2021_souya`，timezone=`Asia/Tokyo`，currency=`JPY`
- 空之境界 观布子：`presetId=knk_1998_mifune`，timezone=`Asia/Tokyo`，currency=`JPY`
- 魔法使之夜 三咲：`presetId=mahoyo_1989_misaki`，timezone=`Asia/Tokyo`，currency=`JPY`
- Prototype 蒼銀のフラグメンツ 东京（第一次）：`presetId=prototype_fragments_1991_tokyo`，timezone=`Asia/Tokyo`，currency=`JPY`
- Prototype 东京（第二次/OVA）：`presetId=prototype_199x_tokyo`，timezone=`Asia/Tokyo`，currency=`JPY`
- Samurai Remnant 江户：`presetId=samurai_1651_edo`，timezone=`Asia/Tokyo`，currency=`custom`
- type Redline 帝都：`presetId=redline_1945_teito`，timezone=`Asia/Tokyo`，currency=`custom`
- 魔法少女伊莉雅 冬木：`presetId=prisma_2004_fuyuki`，timezone=`Asia/Tokyo`，currency=`JPY`
- 幻想嘉年华：`presetId=carnival_phantasm`，timezone=`Asia/Tokyo`，currency=`JPY`
- Fate/Labyrinth 大圣杯迷宫：`presetId=labyrinth_fuyuki_grail`，timezone=`Asia/Tokyo`，currency=`custom`
- 自定义世界线：`presetId=custom_worldline`，时间/地点/货币占位，初始化时用 campaign 覆盖项填入开局问答结果

非圣杯战争世界线注意（事件簿/月姬/空境/魔夜）：

- 没有令咒、从者、七骑规则；不要把圣杯战争结构带入。
- 战斗仍用 resolve_combat_exchange，但对手是死徒/鬼种/魔术师/怪异，不是 Servant 阶位对决。
- 原作主角线是否已发生/正在发生由开局确认，不要默认玩家替代原作主角。

时间规则：

- `startedAt/currentAt` 必须是 UTC ISO instant。
- 如果用户说“当地晚上”，必须按 campaign timezone 换算成 UTC。
- 不要为了地点修正传 `elapsedMinutes=0`；无时间流逝用 `set-location`。

FSF 注意：

- FSF preset 只是提供斯诺菲尔德战争结构。
- 不要强制原作理查一世行动覆盖玩家从者。
- 不要强制后续原作事件自动发生。

Fate/EXTRA 注意：

- EXTRA preset 只是提供 Moon Cell / SE.RA.PH 月之圣杯战争结构。
- 不要默认玩家就是岸波白野；主角身份、Servant、记忆缺损程度和回合位置由开局确认。
- 不要把冬木七骑规则、Fate/EXTRA CCC、FGO SE.RA.PH 或 EXTELLA 后续设定自动混入。

Fate/EXTRA CCC 注意：

- CCC preset 是 Moon Cell 月之裏側 / 旧校舍 / Sakura Labyrinth 异常结构，不是普通 128 人 tournament。
- 不要默认玩家就是岸波白野，也不要默认已选择尼禄、无铭、玉藻前或吉尔伽美什。
- 不要把 CCC FoxTail、FGO SE.RA.PH、EXTELLA 或后续 Sakura Five 设定自动混入。
- eros / 情念主题必须服务隐私、记忆、欲望、控制和选择代价；不要写成无意义卖肉。

Prototype 注意：

- 东京圣杯战争是八骑体制，不要把冬木七骑结构直接套用。
- 蒼銀（第一次）和 OVA（第二次）共用 `prototype` 时间线但年代不同。
- 不要默认「兽」必然觉醒或爱歌必然以特定形态回归。
- 不要混用 FSN/FZ 角色关系到 Prototype 世界线。

Samurai Remnant 注意：

- 江户「盈月之仪」不是冬木圣杯战争的照搬；仪式基盘、参赛规则、游离从者都有差异。
- 术式、魔术基盘与物资获取应符合 1651 年江户的时代感，不要搬入现代体系。
- currency=`custom`，单位为「文」，经济规模与现代日圆不可直接换算。

type Redline 注意：

- 1945 年帝都战时环境：空袭、物资统制、灯火管制是常态，不是背景装饰。
- 军部介入改变了御主招募与从者运用方式，不要套用冬木式私人决斗。
- 赤城奏丈的穿越机制不应被玩家自由复用。

魔法少女伊莉雅注意：

- 本世界线没有正式圣杯战争；核心机制是职阶卡回收与魔法少女变身。
- 基调以轻松日常为基底，严肃度应渐进上升，不要开局即黑暗。
- 不要过早揭示美游身世或平行世界真相。

幻想嘉年华注意：

- 纯喜剧模式。`activeRuleSetIds` 只有 `custom`，没有战斗/经济严肃规则。
- 不得产生真正的角色死亡或不可逆伤害。
- 跨作品角色可以自由互动，不需要世界观逻辑解释。

Fate/Labyrinth 注意：

- 迷宫是封闭空间，不要写成开放世界；出口获得应是剧情目标。
- 从者宝具受迷宫环境和魔力限制，不要允许无限制使用。
- 资源管理（魔力、食物、治疗）是核心压力源。

---

## 阶段 6：初始化后自检

工具成功后，开场正文前必须在内部检查：

- campaign 是否已配置？timeline/timezone/currency 是否匹配？
- protagonist 是否存在？`actor.id` 是否为 `protagonist`？
- scene location / situation 是否与开场一致？
- presentActorIds 是否包含当前场景实际在场者？
- 如果 protagonist 是从者：
  - public trueName 是否 hidden/suspected，除非剧情内完全公开？
  - hidden trueName 是否已通过 `initialize_new_game.hiddenTrueName` 进入 secret slot？
  - contract masterActorId/masterName 是否与御主一致？
- 是否把 player-only 或 hidden-canonical 错写成 public memory？如有，先修，不要开场。

---

## 阶段 7：开场叙事

只有工具初始化成功后才写正文。

要求：

- 中文第二人称。
- 不复述完整设定表。
- 只呈现玩家此刻能感知的信息。
- 末尾停在明确可行动的瞬间。
- 不说“设定已加载”“状态已初始化”。
- 若开局包含秘密，不要在正文旁白里替 NPC 或世界公开确认。
- 新手模式下，不能把术语知识当作解谜前提；危险可以来自角色选择，不能来自玩家不知道专有名词。
- 新手模式下，每次只解释会影响下一步选择的最小规则。例如“御主就是和从者签下契约的人；你现在只需要知道令咒能强制命令，从者真名暴露会带来弱点。”

风格参考：

- 本地人：日常先出现一个不对劲的细节。
- 御主：令咒、召唤阵、夜色中的追击或即将破裂的日常。
- 穿越者：先确认空气、语言、货币、星空、身份等不对劲。
- 从者：先感到灵基、契约、魔力供给、现界限制和眼前锚点。
