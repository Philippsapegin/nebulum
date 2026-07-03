import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
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
  return {
    name: "local-pwa-launcher",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== "/api/open-pwa") {
          next();
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

        const runScript = path.join(rootDir, "scripts", "run-nebulum.ps1");
        const child = spawn(
          "powershell.exe",
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", runScript],
          { detached: true, stdio: "ignore", windowsHide: true },
        );
        child.unref();
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ ok: true }));
      });
    },
  };
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
