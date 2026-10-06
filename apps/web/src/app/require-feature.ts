import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { isFeatureEnabled, type PillarFlag } from "./feature-flags";
import { featureFlagsQueryOptions } from "./use-feature-flags";

/**
 * `beforeLoad` guard for a pillar's routes (ADR-17): sends the user to Today when the flag is off
 * or cannot be read. UX only; the pillar's procedures enforce the flag on the server.
 *
 * The guard fails fast: it overrides the shared query's retries, so a flag outage redirects on the
 * first failure instead of holding the navigation through the backoff. The retrying query stays
 * the one the UI hooks use. `options` is injectable for tests.
 */
export async function requireFeature(
  queryClient: QueryClient,
  flag: PillarFlag,
  options: typeof featureFlagsQueryOptions = featureFlagsQueryOptions,
): Promise<void> {
  const enabled = await isFeatureEnabled(
    () => queryClient.ensureQueryData({ ...options, retry: false }),
    flag,
  );
  if (!enabled) {
    throw redirect({ to: "/today", replace: true });
  }
}
