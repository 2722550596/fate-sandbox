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

import { assertOneOfString } from "./domain-assert";
import { runDomainEventTool } from "./domain-tool-runner";
import { assertArray, assertRecord, assertString, assertStringArray } from "./tool-input";

type RevealSecretToolInput = ConfigureActorSecretsInput | ConfigureServantSecretsInput | RevealSecretEvent;

const NOBLE_PHANTASM_STATUSES = [
  "hidden",
  "suspected",
  "revealed",
] as const satisfies readonly NoblePhantasm["status"][];

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
  const input = assertRecord(params, "reveal_secret 参数");
  const kind = assertString(input["kind"], "kind");
  switch (kind) {
    case "configure-servant-secrets":
      return {
        kind,
        actorId: assertString(input["actorId"], "actorId"),
        trueName:
          input["trueName"] === undefined
            ? undefined
            : assertServantSecretStringInput(input["trueName"], "trueName"),
        hiddenNoblePhantasms:
          input["hiddenNoblePhantasms"] === undefined
            ? undefined
            : assertArray(input["hiddenNoblePhantasms"], "hiddenNoblePhantasms").map(
                (item) => assertServantSecretNoblePhantasmInput(item, "hiddenNoblePhantasms[]"),
              ),
        reason: assertString(input["reason"], "reason"),
      };
    case "configure-actor-secrets":
      return {
        kind,
        actorId: assertString(input["actorId"], "actorId"),
        privateMotives:
          input["privateMotives"] === undefined
            ? undefined
            : assertArray(input["privateMotives"], "privateMotives").map((item) =>
                assertServantSecretStringInput(item, "privateMotives[]"),
              ),
        unrevealedAffiliations:
          input["unrevealedAffiliations"] === undefined
            ? undefined
            : assertArray(input["unrevealedAffiliations"], "unrevealedAffiliations").map((item) =>
                assertServantSecretStringInput(item, "unrevealedAffiliations[]"),
              ),
        reason: assertString(input["reason"], "reason"),
      };
    case "claim-reveal":
      return {
        kind,
        actorId: assertString(input["actorId"], "actorId"),
        claim: assertString(input["claim"], "claim"),
        evidence: assertString(input["evidence"], "evidence"),
      };
    case "observed-reveal":
      return {
        kind,
        actorId: assertString(input["actorId"], "actorId"),
        trigger: assertString(input["trigger"], "trigger"),
        evidence: assertString(input["evidence"], "evidence"),
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
  return assertOneOfString(value, NOBLE_PHANTASM_STATUSES, fieldName, { style: "must-be" });
}
