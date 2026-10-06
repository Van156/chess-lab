import { useGameAnalysis } from "../hooks/use-game-analysis";
import AnalysisStatusView from "./analysis-status-view";

/** Container: runs the background analysis and shows its status. Mount it once per screen. */
export default function AnalysisStatus() {
  const { status, resume } = useGameAnalysis();
  return <AnalysisStatusView status={status} onResume={resume} />;
}
