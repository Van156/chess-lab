/**
 * Post-build guard: reads `dist/sw.js` and `dist/assets` and fails the build when the opening book
 * is precached or no longer sits in its own lazy chunk. See `lib/precache-guard.ts`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
for (const name of readdirSync(join(dist, "assets"))) {
  if (!name.endsWith(".js")) continue;
  const url = `assets/${name}`;
  (precachedUrls.has(url) ? precached : lazy)[url] = readFileSync(join(dist, url), "utf8");
}

const result = checkOpeningBookPlacement({ precached, lazy });
if (!result.ok) {
  console.error(`check-precache: ${result.error}`);
  process.exit(1);
}
console.log(
  `check-precache: OK, the opening book is only in ${result.bookFiles.join(", ")} (${precachedUrls.size} precached files, none holds it)`,
);
