import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";

import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import { exportStateTool } from "./debug/export-state";
import { getStateSchemaTool } from "./debug/get-state-schema";
import { switchToolsetTool } from "./debug/switch-toolset";
import { lookupTool } from "./lookup/lookup";
import { getStatusTool } from "./state/get-status";
import { patchStateTool } from "./state/patch-state";
import { resolveCheckTool } from "./state/resolve-check";
import { resolveConsequenceTool, type ConsequenceToolDetails } from "./state/resolve-consequence";
import { resolveDailyTool } from "./state/resolve-daily";

interface DailyToolDetails {
  dailyActivity: string;
  durationMinutes: number;
  pressureSummary: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConsequenceToolDetails(value: unknown): value is ConsequenceToolDetails {
  if (typeof value !== "object" || value === null) return false;
  return (
    "actionType" in value &&
    "riskLevel" in value &&
    "pressureSummary" in value &&
    typeof value["actionType"] === "string" &&
    typeof value["riskLevel"] === "string" &&
    typeof value["pressureSummary"] === "string"
  );
}

function isDailyToolDetails(value: unknown): value is DailyToolDetails {
  if (typeof value !== "object" || value === null) return false;
  return (
    "dailyActivity" in value &&
    "durationMinutes" in value &&
    "pressureSummary" in value &&
    typeof value["dailyActivity"] === "string" &&
    typeof value["durationMinutes"] === "number" &&
    typeof value["pressureSummary"] === "string"
  );
}

export function registerAllTools(pi: ExtensionAPI): void {
  const toolLabel = "FSN 沙盒";

  pi.registerTool({
    label: toolLabel,
    name: "get_status",
    description:
      "查看玩家角色的当前状态（金钱、位置、身体、时间、疲劳、魔力负担、危险度）。\n\n" +
      "【必须调用的场景】\n" +
      "- 需要确认玩家当前持有金钱、所在位置或身体状况时\n" +
      "- 需要确认时间、疲劳、魔力负担或危险度时\n" +
      "- 玩家询问「我现在有多少钱」「我在哪」「我身体怎么样」「现在几点」「危险吗」时\n\n" +
      "【严禁的行为】\n" +
      "- 凭记忆叙述任何状态数值——你的内部记忆不可靠\n" +
      "- 编造位置信息、时间压力或安全程度——以工具返回的状态为准",
    parameters: Type.Object({}),
    execute: async () => getStatusTool(),
  });

  pi.registerTool({
    label: toolLabel,
    name: "patch_state",
    description:
      "修改玩家状态。用于确定性状态变化；风险/耗时/疲劳/魔力负担优先用 resolve_consequence 结算。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家获得/消费金钱时\n" +
      "- 玩家移动到新地点时\n" +
      "- 玩家受伤/治愈时\n" +
      "- resolve_consequence 以外的确定性状态修正\n\n" +
      "【严禁的行为】\n" +
      "- 修改受保护路径以外的任意字段（会被拒绝）\n" +
      "- 叙事中提到状态变化但不调用此工具——必须先 tool call 再叙事\n" +
      "- 用裸 patch 逃避风险/后果结算；高风险行动必须先 resolve_consequence\n\n" +
      "参数 ops 为 JSON Patch 数组，每个 op 包含:\n" +
      '- op: "replace"（通常用这个）\n' +
      '- path: "/金钱" | "/当前位置" | "/身体状态" | "/时间/当前时间" | "/疲劳" | "/魔力负担" | "/危险度"\n' +
      "- value: 新值",
    parameters: Type.Object({
      ops: Type.Array(
        Type.Object({
          op: Type.Union([Type.Literal("replace")], {
            description: "操作类型——一般用 replace",
          }),
          path: Type.String({
            description: "路径，如 /金钱、/当前位置、/身体状态、/时间/当前时间、/疲劳",
          }),
          value: Type.Unknown({ description: "新值；数字字段可传 number 或整数字符串" }),
        }),
        { description: "JSON Patch 操作数组" },
      ),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      patchStateTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "resolve_consequence",
    description:
      "结算玩家行动造成的时间推进、疲劳、魔力负担和危险度。职责是防止高风险行动被写成免费、无代价。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家采取可能产生风险、耗时、疲劳或魔力消耗的行动\n" +
      "- 战斗、潜入、调查、施法、逃跑、长距离移动、夜间行动\n" +
      "- 吃饭、上课、坐车、闲聊、等待等 30 分钟以上的日常过渡（用「日常」）\n" +
      "- 休息、睡眠、医疗、魔术治疗、安全屋整备、补魔等恢复行为；恢复也会推进时间\n" +
      "- 任何你想写成「暂时安全」「没有代价」的场景，必须先调用本工具确认\n" +
      "- 玩家试图用一句话、善意或临场觉悟化解危机时\n\n" +
      "【严禁的行为】\n" +
      "- 不调用本工具就叙述高风险行动无后果\n" +
      "- 自行决定行动没有疲劳/时间/魔力成本\n" +
      "- 把治疗/休息写成免费瞬间满血\n" +
      "- 忽略工具返回的叙事约束",
    parameters: Type.Object({
      actionType: Type.Union(
        [
          Type.Literal("移动"),
          Type.Literal("调查"),
          Type.Literal("社交"),
          Type.Literal("日常"),
          Type.Literal("潜入"),
          Type.Literal("战斗"),
          Type.Literal("魔术"),
          Type.Literal("逃跑"),
          Type.Literal("休息"),
          Type.Literal("睡眠"),
          Type.Literal("医疗"),
          Type.Literal("魔术治疗"),
          Type.Literal("安全屋整备"),
          Type.Literal("补魔"),
        ],
        { description: "本轮玩家行动类型" },
      ),
      riskLevel: Type.Union(
        [Type.Literal("低"), Type.Literal("中"), Type.Literal("高"), Type.Literal("致命")],
        {
          description: "本轮行动风险等级",
        },
      ),
      durationMinutes: Type.Union([Type.Integer(), Type.String()], {
        description: "行动预计耗时，1-1440 分钟；可传整数或整数字符串",
      }),
      isPublic: Type.Boolean({ description: "是否可能被普通人、监控、组织记录或目击" }),
      involvesMystery: Type.Boolean({
        description: "是否涉及魔术、从者、宝具、结界、异常现象等神秘",
      }),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      resolveConsequenceTool(params, ctx.sessionManager),

    renderCall(args: unknown, theme: Theme): Text {
      const record = isRecord(args) ? args : {};
      const actionType = typeof record["actionType"] === "string" ? record["actionType"] : "?";
      const riskLevel = typeof record["riskLevel"] === "string" ? record["riskLevel"] : "?";
      const minutes =
        typeof record["durationMinutes"] === "string" ||
        typeof record["durationMinutes"] === "number"
          ? String(record["durationMinutes"])
          : "?";
      const text =
        theme.fg("toolTitle", theme.bold("结算 ")) +
        theme.fg("accent", actionType) +
        theme.fg("muted", " · ") +
        theme.fg("warning", riskLevel) +
        theme.fg("muted", " · ") +
        theme.fg("dim", `${minutes}min`);
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded }, theme, _context) {
      const details = isConsequenceToolDetails(result.details) ? result.details : undefined;
      const pressureSummary = details?.pressureSummary ?? "?";
      const actionType = details?.actionType ?? "?";
      const riskLevel = details?.riskLevel ?? "?";

      if (!expanded) {
        const compact =
          theme.fg("accent", actionType) +
          theme.fg("muted", " · ") +
          theme.fg("warning", riskLevel) +
          theme.fg("muted", "  ") +
          theme.fg("dim", pressureSummary);
        return new Text(compact, 0, 0);
      }

      const text = result.content[0];
      return new Text(text?.type === "text" ? text.text : "", 0, 0);
    },
  });

  pi.registerTool({
    label: toolLabel,
    name: "resolve_daily",
    description:
      "结算日常过渡造成的时间推进和轻微疲劳/恢复。用于把吃饭、上课、通勤、闲聊、等待等低风险生活段落从叙事里落到状态时间轴上。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家进行吃饭、上课、通勤、购物、洗澡、等待、闲聊、整理房间、普通休息等日常行动\n" +
      "- 任何 10 分钟以上的低风险生活过渡\n" +
      "- 你准备写「过了一会儿」「放学后」「吃完饭后」「等到晚上」之类时间跳转时\n" +
      "- 玩家问能否顺手做一件不危险的小事，但这件事会消耗时间时\n\n" +
      "【严禁的行为】\n" +
      "- 用叙事直接跳过 10 分钟以上日常时间而不调用本工具\n" +
      "- 把日常工具用于潜入、调查、战斗、施法、逃跑、睡眠、治疗、补魔等有专门代价的行动\n" +
      "- 日常行动中夹带金钱、位置、身体状态等确定性变化但不另行调用 patch_state\n\n" +
      "参数 activity 用一句短语描述日常行动；durationMinutes 为 1-1440 分钟；isPublic 表示是否可能被普通人、监控或组织记录。",
    parameters: Type.Object({
      activity: Type.String({ description: "日常行动，如 吃早饭、上课、通勤、等待、闲聊" }),
      durationMinutes: Type.Union([Type.Integer(), Type.String()], {
        description: "行动耗时，1-1440 分钟；可传整数或整数字符串",
      }),
      isPublic: Type.Optional(
        Type.Boolean({ description: "是否可能被普通人、监控或组织记录；默认 true" }),
      ),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      resolveDailyTool(params, ctx.sessionManager),

    renderCall(args: unknown, theme: Theme): Text {
      const record = isRecord(args) ? args : {};
      const activity = typeof record["activity"] === "string" ? record["activity"] : "?";
      const minutes =
        typeof record["durationMinutes"] === "string" ||
        typeof record["durationMinutes"] === "number"
          ? String(record["durationMinutes"])
          : "?";
      const text =
        theme.fg("toolTitle", theme.bold("日常 ")) +
        theme.fg("accent", activity) +
        theme.fg("muted", " · ") +
        theme.fg("dim", `${minutes}min`);
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded }, theme, _context) {
      const details = isDailyToolDetails(result.details) ? result.details : undefined;
      const activity = details?.dailyActivity ?? "?";
      const minutes = details?.durationMinutes ?? "?";
      const pressureSummary = details?.pressureSummary ?? "?";

      if (!expanded) {
        const compact =
          theme.fg("accent", activity) +
          theme.fg("muted", " · ") +
          theme.fg("dim", `${minutes}min`) +
          theme.fg("muted", "  ") +
          theme.fg("dim", pressureSummary);
        return new Text(compact, 0, 0);
      }

      const text = result.content[0];
      return new Text(text?.type === "text" ? text.text : "", 0, 0);
    },
  });

  pi.registerTool({
    label: toolLabel,
    name: "resolve_check",
    description:
      "用 d20 结算不确定行动，并把失败/代价接入压力数值系统。骰子不能覆盖型月硬规则；不成立的行动直接判不成立，不掷骰。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家行动结果不确定，且失败会产生代价\n" +
      "- 潜入、追踪、逃脱、调查关键线索、说服敌对 NPC、高风险魔术、战斗关键动作\n" +
      "- 玩家试图用一句话绕过危机，且不是世界规则直接禁止的情况\n" +
      "- GM 不确定该让玩家成功、代价成功还是失败时\n\n" +
      "【严禁的行为】\n" +
      "- 对必然成功或必然失败的事情掷骰\n" +
      "- 掷骰后无视结果，或把失败写成温柔成功\n" +
      "- 用骰子覆盖神秘度压制、魔力守恒、宝具真名等硬规则",
    parameters: Type.Object({
      checkType: Type.Union(
        [
          Type.Literal("体能"),
          Type.Literal("隐匿"),
          Type.Literal("调查"),
          Type.Literal("社交"),
          Type.Literal("魔术"),
          Type.Literal("战斗"),
        ],
        { description: "判定领域" },
      ),
      difficulty: Type.Union(
        [
          Type.Literal("简单"),
          Type.Literal("普通"),
          Type.Literal("困难"),
          Type.Literal("极难"),
          Type.Literal("不可能"),
        ],
        {
          description: "目标难度：简单 DC8 / 普通 DC12 / 困难 DC16 / 极难 DC20 / 不可能 DC25",
        },
      ),
      advantage: Type.Union([Type.Literal("劣势"), Type.Literal("正常"), Type.Literal("优势")], {
        description: "优势掷 2 取高，劣势掷 2 取低，正常掷 1d20",
      }),
      riskLevel: Type.Union(
        [Type.Literal("低"), Type.Literal("中"), Type.Literal("高"), Type.Literal("致命")],
        {
          description: "失败/代价的压力等级",
        },
      ),
      consequence: Type.Union(
        [Type.Literal("疲劳"), Type.Literal("受伤"), Type.Literal("魔力负担")],
        {
          description: "失败或代价成功时优先增加的压力项",
        },
      ),
      durationMinutes: Type.Union([Type.Integer(), Type.String()], {
        description: "判定行动耗时，0-720 分钟；可传整数或整数字符串",
      }),
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
      resolveCheckTool(params, ctx.sessionManager),
  });

  pi.registerTool({
    label: toolLabel,
    name: "lookup",
    description:
      "查询型月世界的权威设定——角色、从者、地点、概念、时间线的唯一数据入口。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家遇到或提及任何预设角色/从者/NPC——必须先查再叙述\n" +
      "- 玩家进入预设地点——先查地点设定再描述环境\n" +
      "- 需要引用型月世界观概念（圣杯、魔术、英灵等）——这是唯一权威来源\n" +
      "- 玩家询问某个时间线事件\n\n" +
      "【严禁的行为】\n" +
      "- 凭记忆编造角色外貌/性格/背景——你的内部记忆不是权威来源\n" +
      "- 编造地点名称和环境细节\n" +
      "- 即兴「发明」型月设定——哪怕你觉得自己记得，也先查一下\n\n" +
      "参数: 查询（必填，角色名/地点名/概念名/时间线名）、类型（可选，角色/从者/地点/设定/时间线）",
    parameters: Type.Object({
      query: Type.String({ description: "搜索关键词——角色名、地点名、概念名等" }),
      category: Type.Optional(
        Type.String({ description: "可选过滤: 角色、从者、地点、设定、时间线" }),
      ),
    }),
    execute: async (_toolCallId, params) => lookupTool(params),
  });

  pi.registerTool({
    label: toolLabel,
    name: "switch_toolset",
    description:
      "切换可用工具组。一般不需要使用——默认 always 工具组包含所有常用工具。\n" +
      "debug 工具组包含调试/维护工具（get_state_schema 等），仅开发调试时使用。",
    parameters: Type.Object({
      toolset: Type.String({ description: "工具组名: always 或 debug" }),
    }),
    execute: async (_toolCallId, params) => switchToolsetTool(params),
  });

  pi.registerTool({
    label: toolLabel,
    name: "get_state_schema",
    description: "【调试工具】查看当前状态 schema 版本与字段定义。",
    parameters: Type.Object({}),
    execute: async () => getStateSchemaTool(),
  });

  pi.registerTool({
    label: toolLabel,
    name: "export_state",
    description:
      "【调试工具】将当前内存状态导出到 state/state.json。只用于开发排查，严禁把导出的裸数值直接写进叙事。",
    parameters: Type.Object({}),
    execute: async () => exportStateTool(),
  });
}
