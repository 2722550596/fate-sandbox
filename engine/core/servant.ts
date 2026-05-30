import type {
  ActorId,
  ParamModifier,
  PermanentDefect,
  ResourceTrack,
  ServantContractState,
  ServantCoreState,
} from "./state";

import { assertNonEmptyString, assertPercent, createId, updateState } from "./state";

export type ServantFormEvent =
  | { kind: "spend-mana"; actorId: ActorId; amount: number; reason: string }
  | { kind: "restore-mana"; actorId: ActorId; amount: number; reason: string }
  | { kind: "damage-spiritual-core"; actorId: ActorId; amount: number; reason: string }
  | { kind: "add-param-modifier"; actorId: ActorId; modifier: ParamModifier; reason: string }
  | { kind: "change-contract"; actorId: ActorId; contract: ServantContractState; reason: string }
  | { kind: "add-permanent-defect"; actorId: ActorId; defect: PermanentDefect; reason: string };

export interface ServantFormEventResult {
  message: string;
}

export function updateServantForm(event: ServantFormEvent): ServantFormEventResult {
  assertNonEmptyString(event.reason, "reason");
  switch (event.kind) {
    case "spend-mana":
      return updateResource(event.actorId, "mana", -event.amount, "魔力已消耗");
    case "restore-mana":
      return updateResource(event.actorId, "mana", event.amount, "魔力已恢复");
    case "damage-spiritual-core":
      return updateResource(event.actorId, "spiritualCore", -event.amount, "灵核已受损");
    case "add-param-modifier":
      return addParamModifier(event);
    case "change-contract":
      return changeContract(event);
    case "add-permanent-defect":
      return addPermanentDefect(event);
    default:
      throw new Error("unreachable servant form event kind");
  }
}

function updateResource(
  actorId: ActorId,
  track: keyof Pick<ServantCoreState["condition"], "mana" | "spiritualCore">,
  delta: number,
  message: string,
): ServantFormEventResult {
  updateState((draft) => {
    const servant = requireServantForm(draft.public.actors[actorId]?.servantForm, actorId);
    const resource: ResourceTrack = servant.condition[track];
    resource.value = assertPercent(resource.value + delta, track);
  });
  return { message };
}

function addParamModifier(
  event: Extract<ServantFormEvent, { kind: "add-param-modifier" }>,
): ServantFormEventResult {
  updateState((draft) => {
    const servant = requireServantForm(
      draft.public.actors[event.actorId]?.servantForm,
      event.actorId,
    );
    servant.parameters.modifiers.push({
      ...event.modifier,
      id: event.modifier.id || createId("param-mod"),
    });
  });
  return { message: "参数修正已加入。" };
}

function changeContract(
  event: Extract<ServantFormEvent, { kind: "change-contract" }>,
): ServantFormEventResult {
  updateState((draft) => {
    const servant = requireServantForm(
      draft.public.actors[event.actorId]?.servantForm,
      event.actorId,
    );
    servant.contract = event.contract;
  });
  return { message: "契约状态已更新。" };
}

function addPermanentDefect(
  event: Extract<ServantFormEvent, { kind: "add-permanent-defect" }>,
): ServantFormEventResult {
  updateState((draft) => {
    const servant = requireServantForm(
      draft.public.actors[event.actorId]?.servantForm,
      event.actorId,
    );
    servant.condition.permanentDefects.push({
      ...event.defect,
      id: event.defect.id || createId("defect"),
    });
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
