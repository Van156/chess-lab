import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import SanInput, { checkMoveText } from "./san-input";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AMBIGUOUS = "4k3/8/8/8/8/8/8/1N1K1N2 w - - 0 1";

describe("checkMoveText", () => {
  test("accepts legal SAN", () => {
    expect(checkMoveText(START, "Nf3")).toEqual({ ok: true, san: "Nf3" });
  });

  test("accepts legal UCI and returns its SAN", () => {
    expect(checkMoveText(START, "g1f3")).toEqual({ ok: true, san: "Nf3" });
  });

  test("rejects an illegal move with a legality message", () => {
    const result = checkMoveText(START, "Ke4");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not a legal move");
  });

  test("rejects ambiguous and malformed text", () => {
    expect(checkMoveText(AMBIGUOUS, "Nd2").ok).toBe(false);
    expect(checkMoveText(START, "hello").ok).toBe(false);
  });

  test("rejects empty input with a prompt to type a move", () => {
    const result = checkMoveText(START, "   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Type a move");
  });
});

describe("SanInput", () => {
  test("renders a labelled text field with the default label", () => {
    const html = renderToStaticMarkup(<SanInput fen={START} onMove={() => {}} />);
    expect(html).toMatch(/<label[^>]*for="([^"]+)"[^>]*>Type a move<\/label>/);
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain("<input");
  });

  test("uses a custom label", () => {
    const html = renderToStaticMarkup(<SanInput fen={START} onMove={() => {}} label="Your move" />);
    expect(html).toContain(">Your move</label>");
  });

  test("renders a polite live region for errors and no error initially", () => {
    const html = renderToStaticMarkup(<SanInput fen={START} onMove={() => {}} />);
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("not a legal move");
    expect(html).not.toContain('aria-invalid="true"');
  });

  test("renders a submit button of at least 44 px", () => {
    const html = renderToStaticMarkup(<SanInput fen={START} onMove={() => {}} />);
    expect(html).toContain('type="submit"');
    expect(html).toContain("min-h-11");
  });
});
