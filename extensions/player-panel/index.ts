import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { DynamicBorder, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, matchesKey, Text } from "@earendil-works/pi-tui";

import { syncStateFromSessionManager } from "../../engine/core/session-hydration";
import { getPublicState, type PublicGameState } from "../../engine/core/state";

export default function playerPanelExtension(pi: ExtensionAPI): void {
  pi.registerCommand("status", {
    description: "Show player-visible Fate sandbox status without adding chat context",
    handler: async (_args, ctx) => {
      await showPanel(ctx, buildStatusMarkdown(readPublicState(ctx)));
    },
  });

  pi.registerCommand("inventory", {
    description: "Show player-visible money and inventory without adding chat context",
    handler: async (_args, ctx) => {
      await showPanel(ctx, buildInventoryMarkdown(readPublicState(ctx)));
    },
  });
}

function readPublicState(ctx: ExtensionContext): PublicGameState {
  syncStateFromSessionManager(ctx.sessionManager);
  return getPublicState();
}

async function showPanel(ctx: ExtensionContext, markdown: string): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify(markdown, "info");
    return;
  }

  await ctx.ui.custom<void>((_tui, theme, _keybindings, done) => {
    const container = new Container();
    const border = new DynamicBorder((text: string) => theme.fg("accent", text));
    const markdownTheme = getMarkdownTheme();

    container.addChild(border);
    container.addChild(new Text(theme.fg("accent", theme.bold("Fate Sandbox Status")), 1, 0));
    container.addChild(new Markdown(markdown, 1, 1, markdownTheme));
    container.addChild(new Text(theme.fg("dim", "Press Enter or Esc to close"), 1, 0));
    container.addChild(border);

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (matchesKey(data, "enter") || matchesKey(data, "escape")) {
          done(undefined);
        }
      },
    };
  });
}

function buildStatusMarkdown(publicState: PublicGameState): string {
  return [
    "## 当前状态",
    "",
    `- 时间：${publicState.clock.currentAt}（${publicState.clock.timezone}）`,
    `- 地点：${formatLocation(publicState.scene.location)}`,
    `- 场景：${publicState.scene.situation}`,
    `- 在场：${formatPresentActors(publicState)}`,
    `- 目标：${formatObjectives(publicState)}`,
    `- 威胁：${formatThreats(publicState)}`,
    "",
    buildInventoryMarkdown(publicState),
  ].join("\n");
}

function buildInventoryMarkdown(publicState: PublicGameState): string {
  return [
    "## 资源与物品",
    "",
    "### 资金",
    "",
    formatFunds(publicState),
    "",
    "### 关键物品",
    "",
    formatTrackedItems(publicState),
    "",
    "### 普通随身物",
    "",
    formatOrdinaryItems(publicState),
  ].join("\n");
}

function formatLocation(location: PublicGameState["scene"]["location"]): string {
  return [location.region, location.site, location.detail]
    .filter((part) => part.length > 0)
    .join(" · ");
}

function formatPresentActors(publicState: PublicGameState): string {
  const names = publicState.scene.presentActorIds.map((actorId) => actorName(publicState, actorId));
  return names.length === 0 ? "无" : names.join("、");
}

function formatObjectives(publicState: PublicGameState): string {
  const objectives = publicState.scene.objectives.filter(
    (objective) => objective.status !== "resolved",
  );
  return objectives.length === 0
    ? "无"
    : objectives.map((objective) => `${objective.id}: ${objective.summary}`).join("；");
}

function formatThreats(publicState: PublicGameState): string {
  return publicState.scene.threats.length === 0
    ? "无"
    : publicState.scene.threats.map((threat) => `${threat.severity}: ${threat.summary}`).join("；");
}

function formatFunds(publicState: PublicGameState): string {
  if (publicState.economy.accessibleFunds.length === 0) {
    return "- 无可访问资金";
  }
  return publicState.economy.accessibleFunds
    .map(
      (purse) =>
        `- ${purse.label}：${purse.amount.toLocaleString()} ${publicState.economy.currency}`,
    )
    .join("\n");
}

function formatTrackedItems(publicState: PublicGameState): string {
  const items = Object.values(publicState.trackedItems)
    .filter((item) => item.visibility === "player-known")
    .toSorted((left, right) => left.label.localeCompare(right.label));
  if (items.length === 0) {
    return "- 无关键物品";
  }
  return items
    .map((item) => {
      const holder =
        item.holderActorId === null ? "未随身持有" : actorName(publicState, item.holderActorId);
      const notes = item.notes.length === 0 ? "" : `；${item.notes.join("；")}`;
      return `- ${item.label}（${holder}；${item.condition}${notes}）`;
    })
    .join("\n");
}

function formatOrdinaryItems(publicState: PublicGameState): string {
  const lines = Object.values(publicState.actors)
    .filter((actor) => actor.inventory.ordinaryItems.length > 0)
    .map(
      (actor) => `- ${actor.presentation.displayName}：${actor.inventory.ordinaryItems.join("、")}`,
    );
  return lines.length === 0 ? "- 无记录" : lines.join("\n");
}

function actorName(publicState: PublicGameState, actorId: string): string {
  return publicState.actors[actorId]?.presentation.displayName ?? actorId;
}
