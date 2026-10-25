import type { DrillInfo } from "../lib/drill-catalog";
import { sessionSummary } from "../lib/drill-session";
import { useDrillPlayer } from "../hooks/use-drill-player";
import BlindfoldDrills from "./blindfold-drills";
import DrillPlayer from "./drill-player";
import DrillResults from "./drill-results";

/** Drills tab (container): shows the picker, the running drill or its results. */
export default function BlindfoldDrillsPanel({ drills }: { drills: readonly DrillInfo[] }) {
  const player = useDrillPlayer();
  const { session } = player;

  if (!session) {
    return <BlindfoldDrills drills={drills} onStart={player.start} />;
  }
  const label = drills.find((drill) => drill.kind === session.kind)?.label ?? session.kind;

  if (session.phase === "finished") {
    return (
      <DrillResults
        label={label}
        summary={sessionSummary(session)}
        onPlayAgain={() => player.start(session.kind, session.level)}
        onBack={player.quit}
      />
    );
  }
  return (
    <DrillPlayer
      label={label}
      session={session}
      elapsedMs={player.elapsed}
      onAnswer={player.answer}
      onNext={player.next}
      onQuit={player.quit}
    />
  );
}
