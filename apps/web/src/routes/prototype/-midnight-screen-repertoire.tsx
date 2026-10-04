import { useState } from "react";

import {
  repertoireLines,
  repertoireSquares,
  sides,
  type LineStatus,
  type Side,
} from "./-midnight-repertoire-data";
import {
  cardClass,
  chipClass,
  eyebrowClass,
  midnightBoard,
  MidnightShell,
  primaryButtonClass,
} from "./-midnight-shell";
import { Board } from "./-today-home-board";

const statusTone: Record<LineStatus, string> = {
  Due: "border-(--accent) text-(--accent)",
  Learning: "border-amber-300 text-amber-200",
  Solid: "border-(--line) text-(--muted)",
};

/** Screen C: Repertoire. Pick a side and a line; the board shows its visual idea note. */
export function RepertoireScreen() {
  const [side, setSide] = useState<Side>("White");
  const [selectedId, setSelectedId] = useState("w-italian");

  const lines = repertoireLines.filter((line) => line.side === side);
  const selected = lines.find((line) => line.id === selectedId) ?? lines[0];
  const dueCount = lines.filter((line) => line.status === "Due").length;

  return (
    <MidnightShell
      current="C"
      title="Repertoire"
      subtitle={`${repertoireLines.length} lines in this demo · 80 in your full repertoire`}
    >
      <div role="group" aria-label="Repertoire side" className="mb-6 flex flex-wrap gap-2">
        {sides.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={side === item}
            onClick={() => setSide(item)}
            className={chipClass}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-labelledby="m-lines" className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="m-lines" className={eyebrowClass}>
              {side} lines
            </h2>
            <p className="text-sm text-(--muted)">{dueCount} due today</p>
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {lines.map((line) => (
              <li key={line.id}>
                <button
                  type="button"
                  aria-pressed={line.id === selected.id}
                  onClick={() => setSelectedId(line.id)}
                  className="flex w-full flex-col gap-2 rounded-2xl border border-(--line) bg-(--bg) p-4 text-left hover:border-(--accent) aria-pressed:border-(--accent)"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{line.name}</span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusTone[line.status]}`}
                    >
                      {line.status}
                    </span>
                  </span>
                  <span className="font-mono text-sm text-(--muted)">{line.moves}</span>
                  <span className="flex items-center gap-3 text-xs text-(--muted)">
                    <span>
                      {line.eco} · {line.explorer.games} games
                    </span>
                    <span
                      role="img"
                      aria-label={`Results: White ${line.explorer.white}%, draw ${line.explorer.draw}%, Black ${line.explorer.black}%`}
                      className="flex h-2 flex-1 overflow-hidden rounded-full"
                    >
                      <span className="bg-white" style={{ width: `${line.explorer.white}%` }} />
                      <span className="bg-(--muted)" style={{ width: `${line.explorer.draw}%` }} />
                      <span className="bg-(--line)" style={{ width: `${line.explorer.black}%` }} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-(--muted)">
            Explorer stats: Lichess games rated 1400-1600, results from White's view.
          </p>
        </section>

        <section
          aria-labelledby="m-idea"
          className="flex flex-col gap-4 self-start rounded-2xl border border-(--line) bg-(--surface) p-4"
        >
          <h2 id="m-idea" className={eyebrowClass}>
            Idea note
          </h2>
          <Board
            theme={midnightBoard}
            className="rounded-xl"
            squares={repertoireSquares.get(selected.id)}
            label={`${selected.name} after ${selected.moves}. Arrows mark the key moves.`}
            arrows={selected.arrows}
            highlights={selected.highlights}
          />
          <p className="text-lg font-semibold">{selected.name}</p>
          <p className="text-sm text-(--muted)">{selected.plan}</p>
          <p className="font-mono text-sm text-(--muted)">{selected.moves}</p>
          <button type="button" className={primaryButtonClass}>
            Drill this line
          </button>
        </section>
      </div>
    </MidnightShell>
  );
}
