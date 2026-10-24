import { Button } from "@b2c-template/ui/components/button";
import { Card } from "@b2c-template/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@b2c-template/ui/components/tabs";

import { ChessBoard, SanInput, type BoardArrow } from "@/shared/components/board";
import PageHeader from "@/shared/components/layout/page-header";

import { inRepertoire } from "../lib/explorer-view";
import { describeNote } from "../lib/idea-note";
import type { Opening } from "../lib/opening-lookup";
import { formatLine } from "../lib/repertoire-tree";
import type {
  IdeaNote,
  RepertoireData,
  RepertoireMove,
  RepertoirePosition,
} from "../lib/repertoire-types";
import type { EngineView } from "../lib/suggestion-state";
import type { TreeLine } from "../lib/variation-tree";
import BoardToolbar from "./board-toolbar";
import EnginePanel from "./engine-panel";
import EvalBar from "./eval-bar";
import ExplorerBandSelect from "./explorer-band-select";
import ExplorerPanel, { type ExplorerPanelState } from "./explorer-panel";
import IdeaNoteEditor from "./idea-note-editor";
import LineNavigator from "./line-navigator";
import VariationTree from "./variation-tree";

export type RepertoireBuilderViewProps = {
  repertoire: RepertoireData["repertoire"];
  position: RepertoirePosition;
  path: readonly RepertoireMove[];
  /** The repertoire's moves from this position; the explorer marks the ones it already has. */
  childMoves: readonly RepertoireMove[];
  /** The whole repertoire as an outline; memoised by the caller on the graph and the path. */
  tree: TreeLine;
  startPositionId: string;
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
  onChangeLineCount: (count: number) => void;
  onToggleRepertoireArrows: (on: boolean) => void;
  onSelectPly: (ply: number) => void;
  /** Jumps to a tree move's position by its route. The tree is memoised: keep this stable. */
  onSelectNode: (positionId: string, route: string[]) => void;
  /** Asks to delete a tree move by id. The tree is memoised: keep this stable. */
  onDeleteNode: (moveId: string) => void;
  onRequestDelete: (move: RepertoireMove) => void;
  onNoteChange: (note: IdeaNote) => void;
  onSaveNote: () => void;
  onClearNote: () => void;
};

const railTab = "min-h-11";

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
 */
export default function RepertoireBuilderView({
  repertoire,
  position,
  path,
  childMoves,
  tree,
  startPositionId,
  opening,
  explorer,
  engine,
  boardArrows,
  boardArrowText,
  lineCount,
  showRepertoireArrows,
  note,
  noteDirty,
  saving,
  bandSaving,
  onPlayMove,
  onChangeBandOffset,
  onToggleEngine,
  onRetryEngine,
  onChangeLineCount,
  onToggleRepertoireArrows,
  onSelectPly,
  onSelectNode,
  onDeleteNode,
  onRequestDelete,
  onNoteChange,
  onSaveNote,
  onClearNote,
}: RepertoireBuilderViewProps) {
  const side = position.sideToMove === "w" ? "White" : "Black";
  const lastMove = path[path.length - 1];
  const colour = repertoire.color === "white" ? "White" : "Black";
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
          <BoardToolbar
            lineCount={lineCount}
            onChangeLineCount={onChangeLineCount}
            showRepertoireArrows={showRepertoireArrows}
            onToggleRepertoireArrows={onToggleRepertoireArrows}
          />
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
                fen={position.fen}
                orientation={repertoire.color}
                onMove={(move) => {
                  onPlayMove(move.san);
                  // The board stays on the current position; it jumps once the tree has the move.
                  return false;
                }}
                arrows={boardArrows}
                highlights={note.highlights}
                lastMove={
                  lastMove
                    ? { from: lastMove.uci.slice(0, 2), to: lastMove.uci.slice(2, 4) }
                    : undefined
                }
                label={`Chess position, line: ${formatLine(path)}. ${side} to move. ${describeNote(note)} ${boardArrowText}`.trim()}
              />
            </div>
          </div>
          <LineNavigator path={path} onSelectPly={onSelectPly} onDelete={onRequestDelete} />
          <SanInput fen={position.fen} onMove={onPlayMove} label="Type a move to add it" />
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
              <VariationTree
                tree={tree}
                startPositionId={startPositionId}
                atStart={path.length === 0}
                onSelect={onSelectNode}
                onDelete={onDeleteNode}
              />
            </TabsContent>
            <TabsContent value="engine" keepMounted className="pt-2">
              <EnginePanel
                state={engine.panel}
                addPending={saving}
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
