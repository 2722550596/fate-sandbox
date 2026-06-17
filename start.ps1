$ErrorActionPreference = "Stop"

if (-not (Get-Command pi -ErrorAction SilentlyContinue)) {
  Write-Error "pi is not installed. Install pi coding agent first."
  exit 1
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

function Write-Utf8NoBomFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Remove-Utf8BomIfPresent {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }
  $Bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
    [System.IO.File]::WriteAllBytes($Path, $Bytes[3..($Bytes.Length - 1)])
  }
}

Write-Host "Starting $(Split-Path -Leaf $ProjectRoot)..."

New-Item -ItemType Directory -Force -Path ".\sessions" | Out-Null
New-Item -ItemType Directory -Force -Path ".\.pi\agent" | Out-Null

$ProjectAuth = ".\.pi\agent\auth.json"
$GlobalAuth = Join-Path $HOME ".pi\agent\auth.json"

if ((-not (Test-Path $ProjectAuth)) -and (Test-Path $GlobalAuth)) {
  Copy-Item $GlobalAuth $ProjectAuth
  Write-Host "Copied auth.json into project-local pi config."
}

$SettingsPath = ".\.pi\agent\settings.json"
if (-not (Test-Path $SettingsPath)) {
  $InitialSettings = @"
{
  ""theme"": ""dark""
}
"@
  Write-Utf8NoBomFile -Path $SettingsPath -Content $InitialSettings
  Write-Host "Created project-local pi settings: .pi/agent/settings.json"
  Write-Host "Set defaultProvider/defaultModel there if needed."
}
Remove-Utf8BomIfPresent -Path $SettingsPath

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

Write-Utf8NoBomFile -Path $SettingsPath -Content (($Settings | ConvertTo-Json -Depth 20) + [Environment]::NewLine)

if ($DevMode) {
  Write-Host "Dev mode: pi-subagents builtin agents are enabled."
} else {
  Write-Host "Player mode: pi-subagents builtin coding agents are disabled."
  Write-Host "Dev mode: set `$env:TAVERN2AGENT_DEV='1'; then run .\start.ps1"
}

if ($env:FATE_RENDER_MODEL) {
  Write-Host "Render pass model override: FATE_RENDER_MODEL=$env:FATE_RENDER_MODEL"
} else {
  Write-Host "Render pass reuses the settlement model."
}

$env:PI_CODING_AGENT_DIR = ".\.pi\agent"
$env:PI_CLAUDE_OAUTH_REINJECT_SCOPE = "never"

& pi `
  --no-skills `
  --skill ".\skills" `
  -e ".\extension.ts" `
  -e ".\extensions\compaction-policy\index.ts" `
  -e ".\extensions\player-panel\index.ts" `
  -e ".\extensions\rewind\index.ts" `
  -e ".\extensions\two-pass-render\index.ts" `
  --session-dir ".\sessions" `
  --no-context-files `
  @args

$PiExit = $LASTEXITCODE

Write-Host ""
Write-Host "------------------------------------------------------------"
Write-Host "Before sharing this project, remove local secrets and saves:"
Write-Host "  .pi/agent/auth.json, sessions/, state/"
Write-Host "------------------------------------------------------------"

exit $PiExit
