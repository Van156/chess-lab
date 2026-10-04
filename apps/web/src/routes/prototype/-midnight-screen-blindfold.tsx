import { EyeOff, Mic } from "lucide-react";
import { useState } from "react";

import {
  blindfoldLevels,
  blindfoldModes,
  blindfoldStats,
  replaySeed,
  replaySquares,
  replayTitle,
} from "./-midnight-blindfold-data";
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

/** Groups a flat SAN list into numbered full moves, e.g. "1.e4 e5". */
function toNotationRows(moves: readonly string[]) {
  const rows: { number: number; white: string; black?: string }[] = [];
  moves.forEach((move, index) => {
    if (index % 2 === 0) rows.push({ number: index / 2 + 1, white: move });
    else rows[rows.length - 1].black = move;
  });
  return rows;
}

/** Screen E: Blindfold. Hidden board with Peek, notation feed, typed SAN and a fake voice toggle. */
export function BlindfoldScreen() {
  const [mode, setMode] = useState("replay");
  const [level, setLevel] = useState("Intermediate");
  const [peeking, setPeeking] = useState(false);
  const [peeks, setPeeks] = useState(0);
  const [moves, setMoves] = useState<readonly string[]>(replaySeed);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);

  const activeMode = blindfoldModes.find((item) => item.key === mode) ?? blindfoldModes[0];
  const rows = toNotationRows(moves);

  function togglePeek() {
    if (!peeking) setPeeks((count) => count + 1);
    setPeeking((value) => !value);
  }

  function submitMove() {
    const move = draft.trim();
    if (move === "") return;
    setMoves((list) => [...list, move]);
    setDraft("");
  }

  return (
    <MidnightShell
      current="E"
      title="Blindfold"
      subtitle={`${activeMode.name} · ${level} · best so far ${blindfoldStats.bestDepth} moves`}
    >
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section
          aria-labelledby="m-board"
          className="flex flex-col gap-4 self-start rounded-2xl border border-(--line) bg-(--surface) p-4"
        >
          <h2 id="m-board" className={eyebrowClass}>
            {replayTitle}
          </h2>
          <div className="relative">
            <Board
              theme={midnightBoard}
              className="rounded-xl"
              squares={replaySquares}
              hidden={!peeking}
              label={
                peeking
                  ? "Chess position, revealed while peeking."
                  : "Board hidden. Press Peek to reveal the position."
              }
            />
            {!peeking && (
              <p className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-(--bg)/60 text-sm font-semibold">
                <EyeOff className="size-8 text-(--accent)" aria-hidden />
                Board hidden
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-pressed={peeking}
              onClick={togglePeek}
              className={secondaryButtonClass}
            >
              {peeking ? "Hide board" : "Peek"}
            </button>
            <p className="text-sm text-(--muted)" aria-live="polite">
              Peeks used: <span className="font-bold text-(--fg)">{peeks}</span>
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="m-mode" className={cardClass}>
            <h2 id="m-mode" className={eyebrowClass}>
              Mode
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {blindfoldModes.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-pressed={mode === item.key}
                    onClick={() => setMode(item.key)}
                    className="flex min-h-11 w-full flex-col gap-1 rounded-2xl border border-(--line) bg-(--bg) p-4 text-left hover:border-(--accent) aria-pressed:border-(--accent)"
                  >
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-sm text-(--muted)">{item.description}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div role="group" aria-label="Level" className="mt-4 flex flex-wrap gap-2">
              {blindfoldLevels.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  aria-pressed={level === item.name}
                  onClick={() => setLevel(item.name)}
                  className={chipClass}
                >
                  {item.name} · {item.detail}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="m-feed" className={cardClass}>
            <h2 id="m-feed" className={eyebrowClass}>
              Notation
            </h2>
            <ol
              aria-live="polite"
              className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2 font-mono text-sm"
            >
              {rows.map((row) => (
                <li key={row.number} className="rounded-xl bg-(--bg) px-3 py-2">
                  <span className="text-(--muted)">{row.number}.</span> {row.white} {row.black}
                </li>
              ))}
            </ol>
            <form
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                submitMove();
              }}
            >
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="m-san" className="text-sm font-medium text-(--muted)">
                  Your move (SAN)
                </label>
                <input
                  id="m-san"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="e.g. d4"
                  autoComplete="off"
                  className="min-h-12 rounded-2xl border border-(--line) bg-(--bg) px-4 font-mono text-base placeholder:text-(--muted)"
                />
              </div>
              <button type="submit" className={primaryButtonClass}>
                Play move
              </button>
              <button
                type="button"
                aria-pressed={listening}
                aria-label="Voice input"
                onClick={() => setListening((value) => !value)}
                className={`${secondaryButtonClass} size-12 px-0 sm:self-end`}
              >
                <Mic className="size-5" aria-hidden />
              </button>
            </form>
            <p className="mt-2 min-h-5 text-sm text-(--accent)" aria-live="polite">
              {listening ? "Listening…" : ""}
            </p>
          </section>
        </div>
      </div>
    </MidnightShell>
  );
}
