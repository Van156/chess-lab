import { describe, expect, test } from "bun:test";
import { parseNdjson } from "./ndjson";

const enc = new TextEncoder();

async function* chunks(...parts: (string | Uint8Array)[]) {
  for (const p of parts) yield typeof p === "string" ? enc.encode(p) : p;
}

async function collect(source: AsyncIterable<unknown>) {
  const out: unknown[] = [];
  for await (const v of source) out.push(v);
  return out;
}

describe("parseNdjson", () => {
  test("parses one record per line", async () => {
    expect(await collect(parseNdjson(chunks('{"a":1}\n{"a":2}\n')))).toEqual([{ a: 1 }, { a: 2 }]);
  });

  test("joins a record split across chunk boundaries", async () => {
    const out = await collect(parseNdjson(chunks('{"a":', '1}\n{"a"', ":2}\n")));
    expect(out).toEqual([{ a: 1 }, { a: 2 }]);
  });

  test("yields each record before the stream ends", async () => {
    const seen: unknown[] = [];
    let ended = false;
    async function* source() {
      yield enc.encode('{"a":1}\n');
      ended = seen.length === 0;
      yield enc.encode('{"a":2}\n');
    }
    for await (const v of parseNdjson(source())) seen.push(v);
    expect(ended).toBe(false);
  });

  test("parses a trailing line without a newline", async () => {
    expect(await collect(parseNdjson(chunks('{"a":1}\n{"a":2}')))).toEqual([{ a: 1 }, { a: 2 }]);
  });

  test("skips blank keep-alive lines", async () => {
    expect(await collect(parseNdjson(chunks('\n{"a":1}\n\n\r\n{"a":2}\n\n')))).toEqual([
      { a: 1 },
      { a: 2 },
    ]);
  });

  test("handles a multi-byte character split across chunks", async () => {
    const bytes = enc.encode('{"n":"é"}\n');
    const out = await collect(parseNdjson(chunks(bytes.slice(0, 7), bytes.slice(7))));
    expect(out).toEqual([{ n: "é" }]);
  });

  test("throws on a malformed line, naming its line number", async () => {
    const run = collect(parseNdjson(chunks('{"a":1}\n{oops\n')));
    await expect(run).rejects.toThrow(/line 2/);
  });

  test("throws on a malformed trailing line", async () => {
    await expect(collect(parseNdjson(chunks('{"a":1}\n{oops')))).rejects.toThrow(/line 2/);
  });
});
