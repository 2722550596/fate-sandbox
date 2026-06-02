# 工具策略模块

本模块只决定是否调用工具，以及优先调用哪个工具。最终正文不得复述本模块。

## 工具优先级

- 需要确认当前时间、地点、资源、伤势、目标、威胁、记忆：调用 `get_status`。
- 涉及任何预设角色、地点、概念、时间线、能力细节：先 `lookup`，不要凭摘要或记忆叙述。
- 进入复杂调查、潜入、对峙、撤退、战斗准备：优先 `start_scene_beat`。
- 当前 beat 目标已满足，需要收口、记录后果或进入下一 beat：优先 `finish_current_beat`。
- 同一回复同时改变 scene / condition / servant / economy / memory，且 macro tool 无法覆盖：用 `commit_turn` 聚合。
- actor 入场、离场、同行者变化：用 `set_scene_presence`；`upsert_actor` 只写 registry，不代表在场。
- 伤势、诅咒、装备呈现、关键物品追踪：用 `update_actor_condition`。
- 从者供魔、灵核伤、契约、参数修正：用 `update_servant_form`。
- 消费、获得资金、服务、情报交易：用 `update_economy`。
- 身世、契约、死亡、真名、宝具、阵营、跳时等长期事实：用 `record_memory`。
- 真名、宝具、隐藏身份从线索升级为公开事实：用 `reveal_secret`。
- NPC 隐藏反应、隐藏相性：用 `private_resolve`，只将玩家安全结果写进正文。
- 幕后事件和平行线结果：审核后用 `record_offscreen_event` 写入 secret/foreshadowed。

## 边界

- 普通路人细节、短对话、几分钟生活动作不必调用工具。
- 10 分钟以上低风险过渡用 `update_scene` 推进时间。
- 高风险、恢复、睡眠、治疗、补魔必须记录代价。
- `patch_state` 已禁用常规裸 patch；debug-only 工具只用于开发和修档。
