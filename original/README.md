# original.js 拆分说明

> 原文件 45387 行，拆分为 6 个领域模块、88 个文件。
> 纯粹为了可读性，不可也不应该直接运行。

## 目录总览

```
original/
├── battle-engine/          # 战斗系统引擎 (7084 行)
│   ├── models/             # 数据模型
│   ├── core/               # 核心算法
│   ├── systems/            # 战斗机制子系统
│   ├── logic/              # 条件判定与 AI
│   └── flow/               # 流程控制与输入输出
├── app-core/               # 顶层调度与 LLM 交互 (12022 行)
├── game-systems/           # 游戏系统玩法 (11185 行)
├── ui-components/          # UI 控制器 (8529 行)
├── data-storage/           # 数据与持久化 (2376 行)
├── misc/                   # 杂项工具 (1801 行)
└── _discard-performance/   # 性能优化（可丢弃）(3163 行)
```

## 各模块详情

### 1. battle-engine/ — 战斗系统引擎

| 子目录       | 文件                       | 行数 | 说明                                                                                               |
| ------------ | -------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| models/      | Hero.js                    | 119  | 角色实体                                                                                           |
|              | Move.js                    | 320  | 技能/行动实体                                                                                      |
| core/        | AttributeCalculator.js     | 282  | 属性计算                                                                                           |
|              | DamageCalculator.js        | 288  | 标准伤害计算                                                                                       |
|              | CustomDamageCalculators.js | 59   | 特殊伤害计算                                                                                       |
|              | SkillCostManager.js        | 119  | 资源管控                                                                                           |
|              | SequenceUtils.js           | 39   | 序列等级工具函数                                                                                   |
| systems/     | EffectManager.js           | 577  | Buff/Debuff 持续效果                                                                               |
|              | StatusEffectManager.js     | 190  | 伤势判定                                                                                           |
|              | TagManager.js              | 567  | 标签系统                                                                                           |
| logic/       | ConditionSystem.js         | 305  | 条件分支（TagChecker/RandomGenerator/ExpressionContext/ConditionEvaluator/ParameterSelector 合并） |
|              | CPUManager.js              | 92   | NPC AI 决策                                                                                        |
|              | TargetSelector.js          | 103  | 技能目标圈选                                                                                       |
| flow/        | BattleManager.js           | 525  | 战斗系统总控                                                                                       |
|              | TurnManager.js             | 836  | 回合调度器                                                                                         |
|              | BattleLogger.js            | 247  | 日志                                                                                               |
|              | BattleReporter.js          | 880  | 战报生成                                                                                           |
|              | SkillLoader.js             | 254  | 技能加载                                                                                           |
|              | ConfigLoader.js            | 220  | 配置加载                                                                                           |
|              | TeamManager.js             | 97   | 队伍管理                                                                                           |
|              | TurnResultPool.js          | 45   | 对象池                                                                                             |
|              | BattleSystemError.js       | 14   | 错误类                                                                                             |
|              | BattleErrorHandler.js      | 58   | 错误处理                                                                                           |
|              | BattleCache.js             | 29   | 缓存                                                                                               |
|              | BattleSystemInitializer.js | 76   | 初始化器                                                                                           |
|              | SafeBattleExecution.js     | 143  | 安全执行包装                                                                                       |
| test-code.js |                            | 153  | 测试代码                                                                                           |

### 2. app-core/ — 顶层调度与 LLM 交互

| 文件                         | 行数 | 说明                                             |
| ---------------------------- | ---- | ------------------------------------------------ |
| GameManager.js               | 4173 | 主控制器（初始化、生命周期、界面更新、自动保存） |
| GameManager-extras.js        | 2003 | 主控制器附属代码（杂项）                         |
| ChronicleCore.js             | 424  | 时空管理局（经历日记）                           |
| StreamHandler.js             | —    | 已合并至 GameManager.js                          |
| SystemSettings.js            | 1409 | 系统设置                                         |
| AutoBackup.js                | 718  | 自动备份                                         |
| TimelineJourney.js           | 297  | 历史记录                                         |
| CurrentPlaythroughHistory.js | 368  | 本周目经历                                       |
| SnapshotCorrection.js        | 1170 | 快照修正                                         |
| EnvironmentUI.js             | 570  | 环境与视觉                                       |
| NovelPlotGuide.js            | 863  | 原著剧情指引                                     |

