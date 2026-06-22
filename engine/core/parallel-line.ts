import type {
  OffscreenEventSource,
  OffscreenEventVisibility,
  TimelineId,
} from "./state-enum-schemas.ts";

export type { OffscreenEventSource, OffscreenEventVisibility } from "./state-enum-schemas.ts";

export type ParallelLineOutcome = "no-change" | "progress" | "escalation" | "blocked";

export interface ParallelLineTimeWindow {
  start: string;
  end: string;
}

export interface ParallelLinePressureSlotHint {
  id: string;
  label: string;
  pressureType: string;
  actorOrFactionHints: string[];
  playerSafeProjectionKinds: string[];
  cooldownTurns: number;
  recentUses?: number;
  coolingDown?: boolean;
  forbiddenWhen: string[];
}

export interface ParallelLineRecentEvent {
  lineId: string;
  actorIds: string[];
  pressureType: string;
  summary: string;
}

export interface ParallelLineInput {
  lineId: string;
  timelineId: TimelineId;
  genreContract: string;
  activePressurePalette: ParallelLinePressureSlotHint[];
  timeWindow: ParallelLineTimeWindow;
  currentArc: string;
  currentBeat: string;
  allowedScope: string[];
  forbiddenEscalations: string[];
  knownFacts: string[];
  privateFacts: string[];
  actorGoals: string[];
  previousLineState: string;
  playerSideSummary: string;
  recentOffscreenEvents?: ParallelLineRecentEvent[];
  excludedActorIds?: string[];
  excludedPressureTypes?: string[];
  preferredPressureType?: string;
  majorBeatEnd?: boolean;
  arcTransition?: boolean;
}

export type ParallelLineToneDriftRisk = "none" | "watch" | "drifting";

export interface ParallelLineOutput {
  lineId: string;
  timelineId: TimelineId;
  actorIds: string[];
  timeRange: ParallelLineTimeWindow;
  outcome: ParallelLineOutcome;
  privateSummary: string;
  secretStateChanges: string[];
  publicLeakCandidates: string[];
  futureHooks: string[];
  toneDriftRisk: ParallelLineToneDriftRisk;
  genreFitNotes: string[];
  riskFlags: string[];
  optionalNarrativeSnippet: string | null;
}

export interface OffscreenEvent {
  id: string;
  lineId: string;
  actorIds: string[];
  timeRange: ParallelLineTimeWindow;
  visibility: OffscreenEventVisibility;
  summary: string;
  consequences: string[];
  futureHooks: string[];
  createdFrom: OffscreenEventSource;
  /** canonical 后台压力类型（来自 pressure palette slot 或分类器），驱动 cooldown/多样性纪律 */
  pressureType: string;
  /** 来源 pressure palette slot id；无对应 slot 时为 null */
  pressureSlotId: string | null;
}
