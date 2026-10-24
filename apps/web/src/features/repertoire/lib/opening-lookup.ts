import { positionKey } from "@b2c-template/chess";

/** An opening as the book names it: its ECO code and its name, e.g. C44 and "Scotch Game". */
export type Opening = { eco: string; name: string };

/** The generated book: a position key (see `openingKey`) to `[eco, name]`. */
export type OpeningBook = Readonly<Record<string, readonly [eco: string, name: string]>>;

/**
 * The key a position has in the book. The generator and the lookup both use this one function,
 * so they cannot drift apart. It is the chess package's key: placement, side to move, castling
 * rights, and an en passant square only when a capture there is legal, so `e3` after 1. e4 and
 * `-` give the same key. The move counters are not part of it, which is what lets a transposition
 * reach the same entry.
 */
export function openingKey(fen: string): string {
  return positionKey(fen);
}

/** The book's name for exactly this position, or null. */
export function openingFor(book: OpeningBook, fen: string): Opening | null {
  const key = openingKey(fen);
  if (!Object.hasOwn(book, key)) return null;
  const [eco, name] = book[key] as readonly [string, string];
  return { eco, name };
}

/**
 * The name to show along a line: the last position's own name, else the nearest earlier name on
 * the path, else null. `fens` runs from the start position to the current one.
 */
export function openingAlongPath(book: OpeningBook, fens: readonly string[]): Opening | null {
  for (let index = fens.length - 1; index >= 0; index--) {
    const found = openingFor(book, fens[index] as string);
    if (found) return found;
  }
  return null;
}
