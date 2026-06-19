import type { PublicNpcSkeletonInput, ServantInput } from "./actor.ts";
import type { ConfigureCampaignInput } from "./campaign.ts";
import type { MemoryClaim } from "./memory.ts";
import type { ServantSecretNoblePhantasmInput, ServantSecretStringInput } from "./secrets.ts";
import type {
  ActorId,
  ActorRole,
  FateParams,
  MagecraftCapability,
  NoblePhantasm,
  OutfitState,
  PublicActorState,
  RelationshipState,
  ServantClass,
  ServantSkill,
  State,
} from "./state.ts";

import { setScenePresence, upsertActor } from "./actor.ts";
import { configureCampaign } from "./campaign.ts";
import { recordMemory } from "./memory.ts";
import { configureServantSecrets } from "./secrets.ts";
import { createInitialState } from "./state-store.ts";

export type NewGameInitializationInput = HumanNewGameInput | ServantNewGameInput;

export interface NewGameCampaignInput extends Omit<ConfigureCampaignInput, "reason"> {
  reason?: string;
}

export interface HumanNewGameInput {
  kind: "human-protagonist";
  campaign: NewGameCampaignInput;
  protagonist: HumanProtagonistOpeningInput;
  presence?: NewGamePresenceInput;
  knownFacts?: NewGameKnownFactInput[];
  reason: string;
}

export interface ServantNewGameInput {
  kind: "servant-protagonist";
  campaign: NewGameCampaignInput;
  protagonist: ServantProtagonistOpeningInput;
  master?: PublicNpcSkeletonInput;
  presence?: NewGamePresenceInput;
  knownFacts?: NewGameKnownFactInput[];
  hiddenTrueName?: ServantSecretStringInput;
  hiddenNoblePhantasms?: ServantSecretNoblePhantasmInput[];
  reason: string;
}

export interface HumanProtagonistOpeningInput {
  internalName: string;
  renderName?: string;
  publicIdentity: string;
  background: string;
  apparentAge: string;
  outfit: OutfitState;
  demeanor: string;
  roles?: ActorRole[];
  magecraft?: MagecraftCapability | null;
  abilities?: string[];
  ordinaryItems?: string[];
}

export interface ServantProtagonistOpeningInput {
  internalName: string;
  renderName?: string;
  publicIdentity: string;
  apparentAge: string;
  outfit: OutfitState;
  demeanor: string;
  className: ServantClass;
  trueNameDisplay: string;
  trueNameStatus: "hidden" | "suspected";
  parameters?: FateParams;
  classSkills?: ServantSkill[];
  personalSkills?: ServantSkill[];
  noblePhantasms?: NoblePhantasm[];
  spiritualCore?: number;
  mana?: number;
  spiritualCondition?: string;
  masterActorId?: ActorId | null;
  masterName?: string | null;
  contractStatus?: "stable" | "weak" | "cut" | "masterless";
  manaSupply?: "sufficient" | "strained" | "starved";
  currentOrder?: string;
  publicRoles?: ActorRole[];
  relationshipToProtagonist?: RelationshipState;
  ordinaryItems?: string[];
}

export interface NewGamePresenceInput {
  presentActorIds: ActorId[];
  allyActorIds?: ActorId[];
}

export interface NewGameKnownFactInput {
  scope: "protagonist" | "npc" | "faction" | "world";
  subject?: string;
  text: string;
  claims?: MemoryClaim[];
}

export interface NewGameInitializationResult {
  message: string;
  steps: string[];
}

const PROTAGONIST_ACTOR_ID = "protagonist";
const DEFAULT_FATE_PARAMS: FateParams = {
  strength: "E",
  endurance: "E",
  agility: "E",
  mana: "E",
  luck: "E",
  noblePhantasm: "E",
};

export function initializeNewGame(
  draft: State,
  input: NewGameInitializationInput,
): NewGameInitializationResult {
  const steps: string[] = [];
  Object.assign(draft, createInitialState());
  steps.push("reset-state");

  configureCampaign(draft, { ...input.campaign, reason: input.campaign.reason ?? input.reason });
  steps.push("configure-campaign");

  if (input.kind === "human-protagonist") {
    upsertActor(draft, {
      kind: "setup-protagonist",
      actor: buildHumanProtagonist(input.protagonist),
      reason: input.reason,
    });
    steps.push("setup-human-protagonist");
  } else {
    initializeServantProtagonist(draft, input, steps);
  }

  if (input.presence !== undefined) {
    setScenePresence(draft, {
      presentActorIds: input.presence.presentActorIds,
      allyActorIds: input.presence.allyActorIds ?? [],
      reason: input.reason,
    });
    steps.push("set-scene-presence");
  }

  for (const fact of input.knownFacts ?? []) {
    recordMemory(draft, {
      kind: "pin-fact",
      scope: fact.scope,
      subject: fact.subject ?? PROTAGONIST_ACTOR_ID,
      text: fact.text,
      claims: fact.claims ?? [{ kind: "mundane", statement: fact.text, certainty: "confirmed" }],
      sourceEventId: null,
    });
    steps.push("record-known-fact");
  }

  assertNewGameInitialized(draft, input);
  return { message: "新游戏 state 已初始化。", steps };
}

