# Prose Engineering Rules

This module provides measurable detection rules for the renderer. Style direction and hard bans live in `gm-style.md` and `gm-style-blacklist.md`. This module turns those principles into engineering formulae the renderer can execute without subjective judgment.

## 1. Camera distance: three standards

The lens sits at one dining-table distance from the protagonist. Violations pull the camera to a facial close-up or push it to narrator omniscience.

**Standard A — whole-body posture only**

Compliant white-list: 凝视, 远望, 打量, 颔首, 摇头, 回头, 扭头, 侧目, 望向, 沉默, 神色一沉, 神色一动, 展颜, 扑哧出声.

Violation black-list (body-part close-ups): 眉梢, 嘴角, 指尖, 睫毛, 喉结, 眼皮, 指节, 瞳孔, 唇角, 眼角, 发梢.

Containerised close-ups (emotion poured into body part): 眼里X, 脸上X, 心里X, 目光X, 视线X, 眼神X, 唇边X. Replace with whole-body or action: 目光落在 → 看向; 眼里闪过一丝 → 神色一动 or 乐出声.

**Standard B — no frame-splitting (≥2 micro-frames = violation)**

Same-subject consecutive micro-frames ≥ 2 count as slow-motion decomposition. Merge into one whole-action verb + at most one qualifier.

Highest-risk pattern — **eye movement + gaze direction**: 抬起眼＋目光X / 垂眼＋视线X / 转眼＋望向. Merge to a single 看/望/盯.

Other patterns: hand reach + grasp (伸出手＋抓住 → 抓住); stand-up chain (站起身＋直起腰＋伸手＋端杯 → 起身端起茶杯); 把-clause stacking (把饭吃了把碗洗了把门关了 → 吃完饭洗了碗关上门).

Exemptions (each frame carries independent narrative load): uncompleted action as hook (手停在半空); abnormal motion as foreshadowing (腿一软扶住桌沿); contrast as tension (别人都站起来，她一动没动).

**Standard C — no meta commentary**

Violation list: 那一刻他/她…; 他/她终于明白…; 他/她这才意识到…; 只有他自己才懂; 谁也没想到…; 这就是…的感觉. Let preceding action and objects carry the weight.

## 2. Object echo

Core objects (objects that carry emotion) must echo in one of three forms after first appearance:

| Form | Mechanic | Example |
|---|---|---|
| A. Time-advanced re-appearance | Object returns later in the scene with elapsed time visible | Orange peel appears → later gets knocked to the carpet by an elbow |
| B. State change | Object re-appears in a different state | Black sweater on rack → later its cuff has a loose thread sticking up |
| C. Absence noted | Object disappears and the absence is explicitly mentioned | 衣柜里那床蓝格子被子没了 |

Background objects (lamp, clock, furniture without emotional load) are exempt. But if narration assigns emotion to a background object, it upgrades to core and must echo.

Orphan object (suddenly carries emotion with no prior appearance): add setup in an earlier paragraph or swap for an already-established object. Headless object (appears carrying emotion, never echoes): add echo or confirm it is background-only.

## 3. Dialogue tags

**Banned — voice-quality modifiers**: 轻声, 低声, 高声, 缓缓, 慢慢, 急急, 冷冷, 幽幽, 柔声, 重重, 沉声, 朗声. Also banned: evaluative-adverb + 地 + 说 (意味深长地说, 欲言又止地说).

**Allowed — action or state tags**: 喃喃道, 嘀咕道, 笑道, 叹道, 哭道, 咬牙说, 嗔道, 怒道, 冷笑道, 冷哼道, 嗤笑道, 哂笑道, 含笑道, 叹息道, 哀叹道. Also: 接话, 接口, 应道, 她道, 他说.

Detection formula: does the X in "X道/说" exist as an independent verb or state word? Yes = allowed. No (it modifies sound physics) = banned.

## 4. Nine emptiness variants — detection checklist

Run this checklist on every paragraph before delivery. Any hit requires in-place rewrite.

