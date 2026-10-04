import type { CSSProperties } from "react";

/**
 * Midnight board colours. Values mirror `midnightBoard` in
 * `routes/prototype/-midnight-shell.tsx`, which is deleted in S12, so they are copied here
 * once instead of imported (shared code must not depend on a throwaway prototype route).
 */
export const boardTheme = {
  light: "#8fa3c4",
  dark: "#3d5278",
  highlight: "rgba(255,214,102,.55)",
  lastMove: "rgba(62,230,176,.45)",
  arrow: "#3ee6b0",
} as const;

/** CSS variables set on the board root; square styles read them so a theme swap stays in CSS. */
export const boardThemeStyle = {
  "--board-light": boardTheme.light,
  "--board-dark": boardTheme.dark,
  "--board-highlight": boardTheme.highlight,
  "--board-last-move": boardTheme.lastMove,
  "--board-arrow": boardTheme.arrow,
} as CSSProperties;
