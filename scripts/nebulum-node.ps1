$script:NebulumNodeMajor = 22

function Test-NebulumNodeVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$NodeExe
  )

  try {
    $version = (& $NodeExe -p "process.versions.node" 2>$null).Trim()
    if (-not $version) {
      return $false
    }

    $parts = $version.Split(".")
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    return ($major -gt 22) -or ($major -eq 22 -and $minor -ge 12) -or ($major -eq 20 -and $minor -ge 19)
  }
  catch {
    return $false
  }
}

function Get-NebulumLocalNodeRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $runtimeDir = Join-Path $RepoRoot ".nebulum-runtime"
  if (-not (Test-Path $runtimeDir)) {
    return $null
  }

  $nodeDirs = Get-ChildItem -Path $runtimeDir -Directory -Filter "node-v*-win-x64" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending
  foreach ($nodeDir in $nodeDirs) {
    $nodeExe = Join-Path $nodeDir.FullName "node.exe"
    $npmCmd = Join-Path $nodeDir.FullName "npm.cmd"
    if ((Test-Path $nodeExe) -and (Test-Path $npmCmd) -and (Test-NebulumNodeVersion -NodeExe $nodeExe)) {
      return $nodeDir.FullName
    }
  }

  return $null
}

function Install-NebulumPortableNode {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $runtimeDir = Join-Path $RepoRoot ".nebulum-runtime"
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Write-Host "Downloading local Node.js runtime..."
  $nodeIndex = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing
  $release = $nodeIndex |
    Where-Object { $_.version -like "v$script:NebulumNodeMajor.*" -and $_.files -contains "win-x64-zip" } |
    Select-Object -First 1

  if (-not $release) {
    throw "Could not find a Windows x64 Node.js release."
  }

  $zipName = "node-$($release.version)-win-x64.zip"
  $zipPath = Join-Path $runtimeDir $zipName
  $zipUrl = "https://nodejs.org/dist/$($release.version)/$zipName"
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing

  Write-Host "Extracting Node.js runtime..."
  Expand-Archive -Path $zipPath -DestinationPath $runtimeDir -Force
  Remove-Item -LiteralPath $zipPath -Force

  $nodeRoot = Join-Path $runtimeDir "node-$($release.version)-win-x64"
  if (-not (Test-Path (Join-Path $nodeRoot "npm.cmd"))) {
    throw "Downloaded Node.js runtime is missing npm.cmd."
  }

  return $nodeRoot
}

function Get-NebulumNpmCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [switch]$InstallIfMissing
  )

  $localNodeRoot = Get-NebulumLocalNodeRoot -RepoRoot $RepoRoot
  if ($localNodeRoot) {
    return Join-Path $localNodeRoot "npm.cmd"
  }

  $nodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
  $npmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
  if ($nodeCommand -and $npmCommand -and (Test-NebulumNodeVersion -NodeExe $nodeCommand.Source)) {
    return $npmCommand.Source
  }

  if ($InstallIfMissing) {
    $nodeRoot = Install-NebulumPortableNode -RepoRoot $RepoRoot
    return Join-Path $nodeRoot "npm.cmd"
  }

  throw "Node.js 20.19+ or 22.12+ was not found. Run install.bat first."
}

function Get-NebulumNodeCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [switch]$InstallIfMissing
  )

  $localNodeRoot = Get-NebulumLocalNodeRoot -RepoRoot $RepoRoot
  if ($localNodeRoot) {
    return Join-Path $localNodeRoot "node.exe"
  }

  $nodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
  if ($nodeCommand -and (Test-NebulumNodeVersion -NodeExe $nodeCommand.Source)) {
    return $nodeCommand.Source
  }

  if ($InstallIfMissing) {
    $nodeRoot = Install-NebulumPortableNode -RepoRoot $RepoRoot
    return Join-Path $nodeRoot "node.exe"
  }

  throw "Node.js 20.19+ or 22.12+ was not found. Run install.bat first."
}

function Add-NebulumNodeToPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$NpmCommand
  )

  $nodeRoot = Split-Path -Parent $NpmCommand
  $pathParts = $env:PATH -split ";"
  if ($pathParts -notcontains $nodeRoot) {
    $env:PATH = "$nodeRoot;$env:PATH"
  }
}
