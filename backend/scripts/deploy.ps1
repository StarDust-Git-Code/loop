<#
.SYNOPSIS
  Deploys the three Loopmates services to three Render accounts and wires them together.

.DESCRIPTION
  api        -> Render account 3 : API, run engine, scheduler, Telegram, WhatsApp
  coder      -> Render account 1 : coding agent
  artifacts  -> Render account 2 : files into your Google Drive

  Safe to re-run: existing services are updated, not duplicated. Secrets come from scripts\deploy.env (git-ignored).

.EXAMPLE
  .\scripts\deploy.ps1 -DryRun      # validate everything, change nothing
  .\scripts\deploy.ps1              # deploy all three
  .\scripts\deploy.ps1 -Only api    # redeploy just the API
#>
[CmdletBinding()]
param(
  [string]$EnvFile = '',
  [ValidateSet('all', 'api', 'coder', 'artifacts')][string]$Only = 'all',
  [switch]$DryRun,
  [switch]$SkipGit,
  [switch]$SkipHealth,
  [int]$DeployTimeoutSec = 900,
  [int]$PollSeconds = 8,
  [string]$ApiBase = 'https://api.render.com/v1'
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

function Info($m)  { Write-Host "  $m" }
function Step($m)  { Write-Host ""; Write-Host "== $m" -ForegroundColor Cyan }
function Good($m)  { Write-Host "  OK  $m" -ForegroundColor Green }
function Warn($m)  { Write-Host "  !!  $m" -ForegroundColor Yellow }
function Fail($m)  { throw $m }
trap { Write-Host ""; Write-Host "  XX  $($_.Exception.Message)" -ForegroundColor Red; Write-Host "      (nothing is half-done: this script is safe to run again)" -ForegroundColor DarkGray; exit 1 }

# ------------------------------------------------------------------ env file
$ScriptPath = $MyInvocation.MyCommand.Path
if (-not $ScriptPath) { $ScriptPath = $PSCommandPath }
if (-not $ScriptPath) { throw 'Cannot work out where deploy.ps1 lives. Run it with: powershell -File .\scripts\deploy.ps1' }
$ScriptDir = Split-Path -Parent $ScriptPath
$RepoRoot = Split-Path -Parent $ScriptDir
if (-not $EnvFile) { $EnvFile = Join-Path $ScriptDir 'deploy.env' }
$ExamplePath = Join-Path $ScriptDir 'deploy.env.example'

function Read-EnvFile([string]$path) {
  $map = [ordered]@{}
  foreach ($line in Get-Content -LiteralPath $path -Encoding UTF8) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $k = $t.Substring(0, $i).Trim()
    $v = $t.Substring($i + 1).Trim()
    if ($v.Length -ge 2 -and (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'")))) { $v = $v.Substring(1, $v.Length - 2) }
    $map[$k] = $v
  }
  return $map
}

function Set-EnvValue([string]$path, [string]$key, [string]$value) {
  $lines = @(Get-Content -LiteralPath $path -Encoding UTF8)
  $done = $false
  for ($n = 0; $n -lt $lines.Count; $n++) {
    if ($lines[$n] -match ('^\s*' + [regex]::Escape($key) + '\s*=')) { $lines[$n] = "$key=$value"; $done = $true; break }
  }
  if (-not $done) { $lines += "$key=$value" }
  Set-Content -LiteralPath $path -Value $lines -Encoding UTF8
}

function New-Secret([int]$bytes) {
  $b = New-Object byte[] $bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($b); $rng.Dispose()
  return [Convert]::ToBase64String($b)
}
function New-Slug([int]$len) {
  $chars = 'abcdefghijklmnopqrstuvwxyz0123456789'.ToCharArray()
  $b = New-Object byte[] $len
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($b); $rng.Dispose()
  return (-join ($b | ForEach-Object { $chars[$_ % $chars.Length] }))
}

Step 'Preflight'
if ($PSVersionTable.PSVersion.Major -lt 5) { Fail 'PowerShell 5.1 or newer is required.' }
if (-not (Test-Path -LiteralPath $EnvFile)) {
  if (-not (Test-Path -LiteralPath $ExamplePath)) { Fail "Missing $ExamplePath" }
  Copy-Item -LiteralPath $ExamplePath -Destination $EnvFile
  Write-Host ""
  Write-Host "  Created $EnvFile" -ForegroundColor Yellow
  Write-Host "  Fill in the Render API keys, the Firebase service-account path and the other values, then run this script again." -ForegroundColor Yellow
  exit 1
}

# Refuse to run if the secrets file could be committed.
if (-not $SkipGit -and (Get-Command git -ErrorAction SilentlyContinue)) {
  & git -C $RepoRoot check-ignore -q -- $EnvFile 2>$null
  if ($LASTEXITCODE -ne 0) { Fail "$EnvFile is not git-ignored. Add 'backend/scripts/deploy.env' to .gitignore first." }
}

$cfg = Read-EnvFile $EnvFile
function Cfg([string]$k, [string]$default = '') { if ($cfg.Contains($k) -and $cfg[$k] -ne '') { return [string]$cfg[$k] } else { return $default } }

# Generated secrets (kept in the env file so re-runs reuse them).
foreach ($pair in @(@('SERVICE_SECRET', 32), @('MASTER_KEY', 32), @('CRON_SECRET', 24), @('TELEGRAM_WEBHOOK_SECRET', 24))) {
  if ((Cfg $pair[0]) -eq '') {
    $val = New-Secret $pair[1]
    if ($pair[0] -ne 'MASTER_KEY') { $val = $val.Replace('+', '-').Replace('/', '_').TrimEnd('=') }
    if (-not $DryRun) { Set-EnvValue $EnvFile $pair[0] $val }
    $cfg[$pair[0]] = $val
    Good "generated $($pair[0])$(if ($DryRun) { ' (dry run: not saved)' })"
  }
}
if ((Cfg 'NAME_SUFFIX') -eq '') { $s = New-Slug 4; if (-not $DryRun) { Set-EnvValue $EnvFile 'NAME_SUFFIX' $s }; $cfg['NAME_SUFFIX'] = $s }
if ((Cfg 'MASTER_KEY') -ne '') {
  try { if ([Convert]::FromBase64String((Cfg 'MASTER_KEY')).Length -ne 32) { Fail 'MASTER_KEY must be 32 bytes (base64). Delete the line to regenerate (this makes stored API keys unreadable).' } } catch { Fail 'MASTER_KEY is not valid base64.' }
}

$suffix = Cfg 'NAME_SUFFIX'
$region = Cfg 'REGION' 'singapore'
$repo   = Cfg 'GITHUB_REPO' 'https://github.com/StarDust-Git-Code/loop'
$branch = Cfg 'GITHUB_BRANCH' 'main'

# Role table
$roles = @(
  @{ id = 'coder';     title = 'Coder     (Render 1)'; key = 'RENDER_KEY_CODER';     owner = 'RENDER_OWNER_CODER';     name = "loopmates-coder-$suffix";     start = 'node src/coder/index.js';     build = 'npm ci --omit=dev --omit=optional' },
  @{ id = 'artifacts'; title = 'Artifacts (Render 2)'; key = 'RENDER_KEY_ARTIFACTS'; owner = 'RENDER_OWNER_ARTIFACTS'; name = "loopmates-artifacts-$suffix"; start = 'node src/artifacts/index.js'; build = 'npm ci --omit=dev --omit=optional' },
  @{ id = 'api';       title = 'API       (Render 3)'; key = 'RENDER_KEY_API';       owner = 'RENDER_OWNER_API';       name = "loopmates-api-$suffix";       start = 'node src/api/index.js';       build = 'npm ci --omit=dev' }
)
if ($Only -ne 'all') { $selected = @($roles | Where-Object { $_.id -eq $Only }) } else { $selected = $roles }

# Validation: collect every problem, then report them together.
$problems = New-Object System.Collections.Generic.List[string]
foreach ($r in $selected) { if ((Cfg $r.key) -eq '') { $problems.Add("$($r.key) is empty (Render API key for the $($r.id) account).") } }
$saPath = Cfg 'FIREBASE_SERVICE_ACCOUNT_FILE'
$saB64 = ''
if ($selected | Where-Object { $_.id -eq 'api' }) {
  if ($saPath -eq '' -or -not (Test-Path -LiteralPath $saPath)) { $problems.Add("FIREBASE_SERVICE_ACCOUNT_FILE not found: '$saPath'") }
  else {
    try {
      $raw = Get-Content -LiteralPath $saPath -Raw -Encoding UTF8
      $j = $raw | ConvertFrom-Json
      $names = @($j.PSObject.Properties.Name)
      if (($names -notcontains 'type') -or ($names -notcontains 'private_key') -or $j.type -ne 'service_account') { $problems.Add('FIREBASE_SERVICE_ACCOUNT_FILE is not a service-account key (Firebase console -> Project settings -> Service accounts -> Generate new private key).') }
      else {
        if (($names -contains 'project_id') -and $j.project_id -ne 'loop-mates') { Warn "service account is for project '$($j.project_id)', not 'loop-mates'." }
        $saB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($raw.Trim()))
      }
    } catch { $problems.Add("FIREBASE_SERVICE_ACCOUNT_FILE is not valid JSON: $($_.Exception.Message)") }
  }
  if ((Cfg 'DASHBOARD_ORIGIN') -notmatch '^https?://[^/]+$') { $problems.Add('DASHBOARD_ORIGIN must look like https://your-dashboard.vercel.app (no trailing slash).') }
  if ((Cfg 'ALLOWED_EMAILS') -eq '') { $problems.Add('ALLOWED_EMAILS is empty: anyone with a Google account could sign in and spend your LLM quota.') }
  if (((Cfg 'NVIDIA_API_KEY') + (Cfg 'GEMINI_API_KEY') + (Cfg 'GROQ_API_KEY') + (Cfg 'CEREBRAS_API_KEY') + (Cfg 'OPENROUTER_API_KEY')) -eq '') { Warn 'No LLM key set. Mates cannot think until you add a provider in Settings.' }
}
$skipArtifacts = $false
if ($selected | Where-Object { $_.id -eq 'artifacts' }) {
  $missing = @('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN' | Where-Object { (Cfg $_) -eq '' })
  if ($missing.Count -gt 0) {
    if ($Only -eq 'artifacts') { $problems.Add("$($missing -join ', ') empty (run: node drive-token.mjs <id> <secret>).") }
    else { $skipArtifacts = $true; Warn 'Google Drive is not configured yet, so the Artifacts service is skipped. File storage will answer "not configured" until you add the three GOOGLE_* values and run this script again.' }
  }
}
if ($problems.Count -gt 0) {
  Write-Host ""
  foreach ($p in $problems) { Write-Host "  XX  $p" -ForegroundColor Red }
  Write-Host ""; Write-Host "  Fix the items above in $EnvFile and run again." -ForegroundColor Yellow
  exit 1
}
if ($skipArtifacts) { $selected = @($selected | Where-Object { $_.id -ne 'artifacts' }) }
Good 'configuration is complete'

# ------------------------------------------------------------------ git
if (-not $SkipGit) {
  Step 'Git: Render deploys from GitHub, so the code must be pushed'
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'git is not installed or not on PATH. Install Git for Windows or use -SkipGit if everything is already pushed.' }
  $dirty = @(& git -C $RepoRoot status --porcelain -- backend dashboard)
  if ($dirty.Count -gt 0) {
    Info "$($dirty.Count) uncommitted change(s) in backend/ or dashboard/"
    if ($DryRun) { Warn 'dry run: would commit and push them' }
    else {
      & git -C $RepoRoot add -- backend dashboard
      & git -C $RepoRoot commit -q -m 'Deploy: backend and dashboard updates'
      if ($LASTEXITCODE -ne 0) { Fail 'git commit failed.' }
      Good 'committed'
    }
  }
  $local = (& git -C $RepoRoot rev-parse HEAD).Trim()
  $remoteLine = (& git -C $RepoRoot ls-remote origin "refs/heads/$branch" 2>$null)
  $remote = if ($remoteLine) { ($remoteLine -split '\s+')[0] } else { '' }
  if ($local -ne $remote) {
    if ($DryRun) { Warn "dry run: would push HEAD to origin/$branch" }
    else {
      & git -C $RepoRoot push origin "HEAD:$branch"
      if ($LASTEXITCODE -ne 0) { Fail "git push failed. Sign in to GitHub (git credential manager) and retry." }
      Good "pushed to origin/$branch"
    }
  } else { Good "origin/$branch already has this commit" }
}

