import { describe, expect, mock, test } from "bun:test";

import { handleSignOut } from "./sign-out";

function setup(signOut: () => Promise<{ error?: unknown } | undefined>) {
  const onSignedOut = mock(() => {});
  const showError = mock((_message: string) => {});
  return { signOut, onSignedOut, showError };
}

describe("handleSignOut", () => {
  test("navigates on success and shows no error", async () => {
    const ctx = setup(async () => ({ error: null }));
    expect(await handleSignOut(ctx)).toBe(true);
    expect(ctx.onSignedOut).toHaveBeenCalledTimes(1);
    expect(ctx.showError).not.toHaveBeenCalled();
  });

  test("shows the server message on an HTTP error and does not navigate", async () => {
    const ctx = setup(async () => ({
      error: { status: 500, statusText: "Internal Server Error", message: "Session store down" },
    }));
    expect(await handleSignOut(ctx)).toBe(false);
    expect(ctx.onSignedOut).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith("Session store down");
  });

  test("falls back to a generic message when the HTTP error has no body", async () => {
    const ctx = setup(async () => ({ error: { status: 500 } }));
    await handleSignOut(ctx);
    expect(ctx.showError).toHaveBeenCalledWith("Could not sign out.");
    expect(ctx.onSignedOut).not.toHaveBeenCalled();
  });

  test("a rejected promise (network/offline) shows the toast and does not navigate", async () => {
    const ctx = setup(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await handleSignOut(ctx)).toBe(false);
    expect(ctx.showError).toHaveBeenCalledWith("Could not sign out.");
    expect(ctx.onSignedOut).not.toHaveBeenCalled();
  });

  test("runs beforeSignOut first, and a failing one never stops the sign-out", async () => {
    const order: string[] = [];
    const ctx = setup(async () => {
      order.push("signOut");
      return { error: null };
    });
    const result = await handleSignOut({
      ...ctx,
      beforeSignOut: async () => {
        order.push("before");
        throw new Error("flush failed");
      },
    });
    expect(result).toBe(true);
    expect(order).toEqual(["before", "signOut"]);
  });
});
