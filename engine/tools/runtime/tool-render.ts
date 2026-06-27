import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Markdown, Text, truncateToWidth } from "@earendil-works/pi-tui";

/**
 * 所有 Domain Event Tool 共用的结果渲染：注册时由 registry 统一附加。
 *
 * 折叠态（默认，ctrl-O 收起）只显示首行摘要 + 行数，避免大块 GM brief / lookup
 * 结果摊满屏幕；展开态（ctrl-O）用 Markdown 渲染完整 text。工具本身仍返回扁平
 * text（喂给 LLM 的契约不变），这里只接管 TUI 呈现。
 */
type ToolResultRenderer = NonNullable<ToolDefinition["renderResult"]>;

/** 折叠态首行的最大显示宽度（列）；超出按显示宽度截断并加省略号。 */
const SUMMARY_DISPLAY_WIDTH = 100;

/**
 * 从工具 text 抽折叠态摘要：第一条非空行 + 有效行数（忽略尾部空行）。
 * 纯函数，渲染逻辑的可测核心。
 */
export function summarizeToolText(text: string): { firstLine: string; lineCount: number } {
  const lines = text.split("\n");
  const firstLine = lines.find((line) => line.trim().length > 0)?.trim() ?? "";
  let lineCount = lines.length;
  while (lineCount > 0 && (lines[lineCount - 1] ?? "").trim().length === 0) {
    lineCount -= 1;
  }
  return { firstLine, lineCount };
}

export const renderDomainToolResult: ToolResultRenderer = (result, options, theme, _context) => {
  const fullText = result.content.map((part) => (part.type === "text" ? part.text : "")).join("");

  if (options.isPartial) {
    return new Text(theme.fg("warning", "执行中…"), 0, 0);
  }

  if (options.expanded) {
    return new Markdown(fullText, 0, 0, getMarkdownTheme());
  }

  const { firstLine, lineCount } = summarizeToolText(fullText);
  const summary = firstLine.length > 0 ? firstLine : "（无文本输出）";
  const clipped = truncateToWidth(summary, SUMMARY_DISPLAY_WIDTH, "…");
  const suffix = lineCount > 1 ? theme.fg("dim", ` (${lineCount} 行)`) : "";
  return new Text(theme.fg("toolOutput", clipped) + suffix, 0, 0);
};
