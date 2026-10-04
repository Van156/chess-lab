import type { FeatureFlags, PillarFlag } from "@b2c-template/api/features";

export type { FeatureFlags, PillarFlag };

/** Path of the server's public feature-flags endpoint (ADR-17). */
export const FEATURES_PATH = "/api/public/features";

/** What the UI assumes until the server answers: every pillar and the email sign-up are hidden. */
export const NO_FEATURES: FeatureFlags = {
  mistakes: false,
  repertoire: false,
  blindfold: false,
  progress: false,
  emailSignUp: false,
};

const FLAG_NAMES = Object.keys(NO_FEATURES) as (keyof FeatureFlags)[];

/** Validates the response body; `null` when it is not a complete object of booleans. */
export function readFeatureFlags(body: unknown): FeatureFlags | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const source = body as Record<string, unknown>;
  if (!FLAG_NAMES.every((name) => typeof source[name] === "boolean")) {
    return null;
  }
  return Object.fromEntries(FLAG_NAMES.map((name) => [name, source[name]])) as FeatureFlags;
}

/**
 * Fetches the flags. Any failure (network, non-2xx, invalid JSON, malformed body) rejects, so the
 * query retries and never caches a failure as "everything off"; the UI keeps `NO_FEATURES` meanwhile.
 */
export async function fetchFeatureFlags(
  serverUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FeatureFlags> {
  const response = await fetchImpl(new URL(FEATURES_PATH, serverUrl));
  if (!response.ok) {
    throw new Error(`Feature flags request failed with status ${response.status}`);
  }
  const flags = readFeatureFlags(await response.json());
  if (!flags) {
    throw new Error("Feature flags response was malformed");
  }
  return flags;
}
