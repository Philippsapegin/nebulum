import { createServer } from "node:http";
import { execFileSync, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const port = Number(args.get("--port") || 4173);
const root = path.resolve(args.get("--root") || path.join(process.cwd(), "dist"));
const settingsPath = path.resolve(
  args.get("--settings") ||
    process.env.NEBULUM_SETTINGS_PATH ||
    path.join(process.env.LOCALAPPDATA || os.homedir(), "Nebulum", "settings.json"),
);
const SERVER_VERSION = 10;
const APP_LAUNCH_PARAM = "nebulumApp";
const NEBULUM_LAUNCH_PATH = "/nebulum-launch.html";
const ICON_CACHE_VERSION = "pwa-icons-2026-07-04-1";
const MOVE_WINDOW_TYPE_DEFINITION = [
  "using System;",
  "using System.Runtime.InteropServices;",
  "public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }",
  "public class NebulumWindow {",
  "  [DllImport(\"user32.dll\")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);",
  "  [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);",
  "}",
].join(" ");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
  [".mp3", "audio/mpeg"],
  [".wav", "audio/wav"],
  [".ogg", "audio/ogg"],
]);

function normalizeWindowSettings(settings = {}) {
  return {
    borderlessWindow: settings.borderlessWindow === true,
  };
}

async function readSettings() {
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    return normalizeWindowSettings(JSON.parse(raw));
  } catch {
    return normalizeWindowSettings();
  }
}

async function writeSettings(settings) {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, `${JSON.stringify(normalizeWindowSettings(settings), null, 2)}\n`, "utf8");
}

function sendFullscreenToggle(enterFullscreen) {
  if (process.platform !== "win32") {
    return;
  }

  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    `Add-Type -TypeDefinition '${MOVE_WINDOW_TYPE_DEFINITION.replaceAll("'", "''")}'`,
    "Start-Sleep -Milliseconds 220",
    "$shell = New-Object -ComObject WScript.Shell",
    "$target = $null",
    "for ($attempt = 0; $attempt -lt 40 -and -not $target; $attempt += 1) { $target = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*Nebulum*' } | Select-Object -First 1; if (-not $target) { Start-Sleep -Milliseconds 150 } }",
    "$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds",
    enterFullscreen
      ? "if ($target) { [NebulumWindow]::MoveWindow($target.MainWindowHandle, $screen.Left, $screen.Top, $screen.Width, $screen.Height, $true) | Out-Null; Start-Sleep -Milliseconds 80 }"
      : "",
    "if ($target) { $shell.AppActivate($target.Id) | Out-Null } else { $shell.AppActivate('Nebulum') | Out-Null }",
    "Start-Sleep -Milliseconds 140",
    "$shell.SendKeys('{F11}')",
    enterFullscreen
      ? ""
      : "if ($target) { Start-Sleep -Milliseconds 260; [NebulumWindow]::MoveWindow($target.MainWindowHandle, $screen.Left, $screen.Top, $screen.Width, $screen.Height, $true) | Out-Null }",
  ].join("; ");
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
}

function sendWindowFitToScreen() {
  if (process.platform !== "win32") {
    return;
  }

  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    `Add-Type -TypeDefinition '${MOVE_WINDOW_TYPE_DEFINITION.replaceAll("'", "''")}'`,
    "$target = $null",
    "for ($attempt = 0; $attempt -lt 40 -and -not $target; $attempt += 1) { $target = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*Nebulum*' } | Select-Object -First 1; if (-not $target) { Start-Sleep -Milliseconds 150 } }",
    "$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds",
    "if ($target) { [NebulumWindow]::MoveWindow($target.MainWindowHandle, $screen.Left, $screen.Top, $screen.Width, $screen.Height, $true) | Out-Null }",
  ].join("; ");
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
}

