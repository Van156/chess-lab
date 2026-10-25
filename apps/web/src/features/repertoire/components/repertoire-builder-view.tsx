import { Button } from "@b2c-template/ui/components/button";
import { Card } from "@b2c-template/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@b2c-template/ui/components/tabs";

import { ChessBoard, SanInput, type BoardArrow } from "@/shared/components/board";
import PageHeader from "@/shared/components/layout/page-header";

import { inRepertoire } from "../lib/explorer-view";
import { describeNote } from "../lib/idea-note";
import { lineColour } from "../lib/line-colours";
import type { PreviewView } from "../lib/line-preview";
import type { Opening } from "../lib/opening-lookup";
import type { MoveRank } from "../lib/continuation-ranking";
import { formatLine } from "../lib/repertoire-tree";
import type {
  IdeaNote,
  RepertoireData,
  RepertoireMove,
  RepertoirePosition,
} from "../lib/repertoire-types";
import type { EngineView } from "../lib/suggestion-state";
import type { TreeLine } from "../lib/variation-tree";
import BaseLineHeader from "./base-line-header";
import BoardToolbar from "./board-toolbar";
import EnginePanel from "./engine-panel";
import EvalBar from "./eval-bar";
import ExplorerBandSelect from "./explorer-band-select";
import ExplorerPanel, { type ExplorerPanelState } from "./explorer-panel";
import IdeaNoteEditor from "./idea-note-editor";
import LineNavigator from "./line-navigator";
import LinePreviewBar from "./line-preview-bar";
import VariationTree from "./variation-tree";

export type RepertoireBuilderViewProps = {
  repertoire: RepertoireData["repertoire"];
  position: RepertoirePosition;
  path: readonly RepertoireMove[];
  /** The repertoire's moves from this position; the explorer marks the ones it already has. */
  childMoves: readonly RepertoireMove[];
  /** The whole repertoire as an outline; memoised by the caller on the graph and the path. */
  tree: TreeLine;
  /** The whole repertoire from the start; null when no base hides the moves before it. */
  fullTree: TreeLine | null;
  /** The engine's grades of the analysed continuations by move id; change once per finished search. */
  rankings: ReadonlyMap<string, MoveRank>;
  startPositionId: string;
  /** The base position; null when none is set. */
  basePositionId: string | null;
  /** The moves from the start to the base; empty when none is set. Memoised by the caller. */
  baseLine: readonly RepertoireMove[];
  /** A base change is being saved. */
  baseSaving: boolean;
  /** The opening name of this position or the last named one on the path; null when none is known yet. */
  opening: Opening | null;
  /** Explorer stats for this position; whatever it holds, the rest of the builder works. */
  explorer: ExplorerPanelState;
  /** Stockfish suggestions for this position: the panel and the eval bar share. */
  engine: EngineView;
  /** Everything drawn on the board: the idea note, the engine lines and the repertoire moves. */
  boardArrows: readonly BoardArrow[];
  /** The same arrows in words, for the board's accessible label. */
  boardArrowText: string;
  /** How many engine lines the board draws, 1 to 5. */
  lineCount: number;
  /** The engine line being previewed on the board; `null` when the board shows the position itself. */
  preview: PreviewView | null;
  showRepertoireArrows: boolean;
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
  /** The engine switch; the caller remembers the choice. */
  onToggleEngine: (on: boolean) => void;
  onRetryEngine: () => void;
  /** Previews an engine line, by its rank counted from 0. */
  onPreviewLine: (rank: number) => void;
  onPreviewPrevious: () => void;
  onPreviewNext: () => void;
  /** Leaves the preview and shows the position it started from. */
  onPreviewExit: () => void;
  onChangeLineCount: (count: number) => void;
  onToggleRepertoireArrows: (on: boolean) => void;
  onSelectPly: (ply: number) => void;
  /** Jumps to a tree move's position by its route. The tree is memoised: keep this stable. */
  onSelectNode: (positionId: string, route: string[]) => void;
  /** Makes the position being shown the base. */
  onSetBase: () => void;
  onClearBase: () => void;
  /** Asks to delete a tree move by id. The tree is memoised: keep this stable. */
  onDeleteNode: (moveId: string) => void;
  /** Names the study line that starts with a tree move; null clears it. The tree is memoised: keep this stable. */
  onRenameLine: (moveId: string, name: string | null) => void;
  onRequestDelete: (move: RepertoireMove) => void;
  onNoteChange: (note: IdeaNote) => void;
  onSaveNote: () => void;
  onClearNote: () => void;
};

