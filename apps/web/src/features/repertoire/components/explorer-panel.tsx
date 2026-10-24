import { Badge } from "@b2c-template/ui/components/badge";
import { Skeleton } from "@b2c-template/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@b2c-template/ui/components/table";
import type { ReactNode } from "react";

import {
  STALE_NOTE,
  bandLabel,
  formatGames,
  inRepertoire,
  shareOf,
  unavailableText,
} from "../lib/explorer-view";
import type { ExplorerPanelState } from "../lib/explorer-state";
import type { ExplorerMove } from "../lib/repertoire-types";

export type { ExplorerPanelState };

export type ExplorerPanelProps = {
  state: ExplorerPanelState;
  /** Moves already in the repertoire from the current position; matched by SAN. */
  childMoves: readonly { san: string }[];
  /** Extra controls next to the band label, such as a band select. */
  bandControl?: ReactNode;
  /** An extra cell per explorer move, such as an Add button; adds a column when given. */
  moveAction?: (move: ExplorerMove) => ReactNode;
};

const EMPTY_TEXT = "No games recorded in this position for this rating band.";

/** Stacked White / draws / Black bar. Decorative: the same numbers are in the table as text. */
function ShareBar({ move }: { move: ExplorerMove }) {
  const share = shareOf(move);
  return (
    <div aria-hidden="true" className="mt-1 flex h-2 w-full overflow-hidden rounded-full border">
      <div className="bg-white" style={{ width: `${share.white}%` }} />
      <div className="bg-muted-foreground/50" style={{ width: `${share.draws}%` }} />
      <div className="bg-foreground" style={{ width: `${share.black}%` }} />
    </div>
  );
}

/**
 * Opening explorer for the current position (presentational): the rating band in use, the moves
 * Lichess players chose with their results as text, and a note when the stats are saved, empty or
 * unavailable. The builder works whatever state this shows.
 */
export default function ExplorerPanel({
  state,
  childMoves,
  bandControl,
  moveAction,
}: ExplorerPanelProps) {
  const data = state.kind === "loaded" ? state.data : null;
  const result = data?.result;
  return (
    <section
      data-slot="explorer-panel"
      aria-labelledby="explorer-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="explorer-heading" className="text-xl font-semibold">
        Explorer
      </h2>
      {data ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <p data-slot="explorer-band">
            Rating band {bandLabel(data.band)} · {data.speeds.join(", ")}
          </p>
          {bandControl}
        </div>
      ) : null}
      {state.kind === "loading" ? (
        <div role="status" aria-label="Loading explorer stats" className="flex flex-col gap-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      ) : null}
      {state.kind === "failed" || result?.status === "unavailable" ? (
        <p role="status" data-slot="explorer-unavailable" className="text-sm">
          {unavailableText(result?.status === "unavailable" ? result.reason : "error")}
        </p>
      ) : null}
      {result?.status === "ok" ? (
        <>
          {result.opening ? (
            <p data-slot="explorer-opening" className="text-sm font-medium">
              {result.opening.eco} {result.opening.name}
            </p>
          ) : null}
          {result.stale ? (
            <p data-slot="explorer-stale" className="text-sm text-muted-foreground">
              {STALE_NOTE}
            </p>
          ) : null}
          {result.moves.length === 0 ? (
            <p data-slot="explorer-empty" className="text-sm">
              {EMPTY_TEXT}
            </p>
          ) : (
            <Table>
              <TableCaption className="sr-only">
                Moves played from this position, with game counts and results as percentages.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Move</TableHead>
                  <TableHead scope="col" className="text-right">
                    Games
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    White
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Draws
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Black
                  </TableHead>
                  {moveAction ? (
                    <TableHead scope="col">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.moves.map((move) => {
                  const share = shareOf(move);
                  return (
                    <TableRow key={move.uci}>
                      <TableCell className="min-w-24">
                        <span className="font-mono font-medium">{move.san}</span>
                        {inRepertoire(move.san, childMoves) ? (
                          <Badge variant="secondary" className="ml-2">
                            In repertoire
                          </Badge>
                        ) : null}
                        <ShareBar move={move} />
                      </TableCell>
                      <TableCell className="text-right">{formatGames(move.games)}</TableCell>
                      <TableCell className="text-right">{share.white}%</TableCell>
                      <TableCell className="text-right">{share.draws}%</TableCell>
                      <TableCell className="text-right">{share.black}%</TableCell>
                      {moveAction ? <TableCell>{moveAction(move)}</TableCell> : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      ) : null}
    </section>
  );
}
