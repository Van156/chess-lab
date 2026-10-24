import { Button } from "@b2c-template/ui/components/button";
import { Card } from "@b2c-template/ui/components/card";

import { ChessBoard, MoveList, SanInput } from "@/shared/components/board";
import PageHeader from "@/shared/components/layout/page-header";

import { inRepertoire } from "../lib/explorer-view";
import { describeNote } from "../lib/idea-note";
import { formatLine } from "../lib/repertoire-tree";
import type {
  IdeaNote,
  RepertoireData,
  RepertoireMove,
  RepertoirePosition,
} from "../lib/repertoire-types";
import ExplorerBandSelect from "./explorer-band-select";
import ExplorerPanel, { type ExplorerPanelState } from "./explorer-panel";
import IdeaNoteEditor from "./idea-note-editor";
import LineNavigator from "./line-navigator";

export type RepertoireBuilderViewProps = {
  repertoire: RepertoireData["repertoire"];
  position: RepertoirePosition;
  path: readonly RepertoireMove[];
  childMoves: readonly RepertoireMove[];
  /** Explorer stats for this position; whatever it holds, the rest of the builder works. */
  explorer: ExplorerPanelState;
  /** The note being edited; the board and the text below it show this one. */
  note: IdeaNote;
  noteDirty: boolean;
  saving: boolean;
  /** The explorer band is being saved. */
  bandSaving: boolean;
  /** A move from the board, the text field or the explorer, as SAN; the caller adds it to the tree. */
  onPlayMove: (san: string) => void;
  /** An explorer band offset from -2 to 2; the caller saves it. */
  onChangeBandOffset: (offset: number) => void;
  onSelectPly: (ply: number) => void;
  onSelectChild: (move: RepertoireMove) => void;
  onRequestDelete: (move: RepertoireMove) => void;
  onNoteChange: (note: IdeaNote) => void;
  onSaveNote: () => void;
  onClearNote: () => void;
};

/**
 * Repertoire builder (presentational): the board for the current position with its idea note,
 * a typed-move field beside it, the line so far, the moves that continue it and the note editor.
 * One column at 375 px; board and controls side by side from the large breakpoint.
 */
export default function RepertoireBuilderView({
  repertoire,
  position,
  path,
  childMoves,
  explorer,
  note,
  noteDirty,
  saving,
  bandSaving,
  onPlayMove,
  onChangeBandOffset,
  onSelectPly,
  onSelectChild,
  onRequestDelete,
  onNoteChange,
  onSaveNote,
  onClearNote,
}: RepertoireBuilderViewProps) {
  const side = position.sideToMove === "w" ? "White" : "Black";
  const lastMove = path[path.length - 1];
  const colour = repertoire.color === "white" ? "White" : "Black";
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title={repertoire.name}
        description={`Playing ${colour}. Play or type a move to add it to the tree.`}
        breadcrumbs={[{ label: "Repertoires", to: "/repertoire" }, { label: repertoire.name }]}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-3 rounded-2xl p-4">
          <ChessBoard
            fen={position.fen}
            orientation={repertoire.color}
            onMove={(move) => {
              onPlayMove(move.san);
              // The board stays on the current position; it jumps once the tree has the move.
              return false;
            }}
            arrows={note.arrows}
            highlights={note.highlights}
            lastMove={
              lastMove
                ? { from: lastMove.uci.slice(0, 2), to: lastMove.uci.slice(2, 4) }
                : undefined
            }
            label={`Chess position, line: ${formatLine(path)}. ${side} to move. ${describeNote(note)}`}
          />
          <SanInput fen={position.fen} onMove={onPlayMove} label="Type a move to add it" />
          <p className="text-sm" data-slot="note-text-alternative">
            <span className="font-medium">Idea note:</span> {describeNote(note)}
          </p>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 rounded-2xl p-4 md:p-6">
            <h2 className="text-xl font-semibold">Current line</h2>
            <MoveList
              moves={path.map((move) => move.san)}
              currentPly={path.length}
              onSelect={onSelectPly}
            />
            <LineNavigator
              path={path}
              childMoves={childMoves}
              onSelectPly={onSelectPly}
              onSelectChild={onSelectChild}
              onDelete={onRequestDelete}
            />
          </Card>
          <Card className="rounded-2xl p-4 md:p-6">
            <ExplorerPanel
              state={explorer}
              childMoves={childMoves}
              bandControl={
                explorer.kind === "loaded" ? (
                  <ExplorerBandSelect
                    ownBand={explorer.data.ownBand}
                    band={explorer.data.band}
                    pending={bandSaving}
                    onChange={onChangeBandOffset}
                  />
                ) : undefined
              }
              moveAction={(move) =>
                inRepertoire(move.san, childMoves) ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={saving}
                    aria-label={`Add ${move.san} to the repertoire`}
                    onClick={() => onPlayMove(move.san)}
                  >
                    Add
                  </Button>
                )
              }
            />
          </Card>
          <Card className="rounded-2xl p-4 md:p-6">
            <IdeaNoteEditor
              note={note}
              dirty={noteDirty}
              saving={saving}
              onChange={onNoteChange}
              onSave={onSaveNote}
              onClear={onClearNote}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
