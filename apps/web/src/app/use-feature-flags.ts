import { useQuery } from "@tanstack/react-query";

import { ENV } from "@/env.public";

import { NO_FEATURES, fetchFeatureFlags, type FeatureFlags } from "./feature-flags";

/** Flags are cheap and `no-store` on the server; a short stale window picks up a toggle quickly. */
const FEATURES_STALE_MS = 60 * 1000;

/** Server-owned feature flags (ADR-17); every flag is off while loading or failing. */
export function useFeatureFlags(): FeatureFlags {
  const query = useQuery({
    queryKey: ["public-features"],
    queryFn: () => fetchFeatureFlags(ENV.VITE_SERVER_URL),
    staleTime: FEATURES_STALE_MS,
    retry: 2,
  });
  return query.data ?? NO_FEATURES;
}
