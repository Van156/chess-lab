import type { CSSProperties } from "react";

import { Board, type BoardTheme } from "./-today-home-board";
import { navItems, nextUp, pillars, queue, today } from "./-today-home-mock-data";

const palette = {
  "--bg": "#1b1b1d",
  "--fg": "#f2f0ea",
  "--muted": "#a8a49a",
  "--line": "#3a3a3d",
  "--accent": "#f5a524",
  "--accent-fg": "#1b1b1d",
} as CSSProperties;

const board: BoardTheme = {
  light: "#c9c2b0",
  dark: "#6e675a",
  lastMove: "rgba(245,165,36,.55)",
  whitePiece: "#ffffff",
  blackPiece: "#141414",
};

/** Variant D "Focus": minimal top line, one centered column: board, prompt, full-width CTA, counts. */
export function VariantD() {
  return (
    <div style={palette} className="min-h-[calc(100svh-3rem)] bg-(--bg) text-(--fg)">
      <header className="border-b border-(--line)">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-4 py-1">
          <p className="text-sm font-bold tracking-widest uppercase">Chess Lab</p>
          <button
            type="button"
            aria-label="Account, Alex"
            className="min-h-11 min-w-11 text-sm font-semibold text-(--muted) hover:text-(--accent)"
          >
            {today.account}
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-8 pb-24">
        <div>
          <h1 className="text-sm font-semibold tracking-widest text-(--muted) uppercase">
            {today.date}
          </h1>
          <p className="mt-1 text-sm text-(--muted)">
            {today.sync} · {today.streakDays} day streak
          </p>
        </div>

        <section aria-labelledby="d-next" className="flex flex-col gap-4">
          <h2 id="d-next" className="sr-only">
            Next up
          </h2>
          <Board theme={board} />
          <p className="text-2xl leading-tight font-bold tracking-tight">{nextUp.prompt}</p>
          <p className="text-sm text-(--muted)">{nextUp.context}</p>
          <p className="font-mono text-sm text-(--muted)">{nextUp.moves}</p>
        </section>

        <button
          type="button"
          className="min-h-14 w-full bg-(--accent) px-6 text-lg font-extrabold tracking-wide text-(--accent-fg) uppercase hover:brightness-110"
        >
          Start review · {queue.total} cards · ~{queue.minutes} min
        </button>

        <ul className="flex flex-col divide-y divide-(--line) border-y border-(--line)">
          {pillars.map((pillar) => (
            <li key={pillar.key}>
              <a
                href="#"
                className="flex min-h-14 items-baseline justify-between gap-4 py-3 hover:text-(--accent)"
              >
                <span className="font-semibold">{pillar.title}</span>
                <span className="text-right text-sm text-(--muted)">
                  <span className="text-lg font-bold text-(--fg)">{pillar.value}</span>{" "}
                  {pillar.unit} · {pillar.detail}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <nav aria-label="Primary">
          <ul className="flex flex-wrap gap-x-5">
            {navItems.map((item, index) => (
              <li key={item}>
                <a
                  href="#"
                  aria-current={index === 0 ? "page" : undefined}
                  className="flex min-h-11 items-center text-sm font-semibold text-(--muted) hover:text-(--fg) aria-[current=page]:text-(--accent) aria-[current=page]:underline aria-[current=page]:underline-offset-4"
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
