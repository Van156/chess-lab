import { Check, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

import {
  importStatus,
  mistakeSquares,
  mistakes,
  openingFilters,
  PLAYED_COLOR,
  phaseFilters,
  type PhaseFilter,
} from "./-midnight-mistakes-data";
import {
  cardClass,
  chipClass,
  eyebrowClass,
  midnightBoard,
  MidnightShell,
  primaryButtonClass,
  secondaryButtonClass,
} from "./-midnight-shell";
import { Board } from "./-today-home-board";

/** Screen D: Mistakes. Filter imported-game mistakes, inspect one, add it to the review queue. */
export function MistakesScreen() {
  const [opening, setOpening] = useState("All");
  const [phase, setPhase] = useState<PhaseFilter>("All");
  const [lowTimeOnly, setLowTimeOnly] = useState(false);
  const [selectedId, setSelectedId] = useState(mistakes[0].id);
  const [added, setAdded] = useState<readonly string[]>([]);

  const visible = mistakes.filter(
    (mistake) =>
      (opening === "All" || mistake.opening === opening) &&
      (phase === "All" || mistake.phase === phase) &&
      (!lowTimeOnly || mistake.lowTime),
  );
  const selected = visible.find((mistake) => mistake.id === selectedId) ?? visible[0];
  const isAdded = selected !== undefined && added.includes(selected.id);

  return (
    <MidnightShell
      current="D"
      title="Mistakes"
      subtitle={`${visible.length} of ${mistakes.length} mistakes from your Lichess games`}
    >
      <p className="mb-6 flex items-center gap-2 text-sm text-(--muted)">
        <RefreshCw className="size-4" aria-hidden />
        {importStatus}
      </p>

      <div className="mb-6 flex flex-col gap-4">
        <div role="group" aria-label="Filter by opening" className="flex flex-wrap gap-2">
          {openingFilters.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={opening === item}
              onClick={() => setOpening(item)}
              className={chipClass}
            >
              {item}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filter by phase and time" className="flex flex-wrap gap-2">
          {phaseFilters.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={phase === item}
              onClick={() => setPhase(item)}
              className={chipClass}
            >
              {item === "All" ? "Any phase" : item}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={lowTimeOnly}
            onClick={() => setLowTimeOnly((value) => !value)}
            className={chipClass}
          >
            Low time only
          </button>
        </div>
      </div>

      {selected === undefined ? (
        <p className={`${cardClass} text-(--muted)`}>No mistakes match these filters.</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section aria-labelledby="m-list" className={cardClass}>
            <h2 id="m-list" className={eyebrowClass}>
              Mistakes
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {visible.map((mistake) => (
                <li key={mistake.id}>
                  <button
                    type="button"
                    aria-pressed={mistake.id === selected.id}
                    onClick={() => setSelectedId(mistake.id)}
                    className="flex w-full flex-col gap-1 rounded-2xl border border-(--line) bg-(--bg) p-4 text-left hover:border-(--accent) aria-pressed:border-(--accent)"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{mistake.opening}</span>
                      <span className="font-mono text-sm font-bold text-red-300">
                        -{mistake.evalLoss.toFixed(1)}
                      </span>
                    </span>
                    <span className="text-sm text-(--muted)">
                      {mistake.phase} · played{" "}
                      <span className="font-mono text-(--fg)">{mistake.played}</span>
                      {mistake.lowTime && " · low time"}
                    </span>
                    {mistake.leftRepertoire && (
                      <span className="text-xs font-semibold text-amber-200">Left repertoire</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="m-detail"
            className="flex flex-col gap-4 self-start rounded-2xl border border-(--line) bg-(--surface) p-4"
          >
            <h2 id="m-detail" className={eyebrowClass}>
              Selected mistake
            </h2>
            <Board
              theme={midnightBoard}
              className="rounded-xl"
              squares={mistakeSquares.get(selected.id)}
              label={`${selected.opening}: you played ${selected.played}, best was ${selected.best}.`}
              arrows={[selected.playedArrow, selected.bestArrow]}
            />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="flex items-center gap-2 text-(--muted)">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: PLAYED_COLOR }}
                    aria-hidden
                  />
                  You played
                </dt>
                <dd className="font-mono text-lg font-bold">{selected.played}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-(--muted)">
                  <span className="size-2.5 rounded-full bg-(--accent)" aria-hidden />
                  Best move
                </dt>
                <dd className="font-mono text-lg font-bold text-(--accent)">{selected.best}</dd>
              </div>
            </dl>
            <p className="text-sm text-(--muted)">
              {selected.game} · eval loss {selected.evalLoss.toFixed(1)}
            </p>
            {isAdded ? (
              <button
                type="button"
                onClick={() => setAdded((ids) => ids.filter((id) => id !== selected.id))}
                className={secondaryButtonClass}
              >
                <Check className="size-4" aria-hidden />
                Added to review (undo)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAdded((ids) => [...ids, selected.id])}
                className={primaryButtonClass}
              >
                <Plus className="size-4" aria-hidden />
                Add to review
              </button>
            )}
          </section>
        </div>
      )}
    </MidnightShell>
  );
}
