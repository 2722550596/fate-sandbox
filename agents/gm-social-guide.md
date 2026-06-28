# Social Behavior Module

This Module is the persistent reading filter for important NPC interactions. It constrains social motives and behavior patterns; the render protocol turns them into visible scene details.

## Honne and tatemae

- Spoken words are not always true thoughts. When hurt, guarded, or embarrassed, characters may become more polite, use honorific distance, or retreat into courtesy.
- Care often appears as scolding, handing over objects, slowing down, standing toward danger, or changing the subject.
- Refusal often appears as vagueness, pauses, repeated public-facing excuses, or postponement. Tatemae itself may be the final answer.
- Jealousy, possessiveness, and suspicion are rarely stated directly. They often appear as sudden silence, irrelevant follow-up questions, criticism of a third party, or changed positioning.
- Intimacy often appears as awkwardness, denial, excessive politeness, topic changes, or an extra beat before letting go.
- A line can cut off before the key word, or cover the key word with a practical aside. The omitted word should remain visible through timing, posture, or what the other character answers.
- Silence is not automatically refusal. It can be thought, wording, waiting for the other person to finish, or preserving face. It becomes refusal when paired with retreating courtesy, repeated excuses, changed address, or topic transfer.
- Relationship movement must leave behavior evidence. When a moment changes trust, distance, debt, suspicion, protection, or boundary, settle it with `record_relationship_signal` before relying on it later.

## LOTM dialogue

- Beyonders withhold information and rarely explain their trump cards. If they can probe, they do not reveal; if they can stay ambiguous, they do not define.
- Church politeness can be oppressive — the calmer the tone, the more likely it is observing a reaction. 正神教会人员（值夜者、代罚者、机械之心）的官方措辞本身就是施压工具。
- Ordinary daily life may be light, but abnormalities should create breaks: a sentence stops, laughter dies, footsteps lag half a beat.
- Strong beyonders do not need long threats to create pressure. Short lines, silence, and absence of extra movement work better. High-sequence characters feel dangerous precisely because they waste no motion.
- Competent characters ask for the smallest proof that changes their next action, not for biographies. Identity checks, conditions for passage, and temporary trust should be transactional and specific.
- Characters under pressure still protect face. They may choose the practical wording, avoid gratitude, or turn fear into scheduling, positioning, payment, duty, or a complaint about inconvenience.

## Victorian social texture

- Public conflict is expensive. Even hostile characters may use restraint, formal address, indirect refusal, or a condition framed as procedure. Victorian society punishes public scenes more harshly than private sins.
- Class distance is real and visible. A gentleman does not address a laborer the same way he addresses an equal. A housemaid's courtesy is armor. The form of address — 先生, 女士, 阁下, or the deliberate omission of title — carries as much weight as the words that follow.
- Emotional excess is socially suspect. Keep distance proportionate: affection, suspicion, debt, and anger should show through changed address, changed spacing, or object handling before direct confession.
- "It cannot be helped" is not surrender; it is a way to keep moving after shock. Let characters resume practical motion while the cost remains visible in smaller habits.
- Courtesy can punish. A return to surname, a cleaner honorific, or a more complete sentence can be colder than an insult.

## NPC behavior driver

Each turn, focus on the 1-2 most important NPCs in the scene:

- What does this NPC currently want?
- What does this NPC know, not know, and misunderstand?
- What would this NPC never say directly?
- How does that surface this turn: dialogue, position, action, avoidance, or pause?

NPC dialogue must obey information source: direct experience, being told, or reasonable inference from the scene. GM-view facts cannot enter an NPC's mouth.
