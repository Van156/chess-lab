import { createHash } from "node:crypto";

import { START_FEN, applyMove } from "@b2c-template/chess";

import { openingKey, type OpeningBook } from "./opening-lookup";

/** One row of an upstream TSV: ECO code, opening name and the PGN movetext that reaches it. */
export type OpeningRow = { eco: string; name: string; pgn: string };

/** The SAN moves of a PGN movetext such as `1. e4 e5 2. Nf3`, without move numbers. */
export function sansOf(pgn: string): string[] {
  return pgn.split(/\s+/).filter((token) => token !== "" && !/^\d+\.+$/.test(token));
}

/** The FEN after replaying `pgn` from the start position; throws on an illegal move. */
export function fenAfterPgn(pgn: string): string {
  let fen = START_FEN;
  for (const san of sansOf(pgn)) {
    const next = applyMove(fen, san);
    if (!next) throw new Error(`Illegal move "${san}" in "${pgn}"`);
    fen = next;
  }
  return fen;
}

/** Throws unless the SHA-256 of `content` equals the pinned `expected` hex digest of `file`. */
export function verifySha256(file: string, content: string | Uint8Array, expected: string): void {
  const actual = createHash("sha256").update(content).digest("hex");
  if (actual !== expected) {
    throw new Error(`${file}: SHA-256 ${actual} does not match the pinned ${expected}`);
  }
}

/**
 * Parses a `eco<TAB>name<TAB>pgn` file with a header row. The text is data: it is split and
 * read, never evaluated. A row that does not have three columns is an error, not skipped.
 */
export function parseOpeningRows(tsv: string): OpeningRow[] {
  const [header, ...lines] = tsv.split(/\r?\n/);
  if (header?.trim() !== "eco\tname\tpgn") throw new Error(`Unexpected TSV header "${header}"`);
  return lines
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const columns = line.split("\t");
      const [eco, name, pgn] = columns;
      if (columns.length !== 3 || !eco || !name || !pgn) throw new Error(`Bad TSV row "${line}"`);
      return { eco, name, pgn };
    });
}

/**
 * The book for `rows`, keyed by `openingKey`. When several rows reach the same position (a
 * transposition) the row with the longest line wins, since it is the most specific one; on a tie
 * the row that comes first in `rows` stays. `rows` is the upstream files in a, b, c, d, e order.
 */
export function buildOpeningBook(rows: readonly OpeningRow[]): {
  book: OpeningBook;
  rowCount: number;
} {
  const kept = new Map<string, { plies: number; eco: string; name: string }>();
  for (const row of rows) {
    const key = openingKey(fenAfterPgn(row.pgn));
    const plies = sansOf(row.pgn).length;
    const existing = kept.get(key);
    if (!existing || plies > existing.plies) kept.set(key, { plies, eco: row.eco, name: row.name });
  }
  const book: Record<string, readonly [string, string]> = {};
  for (const [key, { eco, name }] of kept) book[key] = [eco, name];
  return { book, rowCount: rows.length };
}