const railTab = "min-h-11";

/** While previewing, the board draws only the line's next move, in the line's colour. */
function previewArrows(preview: PreviewView): BoardArrow[] {
  return preview.nextArrow ? [{ ...preview.nextArrow, color: lineColour(preview.rank).color }] : [];
}

/**
 * Repertoire builder (presentational), "Board + rail": a board column with the opening name and
 * the lines toolbar above the board and the path, the typed-move field and the note text below it,
 * and a rail of tabs (Tree, Engine, Explorer, Notes) beside it. The opening name has a reserved
 * line, so the board does not move when a name appears. The rail stacks below the board at narrow
 * widths.
 *
 * The board is as wide as the screen height allows, never below 26rem, with the eval bar beside it
 * at the board's height; the bar is hidden while the engine is off. Every rail panel stays mounted,
 * so the tree keeps its folds and the note editor keeps its focus while another tab is shown. The
 * tree takes only its memoised model and stable callbacks, so engine frames never re-render it.
 * Above the tree, the base line header shows the repertoire's base (or the start position) and sets
 * or clears it; the tree and the line navigator begin at the base.
 *
 * While an engine line is previewed, the board shows the line's position instead, with the preview
 * bar in place of the lines toolbar; it takes no moves and the typed-move field is hidden, so
 * nothing can be added from a position that is not in the tree.
 */
