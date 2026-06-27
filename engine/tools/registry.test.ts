import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * 工具契约（name/description/parameters）与实现同文件维护；
 * entry schema 必须保持 loose——union 校验交给领域工具/normalizer，
 * 避免 anyOf/literal schema 在模型侧产生不可读报错。
 */
void test("tool entry schemas stay loose across all tool files", () => {
  const forbidden = ["Type", "Union"].join(".");
  for (const file of listToolSourceFiles()) {
    const source = readFileSync(file, "utf-8");
    assert.equal(
      source.includes(forbidden),
      false,
      `${file}: tool entry schemas must stay loose; domain tools/normalizers should validate unions.`,
    );
  }
});

void test("tool descriptions avoid checklist headings that bait reasoning", () => {
  const forbiddenHeadings = [
    "【必须调用的场景】",
    "【必须调用场景】",
    "【必须】",
    "【严禁的行为】",
    "【严禁行为】",
    "【严禁】",
  ];
  for (const file of listToolSourceFiles()) {
    const source = readFileSync(file, "utf-8");
    for (const heading of forbiddenHeadings) {
      assert.equal(
        source.includes(heading),
        false,
        `${file}: tool descriptions should use compact boundary bullets, not ${heading}.`,
      );
    }
  }
});

void test("registry stays a thin list without inline contracts", () => {
  const source = readFileSync(join(process.cwd(), "tools", "registry.ts"), "utf-8");
  assert.equal(
    source.includes("description:"),
    false,
    "tool descriptions live with their implementations, not in the registry",
  );
  assert.equal(
    source.includes("parameters:"),
    false,
    "tool parameter schemas live with their implementations, not in the registry",
  );
});

function listToolSourceFiles(): string[] {
  const root = join(process.cwd(), "tools");
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        files.push(path);
      }
    }
  };
  walk(root);
  return files;
}
