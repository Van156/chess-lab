import { describe, expect, test } from "bun:test";

import { listEnabledSocialProviders, resolveGoogleCredentials } from "./social-providers";

describe("resolveGoogleCredentials (R5.1)", () => {
  test("returns the credentials when both values are set", () => {
    expect(
      resolveGoogleCredentials({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }),
    ).toEqual({ clientId: "id", clientSecret: "secret" });
  });

  test("returns null when neither is set (unset or empty)", () => {
    expect(resolveGoogleCredentials({})).toBeNull();
    expect(resolveGoogleCredentials({ GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" })).toBeNull();
  });

  test("throws naming the missing secret when only the id is set", () => {
    expect(() => resolveGoogleCredentials({ GOOGLE_CLIENT_ID: "id" })).toThrow(
      /GOOGLE_CLIENT_SECRET/,
    );
  });

  test("throws naming the missing id when only the secret is set", () => {
    expect(() => resolveGoogleCredentials({ GOOGLE_CLIENT_SECRET: "secret" })).toThrow(
      /GOOGLE_CLIENT_ID/,
    );
  });
});

describe("listEnabledSocialProviders", () => {
  test("lists ids only, never credentials", () => {
    const providers = listEnabledSocialProviders({
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
    });
    expect(providers).toEqual(["google"]);
    expect(JSON.stringify(providers)).not.toContain("secret");
  });

  test("is empty when nothing is configured", () => {
    expect(listEnabledSocialProviders({})).toEqual([]);
  });

  test("propagates the half-configured startup error", () => {
    expect(() => listEnabledSocialProviders({ GOOGLE_CLIENT_ID: "id" })).toThrow(
      /GOOGLE_CLIENT_SECRET/,
    );
  });
});

describe("lichess provider listing (S3.8)", () => {
  test("includes lichess when LICHESS_CLIENT_ID is set", () => {
    expect(listEnabledSocialProviders({ LICHESS_CLIENT_ID: "chess-lab" })).toEqual(["lichess"]);
  });

  test("lists google then lichess when both are configured", () => {
    expect(
      listEnabledSocialProviders({
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        LICHESS_CLIENT_ID: "chess-lab",
      }),
    ).toEqual(["google", "lichess"]);
  });

  test("omits lichess when LICHESS_CLIENT_ID is unset or empty", () => {
    expect(listEnabledSocialProviders({ LICHESS_CLIENT_ID: "" })).toEqual([]);
    expect(listEnabledSocialProviders({})).toEqual([]);
  });
});
