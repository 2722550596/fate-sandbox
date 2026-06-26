import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import type { FateToolDefinition } from "./runtime/tool-definition.ts";

import { getStateSchemaToolDefinition } from "./debug/get-state-schema.ts";
import { migrateStateToolDefinition } from "./debug/migrate-state.ts";
import { overrideLockedFactToolDefinition } from "./debug/override-locked-fact.ts";
import { resetStateToolDefinition } from "./debug/reset-state.ts";
import { lookupToolDefinition } from "./lookup/lookup.ts";
import { renderDomainToolResult } from "./runtime/tool-render.ts";
import { commitTurnToolDefinition } from "./state/commit-turn.ts";
import { configureCampaignToolDefinition } from "./state/configure-campaign.ts";
import { getStatusToolDefinition } from "./state/get-status.ts";
import { harvestBackstageCandidateToolDefinition } from "./state/harvest-backstage-candidate.ts";
import { initializeNewGameToolDefinition } from "./state/initialize-new-game.ts";
import { manageFactionClockToolDefinition } from "./state/manage-faction-clock.ts";
import { patchStateToolDefinition } from "./state/patch-state.ts";
import { privateResolveToolDefinition } from "./state/private-resolve.ts";
import { progressSceneBeatToolDefinition } from "./state/progress-scene-beat.ts";
import { recallMemoryToolDefinition } from "./state/recall-memory.ts";
import { recordActorKnowledgeToolDefinition } from "./state/record-actor-knowledge.ts";
import { recordMemoryToolDefinition } from "./state/record-memory.ts";
import { recordOffscreenEventToolDefinition } from "./state/record-offscreen-event.ts";
import { recordRelationshipSignalToolDefinition } from "./state/record-relationship-signal.ts";
import { resolveBackstageLineToolDefinition } from "./state/resolve-backstage-line.ts";
import { retireActorToolDefinition } from "./state/retire-actor.ts";
import { revealSecretToolDefinition } from "./state/reveal-secret.ts";
import { runParallelLineToolDefinition } from "./state/run-parallel-line.ts";
import { setScenePresenceToolDefinition } from "./state/set-scene-presence.ts";
import { submitDirectionPacketToolDefinition } from "./state/submit-direction-packet.ts";
import { updateActorAgendaToolDefinition } from "./state/update-actor-agenda.ts";
import { updateActorConditionToolDefinition } from "./state/update-actor-condition.ts";
import { updateActorImpressionToolDefinition } from "./state/update-actor-impression.ts";
import { updateEconomyToolDefinition } from "./state/update-economy.ts";
import { updateHookToolDefinition } from "./state/update-hook.ts";
import { upsertActorToolDefinition } from "./state/upsert-actor.ts";

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
];

export function registerAllTools(pi: ExtensionAPI): void {
  for (const definition of TOOL_DEFINITIONS) {
    pi.registerTool({ label: "LOTM 叙事", renderResult: renderDomainToolResult, ...definition });
  }
}
