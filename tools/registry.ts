import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { Type } from "typebox";

import { getStateSchemaTool } from "./debug/get-state-schema";
import { switchToolsetTool } from "./debug/switch-toolset";
import { lookupTool } from "./lookup/lookup";
import { getStatusTool } from "./state/get-status";
import { patchStateTool } from "./state/patch-state";
import { resolveCheckTool } from "./state/resolve-check";
import { resolveConsequenceTool } from "./state/resolve-consequence";

export function registerAllTools(pi: ExtensionAPI): void {
  const label = "FSN 沙盒";

  pi.registerTool({
    label,
    name: "get_status",
    description:
      "查看玩家角色的当前状态（金钱、位置、身体、时间、疲劳、魔力负担、危险度、暴露、敌方警觉）。\n\n" +
      "【必须调用的场景】\n" +
      "- 需要确认玩家当前持有金钱、所在位置或身体状况时\n" +
      "- 需要确认时间、疲劳、魔力负担、危险度、暴露或敌方警觉时\n" +
      "- 玩家询问「我现在有多少钱」「我在哪」「我身体怎么样」「现在几点」「危险吗」时\n\n" +
      "【严禁的行为】\n" +
      "- 凭记忆叙述任何状态数值——你的内部记忆不可靠\n" +
      "- 编造位置信息、时间压力或安全程度——以工具返回的状态为准",
    parameters: Type.Object({}),
    execute: async () => getStatusTool(),
  });

  pi.registerTool({
    label,
    name: "patch_state",
    description:
      "修改玩家状态。用于确定性状态变化；风险/耗时/暴露/疲劳/魔力负担优先用 resolve_consequence 结算。\n\n" +
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
      '- path: "/金钱" | "/当前位置" | "/身体状态" | "/当前时间" | "/经过分钟" | "/疲劳" | "/魔力负担" | "/危险度" | "/神秘暴露" | "/社会暴露" | "/敌方警觉"\n' +
      "- value: 新值",
    parameters: Type.Object({
      ops: Type.Array(
        Type.Object({
          op: Type.Union([Type.Literal("replace")], {
            description: "操作类型——一般用 replace",
          }),
          path: Type.String({
            description: "路径，如 /金钱、/当前位置、/身体状态、/当前时间、/疲劳",
          }),
          value: Type.Unknown({ description: "新值；数字字段可传 number 或整数字符串" }),
        }),
        { description: "JSON Patch 操作数组" },
      ),
    }),
    execute: async (_toolCallId, params) => patchStateTool(params),
  });

  pi.registerTool({
    label,
    name: "resolve_consequence",
    description:
      "结算玩家行动造成的时间推进、疲劳、魔力负担、危险度、神秘暴露、社会暴露和敌方警觉。职责是防止高风险行动被写成免费、无痕、无代价。\n\n" +
      "【必须调用的场景】\n" +
      "- 玩家采取可能产生风险、耗时、暴露、疲劳或魔力消耗的行动\n" +
      "- 战斗、潜入、调查、施法、逃跑、长距离移动、夜间行动\n" +
      "- 休息、医疗、魔术治疗、安全屋整备等恢复行为；恢复也会推进时间和敌方行动\n" +
      "- 任何你想写成「暂时安全」「没人发现」「没有代价」的场景，必须先调用本工具确认\n" +
      "- 玩家试图用一句话、善意或临场觉悟化解危机时\n\n" +
      "【严禁的行为】\n" +
      "- 不调用本工具就叙述高风险行动无后果\n" +
      "- 自行决定敌方没有注意到、魔术没有留下痕迹、行动没有疲劳/时间/暴露成本\n" +
      "- 把治疗/休息写成免费瞬间满血，或让敌人在恢复期间静止等待\n" +
      "- 忽略工具返回的叙事约束",
    parameters: Type.Object({
      行动类型: Type.Union(
        [
          Type.Literal("移动"),
          Type.Literal("调查"),
          Type.Literal("社交"),
          Type.Literal("潜入"),
          Type.Literal("战斗"),
          Type.Literal("魔术"),
          Type.Literal("逃跑"),
          Type.Literal("休息"),
          Type.Literal("医疗"),
          Type.Literal("魔术治疗"),
          Type.Literal("安全屋整备"),
        ],
        { description: "本轮玩家行动类型" },
      ),
      风险等级: Type.Union(
        [Type.Literal("低"), Type.Literal("中"), Type.Literal("高"), Type.Literal("致命")],
        {
          description: "本轮行动风险等级",
        },
      ),
      预计耗时分钟: Type.Union([Type.Integer(), Type.String()], {
        description: "行动预计耗时，0-1440 分钟；可传整数或整数字符串",
      }),
      是否公开: Type.Boolean({ description: "是否可能被普通人、监控、组织记录或目击" }),
      是否涉及神秘: Type.Boolean({ description: "是否涉及魔术、从者、宝具、结界、异常现象等神秘" }),
    }),
    execute: async (_toolCallId, params) => resolveConsequenceTool(params),
  });

  pi.registerTool({
    label,
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
      判定类型: Type.Union(
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
      难度: Type.Union(
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
      优势: Type.Union([Type.Literal("劣势"), Type.Literal("正常"), Type.Literal("优势")], {
        description: "优势掷 2 取高，劣势掷 2 取低，正常掷 1d20",
      }),
      风险等级: Type.Union(
        [Type.Literal("低"), Type.Literal("中"), Type.Literal("高"), Type.Literal("致命")],
        {
          description: "失败/代价的压力等级",
        },
      ),
      失败后果: Type.Union(
        [
          Type.Literal("疲劳"),
          Type.Literal("受伤"),
          Type.Literal("魔力负担"),
          Type.Literal("神秘暴露"),
          Type.Literal("社会暴露"),
          Type.Literal("敌方警觉"),
        ],
        { description: "失败或代价成功时优先增加的压力项" },
      ),
      预计耗时分钟: Type.Union([Type.Integer(), Type.String()], {
        description: "判定行动耗时，0-720 分钟；可传整数或整数字符串",
      }),
    }),
    execute: async (_toolCallId, params) => resolveCheckTool(params),
  });

  pi.registerTool({
    label,
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
      查询: Type.String({ description: "搜索关键词——角色名、地点名、概念名等" }),
      类型: Type.Optional(Type.String({ description: "可选过滤: 角色、从者、地点、设定、时间线" })),
    }),
    execute: async (_toolCallId, params) => lookupTool(params),
  });

  pi.registerTool({
    label,
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
    label,
    name: "get_state_schema",
    description: "【调试工具】查看当前状态 schema 版本与字段定义。",
    parameters: Type.Object({}),
    execute: async () => getStateSchemaTool(),
  });
}