# ------------------------------------------------------------------ Render API
function Read-ErrorBody($err) {
  try { if ($err.ErrorDetails -and $err.ErrorDetails.Message) { return [string]$err.ErrorDetails.Message } } catch { }
  try {
    $resp = $err.Exception.Response
    if ($resp) { $sr = New-Object System.IO.StreamReader($resp.GetResponseStream()); return $sr.ReadToEnd() }
  } catch { }
  return [string]$err.Exception.Message
}

function Invoke-Render([string]$key, [string]$method, [string]$path, $body = $null) {
  $uri = "$ApiBase$path"
  $headers = @{ Authorization = "Bearer $key"; Accept = 'application/json' }
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      if ($null -ne $body) { return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -ContentType 'application/json' -Body (ConvertTo-Json -InputObject $body -Depth 12 -Compress) }
      else { return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers }
    } catch {
      $status = 0
      try { $status = [int]$_.Exception.Response.StatusCode } catch { }
      $text = Read-ErrorBody $_
      if (($status -eq 429 -or $status -ge 500 -or $status -eq 0) -and $attempt -lt 5) { Start-Sleep -Seconds (3 * $attempt); continue }
      if ($status -eq 401) { Fail "Render rejected the API key for $path (401). Create a new key in Render -> Account Settings -> API Keys." }
      Fail "Render API $method $path failed ($status): $text"
    }
  }
}

