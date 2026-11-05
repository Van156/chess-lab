import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import RepertoireNameField from "./repertoire-name-field";

const base = { id: "n", label: "Name", value: "", onChange: () => {} };

describe("RepertoireNameField", () => {
  test("labels the input", () => {
    const html = renderToStaticMarkup(<RepertoireNameField {...base} />);
    expect(html).toContain("<label");
    expect(html).toContain('for="n"');
    expect(html).not.toContain('aria-invalid="true"');
    expect(html).not.toContain("aria-describedby");
  });

  test("announces an error and ties it to the input", () => {
    const html = renderToStaticMarkup(<RepertoireNameField {...base} error="Enter a name." />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="n-error"');
    expect(html).toContain('id="n-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Enter a name.");
  });

  test("keeps the label for assistive technology when hidden", () => {
    const html = renderToStaticMarkup(<RepertoireNameField {...base} hideLabel />);
    expect(html).toMatch(/<label[^>]*class="[^"]*sr-only/);
  });
});