function openPwaWindow(request) {
  if (process.platform !== "win32") {
    return false;
  }

  const browser = findBrowser();
  if (!browser) {
    return false;
  }

  const bounds = getNebulumWindowBounds();
  const profileDir = prepareNebulumBrowserProfile(bounds);
  startWindowBoundsWatcher();
  const child = spawn(
    browser,
    [
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-session-crashed-bubble",
      `--app=${getLaunchShellUrl(request)}`,
      "--autoplay-policy=no-user-gesture-required",
      `--window-size=${bounds.width},${bounds.height}`,
      `--window-position=${bounds.left},${bounds.top}`,
    ],
    { detached: true, stdio: "ignore", windowsHide: false },
    );
    child.unref();
    lockNebulumWindowBounds();
    return true;
  }

function getOpenPwaUrl(request) {
  const host = request.headers.host || `127.0.0.1:${port}`;
  return `http://${host}/?${APP_LAUNCH_PARAM}=1`;
}

function getLaunchShellUrl(request) {
  const host = request.headers.host || `127.0.0.1:${port}`;
  const target = encodeURIComponent(getOpenPwaUrl(request));
  return `http://${host}${NEBULUM_LAUNCH_PATH}?target=${target}&nonce=${Date.now()}`;
}

function findBrowser() {
  const candidates = [
    path.join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

function getNebulumWindowBounds() {
  const screen = getPrimaryScreenBounds();
  const marginX = Math.max(24, Math.floor(screen.width * 0.02));
  const marginY = Math.max(24, Math.floor(screen.height * 0.025));
  const width = screen.width - marginX * 2;
  let height = screen.height - marginY * 2;
  if (width < Math.floor(height * 1.45)) {
    height = Math.floor(width / 1.45);
  }
  return {
    left: screen.left + Math.floor((screen.width - width) / 2),
    top: screen.top + Math.floor((screen.height - height) / 2),
    width,
    height,
  };
}

function prepareNebulumBrowserProfile(bounds) {
  const profileDir = getNebulumBrowserProfileDir();
  const defaultProfileDir = path.join(profileDir, "Default");
  refreshNebulumIconCache(profileDir);
  mkdirSync(defaultProfileDir, { recursive: true });
  writeProfileWindowPlacement(path.join(defaultProfileDir, "Preferences"), bounds);
  return profileDir;
}

function getNebulumBrowserProfileDir() {
  return path.join(process.env.LOCALAPPDATA || os.homedir(), "Nebulum", "BrowserProfile");
}

function writeProfileWindowPlacement(preferencesPath, bounds) {
  const prefs = readJsonFile(preferencesPath);
  const screen = getPrimaryScreenBounds();
  prefs.browser = prefs.browser && typeof prefs.browser === "object" ? prefs.browser : {};
  prefs.browser.window_placement = {
    bottom: bounds.top + bounds.height,
    left: bounds.left,
    maximized: false,
    right: bounds.left + bounds.width,
    top: bounds.top,
    work_area_bottom: screen.top + screen.height,
    work_area_left: screen.left,
    work_area_right: screen.left + screen.width,
    work_area_top: screen.top,
  };
  writeFileSync(preferencesPath, JSON.stringify(prefs), "utf8");
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function refreshNebulumIconCache(profileDir) {
  if (process.platform !== "win32") {
    return;
  }

  const markerPath = path.join(profileDir, "icon-cache-version.txt");
  try {
    if (readFileSync(markerPath, "utf8").trim() === ICON_CACHE_VERSION) {
      return;
    }
  } catch {}

  stopNebulumBrowserProfileProcesses();
  const defaultProfileDir = path.join(profileDir, "Default");
  for (const cachePath of [
    path.join(defaultProfileDir, "Favicons"),
    path.join(defaultProfileDir, "Favicons-journal"),
    path.join(defaultProfileDir, "Shortcuts"),
    path.join(defaultProfileDir, "Shortcuts-journal"),
    path.join(defaultProfileDir, "Top Sites"),
    path.join(defaultProfileDir, "Top Sites-journal"),
    path.join(defaultProfileDir, "Web Applications", "Manifest Resources"),
  ]) {
    try {
      rmSync(cachePath, { recursive: true, force: true });
    } catch {}
  }

  mkdirSync(profileDir, { recursive: true });
  writeFileSync(markerPath, ICON_CACHE_VERSION, "utf8");
}

function stopNebulumBrowserProfileProcesses() {
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "Get-CimInstance Win32_Process | Where-Object { ($_.Name -match 'chrome|msedge') -and ($_.CommandLine -match 'Nebulum[\\\\/]BrowserProfile') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
      ],
      { stdio: "ignore", windowsHide: true, timeout: 4000 },
    );
  } catch {}
}


