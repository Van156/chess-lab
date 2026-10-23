import { describe, expect, test } from "bun:test";

import { renderWithRouter } from "@/shared/testing/render-with-router";

import { blackRepertoire, whiteRepertoire } from "./repertoire.fixtures";
import RepertoireListView, { type RepertoireListViewProps } from "./repertoire-list-view";

function render(overrides: Partial<RepertoireListViewProps> = {}) {
  return renderWithRouter(
    <RepertoireListView
      repertoires={[whiteRepertoire, blackRepertoire]}
      onCreate={async () => {}}
      onRename={async () => {}}
      onDelete={async () => {}}
      {...overrides}
    />,
  );
}

describe("RepertoireListView", () => {
  test("groups repertoires by colour, each one linking to its builder", async () => {
    const html = await render();
    expect(html).toContain('aria-label="Playing White"');
    expect(html).toContain('aria-label="Playing Black"');
    expect(html).toContain('href="/repertoire/r1"');
    expect(html).toContain("Open games");
    expect(html).toContain('href="/repertoire/r2"');
    expect(html).toContain("Sicilian Najdorf");
  });

  test("omits a colour section that has no repertoire", async () => {
    const html = await render({ repertoires: [whiteRepertoire] });
    expect(html).toContain('aria-label="Playing White"');
    expect(html).not.toContain('aria-label="Playing Black"');
  });

  test("names the rename and delete buttons after their repertoire", async () => {
    const html = await render();
    expect(html).toContain('aria-label="Rename Open games"');
    expect(html).toContain('aria-label="Delete Sicilian Najdorf"');
  });

  test("the create form has labelled colour and name controls, white preselected", async () => {
    const html = await render();
    expect(html).toContain('aria-label="New repertoire"');
    expect(html).toContain(">Name</label>");
    expect(html).toContain("White");
    expect(html).toContain("Black");
    expect(html).toContain("Create repertoire");
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.indexOf('aria-checked="true"')).toBeLessThan(html.indexOf('value="black"'));
  });

  test("shows the empty state, with the create form still available", async () => {
    const html = await render({ repertoires: [] });
    expect(html).toContain("No repertoires yet");
    expect(html).toContain("Create repertoire");
    expect(html).not.toContain('aria-label="Playing White"');
  });
});
