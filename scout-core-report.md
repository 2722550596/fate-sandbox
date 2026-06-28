# Scout Report: Fate 残留扫描 — `engine/core/`

**排除目录**: combat/, campaign/
**扫描目录**: actor/, backstage/, economy/, inventory/, knowledge/, ledger/, scene/, state/, turn/, utils/

---

## 🔴 红色（设计/功能完全是 Fate 特有）

### 1. `backstage/backstage-director-persona.ts`（全文件，约 340 行）

**严重程度: 🔴 高**

整个 `BACKSTAGE_DIRECTOR_PERSONA` 是 Fate/月世界专用的平行线后台推进代理人格。内含：

- **Timeline IDs 硬编码 Fate 作品**（行 14 附近接口定义）：
  `"fz"`, `"fsn"`, `"case-files"`, `"fsf"`, `"extra"`, `"extra-ccc"`, `"mahoyo"`, `"kara-no-kyoukai"`, `"tsukihime-2000"`, `"tsukihime-2021"`
- **Canon hook palette 全是 Fate 剧情**（行 14 后半）：Master/Servant 夜巡、圣杯战争势力、柳洞寺/教会异常、三大家族动向、月之圣杯战争等
- **Fate 特有概念遍布全人格**：Servant、Master、prana、bounded field、Holy Grail、command spell、noble phantasm、three families、pale rider、False Grail 等
- 首行自称 `backstage-world subagent for the Fate sandbox`

**结论**: 这是最核心的 Fate 设计残留。如果 LOTM 不再需要 Fate 后台平行线机制，整个文件需要重写或移除。如果保留 backstage 机制但适配 LOTM，则 timelineId、canon hook palette、genre contract 全部需要替换。

---

### 2. `state/state-file-projection.ts`（行 268-279）

**严重程度: 🔴 高**

`classifyPressureType()` 函数包含正则模式，将 Fate 从者/职阶关键词映射到 LOTM 压力类型：

```typescript
// 行 268-273 — Fate 魔术概念映射到 "magecraft-infrastructure"
/workshop|bounded field|leyline|familiar|caster|工房|结界|灵脉|使魔|术式|非凡者|序列|魔药/

// 行 275-279 — Fate 从者/职阶映射到 "beyonder-activity"
/servant|saber|archer|lancer|rider|caster|assassin|berserker|从者|英灵|宝具|真名/
```

**问题**: 这个分类函数设计上要处理 Fate 内容（servant 类、从者、英灵、宝具、真名），但 LOTM 世界不应该产出这些概念。如果后续 offscreen event 不产生 Fate 内容，这些正则匹配分支就是死代码。但如果 GM 仍然注入 Fate 内容，这会让系统错误地将 Fate 概念分类到 LOTM 压力类型。

**注意**: "assassin" 在此文件中是 Fate 职阶语境（行 276），但 `state-enum-schemas.ts:171` 中 "assassin" 是 LOTM 通识途径（刺客）— 后者属 🟢 无害。

---

## 🟡 黄色（命名/测试数据残留）

### 3. `state/session-persistence.ts:10`

```typescript
const SESSION_KEY = "fsn-state";
```

"fsn" = Fate/stay night 缩写。这是 pi session storage 的 key 名称——不影响运行时语义，但命名残留。

---

### 4. `knowledge/memory.test.ts` — 多个测试点

所有测试数据使用 Fate 角色/设定：

| 行      | 内容                           | Fate 概念          |
| ------- | ------------------------------ | ------------------ |
| 14      | `"玩家确认自己是御主。"`       | 御主 (Master)      |
| 29      | `"玩家与 Saber 缔结契约。"`    | Saber (从者)       |
| 30      | `"玩家成为御主。"`             | 御主               |
| 47      | `"凛确认 Caster 正在柳洞寺。"` | 凛、Caster、柳洞寺 |
| 58      | `"凛确认 Caster 正在柳洞寺。"` | 同上               |
| 72-78   | `"卫宫士郎与远坂凛..."`        | 卫宫士郎、远坂凛   |
| 94,99   | `"凛确认 Caster 正在柳洞寺。"` | 同上               |
| 114     | `"士郎猜测 Caster..."`         | 士郎、Caster       |
| 119     | `"士郎猜测 Caster..."`         | 同上               |
| 138,143 | `"凛确认 Caster 正在柳洞寺。"` | 同上               |

---

### 5. `knowledge/memory-recall.test.ts` — 多个测试点

| 行     | 内容                                         | Fate 概念            |
| ------ | -------------------------------------------- | -------------------- |
| 40     | `"Fought Lancer at school"`                  | Lancer (从者)        |
| 47     | `"Met Kotomine at church"`                   | Kotomine 言峰        |
| 52     | `keywords: ["Lancer", "church"]`             | Lancer               |
| 64     | `"Master of Archer"`                         | Master/Archer        |
| 71     | `"Matou family member"`                      | Matou 间桐家         |
| 90-91  | `"grail", "Holy Grail War rules"`            | 圣杯、圣杯战争       |
| 98-99  | `"Tohsaka heir"`                             | Tohsaka 远坂家       |
| 118    | `"Sensed bounded field near Ryuudou Temple"` | 结界、柳洞寺         |
| 时间戳 | 全部用 `2004-01-30`                          | 第五次圣杯战争时间线 |

---

