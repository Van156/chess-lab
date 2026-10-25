import { useDrillPlayer } from "../hooks/use-drill-player";
import { useSaveSession } from "../hooks/use-save-session";
import type { DrillInfo } from "../lib/drill-catalog";
import { sessionSummary } from "../lib/drill-session";
import BlindfoldDrills from "./blindfold-drills";
import BlindfoldProgress from "./blindfold-progress";
import DrillPlayer from "./drill-player";
import DrillResults from "./drill-results";

/** Drills tab (container): the picker with progress, the running drill, or its saved results. */
export default function BlindfoldDrillsPanel({ drills }: { drills: readonly DrillInfo[] }) {
  const saver = useSaveSession();
  const player = useDrillPlayer({ onFinish: saver.save });
  const { session } = player;

  if (!session) {
    return (
      <div className="flex flex-col gap-8">
        <BlindfoldDrills drills={drills} onStart={player.start} />
        <BlindfoldProgress drills={drills} />
      </div>
    );
  }
  const label = drills.find((drill) => drill.kind === session.kind)?.label ?? session.kind;

  if (session.phase === "finished") {
    return (
      <DrillResults
        label={label}
        summary={sessionSummary(session)}
        saveStatus={saver.status}
        onRetrySave={saver.retry}
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
