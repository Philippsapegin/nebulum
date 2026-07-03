import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { createReadStream, existsSync } from "node:fs";
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
const SERVER_VERSION = 9;
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
    borderlessWindow: settings.borderlessWindow !== false,
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

function openPwaWindow() {
  if (process.platform !== "win32") {
    return false;
  }

  const candidates = [
    path.join(path.dirname(root), "scripts", "run-nebulum.ps1"),
    path.join(process.cwd(), "scripts", "run-nebulum.ps1"),
  ];
  const runScript = candidates.find((candidate) => existsSync(candidate));
  if (!runScript) {
    return false;
  }

  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", runScript],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
  return true;
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
  });
  response.end(JSON.stringify(body));
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
    if (url.pathname === "/api/window-settings") {
      if (request.method === "GET") {
        sendJson(response, 200, withServerMeta(await readSettings()));
        return;
      }
      if (request.method === "POST") {
        const settings = await readRequestJson(request);
        await writeSettings(settings);
        if (settings.applyNow === true) {
          sendFullscreenToggle(settings.borderlessWindow !== false);
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
        sendJson(response, openPwaWindow() ? 200 : 501, withServerMeta({ ok: process.platform === "win32" }));
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
