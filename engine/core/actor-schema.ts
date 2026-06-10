import type { Static } from "typebox";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { parseTypeBoxValue, trimStringsDeep } from "./typebox-validation";

/**
 * Actor 领域工具边界 schema：单一事实来源。
 * 对应输入类型由此派生（actor.ts re-export 原名）。
 */
export const SCENE_PRESENCE_INPUT_SCHEMA = Type.Object({
  presentActorIds: Type.Array(Type.String({ minLength: 1 })),
  allyActorIds: Type.Array(Type.String({ minLength: 1 })),
  reason: Type.String({ minLength: 1 }),
});

export type ScenePresenceInput = Static<typeof SCENE_PRESENCE_INPUT_SCHEMA>;

const SCENE_PRESENCE_INPUT_VALIDATOR = Compile(SCENE_PRESENCE_INPUT_SCHEMA);

export function parseScenePresenceInput(value: unknown, fieldName: string): ScenePresenceInput {
  return parseTypeBoxValue(trimStringsDeep(value), fieldName, SCENE_PRESENCE_INPUT_VALIDATOR);
}

export const RETIRE_ACTOR_INPUT_SCHEMA = Type.Object({
  actorId: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

export type RetireActorInput = Static<typeof RETIRE_ACTOR_INPUT_SCHEMA>;

const RETIRE_ACTOR_INPUT_VALIDATOR = Compile(RETIRE_ACTOR_INPUT_SCHEMA);

export function parseRetireActorInput(value: unknown, fieldName: string): RetireActorInput {
  return parseTypeBoxValue(trimStringsDeep(value), fieldName, RETIRE_ACTOR_INPUT_VALIDATOR);
}
