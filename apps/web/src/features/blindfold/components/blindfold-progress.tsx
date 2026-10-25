import LoadError from "@/shared/components/feedback/load-error";
import Loader from "@/shared/components/feedback/loader";

import { useBlindfoldStats } from "../hooks/use-blindfold-stats";
import type { DrillInfo } from "../lib/drill-catalog";
import DrillProgress from "./drill-progress";

/** Progress panel (container): reads `blindfold.stats` and renders it, with load and error states. */
export default function BlindfoldProgress({ drills }: { drills: readonly DrillInfo[] }) {
  const stats = useBlindfoldStats();
  if (stats.isPending) return <Loader />;
  if (!stats.data) {
    return <LoadError message="Your progress could not be loaded." onRetry={stats.retry} />;
  }
  return <DrillProgress drills={drills} stats={stats.data} />;
}
