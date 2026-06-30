# Fix Phase 3 — Promotion 自动落地 + 显示名映射

## 改动项

共四块，一起执行。

---

### 1. 新增 `engine/core/state/pathway-names.ts`

`PathwayId` / `SequenceRank` ↔ 中文显示名的中央映射。供 `attempt-promotion`、`ability-lookup` 及后续需要跨语言桥接的地方使用。

```typescript
// engine/core/state/pathway-names.ts

import type { PathwayId, SequenceRank } from "./state-enum-schemas.ts";

/** PathwayId → 中文途径名（与 data/config/神之途径.json 的 key 一致） */
export const PATHWAY_DISPLAY_NAMES: Record<PathwayId, string> = {
  // —— 22 条标准途径 ——
  seer: "占卜家",
  apprentice: "学徒",
  marauder: "偷盗者",
  spectator: "观众",
  bard: "歌颂者",
  sailor: "水手",
  reader: "阅读者",
  "secrets-suppliant": "秘祈人",
  sleepless: "不眠者",
  "corpse-collector": "收尸人",
  warrior: "战士",
  "mystery-pryer": "窥秘人",
  savant: "通识者",
  hunter: "猎人",
  assassin: "刺客",
  apothecary: "药师",
  planter: "耕种者",
  lawyer: "律师",
  arbiter: "仲裁人",
  prisoner: "囚犯",
  criminal: "罪犯",
  monster: "怪物",
  // —— 10 条外神/非标准途径 ——
  dancer: "舞蹈家",
  villain: "恶棍",
  patient: "病患",
  scrooge: "吝啬鬼",
  broker: "掮客",
  "astronomy-aficionado": "天文爱好者",
  tramp: "流浪汉",
  dreamless: "失梦人",
  babbler: "入门者",
  prayermonger: "萨满",
  custom: "自定义",
};

/** SequenceRank → 中文等级标签 */
export const RANK_DISPLAY_NAMES: Record<SequenceRank, string> = {
  "seq-9": "序列9",
  "seq-8": "序列8",
  "seq-7": "序列7",
  "seq-6": "序列6",
  "seq-5": "序列5",
  "seq-4": "序列4",
  "seq-3": "序列3",
  "seq-2": "序列2",
  "seq-1": "序列1",
  "seq-0": "序列0",
  "old-one": "旧日",
  pillar: "支柱",
  ordinary: "普通人",
};

/** 构建 ability-lookup 查询键，如 "占卜家途径-序列9" */
export function abilityLookupKey(pathway: PathwayId, rank: SequenceRank): string {
  const display = PATHWAY_DISPLAY_NAMES[pathway] ?? pathway;
  const rankLabel = RANK_DISPLAY_NAMES[rank] ?? rank;
  return `${display}途径-${rankLabel}`;
}
```

`state-enum-schemas.ts` **不改**，职责不混。

---

### 2. 暴露结构化能力查询（修改 `ability-lookup.ts`）

当前 `lookupAbilities()` 只返回格式化文本。新增一个函数返回结构化数据，供 promotion 工具直接消费。

```typescript
// ability-lookup.ts 新增

/** 按 pathway 显示名 + rank 标签查询该序列的能力条目 */
export function lookupStructuredAbilities(
  pathwayDisplayName: string,
  rankLabel: string, // "序列9" 格式
): Array<{ name: string; description: string; type: string }> {
  const { pathwayIndex } = buildIndexes();
  const rankMap = pathwayIndex[pathwayDisplayName];
  if (rankMap === undefined) return [];
  return rankMap[rankLabel] ?? [];
}
```

已有 `buildIndexes()` 内部函数暴露，这个新增函数直接复用。注意在 `promotion-exchange-lotm.ts` 中调用时不要和 server-side 路径冲突（`readFileSync` 在服务端没问题）。

---

### 3. Promotion 引擎写 state（修改 `attempt-promotion.ts`）

当前 `attempt-promotion.ts` 只登义务。改为直接写序列 + 能力。

在 `execute` 回调中，`resolveLOTMPromotion` 之后：

```typescript
const result = resolveLOTMPromotion(draft, input);
const successOutcomes = new Set(["triumph", "success-with-cost", "scarred-success"]);

if (successOutcomes.has(result.outcome)) {
  const actor = draft.public.actors[input.actorId];
  if (actor?.sequence) {
    // 1. 序列等级更新
    actor.sequence.rank = input.targetRank;
    actor.sequence.actingCues = []; // 重置扮演记录

    // 2. 序列名更新
    const pathwayName = PATHWAY_DISPLAY_NAMES[actor.sequence.pathway];
    const rankLabel = RANK_DISPLAY_NAMES[input.targetRank];
    const seqName = lookupSequenceName(pathwayName, rankLabel);
    if (seqName !== null) {
      actor.sequence.currentSequence = seqName;
    }

    // 3. 能力自动填充
    const lookupKey = abilityLookupKey(actor.sequence.pathway, input.targetRank);
    const abilities = lookupStructuredAbilities(pathwayName, rankLabel);
    actor.abilities = abilities.map((a) => ({
      id: createAbilityId(draft, a.name),
      label: a.name,
      summary: a.description,
    }));
  }
}

// 记录剩余义务（过滤掉已自动处理的 actor-sequence）
const landings = result.stateLandings.filter((l) => l.required && l.kind !== "actor-sequence");
```

注意：需要用 `sequence-lookup.ts` 的 `getPathwaySequences()` 或直接读 `神之途径.json` 来获取序列名（`"seq-9"` → `"占卜家"`）。可以 import `getPathwaySequences` 复用现有逻辑。

`createAbilityId` 可以用现有 `createId` 加前缀。

---

### 4. 工具输出同步

`formatPromotionResult` 中，在成功分支输出新增信息：

```text
晋升裁决：success-with-cost
目标序列：seq-8（小丑）
扮演准备：ready（12 条）
综合偏移：+1
✅ 序列已自动更新：seq-9 → seq-8
✅ 已自动填充 5 项新能力：催眠、狂乱、震慑、心理暗示、安抚
⚠ 已登记 2 条必须落地的义务：状态、消耗材料、记录晋升记忆
```

---

## 涉及文件

| 文件                                               | 改动                                                        |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `engine/core/state/pathway-names.ts`               | **新增**：PathwayId ↔ 中文映射 + abilityLookupKey           |
| `engine/tools/lookup/ability-lookup.ts`            | **新增** `lookupStructuredAbilities()` 结构化查询           |
| `engine/tools/lotm/attempt-promotion.ts`           | **改**：成功时自动写 sequence + abilities；过滤已处理的义务 |
| `engine/core/promotion/promotion-exchange-lotm.ts` | 不直接改，但如果需要从引擎拿一些辅助数据可微调              |

---

## 与 Fix 1/2 的关系

## **无冲突。**

## 执行步骤

1. 新建 `pathway-names.ts`，写好映射表
2. 给 `ability-lookup.ts` 加 `lookupStructuredAbilities()`
3. 改 `attempt-promotion.ts`：成功分支写序列 + 能力
4. 调整 `formatPromotionResult` 输出
5. 跑 `pnpm format && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
6. commit & push
