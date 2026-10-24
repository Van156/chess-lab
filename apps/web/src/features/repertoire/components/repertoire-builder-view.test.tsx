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
  engineOffView,
  engineOnView,
  explorerOk,
  explorerOneBandAbove,
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
      engine={engineOnView}
      note={emptyNote}
      noteDirty={false}
      saving={false}
      bandSaving={false}
      onPlayMove={() => {}}
      onChangeBandOffset={() => {}}
      onToggleEngine={() => {}}
      onRetryEngine={() => {}}
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

  test("offers Add only on explorer moves that are not in the repertoire yet", async () => {
    const html = await render();
    // explorerOk lists c5, e5 and e6; the repertoire has e5 and c5 below e4.
    expect(html).toContain('aria-label="Add e6 to the repertoire"');
    expect(html).not.toContain('aria-label="Add e5 to the repertoire"');
    expect(html).not.toContain('aria-label="Add c5 to the repertoire"');
  });

  test("disables Add while a write is saving", async () => {
    const html = await render({ saving: true });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Add e6 to the repertoire"/);
  });

  test("shows the band select with the saved band selected, and none without stats", async () => {
    const html = await render({ explorer: { kind: "loaded", data: explorerOneBandAbove } });
    expect(html).toContain(">Compare with rating band</label>");
    expect(html).toMatch(
      /<option[^>]*value="1"[^>]*selected=""[^>]*>1800–1999 \(1 above\)<\/option>/,
    );
    expect(await render({ explorer: { kind: "failed" } })).not.toContain(
      "Compare with rating band",
    );
  });

  test("shows the engine panel above the explorer, with the eval bar beside the board", async () => {
    const html = await render();
    expect(html).toContain('data-slot="engine-panel"');
    expect(html).toContain("Depth 18/18");
    expect(html).toContain('data-slot="eval-bar"');
    expect(html.indexOf('data-slot="engine-panel"')).toBeLessThan(html.indexOf(">Explorer</h2>"));
    expect(html.indexOf('data-slot="engine-panel"')).toBeLessThan(html.indexOf("Current line"));
  });

  test("describes the engine arrow next to the idea-note arrows", async () => {
    const html = await render({ note: centreNote });
    expect(html).toContain("Engine best move: e2 to e4.");
    expect(html).toContain("Arrows: g1 to f3, f1 to c4.");
  });

  test("hides the bar and the engine arrow while the engine is off", async () => {
    const html = await render({ engine: engineOffView, note: centreNote });
    expect(html).toContain('data-slot="engine-off"');
    expect(html).not.toContain('data-slot="eval-bar"');
    expect(html).not.toContain("Engine best move");
  });

  test("offers Add on engine lines, disabled while a write is saving", async () => {
    expect(await render()).toContain("Add d4");
    const html = await render({ saving: true });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Add d4<\/button>/);
  });
});
