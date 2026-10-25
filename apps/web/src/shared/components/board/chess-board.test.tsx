import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ChessBoard from "./chess-board";
import ChessBoardImpl, { PromotionPicker } from "./chess-board-impl";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("ChessBoard placeholder (server render)", () => {
  test("renders a labelled group with 64 same-size squares", () => {
    const html = renderToStaticMarkup(<ChessBoard fen={START} orientation="white" label="Start" />);
    expect(html).toContain('aria-label="Start"');
    expect(html).toContain('role="group"');
    const squares = html.match(/data-placeholder-square/g) ?? [];
    expect(squares).toHaveLength(64);
    expect(html).toContain("aspect-square");
    expect(html).toContain("grid-cols-8");
  });

  test("draws no pieces and does not load the library before mount", () => {
    const html = renderToStaticMarkup(<ChessBoard fen={START} orientation="white" label="Start" />);
    expect(html).not.toContain("data-piece");
    expect(html).not.toContain("<svg");
  });

  test("exposes the theme as CSS variables", () => {
    const html = renderToStaticMarkup(<ChessBoard fen={START} orientation="white" label="Start" />);
    for (const name of ["--board-light", "--board-dark", "--board-highlight", "--board-arrow"]) {
      expect(html).toContain(name);
    }
  });
});

describe("ChessBoardImpl coordinates", () => {
  test("labels the squares by default and omits the labels when switched off", () => {
    const labelled = renderToStaticMarkup(
      <ChessBoardImpl fen={START} orientation="white" label="Start" />,
    );
    const bare = renderToStaticMarkup(
      <ChessBoardImpl fen={START} orientation="white" label="Start" coordinates={false} />,
    );
    // The library renders each file/rank label as a non-selectable span: 8 files + 8 ranks.
    expect(labelled.match(/user-select:none/g)).toHaveLength(16);
    expect(bare).not.toContain("user-select:none");
  });
});

describe("ChessBoardImpl blindfold", () => {
  test("draws 32 pieces on the starting position", () => {
    const html = renderToStaticMarkup(
      <ChessBoardImpl fen={START} orientation="white" label="Start" />,
    );
    expect(html.match(/data-piece="/g)).toHaveLength(32);
  });

  test("draws no pieces in blindfold mode while the squares stay", () => {
    const html = renderToStaticMarkup(
      <ChessBoardImpl fen={START} orientation="white" label="Start" hidden />,
    );
    expect(html).not.toContain("data-piece=");
    expect(html.match(/data-square="/g)).toHaveLength(64);
  });

  test("draws pieces again when blindfold is switched off (peek)", () => {
    const html = renderToStaticMarkup(
      <ChessBoardImpl fen={START} orientation="white" label="Start" hidden={false} />,
    );
    expect(html).toContain('data-piece="wP"');
  });
});

describe("PromotionPicker", () => {
  test("offers four labelled piece buttons and a cancel button of at least 44 px", () => {
    const html = renderToStaticMarkup(<PromotionPicker onPick={() => {}} onCancel={() => {}} />);
    expect(html).toContain('role="group"');
    for (const name of ["Queen", "Rook", "Bishop", "Knight"]) {
      expect(html).toContain(`aria-label="Promote to ${name.toLowerCase()}"`);
    }
    expect(html).toContain("Cancel");
    expect(html.match(/<button/g)).toHaveLength(5);
    expect(html.match(/min-h-11/g)).toHaveLength(5);
  });
});
