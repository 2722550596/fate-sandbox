import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import type { PublicGameState } from "../../engine/core/state/state.ts";

import { DynamicBorder, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, matchesKey, Text } from "@earendil-works/pi-tui";

import {
  buildInventoryMarkdown,
  buildStatusMarkdown,
} from "../../engine/core/state/public-projection.ts";
import { syncStateFromSessionManager } from "../../engine/core/state/session-persistence.ts";
import { getPublicState } from "../../engine/core/state/state-store.ts";
import {
  buildHooksMarkdown,
  buildJournalMarkdown,
  buildRecapMarkdown,
  buildRelationsMarkdown,
} from "./player-widgets.ts";

export default function playerPanelExtension(pi: ExtensionAPI): void {
  pi.registerCommand("status", {
    description: "Show player-visible LOTM narrative status without adding chat context",
    handler: async (_args, ctx) => {
      await showPanel(ctx, "LOTM 叙事状态", buildStatusMarkdown(readPublicState(ctx)));
    },
  });

  pi.registerCommand("inventory", {
    description: "Show player-visible money and inventory without adding chat context",
    handler: async (_args, ctx) => {
      await showPanel(ctx, "LOTM 物品与资金", buildInventoryMarkdown(readPublicState(ctx)));
    },
  });

  pi.registerCommand("relations", {
    description: "Show player-visible relationship map and recent signals",
    handler: async (_args, ctx) => {
      await showPanel(ctx, "Relations", buildRelationsMarkdown(readPublicState(ctx)));
    },
  });

  pi.registerCommand("hooks", {
    description: "Show player-visible mystery hook ledger",
    handler: async (_args, ctx) => {
      await showPanel(ctx, "Hook Ledger", buildHooksMarkdown(readPublicState(ctx)));
    },
  });

  pi.registerCommand("journal", {
    description: "Show event timeline and turn log",
    handler: async (_args, ctx) => {
      await showPanel(ctx, "Journal", buildJournalMarkdown(readPublicState(ctx)));
    },
  });

  pi.registerCommand("recap", {
    description: "Show story recap from campaign memory (player-safe)",
    handler: async (_args, ctx) => {
      await showPanel(ctx, "Recap", buildRecapMarkdown(readPublicState(ctx)));
    },
  });
}

function readPublicState(ctx: ExtensionContext): PublicGameState {
  syncStateFromSessionManager(ctx.sessionManager);
  return getPublicState();
}

async function showPanel(ctx: ExtensionContext, title: string, markdown: string): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify(markdown, "info");
    return;
  }

  await ctx.ui.custom<void>((_tui, theme, _keybindings, done) => {
    const container = new Container();
    const border = new DynamicBorder((text: string) => theme.fg("accent", text));
    const markdownTheme = getMarkdownTheme();

    container.addChild(border);
    container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
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
