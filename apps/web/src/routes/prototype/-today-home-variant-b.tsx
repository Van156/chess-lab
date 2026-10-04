import { User } from "lucide-react";
import type { CSSProperties } from "react";

import { Board, type BoardTheme } from "./-today-home-board";
import { navItems, nextUp, pillars, queue, today } from "./-today-home-mock-data";

const palette = {
  "--bg": "#f6f1e4",
  "--fg": "#1d2a22",
  "--muted": "#55645a",
  "--rule": "#1d4a35",
  "--accent": "#1d5a3f",
  "--accent-fg": "#f6f1e4",
} as CSSProperties;

const board: BoardTheme = {
  light: "#eeeed2",
  dark: "#769656",
  lastMove: "rgba(246,214,64,.55)",
  whitePiece: "#ffffff",
  blackPiece: "#161616",
};

/** Variant B "Club": top nav, editorial hero with big numbers, board right, ruled pillar columns. */
export function VariantB() {
  return (
    <div style={palette} className="min-h-[calc(100svh-3rem)] bg-(--bg) text-(--fg)">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-(--rule) py-3">
          <p className="text-lg font-black tracking-tight">Chess Lab</p>
          <nav
            aria-label="Primary"
            className="order-last w-full overflow-x-auto md:order-none md:w-auto"
          >
            <ul className="flex gap-6">
              {navItems.map((item, index) => (
                <li key={item}>
                  <a
                    href="#"
                    aria-current={index === 0 ? "page" : undefined}
                    className="flex min-h-11 items-center border-b-2 border-transparent text-sm font-semibold whitespace-nowrap text-(--muted) hover:text-(--fg) aria-[current=page]:border-(--accent) aria-[current=page]:text-(--fg)"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <button
            type="button"
            aria-label="Account"
            className="flex size-11 items-center justify-center rounded-sm border border-(--rule) hover:bg-(--rule) hover:text-(--accent-fg)"
          >
            <User className="size-5" aria-hidden />
          </button>
        </header>

        <main className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-8">
            <div>
              <p className="text-xs font-bold tracking-widest text-(--muted) uppercase">
                {today.date} · {today.sync}
              </p>
              <h1 className="mt-2 font-serif text-4xl leading-tight font-black tracking-tight md:text-5xl">
                {today.greeting}. {queue.total} cards are due.
              </h1>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-(--rule) border-y-2 border-(--rule)">
              <div className="py-4 pr-3">
                <dt className="text-xs font-bold tracking-widest text-(--muted) uppercase">Due</dt>
                <dd className="font-serif text-5xl font-black md:text-7xl">{queue.total}</dd>
              </div>
              <div className="px-3 py-4 md:px-6">
                <dt className="text-xs font-bold tracking-widest text-(--muted) uppercase">
                  Minutes
                </dt>
                <dd className="font-serif text-5xl font-black md:text-7xl">~{queue.minutes}</dd>
              </div>
              <div className="py-4 pl-3 md:pl-6">
                <dt className="text-xs font-bold tracking-widest text-(--muted) uppercase">
                  Streak
                </dt>
                <dd className="font-serif text-5xl font-black md:text-7xl">{today.streakDays}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <button
                type="button"
                className="min-h-12 rounded-sm bg-(--accent) px-8 text-base font-bold text-(--accent-fg) hover:brightness-125"
              >
                Start review
              </button>
              <p className="text-sm text-(--muted)">
                {queue.parts.map((part) => `${part.count} ${part.label.toLowerCase()}`).join(" · ")}
              </p>
            </div>

            <ul className="grid divide-y divide-(--rule) border-t-2 border-(--rule) sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {pillars.map((pillar, index) => (
                <li key={pillar.key} className={index === 0 ? "py-4 sm:pr-4" : "py-4 sm:px-4"}>
                  <h2 className="text-xs font-bold tracking-widest text-(--muted) uppercase">
                    {pillar.title}
                  </h2>
                  <p className="font-serif text-4xl font-black">
                    {pillar.value}{" "}
                    <span className="font-sans text-sm font-semibold">{pillar.unit}</span>
                  </p>
                  <p className="text-sm text-(--muted)">{pillar.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          <section aria-labelledby="b-next" className="flex flex-col gap-3 self-start">
            <h2 id="b-next" className="text-xs font-bold tracking-widest text-(--muted) uppercase">
              Next up
            </h2>
            <Board theme={board} className="rounded-sm border-2 border-(--rule)" />
            <p className="font-serif text-xl leading-snug font-bold">{nextUp.prompt}</p>
            <p className="text-sm text-(--muted)">{nextUp.context}</p>
            <p className="font-mono text-sm">{nextUp.moves}</p>
          </section>
        </main>
      </div>
    </div>
  );
}
