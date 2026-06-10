import type { ServantFormEvent } from "./servant-schema";
import type { ActorId, ResourceTrack, ServantCoreState, State } from "./state";

import { Temporal } from "@js-temporal/polyfill";

import { createId } from "./ids";
import { assertNonEmptyString, assertPercent } from "./typebox-validation";

export type { ServantFormEvent } from "./servant-schema";

export interface ServantFormEventResult {
  message: string;
}

/**
 * 剪枝已过期的从者参数修正。时钟推进（turn-time）与 Game State Store
 * 提交路径都会调用；原地修改并返回同一个 state。
 */
export function pruneExpiredParamModifiers(state: State): State {
  const currentAt = Temporal.Instant.from(state.public.clock.currentAt);
  for (const actor of Object.values(state.public.actors)) {
    const servantForm = actor.servantForm;
    if (servantForm === null) continue;
    servantForm.parameters.modifiers = servantForm.parameters.modifiers.filter((modifier) => {
      if (modifier.expiresAt === null) return true;
      return Temporal.Instant.compare(Temporal.Instant.from(modifier.expiresAt), currentAt) > 0;
    });
  }
  return state;
}

export function updateServantForm(draft: State, event: ServantFormEvent): ServantFormEventResult {
  assertNonEmptyString(event.reason, "reason");
  switch (event.kind) {
    case "spend-mana":
      return updateResource(draft, event.actorId, "mana", -event.amount, "魔力已消耗");
    case "restore-mana":
      return updateResource(draft, event.actorId, "mana", event.amount, "魔力已恢复");
    case "damage-spiritual-core":
      return updateResource(draft, event.actorId, "spiritualCore", -event.amount, "灵核已受损");
    case "add-param-modifier":
      return addParamModifier(draft, event);
    case "change-contract":
      return changeContract(draft, event);
    case "add-permanent-defect":
      return addPermanentDefect(draft, event);
    default:
      throw new Error("unreachable servant form event kind");
  }
}

function updateResource(
  draft: State,
  actorId: ActorId,
  track: keyof Pick<ServantCoreState["condition"], "mana" | "spiritualCore">,
  delta: number,
  message: string,
): ServantFormEventResult {
  const servant = requireServantForm(draft.public.actors[actorId]?.servantForm, actorId);
  const resource: ResourceTrack = servant.condition[track];
  resource.value = assertPercent(resource.value + delta, track);
  return { message };
}

function addParamModifier(
  draft: State,
  event: Extract<ServantFormEvent, { kind: "add-param-modifier" }>,
): ServantFormEventResult {
  const servant = requireServantForm(
    draft.public.actors[event.actorId]?.servantForm,
    event.actorId,
  );
  servant.parameters.modifiers.push({
    ...event.modifier,
    id: event.modifier.id || createId(draft, "param-mod"),
  });
  return { message: "参数修正已加入。" };
}

function changeContract(
  draft: State,
  event: Extract<ServantFormEvent, { kind: "change-contract" }>,
): ServantFormEventResult {
  const servant = requireServantForm(
    draft.public.actors[event.actorId]?.servantForm,
    event.actorId,
  );
  servant.contract = event.contract;
  return { message: "契约状态已更新。" };
}

function addPermanentDefect(
  draft: State,
  event: Extract<ServantFormEvent, { kind: "add-permanent-defect" }>,
): ServantFormEventResult {
  const servant = requireServantForm(
    draft.public.actors[event.actorId]?.servantForm,
    event.actorId,
  );
  servant.condition.permanentDefects.push({
    ...event.defect,
    id: event.defect.id || createId(draft, "defect"),
  });
  return { message: "永久缺损已记录。" };
}

function requireServantForm(
  servantForm: ServantCoreState | null | undefined,
  actorId: ActorId,
): ServantCoreState {
  if (servantForm === null || servantForm === undefined) {
    throw new Error(`actor ${actorId} 没有 servantForm。`);
  }
  return servantForm;
}
