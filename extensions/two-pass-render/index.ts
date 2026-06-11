import type {
  ExtensionAPI,
  ExtensionContext,
  MessageRenderer,
} from "@earendil-works/pi-coding-agent";

import type { RenderDirectionPacket } from "../../engine/direction/packet-schema.ts";

import { stream } from "@earendil-works/pi-ai";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Markdown } from "@earendil-works/pi-tui";

import { collectUnrevealedSecretStrings } from "../../engine/audit/lint-rules.ts";
import { syncStateFromSessionManager } from "../../engine/core/session-hydration.ts";
import { getState } from "../../engine/core/state-store.ts";
import {
  buildLintRetryMessages,
  buildRendererMessages,
  findPendingDirectionPacket,
  lintRenderedProse,
  type PendingDirectionPacket,
  PROSE_CUSTOM_TYPE,
  redactSecrets,
  type RendererMessage,
} from "../../engine/direction/render-turn.ts";
import { buildRendererSystemPrompt } from "../../engine/gm-prompt/injection.ts";

const RENDERER_MAX_TOKENS = 8192;
/** 伪流式预览 widget：只展示尾部若干行，避免长正文压满屏幕。 */
const RENDER_WIDGET_KEY = "fsn-render-preview";
const RENDER_WIDGET_TAIL_LINES = 12;
/** 等待 run 真正空闲的轮询间隔与上限（约 10s）。 */
const IDLE_POLL_INTERVAL_MS = 25;
const IDLE_POLL_MAX_ATTEMPTS = 400;

/**
 * 双 pass 第二段（Pass B）：结算循环以 submit_direction_packet 收尾后，
 * 在 agent_end 用洁净室 complete() 把 packet 渲染成玩家可见正文，
 * 以 fsn-prose custom message 落 session。结算投影的过滤在 extension.ts。
 *
 * 注意：agent_end 触发时 run 仍处于 streaming 态（finishRun 在监听器之后），
 * 此时 sendMessage 会被当成 steer 输入再唤醒结算器，形成自激振荡。
 * 所以发送必须延迟到 ctx.isIdle() 之后；另用 toolCallId 去重防双渲。
 */
export default function twoPassRenderExtension(pi: ExtensionAPI): void {
  pi.registerMessageRenderer(PROSE_CUSTOM_TYPE, renderProseMessage);

  const renderedToolCallIds = new Set<string>();

  pi.on("agent_end", async (event, ctx) => {
    const pending = readPendingPacket(event.messages, ctx);
    if (pending === undefined || renderedToolCallIds.has(pending.toolCallId)) {
      return;
    }
    renderedToolCallIds.add(pending.toolCallId);
    const { packet } = pending;
    if (!packet.needsRender) {
      sendProseWhenIdle(pi, ctx, packet.directReply, { kind: "direct-reply" });
      return;
    }
    syncStateFromSessionManager(ctx.sessionManager);
    const unrevealedSecrets = collectUnrevealedSecretStrings(getState().secrets);
    const prose = await renderProse(ctx, event.messages, packet, unrevealedSecrets);
    if (prose === undefined) {
      sendProseWhenIdle(pi, ctx, buildFallbackProse(packet), { kind: "render-fallback" });
      return;
    }
    sendProseWhenIdle(pi, ctx, prose.text, { kind: "rendered", lintRuleIds: prose.lintRuleIds });
  });
}

/**
 * 等 run 退出 streaming 态后再落 prose：此时 sendMessage 走「非 streaming +
 * 不触发」分支，只追加消息不开新轮。若玩家抢先开了新轮，则继续等到
 * 那轮结束，最多约 10s 后放弃并告警。
 */
