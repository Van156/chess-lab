import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import IdeaNoteEditor, { type IdeaNoteEditorProps } from "./idea-note-editor";
import { centreNote, emptyNote } from "./repertoire.fixtures";

function render(overrides: Partial<IdeaNoteEditorProps> = {}) {
  return renderToStaticMarkup(
    <IdeaNoteEditor
      note={emptyNote}
      dirty={false}
      onChange={() => {}}
      onSave={() => {}}
      onClear={() => {}}
      {...overrides}
    />,
  );
}

describe("IdeaNoteEditor", () => {
  test("labels every control, with a plan limited to 140 characters and a live counter", () => {
    const html = render();
    expect(html).toContain(">Plan (one line)</label>");
    expect(html).toContain('maxLength="140"');
    expect(html).toContain("0 of 140 characters");
    expect(html).toContain(">Square</label>");
    expect(html).toContain(">From square</label>");
    expect(html).toContain(">To square</label>");
    expect(html).toContain("Add arrow");
    expect(html).toContain("Toggle highlight");
  });

  test("describes the note in words and lists removable arrows and highlights", () => {
    const html = render({ note: centreNote, dirty: true });
    expect(html).toContain("Arrows: g1 to f3, f1 to c4.");
    expect(html).toContain("Highlighted: e4, d4.");
    expect(html).toContain('aria-label="Remove arrow g1 to f3"');
    expect(html).toContain('aria-label="Remove highlight e4"');
    expect(html).toContain("33 of 140 characters");
  });

  test("announces a plan that cannot be saved and disables Save", () => {
    const html = render({ note: { ...emptyNote, plan: "one\ntwo" }, dirty: true });
    expect(html).toContain('role="alert"');
    expect(html).toContain("The plan must be one line.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save note/);
  });

  test("disables Save while the draft matches what is saved", () => {
    expect(render({ dirty: false })).toMatch(/<button[^>]*disabled=""[^>]*>Save note/);
    expect(render({ dirty: true })).not.toMatch(/<button[^>]*disabled=""[^>]*>Save note/);
  });

  test("offers Clear note", () => {
    expect(render()).toContain("Clear note");
  });
});
