import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildGmBrief } from "../core/gm-brief";
import { getPublicState } from "../core/state";

export interface TextMessage {
  role: "user";
  content: Array<{ type: "text"; text: string }>;
  timestamp: number;
}

export interface PromptAssets {
  system: string;
  context: string;
  rules: string;
  think: string;
  style: string;
  render: string;
}

interface UserProfile {
  text: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedAssets: PromptAssets | null = null;
let cachedUserProfile: UserProfile | null = null;

export function loadPromptAssets(): PromptAssets {
  if (cachedAssets === null) {
    cachedAssets = {
      system: readFileSync(join(__dirname, "..", "..", "agents", "gm-system.md"), "utf-8"),
      context: readFileSync(join(__dirname, "..", "..", "agents", "gm-context.md"), "utf-8"),
      rules: readFileSync(join(__dirname, "..", "..", "agents", "gm-rules.md"), "utf-8"),
      think: readFileSync(join(__dirname, "..", "..", "agents", "gm-think.md"), "utf-8"),
      style: readFileSync(join(__dirname, "..", "..", "agents", "gm-style.md"), "utf-8"),
      render: readFileSync(join(__dirname, "..", "..", "agents", "gm-render.md"), "utf-8"),
    };
  }
  return cachedAssets;
}

export function buildSystemPrompt(baseSystemPrompt: string): string {
  return baseSystemPrompt + "\n" + loadPromptAssets().system;
}

export function injectGmPromptMessages<TMessage>(
  messages: ReadonlyArray<TMessage>,
): Array<TMessage | TextMessage> {
  const lastUserIndex = findLastUserMessageIndex(messages);
  if (lastUserIndex === -1) {
    return [...messages];
  }

  const lastUserMessage = messages[lastUserIndex];
  if (lastUserMessage === undefined) {
    return [...messages];
  }

  return [
    ...messages.slice(0, lastUserIndex),
    buildContextMessage(),
    lastUserMessage,
    buildStatePressureMessage(),
    buildRulesMessage(),
    buildThinkMessage(),
    buildStyleMessage(),
    buildRenderMessage(),
    ...messages.slice(lastUserIndex + 1),
  ];
}

function findLastUserMessageIndex(messages: ReadonlyArray<unknown>): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (isMessageWithRole(messages[index], "user")) {
      return index;
    }
  }
  return -1;
}

function buildContextMessage(): TextMessage {
  const assets = loadPromptAssets();
  const userProfile = loadUserProfile().text;
  let text = "[以下为世界观与参考信息]\n\n" + assets.context;
  if (userProfile.length > 0) {
    text += "\n\n---\n\n## 玩家角色档案\n\n" + userProfile;
  }
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: 0,
  };
}

function buildRulesMessage(): TextMessage {
  return buildInjectedUserMessage(
    "[硬规则模块 — 最高优先级，决定世界与机械边界]",
    loadPromptAssets().rules,
  );
}

function buildThinkMessage(): TextMessage {
  return buildInjectedUserMessage(
    "[内部检查模块 — 只用于自检，禁止写进最终回复]",
    loadPromptAssets().think,
  );
}

function buildStyleMessage(): TextMessage {
  return buildInjectedUserMessage(
    "[最终叙事风格模块 — 在不违反硬规则的前提下，按此模块组织正文]",
    loadPromptAssets().style,
  );
}

function buildRenderMessage(): TextMessage {
  return buildInjectedUserMessage(
    "[最终叙事渲染协议 — 输出前最后执行，禁止写成报告或句法八股]",
    loadPromptAssets().render,
  );
}

function buildInjectedUserMessage(header: string, body: string): TextMessage {
  return {
    role: "user",
    content: [{ type: "text", text: `${header}\n\n${body}` }],
    timestamp: 0,
  };
}

function buildStatePressureMessage(): TextMessage {
  const text = [
    "[当前机械状态简报 — 由 public state 派生，只读参考，工具返回值优先]",
    "",
    buildGmBrief(getPublicState()),
    "",
    "这份简报只用于压住叙事倾向，不能替代工具调用；本轮任何工具返回值都覆盖简报。",
  ].join("\n");
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: 0,
  };
}

function loadUserProfile(): UserProfile {
  if (cachedUserProfile === null) {
    cachedUserProfile = readUserProfile();
  }
  return cachedUserProfile;
}

function readUserProfile(): UserProfile {
  const path = join(__dirname, "..", "..", "data", "user.json");
  const raw = readFileSync(path, "utf-8");
  const parsed = parseJsonObject(raw, path);
  const name = parsed["姓名"];
  if (typeof name === "string" && name.length > 0) {
    return { text: JSON.stringify(parsed, null, 2) };
  }
  return { text: "" };
}

function parseJsonObject(raw: string, path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error(`Invalid JSON data ${path}: root must be an object.`);
  }
  return parsed;
}

function isMessageWithRole(message: unknown, role: string): boolean {
  if (!isRecord(message)) {
    return false;
  }
  return message["role"] === role;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
