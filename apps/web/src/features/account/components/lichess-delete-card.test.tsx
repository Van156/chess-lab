import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import LichessDeleteCard from "./lichess-delete-card";

const html = renderToStaticMarkup(
  <LichessDeleteCard username="magnus" onDelete={async () => ({ ok: true })} onReauth={() => {}} />,
);

describe("LichessDeleteCard", () => {
  test("labels the username input and shows the expected username", () => {
    expect(html).toMatch(/<label for="lichess-delete-username"[^>]*>[^]*magnus[^]*<\/label>/);
    expect(html).toContain('id="lichess-delete-username"');
  });

  test("describes the input by the irreversible warning", () => {
    expect(html).toContain('aria-describedby="lichess-delete-warning"');
    expect(html).toContain('id="lichess-delete-warning"');
    expect(html).toContain("cannot be undone");
  });

  test("starts with the delete button disabled and no error or re-auth button", () => {
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Delete my account permanently<\/button>/);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Sign in with Lichess again");
  });

  test("labels the card by its heading", () => {
    expect(html).toContain('aria-labelledby="lichess-delete-title"');
    expect(html).toContain('id="lichess-delete-title"');
  });
});
