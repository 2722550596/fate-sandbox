# LOTM Migration Context — Type Changes Reference

## Removed Types (do not reference these)

- FateRank, FateRankBase, FateRankRange, FateRankOrUnknown
- NoblePhantasm
- ServantClass, ServantCoreState, ServantIdentityState, TrueNameState
- ServantConditionState, ServantContractState, ServantParameterState
- FateParams, ParamModifier, ServantSkillState, ServantSkill
- MagecraftCapability, MagecraftCircuitState, MagecraftDiscipline
- CommandSpellState, MasterRole
- WoundState, AfflictionState, PermanentEffect, PermanentDefect
- CircuitStatus, ManaSupply, ContractStatus, WoundSeverity

## New/Changed Types

- `ActorKind`: "human" | "beyonder" | "creature" | "other" (was: human/outsider/spirit/other)
  - "outsider" → "beyonder" (no extra fields)
  - "spirit" → "creature" (has `origin` field)
  - "other" stays "other" (has `nature` field)
- `ActorBase`: removed `magecraft` and `servantForm` fields; added `sequence: SequenceState | null`
- `SequenceState`: { currentSequence, rank, pathway, promotionSystem, divinity, digestionProgress, lossOfControlProgress }
- `ConditionState`: `{ statusEffects: StatusEffectState[] }` (was: { wounds, afflictions, permanentEffects })
- `StatusEffectState`: { id, name, type, affectedAttribute, valueType, value, duration, source }
- `ActorRole`: only `SocialRole` and `FactionRole` (removed `MasterRole`)
- `ActorSecretSlots`: `pathwaySecret?` and `sequenceSecret?` (replaced `trueName?` and `hiddenNoblePhantasms`)
- `TurnObligationKind`: "sequence" (replaced "servant-form")
- `LocationState`: added `coordinates: { x: number; y: number } | null`

## Removed Enums

- SERVANT_CLASSES, FATE_PARAM_KEYS, CIRCUIT_STATUSES, MANA_SUPPLIES, CONTRACT_STATUSES, WOUND_SEVERITIES

## New Enums (in state-enum-schemas.ts)

- PATHWAY_IDS: 22 pathways (seer, apprentice, thief, mystery-prayer, spectator, sailor, bard, reader, warrior, sleepless, grave-keeper, hunter, assassin, savant, secret-pryer, monster, apothecary, cultivator, ruffian, arbiter, lawyer, broker, custom)
- SEQUENCE_RANKS: seq-9..seq-0, old-one, pillar, ordinary
- STATUS_EFFECT_TYPES: buff, debuff, risk, flag
- VALUE_TYPES: percentage, fixed
- DAMAGE_TYPES: physical, mystical, mental, mixed
- DIFFICULTY_LEVELS: trivial, ordinary, tricky, near-impossible, blasphemous
- JUDGMENT_OUTCOMES: blessed, perfect, narrow-success, failure, loss-of-control
- PROMOTION_SYSTEMS: potion, other
- ATTRIBUTE_KEYS: vitality, spirituality, reason, humanity, agility, luck

## Changed Enums

- RULE_SET_IDS: lotm-worldview-filter, lotm-judgment-combat, lotm-economy, lotm-sequence-promotion, custom
- TIMELINE_IDS: tingen, backlund, bayam, condat, fifth-epoch-1349, custom
- TIMEZONE_IDS: UTC only
- CURRENCY_CODES: penny, gold-pound, custom
- BOUNDARY_KINDS: normal, sacred-domain, otherworld, sealed
- TRACKED_ITEM_KINDS: mundane, weapon, sealed-artifact, mystical-item, document, key-item, consumable, other

## Schema Version

- Changed from 18 to 1 (LOTM starts fresh)
- STATE_META_SCHEMA uses `Type.Literal(1)`
- CURRENT_STATE_SCHEMA_VERSION = 1

## Deleted Files (do not import from these)

- engine/core/servant.ts, servant-schema.ts, servant.test.ts
- engine/core/fate-rank.ts, fate-rank.test.ts
- engine/core/combat-exchange.ts, combat-exchange-schema.ts, combat-exchange.test.ts
- tools/state/resolve-combat-exchange.ts, resolve-combat-exchange.test.ts
- tools/state/update-servant-form.ts, update-servant-form.test.ts

## actor-schema.ts Changes

- Removed: FATE*RANK*_, NOBLE*PHANTASM*_, SERVANT*SKILL*_, FATE*PARAMS*_, COMMAND*SPELL*_, MASTER*ROLE*_
- Removed: ServantInput, SERVANT_INPUT_SCHEMA, UPSERT_SERVANT variant
- Added: SequenceInput, SEQUENCE_INPUT_SCHEMA, UPSERT_SEQUENCE variant
- ACTOR_REGISTRY_KINDS: "setup-protagonist" | "upsert-public-npc" | "init-npc" | "upsert-sequence"
