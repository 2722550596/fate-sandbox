import { assertFateRank } from "../../engine/core/fate-rank";
import {
  updateState,
  writeStateToDetails,
  type ActorId,
  type FateParams,
  type ServantClass,
} from "../../engine/core/state";
import { persistCurrentState } from "../../engine/core/state-persistence";
import { textResult, type ToolResult } from "../runtime/tool-result";

export type OverrideLockedFactParams =
  | { kind: "servant-class"; actorId: ActorId; className: ServantClass; reason: string }
  | { kind: "servant-true-name"; actorId: ActorId; display: string; reason: string }
  | { kind: "servant-base-params"; actorId: ActorId; base: FateParams; reason: string };

export function overrideLockedFactTool(params: unknown, sessionManager: unknown): ToolResult {
  const override = assertOverrideLockedFactParams(params);
  if (override.reason.trim().length === 0) {
    throw new Error("override_locked_fact 必须提供 reason。");
  }
  updateState((draft) => {
    const actor = draft.public.actors[override.actorId];
    if (actor === undefined) {
      throw new Error(`actor 不存在: ${override.actorId}`);
    }
    const servantForm = actor.servantForm;
    if (servantForm === null) {
      throw new Error(`actor ${override.actorId} 没有 servantForm。`);
    }
    switch (override.kind) {
      case "servant-class":
        servantForm.identity.className = override.className;
        break;
      case "servant-true-name":
        servantForm.identity.trueName = { status: "revealed", display: override.display };
        break;
      case "servant-base-params":
        servantForm.parameters.base = override.base;
        break;
      default:
        throw new Error("unreachable override kind");
    }
  });
  persistCurrentState(sessionManager);
  const details: Record<string, unknown> = {
    kind: override.kind,
    actorId: override.actorId,
    reason: override.reason,
  };
  writeStateToDetails(details);
  return textResult(`锁定事实已覆盖：${override.kind}。原因：${override.reason}`, details);
}

function assertOverrideLockedFactParams(params: unknown): OverrideLockedFactParams {
  if (!isRecord(params)) {
    throw new Error("override_locked_fact 参数必须是对象。");
  }
  const kind = assertString(params["kind"], "kind");
  const actorId = assertString(params["actorId"], "actorId");
  const reason = assertString(params["reason"], "reason");
  switch (kind) {
    case "servant-class":
      return { kind, actorId, className: assertServantClass(params["className"]), reason };
    case "servant-true-name":
      return { kind, actorId, display: assertString(params["display"], "display"), reason };
    case "servant-base-params":
      return { kind, actorId, base: assertFateParams(params["base"]), reason };
    default:
      throw new Error(`非法 override kind: ${kind}`);
  }
}

function assertFateParams(value: unknown): FateParams {
  if (!isRecord(value)) {
    throw new Error("base 必须是 FateParams 对象。");
  }
  return {
    strength: assertRank(value["strength"], "strength"),
    endurance: assertRank(value["endurance"], "endurance"),
    agility: assertRank(value["agility"], "agility"),
    mana: assertRank(value["mana"], "mana"),
    luck: assertRank(value["luck"], "luck"),
    noblePhantasm: assertRank(value["noblePhantasm"], "noblePhantasm"),
  };
}

function assertRank(value: unknown, fieldName: string): FateParams["strength"] {
  return assertFateRank(value, fieldName);
}

function assertServantClass(value: unknown): ServantClass {
  const className = assertString(value, "className");
  if (
    className === "Saber" ||
    className === "Archer" ||
    className === "Lancer" ||
    className === "Rider" ||
    className === "Caster" ||
    className === "Assassin" ||
    className === "Berserker" ||
    className === "Avenger" ||
    className === "Ruler" ||
    className === "AlterEgo" ||
    className === "Foreigner" ||
    className === "Shielder" ||
    className === "MoonCancer" ||
    className === "Pretender" ||
    className === "Custom"
  ) {
    return className;
  }
  throw new Error(`非法 className: ${className}`);
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} 必须是非空字符串。`);
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
