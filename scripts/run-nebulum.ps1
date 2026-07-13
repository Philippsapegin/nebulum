$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "nebulum-node.ps1")

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logDir = Join-Path $env:LOCALAPPDATA "Nebulum\logs"
$settingsPath = Join-Path $env:LOCALAPPDATA "Nebulum\settings.json"
$portRange = 4173..4183
$debugLog = Join-Path $env:TEMP "nebulum-launch-debug.log"
$iconCacheVersion = "pwa-icons-2026-07-04-1"

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
    return ($null -ne $settings.borderlessWindow) -and ([int]$settings.serverVersion -ge 11)
  }
  catch {
    return $false
  }
}

function Read-WindowSettings {
  if (-not (Test-Path $settingsPath)) {
    return @{ borderlessWindow = $false }
  }

  try {
    $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    return @{ borderlessWindow = $settings.borderlessWindow -eq $true }
  }
  catch {
    return @{ borderlessWindow = $false }
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

function Get-NebulumWindowBounds {
  Add-Type -AssemblyName System.Windows.Forms
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $marginX = [Math]::Max(24, [Math]::Floor($screen.Width * 0.02))
  $marginY = [Math]::Max(24, [Math]::Floor($screen.Height * 0.025))
  $width = $screen.Width - ($marginX * 2)
  $height = $screen.Height - ($marginY * 2)
  $minAspect = 1.45

  if ($width -lt [Math]::Floor($height * $minAspect)) {
    $height = [Math]::Floor($width / $minAspect)
  }

  return @{
    Left = $screen.Left + [Math]::Floor(($screen.Width - $width) / 2)
    Top = $screen.Top + [Math]::Floor(($screen.Height - $height) / 2)
    Width = $width
    Height = $height
  }
}

function Stop-NebulumBrowserProfileProcesses {
  $profilePattern = "Nebulum[\\/]BrowserProfile"
  Get-CimInstance Win32_Process |
    Where-Object { ($_.Name -match "chrome|msedge") -and ($_.CommandLine -match $profilePattern) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Clear-NebulumIconCache($profileDir) {
  $markerPath = Join-Path $profileDir "icon-cache-version.txt"
  try {
    if ((Get-Content -LiteralPath $markerPath -Raw).Trim() -eq $iconCacheVersion) {
      return
    }
  }
  catch {
  }

  Stop-NebulumBrowserProfileProcesses
  $defaultProfileDir = Join-Path $profileDir "Default"
  $cachePaths = @(
    (Join-Path $defaultProfileDir "Favicons"),
    (Join-Path $defaultProfileDir "Favicons-journal"),
    (Join-Path $defaultProfileDir "Shortcuts"),
    (Join-Path $defaultProfileDir "Shortcuts-journal"),
    (Join-Path $defaultProfileDir "Top Sites"),
    (Join-Path $defaultProfileDir "Top Sites-journal"),
    (Join-Path $defaultProfileDir "Web Applications\Manifest Resources")
  )

  foreach ($cachePath in $cachePaths) {
    Remove-Item -LiteralPath $cachePath -Recurse -Force -ErrorAction SilentlyContinue
  }

  New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
  Set-Content -LiteralPath $markerPath -Value $iconCacheVersion -Encoding UTF8
}

function Clear-NebulumWebCache($profileDir) {
  Stop-NebulumBrowserProfileProcesses
  $defaultProfileDir = Join-Path $profileDir "Default"
  $cachePaths = @(
    (Join-Path $defaultProfileDir "Service Worker"),
    (Join-Path $defaultProfileDir "Cache"),
    (Join-Path $defaultProfileDir "Code Cache"),
    (Join-Path $defaultProfileDir "GPUCache"),
    (Join-Path $defaultProfileDir "DawnCache"),
    (Join-Path $defaultProfileDir "Network\Cache")
  )

  foreach ($cachePath in $cachePaths) {
    Remove-Item -LiteralPath $cachePath -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Update-NebulumBrowserProfile($bounds) {
  $profileDir = Join-Path $env:LOCALAPPDATA "Nebulum\BrowserProfile"
  $defaultProfileDir = Join-Path $profileDir "Default"
  $preferencesPath = Join-Path $defaultProfileDir "Preferences"
  Clear-NebulumIconCache $profileDir
  Clear-NebulumWebCache $profileDir
  New-Item -ItemType Directory -Force -Path $defaultProfileDir | Out-Null

  try {
    $prefs = Get-Content -LiteralPath $preferencesPath -Raw | ConvertFrom-Json
  }
  catch {
    $prefs = [pscustomobject]@{}
  }

  if (-not $prefs.PSObject.Properties["browser"]) {
    $prefs | Add-Member -NotePropertyName browser -NotePropertyValue ([pscustomobject]@{})
  }

  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $placement = [ordered]@{
    bottom = $bounds.Top + $bounds.Height
    left = $bounds.Left
    maximized = $false
    right = $bounds.Left + $bounds.Width
    top = $bounds.Top
    work_area_bottom = $screen.Top + $screen.Height
    work_area_left = $screen.Left
    work_area_right = $screen.Left + $screen.Width
    work_area_top = $screen.Top
  }

  if ($prefs.browser.PSObject.Properties["window_placement"]) {
    $prefs.browser.window_placement = $placement
  }
  else {
    $prefs.browser | Add-Member -NotePropertyName window_placement -NotePropertyValue $placement
  }

  $prefs | ConvertTo-Json -Depth 32 -Compress | Set-Content -LiteralPath $preferencesPath -Encoding UTF8
  return $profileDir
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
`$marginX = [Math]::Max(24, [Math]::Floor(`$screen.Width * 0.02))
`$marginY = [Math]::Max(24, [Math]::Floor(`$screen.Height * 0.025))
`$width = `$screen.Width - (`$marginX * 2)
`$height = `$screen.Height - (`$marginY * 2)
if (`$width -lt [Math]::Floor(`$height * 1.45)) { `$height = [Math]::Floor(`$width / 1.45) }
`$left = `$screen.Left + [Math]::Floor((`$screen.Width - `$width) / 2)
`$top = `$screen.Top + [Math]::Floor((`$screen.Height - `$height) / 2)
if (`$target) {
  `$shell.AppActivate(`$target.Id) | Out-Null
} else {
  `$shell.AppActivate('Nebulum') | Out-Null
}
Start-Sleep -Milliseconds 140
`$shell.SendKeys('{F11}')
if (`$target -and '$EnterFullscreen' -ne 'True') {
  Start-Sleep -Milliseconds 260
  [NebulumWindow]::MoveWindow(`$target.MainWindowHandle, `$left, `$top, `$width, `$height, `$true) | Out-Null
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

  Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -like "*nebulum-window-bounds-watcher.ps1*" -and $_.ProcessId -ne $PID } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$watcherScript`"") `
    -WindowStyle Hidden | Out-Null
}

