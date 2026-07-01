# tool-pattern — 工具编写标准套路

## 何时使用

- 写新工具
- 修工具 bug
- 改工具参数
- 理解已有工具的实现模式

## 必须先读

- `engine/tools/registry.ts` — 全部 40 个工具的注册清单
- `engine/tools/system/domain-tool-runner.ts` — `runDomainEventTool` 核心
- `engine/tools/runtime/tool-definition.ts` — `DomainToolDefinition` 类型定义
- `engine/tools/runtime/tool-result.ts` — `ToolResult`, `textResult`

## 项目内已有的模式与模块

### 执行模式二选一

**模式 A：runDomainEventTool（有状态变异，95% 的工具使用此模式）**

```ts
runDomainEventTool({
  sessionManager, // 从 ctx.sessionManager 获取
  execute: (draft) => {
    // draft = cloneState()，原地变异
    const result = domainFn(draft, parsedParams);
    return result;
  },
  details: resultDetails, // 或自定义 details(result) => Record<string, unknown>
  message: (result) => result.message, // 返回给 LLM 的文本
});
```

**模式 B：直接计算（无状态副作用，仅 roll_dice）**

```ts
export function myTool(params: unknown): ToolResult {
  const { a, b } = parseMyParams(params);
  const result = compute(a, b);
  return textResult(`计算结果：${result}`, { a, b, result });
}
```

### 三层参数处理

| 层                      | 职责                          | 位置                                                                       |
| ----------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| Layer 1: TypeBox Schema | 参数结构声明（框架级校验）    | 每个 tool 文件的 `parameters` 字段                                         |
| Layer 2: Normalizer     | 参数归一化（字段互转/缺省值） | 同一 tool 文件中的独立函数，名为 `prepareXxxParams` 或 `normalizeXxxInput` |
| Layer 3: Domain Engine  | 严格解析 + 领域逻辑执行       | `core/` 下的纯函数（如 `parseActorRegistryInput`、`commitTurn`）           |

Normalizer 示例（`upsert-actor.ts:30-46`）：

- `init-npc`：接收 `id`，输出 `actorId`
- `upsert-public-npc`：接收 `actorId`，输出 `id`
- `setup-protagonist`：对 actor 对象做 stripUndefined + sequence 缺省

### 注册入口

```ts
// 在 engine/tools/registry.ts 中：
import { myToolDefinition } from "./<domain>/my-tool.ts";
const TOOL_DEFINITIONS = [ ..., myToolDefinition, ... ];
// 自动附加 label: "LOTM 叙事" 和 renderResult: renderDomainToolResult
```

## execute 回调签名

所有注册工具的 `execute` 签名必须对齐：

```ts
async (_toolCallId, params, _signal, _onUpdate, ctx) => myTool(params, ctx.sessionManager);
```

## persistStateAfterCommit 规则

- 使用 `runDomainEventTool` 时：**自动调用**，不需要自行处理
- 不使用 `runDomainEventTool` 时：必须自行 `commitState(draft)` → `persistStateAfterCommit(sessionManager, details)`
- `sessionManager` 必须正确传入（从 `ctx.sessionManager` 获取）
- `details` 必须是 `Record<string, unknown>`，会写入 `{ v, turn, state }` 结构

## description 编写规则

`description` 必须紧凑，包含：

1. **使用边界**：什么场景用这个工具
2. **禁区**：什么场景不要用这个工具
3. **examples**（可选）：复杂工具可带 1-2 行 JSON 示例

参考 `roll_dice`（简洁）和 `commit_turn`（详细）的平衡。

## 返回消息模式

| 模式               | 示例                                  | 说明                            |
| ------------------ | ------------------------------------- | ------------------------------- |
| 委托 domain result | `message: (result) => result.message` | domain engine 自带 message 字段 |
| execute 自定义     | `message: (msg) => msg`               | execute 返回 string             |
| 组合消息           | `message: ({ result, x }) => ...`     | execute 返回复合对象            |
| 纯工具内计算       | `textResult(...)`                     | 模式 B 直接构造                 |

## 验证命令

```bash
pnpm typecheck    # 编译检查（TypeBox 类型一致性）
pnpm test         # 运行所有测试（含 tool 集成测试）
```

## 禁止事项

- ❌ 不要绕过 `runDomainEventTool` 直接修改 state → 状态不会持久化
- ❌ 不要在工具函数中直接 throw 原始错误 → 使用有意义的错误信息（中文化）
- ❌ 不要在 `parameters` TypeBox schema 中使用 `unknown` 类型（除非 domain 侧有严格校验）
- ❌ 不要忘记在 `registry.ts` 注册 — 已定义但未注册的工具不会生效
- ❌ 不要使用 `any` — 所有类型必须显式
- ⚠️ `sessionManager` 从 `ctx.sessionManager` 获取，永远不要硬编码或从别处取
- ⚠️ `lookup/lookup.ts` 与 `lookup-rag.ts` 同名导出 `lookup` — 注意不要误 import

## 已知陷阱

1. **persistStateAfterCommit 遗漏**：如果工具直接调了 `cloneState` + `commitState` 但没调 `persistStateAfterCommit`，状态只写内存不写磁盘。重新加载后丢失。
2. **description 与 schema 不同步**：LLM 看到旧 description 会传错参数。改 schema 必须同步改 description。
3. **Layer 2 与 Layer 3 校验不同步**：TypeBox 通过了但 domain 侧的 `parseActorRegistryInput` 或 `assertOneOfString` 抛出，属于运行时错误。
4. **`roll_dice` 已定义但未注册**：在 `engine/tools/lotm/roll-dice.ts` 中有完整定义，但不在 `registry.ts` 的 `TOOL_DEFINITIONS` 数组中。
5. **backstage 有 4 个已定义未注册的工具**：`harvest_backstage_candidate`、`manage_faction_clock`、`resolve_backstage_line`、`run_parallel_line` — 后台导演功能尚未上线。
