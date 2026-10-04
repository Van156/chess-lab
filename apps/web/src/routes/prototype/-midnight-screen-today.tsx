import { Link } from "@tanstack/react-router";

import {
  cardClass,
  eyebrowClass,
  midnightBoard,
  MidnightShell,
  primaryButtonClass,
} from "./-midnight-shell";
import { Board } from "./-today-home-board";
import { nextUp, pillars, queue, today } from "./-today-home-mock-data";

/** Screen A: Today. Variant A's content inside the shared Midnight shell. */
export function TodayScreen() {
  return (
    <MidnightShell current="A" title={today.greeting} subtitle={today.date}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="m-queue" className={cardClass}>
            <h2 id="m-queue" className={eyebrowClass}>
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
            <Link
              to="/prototype/midnight"
              search={{ variant: "B" }}
              className={`${primaryButtonClass} mt-6 w-full sm:w-auto`}
            >
              Start review
            </Link>
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
          aria-labelledby="m-next"
          className="flex flex-col gap-4 self-start rounded-2xl border border-(--line) bg-(--surface) p-4"
        >
          <h2 id="m-next" className={eyebrowClass}>
            Next up
          </h2>
          <Board theme={midnightBoard} className="rounded-xl" />
          <p className="text-lg font-semibold">{nextUp.prompt}</p>
          <p className="text-sm text-(--muted)">{nextUp.context}</p>
          <p className="font-mono text-sm text-(--muted)">{nextUp.moves}</p>
        </section>
      </div>
    </MidnightShell>
  );
}
