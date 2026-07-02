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
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
}
"@

$mutex = New-Object System.Threading.Mutex($false, "Local\NebulumWindowBoundsWatcher")
if (-not $mutex.WaitOne(0)) {
  exit 0
}

try {
  $misses = 0
  $hasSeenTarget = $false

  while ($true) {
    $target = Get-Process chrome, msedge -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowTitle -like "*Nebulum*" } |
      Select-Object -First 1

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

    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $rect = New-Object RECT
    [NebulumWindowBounds]::GetWindowRect($target.MainWindowHandle, [ref]$rect) | Out-Null

    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -lt ($screen.Width - 24) -or $height -lt ($screen.Height - 48)) {
      [NebulumWindowBounds]::MoveWindow(
        $target.MainWindowHandle,
        $screen.Left,
        $screen.Top,
        $screen.Width,
        $screen.Height,
        $true
      ) | Out-Null
    }

    Start-Sleep -Milliseconds 500
  }
}
finally {
  try { $mutex.ReleaseMutex() | Out-Null } catch {}
  $mutex.Dispose()
}
