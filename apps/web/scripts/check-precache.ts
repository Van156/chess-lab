/**
 * Post-build guard: reads `dist/sw.js` and every JS file in `dist` and fails the build when the opening book
 * is precached or no longer sits in its own lazy chunk. See `lib/precache-guard.ts`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { checkOpeningBookPlacement, parsePrecachedUrls } from "./lib/precache-guard";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const swPath = join(dist, "sw.js");
if (!existsSync(swPath)) {
  console.error(`check-precache: ${swPath} not found; run the build first.`);
  process.exit(1);
}

const precachedUrls = new Set(parsePrecachedUrls(readFileSync(swPath, "utf8")));
const precached: Record<string, string> = {};
const lazy: Record<string, string> = {};
// Every JS file under dist, wherever it sits, sorted by whether the manifest lists it.
for (const entry of readdirSync(dist, { recursive: true, encoding: "utf8" })) {
  const url = entry.split(sep).join("/");
  if (!url.endsWith(".js")) continue;
  (precachedUrls.has(url) ? precached : lazy)[url] = readFileSync(join(dist, entry), "utf8");
}

const result = checkOpeningBookPlacement({ precached, lazy });
if (!result.ok) {
  console.error(`check-precache: ${result.error}`);
  process.exit(1);
}
console.log(
  `check-precache: OK, the opening book is only in ${result.bookFiles.join(", ")} (${precachedUrls.size} precached files, none holds it)`,
);
