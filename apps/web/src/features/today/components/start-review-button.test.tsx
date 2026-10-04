import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import StartReviewButton from "./start-review-button";

describe("StartReviewButton", () => {
  test("renders disabled, not a link, while the review route is unavailable", () => {
    const html = renderToStaticMarkup(<StartReviewButton />);
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Start review/);
    expect(html).not.toContain("<a ");
  });
});
