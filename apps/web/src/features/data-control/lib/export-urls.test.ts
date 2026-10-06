import { describe, expect, test } from "bun:test";

import { buildExportUrls } from "./export-urls";

describe("buildExportUrls", () => {
  test("points both exports at the server origin", () => {
    expect(buildExportUrls("https://api.example.com")).toEqual({
      dataJson: "https://api.example.com/api/export/data.json",
      gamesPgn: "https://api.example.com/api/export/games.pgn",
    });
  });

  test("ignores trailing slashes on the server URL", () => {
    expect(buildExportUrls("http://localhost:3000//").dataJson).toBe(
      "http://localhost:3000/api/export/data.json",
    );
  });
});
