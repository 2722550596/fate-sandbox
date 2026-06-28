import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

/**
 * 单个 Domain Event Tool 的完整契约：name + description + parameters + execute。
 * 与实现同文件维护；label 是 registry 的统一呈现关注点，注册时由 registry 附加。
 */
export type DomainToolDefinition = Omit<ToolDefinition, "label">;
