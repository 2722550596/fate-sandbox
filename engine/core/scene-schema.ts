import type { Static } from "typebox";

import type { TypeBoxValidator } from "./typebox-validation.ts";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  SCENE_THREAT_SEVERITY_SCHEMA,
  SITUATION_KIND_SCHEMA,
  stringEnumSchema,
} from "./state-enum-schemas.ts";
import { LOCATION_STATE_SCHEMA } from "./turn-time-schema.ts";
import { parseTaggedTypeBoxUnion, trimStringsDeep } from "./typebox-validation.ts";

/**
 * Scene 领域事件的工具边界 schema：单一事实来源。
 * SceneEvent 类型由此派生（scene.ts re-export 原名）。
 */
export const SCENE_EVENT_KINDS = [
  "set-location",
  "set-situation",
  "set-story-window",
  "clear-story-window",
  "add-objective",
  "resolve-objective",
  "add-threat",
  "clear-threat",
] as const;
const SCENE_EVENT_KIND_SCHEMA = stringEnumSchema(SCENE_EVENT_KINDS);

export const STORY_WINDOW_STATE_SCHEMA = Type.Object({
  currentArcId: Type.String({ minLength: 1 }),
  currentBeatId: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  allowedActions: Type.Array(Type.String({ minLength: 1 })),
  forbiddenEscalations: Type.Array(Type.String({ minLength: 1 })),
  completionCriteria: Type.Array(Type.String({ minLength: 1 })),
  nextBeatHints: Type.Array(Type.String({ minLength: 1 })),
});

export const SET_LOCATION_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("set-location"),
  location: LOCATION_STATE_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export const SET_SITUATION_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("set-situation"),
  situation: SITUATION_KIND_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export const SET_STORY_WINDOW_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("set-story-window"),
  storyWindow: STORY_WINDOW_STATE_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export const CLEAR_STORY_WINDOW_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("clear-story-window"),
  reason: Type.String({ minLength: 1 }),
});

export const ADD_OBJECTIVE_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-objective"),
  summary: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

export const RESOLVE_OBJECTIVE_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("resolve-objective"),
  objectiveId: Type.Optional(Type.String({ minLength: 1 })),
  objectiveSummary: Type.Optional(Type.String({ minLength: 1 })),
  reason: Type.String({ minLength: 1 }),
});

export const ADD_THREAT_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("add-threat"),
  summary: Type.String({ minLength: 1 }),
  severity: SCENE_THREAT_SEVERITY_SCHEMA,
  reason: Type.String({ minLength: 1 }),
});

export const CLEAR_THREAT_EVENT_SCHEMA = Type.Object({
  kind: Type.Literal("clear-threat"),
  threatId: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
});

export type SceneEvent =
  | Static<typeof SET_LOCATION_EVENT_SCHEMA>
  | Static<typeof SET_SITUATION_EVENT_SCHEMA>
  | Static<typeof SET_STORY_WINDOW_EVENT_SCHEMA>
  | Static<typeof CLEAR_STORY_WINDOW_EVENT_SCHEMA>
  | Static<typeof ADD_OBJECTIVE_EVENT_SCHEMA>
  | Static<typeof RESOLVE_OBJECTIVE_EVENT_SCHEMA>
  | Static<typeof ADD_THREAT_EVENT_SCHEMA>
  | Static<typeof CLEAR_THREAT_EVENT_SCHEMA>;

const SCENE_EVENT_KIND_VALIDATOR = Compile(SCENE_EVENT_KIND_SCHEMA);
const SET_LOCATION_EVENT_VALIDATOR = Compile(SET_LOCATION_EVENT_SCHEMA);
const SET_SITUATION_EVENT_VALIDATOR = Compile(SET_SITUATION_EVENT_SCHEMA);
const SET_STORY_WINDOW_EVENT_VALIDATOR = Compile(SET_STORY_WINDOW_EVENT_SCHEMA);
const CLEAR_STORY_WINDOW_EVENT_VALIDATOR = Compile(CLEAR_STORY_WINDOW_EVENT_SCHEMA);
const ADD_OBJECTIVE_EVENT_VALIDATOR = Compile(ADD_OBJECTIVE_EVENT_SCHEMA);
const RESOLVE_OBJECTIVE_EVENT_VALIDATOR = Compile(RESOLVE_OBJECTIVE_EVENT_SCHEMA);
const ADD_THREAT_EVENT_VALIDATOR = Compile(ADD_THREAT_EVENT_SCHEMA);
const CLEAR_THREAT_EVENT_VALIDATOR = Compile(CLEAR_THREAT_EVENT_SCHEMA);

// 注意：Compile 必须在独立常量上调用，不能内联在带 satisfies 的对象字面量里——
// 上下文类型会干扰泛型推导，把 Validator 退化成 unknown。
const SCENE_EVENT_VARIANT_VALIDATORS = {
  "set-location": SET_LOCATION_EVENT_VALIDATOR,
  "set-situation": SET_SITUATION_EVENT_VALIDATOR,
  "set-story-window": SET_STORY_WINDOW_EVENT_VALIDATOR,
  "clear-story-window": CLEAR_STORY_WINDOW_EVENT_VALIDATOR,
  "add-objective": ADD_OBJECTIVE_EVENT_VALIDATOR,
  "resolve-objective": RESOLVE_OBJECTIVE_EVENT_VALIDATOR,
  "add-threat": ADD_THREAT_EVENT_VALIDATOR,
  "clear-threat": CLEAR_THREAT_EVENT_VALIDATOR,
} satisfies Record<SceneEvent["kind"], TypeBoxValidator<SceneEvent>>;

export function parseSceneEvent(value: unknown, fieldName: string): SceneEvent {
  return parseTaggedTypeBoxUnion<SceneEvent["kind"], SceneEvent>(
    trimStringsDeep(value),
    fieldName,
    "kind",
    SCENE_EVENT_KIND_VALIDATOR,
    SCENE_EVENT_VARIANT_VALIDATORS,
  );
}