function sendProseWhenIdle(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  text: string,
  details: Record<string, unknown>,
  attempt = 0,
): void {
  if (ctx.isIdle()) {
    sendProse(pi, text, details);
    clearRenderWidget(ctx);
    return;
  }
  if (attempt >= IDLE_POLL_MAX_ATTEMPTS) {
    clearRenderWidget(ctx);
    notify(ctx, "two-pass render: agent never went idle, dropping prose delivery", "error");
    return;
  }
  setTimeout(() => {
    sendProseWhenIdle(pi, ctx, text, details, attempt + 1);
  }, IDLE_POLL_INTERVAL_MS);
}

interface RenderedProse {
  text: string;
  lintRuleIds: string[];
}

async function renderProse(
  ctx: ExtensionContext,
  loopMessages: ReadonlyArray<unknown>,
  packet: RenderDirectionPacket,
  unrevealedSecrets: readonly string[],
): Promise<RenderedProse | undefined> {
  const model = resolveRendererModel(ctx);
  if (model === undefined) {
    notify(ctx, "two-pass render: no active model, falling back to packet digest", "warning");
    return undefined;
  }
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok || auth.apiKey === undefined) {
    notify(
      ctx,
      "two-pass render: model auth unavailable, falling back to packet digest",
      "warning",
    );
    return undefined;
  }

  const systemPrompt = buildRendererSystemPrompt();
  const baseMessages = buildRendererMessages(loopMessages, packet);

  try {
    setWorking(ctx, "渲染本轮正文…");
    const first = await streamProse(ctx, model, auth, systemPrompt, baseMessages, "渲染中");
    const firstReport = lintRenderedProse(first, unrevealedSecrets);
    if (firstReport.findings.length === 0) {
      return { text: first, lintRuleIds: [] };
    }

    // 一次重试：把首次产出与违规清单回喂渲染器重写全文。
    setWorking(ctx, "文风返工重写中…");
    const second = await streamProse(
      ctx,
      model,
      auth,
      systemPrompt,
      buildLintRetryMessages(baseMessages, first, firstReport.findings),
      "重写中",
    );
    const secondReport = lintRenderedProse(second, unrevealedSecrets);
    const lintRuleIds = secondReport.findings.map((finding) => finding.ruleId);
    if (secondReport.leaks.length > 0) {
      notify(ctx, "two-pass render: secret leak persisted after retry, redacted", "error");
      return { text: redactSecrets(second, unrevealedSecrets), lintRuleIds };
    }
    if (lintRuleIds.length > 0) {
      notify(ctx, `two-pass render: style findings remain (${lintRuleIds.join(", ")})`, "warning");
    }
    return { text: second, lintRuleIds };
  } catch (error) {
    notify(ctx, `two-pass render failed (${formatError(error)}), falling back`, "warning");
    return undefined;
  } finally {
    setWorking(ctx, undefined);
  }
}

/**
 * 伪流式渲染：逐 token 把正文尾部画进编辑器上方的 widget，让玩家看到
 * 正文在生长；最终文本仍走 lint 门禁后以 fsn-prose 消息落地。
 * widget 在 prose 送达时清除（sendProse），失败路径在这里自清。
 */
async function streamProse(
  ctx: ExtensionContext,
  model: NonNullable<ExtensionContext["model"]>,
  auth: { apiKey?: string; headers?: Record<string, string> },
  systemPrompt: string,
  rendererMessages: readonly RendererMessage[],
  label: string,
): Promise<string> {
  const events = stream(
    model,
    {
      systemPrompt,
      messages: rendererMessages.map((message) => toStreamMessage(message, model)),
    },
    { apiKey: auth.apiKey, headers: auth.headers, maxTokens: RENDERER_MAX_TOKENS },
  );
  let draft = "";
  try {
    for await (const event of events) {
      if (event.type === "text_delta") {
        draft += event.delta;
        updateRenderWidget(ctx, label, draft);
      } else if (event.type === "error") {
        throw new Error(event.error.errorMessage ?? "renderer stream failed");
      }
    }
  } catch (error) {
    clearRenderWidget(ctx);
    throw error instanceof Error ? error : new Error(String(error));
  }
  const text = draft.trim();
  if (text === "") {
    clearRenderWidget(ctx);
    throw new Error("renderer returned empty prose");
  }
  return text;
}

