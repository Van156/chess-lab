import { cn } from "@b2c-template/ui/lib/utils";

export type MoveListProps = {
  /** SAN moves in play order; index 0 is White's first move. */
  moves: readonly string[];
  /** Number of plies played in the position shown; 0 is the starting position. */
  currentPly: number;
  /** When given, each move becomes a button that selects the position after that ply (1-based). */
  onSelect?: (ply: number) => void;
};

type FullMove = { number: number; white: string; black?: string };

function toFullMoves(moves: readonly string[]): FullMove[] {
  const rows: FullMove[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const white = moves[i];
    if (white === undefined) continue;
    rows.push({ number: i / 2 + 1, white, black: moves[i + 1] });
  }
  return rows;
}

/** An out-of-range or non-numeric ply must not mislabel the live region or the highlight. */
function clampPly(ply: number, total: number): number {
  if (!Number.isFinite(ply)) return 0;
  return Math.min(Math.max(Math.trunc(ply), 0), total);
}

function describeCurrent(moves: readonly string[], currentPly: number): string {
  const san = moves[currentPly - 1];
  if (san === undefined) return "Starting position";
  const number = Math.ceil(currentPly / 2);
  return `Current move: ${number}${currentPly % 2 === 0 ? "..." : "."} ${san}`;
}

const moveClass = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2";

function Ply({
  ply,
  san,
  current,
  onSelect,
}: {
  ply: number;
  san: string;
  current: boolean;
  onSelect: ((ply: number) => void) | undefined;
}) {
  const className = cn(moveClass, current && "bg-accent font-semibold text-accent-foreground");
  const ariaCurrent = current ? "step" : undefined;
  if (!onSelect) {
    return (
      <span className={className} aria-current={ariaCurrent}>
        {san}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cn(className, "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50")}
      aria-current={ariaCurrent}
      onClick={() => onSelect(ply)}
    >
      {san}
    </button>
  );
}

/** Text move list of the game so far; every board shows one for assistive technology. */
export default function MoveList({ moves, currentPly: rawPly, onSelect }: MoveListProps) {
  const currentPly = clampPly(rawPly, moves.length);
  const rows = toFullMoves(moves);
  return (
    <div data-slot="move-list" className="flex flex-col gap-1">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No moves yet</p>
      ) : (
        <ol aria-label="Moves" className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {rows.map((row) => (
            <li key={row.number} className="flex items-center">
              <span className="text-muted-foreground tabular-nums">{row.number}.</span>
              <Ply
                ply={row.number * 2 - 1}
                san={row.white}
                current={currentPly === row.number * 2 - 1}
                onSelect={onSelect}
              />
              {row.black !== undefined && (
                <Ply
                  ply={row.number * 2}
                  san={row.black}
                  current={currentPly === row.number * 2}
                  onSelect={onSelect}
                />
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="sr-only" aria-live="polite">
        {describeCurrent(moves, currentPly)}
      </p>
    </div>
  );
}
