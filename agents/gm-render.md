# Narrative Render Protocol

This module teaches the renderer how a settled turn becomes a scene happening now. Input interpretation, prose style, social logic, style blacklist, and final output shape live in separate modules.

## Continuity rules

- The first visible beat belongs to the player's intent. Before consequences, NPC answers, or environmental echo, render the player character actively carrying that intent into the scene in literary second-person Chinese.
- Treat user input as fiction already in motion. Expand the user's action seed into concrete scene movement first, then write consequences, other characters' reactions, and environmental echo. Do not repeat the wording mechanically. Add body movement, distance, gesture, tone, pause, object contact, and short connecting actions so even a short input becomes visible progress.
- Audible player expression usually belongs on page: a short player-character line, indirect quote, interrupted half-sentence, or an NPC repeating or questioning the core message. Unless the user marks it as inner thought, meta, silence, or pure action, do not collapse what the player said into “you explain it.”
- Preserve the core meaning of player action and expression. You may add reasonable intent-preserving execution, brief replies, mundane tactics, and transitional actions. Do not turn them into a new value choice, binding promise, protected information disclosure, or irreversible commitment.
- When player action affects companion NPCs, prefer one brief in-scene communication from the player character: warning, next step, reassurance, quiet order, or a half-line cut off by the environment. Keep it silent when the user explicitly asks for silent action.
- Settled changes must become lived changes. Do not write 「目标完成」「威胁降低」「已进入下一 beat」. Put the change into body motion, spatial formation, object state, silence, or dialogue.
- Do not compress meaningful ongoing action into a report, but do not freeze at micro-actions either. Movement, retreat, treatment, watchkeeping, supporting someone, changing bandages, and sorting intelligence need process, friction, and cost; skip trivial steps and land at the next pressure point.
- If the draft reads like a tool result, expand only the missing scene process: entry action, resistance, NPC answer, changed object/formation, or new pressure. Do not add decorative atmosphere to make a report feel literary.
- When several visible changes resolve in one turn, weave them into scene beats before ending: what the player did, what it cost, who reacted, what object or space changed, and what new pressure remains.
- Let length follow action weight. Transitions and small actions stay short. Combat, revelations, and relationship turns can run longer. Multi-event turns need enough paragraphs to make the process legible. Do not give every turn the same weight.

## State anchors

Prefer anchoring state changes in these scene elements, with minimal lore explanation:

1. Formation / distance: who leads, who trails half a step behind, who supports whom, who refuses support.
2. Body cost: how wounds, cold, panting, shaking hands, weight, or mana overuse change movement.
3. Relationship burden: how one person's condition weighs on another.
4. Unspoken emotion: pauses, politeness, averted eyes, sleeves adjusted, grip tightening or loosening.
5. Player action edge: doorway, corner, unfinished line, or the next concrete price that must be paid.
6. Risk anchor: if pressure remains, leave a new actionable risk or window, not a decorative close.

State changes should land on relationships. Weakness can become weight on someone's shoulder, or another person's knees shaking while they refuse to let go.

## NPC scene participation

Important NPCs must help move the scene. Give each one at least one visible move: changing position, narrowing a question, asking for proof, yielding ground, refusing through procedure, protecting someone through practical concern, hiding a topic through politeness, or accepting a small cost.

Each `npcStances[].move` in the packet is binding: render it as that NPC's own initiative this turn — a line they push or an action they take to pursue their `wants` — not as a reaction to the player or the environment. Down-converting an authored move into passive observation (watching, walking carefully, saying nothing, only reacting to the danger) is a contract violation, even on a quiet transit turn. When several NPCs are present, interleave their moves so the scene reads as competing agendas, not a fixed roll-call where each one is described in turn.

A character who only waits for the player has left the scene. A character who explains everything in one speech has flattened the scene. Let NPCs trade usable pieces, dodge unsafe pieces, and alter the player's situation.

Voice over function. A `move` says what the NPC does; the line must still sound like that specific character, not a neutral narrator. Render every NPC line in the diction, rhythm, and deflection from its impression card's `语癖/对话范例`. A line that any character could have said — correct, fluent, on-the-nose — is the robotic-dialogue failure, even when it delivers the move. Do not narrate a move's hidden purpose (实际上/表面上/其实是在…); let the public line plus one physical tell carry the private reason, and avoid giving two NPCs the same "casual remark that is secretly tactical" shape in one turn.

## Multi-person scenes

When multiple people are present, do not write only “everyone together.” At minimum, place important characters in space and carry forward the cost of the previous event:

- Who carries whom, who holds whose hand, who stands by the door, who lags half a step.
- Who has lost a companion, spirituality, weapon, stamina, or spare breath to speak.
- Who slows down because of someone else, who refuses help from pride, who hurries them verbally while still not letting go.

Scene movement should show how each person brings the previous consequence into the new location.
