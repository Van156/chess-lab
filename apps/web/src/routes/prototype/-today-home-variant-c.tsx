import { Flame, RefreshCw, User } from "lucide-react";
import type { CSSProperties } from "react";

import { Board, type BoardTheme } from "./-today-home-board";
import { navItems, nextUp, pillars, queue, today } from "./-today-home-mock-data";

const palette = {
  "--bg": "#eef1f6",
  "--tile": "#ffffff",
  "--line": "#dde3ee",
  "--fg": "#0f172a",
  "--muted": "#4b5a73",
  "--accent": "#1d4ed8",
  "--accent-fg": "#ffffff",
} as CSSProperties;

const board: BoardTheme = {
  light: "#dbe4f5",
  dark: "#6b86c2",
  lastMove: "rgba(29,78,216,.4)",
  whitePiece: "#ffffff",
  blackPiece: "#0f172a",
};

/** Variant C "Bento": floating pill nav over a tile grid; the board tile spans 2x2. */
export function VariantC() {
  return (
    <div style={palette} className="min-h-[calc(100svh-3rem)] bg-(--bg) p-4 text-(--fg) md:p-6">
      <nav
        aria-label="Primary"
        className="sticky top-3 z-10 mx-auto mb-4 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full bg-(--tile) p-1.5 shadow-md ring-1 ring-(--line)"
      >
        {navItems.map((item, index) => (
          <a
            key={item}
            href="#"
            aria-current={index === 0 ? "page" : undefined}
            className="flex min-h-11 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap text-(--muted) hover:text-(--fg) aria-[current=page]:bg-(--accent) aria-[current=page]:text-(--accent-fg)"
          >
            {item}
          </a>
        ))}
        <button
          type="button"
          aria-label="Account"
          className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-(--bg)"
        >
          <User className="size-5" aria-hidden />
        </button>
      </nav>

      <main className="mx-auto grid max-w-5xl auto-rows-min grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <section className="col-span-2 flex flex-col justify-between gap-3 rounded-3xl bg-(--tile) p-6 shadow-sm ring-1 ring-(--line)">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{today.greeting}</h1>
            <p className="text-sm text-(--muted)">{today.date}</p>
          </div>
          <p className="flex items-center gap-2 text-sm text-(--muted)">
            <RefreshCw className="size-4" aria-hidden />
            {today.sync}
          </p>
        </section>

        <section
          aria-labelledby="c-next"
          className="order-last col-span-2 row-span-2 flex flex-col gap-3 rounded-3xl bg-(--tile) p-4 shadow-sm ring-1 ring-(--line) md:order-none md:col-start-3 md:row-start-1"
        >
          <h2
            id="c-next"
            className="px-1 text-xs font-bold tracking-widest text-(--muted) uppercase"
          >
            Next up
          </h2>
          <Board theme={board} className="rounded-2xl" />
          <p className="px-1 text-lg leading-snug font-bold">{nextUp.prompt}</p>
          <p className="px-1 text-sm text-(--muted)">{nextUp.context}</p>
          <p className="px-1 font-mono text-sm text-(--muted)">{nextUp.moves}</p>
        </section>

        <section className="col-span-2 flex flex-col justify-between gap-4 rounded-3xl bg-(--accent) p-6 text-(--accent-fg) shadow-sm">
          <div>
            <h2 className="text-xs font-bold tracking-widest uppercase opacity-90">
              Today's review
            </h2>
            <p className="mt-1 text-6xl font-extrabold tracking-tight">{queue.total}</p>
            <p className="text-sm opacity-90">
              cards · about {queue.minutes} min ·{" "}
              {queue.parts.map((part) => `${part.count} ${part.label.toLowerCase()}`).join(", ")}
            </p>
          </div>
          <button
            type="button"
            className="min-h-12 rounded-full bg-white px-6 text-base font-bold text-(--accent) hover:bg-white/90"
          >
            Start review
          </button>
        </section>

        <section className="col-span-1 flex flex-col justify-between rounded-3xl bg-(--tile) p-5 shadow-sm ring-1 ring-(--line) md:col-start-1">
          <Flame className="size-6 text-(--accent)" aria-hidden />
          <p className="mt-3 text-4xl font-extrabold">{today.streakDays}</p>
          <p className="text-sm text-(--muted)">day streak</p>
        </section>

        {pillars.map((pillar, index) => (
          <section
            key={pillar.key}
            className={`rounded-3xl bg-(--tile) p-5 shadow-sm ring-1 ring-(--line) ${index === 0 ? "col-span-1" : "col-span-2 md:col-span-2"}`}
          >
            <h2 className="text-sm font-semibold text-(--muted)">{pillar.title}</h2>
            <p className="mt-1 text-3xl font-extrabold">
              {pillar.value}{" "}
              <span className="text-sm font-semibold text-(--accent)">{pillar.unit}</span>
            </p>
            <p className="text-sm text-(--muted)">{pillar.detail}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
