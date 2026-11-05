export type MoveSequenceProps = {
  /** SAN moves from the initial position, White first. */
  moves: readonly string[];
};

/** The moves as a numbered score: one row per move pair, numbers right-aligned. */
export default function MoveSequence({ moves }: MoveSequenceProps) {
  const pairs = Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => ({
    number: index + 1,
    white: moves[index * 2] ?? "",
    black: moves[index * 2 + 1],
  }));
  return (
    <ol
      aria-label={`${moves.length} ${moves.length === 1 ? "move" : "moves"} from the start position`}
      className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-1 rounded-2xl border bg-card p-3 font-mono text-base sm:p-4"
    >
      {pairs.map(({ number, white, black }) => (
        <li
          key={number}
          className="grid grid-cols-[1.75rem_1fr_1fr] items-baseline gap-2 rounded-md px-1 py-1"
        >
          <span className="text-right text-sm text-muted-foreground tabular-nums">{number}.</span>
          <span>{white}</span>
          <span>{black ?? ""}</span>
        </li>
      ))}
    </ol>
  );
}
