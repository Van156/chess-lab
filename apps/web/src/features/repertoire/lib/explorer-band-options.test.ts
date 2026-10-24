import { describe, expect, test } from "bun:test";

import { bandOptions } from "./explorer-band-options";

describe("bandOptions", () => {
  test("lists five bands around the own band, labelled by distance", () => {
    expect(bandOptions(1600)).toEqual([
      { offset: -2, band: 1200, label: "1200–1399 (2 below)" },
      { offset: -1, band: 1400, label: "1400–1599 (1 below)" },
      { offset: 0, band: 1600, label: "1600–1799 (your band)" },
      { offset: 1, band: 1800, label: "1800–1999 (1 above)" },
      { offset: 2, band: 2000, label: "2000–2199 (2 above)" },
    ]);
  });

  test("hides offsets that repeat a nearer band at the bottom end", () => {
    expect(bandOptions(0).map(({ offset, band }) => ({ offset, band }))).toEqual([
      { offset: 0, band: 0 },
      { offset: 1, band: 1000 },
      { offset: 2, band: 1200 },
    ]);
    expect(bandOptions(1000).map(({ offset, band }) => ({ offset, band }))).toEqual([
      { offset: -1, band: 0 },
      { offset: 0, band: 1000 },
      { offset: 1, band: 1200 },
      { offset: 2, band: 1400 },
    ]);
  });

  test("hides offsets that repeat a nearer band at the top end", () => {
    const options = bandOptions(2500);
    expect(options.map(({ offset, band }) => ({ offset, band }))).toEqual([
      { offset: -2, band: 2000 },
      { offset: -1, band: 2200 },
      { offset: 0, band: 2500 },
    ]);
    expect(options[2]?.label).toBe("2500+ (your band)");
  });

  test("keeps the open lower end readable", () => {
    expect(bandOptions(1000)[0]?.label).toBe("Under 1000 (1 below)");
  });

  test("offers only the own band when it is not a bucket", () => {
    expect(bandOptions(1500)).toEqual([{ offset: 0, band: 1500, label: "1500 (your band)" }]);
  });
});
