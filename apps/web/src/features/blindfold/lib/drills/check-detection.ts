/** "Check spotter": a piece list is read out; is the asked king in check? */
import type { Rng } from "../rng";
import { ALL_SQUARES, parseSquare, type Square } from "../squares";
import { attackedSquares, checkers, squaresBetween } from "./attacks";
import type {
  CheckDetectionQuestion,
  DrillModule,
  PieceColour,
  PieceLetter,
  PlacedPiece,
} from "./types";

/** Level 2 adds a piece or two, one of which may block the checking line. */
const BLOCKER_LEVEL = 2;
/** Level 3 fills the board with 6-8 pieces, pawns and both sides' minor pieces. */
const BUSY_LEVEL = 3;
const MAX_CHECKERS = 2;
const MAX_ATTEMPTS = 5000;

const CHECKING_PIECES: readonly PieceLetter[] = ["Q", "R", "B", "N"];
const BUSY_CHECKING_PIECES: readonly PieceLetter[] = ["Q", "R", "B", "N", "P"];
const FILLER_PIECES: readonly PieceLetter[] = ["R", "B", "N"];
const BUSY_FILLER_PIECES: readonly PieceLetter[] = ["P", "P", "R", "B", "N"];
const MINOR_PIECES: readonly PieceLetter[] = ["B", "N"];
const SLIDERS: ReadonlySet<PieceLetter> = new Set(["Q", "R", "B"]);

const opponent = (colour: PieceColour): PieceColour => (colour === "white" ? "black" : "white");

function coordinates(square: Square) {
  const parsed = parseSquare(square);
  if (!parsed) throw new Error(`Invalid square: ${square}`);
  return parsed;
}

function touching(a: Square, b: Square): boolean {
  const x = coordinates(a);
  const y = coordinates(b);
  return Math.max(Math.abs(x.file - y.file), Math.abs(x.rank - y.rank)) <= 1;
}

const onBackRank = (square: Square) => square.endsWith("1") || square.endsWith("8");

/** A board that could come from a game: kings apart, no back-rank pawns, at most a double check. */
function looksLegal(pieces: readonly PlacedPiece[], king: PieceColour): boolean {
  const squares = new Set(pieces.map((piece) => piece.square));
  if (squares.size !== pieces.length) return false;
  if (pieces.some((piece) => piece.piece === "P" && onBackRank(piece.square))) return false;
  const kings = pieces.filter((piece) => piece.piece === "K");
  const [first, second] = kings;
  if (kings.length !== 2 || !first || !second || first.colour === second.colour) return false;
  if (touching(first.square, second.square)) return false;
  if (checkers(pieces, opponent(king)).length > 0) return false;
  return checkers(pieces, king).length <= MAX_CHECKERS;
}

/** Adds a piece on a random free square from `candidates`; false when none fits. */
function place(
  pieces: PlacedPiece[],
  rng: Rng,
  colour: PieceColour,
  piece: PieceLetter,
  candidates: readonly Square[] = ALL_SQUARES,
): PlacedPiece | null {
  const taken = new Set(pieces.map((placed) => placed.square));
  const free = candidates.filter(
    (square) => !taken.has(square) && !(piece === "P" && onBackRank(square)),
  );
  if (free.length === 0) return null;
  const placed = { colour, piece, square: rng.pick(free) };
  pieces.push(placed);
  return placed;
}

/** Free squares from which a `piece` of `colour` would hit `target` on the current board. */
function squaresHitting(
  pieces: readonly PlacedPiece[],
  colour: PieceColour,
  piece: PieceLetter,
  target: Square,
): Square[] {
  return ALL_SQUARES.filter((square) => {
    const candidate = { colour, piece, square };
    return attackedSquares([...pieces, candidate], candidate).includes(target);
  });
}

