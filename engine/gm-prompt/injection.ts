import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildGmBrief } from "../core/gm-brief";
import { getPublicState } from "../core/state-store";
import { isRecord } from "../core/typebox-validation";
import {
  loadPromptPreset,
  type PromptPreset,
  type PromptPresetModule,
  type PromptSlot,
} from "./preset";

export interface TextMessage {
  role: "user";
  content: Array<{ type: "text"; text: string }>;
  timestamp: number;
}

export interface PromptAssets {
  system: string;
  preset: PromptPreset;
}

interface PromptModule {
  id: string;
  slot: PromptSlot;
  priority: number;
  header: string;
  body: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");

export function loadPromptAssets(): PromptAssets {
  return {
    system: readFileSync(join(PROJECT_ROOT, "agents", "gm-system.md"), "utf-8"),
    preset: loadPromptPreset(PROJECT_ROOT),
  };
}

export function buildSystemPrompt(baseSystemPrompt: string): string {
  return baseSystemPrompt + "\n" + loadPromptAssets().system;
}

export function injectGmPromptMessages<TMessage>(
  messages: ReadonlyArray<TMessage>,
): Array<TMessage | TextMessage> {
  if (!hasUserMessage(messages)) {
    return [...messages];
  }

  return [
    ...buildSlotMessages("pre-history"),
    ...messages,
    ...buildSlotMessages("pre-response"),
    ...buildSlotMessages("final-contract"),
  ];
}

function buildPromptModules(): PromptModule[] {
  return loadPromptAssets()
    .preset.modules.filter((module) => module.enabled)
    .map(resolvePromptModule)
    .filter((module) => module.body.length > 0);
}

function resolvePromptModule(module: PromptPresetModule): PromptModule {
  return {
    id: module.id,
    slot: module.slot,
    priority: module.priority,
    header: module.header,
    body: resolvePromptModuleBody(module),
  };
}

function resolvePromptModuleBody(module: PromptPresetModule): string {
  if (module.source.kind === "file") {
    return readPromptFile(module.source.path);
  }
  return buildStatePressureText();
}

function readPromptFile(path: string): string {
  return readFileSync(resolvePromptFilePath(path), "utf-8");
}

function resolvePromptFilePath(path: string): string {
  const userPath = path.replace(/^agents\//u, "agents/user/");
  const absoluteUserPath = join(PROJECT_ROOT, userPath);
  if (userPath !== path && existsSync(absoluteUserPath)) {
    return absoluteUserPath;
  }
  return join(PROJECT_ROOT, path);
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

function hasUserMessage(messages: ReadonlyArray<unknown>): boolean {
  return messages.some((message) => isMessageWithRole(message, "user"));
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

function isMessageWithRole(message: unknown, role: string): boolean {
  if (!isRecord(message)) {
    return false;
  }
  return message["role"] === role;
}
