$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectPiDir = Join-Path $ProjectRoot ".pi"
$ProjectAgentDir = Join-Path $ProjectPiDir "agent"
$SessionsDir = Join-Path $ProjectRoot "sessions"
$SettingsPath = Join-Path $ProjectAgentDir "settings.json"
$ProjectSettingsPath = Join-Path $ProjectPiDir "settings.json"

$env:PI_CODING_AGENT_DIR = $ProjectAgentDir
$env:PI_CLAUDE_OAUTH_REINJECT_SCOPE = "never"

if (-not (Get-Command pi -ErrorAction SilentlyContinue)) {
  Write-Error "pi is not installed. Install pi coding agent first."
  exit 1
}

Set-Location $ProjectRoot

function Write-Utf8NoBomFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Read-TextFileWithoutBom {
  param([Parameter(Mandatory = $true)][string]$Path)

  $Bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($Bytes.Length -eq 0) {
    return ""
  }

  if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
    $Content = [System.Text.Encoding]::UTF8.GetString($Bytes, 3, $Bytes.Length - 3)
  } elseif ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) {
    $Content = [System.Text.Encoding]::Unicode.GetString($Bytes, 2, $Bytes.Length - 2)
  } elseif ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF) {
    $Content = [System.Text.Encoding]::BigEndianUnicode.GetString($Bytes, 2, $Bytes.Length - 2)
  } else {
    $Content = [System.Text.Encoding]::UTF8.GetString($Bytes)
  }

  if ($Content.Length -gt 0 -and $Content[0] -eq [char]0xFEFF) {
    return $Content.Substring(1)
  }
  return $Content
}

function Repair-JsonEncodingIfNeeded {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $Bytes = [System.IO.File]::ReadAllBytes($Path)
  $HasUtf8Bom = $Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF
  $HasUtf16Bom = $Bytes.Length -ge 2 -and (($Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) -or ($Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF))

  if (-not $HasUtf8Bom -and -not $HasUtf16Bom) {
    return
  }

  Write-Utf8NoBomFile -Path $Path -Content (Read-TextFileWithoutBom -Path $Path)
}

function ConvertTo-Hashtable {
  param([AllowNull()]$Value)

  if ($null -eq $Value) {
    return $null
  }

  if ($Value -is [System.Collections.IDictionary]) {
    $Result = @{}
    foreach ($Key in $Value.Keys) {
      $Result[$Key] = ConvertTo-Hashtable $Value[$Key]
    }
    return $Result
  }

  if ($Value -is [System.Management.Automation.PSCustomObject]) {
    $Result = @{}
    foreach ($Property in $Value.PSObject.Properties) {
      $Result[$Property.Name] = ConvertTo-Hashtable $Property.Value
    }
    return $Result
  }

  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $Items = @()
    foreach ($Item in $Value) {
      $Items += ,(ConvertTo-Hashtable $Item)
    }
    return $Items
  }

  return $Value
}

Write-Host "Starting $(Split-Path -Leaf $ProjectRoot)..."

New-Item -ItemType Directory -Force -Path $SessionsDir | Out-Null
New-Item -ItemType Directory -Force -Path $ProjectAgentDir | Out-Null

$ProjectAuth = Join-Path $ProjectAgentDir "auth.json"
$GlobalPiDir = Join-Path $HOME ".pi"
$GlobalAgentDir = Join-Path $GlobalPiDir "agent"
$GlobalAuth = Join-Path $GlobalAgentDir "auth.json"

if ((-not (Test-Path -LiteralPath $ProjectAuth)) -and (Test-Path -LiteralPath $GlobalAuth)) {
  Copy-Item $GlobalAuth $ProjectAuth
  Repair-JsonEncodingIfNeeded -Path $ProjectAuth
  Write-Host "Copied auth.json into project-local pi config."
}

if (-not (Test-Path -LiteralPath $SettingsPath)) {
  $InitialSettings = @'
{
  "theme": "dark"
}
'@
  Write-Utf8NoBomFile -Path $SettingsPath -Content $InitialSettings
  Write-Host "Created project-local pi settings: .pi/agent/settings.json"
  Write-Host "Set defaultProvider/defaultModel there if needed."
}

Repair-JsonEncodingIfNeeded -Path $SettingsPath
Repair-JsonEncodingIfNeeded -Path $ProjectSettingsPath

$DevMode = $env:TAVERN2AGENT_DEV -eq "1"
$Settings = @{}

if (Test-Path -LiteralPath $SettingsPath) {
  try {
    $RawSettings = Read-TextFileWithoutBom -Path $SettingsPath
    if ($RawSettings.Trim().Length -gt 0) {
      $Settings = ConvertTo-Hashtable ($RawSettings | ConvertFrom-Json)
    }
  } catch {
    $Settings = @{}
  }
}

if (-not $Settings.ContainsKey("theme")) {
  $Settings["theme"] = "dark"
}
if (-not $Settings.ContainsKey("subagents") -or -not ($Settings["subagents"] -is [System.Collections.IDictionary])) {
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

# Backstage director sessions. run_parallel_line forks the backstage director
# directly from the engine (detached `pi -p`, see ADR 0005); its session (with
# hidden facts) persists under the gitignored .pi/agent/backstage-sessions/. The
# engine self-creates the dir on first spawn; pre-create it here only for clarity.
$BackstageSessionsDir = Join-Path $ProjectAgentDir 'backstage-sessions'
New-Item -ItemType Directory -Force -Path $BackstageSessionsDir | Out-Null

if ($env:RENDER_MODEL) {
  Write-Host "Render pass model override: RENDER_MODEL=$env:RENDER_MODEL"
} else {
  Write-Host "Render pass reuses the settlement model."
}

& pi `
  --no-skills `
  --skill "./skills" `
  -e "./extension.ts" `
  -e "./extensions/compaction/index.ts" `
  -e "./extensions/player-panel/index.ts" `
  -e "./extensions/player-choices/index.ts" `
  -e "./extensions/rewind/index.ts" `
  -e "./extensions/render/index.ts" `
  --session-dir "./sessions" `
  --no-context-files `
  @args

$PiExit = $LASTEXITCODE

Write-Host ""
Write-Host "------------------------------------------------------------"
Write-Host "Before sharing this project, remove local secrets and saves:"
Write-Host "  .pi/agent/auth.json, sessions/, state/"
Write-Host "------------------------------------------------------------"

exit $PiExit
