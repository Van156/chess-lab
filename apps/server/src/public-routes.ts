import type { FeatureFlags } from "@b2c-template/api/features";
import { listEnabledSocialProviders } from "@b2c-template/auth/social-providers";
import type { SocialProviderEnv } from "@b2c-template/auth/social-providers";
import { Hono } from "hono";

/** Public routes (`/api/public`). Enabled providers: ids only, derived from the credentials `createAuth` uses (spec §6.3, decision 17). */
export function createPublicRoutes(env: SocialProviderEnv, features: FeatureFlags) {
  const routes = new Hono();
  routes.get("/auth-providers", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ providers: listEnabledSocialProviders(env) });
  });
  // ADR-17: the web reads the flags here (nav items, route guards, sign-up UI); enforcement stays on
  // the server through `featureProcedure`. Never cached, so a flag change shows on the next load.
  routes.get("/features", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(features);
  });
  return routes;
}
