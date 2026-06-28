import type {
  CustomMessageEntry,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";

import type { SuggestedAction } from "../../engine/direction/packet-schema.ts";

import { PROSE_CUSTOM_TYPE } from "../../engine/direction/render-turn.ts";

const CHOICE_WIDGET_KEY = "player-choices";

export type ChoiceCommand = { kind: "show" } | { index: number; kind: "submit" };

interface ChoiceSet {
  proseEntryId: string;
  actions: SuggestedAction[];
}

export default function playerChoicesExtension(pi: ExtensionAPI): void {
  pi.registerCommand("choice", {
    description: "Submit one suggested Fate narrative action as a real user message: /choice 1",
    handler: async (args, ctx) => {
      await handleChoiceCommand(pi, ctx, args);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    refreshChoiceWidget(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    refreshChoiceWidget(ctx);
  });

  // 新一轮开始（玩家提交行动）立即清掉上一轮的候选 widget。否则本轮结算期间
  // widget 仍显示上轮候选，而 branch 里已经出现更新的 message，/choice 的
  // findLatestChoiceSet 会因「最新 prose 之后还有 message」而返回 undefined，造成
  // 「widget 显示候选、选择却报错」的错位。本轮 prose 落地时会重新填上当轮候选。
  pi.on("turn_start", async (_event, ctx) => {
    clearChoiceWidget(ctx);
  });
}

export function setChoiceWidget(ctx: ExtensionContext, actions: readonly SuggestedAction[]): void {
  if (!ctx.hasUI) {
    return;
  }
  if (actions.length === 0) {
    ctx.ui.setWidget(CHOICE_WIDGET_KEY, undefined);
    return;
  }
  ctx.ui.setWidget(CHOICE_WIDGET_KEY, buildChoiceWidgetLines(actions));
}

export function clearChoiceWidget(ctx: ExtensionContext): void {
  if (ctx.hasUI) {
    ctx.ui.setWidget(CHOICE_WIDGET_KEY, undefined);
  }
}

export function buildChoiceWidgetLines(actions: readonly SuggestedAction[]): string[] {
  return [
    "── 可选行动（可忽略，直接手打也可以）──",
    ...actions.map((action, index) => `/choice ${index + 1}  ${action.submitText}`),
  ];
}

export function parseChoiceCommand(args: string): ChoiceCommand | undefined {
  const trimmed = args.trim();
  if (trimmed === "") {
    return { kind: "show" };
  }
  if (/^\d+$/u.test(trimmed)) {
    return { kind: "submit", index: Number(trimmed) - 1 };
  }
  return undefined;
}

async function handleChoiceCommand(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  args: string,
): Promise<void> {
  const command = parseChoiceCommand(args);
  if (command === undefined) {
    ctx.ui.notify("用法：/choice 1；也可以忽略候选，直接输入你的行动", "warning");
    return;
  }

  const choiceSet = findLatestChoiceSet(ctx.sessionManager.getBranch());
  if (choiceSet === undefined) {
    ctx.ui.notify("当前没有可用候选行动；直接输入你的行动即可", "warning");
    clearChoiceWidget(ctx);
    return;
  }
  if (command.kind === "show") {
    setChoiceWidget(ctx, choiceSet.actions);
    ctx.ui.notify(buildChoiceWidgetLines(choiceSet.actions).join("\n"), "info");
    return;
  }

  const action = choiceSet.actions[command.index];
  if (action === undefined) {
    ctx.ui.notify(`候选行动不存在：${command.index + 1}`, "warning");
    return;
  }
  sendUserChoice(pi, ctx, action.submitText);
}

function sendUserChoice(pi: ExtensionAPI, ctx: ExtensionCommandContext, text: string): void {
  clearChoiceWidget(ctx);
  if (ctx.isIdle()) {
    pi.sendUserMessage(text);
  } else {
    pi.sendUserMessage(text, { deliverAs: "followUp" });
    ctx.ui.notify("行动已排队为下一轮玩家输入", "info");
  }
}

function refreshChoiceWidget(ctx: ExtensionContext): void {
  const choiceSet = findLatestChoiceSet(ctx.sessionManager.getBranch());
  if (choiceSet === undefined) {
    clearChoiceWidget(ctx);
    return;
  }
  setChoiceWidget(ctx, choiceSet.actions);
}

export function findLatestChoiceSet(branch: readonly SessionEntry[]): ChoiceSet | undefined {
  const proseIndex = findLastProseIndex(branch);
  if (proseIndex === undefined) {
    return undefined;
  }
  const hasLaterMessage = branch.slice(proseIndex + 1).some((entry) => entry.type === "message");
  if (hasLaterMessage) {
    return undefined;
  }
  const entry = branch[proseIndex];
  if (entry === undefined || !isProseEntry(entry)) {
    return undefined;
  }
  const actions = readSuggestedActions(entry.details);
  return actions.length === 0 ? undefined : { proseEntryId: entry.id, actions };
}

function findLastProseIndex(branch: readonly SessionEntry[]): number | undefined {
  for (let index = branch.length - 1; index >= 0; index--) {
    const entry = branch[index];
    if (entry !== undefined && isProseEntry(entry)) {
      return index;
    }
  }
  return undefined;
}

function isProseEntry(entry: SessionEntry): entry is CustomMessageEntry {
  return entry.type === "custom_message" && entry.customType === PROSE_CUSTOM_TYPE;
}

function readSuggestedActions(details: unknown): SuggestedAction[] {
  if (!isRecord(details) || !Array.isArray(details["suggestedActions"])) {
    return [];
  }
  const out: SuggestedAction[] = [];
  for (const action of details["suggestedActions"]) {
    if (!isRecord(action)) {
      continue;
    }
    const submitText = action["submitText"];
    if (typeof submitText === "string") {
      out.push({ submitText });
    }
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
