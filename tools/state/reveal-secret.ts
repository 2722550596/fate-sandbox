import type {
  ConfigureActorSecretsInput,
  ConfigureActorSecretsResult,
  ConfigureServantSecretsInput,
  ConfigureServantSecretsResult,
  RevealSecretEvent,
  RevealSecretResult,
  ServantSecretNoblePhantasmInput,
  ServantSecretStringInput,
} from "../../engine/core/secrets";
import type { NoblePhantasm } from "../../engine/core/state";

import { configureActorSecrets, configureServantSecrets, revealSecret } from "../../engine/core/secrets";
import type { ToolResult } from "../runtime/tool-result";

import { runDomainEventTool } from "./domain-tool-runner";

type RevealSecretToolInput = ConfigureActorSecretsInput | ConfigureServantSecretsInput | RevealSecretEvent;

type RevealSecretToolResult =
  | { kind: "configure"; result: ConfigureActorSecretsResult | ConfigureServantSecretsResult }
  | { kind: "reveal"; result: RevealSecretResult };

export function revealSecretTool(params: unknown, sessionManager: unknown): ToolResult {
  return runDomainEventTool({
    sessionManager,
    execute: () => executeSecretTool(assertSecretToolInput(params)),
    details: secretDetails,
    message: secretMessage,
  });
}

function executeSecretTool(input: RevealSecretToolInput): RevealSecretToolResult {
  if (input.kind === "configure-servant-secrets") {
    return { kind: "configure", result: configureServantSecrets(input) };
  }
  if (input.kind === "configure-actor-secrets") {
    return { kind: "configure", result: configureActorSecrets(input) };
  }
  return { kind: "reveal", result: revealSecret(input) };
}

function secretDetails(output: RevealSecretToolResult): Record<string, unknown> {
  if (output.kind === "configure") {
    return { result: output.result };
  }
  return { outcome: output.result.outcome };
}

function secretMessage(output: RevealSecretToolResult): string {
  if (output.kind === "configure") {
    return output.result.message;
  }
  return output.result.playerSafeMessage;
}

function assertSecretToolInput(params: unknown): RevealSecretToolInput {
  if (!isRecord(params)) {
    throw new Error("reveal_secret 参数必须是对象。");
  }
  const kind = assertString(params["kind"], "kind");
  switch (kind) {
    case "configure-servant-secrets":
      return {
        kind,
        actorId: assertString(params["actorId"], "actorId"),
        trueName:
          params["trueName"] === undefined
            ? undefined
            : assertServantSecretStringInput(params["trueName"], "trueName"),
        hiddenNoblePhantasms:
          params["hiddenNoblePhantasms"] === undefined
            ? undefined
            : assertArray(params["hiddenNoblePhantasms"], "hiddenNoblePhantasms").map(
                (item) => assertServantSecretNoblePhantasmInput(item, "hiddenNoblePhantasms[]"),
              ),
        reason: assertString(params["reason"], "reason"),
      };
    case "configure-actor-secrets":
      return {
        kind,
        actorId: assertString(params["actorId"], "actorId"),
        privateMotives:
          params["privateMotives"] === undefined
            ? undefined
            : assertArray(params["privateMotives"], "privateMotives").map((item) =>
                assertServantSecretStringInput(item, "privateMotives[]"),
              ),
        unrevealedAffiliations:
          params["unrevealedAffiliations"] === undefined
            ? undefined
            : assertArray(params["unrevealedAffiliations"], "unrevealedAffiliations").map((item) =>
                assertServantSecretStringInput(item, "unrevealedAffiliations[]"),
              ),
        reason: assertString(params["reason"], "reason"),
      };
    case "claim-reveal":
      return {
        kind,
        actorId: assertString(params["actorId"], "actorId"),
        claim: assertString(params["claim"], "claim"),
        evidence: assertString(params["evidence"], "evidence"),
      };
    case "observed-reveal":
      return {
        kind,
        actorId: assertString(params["actorId"], "actorId"),
        trigger: assertString(params["trigger"], "trigger"),
        evidence: assertString(params["evidence"], "evidence"),
      };
    default:
      throw new Error(`非法 reveal_secret.kind: ${kind}。`);
  }
}

function assertServantSecretStringInput(
  value: unknown,
  fieldName: string,
): ServantSecretStringInput {
  const record = assertRecord(value, fieldName);
  return {
    value: assertString(record["value"], `${fieldName}.value`),
    revealConditions: assertStringArray(record["revealConditions"], `${fieldName}.revealConditions`),
  };
}

function assertServantSecretNoblePhantasmInput(
  value: unknown,
  fieldName: string,
): ServantSecretNoblePhantasmInput {
  const record = assertRecord(value, fieldName);
  return {
    value: assertNoblePhantasm(record["value"], `${fieldName}.value`),
    revealConditions: assertStringArray(record["revealConditions"], `${fieldName}.revealConditions`),
  };
}

function assertNoblePhantasm(value: unknown, fieldName: string): NoblePhantasm {
  const record = assertRecord(value, fieldName);
  return {
    name: assertString(record["name"], `${fieldName}.name`),
    rank: assertFateRankOrNone(record["rank"], `${fieldName}.rank`),
    kind: assertString(record["kind"], `${fieldName}.kind`),
    status: assertNoblePhantasmStatus(record["status"], `${fieldName}.status`),
    summary: assertString(record["summary"], `${fieldName}.summary`),
  };
}

function assertFateRankOrNone(value: unknown, fieldName: string): NoblePhantasm["rank"] {
  const rank = assertString(value, fieldName);
  if (rank === "none") {
    return rank;
  }
  if (/^(E|D|C|B|A|EX)(\+{1,3}|-)?$/.test(rank)) {
    return rank as NoblePhantasm["rank"]; // safe: regex mirrors FateRank grammar in engine/core/fate-rank.ts.
  }
  throw new Error(`${fieldName} 必须是 Fate rank 或 none。`);
}

function assertNoblePhantasmStatus(value: unknown, fieldName: string): NoblePhantasm["status"] {
  const status = assertString(value, fieldName);
  if (status === "hidden" || status === "suspected" || status === "revealed") {
    return status;
  }
  throw new Error(`${fieldName} 必须是 hidden、suspected 或 revealed。`);
}

function assertStringArray(value: unknown, fieldName: string): string[] {
  return assertArray(value, fieldName).map((item, index) =>
    assertString(item, `${fieldName}[${index}]`),
  );
}

function assertArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是数组。`);
  }
  return value;
}

function assertRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
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
