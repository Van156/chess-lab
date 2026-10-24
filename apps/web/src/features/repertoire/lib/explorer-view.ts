import { EXPLORER_RATING_BUCKETS } from "@b2c-template/chess";

import type { ExplorerUnavailableReason } from "./repertoire-types";

type Tally = { white: number; draws: number; black: number; games: number };

export type Share = { white: number; draws: number; black: number };

/** Shown above the table when the stats are a saved copy. */
export const STALE_NOTE = "These are saved results because Lichess did not answer.";

const UNAVAILABLE_TEXT: Record<ExplorerUnavailableReason, string> = {
  unauthorized:
    "Explorer stats need a linked Lichess account. To see them, sign in with Lichess again.",
  rate_limited: "Lichess is busy right now. Try again in a minute.",
  timeout: "Lichess did not answer in time. Try again shortly.",
  error: "Explorer stats are unavailable right now.",
};

export const unavailableText = (reason: ExplorerUnavailableReason): string =>
  UNAVAILABLE_TEXT[reason];

/**
 * White, draw and Black shares as whole percentages that add up to 100 (largest remainder; ties go
 * to the earlier outcome). All zero when no game was played.
 */
export function shareOf({ white, draws, black, games }: Tally): Share {
  if (games <= 0) return { white: 0, draws: 0, black: 0 };
  const exact = [white, draws, black].map((count) => (count / games) * 100);
  const floors = exact.map(Math.floor);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    left -= 1;
  }
  return { white: floors[0] ?? 0, draws: floors[1] ?? 0, black: floors[2] ?? 0 };
}

const gamesFormat = new Intl.NumberFormat("en-US");

/** A game count with thousands separators, in a fixed locale so the text is the same everywhere. */
export const formatGames = (games: number): string => gamesFormat.format(games);

/** One explorer move in words, for assistive technology and the visible cells. */
export function describeExplorerMove(move: Tally & { san: string }): string {
  const share = shareOf(move);
  const noun = move.games === 1 ? "game" : "games";
  return `${move.san}: ${formatGames(move.games)} ${noun}. White ${share.white}%, draws ${share.draws}%, Black ${share.black}%.`;
}

/**
 * The rating range of a bucket: up to just below the next bucket, with open ends at both sides.
 * A number that is not a bucket has no known range, so it is shown as is.
 */
export function bandLabel(band: number): string {
  const buckets: readonly number[] = EXPLORER_RATING_BUCKETS;
  const index = buckets.indexOf(band);
  if (index === -1) return String(band);
  const next = buckets[index + 1];
  if (band === buckets[0]) return `Under ${next}`;
  if (next === undefined) return `${band}+`;
  return `${band}–${next - 1}`;
}

/** True when the repertoire already has this move from the position (SAN is unique per position). */
export const inRepertoire = (san: string, children: readonly { san: string }[]): boolean =>
  children.some((child) => child.san === san);
