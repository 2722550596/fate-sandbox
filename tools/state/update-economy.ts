import type { EconomyEvent } from "../../engine/core/economy";
import type { ToolResult } from "../runtime/tool-result";

import { updateEconomy } from "../../engine/core/economy";
import { parseEconomyEvent } from "../../engine/core/economy-schema";
import { getPublicState } from "../../engine/core/state";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";

export function updateEconomyTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => {
      const event = parseEconomyEvent(params, "update_economy 参数");
      assertExistingPurseIdIfPresent(event);
      return updateEconomy(event);
    },
    details: resultDetails,
    message: (result) => result.message,
  });
}

/** purseId 是否存在依赖当前 Game State，schema 管不了；保留领域校验与 get_status 指引。 */
function assertExistingPurseIdIfPresent(event: EconomyEvent): void {
  if (!("purseId" in event) || event.purseId === undefined) {
    return;
  }
  const purseId = event.purseId;
  const exists = getPublicState().economy.accessibleFunds.some((purse) => purse.id === purseId);
  if (!exists) {
    throw new Error(
      `资金账户不存在: ${purseId}。请先调用 get_status 查看可用 purseId；当前可用: ${formatPurseIds()}。`,
    );
  }
}

function formatPurseIds(): string {
  const purseIds = getPublicState().economy.accessibleFunds.map((purse) => purse.id);
  return purseIds.length === 0 ? "无" : purseIds.join(", ");
}
