import { cn } from "@b2c-template/ui/lib/utils";
import { Fragment } from "react";

export type ChipTone = "neutral" | "success" | "destructive";

const TONES: Record<ChipTone, string> = {
  neutral: "border-border bg-muted text-foreground",
  success: "border-primary/40 bg-primary/10 text-primary",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive line-through",
};

/** A square (or a move) set in mono on a small chip, e.g. e4. */
export function SquareChip({
  children,
  tone = "neutral",
  className,
}: {
  children: string;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-[0.35em] py-[0.05em] font-mono leading-tight font-medium tabular-nums",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Squares like e4 and square ranges like a1-h8, kept whole. */
const SQUARE_PATTERN = /\b([a-h][1-8](?:-[a-h][1-8])?)\b/g;

/** Splits text into plain runs and squares; squares come out at odd indices. */
export function splitSquares(text: string): string[] {
  return text.split(SQUARE_PATTERN);
}

/** Text with every square in it set as a mono chip; reads exactly as the plain text. */
export function SquareText({ text }: { text: string }) {
  return (
    <>
      {splitSquares(text).map((part, index) =>
        index % 2 === 1 ? (
          <SquareChip key={index}>{part}</SquareChip>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