# Invoke-RestMethod may hand back an array as one object (PowerShell 7) or unrolled (5.1). Normalise to a flat array.
function As-List($x) {
  $out = @()
  if ($null -eq $x) { return , $out }
  foreach ($i in @($x)) { if ($i -is [System.Array]) { foreach ($j in $i) { $out += , $j } } else { $out += , $i } }
  return , $out
}

function Unwrap($o, [string]$name) { if ($null -ne $o -and $o.PSObject.Properties.Name -contains $name) { return $o.$name } else { return $o } }

function Get-OwnerId($r) {
  $want = Cfg $r.owner
  if ($want -ne '') { return $want }
  $list = As-List (Invoke-Render (Cfg $r.key) 'GET' '/owners?limit=20')
  if ($list.Count -eq 0) { Fail "No Render workspace found for the $($r.id) key." }
  $o = Unwrap $list[0] 'owner'
  if ($list.Count -gt 1) { Warn "$($r.id): key has $($list.Count) workspaces, using '$($o.name)' ($($o.id)). Set $($r.owner)=... to choose another." }
  return [string]$o.id
}

function Find-Service($r) {
  $res = As-List (Invoke-Render (Cfg $r.key) 'GET' "/services?name=$([uri]::EscapeDataString($r.name))&limit=20")
  foreach ($item in $res) { $s = Unwrap $item 'service'; if ($null -ne $s -and $s.name -eq $r.name) { return $s } }
  return $null
}

