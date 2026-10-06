import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { isFeatureEnabled, type PillarFlag } from "./feature-flags";
import { featureFlagsQueryOptions } from "./use-feature-flags";

/**
 * `beforeLoad` guard for a pillar's routes (ADR-17): sends the user to Today when the flag is off
 * or cannot be read. UX only; the pillar's procedures enforce the flag on the server.
 */
export async function requireFeature(queryClient: QueryClient, flag: PillarFlag): Promise<void> {
  const enabled = await isFeatureEnabled(
    () => queryClient.ensureQueryData(featureFlagsQueryOptions),
    flag,
  );
  if (!enabled) {
    throw redirect({ to: "/today", replace: true });
  }
}
