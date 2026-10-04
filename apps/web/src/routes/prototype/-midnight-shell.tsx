import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Crosshair,
  EyeOff,
  Flame,
  Home,
  ListChecks,
  RefreshCw,
  TrendingUp,
  User,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import type { BoardTheme } from "./-today-home-board";
import { today } from "./-today-home-mock-data";
import { midnightVariants } from "./-registry";

const palette = {
  "--bg": "#0b1220",
  "--surface": "#131c2e",
  "--line": "#243350",
  "--fg": "#e6edf7",
  "--muted": "#a3b3cb",
  "--accent": "#3ee6b0",
  "--accent-fg": "#04231a",
} as CSSProperties;

/** Board colours shared by every Midnight screen. */
export const midnightBoard: BoardTheme = {
  light: "#8fa3c4",
  dark: "#3d5278",
  lastMove: "rgba(62,230,176,.45)",
  highlight: "rgba(255,214,102,.55)",
  arrow: "#3ee6b0",
  whitePiece: "#ffffff",
  blackPiece: "#0b1220",
};

/** Class strings shared by the screens so every view keeps the same look. */
export const cardClass = "rounded-2xl border border-(--line) bg-(--surface) p-4 md:p-6";
export const eyebrowClass = "text-sm font-semibold tracking-wide text-(--muted) uppercase";
export const primaryButtonClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-(--accent) px-6 text-base font-bold text-(--accent-fg) hover:brightness-110 disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-(--line) bg-(--bg) px-4 text-sm font-semibold hover:border-(--accent) aria-pressed:border-(--accent) aria-pressed:text-(--accent)";
export const chipClass =
  "inline-flex min-h-11 items-center rounded-full border border-(--line) px-4 text-sm font-medium hover:border-(--accent) aria-pressed:border-(--accent) aria-pressed:bg-(--bg) aria-pressed:text-(--accent)";

const navIcons: Record<string, LucideIcon> = {
  A: Home,
  B: ListChecks,
  C: BookOpen,
  D: Crosshair,
  E: EyeOff,
  F: TrendingUp,
};

interface MidnightShellProps {
  /** Key of the active screen, matching the `?variant=` value. */
  current: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Midnight app chrome: palette root, sidebar (top strip on mobile) and page header. */
export function MidnightShell({ current, title, subtitle, children }: MidnightShellProps) {
  return (
    <div
      style={palette}
      className="flex min-h-[calc(100svh-3rem)] flex-col bg-(--bg) text-(--fg) md:flex-row"
    >
      <aside className="flex shrink-0 flex-col gap-4 border-b border-(--line) p-4 md:w-60 md:border-r md:border-b-0">
        <p className="px-3 text-lg font-bold tracking-tight">Chess Lab</p>
        <nav aria-label="Primary">
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {midnightVariants.map((variant) => {
              const Icon = navIcons[variant.key];
              const active = variant.key === current;
              return (
                <li key={variant.key}>
                  <Link
                    to="/prototype/midnight"
                    search={{ variant: variant.key }}
                    aria-current={active ? "page" : undefined}
                    className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium whitespace-nowrap text-(--muted) hover:text-(--fg) aria-[current=page]:bg-(--surface) aria-[current=page]:text-(--accent)"
                  >
                    <Icon className="size-4" aria-hidden />
                    {variant.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <main className="flex-1 p-4 pb-24 md:p-8 md:pb-24">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-(--muted)">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden items-center gap-2 text-xs text-(--muted) lg:flex">
              <RefreshCw className="size-3.5" aria-hidden />
              {today.sync}
            </p>
            <span className="flex items-center gap-1.5 rounded-full bg-(--surface) px-3 py-2 text-sm font-semibold">
              <Flame className="size-4 text-(--accent)" aria-hidden />
              {today.streakDays} days
            </span>
            <button
              type="button"
              aria-label="Account"
              className="flex size-11 items-center justify-center rounded-full border border-(--line) bg-(--surface) hover:border-(--accent)"
            >
              <User className="size-5" aria-hidden />
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
