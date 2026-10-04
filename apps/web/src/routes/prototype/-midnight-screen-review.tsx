import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { grades, reviewCards, reviewSession, reviewSquares } from "./-midnight-review-data";
import {
  cardClass,
  eyebrowClass,
  midnightBoard,
  MidnightShell,
  primaryButtonClass,
  secondaryButtonClass,
} from "./-midnight-shell";
import { Board } from "./-today-home-board";

/** Screen B: Review session. Fake FSRS drill: show answer, grade, advance. */
export function ReviewScreen() {
  const [graded, setGraded] = useState<number>(reviewSession.startOffset);
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState("");

  const finished = graded >= reviewSession.total;
  const card = reviewCards[graded % reviewCards.length];
  const upcoming = [1, 2, 3, 4]
    .map((offset) => ({ offset, card: reviewCards[(graded + offset) % reviewCards.length] }))
    .filter(({ offset }) => graded + offset < reviewSession.total);
  const progress = Math.round((graded / reviewSession.total) * 100);

  function grade() {
    setGraded((value) => value + 1);
    setRevealed(false);
    setAttempt("");
  }

  function restart() {
    setGraded(reviewSession.startOffset);
    setRevealed(false);
    setAttempt("");
  }

  return (
    <MidnightShell
      current="B"
      title="Review session"
      subtitle={finished ? "Queue cleared" : `Card ${graded + 1} of ${reviewSession.total}`}
    >
      <div
        role="progressbar"
        aria-label="Review progress"
        aria-valuemin={0}
        aria-valuemax={reviewSession.total}
        aria-valuenow={graded}
        className="mb-6 h-2 overflow-hidden rounded-full bg-(--surface)"
      >
        <div className="h-full bg-(--accent)" style={{ width: `${progress}%` }} />
      </div>

      {finished ? (
        <section
          aria-labelledby="m-done"
          className={`${cardClass} flex flex-col items-start gap-4`}
        >
          <h2 id="m-done" className="text-3xl font-bold">
            All {reviewSession.total} cards done
          </h2>
          <p className="text-(--muted)">Next review is tomorrow. Your streak is safe.</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/prototype/midnight" search={{ variant: "A" }} className={primaryButtonClass}>
              Back to Today
            </Link>
            <button type="button" onClick={restart} className={secondaryButtonClass}>
              Replay session
            </button>
          </div>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <section aria-label="Position" className={cardClass}>
            <Board
              theme={midnightBoard}
              className="rounded-xl"
              squares={reviewSquares.get(card.id)}
              label={`Chess position for card: ${card.prompt}`}
            />
          </section>

          <div className="flex flex-col gap-6">
            <section aria-labelledby="m-card" className={`${cardClass} flex flex-col gap-4`}>
              <div className="flex items-center justify-between gap-3">
                <h2 id="m-card" className={eyebrowClass}>
                  Current card
                </h2>
                <span className="rounded-full border border-(--accent) px-3 py-1 text-sm font-semibold text-(--accent)">
                  {card.kind}
                </span>
              </div>
              <p className="text-xl font-semibold">{card.prompt}</p>
              <p className="text-sm text-(--muted)">{card.context}</p>

              {revealed ? (
                <div className="rounded-2xl border border-(--accent) p-4" aria-live="polite">
                  <p className="font-mono text-2xl font-bold text-(--accent)">{card.answer}</p>
                  <p className="mt-1 text-sm text-(--muted)">{card.explanation}</p>
                </div>
              ) : (
                <form
                  className="flex flex-col gap-3 sm:flex-row sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setRevealed(true);
                  }}
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <label htmlFor="m-attempt" className="text-sm font-medium text-(--muted)">
                      Your move (SAN)
                    </label>
                    <input
                      id="m-attempt"
                      value={attempt}
                      onChange={(event) => setAttempt(event.target.value)}
                      placeholder="e.g. Nf3"
                      autoComplete="off"
                      className="min-h-12 rounded-2xl border border-(--line) bg-(--bg) px-4 font-mono text-base placeholder:text-(--muted)"
                    />
                  </div>
                  <button type="submit" className={primaryButtonClass}>
                    Show answer
                  </button>
                </form>
              )}

              {revealed && (
                <div
                  role="group"
                  aria-label="Grade this card"
                  className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                >
                  {grades.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={grade}
                      className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border bg-(--bg) text-sm font-bold hover:brightness-125 ${item.tone}`}
                    >
                      {item.label}
                      <span className="text-xs font-medium text-(--muted)">{item.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="m-queue-list" className={cardClass}>
              <h2 id="m-queue-list" className={eyebrowClass}>
                Up next
              </h2>
              {upcoming.length === 0 ? (
                <p className="mt-3 text-sm text-(--muted)">This is the last card.</p>
              ) : (
                <ol className="mt-3 flex flex-col divide-y divide-(--line)">
                  {upcoming.map(({ offset, card: next }) => (
                    <li
                      key={offset}
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <span>{next.prompt.split(".")[0]}</span>
                      <span className="shrink-0 text-(--muted)">{next.kind}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </div>
      )}
    </MidnightShell>
  );
}