# Public URLs are predictable: https://<service-name>.onrender.com (verified again after creation).
$urls = @{}
foreach ($r in $roles) { $urls[$r.id] = "https://$($r.name).onrender.com" }

$existingArtifacts = $false
# Re-runs: use the URLs Render really assigned to services that already exist (it appends a suffix if a name is taken).
foreach ($r in $roles) {
  if ((Cfg $r.key) -eq '') { continue }
  try {
    $found = Find-Service $r
    if ($null -ne $found -and $found.serviceDetails -and $found.serviceDetails.url) { $urls[$r.id] = [string]$found.serviceDetails.url; if ($r.id -eq 'artifacts') { $existingArtifacts = $true } }
  } catch { Warn "could not look up the existing $($r.id) service: $($_.Exception.Message)" }
}

if ($skipArtifacts -and -not $existingArtifacts) { $urls['artifacts'] = '' }
$envUrls = @{}
foreach ($k in $urls.Keys) { $envUrls[$k] = $urls[$k] }   # URLs baked into the env vars we send

function Build-Env($r) {
  $e = [ordered]@{ NODE_ENV = 'production'; NODE_VERSION = '22'; SERVICE_SECRET = (Cfg 'SERVICE_SECRET') }
  switch ($r.id) {
    'api' {
      $origin = Cfg 'DASHBOARD_ORIGIN'
      $e['MASTER_KEY'] = Cfg 'MASTER_KEY'; $e['CRON_SECRET'] = Cfg 'CRON_SECRET'
      $e['FIREBASE_SERVICE_ACCOUNT_B64'] = $saB64
      $e['ALLOWED_ORIGINS'] = "$origin,http://localhost:3000"; $e['ALLOWED_EMAILS'] = Cfg 'ALLOWED_EMAILS'
      $e['PUBLIC_URL'] = $urls['api']; $e['CODER_URL'] = $urls['coder']; $e['ARTIFACTS_URL'] = $urls['artifacts']
      foreach ($k in 'NVIDIA_API_KEY', 'NVIDIA_MODEL', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'GROQ_API_KEY', 'GROQ_MODEL', 'CEREBRAS_API_KEY', 'CEREBRAS_MODEL', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'WHATSAPP_ENABLED', 'DEFAULT_REPO') { $e[$k] = Cfg $k }
      if ((Cfg 'DEFAULT_REPO') -eq '') { $e['DEFAULT_REPO'] = $repo }
    }
    'coder' {
      $e['API_URL'] = $urls['api']; $e['GITHUB_TOKEN'] = Cfg 'GITHUB_TOKEN'; $e['DEFAULT_REPO'] = $repo
    }
    'artifacts' {
      foreach ($k in 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN') { $e[$k] = Cfg $k }
    }
  }
  $list = @()
  foreach ($k in $e.Keys) { if ([string]$e[$k] -ne '') { $list += @{ key = $k; value = [string]$e[$k] } } }
  return , $list
}

function Wait-Deploy($r, [string]$serviceId, [string]$deployId) {
  $key = Cfg $r.key
  $deadline = (Get-Date).AddSeconds($DeployTimeoutSec)
  $last = ''
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds $PollSeconds
    $path = if ($deployId) { "/services/$serviceId/deploys/$deployId" } else { "/services/$serviceId/deploys?limit=1" }
    $d = Invoke-Render $key 'GET' $path
    $d = (As-List $d)[0]
    $d = Unwrap $d 'deploy'
    $st = [string]$d.status
    if ($st -ne $last) { Info "$($r.id): $st"; $last = $st }
    if ($st -eq 'live') { return $true }
    if ($st -in @('build_failed', 'update_failed', 'canceled', 'deactivated', 'pre_deploy_failed')) {
      Warn "Deploy ended as '$st'. Open the logs: https://dashboard.render.com/web/$serviceId/logs"
      return $false
    }
  }
  Warn "$($r.id): still not live after $DeployTimeoutSec s. Check https://dashboard.render.com/web/$serviceId"
  return $false
}

