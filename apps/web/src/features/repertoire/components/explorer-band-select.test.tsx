import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ExplorerBandSelect, { type ExplorerBandSelectProps } from "./explorer-band-select";

function render(overrides: Partial<ExplorerBandSelectProps> = {}) {
  return renderToStaticMarkup(
    <ExplorerBandSelect
      ownBand={1600}
      band={1600}
      pending={false}
      onChange={() => {}}
      {...overrides}
    />,
  );
}

describe("ExplorerBandSelect", () => {
  test("is a select with a visible label", () => {
    const html = render();
    const id = html.match(/<label[^>]*for="([^"]+)"/)?.[1];
    expect(id).toBeDefined();
    expect(html).toContain(">Compare with rating band</label>");
    expect(html).toContain(`<select`);
    expect(html).toContain(`id="${id}"`);
  });

  test("labels each option with its band and distance", () => {
    const html = render();
    for (const label of [
      "1200–1399 (2 below)",
      "1400–1599 (1 below)",
      "1600–1799 (your band)",
      "1800–1999 (1 above)",
      "2000–2199 (2 above)",
    ]) {
      expect(html).toContain(`>${label}</option>`);
    }
  });

  test("selects the option of the band in use", () => {
    const html = render({ band: 1800 });
    expect(html).toMatch(/value="1"[^>]*selected=""/);
    expect(html.match(/selected=""/g)).toHaveLength(1);
  });

  test("drops duplicate bands at the end of the list", () => {
    const html = render({ ownBand: 2500, band: 2500 });
    expect(html.match(/<option/g)).toHaveLength(3);
  });

  test("is disabled and announces saving while a change is pending", () => {
    const idle = render();
    expect(idle).not.toContain('disabled=""');
    expect(idle).not.toContain("Saving band");
    const busy = render({ pending: true });
    expect(busy).toMatch(/<select[^>]*disabled=""/);
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toMatch(/role="status"[^>]*>Saving band…/);
  });
});