function getPrimaryScreenBounds() {
  if (process.platform !== "win32") {
    return { left: 0, top: 0, width: 1600, height: 900 };
  }

  try {
    const command = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds",
      "[Console]::WriteLine(($screen.Left.ToString() + ',' + $screen.Top + ',' + $screen.Width + ',' + $screen.Height))",
    ].join("; ");
    const output = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { encoding: "utf8", windowsHide: true, timeout: 3000 },
    ).trim();
    const [left, top, width, height] = output.split(",").map((value) => Number(value));
    if ([left, top, width, height].every(Number.isFinite) && width > 0 && height > 0) {
      return { left, top, width, height };
    }
  } catch {}

  return { left: 0, top: 0, width: 1600, height: 900 };
}

function startWindowBoundsWatcher() {
  if (process.platform !== "win32") {
    return;
  }

  const candidates = [
    path.join(path.dirname(root), "scripts", "nebulum-window-bounds-watcher.ps1"),
    path.join(process.cwd(), "scripts", "nebulum-window-bounds-watcher.ps1"),
  ];
  const watcherScript = candidates.find((candidate) => existsSync(candidate));
  if (!watcherScript) {
    return;
  }

  stopWindowBoundsWatchers();
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `& '${watcherScript.replaceAll("'", "''")}'`],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
}

function stopWindowBoundsWatchers() {
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*nebulum-window-bounds-watcher.ps1*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
      ],
      { stdio: "ignore", windowsHide: true, timeout: 3000 },
    );
  } catch {}
}

function lockNebulumWindowBounds() {
  if (process.platform !== "win32") {
    return;
  }

  const command = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public class NebulumWindowLock {
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$marginX = [Math]::Max(24, [Math]::Floor($screen.Width * 0.02))
$marginY = [Math]::Max(24, [Math]::Floor($screen.Height * 0.025))
$width = $screen.Width - ($marginX * 2)
$height = $screen.Height - ($marginY * 2)
if ($width -lt [Math]::Floor($height * 1.45)) { $height = [Math]::Floor($width / 1.45) }
$left = $screen.Left + [Math]::Floor(($screen.Width - $width) / 2)
$top = $screen.Top + [Math]::Floor(($screen.Height - $height) / 2)
$target = $null
$profileNeedle = "Nebulum\\BrowserProfile"
for ($attempt = 0; $attempt -lt 80 -and -not $target; $attempt += 1) {
  $browserProcesses = Get-CimInstance Win32_Process | Where-Object { ($_.Name -match "chrome|msedge") -and ($_.CommandLine -like "*$profileNeedle*") }
  foreach ($browserProcess in $browserProcesses) {
    $candidate = Get-Process -Id $browserProcess.ProcessId -ErrorAction SilentlyContinue
    if ($candidate -and $candidate.MainWindowHandle -ne 0) {
      $target = $candidate
      break
    }
  }
  if (-not $target) {
    $target = Get-Process chrome, msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq "Nebulum" } | Select-Object -First 1
  }
  if (-not $target) { Start-Sleep -Milliseconds 50 }
}
if ($target) {
  $GWL_STYLE = -16
  $WS_THICKFRAME = 0x00040000
  $WS_MAXIMIZEBOX = 0x00010000
  $SWP_NOSIZE = 0x0001
  $SWP_NOMOVE = 0x0002
  $SWP_NOZORDER = 0x0004
  $SWP_NOACTIVATE = 0x0010
  $SWP_FRAMECHANGED = 0x0020
  $style = [NebulumWindowLock]::GetWindowLong($target.MainWindowHandle, $GWL_STYLE)
  $lockedStyle = $style -band (-bnot ($WS_THICKFRAME -bor $WS_MAXIMIZEBOX))
  [NebulumWindowLock]::SetWindowLong($target.MainWindowHandle, $GWL_STYLE, $lockedStyle) | Out-Null
  [NebulumWindowLock]::SetWindowPos($target.MainWindowHandle, [IntPtr]::Zero, 0, 0, 0, 0, $SWP_NOSIZE -bor $SWP_NOMOVE -bor $SWP_NOZORDER -bor $SWP_NOACTIVATE -bor $SWP_FRAMECHANGED) | Out-Null
  [NebulumWindowLock]::MoveWindow($target.MainWindowHandle, $left, $top, $width, $height, $true) | Out-Null
}
`;

  try {
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { stdio: "ignore", windowsHide: true, timeout: 6000 },
    );
  } catch {}
}

async function readRequestJson(request) {
  const chunks = [];
  let totalLength = 0;
  for await (const chunk of request) {
    totalLength += chunk.length;
    if (totalLength > 64 * 1024) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, HEAD, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(body));
}

function sendLaunchShell(response) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nebulum</title>
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #050506;
    }
  </style>
</head>
<body>
  <script>
    const params = new URLSearchParams(location.search);
    const target = params.get("target") || "/?${APP_LAUNCH_PARAM}=1";
    location.replace(new URL(target, location.origin).toString());
  </script>
</body>
</html>`);
}

