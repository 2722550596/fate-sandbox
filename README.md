# lotm-sandbox

《诡秘之主》世界观沙盒 for pi coding agent。

基于 Fate Sandbox 引擎重构，将原著的世界书、序列体系、非凡特性、经济系统和叙事规则移植为可交互的叙事 runtime。

## 从零开始

### 1. 装 Node.js

本游戏需要 **Node.js >= 24** 和 **pnpm 11.3.0**。如果还没有：

```bash
# 推荐用 nvm 装 Node（装完会自动选好版本）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
exec bash
nvm install 24
nvm use 24

# 装 pnpm
corepack enable && corepack prepare pnpm@11.3.0 --activate
```

Windows 用户可以装 [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)，然后用管理员 PowerShell 装 pnpm。

> **💡 Windows 用户强烈推荐用 WSL2**（见下文），这样可以直接走 Linux 流程，不用折腾原生 Windows 环境。

### 2. 装 pi coding agent

[pi.dev](https://pi.dev) — 本游戏的运行底座，一个本地优先的 AI coding agent。

任选一种方式：

```bash
# 推荐 — 一键脚本
curl -fsSL https://pi.dev/install.sh | sh

# 或用 npm
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

# 或用 bun
bun add -g --ignore-scripts @earendil-works/pi-coding-agent
```

Windows PowerShell（如果不用 WSL）：

```powershell
powershell -c "irm https://pi.dev/install.ps1 | iex"
# 或用 npm
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

装完后在终端里跑一下 `pi --version`，能正常输出版本号就说明装好了。

### 3. Windows 用户：WSL2（推荐）

如果在 Windows 上玩，**强烈建议装 WSL2**。原生 PowerShell 体验差、路径问题多，WSL 里就是完整 Linux 环境。

管理员 PowerShell 一行搞定：

```powershell
wsl --install -d Ubuntu
```

重启后开 Ubuntu 终端，继续走上面的 Linux 流程装 Node.js + pnpm + pi 即可。Ubuntu 终端里 `curl -fsSL https://pi.dev/install.sh | sh` 就能装 pi。

### 4. 开玩

```bash
# 先装依赖
pnpm install

# 复制环境变量模板（必须！否则 lookup 和秘密揭示功能不可用）
cp .env.example .env
# 然后编辑 .env，填入 SILICONFLOW_API_KEY（从 https://cloud.siliconflow.cn 获取）

# 启动
./start.sh
```

Windows 原生 PowerShell（不推荐，但能用）：

```powershell
pnpm install
cp .env.example .env
# 编辑 .env 填 key
.\start.ps1
```

如果 PowerShell 执行策略拦截脚本，可在当前窗口临时放开：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start.ps1
```

首次启动会看到 pi 的界面。如果没登录 pi，先跑 `/login` 或按提示配置 API provider。

然后在输入框里输入：

```txt
/skill:start-game
```

或直接用自然语言说"开始游戏"。推荐用 `/skill:start-game`，它会按项目的开局流程初始化。

常用 UI 命令：

```txt
/status     查看当前时间、地点、目标、威胁和资源
/inventory  查看当前玩家可见资金与物品
/compact    手动压缩聊天上下文（项目已接管压缩策略，自动压缩同样生效）
/reroll     重新渲染最后一条正文：保留结算事实，只替换可见小说文本
/fuck [N]   快速回退到倒数第 N 次输入（默认 1）：中断生成、删除废弃分支、原输入回填输入框
```

`/reroll` 是"正文不满意重写"：只重跑双 pass 的渲染段，不重新结算、
不推进时间、不改游戏状态；它只能作用于当前最后一条正文。

`/fuck` 是"坏输入急救"：刚发出去就后悔时用它回到输入前一刻，游戏状态会自动回滚到回退点快照。被废弃的分支会从 session 文件中物理删除，不可恢复；如果想保留分支对比不同走向，请用 pi 自带的 `/tree`。

`/status` 和 `/inventory` 是 UI 面板，不是剧情动作；它们用于命令行里查看自己当前知道/持有的东西。

看到右下角类似 `0.0%` 和一个方块时，那通常是 pi 的上下文/状态 UI，不是下载进度条。首次启动如果没有 API/model 配置，界面可能看起来像"卡住"，但实际是在等你输入命令或配置模型渠道。

## Environment

项目需要 `.env` 文件才能启用完整功能。从 `.env.example` 复制并填入你的 API Key：

```bash
cp .env.example .env
```

### 必需配置

| 变量                  | 用途                                                | 获取方式                                           |
| --------------------- | --------------------------------------------------- | -------------------------------------------------- |
| `SILICONFLOW_API_KEY` | RAG 世界设定查询（`lookup` 工具）+ 幕后信息揭秘判断 | [SiliconFlow 控制台](https://cloud.siliconflow.cn) |

不配置时 `lookup` 工具和秘密揭示功能会报错。游戏主体（场景、叙事、`lookup_novel`、经济）不受影响。

### 可选调优

| 变量                   | 默认值                          | 用途                       |
| ---------------------- | ------------------------------- | -------------------------- |
| `SILICONFLOW_BASE_URL` | `https://api.siliconflow.cn/v1` | API 接入点                 |
| `EMBEDDING_MODEL`      | `Qwen/Qwen3-Embedding-0.6B`     | RAG 嵌入模型               |
| `RERANKER_MODEL`       | `Qwen/Qwen3-Reranker-0.6B`      | RAG 重排序模型             |
| `LLM_JUDGE_MODEL`      | `Qwen/Qwen3-8B`                 | 秘密揭示判断模型           |
| `RENDER_MODEL`         | 复用结算模型                    | 渲染轮（Pass B）专用模型   |
| `RENDER_TEMPERATURE`   | 不传                            | 渲染轮温度参数             |
| `RENDER_CACHE`         | `short`                         | 渲染轮 prompt cache 保留档 |

## Model Notes

本项目强依赖模型的工具调用纪律。

推荐使用能稳定 tool calling、愿意根据工具错误重试的模型。模型可以犯参数错，工具会拒绝坏状态并给出可用选项；但如果模型经常跳过工具直接续写，体验会退化成普通聊天卡，状态和剧情会开始分家。

### 双模型：结算与渲染分开

每一轮分两段跑：结算轮（工具调用、规则裁决）和渲染轮（玩家可见正文）。两轮可以用不同模型：

```bash
RENDER_MODEL=provider/model-id ./start.sh
```

例如 `RENDER_MODEL=anthropic/claude-opus-4-5`。未设置时渲染轮复用结算轮的当前模型；格式错误或模型未注册会告警并回退。结算轮吃工具调用纪律，渲染轮吃文笔——可以按需分开点菜。

渲染轮另有几个可选旋钮：

- `RENDER_TEMPERATURE=0.9`：只作用于渲染/重写调用（结算轮不受影响）。默认不传——部分模型拒绝该参数，会导致每轮渲染回退机械摘要；确认你的渲染模型支持后再开。
- digest writer（前情提要写手）在推理模型上自动降到 `minimal` 档思考：压缩摘要不需要推理，省 token 也更快。
- `RENDER_CACHE=long|none`：渲染轮的 prompt cache 保留档，默认 `short`（Anthropic 5m TTL，命中免费续期）。实测 Claude OAuth 渠道不 honor 1h TTL，`long` 档只多付 2× 写价不换保留；走 API key 且渠道支持时再开。

### 自定义正文 lint 规则

渲染轮结束后会跑一层正则 lint，拦截泄密、Markdown、AI 腔开场白、空泛氛围词、报告句等。默认规则在：

```txt
engine/audit/lint-rules.ts
```

默认规则对应的提示词说明在：

```txt
agents/gm-style-blacklist.md
agents/gm-output-contract.md
```

如果只是玩家本地想加自己的禁词/禁句，不要改源码，建这个文件即可（`agents/user/` 已被 gitignore）：

```txt
agents/user/prose-lint.json
```

示例：

```json
{
  "rules": [
    { "id": "local-cliche", "scope": "anywhere", "pattern": "月光如水" },
    { "id": "no-opening-ah", "scope": "opening", "pattern": "^啊" }
  ]
}
```

字段说明：

- `id`：小写字母开头，只用小写字母、数字、`-`、`_`。
- `scope`：`opening`（首个非空行）、`ending`（结尾窗口）、`anywhere`（全文）、`per-line`（逐行）。
- `pattern`：JavaScript 正则字符串；运行时自动加 `g`/`u` flag。

规则命中后渲染器会重写一次；重写后仍命中会在 UI 里告警。未揭示真名/宝具泄密是内置 block 规则，不能用本地配置关闭。

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

GPL-3.0-or-later. See `LICENSE`. **GPL 仅覆盖代码**（引擎、扩展、工具、提示词框架）。

`data/` 目录不适用 GPL：其中是基于《诡秘之主》（作者：爱潜水的乌贼）整理的同人设定数据与原著文本，版权归原作者及各自权利方所有，仅供非商业同人用途，详见 `data/NOTICE.md`。这是同人实验项目。
