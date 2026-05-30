# Fate Sandbox

A Fate tabletop-style sandbox where the game master maintains a consistent campaign across long play, multiple possible player identities, and hidden/revealed supernatural facts.

## Language

**Game State**:
The authoritative set of campaign facts that have mechanical or continuity consequences. It is physically split into Public Game State and Secret Game State so player-facing tools and the GM Brief cannot accidentally access hidden truth.
_Avoid_: Prompt state, status text, world book

**Public Game State**:
The player-safe slice of Game State. The GM Brief and player-facing status tools are derived only from this slice.
_Avoid_: Filtered dump, visible state

**Secret Game State**:
The hidden slice of Game State. It stores hidden patches and truth slots for entities whose player-safe skeletons live in Public Game State; only Private Resolution tools may read it.
_Avoid_: Hidden fields, secret prompt, duplicate actor state

**Player-Safe Skeleton**:
The public version of an actor or campaign object that can appear in the GM Brief without leaking hidden truth. Actor skeletons live in the Public Actor Registry, and Secret Game State may attach hidden truth slots to them by Actor ID.
_Avoid_: Public copy, filtered entity

**Public Actor Registry**:
The set of actors materialized into the current campaign state because they are the protagonist, present in the scene, allied, or have campaign-specific changes worth tracking. It is not the world character database.
_Avoid_: Known characters, character book, NPC database

**Protagonist**:
The actor currently played by the user. Protagonist is a role assigned by `protagonistActorId`, not a separate actor kind; the protagonist may be any actor with or without Servant Form.
_Avoid_: Player type, protagonist entity

**Master**:
A contractual role held by an actor who commands or supplies a Servant. Master is not an actor kind; humans, magi, or other actors can hold or lose the Master role.
_Avoid_: Master actor type, player class

**Magus**:
A social identity and magecraft capability, not an actor kind. A human, outsider, or other actor may have magecraft circuits, disciplines, and affiliation without changing what kind of being they are.
_Avoid_: Magus actor type, species

**Spirit**:
An actor kind for a non-physical or spirit-bodied actor such as a heroic spirit, ghost, wraith, or familiar. Spirit is narrower than Servant Form: a spirit may lack Servant Form, and a human or outsider may have Servant Form.
_Avoid_: Servant, any supernatural being

**Servant Form**:
A spiritual form attached to an actor who is manifesting through a Servant-style Saint Graph, class container, Noble Phantasms, and mana supply. Servant Form is not an actor kind; humans, outsiders, spirits, or other actors may have or lack it.
_Avoid_: Servant actor type, species

**Servant Resource**:
A numeric internal resource track for Servant Form, such as spiritual core integrity or mana reserve. Tools may calculate with percentages, but GM Brief and narration normally expose only qualitative bands.
_Avoid_: Public HP bar, visible SP meter

**Condition**:
An actor's current injuries, afflictions, and permanent effects. Condition does not include a universal HP score; Servant Form, magecraft circuits, and other forms carry their own mechanical condition when needed.
_Avoid_: Body HP, health percentage, generic status meter

**Accessible Funds**:
The money currently available to the protagonist in play, including held cash, shared funds, or funds requiring another actor's permission. It is not a complete model of every actor's wealth.
_Avoid_: Global money, player cash

**Tracked Item**:
An important item materialized into Game State because it can move between holders, be contested, break, hide, carry mystery, or become a memory reference. Ordinary possessions remain in actor inventory and are not tracked individually.
_Avoid_: Full item database, every pocket item

**Campaign Memory**:
The player-known memory of the campaign: stable facts, major events, and daily summaries the protagonist has experienced or learned. Hidden events and private motives belong in Secret Game State, not Campaign Memory.
_Avoid_: Full event log, secret memory, compaction summary

**Relationship to Protagonist**:
A player-known relationship summary from an actor to the protagonist, used for GM Brief and tool decisions. It is not a full social graph; non-protagonist mechanical relationships use dedicated structures such as Master role and Servant contract.
_Avoid_: Affection meter, relationship graph

**Scene Objective**:
A short-lived objective active in the current scene. It has an ID for tool updates but is not a campaign-wide quest record.
_Avoid_: Quest, long-term goal

**Scene Threat**:
An immediate pressure or danger active in the current scene. Long-term danger belongs in Campaign Memory or actor state, not as a standing scene threat.
_Avoid_: Global danger level, threat database

**Locked Fact**:
A fact that cannot be changed by ordinary play tools once established. The lock lives with the object that owns the fact, not in a global lock list.
_Avoid_: Global lock registry, rule note

