import { describe, expect, test } from "bun:test";

import { checkOpeningBookPlacement, parsePrecachedUrls } from "./precache-guard";

const BOOK = '{"a b c":["C44","Scotch Game"]}';

describe("parsePrecachedUrls", () => {
  test("reads every url from the precache manifest", () => {
    const sw = `define(["./workbox-1"],function(e){e.precacheAndRoute([{url:"registerSW.js",revision:"3ca0"},{url:"assets/index-Bx12.js",revision:null},{url:'index.html',revision:"ab"}],{})});`;
    expect(parsePrecachedUrls(sw)).toEqual(["registerSW.js", "assets/index-Bx12.js", "index.html"]);
  });

  test("reads urls whose keys are quoted, as JSON-serialised manifests write them", () => {
    const sw = `precacheAndRoute([{"url":"assets/index-Bx12.js","revision":null},{'url':'index.html'}])`;
    expect(parsePrecachedUrls(sw)).toEqual(["assets/index-Bx12.js", "index.html"]);
  });

  test("returns nothing when the worker has no manifest", () => {
    expect(parsePrecachedUrls("self.skipWaiting()")).toEqual([]);
  });
});

describe("checkOpeningBookPlacement", () => {
  test("passes when only a non-precached asset holds the book", () => {
    const result = checkOpeningBookPlacement({
      precached: { "assets/index-1.js": "console.log(1)" },
      lazy: { "assets/opening-book-2.js": `export default ${BOOK}` },
    });
    expect(result).toEqual({ ok: true, bookFiles: ["assets/opening-book-2.js"] });
  });

  test("fails and names the precached file that holds the book", () => {
    const result = checkOpeningBookPlacement({
      precached: { "assets/index-1.js": `x=${BOOK}` },
      lazy: { "assets/opening-book-2.js": BOOK },
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("assets/index-1.js");
  });

  test("fails when no precached JS was found, instead of passing on nothing checked", () => {
    const result = checkOpeningBookPlacement({
      precached: {},
      lazy: { "assets/opening-book-2.js": BOOK },
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("no precached JS");
  });

  test("fails when no non-precached asset holds the book", () => {
    const result = checkOpeningBookPlacement({
      precached: { "assets/index-1.js": "console.log(1)" },
      lazy: { "assets/other-2.js": "console.log(2)" },
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("lazy chunk");
  });
});
