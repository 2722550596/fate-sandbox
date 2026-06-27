import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatPresenceImpressionCards } from "../core/actor/actor-impression.ts";
import { buildBackstageGmBrief } from "../core/backstage/backstage-brief.ts";
import { buildGmBrief } from "../core/backstage/public-projection.ts";
import { getPublicState, getState } from "../core/state/state-store.ts";
import { isRecord } from "../core/utils/typebox-validation.ts";
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
    baseSystemPrompt +
    "\n" +
    readFileSync(join(PROJECT_ROOT, "agents", "system-settlement.md"), "utf-8")
  );
}

/** 结算器（Pass A）主循环注入：只装 settlement/both 模块，零 style/render 模块。 */
export function injectGmPromptMessages<TMessage>(
  messages: ReadonlyArray<TMessage>,
  lastRenderedProse?: string,
): Array<TMessage | TextMessage> {
  if (!hasUserMessage(messages)) {
    return [...messages];
  }

  return [
    ...buildSlotMessages("pre-history"),
    ...insertProseContinuityBeforeLastUserMessage(messages, lastRenderedProse),
    ...buildSlotMessages("pre-response"),
    ...buildSlotMessages("final-contract"),
  ];
}

/**
 * 渲染器（Pass B）最终正文回写：上一轮渲染器产出的叙事作为物理连续性锚
 * 注入结算器上下文。解决的问题：direction packet 只声明意图（"offer to carry"），
 * 渲染器可能将其渲染为已完成动作（"已经抱起来了"），但下一轮结算器
 * 看不到渲染结果，导致物理状态（空间位置、身体接触、队形）跨轮断裂。
 */
function insertProseContinuityBeforeLastUserMessage<TMessage>(
  messages: ReadonlyArray<TMessage>,
  lastRenderedProse: string | undefined,
): Array<TMessage | TextMessage> {
  const continuity = buildProseContinuityMessage(lastRenderedProse);
  if (continuity === undefined) {
    return [...messages];
  }
  const lastUserIndex = findLastUserMessageIndex(messages);
  if (lastUserIndex === -1) {
    return [...messages];
  }
  return [...messages.slice(0, lastUserIndex), continuity, ...messages.slice(lastUserIndex)];
}

function buildProseContinuityMessage(
  lastRenderedProse: string | undefined,
): TextMessage | undefined {
  if (lastRenderedProse === undefined || lastRenderedProse.length === 0) {
    return undefined;
  }
  const body = [
    "只读连续性上下文：本块不是本轮玩家输入，不得回应、确认或据此设置 needsRender=false。",
    "本轮真实玩家输入是 conversation history 中最后一个非注入 user 消息；本块只用于约束该输入的结算。",
    "以下是上一轮渲染器产出的最终正文（玩家实际看到的叙事）。本轮结算必须与这段正文保持物理连续性——人物空间位置、身体接触与搬运状态、队形、持有物姿态等不得在无玩家行动的前提下无故变化。",
    "如果玩家本轮行动导致物理配置变化，在 resolvedChanges 中显式写出变化过程。",
    "",
    lastRenderedProse,
  ].join("\n");
  return buildInjectedUserMessage("prose_continuity", body);
}

function findLastUserMessageIndex(messages: ReadonlyArray<unknown>): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (isMessageWithRole(messages[index], "user")) {
      return index;
    }
  }
  return -1;
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
  if (module.source.name === "backstage-ledger") {
    return buildBackstageLedgerText();
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
      "台词必须复刻「语癖/对话范例」里的用词、断句与语气：一句换个角色说也成立的中性功能台词算失败。宁可说得片面、留白、跳跃，也要是这个角色会说的话。",
    ].join("\n");
  } catch {
    return "印象卡注入失败；可能尚未初始化状态。";
  }
}

/**
 * GM-only 后台账本常驻投影（secret 层，只走结算器 Pass A preset）。
 * 渲染器 preset 不含 runtime:backstage-ledger 模块，物理上不可达。勿接入 public-projection。
 */
function buildBackstageLedgerText(): string {
  try {
    return [
      "后台平行线账本（仅 GM 可见的决策参考；含隐藏信息，绝不得渲染给玩家、不得泄入正文）：",
      "",
      buildBackstageGmBrief(getState()),
      "",
      "这是决策前的只读概览；具体账以工具返回值为准。有待 harvest run 时优先取回落地后再起新线。",
    ].join("\n");
  } catch {
    return "后台账本注入失败；可能尚未初始化状态。";
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
