import { defineConfig } from "vite";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const gasPalettesPath = path.join(rootDir, "src", "gasGiantPalettes.js");

function gasGiantPaletteWriter() {
  return {
    name: "gas-giant-palette-writer",
    configureServer(server) {
      server.middlewares.use("/api/gas-giant-palettes", async (request, response, next) => {
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

          const file =
            `export const GAS_GIANT_PALETTES = ${JSON.stringify(palettes, null, 2)};\n`;
          await fs.writeFile(gasPalettesPath, file, "utf8");
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

export default defineConfig({
  base: "./",
  plugins: [gasGiantPaletteWriter()],
});
