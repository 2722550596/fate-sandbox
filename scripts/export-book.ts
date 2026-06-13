/**
 * 成书导出 CLI（backlog #10）。
 *
 * 从 session JSONL 提取 fsn-prose（双 pass 渲染后的干净正文）和
 * 玩家输入，拼装成连续叙事 Markdown / HTML。
 *
 * 用法：
 *   node scripts/export-book.ts [--html] [--no-player] [session.jsonl ...]
 *
 * 不传文件时取 sessions/ 下最新的 .jsonl。
 * --html 输出 HTML 而非 Markdown。
 * --no-player 不包含玩家输入段落。
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { parseSessionJsonl, reconstructActivePath } from "../engine/audit/session-audit.ts";

const SESSIONS_DIR = join(import.meta.dirname, "..", "sessions");
const OUTPUT_DIR = join(import.meta.dirname, "..", "state", "exports");
const PROSE_CUSTOM_TYPE = "fsn-prose";

// ─── entry classification ────────────────────────────────────────

interface BookSegment {
  kind: "prose" | "player";
  text: string;
}

function extractBookSegments(
  entries: readonly ReturnType<typeof parseSessionJsonl>[number][],
  includePlayer: boolean,
): BookSegment[] {
  const segments: BookSegment[] = [];

  for (const entry of entries) {
    // fsn-prose custom message (rendered narrative)
    if (entry.type === "custom_message" && entry.customType === PROSE_CUSTOM_TYPE) {
      const text = extractCustomContent(entry);
      if (text.length > 0) {
        segments.push({ kind: "prose", text });
      }
      continue;
    }

    // Player input
    if (includePlayer && entry.type === "message" && entry.message?.["role"] === "user") {
      const text = extractUserText(entry);
      if (text.length > 0 && !isMetaCommand(text)) {
        segments.push({ kind: "player", text });
      }
    }
  }

  return segments;
}

function extractCustomContent(entry: { content?: unknown }): string {
  if (typeof entry.content === "string") return entry.content.trim();
  return "";
}

function extractUserText(entry: { message?: Record<string, unknown> }): string {
  const content = entry.message?.["content"];
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter(
        (block): block is { type: string; text: string } =>
          typeof block === "object" &&
          block !== null &&
          "type" in block &&
          block.type === "text" &&
          "text" in block &&
          typeof block.text === "string",
      )
      .map((block) => block.text.trim())
      .filter((text) => text.length > 0)
      .join("\n");
  }
  return "";
}

function isMetaCommand(text: string): boolean {
  return /^\/(?:status|inventory|relations|hooks|journal|recap|fuck|bookmark|skill)/i.test(
    text.trim(),
  );
}

// ─── Markdown output ─────────────────────────────────────────────

function buildMarkdown(segments: readonly BookSegment[], sessionName: string): string {
  const lines: string[] = [];
  lines.push(`# ${sessionName}`, "");
  lines.push(`> 导出自 Fate Sandbox session · ${new Date().toISOString().slice(0, 10)}`, "");
  lines.push("---", "");

  for (const segment of segments) {
    if (segment.kind === "player") {
      lines.push(`> **玩家**：${segment.text}`, "");
    } else {
      lines.push(segment.text, "");
    }
    lines.push("---", "");
  }

  return lines.join("\n");
}

// ─── HTML output ─────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToSimpleHtml(text: string): string {
  return text
    .split("\n\n")
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (trimmed.length === 0) return "";
      // Headings
      const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
      if (headingMatch !== null) {
        const level = headingMatch[1]!.length;
        return `<h${level + 1}>${escapeHtml(headingMatch[2]!)}</h${level + 1}>`;
      }
      // Bold
      const html = escapeHtml(trimmed).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return `<p>${html.replace(/\n/g, "<br>")}</p>`;
    })
    .filter((line) => line.length > 0)
    .join("\n");
}

function buildHtml(segments: readonly BookSegment[], sessionName: string): string {
  const body: string[] = [];

  for (const segment of segments) {
    if (segment.kind === "player") {
      body.push(
        `<blockquote class="player"><strong>玩家</strong>：${escapeHtml(segment.text)}</blockquote>`,
      );
    } else {
      body.push(`<section class="prose">${markdownToSimpleHtml(segment.text)}</section>`);
    }
    body.push('<hr class="separator">');
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(sessionName)}</title>
<style>
  :root { --bg: #1a1a2e; --fg: #e0e0e0; --accent: #c9a959; --muted: #888; --card: #222244; }
  body { max-width: 720px; margin: 2em auto; padding: 0 1em; background: var(--bg); color: var(--fg); font-family: "Noto Serif SC", "Source Han Serif SC", Georgia, serif; line-height: 1.8; font-size: 17px; }
  h1, h2, h3 { color: var(--accent); margin: 1.5em 0 0.5em; }
  h1 { font-size: 1.6em; border-bottom: 1px solid var(--accent); padding-bottom: 0.3em; }
  .prose p { margin: 0.8em 0; text-indent: 2em; }
  .prose p:first-child { text-indent: 0; }
  blockquote.player { border-left: 3px solid var(--accent); margin: 1.5em 0; padding: 0.5em 1em; background: var(--card); border-radius: 4px; font-style: italic; }
  hr.separator { border: none; border-top: 1px solid #333; margin: 2em 0; }
  .meta { color: var(--muted); font-size: 0.85em; margin-bottom: 2em; }
</style>
</head>
<body>
<h1>${escapeHtml(sessionName)}</h1>
<p class="meta">导出自 Fate Sandbox session · ${new Date().toISOString().slice(0, 10)}</p>
${body.join("\n")}
</body>
</html>`;
}

// ─── CLI ─────────────────────────────────────────────────────────

function newestSessionFile(): string {
  const files = readdirSync(SESSIONS_DIR)
    .filter((name) => name.endsWith(".jsonl"))
    .toSorted();
  const newest = files.at(-1);
  if (newest === undefined) {
    throw new Error(`export-book: sessions/ 下没有 .jsonl 文件`);
  }
  return join(SESSIONS_DIR, newest);
}

function main(): void {
  const args = process.argv.slice(2);
  const useHtml = args.includes("--html");
  const includePlayer = !args.includes("--no-player");
  const files = args.filter((arg) => !arg.startsWith("--"));
  const sessionPaths = files.length > 0 ? files : [newestSessionFile()];

  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const sessionPath of sessionPaths) {
    const content = readFileSync(sessionPath, "utf-8");
    const entries = reconstructActivePath(parseSessionJsonl(content));
    const segments = extractBookSegments(entries, includePlayer);

    if (segments.length === 0) {
      console.log(`⚠ ${sessionPath}: 没有找到 fsn-prose 正文，跳过。`);
      continue;
    }

    const sessionName = basename(sessionPath, ".jsonl");
    const ext = useHtml ? ".html" : ".md";
    const output = useHtml
      ? buildHtml(segments, sessionName)
      : buildMarkdown(segments, sessionName);

    const outputPath = join(OUTPUT_DIR, `${sessionName}${ext}`);
    writeFileSync(outputPath, output, "utf-8");

    const proseCount = segments.filter((s) => s.kind === "prose").length;
    const playerCount = segments.filter((s) => s.kind === "player").length;
    console.log(`✓ ${outputPath} (${proseCount} 段正文, ${playerCount} 段玩家输入)`);
  }
}

main();