type StreamMessage = Parameters<typeof stream>[1]["messages"][number];

/** RendererMessage → pi-ai 消息；assistant 位需要补齐元数据字段（历史正文伪装成模型旧产出）。 */
function toStreamMessage(
  message: RendererMessage,
  model: NonNullable<ExtensionContext["model"]>,
): StreamMessage {
  if (message.role === "user") {
    return { role: "user", content: [{ type: "text", text: message.text }], timestamp: 0 };
  }
  return {
    role: "assistant",
    content: [{ type: "text", text: message.text }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: 0,
  };
}

function updateRenderWidget(ctx: ExtensionContext, label: string, draft: string): void {
  if (!ctx.hasUI) {
    return;
  }
  const lines = draft.split("\n");
  const tail = lines.slice(-RENDER_WIDGET_TAIL_LINES);
  ctx.ui.setWidget(RENDER_WIDGET_KEY, [`── ${label} ──`, ...tail]);
}

function clearRenderWidget(ctx: ExtensionContext): void {
  if (ctx.hasUI) {
    ctx.ui.setWidget(RENDER_WIDGET_KEY, undefined);
  }
}

/**
 * 渲染轮可以跑在与结算轮不同的模型上：`FATE_RENDER_MODEL=provider/model-id`。
 * 未设置或找不到时回退到结算轮的当前模型。
 */
function resolveRendererModel(ctx: ExtensionContext): ExtensionContext["model"] {
  const override = process.env["FATE_RENDER_MODEL"]?.trim();
  if (override === undefined || override === "") {
    return ctx.model;
  }
  const slash = override.indexOf("/");
  if (slash <= 0 || slash === override.length - 1) {
    notify(ctx, `FATE_RENDER_MODEL 格式应为 provider/model-id，得到：${override}`, "warning");
    return ctx.model;
  }
  const model = ctx.modelRegistry.find(override.slice(0, slash), override.slice(slash + 1));
  if (model === undefined) {
    notify(ctx, `FATE_RENDER_MODEL 未命中任何已注册模型：${override}，回退结算模型`, "warning");
    return ctx.model;
  }
  return model;
}

function setWorking(ctx: ExtensionContext, message: string | undefined): void {
  if (ctx.hasUI) {
    ctx.ui.setWorkingMessage(message);
  }
}

function readPendingPacket(
  messages: ReadonlyArray<unknown>,
  ctx: ExtensionContext,
): PendingDirectionPacket | undefined {
  try {
    return findPendingDirectionPacket(messages);
  } catch (error) {
    // packet 已过工具层验证，这里失败属于异常路径：通知并放弃渲染。
    notify(ctx, `two-pass render: invalid packet (${formatError(error)})`, "error");
    return undefined;
  }
}

/** 渲染不可用时的兜底：binding 事实以平文列出，保证玩家至少看到结算结果。 */
function buildFallbackProse(packet: RenderDirectionPacket): string {
  return [
    "（渲染器暂不可用，以下为本轮结算摘要）",
    "",
    ...packet.resolvedChanges.map((entry) => `- ${entry}`),
    "",
    `> ${packet.endWindow}`,
  ].join("\n");
}

function sendProse(pi: ExtensionAPI, text: string, details: Record<string, unknown>): void {
  pi.sendMessage(
    { customType: PROSE_CUSTOM_TYPE, content: text, display: true, details },
    { triggerTurn: false },
  );
}

const renderProseMessage: MessageRenderer = (message) => {
  const text = typeof message.content === "string" ? message.content : joinText(message.content);
  return new Markdown(text, 1, 0, getMarkdownTheme());
};

function joinText(content: ReadonlyArray<{ type: string }>): string {
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        part.type === "text" && "text" in part && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

function notify(ctx: ExtensionContext, message: string, level: "info" | "warning" | "error"): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
