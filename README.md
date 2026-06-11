# fate-sandbox

Fate sandbox for pi coding agent. 当前大量测试集中在 Fate/strange Fake 斯诺菲尔德的绫香线。

## Requirements

- Node.js >= 24
- pnpm 11.3.0
- pi coding agent

## Quick Start

### Linux / macOS

```bash
pnpm install
./start.sh
```

### Windows PowerShell

```powershell
pnpm install
.\start.ps1
```

如果 PowerShell 执行策略拦截脚本，可在当前窗口临时放开：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start.ps1
```

进入 pi 界面后，先确认模型/API 已经配置好；如果没登录，先按自己的 pi 环境执行 `/login` 或配置 provider。

然后在输入框里输入：

```txt
/skill:start-game
```

或直接用自然语言说“开始游戏”。推荐用 `/skill:start-game`，它会按项目的开局流程初始化。

常用 UI 命令：

```txt
/status     查看当前时间、地点、目标、威胁和资源
/inventory  查看当前玩家可见资金与物品
/compact    手动压缩聊天上下文（项目已接管为 Fate 压缩策略，自动压缩同样生效）
/fuck [N]   快速回退到倒数第 N 次输入（默认 1）：中断生成、删除废弃分支、原输入回填输入框
```

`/fuck` 是“坏输入急救”：刚发出去就后悔时用它回到输入前一刻，游戏状态会自动回滚到回退点快照。被废弃的分支会从 session 文件中物理删除，不可恢复；如果想保留分支对比不同走向，请用 pi 自带的 `/tree`。

`/status` 和 `/inventory` 是 UI 面板，不是剧情动作；它们用于命令行里查看自己当前知道/持有的东西。

看到右下角类似 `0.0%` 和一个方块时，那通常是 pi 的上下文/状态 UI，不是下载进度条。首次启动如果没有 API/model 配置，界面可能看起来像“卡住”，但实际是在等你输入命令或配置模型渠道。

## New to Fate?

可以玩。推荐选择“新手模式”：普通人或穿越者视角进入异常，让玩家角色和玩家本人一起理解魔术世界。

第一次玩不建议直接选择复杂 FSF 多阵营中心或从者开局。更稳的开局是：

```txt
2004 年冬木市，你是不了解魔术的普通学生或临时来客。某天放学后，你在旧仓库附近看见了不该存在的光。
```

GM 应该只解释影响下一步行动的最小术语，不会要求玩家先懂 Fate 设定。

## Model Notes

本项目强依赖模型的工具调用纪律。它不是普通 prompt 角色卡：移动、过夜、花钱、受伤、揭示真名、推进 scene beat 等状态变化都应该通过工具落地。

推荐使用能稳定 tool calling、愿意根据工具错误重试的模型。模型可以犯参数错，工具会拒绝坏状态并给出可用选项；但如果模型经常跳过工具直接续写，体验会退化成普通聊天卡，状态和剧情会开始分家。

已重点测试：GPT-5.5。也测试过 Opus 4.5、DeepSeek V4 Pro。项目子代理默认使用 DeepSeek V4 Pro，可自行调整。

### 双模型：结算与渲染分开

每一轮分两段跑：结算轮（工具调用、规则裁决）和渲染轮（玩家可见正文）。两轮可以用不同模型：

```bash
FATE_RENDER_MODEL=provider/model-id ./start.sh
```

例如 `FATE_RENDER_MODEL=anthropic/claude-opus-4-5`。未设置时渲染轮复用结算轮的当前模型；格式错误或模型未注册会告警并回退。结算轮吃工具调用纪律，渲染轮吃文笔——可以按需分开点菜。

实测推荐搭配：结算 GPT-5.5 + 渲染 Claude Fable 5。

## Local State

首次运行会在项目内创建隔离配置目录：

```txt
.pi/agent/
```

如果没有可用认证，请按 pi 的正常流程登录或配置 provider。

## Tester Notes

- 游玩存档在 `sessions/`。
- `state/` 是运行时 debug export / legacy fallback，不是发布内容。
- `.pi/agent/auth.json` 包含本地认证信息，不要分享。
- 普通玩家模式会禁用 pi-subagents 内置 coding agents；开发时可用：

```bash
TAVERN2AGENT_DEV=1 ./start.sh
```

## License

GPL-3.0-or-later. See `LICENSE`.

这是同人实验项目；Fate / TYPE-MOON 相关设定归各自权利方所有。

## Package

```bash
pnpm run pack:release
```

输出在：

```txt
dist/
```

发布包不包含 `node_modules/`、`sessions/`、`state/`、`.pi/agent/`、`.pi/npm/`。
