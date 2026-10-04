/**
 * Single source of truth for the product identity. Color is the other knob: change `--brand-hue`
 * in `packages/ui/src/styles/globals.css`. This module is also imported by `vite.config.ts`, so
 * it must stay free of browser-only imports.
 */
export const brand = {
  name: "B2C Template",
  tagline: "Your personal account, preferences and activity in one place.",
  logo: { src: "/logo.png" },
  /** sRGB hex of the light-mode `--sidebar` token, `oklch(0.22 0.015 225)`; used as the PWA `theme_color`. */
  themeColor: "#131c20",
} as const;
