import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { MoveRank } from "../lib/continuation-ranking";
import type { RepertoireGraph } from "../lib/repertoire-tree";
import { buildVariationTree } from "../lib/variation-tree";
import { forkGraph, forkGraphPath, openGameGraph } from "./repertoire.fixtures";
import VariationTree, { type VariationTreeProps } from "./variation-tree";

const pathOf = (ids: string[]) =>
  ids
    .map((id) => forkGraph.moves.find((move) => move.id === id))
    .filter((move) => move !== undefined);

function render(overrides: Partial<VariationTreeProps> = {}) {
  return renderToStaticMarkup(
    <VariationTree
      tree={buildVariationTree(forkGraph, pathOf(forkGraphPath))}
      fullTree={null}
      onSelect={() => {}}
      onDelete={() => {}}
      onRename={() => {}}
      {...overrides}
    />,
  );
}

describe("VariationTree", () => {
  test("leaves the start position to the base line header", () => {
    expect(render()).not.toContain("Start position");
  });

  test("explains an empty repertoire", () => {
    const html = render({ tree: buildVariationTree({ startPositionId: "p0", moves: [] }, []) });
    expect(html).toContain("No moves yet");
  });

  test("says no moves follow the base when a base leaves nothing below it", () => {
    const html = render({
      tree: buildVariationTree({ startPositionId: "p0", moves: [] }, []),
      fullTree: buildVariationTree(forkGraph, []),
    });
    expect(html).toContain("No moves after the base yet.");
  });

  test("keeps the moves from before the base under a fold, closed at first", () => {
    const html = render({ fullTree: buildVariationTree(forkGraph, []) });
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*All lines from the start position/);
    expect(html).not.toContain("1. d4");
    expect(html.match(/aria-label="1\. Nf3[^"]*"/g)).toHaveLength(1);
  });

  test("offers no fold without a base", () => {
    expect(render()).not.toContain("All lines from the start position");
  });

  test("marks only the last move of the shown line as the current location", () => {
    const html = render();
    expect(html.match(/aria-current="location"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-label="2\. Nc3[^"]*" aria-current="location"/);
  });

  test("shows alternatives in a labelled group and names them as alternatives", () => {
    const html = render();
    expect(html).toContain('aria-label="1... c5, opponent reply, alternative to 1... e5"');
    // The nested alternative at 1... c5 is a second level of the same grouping.
    expect(html).toContain('aria-label="Alternatives to 2. Nf3"');
    expect(html).toContain('aria-label="2. Nc3, your move, alternative to 2. Nf3"');
  });

  test("shows White and Black on one row and the move number once", () => {
    const html = renderToStaticMarkup(
      <VariationTree
        tree={buildVariationTree(
          { startPositionId: "p0", moves: openGameGraph.moves.slice(0, 2) },
          [],
        )}
        fullTree={null}
        onSelect={() => {}}
        onDelete={() => {}}
        onRename={() => {}}
      />,
    );
    expect(html.match(/<li>/g)).toHaveLength(1);
    expect(html).toMatch(/1\.<\/span>.*>e4<.*>e5</);
    expect(html).not.toContain(">1...</span>");
  });

  test("starts an alternative that opens with Black on a `N...` row", () => {
    const html = render();
    expect(html).toMatch(/1\.\.\.<\/span>.*aria-label="1\.\.\. c5, opponent reply, alternative to/);
  });

  test("keeps only-child chains flat, without nested alternatives", () => {
    const html = renderToStaticMarkup(
      <VariationTree
        tree={buildVariationTree(
          { startPositionId: "p0", moves: openGameGraph.moves.slice(0, 2) },
          [],
        )}
        fullTree={null}
        onSelect={() => {}}
        onDelete={() => {}}
        onRename={() => {}}
      />,
    );
    expect(html).toContain('aria-label="1... e5, opponent reply"');
    expect(html).not.toContain("Alternatives to");
  });

  test("marks a transposition leaf", () => {
    const html = render();
    expect(html).toContain("transposition to a position shown above");
    expect(html).toContain(">transposition<");
  });

  test("offers a fold toggle on a fork and a delete button on every move", () => {
    const html = render();
    expect(html).toContain('aria-label="Hide alternatives to 1... e5"');
    expect(html).toContain('aria-label="Delete 1. e4 and its continuations"');
    expect(html).toContain('aria-label="Delete 2. Nc3 and its continuations"');
  });

  test("cannot fold a fork the shown line runs through, but can fold the others", () => {
    const toggleOf = (html: string, label: string) =>
      html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? "";
    expect(toggleOf(render(), "Hide alternatives to 2\\. Nf3")).toContain('disabled=""');
    const atE5 = render({ tree: buildVariationTree(forkGraph, pathOf(["f1", "f2"])) });
    expect(toggleOf(atE5, "Hide alternatives to 1\\.\\.\\. e5")).not.toContain('disabled=""');
  });

  describe("study lines", () => {
    const named = {
      ...forkGraph,
      moves: forkGraph.moves.map((move) =>
        move.id === "f1" ? { ...move, name: "King's pawn" } : move,
      ),
    };

    test("lists each move leaving the start position as a study line, not as an alternative", () => {
      const html = render();
      expect(html).toContain('aria-label="Study lines"');
      expect(html.match(/Unnamed line/g)).toHaveLength(2);
      expect(html).not.toContain('aria-label="Alternatives to 1. e4"');
      expect(html).not.toContain("alternative to 1. e4");
      expect(html).toContain('aria-label="1. Nf3, your move"');
    });

    test("names a line, and keeps the first move as a hint", () => {
      const html = render({ tree: buildVariationTree(named, pathOf(forkGraphPath)) });
      expect(html).toContain("King&#x27;s pawn");
      expect(html).toContain(">1. e4</span>");
      expect(html.match(/Unnamed line/g)).toHaveLength(1);
    });

    test("offers a 44px rename button for each line", () => {
      const html = render();
      expect(html).toMatch(
        /<button[^>]*aria-label="Rename the line starting 1\. e4"[^>]*class="[^"]*\bh-11\b[^"]*\bw-11\b/,
      );
      expect(html).toContain('aria-label="Rename the line starting 1. Nf3"');
    });

    test("marks the group that holds the shown line, and only that one", () => {
      const html = render();
      expect(html.match(/Current line/g)).toHaveLength(1);
      expect(html.indexOf("Current line")).toBeLessThan(
        html.indexOf("Rename the line starting 1. Nf3"),
      );
    });

    test("groups a single move after the base, and the group can be named", () => {
      const graph = { startPositionId: "p0", moves: forkGraph.moves.slice(0, 2) };
      const html = render({
        tree: buildVariationTree(graph, [], graph.moves.slice(0, 1)),
        fullTree: buildVariationTree(graph, []),
      });
      expect(html.match(/Unnamed line/g)).toHaveLength(1);
      expect(html).toContain('aria-label="Rename the line starting 1... e5"');
    });
  });

  describe("the fold with the whole repertoire", () => {
    const base = pathOf(["f1", "f2"]);
    const shown = pathOf(["f1", "f2", "f4"]);
    // The container builds the full tree with the shown line, so the fold receives its marks.
    const open = () =>
      render({
        tree: buildVariationTree(forkGraph, shown, base),
        fullTree: buildVariationTree(forkGraph, shown),
        foldOpenByDefault: true,
      });

    test("announces the current move once while the fold is open", () => {
      const html = open();
      expect(html).toContain('aria-label="All lines from the start position"');
      expect(html.match(/aria-current="location"/g)).toHaveLength(1);
      expect(html.match(/aria-label="2\. Nf3, your move[^"]*"/g)?.length).toBeGreaterThan(1);
    });

    test("does not highlight the shown line inside the fold", () => {
      const html = open();
      const fold = html.slice(html.indexOf('role="group"'));
      expect(fold).not.toContain("bg-accent");
      expect(fold).not.toContain("font-semibold");
    });

    test("folds its alternatives apart from the study lines", () => {
      const html = open();
      const fold = html.slice(html.indexOf('role="group"'));
      expect(fold).toContain('aria-label="Alternatives to 1. e4"');
      expect(html.slice(0, html.indexOf('role="group"'))).not.toContain(
        'aria-label="Alternatives to 1. e4"',
      );
    });
  });
  describe("engine rankings", () => {
    const rank = (rankNo: number, scoreLabel: string): MoveRank => ({
      rank: rankNo,
      of: 2,
      score: { kind: "cp", value: 0 },
      scoreLabel,
    });
    // 1. Nf3 beats 1. e4 at the start; 1... e5 beats 1... c5 after 1. e4.
    const rankings = new Map<string, MoveRank>([
      ["f7", rank(1, "+0.30")],
      ["f1", rank(2, "+0.20")],
      ["f3", rank(1, "-0.10")],
      ["f2", rank(2, "-0.40")],
    ]);
    const atE4 = () => buildVariationTree(forkGraph, pathOf(["f1", "f2"]));

    test("lists the ranked study lines best first", () => {
      const html = render({ tree: atE4(), rankings });
      expect(html.indexOf('aria-label="1. Nf3')).toBeLessThan(html.indexOf('aria-label="1. e4'));
    });

    test("keeps the stored order without rankings", () => {
      const html = render({ tree: atE4() });
      expect(html.indexOf('aria-label="1. e4')).toBeLessThan(html.indexOf('aria-label="1. Nf3'));
    });

    test("shows a rank and score badge on each ranked move and says so in its label", () => {
      const html = render({ tree: atE4(), rankings });
      expect(html).toContain("#1 +0.30");
      expect(html).toContain("#2 +0.20");
      expect(html).toContain('aria-label="1. Nf3, your move, ranked 1 of 2 by the engine, +0.30"');
    });

    test("sorts the alternatives of a fork best first while the continuing move keeps its place", () => {
      const html = render({ tree: atE4(), rankings });
      const alternatives = html.slice(html.indexOf('aria-label="Alternatives to 1... e5"'));
      expect(alternatives).toContain("ranked 1 of 2 by the engine, -0.10");
      // The line continues with 1... e5 (ranked 2); 1... c5 (ranked 1) is its listed alternative.
      expect(html.indexOf('aria-label="1... e5, opponent reply, ranked 2')).toBeLessThan(
        html.indexOf('aria-label="Alternatives to 1... e5"'),
      );
    });

    test("lists three alternatives in rank order, the reverse of the stored order", () => {
      const wide = {
        ...forkGraph,
        moves: [
          ...forkGraph.moves,
          { ...forkGraph.moves[2], id: "f10", toPositionId: "p10", san: "e6", uci: "e7e6" },
          { ...forkGraph.moves[2], id: "f11", toPositionId: "p11", san: "d6", uci: "d7d6" },
        ],
      } satisfies RepertoireGraph;
      const tree = buildVariationTree(
        wide,
        ["f1", "f2"].flatMap((id) => wide.moves.filter((move) => move.id === id)),
      );
      const reversed = new Map<string, MoveRank>([
        ["f2", rank(4, "-0.50")],
        ["f3", rank(3, "-0.30")],
        ["f10", rank(2, "-0.20")],
        ["f11", rank(1, "-0.10")],
      ]);
      const order = (html: string) =>
        ["1... d6", "1... e6", "1... c5"].map((san) =>
          html.indexOf(`aria-label="${san}, opponent reply, alternative to 1... e5`),
        );
      const stored = order(render({ tree }));
      expect(stored.every((at) => at >= 0)).toBe(true);
      expect(stored).toEqual([...stored].sort((a, b) => b - a));
      const ranked = order(render({ tree, rankings: reversed }));
      expect(ranked.every((at) => at >= 0)).toBe(true);
      expect(ranked).toEqual([...ranked].sort((a, b) => a - b));
    });

    test("shows nothing on moves the engine has not ranked", () => {
      const html = render({ tree: atE4(), rankings: new Map([["f7", rank(1, "+0.30")]]) });
      expect(html.match(/ranked \d+ of/g)).toHaveLength(1);
      expect(html).not.toContain("#2");
    });

    describe("engine grades", () => {
      const better = { san: "Bc4", scoreLabel: "+0.40" };
      const graded = (
        rankNo: number,
        of: number,
        scoreLabel: string,
        withHint = true,
      ): MoveRank => ({
        rank: rankNo,
        of,
        score: { kind: "cp", value: 0 },
        scoreLabel,
        ...(withHint ? { engineBest: better } : {}),
      });
      // One stored move at the start and one reply: 1. e4 e5.
      const single = buildVariationTree(
        { startPositionId: "p0", moves: forkGraph.moves.slice(0, 2) },
        [],
      );

      test("grades a lone study line and names the engine's better move above it", () => {
        const html = render({ tree: single, rankings: new Map([["f1", graded(2, 4, "+0.10")]]) });
        expect(html).toContain("#2 +0.10");
        expect(html).toContain('aria-label="1. e4, your move, ranked 2 of 4 by the engine, +0.10"');
        expect(html.match(/Engine best:/g)).toHaveLength(1);
        expect(html.indexOf("Engine best:")).toBeLessThan(html.indexOf('aria-label="Study lines"'));
        expect(html).toMatch(/Engine best: <span[^>]*>Bc4<\/span> <span[^>]*>\+0\.40<\/span>/);
      });

      test("puts the hint of a deeper position on the move that continues the line, label included", () => {
        const html = render({ tree: single, rankings: new Map([["f2", graded(1, 3, "-0.20")]]) });
        expect(html).toContain(
          'aria-label="1... e5, opponent reply, ranked 1 of 3 by the engine, -0.20, engine best move here is Bc4, +0.40"',
        );
        expect(html.match(/Engine best:/g)).toHaveLength(1);
        expect(html.indexOf("Engine best:")).toBeGreaterThan(
          html.indexOf('aria-label="Study lines"'),
        );
      });

      test("shows the hint of a fork once, not on its alternatives", () => {
        const html = render({
          tree: atE4(),
          rankings: new Map([
            ["f2", graded(2, 3, "-0.40")],
            ["f3", graded(1, 3, "-0.10")],
          ]),
        });
        expect(html.match(/Engine best:/g)).toHaveLength(1);
        expect(html).toContain("ranked 2 of 3 by the engine, -0.40, engine best move here is Bc4");
        expect(html).toContain(
          'aria-label="1... c5, opponent reply, alternative to 1... e5, ranked 1 of 3 by the engine, -0.10"',
        );
      });

      test("shows no hint when the engine's best move is stored", () => {
        const html = render({
          tree: single,
          rankings: new Map([["f1", graded(1, 3, "+0.40", false)]]),
        });
        expect(html).toContain("#1 +0.40");
        expect(html).not.toContain("Engine best");
        expect(html).not.toContain("engine best move");
      });
    });

    test("leaves the full-repertoire fold unranked", () => {
      const html = render({
        tree: buildVariationTree(forkGraph, pathOf(["f1", "f2", "f4"]), pathOf(["f1", "f2"])),
        fullTree: buildVariationTree(forkGraph, []),
        foldOpenByDefault: true,
        rankings,
      });
      const fold = html.slice(html.indexOf('role="group"'));
      expect(fold).not.toContain("by the engine");
    });
  });
});
