import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const gasPalettesPath = path.join(rootDir, "src", "gasGiantPalettes.js");
const planetPalettesPath = path.join(rootDir, "src", "planetPalettes.js");
const moltenPalettesPath = path.join(rootDir, "src", "moltenPalettes.js");
const moonPalettesPath = path.join(rootDir, "src", "moonPalettes.js");

function paletteWriter() {
  const routes = new Map([
    ["/api/gas-giant-palettes", { path: gasPalettesPath, exportName: "GAS_GIANT_PALETTES" }],
    ["/api/planet-palettes", { path: planetPalettesPath, exportName: "PLANET_PALETTES" }],
    ["/api/molten-palettes", { path: moltenPalettesPath, exportName: "MOLTEN_PALETTES" }],
    ["/api/moon-palettes", { path: moonPalettesPath, exportName: "MOON_PALETTES" }],
  ]);

  return {
    name: "palette-writer",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const route = routes.get(request.url);
        if (!route) {
          next();
          return;
        }

        if (request.method !== "POST") {
          next();
          return;
        }

        try {
          const body = await new Promise((resolve, reject) => {
            let data = "";
            request.setEncoding("utf8");
            request.on("data", (chunk) => {
              data += chunk;
            });
            request.on("end", () => resolve(data));
            request.on("error", reject);
          });
          const palettes = JSON.parse(body);
          if (!Array.isArray(palettes)) {
            throw new Error("Palette payload must be an array.");
          }

          const file = `export const ${route.exportName} = ${JSON.stringify(palettes, null, 2)};\n`;
          await fs.writeFile(route.path, file, "utf8");
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ ok: true }));
        } catch (error) {
          response.statusCode = 400;
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ ok: false, error: error.message }));
        }
      });
    },
  };
}

function localPwaLauncher() {
  function getOpenPwaUrl(request) {
    const host = request.headers.host || "127.0.0.1:5173";
    return `http://${host}/?${APP_LAUNCH_PARAM}=1`;
  }

  function getLaunchShellUrl(request) {
    const host = request.headers.host || "127.0.0.1:5173";
    const target = encodeURIComponent(getOpenPwaUrl(request));
    return `http://${host}${NEBULUM_LAUNCH_PATH}?target=${target}&nonce=${Date.now()}`;
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

  function handleLocalPwaRequest(request, response, next) {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === NEBULUM_LAUNCH_PATH) {
      sendLaunchShell(response);
      return;
    }

    if (url.pathname !== "/api/open-pwa") {
      next();
      return;
    }

    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-methods", "POST, OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type");
    if (request.method === "OPTIONS") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method !== "POST") {
      response.statusCode = 405;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: false }));
      return;
    }

    if (process.platform !== "win32") {
      response.statusCode = 501;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: false }));
      return;
    }

    const opened = openPwaWindow(request);
    response.statusCode = opened ? 200 : 501;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: opened }));
  }

  return {
    name: "local-pwa-launcher",
    configureServer(server) {
      server.middlewares.use(handleLocalPwaRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleLocalPwaRequest);
    },
  };
}

const APP_LAUNCH_PARAM = "nebulumApp";
const NEBULUM_LAUNCH_PATH = "/nebulum-launch.html";

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

  const watcherScript = path.join(rootDir, "scripts", "nebulum-window-bounds-watcher.ps1");
  if (!existsSync(watcherScript)) {
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

function sendLaunchShell(response) {
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "no-store");
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

export default defineConfig(({ mode }) => {
  const shouldAnalyze = mode === "analyze" || process.env.ANALYZE === "true";

  return {
    base: "./",
    build: {
      chunkSizeWarningLimit: 600,
      copyPublicDir: mode !== "analyze",
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/three")) {
              return "three-vendor";
            }
          },
        },
      },
    },
    plugins: [
      paletteWriter(),
      localPwaLauncher(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        manifest: {
          id: "/",
          name: "Nebulum",
          short_name: "Nebulum",
          description: "Procedural stellar atlas and system exploration.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          display_override: ["window-controls-overlay", "standalone"],
          background_color: "#050506",
          theme_color: "#050506",
          orientation: "landscape",
          categories: ["games", "entertainment"],
          icons: [
            {
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          navigateFallback: "/index.html",
          runtimeCaching: [
            {
              urlPattern: /\/Music\/.*\.mp3$/,
              handler: "NetworkFirst",
              options: {
                cacheName: "nebulum-audio",
                expiration: {
                  maxEntries: 16,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/Sounds\/.*\.(?:mp3|wav|ogg)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "nebulum-sounds",
                expiration: {
                  maxEntries: 256,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "nebulum-fonts",
                expiration: {
                  maxEntries: 16,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
      shouldAnalyze &&
        visualizer({
          filename: "dist/bundle-analysis.html",
          gzipSize: true,
          open: false,
          template: "treemap",
        }),
    ].filter(Boolean),
  };
});
