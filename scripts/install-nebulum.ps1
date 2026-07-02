$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "nebulum-node.ps1")

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runScript = Join-Path $repoRoot "scripts\run-nebulum.ps1"
$iconPath = Join-Path $repoRoot "public\nebulum.ico"

function New-NebulumShortcut($path) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = "powershell.exe"
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$runScript`""
  $shortcut.WorkingDirectory = $repoRoot
  if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
  }
  $shortcut.Description = "Launch Nebulum"
  $shortcut.Save()
}

Push-Location $repoRoot
try {
  $npmCommand = Get-NebulumNpmCommand -RepoRoot $repoRoot -InstallIfMissing
  Add-NebulumNodeToPath -NpmCommand $npmCommand

  Write-Host "Installing Nebulum dependencies..."
  & $npmCommand install

  Write-Host "Building Nebulum PWA..."
  & $npmCommand run build

  Write-Host "Creating Nebulum shortcuts..."
  $desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "Nebulum.lnk"
  New-NebulumShortcut $desktopShortcut

  $programsDir = [Environment]::GetFolderPath("Programs")
  if ($programsDir) {
    $startMenuDir = Join-Path $programsDir "Nebulum"
    New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null
    New-NebulumShortcut (Join-Path $startMenuDir "Nebulum.lnk")
  }

  Write-Host "Launching Nebulum..."
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runScript
}
finally {
  Pop-Location
}