**Domain Event Tool**:
A tool that changes Game State by applying a constrained domain event to an aggregate, rather than accepting raw object patches. Domain event tools protect schema boundaries and return player-safe narrative constraints.
_Avoid_: Patch tool, raw update, replace object

**Revelation**:
A domain event that moves hidden truth from Secret Game State into Public Game State. Ordinary reveal tools accept player-facing claims and evidence, not secret IDs; the tool internally matches and validates whether anything is revealed.
_Avoid_: Secret ID reveal, manual public copy

**Player-Known Fact**:
A campaign fact the player character can currently rely on in play. Player-known facts may be narrated, summarized, and used directly when answering the player.
_Avoid_: Public fact, visible variable

**Hidden Fact**:
A campaign fact that is true in the campaign but not yet known to the player character. Hidden facts stay out of the GM Brief by default and enter play only through tools that perform private resolution.
_Avoid_: Secret prompt, spoiler state

**Private Resolution**:
A tool-mediated operation that can consult Hidden Facts without exposing them in the GM Brief. It returns player-safe constraints or outcomes rather than the hidden truth itself.
_Avoid_: Hidden prompt injection, spoiler brief

**GM Brief**:
A short per-turn operational summary for the game master. It is derived from Game State but is not itself the Game State.
_Avoid_: State dump, JSON snapshot, status panel

## Example dialogue

Dev: Archer's true name is known to the campaign, but the player has not discovered it. Is that in Game State?
Domain expert: Yes. Public Game State contains Archer's player-safe skeleton with true name marked hidden; Secret Game State contains the true-name slot keyed by Archer's actor ID.

Dev: The player saw Saber use Excalibur. What changes?
Domain expert: The relevant Hidden Fact becomes a Player-Known Fact, and future narration may refer to the revealed Noble Phantasm directly.

Dev: The player is roleplaying a Servant. Do we need a special ProtagonistServant type?
Domain expert: No. The actor has Servant Form, and `protagonistActorId` marks that actor as the protagonist. Protagonist is a role, and Servant Form is not an actor kind.

Dev: Rin is both a magus and Archer's Master. Are either of those her actor kind?
Domain expert: No. Rin is a human actor with magecraft capability and a Master role. If the contract ends, she loses the Master role without ceasing to be a magus.

Dev: Mash is human but uses a Shielder Saint Graph. Is she a Servant actor?
Domain expert: No. She is a human actor with Servant Form.

Dev: A normal human breaks a rib. Do we subtract body HP?
Domain expert: No. Add a wound to Condition. Universal body HP is not part of actor Condition.

Dev: Saber spends mana on a Noble Phantasm. Do we show the exact SP percentage?
Domain expert: No, not in normal narration or the GM Brief. Tools may track the internal Servant Resource percentage, but player-facing text should use qualitative bands unless explicitly inspecting status.

Dev: The protagonist is a Servant and Rin pays for dinner. Is that the protagonist's money?
Domain expert: No. It is Accessible Funds owned by Rin, with access controlled by permission or agreement.

Dev: Rin lends the protagonist her gem case. Is that just inventory text?
Domain expert: No, because it can move between holders and matters mechanically. Materialize it as a Tracked Item.

Dev: Archer privately suspects something about Shirou. Does that go into Campaign Memory?
Domain expert: No. Campaign Memory is player-known. Private suspicion belongs in Secret Game State; public memory can only record that Archer showed an unexplained reaction if the protagonist observed it.

Dev: Do we need a full relationship graph for Rin and Archer?
Domain expert: No. Public actors store their Relationship to Protagonist. Rin-Archer's contract is represented by Master role and Servant contract, not a general graph edge.

Dev: The current goal is to leave Ryuudou Temple without alerting patrols. Is that Campaign Memory?
Domain expert: No. It is a Scene Objective. If its consequences matter after the scene, record the outcome in Campaign Memory.

Dev: Do we need a global list of locked facts?
Domain expert: No. Locked Facts live on the object that owns them, such as Servant identity or base parameters. A brief can derive a lock summary when needed.

Dev: Should tools submit replacement actor objects?
Domain expert: No. Ordinary play tools submit Domain Events such as add wound, spend mana, reveal secret, or move scene. Raw object replacement is debug-only.

Dev: The player claims Archer is a future Shirou. Does the GM pass a secret ID to reveal it?
Domain expert: No. The GM submits the player-facing claim and evidence. The reveal tool matches hidden slots internally and either reveals, foreshadows, or refuses without leaking the truth.

Dev: Archer sees Shirou use projection magic. Should the GM know Archer's full hidden truth?
Domain expert: No. Use Private Resolution for a hidden reaction. It returns player-safe narrative constraints, not Archer's secret identity or full motive.
