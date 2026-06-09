export interface StringEnumErrorOptions {
  style?: "allowed-values" | "must-be";
}

export function assertOneOfString<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fieldName: string,
  options: StringEnumErrorOptions = {},
): T[number] {
  const trimmed = typeof value === "string" ? value.trim() : null;
  if (trimmed !== null) {
    for (const candidate of allowed) {
      if (trimmed === candidate) {
        return candidate;
      }
    }
  }
  throw new Error(formatOneOfStringError(value, allowed, fieldName, options));
}

export function assertOptionalOneOfString<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fieldName: string,
  options: StringEnumErrorOptions = {},
): T[number] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertOneOfString(value, allowed, fieldName, options);
}

function formatOneOfStringError(
  value: unknown,
  allowed: readonly string[],
  fieldName: string,
  options: StringEnumErrorOptions,
): string {
  if (options.style === "must-be") {
    return `${fieldName} 必须是 ${formatHumanAllowedValues(allowed)}。`;
  }
  if (typeof value !== "string") {
    return `${fieldName} 必须是字符串。允许值: ${allowed.join(", ")}。`;
  }
  return `非法 ${fieldName}: ${JSON.stringify(value.trim())}。允许值: ${allowed.join(", ")}。`;
}

function formatHumanAllowedValues(allowed: readonly string[]): string {
  if (allowed.length <= 1) {
    return allowed.join("");
  }
  const head = allowed.slice(0, -1).join("、");
  const last = allowed[allowed.length - 1];
  if (last === undefined) {
    throw new Error("unreachable empty allowed values");
  }
  return `${head} 或 ${last}`;
}
