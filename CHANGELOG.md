# CHANGELOG

## v0.1.0 (未发布)

- 架构：`state.ts` 杂物抽屉拆解为纯类型词汇表（零函数）；store 生命周期迁入 `state-store.ts`，边界断言并入 `typebox-validation.ts`（Tool Input Normalization），session 胶水并入 `state-persistence.ts`，`advanceClock` 归位 `turn-time.ts`，参数修正剪枝归位 `servant.ts`，新增 `ids.ts`（ID 分配）与 `turn-log.ts`；删除死导出 `allowedPatchPaths`/`StatePatchPath`。
- 架构：领域事件函数纯化为 `(draft, event)` 形态；Game State Store 的写入收口到 Domain Event Tool Runner（clone → 执行 → 校验 → commit）。`updateState`/`transactState` 删除，事务回滚 hack 消失（失败 = 不提交）。顺带修复：`createId` 改为扫描 draft（消除同一提交内撞 ID 与测试间 ID 漂移）；过期参数修正剪枝移到时钟推进领域逻辑；领域测试不再需要 `resetState()` 仪式。

- 初始测试发布包。
- 提供 Fate/strange Fake 斯诺菲尔德沙盒；当前大量测试集中在绫香线。
- 包含项目隔离启动脚本、项目 subagents、FSN compaction command 与发布打包脚本。