export default function RepertoireBuilderView({
  repertoire,
  position,
  path,
  childMoves,
  tree,
  fullTree,
  rankings,
  startPositionId,
  basePositionId,
  baseLine,
  baseSaving,
  opening,
  explorer,
  engine,
  boardArrows,
  boardArrowText,
  lineCount,
  preview,
  showRepertoireArrows,
  note,
  noteDirty,
  saving,
  bandSaving,
  onPlayMove,
  onChangeBandOffset,
  onToggleEngine,
  onRetryEngine,
  onPreviewLine,
  onPreviewPrevious,
  onPreviewNext,
  onPreviewExit,
  onChangeLineCount,
  onToggleRepertoireArrows,
  onSelectPly,
  onSelectNode,
  onSetBase,
  onClearBase,
  onDeleteNode,
  onRenameLine,
  onRequestDelete,
  onNoteChange,
  onSaveNote,
  onClearNote,
}: RepertoireBuilderViewProps) {
  const side = position.sideToMove === "w" ? "White" : "Black";
  const lastMove = path[path.length - 1];
  const lastMoveSquares = lastMove
    ? { from: lastMove.uci.slice(0, 2), to: lastMove.uci.slice(2, 4) }
    : undefined;
  const colour = repertoire.color === "white" ? "White" : "Black";
  const boardLabel = preview
    ? `Chess position, previewing engine line ${preview.rank + 1} (${lineColour(preview.rank).name}), move ${preview.cursor} of ${preview.total}: ${preview.san}. ${preview.fen.split(" ")[1] === "b" ? "Black" : "White"} to move.`
    : `Chess position, line: ${formatLine(path)}. ${side} to move. ${describeNote(note)} ${boardArrowText}`.trim();
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2">
      <PageHeader
        title={repertoire.name}
        description={`Playing ${colour}. Play or type a move to add it to the tree.`}
        breadcrumbs={[{ label: "Repertoires", to: "/repertoire" }, { label: repertoire.name }]}
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section
          aria-label="Board"
          className="flex w-full min-w-0 flex-col gap-2 lg:w-[max(26rem,calc(100dvh-19rem))] lg:shrink-0"
        >
          <p
            data-slot="opening-name"
            className="min-h-6 truncate text-sm font-medium"
            title={opening ? `${opening.eco} · ${opening.name}` : undefined}
          >
            {opening ? `${opening.eco} · ${opening.name}` : null}
          </p>
          {preview ? (
            <LinePreviewBar
              view={preview}
              onPrevious={onPreviewPrevious}
              onNext={onPreviewNext}
              onExit={onPreviewExit}
            />
          ) : (
            <BoardToolbar
              lineCount={lineCount}
              onChangeLineCount={onChangeLineCount}
              showRepertoireArrows={showRepertoireArrows}
              onToggleRepertoireArrows={onToggleRepertoireArrows}
            />
          )}
          <div className="flex items-stretch gap-2">
            {engine.panel.kind === "off" ? null : (
              <EvalBar
                whitePercent={engine.whitePercent}
                orientation={repertoire.color}
                className="h-auto self-stretch"
              />
            )}
            <div className="min-w-0 flex-1">
              <ChessBoard
                fen={preview?.fen ?? position.fen}
                orientation={repertoire.color}
                // A previewed position is not part of the tree, so the board takes no moves then.
                onMove={
                  preview
                    ? undefined
                    : (move) => {
                        onPlayMove(move.san);
                        // The board stays on the current position; it jumps once the tree has the move.
                        return false;
                      }
                }
                arrows={preview ? previewArrows(preview) : boardArrows}
                highlights={preview ? undefined : note.highlights}
                lastMove={preview?.lastMove ?? lastMoveSquares}
                label={boardLabel}
              />
            </div>
          </div>
          <LineNavigator
            path={path}
            basePositionId={basePositionId}
            onSelectPly={onSelectPly}
            onDelete={onRequestDelete}
          />
          {preview ? null : (
            <SanInput fen={position.fen} onMove={onPlayMove} label="Type a move to add it" />
          )}
          <p className="text-sm" data-slot="note-text-alternative">
            <span className="font-medium">Idea note:</span> {describeNote(note)}
          </p>
        </section>

        <Card className="min-w-0 flex-1 rounded-2xl p-3 md:p-4 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto">
          <Tabs defaultValue="tree">
            <TabsList variant="line" className="w-full group-data-horizontal/tabs:h-auto">
              <TabsTrigger value="tree" className={railTab}>
                Tree
              </TabsTrigger>
              <TabsTrigger value="engine" className={railTab}>
                Engine
              </TabsTrigger>
              <TabsTrigger value="explorer" className={railTab}>
                Explorer
              </TabsTrigger>
              <TabsTrigger value="notes" className={railTab}>
                Notes
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tree" keepMounted className="pt-2">
              <div className="flex flex-col gap-1">
                <BaseLineHeader
                  baseLine={baseLine}
                  startPositionId={startPositionId}
                  basePositionId={basePositionId}
                  currentPositionId={position.id}
                  saving={baseSaving}
                  onSelect={onSelectNode}
                  onSetBase={onSetBase}
                  onClearBase={onClearBase}
                />
                <VariationTree
                  tree={tree}
                  fullTree={fullTree}
                  rankings={rankings}
                  onSelect={onSelectNode}
                  onDelete={onDeleteNode}
                  onRename={onRenameLine}
                />
              </div>
            </TabsContent>
            <TabsContent value="engine" keepMounted className="pt-2">
              <EnginePanel
                state={engine.panel}
                addPending={saving}
                previewRank={preview?.rank ?? null}
                onPreview={onPreviewLine}
                onToggle={onToggleEngine}
                onAdd={onPlayMove}
                onRetry={onRetryEngine}
              />
            </TabsContent>
            <TabsContent value="explorer" keepMounted className="pt-2">
              <ExplorerPanel
                state={explorer}
                childMoves={childMoves}
                bandControl={
                  explorer.kind === "loaded" ? (
                    <ExplorerBandSelect
                      ownBand={explorer.data.ownBand}
                      offset={explorer.data.offset}
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
            </TabsContent>
            <TabsContent value="notes" keepMounted className="pt-2">
              <IdeaNoteEditor
                note={note}
                dirty={noteDirty}
                saving={saving}
                onChange={onNoteChange}
                onSave={onSaveNote}
                onClear={onClearNote}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
