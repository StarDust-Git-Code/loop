<#
  Creates (or updates) the loopmates-voice service on Render, then waits for /healthz.
  Run from the repo:  powershell -ExecutionPolicy Bypass -File .\backend\scripts\deploy-voice.ps1
  Reads backend\scripts\deploy.env (same file deploy.ps1 uses) for GEMINI_API_KEY, DASHBOARD_ORIGIN,
  FIREBASE_SERVICE_ACCOUNT_FILE, GITHUB_REPO, GITHUB_BRANCH, REGION. The Render key comes from the RENDER_KEY_VOICE
  line there, or from the RENDER_API_KEY environment variable. Never paste the key into chat or commit it.
#>
param([string]$EnvFile = '')
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
$ApiBase = 'https://api.render.com/v1'
$dir = Split-Path -Parent $PSCommandPath
if (-not $EnvFile) { $EnvFile = Join-Path $dir 'deploy.env' }
$cfg = @{}
if (Test-Path -LiteralPath $EnvFile) {
  foreach ($line in Get-Content -LiteralPath $EnvFile -Encoding UTF8) {
    $t = $line.Trim(); if ($t -eq '' -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('='); if ($i -lt 1) { continue }
    $cfg[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim().Trim('"').Trim("'")
  }
}
function C([string]$k, [string]$d = '') { if ($cfg.ContainsKey($k) -and $cfg[$k]) { return $cfg[$k] }; return $d }
$key = C 'RENDER_KEY_VOICE'; if (-not $key) { $key = $env:RENDER_API_KEY }
if (-not $key) { $sec = Read-Host 'Paste your Render API key (input is hidden)' -AsSecureString; $key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)) }
if (-not $key) { throw 'No Render API key given.' }
$gemini = C 'GEMINI_API_KEY'; if ($env:GEMINI_API_KEY) { $gemini = $env:GEMINI_API_KEY }
if (-not $gemini) { $sec = Read-Host 'Paste your Gemini API key (input is hidden)' -AsSecureString; $gemini = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)) }
$origin = C 'DASHBOARD_ORIGIN' 'https://dashboard-loopmates.vercel.app'
$fb = C 'FIREBASE_SERVICE_ACCOUNT_FILE'
if (-not $fb -or -not (Test-Path -LiteralPath $fb)) { $fb = (Read-Host 'Path to your Firebase service-account JSON file').Trim('"') }
if (-not (Test-Path -LiteralPath $fb)) { throw 'That Firebase service-account file does not exist.' }
$fbB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($fb))
$repo = C 'GITHUB_REPO' 'https://github.com/StarDust-Git-Code/loop'; $branch = C 'GITHUB_BRANCH' 'main'; $region = C 'REGION' 'singapore'
$name = 'loopmates-voice'

function Render([string]$method, [string]$path, $body = $null) {
  $h = @{ Authorization = "Bearer $key"; Accept = 'application/json' }
  try {
    if ($null -ne $body) { return Invoke-RestMethod -Method $method -Uri "$ApiBase$path" -Headers $h -ContentType 'application/json' -Body (ConvertTo-Json -InputObject $body -Depth 12 -Compress) }
    return Invoke-RestMethod -Method $method -Uri "$ApiBase$path" -Headers $h
  } catch {
    $msg = $_.Exception.Message; try { $msg = $_.ErrorDetails.Message } catch { }
    throw "Render API $method $path failed: $msg"
  }
}
function Unwrap($x, [string]$prop) { if ($null -ne $x -and $x.PSObject.Properties.Name -contains $prop) { return $x.$prop }; return $x }

Write-Host '== Finding your Render workspace'
$owners = @(Render 'GET' '/owners?limit=20')
if ($owners.Count -eq 0) { throw 'No workspace found for this key.' }
$ownerId = [string](Unwrap $owners[0] 'owner').id
Write-Host "  workspace $ownerId"

$envs = @(
  @{ key = 'NODE_ENV'; value = 'production' },
  @{ key = 'GEMINI_API_KEY'; value = $gemini },
  @{ key = 'FIREBASE_SERVICE_ACCOUNT_B64'; value = $fbB64 },
  @{ key = 'ALLOWED_ORIGINS'; value = $origin }
)
if (C 'VOICE_MODEL') { $envs += @{ key = 'VOICE_MODEL'; value = (C 'VOICE_MODEL') } }

Write-Host '== Create or update the voice service'
$found = $null
foreach ($s in @(Render 'GET' "/services?name=$name&limit=20")) { $svc = Unwrap $s 'service'; if ($svc.name -eq $name) { $found = $svc; break } }
if ($null -eq $found) {
  $payload = @{
    type = 'web_service'; name = $name; ownerId = $ownerId; repo = $repo; branch = $branch; autoDeploy = 'yes'; rootDir = 'backend'
    envVars = $envs
    serviceDetails = @{ runtime = 'node'; plan = 'free'; region = $region; healthCheckPath = '/healthz'; envSpecificDetails = @{ buildCommand = 'npm ci --omit=dev --omit=optional'; startCommand = 'node src/voice/index.js' } }
  }
  $created = Unwrap (Render 'POST' '/services' $payload) 'service'
  $id = [string]$created.id; $url = [string]$created.serviceDetails.url
  Write-Host "  created $id"
} else {
  $id = [string]$found.id; $url = [string]$found.serviceDetails.url
  Render 'PUT' "/services/$id/env-vars" $envs | Out-Null
  Render 'POST' "/services/$id/deploys" @{ clearCache = 'do_not_clear' } | Out-Null
  Write-Host "  updated $id and started a deploy"
}
if (-not $url) { $url = "https://$name.onrender.com" }

Write-Host "== Waiting for $url/healthz (first build takes a few minutes)"
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 15
  try { $h = Invoke-RestMethod -Uri "$url/healthz" -TimeoutSec 30; if ($h.ok -and $h.service -eq 'voice') { $ok = $true; break } } catch { }
}
if ($ok) {
  Write-Host "  LIVE: $url" -ForegroundColor Green
  Write-Host "  Last step: in Vercel add NEXT_PUBLIC_VOICE_URL = $url  then redeploy the dashboard." -ForegroundColor Cyan
} else {
  Write-Host "  Not live yet. Check the logs: https://dashboard.render.com/web/$id/logs" -ForegroundColor Yellow
}
