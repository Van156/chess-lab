import { buttonVariants } from "@b2c-template/ui/components/button";
import { Card } from "@b2c-template/ui/components/card";
import { cn } from "@b2c-template/ui/lib/utils";
import { Link } from "@tanstack/react-router";

import {
  describeAnalysis,
  describeFormat,
  formatPlayedDate,
  gameOutcome,
  hasMistakesToShow,
  type AnalysisTone,
} from "../lib/game-format";
import type { GameItem } from "../lib/games-types";

const TONE_CLASS: Record<AnalysisTone, string> = {
  neutral: "text-muted-foreground",
  progress: "text-muted-foreground",
  success: "text-success",
  error: "text-destructive",
};

const SIDE_LABEL = { white: "White", black: "Black" } as const;

/**
 * One imported game: outcome, how it was played and its analysis status. The status is text, so it
 * never relies on colour alone. `showMistakesLink` is off while the mistakes pillar is off.
 */
export default function GameRow({
  game,
  showMistakesLink,
}: {
  game: GameItem;
  showMistakesLink: boolean;
}) {
  const analysis = describeAnalysis(game.analysisStatus);
  return (
    <Card className="flex flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold">
          {gameOutcome(game)} <span className="font-normal">as {SIDE_LABEL[game.userColor]}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {describeFormat(game)}
          {game.openingName ? `, ${game.openingName}` : ""}
          {" · "}
          <time dateTime={game.playedAt.toISOString()}>{formatPlayedDate(game.playedAt)}</time>
        </p>
        <p className={cn("text-sm", TONE_CLASS[analysis.tone])}>
          <span className="sr-only">Analysis: </span>
          {analysis.label}
        </p>
      </div>
      {showMistakesLink && hasMistakesToShow(game.analysisStatus) ? (
        <Link
          to="/mistakes"
          search={{ gameId: game.id }}
          className={cn(buttonVariants({ variant: "outline" }), "h-11 min-w-11 px-4")}
        >
          View mistakes
          <span className="sr-only"> from the game on {formatPlayedDate(game.playedAt)}</span>
        </Link>
      ) : null}
    </Card>
  );
}
