import { describe, expect, test } from "bun:test";

import { DELETE_FALLBACK_MESSAGE } from "./lichess-account";
import {
  deleteCardView,
  errorCodeOf,
  initialFocusTarget,
  UNKNOWN_FAILURE_CODE,
  type DeleteCardState,
} from "./lichess-delete-state";

const base: DeleteCardState = { typed: "", username: "magnus", pending: false, errorCode: null };

describe("deleteCardView", () => {
  test("cannot submit until the typed name matches, ignoring case and whitespace", () => {
    expect(deleteCardView(base).canSubmit).toBe(false);
    expect(deleteCardView({ ...base, typed: "magnu" }).canSubmit).toBe(false);
    expect(deleteCardView({ ...base, typed: " MagNus " }).canSubmit).toBe(true);
  });

  test("cannot submit while a delete is pending", () => {
    expect(deleteCardView({ ...base, typed: "magnus", pending: true }).canSubmit).toBe(false);
  });

  test("shows no error before any failure", () => {
    expect(deleteCardView(base).error).toBeNull();
  });

  test("a re-auth error shows its message and the re-auth button", () => {
    const { error } = deleteCardView({ ...base, errorCode: "REAUTH_REQUIRED" });
    expect(error?.showReauth).toBe(true);
    expect(error?.message).toContain("sign in with Lichess again");
  });

  test("other known codes show their own message without the re-auth button", () => {
    const { error } = deleteCardView({ ...base, errorCode: "USERNAME_MISMATCH" });
    expect(error).toEqual({
      message: "The typed username does not match this account.",
      showReauth: false,
    });
  });

  test("an unknown failure shows the fallback without the re-auth button", () => {
    expect(deleteCardView({ ...base, errorCode: "" }).error).toEqual({
      message: DELETE_FALLBACK_MESSAGE,
      showReauth: false,
    });
    expect(deleteCardView({ ...base, errorCode: UNKNOWN_FAILURE_CODE }).error?.showReauth).toBe(
      false,
    );
  });
});

describe("errorCodeOf", () => {
  test("is null on success and the server code on failure", () => {
    expect(errorCodeOf({ ok: true })).toBeNull();
    expect(errorCodeOf({ ok: false, code: "REAUTH_REQUIRED" })).toBe("REAUTH_REQUIRED");
  });

  test("a failure without a code maps to the unknown-failure code", () => {
    expect(errorCodeOf({ ok: false })).toBe(UNKNOWN_FAILURE_CODE);
  });
});

describe("initialFocusTarget", () => {
  test("focuses the username input only when returning from re-auth", () => {
    expect(initialFocusTarget(true)).toBe("username-input");
    expect(initialFocusTarget(false)).toBeNull();
  });
});
