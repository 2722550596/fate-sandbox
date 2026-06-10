import type { TLocalizedValidationError } from "typebox/error";

import type { Percent } from "./state";

import { normalizeIsoInstant } from "./date-time";

const MIN_PERCENT = 0;
const MAX_PERCENT = 100;

export interface TypeBoxValidator<T> {
  Convert(value: unknown): unknown;
  /** 剔除 schema 未声明的多余字段，对齐旧手写 normalizer 重建对象的 strip 语义。 */
  Clean(value: unknown): unknown;
  Check(value: unknown): value is T;
  Errors(value: unknown): TLocalizedValidationError[];
}

export function parseTaggedTypeBoxUnion<Kind extends string, Variant extends { kind: Kind }>(
  value: unknown,
  fieldName: string,
  tagField: string,
  kindValidator: TypeBoxValidator<Kind>,
  variantValidators: Record<Kind, TypeBoxValidator<Variant>>,
): Variant {
  const input = assertRecordForValidation(value, fieldName);
  const kind = parseTypeBoxValue(input[tagField], `${fieldName}.${tagField}`, kindValidator);
  return parseTypeBoxValue(value, fieldName, variantValidators[kind]);
}

export function parseTypeBoxValue<T>(
  value: unknown,
  fieldName: string,
  validator: TypeBoxValidator<T>,
): T {
  const converted = validator.Clean(validator.Convert(cloneValidationInput(value, fieldName)));
  if (validator.Check(converted)) {
    return converted;
  }
  throw new Error(formatTypeBoxValidationErrors(fieldName, validator.Errors(converted)));
}

/**
 * 递归 trim 所有字符串值，返回新结构（不改原值）。
 * 在 parseTypeBoxValue 之前调用，保持旧手写 assertString 的 trim 语义：
 * 纯空白字符串 trim 后会被 minLength: 1 拒绝。
 */
export function trimStringsDeep(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map(trimStringsDeep);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, trimStringsDeep(entry)]),
    );
  }
  return value;
}

function assertRecordForValidation(value: unknown, fieldName: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} 必须是对象。`);
  }
  return value;
}

/** 共享的 record 类型守卫：全仓唯一定义，不要再复制粘贴。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertPercent(value: unknown, fieldName: string): Percent {
  const percent = assertInteger(value, fieldName);
  if (percent < MIN_PERCENT || percent > MAX_PERCENT) {
    throw new Error(`非法${fieldName}: ${percent}。必须在 0-100 之间。`);
  }
  return percent;
}

export function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是字符串。`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`非法${fieldName}: 不能为空。`);
  }
  return trimmed;
}

export function assertOptionalString(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }
  return assertNonEmptyString(value, fieldName);
}

export function assertIsoDateString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是 ISO 时间字符串。`);
  }
  return normalizeIsoInstant(value, fieldName);
}

export function assertNonNegativeInteger(value: unknown, fieldName: string): number {
  const integer = assertInteger(value, fieldName);
  if (integer < 0) {
    throw new Error(`非法${fieldName}: ${integer}。不能为负数。`);
  }
  return integer;
}

export function assertInteger(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  throw new Error(`非法${fieldName}: ${formatUnknown(value)}。必须是整数。`);
}

export function formatUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return `无法序列化的值 (${String(error)})`;
  }
}

function cloneValidationInput(value: unknown, fieldName: string): unknown {
  try {
    return structuredClone(value);
  } catch (error) {
    throw new Error(`无法复制 ${fieldName} 用于 schema 校验: ${String(error)}`, { cause: error });
  }
}

function formatTypeBoxValidationErrors(
  fieldName: string,
  errors: readonly TLocalizedValidationError[],
): string {
  if (errors.length === 0) {
    return `非法 ${fieldName}: schema 校验失败。`;
  }
  const messages = errors.map((error) => formatTypeBoxValidationError(fieldName, error));
  return `非法 ${fieldName}: ${messages.join("；")}。`;
}

function formatTypeBoxValidationError(fieldName: string, error: TLocalizedValidationError): string {
  const path = formatValidationPath(fieldName, error.instancePath);
  switch (error.keyword) {
    case "enum":
      return `${path} 必须是允许值之一: ${formatAllowedValues(error.params.allowedValues)}`;
    case "const":
      return `${path} 必须等于 ${formatAllowedValue(error.params.allowedValue)}`;
    case "required":
      return `${path} 缺少必填字段: ${error.params.requiredProperties.join(", ")}`;
    case "type":
      return `${path} 类型必须是 ${formatExpectedType(error.params.type)}`;
    case "minLength":
      return `${path} 长度不能少于 ${error.params.limit}`;
    case "pattern":
      return `${path} 必须匹配格式 ${error.params.pattern}`;
    case "minimum":
    case "maximum":
    case "exclusiveMinimum":
    case "exclusiveMaximum":
      return `${path} 必须满足 ${error.params.comparison} ${error.params.limit}`;
    case "additionalProperties":
      return `${path} 不允许额外字段: ${error.params.additionalProperties.join(", ")}`;
    case "anyOf":
      return `${path} 必须匹配其中一种结构`;
    case "oneOf":
      return `${path} 必须只匹配一种结构`;
    default:
      return `${path} ${error.message}`;
  }
}

function formatValidationPath(fieldName: string, instancePath: string): string {
  if (instancePath.length === 0) {
    return fieldName;
  }
  const segments = instancePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(unescapeJsonPointerSegment);
  return segments.reduce((path, segment) => {
    if (/^\d+$/.test(segment)) {
      return `${path}[${segment}]`;
    }
    return `${path}.${segment}`;
  }, fieldName);
}

function unescapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function formatAllowedValues(values: readonly unknown[]): string {
  return values.map(formatAllowedValue).join(", ");
}

function formatAllowedValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function formatExpectedType(type: string | readonly string[]): string {
  return typeof type === "string" ? type : type.join(" / ");
}
