$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "nebulum-node.ps1")

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logDir = Join-Path $env:LOCALAPPDATA "Nebulum\logs"
$settingsPath = Join-Path $env:LOCALAPPDATA "Nebulum\settings.json"
$portRange = 4173..4183
$debugLog = Join-Path $env:TEMP "nebulum-launch-debug.log"

function Write-LaunchDebug($message) {
  if (-not $env:NEBULUM_LAUNCH_DEBUG) {
    return
  }

  Add-Content -Path $debugLog -Value "$(Get-Date -Format o) $message"
}

function Test-NebulumServer($port) {
  if (-not (Test-PortOpen $port)) {
    return $false
  }

  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/manifest.webmanifest" -UseBasicParsing -TimeoutSec 1
    $content = $response.Content
    if ($content -is [byte[]]) {
      $content = [System.Text.Encoding]::UTF8.GetString($content)
    }
    $manifest = $content | ConvertFrom-Json
    if ($manifest.name -ne "Nebulum") {
      return $false
    }

    $settingsResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/window-settings" -UseBasicParsing -TimeoutSec 1
    $settingsContent = $settingsResponse.Content
    if ($settingsContent -is [byte[]]) {
      $settingsContent = [System.Text.Encoding]::UTF8.GetString($settingsContent)
    }
    $settings = $settingsContent | ConvertFrom-Json
    return ($null -ne $settings.borderlessWindow) -and ([int]$settings.serverVersion -ge 9)
  }
  catch {
    return $false
  }
}

function Read-WindowSettings {
  if (-not (Test-Path $settingsPath)) {
    return @{ borderlessWindow = $true }
  }

  try {
    $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    return @{ borderlessWindow = $settings.borderlessWindow -ne $false }
  }
  catch {
    return @{ borderlessWindow = $true }
  }
}

function Test-PortOpen($port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect("127.0.0.1", $port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(1000, $false)) {
      return $false
    }
    $client.EndConnect($async)
    return $true
  }
  catch {
    return $false
  }
  finally {
    $client.Close()
  }
}

function Select-NebulumPort {
  foreach ($port in $portRange) {
    if (Test-NebulumServer $port) {
      return $port
    }
  }

  foreach ($port in $portRange) {
    if (-not (Test-PortOpen $port)) {
      return $port
    }
  }

  throw "No free local port found for Nebulum."
}

function Find-Browser {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Get-PrimaryScreenBounds {
  Add-Type -AssemblyName System.Windows.Forms
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  return @{
    Left = $screen.Left
    Top = $screen.Top
    Width = $screen.Width
    Height = $screen.Height
  }
}

function Send-FullscreenToggle {
  param(
    [bool]$EnterFullscreen = $true
  )

  $script = @"
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class NebulumWindow {
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
}
'@
`$shell = New-Object -ComObject WScript.Shell
Start-Sleep -Milliseconds 900
`$target = `$null
for (`$attempt = 0; `$attempt -lt 40 -and -not `$target; `$attempt += 1) {
  `$target = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { `$_.MainWindowTitle -like '*Nebulum*' } | Select-Object -First 1
  if (-not `$target) { Start-Sleep -Milliseconds 150 }
}
`$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
if (`$target) {
  if ('$EnterFullscreen' -eq 'True') {
    [NebulumWindow]::MoveWindow(`$target.MainWindowHandle, `$screen.Left, `$screen.Top, `$screen.Width, `$screen.Height, `$true) | Out-Null
    Start-Sleep -Milliseconds 80
  }
  `$shell.AppActivate(`$target.Id) | Out-Null
} else {
  `$shell.AppActivate('Nebulum') | Out-Null
}
Start-Sleep -Milliseconds 140
`$shell.SendKeys('{F11}')
if (`$target -and '$EnterFullscreen' -ne 'True') {
  Start-Sleep -Milliseconds 260
  [NebulumWindow]::MoveWindow(`$target.MainWindowHandle, `$screen.Left, `$screen.Top, `$screen.Width, `$screen.Height, `$true) | Out-Null
}
"@
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $script) `
    -WindowStyle Hidden | Out-Null
}

function Start-WindowBoundsWatcher {
  $watcherScript = Join-Path $repoRoot "scripts\nebulum-window-bounds-watcher.ps1"
  if (-not (Test-Path $watcherScript)) {
    return
  }

  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$watcherScript`"") `
    -WindowStyle Hidden | Out-Null
}

function Ensure-Built($npmCommand) {
  if (Test-Path (Join-Path $repoRoot "dist\index.html")) {
    return
  }

  Push-Location $repoRoot
  try {
    & $npmCommand install
    & $npmCommand run build
  }
  finally {
    Pop-Location
  }
}

Write-LaunchDebug "start"
$npmCommand = Get-NebulumNpmCommand -RepoRoot $repoRoot
$nodeCommand = Get-NebulumNodeCommand -RepoRoot $repoRoot
Add-NebulumNodeToPath -NpmCommand $npmCommand
Ensure-Built $npmCommand
Write-LaunchDebug "built"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$port = Select-NebulumPort
Write-LaunchDebug "selected port $port"
if (-not (Test-NebulumServer $port)) {
  Write-LaunchDebug "starting server $port"
  $stdout = Join-Path $logDir "preview-$port.out.log"
  $stderr = Join-Path $logDir "preview-$port.err.log"
  $serverScript = Join-Path $repoRoot "scripts\nebulum-server.mjs"
  $distRoot = Join-Path $repoRoot "dist"
  Start-Process -FilePath $nodeCommand `
    -ArgumentList @("`"$serverScript`"", "--port", "$port", "--root", "`"$distRoot`"", "--settings", "`"$settingsPath`"") `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden | Out-Null

  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    if (Test-NebulumServer $port) {
      break
    }
    Start-Sleep -Milliseconds 250
  }

  if (-not (Test-NebulumServer $port)) {
    throw "Nebulum preview server did not start. See logs in $logDir."
  }
  Write-LaunchDebug "server ready $port"
}

$url = "http://127.0.0.1:$port/?nebulumApp=1"
$windowSettings = Read-WindowSettings
$browser = Find-Browser
if ($browser) {
  Write-LaunchDebug "launch browser $browser $url"
  $screenBounds = Get-PrimaryScreenBounds
  $browserArgs = @(
    "--app=$url",
    "--window-size=$($screenBounds.Width),$($screenBounds.Height)",
    "--window-position=$($screenBounds.Left),$($screenBounds.Top)"
  )
  Start-Process -FilePath $browser -ArgumentList $browserArgs | Out-Null
  Start-WindowBoundsWatcher
  if ($windowSettings.borderlessWindow) {
    Send-FullscreenToggle -EnterFullscreen $true
  }
}
else {
  Write-LaunchDebug "launch url $url"
  Start-Process $url | Out-Null
}

Write-LaunchDebug "done"
exit 0
