import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import LoadMore from "./load-more";

const render = (props: { loading?: boolean; failed?: boolean } = {}) =>
  renderToStaticMarkup(
    <LoadMore noun="games" loading={false} failed={false} onLoadMore={() => {}} {...props} />,
  );

describe("LoadMore", () => {
  test("offers the next page", () => {
    const html = render();
    expect(html).toContain("Load more games");
    expect(html).not.toContain('role="alert"');
  });

  test("is disabled and says so while the next page loads", () => {
    const html = render({ loading: true });
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Loading games/);
  });

  test("a failed page announces the error and offers a retry", () => {
    const html = render({ failed: true });
    expect(html).toContain('role="alert"');
    expect(html).toContain("More games could not be loaded.");
    expect(html).toMatch(/<button(?![^>]*\sdisabled="")[^>]*>Try again/);
  });

  test("a retry in flight hides the stale error", () => {
    const html = render({ failed: true, loading: true });
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Loading games");
  });
});
