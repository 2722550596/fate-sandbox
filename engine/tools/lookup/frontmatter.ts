/**
 * 轻量 frontmatter 解析器。
 * 支持 keys: string、keys: [val1, val2]、以及单层嵌套。
 * 不引入外部依赖；复杂的 YAML 场景不在 frontmatter 预期内。
 */

export interface ParsedFrontmatter {
  /** 原始 frontmatter 的键值对 */
  attrs: Record<string, unknown>;
  /** frontmatter 后面的正文（不含开头/结尾空行） */
  body: string;
}

/**
 * 从 markdown 字符串中解析 frontmatter。
 * 返回 null 表示没有 `---` 包裹的 frontmatter。
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter | null {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    return null;
  }

  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) {
    return null;
  }

  const fmBlock = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 3).trimStart();

  const attrs = parseYamlBlock(fmBlock);
  return { attrs, body };
}

function parseYamlBlock(block: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = block.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const valuePart = line.slice(colonIndex + 1).trim();

    if (valuePart.length === 0) continue;

    result[key] = parseYamlValue(valuePart);
  }

  return result;
}

function parseYamlValue(value: string): unknown {
  // 数组: [val1, val2, val3]
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner.length === 0) return [];
    return inner.split(",").map((item) => {
      const trimmed = item.trim();
      return trimmed.startsWith('"') && trimmed.endsWith('"')
        ? trimmed.slice(1, -1)
        : trimmed.startsWith("'") && trimmed.endsWith("'")
          ? trimmed.slice(1, -1)
          : trimmed;
    });
  }

  // 引号包裹的字符串
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  // 数字
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return value.includes(".") ? Number.parseFloat(value) : Number.parseInt(value, 10);
  }

  // 布尔
  if (value === "true") return true;
  if (value === "false") return false;

  // 普通字符串
  return value;
}
