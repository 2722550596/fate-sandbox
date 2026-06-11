import assert from "node:assert/strict";
import test from "node:test";

import { updateServantFormTool } from "./update-servant-form.ts";

void test("updateServantForm reports locked-field attempts clearly", () => {
  assert.throws(
    () =>
      updateServantFormTool(
        { kind: "change-true-name", actorId: "test-saber", reason: "regression" },
        undefined,
      ),
    /锁定字段.*override_locked_fact/,
  );
});

void test("updateServantForm reports invalid contract enums clearly", () => {
  assert.throws(
    () =>
      updateServantFormTool(
        {
          kind: "change-contract",
          actorId: "test-saber",
          contract: {
            masterActorId: "protagonist",
            masterName: "绫香",
            status: "healthy",
            manaSupply: "sufficient",
          },
          reason: "模型误填契约状态",
        },
        undefined,
      ),
    /contract\.status 必须是允许值之一: stable, weak, cut, masterless/,
  );
});

void test("updateServantForm reports invalid affected params clearly", () => {
  assert.throws(
    () =>
      updateServantFormTool(
        {
          kind: "add-param-modifier",
          actorId: "test-saber",
          modifier: {
            source: "临时强化",
            affectedParams: ["speed"],
            summary: "速度提升。",
            expiresAt: null,
          },
          reason: "模型误填参数名",
        },
        undefined,
      ),
    /modifier\.affectedParams\[0\] 必须是允许值之一: strength, endurance, agility, mana, luck, noblePhantasm/,
  );
});
