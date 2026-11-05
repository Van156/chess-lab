import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { ExtraQuestion } from "../../lib/drills/types";
import {
  CHECK_NO,
  CHECK_YES,
  MATE_BACK_RANK,
  MATE_BLACK_TO_MOVE,
  RECALL_EMPTY,
  RECALL_PIECE,
  SAME_DIAGONAL_NO,
  SAME_DIAGONAL_SAME_COLOUR,
  SAME_DIAGONAL_YES,
} from "./answers.fixtures";
import { diagonalName, diagonalPath, locateMove, replayMoves } from "./board-helpers";
import { ExtraDrillAnswer, ExtraDrillStimulus } from "./index";
import { pieceForKey } from "./piece-picker";
import { describePieceCode } from "./pieces";
import { yesNoForKey } from "./yes-no-answer";

const noop = () => {};
const answer = (question: ExtraQuestion) =>
  renderToStaticMarkup(<ExtraDrillAnswer question={question} onSubmit={noop} />);
const stimulus = (question: ExtraQuestion, revealed = false) =>
  renderToStaticMarkup(<ExtraDrillStimulus question={question} revealed={revealed} />);
const BOARD = 'data-slot="chess-board"';

describe("ExtraDrillAnswer", () => {
  test("yes/no drills offer Yes and No with the Y and N shortcuts", () => {
    for (const question of [SAME_DIAGONAL_YES, CHECK_YES]) {
      const html = answer(question);
      expect(html).toContain('aria-keyshortcuts="Y"');
      expect(html).toContain('aria-keyshortcuts="N"');
      expect(html).toContain(">Yes<");
      expect(html).toContain(">No<");
    }
    expect(answer(SAME_DIAGONAL_YES)).toContain('aria-label="Same diagonal"');
    expect(answer(CHECK_YES)).toContain('aria-label="King in check"');
  });

  test("position recall offers twelve named pieces and Empty", () => {
    const html = answer(RECALL_PIECE);
    expect(
      html.match(/aria-label="(White|Black) (king|queen|rook|bishop|knight|pawn)"/g),
    ).toHaveLength(12);
    expect(html).toContain('aria-label="White knight"');
    expect(html).toContain('aria-label="Black pawn"');
    expect(html).toContain('aria-keyshortcuts="Shift+N"');
    expect(html).toContain('aria-keyshortcuts="E"');
    expect(html).toContain("Empty");
  });

  test("mate in one asks for a typed move with an example hint", () => {
    const html = answer(MATE_BACK_RANK);
    expect(html).toContain('for="drill-move"');
    expect(html).toContain("Mating move");
    expect(html).toContain("Type the move, for example");
    expect(html).toContain(">Check<");
  });
});

describe("answer shortcuts", () => {
  test("Y and N answer, Shift and other keys do not", () => {
    expect(yesNoForKey("y", false)).toBe("yes");
    expect(yesNoForKey("n", false)).toBe("no");
    expect(yesNoForKey("y", true)).toBeNull();
    expect(yesNoForKey("x", false)).toBeNull();
  });

  test("a piece letter picks White, with Shift Black, E picks Empty", () => {
    expect(pieceForKey("n", false)).toBe("wN");
    expect(pieceForKey("n", true)).toBe("bN");
    expect(pieceForKey("k", true)).toBe("bK");
    expect(pieceForKey("e", false)).toBe("empty");
    expect(pieceForKey("e", true)).toBeNull();
    expect(pieceForKey("x", false)).toBeNull();
  });
});

