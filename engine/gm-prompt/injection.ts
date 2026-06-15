import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatPresenceImpressionCards } from "../core/actor-impression.ts";
import { buildGmBrief } from "../core/public-projection.ts";
import { getPublicState, getState } from "../core/state-store.ts";
import { isRecord } from "../core/typebox-validation.ts";
import {
  loadPromptPreset,
  type PromptPass,
  type PromptPreset,
  type PromptPresetModule,
  type PromptSlot,
} from "./preset.ts";

export interface TextMessage {
  role: "user";
  content: Array<{ type: "text"; text: string }>;
  timestamp: number;
}

function loadPassPreset(pass: PromptPass): PromptPreset {
  return loadPromptPreset(PROJECT_ROOT, pass);
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

export function buildSystemPrompt(baseSystemPrompt: string): string {
  return (
    baseSystemPrompt + "\n" + readFileSync(join(PROJECT_ROOT, "agents", "system-settlement.md"), "utf-8")
  );
}

/** 结算器（Pass A）主循环注入：只装 settlement/both 模块，零 style/render 模块。 */
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

/**
 * 渲染器（Pass B）洁净室 system prompt：gm-render-system（角色 + packet 契约）
 * + 全部 render/both 模块，按 slot 顺序与 priority 拼接。零工具 schema、零机械规则。
 */
export function buildRendererSystemPrompt(): string {
  const sections = [readPromptFile("agents/system-render.md").trim()];
  for (const slot of ["pre-history", "pre-response", "final-contract"] as const) {
    for (const module of promptModulesForSlot(slot, "render")) {
      sections.push(`<${module.header}>\n${module.body.trim()}\n</${module.header}>`);
    }
  }
  return sections.join("\n\n");
}

function buildPromptModules(pass: PromptPass): PromptModule[] {
  return loadPassPreset(pass)
    .modules.filter((module) => module.enabled)
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
  if (module.source.name === "presence-impressions") {
    return buildPresenceImpressionsText();
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
  return promptModulesForSlot(slot, "settlement").map(buildPromptModuleMessage);
}

function promptModulesForSlot(slot: PromptSlot, pass: PromptPass): PromptModule[] {
  return buildPromptModules(pass)
    .filter((module) => module.slot === slot)
    .toSorted(comparePromptModules);
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

function buildPresenceImpressionsText(): string {
  try {
    const state = getState();
    const text = formatPresenceImpressionCards(state);
    if (text === null) {
      return "当前场景没有在场 NPC 印象卡。重要 NPC 入场后用 update_actor_impression 建立印象卡。";
    }
    return [
      "当前在场 NPC 印象卡（由 presence 自动路由）：",
      "",
      text,
      "",
      "NPC 台词、行动、情绪必须与印象卡一致。重大变化后用 update_actor_impression 更新。",
    ].join("\n");
  } catch {
    return "印象卡注入失败；可能尚未初始化状态。";
  }
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
