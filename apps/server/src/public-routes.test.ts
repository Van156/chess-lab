import { describe, expect, test } from "bun:test";

import { parseFeatureFlags } from "@b2c-template/api/features";

import { createPublicRoutes } from "./public-routes";

describe("GET /auth-providers", () => {
  test("returns provider ids only, never credentials", async () => {
    const routes = createPublicRoutes(
      {
        GOOGLE_CLIENT_ID: "client-id-value",
        GOOGLE_CLIENT_SECRET: "client-secret-value",
      },
      parseFeatureFlags({}),
    );
    const response = await routes.request("/auth-providers");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ providers: ["google"] });
    expect(text).not.toContain("client-id-value");
    expect(text).not.toContain("client-secret-value");
  });

  test("returns an empty list when no provider is configured", async () => {
    const response = await createPublicRoutes({}, parseFeatureFlags({})).request("/auth-providers");
    expect(await response.json()).toEqual({ providers: [] });
  });
});

describe("GET /features", () => {
  test("serves the parsed flags with no-store", async () => {
    const features = parseFeatureFlags({ CHESSLAB_FEATURES: "mistakes,blindfold" });
    const response = await createPublicRoutes({}, features).request("/features");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      mistakes: true,
      repertoire: false,
      blindfold: true,
      progress: false,
      emailSignUp: false,
    });
  });

  test("defaults to mistakes only", async () => {
    const response = await createPublicRoutes({}, parseFeatureFlags({})).request("/features");
    expect(await response.json()).toMatchObject({ mistakes: true, blindfold: false });
  });
});
