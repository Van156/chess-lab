import { buttonVariants } from "@b2c-template/ui/components/button";
import { Card } from "@b2c-template/ui/components/card";
import { cn } from "@b2c-template/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { ChessBoard, MoveList } from "@/shared/components/board";
import PageHeader from "@/shared/components/layout/page-header";

import {
  arrowDescription,
  BEST_ARROW_NAME,
  formatClock,
  formatEval,
  lichessGameUrl,
  moveArrows,
  moveLabel,
  pawns,
  phaseLabel,
  PLAYED_ARROW_COLOR,
  PLAYED_ARROW_NAME,
  severityLabel,
} from "../lib/mistake-format";
import type { MistakeDetail } from "../lib/mistakes-types";

const SIDE_LABEL = { white: "White", black: "Black" } as const;

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

/**
 * Mistake detail (presentational): the board before the move with the played and best moves as
 * arrows, the same facts as text, the game's move list and links to the game. The board is not
 * interactive; `moves` comes from the game's PGN (empty when it cannot be read).
 */
export default function MistakeDetailView({
  mistake,
  moves,
}: {
  mistake: MistakeDetail;
  moves: readonly string[];
}) {
  const side = SIDE_LABEL[mistake.game.userColor];
  const clock = formatClock(mistake.clockLeftMs);
  const played = moveLabel(mistake.ply, mistake.playedSan);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title={`${severityLabel(mistake.severity)} at move ${played}`}
        breadcrumbs={[{ label: "Mistakes", to: "/mistakes" }, { label: "Detail" }]}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-3 rounded-2xl p-4">
          <ChessBoard
            fen={mistake.fenBefore}
            orientation={mistake.game.userColor}
            arrows={moveArrows(mistake)}
            label={`Chess position before your move. ${side} to move. ${arrowDescription(mistake)}`}
          />
          <p className="flex flex-wrap gap-x-4 text-sm">
            <span>
              <span aria-hidden style={{ color: PLAYED_ARROW_COLOR }}>
                {"→"}
              </span>{" "}
              {PLAYED_ARROW_NAME} arrow: you played {mistake.playedSan}
            </span>
            <span>
              <span aria-hidden className="text-primary">
                {"→"}
              </span>{" "}
              {BEST_ARROW_NAME} arrow: best move {mistake.bestSan}
            </span>
          </p>
        </Card>

        <Card className="flex flex-col gap-4 rounded-2xl p-4 md:p-6">
          <h2 className="text-xl font-semibold">Played versus best</h2>
          <dl className="flex flex-col gap-2">
            <Fact term="You played">
              <span className="font-mono">{played}</span>
            </Fact>
            <Fact term="Best move">
              <span className="font-mono">{mistake.bestSan}</span>
            </Fact>
            <Fact term="Evaluation before">{formatEval(mistake.evalBeforeCp)}</Fact>
            <Fact term="Evaluation after">{formatEval(mistake.evalAfterCp)}</Fact>
            <Fact term="Lost">{pawns(mistake.evalLossCp)} pawns</Fact>
            <Fact term="Phase">{phaseLabel(mistake.phase)}</Fact>
            {mistake.openingName ? <Fact term="Opening">{mistake.openingName}</Fact> : null}
            {clock ? <Fact term="Clock left">{clock}</Fact> : null}
          </dl>
          <p className="text-xs text-muted-foreground">
            Evaluations are in pawns from your side; positive is better for you.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/mistakes"
              search={{ gameId: mistake.game.id }}
              className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
            >
              More mistakes from this game
            </Link>
            <a
              href={lichessGameUrl(mistake.game)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
            >
              View game on Lichess
              <ExternalLink aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-3 rounded-2xl p-4 md:p-6">
        <h2 className="text-lg font-semibold">Game moves</h2>
        <MoveList moves={moves} currentPly={mistake.ply - 1} />
      </Card>
    </div>
  );
}
