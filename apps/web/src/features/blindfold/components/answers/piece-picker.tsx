import { Button } from "@b2c-template/ui/components/button";
import { Kbd } from "@b2c-template/ui/components/kbd";
import { Square } from "lucide-react";

import type { PieceColour, PieceLetter } from "../../lib/drills/types";
import PieceGlyph from "./piece-glyph";
import { EMPTY_CODE, PIECE_LETTERS, PIECE_NAMES, pieceCode } from "./pieces";
import { useAnswerKeys } from "./use-answer-keys";

export type PiecePickerProps = {
  /** Called with a `"wN"`-style code or `"empty"`. */
  onSubmit: (answer: string) => void;
};

const COLOURS: readonly { colour: PieceColour; label: string }[] = [
  { colour: "white", label: "White" },
  { colour: "black", label: "Black" },
];

const EMPTY_KEY = "E";

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The code a key press picks (lower-case key), or `null` when the key is not a shortcut. */
export function pieceForKey(key: string, shift: boolean): string | null {
  if (key === EMPTY_KEY.toLowerCase()) return shift ? null : EMPTY_CODE;
  const piece = PIECE_LETTERS.find((letter) => letter.toLowerCase() === key);
  return piece ? pieceCode(shift ? "black" : "white", piece) : null;
}

/**
 * Colour by piece grid plus Empty. Keys follow FEN: a piece letter picks the white piece,
 * Shift and the letter the black one, E picks Empty.
 */
export default function PiecePicker({ onSubmit }: PiecePickerProps) {
  useAnswerKeys((key, shift) => {
    const answer = pieceForKey(key, shift);
    if (answer === null) return false;
    onSubmit(answer);
    return true;
  });

  return (
    <div role="group" aria-label="What stands on the square" className="flex flex-col gap-3">
      {COLOURS.map(({ colour, label }) => (
        <div
          key={colour}
          role="group"
          aria-label={`${label} pieces`}
          className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3"
        >
          <span aria-hidden className="w-12 shrink-0 text-sm text-muted-foreground">
            {label}
          </span>
          <div className="grid flex-1 grid-cols-6 gap-1.5 sm:gap-2">
            {PIECE_LETTERS.map((piece) => (
              <PieceButton
                key={piece}
                colour={colour}
                piece={piece}
                onPick={() => onSubmit(pieceCode(colour, piece))}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex sm:pl-15">
        <Button
          type="button"
          variant="outline"
          aria-keyshortcuts={EMPTY_KEY}
          onClick={() => onSubmit(EMPTY_CODE)}
          className="h-11 w-full justify-center gap-3 rounded-lg px-4 sm:w-auto sm:min-w-40 sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <Square aria-hidden className="text-muted-foreground" />
            Empty
          </span>
          <Kbd aria-hidden className="hidden sm:inline-flex">
            {EMPTY_KEY}
          </Kbd>
        </Button>
      </div>
      <p className="hidden text-xs text-muted-foreground sm:block">
        Keys: <Kbd>K</Kbd> <Kbd>Q</Kbd> <Kbd>R</Kbd> <Kbd>B</Kbd> <Kbd>N</Kbd> <Kbd>P</Kbd> for
        White, with <Kbd>Shift</Kbd> for Black.
      </p>
    </div>
  );
}

function PieceButton({
  colour,
  piece,
  onPick,
}: {
  colour: PieceColour;
  piece: PieceLetter;
  onPick: () => void;
}) {
  const name = `${capitalise(colour)} ${PIECE_NAMES[piece]}`;
  const shortcut = colour === "white" ? piece : `Shift+${piece}`;
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={name}
      aria-keyshortcuts={shortcut}
      title={name}
      onClick={onPick}
      className="h-auto flex-col gap-1 rounded-lg px-0 py-2 sm:py-2.5"
    >
      <PieceGlyph colour={colour} piece={piece} className="text-2xl sm:text-[1.75rem]" />
      <span className="text-[11px] leading-none text-muted-foreground capitalize sm:text-xs">
        {PIECE_NAMES[piece]}
      </span>
    </Button>
  );
}
