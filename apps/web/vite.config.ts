import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, type Plugin } from "vite-plus";

import { brand } from "./src/app/brand";
import { injectBrandTitle } from "./src/app/brand-html";

/**
 * Name of the chunk that holds the generated opening book (~460 kB, builder only). The chunk
 * file is `assets/<name>-<hash>.js`. The `codeSplitting` group below puts the book data module in
 * it, the precache ignore keeps it out of the precache and the runtime cache rule caches it on
 * first use. The group selects the module by file name; `scripts/check-precache.ts` runs after
 * the build and fails it when the book is precached or has no chunk of its own, whatever the
 * module is called.
 */
const OPENING_BOOK_CHUNK = "opening-book";

/** Keeps the static `<title>` in `index.html` in sync with the brand config. */
const brandHtml: Plugin = {
  name: "brand-html",
  transformIndexHtml: (html) => injectBrandTitle(html, brand.name),
};

export default defineConfig({
  server: {
    port: 3001,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: OPENING_BOOK_CHUNK, test: /openings\.generated\.ts$/ }],
        },
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    brandHtml,
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        // The engine (~7 MB WASM) and the opening book (~460 kB, builder only) are never
        // precached; they are cached on first use instead.
        globIgnores: ["engine/**", `assets/${OPENING_BOOK_CHUNK}-*.js`],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/engine/"),
            handler: "CacheFirst",
            options: {
              cacheName: "engine",
              expiration: { maxEntries: 8 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // A RegExp, not a function: a function is serialized into sw.js and loses this constant.
            urlPattern: new RegExp(`/assets/${OPENING_BOOK_CHUNK}-[^/]+\\.js$`),
            handler: "CacheFirst",
            options: {
              cacheName: "opening-book",
              expiration: { maxEntries: 2 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: brand.name,
        short_name: brand.name,
        description: brand.tagline,
        theme_color: brand.themeColor,
        background_color: brand.themeColor,
      },
      pwaAssets: { disabled: false, config: true },
      devOptions: { enabled: true },
    }),
  ],
});
