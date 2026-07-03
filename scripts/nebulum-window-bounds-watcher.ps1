$ErrorActionPreference = "SilentlyContinue"

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;

public struct RECT {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}

public class NebulumWindowBounds {
  [DllImport("user32.dll")]
  public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

  [DllImport("user32.dll")]
  public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

  [DllImport("user32.dll")]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@

$mutex = New-Object System.Threading.Mutex($false, "Local\NebulumWindowBoundsWatcher")
if (-not $mutex.WaitOne(0)) {
  exit 0
}

function Get-NebulumWindowBounds {
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $marginX = [Math]::Max(24, [Math]::Floor($screen.Width * 0.02))
  $marginY = [Math]::Max(24, [Math]::Floor($screen.Height * 0.025))
  $width = $screen.Width - ($marginX * 2)
  $height = $screen.Height - ($marginY * 2)

  if ($width -lt [Math]::Floor($height * 1.45)) {
    $height = [Math]::Floor($width / 1.45)
  }

  return @{
    Left = $screen.Left + [Math]::Floor(($screen.Width - $width) / 2)
    Top = $screen.Top + [Math]::Floor(($screen.Height - $height) / 2)
    Width = $width
    Height = $height
  }
}

function Lock-NebulumWindowStyle($handle) {
  $GWL_STYLE = -16
  $WS_THICKFRAME = 0x00040000
  $WS_MAXIMIZEBOX = 0x00010000
  $SWP_NOSIZE = 0x0001
  $SWP_NOMOVE = 0x0002
  $SWP_NOZORDER = 0x0004
  $SWP_NOACTIVATE = 0x0010
  $SWP_FRAMECHANGED = 0x0020

  $style = [NebulumWindowBounds]::GetWindowLong($handle, $GWL_STYLE)
  $lockedStyle = $style -band (-bnot ($WS_THICKFRAME -bor $WS_MAXIMIZEBOX))
  if ($lockedStyle -ne $style) {
    [NebulumWindowBounds]::SetWindowLong($handle, $GWL_STYLE, $lockedStyle) | Out-Null
    [NebulumWindowBounds]::SetWindowPos(
      $handle,
      [IntPtr]::Zero,
      0,
      0,
      0,
      0,
      $SWP_NOSIZE -bor $SWP_NOMOVE -bor $SWP_NOZORDER -bor $SWP_NOACTIVATE -bor $SWP_FRAMECHANGED
    ) | Out-Null
  }
}

try {
  $misses = 0
  $hasSeenTarget = $false

  while ($true) {
    $profileNeedle = "Nebulum\BrowserProfile"
    $target = $null
    $browserProcesses = Get-CimInstance Win32_Process |
      Where-Object { ($_.Name -match "chrome|msedge") -and ($_.CommandLine -like "*$profileNeedle*") }
    foreach ($browserProcess in $browserProcesses) {
      $candidate = Get-Process -Id $browserProcess.ProcessId -ErrorAction SilentlyContinue
      if ($candidate -and $candidate.MainWindowHandle -ne 0) {
        $target = $candidate
        break
      }
    }
    if (-not $target) {
      $target = Get-Process chrome, msedge -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -eq "Nebulum" } |
        Select-Object -First 1
    }

    if (-not $target) {
      $misses += 1
      if (($hasSeenTarget -and $misses -gt 20) -or (-not $hasSeenTarget -and $misses -gt 240)) {
        break
      }

      Start-Sleep -Milliseconds 500
      continue
    }

    $hasSeenTarget = $true
    $misses = 0

    $bounds = Get-NebulumWindowBounds
    Lock-NebulumWindowStyle $target.MainWindowHandle
    $rect = New-Object RECT
    [NebulumWindowBounds]::GetWindowRect($target.MainWindowHandle, [ref]$rect) | Out-Null

    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if (
      [Math]::Abs($rect.Left - $bounds.Left) -gt 2 -or
      [Math]::Abs($rect.Top - $bounds.Top) -gt 2 -or
      [Math]::Abs($width - $bounds.Width) -gt 2 -or
      [Math]::Abs($height - $bounds.Height) -gt 2
    ) {
      [NebulumWindowBounds]::MoveWindow(
        $target.MainWindowHandle,
        $bounds.Left,
        $bounds.Top,
        $bounds.Width,
        $bounds.Height,
        $true
      ) | Out-Null
    }

    Start-Sleep -Milliseconds 80
  }
}
finally {
  try { $mutex.ReleaseMutex() | Out-Null } catch {}
  $mutex.Dispose()
}