describe("ExtraDrillStimulus before answering", () => {
  test("never draws a board", () => {
    for (const question of [SAME_DIAGONAL_YES, CHECK_YES, RECALL_PIECE, MATE_BACK_RANK]) {
      expect(stimulus(question)).not.toContain(BOARD);
    }
  });

  test("same diagonal shows both squares", () => {
    const html = stimulus(SAME_DIAGONAL_YES);
    expect(html).toContain(">b2<");
    expect(html).toContain(">g7<");
  });

  test("check detection lists every piece by side", () => {
    const html = stimulus(CHECK_YES);
    expect(html).toContain(">White<");
    expect(html).toContain(">Black<");
    for (const { square } of CHECK_YES.pieces) expect(html).toContain(`>${square}<`);
    expect(html).toContain("bishop on </span>");
  });

  test("position recall numbers the moves", () => {
    const html = stimulus(RECALL_PIECE);
    expect(html).toContain("10 moves from the start position");
    expect(html).toContain(">1.<");
    expect(html).toContain(">5.<");
    expect(html).toContain(">O-O<");
  });

  test("mate in one tags the side to move", () => {
    expect(stimulus(MATE_BACK_RANK)).toContain(">White to move<");
    expect(stimulus(MATE_BLACK_TO_MOVE)).toContain(">Black to move<");
  });
});

describe("ExtraDrillStimulus revealed", () => {
  test("same diagonal names the diagonal or why there is none", () => {
    const yes = stimulus(SAME_DIAGONAL_YES, true);
    expect(yes).toContain(BOARD);
    expect(yes).toContain("Diagonal from b2 to g7");
    expect(yes).toContain(">a1-h8<");
    expect(stimulus(SAME_DIAGONAL_NO, true)).toContain("A diagonal never changes colour.");
    expect(stimulus(SAME_DIAGONAL_SAME_COLOUR, true)).toContain("Both are light squares");
  });

  test("check detection names the checker or says there is none", () => {
    expect(stimulus(CHECK_YES, true)).toContain("Check from ");
    expect(stimulus(CHECK_YES, true)).toContain("bishop");
    expect(stimulus(CHECK_NO, true)).toContain("No piece attacks the ");
  });

  test("position recall says what stands on the square", () => {
    expect(stimulus(RECALL_PIECE, true)).toContain("black knight");
    expect(stimulus(RECALL_EMPTY, true)).toContain("is empty.");
  });

  test("mate in one shows the mating move", () => {
    const html = stimulus(MATE_BACK_RANK, true);
    expect(html).toContain(BOARD);
    expect(html).toContain(">Ra8#<");
    expect(html).toContain("is mate.");
  });
});

describe("board helpers", () => {
  test("diagonalPath walks from one square to the other, or is null", () => {
    expect(diagonalPath("b2", "e5")).toEqual(["b2", "c3", "d4", "e5"]);
    expect(diagonalPath("h1", "f3")).toEqual(["h1", "g2", "f3"]);
    expect(diagonalPath("b1", "e6")).toBeNull();
    expect(diagonalPath("a1", "a5")).toBeNull();
    expect(diagonalPath("c3", "c3")).toBeNull();
  });

  test("diagonalName gives the full diagonal from its a-file side", () => {
    expect(diagonalName(["b2", "c3"])).toBe("a1-h8");
    expect(diagonalName(["f3", "g2", "h1"])).toBe("a8-h1");
    expect(diagonalName(["c1", "d2"])).toBe("c1-h6");
    expect(diagonalName(["e8", "f7"])).toBe("e8-h5");
  });

  test("replayMoves plays SAN and stops at an illegal move", () => {
    expect(replayMoves(["e4", "e5", "Nf3"]).lastMove).toEqual({ from: "g1", to: "f3" });
    expect(replayMoves(["e4", "Ke3"]).fen.split(" ")[1]).toBe("b");
  });

  test("locateMove finds a move's squares", () => {
    expect(locateMove(MATE_BACK_RANK.fen, "Ra8")).toEqual({ from: "a1", to: "a8" });
    expect(locateMove(MATE_BACK_RANK.fen, "Qh7")).toBeNull();
  });

  test("describePieceCode reads the codes", () => {
    expect(describePieceCode("wN")).toBe("White knight");
    expect(describePieceCode("bP")).toBe("Black pawn");
    expect(describePieceCode("empty")).toBe("Empty");
  });
});
