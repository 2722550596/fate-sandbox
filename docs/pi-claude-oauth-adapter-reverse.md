# pi-claude-oauth-adapter 逆向分析文档

> 源码地址：npm `pi-claude-oauth-adapter@0.1.2`  
> 作者：minzique  
> 分析日期：2026-05-29  

---

## 一、它解决什么问题

Pi Coding Agent 支持 Anthropic OAuth（Claude Pro/Max 订阅）登录，但 Anthropic 后端会校验请求是否来自合法的 Claude Code 客户端。Pi 发出的请求有几个问题：

1. **缺少 billing header** — Anthropic OAuth 后端要求 `x-anthropic-billing-header` 字段，包含 Claude Code 版本号签名
2. **System prompt 中有自我标识** — 包含 `"You are Claude Code, Anthropic's official CLI for Claude."`，OAuth 模式下不应出现
3. **System prompt 含大量 Pi 自文档** — 占用 token 预算，且对模型回答问题无帮助（除非用户问 Pi 本身）

这个包就是解决这三件事的。

---

## 二、核心逆向思路

### 2.1 Billing Header 伪造

**目标**：让 Anthropic OAuth 后端相信请求来自合法 Claude Code CLI。

**做法**：

```
x-anthropic-billing-header: cc_version=2.1.96.abc; cc_entrypoint=pi; cch=xxxxx;
```

| 字段 | 来源 | 说明 |
|------|------|------|
| `cc_version` | `PI_CLAUDE_CODE_VERSION` 或默认 `2.1.96` | Claude Code 版本号 |
| 版本 hash | `SHA256(salt + 采样字符 + version)` 取前 3 位 hex | 从首条 user message 的第 4、7、20 字符采样 |
| `cc_entrypoint` | `PI_CLAUDE_CODE_ENTRYPOINT` 或默认 `pi` | 入口点标识 |
| `cch` | `SHA256(首条 user message 全文)` 取前 5 位 hex | 消息内容 hash |

**关键常量**：

```typescript
const BILLING_SALT = "59cf53e54c78";
const DEFAULT_CLAUDE_CODE_VERSION = "2.1.96";
```

**hash 算法**：

```typescript
function buildBillingHeader(messages, entrypoint) {
  const firstUserMessage = messages.find(m => m.role === "user");
  const messageText = firstUserMessage ? getText(firstUserMessage.content) : "";
  const sampledChars = [4, 7, 20].map(i => messageText[i] ?? "0").join("");
  const versionHash = sha256(`${BILLING_SALT}${sampledChars}${version}`).slice(0, 3);
  const cch = sha256(messageText).slice(0, 5);
  return `x-anthropic-billing-header: cc_version=${version}.${versionHash}; cc_entrypoint=${entrypoint}; cch=${cch};`;
}
```

**关键细节**：
- `sampledChars` 取 [4,7,20] 三个位置，缺位补 `"0"`
- `versionHash` 只有 3 位 hex，碰撞空间 ~4096，但加上 salt 和采样字符后实际不碰撞
- `cch` 是对整个首条 user message 的 SHA256 前 5 位

### 2.2 System Prompt 净化

在 `before_provider_request` hook 中对 system blocks 做三件事：

1. **删除 identity block**
   ```
   "You are Claude Code, Anthropic's official CLI for Claude."
   ```
   匹配后直接 `continue`（跳过）

2. **删除 Pi docs 段**
   匹配 `"Pi documentation (read only when..."` marker，调用 `extractDocsSection()` 剥离 docs 部分，只保留剩余文本。如果剥离后为空字符串则整个 block 丢弃。

3. **注入 billing header**
   如果遍历完所有 blocks 后仍无 billing header，在最前面 `unshift` 一条。

4. **(兜底) 确保至少有一个 prompt block**
   `ensurePromptBlock()` — 如果所有 system blocks 都只是 billing header（极端情况），从 system prompt 提取剩余文本追加一条带 `cache_control` 的 block。

### 2.3 Pi Docs 的剥离-缓存-按需注入

这是最精巧的部分，分三步：

#### Step 1: before_agent_start — 剥离

```
系统提示词: "...behavioral directive... Pi documentation (read only...) ... # Project Context ..."
              └─ 前半部分 ─┘ └─────── docs 段 ────────┘ └── 后半部分 ──┘
```

`extractDocsSection()` 找到 docs marker，然后找三个 end marker 中最早的那个：
- `"\n\n# Project Context"`
- `"\n\n<available_skills>"`
- `"\nCurrent date:"`

返回 `{ docsSection, strippedPrompt }`，然后把 `strippedPrompt` 设为新的 system prompt。

#### Step 2: context hook — 按需注入

根据 `shouldInjectDocs()` 判断是否注入：

```typescript
function shouldInjectDocs(prompt) {
  if (scope === "never")  return false;
  if (scope === "always") return true;
  return PI_TOPIC_REGEX.test(prompt);  // pi-only
}
```

