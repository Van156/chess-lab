import { call, ORPCError } from "@orpc/server";
import { describe, expect, test } from "bun:test";

import type { AuthorizationPort } from "./authorization";
import { platformProcedure, protectedProcedure, publicProcedure } from "./index";
import type { Context } from "./context";

/**
 * Unit tests for the oRPC procedure builders. Uses a FAKE `AuthorizationPort` (no DB) so these run
 * everywhere, fast; DB-backed behavior is covered by `authorization.integration.test.ts`.
 */

/** A `Context["session"]` fixture. Cast because the real `Session` type (better-auth's
 * `$Infer.Session`) carries many generated fields irrelevant to the builders under test: only
 * `user.id` is read. */
function fakeSession(options: { userId?: string }): Context["session"] {
  return {
    session: {},
    user: {
      id: options.userId ?? "user-1",
    },
  } as unknown as Context["session"];
}

/** Builds a fully-fake `Context` for `call()`, with a controllable `AuthorizationPort`. */
function fakeContext(overrides: {
  session?: Context["session"];
  authorization?: Partial<AuthorizationPort>;
}): Context {
  const authorization: AuthorizationPort = {
    hasPlatformPermission: async () => false,
    ...overrides.authorization,
  };
  return {
    session: overrides.session ?? null,
    // Unused by any builder under test; a real Database is not needed.
    db: {} as unknown as Context["db"],
    headers: new Headers(),
    authorization,
    // Unused by any builder under test.
    platformAdmin: {} as unknown as Context["platformAdmin"],
    // Unused by any builder under test.
    auditLogger: {} as unknown as Context["auditLogger"],
  };
}

const echoHandler = protectedProcedure.handler(({ context }) => context.session?.user.id);

describe("protectedProcedure", () => {
  test("no session -> UNAUTHORIZED", async () => {
    await expect(
      call(echoHandler, undefined, { context: fakeContext({ session: null }) }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("valid session -> handler runs", async () => {
    const session = fakeSession({ userId: "user-42" });
    const result = await call(echoHandler, undefined, { context: fakeContext({ session }) });
    expect(result).toBe("user-42");
  });
});

describe("platformProcedure", () => {
  test("no session -> UNAUTHORIZED", async () => {
    const platformPing = platformProcedure({ user: ["list"] }).handler(() => "pong");
    await expect(
      call(platformPing, undefined, { context: fakeContext({ session: null }) }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("user without a platform role -> FORBIDDEN", async () => {
    const platformPing = platformProcedure({ user: ["list"] }).handler(() => "pong");
    const session = fakeSession({ userId: "plain-1" });
    const context = fakeContext({
      session,
      authorization: { hasPlatformPermission: async () => false },
    });
    await expect(call(platformPing, undefined, { context })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("superadmin -> handler runs", async () => {
    const platformPing = platformProcedure({ user: ["list"] }).handler(() => "pong");
    const session = fakeSession({ userId: "superadmin-1" });
    let calledWith: { userId: string; permissions: Record<string, string[]> } | undefined;
    const context = fakeContext({
      session,
      authorization: {
        hasPlatformPermission: async (userId, permissions) => {
          calledWith = { userId, permissions };
          return true;
        },
      },
    });
    const result = await call(platformPing, undefined, { context });
    expect(result).toBe("pong");
    expect(calledWith).toEqual({ userId: "superadmin-1", permissions: { user: ["list"] } });
  });
});

// Behavior tests for `publicProcedure` (no auth guard at all) and for the
// `ORPCError` instances the other builders above throw (asserted here via
// `echoHandler`, which requires a session).
describe("publicProcedure", () => {
  test("runs without a session", async () => {
    const health = publicProcedure.handler(() => "OK");
    const result = await call(health, undefined, { context: fakeContext({ session: null }) });
    expect(result).toBe("OK");
  });

  test("ORPCError carries the code thrown by the builders", async () => {
    await expect(
      call(echoHandler, undefined, { context: fakeContext({ session: null }) }),
    ).rejects.toBeInstanceOf(ORPCError);
  });
});
