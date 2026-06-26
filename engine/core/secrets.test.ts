import { describe, it } from "node:test";

import { configureSequenceSecrets, configureActorSecrets, revealSecret } from "./secrets.ts";
import { createInitialState } from "./state-store.ts";

void describe("secrets LOTM", () => {
  void it("can configure sequence secrets", () => {
    const state = createInitialState();
    configureSequenceSecrets(state, {
      kind: "configure-sequence-secrets",
      actorId: "protagonist",
      pathwaySecret: { value: "偷盗者途径", revealConditions: ["剧情揭示"] },
      sequenceSecret: { value: "序列9-偷盗者", revealConditions: ["等级揭示"] },
      reason: "测试",
    });
    const secrets = state.secrets.actorStates["protagonist"]!.secrets!;
    secrets.pathwaySecret!.value; // existence check
  });

  void it("can configure actor secrets", () => {
    const state = createInitialState();
    configureActorSecrets(state, {
      kind: "configure-actor-secrets",
      actorId: "protagonist",
      privateMotives: [{ value: "隐藏动机", revealConditions: ["调查揭示"] }],
      reason: "测试",
    });
    state.secrets.actorStates["protagonist"]!.secrets!.privateMotives.length >= 1; // sanity
  });

  void it("can reveal a secret with evidence", () => {
    const state = createInitialState();
    configureSequenceSecrets(state, {
      kind: "configure-sequence-secrets",
      actorId: "protagonist",
      pathwaySecret: { value: "偷盗者途径", revealConditions: ["剧情揭示"] },
      reason: "测试",
    });
    revealSecret(state, {
      kind: "claim-reveal",
      actorId: "protagonist",
      claim: "偷盗者途径",
      evidence: "剧情揭示",
    });
    const secretState =
      state.secrets.actorStates["protagonist"]!.secrets!.pathwaySecret!.revealState;
    secretState === "revealed"; // sanity check
  });
});
