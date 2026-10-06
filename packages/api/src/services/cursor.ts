import { ORPCError } from "@orpc/server";
import { z } from "zod";

const cursorParts = z
  .array(z.union([z.string(), z.number()]))
  .min(1)
  .max(4);

/** Opaque keyset cursor: the sort-key values of the last row, base64url JSON. */
export function encodeCursor(parts: readonly (string | number)[]): string {
  return Buffer.from(JSON.stringify(parts)).toString("base64url");
}

/** Decodes a cursor of exactly `length` parts; anything else is a client error. */
export function decodeCursor(cursor: string, length: number): (string | number)[] {
  try {
    const parts = cursorParts.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (parts.length === length) return parts;
  } catch {
    // Fall through to the single error below.
  }
  throw new ORPCError("BAD_REQUEST", { message: "Invalid cursor" });
}
