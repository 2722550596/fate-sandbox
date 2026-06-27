import type { LocationState } from "../../core/state/state.ts";
import type { FateToolDefinition } from "../runtime/tool-definition.ts";
import type { ToolResult } from "../runtime/tool-result.ts";

import { Type } from "typebox";

import { BOUNDARY_KINDS } from "../../core/state/state-enum-schemas.ts";
import { persistStateAfterCommit } from "../../core/state/state-persistence.ts";
import { cloneState, commitState } from "../../core/state/state-store.ts";
import { assertOneOfString } from "../../core/utils/string-enum.ts";
import { isRecord } from "../../core/utils/typebox-validation.ts";
import { textResult } from "../runtime/tool-result.ts";

export function moveToTool(params: unknown, sessionManager: unknown): ToolResult {
  const { region, site, detail, boundary, coordinates, reason } = parseMoveParams(params);
  const draft = cloneState();

  const newLocation: LocationState = {
    region,
    site,
    detail,
    boundary: assertOneOfString(boundary, BOUNDARY_KINDS, "boundary"),
    coordinates: coordinates ?? null,
  };

  draft.public.scene.location = newLocation;

  commitState(draft);
  persistStateAfterCommit(sessionManager, { result: { region, site, detail, reason } });
  return textResult(
    `已移动到 ${region} - ${site}${detail ? `（${detail}）` : ""}${reason ? `。原因：${reason}` : ""}。`,
    { result: { region, site, detail, boundary, coordinates, reason } },
  );
}

interface MoveParams {
  region: string;
  site: string;
  detail: string;
  boundary: string;
  coordinates: { x: number; y: number } | null;
  reason: string;
}

function parseMoveParams(params: unknown): MoveParams {
  const raw = isRecord(params) ? params : {};
  const region = typeof raw.region === "string" && raw.region.length > 0 ? raw.region : "未知区域";
  const site = typeof raw.site === "string" && raw.site.length > 0 ? raw.site : "未知地点";
  const detail = typeof raw.detail === "string" ? raw.detail : "";
  const boundary = typeof raw.boundary === "string" ? raw.boundary : "normal";
  let coordinates: { x: number; y: number } | null = null;
  if (raw.coordinates !== undefined && raw.coordinates !== null) {
    const coord = isRecord(raw.coordinates) ? raw.coordinates : {};
    const x =
      typeof coord.x === "number" ? coord.x : typeof coord.x === "string" ? Number(coord.x) : NaN;
    const y =
      typeof coord.y === "number" ? coord.y : typeof coord.y === "string" ? Number(coord.y) : NaN;
    if (!isNaN(x) && !isNaN(y)) {
      coordinates = { x, y };
    }
  }
  const reason = typeof raw.reason === "string" ? raw.reason : "移动";
  return { region, site, detail, boundary, coordinates, reason };
}

export const moveToToolDefinition: FateToolDefinition = {
  name: "move_to",
  description:
    "将玩家角色移动到指定位置。每轮只能移动一次；移动本身不推进 clock（时间推进走 commit_turn）。\n\n" +
    "使用边界：跨城/跨街区/进入建筑/离开场景的位置变更；坐标可选（x, y 经纬度体系）。\n" +
    "禁区：不替代 commit_turn 的时间推进；不随意修改无叙事依据的地点。",
  parameters: Type.Object({
    region: Type.String({
      description: "区域/城市/大区域，如廷根市、贝克兰德桥区域",
    }),
    site: Type.String({
      description: "具体地点/场所名，如黑荆棘安保公司、勇敢者酒吧",
    }),
    detail: Type.Optional(
      Type.String({
        description: "位置细节描述，如二楼办公室、后巷角落",
      }),
    ),
    boundary: Type.Optional(
      Type.String({
        description: "边界类型: normal / sacred-domain / otherworld / sealed（默认 normal）",
      }),
    ),
    coordinates: Type.Optional(
      Type.Object({
        x: Type.Number({ description: "经度坐标" }),
        y: Type.Number({ description: "纬度坐标" }),
      }),
    ),
    reason: Type.String({ minLength: 1 }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
    moveToTool(params, ctx.sessionManager),
};
