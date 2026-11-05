import { useBlindfoldStats } from "../hooks/use-blindfold-stats";
import { useBlindfoldSummary } from "../hooks/use-blindfold-summary";
import { useDrillPlayer } from "../hooks/use-drill-player";
import { useSaveSession } from "../hooks/use-save-session";
import type { DrillInfo } from "../lib/drill-catalog";
import { sessionSummary } from "../lib/drill-session";
import { dayKey } from "../lib/practice-summary";
import { suggestDrill, type DrillRecency } from "../lib/suggest-drill";
import BlindfoldDrills, { DEFAULT_LEVEL } from "./blindfold-drills";
import BlindfoldHero from "./blindfold-hero";
import BlindfoldProgress from "./blindfold-progress";
import DrillPlayer from "./drill-player";
import DrillResults from "./drill-results";

/**
 * Drills tab (container): the hero and picker with progress, the running drill, or its saved
 * results. The hero's suggestion is the drill played least recently.
 */
export default function BlindfoldDrillsPanel({ drills }: { drills: readonly DrillInfo[] }) {
  const saver = useSaveSession();
  const player = useDrillPlayer({ onFinish: saver.save });
  const stats = useBlindfoldStats();
  const summary = useBlindfoldSummary();
  const { session } = player;

  if (!session) {
    const recency: readonly DrillRecency[] = stats.data ?? [];
    const suggested = suggestDrill(drills, recency);
    return (
      <div className="flex flex-col gap-10">
        <BlindfoldHero
          summary={summary.data}
          pending={summary.isPending}
          suggestion={
            suggested
              ? {
                  drill: suggested,
                  lastPlayedAt: recency.find((entry) => entry.drill === suggested.kind)
                    ?.lastPlayedAt,
                }
              : null
          }
          today={dayKey(new Date())}
          onStart={() => suggested && player.start(suggested.kind, DEFAULT_LEVEL)}
        />
        <BlindfoldDrills
          drills={drills}
          stats={stats.data}
          suggestedKind={suggested?.kind}
          onStart={player.start}
        />
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
