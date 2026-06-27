// ---------------------------------------------------------------------------
// 战斗结算 — 旧入口转发到新管线
// ---------------------------------------------------------------------------

export { executeCombatAction } from "./combat/combat-pipeline.ts";
export type { CombatActionInput, CombatActionResult } from "./combat/models.ts";
export type { CombatantSnapshot, SkillDef } from "./combat/models.ts";
