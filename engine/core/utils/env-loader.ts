/**
 * 简易 .env 加载器。
 * 从项目根目录读取 .env 文件，设置 process.env。
 * 不引入外部依赖。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");
const DOTENV_PATH = join(PROJECT_ROOT, ".env");

let loaded = false;

/** 从 .env 加载环境变量（只在首次调用时读取一次） */
export function loadEnv(): void {
  if (loaded) return;

  try {
    const raw = readFileSync(DOTENV_PATH, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

      const sepIndex = trimmed.indexOf("=");
      if (sepIndex === -1) continue;

      const key = trimmed.slice(0, sepIndex).trim();
      let value = trimmed.slice(sepIndex + 1).trim();

      // Strip surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key.length > 0 && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env 不存在——静默跳过，process.env 中已有的值优先
  }

  loaded = true;
}

/** 获取必要的 env 变量，若缺失则抛出清晰错误 */
export function requireEnv(name: string): string {
  loadEnv();
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(
      `环境变量 ${name} 未设置。请在项目根目录的 .env 文件中配置，或参考 .env.example。`,
    );
  }
  return value;
}