function initializeServantProtagonist(
  draft: State,
  input: ServantNewGameInput,
  steps: string[],
): void {
  if (input.master !== undefined) {
    upsertActor(draft, { kind: "ensure-public-npc", npc: input.master, reason: input.reason });
    steps.push("ensure-master-npc");
  }

  upsertActor(draft, {
    kind: "upsert-servant",
    servant: buildServantProtagonist(input.protagonist),
    reason: input.reason,
  });
  steps.push("setup-servant-protagonist");

  if (input.hiddenTrueName !== undefined || input.hiddenNoblePhantasms !== undefined) {
    configureServantSecrets(draft, {
      kind: "configure-servant-secrets",
      actorId: PROTAGONIST_ACTOR_ID,
      trueName: input.hiddenTrueName,
      hiddenNoblePhantasms: input.hiddenNoblePhantasms,
      reason: input.reason,
    });
    steps.push("configure-servant-secrets");
  }
}

function buildHumanProtagonist(input: HumanProtagonistOpeningInput): PublicActorState {
  return {
    id: PROTAGONIST_ACTOR_ID,
    kind: "human",
    roles: input.roles ?? [],
    magecraft: input.magecraft ?? null,
    servantForm: null,
    identity: {
      publicIdentity: input.publicIdentity,
      background: input.background,
      lockedFacts: [],
    },
    presentation: {
      internalName: input.internalName,
      renderName: input.renderName ?? input.internalName,
      apparentAge: input.apparentAge,
      outfit: input.outfit,
      demeanor: input.demeanor,
    },
    condition: { wounds: [], afflictions: [], permanentEffects: [] },
    inventory: { ordinaryItems: input.ordinaryItems ?? [] },
    abilities: (input.abilities ?? []).map((summary, index) => ({
      id: `ability-protagonist-${index + 1}`,
      label: summary,
      summary,
    })),
    relationshipToProtagonist: { stance: "self", summary: "玩家本人。" },
  };
}

function buildServantProtagonist(input: ServantProtagonistOpeningInput): ServantInput {
  return {
    id: PROTAGONIST_ACTOR_ID,
    internalName: input.internalName,
    renderName: input.renderName,
    publicIdentity: input.publicIdentity,
    apparentAge: input.apparentAge,
    outfit: input.outfit,
    demeanor: input.demeanor,
    className: input.className,
    trueNameDisplay: input.trueNameDisplay,
    trueNameStatus: input.trueNameStatus,
    parameters: input.parameters ?? DEFAULT_FATE_PARAMS,
    classSkills: input.classSkills ?? [],
    personalSkills: input.personalSkills ?? [],
    noblePhantasms: input.noblePhantasms ?? [],
    spiritualCore: input.spiritualCore ?? 100,
    mana: input.mana ?? 100,
    spiritualCondition: input.spiritualCondition ?? "现界稳定。",
    masterActorId: input.masterActorId ?? null,
    masterName: input.masterName ?? null,
    contractStatus: input.contractStatus ?? "masterless",
    manaSupply: input.manaSupply ?? "sufficient",
    currentOrder: input.currentOrder ?? "等待玩家行动。",
    publicRoles: input.publicRoles ?? [],
    relationshipToProtagonist: input.relationshipToProtagonist ?? {
      stance: "self",
      summary: "玩家本人。",
    },
    ordinaryItems: input.ordinaryItems ?? [],
  };
}

function assertNewGameInitialized(state: State, input: NewGameInitializationInput): void {
  const protagonist = state.public.actors[PROTAGONIST_ACTOR_ID];
  if (protagonist === undefined) {
    throw new Error("新游戏初始化失败：protagonist actor 不存在。");
  }
  if (state.public.protagonistActorId !== PROTAGONIST_ACTOR_ID) {
    throw new Error("新游戏初始化失败：protagonistActorId 必须是 protagonist。");
  }
  if (state.public.campaign.title.trim().length === 0) {
    throw new Error("新游戏初始化失败：campaign 未配置。");
  }
  if (input.kind === "servant-protagonist") {
    const trueName = protagonist.servantForm?.identity.trueName;
    if (trueName === undefined) {
      throw new Error("新游戏初始化失败：从者 protagonist 缺少 servantForm。");
    }
    if (trueName.status === "revealed") {
      throw new Error("新游戏初始化失败：protagonist 从者开局不得直接 public revealed 真名。");
    }
    if (
      input.hiddenTrueName !== undefined &&
      state.secrets.actorSecrets[PROTAGONIST_ACTOR_ID] === undefined
    ) {
      throw new Error("新游戏初始化失败：隐藏真名未写入 Secret Game State。");
    }
  }
}
