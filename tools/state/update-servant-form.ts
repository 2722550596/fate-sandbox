import type { ServantFormEvent } from "../../engine/core/servant";
import type { ToolResult } from "../runtime/tool-result";

import { updateServantForm } from "../../engine/core/servant";
import {
  parseServantFormEvent,
  SERVANT_FORM_EVENT_KINDS,
} from "../../engine/core/servant-schema";

import { resultDetails, runDomainEventTool } from "./domain-tool-runner";
import { isRecord } from "../../engine/core/typebox-validation";

/** 锁定字段的 kind 有专属指引（指向 override_locked_fact），必须先于 schema 枚举报错。 */
const LOCKED_FIELD_KINDS = [
  "change-true-name",
  "change-class",
  "change-base-params",
  "change-noble-phantasm",
] as const;

export function updateServantFormTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: (draft) => updateServantForm(draft, parseServantFormEventBoundary(params)),
    details: resultDetails,
    message: (result) => result.message,
  });
}

function parseServantFormEventBoundary(params: unknown): ServantFormEvent {
  assertNotLockedFieldKind(params);
  return parseServantFormEvent(
    normalizeNullableFields(params),
    "update_servant_form 参数",
  );
}

function assertNotLockedFieldKind(params: unknown): void {
  const kind = isRecord(params) ? params["kind"] : undefined;
  if (typeof kind !== "string" || !LOCKED_FIELD_KINDS.some((locked) => locked === kind)) {
    return;
  }
  throw new Error(
    `非法 update_servant_form.kind: ${JSON.stringify(kind)}。真名、职阶、基础参数、宝具是锁定字段，必须使用 debug 工具 override_locked_fact（宝具当前无常规增删事件），严禁使用 patch_state。允许值: ${SERVANT_FORM_EVENT_KINDS.join(", ")}。`,
  );
}

/** contract/modifier 的 nullable 字段容错：缺省归一为 null——领域归一化，不是校验。 */
function normalizeNullableFields(params: unknown): unknown {
  if (!isRecord(params)) {
    return params;
  }
  const next = { ...params };
  if (isRecord(next["contract"])) {
    next["contract"] = {
      ...next["contract"],
      masterActorId: next["contract"]["masterActorId"] ?? null,
      masterName: next["contract"]["masterName"] ?? null,
    };
  }
  if (isRecord(next["modifier"])) {
    next["modifier"] = {
      ...next["modifier"],
      expiresAt: next["modifier"]["expiresAt"] ?? null,
    };
  }
  return next;
}