function Test-Health([string]$url) {
  for ($i = 1; $i -le 24; $i++) {
    try {
      $h = Invoke-RestMethod -Uri "$url/healthz" -TimeoutSec 30
      if ($h.ok) { return $h }
    } catch { }
    Start-Sleep -Seconds 5
  }
  return $null
}

# ------------------------------------------------------------------ deploy
$results = @{}
if ($DryRun) {
  Step 'Dry run: checking the Render API keys (read-only)'
  foreach ($r in $selected) {
    $owner = Get-OwnerId $r
    $existing = Find-Service $r
    Good "$($r.id): key works, workspace $owner, service '$($r.name)' $(if ($existing) { 'exists (would update)' } else { 'does not exist (would create)' })"
    Info "      URL will be $($urls[$r.id])   env vars: $(((Build-Env $r) | ForEach-Object { $_.key }) -join ', ')"
  }
  Write-Host ""; Write-Host '  Dry run finished. Nothing was changed.' -ForegroundColor Green
  exit 0
}

Step 'Render: create or update services'
foreach ($r in $selected) {
  $key = Cfg $r.key
  $owner = Get-OwnerId $r
  $existing = Find-Service $r
  $envList = Build-Env $r
  $svcId = ''; $deployId = ''; $actual = ''
  if ($null -eq $existing) {
    Info "$($r.id): creating '$($r.name)' in $region"
    $payload = @{
      type = 'web_service'; name = $r.name; ownerId = $owner; repo = $repo; branch = $branch; autoDeploy = 'yes'; rootDir = 'backend'
      envVars = $envList
      serviceDetails = @{ runtime = 'node'; plan = 'free'; region = $region; healthCheckPath = '/healthz'; envSpecificDetails = @{ buildCommand = $r.build; startCommand = $r.start } }
    }
    $created = Invoke-Render $key 'POST' '/services' $payload
    $svc = Unwrap $created 'service'
    $svcId = [string]$svc.id
    if ($created.PSObject.Properties.Name -contains 'deployId') { $deployId = [string]$created.deployId }
    try { $actual = [string]$svc.serviceDetails.url } catch { $actual = '' }
    Good "$($r.id): created $svcId"
  } else {
    $svcId = [string]$existing.id
    Info "$($r.id): updating '$($r.name)' ($svcId)"
    Invoke-Render $key 'PUT' "/services/$svcId/env-vars" $envList | Out-Null
    try {
      Invoke-Render $key 'PATCH' "/services/$svcId" @{ branch = $branch; rootDir = 'backend'; autoDeploy = 'yes'; serviceDetails = @{ healthCheckPath = '/healthz'; envSpecificDetails = @{ buildCommand = $r.build; startCommand = $r.start } } } | Out-Null
    } catch { Warn "$($r.id): could not update build settings (continuing): $($_.Exception.Message)" }
    $dep = Invoke-Render $key 'POST' "/services/$svcId/deploys" @{ clearCache = 'do_not_clear' }
    $dep = Unwrap $dep 'deploy'
    if ($dep -and $dep.PSObject.Properties.Name -contains 'id') { $deployId = [string]$dep.id }
    try { $actual = [string]$existing.serviceDetails.url } catch { $actual = '' }
    Good "$($r.id): env updated, deploy started"
  }
  if ($actual -ne '' -and $actual -ne $urls[$r.id]) { Warn "$($r.id): Render gave a different URL ($actual); wiring will be fixed in the next step."; $urls[$r.id] = $actual }
  $results[$r.id] = @{ role = $r; serviceId = $svcId; deployId = $deployId }
}

