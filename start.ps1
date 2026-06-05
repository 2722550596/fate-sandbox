$ErrorActionPreference = "Stop"

if (-not (Get-Command pi -ErrorAction SilentlyContinue)) {
  Write-Error "错误: pi 未安装，请先安装 pi coding agent"
  exit 1
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "启动《$(Split-Path -Leaf $ProjectRoot)》..."

New-Item -ItemType Directory -Force -Path ".\sessions" | Out-Null
New-Item -ItemType Directory -Force -Path ".\.pi\agent" | Out-Null

$ProjectAuth = ".\.pi\agent\auth.json"
$GlobalAuth = Join-Path $HOME ".pi\agent\auth.json"

if ((-not (Test-Path $ProjectAuth)) -and (Test-Path $GlobalAuth)) {
  Copy-Item $GlobalAuth $ProjectAuth
  Write-Host "✓ 已复制认证信息到项目隔离环境"
}

$SettingsPath = ".\.pi\agent\settings.json"
if (-not (Test-Path $SettingsPath)) {
  @"
{
  "theme": "dark"
}
"@ | Set-Content -Path $SettingsPath -Encoding UTF8
  Write-Host "✓ 已创建项目隔离配置 (.pi/agent/settings.json)"
  Write-Host "  （如需指定默认模型，编辑此文件添加 defaultProvider / defaultModel）"
}

$DevMode = $env:TAVERN2AGENT_DEV -eq "1"
$Settings = @{}

if (Test-Path $SettingsPath) {
  try {
    $Settings = Get-Content $SettingsPath -Raw | ConvertFrom-Json -AsHashtable
  } catch {
    $Settings = @{}
  }
}

if (-not $Settings.ContainsKey("theme")) {
  $Settings["theme"] = "dark"
}
if (-not $Settings.ContainsKey("subagents")) {
  $Settings["subagents"] = @{}
}
$Settings["subagents"]["disableBuiltins"] = -not $DevMode

$Settings | ConvertTo-Json -Depth 20 | Set-Content -Path $SettingsPath -Encoding UTF8

if ($DevMode) {
  Write-Host "✓ 开发模式：保留 pi-subagents 内置 agents"
} else {
  Write-Host "✓ 玩家模式：已禁用 pi-subagents 内置 coding agents（开发模式: `$env:TAVERN2AGENT_DEV='1'; .\start.ps1）"
}

$env:PI_CODING_AGENT_DIR = ".\.pi\agent"
$env:PI_CLAUDE_OAUTH_REINJECT_SCOPE = "never"

& pi `
  --no-skills `
  --skill ".\skills" `
  -e ".\extension.ts" `
  -e ".\extensions\compaction-policy\index.ts" `
  --session-dir ".\sessions" `
  --no-context-files `
  @args

$PiExit = $LASTEXITCODE

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "⚠️  提示：如要分享此项目（git push / 打包发送等），"
Write-Host "    请删除 .pi/agent/auth.json（包含 API 密钥）、sessions/（会话存档）和 state/（调试导出）。"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $PiExit
