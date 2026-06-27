import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import type { FateToolDefinition } from "./runtime/tool-definition.ts";

import { getStateSchemaToolDefinition } from "./debug/get-state-schema.ts";
import { migrateStateToolDefinition } from "./debug/migrate-state.ts";
import { overrideLockedFactToolDefinition } from "./debug/override-locked-fact.ts";
import { resetStateToolDefinition } from "./debug/reset-state.ts";
import { lookupToolDefinition } from "./lookup/lookup.ts";
import { renderDomainToolResult } from "./runtime/tool-render.ts";
import { commitTurnToolDefinition } from "./scene/commit-turn.ts";
import { configureCampaignToolDefinition } from "./system/configure-campaign.ts";
import { getStatusToolDefinition } from "./system/get-status.ts";
import { harvestBackstageCandidateToolDefinition } from "./backstage/harvest-backstage-candidate.ts";
import { initializeNewGameToolDefinition } from "./system/initialize-new-game.ts";
import { manageFactionClockToolDefinition } from "./backstage/manage-faction-clock.ts";
import { patchStateToolDefinition } from "./system/patch-state.ts";
import { privateResolveToolDefinition } from "./scene/private-resolve.ts";
import { progressSceneBeatToolDefinition } from "./scene/progress-scene-beat.ts";
import { recallMemoryToolDefinition } from "./memory/recall-memory.ts";
import { recordActorKnowledgeToolDefinition } from "./actor/record-actor-knowledge.ts";
import { recordMemoryToolDefinition } from "./memory/record-memory.ts";
import { recordOffscreenEventToolDefinition } from "./backstage/record-offscreen-event.ts";
import { recordRelationshipSignalToolDefinition } from "./relationship/record-relationship-signal.ts";
import { resolveBackstageLineToolDefinition } from "./backstage/resolve-backstage-line.ts";
import { retireActorToolDefinition } from "./actor/retire-actor.ts";
import { revealSecretToolDefinition } from "./secrets/reveal-secret.ts";
import { runParallelLineToolDefinition } from "./backstage/run-parallel-line.ts";
import { setScenePresenceToolDefinition } from "./actor/set-scene-presence.ts";
import { submitDirectionPacketToolDefinition } from "./scene/submit-direction-packet.ts";
import { updateActorAgendaToolDefinition } from "./actor/update-actor-agenda.ts";
import { updateActorConditionToolDefinition } from "./actor/update-actor-condition.ts";
import { updateActorImpressionToolDefinition } from "./actor/update-actor-impression.ts";
import { updateEconomyToolDefinition } from "./economy/update-economy.ts";
import { updateHookToolDefinition } from "./system/update-hook.ts";
import { upsertActorToolDefinition } from "./actor/upsert-actor.ts";
import { updateCorruptionToolDefinition } from "./lotm/update-corruption.ts";
import { attemptPromotionToolDefinition } from "./lotm/attempt-promotion.ts";

/** 全部 Domain Event Tool 契约清单；契约本体与实现同文件维护。 */
const TOOL_DEFINITIONS: readonly FateToolDefinition[] = [
  initializeNewGameToolDefinition,
  configureCampaignToolDefinition,
  commitTurnToolDefinition,
  progressSceneBeatToolDefinition,
  getStatusToolDefinition,
  recordMemoryToolDefinition,
  recordOffscreenEventToolDefinition,
  manageFactionClockToolDefinition,
  retireActorToolDefinition,
  updateActorAgendaToolDefinition,
  recordActorKnowledgeToolDefinition,
  recordRelationshipSignalToolDefinition,
  recallMemoryToolDefinition,
  updateActorImpressionToolDefinition,
  updateActorConditionToolDefinition,
  setScenePresenceToolDefinition,
  upsertActorToolDefinition,
  updateEconomyToolDefinition,
  revealSecretToolDefinition,
  runParallelLineToolDefinition,
  harvestBackstageCandidateToolDefinition,
  resolveBackstageLineToolDefinition,
  privateResolveToolDefinition,
  submitDirectionPacketToolDefinition,
  updateHookToolDefinition,
  lookupToolDefinition,
  patchStateToolDefinition,
  overrideLockedFactToolDefinition,
  migrateStateToolDefinition,
  resetStateToolDefinition,
  getStateSchemaToolDefinition,
  updateCorruptionToolDefinition,
  attemptPromotionToolDefinition,
];

export function registerAllTools(pi: ExtensionAPI): void {
  for (const definition of TOOL_DEFINITIONS) {
    pi.registerTool({ label: "LOTM 叙事", renderResult: renderDomainToolResult, ...definition });
  }
}