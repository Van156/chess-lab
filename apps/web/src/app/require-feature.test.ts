import { describe, expect, test } from "bun:test";
import { QueryClient, queryOptions } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";

import { NO_FEATURES, type FeatureFlags } from "./feature-flags";
import { requireFeature } from "./require-feature";

const flagsOptions = (queryFn: () => Promise<FeatureFlags>) =>
  queryOptions({
    queryKey: ["public-features"],
    queryFn,
    staleTime: 60_000,
    // The shared options retry; the guard must not wait for those retries.
    retry: 2,
    retryDelay: 5_000,
  });

const settle = (promise: Promise<unknown>) =>
  promise.then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error }),
  );

describe("requireFeature", () => {
  test("resolves when the flag is on", async () => {
    const client = new QueryClient();
    const options = flagsOptions(async () => ({ ...NO_FEATURES, mistakes: true }));
    await requireFeature(client, "mistakes", options);
  });

  test("redirects to /today when the flag is off", async () => {
    const client = new QueryClient();
    const outcome = await settle(
      requireFeature(
        client,
        "mistakes",
        flagsOptions(async () => NO_FEATURES),
      ),
    );
    expect(!outcome.ok && isRedirect(outcome.error)).toBe(true);
    expect(!outcome.ok && isRedirect(outcome.error) && outcome.error.options.to).toBe("/today");
  });

  test("redirects at once when the flags cannot be loaded, without waiting for query retries", async () => {
    const client = new QueryClient();
    let calls = 0;
    const started = Date.now();
    const outcome = await settle(
      requireFeature(
        client,
        "mistakes",
        flagsOptions(async () => {
          calls += 1;
          throw new Error("outage");
        }),
      ),
    );
    expect(!outcome.ok && isRedirect(outcome.error)).toBe(true);
    expect(calls).toBe(1);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  test("a cached answer is used without another request", async () => {
    const client = new QueryClient();
    let calls = 0;
    const options = flagsOptions(async () => {
      calls += 1;
      return { ...NO_FEATURES, mistakes: true };
    });
    await requireFeature(client, "mistakes", options);
    await requireFeature(client, "mistakes", options);
    expect(calls).toBe(1);
  });
});