/** One random position; the caller keeps it only when it looks legal and has the wanted answer. */
function buildPosition(
  level: number,
  king: PieceColour,
  wantCheck: boolean,
  rng: Rng,
): PlacedPiece[] | null {
  const enemy = opponent(king);
  const pieces: PlacedPiece[] = [];
  const ownKing = place(pieces, rng, king, "K");
  if (!ownKing) return null;
  const apart = ALL_SQUARES.filter((square) => !touching(square, ownKing.square));
  if (!place(pieces, rng, enemy, "K", apart)) return null;

  const busy = level >= BUSY_LEVEL;
  const type = rng.pick(busy ? BUSY_CHECKING_PIECES : CHECKING_PIECES);
  // Near misses: at level 2+ a "no" often aims a line at the king and then blocks it, and at
  // level 3 a knight may land one step away from a checking square.
  const nearMiss = !wantCheck && level >= BLOCKER_LEVEL && rng.next() < 0.6;
  const hitting = squaresHitting(pieces, enemy, type, ownKing.square);
  let candidates: readonly Square[] = ALL_SQUARES;
  if (wantCheck || (nearMiss && SLIDERS.has(type))) candidates = hitting;
  else if (nearMiss && busy && type === "N") {
    candidates = ALL_SQUARES.filter((square) => hitting.some((hit) => touching(hit, square)));
  }
  const attacker = place(pieces, rng, enemy, type, candidates);
  if (!attacker) return null;

  const fillers = busy ? BUSY_FILLER_PIECES : FILLER_PIECES;
  const randomColour = () => (rng.next() < 0.5 ? "white" : "black");
  const between = squaresBetween(attacker.square, ownKing.square);
  const blocks = level >= BLOCKER_LEVEL && between.length > 0 && (nearMiss || rng.next() < 0.3);
  if (blocks && !place(pieces, rng, randomColour(), rng.pick(fillers), between)) return null;

  if (busy) {
    for (const colour of ["white", "black"] as const) {
      if (!pieces.some((piece) => piece.colour === colour && MINOR_PIECES.includes(piece.piece))) {
        if (!place(pieces, rng, colour, rng.pick(MINOR_PIECES))) return null;
      }
    }
    if (!pieces.some((piece) => piece.piece === "P") && !place(pieces, rng, randomColour(), "P")) {
      return null;
    }
    const total = 6 + rng.int(3);
    while (pieces.length < total) {
      if (!place(pieces, rng, randomColour(), rng.pick(fillers))) return null;
    }
    return pieces.length <= 8 ? pieces : null;
  }
  if (level >= BLOCKER_LEVEL) {
    const total = 4 + rng.int(2);
    while (pieces.length < total) {
      if (!place(pieces, rng, randomColour(), rng.pick(fillers))) return null;
    }
  }
  return pieces;
}

const pieceName = (piece: PlacedPiece) =>
  piece.piece === "P" ? piece.square : `${piece.piece}${piece.square}`;

export const checkDetection: DrillModule<CheckDetectionQuestion> = {
  generate: ({ level, rng }) => {
    const king: PieceColour = rng.next() < 0.5 ? "white" : "black";
    const wantCheck = rng.next() < 0.5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const pieces = buildPosition(level, king, wantCheck, rng);
      if (!pieces || !looksLegal(pieces, king)) continue;
      const giving = checkers(pieces, king).map((piece) => piece.square);
      if (giving.length > 0 !== wantCheck) continue;
      return {
        kind: "check_detection",
        pieces,
        king,
        expected: wantCheck ? "yes" : "no",
        checkers: giving,
      };
    }
    throw new Error(`Could not build a check_detection position at level ${level}.`);
  },
  isCorrect: (question, answer) =>
    typeof answer === "string" && answer.trim().toLowerCase() === question.expected,
  describe: (question) => `Is the ${question.king} king in check?`,
  expectedText: (question) => {
    const giving = question.checkers.map((square) => {
      const piece = question.pieces.find((placed) => placed.square === square);
      return piece ? pieceName(piece) : square;
    });
    if (giving.length === 0) return "No — the king is safe";
    return `Yes — ${giving.join(" and ")} ${giving.length === 1 ? "gives" : "give"} check`;
  },
};
