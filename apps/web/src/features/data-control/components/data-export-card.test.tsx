import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import DataExportCard from "./data-export-card";

const urls = {
  dataJson: "https://api.example.com/api/export/data.json",
  gamesPgn: "https://api.example.com/api/export/games.pgn",
};

describe("DataExportCard", () => {
  const html = renderToStaticMarkup(<DataExportCard urls={urls} />);

  test("links to the JSON export with a descriptive name", () => {
    expect(html).toMatch(
      /<a href="https:\/\/api\.example\.com\/api\/export\/data\.json"[^>]*>Download all your data \(JSON\)<\/a>/,
    );
  });

  test("links to the PGN export with a descriptive name", () => {
    expect(html).toMatch(
      /<a href="https:\/\/api\.example\.com\/api\/export\/games\.pgn"[^>]*>Download your games \(PGN\)<\/a>/,
    );
  });

  test("labels the card by its heading", () => {
    expect(html).toContain('aria-labelledby="data-export-title"');
    expect(html).toContain('id="data-export-title"');
  });
});