### 6. `backstage/*.test.ts` — 测试点中的 Fate 残留

| 文件                                | 行                | 内容                                                                                                | Fate 概念            |
| ----------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------- | -------------------- |
| `backstage-brief.test.ts`           | 16,19             | `"bl-caster-ryudou"`, `"caster-ryudou"`                                                             | Caster·柳洞寺        |
| `backstage-spawn.test.ts`           | 8,26              | `"bl-caster-ryudou"`                                                                                | Caster               |
| `backstage-session-read.test.ts`    | 53,59,62,85       | `"fsn-session-read-"`, `"bl-archer"`, `"fsn-nonexistent-dir-xyz"`                                   | fsn、Archer          |
| `backstage-obligation.test.ts`      | 101               | `"Caster 推进了结界。"`                                                                             | Caster               |
| `backstage-director-prompt.test.ts` | 14,29,39,46,51,58 | `"caster-ryudou"`, `"Caster secretly drains townsfolk prana"`, `"hidden grail corruption codeword"` | Caster、prana、grail |

---

### 7. `utils/typebox-validation.test.ts:30`

```typescript
function validSample(): Record<string, unknown> {
  return { name: "saber", count: 3, enabled: true, note: null, tags: ["servant"] };
}
```

测试数据使用 "saber" 和 "servant" 作为字段值。

---

### 8. `actor/actor-agenda.test.ts:89`

```typescript
forbiddenKnowledge: ["hidden true name"],
```

"hidden true name" 是 Fate 宝具真名 (noble phantasm true name) 概念在测试中的残留。该测试验证 `upsertActorKnowledgeLens` 的去重功能，语义上不影响 LOTM——但术语源自 Fate。

---

## 🟢 绿色（无害，专为 LOTM 设计）

以下目录/文件中未发现任何 Fate 残留：

- `actor/` — 核心文件（`actor.ts`, `actor-condition.ts`, `actor-agenda.ts`, `actor-impression.ts`, `secret-actor-state.ts`）🟢
- `economy/` — 经济系统，纯 LOTM（penny 货币体系、账户管理）🟢
- `inventory/` — tracked item 系统，LOTM 通用 🟢
- `ledger/` — turn obligation 账本，设计通用 🟢
- `scene/` — Scene Beat lifecycle，LOTM 适用 🟢
- `turn/` — 时间推进、turn commit、turn log，LOTM 适用 🟢
- `utils/` — ids、rng、typebox-validation、string-enum，通用工具 🟢
- `backstage/` 源码文件（非测试）：`backstage-brief.ts`, `backstage-pending.ts`, `backstage-spawn.ts`, `backstage-session-read.ts`, `backstage-obligation.ts`, `backstage-substrate-config.ts`, `faction-clock.ts`, `parallel-line-assembler.ts`, `parallel-line-output-schema.ts`, `parallel-line.ts`, `backstage-director-prompt.ts` — 机制本身是通用的（平行线后台推进），但 `backstage-director-prompt.ts` 内部组合了 `BACKSTAGE_DIRECTOR_PERSONA`（见 🔴 #1）🟡（受 persona 影响；文件本身设计通用）

注意: `state/state-enum-schemas.ts:171` 中 `"assassin"` 是 LOTM 序列 9 途径之一（刺客），不属 Fate 🟢。

---

## 汇总表

| 文件                                      | 类型    | 问题                                                      |
| ----------------------------------------- | ------- | --------------------------------------------------------- |
| `backstage/backstage-director-persona.ts` | 🔴 红色 | 整个人格是 Fate 专用的平行线代理                          |
| `state/state-file-projection.ts:268-279`  | 🔴 红色 | classifyPressureType 含 servant/职阶/从者等 Fate 正则分支 |
| `state/session-persistence.ts:10`         | 🟡 黄色 | `SESSION_KEY = "fsn-state"` 命名残留                      |
| `knowledge/memory.test.ts` (多处)         | 🟡 黄色 | 测试数据用 Saber/Caster/御主/凛/士郎等 Fate 角色          |
| `knowledge/memory-recall.test.ts` (多处)  | 🟡 黄色 | 测试数据用 Lancer/Master/Archer/grail/Holy Grail War 等   |
| `backstage/*.test.ts` (多处)              | 🟡 黄色 | 测试数据用 caster-ryudou/bl-archer/fsn/prana/grail        |
| `utils/typebox-validation.test.ts:30`     | 🟡 黄色 | 测试数据用 "saber" 和 "servant"                           |
| `actor/actor-agenda.test.ts:89`           | 🟡 黄色 | 测试数据用 "hidden true name"（宝具真名）                 |
| **所有其余文件**                          | 🟢 绿色 | 无 Fate 残留                                              |

---

## 处理建议优先级

1. **🔴 `backstage-director-persona.ts`** — 最重大残留。决定：是保留 backstage 机制重写为 LOTM 人格，还是整个移除？当前人格依赖 Fate 特有的圣杯战争/Servant/Master 世界观。
2. **🔴 `state-file-projection.ts:268-279`** — 删除或更新 classifyPressureType 中的 Fate 正则分支，避免死代码或错误分类。
3. **🟡 测试文件** — 替换测试数据中的 Fate 专有名词为 LOTM 语境下的占位数据。
4. **🟡 `session-persistence.ts:10`** — `fsn-state` → `lotm-state` 或泛化命名。
