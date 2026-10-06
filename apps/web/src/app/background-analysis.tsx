import { AnalysisStatus } from "@/features/engine";

import { useFeatureFlags } from "./use-feature-flags";

/**
 * Starts the background game analysis (ADR-12) and shows its status, once the `mistakes` flag is
 * known to be on (the analysis procedures sit behind it). Analysis starts on mount, so a screen
 * must render this at most once; routes that offer it (Today, Games) are siblings, so only one is
 * mounted at a time and the previous run stops in its unmount cleanup before the next one starts.
 */
export default function BackgroundAnalysis() {
  const { mistakes } = useFeatureFlags();
  return mistakes ? <AnalysisStatus /> : null;
}
