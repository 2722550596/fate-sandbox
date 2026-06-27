import type { TLocalizedValidationError } from "typebox/error";

import type { Percent } from "../state/state.ts";

import { normalizeIsoInstant } from "../state/date-time.ts";

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
  const convertedRaw = validator.Convert(cloneValidationInput(value, fieldName));
  assertNoUnsafeCoercion(value, convertedRaw, fieldName);
  const converted = validator.Clean(convertedRaw);
  if (validator.Check(converted)) {
    return converted;
  }
  throw new Error(formatTypeBoxValidationErrors(fieldName, validator.Errors(converted), converted));
}

/**
 * Convert 后的定向白名单守卫，只允许信息无损的 LLM 容错转换：
 * - 字符串 → 数字/布尔（"3" → 3，对齐 assertInteger 接受整数字符串的既有立场）
 * - 标量 → 单元素数组包装（"x" → ["x"]，见 initialize-new-game 的 revealConditions 测试）
 * 其余类型变化是 Value.Convert 的过度宽容：null → "null"、number → string 等
 * 会把坏输入改名上桌，必须按字段路径拒绝。
 */
function assertNoUnsafeCoercion(original: unknown, converted: unknown, path: string): void {
  if (jsonTypeOf(original) !== jsonTypeOf(converted)) {
    assertAllowedTypeChange(original, converted, path);
    return;
  }
  if (Array.isArray(original) && Array.isArray(converted)) {
    const length = Math.max(original.length, converted.length);
    for (let index = 0; index < length; index++) {
      assertNoUnsafeCoercion(original[index], converted[index], `${path}[${index}]`);
    }
    return;
  }
  if (isRecord(original) && isRecord(converted)) {
    const keys = new Set([...Object.keys(original), ...Object.keys(converted)]);
    for (const key of keys) {
      assertNoUnsafeCoercion(original[key], converted[key], `${path}.${key}`);
    }
  }
}

/** 类型发生变化时的白名单裁决；不在白名单内一律按字段路径拒绝。 */
function assertAllowedTypeChange(original: unknown, converted: unknown, path: string): void {
  const originalType = jsonTypeOf(original);
  const convertedType = jsonTypeOf(converted);
  if (originalType === "string" && (convertedType === "number" || convertedType === "boolean")) {
    return;
  }
  const isScalarWrap =
    originalType !== "object" && Array.isArray(converted) && converted.length === 1;
  if (isScalarWrap) {
    assertNoUnsafeCoercion(original, converted[0], `${path}[0]`);
    return;
  }
  throw new Error(
    `非法 ${path}: 类型 ${originalType} 不会被隐式转换为 ${convertedType}；请传入正确类型的值。`,
  );
}

type JsonValueType =
  | "null"
  | "undefined"
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "other";

function jsonTypeOf(value: unknown): JsonValueType {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean" || type === "object") {
    return type;
  }
  return "other";
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
  source: unknown,
): string {
  if (errors.length === 0) {
    return `非法 ${fieldName}: schema 校验失败。`;
  }
  const merged = mergeUnionErrors(errors);
  const messages = merged.map((entry) =>
    entry.branches === null
      ? formatTypeBoxValidationError(fieldName, entry.summary)
      : formatMergedUnionError(fieldName, entry.summary, entry.branches, source),
  );
  return `非法 ${fieldName}: ${messages.join("；")}。`;
}

interface MergedUnionEntry {
  /** null = standalone error; non-null = union summary with collapsed branch errors. */
  branches: TLocalizedValidationError[] | null;
  summary: TLocalizedValidationError;
}

/**
 * 折叠 anyOf/oneOf 汇总：每条汇总错误回头吸收紧邻的、同 instancePath 的分支级错误，
 * 输出端只显示一条合并消息，而不是 [branch1, branch2, summary] 三条噪声。
 * 顺序保持原样：汇总落在它原本的位置，被吸收的子错误就地消失。
 */
function mergeUnionErrors(errors: readonly TLocalizedValidationError[]): MergedUnionEntry[] {
  const result: MergedUnionEntry[] = [];
  for (const error of errors) {
    if (error.keyword !== "anyOf" && error.keyword !== "oneOf") {
      result.push({ branches: null, summary: error });
      continue;
    }
    const branches: TLocalizedValidationError[] = [];
    while (result.length > 0) {
      const last = result[result.length - 1];
      if (
        last !== undefined &&
        last.branches === null &&
        last.summary.instancePath === error.instancePath
      ) {
        branches.unshift(last.summary);
        result.pop();
        continue;
      }
      break;
    }
    result.push({ branches, summary: error });
  }
  return result;
}

function formatMergedUnionError(
  fieldName: string,
  summary: TLocalizedValidationError,
  branches: readonly TLocalizedValidationError[],
  source: unknown,
): string {
  const path = formatValidationPath(fieldName, summary.instancePath);
  const actualType = jsonTypeOf(getValueByInstancePath(source, summary.instancePath));
  if (branches.length === 0) {
    // 没有分支级前置错误（异常情况）—— 退回原汇总文案，至少标注实际类型。
    const connector = summary.keyword === "oneOf" ? "只匹配一种结构" : "匹配其中一种结构";
    return `${path} 必须${connector}（实际收到 ${actualType}）`;
  }
  const branchDescs = branches.map(describeUnionBranch);
  const allTypeBranches = branches.every((b) => b.keyword === "type");
  if (allTypeBranches) {
    return `${path} 必须是 ${branchDescs.join(" 或 ")}，实际收到 ${actualType}`;
  }
  const separator = summary.keyword === "oneOf" ? "或（且仅一种）" : "或";
  return `${path} 必须是 ${branchDescs.join(` ${separator} `)}，实际收到 ${actualType}`;
}

function describeUnionBranch(error: TLocalizedValidationError): string {
  switch (error.keyword) {
    case "type":
      return formatExpectedType(error.params.type);
    case "required":
      return `包含 ${error.params.requiredProperties.join(", ")} 的对象`;
    case "const":
      return formatAllowedValue(error.params.allowedValue);
    case "enum":
      return `${formatAllowedValues(error.params.allowedValues)} 之一`;
    case "minLength":
      return `长度 >= ${error.params.limit} 的字符串`;
    case "additionalProperties":
      return `不含额外字段 ${error.params.additionalProperties.join(", ")} 的对象`;
    default:
      return error.message;
  }
}

/**
 * 把 instancePath（RFC 6901 JSON Pointer）解析到 source 上，用于报告实际类型。
 * source 取自 Convert+Clean 之后的值，与 Errors() 报路径一致。
 */
function getValueByInstancePath(source: unknown, instancePath: string): unknown {
  if (instancePath.length === 0) {
    return source;
  }
  const segments = instancePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(unescapeJsonPointerSegment);
  let current: unknown = source;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current)) {
      current = current[Number(segment)];
      continue;
    }
    if (isRecord(current)) {
      current = current[segment];
      continue;
    }
    return undefined;
  }
  return current;
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
