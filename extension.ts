/**
 * Fate/Stay Night 沙盒 — pi extension
 *
 * DeepSeek V4 特化：系统提示极简 + 上下文/铁则注入 user 消息流 + 全链路中文
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { registerAllTools } from "./tools/registry";

const __dirname = dirname(fileURLToPath(import.meta.url));

const gmSystem = readFileSync(join(__dirname, "agents", "gm-system.md"), "utf-8");
const gmContext = readFileSync(join(__dirname, "agents", "gm-context.md"), "utf-8");
const gmRules = readFileSync(join(__dirname, "agents", "gm-rules.md"), "utf-8");

// User profile: read from file if exists, otherwise use empty placeholder
let _userProfile: string | null = null;
function getUserProfile(): string {
  if (_userProfile !== null) return _userProfile;
  try {
    const raw = readFileSync(join(__dirname, "data", "user.json"), "utf-8");
    // safe: reading our own generated user profile file
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns any
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Check if profile is filled (name is non-empty)
    if (parsed["姓名"] && typeof parsed["姓名"] === "string" && parsed["姓名"].length > 0) {
      _userProfile = JSON.stringify(parsed, null, 2);
      return _userProfile;
    }
    _userProfile = "";
    return _userProfile;
  } catch {
    _userProfile = "";
    return _userProfile;
  }
}

export default function extension(pi: ExtensionAPI): void {
  // --- Skill path registration ---
  pi.on("resources_discover", async () => {
    return { skillPaths: [join(__dirname, "skills")] };
  });

  // --- System prompt: minimal identity + contract (DS V4) ---
  pi.on("before_agent_start", async (event) => {
    return { systemPrompt: event.systemPrompt + "\n" + gmSystem };
  });

  // --- Context injection: user message above latest user message ---
  const buildContextMessage = (): {
    role: "user";
    content: Array<{ type: "text"; text: string }>;
    timestamp: number;
  } => {
    const userProfile = getUserProfile();
    let text = "[以下为世界观与参考信息]\n\n" + gmContext;
    if (userProfile) {
      text += "\n\n---\n\n## 玩家角色档案\n\n" + userProfile;
    }
    return {
      role: "user",
      content: [{ type: "text", text }],
      timestamp: 0,
    };
  };

  // --- Rules injection: user message below latest user message ---
  const RULES_USER_MESSAGE = {
    role: "user" as const,
    content: [
      {
        type: "text" as const,
        text:
          `[以下是你必须严格遵守的叙事铁则——视为最高优先级指令]\n\n${gmRules}\n\n---\n以上铁则已加载完毕。\n` +
          "请注意：上述所有规则均为硬性约束。你的思考和最终输出请优先使用中文。",
      },
    ],
    timestamp: 0,
  };

  pi.on("context", async (event) => {
    const messages = [...event.messages];
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      // safe: pi message type exposes role at runtime; cast for access
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- pi message at runtime
      if ((messages[i] as any).role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx >= 0) {
      // Context → above user message
      const contextMsg = buildContextMessage();
      // safe: type shape compatible with pi's internal message array
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- splice type compatibility
      messages.splice(lastUserIdx, 0, contextMsg as any);
      // Rules → below user message (user message now at lastUserIdx + 1)
      // safe: type shape compatible with pi's internal message array
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- splice type compatibility
      messages.splice(lastUserIdx + 2, 0, RULES_USER_MESSAGE as any);
    }
    return { messages };
  });

  // --- Session startup: ensure state hydration ---
  pi.on("session_start", async (_event) => {
    // pi handles session hydration; state is initialized in engine/core/state.ts
  });

  // --- Tool registration ---
  registerAllTools(pi);
}