function withServerMeta(body) {
  return {
    ...body,
    serverVersion: SERVER_VERSION,
  };
}

async function resolveStaticPath(requestUrl) {
  const url = new URL(requestUrl, "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  const filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== root) {
    return null;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isFile()) {
      return { filePath, stat };
    }
  } catch {}

  const fallbackPath = path.join(root, "index.html");
  const fallbackStat = await fs.stat(fallbackPath);
  return { filePath: fallbackPath, stat: fallbackStat };
}

function sendStaticFile(request, response, filePath, stat) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes.get(extension) || "application/octet-stream";
  const range = request.headers.range;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (start <= end && end < stat.size) {
        response.writeHead(206, {
          "accept-ranges": "bytes",
          "content-range": `bytes ${start}-${end}/${stat.size}`,
          "content-length": end - start + 1,
          "content-type": contentType,
        });
        createReadStream(filePath, { start, end }).pipe(response);
        return;
      }
    }
  }

  response.writeHead(200, {
    "accept-ranges": "bytes",
    "content-length": stat.size,
    "content-type": contentType,
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname === NEBULUM_LAUNCH_PATH) {
      if (request.method === "GET" || request.method === "HEAD") {
        sendLaunchShell(response);
        return;
      }
      sendJson(response, 405, { ok: false });
      return;
    }

    if (url.pathname === "/api/window-settings") {
      if (request.method === "GET") {
        sendJson(response, 200, withServerMeta(await readSettings()));
        return;
      }
      if (request.method === "POST") {
        const settings = await readRequestJson(request);
        await writeSettings(settings);
        if (settings.applyNow === true) {
          sendFullscreenToggle(settings.borderlessWindow === true);
        }
        sendJson(response, 200, withServerMeta(await readSettings()));
        return;
      }
      sendJson(response, 405, { ok: false });
      return;
    }

    if (url.pathname === "/api/window-bounds") {
      if (request.method === "POST") {
        sendWindowFitToScreen();
        sendJson(response, 200, withServerMeta({ ok: true }));
        return;
      }
      sendJson(response, 405, { ok: false });
      return;
    }

    if (url.pathname === "/api/open-pwa") {
      if (request.method === "POST") {
        const opened = openPwaWindow(request);
        sendJson(response, opened ? 200 : 501, withServerMeta({ ok: opened }));
        return;
      }
      sendJson(response, 405, { ok: false });
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { ok: false });
      return;
    }

    const resolved = await resolveStaticPath(request.url);
    if (!resolved) {
      sendJson(response, 404, { ok: false });
      return;
    }

    if (request.method === "HEAD") {
      response.writeHead(200, {
        "content-length": resolved.stat.size,
        "content-type": mimeTypes.get(path.extname(resolved.filePath).toLowerCase()) || "application/octet-stream",
      });
      response.end();
      return;
    }

    sendStaticFile(request, response, resolved.filePath, resolved.stat);
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Nebulum server running at http://127.0.0.1:${port}/`);
});
