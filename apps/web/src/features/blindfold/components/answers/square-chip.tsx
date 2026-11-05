import { cn } from "@b2c-template/ui/lib/utils";

/** A square name as a large mono chip, the way the geometry drills present squares. */
export default function SquareChip({ square, className }: { square: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-16 min-w-20 items-center justify-center rounded-xl border bg-card px-4 font-mono text-4xl font-medium tracking-tight sm:h-20 sm:min-w-24 sm:text-5xl",
        className,
      )}
    >
      {square}
    </span>
  );
}
