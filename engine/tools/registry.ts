import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import type { DomainToolDefinition } from "./runtime/tool-definition.ts";

import { recordActingFeedbackToolDefinition } from "./actor/record-acting-feedback.ts";
import { recordActorKnowledgeToolDefinition } from "./actor/record-actor-knowledge.ts";
import { retireActorToolDefinition } from "./actor/retire-actor.ts";
import { setScenePresenceToolDefinition } from "./actor/set-scene-presence.ts";
import { updateActorAgendaToolDefinition } from "./actor/update-actor-agenda.ts";
import { updateActorConditionToolDefinition } from "./actor/update-actor-condition.ts";
import { updateActorImpressionToolDefinition } from "./actor/update-actor-impression.ts";
import { updateActorOutfitToolDefinition } from "./actor/update-actor-outfit.ts";
import { upsertActorToolDefinition } from "./actor/upsert-actor.ts";
import { harvestBackstageCandidateToolDefinition } from "./backstage/harvest-backstage-candidate.ts";
import { manageFactionClockToolDefinition } from "./backstage/manage-faction-clock.ts";
import { recordOffscreenEventToolDefinition } from "./backstage/record-offscreen-event.ts";
import { resolveBackstageLineToolDefinition } from "./backstage/resolve-backstage-line.ts";
import { runParallelLineToolDefinition } from "./backstage/run-parallel-line.ts";
import { clearBackstageLockToolDefinition } from "./debug/clear-backstage-lock.ts";
import { getStateSchemaToolDefinition } from "./debug/get-state-schema.ts";
import { overrideLockedFactToolDefinition } from "./debug/override-locked-fact.ts";
import { patchStateToolDefinition } from "./debug/patch-state.ts";
import { resetStateToolDefinition } from "./debug/reset-state.ts";
import { updateEconomyToolDefinition } from "./economy/update-economy.ts";
import { updateTrackedItemToolDefinition } from "./inventory/update-tracked-item.ts";
import { addHiddenWorldFactToolDefinition } from "./knowledge/add-hidden-world-fact.ts";
import { recallMemoryToolDefinition } from "./knowledge/recall-memory.ts";
import { recordMemoryToolDefinition } from "./knowledge/record-memory.ts";
import { revealSecretToolDefinition } from "./knowledge/reveal-secret.ts";
import { lookupEconomyToolDefinition } from "./lookup/economy-lookup.ts";
import { lookupToolDefinition } from "./lookup/lookup-rag.ts";
import { lookupNovelToolDefinition } from "./lookup/novel-lookup.ts";
import { attemptPromotionToolDefinition } from "./lotm/attempt-promotion.ts";
import { recordRelationshipSignalToolDefinition } from "./relationship/record-relationship-signal.ts";
import { renderDomainToolResult } from "./runtime/tool-render.ts";
import { commitTurnToolDefinition } from "./scene/commit-turn.ts";
import { privateResolveToolDefinition } from "./scene/private-resolve.ts";
import { progressSceneBeatToolDefinition } from "./scene/progress-scene-beat.ts";
import { submitDirectionPacketToolDefinition } from "./scene/submit-direction-packet.ts";
import { getStatusToolDefinition } from "./system/get-status.ts";
import { initializeNewGameToolDefinition } from "./system/initialize-new-game.ts";
import { updateHookToolDefinition } from "./system/update-hook.ts";

/** 全部 Domain Event Tool 契约清单；契约本体与实现同文件维护。 */
const TOOL_DEFINITIONS: readonly DomainToolDefinition[] = [
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
  updateActorOutfitToolDefinition,
  addHiddenWorldFactToolDefinition,
  setScenePresenceToolDefinition,
  upsertActorToolDefinition,
  recordActingFeedbackToolDefinition,
  updateEconomyToolDefinition,
  revealSecretToolDefinition,
  runParallelLineToolDefinition,
  harvestBackstageCandidateToolDefinition,
  resolveBackstageLineToolDefinition,
  privateResolveToolDefinition,
  submitDirectionPacketToolDefinition,
  updateHookToolDefinition,
  lookupToolDefinition,
  lookupEconomyToolDefinition,
  lookupNovelToolDefinition,
  patchStateToolDefinition,
  overrideLockedFactToolDefinition,
  clearBackstageLockToolDefinition,

  resetStateToolDefinition,
  getStateSchemaToolDefinition,
  attemptPromotionToolDefinition,
];

export function registerAllTools(pi: ExtensionAPI): void {
  for (const definition of TOOL_DEFINITIONS) {
    pi.registerTool({ label: "LOTM 叙事", renderResult: renderDomainToolResult, ...definition });
  }
}
