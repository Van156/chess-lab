import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import EnginePanel, { type EnginePanelProps } from "./engine-panel";
import { LINE_COLOURS } from "../lib/line-colours";
import { engineLines } from "./repertoire.fixtures";

const doneState: EnginePanelProps["state"] = {
  kind: "done",
  depth: 18,
  maxDepth: 18,
  lines: engineLines,
};

function render(overrides: Partial<EnginePanelProps> = {}) {
  return renderToStaticMarkup(
    <EnginePanel
      state={doneState}
      addPending={false}
      onToggle={() => {}}
      onAdd={() => {}}
      onRetry={() => {}}
      {...overrides}
    />,
  );
}

describe("EnginePanel", () => {
  test("has a labelled switch, checked while the engine is on", () => {
    const html = render();
    expect(html).toContain(">Engine</h2>");
    expect(html).toMatch(/<label[^>]*>[\s\S]*role="switch"[\s\S]*Stockfish<\/label>/);
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"/);
  });

  test("off shows an unchecked switch, a hint and no lines", () => {
    const html = render({ state: { kind: "off" } });
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(html).toContain("Turn on Stockfish");
    expect(html).not.toContain("engine-lines");
  });

  test("starting shows a skeleton and no depth", () => {
    const html = render({ state: { kind: "starting" } });
    expect(html).toContain("Starting the engine");
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain("Depth");
  });

  test("shows the depth as text", () => {
    expect(render()).toContain("Depth 18/18");
    expect(
      render({ state: { kind: "analysing", depth: 11, maxDepth: 18, lines: engineLines } }),
    ).toContain("Depth 11/18");
  });

  test("marks each line with its number and the colour of its board arrow", () => {
    const html = render();
    expect(html.match(/data-slot="engine-line-swatch"/g)).toHaveLength(3);
    for (const [rank, entry] of LINE_COLOURS.slice(0, 3).entries()) {
      expect(html).toContain(`background-color:${entry.color}`);
      expect(html).toContain(`Line ${rank + 1}, ${entry.name} on the board`);
    }
  });

  test("lists each line with its score text, its accessible label and its moves", () => {
    const html = render();
    expect(html.match(/<li /g)).toHaveLength(3);
    expect(html).toContain("+0.34");
    expect(html).toContain("White is better by 0.34 pawns");
    expect(html).toContain("1. Nf3 d5 2. g3 Nf6");
  });

  test("offers Add for a first move not in the repertoire and a badge for one that is", () => {
    const html = render();
    expect(html.match(/In repertoire/g)).toHaveLength(1);
    expect(html).not.toContain("Add e4");
    expect(html).toContain("Add d4");
    expect(html).toContain("Add Nf3");
  });

  test("disables every Add while a save is pending", () => {
    const html = render({ addPending: true });
    const buttons = html.match(/<button[^>]*>Add [^<]+/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toMatch(/ disabled(="")?[ >]/);
    for (const button of render().match(/<button[^>]*>Add [^<]+/g) ?? []) {
      expect(button).not.toMatch(/ disabled(="")?[ >]/);
    }
  });

  test("unavailable says so and offers Retry", () => {
    const html = render({ state: { kind: "unavailable" } });
    expect(html).toContain("The engine is unavailable right now");
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/);
  });

  test("a position without legal moves says so", () => {
    expect(render({ state: { kind: "terminal" } })).toContain("No legal moves in this position");
  });

  test("a finished search without lines says there is no suggestion", () => {
    const html = render({ state: { kind: "done", depth: 18, maxDepth: 18, lines: [] } });
    expect(html).toContain("no suggestion");
  });

  test("announces politely only when a search ends or the engine is unavailable", () => {
    expect(render()).toMatch(/<p role="status" class="sr-only">Analysis finished at depth 18\./);
    expect(render({ state: { kind: "unavailable" } })).toMatch(
      /role="status" class="sr-only">The engine is unavailable\./,
    );
    const analysing = render({
      state: { kind: "analysing", depth: 11, maxDepth: 18, lines: engineLines },
    });
    expect(analysing).toMatch(/role="status" class="sr-only"><\/p>/);
    expect(render({ state: { kind: "starting" } })).toMatch(/role="status" class="sr-only"><\/p>/);
  });
});
