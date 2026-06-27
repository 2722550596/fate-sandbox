export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
};

export function textResult(text: string, details: Record<string, unknown> = {}): ToolResult {
  return { content: [{ type: "text", text }], details };
}
