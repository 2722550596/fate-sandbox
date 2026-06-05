# fate-sandbox

Fate sandbox for pi coding agent. 当前大量测试集中在 Fate/strange Fake 斯诺菲尔德的绫香线。

## Requirements

- Node.js >= 24
- pnpm 11.3.0
- pi coding agent

## Quick Start

```bash
pnpm install
./start.sh
```

进入 pi 界面后，先确认模型/API 已经配置好；如果没登录，先按自己的 pi 环境执行 `/login` 或配置 provider。

然后在输入框里输入：

```txt
/skill:start-game
```

或直接用自然语言说“开始游戏”。推荐用 `/skill:start-game`，它会按项目的开局流程初始化。

看到右下角类似 `0.0%` 和一个方块时，那通常是 pi 的上下文/状态 UI，不是下载进度条。首次启动如果没有 API/model 配置，界面可能看起来像“卡住”，但实际是在等你输入命令或配置模型渠道。

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
