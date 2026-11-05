import { LichessProtocolError } from "./types";

function parseLine(line: string, lineNumber: number): unknown {
  try {
    return JSON.parse(line);
  } catch {
    throw new LichessProtocolError(`Malformed NDJSON record at line ${lineNumber}`);
  }
}

/**
 * Streams NDJSON records out of a byte stream. Records are yielded as soon as
 * their line is complete, so the full body is never buffered. Blank lines
 * (Lichess keep-alives) are skipped; a malformed line throws.
 */
export async function* parseNdjson(source: AsyncIterable<Uint8Array>): AsyncGenerator<unknown> {
  const decoder = new TextDecoder();
  let buffer = "";
  let lineNumber = 0;

  for await (const chunk of source) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      lineNumber += 1;
      if (line) yield parseLine(line, lineNumber);
      newline = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  const rest = buffer.trim();
  if (rest) yield parseLine(rest, lineNumber + 1);
}
