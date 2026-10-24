import { describe, expect, test } from "bun:test";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import {
  afterE4,
  blackRepertoire,
  c5Move,
  centreNote,
  e4Move,
  e5Move,
  emptyNote,
  explorerOk,
  startPosition,
  whiteRepertoire,
} from "./repertoire.fixtures";
import RepertoireBuilderView, { type RepertoireBuilderViewProps } from "./repertoire-builder-view";

function render(overrides: Partial<RepertoireBuilderViewProps> = {}) {
  return renderWithRouter(
    <RepertoireBuilderView
      repertoire={whiteRepertoire}
      position={afterE4}
      path={[e4Move]}
      childMoves={[e5Move, c5Move]}
      explorer={{ kind: "loaded", data: explorerOk }}
      note={emptyNote}
      noteDirty={false}
      saving={false}
      onPlayMove={() => {}}
      onSelectPly={() => {}}
      onSelectChild={() => {}}
      onRequestDelete={() => {}}
      onNoteChange={() => {}}
      onSaveNote={() => {}}
      onClearNote={() => {}}
      {...overrides}
    />,
  );
}

describe("RepertoireBuilderView", () => {
  test("shows the repertoire, a typed-move field and the current line as a move list", async () => {
    const html = await render();
    expect(html).toContain("Open games");
    expect(html).toContain("Playing White");
    expect(html).toContain(">Type a move to add it</label>");
    expect(html).toContain('aria-label="Moves"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('href="/repertoire"');
  });

  test("describes the board in words, including the idea note", async () => {
    const html = await render({ note: centreNote });
    expect(html).toContain("line: 1. e4");
    expect(html).toContain("Black to move");
    expect(html).toContain("Arrows: g1 to f3, f1 to c4.");
    expect(html).toContain("Idea note:");
  });

  test("says so when the position has no note", async () => {
    expect(await render()).toContain("No idea note.");
  });

  test("shows the start position with its first moves", async () => {
    const html = await render({ position: startPosition, path: [], childMoves: [e4Move] });
    expect(html).toContain("Start position");
    expect(html).toContain("No moves yet");
    expect(html).toContain("1. e4");
  });

  test("names the colour being played", async () => {
    expect(await render({ repertoire: blackRepertoire })).toContain("Playing Black");
  });

  test("shows the explorer beside the line, and the builder still works when it failed", async () => {
    expect(await render()).toContain(">Explorer</h2>");
    const html = await render({ explorer: { kind: "failed" } });
    expect(html).toContain("unavailable right now");
    expect(html).toContain(">Type a move to add it</label>");
    expect(html).toContain("Current line");
  });
});
