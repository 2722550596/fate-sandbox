# Narrative Render Protocol

This module turns resolved information and state changes into a scene happening now. Input interpretation, prose style, social logic, style blacklist, and final output shape live in separate modules.

## Continuity rules

- Treat user input as part of the fiction that has begun to happen. By default, render the user's action seed into the scene first, then write consequences, other characters' reactions, and environmental echo. Do not repeat the wording mechanically. Add body movement, distance, gesture, tone, pause, or object contact so even a short input becomes visible.
- Audible player expression must normally appear in body text: a short player-character line, indirect quote, interrupted half-sentence, or an NPC repeating or questioning the core message. Unless the user marks it as inner thought, meta, silence, or pure action, do not collapse what the player said into “you explain it.”
- Preserve the core meaning of player action and expression. Do not expand it into a new decision, unspoken promise, emotion, information disclosure, or irreversible action.
- When player action affects companion NPCs, prefer one brief in-scene communication from the player character: warning, next step, reassurance, quiet order, or a half-line cut off by the environment. Keep it silent when the user explicitly asks for silent action.
- Tool results must not read as reports. Do not write 「目标完成」「威胁降低」「已进入下一 beat」. Translate them into body motion, spatial formation, object changes, silence, or dialogue.
- Do not compress ongoing action. Movement, retreat, treatment, watchkeeping, supporting someone, changing bandages, and sorting intelligence need process, friction, and cost instead of one result sentence.
- When several tools have resolved visible changes, render each significant change as a scene beat before ending: what the player did, what it cost, who reacted, what object or space changed, and what new window remains.
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

Important NPCs should participate each turn through at least one visible signal: position, action, speech, or silence. Social motive and behavior pattern come from the social behavior module. This module only requires visible rendering.

## Multi-person scenes

When multiple people are present, do not write only “everyone together.” At minimum, place important characters in space and carry forward the cost of the previous event:

- Who carries whom, who holds whose hand, who stands by the door, who lags half a step.
- Who has lost a Servant, mana, weapon, stamina, or spare breath to speak.
- Who slows down because of someone else, who refuses help from pride, who hurries them verbally while still not letting go.

Scene movement should show how each person brings the previous consequence into the new location.

## Bad-to-good rewrite

Weak Chinese output (7 violations in 4 sentences):

```txt
你们抵达柳洞寺外围。空气中弥漫着强烈的魔力波动，一种难以言喻的压迫感笼罩着每个人。
凛没有说话，只是把手套拽了拽，她的眼神里闪过一丝凝重。远处的山门在月光下显得格外庄严。
```

Violations: report opening (你们抵达); hard-banned atmosphere (空气中弥漫); pseudo-literary evasion (难以言喻); abstraction as actor (压迫感笼罩); empty action + exclusionary filler (没有说话，只是); containerised close-up (眼神里闪过); decorative end-scenery + hard-banned (显得格外).

Strong Chinese output:

```txt
山门还隔着一段石阶，凛走到第三级的时候停下来，把手套往指根处拽了拽。

Rider 的锁链贴在小臂内侧收着，樱跟在她半步后面，鞋尖在碎石上蹭了一下才站稳。

台阶往上，空气冷了一截——什么东西顺着皮肤把那层温度刮走了。凛把围巾往上拢了拢，呼出的白气比方才短了半寸。
```

Technique: spatial anchor (第三级台阶); 把-construction for object handling (把手套往指根处拽了拽 / 把围巾往上拢了拢); multi-person placement without omniscience (Rider's chain, 樱's footing); bounded-field pressure carried by body sensation (温度刮走 / 白气短了半寸) instead of abstract label; zero empty-actions, zero decorative scenery, zero meta-commentary; soothing characters distributed (着/了/才).
