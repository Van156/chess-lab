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
  midLineArrowText,
  midLineArrows,
  openGameStartTree,
  openGameTree,
  engineOffView,
  engineOnView,
  midLinePreview,
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
      tree={openGameTree}
      startPositionId="p0"
      opening={{ eco: "B00", name: "King's Pawn Game" }}
      explorer={{ kind: "loaded", data: explorerOk }}
      engine={engineOnView}
      boardArrows={midLineArrows}
      boardArrowText={midLineArrowText}
      lineCount={3}
      preview={null}
      showRepertoireArrows
      note={emptyNote}
      noteDirty={false}
      saving={false}
      bandSaving={false}
      onPlayMove={() => {}}
      onChangeBandOffset={() => {}}
      onToggleEngine={() => {}}
      onRetryEngine={() => {}}
      onPreviewLine={() => {}}
      onPreviewPrevious={() => {}}
      onPreviewNext={() => {}}
      onPreviewExit={() => {}}
      onSelectPly={() => {}}
      onChangeLineCount={() => {}}
      onToggleRepertoireArrows={() => {}}
      onSelectNode={() => {}}
      onDeleteNode={() => {}}
      onRequestDelete={() => {}}
      onNoteChange={() => {}}
      onSaveNote={() => {}}
      onClearNote={() => {}}
      {...overrides}
    />,
  );
}

describe("RepertoireBuilderView", () => {
  test("shows the repertoire, a typed-move field and the path to the position", async () => {
    const html = await render();
    expect(html).toContain("Open games");
    expect(html).toContain("Playing White");
    expect(html).toContain(">Type a move to add it</label>");
    expect(html).toContain('aria-label="Path to this position"');
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

  test("lays out the board column and a rail of four tabs", async () => {
    const html = await render();
    expect(html).toContain('aria-label="Board"');
    for (const tab of ["Tree", "Engine", "Explorer", "Notes"]) {
      expect(html).toMatch(new RegExp(`role="tab"[^>]*>${tab}</button>`));
    }
    expect(html.indexOf('data-slot="board-toolbar"')).toBeLessThan(html.indexOf("chess-board"));
  });

  test("shows the whole repertoire as a tree, with the start position as its root", async () => {
    const html = await render({ position: startPosition, path: [], tree: openGameStartTree });
    expect(html).toContain('aria-label="Variation tree"');
    expect(html).toMatch(/aria-current="location"[^>]*>Start position</);
    expect(html).toContain('aria-label="1... c5, opponent reply, alternative to 1... e5"');
  });

  test("shows the toolbar with the saved line count and the repertoire arrows switch", async () => {
    const html = await render({ lineCount: 5 });
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="5 lines on the board"/);
    expect(html).toContain("Repertoire arrows");
  });

  test("shows the opening name with its ECO code above the board toolbar", async () => {
    const html = await render({ opening: { eco: "C44", name: "Scotch Game" } });
    expect(html).toContain("C44 · Scotch Game");
    expect(html.indexOf("C44 · Scotch Game")).toBeLessThan(html.indexOf("Repertoire arrows"));
  });

  test("shows no name, but keeps its line, when none is known on the path", async () => {
    const html = await render({ opening: null });
    expect(html).toMatch(/data-slot="opening-name"[^>]*><\/p>/);
    expect(html).toMatch(/data-slot="opening-name"[^>]*class="[^"]*\bmin-h-6\b/);
  });

  test("names the colour being played", async () => {
    expect(await render({ repertoire: blackRepertoire })).toContain("Playing Black");
  });

  test("shows the explorer beside the line, and the builder still works when it failed", async () => {
    expect(await render()).toContain(">Explorer</h2>");
    const html = await render({ explorer: { kind: "failed" } });
    expect(html).toContain("unavailable right now");
    expect(html).toContain(">Type a move to add it</label>");
    expect(html).toContain('aria-label="Variation tree"');
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
  });

  test("describes the engine lines and repertoire moves next to the idea-note arrows", async () => {
    const html = await render({ note: centreNote });
    expect(html).toContain("Engine lines, best first: 1 e4 (blue), 2 d4 (violet), 3 Nf3 (pink).");
    expect(html).toContain("Repertoire moves: e5, c5.");
    expect(html).toContain("Arrows: g1 to f3, f1 to c4.");
  });

  test("hides the bar while the engine is off", async () => {
    const html = await render({ engine: engineOffView, boardArrowText: "" });
    expect(html).toContain('data-slot="engine-off"');
    expect(html).not.toContain('data-slot="eval-bar"');
    expect(html).not.toContain("Engine lines, best first");
  });

  test("stretches the eval bar to the board's height", async () => {
    expect(await render()).toMatch(/data-slot="eval-bar"[^>]*class="[^"]*self-stretch/);
  });

  test("offers Add on engine lines, disabled while a write is saving", async () => {
    expect(await render()).toContain("Add d4");
    const html = await render({ saving: true });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Add d4<\/button>/);
  });

  test("shows no preview bar while no line is previewed", async () => {
    const html = await render();
    expect(html).not.toContain('data-slot="line-preview-bar"');
    expect(html).toContain('data-slot="board-toolbar"');
  });

  test("previewing swaps the toolbar for the preview bar and describes the previewed position", async () => {
    const html = await render({ preview: midLinePreview });
    expect(html).toContain('data-slot="line-preview-bar"');
    expect(html).not.toContain('data-slot="board-toolbar"');
    expect(html).toContain("Previewing line 2");
    expect(html).toContain(">Back to branch start</button>");
    expect(html).toContain("previewing engine line 2 (violet), move 2 of 3: Nf3.");
    expect(html).not.toContain("Engine lines, best first");
  });

  test("previewing hides the typed-move field, so nothing is added from a previewed position", async () => {
    const html = await render({ preview: midLinePreview });
    expect(html).not.toContain(">Type a move to add it</label>");
  });

  test("previewing marks the previewed line in the Engine tab", async () => {
    const html = await render({ preview: midLinePreview });
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Preview line 2/);
  });
});
