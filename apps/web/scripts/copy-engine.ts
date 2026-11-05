/**
 * Copies the pinned Stockfish lite single-thread build and its GPL text, byte-identical,
 * from the `stockfish` devDependency into `public/engine/`. The engine is never imported
 * into app code; it is only served as a static asset and loaded in a Web Worker.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENGINE_FILES = [
  { from: "bin/stockfish-19-lite-single.js", to: "stockfish-19-lite-single.js" },
  { from: "bin/stockfish-19-lite-single.wasm", to: "stockfish-19-lite-single.wasm" },
  { from: "Copying.txt", to: "Copying.txt" },
] as const;

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const stockfishRoot = dirname(
  createRequire(join(webRoot, "package.json")).resolve("stockfish/package.json"),
);
const outDir = join(webRoot, "public", "engine");

mkdirSync(outDir, { recursive: true });
for (const { from, to } of ENGINE_FILES) {
  copyFileSync(join(stockfishRoot, from), join(outDir, to));
}
console.log(`copy-engine: ${ENGINE_FILES.length} files -> public/engine`);
