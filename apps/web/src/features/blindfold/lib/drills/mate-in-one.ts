/** "Mate in one": a position is given as piece lists; the player types the mating move. */
import { Chess, type Move } from "chess.js";

import { piecesFromFen } from "./fen";
import { MATE_POSITIONS, MAX_MATE_LEVEL } from "./mate-positions";
import type { DrillModule, MateInOneQuestion } from "./types";

const COORDINATE_MOVE = /^([a-h][1-8])\s*[-x]?\s*([a-h][1-8])\s*=?([qrbn])?$/i;

function tryMove(chess: Chess, move: string | { from: string; to: string; promotion?: string }) {
  try {
    return chess.move(move, { strict: false });
  } catch {
    return null;
  }
}

/**
 * Parses a typed move leniently: SAN with or without `+`/`#`, a lower-case piece letter (k q r n
 * only, since b is a pawn file), a lower-case promotion piece, or coordinates such as `a1a8`.
 */
function parseMove(fen: string, input: string): Chess | null {
  const text = input.trim().replace(/[+#!?]+$/, "");
  if (text === "") return null;
  const coordinates = COORDINATE_MOVE.exec(text);
  const candidates: (string | { from: string; to: string; promotion?: string })[] = [];
  if (coordinates?.[1] && coordinates[2]) {
    candidates.push({
      from: coordinates[1].toLowerCase(),
      to: coordinates[2].toLowerCase(),
      ...(coordinates[3] ? { promotion: coordinates[3].toLowerCase() } : {}),
    });
  }
  const promotionFixed = text.replace(
    /=?([qrbn])$/i,
    (_, piece: string) => `=${piece.toUpperCase()}`,
  );
  candidates.push(text, promotionFixed);
  if (/^[kqrn]/.test(text)) {
    candidates.push(`${text[0]?.toUpperCase()}${text.slice(1)}`);
  }
  for (const candidate of candidates) {
    const chess = new Chess(fen);
    const played: Move | null = tryMove(chess, candidate);
    if (played) return chess;
  }
  return null;
}

export const mateInOne: DrillModule<MateInOneQuestion> = {
  generate: ({ level, rng }) => {
    const target = Math.min(level, MAX_MATE_LEVEL);
    const { fen } = rng.pick(MATE_POSITIONS.filter((position) => position.level === target));
    const chess = new Chess(fen);
    const expected = chess
      .moves()
      .filter((san) => san.endsWith("#"))
      .map((san) => san.replace(/[+#]$/, ""));
    return {
      kind: "mate_in_one",
      fen,
      pieces: piecesFromFen(fen),
      toMove: chess.turn() === "w" ? "white" : "black",
      expected,
    };
  },
  isCorrect: (question, answer) => {
    if (typeof answer !== "string") return false;
    return parseMove(question.fen, answer)?.isCheckmate() ?? false;
  },
  describe: (question) =>
    `${question.toMove === "white" ? "White" : "Black"} to move. Find mate in one.`,
  expectedText: (question) => question.expected.map((san) => `${san}#`).join(" or "),
};
