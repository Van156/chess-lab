import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, type Plugin } from "vite-plus";

import { brand } from "./src/app/brand";
import { injectBrandTitle } from "./src/app/brand-html";

/** Keeps the static `<title>` in `index.html` in sync with the brand config. */
const brandHtml: Plugin = {
  name: "brand-html",
  transformIndexHtml: (html) => injectBrandTitle(html, brand.name),
};

export default defineConfig({
  server: {
    port: 3001,
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
        globIgnores: ["engine/**", "assets/openings.generated-*.js"],
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
            urlPattern: ({ url }) => url.pathname.startsWith("/assets/openings.generated-"),
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
