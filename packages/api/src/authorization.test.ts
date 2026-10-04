import { describe, expect, spyOn, test } from "bun:test";

import type { AuthorizationAuthApi } from "./authorization";
import { createBetterAuthAuthorization } from "./authorization";

/**
 * Unit tests for `createBetterAuthAuthorization` using a FAKE `AuthorizationAuthApi` (no DB, no
 * real better-auth instance). Exercises both paths the adapter must distinguish:
 *
 * - better-auth's documented "denied" outcome (user not found) → mapped to `false`.
 * - anything else (a DB-down error, a timeout, an `APIError` with an
 *   unrecognized code) → propagated (so oRPC turns it into a 500), and logged
 *   once via `console.error` with no secrets (no headers, no raw permissions
 *   payload).
 */

/** Mirrors the structural shape of better-auth 1.7.5's `@better-auth/core` `APIError` (see authorization.ts). */
class FakeBetterAuthApiError extends Error {
  readonly status: string;
  readonly body: { code?: string; message: string };

  constructor(status: string, body: { code?: string; message: string }) {
    super(body.message);
    this.name = "APIError";
    this.status = status;
    this.body = body;
  }
}

describe("createBetterAuthAuthorization", () => {
  describe("hasPlatformPermission", () => {
    test('"user not found" (no active session, no matching user) -> false', async () => {
      const auth: AuthorizationAuthApi = {
        api: {
          userHasPermission: async () => {
            throw new FakeBetterAuthApiError("BAD_REQUEST", { message: "user not found" });
          },
        },
      };
      const port = createBetterAuthAuthorization(auth);
      await expect(port.hasPlatformPermission("user-1", { user: ["list"] })).resolves.toBe(false);
    });

    test("an infrastructure error propagates and is logged once", async () => {
      const errorSpy = spyOn(console, "error").mockImplementation(() => {});
      const dbError = new Error("ECONNREFUSED");
      const auth: AuthorizationAuthApi = {
        api: {
          userHasPermission: async () => {
            throw dbError;
          },
        },
      };
      const port = createBetterAuthAuthorization(auth);
      await expect(port.hasPlatformPermission("user-1", { user: ["list"] })).rejects.toBe(dbError);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
    });
  });
});
