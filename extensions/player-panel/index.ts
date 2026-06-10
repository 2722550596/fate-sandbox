import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import type { PublicGameState } from "../../engine/core/state";

import { DynamicBorder, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, matchesKey, Text } from "@earendil-works/pi-tui";

import { buildInventoryMarkdown, buildStatusMarkdown } from "../../engine/core/public-projection";
import { syncStateFromSessionManager } from "../../engine/core/session-hydration";
import { getPublicState } from "../../engine/core/state-store";

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
