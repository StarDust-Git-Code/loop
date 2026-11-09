# Loopmates server installer for Windows 10/11.
# Run from the backend folder in PowerShell:   powershell -ExecutionPolicy Bypass -File .\install.ps1
# What it does:
#   1. Checks for Node.js 22+ (installs it with winget when missing).
#   2. Installs the server's packages (npm ci).
#   3. Creates the data folder %LOCALAPPDATA%\Loopmates.
#   4. Registers a background task "Loopmates" that starts at log on and restarts the server if it stops.
#   5. Adds Start menu shortcuts: "Loopmates setup" and "Stop Loopmates".
#   6. Starts the server and opens the setup page.
# Uninstall: .\install.ps1 -Uninstall
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$task = 'Loopmates'
$menu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Loopmates'

if ($Uninstall) {
  schtasks /End /TN $task 2>$null | Out-Null
  schtasks /Delete /TN $task /F 2>$null | Out-Null
  if (Test-Path $menu) { Remove-Item -Recurse -Force $menu }
  Write-Host "Loopmates is uninstalled. Your data stays in $env:LOCALAPPDATA\Loopmates (delete it to remove everything)."
  exit 0
}

function NodeMajor { try { [int]((node -v) -replace '^v(\d+).*', '$1') } catch { 0 } }
if ((NodeMajor) -lt 22) {
  Write-Host 'Installing Node.js 22 LTS with winget...'
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  if ((NodeMajor) -lt 22) { throw 'Node.js 22 or newer is required. Install it from https://nodejs.org and run this again.' }
}
Write-Host "Node $(node -v)"

Push-Location $root
try { npm ci --omit=dev; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' } } finally { Pop-Location }

$data = Join-Path $env:LOCALAPPDATA 'Loopmates'
New-Item -ItemType Directory -Force $data | Out-Null

$node = (Get-Command node).Source
$cli = Join-Path $root 'bin\loopmates.js'
# A hidden, restarting background task for the current user (no admin rights needed).
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$cli`" run" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -Hidden
Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Settings $settings -Description 'Loopmates server' -Force | Out-Null

New-Item -ItemType Directory -Force $menu | Out-Null
$sh = New-Object -ComObject WScript.Shell
$l = $sh.CreateShortcut((Join-Path $menu 'Loopmates setup.lnk')); $l.TargetPath = $node; $l.Arguments = "`"$cli`" setup"; $l.WorkingDirectory = $root; $l.WindowStyle = 7; $l.Description = 'Open the Loopmates setup and status page'; $l.Save()
$l = $sh.CreateShortcut((Join-Path $menu 'Stop Loopmates.lnk')); $l.TargetPath = 'schtasks.exe'; $l.Arguments = "/End /TN $task"; $l.WindowStyle = 7; $l.Save()
$l = $sh.CreateShortcut((Join-Path $menu 'Start Loopmates.lnk')); $l.TargetPath = 'schtasks.exe'; $l.Arguments = "/Run /TN $task"; $l.WindowStyle = 7; $l.Save()

schtasks /Run /TN $task | Out-Null
Write-Host 'Starting the server...'
for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 500; try { Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8787/healthz' -TimeoutSec 2 | Out-Null; break } catch {} }
& $node $cli setup
Write-Host "`nDone. Loopmates starts by itself when you log on. Use the Start menu shortcut 'Loopmates setup' any time."
