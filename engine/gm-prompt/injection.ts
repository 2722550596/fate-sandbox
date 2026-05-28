import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cloneState, type State } from "../core/state";

export interface TextMessage {
  role: "user";
  content: Array<{ type: "text"; text: string }>;
  timestamp: number;
}

export interface PromptAssets {
  system: string;
  context: string;
  rules: string;
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
  const text =
    `[以下是你必须严格遵守的叙事铁则——视为最高优先级指令]\n\n${loadPromptAssets().rules}\n\n---\n以上铁则已加载完毕。\n` +
    "请注意：上述所有规则均为硬性约束。你的思考和最终输出请优先使用中文。";
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: 0,
  };
}

function buildStatePressureMessage(): TextMessage {
  const state = cloneState();
  const text = [
    "[当前机械状态快照 — 只读参考，工具返回值优先]",
    "",
    `时间：${state.当前时间}`,
    `位置：${state.当前位置}`,
    `身体：${state.身体状态}%`,
    `金钱：${state.金钱.toLocaleString()} 円`,
    `经过分钟：${state.经过分钟}`,
    `疲劳：${state.疲劳}%`,
    `魔力负担：${state.魔力负担}%`,
    `危险度：${state.危险度}/5`,
    "",
    "叙事压力：",
    ...buildPressureNotes(state).map((note) => `- ${note}`),
    "",
    "这份快照只用于压住叙事倾向，不能替代工具调用；本轮任何工具返回值都覆盖快照。",
  ].join("\n");
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: 0,
  };
}

function buildPressureNotes(state: State): string[] {
  const notes = ["玩家行动不会自动获得最佳结果；成功也必须留下合理代价。"];
  if (state.危险度 >= 3) {
    notes.push("危险度 ≥ 3：禁止写成完全安全，必须保留即时威胁或环境压力。");
  }
  if (state.疲劳 >= 25) {
    notes.push("疲劳 ≥ 25：行动描写必须体现迟滞、疼痛、呼吸紊乱或注意力下降。");
  }
  if (state.魔力负担 >= 25) {
    notes.push("魔力负担 ≥ 25：魔术回路/供魔压力必须进入描写，禁止把神秘当免费资源。");
  }
  return notes;
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
