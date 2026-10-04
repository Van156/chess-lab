import type { CardPillar } from "@b2c-template/db/card-pillar";

/** Pillars that can be switched off per deployment (ADR-17). */
export const PILLAR_FLAGS = ["mistakes", "repertoire", "blindfold", "progress"] as const;
export type PillarFlag = (typeof PILLAR_FLAGS)[number];

/** Server-owned feature flags, parsed once from `CHESSLAB_FEATURES` and served to the web. */
export type FeatureFlags = Record<PillarFlag, boolean> & {
  /** Email sign-up UI beside Lichess (PRD open question); off by default. */
  emailSignUp: boolean;
};

const DEFAULT_ENABLED: readonly (PillarFlag | "emailSignUp")[] = ["mistakes"];

/**
 * Parses `CHESSLAB_FEATURES`, a comma list of `mistakes,repertoire,blindfold,progress,emailSignUp`.
 * Unset or blank means `mistakes` only; an explicit list replaces that default. Tokens are
 * trimmed and case-insensitive; unknown tokens are ignored so a typo never breaks startup.
 */
export function parseFeatureFlags(env: { CHESSLAB_FEATURES?: string | undefined }): FeatureFlags {
  const raw = env.CHESSLAB_FEATURES?.trim() ?? "";
  const tokens =
    raw === ""
      ? new Set<string>(DEFAULT_ENABLED.map((name) => name.toLowerCase()))
      : new Set(
          raw
            .split(",")
            .map((token) => token.trim().toLowerCase())
            .filter((token) => token !== ""),
        );
  return {
    mistakes: tokens.has("mistakes"),
    repertoire: tokens.has("repertoire"),
    blindfold: tokens.has("blindfold"),
    progress: tokens.has("progress"),
    emailSignUp: tokens.has("emailsignup"),
  };
}

/** Card pillars (the ones `review.queue` can serve) whose flag is on. */
export function enabledCardPillars(flags: FeatureFlags): CardPillar[] {
  const pillars: CardPillar[] = ["mistakes"];
  return pillars.filter((pillar) => flags[pillar]);
}