### 3. game-systems/ — 游戏系统玩法

| 文件                  | 行数 | 说明         |
| --------------------- | ---- | ------------ |
| IndustrySystem.js     | 656  | 产业系统     |
| IndustryCalculator.js | 1737 | 产业计算函数 |
| EventGeneration.js    | 2096 | 事件生成系统 |
| EquipmentTrading.js   | 486  | 装备交易     |
| MailSystem.js         | 462  | 邮件系统     |
| TradingSystem.js      | 418  | 交易系统     |
| SequenceAbilities.js  | 407  | 序列能力列表 |
| misc-interactions.js  | 1516 | 交互杂项     |
| misc-systems.js       | 154  | 系统杂项     |
| misc-systems2.js      | 529  | 系统杂项 2   |
| misc-trading.js       | 233  | 交易杂项     |
| misc-gameplay.js      | 438  | 玩法杂项     |
| misc-gameplay2.js     | 144  | 玩法杂项 2   |
| misc-debug.js         | 1834 | 调试杂项     |

### 4. ui-components/ — UI 控制器

| 文件                      | 行数 | 说明                     |
| ------------------------- | ---- | ------------------------ |
| BattleUI.js               | 412  | 战斗界面                 |
| TeamBuilderUI.js          | 447  | 队伍组建界面             |
| BattleDisplayUI.js        | 1238 | 战斗显示界面             |
| FloatingVariableEditor.js | 897  | 悬浮变量编辑器           |
| AIContextConfigUI.js      | 1027 | AI 上下文配置            |
| MainPage.js               | 1404 | 主页面                   |
| InteractionPanel.js       | 317  | 交互面板                 |
| IndustryUI.js             | 79   | 产业 UI                  |
| IndustryCardUI.js         | 879  | 产业卡片 UI              |
| FactionUI.js              | 77   | 势力 UI                  |
| GuimiConsole.js           | 221  | 源堡系统（Debug 控制台） |
| WorldMap.js               | 1223 | 世界地图                 |
| DrawerControls.js         | 89   | 抽屉控制                 |

### 5. data-storage/ — 数据与持久化

| 子目录       | 文件                         | 行数 | 说明         |
| ------------ | ---------------------------- | ---- | ------------ |
| integration/ | AttributeMapper.js           | 128  | 属性映射器   |
|              | VariableSystemIntegration.js | 78   | 变量系统集成 |
|              | WorldbookManager.js          | 248  | 世界书管家   |
| schemas/     | SchemaValidation.js          | 79   | Schema 校验  |
|              | SchemaSave.js                | 447  | Schema 保存  |
|              | GameDatabase.js              | 1109 | 游戏数据库   |
|              | CloudSave.js                 | 241  | 云存档       |

### 6. misc/ — 杂项工具

| 文件                        | 行数 | 说明         |
| --------------------------- | ---- | ------------ |
| Header.js                   | 12   | 文件头注释   |
| UtilityFunctions.js         | 928  | 工具函数     |
| DynamicPropertyDetection.js | 663  | 动态属性检测 |
| RunLog.js                   | 150  | 运行日志     |
| LazyInterceptor.js          | 22   | 懒人拦截器   |

### 7. \_discard-performance/ — 可丢弃的性能优化

| 文件                          | 行数 | 说明           |
| ----------------------------- | ---- | -------------- |
| PerformanceMonitor.js         | 372  | 性能监控器     |
| OptimizedEventManager.js      | 124  | 事件管理器     |
| DOMCacheManager.js            | 52   | DOM 缓存       |
| MobilePerformanceOptimizer.js | 2317 | 移动端性能优化 |
| mobile-perf.js                | 135  | 移动端性能     |
| perf-end.js                   | 119  | 性能模块结束   |

## 注意事项

- 文件中的 `_headers.js` 是各子目录下的小段分隔注释，可忽略
- `misc-*.js` 是未能精确归类的杂项代码，标记了原始行号范围
- 所有文件头部标注了原始行号范围，方便回溯查证
- 总计 46160 行（含拆分时添加的文件头注释，比原始多 ~773 行）
