import { Flame, User } from "lucide-react";
import type { CSSProperties } from "react";

import { Board, type BoardTheme } from "./-today-home-board";
import { navItems, nextUp, pillars, queue, today } from "./-today-home-mock-data";

const palette = {
  "--bg": "#eee9ff",
  "--card": "#ffffff",
  "--fg": "#241a4a",
  "--muted": "#5a4f85",
  "--violet": "#5b2bd9",
  "--coral": "#ff6b57",
  "--coral-fg": "#2d0a05",
} as CSSProperties;

const board: BoardTheme = {
  light: "#f1e8ff",
  dark: "#a58ce8",
  lastMove: "rgba(255,107,87,.55)",
  whitePiece: "#ffffff",
  blackPiece: "#241a4a",
};

/** Pillar card tints: [background, text-friendly accent]. All pairs keep text above 4.5:1. */
const tints = ["#ffe0dc", "#d8f5e6", "#d9ebff"] as const;

const ringColors = ["var(--coral)", "var(--violet)", "#f5b82e"] as const;

/** Segmented donut of the queue parts, drawn as stroked circles on a 0-18 path. */
function QueueRing() {
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="size-32 shrink-0 -rotate-90" aria-hidden>
      <circle cx="60" cy="60" r="48" fill="none" stroke="#e4dbff" strokeWidth="14" />
      {queue.parts.map((part, index) => {
        const start = offset;
        offset += part.count;
        return (
          <circle
            key={part.label}
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke={ringColors[index]}
            strokeWidth="14"
            strokeLinecap="round"
            pathLength={queue.total}
            strokeDasharray={`${part.count - 0.8} ${queue.total - part.count + 0.8}`}
            strokeDashoffset={-start}
          />
        );
      })}
    </svg>
  );
}

/** Variant E "Playful": pill nav, greeting card with progress ring + CTA, board card, tinted pillars. */
export function VariantE() {
  return (
    <div style={palette} className="min-h-[calc(100svh-3rem)] bg-(--bg) p-4 text-(--fg) md:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="Primary"
            className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[32px] bg-(--card) p-1.5 shadow-sm"
          >
            {navItems.map((item, index) => (
              <a
                key={item}
                href="#"
                aria-current={index === 0 ? "page" : undefined}
                className="flex min-h-11 items-center rounded-[32px] px-4 text-sm font-bold whitespace-nowrap text-(--muted) hover:text-(--violet) aria-[current=page]:bg-(--violet) aria-[current=page]:text-white"
              >
                {item}
              </a>
            ))}
          </nav>
          <button
            type="button"
            aria-label="Account"
            className="flex size-11 items-center justify-center rounded-full bg-(--card) shadow-sm hover:bg-(--violet) hover:text-white"
          >
            <User className="size-5" aria-hidden />
          </button>
        </header>

        <section
          aria-labelledby="e-hello"
          className="flex flex-col items-center gap-5 rounded-[32px] bg-(--card) p-6 text-center shadow-sm sm:flex-row sm:text-left"
        >
          <div className="relative">
            <QueueRing />
            <p className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl leading-none font-black">{queue.total}</span>
              <span className="text-xs font-bold text-(--muted)">cards</span>
            </p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-3 sm:items-start">
            <div>
              <h1 id="e-hello" className="text-2xl font-black tracking-tight">
                {today.greeting}!
              </h1>
              <p className="text-sm text-(--muted)">
                {today.date} · {today.sync}
              </p>
            </div>
            <p className="flex items-center gap-1.5 rounded-full bg-[#ffe0dc] px-3 py-1.5 text-sm font-bold">
              <Flame className="size-4 text-[#b3261e]" aria-hidden />
              {today.streakDays} day streak
            </p>
            <button
              type="button"
              className="min-h-12 rounded-[32px] bg-(--coral) px-8 text-base font-black text-(--coral-fg) hover:brightness-105"
            >
              Start review · ~{queue.minutes} min
            </button>
          </div>
        </section>

        <section
          aria-labelledby="e-next"
          className="grid items-center gap-5 rounded-[32px] bg-(--card) p-5 shadow-sm sm:grid-cols-[minmax(0,260px)_1fr]"
        >
          <Board theme={board} className="rounded-3xl" />
          <div className="flex flex-col gap-2">
            <h2
              id="e-next"
              className="text-xs font-black tracking-widest text-(--violet) uppercase"
            >
              Next up
            </h2>
            <p className="text-xl leading-snug font-extrabold">{nextUp.prompt}</p>
            <p className="text-sm text-(--muted)">{nextUp.context}</p>
            <p className="font-mono text-sm text-(--muted)">{nextUp.moves}</p>
          </div>
        </section>

        <ul className="grid gap-4 sm:grid-cols-3">
          {pillars.map((pillar, index) => (
            <li
              key={pillar.key}
              style={{ backgroundColor: tints[index] }}
              className="rounded-[32px] p-5 text-(--fg)"
            >
              <h2 className="text-sm font-black">{pillar.title}</h2>
              <p className="text-4xl font-black">
                {pillar.value} <span className="text-sm font-bold">{pillar.unit}</span>
              </p>
              <p className="text-sm font-medium text-(--muted)">{pillar.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