function Get-NewestWriteTimeUtc($path) {
  if (-not (Test-Path $path)) {
    return [DateTime]::MinValue
  }

  $item = Get-Item -LiteralPath $path
  if (-not $item.PSIsContainer) {
    return $item.LastWriteTimeUtc
  }

  $newest = Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

  if ($null -eq $newest) {
    return $item.LastWriteTimeUtc
  }

  return $newest.LastWriteTimeUtc
}

function Test-BuildRequired {
  $distIndex = Join-Path $repoRoot "dist\index.html"
  if (-not (Test-Path $distIndex)) {
    return $true
  }

  $distTime = (Get-Item -LiteralPath $distIndex).LastWriteTimeUtc
  $sourcePaths = @(
    (Join-Path $repoRoot "src"),
    (Join-Path $repoRoot "public"),
    (Join-Path $repoRoot "index.html"),
    (Join-Path $repoRoot "vite.config.js"),
    (Join-Path $repoRoot "package.json"),
    (Join-Path $repoRoot "package-lock.json")
  )

  foreach ($sourcePath in $sourcePaths) {
    if ((Get-NewestWriteTimeUtc $sourcePath) -gt $distTime) {
      return $true
    }
  }

  return $false
}

function Ensure-Built($npmCommand) {
  if (-not (Test-BuildRequired)) {
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

$appUrl = "http://127.0.0.1:$port/?nebulumApp=1"
$encodedAppUrl = [System.Uri]::EscapeDataString($appUrl)
$url = "http://127.0.0.1:$port/nebulum-launch.html?target=$encodedAppUrl&nonce=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
$windowSettings = Read-WindowSettings
$browser = Find-Browser
if ($browser) {
  Write-LaunchDebug "launch browser $browser $url"
  $screenBounds = Get-NebulumWindowBounds
  if ($windowSettings.borderlessWindow) {
    Stop-NebulumBrowserProfileProcesses
  }
  $browserProfile = Update-NebulumBrowserProfile $screenBounds
  $browserArgs = @(
    "--user-data-dir=$browserProfile",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-session-crashed-bubble",
    "--disable-features=PressAndHoldEscToExitBrowserFullscreen",
    "--app=$url",
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=$($screenBounds.Width),$($screenBounds.Height)",
    "--window-position=$($screenBounds.Left),$($screenBounds.Top)"
  )
  if ($windowSettings.borderlessWindow) {
    $browserArgs += "--kiosk"
  }
  Start-Process -FilePath $browser -ArgumentList $browserArgs | Out-Null
  if (-not $windowSettings.borderlessWindow) {
    Start-WindowBoundsWatcher
  }
}
else {
  Write-LaunchDebug "launch url $url"
  Start-Process $url | Out-Null
}

Write-LaunchDebug "done"
exit 0
