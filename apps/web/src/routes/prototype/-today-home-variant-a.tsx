import {
  BookOpen,
  Crosshair,
  EyeOff,
  Flame,
  Home,
  RefreshCw,
  TrendingUp,
  User,
} from "lucide-react";
import type { CSSProperties } from "react";

import { Board, type BoardTheme } from "./-today-home-board";
import { navItems, nextUp, pillars, queue, today } from "./-today-home-mock-data";

const navIcons = [Home, BookOpen, Crosshair, EyeOff, TrendingUp];

const palette = {
  "--bg": "#0b1220",
  "--surface": "#131c2e",
  "--line": "#243350",
  "--fg": "#e6edf7",
  "--muted": "#a3b3cb",
  "--accent": "#3ee6b0",
  "--accent-fg": "#04231a",
} as CSSProperties;

const board: BoardTheme = {
  light: "#8fa3c4",
  dark: "#3d5278",
  lastMove: "rgba(62,230,176,.45)",
  whitePiece: "#ffffff",
  blackPiece: "#0b1220",
};

/** Variant A "Midnight": left sidebar nav, queue + pillars on the left, board card on the right. */
export function VariantA() {
  return (
    <div
      style={palette}
      className="flex min-h-[calc(100svh-3rem)] flex-col bg-(--bg) text-(--fg) md:flex-row"
    >
      <aside className="flex shrink-0 flex-col gap-4 border-b border-(--line) p-4 md:w-60 md:border-r md:border-b-0">
        <p className="px-3 text-lg font-bold tracking-tight">Chess Lab</p>
        <nav aria-label="Primary">
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {navItems.map((item, index) => {
              const Icon = navIcons[index];
              return (
                <li key={item}>
                  <a
                    href="#"
                    aria-current={index === 0 ? "page" : undefined}
                    className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium whitespace-nowrap text-(--muted) hover:text-(--fg) aria-[current=page]:bg-(--surface) aria-[current=page]:text-(--accent)"
                  >
                    <Icon className="size-4" aria-hidden />
                    {item}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <p className="mt-auto hidden items-center gap-2 px-3 text-xs text-(--muted) md:flex">
          <RefreshCw className="size-3.5" aria-hidden />
          {today.sync}
        </p>
      </aside>

      <main className="flex-1 p-4 md:p-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{today.greeting}</h1>
            <p className="text-sm text-(--muted)">{today.date}</p>
          </div>
          <div className="flex items-center gap-3">
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-6">
            <section
              aria-labelledby="a-queue"
              className="rounded-2xl border border-(--line) bg-(--surface) p-6"
            >
              <h2
                id="a-queue"
                className="text-sm font-semibold tracking-wide text-(--muted) uppercase"
              >
                Today's review
              </h2>
              <p className="mt-2 text-5xl font-bold tracking-tight">
                {queue.total} <span className="text-xl font-medium text-(--muted)">cards</span>
              </p>
              <p className="mt-1 text-sm text-(--muted)">About {queue.minutes} min</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {queue.parts.map((part) => (
                  <li
                    key={part.label}
                    className="rounded-full border border-(--line) px-3 py-1 text-sm"
                  >
                    <span className="font-semibold text-(--accent)">{part.count}</span> {part.label}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-6 min-h-12 w-full rounded-2xl bg-(--accent) px-6 text-base font-bold text-(--accent-fg) hover:brightness-110 sm:w-auto"
              >
                Start review
              </button>
            </section>

            <ul className="grid gap-4 sm:grid-cols-3">
              {pillars.map((pillar) => (
                <li
                  key={pillar.key}
                  className="rounded-2xl border border-(--line) bg-(--surface) p-4"
                >
                  <h3 className="text-sm font-semibold text-(--muted)">{pillar.title}</h3>
                  <p className="mt-1 text-3xl font-bold">
                    {pillar.value}{" "}
                    <span className="text-sm font-medium text-(--accent)">{pillar.unit}</span>
                  </p>
                  <p className="mt-1 text-sm text-(--muted)">{pillar.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          <section
            aria-labelledby="a-next"
            className="flex flex-col gap-4 self-start rounded-2xl border border-(--line) bg-(--surface) p-4"
          >
            <h2
              id="a-next"
              className="text-sm font-semibold tracking-wide text-(--muted) uppercase"
            >
              Next up
            </h2>
            <Board theme={board} className="rounded-xl" />
            <p className="text-lg font-semibold">{nextUp.prompt}</p>
            <p className="text-sm text-(--muted)">{nextUp.context}</p>
            <p className="font-mono text-sm text-(--muted)">{nextUp.moves}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
