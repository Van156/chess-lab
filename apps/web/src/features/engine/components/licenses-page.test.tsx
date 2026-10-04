import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ENGINE_LICENSE_PATH,
  ENGINE_SOURCE_URL,
  ENGINE_WASM_PATH,
  ENGINE_WORKER_PATH,
} from "../config";
import LicensesPage from "./licenses-page";

describe("LicensesPage", () => {
  const html = renderToStaticMarkup(<LicensesPage />);

  test("names the licence and says the engine is separate and unmodified", () => {
    expect(html).toContain("GPL-3.0");
    expect(html).toContain("separate Web");
    expect(html).toContain("unmodified");
  });

  test("links the upstream source of the pinned version", () => {
    expect(html).toContain(`href="${ENGINE_SOURCE_URL}"`);
    expect(html).toContain("stockfish@19.0.0");
  });

  test("links the served engine files and the licence text", () => {
    for (const path of [ENGINE_WORKER_PATH, ENGINE_WASM_PATH, ENGINE_LICENSE_PATH]) {
      expect(html).toContain(`href="${path}"`);
    }
  });
});
