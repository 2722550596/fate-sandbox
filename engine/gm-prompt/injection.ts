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
  outputContract: string;
}

interface UserProfile {
  text: string;
}

type PromptSlot = "pre-history" | "post-last-user" | "final-contract";

interface PromptModule {
  id: string;
  slot: PromptSlot;
  priority: number;
  header: string;
  body: string;
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
      outputContract: readFileSync(
        join(__dirname, "..", "..", "agents", "gm-output-contract.md"),
        "utf-8",
      ),
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
    ...buildSlotMessages("pre-history"),
    ...messages.slice(0, lastUserIndex),
    lastUserMessage,
    ...buildSlotMessages("post-last-user"),
    ...messages.slice(lastUserIndex + 1),
    ...buildSlotMessages("final-contract"),
  ];
}

function buildPromptModules(): PromptModule[] {
  const assets = loadPromptAssets();
  const modules: PromptModule[] = [
    {
      id: "world-context",
      slot: "pre-history",
      priority: 10,
      header: "world_context",
      body: assets.context,
    },
    {
      id: "player-character",
      slot: "pre-history",
      priority: 20,
      header: "player_character",
      body: loadUserProfile().text,
    },
    {
      id: "writing-guide",
      slot: "pre-history",
      priority: 30,
      header: "writing_guide",
      body: assets.style,
    },
    {
      id: "render-protocol",
      slot: "pre-history",
      priority: 40,
      header: "render_protocol",
      body: assets.render,
    },
    {
      id: "mechanical-state",
      slot: "post-last-user",
      priority: 10,
      header: "mechanical_state",
      body: buildStatePressureText(),
    },
    {
      id: "hard-rules",
      slot: "post-last-user",
      priority: 20,
      header: "hard_rules",
      body: assets.rules,
    },
    {
      id: "story-driver",
      slot: "post-last-user",
      priority: 30,
      header: "story_driver",
      body: assets.think,
    },
    {
      id: "output-contract",
      slot: "final-contract",
      priority: 10,
      header: "output_contract",
      body: assets.outputContract,
    },
  ];
  return modules.filter((module) => module.body.length > 0);
}

function buildSlotMessages(slot: PromptSlot): TextMessage[] {
  return buildPromptModules()
    .filter((module) => module.slot === slot)
    .toSorted(comparePromptModules)
    .map(buildPromptModuleMessage);
}

function comparePromptModules(left: PromptModule, right: PromptModule): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }
  return left.id.localeCompare(right.id);
}

function buildPromptModuleMessage(module: PromptModule): TextMessage {
  return buildInjectedUserMessage(module.header, module.body);
}

function findLastUserMessageIndex(messages: ReadonlyArray<unknown>): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (isMessageWithRole(messages[index], "user")) {
      return index;
    }
  }
  return -1;
}

function buildInjectedUserMessage(header: string, body: string): TextMessage {
  return {
    role: "user",
    content: [{ type: "text", text: `<${header}>\n${body}\n</${header}>` }],
    timestamp: 0,
  };
}

function buildStatePressureText(): string {
  return [
    "当前机械状态简报由 public state 派生，只读参考，工具返回值优先。",
    "",
    buildGmBrief(getPublicState()),
    "",
    "这份简报只用于压住叙事倾向，不能替代工具调用；本轮任何工具返回值都覆盖简报。",
  ].join("\n");
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
  if (typeof name !== "string" || name.length === 0) {
    return { text: "" };
  }
  return { text: renderUserProfile(parsed) };
}

function renderUserProfile(profile: Record<string, unknown>): string {
  const lines = [
    renderProfileLine("姓名", profile["姓名"]),
    renderProfileLine("性别", profile["性别"]),
    renderProfileLine("年龄", profile["年龄"]),
    renderProfileLine("外貌", profile["外貌"]),
    renderProfileLine("身世背景", profile["身世背景"]),
    renderProfileLine("魔术回路", profile["魔术回路"]),
    renderProfileLine("特殊能力", profile["特殊能力"]),
    renderProfileLine("性格", profile["性格"]),
    renderProfileLine("目标", profile["目标"]),
    renderProfileLine("额外注记", profile["额外注记"]),
  ];
  return lines.filter((line) => line.length > 0).join("\n");
}

function renderProfileLine(label: string, value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? `${label}: ${trimmed}` : "";
  }
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .map(([key, nested]) => renderInlineValue(key, nested))
      .filter((entry) => entry.length > 0);
    return entries.length > 0 ? `${label}: ${entries.join("；")}` : "";
  }
  return "";
}

function renderInlineValue(label: string, value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? `${label}=${trimmed}` : "";
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
