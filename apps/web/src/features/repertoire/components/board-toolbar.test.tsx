import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import BoardToolbar, { type BoardToolbarProps } from "./board-toolbar";

function render(overrides: Partial<BoardToolbarProps> = {}) {
  return renderToStaticMarkup(
    <BoardToolbar
      lineCount={3}
      onChangeLineCount={() => {}}
      showRepertoireArrows
      onToggleRepertoireArrows={() => {}}
      {...overrides}
    />,
  );
}

describe("BoardToolbar", () => {
  test("offers one button per line count from 1 to 5, named in words", () => {
    const html = render();
    expect(html).toContain('aria-label="1 line on the board"');
    for (const count of [2, 3, 4, 5]) {
      expect(html).toContain(`aria-label="${count} lines on the board"`);
    }
    expect(html.match(/<button[^>]*aria-pressed/g)).toHaveLength(5);
  });

  test("presses only the chosen count", () => {
    const html = render({ lineCount: 5 });
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="5 lines on the board"/);
  });

  test("labels the group and the repertoire arrows switch", () => {
    const html = render();
    expect(html).toContain('role="group" aria-labelledby=');
    expect(html).toContain(">Lines</span>");
    expect(html).toContain("Repertoire arrows");
  });

  test("keeps every target at least 44px", () => {
    expect(render().match(/min-h-11 min-w-11/g)).toHaveLength(5);
  });
});