Pi 话题检测正则：

```regex
/\b(pi|@mariozechner\/pi-|pi-mono|coding agent harness|pi sdk|
  pi extension|pi theme|pi skill|pi tui|pi package|prompt templates?|
  keybindings?|custom providers?|adding models?)\b/i
```

四种注入模式：

| 模式 | 行为 | 默认 |
|------|------|------|
| `prepend-custom-message` | 最后一条 user message **前**插入隐藏 custom message | ✅ |
| `append-custom-message` | 最后一条 user message **后**插入 | |
| `user-reminder` | 直接在最后一条 user message 文本前拼接 `<system-reminder>` | |
| `none` | 不注入 | |

custom message 格式：
```json
{
  "role": "custom",
  "customType": "claude-oauth-docs-context",
  "content": "<pi-docs-context>\n{docs内容}\n</pi-docs-context>",
  "display": false,
  "timestamp": 1717...
}
```

#### Step 3: 幂等保护

`user-reminder` 模式下，检查文本是否已以 `<system-reminder>` 开头，避免重复注入。

### 2.4 Fallback 链

如果系统提示词中提取不到 docs 段，按优先级尝试：

1. **环境变量** `PI_CLAUDE_OAUTH_DOCS_FILE` → 读文件
2. **动态构建** → 从 `process.argv[1]` 反推 Pi 安装路径，拼接 README.md + docs/ + examples/ 路径
3. **失败** → `docsSource: "missing"`，显示 `⚠ Claude OAuth setup`

### 2.5 状态机

```
inactive ──(Anthropic OAuth 且 docs 解析成功)──→ ready
ready ──(首次 provider request 发出)──→ active
active ──(HTTP ≥400)──→ issue
issue ──(session_shutdown)──→ inactive
```

TUI footer 显示：
- `✓ Claude OAuth ready` — 解析完成，等待首次请求
- `✓ Claude OAuth active` — 已发出至少一次规范化请求
- `⚠ Claude OAuth setup` — 缺少 docs context 或请求失败

通过 `ctx.ui.setStatus()` 暴露 `claude-oauth-ready` 和 `claude-oauth-issue` 两个状态键，供 Pi runtime 消费。

---

## 三、激活条件

只在同时满足以下条件时激活：

```typescript
function shouldApply(ctx) {
  return ctx.model?.provider === "anthropic" && ctx.modelRegistry.isUsingOAuth(ctx.model);
}
```

- Provider 是 `anthropic`
- 使用 OAuth 认证（非 API Key）

如果是 `ANTHROPIC_API_KEY` 模式，整个适配器保持 `inactive`，完全透明。

---

## 四、事件管线一览

| Hook | 做什么 |
|------|--------|
| `session_start` | 状态同步 |
| `model_select` | 模型切换时重新同步 |
| `before_agent_start` | 剥离 docs，缓存到 activeTurn |
| `context` | 按需注入 docs 到 messages |
| `before_provider_request` | **核心**：净化 system blocks + 注入 billing header |
| `after_provider_response` | 检测 HTTP 错误 |
| `agent_end` | 清理 activeTurn |
| `session_shutdown` | 重置所有状态 |

---

## 五、可配置项

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PI_CLAUDE_OAUTH_REINJECT_SCOPE` | `pi-only` | `never` / `always` / `pi-only` |
| `PI_CLAUDE_OAUTH_REINJECT_MODE` | `prepend-custom-message` | `prepend-custom-message` / `append-custom-message` / `user-reminder` / `none` |
| `PI_CLAUDE_OAUTH_LOG_FILE` | (无) | JSONL 调试日志路径 |
| `PI_CLAUDE_OAUTH_DOCS_FILE` | (无) | docs fallback 文件路径 |
| `PI_CLAUDE_CODE_VERSION` | `2.1.96` | billing header 版本号 |
| `PI_CLAUDE_CODE_ENTRYPOINT` | `pi` | billing header 入口点 |

---

## 六、自我保护属性

1. **可选 debug 日志** — `PI_CLAUDE_OAUTH_LOG_FILE` 开启，JSONL 格式，创建目录 `mkdir recursive`，写入失败 catch 静默吞掉
2. **幂等注入** — `user-reminder` 模式检查 `startsWith("<system-reminder>")`
3. **活跃状态保护** — `active` → `issue` 降级后只有 session 重启才能恢复
4. **fallback 完整链** — 三层：system prompt 提取 → 环境变量文件 → 动态路径构造
5. **无副作用默认** — 不配任何环境变量也能正常工作

---

## 七、如果要自己重写

核心就三件事，每个都很独立：

1. **Billing header 生成** (~30 行) — SHA256 + 采样 + 拼接
2. **System prompt 净化** (~50 行) — 正则匹配 + 字符串操作
3. **Docs 剥离/注入** (~100 行) — marker 定位 + 多模式注入

总代码量不到 200 行核心逻辑，依赖只有 Node.js 内置模块。零外部依赖。
