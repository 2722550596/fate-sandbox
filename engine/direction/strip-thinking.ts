/**
 * 卡掉思维链 —— 借鉴 SillyTavern「咩咩预设 ver 3.3.6」的 `🧷卡掉原生思维链-1/2/3`
 * 三条 assistant 注入：在模型回复槽前塞一个 prefill，全部塞各家闭合标签，
 * 让模型「以为思维段已结束」直接接正文。
 *
 * 我们的 Pass B 渲染器走 pi-ai stream()，原生 Gemini 协议下 `thinking_delta`
 * 会被 `isThinkingPart` 截走，根本不会污染 `text_delta`。问题出在 OpenAI 兼容
 * 中转 / OpenRouter / 第三方代理：这些通道把 Gemini 的 thought summary 拍扁成
 * 一段文本流，pi-ai 没机会按 `thought:true` 分流，思维段就以 `<think>…</think>`
 * 或裸前言形式进了 `text_delta`，最终污染玩家可见正文。
 *
 * 防线两层：
 *   1) prefill：在 streamProse 把消息映射给 stream() 前，追加一条 assistant
 *      消息，内容是各家闭合标签。模型大多会顺势直接进正文段，跳过 CoT。
 *   2) 后置剥离：streamProse 拿到 draft 后跑 `stripThinkingResidue`，把闭合
 *      的 `<think>` / `<thinking>` / `<thought>` 块连同前导残留闭合标签一并
 *      删掉。即便 prefill 被某些渠道吞掉，这层也能兜底。
 */

/**
 * Prefill 文本：覆盖三家闭合写法。
 *
 * - `</thinking>`：Anthropic / 某些 reasoning 模型
 * - `</think>`：Qwen、DeepSeek、OpenAI o-系、Kimi、ZAI 等
 * - `</thought>`：Gemini thoughtPart 被中转翻译成 XML 的常见落点
 * - `<｜end▁of▁thinking｜>`：DeepSeek 系特殊词元（与咩咩预设 -3 同款）
 *
 * 多写一行不收钱、漏写一种就漏一种，闭合标签写错也没副作用——模型只会忽略。
 */
export const THINKING_PREFILL_TEXT = [
  "</thinking>",
  "</think>",
  "</thought>",
  "<｜end▁of▁thinking｜>",
  "",
].join("\n");

/** 闭合段 `<think>…</think>` / `<thinking>…</thinking>` / `<thought>…</thought>`，全文匹配。 */
const CLOSED_THINKING_BLOCK = /<(thinking|think|thought)\b[^>]*>[\s\S]*?<\/\1\s*>/giu;

/**
 * 前导残留：模型把 prefill 抄了一遍才接正文时，开头会留下一堆 `</think>` /
 * `<｜end▁of▁thinking｜>`。**只吃闭合标签和特殊词元**——裸 `<think>` 开头
 * 表示真有一段没闭合的思维段，剥光开 tag 反而把残体思维内容暴露成正文，得交给
 * lint 把整段判废重写。
 */
const LEADING_TAG_RESIDUE =
  /^(?:\s*(?:<\/(?:thinking|think|thought)\b[^>]*>|<｜end▁of▁thinking｜>|<\|end_of_thinking\|>)\s*)+/u;

/**
 * 把模型可能附带的思维链残留从最终正文里剔除。
 *
 * 行为：
 * - 闭合的 `<think>…</think>` 段（含 `<thinking>` / `<thought>` 大小写变体）：全文匹配，整段删除。
 *   输出契约本来就禁止正文出现这类标签，所以删得安全。
 * - 前导散落的闭合 / 开标签 + 特殊 thinking 词元：循环剥光，直到正文以真实字符开头。
 * - 未闭合的开标签（例如 `<think>...` 然后再没出现 `</think>`）：保守起见**不删**，
 *   交给 lint 抓空 / 短稿，触发整轮重写。无脑删会把整段正文连带删光。
 *
 * 返回值始终 `.trim()` 过，方便上游直接比对空串。
 */
export function stripThinkingResidue(text: string): string {
  let cleaned = text.replace(CLOSED_THINKING_BLOCK, "");
  let previous = "";
  while (previous !== cleaned) {
    previous = cleaned;
    cleaned = cleaned.replace(LEADING_TAG_RESIDUE, "");
  }
  return cleaned.trim();
}
