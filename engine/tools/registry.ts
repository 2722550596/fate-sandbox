import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import type { FateToolDefinition } from "./runtime/tool-definition.ts";

import { recordActorKnowledgeToolDefinition } from "./actor/record-actor-knowledge.ts";
import { retireActorToolDefinition } from "./actor/retire-actor.ts";
import { setScenePresenceToolDefinition } from "./actor/set-scene-presence.ts";
import { updateActorAgendaToolDefinition } from "./actor/update-actor-agenda.ts";
import { updateActorConditionToolDefinition } from "./actor/update-actor-condition.ts";
import { updateActorImpressionToolDefinition } from "./actor/update-actor-impression.ts";
import { updateTrackedItemToolDefinition } from "./actor/update-tracked-item.ts";
import { upsertActorToolDefinition } from "./actor/upsert-actor.ts";
import { harvestBackstageCandidateToolDefinition } from "./backstage/harvest-backstage-candidate.ts";
import { manageFactionClockToolDefinition } from "./backstage/manage-faction-clock.ts";
import { recordOffscreenEventToolDefinition } from "./backstage/record-offscreen-event.ts";
import { resolveBackstageLineToolDefinition } from "./backstage/resolve-backstage-line.ts";
import { runParallelLineToolDefinition } from "./backstage/run-parallel-line.ts";
import { getStateSchemaToolDefinition } from "./debug/get-state-schema.ts";
import { overrideLockedFactToolDefinition } from "./debug/override-locked-fact.ts";
import { resetStateToolDefinition } from "./debug/reset-state.ts";
import { updateEconomyToolDefinition } from "./economy/update-economy.ts";
import { addHiddenWorldFactToolDefinition } from "./knowledge/add-hidden-world-fact.ts";
import { recallMemoryToolDefinition } from "./knowledge/recall-memory.ts";
import { recordMemoryToolDefinition } from "./knowledge/record-memory.ts";
import { revealSecretToolDefinition } from "./knowledge/reveal-secret.ts";
import { lookupToolDefinition } from "./lookup/lookup.ts";
import { attemptPromotionToolDefinition } from "./lotm/attempt-promotion.ts";
import { updateCorruptionToolDefinition } from "./lotm/update-corruption.ts";
import { recordRelationshipSignalToolDefinition } from "./relationship/record-relationship-signal.ts";
import { renderDomainToolResult } from "./runtime/tool-render.ts";
import { commitTurnToolDefinition } from "./scene/commit-turn.ts";
import { privateResolveToolDefinition } from "./scene/private-resolve.ts";
import { progressSceneBeatToolDefinition } from "./scene/progress-scene-beat.ts";
import { submitDirectionPacketToolDefinition } from "./scene/submit-direction-packet.ts";
import { getStatusToolDefinition } from "./system/get-status.ts";
import { initializeNewGameToolDefinition } from "./system/initialize-new-game.ts";
import { patchStateToolDefinition } from "./system/patch-state.ts";
import { updateHookToolDefinition } from "./system/update-hook.ts";

/** 全部 Domain Event Tool 契约清单；契约本体与实现同文件维护。 */
const TOOL_DEFINITIONS: readonly FateToolDefinition[] = [
  initializeNewGameToolDefinition,
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
  updateTrackedItemToolDefinition,
  addHiddenWorldFactToolDefinition,
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
