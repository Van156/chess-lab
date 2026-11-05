import { describe, expect, test } from "bun:test";

import {
  accountFlows,
  deleteErrorMessage,
  DELETE_FALLBACK_MESSAGE,
  isSyntheticEmail,
  LICHESS_DELETE_ERROR_CODES,
  lichessUsernameFromEmail,
  parseDangerSearch,
  reauthCallbackUrl,
  usernameMatches,
} from "./lichess-account";

describe("isSyntheticEmail", () => {
  test("detects the reserved domain regardless of case and spaces", () => {
    expect(isSyntheticEmail("magnus@lichess.invalid")).toBe(true);
    expect(isSyntheticEmail("  Magnus@LICHESS.INVALID ")).toBe(true);
  });

  test("rejects real, look-alike and malformed addresses", () => {
    expect(isSyntheticEmail("ada@example.com")).toBe(false);
    expect(isSyntheticEmail("ada@lichess.invalid.example.com")).toBe(false);
    expect(isSyntheticEmail("@lichess.invalid")).toBe(false);
    expect(isSyntheticEmail("lichess.invalid")).toBe(false);
  });
});

describe("accountFlows", () => {
  test("synthetic-email users only get the typed-username deletion", () => {
    expect(accountFlows("magnus@lichess.invalid")).toEqual({
      changeEmail: false,
      password: false,
      emailedDeletion: false,
      typedUsernameDeletion: true,
    });
  });

  test("real-email users keep email, password and emailed deletion", () => {
    expect(accountFlows("ada@example.com")).toEqual({
      changeEmail: true,
      password: true,
      emailedDeletion: true,
      typedUsernameDeletion: false,
    });
  });
});

describe("lichessUsernameFromEmail", () => {
  test("returns the local part for synthetic emails", () => {
    expect(lichessUsernameFromEmail("magnus@lichess.invalid")).toBe("magnus");
  });

  test("returns null for real emails", () => {
    expect(lichessUsernameFromEmail("ada@example.com")).toBeNull();
  });
});

describe("usernameMatches", () => {
  test("ignores case and surrounding whitespace", () => {
    expect(usernameMatches("  MagNus ", "magnus")).toBe(true);
  });

  test("rejects other names and empty input", () => {
    expect(usernameMatches("magnu", "magnus")).toBe(false);
    expect(usernameMatches("   ", "magnus")).toBe(false);
    expect(usernameMatches("", "")).toBe(false);
  });
});

describe("deleteErrorMessage", () => {
  test("maps every server code to its own message", () => {
    const codes = Object.values(LICHESS_DELETE_ERROR_CODES);
    const messages = codes.map((code) => deleteErrorMessage(code));
    expect(codes).toHaveLength(4);
    expect(new Set(messages).size).toBe(codes.length);
    expect(messages).not.toContain(DELETE_FALLBACK_MESSAGE);
  });

  test("falls back for unknown or missing codes, including inherited object keys", () => {
    expect(deleteErrorMessage("SOMETHING_ELSE")).toBe(DELETE_FALLBACK_MESSAGE);
    expect(deleteErrorMessage("toString")).toBe(DELETE_FALLBACK_MESSAGE);
    expect(deleteErrorMessage("")).toBe(DELETE_FALLBACK_MESSAGE);
    expect(deleteErrorMessage(undefined)).toBe(DELETE_FALLBACK_MESSAGE);
  });

  test("the fallback never claims the account is intact or deleted", () => {
    expect(DELETE_FALLBACK_MESSAGE).toContain("could not confirm");
    expect(DELETE_FALLBACK_MESSAGE).toContain("Reload");
    expect(DELETE_FALLBACK_MESSAGE).not.toMatch(/^Could not delete/);
    expect(DELETE_FALLBACK_MESSAGE).not.toMatch(/nothing was deleted\.?$/i);
  });
});

describe("re-auth round trip", () => {
  test("builds the absolute callback URL", () => {
    expect(reauthCallbackUrl("https://chess.example")).toBe(
      "https://chess.example/account/danger?confirm=1",
    );
  });

  test("parseDangerSearch recognises the confirm param as parsed by the router", () => {
    expect(parseDangerSearch({ confirm: 1 })).toEqual({ confirm: true });
    expect(parseDangerSearch({ confirm: "1" })).toEqual({ confirm: true });
  });

  test("parseDangerSearch treats absent or junk values as not requested", () => {
    expect(parseDangerSearch({})).toEqual({ confirm: false });
    expect(parseDangerSearch({ confirm: "0" })).toEqual({ confirm: false });
    expect(parseDangerSearch({ confirm: 2 })).toEqual({ confirm: false });
    expect(parseDangerSearch({ confirm: ["1"] })).toEqual({ confirm: false });
  });
});