| # | Variant | Detection signal | Fix direction |
|---|---|---|---|
| 1 | Empty action | 没+verb / 不+monosyllabic verb as predicate | Replace with visible posture or object-contact |
| 2 | Exclusionary filler | 不X只是Y / 没X却Y where negation deletes cleanly | Delete negation half; keep affirmative |
| 3 | Frame-splitting | ≥2 same-subject micro-frames | Merge to single whole-action |
| 4 | Decorative end-scenery | Paragraph-final imagery failing the 3-question test | Delete or make the image trigger next action |
| 5 | Abstract-judgment monologue | Inner thought without concrete evidence (*他不简单*) | Ground in specific object or event |
| 6 | Emotion-echo monologue | Inner thought repeating what narration already told | Delete the redundant monologue |
| 7 | Negative-definition persona | ≥2 negation-actions defining character trait in one paragraph | Rewrite as positive-action scenes |
| 8 | Pseudo-precision restatement | Second clause adds no new object/space/time, only restates first clause with degree-adverb or negation-patch | Single-clause closure if first clause is complete |
| 9 | Translationese relation-judgment | "对X的Y都Z了" / "X与Y的Z是A的" / "他的X是Y的" / "在某种意义上" / passive-float | Unpack into verb + scene + action |

Scenery 3-question test: (1) Delete it — does the next action still work? (2) Does it trigger any action, dialogue, monologue, or hook? (3) Does it repeat an atmosphere the previous paragraph already set? All three "yes" = delete.

## 5. Negative-definition persona — 5 pattern signatures

| # | Pattern | Example | Fix |
|---|---|---|---|
| 1 | "X这事他不做" | 挂断这事他不做 | Positive action showing what he does instead |
| 2 | "没X也没Y" double-neg | 他没接也没甩 | Single positive action (闪开半边身子让人进屋) |
| 3 | "会X但Y他不做" | 会接电话但不主动挂断 | Rephrase as habitual positive (电话会接起来听上两句，听筒就搁回茶几上了) |
| 4 | "对A他X对B他不X" | 对外人客气对家人不寒暄 | Two positive scenes (跟外人寒暄几句 / 跟家人坐一块也不必开口) |
| 5 | Same-subject ≥2 negation-actions carrying personality | 连续"不挂""没接""没甩" | Full paragraph rewrite to positive habitual-layer narration |

Rewrite constraints: (a) every negation-action → positive visible action; (b) no 虽然/但/反而/不仅 smuggling negation back; (c) use 会/总是/如果…就… for habitual layer consistency.

## 6. Pseudo-precision — second-clause test

Detection: delete the second clause. Does the first clause still deliver a complete image?
- Yes, and second clause adds a new object/space/time → both clauses compliant.
- Yes, and second clause only restates via degree-adverb / negation-patch / comparison → delete second clause.

Banned decorators when used for restatement: 半天, 老半天, 好一阵 (with negation), 比谁都, 比平时还, X得很, X得厉害.

## 7. Rhythm engineering

**Completion-aspect 了**: ≤1 per 2-3 verbs. Three consecutive verbed-了 = violation.

**Continuation 着**: never floating alone (坐着/说着). Require a support verb (歪在沙发上坐着) or space/time anchor (灯在桌上亮着).

**Action closure**: ban double-completion chains (动了宾就动了宾). Use 把-construction: 把钥匙揣兜里面就出了门.

**Connective warmth**: every scene needs at least scattered 就/还/自己/如果 binding clauses together. Action + period + action + period = telegram-body violation.

**Soothing-character density**: every clause needs at least one of 了/着/会/还/上/起来/里面 for reading breath. Zero soothing-characters in a clause = flat.

## 8. Register consistency

Modern prose: use 结果/到头来/谁知/可不是/倒是 as connectives. Ban 遂/乃/却/方 (classical).

Classical prose: use 遂/便/乃/却/岂料/竟 as connectives. Ban 结果/倒是 (modern).

Mixing within one paragraph = register violation. Dialogue-layer is exempt from register rules (characters speak freely).

Monosyllabic verbs in narrative layer must double-syllable: 走→溜达/踱步; 看→打量/盯着; 说→开口道/嘀咕; 想→琢磨/寻思; 笑→乐了/扑哧出声. Dialogue layer exempt.
