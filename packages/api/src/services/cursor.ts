import { ORPCError } from "@orpc/server";
import { z } from "zod";

/** Cursor parts: an ISO-8601 instant (as `Date#toISOString` writes it), a row id, a ply index. */
export const cursorTimestamp = z.iso.datetime().refine((value) => !Number.isNaN(Date.parse(value)));
export const cursorId = z.string().min(1);
export const cursorPly = z.int().min(0);

/** Opaque keyset cursor: the sort-key values of the last row, base64url JSON. */
export function encodeCursor(parts: readonly (string | number)[]): string {
  return Buffer.from(JSON.stringify(parts)).toString("base64url");
}

/** Decodes a cursor and validates it against the router's tuple schema; failure is a client error. */
export function decodeCursor<T extends z.ZodType>(cursor: string, schema: T): z.output<T> {
  try {
    return schema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  } catch {
    throw new ORPCError("BAD_REQUEST", { message: "Invalid cursor" });
  }
}
