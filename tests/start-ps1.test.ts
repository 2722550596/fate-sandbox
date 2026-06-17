/// <reference types="node" />

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";

function hasPwsh(): boolean {
  const result = spawnSync(
    "pwsh",
    ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"],
    {
      stdio: "ignore",
    },
  );
  return result.status === 0;
}

function writePiStub(binDir: string): void {
  mkdirSync(binDir, { recursive: true });

  if (process.platform === "win32") {
    writeFileSync(
      join(binDir, "pi.cmd"),
      [
        "@echo off",
        '> "%PI_STUB_CAPTURE%" echo PI_CODING_AGENT_DIR=%PI_CODING_AGENT_DIR%',
        "setlocal enabledelayedexpansion",
        "set index=0",
        ":loop",
        'if "%~1"=="" goto done',
        '>> "%PI_STUB_CAPTURE%" echo ARG_!index!=%~1',
        "set /a index+=1",
        "shift",
        "goto loop",
        ":done",
        "exit /b 0",
        "",
      ].join("\r\n"),
    );
    return;
  }

  const stubPath = join(binDir, "pi");
  writeFileSync(
    stubPath,
    [
      "#!/usr/bin/env sh",
      "{",
      "  printf 'PI_CODING_AGENT_DIR=%s\\n' \"$PI_CODING_AGENT_DIR\"",
      "  index=0",
      '  for arg in "$@"; do',
      '    printf \'ARG_%s=%s\\n\' "$index" "$arg"',
      "    index=$((index + 1))",
      "  done",
      '} > "$PI_STUB_CAPTURE"',
      "exit 0",
      "",
    ].join("\n"),
  );
  chmodSync(stubPath, 0o755);
}

void test(
  "start.ps1 strips JSON BOMs before launching isolated pi config",
  { skip: hasPwsh() ? false : "pwsh is not available" },
  () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "fate-start-"));
    try {
      copyFileSync(join(process.cwd(), "start.ps1"), join(tempRoot, "start.ps1"));

      const settingsDir = join(tempRoot, ".pi", "agent");
      mkdirSync(settingsDir, { recursive: true });
      const settingsPath = join(settingsDir, "settings.json");
      writeFileSync(
        settingsPath,
        Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{\n  "theme": "dark"\n}\n')]),
      );

      const binDir = join(tempRoot, "bin");
      writePiStub(binDir);

      const homeDir = join(tempRoot, "home");
      mkdirSync(homeDir, { recursive: true });
      const capturePath = join(tempRoot, "pi-capture.txt");
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        HOME: homeDir,
        USERPROFILE: homeDir,
        PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}`,
        PI_STUB_CAPTURE: capturePath,
      };

      const result = spawnSync(
        "pwsh",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          join(tempRoot, "start.ps1"),
          "--version",
        ],
        { cwd: tempRoot, env, encoding: "utf8" },
      );

      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      const settingsBytes = readFileSync(settingsPath);
      assert.notDeepEqual([...settingsBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
      assert.doesNotThrow(() => JSON.parse(settingsBytes.toString("utf8")));

      const capture = readFileSync(capturePath, "utf8");
      assert.match(
        capture,
        new RegExp(`PI_CODING_AGENT_DIR=${settingsDir.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}`),
      );
      assert.match(capture, /ARG_0=--no-skills/);
      assert.match(capture, /ARG_1=--skill/);
      assert.match(capture, /ARG_2=\.\/skills/);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
);