# If any real URL differed from the prediction, push corrected env vars to every service and redeploy.
$needFix = $false
foreach ($r in $selected) { if ($urls[$r.id] -ne $envUrls[$r.id]) { $needFix = $true } }
if ($needFix) {
  Step 'Fixing cross-service URLs'
  foreach ($r in $selected) {
    $key = Cfg $r.key; $id = $results[$r.id].serviceId
    Invoke-Render $key 'PUT' "/services/$id/env-vars" (Build-Env $r) | Out-Null
    $dep = Unwrap (Invoke-Render $key 'POST' "/services/$id/deploys" @{ clearCache = 'do_not_clear' }) 'deploy'
    if ($dep -and $dep.PSObject.Properties.Name -contains 'id') { $results[$r.id].deployId = [string]$dep.id }
  }
}

Step 'Waiting for deploys (first build takes a few minutes)'
$allLive = $true
foreach ($r in $selected) {
  $x = $results[$r.id]
  if (-not (Wait-Deploy $r $x.serviceId $x.deployId)) { $allLive = $false }
}

if (-not $SkipHealth) {
  Step 'Health checks'
  foreach ($r in $selected) {
    $h = Test-Health $urls[$r.id]
    if ($h) { Good "$($r.id): $($urls[$r.id])  (mem $($h.mem) MB)" } else { Warn "$($r.id): no healthy answer from $($urls[$r.id])/healthz yet. Check its logs."; $allLive = $false }
  }
}

if (($selected | Where-Object { $_.id -eq 'api' }) -and (Cfg 'TELEGRAM_BOT_TOKEN') -ne '' -and -not $SkipHealth) {
  Step 'Telegram webhook'
  try {
    $hook = "$($urls['api'])/telegram/webhook/$(Cfg 'TELEGRAM_WEBHOOK_SECRET')"
    $res = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$(Cfg 'TELEGRAM_BOT_TOKEN')/setWebhook" -ContentType 'application/json' -Body (ConvertTo-Json -InputObject @{ url = $hook; allowed_updates = @('message') } -Compress)
    if ($res.ok) { Good 'webhook registered' } else { Warn "Telegram said: $($res.description)" }
  } catch { Warn "Could not set the Telegram webhook: $($_.Exception.Message)" }
}

# ------------------------------------------------------------------ summary
Step 'Done'
Write-Host ""
foreach ($r in $roles) { $u = if ($urls[$r.id]) { $urls[$r.id] } else { '(not deployed)' }; Write-Host ("  {0,-22} {1}" -f $r.title, $u) }
Write-Host ""
Write-Host '  Next steps' -ForegroundColor Cyan
Write-Host "   1. Vercel (dashboard project) -> Settings -> Environment Variables, then redeploy:"
Write-Host "        NEXT_PUBLIC_API_URL = $($urls['api'])"
Write-Host '        NEXT_PUBLIC_FIREBASE_API_KEY, _AUTH_DOMAIN, _PROJECT_ID, _APP_ID, _MESSAGING_SENDER_ID  (same values as dashboard/.env.local)'
Write-Host '   2. Firebase console -> Authentication -> Settings -> Authorized domains: add your Vercel domain.'
Write-Host '   3. Keep the API awake and run schedules: create a free cron-job.org (or UptimeRobot) job every 5 minutes:'
Write-Host "        $($urls['api'])/internal/tick?key=<CRON_SECRET from $EnvFile>"
Write-Host '   4. Rotate the Render API keys if they were ever shared in chat or email.'
Write-Host ""
if ($allLive) { Write-Host '  All services deployed and healthy.' -ForegroundColor Green; exit 0 }
else { Write-Host '  Finished with warnings above. Re-run the script after fixing them; it is safe to repeat.' -ForegroundColor Yellow; exit 2 }
